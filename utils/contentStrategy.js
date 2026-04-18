/**
 * Content strategy engine for Eritage ENT Care (Entebbe, Uganda).
 *
 * Produces daily post ideas for the autonomous GBP agent. Content is grouped
 * into rotating themes so the feed stays varied across a full week. Each
 * theme gives Gemini a constrained prompt so we never drift into
 * medical-advice or prohibited-claim territory.
 *
 * Every topic includes:
 *  - theme: short ID
 *  - prompt: what Gemini must write
 *  - callToAction: optional { actionType, url } attached to the GBP post
 *  - topicType: STANDARD | OFFER | EVENT (GBP enum)
 *
 * The weekly rotation is deterministic — index = dayOfWeek (Sun=0..Sat=6) —
 * so we always know today's topic and can avoid repeats.
 */

const CLINIC = {
    name: 'Eritage ENT Care',
    city: 'Entebbe',
    country: 'Uganda',
    phone: '+256', // kept generic; the real phone lives on the GBP profile itself
    website: 'https://eritageentcare.com',
    primarySpecialty: 'Ear, Nose & Throat (ENT)',
    audience: 'adults and children in and around Entebbe and greater Kampala',
    tone: 'warm, professional, reassuring, plain-English',
};

/**
 * Rotating weekly themes. Index matches JavaScript getDay() (Sunday = 0).
 * Each slot must be safe for daily public posting: no medical advice,
 * no guarantees, no disease claims.
 */
const WEEKLY_THEMES = [
    // Sunday — gentle awareness / community
    {
        theme: 'community_awareness',
        topicType: 'STANDARD',
        callToAction: { actionType: 'LEARN_MORE', useWebsite: true },
        prompt:
            'Write a short, warm community-awareness post for an ENT clinic in Entebbe, Uganda. ' +
            'Pick ONE everyday ENT topic (e.g. protecting hearing from loud music, staying hydrated to ease throat irritation, ' +
            'why you should never use cotton buds deep in the ear, seasonal allergy comfort tips, caring for your voice). ' +
            'Offer ONE practical tip and invite readers to book a professional check-up if symptoms persist. ' +
            'Avoid disease names, diagnoses, treatment claims, dosages, or medical guarantees. ' +
            'Do not use the words "cure", "treat", "guaranteed", or "best". ' +
            'Do not tell anyone to stop seeing another doctor. ' +
            'Keep it 3–5 short sentences, friendly and plain. No hashtags, no emojis.',
    },
    // Monday — "Meet the team" / clinic culture (no person-specific claims)
    {
        theme: 'clinic_culture',
        topicType: 'STANDARD',
        callToAction: { actionType: 'LEARN_MORE', useWebsite: true },
        prompt:
            'Write a short, welcoming post about the patient experience at Eritage ENT Care in Entebbe, Uganda. ' +
            'Emphasise one of: a calm clinic environment, modern diagnostic equipment, child-friendly care, ' +
            'or careful listening during consultations. ' +
            'Speak in general terms about the clinic — do NOT mention individual staff names, photos, or credentials. ' +
            'Invite readers to schedule a consultation. ' +
            'No medical claims, no superlatives like "best" or "top". 3–5 short sentences. No hashtags, no emojis.',
    },
    // Tuesday — service spotlight (informational, not promotional/medical advice)
    {
        theme: 'service_spotlight',
        topicType: 'STANDARD',
        callToAction: { actionType: 'BOOK', useWebsite: true },
        prompt:
            'Write a brief informational post spotlighting ONE general ENT service category offered at Eritage ENT Care ' +
            '(e.g. hearing assessments, ear cleaning by a professional, nasal congestion consultations, sore-throat evaluations, ' +
            'paediatric ENT check-ups, snoring or sleep-breathing assessments). ' +
            'Describe who might benefit in plain language, without promising outcomes. ' +
            'Do not list prices. Do not compare to other clinics. No "cure", "treat", "guaranteed", "best". ' +
            'Invite readers to book an appointment. 3–5 short sentences. No hashtags, no emojis.',
    },
    // Wednesday — everyday ENT wellness tip
    {
        theme: 'wellness_tip',
        topicType: 'STANDARD',
        callToAction: { actionType: 'LEARN_MORE', useWebsite: true },
        prompt:
            'Write a short, useful wellness tip related to ear, nose, or throat health for readers in Entebbe, Uganda. ' +
            'Example angles: safe ear hygiene, reducing screen-time-related throat strain, staying hydrated, ' +
            'how to protect your ears at loud events, when to rest your voice. ' +
            'Give ONE gentle, general tip and remind readers a professional check-up helps if symptoms last or worsen. ' +
            'Do not diagnose. Do not recommend specific medications, dosages, or home remedies. ' +
            'No "cure", "treat", "guaranteed", "best". 3–5 short sentences. No hashtags, no emojis.',
    },
    // Thursday — FAQ / "did you know" (educational, neutral)
    {
        theme: 'did_you_know',
        topicType: 'STANDARD',
        callToAction: { actionType: 'LEARN_MORE', useWebsite: true },
        prompt:
            'Write a short "did you know?" style post about a general, non-alarming ENT fact ' +
            '(e.g. the ear has three main parts, the nose warms air before it reaches the lungs, ' +
            'the tonsils are part of the immune system, balance is partly controlled by the inner ear). ' +
            'Keep it educational and curious, not promotional. ' +
            'Close with a friendly reminder that Eritage ENT Care in Entebbe is available for check-ups. ' +
            'No diagnoses, no treatment claims, no "cure"/"treat"/"guaranteed"/"best". ' +
            '3–5 short sentences. No hashtags, no emojis.',
    },
    // Friday — gentle seasonal/weekly reminder
    {
        theme: 'weekly_reminder',
        topicType: 'STANDARD',
        callToAction: { actionType: 'CALL', useWebsite: false },
        prompt:
            'Write a short, friendly end-of-week post reminding readers in Entebbe that Eritage ENT Care is open ' +
            'and welcoming new patients for ear, nose, and throat concerns. ' +
            'Encourage anyone who has been putting off a check-up to call and book. ' +
            'No medical claims. No specific conditions. No "cure"/"treat"/"guaranteed"/"best". ' +
            '2–4 short sentences. No hashtags, no emojis.',
    },
    // Saturday — weekend soft awareness (family/kids angle)
    {
        theme: 'family_wellness',
        topicType: 'STANDARD',
        callToAction: { actionType: 'LEARN_MORE', useWebsite: true },
        prompt:
            'Write a short, warm post about family ENT wellness for weekend readers in Entebbe, Uganda. ' +
            'Pick ONE gentle angle: paediatric ear check-ups, kids and loud play, how the whole family can ease seasonal sniffles, ' +
            'or when to bring a child in for a persistent cough or earache. ' +
            'Encourage parents to book a consultation if they have concerns — avoid alarming language. ' +
            'No diagnoses, no treatment claims, no "cure"/"treat"/"guaranteed"/"best". ' +
            '3–5 short sentences. No hashtags, no emojis.',
    },
];

