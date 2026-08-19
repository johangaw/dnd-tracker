// Custom Monsters List Component rewritten as a light-DOM WebComponent

import * as CustomMonsters from '../../services/customMonsters.js';
import * as MonsterAPI from '../../services/monsterApi.js';
import { formatCR, getHP, getAC } from '../../services/monsterApi.js';
import { setView } from '../../services/state.js';
import { MonsterFolders } from '../../services/folders.js';
import * as Router from '../../utils/router.js';
import { escapeHtml, showToast } from '../../utils/helpers.js';
import { showStatBlock, showStatBlockByNameSource } from '../modals/statBlock.js';
import { searchMonsters as searchMonsterModal } from '../modals/monsterSearchModal.js';
import customMonsterEditView from '../custom-monster-edit-view/index.js';
import '../modals/import-monster-modal/index.js';
import '../modals/folder-modal/index.js';

class CustomMonstersViewElement extends HTMLElement {
    cleanupController = null
    searchTimeout = null
    activeFolderFilter = null // null = All, 'unfiled' = no folders, otherwise a folder id

    constructor() {
        super();
    }

    connectedCallback() {
        this.cleanupController = new AbortController()

        // Render the internal structure: list container + new-monster button + context menu + modals
        this.innerHTML = `
            <div class="folder-filter-bar">
                <div id="monster-folder-chips" class="folder-chips"></div>
                <button id="manage-monster-folders-btn" class="icon-btn" aria-label="Manage Folders" title="Manage Folders">📁</button>
            </div>
            <div id="custom-monsters-list" class="list"></div>
            <button id="new-custom-monster-btn" class="fab" aria-label="New Custom Monster">
                <svg viewBox="0 0 24 24" width="24" height="24"><path fill="currentColor" d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg>
            </button>

            <!-- Custom Monster Context Menu -->
            <div id="monster-context-menu" class="context-menu hidden">
                <button class="context-item" data-action="view-stats">View Stats</button>
                <button class="context-item" data-action="edit">Edit</button>
                <button class="context-item" data-action="folders">Folders...</button>
                <button class="context-item" data-action="copy">Duplicate</button>
                <button class="context-item" data-action="copy-json">Copy JSON</button>
                <button class="context-item" data-action="share">Share Link</button>
                <button class="context-item danger" data-action="delete">Delete</button>
            </div>

            <!-- Folder Modal -->
            <folder-modal id="monster-folder-modal" class="modal"></folder-modal>

            <!-- Add Monster Choice Modal -->
            <div id="add-monster-choice-modal" class="modal">
                <div class="modal-content modal-small">
                    <div class="modal-header">
                        <h2>Add Monster</h2>
                        <button type="button" class="close-modal" aria-label="Close">&times;</button>
                    </div>
                    <div class="modal-body">
                        <div class="choice-buttons">
                            <button type="button" id="choice-create-new" class="btn btn-large">
                                <svg viewBox="0 0 24 24" width="24" height="24"><path fill="currentColor" d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg>
                                Create New
                            </button>
                            <button type="button" id="choice-from-existing" class="btn btn-large">
                                <svg viewBox="0 0 24 24" width="24" height="24"><path fill="currentColor" d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/></svg>
                                From Existing
                            </button>
                            <button type="button" id="choice-import-json" class="btn btn-large">
                                <svg viewBox="0 0 24 24" width="24" height="24"><path fill="currentColor" d="M9 16h6v-6h4l-7-7-7 7h4v6zm-4 2h14v2H5v-2z"/></svg>
                                Import JSON
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Import Monster JSON Modal -->
            <div id="import-json-modal" class="modal">
                <div class="modal-content">
                    <div class="modal-header">
                        <h2>Import Monster from JSON</h2>
                        <button type="button" class="close-modal" aria-label="Close">&times;</button>
                    </div>
                    <div class="modal-body">
                        <p class="modal-hint">Paste monster JSON data (5e.tools format supported)</p>
                        <div class="schema-link">
                            <button type="button" id="copy-schema-btn" class="btn btn-small">Copy Schema URL</button>
                            <span id="schema-copied-msg" class="copied-msg hidden">Copied!</span>
                        </div>
                        <div class="form-group">
                            <textarea id="import-json-input" rows="10" placeholder='{"name": "My Monster", "ac": [{"ac": 15}], "hp": {"average": 50}, ...}'></textarea>
                        </div>
                        <p id="import-json-error" class="error-text hidden"></p>
                        <div class="form-actions" style="margin-top: 16px;">
                            <button type="button" id="import-json-cancel-btn" class="btn">Cancel</button>
                            <button type="button" id="import-json-confirm-btn" class="btn btn-primary">Import</button>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Baseline Monster Search Modal -->
            <div id="baseline-search-modal" class="modal">
                <div class="modal-content">
                    <div class="modal-header">
                        <h2>Search Monsters</h2>
                        <button type="button" class="close-modal" aria-label="Close">&times;</button>
                    </div>
                    <div class="modal-body">
                        <div class="search-box">
                            <input type="text" id="baseline-search-input" placeholder="Search by name...">
                            <select id="baseline-source-filter">
                                <option value="" selected>Default</option>
                                <option value="ALL">All Sources</option>
                                <option value="Custom">Custom Monsters</option>
                                <option value="XMM">Monster Manual (2024)</option>
                                <option value="MM">Monster Manual (2014)</option>
                            </select>
                        </div>
                        <div id="baseline-search-results" class="search-results"></div>
                    </div>
                </div>
            </div>

            <!-- Import Monster Modal (from URL) -->
            <import-monster-modal id="import-monster-modal" class="modal"></import-monster-modal>
        `;

        this.render();
        this.setupEventHandlers();
    }

