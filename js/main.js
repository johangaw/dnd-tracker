// D&D Encounter Tracker - Main Application Entry Point

import * as Storage from './services/storage.js';
import * as MonsterAPI from './services/monsterApi.js';
import * as CustomMonsters from './services/customMonsters.js';
import * as Characters from './services/characters.js';
import { getState, setView, setMonsterQuantity, setImportingEncounter, setImportingMonster, setImportingCharacter, setCharacterEditSource } from './services/state.js';
import { closeModals, showToast } from './utils/helpers.js';
import * as Router from './utils/router.js';

// Hide app menu
function hideAppMenu() {
    document.getElementById('app-menu')?.classList.add('hidden');
}

import * as EncounterList from './components/encounter-list-view/index.js';
import * as EncounterEdit from './components/encounter-edit-view/index.js';
import './components/encounter-run-view/index.js';
import * as CustomMonsterList from './components/custom-monsters-view/index.js';
import * as CustomMonsterEdit from './components/custom-monster-edit-view/index.js';
import * as CharacterList from './components/characters-view/index.js';
import * as CharacterView from './components/character-view/index.js';
import * as CharacterEdit from './components/character-edit-view/index.js';
import { showSpellModal, closeSpellModal, initSpellModal } from './components/modals/spellModal.js';

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
            Router.navigateToList('encounters');
        } else if (state.currentView === 'encounter-run') {
            if (confirm('End combat and return to encounter list?')) {
                Router.navigateToList('encounters');
            }
        } else if (state.currentView === 'custom-monsters') {
            Router.navigateToList('encounters');
        } else if (state.currentView === 'custom-monster-edit') {
            Router.navigateToList('monsters');
        } else if (state.currentView === 'characters') {
            Router.navigateToList('encounters');
        } else if (state.currentView === 'character-view') {
            Router.navigateToList('characters');
        } else if (state.currentView === 'character-edit') {
            // Go back based on where we entered from
            const routeInfo = Router.parseHash();
            if (state.characterEditSource === 'view' && routeInfo.id) {
                // Came from character view, go back to view
                Router.navigateToItem('characters', routeInfo.id);
            } else {
                // Came from list or direct URL, go back to list
                Router.navigateToList('characters');
            }
        }
    });

    // New encounter button - show choice modal
    document.getElementById('new-encounter-btn').addEventListener('click', () => {
        document.getElementById('add-encounter-choice-modal').classList.add('active');
    });

    // Encounter choice modal - Create New
    document.getElementById('encounter-choice-create-new').addEventListener('click', () => {
        closeModals();
        EncounterEdit.render();
    });

    // Encounter choice modal - Import JSON
    document.getElementById('encounter-choice-import-json').addEventListener('click', () => {
        closeModals();
        document.getElementById('import-encounter-json-input').value = '';
        document.getElementById('import-encounter-json-error').classList.add('hidden');
        document.getElementById('import-encounter-json-modal').classList.add('active');
    });

    // Import Encounter JSON Modal - Cancel
    document.getElementById('import-encounter-json-cancel-btn').addEventListener('click', () => {
        closeModals();
    });

    // Import Encounter JSON Modal - Confirm
    document.getElementById('import-encounter-json-confirm-btn').addEventListener('click', () => {
        const jsonInput = document.getElementById('import-encounter-json-input').value.trim();
        const errorEl = document.getElementById('import-encounter-json-error');
        
        if (!jsonInput) {
            errorEl.textContent = 'Please enter JSON data';
            errorEl.classList.remove('hidden');
            return;
        }
        
        try {
            const encounter = Storage.importEncounterFromJSON(jsonInput);
            Storage.saveEncounter(encounter);
            closeModals();
            EncounterList.render();
            showToast(`Imported "${encounter.title}"`);
        } catch (e) {
            errorEl.textContent = e.message;
            errorEl.classList.remove('hidden');
        }
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

    // === Main Navigation ===
    function updateNavSelection(selectedKey) {
        document.querySelectorAll('.nav-item').forEach((navItem) => {
            const isActive = navItem.dataset.nav === selectedKey;
            navItem.classList.toggle('active', isActive);
            navItem.setAttribute('aria-current', isActive ? 'page' : 'false');
        });
    }

    document.querySelectorAll('.nav-item').forEach((navItem) => {
        navItem.addEventListener('click', () => {
            const target = navItem.dataset.nav;
            if (target === 'encounters') {
                Router.navigateToList('encounters');
            } else if (target === 'characters') {
                Router.navigateToList('characters');
            } else if (target === 'custom-monsters') {
                Router.navigateToList('monsters');
            }
            updateNavSelection(target);
        });
    });

    document.getElementById('menu-btn')?.addEventListener('click', (e) => {
        e.stopPropagation();
        const menu = document.getElementById('app-menu');
        menu?.classList.toggle('hidden');
    });

    document.getElementById('menu-encounters')?.addEventListener('click', () => {
        Router.navigateToList('encounters');
    });

    document.getElementById('menu-custom-monsters')?.addEventListener('click', () => {
        Router.navigateToList('monsters');
    });

    document.getElementById('menu-characters')?.addEventListener('click', () => {
        Router.navigateToList('characters');
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

    // Close modals via close button or backdrop click — only affect the target modal
    document.querySelectorAll('.close-modal').forEach(btn => {
        if (btn.closest('#spell-modal')) return; // Skip spell modal
        btn.addEventListener('click', (e) => {
            const modal = btn.closest('.modal');
            if (modal) modal.classList.remove('active');
        });
    });

    // Close modal on backdrop click (only the clicked modal)
    document.querySelectorAll('.modal').forEach(modal => {
        if (modal.id === 'spell-modal') return; // Skip spell modal
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.classList.remove('active');
            }
        });
    });

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            // Close spell modal first if it's open, otherwise close other modals
            const spellModal = document.getElementById('spell-modal');
            if (spellModal?.classList.contains('active')) {
                closeSpellModal();
            } else {
                closeModals();
            }
        }
    });
}

