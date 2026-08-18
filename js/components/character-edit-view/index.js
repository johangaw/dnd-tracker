// Character Edit Component (character sheet editor) as a light-DOM WebComponent

import * as Characters from '../../services/characters.js';
import * as Spells from '../../services/spells.js';
import * as ClassFeatures from '../../services/classFeatures.js';
import * as ClassSpellLists from '../../data/classSpellLists.js';
import { getState, setView } from '../../services/state.js';
import * as Router from '../../utils/router.js';
import { escapeHtml, showToast } from '../../utils/helpers.js';

// Feature picker state
let featurePickerState = {
    allFeatures: [],
    displayedCount: 0,
    batchSize: 50
};

// Spell picker state
let spellPickerState = {
    allSpells: [],
    displayedCount: 0,
    batchSize: 50
};

const SKILL_ROWS = [
    ['acrobatics', 'Acrobatics', 'Dex'],
    ['animalHandling', 'Animal Handling', 'Wis'],
    ['arcana', 'Arcana', 'Int'],
    ['athletics', 'Athletics', 'Str'],
    ['deception', 'Deception', 'Cha'],
    ['history', 'History', 'Int'],
    ['insight', 'Insight', 'Wis'],
    ['intimidation', 'Intimidation', 'Cha'],
    ['investigation', 'Investigation', 'Int'],
    ['medicine', 'Medicine', 'Wis'],
    ['nature', 'Nature', 'Int'],
    ['perception', 'Perception', 'Wis'],
    ['performance', 'Performance', 'Cha'],
    ['persuasion', 'Persuasion', 'Cha'],
    ['religion', 'Religion', 'Int'],
    ['sleightOfHand', 'Sleight of Hand', 'Dex'],
    ['stealth', 'Stealth', 'Dex'],
    ['survival', 'Survival', 'Wis']
];

const CLASS_SUGGESTIONS = [
    'Barbarian', 'Bard', 'Cleric', 'Druid', 'Fighter', 'Monk',
    'Paladin', 'Ranger', 'Rogue', 'Sorcerer', 'Warlock', 'Wizard'
];

const ABILITY_BOXES = [
    ['str', 'STR'], ['dex', 'DEX'], ['con', 'CON'],
    ['int', 'INT'], ['wis', 'WIS'], ['cha', 'CHA']
];

class CharacterEditViewElement extends HTMLElement {
    cleanupController = null

    constructor() {
        super();
    }

