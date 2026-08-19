// Import Encounter from JSON Modal - light-DOM WebComponent
import { setupModalClose } from '../modalBase.js';

class ImportEncounterJsonModalElement extends HTMLElement {
    cleanupController = null;
    confirmHandler = null;
    cancelHandler = null;

    connectedCallback() {
        this.cleanupController = new AbortController();

        this.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h2>Import Encounter from JSON</h2>
                    <button type="button" class="close-modal" aria-label="Close">&times;</button>
                </div>
                <div class="modal-body">
                    <p class="modal-hint">Paste encounter JSON data</p>
                    <div class="form-group">
                        <textarea id="import-encounter-json-input" rows="10" placeholder='{"title": "My Encounter", "pcs": [{"name": "Fighter"}], "monsters": [{"name": "Goblin", "source": "MM"}], ...}'></textarea>
                    </div>
                    <p id="import-encounter-json-error" class="error-text hidden"></p>
                    <div class="form-actions" style="margin-top: 16px;">
                        <button type="button" id="import-encounter-json-cancel-btn" class="btn">Cancel</button>
                        <button type="button" id="import-encounter-json-confirm-btn" class="btn btn-primary">Import</button>
                    </div>
                </div>
            </div>
        `;

        setupModalClose(this, this.cleanupController.signal);

        const signal = this.cleanupController.signal;
        this.querySelector('#import-encounter-json-confirm-btn').addEventListener('click', () => this.confirmHandler?.(this.getValue()), { signal });
        this.querySelector('#import-encounter-json-cancel-btn').addEventListener('click', () => this.cancelHandler?.(), { signal });
    }

    disconnectedCallback() {
        this.cleanupController.abort();
    }

    onConfirm(handler) {
        this.confirmHandler = handler;
    }

    onCancel(handler) {
        this.cancelHandler = handler;
    }

    getValue() {
        return this.querySelector('#import-encounter-json-input').value.trim();
    }

    showError(message) {
        this.querySelector('#import-encounter-json-error').textContent = message;
        this.querySelector('#import-encounter-json-error').classList.remove('hidden');
    }

    hideError() {
        this.querySelector('#import-encounter-json-error').classList.add('hidden');
    }

    open() {
        this.querySelector('#import-encounter-json-input').value = '';
        this.hideError();
        this.classList.add('active');
    }
}

if (!customElements.get('import-encounter-json-modal')) {
    customElements.define('import-encounter-json-modal', ImportEncounterJsonModalElement);
}
