/**
 * Unique numeric ids for sentences and words, shared by the whole app.
 *
 * A monotonic counter seeded from the clock. Ids must stay integers
 * (deutschCurrentSentence is read back with parseInt). Call reserveIdsAbove()
 * with the largest stored id after loading, so new ids never collide with
 * ids from an earlier session.
 */
let lastIssuedId = Date.now();

export function nextId() {
    lastIssuedId = Math.max(lastIssuedId + 1, Date.now());
    return lastIssuedId;
}

export function reserveIdsAbove(id) {
    if (Number.isFinite(id) && id > lastIssuedId) lastIssuedId = id;
}