    connectedCallback() {
        this.cleanupController = new AbortController()

        this.innerHTML = `
            <form id="character-form" class="form">
                <!-- Basic Info -->
                <div class="form-section">
                    <div class="section-header">
                        <h3>Basic Info</h3>
                    </div>
                    <div class="form-group">
                        <label for="char-name">Character Name *</label>
                        <input type="text" id="char-name" placeholder="Character name..." required>
                    </div>
                    <div class="form-row">
                        <div class="form-group">
                            <label for="char-class">Class</label>
                            <input type="text" id="char-class" placeholder="Fighter, Wizard..." list="class-suggestions" autocomplete="off">
                            <datalist id="class-suggestions">
                                ${CLASS_SUGGESTIONS.map(name => `<option value="${name}">`).join('\n                                ')}
                            </datalist>
                        </div>
                        <div class="form-group">
                            <label for="char-level">Level</label>
                            <input type="number" id="char-level" min="1" max="20" value="1">
                        </div>
                    </div>
                    <div class="form-group">
                        <label for="char-subclass">Subclass</label>
                        <input type="text" id="char-subclass" placeholder="Champion, Evocation..." list="subclass-suggestions" autocomplete="off">
                        <datalist id="subclass-suggestions"></datalist>
                    </div>
                    <div class="form-row">
                        <div class="form-group">
                            <label for="char-species">Species</label>
                            <input type="text" id="char-species" placeholder="Human, Elf...">
                        </div>
                        <div class="form-group">
                            <label for="char-background">Background</label>
                            <input type="text" id="char-background" placeholder="Soldier, Sage...">
                        </div>
                    </div>
                    <div class="form-row">
                        <div class="form-group">
                            <label for="char-alignment">Alignment</label>
                            <input type="text" id="char-alignment" placeholder="Lawful Good...">
                        </div>
                        <div class="form-group">
                            <label for="char-xp">Experience Points</label>
                            <input type="number" id="char-xp" min="0" value="0">
                        </div>
                    </div>
                    <div class="proficiency-display">
                        Proficiency Bonus: <span id="char-prof-bonus">+2</span>
                    </div>
                </div>

                <!-- Ability Scores -->
                <div class="form-section">
                    <div class="section-header">
                        <h3>Ability Scores</h3>
                    </div>
                    <div class="abilities-edit-grid">
                        ${ABILITY_BOXES.map(([key, label]) => `
                            <div class="ability-edit-box">
                                <label>${label}</label>
                                <input type="number" id="char-${key}" min="1" max="30" value="10">
                                <span id="char-${key}-mod" class="ability-mod-display">+0</span>
                                <label class="save-checkbox"><input type="checkbox" id="char-save-${key}"> Save</label>
                            </div>
                        `).join('')}
                    </div>
                </div>

                <!-- Skills -->
                <div class="form-section">
                    <div class="section-header">
                        <h3>Skills</h3>
                    </div>
                    <div class="skills-edit-grid">
                        ${SKILL_ROWS.map(([key, label, ability]) => `<div class="skill-edit-row"><label><input type="checkbox" id="char-skill-${key}"> ${label}</label><span class="skill-ability">(${ability})</span><label class="expertise-label"><input type="checkbox" id="char-expertise-${key}"> Exp</label></div>`).join('\n                        ')}
                    </div>
                </div>

                <!-- Combat Stats -->
                <div class="form-section">
                    <div class="section-header">
                        <h3>Combat</h3>
                    </div>
                    <div class="form-row">
                        <div class="form-group">
                            <label for="char-ac">Armor Class</label>
                            <input type="number" id="char-ac" min="1" max="30" value="10">
                        </div>
                        <div class="form-group">
                            <label for="char-ac-desc">AC Description</label>
                            <input type="text" id="char-ac-desc" placeholder="(leather armor)">
                        </div>
                    </div>
                    <div class="form-row">
                        <div class="form-group">
                            <label for="char-init-bonus">Initiative Bonus</label>
                            <input type="number" id="char-init-bonus" value="0">
                        </div>
                        <div class="form-group">
                            <label for="char-speed">Speed (ft)</label>
                            <input type="number" id="char-speed" min="0" value="30">
                        </div>
                    </div>
                    <div class="form-row">
                        <div class="form-group">
                            <label for="char-hp-max">HP Max</label>
                            <input type="number" id="char-hp-max" min="0" value="0">
                        </div>
                        <div class="form-group">
                            <label for="char-hp-current">HP Current</label>
                            <input type="number" id="char-hp-current" min="0" value="0">
                        </div>
                        <div class="form-group">
                            <label for="char-hp-temp">Temp HP</label>
                            <input type="number" id="char-hp-temp" min="0" value="0">
                        </div>
                        <div class="form-group">
                            <label for="char-hp-max-reduction">Max HP Reduction</label>
                            <input type="number" id="char-hp-max-reduction" min="0" value="0">
                        </div>
                    </div>
                    <div class="form-row">
                        <div class="form-group">
                            <label for="char-hit-dice">Hit Dice</label>
                            <input type="text" id="char-hit-dice" placeholder="1d10">
                        </div>
                        <div class="form-group">
                            <label for="char-hit-dice-used">Used</label>
                            <input type="number" id="char-hit-dice-used" min="0" value="0">
                        </div>
                    </div>
                    <div class="form-row">
                        <div class="form-group">
                            <label for="char-death-success">Death Saves (Success)</label>
                            <input type="number" id="char-death-success" min="0" max="3" value="0">
                        </div>
                        <div class="form-group">
                            <label for="char-death-failure">Death Saves (Failure)</label>
                            <input type="number" id="char-death-failure" min="0" max="3" value="0">
                        </div>
                    </div>
                </div>

                <!-- Attacks -->
                <div class="form-section collapsible">
                    <div class="section-header" data-toggle="attacks-content">
                        <h3>Attacks</h3>
                        <button type="button" id="add-attack-btn" class="add-item-btn">+ Add</button>
                    </div>
                    <div id="attacks-content" class="section-content">
                        <div id="attacks-list" class="item-list"></div>
                    </div>
                </div>

                <!-- Proficiencies & Languages -->
                <div class="form-section collapsible">
                    <div class="section-header" data-toggle="proficiencies-content">
                        <h3>Proficiencies & Languages</h3>
                        <span class="toggle-icon">▼</span>
                    </div>
                    <div id="proficiencies-content" class="section-content">
                        <div class="form-group">
                            <label for="char-armor-prof">Armor Proficiencies</label>
                            <input type="text" id="char-armor-prof" placeholder="Light, Medium, Heavy, Shields">
                        </div>
                        <div class="form-group">
                            <label for="char-weapon-prof">Weapon Proficiencies</label>
                            <input type="text" id="char-weapon-prof" placeholder="Simple, Martial, Longsword">
                        </div>
                        <div class="form-group">
                            <label for="char-tool-prof">Tool Proficiencies</label>
                            <input type="text" id="char-tool-prof" placeholder="Thieves' tools, Smith's tools">
                        </div>
                        <div class="form-group">
                            <label for="char-languages">Languages</label>
                            <input type="text" id="char-languages" placeholder="Common, Elvish, Dwarvish">
                        </div>
                    </div>
                </div>

                <!-- Personality -->
                <div class="form-section collapsible">
                    <div class="section-header" data-toggle="personality-content">
                        <h3>Personality</h3>
                        <span class="toggle-icon">▼</span>
                    </div>
                    <div id="personality-content" class="section-content">
                        <div class="form-group">
                            <label for="char-personality">Personality Traits</label>
                            <textarea id="char-personality" rows="2" placeholder="Your character's personality traits..."></textarea>
                        </div>
                        <div class="form-group">
                            <label for="char-ideals">Ideals</label>
                            <textarea id="char-ideals" rows="2" placeholder="What drives your character..."></textarea>
                        </div>
                        <div class="form-group">
                            <label for="char-bonds">Bonds</label>
                            <textarea id="char-bonds" rows="2" placeholder="People, places, or things important to your character..."></textarea>
                        </div>
                        <div class="form-group">
                            <label for="char-flaws">Flaws</label>
                            <textarea id="char-flaws" rows="2" placeholder="Your character's weaknesses..."></textarea>
                        </div>
                    </div>
                </div>

                <!-- Trackers (Ki Points, Rage, etc.) -->
                <div class="form-section collapsible">
                    <div class="section-header" data-toggle="trackers-content">
                        <h3>Trackers</h3>
                        <button type="button" id="add-tracker-btn" class="add-item-btn">+ Add</button>
                    </div>
                    <div id="trackers-content" class="section-content">
                        <p class="section-hint">Track class resources like Ki Points, Rage, Channel Divinity, etc.</p>
                        <div id="trackers-list" class="item-list"></div>
                    </div>
                </div>

                <!-- Spellcasting -->
                <div class="form-section collapsible">
                    <div class="section-header" data-toggle="spellcasting-content">
                        <h3>Spellcasting</h3>
                        <span class="toggle-icon">▼</span>
                    </div>
                    <div id="spellcasting-content" class="section-content">
                        <div class="form-row">
                            <div class="form-group">
                                <label for="char-spell-ability">Spellcasting Ability</label>
                                <select id="char-spell-ability">
                                    <option value="">None</option>
                                    <option value="int">Intelligence</option>
                                    <option value="wis">Wisdom</option>
                                    <option value="cha">Charisma</option>
                                </select>
                            </div>
                            <div class="form-group">
                                <label for="char-spell-dc">Spell Save DC</label>
                                <input type="number" id="char-spell-dc" min="0" value="0">
                            </div>
                            <div class="form-group">
                                <label for="char-spell-attack">Spell Attack</label>
                                <input type="number" id="char-spell-attack" value="0">
                            </div>
                        </div>
                        <div class="spell-slots-edit-section">
                            <h4>Spell Slots</h4>
                            <div id="spell-slots-edit"></div>
                        </div>
                        <div class="spells-section">
                            <h4>Cantrips</h4>
                            <div id="cantrips-list" class="spell-list"></div>
                        </div>
                        <div class="spells-section">
                            <h4>Prepared Spells</h4>
                            <div id="spells-known-list" class="spell-list"></div>
                        </div>
                    </div>
                </div>

                <!-- Features & Traits -->
                <div class="form-section collapsible">
                    <div class="section-header" data-toggle="features-content">
                        <h3>Features & Traits</h3>
                        <button type="button" id="add-feature-btn" class="add-item-btn">+ Add</button>
                    </div>
                    <div id="features-content" class="section-content">
                        <div id="features-list" class="item-list"></div>
                        <div class="form-group">
                            <label for="char-traits">Other Traits</label>
                            <textarea id="char-traits" rows="3" placeholder="Additional traits, abilities, etc."></textarea>
                        </div>
                    </div>
                </div>

                <!-- Equipment -->
                <div class="form-section collapsible">
                    <div class="section-header" data-toggle="equipment-content">
                        <h3>Equipment</h3>
                        <button type="button" id="add-equipment-btn" class="add-item-btn">+ Add</button>
                    </div>
                    <div id="equipment-content" class="section-content">
                        <div class="currency-edit-row">
                            <div class="currency-input cp">
                                <label for="char-cp">CP</label>
                                <input type="number" id="char-cp" min="0" value="0">
                            </div>
                            <div class="currency-input sp">
                                <label for="char-sp">SP</label>
                                <input type="number" id="char-sp" min="0" value="0">
                            </div>
                            <div class="currency-input ep">
                                <label for="char-ep">EP</label>
                                <input type="number" id="char-ep" min="0" value="0">
                            </div>
                            <div class="currency-input gp">
                                <label for="char-gp">GP</label>
                                <input type="number" id="char-gp" min="0" value="0">
                            </div>
                            <div class="currency-input pp">
                                <label for="char-pp">PP</label>
                                <input type="number" id="char-pp" min="0" value="0">
                            </div>
                        </div>
                        <div id="equipment-list" class="item-list"></div>
                    </div>
                </div>

                <!-- Notes -->
                <div class="form-section">
                    <div class="section-header">
                        <h3>Notes</h3>
                    </div>
                    <div class="form-group">
                        <textarea id="char-notes" rows="4" placeholder="Additional notes, backstory, etc."></textarea>
                    </div>
                </div>

                <div class="form-actions">
                    <button type="button" id="cancel-character-btn" class="btn">Cancel</button>
                    <button type="submit" class="btn btn-primary">Save Character</button>
                    <button type="button" id="delete-character-btn" class="btn btn-danger hidden">Delete</button>
                </div>
            </form>

            <!-- Spell Picker Modal -->
            <div id="spell-picker-modal" class="modal">
                <div class="modal-content modal-large">
                    <div class="modal-header">
                        <h2 id="spell-picker-title">Select Spell</h2>
                        <button type="button" class="close-modal" aria-label="Close">&times;</button>
                    </div>
                    <div class="modal-body">
                        <div class="search-container">
                            <input type="text" id="spell-search-input" placeholder="Search spells..." autocomplete="off">
                            <div class="spell-filters">
                                <select id="spell-level-filter">
                                    <option value="">All Levels</option>
                                    <option value="0">Cantrips</option>
                                    <option value="1">1st Level</option>
                                    <option value="2">2nd Level</option>
                                    <option value="3">3rd Level</option>
                                    <option value="4">4th Level</option>
                                    <option value="5">5th Level</option>
                                    <option value="6">6th Level</option>
                                    <option value="7">7th Level</option>
                                    <option value="8">8th Level</option>
                                    <option value="9">9th Level</option>
                                </select>
                                <select id="spell-school-filter">
                                    <option value="">All Schools</option>
                                    <option value="Abjuration">Abjuration</option>
                                    <option value="Conjuration">Conjuration</option>
                                    <option value="Divination">Divination</option>
                                    <option value="Enchantment">Enchantment</option>
                                    <option value="Evocation">Evocation</option>
                                    <option value="Illusion">Illusion</option>
                                    <option value="Necromancy">Necromancy</option>
                                    <option value="Transmutation">Transmutation</option>
                                </select>
                            </div>
                            <div class="spell-class-filter" id="spell-class-filter-container" style="display: none;">
                                <label class="checkbox-label">
                                    <input type="checkbox" id="spell-class-filter-toggle">
                                    <span id="spell-class-filter-label">Show only class spells</span>
                                </label>
                            </div>
                        </div>
                        <div id="spell-picker-results" class="spell-picker-results"></div>
                    </div>
                </div>
            </div>

            <!-- Add Feature Choice Modal -->
            <div id="add-feature-choice-modal" class="modal">
                <div class="modal-content modal-small">
                    <div class="modal-header">
                        <h2>Add Feature</h2>
                        <button type="button" class="close-modal" aria-label="Close">&times;</button>
                    </div>
                    <div class="modal-body">
                        <div class="choice-buttons">
                            <button type="button" id="feature-choice-search" class="btn btn-large">
                                <svg viewBox="0 0 24 24" width="24" height="24"><path fill="currentColor" d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/></svg>
                                Search Features & Feats
                            </button>
                            <button type="button" id="feature-choice-blank" class="btn btn-large">
                                <svg viewBox="0 0 24 24" width="24" height="24"><path fill="currentColor" d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg>
                                Add Blank
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Feature Picker Modal -->
            <div id="feature-picker-modal" class="modal">
                <div class="modal-content modal-large">
                    <div class="modal-header">
                        <h2>Select Feature</h2>
                        <button type="button" class="close-modal" aria-label="Close">&times;</button>
                    </div>
                    <div class="modal-body">
                        <div class="search-container">
                            <input type="text" id="feature-search-input" placeholder="Search features and feats..." autocomplete="off">
                            <div class="feature-filters">
                                <select id="feature-category-filter">
                                    <option value="">All Types</option>
                                    <option value="feat">Feats</option>
                                    <option value="fighting-style">Fighting Styles</option>
                                    <option value="class">Class Features</option>
                                </select>
                                <select id="feature-class-filter">
                                    <option value="">All Classes</option>
                                </select>
                                <select id="feature-level-filter">
                                    <option value="">All Levels</option>
                                    ${Array.from({ length: 20 }, (_, i) => `<option value="${i + 1}">Level ${i + 1}</option>`).join('\n                                    ')}
                                </select>
                            </div>
                        </div>
                        <div id="feature-picker-results" class="feature-picker-results"></div>
                    </div>
                </div>
            </div>
        `;

        this.setupEventHandlers();
    }

