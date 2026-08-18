// Custom Monster Edit Component rewritten as a light-DOM WebComponent

import * as CustomMonsters from '../../services/customMonsters.js';
import { getState, setView } from '../../services/state.js';
import * as Router from '../../utils/router.js';
import { escapeHtml } from '../../utils/helpers.js';
import { getHP, getAC, getProficiencyBonus } from '../../services/monsterApi.js';
import { showStatBlock } from '../modals/statBlock.js';

const SIZE_OPTIONS = [
    ['T', 'Tiny'], ['S', 'Small'], ['M', 'Medium'],
    ['L', 'Large'], ['H', 'Huge'], ['G', 'Gargantuan']
];

const TYPE_OPTIONS = [
    'aberration', 'beast', 'celestial', 'construct', 'dragon', 'elemental',
    'fey', 'fiend', 'giant', 'humanoid', 'monstrosity', 'ooze', 'plant', 'undead'
];

const CR_OPTIONS = [
    '0', '1/8', '1/4', '1/2',
    ...Array.from({ length: 30 }, (_, i) => String(i + 1))
];

const ALIGNMENT_OPTIONS = [
    ['LG', 'Lawful Good'], ['NG', 'Neutral Good'], ['CG', 'Chaotic Good'],
    ['LN', 'Lawful Neutral'], ['N', 'Neutral'], ['CN', 'Chaotic Neutral'],
    ['LE', 'Lawful Evil'], ['NE', 'Neutral Evil'], ['CE', 'Chaotic Evil'],
    ['U', 'Unaligned']
];

const ABILITIES = ['str', 'dex', 'con', 'int', 'wis', 'cha'];

class CustomMonsterEditViewElement extends HTMLElement {
    cleanupController = null

    constructor() {
        super();
    }

