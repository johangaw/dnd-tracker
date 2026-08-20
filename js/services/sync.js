// Multi-device sync: pull, then push, last write wins.
//
// This layer never talks to the app's data directly. It reads and writes the
// same localStorage collections through records.js, which is also what tells it
// when something became dirty. If sync is not configured or the user is signed
// out, none of this runs and the app behaves exactly as it always has.

import { CONFIG, isSyncConfigured } from '../config.js';
import * as Auth from './auth.js';
import {
    SYNCED_KEYS,
    readRaw,
    writeRaw,
    getDirty,
    clearDirty,
    markDirty,
    hasDirty,
    setClockOffset,
    onChange
} from './records.js';

const STATE_KEY = 'dnd-sync-state';
const PUSH_BATCH_SIZE = 25;
const DEBOUNCE_MS = 3000;

// Local edits are pushed one batch at a time; this is how many round trips a
// single sync will make before leaving the rest for the next one.
const MAX_PUSH_BATCHES = 20;

let status = 'idle';
const statusListeners = new Set();
let debounceTimer = null;
let syncInFlight = null;

export function getState() {
    try {
        return JSON.parse(localStorage.getItem(STATE_KEY)) || {};
    } catch {
        return {};
    }
}

function saveState(patch) {
    localStorage.setItem(STATE_KEY, JSON.stringify({ ...getState(), ...patch }));
}

export function onStatusChange(listener) {
    statusListeners.add(listener);
    listener(status);
    return () => statusListeners.delete(listener);
}

function setStatus(next, detail) {
    status = next;
    for (const listener of statusListeners) listener(next, detail);
}

export function getStatus() {
    return status;
}

export function isEnabled() {
    return isSyncConfigured() && Auth.isSignedIn();
}