    disconnectedCallback() {
        this.cleanupController?.abort()
    }

    setupEventHandlers() {
        const signal = this.cleanupController.signal;

        // Character form submit
        this.querySelector('#character-form').addEventListener('submit', (e) => {
            e.preventDefault();
            const savedCharacter = saveCharacter();
            if (savedCharacter) {
                // Navigate based on where we came from
                const state = getState();
                if (state.characterEditSource === 'view') {
                    Router.navigateToItem('characters', savedCharacter.id);
                } else {
                    Router.navigateToList('characters');
                }
            }
        }, {signal});

        // Cancel character edit
        this.querySelector('#cancel-character-btn').addEventListener('click', () => {
            const state = getState();
            const routeInfo = Router.parseHash();
            if (state.characterEditSource === 'view' && routeInfo.id) {
                Router.navigateToItem('characters', routeInfo.id);
            } else {
                Router.navigateToList('characters');
            }
        }, {signal});

        // Delete character button
        this.querySelector('#delete-character-btn').addEventListener('click', () => {
            if (deleteCharacter()) {
                // Always go to list after delete
                Router.navigateToList('characters');
            }
        }, {signal});

        // Character level change - update proficiency
        this.querySelector('#char-level').addEventListener('change', () => {
            updateProficiencyDisplay();
        }, {signal});

        // Character class change - update subclass suggestions
        this.querySelector('#char-class').addEventListener('input', () => {
            updateSubclassSuggestions();
        }, {signal});

        // Ability score changes - update modifiers
        Characters.ABILITIES.forEach(ability => {
            this.querySelector(`#char-${ability}`)?.addEventListener('change', () => {
                updateAbilityModifiers();
            }, {signal});
        });

        // Add buttons for character edit - show choice modal for features
        this.querySelector('#add-feature-btn').addEventListener('click', () => {
            this.querySelector('#add-feature-choice-modal')?.classList.add('active');
        }, {signal});

        // Feature choice modal buttons
        this.querySelector('#feature-choice-search').addEventListener('click', () => {
            this.querySelector('#add-feature-choice-modal')?.classList.remove('active');
            openFeaturePicker();
        }, {signal});

        this.querySelector('#feature-choice-blank').addEventListener('click', () => {
            this.querySelector('#add-feature-choice-modal')?.classList.remove('active');
            addFeature();
        }, {signal});

        // Feature Picker Modal
        this.querySelector('#feature-search-input').addEventListener('input', () => {
            renderFeaturePickerResults();
        }, {signal});

        this.querySelector('#feature-category-filter').addEventListener('change', (e) => {
            const classFilter = this.querySelector('#feature-class-filter');
            if (classFilter) {
                if (e.target.value === 'feat' || e.target.value === 'fighting-style') {
                    // Disable and reset class filter when Feats or Fighting Styles is selected
                    classFilter.value = '';
                    classFilter.disabled = true;
                } else {
                    classFilter.disabled = false;
                }
            }
            renderFeaturePickerResults();
        }, {signal});

        this.querySelector('#feature-class-filter').addEventListener('change', () => {
            renderFeaturePickerResults();
        }, {signal});

        this.querySelector('#feature-level-filter').addEventListener('change', () => {
            renderFeaturePickerResults();
        }, {signal});

        this.querySelector('#feature-picker-modal')?.querySelector('.close-modal')?.addEventListener('click', () => {
            closeFeaturePicker();
        }, {signal});

        this.querySelector('#add-equipment-btn').addEventListener('click', () => {
            addEquipment();
        }, {signal});

        this.querySelector('#add-attack-btn').addEventListener('click', () => {
            addAttack();
        }, {signal});

        this.querySelector('#add-tracker-btn').addEventListener('click', () => {
            addTracker();
        }, {signal});

        // Spell Picker Modal
        this.querySelector('#spell-search-input').addEventListener('input', () => {
            renderSpellPickerResults();
        }, {signal});

        this.querySelector('#spell-level-filter').addEventListener('change', () => {
            renderSpellPickerResults();
        }, {signal});

        this.querySelector('#spell-school-filter').addEventListener('change', () => {
            renderSpellPickerResults();
        }, {signal});

        this.querySelector('#spell-class-filter-toggle').addEventListener('change', () => {
            renderSpellPickerResults();
        }, {signal});

        this.querySelector('#spell-picker-modal')?.querySelector('.close-modal')?.addEventListener('click', () => {
            closeSpellPicker();
        }, {signal});

        // Collapsible section toggles
        this.querySelectorAll('.form-section.collapsible .section-header').forEach(header => {
            header.addEventListener('click', (e) => {
                // Don't toggle if clicking on a button inside the header
                if (e.target.closest('.add-item-btn')) return;

                const section = header.closest('.form-section');
                section.classList.toggle('collapsed');
            }, {signal});
        });

        // Close modal buttons (only close the containing modal)
        this.querySelectorAll('.close-modal').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                btn.closest('.modal')?.classList.remove('active');
            }, {signal});
        });

        // Close modal on backdrop click (only the clicked modal)
        this.querySelectorAll('.modal').forEach(modal => {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    modal.classList.remove('active');
                }
            }, {signal});
        });
    }

    init(character = null) {
        init(character);
    }

    renderForm() {
        renderForm();
    }
}

// Initialize the edit form with a character (or empty for new)
export function init(character = null) {
    const state = getState();

    if (character) {
        state.editingCharacter = JSON.parse(JSON.stringify(character)); // Deep clone
    } else {
        state.editingCharacter = Characters.createEmptyCharacter();
    }

    setView('character-edit');
    renderForm();
}

