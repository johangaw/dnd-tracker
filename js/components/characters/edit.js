// Character Edit Component - Character sheet editor

import * as Characters from '../../services/characters.js';
import { getState, setView } from '../../services/state.js';
import { escapeHtml } from '../../utils/helpers.js';
import CharacterList from './list.js';

// Initialize the edit form with a character (or empty for new)
export function init(character = null) {
    const state = getState();
    
    if (character) {
        state.editingCharacter = JSON.parse(JSON.stringify(character)); // Deep clone
    } else {
        state.editingCharacter = Characters.createEmptyCharacter();
    }
    
    setView('character-edit');
    renderForm();
}

// Render the form with current character data
export function renderForm() {
    const state = getState();
    const character = state.editingCharacter;
    
    if (!character) return;
    
    // Basic Info
    setInputValue('char-name', character.name);
    setInputValue('char-class', character.class);
    setInputValue('char-subclass', character.subclass);
    setInputValue('char-level', character.level);
    setInputValue('char-background', character.background);
    setInputValue('char-species', character.species);
    setInputValue('char-alignment', character.alignment);
    setInputValue('char-xp', character.experiencePoints);
    
    // Update proficiency bonus display
    updateProficiencyDisplay();
    
    // Ability Scores
    Characters.ABILITIES.forEach(ability => {
        setInputValue(`char-${ability}`, character.abilities?.[ability] || 10);
        setCheckboxValue(`char-save-${ability}`, character.saveProficiencies?.[ability]);
    });
    
    // Update ability modifiers display
    updateAbilityModifiers();
    
    // Skills
    Object.keys(Characters.SKILLS).forEach(skillKey => {
        setCheckboxValue(`char-skill-${skillKey}`, character.skillProficiencies?.[skillKey]);
        setCheckboxValue(`char-expertise-${skillKey}`, character.skillExpertise?.[skillKey]);
    });
    
    // Combat Stats
    setInputValue('char-ac', character.armorClass);
    setInputValue('char-ac-desc', character.acDescription);
    setInputValue('char-init-bonus', character.initiative);
    setInputValue('char-speed', character.speed);
    setInputValue('char-hp-max', character.hitPointsMax);
    setInputValue('char-hp-current', character.hitPointsCurrent);
    setInputValue('char-hp-temp', character.hitPointsTemp);
    setInputValue('char-hp-max-reduction', character.hitPointsMaxReduction);
    setInputValue('char-hit-dice', character.hitDiceTotal);
    setInputValue('char-hit-dice-used', character.hitDiceUsed);
    
    // Death Saves
    setInputValue('char-death-success', character.deathSaves?.successes || 0);
    setInputValue('char-death-failure', character.deathSaves?.failures || 0);
    
    // Proficiencies & Languages
    setInputValue('char-armor-prof', (character.armorProficiencies || []).join(', '));
    setInputValue('char-weapon-prof', (character.weaponProficiencies || []).join(', '));
    setInputValue('char-tool-prof', (character.toolProficiencies || []).join(', '));
    setInputValue('char-languages', (character.languages || []).join(', '));
    
    // Personality
    setInputValue('char-personality', character.personalityTraits);
    setInputValue('char-ideals', character.ideals);
    setInputValue('char-bonds', character.bonds);
    setInputValue('char-flaws', character.flaws);
    
    // Features & Traits
    setInputValue('char-traits', character.traits);
    renderFeatures();
    
    // Equipment
    setInputValue('char-cp', character.copperPieces);
    setInputValue('char-sp', character.silverPieces);
    setInputValue('char-ep', character.electrumPieces);
    setInputValue('char-gp', character.goldPieces);
    setInputValue('char-pp', character.platinumPieces);
    renderEquipment();
    
    // Attacks
    renderAttacks();
    
    // Spellcasting
    setInputValue('char-spell-ability', character.spellcastingAbility);
    setInputValue('char-spell-dc', character.spellSaveDC);
    setInputValue('char-spell-attack', character.spellAttackBonus);
    renderSpellSlots();
    renderSpells();
    
    // Notes
    setInputValue('char-notes', character.notes);
    
    // Show delete button only for existing characters
    const deleteBtn = document.getElementById('delete-character-btn');
    if (character.id && Characters.getCharacter(character.id)) {
        deleteBtn?.classList.remove('hidden');
    } else {
        deleteBtn?.classList.add('hidden');
    }
}

