// Custom Monsters Service - Handles storage and sharing of user-created monsters

const CUSTOM_MONSTERS_KEY = 'dnd-custom-monsters';

// Get all custom monsters
export function getCustomMonsters() {
    const data = localStorage.getItem(CUSTOM_MONSTERS_KEY);
    return data ? JSON.parse(data) : [];
}

// Save all custom monsters
export function saveCustomMonsters(monsters) {
    localStorage.setItem(CUSTOM_MONSTERS_KEY, JSON.stringify(monsters));
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
        id: Date.now().toString(),
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
        isCustom: true
    };
}

// Create a custom monster from an existing monster (baseline)
export function createFromBaseline(baseMonster) {
    return {
        ...JSON.parse(JSON.stringify(baseMonster)), // Deep clone
        id: Date.now().toString(),
        name: `${baseMonster.name} (Custom)`,
        source: 'Custom',
        baselineSource: baseMonster.source, // Track original source
        baselineName: baseMonster.name,     // Track original name
        isCustom: true
    };
}

// Import monster from JSON string
export function importMonsterFromJSON(jsonString) {
    try {
        const data = JSON.parse(jsonString);
        
        // Validate required fields
        if (!data.name) {
            throw new Error('Monster must have a name');
        }
        
        // Create a valid monster object with defaults for missing fields
        const monster = {
            id: Date.now().toString(),
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
            trait: data.trait || [],
            action: data.action || [],
            reaction: data.reaction || [],
            legendary: data.legendary || [],
            skill: data.skill || {},
            save: data.save || {},
            immune: data.immune || [],
            resist: data.resist || [],
            vulnerable: data.vulnerable || [],
            conditionImmune: data.conditionImmune || [],
            senses: data.senses || [],
            languages: data.languages || [],
            spellcasting: data.spellcasting || [],
            isCustom: true
        };
        
        return monster;
    } catch (e) {
        console.error('Failed to import monster from JSON:', e);
        throw new Error(`Invalid JSON: ${e.message}`);
    }
}

// Export monster to shareable URL
export function exportMonsterToURL(monster) {
    // Create a copy without the id (will be regenerated on import)
    const exportData = {
        ...monster,
        id: undefined
    };
    delete exportData.id;
    
    const json = JSON.stringify(exportData);
    const encoded = btoa(encodeURIComponent(json));
    const url = `${window.location.origin}${window.location.pathname}?importMonster=${encoded}`;
    return url;
}

// Import monster from URL parameter
export function importMonsterFromURL() {
    const params = new URLSearchParams(window.location.search);
    const importData = params.get('importMonster');
    
    if (!importData) return null;
    
    try {
        const json = decodeURIComponent(atob(importData));
        const data = JSON.parse(json);
        
        // Add new ID and ensure it's marked as custom
        return {
            ...data,
            id: Date.now().toString(),
            isCustom: true
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