// Render the form with current character data
export function renderForm() {
    const state = getState();
    const character = state.editingCharacter;

    if (!character) return;

    // Basic Info
    setInputValue('char-name', character.name);
    setInputValue('char-class', character.class);
    setInputValue('char-subclass', character.subclass);
    setInputValue('char-level', character.level);
    setInputValue('char-background', character.background);
    setInputValue('char-species', character.species);
    setInputValue('char-alignment', character.alignment);
    setInputValue('char-xp', character.experiencePoints);

    // Update proficiency bonus display
    updateProficiencyDisplay();

    // Ability Scores
    Characters.ABILITIES.forEach(ability => {
        setInputValue(`char-${ability}`, character.abilities?.[ability] || 10);
        setCheckboxValue(`char-save-${ability}`, character.saveProficiencies?.[ability]);
    });

    // Update ability modifiers display
    updateAbilityModifiers();

    // Skills
    Object.keys(Characters.SKILLS).forEach(skillKey => {
        setCheckboxValue(`char-skill-${skillKey}`, character.skillProficiencies?.[skillKey]);
        setCheckboxValue(`char-expertise-${skillKey}`, character.skillExpertise?.[skillKey]);
    });

    // Combat Stats
    setInputValue('char-ac', character.armorClass);
    setInputValue('char-ac-desc', character.acDescription);
    setInputValue('char-init-bonus', character.initiative);
    setInputValue('char-speed', character.speed);
    setInputValue('char-hp-max', character.hitPointsMax);
    setInputValue('char-hp-current', character.hitPointsCurrent);
    setInputValue('char-hp-temp', character.hitPointsTemp);
    setInputValue('char-hp-max-reduction', character.hitPointsMaxReduction);
    setInputValue('char-hit-dice', character.hitDiceTotal);
    setInputValue('char-hit-dice-used', character.hitDiceUsed);

    // Death Saves
    setInputValue('char-death-success', character.deathSaves?.successes || 0);
    setInputValue('char-death-failure', character.deathSaves?.failures || 0);

    // Proficiencies & Languages
    setInputValue('char-armor-prof', (character.armorProficiencies || []).join(', '));
    setInputValue('char-weapon-prof', (character.weaponProficiencies || []).join(', '));
    setInputValue('char-tool-prof', (character.toolProficiencies || []).join(', '));
    setInputValue('char-languages', (character.languages || []).join(', '));

    // Personality
    setInputValue('char-personality', character.personalityTraits);
    setInputValue('char-ideals', character.ideals);
    setInputValue('char-bonds', character.bonds);
    setInputValue('char-flaws', character.flaws);

    // Features & Traits
    setInputValue('char-traits', character.traits);
    renderFeatures();

    // Equipment
    setInputValue('char-cp', character.copperPieces);
    setInputValue('char-sp', character.silverPieces);
    setInputValue('char-ep', character.electrumPieces);
    setInputValue('char-gp', character.goldPieces);
    setInputValue('char-pp', character.platinumPieces);
    renderEquipment();

    // Attacks
    renderAttacks();

    // Trackers (Ki Points, Rage, etc.)
    renderTrackers();

    // Spellcasting
    setInputValue('char-spell-ability', character.spellcastingAbility);
    setInputValue('char-spell-dc', character.spellSaveDC);
    setInputValue('char-spell-attack', character.spellAttackBonus);
    renderSpellSlots();
    renderSpells();

    // Notes
    setInputValue('char-notes', character.notes);

    // Update subclass suggestions based on class
    updateSubclassSuggestions();

    // Show delete button only for existing characters
    const deleteBtn = document.getElementById('delete-character-btn');
    if (character.id && Characters.getCharacter(character.id)) {
        deleteBtn?.classList.remove('hidden');
    } else {
        deleteBtn?.classList.add('hidden');
    }
}

// Helper to safely set input value
function setInputValue(id, value) {
    const el = document.getElementById(id);
    if (el) {
        el.value = value ?? '';
    }
}

// Helper to safely set checkbox value
function setCheckboxValue(id, checked) {
    const el = document.getElementById(id);
    if (el) {
        el.checked = !!checked;
    }
}

// Update proficiency bonus display
export function updateProficiencyDisplay() {
    const state = getState();
    const character = state.editingCharacter;
    if (!character) return;

    const level = parseInt(document.getElementById('char-level')?.value) || 1;
    const profBonus = Characters.getProficiencyBonus(level);

    const profEl = document.getElementById('char-prof-bonus');
    if (profEl) {
        profEl.textContent = `+${profBonus}`;
    }

    // Update character state
    character.level = level;
}

// Update ability modifier displays
export function updateAbilityModifiers() {
    const state = getState();
    const character = state.editingCharacter;
    if (!character) return;

    Characters.ABILITIES.forEach(ability => {
        const input = document.getElementById(`char-${ability}`);
        const modEl = document.getElementById(`char-${ability}-mod`);

        if (input && modEl) {
            const score = parseInt(input.value) || 10;
            character.abilities[ability] = score;
            const mod = Characters.getAbilityModifier(score);
            modEl.textContent = Characters.formatModifier(mod);
        }
    });
}

// Render features list
export function renderFeatures() {
    const state = getState();
    const character = state.editingCharacter;
    const container = document.getElementById('features-list');

    if (!container) return;

    const features = character.features || [];

    if (features.length === 0) {
        container.innerHTML = '<p class="empty-hint">No features added</p>';
        return;
    }

    container.innerHTML = features.map((feature, index) => `
        <div class="feature-item item-row" data-index="${index}">
            <div class="feature-content">
                <input type="text" class="feature-name" value="${escapeHtml(feature.name || '')}" placeholder="Feature name">
                <textarea class="feature-desc" placeholder="Description">${escapeHtml(feature.description || '')}</textarea>
            </div>
            <div class="item-buttons">
                <button type="button" class="move-up-btn" data-index="${index}" ${index === 0 ? 'disabled' : ''} aria-label="Move up">▲</button>
                <button type="button" class="move-down-btn" data-index="${index}" ${index === features.length - 1 ? 'disabled' : ''} aria-label="Move down">▼</button>
                <button type="button" class="remove-btn" data-index="${index}" aria-label="Remove">&times;</button>
            </div>
        </div>
    `).join('');

    // Add event handlers
    container.querySelectorAll('.feature-name').forEach((input, i) => {
        input.addEventListener('change', () => {
            character.features[i].name = input.value;
        });
    });
    container.querySelectorAll('.feature-desc').forEach((textarea, i) => {
        textarea.addEventListener('change', () => {
            character.features[i].description = textarea.value;
        });
    });
    container.querySelectorAll('.remove-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            character.features.splice(parseInt(btn.dataset.index), 1);
            renderFeatures();
        });
    });
    container.querySelectorAll('.move-up-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const index = parseInt(btn.dataset.index);
            if (index > 0) {
                const temp = character.features[index];
                character.features[index] = character.features[index - 1];
                character.features[index - 1] = temp;
                renderFeatures();
            }
        });
    });
    container.querySelectorAll('.move-down-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const index = parseInt(btn.dataset.index);
            if (index < character.features.length - 1) {
                const temp = character.features[index];
                character.features[index] = character.features[index + 1];
                character.features[index + 1] = temp;
                renderFeatures();
            }
        });
    });
}

// Add new feature
export function addFeature() {
    const state = getState();
    const character = state.editingCharacter;
    if (!character.features) character.features = [];
    character.features.push({ name: '', description: '' });
    renderFeatures();
}

// Render equipment list
export function renderEquipment() {
    const state = getState();
    const character = state.editingCharacter;
    const container = document.getElementById('equipment-list');

    if (!container) return;

    const equipment = character.equipment || [];

    if (equipment.length === 0) {
        container.innerHTML = '<p class="empty-hint">No equipment added</p>';
        return;
    }

    container.innerHTML = equipment.map((item, index) => {
        const name = typeof item === 'string' ? item : item.name;
        const qty = typeof item === 'object' ? item.quantity : 1;

        return `
            <div class="equipment-item item-row" data-index="${index}">
                <input type="text" class="equipment-name" value="${escapeHtml(name || '')}" placeholder="Item name">
                <input type="number" class="equipment-qty" value="${qty || 1}" min="1" placeholder="Qty">
                <button type="button" class="remove-btn" data-index="${index}" aria-label="Remove">&times;</button>
            </div>
        `;
    }).join('');

    // Add event handlers
    container.querySelectorAll('.equipment-name').forEach((input, i) => {
        input.addEventListener('change', () => {
            if (typeof character.equipment[i] === 'string') {
                character.equipment[i] = { name: input.value, quantity: 1 };
            } else {
                character.equipment[i].name = input.value;
            }
        });
    });
    container.querySelectorAll('.equipment-qty').forEach((input, i) => {
        input.addEventListener('change', () => {
            if (typeof character.equipment[i] === 'string') {
                character.equipment[i] = { name: character.equipment[i], quantity: parseInt(input.value) || 1 };
            } else {
                character.equipment[i].quantity = parseInt(input.value) || 1;
            }
        });
    });
    container.querySelectorAll('.remove-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            character.equipment.splice(parseInt(btn.dataset.index), 1);
            renderEquipment();
        });
    });
}

