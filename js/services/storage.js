// Storage Service - Handles localStorage operations for encounters and monster cache

import { compress, decompress, isCompressed, legacyDecode } from '../utils/compression.js';

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

// Export encounter to shareable URL (async due to compression)
export async function exportEncounterToURL(encounter) {
    // Create a minimal copy without the id (will be regenerated on import)
    const exportData = {
        t: encounter.title,
        d: encounter.description || '',
        p: (encounter.pcs || []).map(pc => pc.name),
        m: (encounter.monsters || []).map(m => ({
            n: m.name,
            s: m.source,
            c: m.cr,
            h: m.hp,
            cm: m.comment || ''
        })),
        a: encounter.autoAddMonsters ? 1 : 0
    };
    
    const json = JSON.stringify(exportData);
    const encoded = await compress(json);
    const url = `${window.location.origin}${window.location.pathname}?import=${encoded}#/encounters`;
    return url;
}

// Import encounter from URL parameter (async due to decompression)
export async function importEncounterFromURL() {
    const params = new URLSearchParams(window.location.search);
    const importData = params.get('import');
    
    if (!importData) return null;
    
    try {
        let json;
        if (isCompressed(importData)) {
            // New compressed format
            json = await decompress(importData);
        } else {
            // Legacy uncompressed format: btoa(encodeURIComponent(json))
            json = legacyDecode(importData);
        }
        const data = JSON.parse(json);
        
        // Reconstruct the encounter object
        const encounter = {
            id: Date.now().toString(),
            title: data.t || 'Imported Encounter',
            description: data.d || '',
            pcs: (data.p || []).map(name => ({ name })),
            monsters: (data.m || []).map(m => ({
                name: m.n,
                source: m.s,
                cr: m.c,
                hp: m.h,
                comment: m.cm || ''
            })),
            autoAddMonsters: data.a === 1,
            folderIds: []
        };
        
        return encounter;
    } catch (e) {
        console.error('Failed to import encounter from URL:', e);
        return null;
    }
}

// Clear the import parameter from URL without reloading
export function clearImportParam() {
    const url = new URL(window.location);
    url.searchParams.delete('import');
    window.history.replaceState({}, '', url);
}

// Export encounter to JSON string (for copy/paste sharing)
export function exportEncounterToJSON(encounter) {
    const exportData = {
        title: encounter.title,
        description: encounter.description || '',
        pcs: encounter.pcs || [],
        monsters: encounter.monsters || [],
        autoAddMonsters: encounter.autoAddMonsters || false
    };
    return JSON.stringify(exportData, null, 2);
}

// Import encounter from JSON string
export function importEncounterFromJSON(jsonString) {
    try {
        const data = JSON.parse(jsonString);
        
        // Validate required fields
        if (!data.title) {
            throw new Error('Encounter must have a title');
        }
        
        // Create a valid encounter object with defaults for missing fields
        const encounter = {
            id: Date.now().toString(),
            title: data.title,
            description: data.description || '',
            pcs: (data.pcs || []).map(pc => ({
                name: pc.name || pc
            })),
            monsters: (data.monsters || []).map(m => ({
                name: m.name || m.n,
                source: m.source || m.s || 'Unknown',
                cr: m.cr || m.c || '0',
                hp: m.hp || m.h || 0,
                comment: m.comment || m.cm || ''
            })),
            autoAddMonsters: data.autoAddMonsters || false,
            folderIds: data.folderIds || []
        };
        
        return encounter;
    } catch (e) {
        console.error('Failed to import encounter from JSON:', e);
        throw new Error(`Invalid JSON: ${e.message}`);
    }
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
    cacheMonster,
    exportEncounterToURL,
    importEncounterFromURL,
    clearImportParam,
    exportEncounterToJSON,
    importEncounterFromJSON
};
