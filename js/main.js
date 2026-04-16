// D&D Encounter Tracker - Main Application Entry Point

import * as Storage from './services/storage.js';
import * as MonsterAPI from './services/monsterApi.js';
import * as CustomMonsters from './services/customMonsters.js';
import * as Characters from './services/characters.js';
import { getState, setView, setMonsterQuantity, setImportingEncounter, setImportingMonster, setImportingCharacter, setCharacterEditSource } from './services/state.js';
import { closeModals, hideContextMenu, showToast } from './utils/helpers.js';
import * as Router from './utils/router.js';

// Hide app menu
function hideAppMenu() {
    document.getElementById('app-menu')?.classList.add('hidden');
}

import * as EncounterList from './components/encounterList/index.js';
import * as EncounterEdit from './components/encounterEdit/index.js';
import * as CombatTracker from './components/combatTracker/index.js';
import * as CustomMonsterList from './components/customMonsters/list.js';
import * as CustomMonsterEdit from './components/customMonsters/edit.js';
import * as CharacterList from './components/characters/list.js';
import * as CharacterView from './components/characters/view.js';
import * as CharacterEdit from './components/characters/edit.js';
import { showStatBlock } from './components/modals/statBlock.js';

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
        EncounterEdit.init();
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
        Router.navigateToList('encounters');
    });

    // Delete encounter button
    document.getElementById('delete-encounter-btn').addEventListener('click', () => {
        const state = getState();
        if (confirm('Delete this encounter?')) {
            Storage.deleteEncounter(state.editingEncounter.id);
            Router.navigateToList('encounters');
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
                    Router.navigateToItem('encounters', encounterId);
                    break;
                case 'copy':
                    const copy = JSON.parse(JSON.stringify(encounter));
                    copy.id = Date.now().toString();
                    copy.title = `${copy.title} (Copy)`;
                    Storage.saveEncounter(copy);
                    EncounterList.render();
                    break;
                case 'copy-json':
                    const jsonStr = Storage.exportEncounterToJSON(encounter);
                    navigator.clipboard.writeText(jsonStr).then(() => {
                        showToast('Encounter JSON copied to clipboard!');
                    }).catch(() => {
                        prompt('Copy this JSON:', jsonStr);
                    });
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
    // Works for both monsters (CombatTracker) and characters
    document.querySelectorAll('.hp-controls .hp-adj-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const amount = parseInt(btn.dataset.amount);
            if (window.isCharacterHpModalActive && window.isCharacterHpModalActive()) {
                window.addToCharacterHPDelta(amount);
            } else {
                CombatTracker.addToHPDelta(amount);
            }
        });
    });

    // HP custom amount input - update preview on change
    document.getElementById('hp-custom-amount').addEventListener('input', () => {
        if (window.isCharacterHpModalActive && window.isCharacterHpModalActive()) {
            window.updateCharacterHPPreview();
        } else {
            CombatTracker.updateHPPreview();
        }
    });

    document.getElementById('hp-reset-btn').addEventListener('click', () => {
        CombatTracker.resetHPDelta();
        // Reset also clears preview for character mode
        if (window.isCharacterHpModalActive && window.isCharacterHpModalActive()) {
            document.getElementById('hp-preview').classList.add('hidden');
            document.getElementById('hp-custom-amount').classList.remove('damage', 'heal');
        }
    });

    document.getElementById('hp-apply-btn').addEventListener('click', () => {
        if (window.isCharacterHpModalActive && window.isCharacterHpModalActive()) {
            window.saveCharacterHP();
        } else {
            CombatTracker.applyHPDelta();
        }
    });

    // Allow Enter key in HP input to apply
    document.getElementById('hp-custom-amount').addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            if (window.isCharacterHpModalActive && window.isCharacterHpModalActive()) {
                window.saveCharacterHP();
            } else {
                CombatTracker.applyHPDelta();
            }
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

    document.getElementById('menu-encounters')?.addEventListener('click', () => {
        hideAppMenu();
        Router.navigateToList('encounters');
    });

    document.getElementById('menu-custom-monsters')?.addEventListener('click', () => {
        hideAppMenu();
        Router.navigateToList('monsters');
    });

    document.getElementById('menu-characters')?.addEventListener('click', () => {
        hideAppMenu();
        Router.navigateToList('characters');
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
                case 'view-stats':
                    showStatBlock(monster);
                    break;
                case 'edit':
                    Router.navigateToItem('monsters', monsterId);
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

    // === Character Events ===
    
    // New character button - show choice modal
    document.getElementById('new-character-btn')?.addEventListener('click', () => {
        document.getElementById('add-character-choice-modal').classList.add('active');
    });

    // Character choice modal - Create New
    document.getElementById('character-choice-create-new')?.addEventListener('click', () => {
        closeModals();
        setCharacterEditSource('list');
        Router.navigateToNew('characters');
    });

    // Character choice modal - Import JSON
    document.getElementById('character-choice-import-json')?.addEventListener('click', () => {
        closeModals();
        document.getElementById('import-character-json-input').value = '';
        document.getElementById('import-character-json-error').classList.add('hidden');
        document.getElementById('import-character-json-modal').classList.add('active');
    });

    // Import Character JSON Modal - Cancel
    document.getElementById('import-character-json-cancel-btn')?.addEventListener('click', () => {
        closeModals();
    });

    // Import Character JSON Modal - Confirm
    document.getElementById('import-character-json-confirm-btn')?.addEventListener('click', () => {
        const jsonInput = document.getElementById('import-character-json-input').value.trim();
        const errorEl = document.getElementById('import-character-json-error');
        
        if (!jsonInput) {
            errorEl.textContent = 'Please enter JSON data or a share link';
            errorEl.classList.remove('hidden');
            return;
        }
        
        try {
            let character;
            
            // Check if input is a URL (share link)
            if (jsonInput.startsWith('http://') || jsonInput.startsWith('https://')) {
                // Extract the base64 data from the URL
                const url = new URL(jsonInput);
                const encoded = url.searchParams.get('importCharacter');
                if (!encoded) {
                    throw new Error('Invalid share link - no character data found');
                }
                // URL uses btoa(encodeURIComponent(json)), so decode with decodeURIComponent(atob())
                const jsonStr = decodeURIComponent(atob(encoded));
                character = Characters.importCharacterFromJSON(jsonStr);
            } else {
                // Treat as raw JSON
                character = Characters.importCharacterFromJSON(jsonInput);
            }
            
            Characters.saveCharacter(character);
            closeModals();
            CharacterList.render();
            showToast(`Imported "${character.name}"`);
        } catch (e) {
            errorEl.textContent = e.message;
            errorEl.classList.remove('hidden');
        }
    });

    // Character URL Import Modal - Cancel
    document.getElementById('character-import-cancel-btn')?.addEventListener('click', () => {
        Characters.clearCharacterImportParam();
        closeModals();
    });

    // Character URL Import Modal - Confirm
    document.getElementById('character-import-confirm-btn')?.addEventListener('click', () => {
        const state = getState();
        if (state.importingCharacter) {
            const character = state.importingCharacter;
            Characters.saveCharacter(character);
            Characters.clearCharacterImportParam();
            setImportingCharacter(null);
            closeModals();
            CharacterList.render();
            showToast(`Imported "${character.name}"`);
        }
    });

    // Character view edit button
    document.getElementById('character-view-edit')?.addEventListener('click', () => {
        const characterId = CharacterView.getCurrentCharacterId();
        if (characterId) {
            // Track that we're coming from character view
            setCharacterEditSource('view');
            Router.navigateToItem('characters', characterId, 'edit');
        }
    });

    // Character view long rest button
    document.getElementById('long-rest-btn')?.addEventListener('click', () => {
        CharacterView.performLongRest();
    });

    // Character form submit
    document.getElementById('character-form')?.addEventListener('submit', (e) => {
        e.preventDefault();
        const savedCharacter = CharacterEdit.saveCharacter();
        if (savedCharacter) {
            // Navigate based on where we came from
            const state = getState();
            if (state.characterEditSource === 'view') {
                Router.navigateToItem('characters', savedCharacter.id);
            } else {
                Router.navigateToList('characters');
            }
        }
    });

    // Cancel character edit
    document.getElementById('cancel-character-btn')?.addEventListener('click', () => {
        const state = getState();
        const routeInfo = Router.parseHash();
        if (state.characterEditSource === 'view' && routeInfo.id) {
            Router.navigateToItem('characters', routeInfo.id);
        } else {
            Router.navigateToList('characters');
        }
    });

    // Delete character button
    document.getElementById('delete-character-btn')?.addEventListener('click', () => {
        if (CharacterEdit.deleteCharacter()) {
            // Always go to list after delete
            Router.navigateToList('characters');
        }
    });

    // Character level change - update proficiency
    document.getElementById('char-level')?.addEventListener('change', () => {
        CharacterEdit.updateProficiencyDisplay();
    });

    // Character class change - update subclass suggestions
    document.getElementById('char-class')?.addEventListener('input', () => {
        CharacterEdit.updateSubclassSuggestions();
    });

    // Ability score changes - update modifiers
    Characters.ABILITIES.forEach(ability => {
        document.getElementById(`char-${ability}`)?.addEventListener('change', () => {
            CharacterEdit.updateAbilityModifiers();
        });
    });

    // Add buttons for character edit
    document.getElementById('add-feature-btn')?.addEventListener('click', () => {
        CharacterEdit.addFeature();
    });

    document.getElementById('add-equipment-btn')?.addEventListener('click', () => {
        CharacterEdit.addEquipment();
    });

    document.getElementById('add-attack-btn')?.addEventListener('click', () => {
        CharacterEdit.addAttack();
    });

    document.getElementById('add-tracker-btn')?.addEventListener('click', () => {
        CharacterEdit.addTracker();
    });

    // Spell Picker Modal
    document.getElementById('spell-search-input')?.addEventListener('input', () => {
        CharacterEdit.renderSpellPickerResults();
    });

    document.getElementById('spell-level-filter')?.addEventListener('change', () => {
        CharacterEdit.renderSpellPickerResults();
    });

    document.getElementById('spell-school-filter')?.addEventListener('change', () => {
        CharacterEdit.renderSpellPickerResults();
    });

    document.getElementById('spell-class-filter-toggle')?.addEventListener('change', () => {
        CharacterEdit.renderSpellPickerResults();
    });

    document.getElementById('spell-picker-modal')?.querySelector('.close-modal')?.addEventListener('click', () => {
        CharacterEdit.closeSpellPicker();
    });

    // Character HP Modal - uses shared #hp-modal
    let characterHpModalCharacterId = null;
    let characterHpModalCurrentHp = 0;
    let characterHpModalTempHp = 0;
    let characterHpModalEffectiveMax = 0;

    function openCharacterHpModal(characterId) {
        const character = Characters.getCharacter(characterId);
        if (!character) return;

        characterHpModalCharacterId = characterId;
        const modal = document.getElementById('hp-modal');
        const characterFields = document.getElementById('hp-character-fields');
        const instanceSelector = document.getElementById('hp-instance-selector');
        const tempDisplay = document.getElementById('hp-temp-display');
        
        // Calculate effective max HP
        characterHpModalEffectiveMax = Characters.getEffectiveMaxHp(character);
        characterHpModalCurrentHp = character.hitPointsCurrent ?? 0;
        characterHpModalTempHp = character.hitPointsTemp || 0;

        // Set up modal for character mode
        document.getElementById('hp-modal-title').textContent = `${character.name} - HP`;
        document.getElementById('current-hp').textContent = characterHpModalCurrentHp;
        document.getElementById('max-hp').textContent = characterHpModalEffectiveMax;
        document.getElementById('hp-custom-amount').value = '0';
        
        // Show temp HP in display if present
        if (characterHpModalTempHp > 0) {
            document.getElementById('hp-temp-value').textContent = characterHpModalTempHp;
            tempDisplay.classList.remove('hidden');
        } else {
            tempDisplay.classList.add('hidden');
        }
        
        // Show character-specific fields
        characterFields.classList.remove('hidden');
        document.getElementById('hp-temp-input').value = characterHpModalTempHp;
        document.getElementById('hp-max-reduction').value = character.hitPointsMaxReduction || 0;
        
        // Hide instance selector (not used for characters)
        instanceSelector.classList.add('hidden');
        
        // Hide HP preview initially
        document.getElementById('hp-preview').classList.add('hidden');
        
        // Update HP display styling
        updateCharacterHPDisplayStyle();

        modal.classList.add('active');
    }
    
    function updateCharacterHPDisplayStyle() {
        const display = document.querySelector('#hp-modal .hp-display');
        const percent = characterHpModalCurrentHp / characterHpModalEffectiveMax;
        display.classList.remove('low', 'critical');
        if (percent <= 0.25) display.classList.add('critical');
        else if (percent <= 0.5) display.classList.add('low');
    }
    
    function updateCharacterHPDisplay() {
        document.getElementById('current-hp').textContent = characterHpModalCurrentHp;
        document.getElementById('max-hp').textContent = characterHpModalEffectiveMax;
        
        // Update temp HP display
        const tempDisplay = document.getElementById('hp-temp-display');
        if (characterHpModalTempHp > 0) {
            document.getElementById('hp-temp-value').textContent = characterHpModalTempHp;
            tempDisplay.classList.remove('hidden');
        } else {
            tempDisplay.classList.add('hidden');
        }
        
        // Also update the input field
        document.getElementById('hp-temp-input').value = characterHpModalTempHp;
        
        updateCharacterHPDisplayStyle();
    }
    
    function isCharacterHpModalActive() {
        return characterHpModalCharacterId !== null;
    }

    // Update effective max display when reduction changes
    document.getElementById('hp-max-reduction')?.addEventListener('input', () => {
        if (!isCharacterHpModalActive()) return;
        const character = Characters.getCharacter(characterHpModalCharacterId);
        if (!character) return;

        const reduction = parseInt(document.getElementById('hp-max-reduction').value) || 0;
        characterHpModalEffectiveMax = Math.max(0, (character.hitPointsMax || 0) - reduction);
        
        // Cap current HP at effective max
        if (characterHpModalCurrentHp > characterHpModalEffectiveMax) {
            characterHpModalCurrentHp = characterHpModalEffectiveMax;
        }
        
        updateCharacterHPDisplay();
    });
    
    // Update temp HP when input changes
    document.getElementById('hp-temp-input')?.addEventListener('input', () => {
        if (!isCharacterHpModalActive()) return;
        characterHpModalTempHp = parseInt(document.getElementById('hp-temp-input').value) || 0;
        updateCharacterHPDisplay();
    });

    // Apply HP delta for character (handles temp HP for damage)
    function applyCharacterHPDelta() {
        if (!isCharacterHpModalActive()) return;
        
        const input = document.getElementById('hp-custom-amount');
        const delta = parseInt(input.value) || 0;
        
        if (delta === 0) return;
        
        if (delta < 0) {
            // Damage: reduce temp HP first, then current
            let damage = Math.abs(delta);
            if (characterHpModalTempHp > 0) {
                const tempDamage = Math.min(characterHpModalTempHp, damage);
                characterHpModalTempHp -= tempDamage;
                damage -= tempDamage;
            }
            characterHpModalCurrentHp = Math.max(0, characterHpModalCurrentHp - damage);
        } else {
            // Healing: increase current HP up to effective max (doesn't affect temp HP)
            characterHpModalCurrentHp = Math.min(characterHpModalEffectiveMax, characterHpModalCurrentHp + delta);
        }
        
        updateCharacterHPDisplay();
        input.value = '0';
        document.getElementById('hp-preview').classList.add('hidden');
        input.classList.remove('damage', 'heal');
    }
    
    // Add to HP delta for character (just updates input and preview)
    function addToCharacterHPDelta(amount) {
        const input = document.getElementById('hp-custom-amount');
        const currentValue = parseInt(input.value) || 0;
        input.value = currentValue + amount;
        updateCharacterHPPreview();
    }
    
    // Update HP preview for character
    function updateCharacterHPPreview() {
        const input = document.getElementById('hp-custom-amount');
        const preview = document.getElementById('hp-preview');
        const previewValue = document.getElementById('hp-preview-value');
        
        const delta = parseInt(input.value) || 0;
        
        if (delta === 0) {
            preview.classList.add('hidden');
            input.classList.remove('damage', 'heal');
            return;
        }
        
        preview.classList.remove('hidden');
        input.classList.remove('damage', 'heal');
        input.classList.add(delta < 0 ? 'damage' : 'heal');
        
        // Calculate preview considering temp HP for damage
        let previewHp;
        if (delta < 0) {
            let damage = Math.abs(delta);
            let tempRemaining = characterHpModalTempHp;
            if (tempRemaining > 0) {
                const tempDamage = Math.min(tempRemaining, damage);
                damage -= tempDamage;
            }
            previewHp = Math.max(0, characterHpModalCurrentHp - damage);
        } else {
            previewHp = Math.min(characterHpModalEffectiveMax, characterHpModalCurrentHp + delta);
        }
        
        previewValue.textContent = previewHp;
        previewValue.classList.toggle('dead', previewHp <= 0);
    }
    
    // Save character HP and close modal
    function saveCharacterHP() {
        if (!isCharacterHpModalActive()) return;

        const character = Characters.getCharacter(characterHpModalCharacterId);
        if (!character) return;
        
        // Save the character ID before closeModals resets it
        const characterId = characterHpModalCharacterId;
        
        // Apply any pending HP delta before saving
        const input = document.getElementById('hp-custom-amount');
        const delta = parseInt(input.value) || 0;
        
        if (delta !== 0) {
            if (delta < 0) {
                // Damage: reduce temp HP first, then current
                let damage = Math.abs(delta);
                if (characterHpModalTempHp > 0) {
                    const tempDamage = Math.min(characterHpModalTempHp, damage);
                    characterHpModalTempHp -= tempDamage;
                    damage -= tempDamage;
                }
                characterHpModalCurrentHp = Math.max(0, characterHpModalCurrentHp - damage);
            } else {
                // Healing: increase current HP up to effective max
                characterHpModalCurrentHp = Math.min(characterHpModalEffectiveMax, characterHpModalCurrentHp + delta);
            }
        }

        character.hitPointsCurrent = characterHpModalCurrentHp;
        character.hitPointsTemp = characterHpModalTempHp;
        character.hitPointsMaxReduction = parseInt(document.getElementById('hp-max-reduction').value) || 0;

        Characters.saveCharacter(character);
        closeModals();
        
        // Refresh the character view if we're on it
        const currentState = getState();
        if (currentState.currentView === 'character-view') {
            CharacterView.render(characterId);
        }

        showToast('HP updated');
    }
    
    // Reset character HP modal on close
    function resetCharacterHpModal() {
        characterHpModalCharacterId = null;
        characterHpModalCurrentHp = 0;
        characterHpModalTempHp = 0;
        characterHpModalEffectiveMax = 0;
        
        // Hide character-specific fields
        document.getElementById('hp-character-fields')?.classList.add('hidden');
        document.getElementById('hp-temp-display')?.classList.add('hidden');
    }

    // Expose openCharacterHpModal for use by CharacterView
    window.openCharacterHpModal = openCharacterHpModal;
    
    // Expose character HP functions for the shared HP modal handlers
    window.isCharacterHpModalActive = isCharacterHpModalActive;
    window.applyCharacterHPDelta = applyCharacterHPDelta;
    window.addToCharacterHPDelta = addToCharacterHPDelta;
    window.updateCharacterHPPreview = updateCharacterHPPreview;
    window.saveCharacterHP = saveCharacterHP;
    window.resetCharacterHpModal = resetCharacterHpModal;

    // Money Management Modal
    let moneyModalCharacterId = null;

    function openMoneyModal(characterId) {
        const character = Characters.getCharacter(characterId);
        if (!character) return;

        moneyModalCharacterId = characterId;
        const modal = document.getElementById('money-modal');

        // Display current money
        document.getElementById('money-current-pp').textContent = character.platinumPieces || 0;
        document.getElementById('money-current-gp').textContent = character.goldPieces || 0;
        document.getElementById('money-current-ep').textContent = character.electrumPieces || 0;
        document.getElementById('money-current-sp').textContent = character.silverPieces || 0;
        document.getElementById('money-current-cp').textContent = character.copperPieces || 0;

        // Clear all currency inputs
        document.getElementById('money-input-pp').value = '';
        document.getElementById('money-input-gp').value = '';
        document.getElementById('money-input-ep').value = '';
        document.getElementById('money-input-sp').value = '';
        document.getElementById('money-input-cp').value = '';

        modal.classList.add('active');
    }

    // Expose openMoneyModal for use by CharacterView
    window.openMoneyModal = openMoneyModal;

    // Helper to get amounts from all currency inputs
    function getMoneyInputAmounts() {
        return {
            pp: parseInt(document.getElementById('money-input-pp').value) || 0,
            gp: parseInt(document.getElementById('money-input-gp').value) || 0,
            ep: parseInt(document.getElementById('money-input-ep').value) || 0,
            sp: parseInt(document.getElementById('money-input-sp').value) || 0,
            cp: parseInt(document.getElementById('money-input-cp').value) || 0
        };
    }

    // Helper to check if any amount is entered
    function hasAnyAmount(amounts) {
        return amounts.pp > 0 || amounts.gp > 0 || amounts.ep > 0 || amounts.sp > 0 || amounts.cp > 0;
    }

    // Helper to build transaction message
    function buildMoneyMessage(amounts, verb) {
        const parts = [];
        if (amounts.pp > 0) parts.push(`${amounts.pp} PP`);
        if (amounts.gp > 0) parts.push(`${amounts.gp} GP`);
        if (amounts.ep > 0) parts.push(`${amounts.ep} EP`);
        if (amounts.sp > 0) parts.push(`${amounts.sp} SP`);
        if (amounts.cp > 0) parts.push(`${amounts.cp} CP`);
        return `${verb} ${parts.join(', ')}`;
    }

    const fieldMap = {
        pp: 'platinumPieces',
        gp: 'goldPieces',
        ep: 'electrumPieces',
        sp: 'silverPieces',
        cp: 'copperPieces'
    };

    // Money withdraw button
    document.getElementById('money-withdraw-btn')?.addEventListener('click', () => {
        if (!moneyModalCharacterId) return;
        
        const character = Characters.getCharacter(moneyModalCharacterId);
        if (!character) return;

        const amounts = getMoneyInputAmounts();

        if (!hasAnyAmount(amounts)) {
            showToast('Enter an amount', 'error');
            return;
        }

        // Check if character has enough of each currency
        for (const [currency, amount] of Object.entries(amounts)) {
            if (amount > 0) {
                const field = fieldMap[currency];
                const current = character[field] || 0;
                if (amount > current) {
                    showToast(`Not enough ${currency.toUpperCase()}`, 'error');
                    return;
                }
            }
        }

        // Apply withdrawals
        for (const [currency, amount] of Object.entries(amounts)) {
            if (amount > 0) {
                const field = fieldMap[currency];
                character[field] = (character[field] || 0) - amount;
            }
        }
        
        Characters.saveCharacter(character);
        closeModals();
        
        // Refresh the character view
        const currentState = getState();
        if (currentState.currentView === 'character-view') {
            CharacterView.render(moneyModalCharacterId);
        }

        showToast(buildMoneyMessage(amounts, 'Withdrew'));
        moneyModalCharacterId = null;
    });

    // Money deposit button
    document.getElementById('money-deposit-btn')?.addEventListener('click', () => {
        if (!moneyModalCharacterId) return;
        
        const character = Characters.getCharacter(moneyModalCharacterId);
        if (!character) return;

        const amounts = getMoneyInputAmounts();

        if (!hasAnyAmount(amounts)) {
            showToast('Enter an amount', 'error');
            return;
        }

        // Apply deposits
        for (const [currency, amount] of Object.entries(amounts)) {
            if (amount > 0) {
                const field = fieldMap[currency];
                character[field] = (character[field] || 0) + amount;
            }
        }
        
        Characters.saveCharacter(character);
        closeModals();
        
        // Refresh the character view
        const currentState = getState();
        if (currentState.currentView === 'character-view') {
            CharacterView.render(moneyModalCharacterId);
        }

        showToast(buildMoneyMessage(amounts, 'Deposited'));
        moneyModalCharacterId = null;
    });

    // Collapsible section toggles
    document.querySelectorAll('.form-section.collapsible .section-header').forEach(header => {
        header.addEventListener('click', (e) => {
            // Don't toggle if clicking on a button inside the header
            if (e.target.closest('.add-item-btn')) return;
            
            const section = header.closest('.form-section');
            section.classList.toggle('collapsed');
        });
    });

    // Character context menu actions
    document.querySelectorAll('#character-context-menu .context-item').forEach(item => {
        item.addEventListener('click', () => {
            const menu = document.getElementById('character-context-menu');
            const characterId = menu.dataset.characterId;
            const action = item.dataset.action;
            const character = Characters.getCharacter(characterId);

            if (!character) {
                CharacterList.hideContextMenu();
                return;
            }

            switch (action) {
                case 'view':
                    Router.navigateToItem('characters', characterId);
                    break;
                case 'edit':
                    Router.navigateToItem('characters', characterId, 'edit');
                    break;
                case 'copy':
                    const copy = Characters.duplicateCharacter(character);
                    Characters.saveCharacter(copy);
                    CharacterList.render();
                    showToast(`Duplicated "${character.name}"`);
                    break;
                case 'copy-json':
                    const jsonStr = Characters.exportCharacterToJSON(character);
                    navigator.clipboard.writeText(jsonStr).then(() => {
                        showToast('Character JSON copied to clipboard!');
                    }).catch(() => {
                        prompt('Copy this JSON:', jsonStr);
                    });
                    break;
                case 'share':
                    const url = Characters.exportCharacterToURL(character);
                    navigator.clipboard.writeText(url).then(() => {
                        showToast('Share link copied to clipboard!');
                    }).catch(() => {
                        prompt('Copy this link to share:', url);
                    });
                    break;
                case 'delete':
                    if (confirm(`Delete "${character.name}"?`)) {
                        Characters.deleteCharacter(characterId);
                        CharacterList.render();
                    }
                    break;
            }

            CharacterList.hideContextMenu();
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
                    EncounterEdit.init(encounter);
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
        return true;
    }
    return false;
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
        return true;
    }
    return false;
}

// Check for character import in URL
function checkForCharacterImport() {
    const character = Characters.importCharacterFromURL();
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
