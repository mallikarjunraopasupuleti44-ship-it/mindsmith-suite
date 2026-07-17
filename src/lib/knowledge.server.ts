// Server-only: document extraction + chunking. Runs inside server-fn handlers.

export type ExtractResult = { text: string; extractable: boolean };

export async function extractText(bytes: Uint8Array, mime: string, fileName: string): Promise<ExtractResult> {
  const lower = fileName.toLowerCase();
  try {
    if (mime === "application/pdf" || lower.endsWith(".pdf")) {
      const { extractText: extractPdf, getDocumentProxy } = await import("unpdf");
      const pdf = await getDocumentProxy(new Uint8Array(bytes));
      const { text } = await extractPdf(pdf, { mergePages: true });
      return { text: String(text || "").trim(), extractable: true };
    }
    if (
      mime === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
      lower.endsWith(".docx")
    ) {
      const mammoth = await import("mammoth");
      const buf = Buffer.from(bytes);
      const { value } = await mammoth.extractRawText({ buffer: buf });
      return { text: value.trim(), extractable: true };
    }
    if (
      mime === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
      mime === "application/vnd.ms-excel" ||
      lower.endsWith(".xlsx") ||
      lower.endsWith(".xls")
    ) {
      const XLSX = await import("xlsx");
      const wb = XLSX.read(bytes, { type: "array" });
      const parts: string[] = [];
      for (const name of wb.SheetNames) {
        const csv = XLSX.utils.sheet_to_csv(wb.Sheets[name]);
        parts.push(`# Sheet: ${name}\n${csv}`);
      }
      return { text: parts.join("\n\n").trim(), extractable: true };
    }
    if (
      mime === "text/csv" || mime === "text/plain" || mime === "text/markdown" ||
      lower.endsWith(".csv") || lower.endsWith(".txt") || lower.endsWith(".md")
    ) {
      return { text: new TextDecoder().decode(bytes).trim(), extractable: true };
    }
    if (mime.startsWith("image/")) {
      return { text: "", extractable: false };
    }
    // Unknown — try text decode
    return { text: new TextDecoder().decode(bytes).trim(), extractable: true };
  } catch (err) {
    throw new Error(`Could not extract ${fileName}: ${(err as Error).message}`);
  }
}

export function chunkText(text: string, target = 1800, overlap = 200): string[] {
  const clean = text.replace(/\s+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
  if (!clean) return [];
  const out: string[] = [];
  let i = 0;
  while (i < clean.length) {
    const end = Math.min(clean.length, i + target);
    let cut = end;
    if (end < clean.length) {
      const nl = clean.lastIndexOf("\n", end);
      const sp = clean.lastIndexOf(" ", end);
      cut = Math.max(nl, sp, i + Math.floor(target * 0.6));
      if (cut <= i) cut = end;
    }
    out.push(clean.slice(i, cut).trim());
    if (cut >= clean.length) break;
    i = Math.max(cut - overlap, i + 1);
  }
  return out.filter(Boolean).slice(0, 40); // cap chunks per doc
}

export const CATEGORIES = ["financial", "marketing", "operations", "legal", "other"] as const;
export type Category = typeof CATEGORIES[number];
