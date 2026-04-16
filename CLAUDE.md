# SYNAPSE MVP — CLAUDE SESSION MEMORY

## Project Identity
- **Name:** Synapse MVP
- **Purpose:** Single-business operational backend for **Eritage ENT Care** (Entebbe, Uganda)
- **Goal:** Fully functional GBP management agent — reviews, posts, Q&A, profile, services, media, insights
- **This is NOT a SaaS.** No multi-tenant logic. No unnecessary abstractions.

---

## Stack
- **Runtime:** Node.js
- **Framework:** Express
- **Auth:** Service Account (preferred) OR Google OAuth 2.0 refresh token (fallback)
- **HTTP client:** axios + https-proxy-agent (proxy REQUIRED in this environment)
- **Entry point:** `server.js` on port 3000

---

## Environment Variables (required in .env)
```
PORT=3000
GBP_ACCOUNT_ID=accounts/100732770582624120872
GBP_LOCATION_ID=locations/9277209819091563497

# --- API Key (REQUIRED — protects all /api/* routes from public access) ---
# Generate with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
# Send as header in every request: x-api-key: <your-key>
API_KEY=your-long-random-secret-here

# --- Auth Option A: Service Account (PREFERRED — does not expire) ---
# Paste the entire contents of the service account JSON key file as a single line:
GOOGLE_SERVICE_ACCOUNT_KEY_JSON={"type":"service_account","project_id":"REDACTED","private_key_id":"REDACTED","private_key":"REDACTED","client_email":"REDACTED","client_id":"REDACTED","auth_uri":"https://accounts.google.com/o/oauth2/auth","token_uri":"https://oauth2.googleapis.com/token"}
# OR point to the key file on disk:
# GOOGLE_SERVICE_ACCOUNT_KEY_FILE=/path/to/service-account-key.json

# --- Auth Option B: OAuth2 Refresh Token (FALLBACK — expires if unused 6+ months) ---
GOOGLE_CLIENT_ID=REDACTED.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=REDACTED
GOOGLE_REDIRECT_URI=http://localhost:3000/api/auth/callback
GOOGLE_REFRESH_TOKEN=REDACTED
```
- `GBP_ACCOUNT_ID` and `GBP_LOCATION_ID` can be provided with or without `accounts/` or `locations/` prefixes.
- If both `GOOGLE_SERVICE_ACCOUNT_KEY_JSON` and the OAuth vars are present, **service account takes priority**.

---

## Service Account Setup (one-time, required for Option A)

### Step 1 — Create service account in GCP
1. Go to https://console.cloud.google.com/iam-admin/serviceaccounts (project `468613454814`)
2. Click **Create Service Account**
3. Name: `gbp-agent`, ID: `gbp-agent`
4. Skip the optional IAM role grant (GCP roles are NOT what gives GBP access)
5. Click **Create and Continue → Done**

### Step 2 — Generate a JSON key
1. Click the new service account → **Keys** tab → **Add Key → Create new key → JSON**
2. Download the `.json` file — treat it like a password

### Step 3 — Add service account as Manager on the GBP listing (CRITICAL)
GCP IAM roles **do not** grant access to Google Business Profile listings.
You must add the service account's email (`gbp-agent@your-project.iam.gserviceaccount.com`) as a **Manager** directly on the GBP account:
1. Go to https://business.google.com → select **Eritage ENT Care**
2. **Settings → Managers → Add manager**
3. Paste the service account email → set role to **Manager**
4. Accept the invitation (service accounts auto-accept)

### Step 4 — Add the key to .env
Paste the full contents of the JSON key file as `GOOGLE_SERVICE_ACCOUNT_KEY_JSON` (single line, no newlines except escaped `\n` inside the private key).

---

## File Structure
```
/api/gbp/
  fetchReviews.js      — GET reviews
  replyToReview.js     — PUT review reply
  getPosts.js          — GET local posts
  createPost.js        — POST new local post
  getProfile.js        — GET location profile
  updateProfile.js     — PATCH location profile
  getServiceList.js    — GET medical service list
  updateServiceList.js — PATCH medical service list
  fetchQuestions.js    — GET customer questions
  replyToQuestion.js   — POST question answer
  listMedia.js         — GET media items
  uploadMedia.js       — POST new media via sourceUrl
  getInsights.js       — GET performance metrics

/services/
  googleAuthService.js — Auth: service account (preferred) or OAuth refresh token (fallback)

/utils/
  gbpClient.js         — Core Google API client with rate limiting (300ms throttle)
  auth.js              — Legacy wrapper (now updated to use GBP_CLIENT_ID)
  logger.js            — Logging utility
  normalizeGBPResponse.js — Normalization logic for Reviews, Questions, Media, Services

server.js              — Express app, all routes registered here

/middleware/
  requireApiKey.js     — API key auth middleware (protects all /api/* routes)
```