    connectedCallback() {
        this.cleanupController = new AbortController()

        // Render the internal structure
        this.innerHTML = `
            <form id="custom-monster-form" class="form">
                <!-- Basic Info -->
                <div class="form-section">
                    <div class="section-header">
                        <h3>Basic Info</h3>
                    </div>
                    <div class="form-group">
                        <label for="monster-name">Name *</label>
                        <input type="text" id="monster-name" placeholder="Monster name..." required>
                    </div>
                    <div class="form-row">
                        <div class="form-group">
                            <label for="monster-size">Size</label>
                            <select id="monster-size">
                                ${SIZE_OPTIONS.map(([value, label]) => `<option value="${value}"${value === 'M' ? ' selected' : ''}>${label}</option>`).join('')}
                            </select>
                        </div>
                        <div class="form-group">
                            <label for="monster-type">Type</label>
                            <select id="monster-type">
                                ${TYPE_OPTIONS.map(type => `<option value="${type}"${type === 'humanoid' ? ' selected' : ''}>${type.charAt(0).toUpperCase() + type.slice(1)}</option>`).join('')}
                            </select>
                        </div>
                    </div>
                    <div class="form-row">
                        <div class="form-group">
                            <label for="monster-cr">CR</label>
                            <select id="monster-cr">
                                ${CR_OPTIONS.map(cr => `<option value="${cr}"${cr === '1' ? ' selected' : ''}>${cr}</option>`).join('')}
                            </select>
                            <span id="monster-prof-bonus" class="prof-bonus-display">Prof. +2</span>
                        </div>
                        <div class="form-group">
                            <label for="monster-alignment">Alignment</label>
                            <select id="monster-alignment">
                                ${ALIGNMENT_OPTIONS.map(([value, label]) => `<option value="${value}"${value === 'N' ? ' selected' : ''}>${label}</option>`).join('')}
                            </select>
                        </div>
                    </div>
                </div>

                <!-- Combat Stats -->
                <div class="form-section">
                    <div class="section-header">
                        <h3>Combat Stats</h3>
                    </div>
                    <div class="form-row">
                        <div class="form-group">
                            <label for="monster-ac">AC</label>
                            <input type="number" id="monster-ac" value="10" min="1" max="30">
                        </div>
                        <div class="form-group">
                            <label for="monster-hp">HP</label>
                            <input type="number" id="monster-hp" value="10" min="1">
                        </div>
                        <div class="form-group">
                            <label for="monster-speed">Speed</label>
                            <input type="number" id="monster-speed" value="30" min="0" step="5">
                        </div>
                    </div>
                    <div class="form-group">
                        <label for="monster-hp-formula">HP Formula (optional)</label>
                        <input type="text" id="monster-hp-formula" placeholder="e.g., 2d8+2">
                    </div>
                </div>

                <!-- Ability Scores -->
                <div class="form-section">
                    <div class="section-header">
                        <h3>Ability Scores</h3>
                    </div>
                    <div class="ability-scores-grid">
                        ${ABILITIES.map(ability => `
                            <div class="form-group">
                                <label for="monster-${ability}">${ability.toUpperCase()}</label>
                                <input type="number" id="monster-${ability}" value="10" min="1" max="30">
                            </div>
                        `).join('')}
                    </div>
                </div>

                <!-- Defenses & Senses -->
                <div class="form-section">
                    <div class="section-header">
                        <h3>Defenses &amp; Senses</h3>
                    </div>
                    <div class="form-group">
                        <label for="monster-saves">Saving Throws</label>
                        <input type="text" id="monster-saves" placeholder="e.g., Dex +5, Wis +3">
                    </div>
                    <div class="form-group">
                        <label for="monster-skills">Skills</label>
                        <input type="text" id="monster-skills" placeholder="e.g., Perception +5, Stealth +7">
                    </div>
                    <div class="form-group">
                        <label for="monster-resistances">Damage Resistances</label>
                        <input type="text" id="monster-resistances" placeholder="e.g., fire, cold, bludgeoning">
                    </div>
                    <div class="form-group">
                        <label for="monster-immunities">Damage Immunities</label>
                        <input type="text" id="monster-immunities" placeholder="e.g., poison, necrotic">
                    </div>
                    <div class="form-group">
                        <label for="monster-vulnerabilities">Damage Vulnerabilities</label>
                        <input type="text" id="monster-vulnerabilities" placeholder="e.g., radiant">
                    </div>
                    <div class="form-group">
                        <label for="monster-condition-immunities">Condition Immunities</label>
                        <input type="text" id="monster-condition-immunities" placeholder="e.g., poisoned, frightened">
                    </div>
                    <div class="form-group">
                        <label for="monster-senses">Senses</label>
                        <input type="text" id="monster-senses" placeholder="e.g., darkvision 60 ft., blindsight 30 ft.">
                    </div>
                    <div class="form-group">
                        <label for="monster-passive">Passive Perception</label>
                        <input type="number" id="monster-passive" value="10" min="1" max="30">
                    </div>
                    <div class="form-group">
                        <label for="monster-languages">Languages</label>
                        <input type="text" id="monster-languages" placeholder="e.g., Common, Draconic">
                    </div>
                </div>

                <!-- Traits -->
                <div class="form-section">
                    <div class="section-header">
                        <h3>Traits</h3>
                        <button type="button" id="add-trait-btn" class="btn btn-small">+ Add Trait</button>
                    </div>
                    <div id="traits-list" class="item-list"></div>
                </div>

                <!-- Actions -->
                <div class="form-section">
                    <div class="section-header">
                        <h3>Actions</h3>
                        <button type="button" id="add-action-btn" class="btn btn-small">+ Add Action</button>
                    </div>
                    <div id="actions-list" class="item-list"></div>
                </div>

                <!-- Bonus Actions -->
                <div class="form-section">
                    <div class="section-header">
                        <h3>Bonus Actions</h3>
                        <button type="button" id="add-bonus-btn" class="btn btn-small">+ Add Bonus Action</button>
                    </div>
                    <div id="bonus-list" class="item-list"></div>
                </div>

                <!-- Reactions -->
                <div class="form-section">
                    <div class="section-header">
                        <h3>Reactions</h3>
                        <button type="button" id="add-reaction-btn" class="btn btn-small">+ Add Reaction</button>
                    </div>
                    <div id="reactions-list" class="item-list"></div>
                </div>

                <!-- Spellcasting -->
                <div class="form-section">
                    <div class="section-header">
                        <h3>Spellcasting</h3>
                        <button type="button" id="add-spellcasting-btn" class="btn btn-small">+ Add Spellcasting</button>
                    </div>
                    <div id="spellcasting-list" class="item-list"></div>
                </div>

                <!-- Legendary Actions -->
                <div class="form-section">
                    <div class="section-header">
                        <h3>Legendary Actions</h3>
                        <button type="button" id="add-legendary-btn" class="btn btn-small">+ Add Legendary</button>
                    </div>
                    <div class="legendary-config">
                        <label>
                            Actions per round:
                            <input type="number" id="legendary-actions-count" min="1" max="5" value="3">
                        </label>
                        <label>
                            In lair (0 = same):
                            <input type="number" id="legendary-actions-lair" min="0" max="6" value="0">
                        </label>
                    </div>
                    <div id="legendary-list" class="item-list"></div>
                </div>

                <div class="form-actions">
                    <button type="button" id="preview-monster-btn" class="btn">Preview</button>
                    <button type="submit" class="btn btn-primary">Save Monster</button>
                    <button type="button" id="delete-monster-btn" class="btn btn-danger hidden">Delete</button>
                </div>
            </form>
        `;

        this.setupEventHandlers();
    }

