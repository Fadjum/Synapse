/**
 * Append-only audit log for the autonomous agent.
 *
 * Every autonomous action (post created, reply posted, generation rejected,
 * cron triggered, etc.) is recorded here with a timestamp, type, and
 * structured payload. Used for:
 *   - compliance: proof that a human can inspect what the AI did
 *   - UX: the "Autopilot" panel in the frontend reads from /api/agent/auditLog
 *   - idempotency: the orchestrator checks "did we already post today?"
 *
 * Persistence layering:
 *   - Always kept in-memory (ring buffer, ~500 entries) so it works in
 *     Vercel serverless invocations.
 *   - ALSO written to /tmp/synapse-audit.jsonl when the filesystem is
 *     writable. On Vercel, /tmp is warm-instance-scoped; this is a
 *     best-effort cache, not durable storage.
 *   - The GBP itself is the durable source of truth: "did we post today?"
 *     is answered by listing posts via the GBP API, not by trusting the log.
 */

const fs = require('fs');
const path = require('path');

const MAX_ENTRIES = 500;
const LOG_PATH = process.env.SYNAPSE_AUDIT_PATH || path.join('/tmp', 'synapse-audit.jsonl');

const ring = [];
let fileWritable = true;

function loadFromDisk() {
    try {
        if (!fs.existsSync(LOG_PATH)) return;
        const raw = fs.readFileSync(LOG_PATH, 'utf8');
        raw.split('\n').forEach(line => {
            if (!line.trim()) return;
            try {
                const entry = JSON.parse(line);
                ring.push(entry);
            } catch { /* corrupt line, skip */ }
        });
        while (ring.length > MAX_ENTRIES) ring.shift();
    } catch (e) {
        fileWritable = false;
    }
}

loadFromDisk();

/**
 * Record an audit event. Non-blocking — failures don't throw.
 */
function record(type, payload = {}) {
    const entry = {
        ts: new Date().toISOString(),
        type,
        payload: sanitize(payload),
    };
    ring.push(entry);
    while (ring.length > MAX_ENTRIES) ring.shift();

    if (fileWritable) {
        try {
            fs.appendFileSync(LOG_PATH, JSON.stringify(entry) + '\n');
        } catch {
            fileWritable = false;
        }
    }
    return entry;
}

/**
 * Strip obviously-sensitive fields before persisting.
 * Customer review text is kept (it's already public on Google) but
 * anything that looks like a token or key is removed.
 */
function sanitize(obj) {
    if (obj == null || typeof obj !== 'object') return obj;
    const out = Array.isArray(obj) ? [] : {};
    for (const [k, v] of Object.entries(obj)) {
        const lk = k.toLowerCase();
        if (lk.includes('token') || lk.includes('secret') || lk.includes('apikey') || lk.includes('authorization')) {
            out[k] = '[REDACTED]';
        } else if (typeof v === 'object') {
            out[k] = sanitize(v);
        } else {
            out[k] = v;
        }
    }
    return out;
}

/**
 * Return the most recent N entries, newest last (chronological).
 * Optional filter by type prefix.
 */
function recent(limit = 100, typePrefix = null) {
    const filtered = typePrefix
        ? ring.filter(e => e.type.startsWith(typePrefix))
        : ring.slice();
    return filtered.slice(-limit);
}

/**
 * Returns the most recent entry matching the given type, or null.
 */
function findLast(type) {
    for (let i = ring.length - 1; i >= 0; i--) {
        if (ring[i].type === type) return ring[i];
    }
    return null;
}

module.exports = {
    record,
    recent,
    findLast,
    _ring: ring,
};
