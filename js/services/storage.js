// Storage Service - Handles localStorage operations for encounters and monster cache

const ENCOUNTERS_KEY = 'dnd-encounters';
const MONSTER_CACHE_KEY = 'dnd-monster-cache';

export function getEncounters() {
    const data = localStorage.getItem(ENCOUNTERS_KEY);
    return data ? JSON.parse(data) : [];
}

export function saveEncounters(encounters) {
    localStorage.setItem(ENCOUNTERS_KEY, JSON.stringify(encounters));
}

export function getEncounter(id) {
    return getEncounters().find(e => e.id === id);
}

export function saveEncounter(encounter) {
    const encounters = getEncounters();
    const index = encounters.findIndex(e => e.id === encounter.id);
    if (index >= 0) {
        encounters[index] = encounter;
    } else {
        encounters.push(encounter);
    }
    saveEncounters(encounters);
}

export function deleteEncounter(id) {
    const encounters = getEncounters().filter(e => e.id !== id);
    saveEncounters(encounters);
}

export function getMonsterCache() {
    const data = localStorage.getItem(MONSTER_CACHE_KEY);
    return data ? JSON.parse(data) : {};
}

export function cacheMonster(key, monster) {
    const cache = getMonsterCache();
    cache[key] = monster;
    localStorage.setItem(MONSTER_CACHE_KEY, JSON.stringify(cache));
}

// Default export for backward compatibility
export default {
    ENCOUNTERS_KEY,
    MONSTER_CACHE_KEY,
    getEncounters,
    saveEncounters,
    getEncounter,
    saveEncounter,
    deleteEncounter,
    getMonsterCache,
    cacheMonster
};