    disconnectedCallback() {
        this.cleanupController.abort()
    }

    setupEventHandlers() {
        const signal = this.cleanupController.signal;

        // Form submission
        this.querySelector('#custom-monster-form').addEventListener('submit', (e) => {
            e.preventDefault();
            this.saveMonster();
        }, {signal});

        // Preview / delete buttons
        this.querySelector('#preview-monster-btn').addEventListener('click', () => this.previewMonster(), {signal});
        this.querySelector('#delete-monster-btn').addEventListener('click', () => this.deleteMonster(), {signal});

        // Add-item buttons
        this.querySelector('#add-trait-btn').addEventListener('click', () => this.addTrait(), {signal});
        this.querySelector('#add-action-btn').addEventListener('click', () => this.addAction(), {signal});
        this.querySelector('#add-bonus-btn').addEventListener('click', () => this.addBonusAction(), {signal});
        this.querySelector('#add-reaction-btn').addEventListener('click', () => this.addReaction(), {signal});
        this.querySelector('#add-spellcasting-btn').addEventListener('click', () => this.addSpellcasting(), {signal});
        this.querySelector('#add-legendary-btn').addEventListener('click', () => this.addLegendaryAction(), {signal});

        // CR change - update proficiency bonus
        this.querySelector('#monster-cr').addEventListener('change', () => this.onCRChange(), {signal});
    }

    // Field value helper
    field(id) {
        return this.querySelector(`#${id}`);
    }

    // Initialize the edit form with a monster (or empty for new)
    render(monster = null) {
        const state = getState();

        state.editingMonster = monster ? { ...monster } : CustomMonsters.createEmptyMonster();

        setView('custom-monster-edit');
        this.renderForm();
    }

    // Initialize from baseline monster
    initFromBaseline(baseMonster) {
        const state = getState();
        state.editingMonster = CustomMonsters.createFromBaseline(baseMonster);
        setView('custom-monster-edit');
        this.renderForm();
    }

    // Render the form with current monster data
    renderForm() {
        const state = getState();
        const monster = state.editingMonster;

        if (!monster) return;

        // Basic info
        this.field('monster-name').value = monster.name || '';
        this.field('monster-size').value = Array.isArray(monster.size) ? monster.size[0] : (monster.size || 'M');
        this.field('monster-type').value = monster.type || 'humanoid';
        this.field('monster-cr').value = formatCRForSelect(monster.cr);
        this.field('monster-alignment').value = formatAlignmentForSelect(monster.alignment);

        // Update proficiency bonus display
        this.updateProficiencyBonus(monster.cr);

        // Combat stats
        this.field('monster-ac').value = getAC(monster);
        this.field('monster-hp').value = getHP(monster);
        this.field('monster-speed').value = monster.speed?.walk || 30;
        this.field('monster-hp-formula').value = monster.hp?.formula || '';

        // Ability scores
        ABILITIES.forEach(ability => {
            this.field(`monster-${ability}`).value = monster[ability] || 10;
        });

        // Defenses & Senses
        this.field('monster-saves').value = formatSaves(monster.save);
        this.field('monster-skills').value = formatSkills(monster.skill);
        this.field('monster-resistances').value = formatDamageList(monster.resist);
        this.field('monster-immunities').value = formatDamageList(monster.immune);
        this.field('monster-vulnerabilities').value = formatDamageList(monster.vulnerable);
        this.field('monster-condition-immunities').value = (monster.conditionImmune || []).join(', ');
        this.field('monster-senses').value = (monster.senses || []).join(', ');
        this.field('monster-passive').value = monster.passive || 10;
        this.field('monster-languages').value = (monster.languages || []).join(', ');

        // Traits and actions
        this.renderTraits();
        this.renderActions();
        this.renderBonusActions();
        this.renderReactions();
        this.renderSpellcasting();
        this.renderLegendaryActions();

        // Show delete button only for existing monsters
        const deleteBtn = this.field('delete-monster-btn');
        if (monster.id && CustomMonsters.getCustomMonster(monster.id)) {
            deleteBtn.classList.remove('hidden');
        } else {
            deleteBtn.classList.add('hidden');
        }
    }

