// Combat Monster Search Modal - light-DOM WebComponent
import { setupModalClose } from '../modalBase.js';

class CombatMonsterSearchModalElement extends HTMLElement {
    cleanupController = null;
    searchTimeout = null;
    searchHandler = null;
    quantityDeltaHandler = null;

    connectedCallback() {
        this.cleanupController = new AbortController();

        this.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h2>Add Monster to Combat</h2>
                    <button type="button" class="close-modal" aria-label="Close">&times;</button>
                </div>
                <div class="modal-body">
                    <div class="search-box">
                        <input type="text" id="combat-monster-search-input" placeholder="Search by name...">
                        <select id="combat-monster-source-filter">
                            <option value="" selected>Default</option>
                            <option value="ALL">All Sources</option>
                            <option value="Custom">Custom Monsters</option>
                            <option value="XMM">Monster Manual (2024)</option>
                            <option value="MM">Monster Manual (2014)</option>
                        </select>
                    </div>
                    <div class="quantity-selector">
                        <label>Quantity:</label>
                        <button type="button" class="qty-btn" id="qty-decrease">-</button>
                        <span id="monster-quantity">1</span>
                        <button type="button" class="qty-btn" id="qty-increase">+</button>
                    </div>
                    <div id="combat-monster-search-results" class="search-results"></div>
                </div>
            </div>
        `;

        setupModalClose(this, this.cleanupController.signal);
        this.wireControls();
    }

    disconnectedCallback() {
        this.cleanupController.abort();
        clearTimeout(this.searchTimeout);
    }

    wireControls() {
        const signal = this.cleanupController.signal;
        const input = this.querySelector('#combat-monster-search-input');
        const sourceFilter = this.querySelector('#combat-monster-source-filter');

        input.addEventListener('input', () => {
            clearTimeout(this.searchTimeout);
            const query = input.value;
            this.searchTimeout = setTimeout(() => {
                this.searchHandler?.(query, sourceFilter.value);
            }, 300);
        }, { signal });

        sourceFilter.addEventListener('change', () => {
            if (input.value.length >= 2) {
                this.searchHandler?.(input.value, sourceFilter.value);
            }
        }, { signal });

        this.querySelector('#qty-decrease').addEventListener('click', () => this.quantityDeltaHandler?.(-1), { signal });
        this.querySelector('#qty-increase').addEventListener('click', () => this.quantityDeltaHandler?.(1), { signal });
    }

    // Register the callback invoked (debounced) with (query, source) whenever
    // the user searches.
    onSearch(handler) {
        this.searchHandler = handler;
    }

    // Register the callback invoked with -1/+1 when the quantity buttons are
    // clicked. The caller owns clamping/state and reports the result back via
    // setQuantity().
    onQuantityDelta(handler) {
        this.quantityDeltaHandler = handler;
    }

    setQuantity(value) {
        this.querySelector('#monster-quantity').textContent = value;
    }

    getQuantity() {
        return parseInt(this.querySelector('#monster-quantity').textContent) || 1;
    }

    setResultsHtml(html) {
        this.querySelector('#combat-monster-search-results').innerHTML = html;
    }

    getResultsElement() {
        return this.querySelector('#combat-monster-search-results');
    }

    open() {
        this.querySelector('#combat-monster-search-input').value = '';
        this.setResultsHtml('<div class="search-empty">Type to search for monsters...</div>');
        this.classList.add('active');
        this.querySelector('#combat-monster-search-input').focus();
    }
}

if (!customElements.get('combat-monster-search-modal')) {
    customElements.define('combat-monster-search-modal', CombatMonsterSearchModalElement);
}
