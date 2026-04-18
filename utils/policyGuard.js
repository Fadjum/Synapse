/**
 * Policy guard — the safety net between the AI and the public internet.
 *
 * Before the autonomous agent publishes ANY content on the Google Business
 * Profile, the text must pass through these checks. If a check fails the
 * content is rejected and logged; it is never re-tried silently.
 *
 * Rules enforced:
 *   1. Length limits (GBP hard caps: post 1500 chars, reply 4096 chars).
 *   2. Banned medical-claim terms (cure, guarantee, miracle, etc.).
 *   3. No leaked customer PII (email, phone that isn't the clinic's own).
 *   4. No URLs other than the clinic's own website / tel:.
 *   5. Plain-English only (reject non-ASCII-heavy output, emoji, hashtags).
 *   6. No profanity or aggressive language in review replies.
 *   7. No reply to <=2-star reviews without human approval (handled by orchestrator).
 *
 * All helpers return { ok: boolean, reasons: string[], cleaned?: string }.
 */

const { CONTENT_CONSTRAINTS, CLINIC } = require('./contentStrategy');

const POST_MAX = 1400;
const POST_MIN = 40;
const REPLY_MAX = 4000;
const REPLY_MIN = 12;

const URL_RE = /\bhttps?:\/\/[^\s)]+/gi;
const EMAIL_RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
// International phone-ish pattern. Deliberately loose — we only care that
// the Agent isn't making up phone numbers.
const PHONE_RE = /(?:\+?\d[\d\s\-().]{7,}\d)/g;
const EMOJI_RE = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u;
const HASHTAG_RE = /(^|\s)#[A-Za-z0-9_]+/;

// Profanity list is intentionally narrow — the goal is catching Gemini
// regressions, not policing users.
const PROFANITY = [
    'damn', 'hell', 'stupid', 'idiot', 'shut up', 'crap',
];

// Medical / policy banned terms (both posts and replies).
const STRONG_CLAIMS = [
    'cure', 'cures', 'cured',
    'guarantee', 'guaranteed', 'guarantees',
    'miracle', 'miraculous',
    '100%', 'scientifically proven',
    'fda approved', 'fda-approved',
    'prescribe you', 'prescription for',
];

// Superlatives banned per Google's review-policy spirit (misleading).
const SUPERLATIVES = [
    'best ent', 'number one', '#1 clinic',
];

/**
 * Returns an array of reasons why `text` fails length constraints.
 */
function checkLength(text, { min, max }) {
    const reasons = [];
    const len = (text || '').trim().length;
    if (len < min) reasons.push(`too_short(${len}<${min})`);
    if (len > max) reasons.push(`too_long(${len}>${max})`);
    return reasons;
}

function containsAny(text, list) {
    const lower = (text || '').toLowerCase();
    return list.filter(term => lower.includes(term));
}

/**
 * Extract URLs that are NOT the clinic's own website / google maps / tel:.
 */
function foreignUrls(text) {
    const matches = (text || '').match(URL_RE) || [];
    return matches.filter(u => {
        try {
            const host = new URL(u).hostname.toLowerCase();
            const ownHost = new URL(CLINIC.website).hostname.toLowerCase();
            if (host === ownHost) return false;
            if (host.endsWith('.' + ownHost)) return false;
            if (host.endsWith('google.com') || host.endsWith('maps.google.com')) return false;
            return true;
        } catch {
            return true; // malformed URL = foreign
        }
    });
}

/**
 * Validate a post body that the autonomous agent wants to publish.
 */
function validatePost(text) {
    const reasons = [];
    const trimmed = (text || '').trim();

    reasons.push(...checkLength(trimmed, { min: POST_MIN, max: POST_MAX }));

    const claims = containsAny(trimmed, STRONG_CLAIMS);
    if (claims.length) reasons.push(`banned_claim:${claims.join('|')}`);

    const supers = containsAny(trimmed, SUPERLATIVES);
    if (supers.length) reasons.push(`banned_superlative:${supers.join('|')}`);

    const configuredBanned = containsAny(trimmed, CONTENT_CONSTRAINTS.bannedTerms);
    if (configuredBanned.length) reasons.push(`banned_term:${configuredBanned.join('|')}`);

    const urls = foreignUrls(trimmed);
    if (urls.length) reasons.push(`foreign_url:${urls.join('|')}`);

    const emails = trimmed.match(EMAIL_RE);
    if (emails) reasons.push(`contains_email:${emails.join('|')}`);

    // A single phone-shaped number is allowed IF it matches the clinic's
    // GBP-registered phone (passed in by the orchestrator via env). We
    // default to rejecting any phone-shaped substring.
    const phones = trimmed.match(PHONE_RE);
    if (phones && phones.length) reasons.push(`contains_phone:${phones.length}`);

    if (EMOJI_RE.test(trimmed)) reasons.push('contains_emoji');
    if (HASHTAG_RE.test(trimmed)) reasons.push('contains_hashtag');

    const profanity = containsAny(trimmed, PROFANITY);
    if (profanity.length) reasons.push(`profanity:${profanity.join('|')}`);

    // Reject content that's mostly non-ASCII — signals Gemini drift.
    if (trimmed.length > 0) {
        const nonAscii = (trimmed.match(/[^\x00-\x7F]/g) || []).length;
        if (nonAscii / trimmed.length > 0.15) reasons.push('non_english_heavy');
    }

    return { ok: reasons.length === 0, reasons, cleaned: trimmed };
}

