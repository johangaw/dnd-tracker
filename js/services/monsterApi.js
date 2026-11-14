// Monster API Service - Handles fetching and searching monster data from local 5e.tools data

import { getMonsterCache, cacheMonster } from './storage.js';

const BASE_URL = 'data/bestiary';

// All available sources (locally hosted)
const AVAILABLE_SOURCES = [
    'AATM', 'ABH', 'AI', 'AitFR-ISF', 'AitFR-THP', 'AitFR-DN', 'AitFR-FCD', 'AWM', 'BAM', 'BGDIA',
    'BGG', 'BMT', 'CM', 'CoA', 'CoS', 'CRCotN', 'DC', 'DIP', 'DitLCoT', 'DMG', 'DoD', 'DoSI',
    'DSotDQ', 'EFA', 'EGW', 'ERLW', 'ESK', 'FRAiF', 'FTD', 'GGR', 'GoS', 'GotSF', 'HAT-TG',
    'HftT', 'HoL', 'HotB', 'HotDQ', 'IDRotF', 'IMR', 'JttRC', 'KftGV', 'KKW', 'LFL', 'LLK',
    'LMoP', 'LoX', 'LR', 'LRDT', 'MaBJoV', 'MCV1SC', 'MCV2DC', 'MCV3MC', 'MCV4EC', 'MisMV1',
    'MFF', 'MGELFT', 'MM', 'MPMM', 'MPP', 'MOT', 'MTF', 'MODK', 'NF', 'NRH-TCMC', 'NRH-AVitW', 'NRH-ASS',
    'NRH-CoI', 'NRH-TLT', 'NRH-AWoL', 'NRH-AT', 'OotA', 'OoW', 'PaBTSO', 'PSA', 'PSD', 'PSI',
    'PSK', 'PSX', 'PSZ', 'PHB', 'PotA', 'QftIS', 'RMBRE', 'RoT', 'RtG', 'SADS', 'SCC', 'SDW',
    'SKT', 'SLW', 'TCE', 'TTP', 'TftYP', 'ToA', 'ToFW', 'VD', 'VEoR', 'VGM', 'VRGR', 'XGE',
    'WBtW', 'WDH', 'WDMM', 'WttHC', 'XDMG', 'XMM', 'XPHB', 'RHW'
];

// Default sources to search when no filter is selected: all sources except the 2014 MM
// so XMM is preferred by default without hiding the rest of the bestiary.
const DEFAULT_SOURCES = AVAILABLE_SOURCES.filter(source => source !== 'MM');

let sourceIndex = null;
let indexPromise = null;
const loadedSources = {};
const sourcePromises = new Map();

export async function loadIndex() {
    if (sourceIndex) return sourceIndex;
    if (indexPromise) return indexPromise;

    indexPromise = (async () => {
        try {
            const response = await fetch(`${BASE_URL}/index.json`);
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            sourceIndex = await response.json();
            return sourceIndex;
        } catch (error) {
            console.error('Failed to load monster index:', error);
            return {};
        }
    })();
    try {
        return await indexPromise;
    } finally {
        indexPromise = null;
    }
}

export async function loadSource(sourceCode) {
    if (loadedSources[sourceCode]) return loadedSources[sourceCode];
    if (!AVAILABLE_SOURCES.includes(sourceCode)) return [];
    if (sourcePromises.has(sourceCode)) return sourcePromises.get(sourceCode);

    const pending = (async () => {
        const index = await loadIndex();
        const filename = index[sourceCode];
        if (!filename) return [];

        try {
            const response = await fetch(`${BASE_URL}/${filename}`);
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const data = await response.json();
            const monsters = data.monster || [];
            for (const m of monsters) m.source = sourceCode;
            loadedSources[sourceCode] = monsters;
            return monsters;
        } catch (error) {
            console.error(`Failed to load source ${sourceCode}:`, error);
            return [];
        }
    })();
    sourcePromises.set(sourceCode, pending);
    try {
        return await pending;
    } finally {
        sourcePromises.delete(sourceCode);
    }
}

// Warm the search cache without delaying the app's first view or flooding the
// connection. loadSource shares in-flight requests with searches and retries
// failed downloads on the next use.
export async function preloadMonsters() {
    const sources = [...AVAILABLE_SOURCES];
    await Promise.all(Array.from({ length: 6 }, async () => {
        while (sources.length) await loadSource(sources.shift());
    }));
}

