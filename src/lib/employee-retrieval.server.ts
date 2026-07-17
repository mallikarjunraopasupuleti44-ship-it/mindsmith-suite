// Server-only: hybrid retrieval for AI Employees.
// Try pgvector semantic search first via match_document_chunks RPC.
// If no strong hits (or vector call fails), fall back to Postgres FTS
// via keyword_match_document_chunks RPC.
//
// NOTE: This retrieval layer should be revisited when we add reranking or
// hybrid fusion — pgvector is already in place, FTS is a resilience layer.
import type { SupabaseClient } from "@supabase/supabase-js";
import { embedText } from "./ai-gateway.server";

export type RetrievedChunk = {
  document_id: string;
  chunk_text: string;
  file_name: string;
  category: string | null;
};

const MIN_VECTOR_SIMILARITY = 0.35;
const MAX_CONTEXT_CHARS = 6000;

export async function retrieveContext(
  supabase: SupabaseClient,
  userId: string,
  query: string,
  k = 5,
): Promise<{ chunks: RetrievedChunk[]; block: string; source: "vector" | "keyword" | "none" }> {
  let chunks: RetrievedChunk[] = [];
  let source: "vector" | "keyword" | "none" = "none";

  // 1. Vector-first
  try {
    const embedding = await embedText(query);
    const { data, error } = await supabase.rpc("match_document_chunks", {
      p_user_id: userId,
      query_embedding: embedding as any,
      p_category: null,
      match_count: k,
    });
    if (!error && Array.isArray(data)) {
      const strong = data.filter((c: any) => (c.similarity ?? 0) >= MIN_VECTOR_SIMILARITY);
      if (strong.length > 0) {
        chunks = strong.map((c: any) => ({
          document_id: c.document_id,
          chunk_text: c.chunk_text,
          file_name: c.file_name,
          category: c.category ?? null,
        }));
        source = "vector";
      }
    }
  } catch (err) {
    console.warn("[employee-retrieval] vector failed", (err as Error).message);
  }

  // 2. FTS fallback
  if (chunks.length === 0) {
    try {
      const { data, error } = await supabase.rpc("keyword_match_document_chunks", {
        p_user_id: userId,
        p_query: query,
        match_count: k,
      });
      if (!error && Array.isArray(data) && data.length > 0) {
        chunks = data.map((c: any) => ({
          document_id: c.document_id,
          chunk_text: c.chunk_text,
          file_name: c.file_name,
          category: c.category ?? null,
        }));
        source = "keyword";
      }
    } catch (err) {
      console.warn("[employee-retrieval] keyword failed", (err as Error).message);
    }
  }

  // Build context block, truncated to budget
  let block = "";
  if (chunks.length > 0) {
    const parts: string[] = [];
    let total = 0;
    for (const c of chunks) {
      const piece = `[${c.file_name}]\n${c.chunk_text}`;
      if (total + piece.length > MAX_CONTEXT_CHARS) {
        parts.push(piece.slice(0, MAX_CONTEXT_CHARS - total));
        break;
      }
      parts.push(piece);
      total += piece.length;
    }
    block = parts.join("\n\n---\n\n");
  }

  return { chunks, block, source };
}