    // Render a name/description item list (traits, actions, bonus actions, reactions, legendary)
    renderEntryList({ containerId, itemClass, prefix, key, emptyHint, namePlaceholder }) {
        const state = getState();
        const container = this.field(containerId);
        const items = state.editingMonster[key] || [];

        if (items.length === 0) {
            container.innerHTML = `<p class="empty-hint">${emptyHint}</p>`;
            return;
        }

        container.innerHTML = items.map((item, index) => `
            <div class="${itemClass} item-row" data-index="${index}">
                <div class="${prefix}-content">
                    <input type="text" class="${prefix}-name" value="${escapeHtml(item.name || '')}" placeholder="${namePlaceholder}">
                    <textarea class="${prefix}-desc" placeholder="Description">${escapeHtml(formatEntries(item.entries))}</textarea>
                </div>
                <div class="item-buttons">
                    <button type="button" class="move-up-btn" data-index="${index}" aria-label="Move up" ${index === 0 ? 'disabled' : ''}>&#9650;</button>
                    <button type="button" class="move-down-btn" data-index="${index}" aria-label="Move down" ${index === items.length - 1 ? 'disabled' : ''}>&#9660;</button>
                    <button type="button" class="remove-btn" data-index="${index}" aria-label="Remove">&times;</button>
                </div>
            </div>
        `).join('');

        const rerender = () => this.renderEntryList({ containerId, itemClass, prefix, key, emptyHint, namePlaceholder });

        // Add change handlers
        container.querySelectorAll(`.${prefix}-name`).forEach((input, i) => {
            input.addEventListener('change', () => this.updateEntry(key, i, 'name', input.value));
        });
        container.querySelectorAll(`.${prefix}-desc`).forEach((textarea, i) => {
            textarea.addEventListener('change', () => this.updateEntry(key, i, 'entries', textarea.value));
        });
        container.querySelectorAll('.remove-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                state.editingMonster[key]?.splice(parseInt(btn.dataset.index), 1);
                rerender();
            });
        });
        container.querySelectorAll('.move-up-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                if (moveItemUp(state.editingMonster[key] || [], parseInt(btn.dataset.index))) rerender();
            });
        });
        container.querySelectorAll('.move-down-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                if (moveItemDown(state.editingMonster[key] || [], parseInt(btn.dataset.index))) rerender();
            });
        });
    }

    renderTraits() {
        this.renderEntryList({
            containerId: 'traits-list',
            itemClass: 'trait-item',
            prefix: 'trait',
            key: 'trait',
            emptyHint: 'No traits added',
            namePlaceholder: 'Trait name'
        });
    }

    renderActions() {
        this.renderEntryList({
            containerId: 'actions-list',
            itemClass: 'action-item',
            prefix: 'action',
            key: 'action',
            emptyHint: 'No actions added',
            namePlaceholder: 'Action name'
        });
    }

    renderBonusActions() {
        this.renderEntryList({
            containerId: 'bonus-list',
            itemClass: 'bonus-item',
            prefix: 'bonus',
            key: 'bonus',
            emptyHint: 'No bonus actions added',
            namePlaceholder: 'Bonus action name'
        });
    }

    renderReactions() {
        this.renderEntryList({
            containerId: 'reactions-list',
            itemClass: 'reaction-item',
            prefix: 'reaction',
            key: 'reaction',
            emptyHint: 'No reactions added',
            namePlaceholder: 'Reaction name'
        });
    }

    renderLegendaryActions() {
        const state = getState();
        const monster = state.editingMonster;

        // Set legendary action counts
        this.field('legendary-actions-count').value = monster.legendaryActions || 3;
        this.field('legendary-actions-lair').value = monster.legendaryActionsLair || 0;

        this.renderEntryList({
            containerId: 'legendary-list',
            itemClass: 'legendary-item',
            prefix: 'legendary',
            key: 'legendary',
            emptyHint: 'No legendary actions added',
            namePlaceholder: "Legendary action name (e.g., 'Attack' or 'Wing Attack (Costs 2 Actions)')"
        });
    }

    // Render spellcasting list
    renderSpellcasting() {
        const state = getState();
        const monster = state.editingMonster;
        const container = this.field('spellcasting-list');

        const spellcasting = monster.spellcasting || [];

        if (spellcasting.length === 0) {
            container.innerHTML = '<p class="empty-hint">No spellcasting added</p>';
            return;
        }

        container.innerHTML = spellcasting.map((sc, index) => `
            <div class="spellcasting-item item-row" data-index="${index}">
                <div class="spellcasting-content">
                    <input type="text" class="spellcasting-name" value="${escapeHtml(sc.name || 'Spellcasting')}" placeholder="Spellcasting name">
                    <textarea class="spellcasting-header" placeholder="Header (e.g., 'The mage is a 5th-level spellcaster. Its spellcasting ability is Intelligence (spell save DC 14, +6 to hit).')">${escapeHtml(formatEntries(sc.headerEntries || []))}</textarea>
                    <textarea class="spellcasting-spells" placeholder="Spells (one per line, format: 'Cantrips: fire bolt, light' or '1st (4 slots): magic missile, shield' or 'At will: detect magic' or '1/day each: fireball, lightning bolt')">${escapeHtml(formatSpellcastingForEdit(sc))}</textarea>
                </div>
                <div class="item-buttons">
                    <button type="button" class="move-up-btn" data-index="${index}" aria-label="Move up" ${index === 0 ? 'disabled' : ''}>&#9650;</button>
                    <button type="button" class="move-down-btn" data-index="${index}" aria-label="Move down" ${index === spellcasting.length - 1 ? 'disabled' : ''}>&#9660;</button>
                    <button type="button" class="remove-btn" data-index="${index}" aria-label="Remove">&times;</button>
                </div>
            </div>
        `).join('');

        // Add change handlers
        container.querySelectorAll('.spellcasting-name').forEach((input, i) => {
            input.addEventListener('change', () => this.updateSpellcasting(i, 'name', input.value));
        });
        container.querySelectorAll('.spellcasting-header').forEach((textarea, i) => {
            textarea.addEventListener('change', () => this.updateSpellcasting(i, 'headerEntries', textarea.value));
        });
        container.querySelectorAll('.spellcasting-spells').forEach((textarea, i) => {
            textarea.addEventListener('change', () => this.updateSpellcastingSpells(i, textarea.value));
        });
        container.querySelectorAll('.remove-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                getState().editingMonster.spellcasting?.splice(parseInt(btn.dataset.index), 1);
                this.renderSpellcasting();
            });
        });
        container.querySelectorAll('.move-up-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                if (moveItemUp(getState().editingMonster.spellcasting || [], parseInt(btn.dataset.index))) this.renderSpellcasting();
            });
        });
        container.querySelectorAll('.move-down-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                if (moveItemDown(getState().editingMonster.spellcasting || [], parseInt(btn.dataset.index))) this.renderSpellcasting();
            });
        });
    }

    // Update a name/entries item in the editing monster
    updateEntry(key, index, fieldName, value) {
        const monster = getState().editingMonster;
        if (!monster[key]) monster[key] = [];
        if (!monster[key][index]) monster[key][index] = {};

        if (fieldName === 'entries') {
            monster[key][index].entries = parseEntries(value);
        } else {
            monster[key][index][fieldName] = value;
        }
    }

    // Append an empty name/entries item and re-render its list
    addEntry(key, rerender) {
        const monster = getState().editingMonster;
        if (!monster[key]) monster[key] = [];
        monster[key].push({ name: '', entries: [] });
        rerender();
    }

    addTrait() {
        this.addEntry('trait', () => this.renderTraits());
    }

    addAction() {
        this.addEntry('action', () => this.renderActions());
    }

    addBonusAction() {
        this.addEntry('bonus', () => this.renderBonusActions());
    }

    addReaction() {
        this.addEntry('reaction', () => this.renderReactions());
    }

    addLegendaryAction() {
        this.addEntry('legendary', () => this.renderLegendaryActions());
    }

    // Update spellcasting field
    updateSpellcasting(index, fieldName, value) {
        const monster = getState().editingMonster;
        if (!monster.spellcasting) monster.spellcasting = [];
        if (!monster.spellcasting[index]) monster.spellcasting[index] = { type: 'spellcasting' };

        if (fieldName === 'headerEntries') {
            monster.spellcasting[index].headerEntries = parseEntries(value);
        } else {
            monster.spellcasting[index][fieldName] = value;
        }
    }

    // Update spellcasting spells from text
    updateSpellcastingSpells(index, text) {
        const monster = getState().editingMonster;
        if (!monster.spellcasting) monster.spellcasting = [];
        if (!monster.spellcasting[index]) monster.spellcasting[index] = { type: 'spellcasting' };

        const parsed = parseSpellcastingText(text);
        const sc = monster.spellcasting[index];

        // Clear existing spell data
        delete sc.will;
        delete sc.daily;
        delete sc.spells;

        // Apply parsed data
        if (parsed.will) sc.will = parsed.will;
        if (parsed.daily) sc.daily = parsed.daily;
        if (parsed.spells) sc.spells = parsed.spells;
    }

    addSpellcasting() {
        const monster = getState().editingMonster;
        if (!monster.spellcasting) monster.spellcasting = [];
        monster.spellcasting.push({
            name: 'Spellcasting',
            type: 'spellcasting',
            headerEntries: []
        });
        this.renderSpellcasting();
    }

    // Collect form data into monster object
    collectFormData() {
        const state = getState();
        const monster = state.editingMonster;

        monster.name = this.field('monster-name').value.trim();
        monster.size = [this.field('monster-size').value];
        monster.type = this.field('monster-type').value;
        monster.cr = this.field('monster-cr').value;
        monster.alignment = [this.field('monster-alignment').value];

        const ac = parseInt(this.field('monster-ac').value) || 10;
        monster.ac = [{ ac }];

        const hp = parseInt(this.field('monster-hp').value) || 10;
        const hpFormula = this.field('monster-hp-formula').value.trim();
        monster.hp = { average: hp, formula: hpFormula || `${Math.ceil(hp / 4.5)}d8` };

        monster.speed = { walk: parseInt(this.field('monster-speed').value) || 30 };

        ABILITIES.forEach(ability => {
            monster[ability] = parseInt(this.field(`monster-${ability}`).value) || 10;
        });

        // Defenses & Senses
        monster.save = parseSaves(this.field('monster-saves').value);
        monster.skill = parseSkills(this.field('monster-skills').value);
        monster.resist = parseCommaList(this.field('monster-resistances').value);
        monster.immune = parseCommaList(this.field('monster-immunities').value);
        monster.vulnerable = parseCommaList(this.field('monster-vulnerabilities').value);
        monster.conditionImmune = parseCommaList(this.field('monster-condition-immunities').value);
        monster.senses = parseCommaList(this.field('monster-senses').value);
        monster.passive = parseInt(this.field('monster-passive').value) || 10;
        monster.languages = parseCommaList(this.field('monster-languages').value);

        // Clean up empty arrays/objects
        if (!monster.resist || monster.resist.length === 0) delete monster.resist;
        if (!monster.immune || monster.immune.length === 0) delete monster.immune;
        if (!monster.vulnerable || monster.vulnerable.length === 0) delete monster.vulnerable;
        if (!monster.conditionImmune || monster.conditionImmune.length === 0) delete monster.conditionImmune;
        if (!monster.senses || monster.senses.length === 0) delete monster.senses;
        if (!monster.languages || monster.languages.length === 0) delete monster.languages;

        // Legendary actions config
        const legendaryCount = parseInt(this.field('legendary-actions-count').value) || 3;
        const legendaryLair = parseInt(this.field('legendary-actions-lair').value) || 0;
        if (monster.legendary && monster.legendary.length > 0) {
            monster.legendaryActions = legendaryCount;
            if (legendaryLair > 0 && legendaryLair !== legendaryCount) {
                monster.legendaryActionsLair = legendaryLair;
            } else {
                delete monster.legendaryActionsLair;
            }
        } else {
            delete monster.legendaryActions;
            delete monster.legendaryActionsLair;
        }

        monster.source = 'Custom';
        monster.isCustom = true;

        return monster;
    }

    // Preview monster stat block
    previewMonster() {
        const monster = this.collectFormData();

        if (!monster.name) {
            alert('Monster name is required for preview');
            return;
        }

        showStatBlock(monster);
    }

    // Collect form data and save monster
    saveMonster() {
        const monster = this.collectFormData();

        if (!monster.name) {
            alert('Monster name is required');
            return;
        }

        CustomMonsters.saveCustomMonster(monster);

        // Return to list
        Router.navigateToList('monsters');
    }

    // Delete current monster
    deleteMonster() {
        const monster = getState().editingMonster;

        if (monster && monster.id) {
            if (confirm(`Delete "${monster.name}"?`)) {
                CustomMonsters.deleteCustomMonster(monster.id);
                Router.navigateToList('monsters');
            }
        }
    }

    // Update proficiency bonus display based on CR
    updateProficiencyBonus(cr) {
        const profEl = this.field('monster-prof-bonus');
        if (profEl) {
            profEl.textContent = `Prof. +${getProficiencyBonus(cr)}`;
        }
    }

    // Handle CR change to update proficiency bonus
    onCRChange() {
        this.updateProficiencyBonus(this.field('monster-cr').value);
    }
}

