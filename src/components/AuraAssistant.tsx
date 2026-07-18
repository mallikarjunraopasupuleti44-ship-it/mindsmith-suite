import { useEffect, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Sparkles, X, Minus, Send, Loader2 } from "lucide-react";
import { chatWithAssistant } from "@/lib/assistant.functions";
import { AtomLogo } from "./AtomLogo";

type Msg = { role: "user" | "assistant"; content: string; ts: number };

const WELCOME: Msg = {
  role: "assistant",
  ts: Date.now(),
  content:
    "Hello 👋 I'm the Aura AI Website Assistant. I can explain everything about Aura AI — features, AI Employees, Knowledge Base, Automation, Reports, Business Planning, Security, Pricing, and how to use the platform. Ask me anything.",
};

const SUGGESTIONS = [
  "What is Aura AI?",
  "How does it work?",
  "What are AI Employees?",
  "How do I upload my business knowledge?",
  "Can Aura AI automate my business?",
  "What AI agents are available?",
  "How does pricing work?",
  "Is my data secure?",
  "Can I edit my business later?",
  "How do reports work?",
];

function renderMarkdown(text: string) {
  // ultra-light markdown: **bold**, bullet lines, line breaks
  const lines = text.split(/\r?\n/);
  const out: React.ReactNode[] = [];
  let bullets: string[] = [];
  const flush = () => {
    if (bullets.length) {
      out.push(
        <ul key={out.length} className="list-disc pl-5 space-y-1">
          {bullets.map((b, i) => (
            <li key={i} dangerouslySetInnerHTML={{ __html: inline(b) }} />
          ))}
        </ul>,
      );
      bullets = [];
    }
  };
  const inline = (s: string) =>
    s
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
      .replace(/`([^`]+)`/g, '<code class="px-1 py-0.5 rounded bg-black/5 text-[0.85em]">$1</code>');
  for (const raw of lines) {
    const l = raw.trimEnd();
    const m = l.match(/^\s*[-•*]\s+(.*)$/);
    if (m) {
      bullets.push(m[1]);
    } else {
      flush();
      if (l.trim() === "") out.push(<div key={out.length} className="h-2" />);
      else
        out.push(
          <p key={out.length} className="leading-relaxed" dangerouslySetInnerHTML={{ __html: inline(l) }} />,
        );
    }
  }
  flush();
  return out;
}

export function AuraAssistant() {
  const [open, setOpen] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([WELCOME]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, open, minimized]);

  useEffect(() => {
    if (open && !minimized) inputRef.current?.focus();
  }, [open, minimized]);

  const send = async (text: string) => {
    const clean = text.trim();
    if (!clean || busy) return;
    const next: Msg[] = [...messages, { role: "user", content: clean, ts: Date.now() }];
    setMessages(next);
    setInput("");
    setBusy(true);
    try {
      const res = await chatWithAssistant({
        data: { messages: next.map(({ role, content }) => ({ role, content })) },
      });
      setMessages((m) => [...m, { role: "assistant", content: res.text, ts: Date.now() }]);
      if (res.navigateTo) {
        setTimeout(() => {
          navigate({ to: res.navigateTo as string }).catch(() => {});
        }, 400);
      }
    } catch {
      setMessages((m) => [
        ...m,
        { role: "assistant", content: "I couldn't reach the assistant service just now. Please try again.", ts: Date.now() },
      ]);
    } finally {
      setBusy(false);
    }
  };

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    send(input);
  };

  return (
    <>
      {/* Launcher */}
      {(!open || minimized) && (
        <button
          type="button"
          onClick={() => {
            setOpen(true);
            setMinimized(false);
          }}
          aria-label="Open Aura AI assistant"
          className="aura-launcher fixed z-[60] bottom-[20px] right-[20px] sm:bottom-[30px] sm:right-[30px] h-14 w-14 sm:h-16 sm:w-16 rounded-full flex items-center justify-center text-white"
        >
          <span className="aura-orb-icon">
            <Sparkles className="h-6 w-6 sm:h-7 sm:w-7 drop-shadow" />
          </span>
        </button>
      )}

      {/* Panel */}
      {open && !minimized && (
        <div className="fixed z-[60] bottom-[20px] right-[20px] sm:bottom-[30px] sm:right-[30px] left-[20px] sm:left-auto aura-panel flex flex-col overflow-hidden">
          {/* Header */}
          <div className="aura-header flex items-center gap-3 px-4 py-3">
            <div className="h-9 w-9 rounded-xl bg-white/40 backdrop-blur flex items-center justify-center shadow-inner">
              <AtomLogo size={22} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold text-slate-900 truncate">Aura AI Assistant</div>
              <div className="flex items-center gap-2 text-[11px] text-slate-600">
                <span className="inline-flex items-center gap-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 pulse-dot" />
                  Online
                </span>
                <span className="text-slate-400">·</span>
                <span className="truncate">Ask anything about Aura AI</span>
              </div>
            </div>
            <button
              onClick={() => setMinimized(true)}
              className="h-8 w-8 rounded-lg hover:bg-white/60 flex items-center justify-center text-slate-600"
              aria-label="Minimize"
              type="button"
            >
              <Minus className="h-4 w-4" />
            </button>
            <button
              onClick={() => {
                setOpen(false);
                setMinimized(false);
              }}
              className="h-8 w-8 rounded-lg hover:bg-white/60 flex items-center justify-center text-slate-600"
              aria-label="Close"
              type="button"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Messages */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                <div
                  className={
                    m.role === "user"
                      ? "max-w-[85%] rounded-2xl rounded-br-md px-3.5 py-2.5 text-sm text-white shadow-md aura-user-bubble"
                      : "max-w-[90%] rounded-2xl rounded-bl-md px-3.5 py-2.5 text-sm text-slate-800 bg-white/70 border border-white/60 backdrop-blur"
                  }
                >
                  <div className="space-y-2">{renderMarkdown(m.content)}</div>
                </div>
              </div>
            ))}
            {busy && (
              <div className="flex justify-start">
                <div className="rounded-2xl rounded-bl-md px-3.5 py-2.5 bg-white/70 border border-white/60 text-slate-500 text-sm inline-flex items-center gap-2">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> Thinking…
                </div>
              </div>
            )}

            {messages.length === 1 && !busy && (
              <div className="pt-2">
                <div className="text-[11px] uppercase tracking-wide text-slate-500 mb-2">Try asking</div>
                <div className="flex flex-wrap gap-1.5">
                  {SUGGESTIONS.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => send(s)}
                      className="text-[12px] px-3 py-1.5 rounded-full bg-white/70 hover:bg-white border border-white/70 text-slate-700 backdrop-blur transition"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Composer */}
          <form onSubmit={onSubmit} className="px-3 py-3 border-t border-white/50 bg-white/40 backdrop-blur">
            <div className="flex items-end gap-2">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    send(input);
                  }
                }}
                rows={1}
                placeholder="Ask about Aura AI…"
                className="flex-1 resize-none max-h-32 rounded-xl border border-white/70 bg-white/80 px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
              />
              <button
                type="submit"
                disabled={busy || !input.trim()}
                className="h-10 w-10 rounded-xl flex items-center justify-center text-white aura-send disabled:opacity-50"
                aria-label="Send"
              >
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
