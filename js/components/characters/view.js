// Character View Component - Read-only character sheet display

import * as Characters from '../../services/characters.js';
import { escapeHtml } from '../../utils/helpers.js';

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
                
                <div class="hp-section">
                    <div class="hp-box">
                        <div class="hp-current">${character.hitPointsCurrent ?? character.hitPointsMax ?? '-'}</div>
                        <div class="hp-divider">/</div>
                        <div class="hp-max">${character.hitPointsMax || '-'}</div>
                        ${character.hitPointsTemp ? `<div class="hp-temp">+${character.hitPointsTemp} temp</div>` : ''}
                    </div>
                    <div class="hp-label">Hit Points</div>
                </div>

                <div class="combat-extras-grid">
                    <div class="hit-dice-box">
                        <div class="hit-dice-value">${escapeHtml(character.hitDiceTotal) || '-'}</div>
                        <div class="hit-dice-label">Hit Dice</div>
                        ${character.hitDiceUsed ? `<div class="hit-dice-used">(${character.hitDiceUsed} used)</div>` : ''}
                    </div>
                    <div class="death-saves-box">
                        <div class="death-saves-label">Death Saves</div>
                        <div class="death-saves-row">
                            <span class="success-label">S:</span>
                            ${renderDeathSaveBoxes(character.deathSaves?.successes || 0, 'success')}
                        </div>
                        <div class="death-saves-row">
                            <span class="failure-label">F:</span>
                            ${renderDeathSaveBoxes(character.deathSaves?.failures || 0, 'failure')}
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

            <!-- Equipment Section -->
            ${(character.equipment?.length > 0 || hasMoney(character)) ? `
                <section class="character-equipment-section">
                    <h2>Equipment</h2>
                    ${hasMoney(character) ? `
                        <div class="currency-row">
                            ${character.platinumPieces ? `<span class="currency pp">${character.platinumPieces} PP</span>` : ''}
                            ${character.goldPieces ? `<span class="currency gp">${character.goldPieces} GP</span>` : ''}
                            ${character.electrumPieces ? `<span class="currency ep">${character.electrumPieces} EP</span>` : ''}
                            ${character.silverPieces ? `<span class="currency sp">${character.silverPieces} SP</span>` : ''}
                            ${character.copperPieces ? `<span class="currency cp">${character.copperPieces} CP</span>` : ''}
                        </div>
                    ` : ''}
                    ${character.equipment?.length > 0 ? `
                        <ul class="equipment-list">
                            ${character.equipment.map(item => `
                                <li>${escapeHtml(typeof item === 'string' ? item : item.name)}${item.quantity > 1 ? ` (×${item.quantity})` : ''}</li>
                            `).join('')}
                        </ul>
                    ` : ''}
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
                                ${character.cantripsKnown.map(spell => `<li>${escapeHtml(typeof spell === 'string' ? spell : spell.name)}</li>`).join('')}
                            </ul>
                        </div>
                    ` : ''}
                    
                    ${character.spellsKnown?.length > 0 ? `
                        <div class="spell-level-group">
                            <h3>Spells</h3>
                            <ul class="spells-list">
                                ${character.spellsKnown.map(spell => `<li>${escapeHtml(typeof spell === 'string' ? spell : spell.name)}</li>`).join('')}
                            </ul>
                        </div>
                    ` : ''}
                </section>
            ` : ''}

            <!-- Notes Section -->
            ${character.notes ? `
                <section class="character-notes-section">
                    <h2>Notes</h2>
                    <div class="notes-content">${escapeHtml(character.notes)}</div>
                </section>
            ` : ''}
        </div>
    `;
}

// Helper function to render death save boxes
function renderDeathSaveBoxes(count, type) {
    const boxes = [];
    for (let i = 0; i < 3; i++) {
        const filled = i < count;
        boxes.push(`<span class="death-save-box ${type} ${filled ? 'filled' : ''}"></span>`);
    }
    return boxes.join('');
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
    
    const slotRows = [];
    for (let level = 1; level <= 9; level++) {
        const slot = slots[level];
        if (slot?.total > 0) {
            const remaining = slot.total - (slot.used || 0);
            slotRows.push(`
                <div class="spell-slot-row">
                    <span class="spell-slot-level">${level}${getOrdinalSuffix(level)}</span>
                    <span class="spell-slot-boxes">${renderSlotBoxes(slot.total, slot.used || 0)}</span>
                    <span class="spell-slot-count">${remaining}/${slot.total}</span>
                </div>
            `);
        }
    }
    
    if (slotRows.length === 0) return '';
    
    return `
        <div class="spell-slots-container">
            <h3>Spell Slots</h3>
            ${slotRows.join('')}
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

// Helper to render slot boxes
function renderSlotBoxes(total, used) {
    const boxes = [];
    for (let i = 0; i < total; i++) {
        const isUsed = i < used;
        boxes.push(`<span class="spell-slot-box ${isUsed ? 'used' : ''}"></span>`);
    }
    return boxes.join('');
}

export default {
    render,
    getCurrentCharacterId
};
