import { createClient } from "@supabase/supabase-js";
import { defineTool, type ToolContext } from "@lovable.dev/mcp-js";
import { z } from "zod";

function userClient(ctx: ToolContext) {
  return createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!, {
    global: { headers: { Authorization: `Bearer ${ctx.getToken()}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

const AGENTS = ["planner", "marketing", "finance", "operations", "website"] as const;

export default defineTool({
  name: "start_mission",
  title: "Start mission",
  description:
    "Kick off a new AI mission for a business idea. Creates the project and queues the 5 agents (planner, marketing, finance, operations, website).",
  inputSchema: {
    mission: z.string().trim().min(4).max(400).describe("One-line description of the business idea."),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  handler: async ({ mission }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    const supabase = userClient(ctx);
    const userId = ctx.getUserId();
    const { data: project, error } = await supabase
      .from("projects")
      .insert({ user_id: userId, mission })
      .select("id, mission, created_at")
      .single();
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };

    const { error: te } = await supabase.from("agent_tasks").insert(
      AGENTS.map((agent_id) => ({
        project_id: project.id,
        user_id: userId,
        agent_id,
        status: "working",
      })),
    );
    if (te) return { content: [{ type: "text", text: te.message }], isError: true };

    return {
      content: [
        {
          type: "text",
          text: `Mission queued. Open the app dashboard to watch the agents run. mission_id=${project.id}`,
        },
      ],
      structuredContent: { mission_id: project.id, mission: project.mission },
    };
  },
});
