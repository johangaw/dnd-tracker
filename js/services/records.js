// Records Layer - the single choke point through which every synced collection
// is read and written.
//
// Why this exists: the services above (encounters, custom monsters, characters,
// folders) all persist whole arrays via a `saveX(array)` function, and they
// delete by filtering that array. There is no per-record write hook to
// intercept. Rather than rewriting all four services (and every caller, since
// they all assume synchronous returns), this layer diffs each incoming array
// against what was stored before. From that diff it derives everything sync
// needs: which records changed, and which ones disappeared and therefore need a
// tombstone so the deletion can propagate to other devices instead of the
// record being resurrected by the next pull.
//
// This module deliberately does NOT import sync.js. Sync registers a callback
// via onChange(), so records stays testable and the app keeps working with sync
// absent or signed out.

import { uuid } from '../utils/uuid.js';
import { runMigrations } from './migrations.js';

export const ENCOUNTERS_KEY = 'dnd-encounters';
export const CUSTOM_MONSTERS_KEY = 'dnd-custom-monsters';
export const CHARACTERS_KEY = 'dnd-characters';
export const MONSTER_FOLDERS_KEY = 'dnd-monster-folders';
export const ENCOUNTER_FOLDERS_KEY = 'dnd-encounter-folders';

// The collections that participate in sync. `dnd-monster-cache` is deliberately
// absent: it is derived from the bestiary files shipped in data/, is
// regenerable, and is by far the largest thing in localStorage.
export const SYNCED_KEYS = [
    ENCOUNTERS_KEY,
    CUSTOM_MONSTERS_KEY,
    CHARACTERS_KEY,
    MONSTER_FOLDERS_KEY,
    ENCOUNTER_FOLDERS_KEY
];

const DIRTY_KEY = 'dnd-sync-dirty';

// Offset between this device's clock and the server's, set by sync.js from the
// `now` field of the last sync response. Without it a device with a skewed
// clock would win — or lose — every last-write-wins conflict forever.
let clockOffset = 0;

export function setClockOffset(offset) {
    clockOffset = Number.isFinite(offset) ? offset : 0;
}

export function now() {
    return Date.now() + clockOffset;
}

let changeListener = null;

// Sync registers here to be told when local data became dirty.
export function onChange(callback) {
    changeListener = callback;
}

let migrated = false;

function ensureMigrated() {
    if (migrated) return;
    migrated = true;
    try {
        runMigrations();
    } catch (e) {
        // A failed migration must not take the app down; the version key stays
        // unbumped so the next load retries.
        migrated = false;
        console.error('Schema migration failed:', e);
    }
}

// Key order is not guaranteed to be stable across a round trip through the
// server, so compare records by a canonical form. Otherwise a record that came
// back from a pull would look "changed" on the next save and re-dirty itself
// forever.
//
// The sync metadata itself is excluded from the comparison. `updatedAt` is the
// output of the comparison, not an input, and `deletedAt` is decided separately
// below - if it were compared, a caller that rebuilt a record from its fields
// (as the edit views do) would look different purely because it omitted a
// `deletedAt: null` that the stored copy carries.
const SYNC_FIELDS = new Set(['updatedAt', 'deletedAt']);

function canonical(value) {
    if (Array.isArray(value)) {
        return `[${value.map(canonical).join(',')}]`;
    }
    if (value && typeof value === 'object') {
        const keys = Object.keys(value)
            .filter(k => !SYNC_FIELDS.has(k) && value[k] !== undefined)
            .sort();
        return `{${keys.map(k => `${JSON.stringify(k)}:${canonical(value[k])}`).join(',')}}`;
    }
    return JSON.stringify(value) ?? 'null';
}

export function readRaw(key) {
    ensureMigrated();
    const data = localStorage.getItem(key);
    if (!data) return [];
    try {
        const parsed = JSON.parse(data);
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        console.error(`Corrupt data in ${key}, treating as empty`);
        return [];
    }
}

// Writes without diffing or stamping. Only the sync apply-path should use this:
// applying a pull must not mark the records it just received as dirty.
//
// It still has to ensure the migration has run. Otherwise writing here first
// would leave the schema version unset, and the next read would migrate - which
// regenerates ids and would silently detach these records from the dirty list
// and from anything referencing them.
export function writeRaw(key, items) {
    ensureMigrated();
    localStorage.setItem(key, JSON.stringify(items));
}

export function readCollection(key) {
    return readRaw(key).filter(r => !r.deletedAt);
}

export function writeCollection(key, items) {
    const previous = readRaw(key);
    const previousById = new Map(previous.map(r => [r.id, r]));
    const timestamp = now();
    const dirtyIds = [];

    const next = items.map(item => {
        if (!item.id) item = { ...item, id: uuid() };

        const before = previousById.get(item.id);
        // A record that is new, resurrected from a tombstone, or genuinely
        // edited gets a fresh timestamp. An untouched record keeps its old one,
        // so re-saving a whole array does not mark everything dirty.
        if (!before || before.deletedAt || canonical(before) !== canonical(item)) {
            dirtyIds.push(item.id);
            return { ...item, updatedAt: timestamp, deletedAt: null };
        }
        return item;
    });

    const presentIds = new Set(next.map(r => r.id));
    const tombstones = [];
    for (const before of previous) {
        if (presentIds.has(before.id)) continue;
        if (before.deletedAt) {
            tombstones.push(before); // already buried, carry forward untouched
        } else {
            tombstones.push({ id: before.id, deletedAt: timestamp, updatedAt: timestamp });
            dirtyIds.push(before.id);
        }
    }

    writeRaw(key, [...next, ...tombstones]);

    if (dirtyIds.length) {
        markDirty(key, dirtyIds);
        changeListener?.(key, dirtyIds);
    }
}

export function getDirty() {
    const data = localStorage.getItem(DIRTY_KEY);
    if (!data) return {};
    try {
        return JSON.parse(data) || {};
    } catch {
        return {};
    }
}

export function markDirty(key, ids) {
    const dirty = getDirty();
    dirty[key] = [...new Set([...(dirty[key] || []), ...ids])];
    localStorage.setItem(DIRTY_KEY, JSON.stringify(dirty));
}

export function clearDirty(key, ids) {
    const dirty = getDirty();
    if (!dirty[key]) return;
    const removed = new Set(ids);
    dirty[key] = dirty[key].filter(id => !removed.has(id));
    if (!dirty[key].length) delete dirty[key];
    localStorage.setItem(DIRTY_KEY, JSON.stringify(dirty));
}

export function hasDirty() {
    return Object.values(getDirty()).some(ids => ids.length > 0);
}

// Test seam: lets a suite force the migration to re-run against freshly seeded
// localStorage, since tests seed data after the modules have been imported.
export function resetForTests() {
    migrated = false;
    clockOffset = 0;
    changeListener = null;
}

export default {
    SYNCED_KEYS,
    readCollection,
    writeCollection,
    readRaw,
    writeRaw,
    getDirty,
    markDirty,
    clearDirty,
    hasDirty,
    setClockOffset,
    now,
    onChange
};
