// Speech-to-text endpoint. Accepts multipart/form-data with an `audio` file,
// forwards it to the Lovable AI Gateway transcription endpoint, and returns
// the transcript as JSON: { text: string }.
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/transcribe")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const key = process.env.LOVABLE_API_KEY;
        if (!key) {
          return new Response(
            JSON.stringify({ error: "LOVABLE_API_KEY not configured" }),
            { status: 500, headers: { "Content-Type": "application/json" } },
          );
        }

        let form: FormData;
        try {
          form = await request.formData();
        } catch {
          return new Response(
            JSON.stringify({ error: "Expected multipart/form-data" }),
            { status: 400, headers: { "Content-Type": "application/json" } },
          );
        }

        const audio = form.get("audio");
        if (!(audio instanceof Blob) || audio.size < 512) {
          return new Response(
            JSON.stringify({ error: "Recording was empty — please try again." }),
            { status: 400, headers: { "Content-Type": "application/json" } },
          );
        }

        // Cap upload at ~24 MiB to stay under the Gateway limit.
        if (audio.size > 24 * 1024 * 1024) {
          return new Response(
            JSON.stringify({ error: "Recording too long. Keep it under ~2 minutes." }),
            { status: 413, headers: { "Content-Type": "application/json" } },
          );
        }

        const filename =
          audio instanceof File && audio.name ? audio.name : "recording.wav";

        const upstream = new FormData();
        // gpt-4o-transcribe gives higher multilingual accuracy than the mini
        // variant. Omit `language` so the model auto-detects (English, Hindi,
        // Telugu, Urdu, etc.) instead of assuming one language.
        upstream.append("model", "openai/gpt-4o-transcribe");
        upstream.append("file", audio, filename);
        upstream.append(
          "prompt",
          "The speaker may speak in English, Hindi, Telugu, or Urdu, and may switch between them mid-sentence. Transcribe each language in its native script.",
        );

        const res = await fetch(
          "https://ai.gateway.lovable.dev/v1/audio/transcriptions",
          {
            method: "POST",
            headers: { Authorization: `Bearer ${key}` },
            body: upstream,
          },
        );

        const body = await res.text();
        if (!res.ok) {
          return new Response(
            JSON.stringify({ error: `Transcription failed (${res.status}): ${body.slice(0, 300)}` }),
            { status: res.status, headers: { "Content-Type": "application/json" } },
          );
        }

        try {
          const parsed = JSON.parse(body);
          const text: string = (parsed.text ?? "").toString().trim();
          return new Response(JSON.stringify({ text }), {
            headers: { "Content-Type": "application/json" },
          });
        } catch {
          return new Response(
            JSON.stringify({ error: "Unexpected transcription response" }),
            { status: 502, headers: { "Content-Type": "application/json" } },
          );
        }
      },
    },
  },
});