// Helper to safely set input value
function setInputValue(id, value) {
    const el = document.getElementById(id);
    if (el) {
        el.value = value ?? '';
    }
}

// Helper to safely set checkbox value
function setCheckboxValue(id, checked) {
    const el = document.getElementById(id);
    if (el) {
        el.checked = !!checked;
    }
}

// Update proficiency bonus display
export function updateProficiencyDisplay() {
    const state = getState();
    const character = state.editingCharacter;
    if (!character) return;
    
    const level = parseInt(document.getElementById('char-level')?.value) || 1;
    const profBonus = Characters.getProficiencyBonus(level);
    
    const profEl = document.getElementById('char-prof-bonus');
    if (profEl) {
        profEl.textContent = `+${profBonus}`;
    }
    
    // Update character state
    character.level = level;
}

// Update ability modifier displays
export function updateAbilityModifiers() {
    const state = getState();
    const character = state.editingCharacter;
    if (!character) return;
    
    Characters.ABILITIES.forEach(ability => {
        const input = document.getElementById(`char-${ability}`);
        const modEl = document.getElementById(`char-${ability}-mod`);
        
        if (input && modEl) {
            const score = parseInt(input.value) || 10;
            character.abilities[ability] = score;
            const mod = Characters.getAbilityModifier(score);
            modEl.textContent = Characters.formatModifier(mod);
        }
    });
}

// Render features list
export function renderFeatures() {
    const state = getState();
    const character = state.editingCharacter;
    const container = document.getElementById('features-list');
    
    if (!container) return;
    
    const features = character.features || [];
    
    if (features.length === 0) {
        container.innerHTML = '<p class="empty-hint">No features added</p>';
        return;
    }
    
    container.innerHTML = features.map((feature, index) => `
        <div class="feature-item item-row" data-index="${index}">
            <div class="feature-content">
                <input type="text" class="feature-name" value="${escapeHtml(feature.name || '')}" placeholder="Feature name">
                <textarea class="feature-desc" placeholder="Description">${escapeHtml(feature.description || '')}</textarea>
            </div>
            <div class="item-buttons">
                <button type="button" class="remove-btn" data-index="${index}" aria-label="Remove">&times;</button>
            </div>
        </div>
    `).join('');
    
    // Add event handlers
    container.querySelectorAll('.feature-name').forEach((input, i) => {
        input.addEventListener('change', () => {
            character.features[i].name = input.value;
        });
    });
    container.querySelectorAll('.feature-desc').forEach((textarea, i) => {
        textarea.addEventListener('change', () => {
            character.features[i].description = textarea.value;
        });
    });
    container.querySelectorAll('.remove-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            character.features.splice(parseInt(btn.dataset.index), 1);
            renderFeatures();
        });
    });
}

// Add new feature
export function addFeature() {
    const state = getState();
    const character = state.editingCharacter;
    if (!character.features) character.features = [];
    character.features.push({ name: '', description: '' });
    renderFeatures();
}

// Render equipment list
export function renderEquipment() {
    const state = getState();
    const character = state.editingCharacter;
    const container = document.getElementById('equipment-list');
    
    if (!container) return;
    
    const equipment = character.equipment || [];
    
    if (equipment.length === 0) {
        container.innerHTML = '<p class="empty-hint">No equipment added</p>';
        return;
    }
    
    container.innerHTML = equipment.map((item, index) => {
        const name = typeof item === 'string' ? item : item.name;
        const qty = typeof item === 'object' ? item.quantity : 1;
        
        return `
            <div class="equipment-item item-row" data-index="${index}">
                <input type="text" class="equipment-name" value="${escapeHtml(name || '')}" placeholder="Item name">
                <input type="number" class="equipment-qty" value="${qty || 1}" min="1" placeholder="Qty">
                <button type="button" class="remove-btn" data-index="${index}" aria-label="Remove">&times;</button>
            </div>
        `;
    }).join('');
    
    // Add event handlers
    container.querySelectorAll('.equipment-name').forEach((input, i) => {
        input.addEventListener('change', () => {
            if (typeof character.equipment[i] === 'string') {
                character.equipment[i] = { name: input.value, quantity: 1 };
            } else {
                character.equipment[i].name = input.value;
            }
        });
    });
    container.querySelectorAll('.equipment-qty').forEach((input, i) => {
        input.addEventListener('change', () => {
            if (typeof character.equipment[i] === 'string') {
                character.equipment[i] = { name: character.equipment[i], quantity: parseInt(input.value) || 1 };
            } else {
                character.equipment[i].quantity = parseInt(input.value) || 1;
            }
        });
    });
    container.querySelectorAll('.remove-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            character.equipment.splice(parseInt(btn.dataset.index), 1);
            renderEquipment();
        });
    });
}