/**
 * Absolute content constraints enforced later by policyGuard.js.
 * Defined here so generation and validation stay in sync.
 */
const CONTENT_CONSTRAINTS = {
    maxLength: 1400,       // GBP hard limit is 1500; we leave headroom.
    minLength: 60,
    bannedTerms: [
        'cure', 'cures', 'cured',
        'guarantee', 'guaranteed', 'guarantees',
        'miracle', 'miraculous',
        'best ent', 'number one', '#1',
        'prescription', 'dosage',
        'diagnose you', 'we diagnose',
    ],
    bannedTermsInReplies: [
        'cure', 'guarantee', 'miracle',
    ],
};

/**
 * Returns today's scheduled topic (weekly rotation).
 * @param {Date} [now]
 */
function getTopicForToday(now = new Date()) {
    const idx = now.getDay();
    const topic = WEEKLY_THEMES[idx];
    return { ...topic, dayIndex: idx, dayName: dayName(idx) };
}

/**
 * Returns the next N scheduled topics starting today — handy for showing
 * a content calendar in the UI.
 */
function getUpcomingTopics(days = 7, now = new Date()) {
    const out = [];
    for (let i = 0; i < days; i++) {
        const d = new Date(now);
        d.setDate(d.getDate() + i);
        out.push({ date: d.toISOString().slice(0, 10), ...getTopicForToday(d) });
    }
    return out;
}

function dayName(idx) {
    return ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][idx];
}

module.exports = {
    CLINIC,
    WEEKLY_THEMES,
    CONTENT_CONSTRAINTS,
    getTopicForToday,
    getUpcomingTopics,
};
