import { setupModalClose } from '../modalBase.js';
import { searchMonsters } from '../monsterSearchModal.js';
import * as MonsterAPI from '../../../services/monsterApi.js';
import * as CustomMonsters from '../../../services/customMonsters.js';
import { escapeHtml, formatEntries, formatName } from '../../../utils/helpers.js';
import { showStatBlock } from '../statBlock.js';

const SECTIONS = [
    ['trait', 'Traits'], ['action', 'Actions / Attacks'],
    ['bonus', 'Bonus Actions'], ['reaction', 'Reactions'],
    ['spellcasting', 'Spellcasting'], ['legendary', 'Legendary Actions']
];

// Escape homebrew text before applying the same rules markup as stat blocks.
function renderEntries(entries = []) {
    if (!Array.isArray(entries)) entries = [entries];
    return entries.map(entry => {
        if (typeof entry === 'string') return `<p>${formatEntries([escapeHtml(entry)])}</p>`;
        if (!entry || typeof entry !== 'object') return '';
        if (entry.type === 'list') {
            return `<ul>${(entry.items || []).map(item => `<li>${renderEntries(item)}</li>`).join('')}</ul>`;
        }
        return `${entry.name ? `<strong>${escapeHtml(entry.name)}</strong>` : ''}${renderEntries(entry.entries || entry.entry || [])}`;
    }).join('');
}

function renderDescription(entry, key) {
    if (key !== 'spellcasting') return renderEntries(entry.entries);
    let html = renderEntries(entry.headerEntries);
    for (const [field, label] of [['constant', 'Constant'], ['will', 'At will'], ['ritual', 'Rituals']]) {
        if (entry[field]?.length) html += `<p><strong>${label}:</strong> ${formatEntries([escapeHtml(entry[field].join(', '))])}</p>`;
    }
    for (const [field, period] of [['daily', 'day'], ['rest', 'rest'], ['weekly', 'week'], ['monthly', 'month'], ['yearly', 'year']]) {
        for (const [frequency, spells] of Object.entries(entry[field] || {})) {
            html += `<p><strong>${escapeHtml(frequency.replace('e', ''))}/${period}${frequency.endsWith('e') ? ' each' : ''}:</strong> ${formatEntries([escapeHtml(spells.join(', '))])}</p>`;
        }
    }
    for (const [level, data] of Object.entries(entry.spells || {})) {
        const label = level === '0' ? 'Cantrips' : `Level ${escapeHtml(level)}${data.slots ? ` (${escapeHtml(String(data.slots))} slots)` : ''}`;
        html += `<p><strong>${label}:</strong> ${formatEntries([escapeHtml((data.spells || []).join(', '))])}</p>`;
    }
    return html + renderEntries(entry.footerEntries);
}

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
                    <div id="feature-search-step">
                    <p class="feature-hint">Search for a monster to borrow features from.</p>
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
                    </div>
                    <div id="feature-selection-step" hidden>
                        <button type="button" id="feature-change-monster" class="btn btn-small">&#8592; Change monster</button>
                        <div id="feature-options" aria-live="polite"></div>
                    </div>
                </div>
                    <div class="feature-import-footer">
                        <span id="feature-selection-count" role="status">No features selected</span>
                        <button type="button" id="feature-cancel" class="btn">Cancel</button>
                        <button type="button" id="import-selected-features" class="btn btn-primary" disabled>Import Selected</button>
                    </div>
            </div>`;
        setupModalClose(this, signal);
        this.querySelector('#feature-cancel').addEventListener('click', () => this.classList.remove('active'), { signal });
        this.querySelector('#feature-change-monster').addEventListener('click', () => {
            this.resetSelection();
            this.showStep(false);
            this.querySelector('#feature-monster-search').focus();
        }, { signal });
        this.querySelector('#feature-monster-search').addEventListener('input', () => this.search(), { signal });
        this.querySelector('#feature-source').addEventListener('change', () => this.search(), { signal });
        this.querySelector('#feature-options').addEventListener('change', () => {
            const count = this.querySelectorAll('input[name="feature"]:checked').length;
            this.querySelector('#import-selected-features').disabled = count === 0;
            this.querySelector('#feature-selection-count').textContent = count ? `${count} selected` : 'No features selected';
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
        this.querySelector('#feature-selection-count').textContent = 'No features selected';
    }

    showStep(selected) {
        this.querySelector('#feature-search-step').hidden = selected;
        this.querySelector('#feature-selection-step').hidden = !selected;
        this.querySelector('.modal-body').scrollTop = 0;
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
        this.showStep(false);
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
        this.showStep(true);
        const request = this.request;
        const options = this.querySelector('#feature-options');
        options.textContent = 'Loading features...';
        try {
            const monster = await this.loadMonster(selection);
            if (this.request !== request || !this.classList.contains('active')) return;
            if (!monster) throw new Error('Monster unavailable');
            let html = `<h3 class="feature-monster-name" tabindex="-1">${escapeHtml(monster.name)}</h3><p class="feature-hint">Select the features to import. Existing features will be kept.</p>`;
            for (const [key, label] of SECTIONS) {
                if (!monster[key]?.length) continue;
                html += `<section class="feature-section"><h4>${label}</h4>`;
                for (const entry of monster[key]) {
                    const index = this.features.push({ key, entry }) - 1;
                    html += `<article class="feature-choice">
                        <label class="feature-choice-heading"><input type="checkbox" name="feature" value="${index}" aria-describedby="feature-description-${index}"><span>${formatName(escapeHtml(entry.name || label))}</span></label>
                        <div id="feature-description-${index}" class="feature-description">${renderDescription(entry, key)}</div>
                    </article>`;
                }
                html += '</section>';
            }
            options.innerHTML = html + (this.features.length ? '' : '<p>This monster has no features to import.</p>');
            options.querySelector('h3').focus();
        } catch {
            if (this.request === request) options.textContent = 'Unable to load monster. Please try again.';
        }
    }
}

if (!customElements.get('import-features-modal')) {
    customElements.define('import-features-modal', ImportFeaturesModalElement);
}