// Add new equipment
export function addEquipment() {
    const state = getState();
    const character = state.editingCharacter;
    if (!character.equipment) character.equipment = [];
    character.equipment.push({ name: '', quantity: 1 });
    renderEquipment();
}

// Render attacks list
export function renderAttacks() {
    const state = getState();
    const character = state.editingCharacter;
    const container = document.getElementById('attacks-list');

    if (!container) return;

    const attacks = character.attacks || [];

    if (attacks.length === 0) {
        container.innerHTML = '<p class="empty-hint">No attacks added</p>';
        return;
    }

    container.innerHTML = attacks.map((attack, index) => `
        <div class="attack-item item-row" data-index="${index}">
            <div class="attack-inputs">
                <input type="text" class="attack-name" value="${escapeHtml(attack.name || '')}" placeholder="Weapon/Attack name">
                <div class="attack-stats">
                    <input type="number" class="attack-bonus" value="${attack.bonus || 0}" placeholder="+0">
                    <input type="text" class="attack-damage" value="${escapeHtml(attack.damage || '')}" placeholder="1d8 + 3 slashing">
                </div>
            </div>
            <button type="button" class="remove-btn" data-index="${index}" aria-label="Remove">&times;</button>
        </div>
    `).join('');

    // Add event handlers
    container.querySelectorAll('.attack-name').forEach((input, i) => {
        input.addEventListener('change', () => {
            character.attacks[i].name = input.value;
        });
    });
    container.querySelectorAll('.attack-bonus').forEach((input, i) => {
        input.addEventListener('change', () => {
            character.attacks[i].bonus = parseInt(input.value) || 0;
        });
    });
    container.querySelectorAll('.attack-damage').forEach((input, i) => {
        input.addEventListener('change', () => {
            character.attacks[i].damage = input.value;
        });
    });
    container.querySelectorAll('.remove-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            character.attacks.splice(parseInt(btn.dataset.index), 1);
            renderAttacks();
        });
    });
}

// Add new attack
export function addAttack() {
    const state = getState();
    const character = state.editingCharacter;
    if (!character.attacks) character.attacks = [];
    character.attacks.push({ name: '', bonus: 0, damage: '' });
    renderAttacks();
}

// Render trackers list (Ki Points, Rage, etc.)
export function renderTrackers() {
    const state = getState();
    const character = state.editingCharacter;
    const container = document.getElementById('trackers-list');

    if (!container) return;

    const trackers = character.trackers || [];

    if (trackers.length === 0) {
        container.innerHTML = '<p class="empty-hint">No trackers added</p>';
        return;
    }

    container.innerHTML = trackers.map((tracker, index) => `
        <div class="tracker-item" data-index="${index}">
            <button type="button" class="remove-btn" data-index="${index}" aria-label="Remove">&times;</button>
            <div class="tracker-fields">
                <div class="form-group tracker-name-group">
                    <label>Name</label>
                    <input type="text" class="tracker-name" value="${escapeHtml(tracker.name || '')}" placeholder="e.g. Ki Points">
                </div>
                <div class="form-group tracker-max-group">
                    <label>Max</label>
                    <input type="number" class="tracker-max" value="${tracker.max || 0}" min="0">
                </div>
                <div class="form-group tracker-used-group">
                    <label>Used</label>
                    <input type="number" class="tracker-used" value="${tracker.used || 0}" min="0">
                </div>
            </div>
            <div class="tracker-options">
                <label class="tracker-reset-label">
                    <input type="checkbox" class="tracker-reset" ${tracker.resetOnLongRest !== false ? 'checked' : ''}>
                    Reset on Long Rest
                </label>
            </div>
        </div>
    `).join('');

    // Add event handlers
    container.querySelectorAll('.tracker-name').forEach((input, i) => {
        input.addEventListener('change', () => {
            character.trackers[i].name = input.value;
        });
    });
    container.querySelectorAll('.tracker-max').forEach((input, i) => {
        input.addEventListener('change', () => {
            character.trackers[i].max = parseInt(input.value) || 0;
        });
    });
    container.querySelectorAll('.tracker-used').forEach((input, i) => {
        input.addEventListener('change', () => {
            character.trackers[i].used = parseInt(input.value) || 0;
        });
    });
    container.querySelectorAll('.tracker-reset').forEach((input, i) => {
        input.addEventListener('change', () => {
            character.trackers[i].resetOnLongRest = input.checked;
        });
    });
    container.querySelectorAll('.remove-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            character.trackers.splice(parseInt(btn.dataset.index), 1);
            renderTrackers();
        });
    });
}

// Add new tracker
export function addTracker() {
    const state = getState();
    const character = state.editingCharacter;
    if (!character.trackers) character.trackers = [];
    character.trackers.push({ name: '', max: 0, used: 0, resetOnLongRest: true });
    renderTrackers();
}

// Render spell slots
export function renderSpellSlots() {
    const state = getState();
    const character = state.editingCharacter;
    const container = document.getElementById('spell-slots-edit');

    if (!container) return;

    const slots = character.spellSlots || {};

    container.innerHTML = Array.from({ length: 9 }, (_, i) => {
        const level = i + 1;
        const slot = slots[level] || { total: 0, used: 0 };
        return `
            <div class="spell-slot-edit-row">
                <span class="slot-level">${level}${getOrdinalSuffix(level)}</span>
                <input type="number" class="slot-total" data-level="${level}" value="${slot.total}" min="0" max="9" placeholder="0">
                <span class="slot-separator">/</span>
                <input type="number" class="slot-used" data-level="${level}" value="${slot.used}" min="0" max="${slot.total}" placeholder="0">
                <span class="slot-label">used</span>
            </div>
        `;
    }).join('');

    // Add event handlers
    container.querySelectorAll('.slot-total').forEach(input => {
        input.addEventListener('change', () => {
            const level = input.dataset.level;
            if (!character.spellSlots[level]) character.spellSlots[level] = { total: 0, used: 0 };
            character.spellSlots[level].total = parseInt(input.value) || 0;
        });
    });
    container.querySelectorAll('.slot-used').forEach(input => {
        input.addEventListener('change', () => {
            const level = input.dataset.level;
            if (!character.spellSlots[level]) character.spellSlots[level] = { total: 0, used: 0 };
            character.spellSlots[level].used = parseInt(input.value) || 0;
        });
    });
}

// Helper to get ordinal suffix
function getOrdinalSuffix(n) {
    if (n === 1) return 'st';
    if (n === 2) return 'nd';
    if (n === 3) return 'rd';
    return 'th';
}

// Render spells (cantrips and known spells)
export function renderSpells() {
    const state = getState();
    const character = state.editingCharacter;

    // Cantrips
    const cantripsContainer = document.getElementById('cantrips-list');
    if (cantripsContainer) {
        const cantrips = character.cantripsKnown || [];
        let html = cantrips.length === 0
            ? '<p class="empty-hint">No cantrips added</p>'
            : cantrips.map((spell, index) => {
                const name = typeof spell === 'string' ? spell : spell.name;
                return `
                    <div class="spell-item" data-index="${index}">
                        <div class="spell-display">
                            <a href="#" class="spell-link" data-spell="${escapeHtml(name)}">${escapeHtml(name)}</a>
                        </div>
                        <button type="button" class="remove-btn" data-index="${index}">&times;</button>
                    </div>
                `;
            }).join('');

        html += `
            <button type="button" class="add-spell-btn" id="add-cantrip-btn">
                <svg viewBox="0 0 24 24"><path fill="currentColor" d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg>
                Add Cantrip
            </button>
        `;

        cantripsContainer.innerHTML = html;

        cantripsContainer.querySelectorAll('.remove-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                character.cantripsKnown.splice(parseInt(btn.dataset.index), 1);
                renderSpells();
            });
        });

        document.getElementById('add-cantrip-btn')?.addEventListener('click', () => {
            openSpellPicker('cantrip');
        });
    }

    // Spells known
    const spellsContainer = document.getElementById('spells-known-list');
    if (spellsContainer) {
        const spells = character.spellsKnown || [];
        let html = spells.length === 0
            ? '<p class="empty-hint">No spells added</p>'
            : spells.map((spell, index) => {
                const name = typeof spell === 'string' ? spell : spell.name;
                return `
                    <div class="spell-item" data-index="${index}">
                        <div class="spell-display">
                            <a href="#" class="spell-link" data-spell="${escapeHtml(name)}">${escapeHtml(name)}</a>
                        </div>
                        <button type="button" class="remove-btn" data-index="${index}">&times;</button>
                    </div>
                `;
            }).join('');

        html += `
            <button type="button" class="add-spell-btn" id="add-spell-btn">
                <svg viewBox="0 0 24 24"><path fill="currentColor" d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg>
                Add Spell
            </button>
        `;

        spellsContainer.innerHTML = html;

        spellsContainer.querySelectorAll('.remove-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                character.spellsKnown.splice(parseInt(btn.dataset.index), 1);
                renderSpells();
            });
        });

        document.getElementById('add-spell-btn')?.addEventListener('click', () => {
            openSpellPicker('spell');
        });
    }
}

