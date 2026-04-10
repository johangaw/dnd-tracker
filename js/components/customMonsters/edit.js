// Custom Monster Edit Component

import * as CustomMonsters from '../../services/customMonsters.js';
import { getState, setView } from '../../services/state.js';
import { escapeHtml } from '../../utils/helpers.js';
import { getHP, getAC, getProficiencyBonus } from '../../services/monsterApi.js';
import { showStatBlock } from '../modals/statBlock.js';
import CustomMonsterList from './list.js';

// Initialize the edit form with a monster (or empty for new)
export function init(monster = null) {
    const state = getState();
    
    if (monster) {
        state.editingMonster = { ...monster };
    } else {
        state.editingMonster = CustomMonsters.createEmptyMonster();
    }
    
    setView('custom-monster-edit');
    renderForm();
}

// Initialize from baseline monster
export function initFromBaseline(baseMonster) {
    const state = getState();
    state.editingMonster = CustomMonsters.createFromBaseline(baseMonster);
    setView('custom-monster-edit');
    renderForm();
}

// Render the form with current monster data
export function renderForm() {
    const state = getState();
    const monster = state.editingMonster;
    
    if (!monster) return;
    
    // Basic info
    document.getElementById('monster-name').value = monster.name || '';
    document.getElementById('monster-size').value = Array.isArray(monster.size) ? monster.size[0] : (monster.size || 'M');
    document.getElementById('monster-type').value = monster.type || 'humanoid';
    document.getElementById('monster-cr').value = formatCRForSelect(monster.cr);
    document.getElementById('monster-alignment').value = formatAlignmentForSelect(monster.alignment);
    
    // Update proficiency bonus display
    updateProficiencyBonus(monster.cr);
    
    // Combat stats
    document.getElementById('monster-ac').value = getAC(monster);
    document.getElementById('monster-hp').value = getHP(monster);
    document.getElementById('monster-speed').value = monster.speed?.walk || 30;
    document.getElementById('monster-hp-formula').value = monster.hp?.formula || '';
    
    // Ability scores
    document.getElementById('monster-str').value = monster.str || 10;
    document.getElementById('monster-dex').value = monster.dex || 10;
    document.getElementById('monster-con').value = monster.con || 10;
    document.getElementById('monster-int').value = monster.int || 10;
    document.getElementById('monster-wis').value = monster.wis || 10;
    document.getElementById('monster-cha').value = monster.cha || 10;
    
    // Defenses & Senses
    document.getElementById('monster-saves').value = formatSaves(monster.save);
    document.getElementById('monster-skills').value = formatSkills(monster.skill);
    document.getElementById('monster-resistances').value = formatDamageList(monster.resist);
    document.getElementById('monster-immunities').value = formatDamageList(monster.immune);
    document.getElementById('monster-vulnerabilities').value = formatDamageList(monster.vulnerable);
    document.getElementById('monster-condition-immunities').value = (monster.conditionImmune || []).join(', ');
    document.getElementById('monster-senses').value = (monster.senses || []).join(', ');
    document.getElementById('monster-passive').value = monster.passive || 10;
    document.getElementById('monster-languages').value = (monster.languages || []).join(', ');
    
    // Traits and actions
    renderTraits();
    renderActions();
    renderBonusActions();
    renderReactions();
    renderSpellcasting();
    renderLegendaryActions();
    
    // Show delete button only for existing monsters
    const deleteBtn = document.getElementById('delete-monster-btn');
    if (monster.id && CustomMonsters.getCustomMonster(monster.id)) {
        deleteBtn.classList.remove('hidden');
    } else {
        deleteBtn.classList.add('hidden');
    }
}

// Format CR for select element
function formatCRForSelect(cr) {
    if (!cr) return '1';
    if (typeof cr === 'object') return cr.cr || '1';
    return String(cr);
}

// Format alignment for select element
function formatAlignmentForSelect(alignment) {
    if (!alignment) return 'N';
    if (Array.isArray(alignment)) {
        // Handle 5e.tools format like ['N', 'E'] for Neutral Evil
        if (alignment.length === 2) {
            const [a, b] = alignment;
            if (a === 'N' && b === 'E') return 'NE';
            if (a === 'N' && b === 'G') return 'NG';
            if (a === 'L' && b === 'G') return 'LG';
            if (a === 'L' && b === 'E') return 'LE';
            if (a === 'L' && b === 'N') return 'LN';
            if (a === 'C' && b === 'G') return 'CG';
            if (a === 'C' && b === 'E') return 'CE';
            if (a === 'C' && b === 'N') return 'CN';
        }
        return alignment[0] || 'N';
    }
    return alignment;
}

// Format saving throws for display (e.g., {str: "+5", dex: "+3"} -> "Str +5, Dex +3")
function formatSaves(save) {
    if (!save || typeof save !== 'object') return '';
    return Object.entries(save)
        .map(([k, v]) => `${k.charAt(0).toUpperCase() + k.slice(1)} ${v}`)
        .join(', ');
}

