// Character View Component (read-only character sheet) as a light-DOM WebComponent

import * as Characters from '../../services/characters.js';
import { getState, setCharacterEditSource } from '../../services/state.js';
import * as Router from '../../utils/router.js';
import { escapeHtml, showToast, closeModals } from '../../utils/helpers.js';

class CharacterViewElement extends HTMLElement {
    cleanupController = null
    currentCharacterId = null

    // Character HP modal state (uses the shared #hp-modal)
    hpModalCharacterId = null
    hpModalCurrentHp = 0
    hpModalTempHp = 0
    hpModalEffectiveMax = 0

    // Money modal state
    moneyModalCharacterId = null

    constructor() {
        super();
    }

    connectedCallback() {
        this.cleanupController = new AbortController()

        // Render the internal structure: view header, sheet content + money modal
        this.innerHTML = `
            <div class="view-header">
                <button id="long-rest-btn" class="long-rest-btn">Long Rest</button>
                <button id="character-view-edit" class="btn">Edit</button>
            </div>
            <div id="character-view-content"></div>

            <!-- Money Management Modal -->
            <div id="money-modal" class="modal">
                <div class="modal-content modal-small">
                    <div class="modal-header">
                        <h2>Manage Money</h2>
                        <button type="button" class="close-modal" aria-label="Close">&times;</button>
                    </div>
                    <div class="modal-body">
                        <div class="money-current">
                            <span class="money-item pp"><span id="money-current-pp">0</span> PP</span>
                            <span class="money-item gp"><span id="money-current-gp">0</span> GP</span>
                            <span class="money-item ep"><span id="money-current-ep">0</span> EP</span>
                            <span class="money-item sp"><span id="money-current-sp">0</span> SP</span>
                            <span class="money-item cp"><span id="money-current-cp">0</span> CP</span>
                        </div>
                        <div class="money-inputs">
                            <div class="money-input-item pp">
                                <input type="number" id="money-input-pp" min="0" placeholder="0">
                                <label for="money-input-pp">PP</label>
                            </div>
                            <div class="money-input-item gp">
                                <input type="number" id="money-input-gp" min="0" placeholder="0">
                                <label for="money-input-gp">GP</label>
                            </div>
                            <div class="money-input-item ep">
                                <input type="number" id="money-input-ep" min="0" placeholder="0">
                                <label for="money-input-ep">EP</label>
                            </div>
                            <div class="money-input-item sp">
                                <input type="number" id="money-input-sp" min="0" placeholder="0">
                                <label for="money-input-sp">SP</label>
                            </div>
                            <div class="money-input-item cp">
                                <input type="number" id="money-input-cp" min="0" placeholder="0">
                                <label for="money-input-cp">CP</label>
                            </div>
                        </div>
                        <div class="money-actions">
                            <button type="button" id="money-withdraw-btn" class="btn btn-danger">Withdraw</button>
                            <button type="button" id="money-deposit-btn" class="btn btn-success">Deposit</button>
                        </div>
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

        // Character view edit button
        this.querySelector('#character-view-edit').addEventListener('click', () => {
            const characterId = this.getCurrentCharacterId();
            if (characterId) {
                // Track that we're coming from character view
                setCharacterEditSource('view');
                Router.navigateToItem('characters', characterId, 'edit');
            }
        }, {signal});

        // Character view long rest button
        this.querySelector('#long-rest-btn').addEventListener('click', () => {
            this.performLongRest();
        }, {signal});

        // Money withdraw button
        this.querySelector('#money-withdraw-btn').addEventListener('click', () => {
            this.withdrawMoney();
        }, {signal});

        // Money deposit button
        this.querySelector('#money-deposit-btn').addEventListener('click', () => {
            this.depositMoney();
        }, {signal});

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

    // Get current character ID
    getCurrentCharacterId() {
        return this.currentCharacterId;
    }

    // Render the character sheet view
    render(characterId) {
        this.currentCharacterId = characterId;
        const container = this.querySelector('#character-view-content');
        const character = Characters.getCharacter(characterId);

        if (!container) return;

        if (!character) {
            container.innerHTML = `
                <div class="empty-state">
                    <h3>Character Not Found</h3>
                    <p>This character may have been deleted.</p>
                </div>
            `;
            return;
        }

        const profBonus = Characters.getProficiencyBonus(character.level);

        container.innerHTML = `
            <div class="character-sheet">
                <!-- Header Section -->
                <section class="character-header-section">
                    <h1 class="character-name">${escapeHtml(character.name) || 'Unnamed Character'}</h1>
                    <div class="character-subtitle">
                        ${character.level ? `Level ${character.level}` : ''}
                        ${escapeHtml(character.class) || ''}
                        ${character.subclass ? `(${escapeHtml(character.subclass)})` : ''}
                    </div>
                    <div class="character-info-row">
                        <span>${escapeHtml(character.species) || '-'}</span>
                        <span>${escapeHtml(character.background) || '-'}</span>
                        <span>${escapeHtml(character.alignment) || '-'}</span>
                    </div>
                    ${character.experiencePoints ? `<div class="character-xp">XP: ${character.experiencePoints.toLocaleString()}</div>` : ''}
                </section>

                <!-- Combat Stats Section -->
                <section class="character-combat-section">
                    <div class="combat-stats-grid">
                        <div class="combat-stat-box">
                            <div class="combat-stat-value">${character.armorClass || 10}</div>
                            <div class="combat-stat-label">Armor Class</div>
                            ${character.acDescription ? `<div class="combat-stat-note">${escapeHtml(character.acDescription)}</div>` : ''}
                        </div>
                        <div class="combat-stat-box">
                            <div class="combat-stat-value">${Characters.formatModifier(Characters.getInitiativeModifier(character) + (character.initiative || 0))}</div>
                            <div class="combat-stat-label">Initiative</div>
                        </div>
                        <div class="combat-stat-box">
                            <div class="combat-stat-value">${character.speed || 30} ft</div>
                            <div class="combat-stat-label">Speed</div>
                        </div>
                    </div>

                    <div class="hp-section hp-clickable" data-character-id="${character.id}" title="Click to update HP">
                        <div class="hp-box">
                            <div class="hp-current">${character.hitPointsCurrent ?? character.hitPointsMax ?? '-'}</div>
                            <div class="hp-divider">/</div>
                            <div class="hp-max">${Characters.getEffectiveMaxHp(character) || '-'}</div>
                            ${character.hitPointsTemp ? `<div class="hp-temp">+${character.hitPointsTemp} temp</div>` : ''}
                        </div>
                        <div class="hp-label">Hit Points</div>
                        ${character.hitPointsMaxReduction ? `<div class="hp-reduction-note">(-${character.hitPointsMaxReduction} max HP)</div>` : ''}
                    </div>

                    <div class="combat-extras-grid">
                        <div class="hit-dice-box clickable" id="hit-dice-view-box">
                            <div class="hit-dice-label">Hit Dice (${escapeHtml(parseHitDiceType(character.hitDiceTotal)) || '?'})</div>
                            <div class="hit-dice-circles">
                                ${renderHitDiceCircles(character.level || 1, character.hitDiceUsed || 0)}
                            </div>
                            <div class="hit-dice-count">${(character.level || 1) - (character.hitDiceUsed || 0)} / ${character.level || 1}</div>
                        </div>
                        <div class="death-saves-box" id="death-saves-view-box">
                            <div class="death-saves-label">Death Saves</div>
                            <div class="death-saves-grid">
                                <div class="death-save-item success" id="death-save-view-success">
                                    <span class="death-save-type">Success</span>
                                    <div class="death-save-circles">
                                        ${renderDeathSaveCircles(character.deathSaves?.successes || 0, 'success')}
                                    </div>
                                </div>
                                <div class="death-save-item failure" id="death-save-view-failure">
                                    <span class="death-save-type">Failure</span>
                                    <div class="death-save-circles">
                                        ${renderDeathSaveCircles(character.deathSaves?.failures || 0, 'failure')}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>

                <!-- Ability Scores Section -->
                <section class="character-abilities-section">
                    <h2>Ability Scores</h2>
                    <div class="abilities-grid">
                        ${Characters.ABILITIES.map(ability => {
                            const score = character.abilities?.[ability] || 10;
                            const mod = Characters.getAbilityModifier(score);
                            const saveMod = Characters.getSavingThrowModifier(character, ability);
                            const hasSaveProf = character.saveProficiencies?.[ability];

                            return `
                                <div class="ability-box">
                                    <div class="ability-name">${Characters.ABILITY_NAMES[ability]}</div>
                                    <div class="ability-score">${score}</div>
                                    <div class="ability-mod">${Characters.formatModifier(mod)}</div>
                                    <div class="ability-save ${hasSaveProf ? 'proficient' : ''}">
                                        Save: ${Characters.formatModifier(saveMod)}
                                        ${hasSaveProf ? ' ●' : ''}
                                    </div>
                                </div>
                            `;
                        }).join('')}
                    </div>
                    <div class="proficiency-bonus">Proficiency Bonus: +${profBonus}</div>
                </section>

                <!-- Skills Section -->
                <section class="character-skills-section">
                    <h2>Skills</h2>
                    <div class="skills-list">
                        ${Object.keys(Characters.SKILL_NAMES).sort().map(skillKey => {
                            const skillMod = Characters.getSkillModifier(character, skillKey);
                            const isProf = character.skillProficiencies?.[skillKey];
                            const isExpert = character.skillExpertise?.[skillKey];
                            const ability = Characters.SKILLS[skillKey];

                            return `
                                <div class="skill-row ${isProf ? 'proficient' : ''} ${isExpert ? 'expertise' : ''}">
                                    <span class="skill-prof-indicator">${isExpert ? '◆' : isProf ? '●' : '○'}</span>
                                    <span class="skill-mod">${Characters.formatModifier(skillMod)}</span>
                                    <span class="skill-name">${Characters.SKILL_NAMES[skillKey]}</span>
                                    <span class="skill-ability">(${ability.substring(0, 3).toUpperCase()})</span>
                                </div>
                            `;
                        }).join('')}
                    </div>
                    <div class="passive-perception">
                        Passive Perception: ${Characters.getPassivePerception(character)}
                    </div>
                </section>

                <!-- Attacks Section -->
                ${character.attacks && character.attacks.length > 0 ? `
                    <section class="character-attacks-section">
                        <h2>Attacks & Actions</h2>
                        <div class="attacks-table">
                            <div class="attacks-header">
                                <span>Name</span>
                                <span>Atk Bonus</span>
                                <span>Damage/Type</span>
                            </div>
                            ${character.attacks.map(attack => `
                                <div class="attack-row">
                                    <span class="attack-name">${escapeHtml(attack.name)}</span>
                                    <span class="attack-bonus">${attack.bonus ? Characters.formatModifier(attack.bonus) : '-'}</span>
                                    <span class="attack-damage">${escapeHtml(attack.damage) || '-'}</span>
                                </div>
                            `).join('')}
                        </div>
                    </section>
                ` : ''}

                <!-- Proficiencies & Languages Section -->
                ${(hasProficiencies(character) || character.languages?.length > 0) ? `
                    <section class="character-proficiencies-section">
                        <h2>Proficiencies & Languages</h2>
                        ${character.armorProficiencies?.length > 0 ? `
                            <div class="proficiency-group">
                                <strong>Armor:</strong> ${character.armorProficiencies.map(p => escapeHtml(p)).join(', ')}
                            </div>
                        ` : ''}
                        ${character.weaponProficiencies?.length > 0 ? `
                            <div class="proficiency-group">
                                <strong>Weapons:</strong> ${character.weaponProficiencies.map(p => escapeHtml(p)).join(', ')}
                            </div>
                        ` : ''}
                        ${character.toolProficiencies?.length > 0 ? `
                            <div class="proficiency-group">
                                <strong>Tools:</strong> ${character.toolProficiencies.map(p => escapeHtml(p)).join(', ')}
                            </div>
                        ` : ''}
                        ${character.languages?.length > 0 ? `
                            <div class="proficiency-group">
                                <strong>Languages:</strong> ${character.languages.map(l => escapeHtml(l)).join(', ')}
                            </div>
                        ` : ''}
                    </section>
                ` : ''}

                <!-- Personality Section -->
                ${hasPersonality(character) ? `
                    <section class="character-personality-section">
                        <h2>Personality</h2>
                        ${character.personalityTraits ? `
                            <div class="personality-box">
                                <strong>Personality Traits</strong>
                                <p>${escapeHtml(character.personalityTraits)}</p>
                            </div>
                        ` : ''}
                        ${character.ideals ? `
                            <div class="personality-box">
                                <strong>Ideals</strong>
                                <p>${escapeHtml(character.ideals)}</p>
                            </div>
                        ` : ''}
                        ${character.bonds ? `
                            <div class="personality-box">
                                <strong>Bonds</strong>
                                <p>${escapeHtml(character.bonds)}</p>
                            </div>
                        ` : ''}
                        ${character.flaws ? `
                            <div class="personality-box">
                                <strong>Flaws</strong>
                                <p>${escapeHtml(character.flaws)}</p>
                            </div>
                        ` : ''}
                    </section>
                ` : ''}

                <!-- Trackers Section (Ki Points, Rage, etc.) -->
                ${character.trackers?.length > 0 ? `
                    <section class="character-trackers-section">
                        <h2>Trackers</h2>
                        <div class="trackers-grid">
                            ${character.trackers.map((tracker, index) => `
                                <div class="tracker-box clickable" data-tracker-index="${index}" title="Click to use">
                                    <div class="tracker-label">${escapeHtml(tracker.name) || 'Unnamed Tracker'}</div>
                                    <div class="tracker-circles">
                                        ${renderTrackerCircles(tracker.max || 0, tracker.used || 0)}
                                    </div>
                                    <div class="tracker-count">${(tracker.max || 0) - (tracker.used || 0)} / ${tracker.max || 0}</div>
                                </div>
                            `).join('')}
                        </div>
                    </section>
                ` : ''}

                <!-- Spellcasting Section -->
                ${hasSpellcasting(character) ? `
                    <section class="character-spellcasting-section">
                        <h2>Spellcasting</h2>
                        <div class="spellcasting-stats">
                            ${character.spellcastingAbility ? `<span>Ability: ${character.spellcastingAbility.toUpperCase()}</span>` : ''}
                            ${character.spellSaveDC ? `<span>Save DC: ${character.spellSaveDC}</span>` : ''}
                            ${character.spellAttackBonus ? `<span>Attack: ${Characters.formatModifier(character.spellAttackBonus)}</span>` : ''}
                        </div>

                        ${renderSpellSlots(character.spellSlots)}

                        ${character.cantripsKnown?.length > 0 ? `
                            <div class="spell-level-group">
                                <h3>Cantrips</h3>
                                <ul class="spells-list">
                                    ${character.cantripsKnown.map(spell => {
                                        const spellName = typeof spell === 'string' ? spell : spell.name;
                                        return `<li><a href="#" class="spell-link" data-spell="${escapeHtml(spellName)}">${escapeHtml(spellName)}</a></li>`;
                                    }).join('')}
                                </ul>
                            </div>
                        ` : ''}

                        ${character.spellsKnown?.length > 0 ? `
                            <div class="spell-level-group">
                                <h3>Prepared Spells</h3>
                                <ul class="spells-list">
                                    ${character.spellsKnown.map(spell => {
                                        const spellName = typeof spell === 'string' ? spell : spell.name;
                                        return `<li><a href="#" class="spell-link" data-spell="${escapeHtml(spellName)}">${escapeHtml(spellName)}</a></li>`;
                                    }).join('')}
                                </ul>
                            </div>
                        ` : ''}
                    </section>
                ` : ''}

                <!-- Features & Traits Section -->
                ${(character.features?.length > 0 || character.traits) ? `
                    <section class="character-features-section">
                        <h2>Features & Traits</h2>
                        ${character.features?.length > 0 ? `
                            <div class="features-list">
                                ${character.features.map(feature => `
                                    <div class="feature-item">
                                        <strong>${escapeHtml(feature.name)}</strong>
                                        ${feature.description ? `<p>${escapeHtml(feature.description)}</p>` : ''}
                                    </div>
                                `).join('')}
                            </div>
                        ` : ''}
                        ${character.traits ? `<div class="traits-text">${escapeHtml(character.traits)}</div>` : ''}
                    </section>
                ` : ''}

                <!-- Equipment Section -->
                <section class="character-equipment-section">
                    <h2>Equipment</h2>
                    ${hasMoney(character) ? `
                        <div class="currency-row currency-clickable" data-character-id="${character.id}" title="Click to manage money">
                            ${character.platinumPieces ? `<span class="currency pp">${character.platinumPieces} PP</span>` : ''}
                            ${character.goldPieces ? `<span class="currency gp">${character.goldPieces} GP</span>` : ''}
                            ${character.electrumPieces ? `<span class="currency ep">${character.electrumPieces} EP</span>` : ''}
                            ${character.silverPieces ? `<span class="currency sp">${character.silverPieces} SP</span>` : ''}
                            ${character.copperPieces ? `<span class="currency cp">${character.copperPieces} CP</span>` : ''}
                        </div>
                    ` : `
                        <div class="currency-row currency-clickable currency-empty" data-character-id="${character.id}" title="Click to add money">
                            <span class="currency-empty-text">No money (tap to add)</span>
                        </div>
                    `}
                    ${character.equipment?.length > 0 ? `
                        <ul class="equipment-list">
                            ${character.equipment.map(item => `
                                <li>${escapeHtml(typeof item === 'string' ? item : item.name)}${item.quantity > 1 ? ` (×${item.quantity})` : ''}</li>
                            `).join('')}
                        </ul>
                    ` : ''}
                </section>

                <!-- Notes Section -->
                ${character.notes ? `
                    <section class="character-notes-section">
                        <h2>Notes</h2>
                        <div class="notes-content">${escapeHtml(character.notes)}</div>
                    </section>
                ` : ''}
            </div>
        `;

        // Add click handler for HP section
        container.querySelector('.hp-clickable')?.addEventListener('click', () => {
            this.openCharacterHpModal(characterId);
        });

        // Add click handlers for spell slot items (entire row is clickable)
        container.querySelectorAll('.spell-slot-item').forEach(item => {
            item.addEventListener('click', () => {
                const level = parseInt(item.dataset.level);
                this.handleSpellSlotClick(characterId, level);
            });
        });

        // Add click handlers for death save items (entire box is clickable)
        container.querySelector('#death-save-view-success')?.addEventListener('click', () => {
            this.handleViewDeathSaveClick('success');
        });

        container.querySelector('#death-save-view-failure')?.addEventListener('click', () => {
            this.handleViewDeathSaveClick('failure');
        });

        // Add click handler for hit dice box
        container.querySelector('#hit-dice-view-box')?.addEventListener('click', () => {
            this.handleHitDiceClick();
        });

        // Add click handler for currency row (money management)
        container.querySelector('.currency-clickable')?.addEventListener('click', () => {
            this.openMoneyModal(characterId);
        });

        // Add click handlers for trackers
        container.querySelectorAll('.tracker-box.clickable').forEach(box => {
            box.addEventListener('click', () => {
                const trackerIndex = parseInt(box.dataset.trackerIndex);
                this.handleTrackerClick(trackerIndex);
            });
        });
    }

    // Handle spell slot click - expend a slot
    handleSpellSlotClick(characterId, level) {
        const character = Characters.getCharacter(characterId);
        if (!character || !character.spellSlots?.[level]) return;

        const slot = character.spellSlots[level];
        const available = slot.total - (slot.used || 0);

        // Only allow expending if slots are available
        if (available <= 0) return;

        if (confirm(`Expend a Level ${level} spell slot?`)) {
            slot.used = (slot.used || 0) + 1;
            Characters.saveCharacter(character);
            this.render(characterId);
        }
    }

    // Handle death save circle click in view mode
    // Clicking adds one circle; if all 3 are filled, clears all
    handleViewDeathSaveClick(type) {
        if (!this.currentCharacterId) return;

        const character = Characters.getCharacter(this.currentCharacterId);
        if (!character) return;

        // Get current count
        if (!character.deathSaves) {
            character.deathSaves = { successes: 0, failures: 0 };
        }

        const currentValue = type === 'success'
            ? character.deathSaves.successes
            : character.deathSaves.failures;

        // If all 3 filled, clear to 0; otherwise add one
        const newValue = currentValue >= 3 ? 0 : currentValue + 1;

        // Update character state
        if (type === 'success') {
            character.deathSaves.successes = newValue;
        } else {
            character.deathSaves.failures = newValue;
        }

        // Save and re-render
        Characters.saveCharacter(character);
        this.render(this.currentCharacterId);
    }

    // Handle hit dice click - use one hit die
    handleHitDiceClick() {
        if (!this.currentCharacterId) return;

        const character = Characters.getCharacter(this.currentCharacterId);
        if (!character) return;

        const total = character.level || 1;
        const used = character.hitDiceUsed || 0;
        const available = total - used;

        // Only use if there are available hit dice
        if (available <= 0) return;

        // Use one hit die
        character.hitDiceUsed = used + 1;

        // Save and re-render
        Characters.saveCharacter(character);
        this.render(this.currentCharacterId);
    }

    // Handle tracker click - use one charge, wrap around when empty
    handleTrackerClick(trackerIndex) {
        if (!this.currentCharacterId) return;

        const character = Characters.getCharacter(this.currentCharacterId);
        if (!character || !character.trackers || !character.trackers[trackerIndex]) return;

        const tracker = character.trackers[trackerIndex];
        const max = tracker.max || 0;
        const used = tracker.used || 0;
        const available = max - used;

        // If no charges available, wrap around to full
        if (available <= 0) {
            tracker.used = 0;
        } else {
            // Use one charge
            tracker.used = used + 1;
        }

        // Save and re-render
        Characters.saveCharacter(character);
        this.render(this.currentCharacterId);
    }

    // Perform a long rest - resets spell slots, hit dice, death saves, HP, and trackers
    performLongRest() {
        if (!this.currentCharacterId) return;

        const character = Characters.getCharacter(this.currentCharacterId);
        if (!character) return;

        // Reset all spell slot used counts to 0
        if (character.spellSlots) {
            for (const level in character.spellSlots) {
                character.spellSlots[level].used = 0;
            }
        }

        // Reset hit dice used to 0
        character.hitDiceUsed = 0;

        // Reset death saves
        character.deathSaves = { successes: 0, failures: 0 };

        // Reset current HP to max HP
        character.hitPointsCurrent = character.hitPointsMax || 0;

        // Reset trackers that have resetOnLongRest enabled (default true)
        if (character.trackers) {
            character.trackers.forEach(tracker => {
                // resetOnLongRest defaults to true (checked !== false)
                if (tracker.resetOnLongRest !== false) {
                    tracker.used = 0;
                }
            });
        }

        // Save and re-render
        Characters.saveCharacter(character);
        this.render(this.currentCharacterId);

        // Show confirmation toast
        showToast('Long rest complete');
    }

    // === Character HP Modal (uses shared #hp-modal) ===

    openCharacterHpModal(characterId) {
        const character = Characters.getCharacter(characterId);
        if (!character) return;

        this.hpModalCharacterId = characterId;
        const modal = document.querySelector('hp-modal');

        // Calculate effective max HP
        this.hpModalEffectiveMax = Characters.getEffectiveMaxHp(character);
        this.hpModalCurrentHp = character.hitPointsCurrent ?? 0;
        this.hpModalTempHp = character.hitPointsTemp || 0;

        modal.configure({
            onAdjust: (amount) => this.addToCharacterHPDelta(amount),
            onReset: () => this.resetCharacterHPDelta(),
            onApply: () => this.saveCharacterHP(),
            onAmountInput: () => this.updateCharacterHPPreview(),
            onTempInput: () => this.onCharacterTempHpInput(),
            onMaxReductionInput: () => this.onCharacterMaxReductionInput(),
        });

        // Set up modal for character mode
        modal.setTitle(`${character.name} - HP`);
        modal.setHpDisplay(this.hpModalCurrentHp, this.hpModalEffectiveMax);
        modal.setAmount(0);

        // Show temp HP in display if present
        if (this.hpModalTempHp > 0) {
            modal.showTempDisplay(this.hpModalTempHp);
        } else {
            modal.hideTempDisplay();
        }

        // Show character-specific fields, hide the instance selector (monsters only)
        modal.showCharacterFields();
        modal.setTempInput(this.hpModalTempHp);
        modal.setMaxReductionInput(character.hitPointsMaxReduction || 0);
        modal.hideInstanceSelector();
        modal.hidePreview();

        modal.open();
    }

    updateCharacterHPDisplay() {
        const modal = document.querySelector('hp-modal');
        modal.setHpDisplay(this.hpModalCurrentHp, this.hpModalEffectiveMax);

        if (this.hpModalTempHp > 0) {
            modal.showTempDisplay(this.hpModalTempHp);
        } else {
            modal.hideTempDisplay();
        }

        modal.setTempInput(this.hpModalTempHp);
    }

    // Reset the pending HP delta (Reset button)
    resetCharacterHPDelta() {
        const modal = document.querySelector('hp-modal');
        modal.setAmount(0);
        this.updateCharacterHPPreview();
    }

    // Add to HP delta for character (just updates input and preview)
    addToCharacterHPDelta(amount) {
        const modal = document.querySelector('hp-modal');
        modal.setAmount(modal.getAmount() + amount);
        this.updateCharacterHPPreview();
    }

    // Update HP preview for character
    updateCharacterHPPreview() {
        const modal = document.querySelector('hp-modal');
        const delta = modal.getAmount();

        if (delta === 0) {
            modal.hidePreview();
            modal.setAmountTone(null);
            return;
        }

        modal.setAmountTone(delta < 0 ? 'damage' : 'heal');

        // Calculate preview considering temp HP for damage
        let previewHp;
        if (delta < 0) {
            let damage = Math.abs(delta);
            let tempRemaining = this.hpModalTempHp;
            if (tempRemaining > 0) {
                const tempDamage = Math.min(tempRemaining, damage);
                damage -= tempDamage;
            }
            previewHp = Math.max(0, this.hpModalCurrentHp - damage);
        } else {
            previewHp = Math.min(this.hpModalEffectiveMax, this.hpModalCurrentHp + delta);
        }

        modal.showPreview(previewHp, previewHp <= 0);
    }

    // Update effective max HP when the max-reduction input changes
    onCharacterMaxReductionInput() {
        const character = Characters.getCharacter(this.hpModalCharacterId);
        if (!character) return;

        const modal = document.querySelector('hp-modal');
        const reduction = modal.getMaxReductionInput();
        this.hpModalEffectiveMax = Math.max(0, (character.hitPointsMax || 0) - reduction);

        // Cap current HP at effective max
        if (this.hpModalCurrentHp > this.hpModalEffectiveMax) {
            this.hpModalCurrentHp = this.hpModalEffectiveMax;
        }

        this.updateCharacterHPDisplay();
    }

    // Update temp HP when its input changes
    onCharacterTempHpInput() {
        const modal = document.querySelector('hp-modal');
        this.hpModalTempHp = modal.getTempInput();
        this.updateCharacterHPDisplay();
    }

    // Save character HP and close modal
    saveCharacterHP() {
        const character = Characters.getCharacter(this.hpModalCharacterId);
        if (!character) return;

        // Save the character ID before closeModals resets it
        const characterId = this.hpModalCharacterId;

        // Apply any pending HP delta before saving
        const modal = document.querySelector('hp-modal');
        const delta = modal.getAmount();

        if (delta !== 0) {
            if (delta < 0) {
                // Damage: reduce temp HP first, then current
                let damage = Math.abs(delta);
                if (this.hpModalTempHp > 0) {
                    const tempDamage = Math.min(this.hpModalTempHp, damage);
                    this.hpModalTempHp -= tempDamage;
                    damage -= tempDamage;
                }
                this.hpModalCurrentHp = Math.max(0, this.hpModalCurrentHp - damage);
            } else {
                // Healing: increase current HP up to effective max
                this.hpModalCurrentHp = Math.min(this.hpModalEffectiveMax, this.hpModalCurrentHp + delta);
            }
        }

        character.hitPointsCurrent = this.hpModalCurrentHp;
        character.hitPointsTemp = this.hpModalTempHp;
        character.hitPointsMaxReduction = modal.getMaxReductionInput();

        Characters.saveCharacter(character);
        closeModals();

        // Refresh the character view if we're on it
        const currentState = getState();
        if (currentState.currentView === 'character-view') {
            this.render(characterId);
        }

        showToast('HP updated');
    }

    // === Money Management Modal ===

    openMoneyModal(characterId) {
        const character = Characters.getCharacter(characterId);
        if (!character) return;

        this.moneyModalCharacterId = characterId;
        const modal = this.querySelector('#money-modal');

        // Display current money
        this.querySelector('#money-current-pp').textContent = character.platinumPieces || 0;
        this.querySelector('#money-current-gp').textContent = character.goldPieces || 0;
        this.querySelector('#money-current-ep').textContent = character.electrumPieces || 0;
        this.querySelector('#money-current-sp').textContent = character.silverPieces || 0;
        this.querySelector('#money-current-cp').textContent = character.copperPieces || 0;

        // Clear all currency inputs
        this.querySelector('#money-input-pp').value = '';
        this.querySelector('#money-input-gp').value = '';
        this.querySelector('#money-input-ep').value = '';
        this.querySelector('#money-input-sp').value = '';
        this.querySelector('#money-input-cp').value = '';

        modal.classList.add('active');
    }

    // Helper to get amounts from all currency inputs
    getMoneyInputAmounts() {
        return {
            pp: parseInt(this.querySelector('#money-input-pp').value) || 0,
            gp: parseInt(this.querySelector('#money-input-gp').value) || 0,
            ep: parseInt(this.querySelector('#money-input-ep').value) || 0,
            sp: parseInt(this.querySelector('#money-input-sp').value) || 0,
            cp: parseInt(this.querySelector('#money-input-cp').value) || 0
        };
    }

    withdrawMoney() {
        if (!this.moneyModalCharacterId) return;

        const character = Characters.getCharacter(this.moneyModalCharacterId);
        if (!character) return;

        const amounts = this.getMoneyInputAmounts();

        if (!hasAnyAmount(amounts)) {
            showToast('Enter an amount', 'error');
            return;
        }

        // Check if character has enough of each currency
        for (const [currency, amount] of Object.entries(amounts)) {
            if (amount > 0) {
                const field = CURRENCY_FIELD_MAP[currency];
                const current = character[field] || 0;
                if (amount > current) {
                    showToast(`Not enough ${currency.toUpperCase()}`, 'error');
                    return;
                }
            }
        }

        // Apply withdrawals
        for (const [currency, amount] of Object.entries(amounts)) {
            if (amount > 0) {
                const field = CURRENCY_FIELD_MAP[currency];
                character[field] = (character[field] || 0) - amount;
            }
        }

        Characters.saveCharacter(character);
        closeModals();

        // Refresh the character view
        const currentState = getState();
        if (currentState.currentView === 'character-view') {
            this.render(this.moneyModalCharacterId);
        }

        showToast(buildMoneyMessage(amounts, 'Withdrew'));
        this.moneyModalCharacterId = null;
    }

    depositMoney() {
        if (!this.moneyModalCharacterId) return;

        const character = Characters.getCharacter(this.moneyModalCharacterId);
        if (!character) return;

        const amounts = this.getMoneyInputAmounts();

        if (!hasAnyAmount(amounts)) {
            showToast('Enter an amount', 'error');
            return;
        }

        // Apply deposits
        for (const [currency, amount] of Object.entries(amounts)) {
            if (amount > 0) {
                const field = CURRENCY_FIELD_MAP[currency];
                character[field] = (character[field] || 0) + amount;
            }
        }

        Characters.saveCharacter(character);
        closeModals();

        // Refresh the character view
        const currentState = getState();
        if (currentState.currentView === 'character-view') {
            this.render(this.moneyModalCharacterId);
        }

        showToast(buildMoneyMessage(amounts, 'Deposited'));
        this.moneyModalCharacterId = null;
    }
}

const CURRENCY_FIELD_MAP = {
    pp: 'platinumPieces',
    gp: 'goldPieces',
    ep: 'electrumPieces',
    sp: 'silverPieces',
    cp: 'copperPieces'
};

// Helper to check if any amount is entered
function hasAnyAmount(amounts) {
    return amounts.pp > 0 || amounts.gp > 0 || amounts.ep > 0 || amounts.sp > 0 || amounts.cp > 0;
}

// Helper to build transaction message
function buildMoneyMessage(amounts, verb) {
    const parts = [];
    if (amounts.pp > 0) parts.push(`${amounts.pp} PP`);
    if (amounts.gp > 0) parts.push(`${amounts.gp} GP`);
    if (amounts.ep > 0) parts.push(`${amounts.ep} EP`);
    if (amounts.sp > 0) parts.push(`${amounts.sp} SP`);
    if (amounts.cp > 0) parts.push(`${amounts.cp} CP`);
    return `${verb} ${parts.join(', ')}`;
}

// Helper function to render clickable death save circles
function renderDeathSaveCircles(count, type) {
    const circles = [];
    for (let i = 0; i < 3; i++) {
        const filled = i < count;
        circles.push(`<span class="death-save-circle ${type} ${filled ? 'filled' : ''}" data-index="${i}"></span>`);
    }
    return circles.join('');
}

// Get hit dice type from string (e.g., "5d8" -> "d8")
function parseHitDiceType(hitDiceTotal) {
    if (!hitDiceTotal) return '';
    const match = hitDiceTotal.match(/d\d+/i);
    return match ? match[0] : '';
}

// Render hit dice circles (similar to spell slots)
function renderHitDiceCircles(total, used) {
    const circles = [];
    const available = total - used;

    // Render available dice first (filled circles)
    for (let i = 0; i < available; i++) {
        circles.push(`<span class="hit-dice-circle available"></span>`);
    }
    // Render used dice (empty circles)
    for (let i = 0; i < used; i++) {
        circles.push(`<span class="hit-dice-circle used"></span>`);
    }
    return circles.join('');
}

// Render tracker circles (similar to hit dice)
function renderTrackerCircles(max, used) {
    const circles = [];
    const available = max - used;

    // Render available first (filled circles)
    for (let i = 0; i < available; i++) {
        circles.push(`<span class="tracker-circle available"></span>`);
    }
    // Render used (empty circles)
    for (let i = 0; i < used; i++) {
        circles.push(`<span class="tracker-circle used"></span>`);
    }
    return circles.join('');
}

// Helper to check if character has money
function hasMoney(character) {
    return character.copperPieces || character.silverPieces ||
           character.electrumPieces || character.goldPieces || character.platinumPieces;
}

// Helper to check if character has proficiencies
function hasProficiencies(character) {
    return (character.armorProficiencies?.length > 0) ||
           (character.weaponProficiencies?.length > 0) ||
           (character.toolProficiencies?.length > 0);
}

// Helper to check if character has personality info
function hasPersonality(character) {
    return character.personalityTraits || character.ideals ||
           character.bonds || character.flaws;
}

// Helper to check if character has spellcasting
function hasSpellcasting(character) {
    return character.spellcastingAbility ||
           character.cantripsKnown?.length > 0 ||
           character.spellsKnown?.length > 0 ||
           hasSpellSlots(character.spellSlots);
}

// Helper to check if character has spell slots
function hasSpellSlots(slots) {
    if (!slots) return false;
    for (let level = 1; level <= 9; level++) {
        if (slots[level]?.total > 0) return true;
    }
    return false;
}

// Helper to render spell slots
function renderSpellSlots(slots) {
    if (!slots || !hasSpellSlots(slots)) return '';

    const slotItems = [];
    for (let level = 1; level <= 9; level++) {
        const slot = slots[level];
        if (slot?.total > 0) {
            const used = slot.used || 0;
            slotItems.push(`
                <div class="spell-slot-item" data-level="${level}">
                    <span class="spell-slot-level">Level ${level}</span>
                    <span class="spell-slot-circles">${renderSlotCircles(slot.total, used)}</span>
                </div>
            `);
        }
    }

    if (slotItems.length === 0) return '';

    return `
        <div class="spell-slots-container">
            <h3>Spell Slots</h3>
            <div class="spell-slots-grid">
                ${slotItems.join('')}
            </div>
        </div>
    `;
}

// Helper to render slot circles (filled = available, empty = used)
function renderSlotCircles(total, used) {
    const circles = [];
    const available = total - used;

    // Render available slots first (filled circles)
    for (let i = 0; i < available; i++) {
        circles.push(`<span class="spell-slot-circle available"></span>`);
    }
    // Render used slots (empty circles)
    for (let i = 0; i < used; i++) {
        circles.push(`<span class="spell-slot-circle used"></span>`);
    }
    return circles.join('');
}

// Register element if not already registered
if (!customElements.get('character-view')) {
    customElements.define('character-view', CharacterViewElement);
}

// Compatibility exports used elsewhere in app
export function render(characterId) {
    const el = document.querySelector('character-view');
    if (el && typeof el.render === 'function') el.render(characterId);
}

export function getCurrentCharacterId() {
    const el = document.querySelector('character-view');
    return el && typeof el.getCurrentCharacterId === 'function' ? el.getCurrentCharacterId() : null;
}

export function performLongRest() {
    const el = document.querySelector('character-view');
    if (el && typeof el.performLongRest === 'function') el.performLongRest();
}

export function handleViewDeathSaveClick(type) {
    const el = document.querySelector('character-view');
    if (el && typeof el.handleViewDeathSaveClick === 'function') el.handleViewDeathSaveClick(type);
}

export default {
    render,
    getCurrentCharacterId,
    performLongRest,
    handleViewDeathSaveClick
};
