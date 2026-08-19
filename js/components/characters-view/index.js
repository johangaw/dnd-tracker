// Characters List Component rewritten as a light-DOM WebComponent

import * as Characters from '../../services/characters.js';
import { getState, setImportingCharacter, setCharacterEditSource } from '../../services/state.js';
import * as Router from '../../utils/router.js';
import { escapeHtml, showToast, closeModals } from '../../utils/helpers.js';
import { decompress, isCompressed, legacyDecode } from '../../utils/compression.js';

class CharactersViewElement extends HTMLElement {
    cleanupController = null

    constructor() {
        super();
    }

    connectedCallback() {
        this.cleanupController = new AbortController()

        // Render the internal structure: list container + new-character button + context menu + modals
        this.innerHTML = `
            <div id="characters-list" class="list"></div>
            <button id="new-character-btn" class="fab" aria-label="New Character">
                <svg viewBox="0 0 24 24" width="24" height="24"><path fill="currentColor" d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg>
            </button>

            <!-- Character Context Menu -->
            <div id="character-context-menu" class="context-menu hidden">
                <button class="context-item" data-action="view">View</button>
                <button class="context-item" data-action="edit">Edit</button>
                <button class="context-item" data-action="copy">Duplicate</button>
                <button class="context-item" data-action="copy-json">Copy JSON</button>
                <button class="context-item" data-action="share">Share Link</button>
                <button class="context-item danger" data-action="delete">Delete</button>
            </div>

            <!-- Add Character Choice Modal -->
            <div id="add-character-choice-modal" class="modal">
                <div class="modal-content modal-small">
                    <div class="modal-header">
                        <h2>Add Character</h2>
                        <button type="button" class="close-modal" aria-label="Close">&times;</button>
                    </div>
                    <div class="modal-body">
                        <div class="choice-buttons">
                            <button type="button" id="character-choice-create-new" class="btn btn-large">
                                <svg viewBox="0 0 24 24" width="24" height="24"><path fill="currentColor" d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg>
                                Create New
                            </button>
                            <button type="button" id="character-choice-import-json" class="btn btn-large">
                                <svg viewBox="0 0 24 24" width="24" height="24"><path fill="currentColor" d="M9 16h6v-6h4l-7-7-7 7h4v6zm-4 2h14v2H5v-2z"/></svg>
                                Import JSON
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Import Character JSON Modal -->
            <div id="import-character-json-modal" class="modal">
                <div class="modal-content">
                    <div class="modal-header">
                        <h2>Import Character from JSON</h2>
                        <button type="button" class="close-modal" aria-label="Close">&times;</button>
                    </div>
                    <div class="modal-body">
                        <p class="modal-hint">Paste character JSON data or a share link</p>
                        <div class="form-group">
                            <textarea id="import-character-json-input" rows="10" placeholder='{"name": "Thorin", "class": "Fighter", "level": 5, ...}'></textarea>
                        </div>
                        <p id="import-character-json-error" class="error-text hidden"></p>
                        <div class="form-actions" style="margin-top: 16px;">
                            <button type="button" id="import-character-json-cancel-btn" class="btn">Cancel</button>
                            <button type="button" id="import-character-json-confirm-btn" class="btn btn-primary">Import</button>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Character Import Confirm Modal (for URL imports) -->
            <div id="character-import-modal" class="modal">
                <div class="modal-content">
                    <div class="modal-header">
                        <h2>Import Character</h2>
                        <button type="button" class="close-modal" aria-label="Close">&times;</button>
                    </div>
                    <div class="modal-body">
                        <p>Would you like to import this character?</p>
                        <div id="character-import-preview" class="import-preview"></div>
                        <div class="form-actions" style="margin-top: 16px;">
                            <button type="button" id="character-import-cancel-btn" class="btn">Cancel</button>
                            <button type="button" id="character-import-confirm-btn" class="btn btn-primary">Import</button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        this.render();
        this.setupEventHandlers();
    }

    disconnectedCallback() {
        this.cleanupController?.abort()
    }

    setupEventHandlers() {
        const signal = this.cleanupController.signal;

        // New character button - show choice modal
        this.querySelector('#new-character-btn').addEventListener('click', () => {
            this.querySelector('#add-character-choice-modal').classList.add('active');
        }, {signal});

        // Character choice modal - Create New
        this.querySelector('#character-choice-create-new').addEventListener('click', () => {
            closeModals();
            setCharacterEditSource('list');
            Router.navigateToNew('characters');
        }, {signal});

        // Character choice modal - Import JSON
        this.querySelector('#character-choice-import-json').addEventListener('click', () => {
            closeModals();
            this.querySelector('#import-character-json-input').value = '';
            this.querySelector('#import-character-json-error').classList.add('hidden');
            this.querySelector('#import-character-json-modal').classList.add('active');
        }, {signal});

        // Import Character JSON Modal - Cancel
        this.querySelector('#import-character-json-cancel-btn').addEventListener('click', () => {
            closeModals();
        }, {signal});

        // Import Character JSON Modal - Confirm
        this.querySelector('#import-character-json-confirm-btn').addEventListener('click', async () => {
            const jsonInput = this.querySelector('#import-character-json-input').value.trim();
            const errorEl = this.querySelector('#import-character-json-error');

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
                    // Handle both compressed and legacy formats
                    let jsonStr;
                    if (isCompressed(encoded)) {
                        jsonStr = await decompress(encoded);
                    } else {
                        jsonStr = legacyDecode(encoded);
                    }
                    character = Characters.importCharacterFromJSON(jsonStr);
                } else {
                    // Treat as raw JSON
                    character = Characters.importCharacterFromJSON(jsonInput);
                }

                Characters.saveCharacter(character);
                closeModals();
                this.render();
                showToast(`Imported "${character.name}"`);
            } catch (e) {
                errorEl.textContent = e.message;
                errorEl.classList.remove('hidden');
            }
        }, {signal});

        // Character URL Import Modal - Cancel
        this.querySelector('#character-import-cancel-btn').addEventListener('click', () => {
            Characters.clearCharacterImportParam();
            closeModals();
        }, {signal});

        // Character URL Import Modal - Confirm
        this.querySelector('#character-import-confirm-btn').addEventListener('click', () => {
            const state = getState();
            if (state.importingCharacter) {
                const character = state.importingCharacter;
                Characters.saveCharacter(character);
                Characters.clearCharacterImportParam();
                setImportingCharacter(null);
                closeModals();
                this.render();
                showToast(`Imported "${character.name}"`);
            }
        }, {signal});

        // Close modal buttons (only close the containing modal)
        this.querySelectorAll('.close-modal').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                btn.closest('.modal')?.classList.remove('active');
            }, {signal});
        });

        // Close modal on backdrop click (only the clicked modal)
        this.querySelectorAll('.modal').forEach(modal => {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    modal.classList.remove('active');
                }
            }, {signal});
        });

        // Context menu action handlers
        const menu = this.querySelector('#character-context-menu');
        menu.querySelectorAll('.context-item').forEach(item => {
            item.addEventListener('click', () => {
                const characterId = menu.dataset.characterId;
                const action = item.dataset.action;
                const character = Characters.getCharacter(characterId);

                if (!character) {
                    this.hideContextMenu();
                    return;
                }

                switch (action) {
                    case 'view':
                        Router.navigateToItem('characters', characterId);
                        break;
                    case 'edit':
                        Router.navigateToItem('characters', characterId, 'edit');
                        break;
                    case 'copy': {
                        const copy = Characters.duplicateCharacter(character);
                        Characters.saveCharacter(copy);
                        this.render();
                        showToast(`Duplicated "${character.name}"`);
                        break;
                    }
                    case 'copy-json': {
                        const jsonStr = Characters.exportCharacterToJSON(character);
                        navigator.clipboard.writeText(jsonStr).then(() => {
                            showToast('Character JSON copied to clipboard!');
                        }).catch(() => {
                            prompt('Copy this JSON:', jsonStr);
                        });
                        break;
                    }
                    case 'share':
                        Characters.exportCharacterToURL(character).then(url => {
                            navigator.clipboard.writeText(url).then(() => {
                                showToast('Share link copied to clipboard!');
                            }).catch(() => {
                                prompt('Copy this link to share:', url);
                            });
                        });
                        break;
                    case 'delete':
                        if (confirm(`Delete "${character.name}"?`)) {
                            Characters.deleteCharacter(characterId);
                            this.render();
                        }
                        break;
                }

                this.hideContextMenu();
            }, {signal});
        });
    }

    render() {
        const container = this.querySelector('#characters-list');
        const characters = Characters.getCharacters();

        if (!container) return;

        if (characters.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <svg viewBox="0 0 24 24"><path fill="currentColor" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z"/></svg>
                    <h3>No Characters</h3>
                    <p>Create your first D&D character sheet</p>
                </div>
            `;
            return;
        }