// Parse saving throws from input (e.g., "Str +5, Dex +3" -> {str: "+5", dex: "+3"})
function parseSaves(text) {
    if (!text.trim()) return undefined;
    const result = {};
    const parts = text.split(',').map(p => p.trim()).filter(p => p);
    parts.forEach(part => {
        const match = part.match(/^(str|dex|con|int|wis|cha)\s*([+-]?\d+)/i);
        if (match) {
            const ability = match[1].toLowerCase();
            const bonus = match[2].startsWith('+') || match[2].startsWith('-') ? match[2] : `+${match[2]}`;
            result[ability] = bonus;
        }
    });
    return Object.keys(result).length > 0 ? result : undefined;
}

// Format skills for display (e.g., {perception: "+5"} -> "Perception +5")
function formatSkills(skill) {
    if (!skill || typeof skill !== 'object') return '';
    return Object.entries(skill)
        .map(([k, v]) => `${k.charAt(0).toUpperCase() + k.slice(1)} ${v}`)
        .join(', ');
}

// Parse skills from input (e.g., "Perception +5, Stealth +7" -> {perception: "+5", stealth: "+7"})
function parseSkills(text) {
    if (!text.trim()) return undefined;
    const result = {};
    const parts = text.split(',').map(p => p.trim()).filter(p => p);
    parts.forEach(part => {
        const match = part.match(/^(\w+)\s*([+-]?\d+)/i);
        if (match) {
            const skill = match[1].toLowerCase();
            const bonus = match[2].startsWith('+') || match[2].startsWith('-') ? match[2] : `+${match[2]}`;
            result[skill] = bonus;
        }
    });
    return Object.keys(result).length > 0 ? result : undefined;
}

// Format damage types list for display
function formatDamageList(list) {
    if (!list || !Array.isArray(list) || list.length === 0) return '';
    return list.join(', ');
}

// Parse comma-separated list into array
function parseCommaList(text) {
    if (!text.trim()) return [];
    return text.split(',').map(p => p.trim()).filter(p => p);
}

// Render traits list
export function renderTraits() {
    const state = getState();
    const monster = state.editingMonster;
    const container = document.getElementById('traits-list');
    
    const traits = monster.trait || [];
    
    if (traits.length === 0) {
        container.innerHTML = '<p class="empty-hint">No traits added</p>';
        return;
    }
    
    container.innerHTML = traits.map((trait, index) => `
        <div class="trait-item item-row" data-index="${index}">
            <div class="trait-content">
                <input type="text" class="trait-name" value="${escapeHtml(trait.name || '')}" placeholder="Trait name">
                <textarea class="trait-desc" placeholder="Description">${escapeHtml(formatEntries(trait.entries))}</textarea>
            </div>
            <div class="item-buttons">
                <button type="button" class="move-up-btn" data-index="${index}" aria-label="Move up" ${index === 0 ? 'disabled' : ''}>&#9650;</button>
                <button type="button" class="move-down-btn" data-index="${index}" aria-label="Move down" ${index === traits.length - 1 ? 'disabled' : ''}>&#9660;</button>
                <button type="button" class="remove-btn" data-index="${index}" aria-label="Remove">&times;</button>
            </div>
        </div>
    `).join('');
    
    // Add change handlers
    container.querySelectorAll('.trait-name').forEach((input, i) => {
        input.addEventListener('change', () => updateTrait(i, 'name', input.value));
    });
    container.querySelectorAll('.trait-desc').forEach((textarea, i) => {
        textarea.addEventListener('change', () => updateTrait(i, 'entries', textarea.value));
    });
    container.querySelectorAll('.remove-btn').forEach(btn => {
        btn.addEventListener('click', () => removeTrait(parseInt(btn.dataset.index)));
    });
    container.querySelectorAll('.move-up-btn').forEach(btn => {
        btn.addEventListener('click', () => moveTraitUp(parseInt(btn.dataset.index)));
    });
    container.querySelectorAll('.move-down-btn').forEach(btn => {
        btn.addEventListener('click', () => moveTraitDown(parseInt(btn.dataset.index)));
    });
}

