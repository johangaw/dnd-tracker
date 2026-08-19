// Spell Detail Modal - light-DOM WebComponent
import { setupModalClose } from '../modalBase.js';

class SpellModalElement extends HTMLElement {
    cleanupController = null;

    connectedCallback() {
        this.cleanupController = new AbortController();

        this.innerHTML = `
            <div class="modal-content modal-large">
                <div class="modal-header">
                    <h2 id="spell-modal-name">Spell Name</h2>
                    <button type="button" class="close-modal" aria-label="Close">&times;</button>
                </div>
                <div class="modal-body">
                    <div id="spell-modal-content" class="spell-block"></div>
                </div>
            </div>
        `;

        setupModalClose(this, this.cleanupController.signal);
    }

    disconnectedCallback() {
        this.cleanupController.abort();
    }

    // Populate the modal with the given spell name and pre-rendered body HTML
    // (see spellModal.js for how the HTML is built), then open it.
    show(name, contentHtml) {
        this.querySelector('#spell-modal-name').textContent = name;
        this.querySelector('#spell-modal-content').innerHTML = contentHtml;
        this.classList.add('active');
    }

    close() {
        this.classList.remove('active');
    }

    isActive() {
        return this.classList.contains('active');
    }
}

if (!customElements.get('spell-modal')) {
    customElements.define('spell-modal', SpellModalElement);
}
