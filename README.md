# Synapse MVP
Synapse is a fully autonomous Google Business Profile (GBP) agent for **Eritage ENT Care (Entebbe)**. It manages reviews, posts, profile information, medical services, and media items, and runs **Autopilot** — an autonomous daily-posting and safe-review-reply system — with a hard policy guard that enforces Google's GBP content rules.


## 🚀 How to Install

Run the following command to install the necessary dependencies:
```bash
npm install
```

## 🛠️ How to Run Locally

1.  Create a `.env` file in the root directory (see `config/env.example`).
2.  Add your Google Cloud OAuth2 credentials and GBP account/location IDs.
3.  Run the server:

```bash
npm start
```
The server will start at `http://localhost:3000`.

## 📡 API Endpoints

### Reviews
- `GET /api/gbp/fetchReviews`: Get all reviews.
- `POST /api/gbp/replyToReview`: Reply to a review. (Body: `{ reviewName, replyText }`)

### Posts
- `GET /api/gbp/getPosts`: List all local posts.
- `POST /api/gbp/createPost`: Create a new local post. (Body: `{ postData }`)

### Profile & Services
- `GET /api/gbp/getProfile`: Get location profile.
- `PATCH /api/gbp/updateProfile`: Update profile fields. (Body: `{ updateData, updateMask }`)
- `GET /api/gbp/getServiceList`: Get medical service list.
- `PATCH /api/gbp/updateServiceList`: Update service list. (Body: `{ serviceListData, updateMask }`)

### Q&A
- `GET /api/gbp/fetchQuestions`: List all customer questions.
- `POST /api/gbp/replyToQuestion`: Answer a question. (Body: `{ questionName, answerText }`)

### Media
- `GET /api/gbp/listMedia`: List photos and videos.
- `POST /api/gbp/uploadMedia`: Upload new media via source URL. (Body: `{ mediaData }`)

### Analytics
- `GET /api/gbp/getInsights`: Get performance metrics.

### Autopilot (Autonomous Agent)
- `GET /api/agent/status`: Autopilot status, today's theme, 7-day content calendar.
- `GET /api/agent/auditLog?limit=100&prefix=autopilot.`: Recent autonomous actions.
- `POST /api/agent/autonomousPost` *(body: `{force?, dryRun?}`)*: Generate + publish today's post.
- `POST /api/agent/autoReplyReviews` *(body: `{maxReplies?, dryRun?}`)*: Auto-reply to safe 4★/5★ reviews.
- `POST /api/agent/runDaily`: Run the full daily cycle now (post + replies).
- `GET /api/cron/daily`: Vercel Cron entry point (authenticated via `CRON_SECRET` bearer).

### Conversational AI
- `POST /api/agent/chat` *(body: `{message, history}`)*: Gemini-powered agent with 14 GBP tools.

## 🤖 Autopilot & Policy Safety

Autopilot is a scheduled, policy-checked pipeline — **not** a raw AI loop.
Every draft passes through `utils/policyGuard.js` before publishing:

- No medical claims (`cure`, `guarantee`, `miracle`, `diagnose`, `prescription`, `dosage`, `#1`, `best ent`, `100%`, …)
- No foreign URLs, no emails, no phone numbers, no hashtags, no emojis
- Enforced length limits (post ≤ 1400, reply ≤ 4000 chars)
- No quoting the reviewer's text back (privacy)
- Auto-reply only for 4★/5★ reviews; everything else is flagged for a human
- Idempotent: queries GBP itself to avoid double-posts

Feature flags (env vars): `AUTOPILOT_ENABLED`, `AUTOPILOT_DAILY_POST`,
`AUTOPILOT_AUTO_REPLY`, `AUTOPILOT_POST_DRY_RUN`, `AUTOPILOT_REPLY_DRY_RUN`.
Cron runs daily at **06:00 UTC** (09:00 Entebbe).

## 🔐 Required Environment Variables

- `GBP_CLIENT_ID`: Google Cloud OAuth client ID.
- `GBP_CLIENT_SECRET`: Google Cloud OAuth client secret.
- `GOOGLE_REFRESH_TOKEN`: Google OAuth refresh token.
- `GOOGLE_REDIRECT_URI`: OAuth redirect URI.
- `GBP_ACCOUNT_ID`: Your Google Business Account ID.
- `GBP_LOCATION_ID`: Your Google Business Location ID.
- `API_KEY`: Shared-secret for all `/api/*` routes (sent as `x-api-key` header).
- `GEMINI_API_KEY`: Google Generative AI API key (for post/reply drafting + AI chat).
- `CRON_SECRET`: Bearer token for `/api/cron/daily` — **required** for Autopilot cron.
- *(optional)* `AUTOPILOT_ENABLED`, `AUTOPILOT_DAILY_POST`, `AUTOPILOT_AUTO_REPLY`, `AUTOPILOT_POST_DRY_RUN`, `AUTOPILOT_REPLY_DRY_RUN`.

---

_Last updated: 2026-04-11_


---
*Deployment trigger: Fixed contributor access for Vercel Hobby plan.*
