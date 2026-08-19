// Characters Service - Handles storage of D&D 2024 character sheets

import { compress, decompress, isCompressed, legacyDecode } from '../utils/compression.js';
import { readCollection, writeCollection, CHARACTERS_KEY } from './records.js';
import { uuid as generateUniqueId } from '../utils/uuid.js';

// D&D 2024 Skills with their associated abilities
export const SKILLS = {
    acrobatics: 'dex',
    animalHandling: 'wis',
    arcana: 'int',
    athletics: 'str',
    deception: 'cha',
    history: 'int',
    insight: 'wis',
    intimidation: 'cha',
    investigation: 'int',
    medicine: 'wis',
    nature: 'int',
    perception: 'wis',
    performance: 'cha',
    persuasion: 'cha',
    religion: 'int',
    sleightOfHand: 'dex',
    stealth: 'dex',
    survival: 'wis'
};

// Skill display names
export const SKILL_NAMES = {
    acrobatics: 'Acrobatics',
    animalHandling: 'Animal Handling',
    arcana: 'Arcana',
    athletics: 'Athletics',
    deception: 'Deception',
    history: 'History',
    insight: 'Insight',
    intimidation: 'Intimidation',
    investigation: 'Investigation',
    medicine: 'Medicine',
    nature: 'Nature',
    perception: 'Perception',
    performance: 'Performance',
    persuasion: 'Persuasion',
    religion: 'Religion',
    sleightOfHand: 'Sleight of Hand',
    stealth: 'Stealth',
    survival: 'Survival'
};

// Ability score names
export const ABILITIES = ['str', 'dex', 'con', 'int', 'wis', 'cha'];

export const ABILITY_NAMES = {
    str: 'Strength',
    dex: 'Dexterity',
    con: 'Constitution',
    int: 'Intelligence',
    wis: 'Wisdom',
    cha: 'Charisma'
};

// Skills grouped by ability (for display purposes)
export const SKILLS_BY_ABILITY = {
    str: ['athletics'],
    dex: ['acrobatics', 'sleightOfHand', 'stealth'],
    con: [], // Constitution has no skills
    int: ['arcana', 'history', 'investigation', 'nature', 'religion'],
    wis: ['animalHandling', 'insight', 'medicine', 'perception', 'survival'],
    cha: ['deception', 'intimidation', 'performance', 'persuasion']
};

// Get all characters
export function getCharacters() {
    return readCollection(CHARACTERS_KEY);
}

// Save all characters
export function saveCharacters(characters) {
    writeCollection(CHARACTERS_KEY, characters);
}

// Get a single character by ID
export function getCharacter(id) {
    return getCharacters().find(c => c.id === id);
}

// Save or update a character
export function saveCharacter(character) {
    const characters = getCharacters();
    const index = characters.findIndex(c => c.id === character.id);

    // `updatedAt` is stamped by the records layer, which owns the one clock all
    // conflict resolution compares against.
    if (index >= 0) {
        characters[index] = character;
    } else {
        character.createdAt = Date.now();
        characters.push(character);
    }
    saveCharacters(characters);
}

// Delete a character
export function deleteCharacter(id) {
    const characters = getCharacters().filter(c => c.id !== id);
    saveCharacters(characters);
}

// Search characters by name
export function searchCharacters(query) {
    const searchQuery = query.toLowerCase().trim();
    if (searchQuery.length < 2) return [];
    
    return getCharacters().filter(c => 
        c.name.toLowerCase().includes(searchQuery) ||
        c.class.toLowerCase().includes(searchQuery) ||
        c.species.toLowerCase().includes(searchQuery)
    );
}

// Calculate ability modifier
export function getAbilityModifier(score) {
    return Math.floor((score - 10) / 2);
}

// Format modifier with sign
export function formatModifier(modifier) {
    return modifier >= 0 ? `+${modifier}` : `${modifier}`;
}

// Calculate proficiency bonus based on level
export function getProficiencyBonus(level) {
    return Math.ceil(level / 4) + 1;
}

// Calculate skill modifier
export function getSkillModifier(character, skillKey) {
    const ability = SKILLS[skillKey];
    const abilityMod = getAbilityModifier(character.abilities[ability]);
    const profBonus = getProficiencyBonus(character.level);
    
    if (character.skillExpertise && character.skillExpertise[skillKey]) {
        return abilityMod + (profBonus * 2);
    }
    if (character.skillProficiencies && character.skillProficiencies[skillKey]) {
        return abilityMod + profBonus;
    }
    return abilityMod;
}

// Calculate saving throw modifier
export function getSavingThrowModifier(character, ability) {
    const abilityMod = getAbilityModifier(character.abilities[ability]);
    const profBonus = getProficiencyBonus(character.level);
    
    if (character.saveProficiencies && character.saveProficiencies[ability]) {
        return abilityMod + profBonus;
    }
    return abilityMod;
}

// Calculate passive perception
export function getPassivePerception(character) {
    return 10 + getSkillModifier(character, 'perception');
}

// Calculate initiative modifier
export function getInitiativeModifier(character) {
    return getAbilityModifier(character.abilities.dex);
}

// Get effective max HP (accounting for max HP reduction)
export function getEffectiveMaxHp(character) {
    const maxHp = character.hitPointsMax || 0;
    const reduction = character.hitPointsMaxReduction || 0;
    return Math.max(0, maxHp - reduction);
}

