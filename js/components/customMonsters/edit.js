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
    
    // Traits and actions
    renderTraits();
    renderActions();
    
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
            <button type="button" class="remove-btn" data-index="${index}" aria-label="Remove">&times;</button>
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
            <button type="button" class="remove-btn" data-index="${index}" aria-label="Remove">&times;</button>
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
    addTrait,
    addAction,
    previewMonster,
    saveMonster,
    deleteMonster,
    updateProficiencyBonus,
    onCRChange
};
