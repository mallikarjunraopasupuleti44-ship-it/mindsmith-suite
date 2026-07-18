# Real Automations: Instagram + YouTube + AI Content

## Honest constraints (please read)

1. **"Fully free" caveats you must accept:**
   - **Instagram publishing** requires a **Facebook Page + Instagram Business/Creator account** linked to it. The Meta Graph API is free, but to let *other* users connect, our Meta app needs Meta's App Review (free, but takes days). Until then, only accounts added as testers in the Meta app can publish.
   - **YouTube Data API** is free but has a 10,000 units/day quota; each video upload = 1,600 units (~6 uploads/day/project). Google also requires OAuth verification for production; unverified apps show a "Google hasn't verified this app" warning until reviewed.
   - **You (the app owner)** must create one Meta app + one Google Cloud project and add their client IDs/secrets to Aura as secrets. I cannot do that step — it needs your dashboards.

2. **AI video on Cloudflare Workers:** Real MP4 encoding (ffmpeg / sharp) does **not** run in our serverless runtime. For a truly free path I'll generate the slideshow client-side in the browser using the Canvas + WebCodecs / MediaRecorder API when the user clicks "Generate video", then upload the resulting Blob to Supabase Storage, then hand its URL to YouTube. Instagram Reels also accepts this MP4 URL.

## What I'll build

### 1. Schema (migration)
- Extend `automation_channels`: `access_token`, `refresh_token`, `token_expires_at`, `provider_account_id` (IG business id / YT channel id), `provider_username`, `metadata jsonb`, `scopes text[]`.
- Extend `posts`: `media_url` (Storage URL), `media_type` (image/video), `external_post_id`, `error text`, `published_at` timestamp.
- New storage bucket `post-media` (private, signed URLs).

### 2. OAuth connect flows (server routes)
- `src/routes/api/public/oauth/google/start.ts` + `/callback.ts` — Google OAuth with `youtube.upload` + `youtube.readonly` scopes; store tokens in `automation_channels`.
- `src/routes/api/public/oauth/meta/start.ts` + `/callback.ts` — Facebook Login with `instagram_basic`, `instagram_content_publish`, `pages_show_list`, `pages_read_engagement`; discovers linked IG business id.
- Secrets needed (I'll request via `add_secret`): `GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET`, `META_APP_ID`, `META_APP_SECRET`.

### 3. AI content generation (server fns)
- `generatePostContent({ topic, platform })`: Gemini writes caption + hashtags, returns image prompt.
- `/api/generate-post-image` streaming route: uses Lovable AI Gateway image model, saves final PNG to `post-media` bucket, returns URL.
- Client-side `buildSlideshowVideo(images[], caption, durationSec)` using Canvas + MediaRecorder → Blob → upload to `post-media`.

### 4. Publishing pipeline
- `publishPostNow(postId)` server fn:
  - Refreshes OAuth token if expired.
  - **Instagram image**: `POST /{ig-user-id}/media` (image_url) → `POST /{ig-user-id}/media_publish`.
  - **Instagram Reels**: same but `media_type=REELS` + video_url.
  - **YouTube**: resumable upload to `https://www.googleapis.com/upload/youtube/v3/videos` with title/description/tags, `privacyStatus=public`.
  - Updates `posts.status`, `external_post_id`, `published_at`, `error`.
- Existing `pg_cron` job `/api/public/hooks/publish-scheduled` (already runs every 5 min) will call `publishPostNow` for each due post instead of just flipping status.

### 5. UI (`/dashboard/automation`)
- **Connections panel**: real "Connect Instagram" / "Connect YouTube" buttons that open OAuth popup; shows connected username + disconnect.
- **Compose panel**: topic prompt → AI-generate caption + image → optional "Make slideshow video" (client-side) → schedule date/time → save as scheduled post.
- **Posts list**: shows status (draft/scheduled/publishing/published/failed), error message, external link when published.

## Technical section

- Tokens stored server-only; `automation_channels` remains service-role only (no anon/authenticated grants on token columns — expose a view with only safe columns).
- All OAuth callbacks live under `/api/public/*` (bypass auth) and use a signed `state` param containing `user_id + platform + nonce` to prevent CSRF.
- Video generation runs in browser (`ClientOnly`) to avoid Worker limits; upload uses Supabase Storage signed upload URL.
- pg_cron already exists; only the handler logic changes.
- Meta Graph API version pinned to `v21.0`. YouTube API v3.
- Retry: 1 retry on 5xx, exponential; permanent failures set `posts.status='failed'` + `error`.

## What I need from you before it can actually post
1. Create Meta app at developers.facebook.com → add Instagram Graph API product → get App ID + Secret → add redirect URI `https://mindsmith-suite.lovable.app/api/public/oauth/meta/callback`.
2. Create Google Cloud project → enable YouTube Data API v3 → OAuth client (Web) → add redirect URI `https://mindsmith-suite.lovable.app/api/public/oauth/google/callback` → get Client ID + Secret.
3. Paste all 4 into secure prompts I'll open.

Confirm and I'll start with the migration, then wire OAuth, AI generation, and publishing in that order.