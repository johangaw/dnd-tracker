// Custom Monsters Service - Handles storage and sharing of user-created monsters

import { compress, decompress, isCompressed, legacyDecode } from '../utils/compression.js';
import { readCollection, writeCollection, CUSTOM_MONSTERS_KEY } from './records.js';
import { uuid } from '../utils/uuid.js';

// Get all custom monsters
export function getCustomMonsters() {
    return readCollection(CUSTOM_MONSTERS_KEY);
}

// Save all custom monsters
export function saveCustomMonsters(monsters) {
    writeCollection(CUSTOM_MONSTERS_KEY, monsters);
}

// Get a single custom monster by ID
export function getCustomMonster(id) {
    return getCustomMonsters().find(m => m.id === id);
}

// Save or update a custom monster
export function saveCustomMonster(monster) {
    const monsters = getCustomMonsters();
    const index = monsters.findIndex(m => m.id === monster.id);
    if (index >= 0) {
        monsters[index] = monster;
    } else {
        monsters.push(monster);
    }
    saveCustomMonsters(monsters);
}

// Delete a custom monster
export function deleteCustomMonster(id) {
    const monsters = getCustomMonsters().filter(m => m.id !== id);
    saveCustomMonsters(monsters);
}

// Search custom monsters by name
export function searchCustomMonsters(query) {
    const searchQuery = query.toLowerCase().trim();
    if (searchQuery.length < 2) return [];
    
    return getCustomMonsters().filter(m => 
        m.name.toLowerCase().includes(searchQuery)
    );
}

// Create a new custom monster with default values
export function createEmptyMonster() {
    return {
        id: uuid(),
        name: '',
        source: 'Custom',
        size: ['M'],
        type: 'humanoid',
        alignment: ['N'],
        ac: [{ ac: 10 }],
        hp: { average: 10, formula: '2d8+2' },
        speed: { walk: 30 },
        str: 10,
        dex: 10,
        con: 10,
        int: 10,
        wis: 10,
        cha: 10,
        cr: '1',
        trait: [],
        action: [],
        isCustom: true,
        folderIds: []
    };
}

// Create a custom monster from an existing monster (baseline)
export function createFromBaseline(baseMonster) {
    return {
        ...JSON.parse(JSON.stringify(baseMonster)), // Deep clone
        id: uuid(),
        name: `${baseMonster.name} (Custom)`,
        source: 'Custom',
        baselineSource: baseMonster.source, // Track original source
        baselineName: baseMonster.name,     // Track original name
        isCustom: true,
        folderIds: []
    };
}

// Import monster from JSON string
export function importMonsterFromJSON(jsonString) {
    try {
        let data = JSON.parse(jsonString);
        
        // Handle 5e.tools format with monster array wrapper
        if (data.monster && Array.isArray(data.monster) && data.monster.length > 0) {
            data = data.monster[0];
        }
        
        // Validate required fields
        if (!data.name) {
            throw new Error('Monster must have a name');
        }
        
        // Create a valid monster object with defaults for missing fields
        const monster = {
            id: uuid(),
            name: data.name,
            source: data.source || 'Custom',
            size: data.size || ['M'],
            type: data.type || 'creature',
            alignment: data.alignment || ['N'],
            ac: data.ac || [{ ac: 10 }],
            hp: data.hp || { average: 10, formula: '2d8' },
            speed: data.speed || { walk: 30 },
            str: data.str || 10,
            dex: data.dex || 10,
            con: data.con || 10,
            int: data.int || 10,
            wis: data.wis || 10,
            cha: data.cha || 10,
            cr: data.cr || '1',
            passive: data.passive,
            trait: data.trait || [],
            action: data.action || [],
            bonus: data.bonus || [],
            reaction: data.reaction || [],
            legendary: data.legendary || [],
            legendaryActions: data.legendaryActions,
            legendaryActionsLair: data.legendaryActionsLair,
            skill: data.skill || {},
            save: data.save || {},
            immune: data.immune || [],
            resist: data.resist || [],
            vulnerable: data.vulnerable || [],
            conditionImmune: data.conditionImmune || [],
            senses: data.senses || [],
            languages: data.languages || [],
            spellcasting: data.spellcasting || [],
            isCustom: true,
            folderIds: data.folderIds || []
        };
        
        return monster;
    } catch (e) {
        console.error('Failed to import monster from JSON:', e);
        throw new Error(`Invalid JSON: ${e.message}`);
    }
}

// Export monster to shareable URL (async due to compression)
export async function exportMonsterToURL(monster) {
    // Create a copy without the id (will be regenerated on import)
    const exportData = {
        ...monster,
        id: undefined,
        folderIds: undefined
    };
    delete exportData.id;
    delete exportData.folderIds;

    const json = JSON.stringify(exportData);
    const encoded = await compress(json);
    const url = `${window.location.origin}${window.location.pathname}?importMonster=${encoded}#/monsters`;
    return url;
}

// Import monster from URL parameter (async due to decompression)
export async function importMonsterFromURL() {
    const params = new URLSearchParams(window.location.search);
    const importData = params.get('importMonster');
    
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
        
        // Add new ID and ensure it's marked as custom
        return {
            ...data,
            id: uuid(),
            isCustom: true,
            folderIds: []
        };
    } catch (e) {
        console.error('Failed to import monster from URL:', e);
        return null;
    }
}

// Clear the import parameter from URL without reloading
export function clearMonsterImportParam() {
    const url = new URL(window.location);
    url.searchParams.delete('importMonster');
    window.history.replaceState({}, '', url);
}

// Default export
export default {
    CUSTOM_MONSTERS_KEY,
    getCustomMonsters,
    saveCustomMonsters,
    getCustomMonster,
    saveCustomMonster,
    deleteCustomMonster,
    searchCustomMonsters,
    createEmptyMonster,
    createFromBaseline,
    importMonsterFromJSON,
    exportMonsterToURL,
    importMonsterFromURL,
    clearMonsterImportParam
};
