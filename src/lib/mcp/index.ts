import { auth, defineMcp } from "@lovable.dev/mcp-js";
import listMissionsTool from "./tools/list-projects";
import getMissionTool from "./tools/get-mission";
import listKnowledgeTool from "./tools/list-knowledge";
import startMissionTool from "./tools/start-mission";

// Direct Supabase host — the .lovable.cloud proxy fails RFC 8414 discovery.
// VITE_SUPABASE_PROJECT_ID is inlined at build time by Vite.
const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

export default defineMcp({
  name: "aura-ai-mcp",
  title: "Aura AI",
  version: "0.1.0",
  instructions:
    "Aura AI is an AI co-founder workspace. Use these tools to list a user's missions and business knowledge documents, inspect deliverables from the 5 agents, or start a new mission from a business idea.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [listMissionsTool, getMissionTool, listKnowledgeTool, startMissionTool],
});
