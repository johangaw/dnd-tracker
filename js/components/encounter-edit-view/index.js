// Encounter Edit Component rewritten as a light-DOM WebComponent

import * as Storage from '../../services/storage.js';
import * as MonsterAPI from '../../services/monsterApi.js';
import * as CustomMonsters from '../../services/customMonsters.js';
import { getState, setView, setEditingEncounter, setEditingMonsterIndex } from '../../services/state.js';
import { escapeHtml, closeModals } from '../../utils/helpers.js';
import { showStatBlockByNameSource, showStatBlock } from '../modals/statBlock.js';
import { searchMonsters as searchMonsterModal } from '../modals/monsterSearchModal.js';
import { uuid } from '../../utils/uuid.js';
import { createAutosave, bindFormAutosave } from '../../utils/autosave.js';

class EncounterEditViewElement extends HTMLElement {
    cleanupController = null
    searchTimeout = null
    autosave = createAutosave(() => this.persist())
    // Suppressed while the form is being populated, so painting the existing
    // encounter into the fields is not mistaken for an edit.
    autosaveReady = false

    constructor() {
        super();
    }

    connectedCallback() {
        this.cleanupController = new AbortController()

        // Render the internal structure
        this.innerHTML = `
            <form id="encounter-form" class="form">
                <div class="form-group">
                    <label for="encounter-title">Title</label>
                    <input type="text" id="encounter-title" placeholder="Encounter name..." required>
                </div>
                <div class="form-group">
                    <label for="encounter-description">Description</label>
                    <textarea id="encounter-description" placeholder="Optional description..." rows="3"></textarea>
                </div>

                <!-- PCs Section -->
                <div class="form-section">
                    <div class="section-header">
                        <h3>Player Characters</h3>
                        <button type="button" id="add-pc-btn" class="btn btn-small">+ Add PC</button>
                    </div>
                    <div id="pc-list" class="item-list"></div>
                </div>

                <!-- Monsters Section -->
                <div class="form-section">
                    <div class="section-header">
                        <h3>Monsters</h3>
                        <button type="button" id="add-monster-btn" class="btn btn-small">+ Add Monster</button>
                    </div>
                    <div id="monster-list" class="item-list"></div>
                </div>

                <!-- Combat Settings -->
                <div class="form-section">
                    <div class="section-header">
                        <h3>Combat Settings</h3>
                    </div>
                    <label class="checkbox-label">
                        <input type="checkbox" id="auto-add-monsters">
                        <span>Add all monsters to combat at start</span>
                    </label>
                </div>

                <p id="encounter-title-required" class="error-text hidden">Add a title to save this encounter.</p>
            </form>

            <!-- Monster Search Modal -->
            <div id="monster-search-modal" class="modal">
                <div class="modal-content">
                    <div class="modal-header">
                        <h2>Search Monsters</h2>
                        <button type="button" class="close-modal" aria-label="Close">&times;</button>
                    </div>
                    <div class="modal-body">
                        <div class="search-box">
                            <input type="text" id="monster-search-input" placeholder="Search by name...">
                            <select id="monster-source-filter">
                                <option value="" selected>Default</option>
                                <option value="ALL">All Sources</option>
                                <option value="Custom">Custom Monsters</option>
                                <option value="XMM">Monster Manual (2024)</option>
                                <option value="MM">Monster Manual (2014)</option>
                            </select>
                        </div>
                        <div id="monster-search-results" class="search-results"></div>
                    </div>
                </div>
            </div>

            <!-- DM Notes Modal -->
            <div id="dm-notes-modal" class="modal">
                <div class="modal-content">
                    <div class="modal-header">
                        <h2 id="dm-notes-modal-title">DM Notes</h2>
                        <button type="button" class="close-modal" aria-label="Close">&times;</button>
                    </div>
                    <div class="modal-body">
                        <div class="form-group">
                            <textarea id="dm-notes-input" rows="6" placeholder="Add notes about this monster (tactics, special behaviors, plot hooks, etc.)"></textarea>
                        </div>
                        <button type="button" id="save-dm-notes-btn" class="btn btn-primary" style="width: 100%; margin-top: 12px;">Save Notes</button>
                    </div>
                </div>
            </div>
        `;

        this.setupEventHandlers();
    }

    disconnectedCallback() {
        this.cleanupController.abort()
        clearTimeout(this.searchTimeout)
    }