// Render actions list
export function renderActions() {
    const state = getState();
    const monster = state.editingMonster;
    const container = document.getElementById('actions-list');
    
    const actions = monster.action || [];
    
    if (actions.length === 0) {
        container.innerHTML = '<p class="empty-hint">No actions added</p>';
        return;
    }
    
    container.innerHTML = actions.map((action, index) => `
        <div class="action-item item-row" data-index="${index}">
            <div class="action-content">
                <input type="text" class="action-name" value="${escapeHtml(action.name || '')}" placeholder="Action name">
                <textarea class="action-desc" placeholder="Description">${escapeHtml(formatEntries(action.entries))}</textarea>
            </div>
            <div class="item-buttons">
                <button type="button" class="move-up-btn" data-index="${index}" aria-label="Move up" ${index === 0 ? 'disabled' : ''}>&#9650;</button>
                <button type="button" class="move-down-btn" data-index="${index}" aria-label="Move down" ${index === actions.length - 1 ? 'disabled' : ''}>&#9660;</button>
                <button type="button" class="remove-btn" data-index="${index}" aria-label="Remove">&times;</button>
            </div>
        </div>
    `).join('');
    
    // Add change handlers
    container.querySelectorAll('.action-name').forEach((input, i) => {
        input.addEventListener('change', () => updateAction(i, 'name', input.value));
    });
    container.querySelectorAll('.action-desc').forEach((textarea, i) => {
        textarea.addEventListener('change', () => updateAction(i, 'entries', textarea.value));
    });
    container.querySelectorAll('.remove-btn').forEach(btn => {
        btn.addEventListener('click', () => removeAction(parseInt(btn.dataset.index)));
    });
    container.querySelectorAll('.move-up-btn').forEach(btn => {
        btn.addEventListener('click', () => moveActionUp(parseInt(btn.dataset.index)));
    });
    container.querySelectorAll('.move-down-btn').forEach(btn => {
        btn.addEventListener('click', () => moveActionDown(parseInt(btn.dataset.index)));
    });
}

// Render bonus actions list
export function renderBonusActions() {
    const state = getState();
    const monster = state.editingMonster;
    const container = document.getElementById('bonus-list');
    
    const bonusActions = monster.bonus || [];
    
    if (bonusActions.length === 0) {
        container.innerHTML = '<p class="empty-hint">No bonus actions added</p>';
        return;
    }
    
    container.innerHTML = bonusActions.map((action, index) => `
        <div class="bonus-item item-row" data-index="${index}">
            <div class="bonus-content">
                <input type="text" class="bonus-name" value="${escapeHtml(action.name || '')}" placeholder="Bonus action name">
                <textarea class="bonus-desc" placeholder="Description">${escapeHtml(formatEntries(action.entries))}</textarea>
            </div>
            <div class="item-buttons">
                <button type="button" class="move-up-btn" data-index="${index}" aria-label="Move up" ${index === 0 ? 'disabled' : ''}>&#9650;</button>
                <button type="button" class="move-down-btn" data-index="${index}" aria-label="Move down" ${index === bonusActions.length - 1 ? 'disabled' : ''}>&#9660;</button>
                <button type="button" class="remove-btn" data-index="${index}" aria-label="Remove">&times;</button>
            </div>
        </div>
    `).join('');
    
    // Add change handlers
    container.querySelectorAll('.bonus-name').forEach((input, i) => {
        input.addEventListener('change', () => updateBonusAction(i, 'name', input.value));
    });
    container.querySelectorAll('.bonus-desc').forEach((textarea, i) => {
        textarea.addEventListener('change', () => updateBonusAction(i, 'entries', textarea.value));
    });
    container.querySelectorAll('.remove-btn').forEach(btn => {
        btn.addEventListener('click', () => removeBonusAction(parseInt(btn.dataset.index)));
    });
    container.querySelectorAll('.move-up-btn').forEach(btn => {
        btn.addEventListener('click', () => moveBonusActionUp(parseInt(btn.dataset.index)));
    });
    container.querySelectorAll('.move-down-btn').forEach(btn => {
        btn.addEventListener('click', () => moveBonusActionDown(parseInt(btn.dataset.index)));
    });
}

// Render reactions list
export function renderReactions() {
    const state = getState();
    const monster = state.editingMonster;
    const container = document.getElementById('reactions-list');
    
    const reactions = monster.reaction || [];
    
    if (reactions.length === 0) {
        container.innerHTML = '<p class="empty-hint">No reactions added</p>';
        return;
    }
    
    container.innerHTML = reactions.map((action, index) => `
        <div class="reaction-item item-row" data-index="${index}">
            <div class="reaction-content">
                <input type="text" class="reaction-name" value="${escapeHtml(action.name || '')}" placeholder="Reaction name">
                <textarea class="reaction-desc" placeholder="Description">${escapeHtml(formatEntries(action.entries))}</textarea>
            </div>
            <div class="item-buttons">
                <button type="button" class="move-up-btn" data-index="${index}" aria-label="Move up" ${index === 0 ? 'disabled' : ''}>&#9650;</button>
                <button type="button" class="move-down-btn" data-index="${index}" aria-label="Move down" ${index === reactions.length - 1 ? 'disabled' : ''}>&#9660;</button>
                <button type="button" class="remove-btn" data-index="${index}" aria-label="Remove">&times;</button>
            </div>
        </div>
    `).join('');
    
    // Add change handlers
    container.querySelectorAll('.reaction-name').forEach((input, i) => {
        input.addEventListener('change', () => updateReaction(i, 'name', input.value));
    });
    container.querySelectorAll('.reaction-desc').forEach((textarea, i) => {
        textarea.addEventListener('change', () => updateReaction(i, 'entries', textarea.value));
    });
    container.querySelectorAll('.remove-btn').forEach(btn => {
        btn.addEventListener('click', () => removeReaction(parseInt(btn.dataset.index)));
    });
    container.querySelectorAll('.move-up-btn').forEach(btn => {
        btn.addEventListener('click', () => moveReactionUp(parseInt(btn.dataset.index)));
    });
    container.querySelectorAll('.move-down-btn').forEach(btn => {
        btn.addEventListener('click', () => moveReactionDown(parseInt(btn.dataset.index)));
    });
}