    disconnectedCallback() {
        this.cleanupController.abort()
        clearTimeout(this.searchTimeout)
    }

    setupEventHandlers() {
        const signal = this.cleanupController.signal;

        // Manage folders button
        this.querySelector('#manage-monster-folders-btn').addEventListener('click', () => {
            this.querySelector('#monster-folder-modal').open({
                folderStore: MonsterFolders,
                getItems: CustomMonsters.getCustomMonsters,
                saveItems: CustomMonsters.saveCustomMonsters,
                onFoldersChanged: () => this.render()
            });
        }, {signal});

        // New custom monster button - show choice modal
        this.querySelector('#new-custom-monster-btn').addEventListener('click', () => {
            this.querySelector('#add-monster-choice-modal').classList.add('active');
        }, {signal});

        // Choice modal - Create New
        this.querySelector('#choice-create-new').addEventListener('click', () => {
            this.closeOwnModals();
            customMonsterEditView.render();
        }, {signal});

        // Choice modal - From Existing
        this.querySelector('#choice-from-existing').addEventListener('click', () => {
            this.closeOwnModals();
            this.querySelector('#baseline-search-input').value = '';
            this.querySelector('#baseline-search-results').innerHTML = '';
            this.querySelector('#baseline-search-modal').classList.add('active');
        }, {signal});

        // Choice modal - Import JSON
        this.querySelector('#choice-import-json').addEventListener('click', () => {
            this.closeOwnModals();
            this.querySelector('#import-json-input').value = '';
            this.querySelector('#import-json-error').classList.add('hidden');
            this.querySelector('#import-json-modal').classList.add('active');
        }, {signal});

        // Import JSON modal - Cancel
        this.querySelector('#import-json-cancel-btn').addEventListener('click', () => {
            this.closeOwnModals();
        }, {signal});

        // Import JSON modal - Confirm
        this.querySelector('#import-json-confirm-btn').addEventListener('click', () => {
            const input = this.querySelector('#import-json-input');
            const errorEl = this.querySelector('#import-json-error');

            try {
                const monster = CustomMonsters.importMonsterFromJSON(input.value);
                CustomMonsters.saveCustomMonster(monster);
                this.closeOwnModals();

                // Show the custom monsters view with the imported monster
                setView('custom-monsters');
                this.render();
            } catch (e) {
                errorEl.textContent = e.message;
                errorEl.classList.remove('hidden');
            }
        }, {signal});

        // Copy schema URL button
        this.querySelector('#copy-schema-btn').addEventListener('click', async () => {
            const basePath = window.location.pathname.endsWith('/')
                ? window.location.pathname
                : window.location.pathname.replace(/\/[^/]*$/, '/');
            const schemaUrl = `${window.location.origin}${basePath}monster-schema.json`;
            try {
                await navigator.clipboard.writeText(schemaUrl);
                const msg = this.querySelector('#schema-copied-msg');
                msg.classList.remove('hidden');
                setTimeout(() => msg.classList.add('hidden'), 2000);
            } catch (e) {
                // Fallback for older browsers
                prompt('Copy this URL:', schemaUrl);
            }
        }, {signal});

        // Baseline search
        const baselineInput = this.querySelector('#baseline-search-input');
        const baselineSourceFilter = this.querySelector('#baseline-source-filter');

        baselineInput.addEventListener('input', (e) => {
            clearTimeout(this.searchTimeout);
            this.searchTimeout = setTimeout(() => {
                this.searchBaselineMonsters(e.target.value, baselineSourceFilter.value);
            }, 300);
        }, {signal});

        baselineSourceFilter.addEventListener('change', () => {
            const query = baselineInput.value;
            if (query.length >= 2) {
                this.searchBaselineMonsters(query, baselineSourceFilter.value);
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
        const menu = this.querySelector('#monster-context-menu');
        menu.querySelectorAll('.context-item').forEach(item => {
            item.addEventListener('click', () => {
                const monsterId = menu.dataset.monsterId;
                const action = item.dataset.action;
                const monster = CustomMonsters.getCustomMonster(monsterId);

                if (!monster) {
                    this.hideContextMenu();
                    return;
                }

                switch (action) {
                    case 'view-stats':
                        showStatBlock(monster);
                        break;
                    case 'edit':
                        Router.navigateToItem('monsters', monsterId);
                        break;
                    case 'folders':
                        this.querySelector('#monster-folder-modal').open({
                            folderStore: MonsterFolders,
                            getItems: CustomMonsters.getCustomMonsters,
                            saveItems: CustomMonsters.saveCustomMonsters,
                            item: monster,
                            onChange: (folderIds) => {
                                monster.folderIds = folderIds;
                                CustomMonsters.saveCustomMonster(monster);
                            },
                            onFoldersChanged: () => this.render()
                        });
                        break;
                    case 'copy': {
                        const copy = JSON.parse(JSON.stringify(monster));
                        copy.id = Date.now().toString();
                        copy.name = `${copy.name} (Copy)`;
                        CustomMonsters.saveCustomMonster(copy);
                        this.render();
                        break;
                    }
                    case 'copy-json': {
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
                    }
                    case 'share':
                        CustomMonsters.exportMonsterToURL(monster).then(url => {
                            navigator.clipboard.writeText(url).then(() => {
                                showToast('Share link copied to clipboard!');
                            }).catch(() => {
                                prompt('Copy this link to share:', url);
                            });
                        });
                        break;
                    case 'delete':
                        if (confirm(`Delete "${monster.name}"?`)) {
                            CustomMonsters.deleteCustomMonster(monsterId);
                            this.render();
                        }
                        break;
                }

                this.hideContextMenu();
            }, {signal});
        });

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.hideContextMenu();
            }
        }, {signal});
    }