// Handle route changes
function handleRoute() {
    const routeInfo = Router.parseHash();
    const view = Router.getViewForRoute(routeInfo);
    
    // Handle "new" routes first
    if (routeInfo.view === 'new') {
        switch (routeInfo.type) {
            case 'characters':
                const state = getState();
                if (state.characterEditSource !== 'list') {
                    setCharacterEditSource('list');
                }
                CharacterEdit.init();
                break;
            default:
                // Unsupported "new" route, go to list
                Router.navigateToList(routeInfo.type, true);
        }
        return;
    }
    
    // Handle item/edit routes (need to load specific item)
    if (Router.isItemRoute(routeInfo)) {
        switch (routeInfo.type) {
            case 'encounters':
                const encounter = Storage.getEncounter(routeInfo.id);
                if (encounter) {
                    EncounterEdit.render(encounter);
                } else {
                    // Encounter not found, go to list
                    Router.navigateToList('encounters', true);
                }
                break;
            case 'monsters':
                const monster = CustomMonsters.getCustomMonster(routeInfo.id);
                if (monster) {
                    CustomMonsterEdit.init(monster);
                } else {
                    // Monster not found, go to list
                    Router.navigateToList('monsters', true);
                }
                break;
            case 'characters':
                const character = Characters.getCharacter(routeInfo.id);
                if (character) {
                    // Check if this is an edit route or view route
                    if (routeInfo.view === 'edit') {
                        // Only set source to 'list' if not already set to 'view'
                        // (edit button sets it to 'view' before navigation)
                        const state = getState();
                        if (state.characterEditSource !== 'view') {
                            setCharacterEditSource('list');
                        }
                        CharacterEdit.init(character);
                    } else {
                        // Reset edit source when viewing character
                        setCharacterEditSource(null);
                        setView('character-view');
                        CharacterView.render(routeInfo.id);
                    }
                } else {
                    // Character not found, go to list
                    Router.navigateToList('characters', true);
                }
                break;
        }
    } else {
        // Handle list routes
        switch (routeInfo.type) {
            case 'encounters':
                setView('encounter-list');
                EncounterList.render();
                break;
            case 'monsters':
                setView('custom-monsters');
                CustomMonsterList.render();
                break;
            case 'characters':
                // Reset edit source when viewing character list
                setCharacterEditSource(null);
                setView('characters');
                CharacterList.render();
                break;
        }
    }
}

// Initialize App
document.addEventListener('DOMContentLoaded', () => {
    initEventHandlers();
    
    // Initialize spell modal (separate close handling)
    initSpellModal();
    
    // Preload monster index
    MonsterAPI.loadIndex();
    
    // Handle initial route first (so the correct view is shown behind any import modal)
    handleRoute();
    
    // Then check for imports in URL (query params) and show modals on top
    checkForImport();
    checkForMonsterImport();
    checkForCharacterImport();
    
    // Listen for hash changes
    window.addEventListener('hashchange', handleRoute);
    
    // Delegated click handler for spell links (in spell descriptions and character view)
    document.addEventListener('click', (e) => {
        const spellLink = e.target.closest('.spell-link, a[data-spell]');
        if (spellLink) {
            e.preventDefault();
            const spellName = spellLink.dataset.spell;
            if (spellName) {
                showSpellModal(spellName);
            }
        }
    });
});

// Expose showSpellModal globally for use by other components
window.showSpellModal = showSpellModal;

// Check for encounter import in URL
async function checkForImport() {
    const encounter = await Storage.importEncounterFromURL();
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
        return true;
    }
    return false;
}

// Check for monster import in URL
async function checkForMonsterImport() {
    const monster = await CustomMonsters.importMonsterFromURL();
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
        return true;
    }
    return false;
}

// Check for character import in URL
async function checkForCharacterImport() {
    const character = await Characters.importCharacterFromURL();
    if (character) {
        setImportingCharacter(character);
        
        // Show import modal with character info
        const level = character.level || 1;
        const charClass = character.class || 'Unknown';
        
        document.getElementById('character-import-preview').innerHTML = `
            <strong>${character.name}</strong><br>
            Level ${level} ${charClass}
        `;
        
        document.getElementById('character-import-modal').classList.add('active');
        return true;
    }
    return false;
}

// Reset initialization state (for testing)
export function resetForTests() {
    initialized = false;
}