// Render spellcasting list
export function renderSpellcasting() {
    const state = getState();
    const monster = state.editingMonster;
    const container = document.getElementById('spellcasting-list');
    
    const spellcasting = monster.spellcasting || [];
    
    if (spellcasting.length === 0) {
        container.innerHTML = '<p class="empty-hint">No spellcasting added</p>';
        return;
    }
    
    container.innerHTML = spellcasting.map((sc, index) => `
        <div class="spellcasting-item item-row" data-index="${index}">
            <div class="spellcasting-content">
                <input type="text" class="spellcasting-name" value="${escapeHtml(sc.name || 'Spellcasting')}" placeholder="Spellcasting name">
                <textarea class="spellcasting-header" placeholder="Header (e.g., 'The mage is a 5th-level spellcaster. Its spellcasting ability is Intelligence (spell save DC 14, +6 to hit).')">${escapeHtml(formatEntries(sc.headerEntries || []))}</textarea>
                <textarea class="spellcasting-spells" placeholder="Spells (one per line, format: 'Cantrips: fire bolt, light' or '1st (4 slots): magic missile, shield' or 'At will: detect magic' or '1/day each: fireball, lightning bolt')">${escapeHtml(formatSpellcastingForEdit(sc))}</textarea>
            </div>
            <div class="item-buttons">
                <button type="button" class="move-up-btn" data-index="${index}" aria-label="Move up" ${index === 0 ? 'disabled' : ''}>&#9650;</button>
                <button type="button" class="move-down-btn" data-index="${index}" aria-label="Move down" ${index === spellcasting.length - 1 ? 'disabled' : ''}>&#9660;</button>
                <button type="button" class="remove-btn" data-index="${index}" aria-label="Remove">&times;</button>
            </div>
        </div>
    `).join('');
    
    // Add change handlers
    container.querySelectorAll('.spellcasting-name').forEach((input, i) => {
        input.addEventListener('change', () => updateSpellcasting(i, 'name', input.value));
    });
    container.querySelectorAll('.spellcasting-header').forEach((textarea, i) => {
        textarea.addEventListener('change', () => updateSpellcasting(i, 'headerEntries', textarea.value));
    });
    container.querySelectorAll('.spellcasting-spells').forEach((textarea, i) => {
        textarea.addEventListener('change', () => updateSpellcastingSpells(i, textarea.value));
    });
    container.querySelectorAll('.remove-btn').forEach(btn => {
        btn.addEventListener('click', () => removeSpellcasting(parseInt(btn.dataset.index)));
    });
    container.querySelectorAll('.move-up-btn').forEach(btn => {
        btn.addEventListener('click', () => moveSpellcastingUp(parseInt(btn.dataset.index)));
    });
    container.querySelectorAll('.move-down-btn').forEach(btn => {
        btn.addEventListener('click', () => moveSpellcastingDown(parseInt(btn.dataset.index)));
    });
}

