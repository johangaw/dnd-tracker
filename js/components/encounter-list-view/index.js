// Encounter List Component rewritten as a light-DOM WebComponent

import * as Storage from '../../services/storage.js';
import * as Router from '../../utils/router.js';
import '../encounter-run-view/index.js';
import { escapeHtml, showToast } from '../../utils/helpers.js';
import encounterRunView from '../encounter-run-view/index.js';
import '../modals/import-modal/index.js';
import '../modals/add-encounter-choice-modal/index.js';
import '../modals/import-encounter-json-modal/index.js';

class EncounterListViewElement extends HTMLElement {
    cleanupController = null

    constructor() {
        super();
    }

    connectedCallback() {
        this.cleanupController = new AbortController()

        // Render the internal structure: list container + new-encounter button + context menu
        this.innerHTML = `
            <div class="list"></div>
            <button id="new-encounter-btn" class="fab" aria-label="New Encounter">
                <svg viewBox="0 0 24 24" width="24" height="24"><path fill="currentColor" d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg>
            </button>

            <!-- Context Menu -->
            <div id="context-menu" class="context-menu hidden">
                <button class="context-item" data-action="edit">Edit</button>
                <button class="context-item" data-action="copy">Duplicate</button>
                <button class="context-item" data-action="copy-json">Copy JSON</button>
                <button class="context-item" data-action="share">Share Link</button>
                <button class="context-item" data-action="run">Run Encounter</button>
                <button class="context-item danger" data-action="delete">Delete</button>
            </div>

            <!-- Add Encounter Choice Modal -->
            <add-encounter-choice-modal id="add-encounter-choice-modal" class="modal"></add-encounter-choice-modal>

            <!-- Import Encounter JSON Modal -->
            <import-encounter-json-modal id="import-encounter-json-modal" class="modal"></import-encounter-json-modal>

            <!-- Import Encounter Modal (from URL) -->
            <import-modal id="import-modal" class="modal"></import-modal>
        `;

        this.render();

        // Wire up context menu action handlers inside the component
        const menu = this.querySelector('#context-menu');
        if (menu) {
            menu.querySelectorAll('.context-item').forEach(item => {
                item.addEventListener('click', async () => {
                    const encounterId = menu.dataset.encounterId;
                    const action = item.dataset.action;
                    const encounter = Storage.getEncounter(encounterId);

                    switch (action) {
                        case 'edit':
                            Router.navigateToItem('encounters', encounterId);
                            break;
                        case 'copy': {
                            const copy = JSON.parse(JSON.stringify(encounter));
                            copy.id = Date.now().toString();
                            copy.title = `${copy.title} (Copy)`;
                            Storage.saveEncounter(copy);
                            this.render();
                            break;
                        }
                        case 'copy-json': {
                            const jsonStr = Storage.exportEncounterToJSON(encounter);
                            try {
                                await navigator.clipboard.writeText(jsonStr);
                                showToast('Encounter JSON copied to clipboard!');
                            } catch (e) {
                                prompt('Copy this JSON:', jsonStr);
                            }
                            break;
                        }
                        case 'share': {
                            Storage.exportEncounterToURL(encounter).then(url => {
                                navigator.clipboard.writeText(url).then(() => {
                                    showToast('Share link copied to clipboard!');
                                }).catch(() => {
                                    prompt('Copy this link to share:', url);
                                });
                            });
                            break;
                        }
                        case 'run':
                            encounterRunView.render(encounter);
                            break;
                        case 'delete':
                            if (confirm('Delete this encounter?')) {
                                Storage.deleteEncounter(encounterId);
                                this.render();
                            }
                            break;
                    }

                    this.hideContextMenu();
                });
            });
        }

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.hideContextMenu();
            }
        }, {signal: this.cleanupController.signal});
    }

    disconnectedCallback() {
        this.cleanupController.abort()
    }

    render() {
        const container = this.querySelector('.list');
        const encounters = Storage.getEncounters();

        if (!container) return;

        if (!encounters || encounters.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <svg viewBox="0 0 24 24"><path fill="currentColor" d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-5 14H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z"/></svg>
                    <h3>No Encounters Yet</h3>
                    <p>Tap the + button to create your first encounter</p>
                </div>
            `;
            return;
        }

        container.innerHTML = encounters.map(enc => `
            <div class="encounter-card" data-id="${enc.id}">
                <h3>${escapeHtml(enc.title)}</h3>
                ${enc.description ? `<p>${escapeHtml(enc.description)}</p>` : ''}
                <div class="meta">
                    <span>${enc.pcs?.length || 0} PCs</span>
                    <span>${enc.monsters?.length || 0} Monsters</span>
                </div>
            </div>
        `).join('');

        // Add click handlers
        container.querySelectorAll('.encounter-card').forEach(card => {
            card.addEventListener('click', (e) => {
                const id = card.dataset.id;
                this.showContextMenu(e, id);
            });

            // Long press for mobile
            let pressTimer;
            card.addEventListener('touchstart', (e) => {
                pressTimer = setTimeout(() => {
                    const id = card.dataset.id;
                    this.showContextMenu(e, id);
                }, 500);
            });
            card.addEventListener('touchend', () => clearTimeout(pressTimer));
            card.addEventListener('touchmove', () => clearTimeout(pressTimer));
        });
    }

    showContextMenu(e, encounterId) {
        e.preventDefault();
        e.stopPropagation();

        const menu = document.getElementById('context-menu');
        if (!menu) return;

        // If clicking on the same encounter while menu is open, just close it
        if (!menu.classList.contains('hidden') && menu.dataset.encounterId === encounterId) {
            this.hideContextMenu();
            return;
        }

        menu.classList.remove('hidden');
        menu.dataset.encounterId = encounterId;

        // Position menu
        const x = e.clientX || e.touches?.[0]?.clientX || 100;
        const y = e.clientY || e.touches?.[0]?.clientY || 100;

        menu.style.left = `${Math.min(x, window.innerWidth - 180)}px`;
        menu.style.top = `${Math.min(y, window.innerHeight - 200)}px`;

        // Close on click outside - use setTimeout to avoid the current click triggering it
        setTimeout(() => {
            document.addEventListener('click', () => this.hideContextMenu(), { once: true });
        }, 0);
    }

    hideContextMenu() {
        const menu = document.getElementById('context-menu');
        menu.classList.add('hidden');
        delete menu.dataset.encounterId;
    }
    
}

// Register element if not already registered
if (!customElements.get('encounter-list-view')) {
    customElements.define('encounter-list-view', EncounterListViewElement);
}

// Compatibility exports used elsewhere in app
export function render() {
    const el = document.querySelector('encounter-list-view');
    if (el && typeof el.render === 'function') el.render();
}

export default {
    render
};
