const autonomous = require('../../utils/autonomousAgent');
const auditLog = require('../../utils/auditLog');
const logger = require('../../utils/logger');

/**
 * GET /api/cron/daily
 *
 * Entry point for the Vercel Cron scheduler (see `crons` in vercel.json).
 * Vercel Cron automatically attaches an `Authorization: Bearer <CRON_SECRET>`
 * header when CRON_SECRET is set in the project's environment variables.
 * We verify that token before running any autonomous action — this keeps
 * the endpoint publicly reachable (Vercel Cron can't use x-api-key) while
 * still rejecting unauthorised callers.
 *
 * Behaviour on an UNAUTHORIZED call: returns 401 and records an audit
 * entry. Behaviour on a MISSING secret: fails closed (refuses to run)
 * so a misconfigured deployment can't be abused as a posting bot.
 */
module.exports = async (req, res) => {
    const expected = process.env.CRON_SECRET;
    const provided = (req.headers.authorization || '').replace(/^Bearer\s+/i, '').trim();

    if (!expected) {
        auditLog.record('autopilot.cron.refused', { reason: 'cron_secret_missing' });
        return res.status(503).json({
            success: false,
            error: 'CRON_SECRET_NOT_CONFIGURED',
            message: 'Set CRON_SECRET in the deployment env before enabling cron.',
        });
    }
    if (!provided || provided !== expected) {
        auditLog.record('autopilot.cron.unauthorized', {
            reason: provided ? 'bad_token' : 'missing_token',
            ua: req.headers['user-agent'] || null,
        });
        return res.status(401).json({ success: false, error: 'UNAUTHORIZED' });
    }

    try {
        const summary = await autonomous.runDailyCycle({ source: 'cron' });
        res.json({ success: true, summary });
    } catch (err) {
        logger.error('cron daily failed: ' + err.message);
        auditLog.record('autopilot.cron.error', { message: err.message });
        res.status(500).json({ success: false, error: 'CRON_RUN_FAILED', message: err.message });
    }
};