// Render legendary actions list
export function renderLegendaryActions() {
    const state = getState();
    const monster = state.editingMonster;
    const container = document.getElementById('legendary-list');
    
    // Set legendary action counts
    document.getElementById('legendary-actions-count').value = monster.legendaryActions || 3;
    document.getElementById('legendary-actions-lair').value = monster.legendaryActionsLair || 0;
    
    const legendary = monster.legendary || [];
    
    if (legendary.length === 0) {
        container.innerHTML = '<p class="empty-hint">No legendary actions added</p>';
        return;
    }
    
    container.innerHTML = legendary.map((action, index) => `
        <div class="legendary-item item-row" data-index="${index}">
            <div class="legendary-content">
                <input type="text" class="legendary-name" value="${escapeHtml(action.name || '')}" placeholder="Legendary action name (e.g., 'Attack' or 'Wing Attack (Costs 2 Actions)')">
                <textarea class="legendary-desc" placeholder="Description">${escapeHtml(formatEntries(action.entries))}</textarea>
            </div>
            <div class="item-buttons">
                <button type="button" class="move-up-btn" data-index="${index}" aria-label="Move up" ${index === 0 ? 'disabled' : ''}>&#9650;</button>
                <button type="button" class="move-down-btn" data-index="${index}" aria-label="Move down" ${index === legendary.length - 1 ? 'disabled' : ''}>&#9660;</button>
                <button type="button" class="remove-btn" data-index="${index}" aria-label="Remove">&times;</button>
            </div>
        </div>
    `).join('');
    
    // Add change handlers
    container.querySelectorAll('.legendary-name').forEach((input, i) => {
        input.addEventListener('change', () => updateLegendaryAction(i, 'name', input.value));
    });
    container.querySelectorAll('.legendary-desc').forEach((textarea, i) => {
        textarea.addEventListener('change', () => updateLegendaryAction(i, 'entries', textarea.value));
    });
    container.querySelectorAll('.remove-btn').forEach(btn => {
        btn.addEventListener('click', () => removeLegendaryAction(parseInt(btn.dataset.index)));
    });
    container.querySelectorAll('.move-up-btn').forEach(btn => {
        btn.addEventListener('click', () => moveLegendaryActionUp(parseInt(btn.dataset.index)));
    });
    container.querySelectorAll('.move-down-btn').forEach(btn => {
        btn.addEventListener('click', () => moveLegendaryActionDown(parseInt(btn.dataset.index)));
    });
}

// Format entries array to string
function formatEntries(entries) {
    if (!entries) return '';
    if (typeof entries === 'string') return entries;
    if (Array.isArray(entries)) {
        return entries.map(e => typeof e === 'string' ? e : JSON.stringify(e)).join('\n');
    }
    return '';
}

// Parse entries string to array
function parseEntries(text) {
    if (!text) return [];
    return text.split('\n').filter(line => line.trim());
}

// Generic move item up in array
function moveItemUp(array, index) {
    if (index <= 0 || index >= array.length) return false;
    [array[index - 1], array[index]] = [array[index], array[index - 1]];
    return true;
}

// Generic move item down in array
function moveItemDown(array, index) {
    if (index < 0 || index >= array.length - 1) return false;
    [array[index], array[index + 1]] = [array[index + 1], array[index]];
    return true;
}

// Update trait
function updateTrait(index, field, value) {
    const state = getState();
    if (!state.editingMonster.trait) state.editingMonster.trait = [];
    if (!state.editingMonster.trait[index]) state.editingMonster.trait[index] = {};
    
    if (field === 'entries') {
        state.editingMonster.trait[index].entries = parseEntries(value);
    } else {
        state.editingMonster.trait[index][field] = value;
    }
}

// Update action
function updateAction(index, field, value) {
    const state = getState();
    if (!state.editingMonster.action) state.editingMonster.action = [];
    if (!state.editingMonster.action[index]) state.editingMonster.action[index] = {};
    
    if (field === 'entries') {
        state.editingMonster.action[index].entries = parseEntries(value);
    } else {
        state.editingMonster.action[index][field] = value;
    }
}

// Update bonus action
function updateBonusAction(index, field, value) {
    const state = getState();
    if (!state.editingMonster.bonus) state.editingMonster.bonus = [];
    if (!state.editingMonster.bonus[index]) state.editingMonster.bonus[index] = {};
    
    if (field === 'entries') {
        state.editingMonster.bonus[index].entries = parseEntries(value);
    } else {
        state.editingMonster.bonus[index][field] = value;
    }
}

// Update reaction
function updateReaction(index, field, value) {
    const state = getState();
    if (!state.editingMonster.reaction) state.editingMonster.reaction = [];
    if (!state.editingMonster.reaction[index]) state.editingMonster.reaction[index] = {};
    
    if (field === 'entries') {
        state.editingMonster.reaction[index].entries = parseEntries(value);
    } else {
        state.editingMonster.reaction[index][field] = value;
    }
}

// Add new trait
export function addTrait() {
    const state = getState();
    if (!state.editingMonster.trait) state.editingMonster.trait = [];
    state.editingMonster.trait.push({ name: '', entries: [] });
    renderTraits();
}

// Remove trait
function removeTrait(index) {
    const state = getState();
    if (state.editingMonster.trait) {
        state.editingMonster.trait.splice(index, 1);
        renderTraits();
    }
}

// Move trait up
function moveTraitUp(index) {
    const state = getState();
    if (state.editingMonster.trait && moveItemUp(state.editingMonster.trait, index)) {
        renderTraits();
    }
}

// Move trait down
function moveTraitDown(index) {
    const state = getState();
    if (state.editingMonster.trait && moveItemDown(state.editingMonster.trait, index)) {
        renderTraits();
    }
}

// Add new action
export function addAction() {
    const state = getState();
    if (!state.editingMonster.action) state.editingMonster.action = [];
    state.editingMonster.action.push({ name: '', entries: [] });
    renderActions();
}

