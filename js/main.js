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
import * as Settings from './components/settings-view/index.js';
import { showSpellModal, closeSpellModal, isSpellModalActive } from './components/modals/spellModal.js';
// Modals shared across multiple views live here; view-exclusive modals are
// imported by the view component that owns them (encounter-run-view,
// encounter-list-view, custom-monsters-view).
import './components/modals/stat-block-modal/index.js';
import './components/modals/spell-modal/index.js';
import './components/modals/hp-modal/index.js';

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
        document.querySelector('add-encounter-choice-modal').open();
    });

    // Encounter choice modal - Create New / Import JSON
    document.querySelector('add-encounter-choice-modal').onCreateNew(() => {
        closeModals();
        EncounterEdit.render();
    });
    document.querySelector('add-encounter-choice-modal').onImportJson(() => {
        closeModals();
        document.querySelector('import-encounter-json-modal').open();
    });

    // Import Encounter JSON Modal - Cancel / Confirm
    document.querySelector('import-encounter-json-modal').onCancel(() => {
        closeModals();
    });
    document.querySelector('import-encounter-json-modal').onConfirm((jsonInput) => {
        const modal = document.querySelector('import-encounter-json-modal');

        if (!jsonInput) {
            modal.showError('Please enter JSON data');
            return;
        }

        try {
            const encounter = Storage.importEncounterFromJSON(jsonInput);
            Storage.saveEncounter(encounter);
            closeModals();
            EncounterList.render();
            showToast(`Imported "${encounter.title}"`);
        } catch (e) {
            modal.showError(e.message);
        }
    });

    // Import encounter buttons
    document.querySelector('import-modal').onCancel(() => {
        Storage.clearImportParam();
        closeModals();
    });
    document.querySelector('import-modal').onConfirm(() => {
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
            } else if (target === 'settings') {
                Router.navigateToList('settings');
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

    document.getElementById('menu-settings')?.addEventListener('click', () => {
        Router.navigateToList('settings');
    });

    // === Import Monster from URL Modal ===
    document.querySelector('import-monster-modal').onCancel(() => {
        CustomMonsters.clearMonsterImportParam();
        closeModals();
    });

    document.querySelector('import-monster-modal').onConfirm(() => {
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

    // Note: close button / backdrop-click handling for every top-level modal
    // is self-managed by each modal's own web component.

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            // Close spell modal first if it's open, otherwise close other modals
            if (isSpellModalActive()) {
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
            case 'settings':
                setView('settings');
                Settings.render();
                break;
        }
    }
}

// Initialize App
document.addEventListener('DOMContentLoaded', () => {
    initEventHandlers();

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

        document.querySelector('import-modal').open(`
            <strong>${encounter.title}</strong><br>
            ${encounter.description ? `<em>${encounter.description}</em><br>` : ''}
            ${pcCount} PC${pcCount !== 1 ? 's' : ''}, ${monsterCount} monster${monsterCount !== 1 ? 's' : ''}
        `);
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

        document.querySelector('import-monster-modal').open(`
            <strong>${monster.name}</strong><br>
            CR ${cr} | AC ${ac} | HP ${hp}
        `);
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
