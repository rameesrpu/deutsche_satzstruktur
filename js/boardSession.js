// Boards: the pure queue of one practice session. Only an item's first answer counts;
// a wrong item comes back once at the end.

/** @returns {{queue: string[], pos: number, first: Object<string, boolean>}} */
export function createSession(ids) {
    return { queue: [...ids], pos: 0, first: {} };
}

export function currentItem(session) {
    return session.pos < session.queue.length ? session.queue[session.pos] : null;
}

/** Answer the current item; returns a new session. */
export function answer(session, ok) {
    const id = currentItem(session);
    if (id === null) return session;
    const firstTime = !(id in session.first);
    const queue = [...session.queue];
    if (firstTime && !ok) queue.push(id);
    return {
        queue,
        pos: session.pos + 1,
        first: firstTime ? { ...session.first, [id]: ok } : session.first,
    };
}

export function sessionDone(session) {
    return session.pos >= session.queue.length;
}

/** First answers, in order of first answer. */
export function sessionResults(session) {
    return Object.keys(session.first).map(id => ({ id, ok: session.first[id] }));
}
