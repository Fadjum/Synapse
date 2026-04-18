const { runAgentChat } = require('../../utils/geminiClient');

const SERVER_TIMEOUT_MS = 50000; // 50s — ensures clean JSON response before Vercel's 60s kill

function withTimeout(promise, ms) {
  const timeout = new Promise((_, reject) =>
    setTimeout(() => reject(new Error('RESPONSE_TIMEOUT')), ms)
  );
  return Promise.race([promise, timeout]);
}

function friendlyError(err) {
  const msg = err.message || '';
  if (msg === 'RESPONSE_TIMEOUT') {
    return 'The AI took too long to respond. Please try a simpler question or try again.';
  }
  if (msg.includes('429') || msg.includes('quota') || msg.includes('Too Many Requests') || msg.includes('RESOURCE_EXHAUSTED')) {
    return 'The AI is temporarily rate-limited. Please wait a moment and try again.';
  }
  if (msg.includes('API key') || msg.includes('API_KEY') || msg.includes('UNAUTHENTICATED')) {
    return 'Invalid or missing Gemini API key. Please check GEMINI_API_KEY in Vercel environment variables.';
  }
  if (msg.includes('SAFETY') || msg.includes('blocked')) {
    return 'The request was blocked by the AI safety filter. Please rephrase your message.';
  }
  return 'The AI encountered an error. Please try again.';
}

module.exports = async (req, res) => {
  const { message, history = [] } = req.body;

  if (!message || typeof message !== 'string' || !message.trim()) {
    return res.status(400).json({ error: 'message is required' });
  }

  if (!process.env.GEMINI_API_KEY) {
    return res.status(503).json({ error: 'GEMINI_API_KEY is not configured on the server.' });
  }

  try {
    const { reply, history: updatedHistory } = await withTimeout(
      runAgentChat(message.trim(), history),
      SERVER_TIMEOUT_MS
    );
    res.json({ reply, history: updatedHistory });
  } catch (err) {
    console.error('[Agent] Error:', err.message);
    const status = err.message === 'RESPONSE_TIMEOUT' ? 504 : 500;
    res.status(status).json({ error: friendlyError(err) });
  }
};