// Remove action
function removeAction(index) {
    const state = getState();
    if (state.editingMonster.action) {
        state.editingMonster.action.splice(index, 1);
        renderActions();
    }
}

// Move action up
function moveActionUp(index) {
    const state = getState();
    if (state.editingMonster.action && moveItemUp(state.editingMonster.action, index)) {
        renderActions();
    }
}

// Move action down
function moveActionDown(index) {
    const state = getState();
    if (state.editingMonster.action && moveItemDown(state.editingMonster.action, index)) {
        renderActions();
    }
}

// Add new bonus action
export function addBonusAction() {
    const state = getState();
    if (!state.editingMonster.bonus) state.editingMonster.bonus = [];
    state.editingMonster.bonus.push({ name: '', entries: [] });
    renderBonusActions();
}

// Remove bonus action
function removeBonusAction(index) {
    const state = getState();
    if (state.editingMonster.bonus) {
        state.editingMonster.bonus.splice(index, 1);
        renderBonusActions();
    }
}

// Move bonus action up
function moveBonusActionUp(index) {
    const state = getState();
    if (state.editingMonster.bonus && moveItemUp(state.editingMonster.bonus, index)) {
        renderBonusActions();
    }
}

// Move bonus action down
function moveBonusActionDown(index) {
    const state = getState();
    if (state.editingMonster.bonus && moveItemDown(state.editingMonster.bonus, index)) {
        renderBonusActions();
    }
}

// Add new reaction
export function addReaction() {
    const state = getState();
    if (!state.editingMonster.reaction) state.editingMonster.reaction = [];
    state.editingMonster.reaction.push({ name: '', entries: [] });
    renderReactions();
}

// Remove reaction
function removeReaction(index) {
    const state = getState();
    if (state.editingMonster.reaction) {
        state.editingMonster.reaction.splice(index, 1);
        renderReactions();
    }
}

// Move reaction up
function moveReactionUp(index) {
    const state = getState();
    if (state.editingMonster.reaction && moveItemUp(state.editingMonster.reaction, index)) {
        renderReactions();
    }
}

// Move reaction down
function moveReactionDown(index) {
    const state = getState();
    if (state.editingMonster.reaction && moveItemDown(state.editingMonster.reaction, index)) {
        renderReactions();
    }
}

// Format spellcasting object to editable text
function formatSpellcastingForEdit(sc) {
    const lines = [];
    
    // At-will spells
    if (sc.will && sc.will.length > 0) {
        lines.push(`At will: ${sc.will.map(cleanSpellName).join(', ')}`);
    }
    
    // Daily spells
    if (sc.daily) {
        const dailyOrder = ['3e', '3', '2e', '2', '1e', '1'];
        dailyOrder.forEach(key => {
            if (sc.daily[key] && sc.daily[key].length > 0) {
                const times = key.charAt(0);
                const each = key.includes('e') ? ' each' : '';
                lines.push(`${times}/day${each}: ${sc.daily[key].map(cleanSpellName).join(', ')}`);
            }
        });
    }
    
    // Spell slots by level
    if (sc.spells) {
        Object.keys(sc.spells).sort((a, b) => parseInt(a) - parseInt(b)).forEach(level => {
            const spellLevel = sc.spells[level];
            if (spellLevel.spells && spellLevel.spells.length > 0) {
                if (level === '0') {
                    lines.push(`Cantrips: ${spellLevel.spells.map(cleanSpellName).join(', ')}`);
                } else {
                    const suffix = level === '1' ? 'st' : level === '2' ? 'nd' : level === '3' ? 'rd' : 'th';
                    const slots = spellLevel.slots ? ` (${spellLevel.slots} slots)` : '';
                    lines.push(`${level}${suffix}${slots}: ${spellLevel.spells.map(cleanSpellName).join(', ')}`);
                }
            }
        });
    }
    
    return lines.join('\n');
}

// Clean spell name from 5e.tools format
function cleanSpellName(spell) {
    if (typeof spell === 'string') {
        return spell.replace(/{@spell ([^|}]+)(\|[^}]*)?}/g, '$1').replace(/{@[^}]+}/g, '');
    }
    return '';
}

