// Character View Component - Read-only character sheet display

import * as Characters from '../../services/characters.js';
import { escapeHtml, showToast } from '../../utils/helpers.js';
import { getSpellUrl } from '../../services/spells.js';

let currentCharacterId = null;

// Get current character ID
export function getCurrentCharacterId() {
    return currentCharacterId;
}

// Render the character sheet view
export function render(characterId) {
    currentCharacterId = characterId;
    const container = document.getElementById('character-view-content');
    const character = Characters.getCharacter(characterId);

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
                                    return `<li><a href="${getSpellUrl(spellName)}" target="_blank" rel="noopener noreferrer">${escapeHtml(spellName)}</a></li>`;
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
                                    return `<li><a href="${getSpellUrl(spellName)}" target="_blank" rel="noopener noreferrer">${escapeHtml(spellName)}</a></li>`;
                                }).join('')}
                            </ul>
                        </div>
                    ` : ''}
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
        if (window.openCharacterHpModal) {
            window.openCharacterHpModal(characterId);
        }
    });

    // Add click handlers for spell slot items (entire row is clickable)
    container.querySelectorAll('.spell-slot-item').forEach(item => {
        item.addEventListener('click', () => {
            const level = parseInt(item.dataset.level);
            handleSpellSlotClick(characterId, level);
        });
    });

    // Add click handlers for death save items (entire box is clickable)
    container.querySelector('#death-save-view-success')?.addEventListener('click', () => {
        handleViewDeathSaveClick('success');
    });

    container.querySelector('#death-save-view-failure')?.addEventListener('click', () => {
        handleViewDeathSaveClick('failure');
    });

    // Add click handler for hit dice box
    container.querySelector('#hit-dice-view-box')?.addEventListener('click', () => {
        handleHitDiceClick();
    });

    // Add click handler for currency row (money management)
    container.querySelector('.currency-clickable')?.addEventListener('click', () => {
        if (window.openMoneyModal) {
            window.openMoneyModal(characterId);
        }
    });

    // Add click handlers for trackers
    container.querySelectorAll('.tracker-box.clickable').forEach(box => {
        box.addEventListener('click', () => {
            const trackerIndex = parseInt(box.dataset.trackerIndex);
            handleTrackerClick(trackerIndex);
        });
    });
}

// Handle spell slot click - expend a slot
function handleSpellSlotClick(characterId, level) {
    const character = Characters.getCharacter(characterId);
    if (!character || !character.spellSlots?.[level]) return;

    const slot = character.spellSlots[level];
    const available = slot.total - (slot.used || 0);

    // Only allow expending if slots are available
    if (available <= 0) return;

    if (confirm(`Expend a Level ${level} spell slot?`)) {
        slot.used = (slot.used || 0) + 1;
        Characters.saveCharacter(character);
        render(characterId);
    }
}

// Handle death save circle click in view mode
// Clicking adds one circle; if all 3 are filled, clears all
export function handleViewDeathSaveClick(type) {
    if (!currentCharacterId) return;
    
    const character = Characters.getCharacter(currentCharacterId);
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
    render(currentCharacterId);
}

// Helper function to render death save boxes (legacy - static display)
function renderDeathSaveBoxes(count, type) {
    const boxes = [];
    for (let i = 0; i < 3; i++) {
        const filled = i < count;
        boxes.push(`<span class="death-save-box ${type} ${filled ? 'filled' : ''}"></span>`);
    }
    return boxes.join('');
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

// Handle hit dice click - use one hit die
function handleHitDiceClick() {
    if (!currentCharacterId) return;
    
    const character = Characters.getCharacter(currentCharacterId);
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
    render(currentCharacterId);
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

// Handle tracker click - use one charge, wrap around when empty
function handleTrackerClick(trackerIndex) {
    if (!currentCharacterId) return;
    
    const character = Characters.getCharacter(currentCharacterId);
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
    render(currentCharacterId);
}

// Perform a long rest - resets spell slots, hit dice, death saves, HP, and trackers
export function performLongRest() {
    if (!currentCharacterId) return;
    
    const character = Characters.getCharacter(currentCharacterId);
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
    render(currentCharacterId);
    
    // Show confirmation toast
    showToast('Long rest complete');
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

// Helper to get ordinal suffix
function getOrdinalSuffix(n) {
    if (n === 1) return 'st';
    if (n === 2) return 'nd';
    if (n === 3) return 'rd';
    return 'th';
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

export default {
    render,
    getCurrentCharacterId
};