        container.innerHTML = characters.map(character => {
            const profBonus = Characters.getProficiencyBonus(character.level);
            const hpDisplay = character.hitPointsCurrent !== undefined
                ? `${character.hitPointsCurrent}/${character.hitPointsMax}`
                : character.hitPointsMax || '-';

            return `
                <div class="character-card" data-id="${character.id}">
                    <div class="character-card-header">
                        <h3>${escapeHtml(character.name) || 'Unnamed Character'}</h3>
                    </div>
                    <div class="character-card-meta">
                        <span class="character-class">${escapeHtml(character.class) || 'No Class'} ${character.level}</span>
                        <span class="character-species">${escapeHtml(character.species) || 'No Species'}</span>
                    </div>
                    <div class="character-card-stats">
                        <span>AC ${character.armorClass || 10}</span>
                        <span>HP ${hpDisplay}</span>
                        <span>Prof +${profBonus}</span>
                    </div>
                </div>
            `;
        }).join('');

        // Add click handlers
        container.querySelectorAll('.character-card').forEach(card => {
            card.addEventListener('click', (e) => {
                const id = card.dataset.id;
                this.showContextMenu(e, id);
            });
        });
    }

    // Show context menu for character
    showContextMenu(e, characterId) {
        e.preventDefault();
        e.stopPropagation();

        const menu = this.querySelector('#character-context-menu');
        if (!menu) return;

        // If clicking on the same character while menu is open, just close it
        if (!menu.classList.contains('hidden') && menu.dataset.characterId === characterId) {
            this.hideContextMenu();
            return;
        }

        menu.classList.remove('hidden');
        menu.dataset.characterId = characterId;

        // Position menu
        const x = e.clientX || e.touches?.[0]?.clientX || 100;
        const y = e.clientY || e.touches?.[0]?.clientY || 100;

        const margin = 8;
        const menuWidth = menu.offsetWidth;
        const menuHeight = menu.offsetHeight;
        menu.style.left = `${Math.max(margin, Math.min(x, window.innerWidth - menuWidth - margin))}px`;
        menu.style.top = `${Math.max(margin, Math.min(y, window.innerHeight - menuHeight - margin))}px`;

        // Close on click outside - use setTimeout to avoid the current click triggering it
        setTimeout(() => {
            document.addEventListener('click', () => this.hideContextMenu(), { once: true });
        }, 0);
    }

    hideContextMenu() {
        const menu = this.querySelector('#character-context-menu');
        if (!menu) return;
        menu.classList.add('hidden');
    }
}

// Register element if not already registered
if (!customElements.get('characters-view')) {
    customElements.define('characters-view', CharactersViewElement);
}

// Compatibility exports used elsewhere in app
export function render() {
    const el = document.querySelector('characters-view');
    if (el && typeof el.render === 'function') el.render();
}

export function showContextMenu(e, characterId) {
    const el = document.querySelector('characters-view');
    if (el && typeof el.showContextMenu === 'function') el.showContextMenu(e, characterId);
}

export function hideContextMenu() {
    const el = document.querySelector('characters-view');
    if (el && typeof el.hideContextMenu === 'function') el.hideContextMenu();
}

export default {
    render,
    showContextMenu,
    hideContextMenu
};