// Format CR for select element
function formatCRForSelect(cr) {
    if (!cr) return '1';
    if (typeof cr === 'object') return cr.cr || '1';
    return String(cr);
}

// Format alignment for select element
function formatAlignmentForSelect(alignment) {
    if (!alignment) return 'N';
    if (Array.isArray(alignment)) {
        // Handle 5e.tools format like ['N', 'E'] for Neutral Evil
        if (alignment.length === 2) {
            const [a, b] = alignment;
            if (a === 'N' && b === 'E') return 'NE';
            if (a === 'N' && b === 'G') return 'NG';
            if (a === 'L' && b === 'G') return 'LG';
            if (a === 'L' && b === 'E') return 'LE';
            if (a === 'L' && b === 'N') return 'LN';
            if (a === 'C' && b === 'G') return 'CG';
            if (a === 'C' && b === 'E') return 'CE';
            if (a === 'C' && b === 'N') return 'CN';
        }
        return alignment[0] || 'N';
    }
    return alignment;
}

// Format saving throws for display (e.g., {str: "+5", dex: "+3"} -> "Str +5, Dex +3")
function formatSaves(save) {
    if (!save || typeof save !== 'object') return '';
    return Object.entries(save)
        .map(([k, v]) => `${k.charAt(0).toUpperCase() + k.slice(1)} ${v}`)
        .join(', ');
}