// Current spell picker mode ('cantrip' or 'spell')
let spellPickerMode = null;

// Get current class/subclass from form fields
function getCurrentClassFromForm() {
    const classInput = document.getElementById('char-class');
    const subclassInput = document.getElementById('char-subclass');
    return {
        class: classInput?.value?.trim() || '',
        subclass: subclassInput?.value?.trim() || ''
    };
}

// Open spell picker modal
export async function openSpellPicker(mode) {
    spellPickerMode = mode;

    const modal = document.getElementById('spell-picker-modal');
    const title = document.getElementById('spell-picker-title');
    const searchInput = document.getElementById('spell-search-input');
    const levelFilter = document.getElementById('spell-level-filter');
    const schoolFilter = document.getElementById('spell-school-filter');
    const classFilterContainer = document.getElementById('spell-class-filter-container');
    const classFilterToggle = document.getElementById('spell-class-filter-toggle');
    const classFilterLabel = document.getElementById('spell-class-filter-label');

    // Set title and default filter based on mode
    if (mode === 'cantrip') {
        title.textContent = 'Select Cantrip';
        levelFilter.value = '0';
        levelFilter.disabled = true;
    } else {
        title.textContent = 'Select Spell';
        levelFilter.value = '';
        levelFilter.disabled = false;
    }

    // Reset other filters
    searchInput.value = '';
    schoolFilter.value = '';

    // Get class/subclass from form fields (not saved character)
    const { class: charClass, subclass: charSubclass } = getCurrentClassFromForm();

    // Show/hide class filter based on whether character has a spellcasting class OR subclass
    const hasSpellcastingClass = charClass && ClassSpellLists.isSpellcastingClass(charClass);
    const hasSpellcastingSubclass = charSubclass && ClassSpellLists.isSpellcastingSubclass(charSubclass);

    if (hasSpellcastingClass || hasSpellcastingSubclass) {
        classFilterContainer.style.display = 'block';
        classFilterToggle.checked = true; // Default to showing class spells

        // Update label to show class/subclass name
        let label;
        if (hasSpellcastingSubclass && !hasSpellcastingClass) {
            // Subclass grants spellcasting (e.g., Eldritch Knight, Arcane Trickster)
            label = `Show only ${charSubclass} spells`;
        } else if (charSubclass) {
            label = `Show only ${charClass} (${charSubclass}) spells`;
        } else {
            label = `Show only ${charClass} spells`;
        }
        classFilterLabel.textContent = label;
    } else {
        classFilterContainer.style.display = 'none';
        classFilterToggle.checked = false;
    }

    // Show modal first so user sees it immediately
    modal.classList.add('active');
    searchInput.focus();

    // Render initial results (async - will populate after data loads)
    await renderSpellPickerResults();
}

// Close spell picker modal
export function closeSpellPicker() {
    const modal = document.getElementById('spell-picker-modal');
    modal.classList.remove('active');
    spellPickerMode = null;
}

// Render spell picker search results
export async function renderSpellPickerResults(loadMore = false) {
    const resultsContainer = document.getElementById('spell-picker-results');
    const searchQuery = document.getElementById('spell-search-input').value;
    const levelFilter = document.getElementById('spell-level-filter').value;
    const schoolFilter = document.getElementById('spell-school-filter').value;
    const classFilterToggle = document.getElementById('spell-class-filter-toggle');

    // If not loading more, reset state and show loading
    if (!loadMore) {
        spellPickerState.displayedCount = 0;
        spellPickerState.allSpells = [];
    }

    // Fetch and filter spells if not loading more
    if (!loadMore || spellPickerState.allSpells.length === 0) {
        // Get class/subclass from form fields
        const { class: charClass, subclass: charSubclass } = getCurrentClassFromForm();

        // Get filtered spells (async)
        let spells = await Spells.getAllSpells();

        // Filter by class/subclass if toggle is checked
        if (classFilterToggle?.checked) {
            // Check if we have spellcasting from class or subclass
            const hasSpellcastingClass = charClass && ClassSpellLists.isSpellcastingClass(charClass);
            const hasSpellcastingSubclass = charSubclass && ClassSpellLists.isSpellcastingSubclass(charSubclass);

            if (hasSpellcastingClass || hasSpellcastingSubclass) {
                const availableSpells = ClassSpellLists.getAvailableSpells(charClass, charSubclass);
                const availableSet = new Set(availableSpells.map(s => s.toLowerCase()));
                spells = spells.filter(s => availableSet.has(s.name.toLowerCase()));
            }
        }

        // Filter by level
        if (levelFilter !== '') {
            const level = parseInt(levelFilter);
            spells = spells.filter(s => s.level === level);
        } else if (spellPickerMode === 'cantrip') {
            spells = spells.filter(s => s.level === 0);
        } else if (spellPickerMode === 'spell') {
            // For spells, exclude cantrips by default unless explicitly selected
            spells = spells.filter(s => s.level > 0);
        }

        // Filter by school
        if (schoolFilter) {
            spells = spells.filter(s => s.school === schoolFilter);
        }

        // Filter by search query
        if (searchQuery.trim()) {
            const query = searchQuery.toLowerCase().trim();
            spells = spells.filter(s => s.name.toLowerCase().includes(query));
        }

        spellPickerState.allSpells = spells;
    }

    const spells = spellPickerState.allSpells;

    if (spells.length === 0) {
        resultsContainer.innerHTML = '<p class="empty-hint" style="padding: 16px; text-align: center;">No spells found</p>';
        return;
    }

    // Calculate which spells to display
    const startIndex = loadMore ? spellPickerState.displayedCount : 0;
    const endIndex = startIndex + spellPickerState.batchSize;
    const displaySpells = spells.slice(startIndex, endIndex);

    const newItemsHtml = displaySpells.map(spell => {
        const levelText = Spells.formatSpellLevel(spell.level);
        return `
            <div class="spell-result-item" data-spell-name="${escapeHtml(spell.name)}">
                <div class="spell-result-info">
                    <div class="spell-result-header">
                        <span class="spell-result-name">${escapeHtml(spell.name)}</span>
                        <span class="spell-result-level">${levelText}</span>
                    </div>
                    <div class="spell-result-details">
                        <span>${spell.school}</span>
                        <span>${spell.castingTime}</span>
                        <span>${spell.range}</span>
                        ${spell.concentration ? '<span class="spell-concentration">Concentration</span>' : ''}
                        ${spell.ritual ? '<span class="spell-ritual">Ritual</span>' : ''}
                    </div>
                </div>
                <button type="button" class="spell-info-btn" data-spell="${escapeHtml(spell.name)}" aria-label="View spell details">
                    <svg viewBox="0 0 24 24" width="20" height="20"><path fill="currentColor" d="M11 7h2v2h-2zm0 4h2v6h-2zm1-9C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z"/></svg>
                </button>
            </div>
        `;
    }).join('');

    // Update displayed count
    spellPickerState.displayedCount = endIndex;

    if (loadMore) {
        // Remove the old "load more" button/hint before appending
        const oldLoadMore = resultsContainer.querySelector('.spell-load-more-container');
        if (oldLoadMore) oldLoadMore.remove();
        resultsContainer.insertAdjacentHTML('beforeend', newItemsHtml);
    } else {
        resultsContainer.innerHTML = newItemsHtml;
    }

    // Add "Load More" button if there are more results
    const remaining = spells.length - spellPickerState.displayedCount;
    if (remaining > 0) {
        resultsContainer.insertAdjacentHTML('beforeend', `
            <div class="spell-load-more-container" style="padding: 12px; text-align: center;">
                <button type="button" class="btn btn-secondary spell-load-more-btn">
                    Load More (${remaining} remaining)
                </button>
            </div>
        `);

        // Add click handler for load more button
        const loadMoreBtn = resultsContainer.querySelector('.spell-load-more-btn');
        if (loadMoreBtn) {
            loadMoreBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                renderSpellPickerResults(true);
            });
        }
    } else if (spells.length > spellPickerState.batchSize) {
        // Show "all loaded" message only if we had to paginate
        resultsContainer.insertAdjacentHTML('beforeend', `
            <p class="empty-hint" style="padding: 8px; text-align: center; font-size: 0.85rem;">All ${spells.length} spells loaded</p>
        `);
    }

    // Add click handlers to new items only
    const itemsToAttach = loadMore
        ? Array.from(resultsContainer.querySelectorAll('.spell-result-item')).slice(startIndex)
        : resultsContainer.querySelectorAll('.spell-result-item');

    // Add click handlers for selecting spells
    itemsToAttach.forEach(item => {
        const info = item.querySelector('.spell-result-info');
        if (info) {
            info.addEventListener('click', () => {
                selectSpell(item.dataset.spellName);
            });
        }
    });

    // Add click handlers for viewing spell details
    itemsToAttach.forEach(item => {
        const btn = item.querySelector('.spell-info-btn');
        if (btn) {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                window.showSpellModal(btn.dataset.spell);
            });
        }
    });
}