// Add new equipment
export function addEquipment() {
    const state = getState();
    const character = state.editingCharacter;
    if (!character.equipment) character.equipment = [];
    character.equipment.push({ name: '', quantity: 1 });
    renderEquipment();
}

// Render attacks list
export function renderAttacks() {
    const state = getState();
    const character = state.editingCharacter;
    const container = document.getElementById('attacks-list');
    
    if (!container) return;
    
    const attacks = character.attacks || [];
    
    if (attacks.length === 0) {
        container.innerHTML = '<p class="empty-hint">No attacks added</p>';
        return;
    }
    
    container.innerHTML = attacks.map((attack, index) => `
        <div class="attack-item item-row" data-index="${index}">
            <input type="text" class="attack-name" value="${escapeHtml(attack.name || '')}" placeholder="Attack name">
            <input type="text" class="attack-bonus" value="${attack.bonus || ''}" placeholder="+X">
            <input type="text" class="attack-damage" value="${escapeHtml(attack.damage || '')}" placeholder="1d8+3 slashing">
            <button type="button" class="remove-btn" data-index="${index}" aria-label="Remove">&times;</button>
        </div>
    `).join('');
    
    // Add event handlers
    container.querySelectorAll('.attack-name').forEach((input, i) => {
        input.addEventListener('change', () => { character.attacks[i].name = input.value; });
    });
    container.querySelectorAll('.attack-bonus').forEach((input, i) => {
        input.addEventListener('change', () => { character.attacks[i].bonus = parseInt(input.value) || 0; });
    });
    container.querySelectorAll('.attack-damage').forEach((input, i) => {
        input.addEventListener('change', () => { character.attacks[i].damage = input.value; });
    });
    container.querySelectorAll('.remove-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            character.attacks.splice(parseInt(btn.dataset.index), 1);
            renderAttacks();
        });
    });
}

// Add new attack
export function addAttack() {
    const state = getState();
    const character = state.editingCharacter;
    if (!character.attacks) character.attacks = [];
    character.attacks.push({ name: '', bonus: 0, damage: '' });
    renderAttacks();
}

// Render spell slots
export function renderSpellSlots() {
    const state = getState();
    const character = state.editingCharacter;
    const container = document.getElementById('spell-slots-edit');
    
    if (!container) return;
    
    const slots = character.spellSlots || {};
    
    container.innerHTML = Array.from({ length: 9 }, (_, i) => {
        const level = i + 1;
        const slot = slots[level] || { total: 0, used: 0 };
        return `
            <div class="spell-slot-edit-row">
                <span class="slot-level">${level}${getOrdinalSuffix(level)}</span>
                <input type="number" class="slot-total" data-level="${level}" value="${slot.total}" min="0" max="9" placeholder="0">
                <span class="slot-separator">/</span>
                <input type="number" class="slot-used" data-level="${level}" value="${slot.used}" min="0" max="${slot.total}" placeholder="0">
                <span class="slot-label">used</span>
            </div>
        `;
    }).join('');
    
    // Add event handlers
    container.querySelectorAll('.slot-total').forEach(input => {
        input.addEventListener('change', () => {
            const level = input.dataset.level;
            if (!character.spellSlots[level]) character.spellSlots[level] = { total: 0, used: 0 };
            character.spellSlots[level].total = parseInt(input.value) || 0;
        });
    });
    container.querySelectorAll('.slot-used').forEach(input => {
        input.addEventListener('change', () => {
            const level = input.dataset.level;
            if (!character.spellSlots[level]) character.spellSlots[level] = { total: 0, used: 0 };
            character.spellSlots[level].used = parseInt(input.value) || 0;
        });
    });
}