// Parse saving throws from input (e.g., "Str +5, Dex +3" -> {str: "+5", dex: "+3"})
function parseSaves(text) {
    if (!text.trim()) return undefined;
    const result = {};
    const parts = text.split(',').map(p => p.trim()).filter(p => p);
    parts.forEach(part => {
        const match = part.match(/^(str|dex|con|int|wis|cha)\s*([+-]?\d+)/i);
        if (match) {
            const ability = match[1].toLowerCase();
            const bonus = match[2].startsWith('+') || match[2].startsWith('-') ? match[2] : `+${match[2]}`;
            result[ability] = bonus;
        }
    });
    return Object.keys(result).length > 0 ? result : undefined;
}

// Format skills for display (e.g., {perception: "+5"} -> "Perception +5")
function formatSkills(skill) {
    if (!skill || typeof skill !== 'object') return '';
    return Object.entries(skill)
        .map(([k, v]) => `${k.charAt(0).toUpperCase() + k.slice(1)} ${v}`)
        .join(', ');
}

// Parse skills from input (e.g., "Perception +5, Stealth +7" -> {perception: "+5", stealth: "+7"})
function parseSkills(text) {
    if (!text.trim()) return undefined;
    const result = {};
    const parts = text.split(',').map(p => p.trim()).filter(p => p);
    parts.forEach(part => {
        const match = part.match(/^(\w+)\s*([+-]?\d+)/i);
        if (match) {
            const skill = match[1].toLowerCase();
            const bonus = match[2].startsWith('+') || match[2].startsWith('-') ? match[2] : `+${match[2]}`;
            result[skill] = bonus;
        }
    });
    return Object.keys(result).length > 0 ? result : undefined;
}

