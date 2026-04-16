// Spell Data Service
// Provides spell list and search functionality for character spell selection
// Loads spell data from 5etools JSON files

// School code to full name mapping
const SCHOOL_NAMES = {
    'A': 'Abjuration',
    'C': 'Conjuration',
    'D': 'Divination',
    'E': 'Enchantment',
    'I': 'Illusion',
    'N': 'Necromancy',
    'T': 'Transmutation',
    'V': 'Evocation'
};

// Source code to full name mapping
const SOURCE_NAMES = {
    'XPHB': "Player's Handbook (2024)",
    'EFA': "Explore Faerun",
    'FRHoF': "Forgotten Realms: Heroes of Faerun"
};

// Spell source files to load (in order of priority)
const SPELL_SOURCES = [
    'spells-xphb.json',
    'spells-efa.json',
    'spells-frhof.json'
];

// Fluff source files (for images)
const FLUFF_SOURCES = [
    'fluff-spells-xphb.json',
    'fluff-spells-frhof.json'
];

// Base URL for 5e.tools images
const IMAGE_BASE_URL = 'https://5e.tools/img/';

// Cache for loaded spells
let spellsCache = null;
let spellsByName = null;
let fluffByKey = null;
let loadPromise = null;

/**
 * Load all spell data from JSON files
 * @returns {Promise<Object[]>} Array of spell objects
 */
async function loadSpells() {
    if (spellsCache) return spellsCache;
    if (loadPromise) return loadPromise;

    loadPromise = (async () => {
        const allSpells = [];
        
        // Load spell data
        for (const file of SPELL_SOURCES) {
            try {
                const response = await fetch(`/data/spells/${file}`);
                if (response.ok) {
                    const data = await response.json();
                    if (data.spell && Array.isArray(data.spell)) {
                        allSpells.push(...data.spell);
                    }
                }
            } catch (e) {
                console.warn(`Failed to load spell file ${file}:`, e);
            }
        }

        // Load fluff data (for images)
        fluffByKey = new Map();
        for (const file of FLUFF_SOURCES) {
            try {
                const response = await fetch(`/data/spells/${file}`);
                if (response.ok) {
                    const data = await response.json();
                    if (data.spellFluff && Array.isArray(data.spellFluff)) {
                        for (const fluff of data.spellFluff) {
                            // Key by name+source for exact matching
                            const key = `${fluff.name.toLowerCase()}|${fluff.source.toLowerCase()}`;
                            fluffByKey.set(key, fluff);
                        }
                    }
                }
            } catch (e) {
                console.warn(`Failed to load fluff file ${file}:`, e);
            }
        }

        // Process and normalize spells
        const normalizedSpells = allSpells.map(normalizeSpell);
        
        // Build name lookup map (use lowercase name as key)
        // This also deduplicates spells (keeps first occurrence from higher priority sources)
        spellsByName = new Map();
        for (const spell of normalizedSpells) {
            const key = spell.name.toLowerCase();
            // Keep first occurrence (higher priority source)
            if (!spellsByName.has(key)) {
                spellsByName.set(key, spell);
            }
        }
        
        // Use deduplicated list as the cache
        spellsCache = Array.from(spellsByName.values());

        return spellsCache;
    })();

    return loadPromise;
}

/**
 * Normalize a spell from 5etools format to our internal format
 * @param {Object} rawSpell - Raw spell from 5etools JSON
 * @returns {Object} Normalized spell object
 */
function normalizeSpell(rawSpell) {
    // Look up fluff data for this spell
    const fluffKey = `${rawSpell.name.toLowerCase()}|${rawSpell.source.toLowerCase()}`;
    const fluff = fluffByKey?.get(fluffKey);
    
    // Extract image URL from fluff if available
    let imageUrl = null;
    let imageCredit = null;
    if (fluff?.images?.[0]?.href?.path) {
        imageUrl = IMAGE_BASE_URL + fluff.images[0].href.path;
        imageCredit = fluff.images[0].credit || null;
    }
    
    return {
        // Original data (for display in modal)
        _raw: rawSpell,
        
        // Basic properties for list/search
        name: rawSpell.name,
        level: rawSpell.level,
        school: SCHOOL_NAMES[rawSpell.school] || rawSpell.school,
        schoolCode: rawSpell.school,
        source: rawSpell.source,
        sourceName: SOURCE_NAMES[rawSpell.source] || rawSpell.source,
        
        // Formatted properties
        castingTime: formatCastingTime(rawSpell.time),
        range: formatRange(rawSpell.range),
        duration: formatDuration(rawSpell.duration),
        components: formatComponents(rawSpell.components),
        concentration: hasConcentration(rawSpell.duration),
        ritual: rawSpell.meta?.ritual || false,
        
        // Image data
        imageUrl,
        imageCredit
    };
}

/**
 * Format casting time from 5etools format
 */
function formatCastingTime(time) {
    if (!time || !time.length) return 'Unknown';
    const t = time[0];
    if (t.unit === 'action') return 'Action';
    if (t.unit === 'bonus') return 'Bonus Action';
    if (t.unit === 'reaction') return 'Reaction';
    if (t.number === 1) return `1 ${t.unit}`;
    return `${t.number} ${t.unit}s`;
}

/**
 * Format range from 5etools format
 */