/**
 * Validate an auto-generated review reply.
 */
function validateReviewReply(text, reviewMeta = {}) {
    const reasons = [];
    const trimmed = (text || '').trim();

    reasons.push(...checkLength(trimmed, { min: REPLY_MIN, max: REPLY_MAX }));

    const claims = containsAny(trimmed, STRONG_CLAIMS);
    if (claims.length) reasons.push(`banned_claim:${claims.join('|')}`);

    const configuredBanned = containsAny(trimmed, CONTENT_CONSTRAINTS.bannedTermsInReplies);
    if (configuredBanned.length) reasons.push(`banned_term:${configuredBanned.join('|')}`);

    const urls = foreignUrls(trimmed);
    if (urls.length) reasons.push(`foreign_url:${urls.join('|')}`);

    const emails = trimmed.match(EMAIL_RE);
    if (emails) reasons.push(`contains_email:${emails.join('|')}`);

    const phones = trimmed.match(PHONE_RE);
    if (phones && phones.length) reasons.push(`contains_phone:${phones.length}`);

    const profanity = containsAny(trimmed, PROFANITY);
    if (profanity.length) reasons.push(`profanity:${profanity.join('|')}`);

    if (HASHTAG_RE.test(trimmed)) reasons.push('contains_hashtag');
    if (EMOJI_RE.test(trimmed)) reasons.push('contains_emoji');

    // Privacy: the reply must not quote the reviewer's full text back or
    // reveal any personal info the reviewer shared.
    if (reviewMeta.comment) {
        const revSnippet = reviewMeta.comment.trim().slice(0, 40).toLowerCase();
        if (revSnippet.length > 20 && trimmed.toLowerCase().includes(revSnippet)) {
            reasons.push('quotes_reviewer_text');
        }
    }

    return { ok: reasons.length === 0, reasons, cleaned: trimmed };
}

/**
 * Decide if a given review is safe for AUTO-reply (i.e. without human review).
 * Conservative defaults:
 *   - Only reply to 4 or 5-star reviews automatically.
 *   - Skip if review already has an owner reply.
 *   - Skip if review comment looks like it mentions medical complaints
 *     or emergencies — those need a human.
 *   - Skip very long complaints (>600 chars).
 */
function isSafeForAutoReply(review) {
    const reasons = [];
    const stars = starToNumber(review.starRating);
    if (stars === null || stars < 4) reasons.push('low_or_unknown_star_rating');
    if (review.hasReply) reasons.push('already_replied');
    const comment = (review.comment || '').toLowerCase();
    if (comment.length > 600) reasons.push('long_complaint_needs_human');
    const redFlags = [
        'lawsuit', 'sue', 'malpractice', 'negligence',
        'emergency', 'worse', 'infection', 'died', 'death',
        'refund', 'money back', 'scam', 'fraud',
    ];
    const hits = redFlags.filter(t => comment.includes(t));
    if (hits.length) reasons.push(`red_flag:${hits.join('|')}`);
    return { ok: reasons.length === 0, reasons };
}

function starToNumber(rating) {
    if (typeof rating === 'number') return rating;
    const map = { ONE: 1, TWO: 2, THREE: 3, FOUR: 4, FIVE: 5 };
    return map[(rating || '').toString().toUpperCase()] ?? null;
}

module.exports = {
    validatePost,
    validateReviewReply,
    isSafeForAutoReply,
    foreignUrls,
    // exported for tests / debugging
    _internal: { STRONG_CLAIMS, SUPERLATIVES, POST_MAX, REPLY_MAX },
};