// Select a spell from the picker
function selectSpell(spellName) {
    const state = getState();
    const character = state.editingCharacter;

    if (spellPickerMode === 'cantrip') {
        if (!character.cantripsKnown) character.cantripsKnown = [];
        // Avoid duplicates
        if (!character.cantripsKnown.includes(spellName)) {
            character.cantripsKnown.push(spellName);
        }
    } else {
        if (!character.spellsKnown) character.spellsKnown = [];
        // Avoid duplicates
        if (!character.spellsKnown.includes(spellName)) {
            character.spellsKnown.push(spellName);
        }
    }

    closeSpellPicker();
    renderSpells();
}

// Parse comma-separated list
function parseCommaList(text) {
    if (!text || !text.trim()) return [];
    return text.split(',').map(s => s.trim()).filter(s => s);
}

// Collect all form data into character object
function collectFormData() {
    const state = getState();
    const character = state.editingCharacter;

    // Basic Info
    character.name = document.getElementById('char-name')?.value.trim() || '';
    character.class = document.getElementById('char-class')?.value.trim() || '';
    character.subclass = document.getElementById('char-subclass')?.value.trim() || '';
    character.level = parseInt(document.getElementById('char-level')?.value) || 1;
    character.background = document.getElementById('char-background')?.value.trim() || '';
    character.species = document.getElementById('char-species')?.value.trim() || '';
    character.alignment = document.getElementById('char-alignment')?.value.trim() || '';
    character.experiencePoints = parseInt(document.getElementById('char-xp')?.value) || 0;

    // Ability Scores
    Characters.ABILITIES.forEach(ability => {
        character.abilities[ability] = parseInt(document.getElementById(`char-${ability}`)?.value) || 10;
        character.saveProficiencies[ability] = document.getElementById(`char-save-${ability}`)?.checked || false;
    });

    // Skills
    character.skillProficiencies = {};
    character.skillExpertise = {};
    Object.keys(Characters.SKILLS).forEach(skillKey => {
        if (document.getElementById(`char-skill-${skillKey}`)?.checked) {
            character.skillProficiencies[skillKey] = true;
        }
        if (document.getElementById(`char-expertise-${skillKey}`)?.checked) {
            character.skillExpertise[skillKey] = true;
        }
    });

    // Combat Stats
    character.armorClass = parseInt(document.getElementById('char-ac')?.value) || 10;
    character.acDescription = document.getElementById('char-ac-desc')?.value.trim() || '';
    character.initiative = parseInt(document.getElementById('char-init-bonus')?.value) || 0;
    character.speed = parseInt(document.getElementById('char-speed')?.value) || 30;
    character.hitPointsMax = parseInt(document.getElementById('char-hp-max')?.value) || 0;
    character.hitPointsCurrent = parseInt(document.getElementById('char-hp-current')?.value) || 0;
    character.hitPointsTemp = parseInt(document.getElementById('char-hp-temp')?.value) || 0;
    character.hitPointsMaxReduction = parseInt(document.getElementById('char-hp-max-reduction')?.value) || 0;
    character.hitDiceTotal = document.getElementById('char-hit-dice')?.value.trim() || '';
    character.hitDiceUsed = parseInt(document.getElementById('char-hit-dice-used')?.value) || 0;

    // Death Saves
    character.deathSaves = {
        successes: parseInt(document.getElementById('char-death-success')?.value) || 0,
        failures: parseInt(document.getElementById('char-death-failure')?.value) || 0
    };

    // Proficiencies & Languages
    character.armorProficiencies = parseCommaList(document.getElementById('char-armor-prof')?.value);
    character.weaponProficiencies = parseCommaList(document.getElementById('char-weapon-prof')?.value);
    character.toolProficiencies = parseCommaList(document.getElementById('char-tool-prof')?.value);
    character.languages = parseCommaList(document.getElementById('char-languages')?.value);

    // Personality
    character.personalityTraits = document.getElementById('char-personality')?.value.trim() || '';
    character.ideals = document.getElementById('char-ideals')?.value.trim() || '';
    character.bonds = document.getElementById('char-bonds')?.value.trim() || '';
    character.flaws = document.getElementById('char-flaws')?.value.trim() || '';

    // Features & Traits
    character.traits = document.getElementById('char-traits')?.value.trim() || '';

    // Currency
    character.copperPieces = parseInt(document.getElementById('char-cp')?.value) || 0;
    character.silverPieces = parseInt(document.getElementById('char-sp')?.value) || 0;
    character.electrumPieces = parseInt(document.getElementById('char-ep')?.value) || 0;
    character.goldPieces = parseInt(document.getElementById('char-gp')?.value) || 0;
    character.platinumPieces = parseInt(document.getElementById('char-pp')?.value) || 0;

    // Spellcasting
    character.spellcastingAbility = document.getElementById('char-spell-ability')?.value.trim() || '';
    character.spellSaveDC = parseInt(document.getElementById('char-spell-dc')?.value) || 0;
    character.spellAttackBonus = parseInt(document.getElementById('char-spell-attack')?.value) || 0;

    // Notes
    character.notes = document.getElementById('char-notes')?.value.trim() || '';

    return character;
}

// Save character - returns saved character or null if validation fails
export function saveCharacter() {
    const character = collectFormData();

    if (!character.name) {
        alert('Character name is required');
        return null;
    }

    Characters.saveCharacter(character);
    return character;
}

// Delete current character - returns true if deleted
export function deleteCharacter() {
    const state = getState();
    const character = state.editingCharacter;

    if (character && character.id) {
        if (confirm(`Delete "${character.name}"?`)) {
            Characters.deleteCharacter(character.id);
            return true;
        }
    }
    return false;
}

// Cancel editing and return to list
export function cancelEdit() {
    const state = getState();
    state.editingCharacter = null;
    setView('characters');
}

// Update subclass suggestions based on current class
export function updateSubclassSuggestions() {
    const classInput = document.getElementById('char-class');
    const subclassDatalist = document.getElementById('subclass-suggestions');

    if (!classInput || !subclassDatalist) return;

    const className = classInput.value.trim();
    const subclasses = ClassSpellLists.getSubclassesForClass(className);

    // Clear and repopulate datalist
    subclassDatalist.innerHTML = subclasses
        .map(sc => `<option value="${sc}">`)
        .join('');
}

