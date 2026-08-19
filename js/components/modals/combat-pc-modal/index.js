// Add PC to Combat Modal - light-DOM WebComponent
import { setupModalClose } from '../modalBase.js';

class CombatPcModalElement extends HTMLElement {
    cleanupController = null;
    confirmHandler = null;

    connectedCallback() {
        this.cleanupController = new AbortController();

        this.innerHTML = `
            <div class="modal-content modal-small">
                <div class="modal-header">
                    <h2>Add PC to Combat</h2>
                    <button type="button" class="close-modal" aria-label="Close">&times;</button>
                </div>
                <div class="modal-body">
                    <div class="form-group">
                        <label for="combat-pc-name">Character Name</label>
                        <input type="text" id="combat-pc-name" placeholder="Enter name...">
                    </div>
                    <div class="form-group">
                        <label for="combat-pc-initiative">Initiative</label>
                        <input type="number" id="combat-pc-initiative" placeholder="0">
                    </div>
                    <button type="button" id="add-combat-pc-confirm" class="btn btn-primary" style="width: 100%; margin-top: 12px;">Add PC</button>
                </div>
            </div>
        `;

        setupModalClose(this, this.cleanupController.signal);

        const signal = this.cleanupController.signal;
        this.querySelector('#add-combat-pc-confirm').addEventListener('click', () => this.confirm(), { signal });
    }

    disconnectedCallback() {
        this.cleanupController.abort();
    }

    confirm() {
        const name = this.querySelector('#combat-pc-name').value.trim();
        const initiative = parseInt(this.querySelector('#combat-pc-initiative').value) || 0;
        if (name) this.confirmHandler?.({ name, initiative });
    }

    // Register the callback invoked with { name, initiative } when the user
    // confirms adding a PC.
    onConfirm(handler) {
        this.confirmHandler = handler;
    }

    open() {
        this.querySelector('#combat-pc-name').value = '';
        this.querySelector('#combat-pc-initiative').value = '';
        this.classList.add('active');
        this.querySelector('#combat-pc-name').focus();
    }
}

if (!customElements.get('combat-pc-modal')) {
    customElements.define('combat-pc-modal', CombatPcModalElement);
}
