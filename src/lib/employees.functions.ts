// Server functions for the AI Employees registry, threads, and chat.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { generateText } from "ai";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createGateway, CHAT_MODEL } from "./ai-gateway.server";
import { retrieveContext } from "./employee-retrieval.server";

export type EmployeeRow = {
  id: string;
  slug: string;
  name: string;
  role_title: string;
  icon: string;
  accent: string;
  specialty_description: string;
  system_prompt_template: string;
  sort_order: number;
};

export const listEmployees = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("ai_employees")
      .select("id, slug, name, role_title, icon, accent, specialty_description, system_prompt_template, sort_order")
      .eq("is_active", true)
      .order("sort_order");
    if (error) throw new Error(error.message);
    return (data ?? []) as EmployeeRow[];
  });

export const getEmployeeBySlug = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { slug: string }) => z.object({ slug: z.string() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: emp, error } = await context.supabase
      .from("ai_employees")
      .select("id, slug, name, role_title, icon, accent, specialty_description, system_prompt_template, sort_order")
      .eq("slug", data.slug)
      .eq("is_active", true)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!emp) throw new Error("Employee not found");
    return emp as EmployeeRow;
  });

export const listThreads = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { employeeId: string }) => z.object({ employeeId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("employee_threads")
      .select("id, title, updated_at, created_at")
      .eq("employee_id", data.employeeId)
      .eq("user_id", context.userId)
      .order("updated_at", { ascending: false });
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const createThread = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { employeeId: string; title?: string }) =>
    z.object({ employeeId: z.string().uuid(), title: z.string().optional() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("employee_threads")
      .insert({
        employee_id: data.employeeId,
        user_id: context.userId,
        title: data.title || "New conversation",
      })
      .select("id, title, updated_at, created_at")
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const deleteThread = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { threadId: string }) => z.object({ threadId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("employee_threads")
      .delete()
      .eq("id", data.threadId)
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const getThreadMessages = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { threadId: string }) => z.object({ threadId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: thread, error: te } = await context.supabase
      .from("employee_threads")
      .select("id, employee_id, title")
      .eq("id", data.threadId)
      .eq("user_id", context.userId)
      .maybeSingle();
    if (te) throw new Error(te.message);
    if (!thread) throw new Error("Thread not found");
    const { data: msgs, error } = await context.supabase
      .from("employee_messages")
      .select("id, role, content, created_at")
      .eq("thread_id", data.threadId)
      .order("created_at");
    if (error) throw new Error(error.message);
    return { thread, messages: msgs ?? [] };
  });

export const sendEmployeeMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { threadId: string; content: string }) =>
    z.object({ threadId: z.string().uuid(), content: z.string().min(1).max(8000) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    // Verify thread ownership + get employee
    const { data: thread, error: te } = await context.supabase
      .from("employee_threads")
      .select("id, employee_id, title")
      .eq("id", data.threadId)
      .eq("user_id", context.userId)
      .maybeSingle();
    if (te) throw new Error(te.message);
    if (!thread) throw new Error("Thread not found");

    const { data: emp, error: ee } = await context.supabase
      .from("ai_employees")
      .select("name, role_title, system_prompt_template")
      .eq("id", thread.employee_id)
      .maybeSingle();
    if (ee) throw new Error(ee.message);
    if (!emp) throw new Error("Employee not found");

    // Persist user message + load history
    const { error: insErr } = await context.supabase.from("employee_messages").insert({
      thread_id: thread.id,
      user_id: context.userId,
      role: "user",
      content: data.content,
    });
    if (insErr) throw new Error(insErr.message);

    const { data: history, error: hErr } = await context.supabase
      .from("employee_messages")
      .select("role, content")
      .eq("thread_id", thread.id)
      .order("created_at");
    if (hErr) throw new Error(hErr.message);

    // Hybrid retrieval from knowledge base
    const { block, source } = await retrieveContext(
      context.supabase,
      context.userId,
      data.content,
      5,
    );

    const kbBlock = block
      ? `\n\nRelevant context from the founder's knowledge base (source: ${source}):\n${block}\n\nUse this context when it applies. If it doesn't apply, ignore it and answer normally.`
      : "";
    const system = `${emp.system_prompt_template}${kbBlock}`;

    // Auto-title thread from first user message
    if (thread.title === "New conversation") {
      const newTitle = data.content.slice(0, 60).replace(/\s+/g, " ").trim();
      if (newTitle) {
        await context.supabase
          .from("employee_threads")
          .update({ title: newTitle })
          .eq("id", thread.id);
      }
    }

    // Hardened generate: JSON-only isn't required (conversational), but we
    // still retry once on outright failure and surface real errors.
    const gateway = createGateway();
    const model = gateway(CHAT_MODEL);
    const messages = (history ?? []).map((m: any) => ({
      role: m.role as "user" | "assistant" | "system",
      content: m.content,
    }));

    let reply = "";
    let errMsg: string | null = null;
    try {
      const { text } = await generateText({
        model,
        system,
        messages,
        maxOutputTokens: 2048,
      });
      reply = (text ?? "").trim();
      if (!reply) throw new Error("Empty response");
    } catch (err) {
      console.warn(`[employee:${emp.name}] first attempt failed`, (err as Error).message);
      try {
        const { text } = await generateText({
          model,
          system: `${system}\n\nREMINDER: Reply directly and clearly to the user's last message.`,
          messages,
          maxOutputTokens: 2048,
        });
        reply = (text ?? "").trim();
        if (!reply) throw new Error("Empty response");
      } catch (err2) {
        errMsg = (err2 as Error).message || "Model call failed";
        console.error(`[employee:${emp.name}] final failure`, errMsg);
      }
    }

    const finalContent = reply || `⚠️ I couldn't generate a response — ${errMsg ?? "unknown error"}. Please try again.`;

    const { data: assistantRow, error: aErr } = await context.supabase
      .from("employee_messages")
      .insert({
        thread_id: thread.id,
        user_id: context.userId,
        role: "assistant",
        content: finalContent,
      })
      .select("id, role, content, created_at")
      .single();
    if (aErr) throw new Error(aErr.message);

    // Bump thread updated_at
    await context.supabase
      .from("employee_threads")
      .update({ updated_at: new Date().toISOString() })
      .eq("id", thread.id);

    return { message: assistantRow, error: errMsg };
  });
