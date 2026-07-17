# Phase 3 + Knowledge Base

Ship in one turn: real backend, real AI agents, and the Knowledge tab wired into the agent pipeline.

## 1. Backend & Auth

- Enable Lovable Cloud (Supabase under the hood).
- Add email/password + Google sign-in via the managed integration.
- Ship the auth page and move `/dashboard/*` under the managed `_authenticated/route.tsx` gate. Landing page (`/`) stays public with a "Sign in / Get started" CTA that reflects session state.

## 2. Database schema (one migration)

- `projects` — one per mission (`id, user_id, mission, created_at`).
- `agent_tasks` — `id, project_id, agent_id, status, deliverable jsonb, error, updated_at`.
- `activity_events` — `id, project_id, agent, message, created_at`.
- `knowledge_documents` — `id, user_id, project_id, file_name, storage_path, file_type, category, status, status_error, extracted_text, uploaded_at`.
- `document_chunks` — `id, document_id, chunk_text, chunk_index, embedding vector(3072)` (pgvector + halfvec HNSW index).
- `deliverable_sources` — `id, agent_task_id, document_id`.
- Storage bucket `business-documents` (private) with owner-scoped RLS.
- RLS on every table scoped to `auth.uid()`; explicit `GRANT`s to `authenticated` + `service_role`.
- `match_document_chunks(project_id, query_embedding, category, k)` SQL function for RAG.

## 3. Agent pipeline (Gemini via Lovable AI Gateway)

- Server functions in `src/lib/agents.functions.ts` protected by `requireSupabaseAuth`.
- `startMission({ mission })` → creates project + 5 agent_tasks (status `working`), kicks off each agent in parallel.
- `runAgent({ projectId, agentId })`:
  1. Load project mission + (if it exists) Planner deliverable for brand context.
  2. Embed the query with `google/gemini-embedding-001`.
  3. Call `match_document_chunks` filtered to the agent's mapped category, fall back to any category if none matches.
  4. Build prompt with a "Context from the user's uploaded business documents" section listing chunk text + source file name.
  5. Call `google/gemini-3-pro-preview` with `generateText` + `Output.object` (per-agent schemas mirroring the current mock shape).
  6. Persist deliverable JSON, flip status to `needs_review`, record `deliverable_sources` for chunks actually used, push activity event.
- Planner runs first; Marketing/Finance/Operations/Website launch once Planner completes so they can reference the brand.
- `approveDeliverable` / `requestRevision` server fns update status + activity.
- Failures: agent status → `needs_review` with error, activity event, UI shows retry.

## 4. Frontend rewire

- Replace zustand-only state: keep zustand for UI ephemera, but source `mission`, agents, activity, deliverables from TanStack Query hooks over the new server fns. Realtime subscription to `agent_tasks` + `activity_events` per project so the Command Center updates as agents finish.
- `ReviewModal` renders live deliverable JSON (same shape as current mocks) and shows the "📎 Referenced N documents" chip.
- AgentCard shows the same chip when `deliverable_sources` exist.

## 5. Knowledge tab (`/dashboard/knowledge`)

- Route + sidebar item, matching existing glass styling.
- Upload zone (drag/drop + browse), category picker (Financial / Marketing & Brand / Operations / Legal / Other / Auto-detect), 20MB cap, accept PDF/DOCX/XLSX/CSV/TXT/PNG/JPG.
- Upload flow: signed upload to `business-documents` bucket → `ingestDocument` server fn inserts row (status `processing`) and returns; ingestion runs in the same fn (extract → chunk → embed → insert chunks → status `indexed`, or `failed` with reason).
- Text extraction: `pdf-parse` for PDF, `mammoth` for DOCX, `xlsx` for XLSX, native for CSV/TXT, images stored reference-only.
- Chunking ~500 tokens with ~50 overlap.
- Embeddings via Lovable AI `/v1/embeddings` (google/gemini-embedding-001, 3072 dims).
- Document list with search + category filter chips, status pills, row actions (Preview, Re-process, Delete). Detail drawer with inline preview, extracted text, and "Used in" list from `deliverable_sources`.
- Empty state matching design.

## 6. Package additions

`pdf-parse`, `mammoth`, `xlsx`, `@ai-sdk/openai-compatible`, `ai`, `zod` (if not present).

## Technical notes

- All AI + DB work in `createServerFn` handlers under `requireSupabaseAuth`; `LOVABLE_API_KEY` read inside handlers only.
- Public landing route stays SSR; dashboard subtree gets `ssr: false` via the managed auth layout.
- Root `onAuthStateChange` listener invalidates router + query cache on SIGNED_IN/OUT/USER_UPDATED only.
- Structured output schemas kept flat and constraint-free; limits enforced in prompt + code, wrapped in `NoObjectGeneratedError` fallback.
- Realtime uses `supabase.channel(...).on('postgres_changes', ...)` scoped by `project_id`.
- Delete flow removes DB rows, chunks, and storage object atomically (storage delete after row delete succeeds).

## Out of scope for this turn

- Preview rendering of DOCX/XLSX inside the drawer beyond extracted text.
- Fine-grained per-chunk citation UI (we show source file names, not per-sentence footnotes).
- Background workers / queues — ingestion runs inline in the server fn (fine for 20MB cap; can move to a queue later).
