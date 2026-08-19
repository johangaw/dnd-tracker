// HP Adjustment Modal (shared between encounter-run-view and character-view) - light-DOM WebComponent
//
// The modal owns its own controls (adjust buttons, reset/apply, the amount
// input, the character-only temp HP / max-reduction inputs, and the instance
// selector) and simply forwards user actions to whichever caller last called
// configure(). Since only one of encounter-run-view (monster HP) or
// character-view (character HP) ever has the modal open at a time, and each
// re-registers its own callbacks every time it opens the modal, this removes
// the need for any "which mode is active" state or window-global bridge
// between the two callers.
import { setupModalClose } from '../modalBase.js';

class HpModalElement extends HTMLElement {
    cleanupController = null;
    handlers = {};

    connectedCallback() {
        this.cleanupController = new AbortController();

        this.innerHTML = `
            <div class="modal-content modal-small">
                <div class="modal-header">
                    <h2 id="hp-modal-title">Adjust HP</h2>
                    <button type="button" class="close-modal" aria-label="Close">&times;</button>
                </div>
                <div class="modal-body">
                    <!-- Instance selector for grouped monsters -->
                    <div id="hp-instance-selector" class="instance-selector hidden"></div>
                    <div class="hp-display">
                        <span id="current-hp">0</span> / <span id="max-hp">0</span>
                        <span id="hp-temp-display" class="hp-temp-display hidden">+<span id="hp-temp-value">0</span> temp</span>
                    </div>
                    <!-- Character-only fields (hidden for monsters) -->
                    <div id="hp-character-fields" class="hp-character-fields hidden">
                        <div class="hp-field-row">
                            <div class="hp-field">
                                <label for="hp-temp-input">Temp HP</label>
                                <input type="number" id="hp-temp-input" min="0" value="0">
                            </div>
                            <div class="hp-field">
                                <label for="hp-max-reduction">Max HP Reduction</label>
                                <input type="number" id="hp-max-reduction" min="0" value="0">
                            </div>
                        </div>
                    </div>
                    <div class="hp-input-row">
                        <input type="number" id="hp-custom-amount" placeholder="0" value="0">
                        <span id="hp-preview" class="hp-preview hidden">= <span id="hp-preview-value">0</span></span>
                    </div>
                    <div class="hp-controls">
                        <button type="button" class="hp-adj-btn damage" data-amount="-10">-10</button>
                        <button type="button" class="hp-adj-btn damage" data-amount="-5">-5</button>
                        <button type="button" class="hp-adj-btn damage" data-amount="-1">-1</button>
                        <button type="button" class="hp-adj-btn heal" data-amount="1">+1</button>
                        <button type="button" class="hp-adj-btn heal" data-amount="5">+5</button>
                        <button type="button" class="hp-adj-btn heal" data-amount="10">+10</button>
                    </div>
                    <div class="hp-actions">
                        <button type="button" id="hp-reset-btn" class="btn btn-small">Reset</button>
                        <button type="button" id="hp-apply-btn" class="btn btn-primary">Apply</button>
                    </div>
                </div>
            </div>
        `;

        setupModalClose(this, this.cleanupController.signal);
        this.wireControls();
    }

    disconnectedCallback() {
        this.cleanupController.abort();
    }

    wireControls() {
        const signal = this.cleanupController.signal;

        this.querySelectorAll('.hp-adj-btn').forEach(btn => {
            btn.addEventListener('click', () => this.handlers.onAdjust?.(parseInt(btn.dataset.amount)), { signal });
        });

        this.querySelector('#hp-reset-btn').addEventListener('click', () => this.handlers.onReset?.(), { signal });
        this.querySelector('#hp-apply-btn').addEventListener('click', () => this.handlers.onApply?.(), { signal });

        const amountInput = this.querySelector('#hp-custom-amount');
        amountInput.addEventListener('input', () => this.handlers.onAmountInput?.(), { signal });
        amountInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') this.handlers.onApply?.();
        }, { signal });

        this.querySelector('#hp-temp-input').addEventListener('input', () => this.handlers.onTempInput?.(), { signal });
        this.querySelector('#hp-max-reduction').addEventListener('input', () => this.handlers.onMaxReductionInput?.(), { signal });

        this.querySelector('#hp-instance-selector').addEventListener('click', (e) => {
            const btn = e.target.closest('.instance-btn');
            if (btn) this.handlers.onInstanceSelect?.(parseInt(btn.dataset.instance));
        }, { signal });
    }

    // Register the callbacks for whichever caller is currently using the
    // modal. Call this every time the modal is opened.
    configure(handlers) {
        this.handlers = handlers || {};
    }

    open() {
        this.classList.add('active');
    }

    close() {
        this.classList.remove('active');
    }

    setTitle(text) {
        this.querySelector('#hp-modal-title').textContent = text;
    }

    setHpDisplay(current, max) {
        this.querySelector('#current-hp').textContent = current;
        this.querySelector('#max-hp').textContent = max;

        const display = this.querySelector('.hp-display');
        const percent = max > 0 ? current / max : 0;
        display.classList.remove('low', 'critical');
        if (percent <= 0.25) display.classList.add('critical');
        else if (percent <= 0.5) display.classList.add('low');
    }

    setAmount(value) {
        this.querySelector('#hp-custom-amount').value = value;
    }

    getAmount() {
        return parseInt(this.querySelector('#hp-custom-amount').value) || 0;
    }

    showPreview(value, isDead) {
        this.querySelector('#hp-preview').classList.remove('hidden');
        const previewValue = this.querySelector('#hp-preview-value');
        previewValue.textContent = value;
        previewValue.classList.toggle('dead', !!isDead);
    }

    hidePreview() {
        this.querySelector('#hp-preview').classList.add('hidden');
    }

    // kind: 'damage' | 'heal' | null
    setAmountTone(kind) {
        const input = this.querySelector('#hp-custom-amount');
        input.classList.remove('damage', 'heal');
        if (kind) input.classList.add(kind);
    }

    showInstanceSelector(html) {
        const el = this.querySelector('#hp-instance-selector');
        el.innerHTML = html;
        el.classList.remove('hidden');
    }

    hideInstanceSelector() {
        this.querySelector('#hp-instance-selector').classList.add('hidden');
    }

    showCharacterFields() {
        this.querySelector('#hp-character-fields').classList.remove('hidden');
    }

    hideCharacterFields() {
        this.querySelector('#hp-character-fields').classList.add('hidden');
    }

    showTempDisplay(value) {
        this.querySelector('#hp-temp-value').textContent = value;
        this.querySelector('#hp-temp-display').classList.remove('hidden');
    }

    hideTempDisplay() {
        this.querySelector('#hp-temp-display').classList.add('hidden');
    }

    setTempInput(value) {
        this.querySelector('#hp-temp-input').value = value;
    }

    getTempInput() {
        return parseInt(this.querySelector('#hp-temp-input').value) || 0;
    }

    setMaxReductionInput(value) {
        this.querySelector('#hp-max-reduction').value = value;
    }

    getMaxReductionInput() {
        return parseInt(this.querySelector('#hp-max-reduction').value) || 0;
    }
}

if (!customElements.get('hp-modal')) {
    customElements.define('hp-modal', HpModalElement);
}
