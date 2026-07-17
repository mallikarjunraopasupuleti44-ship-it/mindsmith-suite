import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Plus, Send, Trash2 } from "lucide-react";
import ReactMarkdown from "react-markdown";
import {
  getEmployeeBySlug,
  listThreads,
  createThread,
  deleteThread,
  getThreadMessages,
  sendEmployeeMessage,
} from "@/lib/employees.functions";

export const Route = createFileRoute("/_authenticated/dashboard/employees/$slug")({
  component: EmployeeChatPage,
});

function EmployeeChatPage() {
  const { slug } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const getEmp = useServerFn(getEmployeeBySlug);
  const listThr = useServerFn(listThreads);
  const createThr = useServerFn(createThread);
  const delThr = useServerFn(deleteThread);
  const getMsgs = useServerFn(getThreadMessages);
  const sendMsg = useServerFn(sendEmployeeMessage);

  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);

  const empQ = useQuery({ queryKey: ["employee", slug], queryFn: () => getEmp({ data: { slug } }) });
  const threadsQ = useQuery({
    queryKey: ["employee-threads", empQ.data?.id],
    queryFn: () => listThr({ data: { employeeId: empQ.data!.id } }),
    enabled: !!empQ.data?.id,
  });

  // Auto-select most recent thread, or create one if none exists
  useEffect(() => {
    if (!threadsQ.data || activeThreadId) return;
    if (threadsQ.data.length > 0) {
      setActiveThreadId(threadsQ.data[0].id);
    }
  }, [threadsQ.data, activeThreadId]);

  const messagesQ = useQuery({
    queryKey: ["employee-thread-messages", activeThreadId],
    queryFn: () => getMsgs({ data: { threadId: activeThreadId! } }),
    enabled: !!activeThreadId,
  });

  useEffect(() => {
    scrollerRef.current?.scrollTo({ top: scrollerRef.current.scrollHeight, behavior: "smooth" });
  }, [messagesQ.data?.messages?.length]);

  useEffect(() => {
    inputRef.current?.focus();
  }, [activeThreadId, empQ.data?.id]);

  const newThread = useMutation({
    mutationFn: async () => createThr({ data: { employeeId: empQ.data!.id } }),
    onSuccess: (t) => {
      qc.invalidateQueries({ queryKey: ["employee-threads", empQ.data?.id] });
      setActiveThreadId(t.id);
    },
  });

  const removeThread = useMutation({
    mutationFn: async (id: string) => delThr({ data: { threadId: id } }),
    onSuccess: (_r, id) => {
      qc.invalidateQueries({ queryKey: ["employee-threads", empQ.data?.id] });
      if (activeThreadId === id) setActiveThreadId(null);
    },
  });

  const send = useMutation({
    mutationFn: async (content: string) => {
      let tid = activeThreadId;
      if (!tid) {
        const t = await createThr({ data: { employeeId: empQ.data!.id } });
        tid = t.id;
        setActiveThreadId(tid);
        qc.invalidateQueries({ queryKey: ["employee-threads", empQ.data?.id] });
      }
      return sendMsg({ data: { threadId: tid, content } });
    },
    onMutate: async (content) => {
      if (!activeThreadId) return;
      const key = ["employee-thread-messages", activeThreadId];
      await qc.cancelQueries({ queryKey: key });
      const prev = qc.getQueryData<any>(key);
      qc.setQueryData(key, (old: any) => ({
        thread: old?.thread,
        messages: [...(old?.messages ?? []), { id: "optimistic", role: "user", content, created_at: new Date().toISOString() }],
      }));
      return { prev, key };
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["employee-thread-messages", activeThreadId] });
      qc.invalidateQueries({ queryKey: ["employee-threads", empQ.data?.id] });
    },
  });

  const submit = () => {
    const v = input.trim();
    if (!v || send.isPending || !empQ.data) return;
    setInput("");
    send.mutate(v);
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  if (empQ.isLoading) return <div className="glass-panel p-6 text-sm text-slate-500">Loading employee…</div>;
  if (empQ.error) return <div className="glass-panel p-4 text-sm text-red-600">{(empQ.error as Error).message}</div>;
  const emp = empQ.data!;

  return (
    <div className="space-y-4">
      <button
        onClick={() => navigate({ to: "/dashboard/employees" })}
        className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-foreground transition"
      >
        <ArrowLeft className="h-4 w-4" /> Back to team
      </button>

      <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-4">
        {/* Thread sidebar */}
        <div className="glass-panel p-3 space-y-2 h-fit lg:sticky lg:top-4">
          <div className="flex items-center gap-3 px-2 py-2">
            <div
              className="flex h-10 w-10 items-center justify-center rounded-xl text-lg font-bold text-white"
              style={{ background: emp.accent }}
            >
              {emp.icon}
            </div>
            <div className="min-w-0">
              <div className="font-display text-sm font-semibold truncate">{emp.role_title}</div>
            </div>
          </div>
          <button
            onClick={() => newThread.mutate()}
            disabled={newThread.isPending}
            className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50"
          >
            <Plus className="h-3.5 w-3.5" /> New conversation
          </button>
          <div className="max-h-[60vh] overflow-auto space-y-1 pt-1">
            {threadsQ.data?.map((t) => (
              <div
                key={t.id}
                className={`group flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs cursor-pointer transition ${
                  activeThreadId === t.id ? "bg-primary/10 text-primary" : "text-slate-600 hover:bg-white/60"
                }`}
              >
                <button
                  type="button"
                  onClick={() => setActiveThreadId(t.id)}
                  className="flex-1 text-left truncate"
                >
                  {t.title}
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (confirm("Delete this conversation?")) removeThread.mutate(t.id);
                  }}
                  className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-red-500"
                  aria-label="Delete conversation"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            ))}
            {threadsQ.data && threadsQ.data.length === 0 && (
              <div className="px-2 py-6 text-center text-xs text-slate-400">
                No conversations yet. Start one below.
              </div>
            )}
          </div>
        </div>

        {/* Chat panel */}
        <div className="glass-panel flex flex-col h-[70vh]">
          <div className="border-b border-white/40 px-5 py-3">
            <div className="font-display text-base font-semibold">{emp.role_title}</div>
            <p className="text-xs text-slate-500 line-clamp-1">{emp.specialty_description}</p>
          </div>

          <div ref={scrollerRef} className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
            {(!activeThreadId || (messagesQ.data && messagesQ.data.messages.length === 0)) && (
              <div className="rounded-2xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">
                Ask {emp.name.split(" ")[0]} anything about {emp.role_title.toLowerCase()}. They'll pull from
                your Knowledge base when relevant.
              </div>
            )}
            {messagesQ.data?.messages.map((m: any) => (
              <MessageBubble key={m.id} role={m.role} content={m.content} accent={emp.accent} />
            ))}
            {send.isPending && (
              <div className="flex items-center gap-2 text-xs text-slate-400">
                <span className="inline-block h-2 w-2 rounded-full bg-primary animate-pulse" />
                {emp.name.split(" ")[0]} is thinking…
              </div>
            )}
          </div>

          <div className="border-t border-white/40 p-3">
            <div className="flex items-end gap-2">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    submit();
                  }
                }}
                rows={2}
                placeholder={`Message ${emp.name.split(" ")[0]}…`}
                className="flex-1 resize-none rounded-xl border border-white/60 bg-white/60 px-3 py-2 text-sm outline-none focus:border-primary/40"
              />
              <button
                onClick={submit}
                disabled={!input.trim() || send.isPending}
                className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
              >
                <Send className="h-4 w-4" /> Send
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function MessageBubble({ role, content, accent }: { role: string; content: string; accent: string }) {
  const isUser = role === "user";
  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm ${
          isUser
            ? "bg-primary text-primary-foreground"
            : "bg-white/70 border border-white/60 text-foreground"
        }`}
        style={!isUser ? { borderLeft: `3px solid ${accent}` } : undefined}
      >
        {isUser ? (
          <div className="whitespace-pre-wrap">{content}</div>
        ) : (
          <div className="prose prose-sm max-w-none prose-p:my-1 prose-headings:my-2">
            <ReactMarkdown>{content}</ReactMarkdown>
          </div>
        )}
      </div>
    </div>
  );
}