// Create a new empty character with default values
export function createEmptyCharacter() {
    return {
        id: generateUniqueId(),
        
        // Basic Info
        name: '',
        class: '',
        subclass: '',
        level: 1,
        background: '',
        species: '',
        alignment: '',
        experiencePoints: 0,
        
        // Ability Scores
        abilities: {
            str: 10,
            dex: 10,
            con: 10,
            int: 10,
            wis: 10,
            cha: 10
        },
        
        // Saving Throw Proficiencies
        saveProficiencies: {
            str: false,
            dex: false,
            con: false,
            int: false,
            wis: false,
            cha: false
        },
        
        // Skill Proficiencies
        skillProficiencies: {},
        skillExpertise: {},
        
        // Combat Stats
        armorClass: 10,
        acDescription: '',
        initiative: 0, // Bonus beyond DEX
        speed: 30,
        hitPointsMax: 0,
        hitPointsCurrent: 0,
        hitPointsTemp: 0,
        hitPointsMaxReduction: 0, // For effects that reduce max HP (e.g., certain undead attacks)
        hitDiceTotal: '',
        hitDiceUsed: 0,
        deathSaves: {
            successes: 0,
            failures: 0
        },
        
        // Features & Traits
        features: [],
        traits: '',
        
        // Equipment & Inventory
        equipment: [],
        copperPieces: 0,
        silverPieces: 0,
        electrumPieces: 0,
        goldPieces: 0,
        platinumPieces: 0,
        
        // Proficiencies & Languages
        armorProficiencies: [],
        weaponProficiencies: [],
        toolProficiencies: [],
        languages: [],
        
        // Personality
        personalityTraits: '',
        ideals: '',
        bonds: '',
        flaws: '',
        
        // Spellcasting
        spellcastingAbility: '',
        spellSaveDC: 0,
        spellAttackBonus: 0,
        spellSlots: {
            1: { total: 0, used: 0 },
            2: { total: 0, used: 0 },
            3: { total: 0, used: 0 },
            4: { total: 0, used: 0 },
            5: { total: 0, used: 0 },
            6: { total: 0, used: 0 },
            7: { total: 0, used: 0 },
            8: { total: 0, used: 0 },
            9: { total: 0, used: 0 }
        },
        spellsKnown: [],
        cantripsKnown: [],
        
        // Attacks & Actions
        attacks: [],
        
        // Custom Trackers (e.g., Ki Points, Rage, Channel Divinity)
        trackers: [],
        
        // Additional
        notes: '',
        
        // Metadata
        createdAt: null,
        updatedAt: null
    };
}

// Duplicate a character
export function duplicateCharacter(character) {
    return {
        ...JSON.parse(JSON.stringify(character)), // Deep clone
        id: generateUniqueId(),
        name: `${character.name} (Copy)`,
        createdAt: null,
        updatedAt: null
    };
}

// Export character to JSON string
export function exportCharacterToJSON(character) {
    // Create a copy without timestamps for cleaner export
    const exportData = {
        ...character,
        id: undefined,
        createdAt: undefined,
        updatedAt: undefined
    };
    delete exportData.id;
    delete exportData.createdAt;
    delete exportData.updatedAt;
    
    return JSON.stringify(exportData, null, 2);
}

// Import character from JSON string
export function importCharacterFromJSON(jsonString) {
    try {
        const data = JSON.parse(jsonString);
        
        // Validate required fields
        if (!data.name) {
            throw new Error('Character must have a name');
        }
        
        // Merge with empty character to ensure all fields exist
        const character = {
            ...createEmptyCharacter(),
            ...data,
            id: generateUniqueId()
        };
        
        return character;
    } catch (e) {
        console.error('Failed to import character from JSON:', e);
        throw new Error(`Invalid JSON: ${e.message}`);
    }
}

// Export character to shareable URL (async due to compression)
export async function exportCharacterToURL(character) {
    const exportData = {
        ...character,
        id: undefined,
        createdAt: undefined,
        updatedAt: undefined
    };
    delete exportData.id;
    delete exportData.createdAt;
    delete exportData.updatedAt;
    
    const json = JSON.stringify(exportData);
    const encoded = await compress(json);
    const url = `${window.location.origin}${window.location.pathname}?importCharacter=${encoded}#/characters`;
    return url;
}

// Import character from URL parameter (async due to decompression)
export async function importCharacterFromURL() {
    const params = new URLSearchParams(window.location.search);
    const importData = params.get('importCharacter');
    
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
        
        return {
            ...createEmptyCharacter(),
            ...data,
            id: generateUniqueId()
        };
    } catch (e) {
        console.error('Failed to import character from URL:', e);
        return null;
    }
}

// Clear the import parameter from URL without reloading
export function clearCharacterImportParam() {
    const url = new URL(window.location);
    url.searchParams.delete('importCharacter');
    window.history.replaceState({}, '', url);
}

// Default export
export default {
    CHARACTERS_KEY,
    SKILLS,
    SKILL_NAMES,
    ABILITIES,
    ABILITY_NAMES,
    getCharacters,
    saveCharacters,
    getCharacter,
    saveCharacter,
    deleteCharacter,
    searchCharacters,
    getAbilityModifier,
    formatModifier,
    getProficiencyBonus,
    getSkillModifier,
    getSavingThrowModifier,
    getPassivePerception,
    getInitiativeModifier,
    createEmptyCharacter,
    duplicateCharacter,
    exportCharacterToJSON,
    importCharacterFromJSON,
    exportCharacterToURL,
    importCharacterFromURL,
    clearCharacterImportParam
};