// Helper to get ordinal suffix
function getOrdinalSuffix(n) {
    if (n === 1) return 'st';
    if (n === 2) return 'nd';
    if (n === 3) return 'rd';
    return 'th';
}

// Render spells (cantrips and known spells)
export function renderSpells() {
    const state = getState();
    const character = state.editingCharacter;
    
    // Cantrips
    const cantripsContainer = document.getElementById('cantrips-list');
    if (cantripsContainer) {
        const cantrips = character.cantripsKnown || [];
        cantripsContainer.innerHTML = cantrips.length === 0 
            ? '<p class="empty-hint">No cantrips added</p>'
            : cantrips.map((spell, index) => {
                const name = typeof spell === 'string' ? spell : spell.name;
                return `
                    <div class="spell-item" data-index="${index}">
                        <input type="text" class="spell-name" value="${escapeHtml(name || '')}" placeholder="Cantrip name">
                        <button type="button" class="remove-btn" data-index="${index}">&times;</button>
                    </div>
                `;
            }).join('');
        
        cantripsContainer.querySelectorAll('.spell-name').forEach((input, i) => {
            input.addEventListener('change', () => { character.cantripsKnown[i] = input.value; });
        });
        cantripsContainer.querySelectorAll('.remove-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                character.cantripsKnown.splice(parseInt(btn.dataset.index), 1);
                renderSpells();
            });
        });
    }
    
    // Spells known
    const spellsContainer = document.getElementById('spells-known-list');
    if (spellsContainer) {
        const spells = character.spellsKnown || [];
        spellsContainer.innerHTML = spells.length === 0 
            ? '<p class="empty-hint">No spells added</p>'
            : spells.map((spell, index) => {
                const name = typeof spell === 'string' ? spell : spell.name;
                return `
                    <div class="spell-item" data-index="${index}">
                        <input type="text" class="spell-name" value="${escapeHtml(name || '')}" placeholder="Spell name">
                        <button type="button" class="remove-btn" data-index="${index}">&times;</button>
                    </div>
                `;
            }).join('');
        
        spellsContainer.querySelectorAll('.spell-name').forEach((input, i) => {
            input.addEventListener('change', () => { character.spellsKnown[i] = input.value; });
        });
        spellsContainer.querySelectorAll('.remove-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                character.spellsKnown.splice(parseInt(btn.dataset.index), 1);
                renderSpells();
            });
        });
    }
}

// Add cantrip
export function addCantrip() {
    const state = getState();
    const character = state.editingCharacter;
    if (!character.cantripsKnown) character.cantripsKnown = [];
    character.cantripsKnown.push('');
    renderSpells();
}

// Add spell
export function addSpell() {
    const state = getState();
    const character = state.editingCharacter;
    if (!character.spellsKnown) character.spellsKnown = [];
    character.spellsKnown.push('');
    renderSpells();
}

// Parse comma-separated list
function parseCommaList(text) {
    if (!text || !text.trim()) return [];
    return text.split(',').map(s => s.trim()).filter(s => s);
}

