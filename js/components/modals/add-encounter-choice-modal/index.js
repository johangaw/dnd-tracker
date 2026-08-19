// Add Encounter Choice Modal - light-DOM WebComponent
import { setupModalClose } from '../modalBase.js';

class AddEncounterChoiceModalElement extends HTMLElement {
    cleanupController = null;
    createNewHandler = null;
    importJsonHandler = null;

    connectedCallback() {
        this.cleanupController = new AbortController();

        this.innerHTML = `
            <div class="modal-content modal-small">
                <div class="modal-header">
                    <h2>Add Encounter</h2>
                    <button type="button" class="close-modal" aria-label="Close">&times;</button>
                </div>
                <div class="modal-body">
                    <div class="choice-buttons">
                        <button type="button" id="encounter-choice-create-new" class="btn btn-large">
                            <svg viewBox="0 0 24 24" width="24" height="24"><path fill="currentColor" d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg>
                            Create New
                        </button>
                        <button type="button" id="encounter-choice-import-json" class="btn btn-large">
                            <svg viewBox="0 0 24 24" width="24" height="24"><path fill="currentColor" d="M9 16h6v-6h4l-7-7-7 7h4v6zm-4 2h14v2H5v-2z"/></svg>
                            Import JSON
                        </button>
                    </div>
                </div>
            </div>
        `;

        setupModalClose(this, this.cleanupController.signal);

        const signal = this.cleanupController.signal;
        this.querySelector('#encounter-choice-create-new').addEventListener('click', () => this.createNewHandler?.(), { signal });
        this.querySelector('#encounter-choice-import-json').addEventListener('click', () => this.importJsonHandler?.(), { signal });
    }

    disconnectedCallback() {
        this.cleanupController.abort();
    }

    onCreateNew(handler) {
        this.createNewHandler = handler;
    }

    onImportJson(handler) {
        this.importJsonHandler = handler;
    }

    open() {
        this.classList.add('active');
    }
}

if (!customElements.get('add-encounter-choice-modal')) {
    customElements.define('add-encounter-choice-modal', AddEncounterChoiceModalElement);
}