    // Close only the modals owned by this component
    closeOwnModals() {
        this.querySelectorAll('.modal').forEach(m => m.classList.remove('active'));
    }

    renderFolderChips() {
        const chipsContainer = this.querySelector('#monster-folder-chips');
        if (!chipsContainer) return;

        const allMonsters = CustomMonsters.getCustomMonsters();
        const folders = MonsterFolders.getFolders();

        // Reset filter if it points at a folder that no longer exists
        if (this.activeFolderFilter && this.activeFolderFilter !== 'unfiled' &&
            !folders.some(f => f.id === this.activeFolderFilter)) {
            this.activeFolderFilter = null;
        }

        const unfiledCount = allMonsters.filter(m => !m.folderIds || m.folderIds.length === 0).length;

        const chips = [
            `<button class="folder-chip ${!this.activeFolderFilter ? 'active' : ''}" data-filter="">All <span class="count">${allMonsters.length}</span></button>`,
            ...folders.map(f => {
                const count = allMonsters.filter(m => m.folderIds?.includes(f.id)).length;
                return `<button class="folder-chip ${this.activeFolderFilter === f.id ? 'active' : ''}" data-filter="${f.id}">${escapeHtml(f.name)} <span class="count">${count}</span></button>`;
            })
        ];

        if (folders.length > 0) {
            chips.push(`<button class="folder-chip ${this.activeFolderFilter === 'unfiled' ? 'active' : ''}" data-filter="unfiled">Unfiled <span class="count">${unfiledCount}</span></button>`);
        }

        chipsContainer.innerHTML = chips.join('');

        chipsContainer.querySelectorAll('.folder-chip').forEach(chip => {
            chip.addEventListener('click', () => {
                this.activeFolderFilter = chip.dataset.filter || null;
                this.render();
            });
        });
    }