async function api(path, body) {
    const token = await Auth.getAccessToken();
    if (!token) throw new Error('Not signed in');

    const response = await fetch(`${CONFIG.apiBase}${path}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
        body: JSON.stringify(body)
    });

    if (!response.ok) {
        const detail = await response.json().catch(() => ({}));
        throw new Error(detail.error || `Request failed (${response.status})`);
    }
    return response.json();
}

// A record as stored locally, split into the envelope the API expects.
function toWireFormat(col, record) {
    const { updatedAt, deletedAt, ...data } = record;
    return {
        col,
        id: record.id,
        updatedAt,
        deletedAt: deletedAt ?? null,
        data: deletedAt ? null : data
    };
}

function fromWireFormat(record) {
    if (record.deletedAt) {
        return { id: record.id, updatedAt: record.updatedAt, deletedAt: record.deletedAt };
    }
    return { ...record.data, id: record.id, updatedAt: record.updatedAt, deletedAt: null };
}

// Last write wins by updatedAt. Ties go to the delete, because a record that
// was deleted on one device and edited on another is more likely meant to be
// gone than resurrected.
function remoteWins(remote, local, isDirty) {
    if (!local) return true;
    // A clean local record is just a cached copy of what the server had, so the
    // server is always right about it.
    if (!isDirty) return true;

    if (remote.updatedAt !== local.updatedAt) return remote.updatedAt > local.updatedAt;
    return Boolean(remote.deletedAt) && !local.deletedAt;
}

function applyPulled(records) {
    const byCollection = new Map();
    for (const record of records) {
        if (!SYNCED_KEYS.includes(record.col)) continue; // a collection this version does not know
        if (!byCollection.has(record.col)) byCollection.set(record.col, []);
        byCollection.get(record.col).push(record);
    }

    const dirty = getDirty();
    let applied = 0;
    let overwritten = 0;

    for (const [col, incoming] of byCollection) {
        const local = readRaw(col);
        const byId = new Map(local.map(r => [r.id, r]));
        const dirtyIds = new Set(dirty[col] || []);
        const settled = [];

        for (const record of incoming) {
            const current = byId.get(record.id);
            const isDirty = dirtyIds.has(record.id);

            if (!remoteWins(record, current, isDirty)) continue;

            byId.set(record.id, fromWireFormat(record));
            applied++;
            // A local edit that lost is worth telling the user about; a clean
            // record being updated is just sync working.
            if (isDirty) {
                overwritten++;
                settled.push(record.id);
            }
        }

        // writeRaw, not writeCollection: applying a pull must not re-stamp
        // updatedAt or mark everything dirty again.
        writeRaw(col, [...byId.values()]);
        if (settled.length) clearDirty(col, settled);
    }

    return { applied, overwritten };
}

function collectDirtyRecords() {
    const dirty = getDirty();
    const pending = [];

    for (const col of SYNCED_KEYS) {
        const ids = dirty[col];
        if (!ids?.length) continue;

        const byId = new Map(readRaw(col).map(r => [r.id, r]));
        for (const id of ids) {
            const record = byId.get(id);
            // Gone entirely, without even a tombstone: nothing to say about it.
            if (!record) {
                clearDirty(col, [id]);
                continue;
            }
            pending.push(toWireFormat(col, record));
        }
    }

    return pending;
}

async function pushDirty() {
    let pushed = 0;
    let overwritten = 0;

    for (let batch = 0; batch < MAX_PUSH_BATCHES; batch++) {
        const pending = collectDirtyRecords().slice(0, PUSH_BATCH_SIZE);
        if (!pending.length) break;

        const result = await api('/sync/push', { records: pending });

        for (const { col, id } of result.applied || []) {
            clearDirty(col, [id]);
            pushed++;
        }

        // The server refused these because its copy is newer, so adopt it.
        if (result.conflicts?.length) {
            for (const conflict of result.conflicts) {
                const local = readRaw(conflict.col);
                const byId = new Map(local.map(r => [r.id, r]));
                byId.set(conflict.id, fromWireFormat(conflict));
                writeRaw(conflict.col, [...byId.values()]);
                clearDirty(conflict.col, [conflict.id]);
                overwritten++;
            }
        }

        if (!result.applied?.length && !result.conflicts?.length) break; // no progress
    }

    return { pushed, overwritten };
}

// Signing in as someone else on a device that still holds unsynced local data
// would otherwise merge one person's encounters into another's account.
function checkAccountSwitch() {
    const { ownerSub } = getState();
    const identity = Auth.getIdentity();

    if (ownerSub && identity?.sub && ownerSub !== identity.sub && hasDirty()) {
        throw new Error(
            'This device has unsynced data from a different account. ' +
            'Export a backup from Settings, then sign out and back in to continue.'
        );
    }
}

export async function syncNow() {
    if (!isEnabled()) return { skipped: true };
    if (syncInFlight) return syncInFlight;

    syncInFlight = (async () => {
        setStatus('syncing');
        try {
            checkAccountSwitch();

            const { cursor = 0 } = getState();
            const pull = await api('/sync/pull', { cursor });

            // The server's clock is the one all conflict resolution compares
            // against, so a device with a skewed clock cannot win or lose every
            // conflict forever.
            setClockOffset(pull.now - Date.now());

            const pulled = applyPulled(pull.records || []);
            const pushed = await pushDirty();

            saveState({
                cursor: pull.cursor ?? cursor,
                lastSyncAt: Date.now(),
                clockOffset: pull.now - Date.now(),
                ownerSub: Auth.getIdentity()?.sub ?? null
            });

            const overwritten = pulled.overwritten + pushed.overwritten;
            setStatus('idle', { overwritten });
            return { pulled: pulled.applied, pushed: pushed.pushed, overwritten };
        } catch (e) {
            setStatus(navigator.onLine === false ? 'offline' : 'error', { message: e.message });
            throw e;
        } finally {
            syncInFlight = null;
        }
    })();

    return syncInFlight;
}

export function scheduleSync() {
    if (!isEnabled()) return;
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
        syncNow().catch(() => { /* status already reflects the failure */ });
    }, DEBOUNCE_MS);
}

// Wires sync into the app. A no-op when sync is unconfigured or signed out,
// which matters because this runs on every load - including in tests.
export function initSync() {
    if (!isSyncConfigured()) return;

    onChange(() => scheduleSync());

    window.addEventListener('online', () => scheduleSync());
    document.addEventListener('visibilitychange', () => {
        // Leaving the app is the natural moment to flush pending edits.
        if (document.visibilityState === 'hidden' && hasDirty()) scheduleSync();
    });

    if (isEnabled()) {
        syncNow().catch(() => { /* surfaced through status */ });
    }
}

export function resetForTests() {
    clearTimeout(debounceTimer);
    debounceTimer = null;
    syncInFlight = null;
    status = 'idle';
    statusListeners.clear();
}

export default {
    isEnabled,
    syncNow,
    scheduleSync,
    initSync,
    onStatusChange,
    getStatus,
    getState
};
