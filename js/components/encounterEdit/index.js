// Encounter Edit Component

import * as Storage from '../../services/storage.js';
import * as MonsterAPI from '../../services/monsterApi.js';
import * as CustomMonsters from '../../services/customMonsters.js';
import { getState, setView, setEditingEncounter, setEditingMonsterIndex } from '../../services/state.js';
import { escapeHtml, closeModals } from '../../utils/helpers.js';
import { showStatBlockByNameSource, showStatBlock } from '../modals/statBlock.js';
import { searchMonsters as searchMonsterModal } from '../modals/monsterSearchModal.js';

// Initialize edit form
export function init(encounter = null) {
    const state = getState();
    
    const editingEncounter = encounter || {
        id: Date.now().toString(),
        title: '',
        description: '',
        pcs: [],
        monsters: [],
        autoAddMonsters: false
    };
    
    setEditingEncounter(editingEncounter);

    document.getElementById('encounter-title').value = editingEncounter.title;
    document.getElementById('encounter-description').value = editingEncounter.description || '';
    document.getElementById('auto-add-monsters').checked = editingEncounter.autoAddMonsters || false;
    
    const deleteBtn = document.getElementById('delete-encounter-btn');
    if (encounter) {
        deleteBtn.classList.remove('hidden');
    } else {
        deleteBtn.classList.add('hidden');
    }

    renderPCList();
    renderMonsterList();
    setView('encounter-edit');
}

// Render PC list in edit form
export function renderPCList() {
    const state = getState();
    const container = document.getElementById('pc-list');
    const pcs = state.editingEncounter.pcs || [];

    container.innerHTML = pcs.map((pc, index) => `
        <div class="item-row" data-index="${index}">
            <input type="text" value="${escapeHtml(pc.name)}" placeholder="Character name..." class="pc-name-input">
            <button type="button" class="remove-btn" data-index="${index}">
                <svg viewBox="0 0 24 24" width="20" height="20"><path fill="currentColor" d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>
            </button>
        </div>
    `).join('');

    // Add event listeners
    container.querySelectorAll('.pc-name-input').forEach((input, index) => {
        input.addEventListener('change', () => {
            state.editingEncounter.pcs[index].name = input.value;
        });
    });

    container.querySelectorAll('.remove-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const index = parseInt(btn.dataset.index);
            state.editingEncounter.pcs.splice(index, 1);
            renderPCList();
        });
    });
}

// Render Monster list in edit form
export function renderMonsterList() {
    const state = getState();
    const container = document.getElementById('monster-list');
    const monsters = state.editingEncounter.monsters || [];

    container.innerHTML = monsters.map((monster, index) => `
        <div class="item-row" data-index="${index}">
            <div class="monster-info">
                <div class="monster-name">${escapeHtml(monster.name)}</div>
                <div class="monster-meta">CR ${MonsterAPI.formatCR(monster.cr)} | HP ${monster.hp} | ${monster.source}</div>
            </div>
            <button type="button" class="btn btn-small notes-btn ${monster.comment ? 'has-notes' : ''}" data-index="${index}" title="DM Notes">
                <svg viewBox="0 0 24 24" width="16" height="16"><path fill="currentColor" d="M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6zm-1 2l5 5h-5V4zM6 20V4h6v6h6v10H6z"/></svg>
            </button>
            <button type="button" class="btn btn-small stats-btn" data-name="${escapeHtml(monster.name)}" data-source="${monster.source}" data-index="${index}">Stats</button>
            <button type="button" class="remove-btn" data-index="${index}">
                <svg viewBox="0 0 24 24" width="20" height="20"><path fill="currentColor" d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>
            </button>
        </div>
    `).join('');

    // Notes buttons
    container.querySelectorAll('.notes-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const index = parseInt(btn.dataset.index);
            showDMNotesModal(index);
        });
    });

    // Stats buttons - pass comment to stat block
    container.querySelectorAll('.stats-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
            const name = btn.dataset.name;
            const source = btn.dataset.source;
            const index = parseInt(btn.dataset.index);
            const monster = state.editingEncounter.monsters[index];
            const comment = monster?.comment || '';
            
            // Check if it's a custom monster
            if (monster?.customMonsterId || source === 'Custom') {
                const customMonster = monster?.customMonsterId 
                    ? CustomMonsters.getCustomMonster(monster.customMonsterId)
                    : CustomMonsters.searchCustomMonsters(name).find(m => m.name === name);
                if (customMonster) {
                    showStatBlock(customMonster, comment);
                    return;
                }
            }
            
            await showStatBlockByNameSource(name, source, comment);
        });
    });

    // Remove buttons
    container.querySelectorAll('.remove-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const index = parseInt(btn.dataset.index);
            state.editingEncounter.monsters.splice(index, 1);
            renderMonsterList();
        });
    });
}