// Parse spellcasting text back to 5e.tools format
function parseSpellcastingText(text) {
    const result = {};
    const lines = text.split('\n').filter(line => line.trim());
    
    lines.forEach(line => {
        const colonIndex = line.indexOf(':');
        if (colonIndex === -1) return;
        
        const prefix = line.substring(0, colonIndex).trim().toLowerCase();
        const spellsText = line.substring(colonIndex + 1).trim();
        const spells = spellsText.split(',').map(s => s.trim()).filter(s => s);
        
        if (spells.length === 0) return;
        
        if (prefix === 'at will') {
            result.will = spells;
        } else if (prefix === 'cantrips') {
            if (!result.spells) result.spells = {};
            result.spells['0'] = { spells };
        } else if (prefix.match(/^\d\/day/)) {
            // Parse "1/day", "2/day each", etc.
            const match = prefix.match(/^(\d)\/day( each)?/);
            if (match) {
                if (!result.daily) result.daily = {};
                const key = match[2] ? `${match[1]}e` : match[1];
                result.daily[key] = spells;
            }
        } else if (prefix.match(/^\d+(st|nd|rd|th)/)) {
            // Parse "1st (4 slots)", "2nd", etc.
            const match = prefix.match(/^(\d+)(st|nd|rd|th)(\s*\((\d+)\s*slots?\))?/);
            if (match) {
                if (!result.spells) result.spells = {};
                const level = match[1];
                const slots = match[4] ? parseInt(match[4]) : undefined;
                result.spells[level] = slots ? { slots, spells } : { spells };
            }
        }
    });
    
    return result;
}

// Update spellcasting field
function updateSpellcasting(index, field, value) {
    const state = getState();
    if (!state.editingMonster.spellcasting) state.editingMonster.spellcasting = [];
    if (!state.editingMonster.spellcasting[index]) state.editingMonster.spellcasting[index] = { type: 'spellcasting' };
    
    if (field === 'headerEntries') {
        state.editingMonster.spellcasting[index].headerEntries = parseEntries(value);
    } else {
        state.editingMonster.spellcasting[index][field] = value;
    }
}

// Update spellcasting spells from text
function updateSpellcastingSpells(index, text) {
    const state = getState();
    if (!state.editingMonster.spellcasting) state.editingMonster.spellcasting = [];
    if (!state.editingMonster.spellcasting[index]) state.editingMonster.spellcasting[index] = { type: 'spellcasting' };
    
    const parsed = parseSpellcastingText(text);
    const sc = state.editingMonster.spellcasting[index];
    
    // Clear existing spell data
    delete sc.will;
    delete sc.daily;
    delete sc.spells;
    
    // Apply parsed data
    if (parsed.will) sc.will = parsed.will;
    if (parsed.daily) sc.daily = parsed.daily;
    if (parsed.spells) sc.spells = parsed.spells;
}

// Add new spellcasting
export function addSpellcasting() {
    const state = getState();
    if (!state.editingMonster.spellcasting) state.editingMonster.spellcasting = [];
    state.editingMonster.spellcasting.push({ 
        name: 'Spellcasting', 
        type: 'spellcasting',
        headerEntries: [] 
    });
    renderSpellcasting();
}

// Remove spellcasting
function removeSpellcasting(index) {
    const state = getState();
    if (state.editingMonster.spellcasting) {
        state.editingMonster.spellcasting.splice(index, 1);
        renderSpellcasting();
    }
}

// Move spellcasting up
function moveSpellcastingUp(index) {
    const state = getState();
    if (state.editingMonster.spellcasting && moveItemUp(state.editingMonster.spellcasting, index)) {
        renderSpellcasting();
    }
}

// Move spellcasting down
function moveSpellcastingDown(index) {
    const state = getState();
    if (state.editingMonster.spellcasting && moveItemDown(state.editingMonster.spellcasting, index)) {
        renderSpellcasting();
    }
}

// Update legendary action
function updateLegendaryAction(index, field, value) {
    const state = getState();
    if (!state.editingMonster.legendary) state.editingMonster.legendary = [];
    if (!state.editingMonster.legendary[index]) state.editingMonster.legendary[index] = {};
    
    if (field === 'entries') {
        state.editingMonster.legendary[index].entries = parseEntries(value);
    } else {
        state.editingMonster.legendary[index][field] = value;
    }
}

// Add new legendary action
export function addLegendaryAction() {
    const state = getState();
    if (!state.editingMonster.legendary) state.editingMonster.legendary = [];
    state.editingMonster.legendary.push({ name: '', entries: [] });
    renderLegendaryActions();
}

// Remove legendary action
function removeLegendaryAction(index) {
    const state = getState();
    if (state.editingMonster.legendary) {
        state.editingMonster.legendary.splice(index, 1);
        renderLegendaryActions();
    }
}

// Move legendary action up
function moveLegendaryActionUp(index) {
    const state = getState();
    if (state.editingMonster.legendary && moveItemUp(state.editingMonster.legendary, index)) {
        renderLegendaryActions();
    }
}

// Move legendary action down
function moveLegendaryActionDown(index) {
    const state = getState();
    if (state.editingMonster.legendary && moveItemDown(state.editingMonster.legendary, index)) {
        renderLegendaryActions();
    }
}