function formatRange(range) {
    if (!range) return 'Unknown';
    
    if (range.type === 'point') {
        const dist = range.distance;
        if (dist.type === 'self') return 'Self';
        if (dist.type === 'touch') return 'Touch';
        if (dist.type === 'sight') return 'Sight';
        if (dist.type === 'unlimited') return 'Unlimited';
        if (dist.amount) return `${dist.amount} ${dist.type}`;
    }
    
    if (range.type === 'emanation' || range.type === 'radius' || range.type === 'sphere') {
        const dist = range.distance;
        return `Self (${dist.amount}-${dist.type} ${range.type})`;
    }
    
    if (range.type === 'line' || range.type === 'cone' || range.type === 'cube') {
        const dist = range.distance;
        return `Self (${dist.amount}-${dist.type} ${range.type})`;
    }
    
    return 'Special';
}

/**
 * Format duration from 5etools format
 */
function formatDuration(duration) {
    if (!duration || !duration.length) return 'Unknown';
    const d = duration[0];
    
    if (d.type === 'instant') return 'Instantaneous';
    if (d.type === 'permanent') {
        if (d.ends?.includes('dispel')) return 'Until dispelled';
        return 'Permanent';
    }
    
    if (d.type === 'timed' && d.duration) {
        const amount = d.duration.amount;
        const unit = d.duration.type;
        const conc = d.concentration ? 'Concentration, up to ' : '';
        if (amount === 1) return `${conc}1 ${unit}`;
        return `${conc}${amount} ${unit}s`;
    }
    
    return 'Special';
}

/**
 * Format components from 5etools format
 */
function formatComponents(comp) {
    if (!comp) return '';
    const parts = [];
    if (comp.v) parts.push('V');
    if (comp.s) parts.push('S');
    if (comp.m) parts.push('M');
    return parts.join(',');
}

/**
 * Check if spell requires concentration
 */
function hasConcentration(duration) {
    if (!duration || !duration.length) return false;
    return duration.some(d => d.concentration === true);
}

/**
 * Format material component for display
 */
export function formatMaterialComponent(comp) {
    if (!comp || !comp.m) return null;
    if (typeof comp.m === 'string') return comp.m;
    if (comp.m.text) return comp.m.text;
    return null;
}

// ============================================
// Public API (maintains backward compatibility)
// ============================================

/**
 * Get all spells (async)
 */
export async function getAllSpells() {
    const spells = await loadSpells();
    return spells;
}

/**
 * Get cantrips only (level 0)
 */
export async function getCantrips() {
    const spells = await loadSpells();
    return spells.filter(s => s.level === 0);
}

/**
 * Get spells by level (1-9)
 */
export async function getSpellsByLevel(level) {
    const spells = await loadSpells();
    return spells.filter(s => s.level === level);
}

/**
 * Get non-cantrip spells (level 1+)
 */
export async function getLeveledSpells() {
    const spells = await loadSpells();
    return spells.filter(s => s.level > 0);
}

/**
 * Search spells by name (case-insensitive partial match)
 */
export async function searchSpells(query, options = {}) {
    const { cantripsOnly = false, leveledOnly = false, maxLevel = 9, minLevel = 0 } = options;
    
    let results = await loadSpells();
    
    // Filter by level range
    results = results.filter(s => s.level >= minLevel && s.level <= maxLevel);
    
    // Filter cantrips/leveled
    if (cantripsOnly) {
        results = results.filter(s => s.level === 0);
    } else if (leveledOnly) {
        results = results.filter(s => s.level > 0);
    }
    
    // Filter by name if query provided
    if (query && query.trim()) {
        const lowerQuery = query.toLowerCase().trim();
        results = results.filter(s => s.name.toLowerCase().includes(lowerQuery));
    }
    
    return results;
}

/**
 * Get spell by exact name (async)
 */
export async function getSpell(name) {
    await loadSpells();
    return spellsByName.get(name.toLowerCase()) || null;
}

/**
 * Get full spell data for modal display
 */
export async function getSpellDetails(name) {
    const spell = await getSpell(name);
    if (!spell) return null;
    return spell._raw;
}

/**
 * Format spell level for display
 */
export function formatSpellLevel(level) {
    if (level === 0) return 'Cantrip';
    if (level === 1) return '1st';
    if (level === 2) return '2nd';
    if (level === 3) return '3rd';
    return `${level}th`;
}

/**
 * Get school full name from code
 */
export function getSchoolName(code) {
    return SCHOOL_NAMES[code] || code;
}

/**
 * Get source full name from code
 */
export function getSourceName(code) {
    return SOURCE_NAMES[code] || code;
}

/**
 * Preload spells (can be called early to speed up first search)
 */
export function preloadSpells() {
    loadSpells().catch(console.error);
}

/**
 * Clear the spell cache (for testing)
 */
export function clearCache() {
    spellsCache = null;
    spellsByName = null;
    fluffByKey = null;
    loadPromise = null;
}

export default {
    getAllSpells,
    getCantrips,
    getSpellsByLevel,
    getLeveledSpells,
    searchSpells,
    getSpell,
    getSpellDetails,
    formatSpellLevel,
    formatMaterialComponent,
    getSchoolName,
    getSourceName,
    preloadSpells,
    clearCache
};
