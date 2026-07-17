// Push-to-talk mic button. Records mic audio via Web Audio, encodes it as
// a 16 kHz mono WAV file, POSTs it to /api/transcribe, and calls
// onTranscript with the returned text. Works across browsers (WAV avoids
// Safari's fragmented MP4 issue and MediaRecorder timeslice headers).
import { useCallback, useRef, useState } from "react";
import { Mic, Square, Loader2 } from "lucide-react";

type Props = {
  onTranscript: (text: string) => void;
  disabled?: boolean;
  className?: string;
  title?: string;
};

type Recorder = {
  stream: MediaStream;
  ctx: AudioContext;
  source: MediaStreamAudioSourceNode;
  processor: ScriptProcessorNode;
  chunks: Float32Array[];
};

function encodeWav(samples: Float32Array, sampleRate: number): Blob {
  const bytesPerSample = 2;
  const buffer = new ArrayBuffer(44 + samples.length * bytesPerSample);
  const view = new DataView(buffer);
  const writeString = (offset: number, s: string) => {
    for (let i = 0; i < s.length; i++) view.setUint8(offset + i, s.charCodeAt(i));
  };
  const dataSize = samples.length * bytesPerSample;
  writeString(0, "RIFF");
  view.setUint32(4, 36 + dataSize, true);
  writeString(8, "WAVE");
  writeString(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * bytesPerSample, true);
  view.setUint16(32, bytesPerSample, true);
  view.setUint16(34, 16, true);
  writeString(36, "data");
  view.setUint32(40, dataSize, true);
  let offset = 44;
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    offset += 2;
  }
  return new Blob([buffer], { type: "audio/wav" });
}

function downsample(input: Float32Array, inRate: number, outRate: number): Float32Array {
  if (outRate >= inRate) return input;
  const ratio = inRate / outRate;
  const outLen = Math.floor(input.length / ratio);
  const out = new Float32Array(outLen);
  for (let i = 0; i < outLen; i++) {
    const start = Math.floor(i * ratio);
    const end = Math.floor((i + 1) * ratio);
    let sum = 0;
    let count = 0;
    for (let j = start; j < end && j < input.length; j++) {
      sum += input[j];
      count++;
    }
    out[i] = count > 0 ? sum / count : 0;
  }
  return out;
}

export function MicButton({ onTranscript, disabled, className, title }: Props) {
  const [recording, setRecording] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const recRef = useRef<Recorder | null>(null);

  const start = useCallback(async () => {
    setErr(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const ctx = new AudioContext();
      const source = ctx.createMediaStreamSource(stream);
      const processor = ctx.createScriptProcessor(4096, 1, 1);
      const chunks: Float32Array[] = [];
      processor.onaudioprocess = (e) => {
        chunks.push(new Float32Array(e.inputBuffer.getChannelData(0)));
      };
      source.connect(processor);
      processor.connect(ctx.destination);
      recRef.current = { stream, ctx, source, processor, chunks };
      setRecording(true);
    } catch {
      setErr("Microphone access is needed.");
    }
  }, []);

  const stop = useCallback(async () => {
    const rec = recRef.current;
    recRef.current = null;
    setRecording(false);
    if (!rec) return;

    rec.processor.disconnect();
    rec.source.disconnect();
    rec.stream.getTracks().forEach((t) => t.stop());
    const inRate = rec.ctx.sampleRate;
    await rec.ctx.close();

    const total = rec.chunks.reduce((n, c) => n + c.length, 0);
    if (total < inRate * 0.25) {
      setErr("That was too short — try again.");
      return;
    }
    const merged = new Float32Array(total);
    let off = 0;
    for (const c of rec.chunks) {
      merged.set(c, off);
      off += c.length;
    }
    const targetRate = 16000;
    const resampled = downsample(merged, inRate, targetRate);
    const wav = encodeWav(resampled, targetRate);

    setBusy(true);
    try {
      const form = new FormData();
      form.append("audio", wav, "recording.wav");
      const res = await fetch("/api/transcribe", { method: "POST", body: form });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || `Transcription failed (${res.status})`);
      const text = (data.text || "").trim();
      if (!text) throw new Error("No speech detected.");
      onTranscript(text);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }, [onTranscript]);

  const toggle = () => (recording ? stop() : start());

  return (
    <div className={className}>
      <button
        type="button"
        onClick={toggle}
        disabled={disabled || busy}
        title={title || (recording ? "Stop recording" : "Record voice message")}
        aria-label={recording ? "Stop recording" : "Record voice message"}
        className={`inline-flex items-center justify-center rounded-xl px-3 py-2 text-sm font-semibold transition disabled:opacity-50 ${
          recording
            ? "bg-red-500 text-white animate-pulse"
            : "bg-white/60 border border-white/60 text-slate-600 hover:bg-white"
        }`}
      >
        {busy ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : recording ? (
          <Square className="h-4 w-4" />
        ) : (
          <Mic className="h-4 w-4" />
        )}
      </button>
      {err && <div className="mt-1 text-[10px] text-red-500">{err}</div>}
    </div>
  );
}
