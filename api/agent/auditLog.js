const auditLog = require('../../utils/auditLog');

/**
 * GET /api/agent/auditLog?limit=100&prefix=autopilot.
 * Returns the recent audit-log entries (autonomous actions, rejections, cycles).
 */
module.exports = async (req, res) => {
    const limit = Math.min(parseInt(req.query.limit, 10) || 100, 500);
    const prefix = req.query.prefix || null;
    res.json({
        success: true,
        count: auditLog._ring.length,
        entries: auditLog.recent(limit, prefix),
    });
};
