# GEMINI AGENT INSTRUCTIONS — SYNAPSE MVP

## 🎯 ROLE
You are a strict implementation agent.

Your job:
- build exactly what is specified
- do NOT redesign architecture
- do NOT add features
- do NOT optimize beyond instruction

---

## ⚠️ CRITICAL RULES

1. NEVER create SaaS structure
2. NEVER introduce multi-tenant logic
3. NEVER add unnecessary abstraction layers
4. ONLY implement requested file or function
5. STOP after task completion

---

## 🧱 ARCHITECTURE RULES

- All Google API calls MUST go through:
  /utils/gbpClient.js

- OAuth handled ONLY in:
  /utils/auth.js

- Logging handled ONLY in:
  /utils/logger.js

---

## 📁 APPROVED STRUCTURE

/api/gbp/
  fetchReviews.js
  replyToReview.js
  getProfile.js
  getInsights.js
  getPosts.js

/utils/
  gbpClient.js
  auth.js
  logger.js

---

## 🔥 DEVELOPMENT PRINCIPLE

This is NOT a SaaS.

This is a single-business operational system for:
Eritage ENT Care (Entebbe)

All logic must serve:
- Google visibility
- patient acquisition
- review management

---

## 🧠 OUTPUT FORMAT RULE

All API responses must be:
- JSON only
- no HTML allowed
- no raw Google redirects exposed

---

## 🧭 TASK BEHAVIOR

When given a task:
1. Implement only requested file
2. Do not touch other files
3. Do not refactor unrelated code
4. Do not introduce new architecture
5. Stop immediately after completion

---

## 🔀 GIT WORKFLOW

- Always commit and push changes to the `main` branch
- Never push to any other branch unless explicitly instructed

---

# SESSION CONTEXT

## Last Worked On
- **Completed Core Feature Set:**
    - **Profile & Hours Management:** Fully implemented profile editing (phone, website, address, description) and a business hours editor in the frontend. Updated `gbpClient` and `normalizeProfile` to include `description`.
    - **Service Management:** Added UI for creating, editing, and deleting services, fully integrated with the `updateServiceList` backend.
    - **Advanced Post Features:** Expanded post creation to support `OFFER` and `EVENT` types (including coupon codes, links, event dates, and terms).
    - **Post Deletion:** Implemented `deletePost` backend route and frontend integration with full resource name tracking in `normalizePosts`.
    - **Pagination & Media:** Implemented pagination for Reviews, Posts, and Media items with "Load More" functionality. Added support for video thumbnails and video uploads.
    - **UI/UX Refinement:** Enhanced the modal system for dynamic forms, added toast notifications for all operations, and updated `styles.css` with a robust set of form and utility classes.

## Status
- **Backend:** All core GBP management endpoints (Profile, Reviews, Posts, Services, Media, Insights) are verified and functional. Added `deletePost` endpoint.
- **Frontend:** Fully feature-complete dashboard and management views. Supports full CRUD for posts and services, and full profile/hours editing.
- **Git:** All changes integrated into the codebase.

## Next Steps
- **Vercel Setup:** User needs to manually add environment variables (`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REFRESH_TOKEN`, etc.) in the Vercel dashboard.
- **Production Validation:** Conduct a final end-to-end smoke test on the live GBP account once deployed to Vercel.
