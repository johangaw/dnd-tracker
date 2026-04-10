// D&D Encounter Tracker - Main Application Entry Point

import * as Storage from './services/storage.js';
import * as MonsterAPI from './services/monsterApi.js';
import * as CustomMonsters from './services/customMonsters.js';
import { getState, setView, setMonsterQuantity, setImportingEncounter, setImportingMonster } from './services/state.js';
import { closeModals, hideContextMenu, showToast } from './utils/helpers.js';

// Hide app menu
function hideAppMenu() {
    document.getElementById('app-menu')?.classList.add('hidden');
}

import * as EncounterList from './components/encounterList/index.js';
import * as EncounterEdit from './components/encounterEdit/index.js';
import * as CombatTracker from './components/combatTracker/index.js';
import * as CustomMonsterList from './components/customMonsters/list.js';
import * as CustomMonsterEdit from './components/customMonsters/edit.js';

// Track initialization to prevent duplicate event handlers
let initialized = false;

// Initialize Event Handlers
function initEventHandlers() {
    if (initialized) return;
    initialized = true;
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
        } else if (state.currentView === 'custom-monsters') {
            setView('encounter-list');
            EncounterList.render();
        } else if (state.currentView === 'custom-monster-edit') {
            setView('custom-monsters');
            CustomMonsterList.render();
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
        state.editingEncounter.autoAddMonsters = document.getElementById('auto-add-monsters').checked;
        
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

    // Context menu actions (encounter context menu only)
    document.querySelectorAll('#context-menu .context-item').forEach(item => {
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
                case 'share':
                    const url = Storage.exportEncounterToURL(encounter);
                    navigator.clipboard.writeText(url).then(() => {
                        showToast('Share link copied to clipboard!');
                    }).catch(() => {
                        // Fallback for older browsers
                        prompt('Copy this link to share:', url);
                    });
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

    // Add encounter monster button (quick add from encounter definition)
    document.getElementById('add-encounter-monster-btn').addEventListener('click', () => {
        CombatTracker.showEncounterMonstersModal();
    });

    // Add encounter monster button in setup phase
    document.getElementById('add-encounter-monster-setup-btn').addEventListener('click', () => {
        CombatTracker.showEncounterMonstersModal();
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

    // Import encounter buttons
    document.getElementById('import-cancel-btn').addEventListener('click', () => {
        Storage.clearImportParam();
        closeModals();
    });

    document.getElementById('import-confirm-btn').addEventListener('click', () => {
        const state = getState();
        if (state.importingEncounter) {
            Storage.saveEncounter(state.importingEncounter);
            Storage.clearImportParam();
            setImportingEncounter(null);
            closeModals();
            EncounterList.render();
        }
    });

    // === App Menu ===
    document.getElementById('menu-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        const menu = document.getElementById('app-menu');
        menu.classList.toggle('hidden');
        
        // Close on click outside
        if (!menu.classList.contains('hidden')) {
            setTimeout(() => {
                document.addEventListener('click', hideAppMenu, { once: true });
            }, 0);
        }
    });

    document.getElementById('menu-custom-monsters')?.addEventListener('click', () => {
        hideAppMenu();
        setView('custom-monsters');
        CustomMonsterList.render();
    });

    // === Custom Monster Events ===
    
    // New custom monster button - show choice modal
    document.getElementById('new-custom-monster-btn').addEventListener('click', () => {
        document.getElementById('add-monster-choice-modal').classList.add('active');
    });

    // Choice modal - Create New
    document.getElementById('choice-create-new').addEventListener('click', () => {
        closeModals();
        CustomMonsterEdit.init();
    });

    // Choice modal - From Existing
    document.getElementById('choice-from-existing').addEventListener('click', () => {
        closeModals();
        document.getElementById('baseline-search-input').value = '';
        document.getElementById('baseline-search-results').innerHTML = '';
        document.getElementById('baseline-search-modal').classList.add('active');
    });

    // Choice modal - Import JSON
    document.getElementById('choice-import-json').addEventListener('click', () => {
        closeModals();
        document.getElementById('import-json-input').value = '';
        document.getElementById('import-json-error').classList.add('hidden');
        document.getElementById('import-json-modal').classList.add('active');
    });

    // Custom monster form submit
    document.getElementById('custom-monster-form').addEventListener('submit', (e) => {
        e.preventDefault();
        CustomMonsterEdit.saveMonster();
    });

    // Preview monster button
    document.getElementById('preview-monster-btn').addEventListener('click', () => {
        CustomMonsterEdit.previewMonster();
    });

    // Delete monster button
    document.getElementById('delete-monster-btn').addEventListener('click', () => {
        CustomMonsterEdit.deleteMonster();
    });

    // Add trait button
    document.getElementById('add-trait-btn').addEventListener('click', () => {
        CustomMonsterEdit.addTrait();
    });

    // Add action button
    document.getElementById('add-action-btn').addEventListener('click', () => {
        CustomMonsterEdit.addAction();
    });

    // Add bonus action button
    document.getElementById('add-bonus-btn').addEventListener('click', () => {
        CustomMonsterEdit.addBonusAction();
    });

    // Add reaction button
    document.getElementById('add-reaction-btn').addEventListener('click', () => {
        CustomMonsterEdit.addReaction();
    });

    // Add spellcasting button
    document.getElementById('add-spellcasting-btn').addEventListener('click', () => {
        CustomMonsterEdit.addSpellcasting();
    });

    // Add legendary action button
    document.getElementById('add-legendary-btn').addEventListener('click', () => {
        CustomMonsterEdit.addLegendaryAction();
    });

    // CR change - update proficiency bonus
    document.getElementById('monster-cr').addEventListener('change', () => {
        CustomMonsterEdit.onCRChange();
    });

    // Custom monster context menu actions
    document.querySelectorAll('#monster-context-menu .context-item').forEach(item => {
        item.addEventListener('click', () => {
            const menu = document.getElementById('monster-context-menu');
            const monsterId = menu.dataset.monsterId;
            const action = item.dataset.action;
            const monster = CustomMonsters.getCustomMonster(monsterId);

            if (!monster) {
                CustomMonsterList.hideContextMenu();
                return;
            }

            switch (action) {
                case 'edit':
                    CustomMonsterEdit.init(monster);
                    break;
                case 'copy':
                    const copy = JSON.parse(JSON.stringify(monster));
                    copy.id = Date.now().toString();
                    copy.name = `${copy.name} (Copy)`;
                    CustomMonsters.saveCustomMonster(copy);
                    CustomMonsterList.render();
                    break;
                case 'copy-json':
                    const jsonExport = { ...monster };
                    delete jsonExport.id;
                    delete jsonExport.isCustom;
                    const jsonStr = JSON.stringify(jsonExport, null, 2);
                    navigator.clipboard.writeText(jsonStr).then(() => {
                        showToast('Monster JSON copied to clipboard!');
                    }).catch(() => {
                        prompt('Copy this JSON:', jsonStr);
                    });
                    break;
                case 'share':
                    const url = CustomMonsters.exportMonsterToURL(monster);
                    navigator.clipboard.writeText(url).then(() => {
                        showToast('Share link copied to clipboard!');
                    }).catch(() => {
                        prompt('Copy this link to share:', url);
                    });
                    break;
                case 'delete':
                    if (confirm(`Delete "${monster.name}"?`)) {
                        CustomMonsters.deleteCustomMonster(monsterId);
                        CustomMonsterList.render();
                    }
                    break;
            }

            CustomMonsterList.hideContextMenu();
        });
    });

    // === Import JSON Modal ===
    document.getElementById('import-json-cancel-btn').addEventListener('click', () => {
        closeModals();
    });

    // Copy schema URL button
    document.getElementById('copy-schema-btn').addEventListener('click', async () => {
        const basePath = window.location.pathname.endsWith('/') 
            ? window.location.pathname 
            : window.location.pathname.replace(/\/[^/]*$/, '/');
        const schemaUrl = `${window.location.origin}${basePath}monster-schema.json`;
        try {
            await navigator.clipboard.writeText(schemaUrl);
            const msg = document.getElementById('schema-copied-msg');
            msg.classList.remove('hidden');
            setTimeout(() => msg.classList.add('hidden'), 2000);
        } catch (e) {
            // Fallback for older browsers
            prompt('Copy this URL:', schemaUrl);
        }
    });

    document.getElementById('import-json-confirm-btn').addEventListener('click', () => {
        const input = document.getElementById('import-json-input');
        const errorEl = document.getElementById('import-json-error');
        
        try {
            const monster = CustomMonsters.importMonsterFromJSON(input.value);
            CustomMonsters.saveCustomMonster(monster);
            closeModals();
            
            // Navigate to custom monsters view to show the imported monster
            setView('custom-monsters');
            CustomMonsterList.render();
        } catch (e) {
            errorEl.textContent = e.message;
            errorEl.classList.remove('hidden');
        }
    });

    // === Import Monster from URL Modal ===
    document.getElementById('import-monster-cancel-btn').addEventListener('click', () => {
        CustomMonsters.clearMonsterImportParam();
        closeModals();
    });

    document.getElementById('import-monster-confirm-btn').addEventListener('click', () => {
        const state = getState();
        if (state.importingMonster) {
            CustomMonsters.saveCustomMonster(state.importingMonster);
            CustomMonsters.clearMonsterImportParam();
            setImportingMonster(null);
            closeModals();
            setView('custom-monsters');
            CustomMonsterList.render();
        }
    });

    // === Baseline Search Modal ===
    let baselineSearchTimeout;
    document.getElementById('baseline-search-input').addEventListener('input', (e) => {
        clearTimeout(baselineSearchTimeout);
        baselineSearchTimeout = setTimeout(() => {
            const source = document.getElementById('baseline-source-filter').value;
            searchBaselineMonsters(e.target.value, source);
        }, 300);
    });

    document.getElementById('baseline-source-filter').addEventListener('change', () => {
        const query = document.getElementById('baseline-search-input').value;
        if (query.length >= 2) {
            const source = document.getElementById('baseline-source-filter').value;
            searchBaselineMonsters(query, source);
        }
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
    
    // Check for imports in URL
    checkForImport();
    checkForMonsterImport();
});

// Check for encounter import in URL
function checkForImport() {
    const encounter = Storage.importEncounterFromURL();
    if (encounter) {
        setImportingEncounter(encounter);
        
        // Show import modal with encounter info
        const pcCount = encounter.pcs?.length || 0;
        const monsterCount = encounter.monsters?.length || 0;
        
        document.getElementById('import-encounter-info').innerHTML = `
            <strong>${encounter.title}</strong><br>
            ${encounter.description ? `<em>${encounter.description}</em><br>` : ''}
            ${pcCount} PC${pcCount !== 1 ? 's' : ''}, ${monsterCount} monster${monsterCount !== 1 ? 's' : ''}
        `;
        
        document.getElementById('import-modal').classList.add('active');
    }
}

// Check for monster import in URL
function checkForMonsterImport() {
    const monster = CustomMonsters.importMonsterFromURL();
    if (monster) {
        setImportingMonster(monster);
        
        // Show import modal with monster info
        const hp = MonsterAPI.getHP(monster);
        const ac = MonsterAPI.getAC(monster);
        const cr = MonsterAPI.formatCR(monster.cr);
        
        document.getElementById('import-monster-info').innerHTML = `
            <strong>${monster.name}</strong><br>
            CR ${cr} | AC ${ac} | HP ${hp}
        `;
        
        document.getElementById('import-monster-modal').classList.add('active');
    }
}

// Search for monsters to use as baseline
async function searchBaselineMonsters(query, source) {
    const resultsContainer = document.getElementById('baseline-search-results');
    
    if (query.length < 2) {
        resultsContainer.innerHTML = '<p class="search-hint">Type at least 2 characters to search</p>';
        return;
    }

    resultsContainer.innerHTML = '<p class="search-hint">Searching...</p>';

    // Get results from both custom monsters and API
    const customResults = source === 'Custom' || !source ? CustomMonsters.searchCustomMonsters(query) : [];
    
    let apiResults = [];
    if (source !== 'Custom') {
        apiResults = await MonsterAPI.searchMonsters(query, source);
    }

    // Combine results, custom monsters first
    const results = [...customResults, ...apiResults].slice(0, 20);

    if (results.length === 0) {
        resultsContainer.innerHTML = '<p class="search-hint">No monsters found</p>';
        return;
    }

    resultsContainer.innerHTML = results.map(monster => {
        const isCustom = monster.isCustom || monster.source === 'Custom';
        return `
            <div class="search-result-item" data-id="${monster.id || ''}" data-name="${monster.name}" data-source="${monster.source}">
                <span class="monster-name">${monster.name}</span>
                <span class="monster-source">${isCustom ? 'Custom' : monster.source}</span>
            </div>
        `;
    }).join('');

    // Add click handlers
    resultsContainer.querySelectorAll('.search-result-item').forEach(item => {
        item.addEventListener('click', async () => {
            const id = item.dataset.id;
            const name = item.dataset.name;
            const source = item.dataset.source;
            
            let monster;
            if (source === 'Custom' && id) {
                monster = CustomMonsters.getCustomMonster(id);
            } else {
                monster = await MonsterAPI.getMonster(name, source);
            }
            
            if (monster) {
                closeModals();
                CustomMonsterEdit.initFromBaseline(monster);
            }
        });
    });
}

// Reset initialization state (for testing)
export function resetForTests() {
    initialized = false;
}
