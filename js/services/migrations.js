// Schema migrations for locally stored data.
//
// Migration 1 replaces the old `Date.now()`-derived record ids with UUIDs and
// stamps every record with an `updatedAt`, which is what multi-device sync needs
// to identify records and resolve conflicts.
//
// The tricky part is that ids are referenced across collections, so they cannot
// simply be regenerated in place:
//   - `encounter.monsters[].customMonsterId` points at a custom monster
//   - `encounter.folderIds` / `customMonster.folderIds` point at folders, and
//     the two folder stores have completely independent id spaces
// Every mapping is therefore built before anything is rewritten.
//
// This module talks to localStorage directly rather than going through
// records.js, because records.js calls into it (and would otherwise be circular).

import { uuid, isUuid } from '../utils/uuid.js';

const VERSION_KEY = 'dnd-schema-version';
const CURRENT_VERSION = 1;

const ENCOUNTERS_KEY = 'dnd-encounters';
const CUSTOM_MONSTERS_KEY = 'dnd-custom-monsters';
const CHARACTERS_KEY = 'dnd-characters';
const MONSTER_FOLDERS_KEY = 'dnd-monster-folders';
const ENCOUNTER_FOLDERS_KEY = 'dnd-encounter-folders';

function read(key) {
    const data = localStorage.getItem(key);
    if (!data) return [];
    try {
        const parsed = JSON.parse(data);
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
}

function write(key, items) {
    localStorage.setItem(key, JSON.stringify(items));
}

export function getSchemaVersion() {
    const raw = localStorage.getItem(VERSION_KEY);
    const parsed = parseInt(raw, 10);
    return Number.isFinite(parsed) ? parsed : 0;
}

// Assigns UUIDs to any record that does not already have one, returning the
// old-id -> new-id mapping. Records that were already migrated map to
// themselves, which is what makes a re-run a no-op.
function assignIds(items, timestamp) {
    const idMap = new Map();
    const migrated = items.map(item => {
        const oldId = item.id;
        const newId = isUuid(oldId) ? oldId : uuid();
        if (oldId != null) idMap.set(oldId, newId);
        return {
            ...item,
            id: newId,
            updatedAt: item.updatedAt ?? timestamp
        };
    });
    return { items: migrated, idMap };
}

function remapFolderIds(item, folderIdMap) {
    if (!Array.isArray(item.folderIds)) return item;
    return {
        ...item,
        // Unmapped ids are dropped: dangling folder references already exist in
        // stored data and carrying them forward would keep them dangling.
        folderIds: item.folderIds.map(id => folderIdMap.get(id)).filter(Boolean)
    };
}

function migrateToV1() {
    const timestamp = Date.now();

    const monsterFolders = assignIds(read(MONSTER_FOLDERS_KEY), timestamp);
    const encounterFolders = assignIds(read(ENCOUNTER_FOLDERS_KEY), timestamp);
    const customMonsters = assignIds(read(CUSTOM_MONSTERS_KEY), timestamp);
    const encounters = assignIds(read(ENCOUNTERS_KEY), timestamp);
    const characters = assignIds(read(CHARACTERS_KEY), timestamp);

    const monsters = customMonsters.items.map(m => remapFolderIds(m, monsterFolders.idMap));

    const remappedEncounters = encounters.items.map(encounter => {
        const withFolders = remapFolderIds(encounter, encounterFolders.idMap);
        if (!Array.isArray(withFolders.monsters)) return withFolders;

        return {
            ...withFolders,
            monsters: withFolders.monsters.map(entry => {
                if (!entry.customMonsterId) return entry;
                const mapped = customMonsters.idMap.get(entry.customMonsterId);
                if (mapped) return { ...entry, customMonsterId: mapped };
                // The custom monster is gone. Drop the link and let the views
                // fall back to their name/source lookup.
                const { customMonsterId, ...rest } = entry;
                return rest;
            })
        };
    });

    // Everything is written before the version bumps, so a crash part-way
    // through simply re-runs the whole migration on the next load.
    write(MONSTER_FOLDERS_KEY, monsterFolders.items);
    write(ENCOUNTER_FOLDERS_KEY, encounterFolders.items);
    write(CUSTOM_MONSTERS_KEY, monsters);
    write(ENCOUNTERS_KEY, remappedEncounters);
    write(CHARACTERS_KEY, characters.items);
}

export function runMigrations() {
    if (getSchemaVersion() >= CURRENT_VERSION) return false;
    migrateToV1();
    localStorage.setItem(VERSION_KEY, String(CURRENT_VERSION));
    return true;
}

export default { runMigrations, getSchemaVersion, VERSION_KEY, CURRENT_VERSION };