    render() {
        this.renderFolderChips();

        const container = this.querySelector('#custom-monsters-list');
        const allMonsters = CustomMonsters.getCustomMonsters();

        if (!container) return;

        if (allMonsters.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <svg viewBox="0 0 24 24"><path fill="currentColor" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/></svg>
                    <h3>No Custom Monsters</h3>
                    <p>Create your own monsters or import from JSON</p>
                </div>
            `;
            return;
        }

        let monsters = allMonsters;
        if (this.activeFolderFilter === 'unfiled') {
            monsters = allMonsters.filter(m => !m.folderIds || m.folderIds.length === 0);
        } else if (this.activeFolderFilter) {
            monsters = allMonsters.filter(m => m.folderIds?.includes(this.activeFolderFilter));
        }

        if (monsters.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <svg viewBox="0 0 24 24"><path fill="currentColor" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/></svg>
                    <h3>No Monsters Here</h3>
                    <p>Nothing in this folder yet</p>
                </div>
            `;
            return;
        }

        container.innerHTML = monsters.map(monster => {
            const hp = getHP(monster);
            const ac = getAC(monster);
            const cr = formatCR(monster.cr);
            const type = monster.type || 'creature';
            const size = formatSize(monster.size);

            return `
                <div class="monster-card" data-id="${monster.id}">
                    <div class="monster-card-header">
                        <h3>${escapeHtml(monster.name)}</h3>
                        ${monster.baselineName ? `<span class="baseline-tag">Based on ${escapeHtml(monster.baselineName)}</span>` : ''}
                    </div>
                    <div class="monster-card-meta">
                        <span>${size} ${type}</span>
                        <span>CR ${cr}</span>
                    </div>
                    <div class="monster-card-stats">
                        <span>AC ${ac}</span>
                        <span>HP ${hp}</span>
                    </div>
                </div>
            `;
        }).join('');

        // Add click handlers
        container.querySelectorAll('.monster-card').forEach(card => {
            card.addEventListener('click', (e) => {
                this.showContextMenu(e, card.dataset.id);
            });
        });
    }

    async searchBaselineMonsters(query, source) {
        const resultsContainer = this.querySelector('#baseline-search-results');

        if (query.length < 2) {
            resultsContainer.innerHTML = '<p class="search-hint">Type at least 2 characters to search</p>';
            return;
        }

        resultsContainer.innerHTML = '<p class="search-hint">Searching...</p>';

        await searchMonsterModal({
            query,
            source,
            container: resultsContainer,
            emptyMessage: 'No monsters found',
            onSelect: async ({ name, source, id }) => {
                let monster;
                if (source === 'Custom' && id) {
                    monster = CustomMonsters.getCustomMonster(id);
                } else {
                    monster = await MonsterAPI.getMonster(name, source);
                }

                if (monster) {
                    this.closeOwnModals();
                    customMonsterEditView.initFromBaseline(monster);
                }
            },
            onViewStats: async ({ name, source, id }) => {
                if (source === 'Custom' && id) {
                    const monster = CustomMonsters.getCustomMonster(id);
                    if (monster) {
                        showStatBlock(monster);
                    }
                    return;
                }

                await showStatBlockByNameSource(name, source);
            }
        });
    }

    showContextMenu(e, monsterId) {
        e.preventDefault();
        e.stopPropagation();

        const menu = this.querySelector('#monster-context-menu');
        if (!menu) return;

        // If clicking on the same monster while menu is open, just close it
        if (!menu.classList.contains('hidden') && menu.dataset.monsterId === monsterId) {
            this.hideContextMenu();
            return;
        }

        menu.classList.remove('hidden');
        menu.dataset.monsterId = monsterId;

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
        const menu = this.querySelector('#monster-context-menu');
        if (!menu) return;
        menu.classList.add('hidden');
        delete menu.dataset.monsterId;
    }
}

// Format size code to readable text
function formatSize(size) {
    if (!size) return 'Medium';
    const sizeCode = Array.isArray(size) ? size[0] : size;
    const sizes = {
        'T': 'Tiny',
        'S': 'Small',
        'M': 'Medium',
        'L': 'Large',
        'H': 'Huge',
        'G': 'Gargantuan'
    };
    return sizes[sizeCode] || 'Medium';
}

// Register element if not already registered
if (!customElements.get('custom-monsters-view')) {
    customElements.define('custom-monsters-view', CustomMonstersViewElement);
}

// Compatibility exports used elsewhere in app
export function render() {
    const el = document.querySelector('custom-monsters-view');
    if (el && typeof el.render === 'function') el.render();
}

export function hideContextMenu() {
    const el = document.querySelector('custom-monsters-view');
    if (el && typeof el.hideContextMenu === 'function') el.hideContextMenu();
}

export default {
    render,
    hideContextMenu
};