// Format damage types list for display
function formatDamageList(list) {
    if (!list || !Array.isArray(list) || list.length === 0) return '';
    return list.join(', ');
}

// Parse comma-separated list into array
function parseCommaList(text) {
    if (!text.trim()) return [];
    return text.split(',').map(p => p.trim()).filter(p => p);
}

// Format entries array to string
function formatEntries(entries) {
    if (!entries) return '';
    if (typeof entries === 'string') return entries;
    if (Array.isArray(entries)) {
        return entries.map(e => typeof e === 'string' ? e : JSON.stringify(e)).join('\n');
    }
    return '';
}

// Parse entries string to array
function parseEntries(text) {
    if (!text) return [];
    return text.split('\n').filter(line => line.trim());
}

// Generic move item up in array
function moveItemUp(array, index) {
    if (index <= 0 || index >= array.length) return false;
    [array[index - 1], array[index]] = [array[index], array[index - 1]];
    return true;
}

// Generic move item down in array
function moveItemDown(array, index) {
    if (index < 0 || index >= array.length - 1) return false;
    [array[index], array[index + 1]] = [array[index + 1], array[index]];
    return true;
}

// Format spellcasting object to editable text
function formatSpellcastingForEdit(sc) {
    const lines = [];

    // At-will spells
    if (sc.will && sc.will.length > 0) {
        lines.push(`At will: ${sc.will.map(cleanSpellName).join(', ')}`);
    }

    // Daily spells
    if (sc.daily) {
        const dailyOrder = ['4e', '4', '3e', '3', '2e', '2', '1e', '1'];
        dailyOrder.forEach(key => {
            if (sc.daily[key] && sc.daily[key].length > 0) {
                const times = key.charAt(0);
                const each = key.includes('e') ? ' each' : '';
                lines.push(`${times}/day${each}: ${sc.daily[key].map(cleanSpellName).join(', ')}`);
            }
        });
    }

    // Spell slots by level
    if (sc.spells) {
        Object.keys(sc.spells).sort((a, b) => parseInt(a) - parseInt(b)).forEach(level => {
            const spellLevel = sc.spells[level];
            if (spellLevel.spells && spellLevel.spells.length > 0) {
                if (level === '0') {
                    lines.push(`Cantrips: ${spellLevel.spells.map(cleanSpellName).join(', ')}`);
                } else {
                    const suffix = level === '1' ? 'st' : level === '2' ? 'nd' : level === '3' ? 'rd' : 'th';
                    const slots = spellLevel.slots ? ` (${spellLevel.slots} slots)` : '';
                    lines.push(`${level}${suffix}${slots}: ${spellLevel.spells.map(cleanSpellName).join(', ')}`);
                }
            }
        });
    }

    return lines.join('\n');
}

