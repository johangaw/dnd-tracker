// Import Encounter (from URL) Modal - light-DOM WebComponent
import { setupModalClose } from '../modalBase.js';

class ImportModalElement extends HTMLElement {
    cleanupController = null;
    confirmHandler = null;
    cancelHandler = null;

    connectedCallback() {
        this.cleanupController = new AbortController();

        this.innerHTML = `
            <div class="modal-content modal-small">
                <div class="modal-header">
                    <h2>Import Encounter</h2>
                    <button type="button" class="close-modal" aria-label="Close">&times;</button>
                </div>
                <div class="modal-body">
                    <p id="import-encounter-info"></p>
                    <div class="form-actions" style="margin-top: 16px;">
                        <button type="button" id="import-cancel-btn" class="btn">Cancel</button>
                        <button type="button" id="import-confirm-btn" class="btn btn-primary">Import</button>
                    </div>
                </div>
            </div>
        `;

        setupModalClose(this, this.cleanupController.signal);

        const signal = this.cleanupController.signal;
        this.querySelector('#import-confirm-btn').addEventListener('click', () => this.confirmHandler?.(), { signal });
        this.querySelector('#import-cancel-btn').addEventListener('click', () => this.cancelHandler?.(), { signal });
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

    open(infoHtml) {
        this.querySelector('#import-encounter-info').innerHTML = infoHtml;
        this.classList.add('active');
    }
}

if (!customElements.get('import-modal')) {
    customElements.define('import-modal', ImportModalElement);
}
