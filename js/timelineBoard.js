// timelineBoard: the time board kind (Die Zeit). A verb is placed on a timeline (Gestern / Jetzt / Morgen),
// completed into the Perfekt bracket (Klammer) and sorted by auxiliary (haben oder sein?).
// This file is the pure part: sentences, bracket frame, hints, practice ids. The DOM part is added below it.

export const AUX = {
    haben: { ich: 'habe', du: 'hast', er: 'hat', wir: 'haben', ihr: 'habt' },
    sein: { ich: 'bin', du: 'bist', er: 'ist', wir: 'sind', ihr: 'seid' },
};

export const ZONES = ['past', 'now', 'future'];

const join = (...parts) => parts.filter(p => p).join(' ');
const capital = s => s.charAt(0).toUpperCase() + s.slice(1);

/** One sentence of a verb in a time zone: Gestern + Perfekt, Jetzt / Morgen + Präsens (verb second). */
export function timeSentence(verb, zone) {
    if (zone === 'past') return join('Gestern', AUX[verb.aux][verb.person], verb.subject, verb.rest, verb.partizip) + '.';
    const lead = zone === 'future' ? 'Morgen' : 'Jetzt';
    return join(lead, verb.finite, verb.subject, verb.rest, verb.particle) + '.';
}

/** Practice ids of a mode: wann has one per verb and zone (`<id>.past|now|future`), the others one per verb. */
export function timelineItemIds(set, modeId) {
    return modeId === 'wann'
        ? set.items.flatMap(v => ZONES.map(z => `${v.id}.${z}`))
        : set.items.map(v => v.id);
}

/** The Perfekt sentence in the bracket order: Subject, auxiliary, "gestern ...", participle. */
export function clampSentence(verb) {
    return join(capital(verb.subject), AUX[verb.aux][verb.person], 'gestern', verb.rest, verb.partizip) + '.';
}

function shuffled(list, rng) {
    const a = list.slice();
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(rng() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}

/** What the Klammer exercise shows: the text before the bracket, between its parts, both choices (wrong participles only here). */
export function clampFrame(verb, rng = Math.random) {
    return {
        before: capital(verb.subject),
        middle: join('gestern', verb.rest),
        auxOptions: [AUX.haben[verb.person], AUX.sein[verb.person]],
        auxAnswer: AUX[verb.aux][verb.person],
        partOptions: shuffled([verb.partizip, ...verb.wrong], rng),
        partAnswer: verb.partizip,
    };
}

/** The short rule shown after a haben-oder-sein answer. */
export function auxHint(verb) {
    if (verb.inf === 'sein' || verb.inf === 'bleiben') return 'sein und bleiben: immer mit sein';
    return verb.aux === 'sein' ? 'Bewegung oder Veränderung → sein' : 'Alle anderen → haben';
}
