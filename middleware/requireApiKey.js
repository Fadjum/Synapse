/**
 * requireApiKey middleware
 *
 * Protects routes by requiring a valid API key in every request.
 * The key must be sent as the `x-api-key` header.
 *
 * Set API_KEY in your .env file to a long random secret.
 * Generate one with:  node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
 */
const API_KEY = process.env.API_KEY;

if (!API_KEY) {
  console.error('[SECURITY] FATAL: API_KEY is not set in .env — all protected routes will be blocked.');
}

module.exports = function requireApiKey(req, res, next) {
  if (!API_KEY) {
    return res.status(503).json({
      success: false,
      error: 'Server misconfiguration: API_KEY is not set. Contact the administrator.'
    });
  }

  const provided = req.headers['x-api-key'];

  if (!provided || provided !== API_KEY) {
    return res.status(401).json({
      success: false,
      error: 'Unauthorized: missing or invalid x-api-key header.'
    });
  }

  next();
};
