
require('dotenv').config();
const path = require('path');
const express = require('express');
const { google } = require('googleapis');
const gbpClient = require('./utils/gbpClient');
const requireApiKey = require('./middleware/requireApiKey');
const handleReplyToReview = require('./api/gbp/replyToReview');
const handleDeleteReviewReply = require('./api/gbp/deleteReviewReply');
const handleGetReviews = require('./api/gbp/fetchReviews');
const handleGetPosts = require('./api/gbp/getPosts');
const handleGetProfile = require('./api/gbp/getProfile');
const handleUpdateProfile = require('./api/gbp/updateProfile');
const handleGetInsights = require('./api/gbp/getInsights');
const handleCreatePost = require('./api/gbp/createPost');
const handleFetchQuestions = require('./api/gbp/fetchQuestions');
const handleReplyToQuestion = require('./api/gbp/replyToQuestion');
const handleListMedia = require('./api/gbp/listMedia');
const handleUploadMedia = require('./api/gbp/uploadMedia');
const handleDeleteMedia = require('./api/gbp/deleteMedia');
const handleGetServiceList = require('./api/gbp/getServiceList');
const handleUpdateServiceList = require('./api/gbp/updateServiceList');
const handleDeletePost = require('./api/gbp/deletePost');
const handleGetLocations = require('./api/gbp/getLocations');
const handleAgentChat = require('./api/agent/chat');
const handleAutonomousPost = require('./api/agent/autonomousPost');
const handleAutoReplyReviews = require('./api/agent/autoReplyReviews');
const handleRunDaily = require('./api/agent/runDaily');
const handleAgentStatus = require('./api/agent/status');
const handleAuditLog = require('./api/agent/auditLog');
const handleCronDaily = require('./api/cron/daily');
const app = express();
// Dummy comment to trigger deployment
const port = 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Public health-check — no auth needed
app.get("/ping", (req, res) => {
  res.json({ success: true, message: "pong" });
});

// --- OAuth2 re-authorization routes (protected) ---
// Step 1: Visit /api/auth/login to get the Google consent URL
app.get('/api/auth/login', requireApiKey, (req, res) => {
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );
  const url = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',         // force consent screen so Google always returns a refresh token
    scope: ['https://www.googleapis.com/auth/business.manage']
  });
  res.json({ success: true, message: 'Open this URL in your browser to re-authorize', auth_url: url });
});

// Step 2: Google redirects here with ?code=... — exchange it for tokens and display the new refresh token
app.get('/api/auth/callback', requireApiKey, async (req, res) => {
  const { code } = req.query;
  if (!code) return res.status(400).json({ success: false, error: 'Missing authorization code' });

  try {
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI
    );
    const { tokens } = await oauth2Client.getToken(code);
    res.json({
      success: true,
      message: 'Copy the refresh_token below into your .env as GOOGLE_REFRESH_TOKEN',
      refresh_token: tokens.refresh_token,
      access_token: tokens.access_token,
      expiry_date: tokens.expiry_date
    });
  } catch (error) {
    const detail = error.response ? error.response.data : error.message;
    res.status(500).json({ success: false, error: 'Token exchange failed', detail });
  }
});

app.get('/api/gbp/fetchReviews', requireApiKey, handleGetReviews);
app.post('/api/gbp/replyToReview', requireApiKey, handleReplyToReview);
app.delete('/api/gbp/deleteReviewReply', requireApiKey, handleDeleteReviewReply);
app.get('/api/gbp/getPosts', requireApiKey, handleGetPosts);
app.post('/api/gbp/createPost', requireApiKey, handleCreatePost);
app.post('/api/gbp/deletePost', requireApiKey, handleDeletePost);
app.get('/api/gbp/getProfile', requireApiKey, handleGetProfile);
app.patch('/api/gbp/updateProfile', requireApiKey, handleUpdateProfile);
app.get('/api/gbp/getInsights', requireApiKey, handleGetInsights);
app.get('/api/gbp/fetchQuestions', requireApiKey, handleFetchQuestions);
app.post('/api/gbp/replyToQuestion', requireApiKey, handleReplyToQuestion);
app.get('/api/gbp/listMedia', requireApiKey, handleListMedia);
app.post('/api/gbp/uploadMedia', requireApiKey, handleUploadMedia);
app.delete('/api/gbp/deleteMedia', requireApiKey, handleDeleteMedia);
app.get('/api/gbp/getServiceList', requireApiKey, handleGetServiceList);
app.patch('/api/gbp/updateServiceList', requireApiKey, handleUpdateServiceList);

app.get('/api/gbp/debug/locations', requireApiKey, handleGetLocations);

// AI Agent
app.post('/api/agent/chat', requireApiKey, handleAgentChat);

// --- Autonomous agent (Autopilot) ---
app.get('/api/agent/status', requireApiKey, handleAgentStatus);
app.get('/api/agent/auditLog', requireApiKey, handleAuditLog);
app.post('/api/agent/autonomousPost', requireApiKey, handleAutonomousPost);
app.post('/api/agent/autoReplyReviews', requireApiKey, handleAutoReplyReviews);
app.post('/api/agent/runDaily', requireApiKey, handleRunDaily);

// Vercel Cron entry point — authenticated via CRON_SECRET bearer token,
// NOT via x-api-key (Vercel Cron can't attach custom headers).
app.get('/api/cron/daily', handleCronDaily);

app.listen(port, () => {
  console.log(`Server listening at http://localhost:${port}`);
});
