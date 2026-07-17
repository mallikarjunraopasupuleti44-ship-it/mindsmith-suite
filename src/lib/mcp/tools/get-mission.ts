import { createClient } from "@supabase/supabase-js";
import { defineTool, type ToolContext } from "@lovable.dev/mcp-js";
import { z } from "zod";

function userClient(ctx: ToolContext) {
  return createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!, {
    global: { headers: { Authorization: `Bearer ${ctx.getToken()}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export default defineTool({
  name: "get_mission",
  title: "Get mission",
  description: "Fetch a mission with all its agent deliverables and statuses.",
  inputSchema: {
    mission_id: z.string().uuid().describe("The mission (project) id."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ mission_id }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    const supabase = userClient(ctx);
    const [{ data: project, error: pe }, { data: tasks, error: te }] = await Promise.all([
      supabase.from("projects").select("id, mission, created_at").eq("id", mission_id).maybeSingle(),
      supabase.from("agent_tasks").select("agent_id, status, deliverable, updated_at").eq("project_id", mission_id),
    ]);
    if (pe) return { content: [{ type: "text", text: pe.message }], isError: true };
    if (te) return { content: [{ type: "text", text: te.message }], isError: true };
    if (!project) return { content: [{ type: "text", text: "Mission not found" }], isError: true };
    const payload = { project, tasks };
    return {
      content: [{ type: "text", text: JSON.stringify(payload, null, 2) }],
      structuredContent: payload,
    };
  },
});