// Collect all form data into character object
function collectFormData() {
    const state = getState();
    const character = state.editingCharacter;
    
    // Basic Info
    character.name = document.getElementById('char-name')?.value.trim() || '';
    character.class = document.getElementById('char-class')?.value.trim() || '';
    character.subclass = document.getElementById('char-subclass')?.value.trim() || '';
    character.level = parseInt(document.getElementById('char-level')?.value) || 1;
    character.background = document.getElementById('char-background')?.value.trim() || '';
    character.species = document.getElementById('char-species')?.value.trim() || '';
    character.alignment = document.getElementById('char-alignment')?.value.trim() || '';
    character.experiencePoints = parseInt(document.getElementById('char-xp')?.value) || 0;
    
    // Ability Scores
    Characters.ABILITIES.forEach(ability => {
        character.abilities[ability] = parseInt(document.getElementById(`char-${ability}`)?.value) || 10;
        character.saveProficiencies[ability] = document.getElementById(`char-save-${ability}`)?.checked || false;
    });
    
    // Skills
    character.skillProficiencies = {};
    character.skillExpertise = {};
    Object.keys(Characters.SKILLS).forEach(skillKey => {
        if (document.getElementById(`char-skill-${skillKey}`)?.checked) {
            character.skillProficiencies[skillKey] = true;
        }
        if (document.getElementById(`char-expertise-${skillKey}`)?.checked) {
            character.skillExpertise[skillKey] = true;
        }
    });
    
    // Combat Stats
    character.armorClass = parseInt(document.getElementById('char-ac')?.value) || 10;
    character.acDescription = document.getElementById('char-ac-desc')?.value.trim() || '';
    character.initiative = parseInt(document.getElementById('char-init-bonus')?.value) || 0;
    character.speed = parseInt(document.getElementById('char-speed')?.value) || 30;
    character.hitPointsMax = parseInt(document.getElementById('char-hp-max')?.value) || 0;
    character.hitPointsCurrent = parseInt(document.getElementById('char-hp-current')?.value) || 0;
    character.hitPointsTemp = parseInt(document.getElementById('char-hp-temp')?.value) || 0;
    character.hitPointsMaxReduction = parseInt(document.getElementById('char-hp-max-reduction')?.value) || 0;
    character.hitDiceTotal = document.getElementById('char-hit-dice')?.value.trim() || '';
    character.hitDiceUsed = parseInt(document.getElementById('char-hit-dice-used')?.value) || 0;
    
    // Death Saves
    character.deathSaves = {
        successes: parseInt(document.getElementById('char-death-success')?.value) || 0,
        failures: parseInt(document.getElementById('char-death-failure')?.value) || 0
    };
    
    // Proficiencies & Languages
    character.armorProficiencies = parseCommaList(document.getElementById('char-armor-prof')?.value);
    character.weaponProficiencies = parseCommaList(document.getElementById('char-weapon-prof')?.value);
    character.toolProficiencies = parseCommaList(document.getElementById('char-tool-prof')?.value);
    character.languages = parseCommaList(document.getElementById('char-languages')?.value);
    
    // Personality
    character.personalityTraits = document.getElementById('char-personality')?.value.trim() || '';
    character.ideals = document.getElementById('char-ideals')?.value.trim() || '';
    character.bonds = document.getElementById('char-bonds')?.value.trim() || '';
    character.flaws = document.getElementById('char-flaws')?.value.trim() || '';
    
    // Features & Traits
    character.traits = document.getElementById('char-traits')?.value.trim() || '';
    
    // Currency
    character.copperPieces = parseInt(document.getElementById('char-cp')?.value) || 0;
    character.silverPieces = parseInt(document.getElementById('char-sp')?.value) || 0;
    character.electrumPieces = parseInt(document.getElementById('char-ep')?.value) || 0;
    character.goldPieces = parseInt(document.getElementById('char-gp')?.value) || 0;
    character.platinumPieces = parseInt(document.getElementById('char-pp')?.value) || 0;
    
    // Spellcasting
    character.spellcastingAbility = document.getElementById('char-spell-ability')?.value.trim() || '';
    character.spellSaveDC = parseInt(document.getElementById('char-spell-dc')?.value) || 0;
    character.spellAttackBonus = parseInt(document.getElementById('char-spell-attack')?.value) || 0;
    
    // Notes
    character.notes = document.getElementById('char-notes')?.value.trim() || '';
    
    return character;
}

// Save character
export function saveCharacter() {
    const character = collectFormData();
    
    if (!character.name) {
        alert('Character name is required');
        return;
    }
    
    Characters.saveCharacter(character);
    
    // Return to list
    setView('characters');
    CharacterList.render();
}

// Delete current character
export function deleteCharacter() {
    const state = getState();
    const character = state.editingCharacter;
    
    if (character && character.id) {
        if (confirm(`Delete "${character.name}"?`)) {
            Characters.deleteCharacter(character.id);
            setView('characters');
            CharacterList.render();
        }
    }
}

// Cancel editing and return to list
export function cancelEdit() {
    const state = getState();
    state.editingCharacter = null;
    setView('characters');
}

export default {
    init,
    renderForm,
    updateProficiencyDisplay,
    updateAbilityModifiers,
    renderFeatures,
    addFeature,
    renderEquipment,
    addEquipment,
    renderAttacks,
    addAttack,
    renderSpellSlots,
    renderSpells,
    addCantrip,
    addSpell,
    saveCharacter,
    deleteCharacter,
    cancelEdit
};
