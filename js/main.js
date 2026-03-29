// D&D Encounter Tracker - Main Application Entry Point

import * as Storage from './services/storage.js';
import * as MonsterAPI from './services/monsterApi.js';
import { getState, setView, setMonsterQuantity } from './services/state.js';
import { closeModals, hideContextMenu } from './utils/helpers.js';

import * as EncounterList from './components/encounterList/index.js';
import * as EncounterEdit from './components/encounterEdit/index.js';
import * as CombatTracker from './components/combatTracker/index.js';

// Initialize Event Handlers
function initEventHandlers() {
    // Back button
    document.getElementById('back-btn').addEventListener('click', () => {
        const state = getState();
        if (state.currentView === 'encounter-edit') {
            setView('encounter-list');
            EncounterList.render();
        } else if (state.currentView === 'encounter-run') {
            if (confirm('End combat and return to encounter list?')) {
                setView('encounter-list');
                EncounterList.render();
            }
        }
    });

    // New encounter button
    document.getElementById('new-encounter-btn').addEventListener('click', () => {
        EncounterEdit.init();
    });

    // Add PC button
    document.getElementById('add-pc-btn').addEventListener('click', () => {
        const state = getState();
        state.editingEncounter.pcs.push({ name: '' });
        EncounterEdit.renderPCList();
        // Focus the new input
        const inputs = document.querySelectorAll('.pc-name-input');
        if (inputs.length > 0) {
            inputs[inputs.length - 1].focus();
        }
    });

    // Add monster button
    document.getElementById('add-monster-btn').addEventListener('click', () => {
        EncounterEdit.showMonsterSearch();
    });

    // Monster search input
    let searchTimeout;
    document.getElementById('monster-search-input').addEventListener('input', (e) => {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => {
            const source = document.getElementById('monster-source-filter').value;
            EncounterEdit.searchMonsters(e.target.value, source);
        }, 300);
    });

    document.getElementById('monster-source-filter').addEventListener('change', () => {
        const query = document.getElementById('monster-search-input').value;
        if (query.length >= 2) {
            const source = document.getElementById('monster-source-filter').value;
            EncounterEdit.searchMonsters(query, source);
        }
    });

    // Encounter form submit
    document.getElementById('encounter-form').addEventListener('submit', (e) => {
        e.preventDefault();
        const state = getState();
        
        state.editingEncounter.title = document.getElementById('encounter-title').value;
        state.editingEncounter.description = document.getElementById('encounter-description').value;
        
        // Filter out empty PCs
        state.editingEncounter.pcs = state.editingEncounter.pcs.filter(pc => pc.name.trim());
        
        Storage.saveEncounter(state.editingEncounter);
        setView('encounter-list');
        EncounterList.render();
    });

    // Delete encounter button
    document.getElementById('delete-encounter-btn').addEventListener('click', () => {
        const state = getState();
        if (confirm('Delete this encounter?')) {
            Storage.deleteEncounter(state.editingEncounter.id);
            setView('encounter-list');
            EncounterList.render();
        }
    });

    // Context menu actions
    document.querySelectorAll('.context-item').forEach(item => {
        item.addEventListener('click', () => {
            const menu = document.getElementById('context-menu');
            const encounterId = menu.dataset.encounterId;
            const action = item.dataset.action;
            const encounter = Storage.getEncounter(encounterId);

            switch (action) {
                case 'edit':
                    EncounterEdit.init(encounter);
                    break;
                case 'copy':
                    const copy = JSON.parse(JSON.stringify(encounter));
                    copy.id = Date.now().toString();
                    copy.title = `${copy.title} (Copy)`;
                    Storage.saveEncounter(copy);
                    EncounterList.render();
                    break;
                case 'run':
                    CombatTracker.init(encounter);
                    break;
                case 'delete':
                    if (confirm('Delete this encounter?')) {
                        Storage.deleteEncounter(encounterId);
                        EncounterList.render();
                    }
                    break;
            }

            hideContextMenu();
        });
    });

    // Start combat button
    document.getElementById('start-combat-btn').addEventListener('click', () => {
        CombatTracker.startCombat();
    });

    // Add monster to combat buttons (both in setup and during combat)
    document.getElementById('add-combat-monster-btn').addEventListener('click', () => {
        CombatTracker.showCombatMonsterSearch();
    });
    document.getElementById('add-combat-monster-btn-2').addEventListener('click', () => {
        CombatTracker.showCombatMonsterSearch();
    });

    // Add PC to combat button
    document.getElementById('add-combat-pc-btn').addEventListener('click', () => {
        document.getElementById('combat-pc-name').value = '';
        document.getElementById('combat-pc-initiative').value = '';
        document.getElementById('combat-pc-modal').classList.add('active');
        document.getElementById('combat-pc-name').focus();
    });

    // Confirm add PC to combat
    document.getElementById('add-combat-pc-confirm').addEventListener('click', () => {
        const name = document.getElementById('combat-pc-name').value.trim();
        const initiative = parseInt(document.getElementById('combat-pc-initiative').value) || 0;
        if (name) {
            CombatTracker.addPCToCombat(name, initiative);
        }
    });

    // Combat monster search
    let combatSearchTimeout;
    document.getElementById('combat-monster-search-input').addEventListener('input', (e) => {
        clearTimeout(combatSearchTimeout);
        combatSearchTimeout = setTimeout(() => {
            const source = document.getElementById('combat-monster-source-filter').value;
            CombatTracker.searchCombatMonsters(e.target.value, source);
        }, 300);
    });

    document.getElementById('combat-monster-source-filter').addEventListener('change', () => {
        const query = document.getElementById('combat-monster-search-input').value;
        if (query.length >= 2) {
            const source = document.getElementById('combat-monster-source-filter').value;
            CombatTracker.searchCombatMonsters(query, source);
        }
    });

    // Quantity controls
    document.getElementById('qty-decrease').addEventListener('click', () => {
        const state = getState();
        setMonsterQuantity(Math.max(1, state.monsterQuantity - 1));
        document.getElementById('monster-quantity').textContent = state.monsterQuantity;
    });

    document.getElementById('qty-increase').addEventListener('click', () => {
        const state = getState();
        setMonsterQuantity(Math.min(20, state.monsterQuantity + 1));
        document.getElementById('monster-quantity').textContent = state.monsterQuantity;
    });

    // Turn navigation
    document.getElementById('next-turn-btn').addEventListener('click', () => {
        CombatTracker.nextTurn();
    });

    document.getElementById('prev-turn-btn').addEventListener('click', () => {
        CombatTracker.prevTurn();
    });

    // HP adjustment buttons (add to the input field value)
    document.querySelectorAll('.hp-controls .hp-adj-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const amount = parseInt(btn.dataset.amount);
            CombatTracker.addToHPDelta(amount);
        });
    });

    // HP custom amount input - update preview on change
    document.getElementById('hp-custom-amount').addEventListener('input', () => {
        CombatTracker.updateHPPreview();
    });

    document.getElementById('hp-reset-btn').addEventListener('click', () => {
        CombatTracker.resetHPDelta();
    });

    document.getElementById('hp-apply-btn').addEventListener('click', () => {
        CombatTracker.applyHPDelta();
    });

    // Allow Enter key in HP input to apply
    document.getElementById('hp-custom-amount').addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            CombatTracker.applyHPDelta();
        }
    });

    // Save initiative button
    document.getElementById('save-initiative-btn').addEventListener('click', () => {
        CombatTracker.saveInitiative();
    });

    // Allow Enter key in initiative input
    document.getElementById('initiative-input').addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            CombatTracker.saveInitiative();
        }
    });

    // Save DM notes button
    document.getElementById('save-dm-notes-btn').addEventListener('click', () => {
        EncounterEdit.saveDMNotes();
    });

    // Close modals
    document.querySelectorAll('.close-modal').forEach(btn => {
        btn.addEventListener('click', () => {
            closeModals();
        });
    });

    // Close modal on backdrop click
    document.querySelectorAll('.modal').forEach(modal => {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                closeModals();
            }
        });
    });

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            closeModals();
            hideContextMenu();
        }
    });
}

// Initialize App
document.addEventListener('DOMContentLoaded', () => {
    initEventHandlers();
    EncounterList.render();
    
    // Preload monster index
    MonsterAPI.loadIndex();
});
