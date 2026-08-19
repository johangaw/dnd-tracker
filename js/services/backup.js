// Backup Service - exports and restores every synced collection as one file.
//
// Sharing has always been per-item (a link or a blob of JSON for one encounter,
// monster or character). This is the whole-app equivalent: everything in one
// document, so data can be moved to another device or kept as a safety net.
//
// Restoring merges rather than replaces, and resolves collisions the same way
// sync does - the newer `updatedAt` wins. That means importing a backup onto a
// device that has since moved on will not silently undo newer work, and
// importing the same file twice is a no-op.

import { readCollection, writeCollection, SYNCED_KEYS } from './records.js';

const BACKUP_VERSION = 1;

export function exportAllData() {
    const collections = {};
    for (const key of SYNCED_KEYS) {
        collections[key] = readCollection(key);
    }

    return JSON.stringify({
        version: BACKUP_VERSION,
        exportedAt: new Date().toISOString(),
        collections
    }, null, 2);
}

export function countRecords(backup) {
    return Object.values(backup.collections || {})
        .reduce((total, items) => total + (Array.isArray(items) ? items.length : 0), 0);
}

export function parseBackup(jsonString) {
    let backup;
    try {
        backup = JSON.parse(jsonString);
    } catch (e) {
        throw new Error(`Not valid JSON: ${e.message}`);
    }

    if (!backup || typeof backup !== 'object' || !backup.collections) {
        throw new Error('This does not look like a D&D Tracker backup file');
    }
    if (backup.version > BACKUP_VERSION) {
        throw new Error('This backup was made by a newer version of the app');
    }

    return backup;
}

export function importAllData(jsonString) {
    const backup = parseBackup(jsonString);
    const summary = { added: 0, updated: 0, skipped: 0 };

    for (const key of SYNCED_KEYS) {
        const incoming = backup.collections[key];
        if (!Array.isArray(incoming)) continue;

        const existing = readCollection(key);
        const byId = new Map(existing.map(r => [r.id, r]));

        for (const record of incoming) {
            if (!record?.id) continue;

            const current = byId.get(record.id);
            if (!current) {
                byId.set(record.id, record);
                summary.added++;
            } else if ((record.updatedAt || 0) > (current.updatedAt || 0)) {
                byId.set(record.id, record);
                summary.updated++;
            } else {
                summary.skipped++;
            }
        }

        writeCollection(key, [...byId.values()]);
    }

    return summary;
}

export default { exportAllData, importAllData, parseBackup, countRecords };