export async function searchMonsters(query, source = '') {
    const searchQuery = query.toLowerCase().trim();
    if (searchQuery.length < 2) return [];

    // Use specific source, or default sources, or all sources if 'ALL' is specified
    let sourcesToSearch;
    if (source === 'ALL') {
        sourcesToSearch = AVAILABLE_SOURCES;
    } else if (source) {
        sourcesToSearch = [source];
    } else {
        sourcesToSearch = DEFAULT_SOURCES;
    }

    const results = [];
    
    for (const src of sourcesToSearch) {
        const monsters = await loadSource(src);
        for (const monster of monsters) {
            if (monster.name.toLowerCase().includes(searchQuery)) {
                results.push(monster);
            }
        }
    }

    // Sort by name and limit results
    return Promise.all(results
        .sort((a, b) => a.name.localeCompare(b.name))
        .slice(0, 100)
        .map(monster => resolveMonsterCopy(monster)));
}

// Plain bestiary aliases inherit their base creature's stats while retaining
// their own name, source and explicit overrides. Modified copies use a richer
// 5e.tools transformation format and are outside this alias resolver's scope.
async function resolveMonsterCopy(monster, ancestors = new Set()) {
    if (!monster?._copy || monster._copy._mod) return monster;
    const key = `${monster.name}|${monster.source}`;
    if (ancestors.has(key)) throw new Error(`Circular monster copy: ${key}`);
    const nextAncestors = new Set(ancestors).add(key);
    const reference = monster._copy;
    const bases = await loadSource(reference.source);
    const base = bases.find(m => m.name === reference.name);
    if (!base) throw new Error(`Missing monster copy base: ${reference.name}|${reference.source}`);
    const resolved = { ...structuredClone(await resolveMonsterCopy(base, nextAncestors)), ...monster };
    delete resolved._copy;
    return resolved;
}

export async function getMonster(name, source) {
    const cacheKey = `${name}|${source}`;
    const cached = getMonsterCache()[cacheKey];
    if (cached && !cached._copy) return cached;

    const monsters = await loadSource(source);
    const monster = await resolveMonsterCopy(monsters.find(m => m.name === name && m.source === source));
    
    if (monster) {
        cacheMonster(cacheKey, monster);
    }
    
    return monster;
}

// Format CR for display
export function formatCR(cr) {
    if (typeof cr === 'object') {
        return cr.cr || '?';
    }
    return cr || '?';
}

// Get HP value
export function getHP(monster) {
    if (monster.hp) {
        if (typeof monster.hp === 'object') {
            return monster.hp.average || 0;
        }
        return monster.hp;
    }
    return 0;
}

// Get AC value
export function getAC(monster) {
    if (!monster.ac) return 10;
    if (Array.isArray(monster.ac)) {
        const first = monster.ac[0];
        if (typeof first === 'object') {
            return first.ac || 10;
        }
        return first;
    }
    return monster.ac;
}

// Get ability modifier
export function getAbilityMod(score) {
    return Math.floor((score - 10) / 2);
}

// Get proficiency bonus based on CR
export function getProficiencyBonus(cr) {
    if (!cr) return 2;
    // CR can be a string like "1/4", "1/2", "1", "22", or an object like {cr: "22"}
    let crValue = cr;
    if (typeof cr === 'object') {
        crValue = cr.cr || cr;
    }
    if (typeof crValue === 'string') {
        if (crValue === '1/8' || crValue === '1/4' || crValue === '1/2' || crValue === '0') {
            crValue = 0;
        } else {
            crValue = parseFloat(crValue);
        }
    }
    // Proficiency bonus: +2 for CR 0-4, +3 for CR 5-8, +4 for CR 9-12, etc.
    return Math.max(2, Math.floor((crValue - 1) / 4) + 2);
}

// Get initiative modifier (DEX mod + proficiency bonus * initiative.proficiency)
export function getInitiativeMod(monster) {
    const dexMod = getAbilityMod(monster.dex);
    
    // Check if monster has initiative proficiency multiplier (2024 rules)
    if (monster.initiative && monster.initiative.proficiency) {
        const profBonus = getProficiencyBonus(monster.cr);
        const profMultiplier = monster.initiative.proficiency;
        return dexMod + (profBonus * profMultiplier);
    }
    
    return dexMod;
}

export function formatMod(mod) {
    return mod >= 0 ? `+${mod}` : `${mod}`;
}

// Default export for backward compatibility
export default {
    BASE_URL,
    AVAILABLE_SOURCES,
    DEFAULT_SOURCES,
    loadIndex,
    loadSource,
    preloadMonsters,
    searchMonsters,
    getMonster,
    formatCR,
    getHP,
    getAC,
    getAbilityMod,
    getProficiencyBonus,
    getInitiativeMod,
    formatMod
};
