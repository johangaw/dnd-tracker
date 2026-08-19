// Monster Stat Block Modal - light-DOM WebComponent
import { setupModalClose } from '../modalBase.js';

class StatBlockModalElement extends HTMLElement {
    cleanupController = null;

    connectedCallback() {
        this.cleanupController = new AbortController();

        this.innerHTML = `
            <div class="modal-content modal-large">
                <div class="modal-header">
                    <h2 id="stat-block-name">Monster Name</h2>
                    <button type="button" class="close-modal" aria-label="Close">&times;</button>
                </div>
                <div class="modal-body">
                    <div id="stat-block-content" class="stat-block"></div>
                </div>
            </div>
        `;

        setupModalClose(this, this.cleanupController.signal);
    }

    disconnectedCallback() {
        this.cleanupController.abort();
    }

    // Populate the stat block with the given monster name and pre-rendered
    // body HTML (see statBlock.js for how the HTML is built), then open it.
    show(name, contentHtml) {
        this.querySelector('#stat-block-name').textContent = name;
        this.querySelector('#stat-block-content').innerHTML = contentHtml;
        this.classList.add('active');
    }
}

if (!customElements.get('stat-block-modal')) {
    customElements.define('stat-block-modal', StatBlockModalElement);
}
