// UUID generation for stable, collision-free record ids.
//
// Records used to be identified by `Date.now()`-derived strings, which collide
// when two devices create records independently (and even on one device when two
// records are created in the same millisecond). Sync needs ids that are stable
// and globally unique, so every collection now uses UUID v4.
//
// `crypto.randomUUID` is only available in a secure context, so it is missing
// when the dev server is opened over plain http from another device on the LAN
// (e.g. http://192.168.1.10:3000). The fallbacks keep id generation working
// there; only sync itself requires https.

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function uuid() {
    if (globalThis.crypto?.randomUUID) {
        return crypto.randomUUID();
    }

    if (globalThis.crypto?.getRandomValues) {
        const bytes = crypto.getRandomValues(new Uint8Array(16));
        bytes[6] = (bytes[6] & 0x0f) | 0x40; // version 4
        bytes[8] = (bytes[8] & 0x3f) | 0x80; // variant 10
        const hex = [...bytes].map(b => b.toString(16).padStart(2, '0')).join('');
        return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
    }

    // Last resort: not cryptographically random, but still unique enough that
    // two records created on the same device will not collide.
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
        const r = (Math.random() * 16) | 0;
        const v = c === 'x' ? r : (r & 0x3) | 0x8;
        return v.toString(16);
    });
}

// Used by the migration to tell already-migrated records from legacy ones,
// which is what makes the migration safe to re-run.
export function isUuid(value) {
    return typeof value === 'string' && UUID_PATTERN.test(value);
}

export default { uuid, isUuid };