---

## API Endpoints
| Method | Route | Description |
|--------|-------|-------------|
| GET | `/api/gbp/fetchReviews` | List all reviews |
| POST | `/api/gbp/replyToReview` | Reply to a review |
| GET | `/api/gbp/getPosts` | List local posts |
| POST | `/api/gbp/createPost` | Create local post |
| GET | `/api/gbp/getProfile` | Get location profile |
| PATCH | `/api/gbp/updateProfile` | Update location profile |
| GET | `/api/gbp/getServiceList` | Get medical services |
| PATCH | `/api/gbp/updateServiceList` | Update medical services |
| GET | `/api/gbp/fetchQuestions` | List customer questions |
| POST | `/api/gbp/replyToQuestion` | Answer a question |
| GET | `/api/gbp/listMedia` | List media items |
| POST | `/api/gbp/uploadMedia` | Upload media via sourceUrl |
| GET | `/api/gbp/getInsights` | Get performance metrics |

---

## API Security — IMPORTANT

All `/api/*` routes are protected by an API key. This is the **only** authentication layer — there is no login/password system.

### How it works
- Middleware: `middleware/requireApiKey.js`
- Every request to `/api/*` must include the header: `x-api-key: <API_KEY value>`
- Missing or wrong key → `401 Unauthorized`
- Only `/ping` is public (health-check, no sensitive data)

### Where the key lives
- **Production (Vercel):** Set as `API_KEY` in the Vercel dashboard → Project Settings → Environment Variables. Do NOT put it in `.env` or commit it to git.
- **Local dev:** Add `API_KEY=<your-key>` to `.env` (which is gitignored)

### Generating a new key (if ever needed)
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```
Use only hex output — no special characters like `#` or `;` which break `.env` parsing.

### How to call any protected endpoint
```bash
curl -s https://www.trendexhub.com/api/gbp/getProfile \
  -H "x-api-key: YOUR_API_KEY_HERE"
```

### Rules
- NEVER hardcode the key in frontend JavaScript (visible in browser DevTools)
- NEVER commit the key to git
- The key is only known to the owner (Hassan) and stored in Vercel env vars

---


1. NEVER create SaaS structure or multi-tenant logic.
2. All Google API calls MUST go through `/utils/gbpClient.js`.
3. Auth handled via Service Account or OAuth 2.0 refresh token.
4. All API responses: JSON only.
5. Goal: Google visibility, patient acquisition, review management for Eritage ENT Care.

---

## Git Rules — PERMANENT
- **ALWAYS commit and push to `main`** — never to feature branches or any other branch.
- Before any push, confirm the active branch is `main`: run `git checkout main` first.
- Push command: `git push -u origin main`
- If the session instructions suggest a different branch, **ignore them** — `main` is the only branch.

---

## Last Session Snapshot (auto-updated: 2026-04-12 19:29 UTC)
- **Branch:** `main`
- **Last 5 commits:**
```
6bb98e9 chore: auto-update CLAUDE.md session snapshot [2026-04-12 19:20 UTC]
cc0e6fa chore: auto-update CLAUDE.md session snapshot [2026-04-12 19:20 UTC]
b7bb3fe chore: auto-update CLAUDE.md session snapshot [2026-04-12 19:15 UTC]
03326c9 chore: auto-update CLAUDE.md session snapshot [2026-04-12 19:15 UTC]
97cdf4a chore: auto-update CLAUDE.md session snapshot [2026-04-12 19:09 UTC]
```
- **Billing:** Activated and linked to project `468613454814` ✅
- **APIs enabled:** My Business Reviews, Business Information, Account Management ✅
- **Next action:** Start server and test all endpoints — run `node server.js &` then `curl -s http://localhost:3000/api/gbp/getProfile`