// Collect form data into monster object
function collectFormData() {
    const state = getState();
    const monster = state.editingMonster;
    
    monster.name = document.getElementById('monster-name').value.trim();
    monster.size = [document.getElementById('monster-size').value];
    monster.type = document.getElementById('monster-type').value;
    monster.cr = document.getElementById('monster-cr').value;
    monster.alignment = [document.getElementById('monster-alignment').value];
    
    const ac = parseInt(document.getElementById('monster-ac').value) || 10;
    monster.ac = [{ ac }];
    
    const hp = parseInt(document.getElementById('monster-hp').value) || 10;
    const hpFormula = document.getElementById('monster-hp-formula').value.trim();
    monster.hp = { average: hp, formula: hpFormula || `${Math.ceil(hp / 4.5)}d8` };
    
    monster.speed = { walk: parseInt(document.getElementById('monster-speed').value) || 30 };
    
    monster.str = parseInt(document.getElementById('monster-str').value) || 10;
    monster.dex = parseInt(document.getElementById('monster-dex').value) || 10;
    monster.con = parseInt(document.getElementById('monster-con').value) || 10;
    monster.int = parseInt(document.getElementById('monster-int').value) || 10;
    monster.wis = parseInt(document.getElementById('monster-wis').value) || 10;
    monster.cha = parseInt(document.getElementById('monster-cha').value) || 10;
    
    // Defenses & Senses
    monster.save = parseSaves(document.getElementById('monster-saves').value);
    monster.skill = parseSkills(document.getElementById('monster-skills').value);
    monster.resist = parseCommaList(document.getElementById('monster-resistances').value);
    monster.immune = parseCommaList(document.getElementById('monster-immunities').value);
    monster.vulnerable = parseCommaList(document.getElementById('monster-vulnerabilities').value);
    monster.conditionImmune = parseCommaList(document.getElementById('monster-condition-immunities').value);
    monster.senses = parseCommaList(document.getElementById('monster-senses').value);
    monster.passive = parseInt(document.getElementById('monster-passive').value) || 10;
    monster.languages = parseCommaList(document.getElementById('monster-languages').value);
    
    // Clean up empty arrays/objects
    if (!monster.resist || monster.resist.length === 0) delete monster.resist;
    if (!monster.immune || monster.immune.length === 0) delete monster.immune;
    if (!monster.vulnerable || monster.vulnerable.length === 0) delete monster.vulnerable;
    if (!monster.conditionImmune || monster.conditionImmune.length === 0) delete monster.conditionImmune;
    if (!monster.senses || monster.senses.length === 0) delete monster.senses;
    if (!monster.languages || monster.languages.length === 0) delete monster.languages;
    
    // Legendary actions config
    const legendaryCount = parseInt(document.getElementById('legendary-actions-count').value) || 3;
    const legendaryLair = parseInt(document.getElementById('legendary-actions-lair').value) || 0;
    if (monster.legendary && monster.legendary.length > 0) {
        monster.legendaryActions = legendaryCount;
        if (legendaryLair > 0 && legendaryLair !== legendaryCount) {
            monster.legendaryActionsLair = legendaryLair;
        } else {
            delete monster.legendaryActionsLair;
        }
    } else {
        delete monster.legendaryActions;
        delete monster.legendaryActionsLair;
    }
    
    monster.source = 'Custom';
    monster.isCustom = true;
    
    return monster;
}

// Preview monster stat block
export function previewMonster() {
    const monster = collectFormData();
    
    if (!monster.name) {
        alert('Monster name is required for preview');
        return;
    }
    
    showStatBlock(monster);
}

// Collect form data and save monster
export function saveMonster() {
    const monster = collectFormData();
    
    if (!monster.name) {
        alert('Monster name is required');
        return;
    }
    
    // Save to storage
    CustomMonsters.saveCustomMonster(monster);
    
    // Return to list
    setView('custom-monsters');
    CustomMonsterList.render();
}

// Delete current monster
export function deleteMonster() {
    const state = getState();
    const monster = state.editingMonster;
    
    if (monster && monster.id) {
        if (confirm(`Delete "${monster.name}"?`)) {
            CustomMonsters.deleteCustomMonster(monster.id);
            setView('custom-monsters');
            CustomMonsterList.render();
        }
    }
}

// Update proficiency bonus display based on CR
export function updateProficiencyBonus(cr) {
    const profBonus = getProficiencyBonus(cr);
    const profEl = document.getElementById('monster-prof-bonus');
    if (profEl) {
        profEl.textContent = `Prof. +${profBonus}`;
    }
}

// Handle CR change to update proficiency bonus
export function onCRChange() {
    const cr = document.getElementById('monster-cr').value;
    updateProficiencyBonus(cr);
}

export default {
    init,
    initFromBaseline,
    renderForm,
    renderTraits,
    renderActions,
    renderBonusActions,
    renderReactions,
    renderSpellcasting,
    renderLegendaryActions,
    addTrait,
    addAction,
    addBonusAction,
    addReaction,
    addSpellcasting,
    addLegendaryAction,
    previewMonster,
    saveMonster,
    deleteMonster,
    updateProficiencyBonus,
    onCRChange
};
