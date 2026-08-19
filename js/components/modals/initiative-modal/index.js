// Initiative Edit Modal - light-DOM WebComponent
import { setupModalClose } from '../modalBase.js';

class InitiativeModalElement extends HTMLElement {
    cleanupController = null;
    saveHandler = null;

    connectedCallback() {
        this.cleanupController = new AbortController();

        this.innerHTML = `
            <div class="modal-content modal-small">
                <div class="modal-header">
                    <h2 id="initiative-modal-title">Edit Initiative</h2>
                    <button type="button" class="close-modal" aria-label="Close">&times;</button>
                </div>
                <div class="modal-body">
                    <div class="form-group">
                        <label for="initiative-input">Initiative</label>
                        <input type="number" id="initiative-input" placeholder="0">
                    </div>
                    <button type="button" id="save-initiative-btn" class="btn btn-primary" style="width: 100%; margin-top: 12px;">Save</button>
                </div>
            </div>
        `;

        setupModalClose(this, this.cleanupController.signal);

        const signal = this.cleanupController.signal;
        const input = this.querySelector('#initiative-input');
        this.querySelector('#save-initiative-btn').addEventListener('click', () => this.save(), { signal });
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') this.save();
        }, { signal });
    }

    disconnectedCallback() {
        this.cleanupController.abort();
    }

    save() {
        const value = parseInt(this.querySelector('#initiative-input').value) || 0;
        this.saveHandler?.(value);
    }

    // Register the callback invoked with the parsed initiative value when the
    // user saves.
    onSave(handler) {
        this.saveHandler = handler;
    }

    open(title, initiative) {
        this.querySelector('#initiative-modal-title').textContent = title;
        const input = this.querySelector('#initiative-input');
        input.value = initiative;
        this.classList.add('active');
        input.focus();
        input.select();
    }
}

if (!customElements.get('initiative-modal')) {
    customElements.define('initiative-modal', InitiativeModalElement);
}