// Show DM Notes modal for a monster
export function showDMNotesModal(monsterIndex) {
    const state = getState();
    setEditingMonsterIndex(monsterIndex);
    const monster = state.editingEncounter.monsters[monsterIndex];
    
    document.getElementById('dm-notes-modal-title').textContent = `Notes: ${monster.name}`;
    document.getElementById('dm-notes-input').value = monster.comment || '';
    document.getElementById('dm-notes-modal').classList.add('active');
    document.getElementById('dm-notes-input').focus();
}

// Save DM Notes from modal
export function saveDMNotes() {
    const state = getState();
    const notes = document.getElementById('dm-notes-input').value;
    state.editingEncounter.monsters[state.editingMonsterIndex].comment = notes;
    closeModals();
    renderMonsterList();
}

// Add monster to encounter (for encounter editing)
export async function addMonsterToEncounter(name, source, customMonsterId = null) {
    const state = getState();
    let monster;
    
    // Check if it's a custom monster
    if (customMonsterId || source === 'Custom') {
        monster = customMonsterId 
            ? CustomMonsters.getCustomMonster(customMonsterId)
            : CustomMonsters.searchCustomMonsters(name).find(m => m.name === name);
    } else {
        monster = await MonsterAPI.getMonster(name, source);
    }
    
    if (!monster) {
        alert('Could not load monster data');
        return;
    }

    if (!state.editingEncounter.monsters) {
        state.editingEncounter.monsters = [];
    }

    state.editingEncounter.monsters.push({
        name: monster.name,
        source: monster.source || 'Custom',
        cr: monster.cr,
        hp: MonsterAPI.getHP(monster),
        customMonsterId: monster.isCustom ? monster.id : undefined, // Track custom monster ID
        comment: '' // DM notes for this monster instance
    });

    renderMonsterList();
    closeModals();
}

// Search monsters (for encounter editing)
export async function searchMonsters(query, source) {
    const results = document.getElementById('monster-search-results');

    await searchMonsterModal({
        query,
        source,
        container: results,
        emptyMessage: 'No monsters found',
        onSelect: async ({ name, source, id }) => {
            await addMonsterToEncounter(name, source, id || null);
        },
        onViewStats: async ({ name, source, id }) => {
            if (id && source === 'Custom') {
                const monster = CustomMonsters.getCustomMonster(id);
                if (monster) {
                    showStatBlock(monster);
                }
            } else {
                await showStatBlockByNameSource(name, source);
            }
        }
    });
}

// Show monster search modal
export function showMonsterSearch() {
    document.getElementById('monster-search-input').value = '';
    document.getElementById('monster-search-results').innerHTML = 
        '<div class="search-empty">Type to search for monsters...</div>';
    document.getElementById('monster-search-modal').classList.add('active');
    document.getElementById('monster-search-input').focus();
}

export default {
    init,
    renderPCList,
    renderMonsterList,
    showDMNotesModal,
    saveDMNotes,
    addMonsterToEncounter,
    searchMonsters,
    showMonsterSearch
};
