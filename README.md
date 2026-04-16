# Synapse MVP
This project is a fully functional Google Business Profile (GBP) management agent for **Eritage ENT Care (Entebbe)**. It allows managing reviews, posts, questions/answers, profile information, medical services, and media items.


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

## 🔐 Required Environment Variables

- `GBP_CLIENT_ID`: Google Cloud OAuth client ID.
- `GBP_CLIENT_SECRET`: Google Cloud OAuth client secret.
- `GOOGLE_REFRESH_TOKEN`: Google OAuth refresh token.
- `GOOGLE_REDIRECT_URI`: OAuth redirect URI.
- `GBP_ACCOUNT_ID`: Your Google Business Account ID.
- `GBP_LOCATION_ID`: Your Google Business Location ID.

---

_Last updated: 2026-04-11_


---
*Deployment trigger: Fixed contributor access for Vercel Hobby plan.*