    setupEventHandlers() {
        const form = this.querySelector('#encounter-form');
        const addPcBtn = this.querySelector('#add-pc-btn');
        const addMonsterBtn = this.querySelector('#add-monster-btn');
        const saveDmNotesBtn = this.querySelector('#save-dm-notes-btn');
        const monsterSearchInput = this.querySelector('#monster-search-input');
        const monsterSourceFilter = this.querySelector('#monster-source-filter');
        const closeModalsButtons = this.querySelectorAll('.close-modal');

        // There is no save button; every edit is persisted as it is made.
        // Enter in a text field still submits the form, so swallow that and
        // treat it as a commit.
        form.addEventListener('submit', (e) => {
            e.preventDefault();
            this.autosave.saveNow();
        }, {signal: this.cleanupController.signal});

        bindFormAutosave(form, this.autosave, this.cleanupController.signal);

        // Add PC button
        addPcBtn.addEventListener('click', () => this.addPC(), {signal: this.cleanupController.signal});

        // Add monster button
        addMonsterBtn.addEventListener('click', () => this.showMonsterSearch(), {signal: this.cleanupController.signal});

        // Monster search input
        monsterSearchInput.addEventListener('input', (e) => {
            clearTimeout(this.searchTimeout);
            this.searchTimeout = setTimeout(() => {
                const source = monsterSourceFilter.value;
                this.searchMonsters(e.target.value, source);
            }, 300);
        }, {signal: this.cleanupController.signal});

        monsterSourceFilter.addEventListener('change', () => {
            const query = monsterSearchInput.value;
            if (query.length >= 2) {
                const source = monsterSourceFilter.value;
                this.searchMonsters(query, source);
            }
        }, {signal: this.cleanupController.signal});

        // Save DM notes button
        saveDmNotesBtn.addEventListener('click', () => this.saveDMNotes(), {signal: this.cleanupController.signal});

        // Close modal buttons
        closeModalsButtons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                closeModals();
            }, {signal: this.cleanupController.signal});
        });
    }

    render(encounter = null) {
        const state = getState();
        this.autosaveReady = false;
        this.autosave.cancel();
        
        const editingEncounter = encounter || {
            id: uuid(),
            title: '',
            description: '',
            pcs: [],
            monsters: [],
            autoAddMonsters: false,
            folderIds: []
        };
        
        setEditingEncounter(editingEncounter);

        this.querySelector('#encounter-title').value = editingEncounter.title;
        this.querySelector('#encounter-description').value = editingEncounter.description || '';
        this.querySelector('#auto-add-monsters').checked = editingEncounter.autoAddMonsters || false;
        
        this.querySelector('#encounter-title-required').classList.add('hidden');

        this.renderPCList();
        this.renderMonsterList();
        setView('encounter-edit');
        this.autosaveReady = true;
    }

    // Persist the encounter as it currently stands. An encounter with no title
    // is not written at all: a title is what identifies it in the list, and a
    // brand new encounter should not appear there the moment it is opened.
    persist() {
        const state = getState();
        const encounter = state.editingEncounter;
        if (!this.autosaveReady || !encounter) return;

        encounter.title = this.querySelector('#encounter-title').value;
        encounter.description = this.querySelector('#encounter-description').value;
        encounter.autoAddMonsters = this.querySelector('#auto-add-monsters').checked;

        const hasTitle = !!encounter.title.trim();
        this.querySelector('#encounter-title-required').classList.toggle('hidden', hasTitle);
        if (!hasTitle) return;

        // PCs are dropped from the stored copy while their name is still blank,
        // but kept in the editing state so a freshly added row does not vanish
        // from under the cursor.
        Storage.saveEncounter({
            ...encounter,
            pcs: (encounter.pcs || []).filter(pc => pc.name.trim())
        });
    }

    renderPCList() {
        const state = getState();
        const container = this.querySelector('#pc-list');
        const pcs = state.editingEncounter.pcs || [];

        container.innerHTML = pcs.map((pc, index) => `
            <div class="item-row" data-index="${index}">
                <input type="text" value="${escapeHtml(pc.name)}" placeholder="Character name..." class="pc-name-input">
                <button type="button" class="remove-btn" data-index="${index}">
                    <svg viewBox="0 0 24 24" width="20" height="20"><path fill="currentColor" d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>
                </button>
            </div>
        `).join('');

        this.autosave.saveNow();

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
                this.renderPCList();
            });
        });
    }

    renderMonsterList() {
        const state = getState();
        const container = this.querySelector('#monster-list');
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

        this.autosave.saveNow();

        // Notes buttons
        container.querySelectorAll('.notes-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const index = parseInt(btn.dataset.index);
                this.showDMNotesModal(index);
            });
        });

        // Stats buttons
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
                this.renderMonsterList();
            });
        });
    }

    addPC() {
        const state = getState();
        state.editingEncounter.pcs.push({ name: '' });
        this.renderPCList();
        // Focus the new input
        const inputs = this.querySelectorAll('.pc-name-input');
        if (inputs.length > 0) {
            inputs[inputs.length - 1].focus();
        }
    }

    showDMNotesModal(monsterIndex) {
        const state = getState();
        setEditingMonsterIndex(monsterIndex);
        const monster = state.editingEncounter.monsters[monsterIndex];
        
        this.querySelector('#dm-notes-modal-title').textContent = `Notes: ${monster.name}`;
        this.querySelector('#dm-notes-input').value = monster.comment || '';
        this.querySelector('#dm-notes-modal').classList.add('active');
        this.querySelector('#dm-notes-input').focus();
    }

    saveDMNotes() {
        const state = getState();
        const notes = this.querySelector('#dm-notes-input').value;
        state.editingEncounter.monsters[state.editingMonsterIndex].comment = notes;
        closeModals();
        this.renderMonsterList();
    }

    async addMonsterToEncounter(name, source, customMonsterId = null) {
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
            customMonsterId: monster.isCustom ? monster.id : undefined,
            comment: ''
        });

        this.renderMonsterList();
        closeModals();
    }

    async searchMonsters(query, source) {
        const results = this.querySelector('#monster-search-results');

        await searchMonsterModal({
            query,
            source,
            container: results,
            emptyMessage: 'No monsters found',
            onSelect: async ({ name, source, id }) => {
                await this.addMonsterToEncounter(name, source, id || null);
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

    showMonsterSearch() {
        this.querySelector('#monster-search-input').value = '';
        this.querySelector('#monster-search-results').innerHTML = 
            '<div class="search-empty">Type to search for monsters...</div>';
        this.querySelector('#monster-search-modal').classList.add('active');
        this.querySelector('#monster-search-input').focus();
    }

    // Called when leaving the view, so a debounced keystroke is not lost.
    flushAutosave() {
        this.autosave.flush();
    }
}

// Register element if not already registered
if (!customElements.get('encounter-edit-view')) {
    customElements.define('encounter-edit-view', EncounterEditViewElement);
}

// Compatibility exports used elsewhere in app
export function render(encounter = null) {
    const el = document.querySelector('encounter-edit-view');
    if (el && typeof el.render === 'function') el.render(encounter);
}

export default {
    render,
};
