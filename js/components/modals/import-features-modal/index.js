import { setupModalClose } from '../modalBase.js';
import { searchMonsters } from '../monsterSearchModal.js';
import * as MonsterAPI from '../../../services/monsterApi.js';
import * as CustomMonsters from '../../../services/customMonsters.js';
import { escapeHtml } from '../../../utils/helpers.js';
import { showStatBlock } from '../statBlock.js';

const SECTIONS = [
    ['trait', 'Traits'], ['action', 'Actions / Attacks'],
    ['bonus', 'Bonus Actions'], ['reaction', 'Reactions'],
    ['spellcasting', 'Spellcasting'], ['legendary', 'Legendary Actions']
];

class ImportFeaturesModalElement extends HTMLElement {
    connectedCallback() {
        this.controller = new AbortController();
        const signal = this.controller.signal;
        this.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h2>Import Features</h2>
                    <button type="button" class="close-modal" aria-label="Close">&times;</button>
                </div>
                <div class="modal-body">
                    <p>Search for a monster, then choose the features to copy.</p>
                    <div class="search-box">
                        <input id="feature-monster-search" type="search" placeholder="Search by name..." aria-label="Search monsters for features">
                        <select id="feature-source" aria-label="Monster source">
                            <option value="">Default</option>
                            <option value="ALL">All Sources</option>
                            <option value="Custom">Custom Monsters</option>
                            <option value="XMM">Monster Manual (2024)</option>
                            <option value="MM">Monster Manual (2014)</option>
                        </select>
                    </div>
                    <div id="feature-monster-results" class="search-results"></div>
                    <div id="feature-options" aria-live="polite"></div>
                    <div class="form-actions">
                        <button type="button" class="btn close-modal">Cancel</button>
                        <button type="button" id="import-selected-features" class="btn btn-primary" disabled>Import Selected</button>
                    </div>
                </div>
            </div>`;
        setupModalClose(this, signal);
        this.querySelector('#feature-monster-search').addEventListener('input', () => this.search(), { signal });
        this.querySelector('#feature-source').addEventListener('change', () => this.search(), { signal });
        this.querySelector('#feature-options').addEventListener('change', () => {
            this.querySelector('#import-selected-features').disabled = !this.querySelector('input[name="feature"]:checked');
        }, { signal });
        this.querySelector('#import-selected-features').addEventListener('click', () => {
            const selected = [...this.querySelectorAll('input[name="feature"]:checked')]
                .map(input => this.features[Number(input.value)]);
            if (!selected.length) return;
            this.onImport(selected);
            this.classList.remove('active');
            this.resetSelection();
        }, { signal });
    }

    disconnectedCallback() {
        this.request = {};
        this.controller.abort();
    }

    resetSelection() {
        this.request = {};
        this.features = [];
        this.querySelector('#feature-options').replaceChildren();
        this.querySelector('#import-selected-features').disabled = true;
    }

    open(onImport) {
        this.onImport = onImport;
        this.querySelector('#feature-monster-search').value = '';
        this.querySelector('#feature-source').value = '';
        this.classList.add('active');
        void this.search();
        this.querySelector('#feature-monster-search').focus();
    }

    search() {
        this.resetSelection();
        return searchMonsters({
            query: this.querySelector('#feature-monster-search').value,
            source: this.querySelector('#feature-source').value,
            container: this.querySelector('#feature-monster-results'),
            onSelect: selection => this.selectMonster(selection),
            onViewStats: async selection => {
                try {
                    const monster = await this.loadMonster(selection);
                    if (monster) showStatBlock(monster);
                } catch {
                    this.querySelector('#feature-options').textContent = 'Unable to load monster. Please try again.';
                }
            }
        });
    }

    loadMonster({ name, source, id }) {
        return source === 'Custom'
            ? CustomMonsters.getCustomMonster(id)
            : MonsterAPI.getMonster(name, source);
    }

    async selectMonster(selection) {
        this.resetSelection();
        const request = this.request;
        const options = this.querySelector('#feature-options');
        options.textContent = 'Loading features...';
        try {
            const monster = await this.loadMonster(selection);
            if (this.request !== request || !this.classList.contains('active')) return;
            if (!monster) throw new Error('Monster unavailable');
            let html = `<h3>${escapeHtml(monster.name)}</h3>`;
            for (const [key, label] of SECTIONS) {
                if (!monster[key]?.length) continue;
                html += `<h4>${label}</h4>`;
                for (const entry of monster[key]) {
                    const index = this.features.push({ key, entry }) - 1;
                    html += `<div class="form-group"><label><input type="checkbox" name="feature" value="${index}"> ${escapeHtml(entry.name || label)}</label></div>`;
                }
            }
            options.innerHTML = html + (this.features.length ? '' : '<p>This monster has no features to import.</p>');
        } catch {
            if (this.request === request) options.textContent = 'Unable to load monster. Please try again.';
        }
    }
}

if (!customElements.get('import-features-modal')) {
    customElements.define('import-features-modal', ImportFeaturesModalElement);
}
