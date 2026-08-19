// Encounter Monsters Quick Add Modal - light-DOM WebComponent
import { setupModalClose } from '../modalBase.js';

class EncounterMonstersModalElement extends HTMLElement {
    cleanupController = null;

    connectedCallback() {
        this.cleanupController = new AbortController();

        this.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h2>Add from Encounter</h2>
                    <button type="button" class="close-modal" aria-label="Close">&times;</button>
                </div>
                <div class="modal-body">
                    <p class="modal-hint">Tap a monster to add one instance to combat</p>
                    <div id="encounter-monsters-list" class="search-results"></div>
                </div>
            </div>
        `;

        setupModalClose(this, this.cleanupController.signal);
    }

    disconnectedCallback() {
        this.cleanupController.abort();
    }

    setContent(html) {
        this.querySelector('#encounter-monsters-list').innerHTML = html;
    }

    getContentElement() {
        return this.querySelector('#encounter-monsters-list');
    }

    open() {
        this.classList.add('active');
    }
}

if (!customElements.get('encounter-monsters-modal')) {
    customElements.define('encounter-monsters-modal', EncounterMonstersModalElement);
}
