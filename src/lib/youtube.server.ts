// YouTube helpers — server-only (never import from client bundles).
import { createHmac, timingSafeEqual } from "node:crypto";

const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const YT_UPLOAD_URL = "https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status";
const YT_CHANNEL_URL = "https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true";
export const YT_SCOPES = "https://www.googleapis.com/auth/youtube.upload https://www.googleapis.com/auth/youtube.readonly";

function stateSecret() {
  const s = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!s) throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY");
  return s;
}

export function signState(userId: string): string {
  const payload = `${userId}.${Date.now()}`;
  const sig = createHmac("sha256", stateSecret()).update(payload).digest("hex");
  return Buffer.from(`${payload}.${sig}`).toString("base64url");
}

export function verifyState(state: string): { userId: string } | null {
  try {
    const raw = Buffer.from(state, "base64url").toString("utf8");
    const parts = raw.split(".");
    if (parts.length !== 3) return null;
    const [userId, ts, sig] = parts;
    const expected = createHmac("sha256", stateSecret()).update(`${userId}.${ts}`).digest("hex");
    const a = Buffer.from(sig, "hex");
    const b = Buffer.from(expected, "hex");
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
    if (Date.now() - Number(ts) > 10 * 60 * 1000) return null;
    return { userId };
  } catch {
    return null;
  }
}

export function googleAuthUrl(redirectUri: string, state: string): string {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  if (!clientId) throw new Error("Missing GOOGLE_OAUTH_CLIENT_ID");
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: YT_SCOPES,
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "true",
    state,
  });
  return `${GOOGLE_AUTH_URL}?${params.toString()}`;
}

export async function exchangeCode(code: string, redirectUri: string) {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID!;
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET!;
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code, client_id: clientId, client_secret: clientSecret,
      redirect_uri: redirectUri, grant_type: "authorization_code",
    }),
  });
  if (!res.ok) throw new Error(`Google token exchange failed: ${await res.text()}`);
  return (await res.json()) as {
    access_token: string; refresh_token?: string; expires_in: number; scope: string; token_type: string;
  };
}

export async function refreshAccessToken(refreshToken: string) {
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: process.env.GOOGLE_OAUTH_CLIENT_ID!,
      client_secret: process.env.GOOGLE_OAUTH_CLIENT_SECRET!,
      grant_type: "refresh_token",
    }),
  });
  if (!res.ok) throw new Error(`Google refresh failed: ${await res.text()}`);
  return (await res.json()) as { access_token: string; expires_in: number };
}

export async function fetchChannelInfo(accessToken: string) {
  const res = await fetch(YT_CHANNEL_URL, { headers: { Authorization: `Bearer ${accessToken}` } });
  if (!res.ok) return null;
  const j = (await res.json()) as any;
  const item = j.items?.[0];
  if (!item) return null;
  return { id: item.id as string, title: item.snippet?.title as string | undefined };
}

// Given a stored channel row, ensure the access_token is valid; refresh if needed.
// Returns valid access token. Updates the row in place via supabaseAdmin.
export async function getValidAccessToken(row: {
  id: string; access_token: string | null; refresh_token: string | null; token_expires_at: string | null;
}): Promise<string> {
  if (!row.refresh_token) throw new Error("YouTube not connected");
  const exp = row.token_expires_at ? new Date(row.token_expires_at).getTime() : 0;
  if (row.access_token && exp - Date.now() > 60_000) return row.access_token;
  const fresh = await refreshAccessToken(row.refresh_token);
  const newExpiry = new Date(Date.now() + fresh.expires_in * 1000).toISOString();
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  await supabaseAdmin.from("automation_channels")
    .update({ access_token: fresh.access_token, token_expires_at: newExpiry })
    .eq("id", row.id);
  return fresh.access_token;
}

export async function uploadVideoToYoutube(opts: {
  accessToken: string;
  title: string;
  description: string;
  tags: string[];
  videoBytes: ArrayBuffer;
  contentType: string;
  privacyStatus?: "public" | "unlisted" | "private";
}): Promise<{ id: string; url: string }> {
  const meta = {
    snippet: {
      title: opts.title.slice(0, 100) || "Untitled",
      description: opts.description.slice(0, 5000),
      tags: opts.tags.slice(0, 15),
    },
    status: { privacyStatus: opts.privacyStatus ?? "public", selfDeclaredMadeForKids: false },
  };
  const initRes = await fetch(YT_UPLOAD_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${opts.accessToken}`,
      "Content-Type": "application/json; charset=UTF-8",
      "X-Upload-Content-Type": opts.contentType,
      "X-Upload-Content-Length": String(opts.videoBytes.byteLength),
    },
    body: JSON.stringify(meta),
  });
  if (!initRes.ok) throw new Error(`YouTube init failed: ${initRes.status} ${await initRes.text()}`);
  const uploadUrl = initRes.headers.get("Location");
  if (!uploadUrl) throw new Error("YouTube upload URL missing");

  const putRes = await fetch(uploadUrl, {
    method: "PUT",
    headers: { "Content-Type": opts.contentType, "Content-Length": String(opts.videoBytes.byteLength) },
    body: opts.videoBytes,
  });
  if (!putRes.ok) throw new Error(`YouTube upload failed: ${putRes.status} ${await putRes.text()}`);
  const body = (await putRes.json()) as { id: string };
  return { id: body.id, url: `https://www.youtube.com/watch?v=${body.id}` };
}