// Open the feature picker modal
export async function openFeaturePicker() {
    const modal = document.getElementById('feature-picker-modal');
    if (!modal) return;

    // Reset category filter and enable class filter
    const categoryFilter = document.getElementById('feature-category-filter');
    if (categoryFilter) categoryFilter.value = '';

    // Populate class filter dropdown
    const classFilter = document.getElementById('feature-class-filter');
    if (classFilter) {
        classFilter.disabled = false; // Ensure it's enabled

        if (classFilter.options.length <= 1) {
            const classNames = await ClassFeatures.getClassNames();
            for (const className of classNames) {
                const option = document.createElement('option');
                option.value = className;
                option.textContent = className;
                classFilter.appendChild(option);
            }
        }

        // Pre-select character's class if available
        const state = getState();
        const character = state.editingCharacter;
        if (character && character.class) {
            const charClass = character.class.split('/')[0].trim(); // Handle multiclass
            for (const opt of classFilter.options) {
                if (opt.value.toLowerCase() === charClass.toLowerCase()) {
                    classFilter.value = opt.value;
                    break;
                }
            }
        } else {
            classFilter.value = '';
        }
    }

    // Reset search input
    const searchInput = document.getElementById('feature-search-input');
    if (searchInput) searchInput.value = '';

    // Reset level filter
    const levelFilter = document.getElementById('feature-level-filter');
    if (levelFilter) levelFilter.value = '';

    modal.classList.add('active');

    // Render initial results
    await renderFeaturePickerResults();

    // Focus on search input
    searchInput?.focus();
}

// Close the feature picker modal
export function closeFeaturePicker() {
    const modal = document.getElementById('feature-picker-modal');
    if (modal) {
        modal.classList.remove('active');
    }
}

// Render feature picker results
export async function renderFeaturePickerResults(loadMore = false) {
    const resultsContainer = document.getElementById('feature-picker-results');
    if (!resultsContainer) return;

    const query = document.getElementById('feature-search-input')?.value || '';
    const categoryFilter = document.getElementById('feature-category-filter')?.value || '';
    const classFilter = document.getElementById('feature-class-filter')?.value || '';
    const levelFilter = document.getElementById('feature-level-filter')?.value || '';

    // If not loading more, reset state and show loading
    if (!loadMore) {
        featurePickerState.displayedCount = 0;
        featurePickerState.allFeatures = [];
        resultsContainer.innerHTML = '<p class="loading-hint" style="padding: 16px; text-align: center;">Loading features...</p>';
    }

    try {
        // Fetch features if not loading more (or if we don't have them cached)
        if (!loadMore || featurePickerState.allFeatures.length === 0) {
            featurePickerState.allFeatures = await ClassFeatures.searchFeatures(query, {
                category: categoryFilter,
                className: classFilter,
                level: levelFilter
            });
        }

        const features = featurePickerState.allFeatures;

        if (features.length === 0) {
            resultsContainer.innerHTML = '<p class="empty-hint" style="padding: 16px; text-align: center;">No features found</p>';
            return;
        }

        // Calculate which features to display
        const startIndex = loadMore ? featurePickerState.displayedCount : 0;
        const endIndex = startIndex + featurePickerState.batchSize;
        const displayFeatures = features.slice(startIndex, endIndex);

        const newItemsHtml = displayFeatures.map(feature => {
            const preview = (feature.description || '').substring(0, 150);
            const isFeat = feature.type === 'feat';

            return `
                <div class="feature-result-item" data-feature-name="${escapeHtml(feature.name)}" data-feature-type="${feature.type}" data-feature-class="${escapeHtml(feature.className || '')}" data-feature-subclass="${escapeHtml(feature.subclassShortName || '')}">
                    <div class="feature-result-header">
                        <span class="feature-result-name">${escapeHtml(feature.name)}</span>
                        <div class="feature-result-meta">
                            ${isFeat ? `
                                <span class="feature-result-category">${escapeHtml(feature.categoryLabel || 'Feat')}</span>
                                ${feature.level ? `<span class="feature-result-level">Lv ${feature.level}+</span>` : ''}
                            ` : `
                                ${feature.subclassShortName ? `<span class="feature-result-subclass">${escapeHtml(feature.subclassShortName)}</span>` : ''}
                                <span class="feature-result-class">${escapeHtml(feature.className)}</span>
                                <span class="feature-result-level">Lv ${feature.level}</span>
                            `}
                            ${feature.source ? `<span class="feature-result-source">${escapeHtml(feature.source)}</span>` : ''}
                        </div>
                    </div>
                    <div class="feature-result-preview">${escapeHtml(preview)}${preview.length < (feature.description || '').length ? '...' : ''}</div>
                </div>
            `;
        }).join('');

        // Update displayed count
        featurePickerState.displayedCount = endIndex;

        if (loadMore) {
            // Remove the old "load more" button/hint before appending
            const oldLoadMore = resultsContainer.querySelector('.feature-load-more-container');
            if (oldLoadMore) oldLoadMore.remove();
            resultsContainer.insertAdjacentHTML('beforeend', newItemsHtml);
        } else {
            resultsContainer.innerHTML = newItemsHtml;
        }

        // Add "Load More" button if there are more results
        const remaining = features.length - featurePickerState.displayedCount;
        if (remaining > 0) {
            resultsContainer.insertAdjacentHTML('beforeend', `
                <div class="feature-load-more-container" style="padding: 12px; text-align: center;">
                    <button type="button" class="btn btn-secondary feature-load-more-btn">
                        Load More (${remaining} remaining)
                    </button>
                </div>
            `);

            // Add click handler for load more button
            const loadMoreBtn = resultsContainer.querySelector('.feature-load-more-btn');
            if (loadMoreBtn) {
                loadMoreBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    renderFeaturePickerResults(true);
                });
            }
        } else if (features.length > featurePickerState.batchSize) {
            // Show "all loaded" message only if we had to paginate
            resultsContainer.insertAdjacentHTML('beforeend', `
                <p class="empty-hint" style="padding: 8px; text-align: center; font-size: 0.85rem;">All ${features.length} results loaded</p>
            `);
        }

        // Add click handlers to new items only
        const itemsToAttach = loadMore
            ? Array.from(resultsContainer.querySelectorAll('.feature-result-item')).slice(startIndex)
            : resultsContainer.querySelectorAll('.feature-result-item');

        itemsToAttach.forEach(item => {
            item.addEventListener('click', async () => {
                const featureName = item.dataset.featureName;
                const featureType = item.dataset.featureType;
                const featureClass = item.dataset.featureClass;
                const featureSubclass = item.dataset.featureSubclass;

                // Use cached features instead of re-fetching
                const feature = featurePickerState.allFeatures.find(f => {
                    if (f.type === 'feat') {
                        return f.name === featureName && f.type === featureType;
                    }
                    return f.name === featureName &&
                        f.className === featureClass &&
                        (f.subclassShortName || '') === featureSubclass;
                });

                if (feature) {
                    selectFeatureFromPicker(feature);
                }
            });
        });
    } catch (error) {
        console.error('Error loading features:', error);
        resultsContainer.innerHTML = '<p class="error-hint" style="padding: 16px; text-align: center; color: var(--color-danger);">Error loading features</p>';
    }
}

// Select a feature from the picker and add it to the character
function selectFeatureFromPicker(feature) {
    const state = getState();
    const character = state.editingCharacter;

    if (!character.features) character.features = [];

    // Format the feature name with class/subclass info
    let featureName = feature.name;
    if (feature.subclassShortName) {
        featureName = `${feature.name} (${feature.subclassShortName})`;
    }

    character.features.push({
        name: featureName,
        description: feature.description || ''
    });

    closeFeaturePicker();
    renderFeatures();

    showToast(`Added ${feature.name}`);
}

// Register element if not already registered
if (!customElements.get('character-edit-view')) {
    customElements.define('character-edit-view', CharacterEditViewElement);
}

export default {
    init,
    renderForm,
    updateProficiencyDisplay,
    updateAbilityModifiers,
    renderFeatures,
    addFeature,
    renderEquipment,
    addEquipment,
    renderAttacks,
    addAttack,
    renderTrackers,
    addTracker,
    renderSpellSlots,
    renderSpells,
    openSpellPicker,
    closeSpellPicker,
    renderSpellPickerResults,
    openFeaturePicker,
    closeFeaturePicker,
    renderFeaturePickerResults,
    updateSubclassSuggestions,
    saveCharacter,
    deleteCharacter,
    cancelEdit
};