// Clean spell name from 5e.tools format
function cleanSpellName(spell) {
    if (typeof spell === 'string') {
        return spell.replace(/{@spell ([^|}]+)(\|[^}]*)?}/g, '$1').replace(/{@[^}]+}/g, '');
    }
    return '';
}

// Parse spellcasting text back to 5e.tools format
function parseSpellcastingText(text) {
    const result = {};
    const lines = text.split('\n').filter(line => line.trim());

    lines.forEach(line => {
        const colonIndex = line.indexOf(':');
        if (colonIndex === -1) return;

        const prefix = line.substring(0, colonIndex).trim().toLowerCase();
        const spellsText = line.substring(colonIndex + 1).trim();
        const spells = spellsText.split(',').map(s => s.trim()).filter(s => s);

        if (spells.length === 0) return;

        if (prefix === 'at will') {
            result.will = spells;
        } else if (prefix === 'cantrips') {
            if (!result.spells) result.spells = {};
            result.spells['0'] = { spells };
        } else if (prefix.match(/^\d\/day/)) {
            // Parse "1/day", "2/day each", etc.
            const match = prefix.match(/^(\d)\/day( each)?/);
            if (match) {
                if (!result.daily) result.daily = {};
                const key = match[2] ? `${match[1]}e` : match[1];
                result.daily[key] = spells;
            }
        } else if (prefix.match(/^\d+(st|nd|rd|th)/)) {
            // Parse "1st (4 slots)", "2nd", etc.
            const match = prefix.match(/^(\d+)(st|nd|rd|th)(\s*\((\d+)\s*slots?\))?/);
            if (match) {
                if (!result.spells) result.spells = {};
                const level = match[1];
                const slots = match[4] ? parseInt(match[4]) : undefined;
                result.spells[level] = slots ? { slots, spells } : { spells };
            }
        }
    });

    return result;
}

// Register element if not already registered
if (!customElements.get('custom-monster-edit-view')) {
    customElements.define('custom-monster-edit-view', CustomMonsterEditViewElement);
}

// Compatibility exports used elsewhere in app
export function render(monster = null) {
    const el = document.querySelector('custom-monster-edit-view');
    if (el && typeof el.render === 'function') el.render(monster);
}

export function init(monster = null) {
    render(monster);
}

export function initFromBaseline(baseMonster) {
    const el = document.querySelector('custom-monster-edit-view');
    if (el && typeof el.initFromBaseline === 'function') el.initFromBaseline(baseMonster);
}

export default {
    render,
    init,
    initFromBaseline
};
