// Stat Block Modal Component

import * as MonsterAPI from '../../services/monsterApi.js';
import { getLegendaryGroup, formatLegendaryEntries } from '../../services/legendaryGroups.js';
import { escapeHtml, formatSize, formatType, formatAlignment, formatSpeed, formatDamageTypes, formatConditionImmune, formatEntries, formatName, capitalizeFirst, formatSpellList } from '../../utils/helpers.js';

/**
 * Generate the 5e.tools token image URL for a monster
 * URL format: https://5e.tools/img/bestiary/tokens/{SOURCE}/{NAME}.webp
 * @param {Object} monster - The monster object with name and source properties
 * @returns {string|null} The token URL or null if monster has no source
 */
function getTokenUrl(monster) {
    if (!monster || !monster.name) return null;
    
    // Use the monster's source, defaulting to MM (Monster Manual) for custom monsters
    // If the monster provides an external tokenHref, prefer that (homebrew images)
    if (monster.tokenHref && monster.tokenHref.url) {
        return monster.tokenHref.url;
    }
    // Some bestiary files include altArt with tokenHref entries
    if (monster.altArt && monster.altArt.length > 0) {
        for (const art of monster.altArt) {
            if (art.tokenHref && art.tokenHref.url) return art.tokenHref.url;
        }
    }

    // Fallback: use the monster's source (default MM) and 5e.tools token URL
    const source = monster.source || 'MM';
    const encodedName = encodeURIComponent(monster.name);
    return `https://5e.tools/img/bestiary/tokens/${source}/${encodedName}.webp`;
}

export async function showStatBlockByNameSource(name, source, comment = '') {
    const monster = await MonsterAPI.getMonster(name, source);

    if (!monster) {
        alert('Could not load monster stats');
        return;
    }

    await showStatBlock(monster, comment);
}

// Show stat block for a monster object directly (used for custom monsters)
export async function showStatBlock(monster, comment = '') {
    if (!monster) {
        alert('Could not load monster stats');
        return;
    }

    // Render base stat block
    let html = renderStatBlock(monster, comment);

    // Fetch and append lair actions/regional effects if monster has legendaryGroup
    const lairHtml = await renderLairSection(monster);
    if (lairHtml) {
        html += lairHtml;
    }

    document.querySelector('stat-block-modal')?.show(monster.name, html);
}

/**
 * Render lair actions and regional effects section
 * @param {Object} monster - The monster object
 * @returns {Promise<string>} HTML string for lair section
 */
async function renderLairSection(monster) {
    const legendaryGroup = await getLegendaryGroup(monster);
    if (!legendaryGroup) return '';
    
    let html = '';
    
    // Lair Actions
    if (legendaryGroup.lairActions && legendaryGroup.lairActions.length > 0) {
        html += `<div class="divider"></div>`;
        html += `<div class="section-title lair-title">Lair Actions</div>`;
        html += `<div class="lair-section">${formatLegendaryEntries(legendaryGroup.lairActions, formatEntries)}</div>`;
    }
    
    // Regional Effects
    if (legendaryGroup.regionalEffects && legendaryGroup.regionalEffects.length > 0) {
        html += `<div class="divider"></div>`;
        html += `<div class="section-title lair-title">Regional Effects</div>`;
        html += `<div class="lair-section">${formatLegendaryEntries(legendaryGroup.regionalEffects, formatEntries)}</div>`;
    }
    
    return html;
}

export function renderStatBlock(monster, comment = '') {
    const size = formatSize(monster.size);
    const type = formatType(monster.type);
    const alignment = formatAlignment(monster.alignment);
    
    // Generate token image URL (5e.tools format)
    const tokenUrl = getTokenUrl(monster);
    const tokenHtml = tokenUrl 
        ? `<img class="monster-token" src="${tokenUrl}" alt="${escapeHtml(monster.name)}" onerror="this.style.display='none'">`
        : '';
    
    let html = `
        <div class="monster-header">
            ${tokenHtml}
            <div class="monster-header-text">
                <div class="monster-name">${escapeHtml(monster.name)}</div>
                <div class="monster-type">${size} ${type}, ${alignment}</div>
            </div>
        </div>
        <div class="divider"></div>
        <div class="stat-row"><span class="stat-label">Armor Class</span> ${MonsterAPI.getAC(monster)}</div>
        <div class="stat-row"><span class="stat-label">Hit Points</span> ${monster.hp?.average || 0} ${monster.hp?.formula ? `(${monster.hp.formula})` : ''}</div>
        <div class="stat-row"><span class="stat-label">Speed</span> ${formatSpeed(monster.speed)}</div>
        <div class="divider"></div>
        <div class="abilities">
            <div class="ability">
                <div class="ability-name">STR</div>
                <div class="ability-score">${monster.str}</div>
                <div class="ability-mod">(${MonsterAPI.formatMod(MonsterAPI.getAbilityMod(monster.str))})</div>
            </div>
            <div class="ability">
                <div class="ability-name">DEX</div>
                <div class="ability-score">${monster.dex}</div>
                <div class="ability-mod">(${MonsterAPI.formatMod(MonsterAPI.getAbilityMod(monster.dex))})</div>
            </div>
            <div class="ability">
                <div class="ability-name">CON</div>
                <div class="ability-score">${monster.con}</div>
                <div class="ability-mod">(${MonsterAPI.formatMod(MonsterAPI.getAbilityMod(monster.con))})</div>
            </div>
            <div class="ability">
                <div class="ability-name">INT</div>
                <div class="ability-score">${monster.int}</div>
                <div class="ability-mod">(${MonsterAPI.formatMod(MonsterAPI.getAbilityMod(monster.int))})</div>
            </div>
            <div class="ability">
                <div class="ability-name">WIS</div>
                <div class="ability-score">${monster.wis}</div>
                <div class="ability-mod">(${MonsterAPI.formatMod(MonsterAPI.getAbilityMod(monster.wis))})</div>
            </div>
            <div class="ability">
                <div class="ability-name">CHA</div>
                <div class="ability-score">${monster.cha}</div>
                <div class="ability-mod">(${MonsterAPI.formatMod(MonsterAPI.getAbilityMod(monster.cha))})</div>
            </div>
        </div>
        <div class="divider"></div>
    `;

    // Saving throws
    if (monster.save) {
        const saves = Object.entries(monster.save).map(([k, v]) => `${k.toUpperCase()} ${v}`).join(', ');
        html += `<div class="stat-row"><span class="stat-label">Saving Throws</span> ${saves}</div>`;
    }

    // Skills
    if (monster.skill) {
        const skills = Object.entries(monster.skill).map(([k, v]) => `${capitalizeFirst(k)} ${v}`).join(', ');
        html += `<div class="stat-row"><span class="stat-label">Skills</span> ${skills}</div>`;
    }

    // Damage immunities/resistances/vulnerabilities
    if (monster.immune && monster.immune.length > 0) {
        html += `<div class="stat-row"><span class="stat-label">Damage Immunities</span> ${formatDamageTypes(monster.immune, 'immune')}</div>`;
    }
    if (monster.resist && monster.resist.length > 0) {
        html += `<div class="stat-row"><span class="stat-label">Damage Resistances</span> ${formatDamageTypes(monster.resist, 'resist')}</div>`;
    }
    if (monster.vulnerable && monster.vulnerable.length > 0) {
        html += `<div class="stat-row"><span class="stat-label">Damage Vulnerabilities</span> ${formatDamageTypes(monster.vulnerable, 'vulnerable')}</div>`;
    }

    // Condition immunities (strip source suffix like "Grappled|XPHB" -> "Grappled")
    if (monster.conditionImmune && monster.conditionImmune.length > 0) {
        html += `<div class="stat-row"><span class="stat-label">Condition Immunities</span> ${formatConditionImmune(monster.conditionImmune)}</div>`;
    }

    // Senses
    if (monster.senses || monster.passive) {
        const senses = [...(monster.senses || []), `passive Perception ${monster.passive}`].join(', ');
        html += `<div class="stat-row"><span class="stat-label">Senses</span> ${senses}</div>`;
    }

    // Languages
    if (monster.languages) {
        html += `<div class="stat-row"><span class="stat-label">Languages</span> ${monster.languages.join(', ') || '—'}</div>`;
    }

    // CR and Proficiency Bonus
    const profBonus = MonsterAPI.getProficiencyBonus(monster.cr);
    html += `<div class="stat-row"><span class="stat-label">Challenge</span> ${MonsterAPI.formatCR(monster.cr)} <span class="prof-bonus">(Prof. +${profBonus})</span></div>`;
    html += `<div class="divider"></div>`;

    // Traits
    if (monster.trait) {
        monster.trait.forEach(trait => {
            html += `<div class="trait"><span class="trait-name">${formatName(trait.name)}.</span> ${formatEntries(trait.entries)}</div>`;
        });
    }

    // Actions
    if (monster.action || (monster.spellcasting && monster.spellcasting.length > 0)) {
        html += `<div class="section-title">Actions</div>`;
        
        // Regular actions
        if (monster.action) {
            monster.action.forEach(action => {
                html += `<div class="action"><span class="action-name">${formatName(action.name)}.</span> ${formatEntries(action.entries)}</div>`;
            });
        }
        
        // Spellcasting (rendered at the end of actions)
        if (monster.spellcasting && monster.spellcasting.length > 0) {
            monster.spellcasting.forEach(sc => {
                html += `<div class="action"><span class="action-name">${formatName(sc.name) || 'Spellcasting'}.</span> ${formatEntries(sc.headerEntries || [])}</div>`;
                
                // At-will spells
                if (sc.will && sc.will.length > 0) {
                    html += `<div class="spell-list"><span class="spell-level">At will:</span> ${formatSpellList(sc.will)}</div>`;
                }
                
                // Daily spells (1/day, 2/day, 3/day each)
                if (sc.daily) {
                    const dailyOrder = ['4e', '4', '3e', '3', '2e', '2', '1e', '1'];
                    dailyOrder.forEach(key => {
                        if (sc.daily[key] && sc.daily[key].length > 0) {
                            const times = key.charAt(0);
                            const each = key.includes('e') ? ' each' : '';
                            html += `<div class="spell-list"><span class="spell-level">${times}/day${each}:</span> ${formatSpellList(sc.daily[key])}</div>`;
                        }
                    });
                }
                
                // Spell slots by level
                if (sc.spells) {
                    Object.keys(sc.spells).sort((a, b) => parseInt(a) - parseInt(b)).forEach(level => {
                        const spellLevel = sc.spells[level];
                        if (spellLevel.spells && spellLevel.spells.length > 0) {
                            let levelLabel;
                            if (level === '0') {
                                levelLabel = 'Cantrips (at will):';
                            } else {
                                const suffix = level === '1' ? 'st' : level === '2' ? 'nd' : level === '3' ? 'rd' : 'th';
                                const slots = spellLevel.slots ? ` (${spellLevel.slots} slot${spellLevel.slots > 1 ? 's' : ''})` : '';
                                levelLabel = `${level}${suffix} level${slots}:`;
                            }
                            html += `<div class="spell-list"><span class="spell-level">${levelLabel}</span> ${formatSpellList(spellLevel.spells)}</div>`;
                        }
                    });
                }
            });
        }
    }

    // Bonus Actions
    if (monster.bonus && monster.bonus.length > 0) {
        html += `<div class="section-title">Bonus Actions</div>`;
        monster.bonus.forEach(action => {
            html += `<div class="action"><span class="action-name">${formatName(action.name)}.</span> ${formatEntries(action.entries)}</div>`;
        });
    }

    // Reactions
    if (monster.reaction && monster.reaction.length > 0) {
        html += `<div class="section-title">Reactions</div>`;
        monster.reaction.forEach(action => {
            html += `<div class="action"><span class="action-name">${formatName(action.name)}.</span> ${formatEntries(action.entries)}</div>`;
        });
    }

    // Legendary actions
    if (monster.legendary && monster.legendary.length > 0) {
        const numActions = monster.legendaryActions || 3;
        const lairActions = monster.legendaryActionsLair;
        let actionInfo = `${numActions} action${numActions !== 1 ? 's' : ''}`;
        if (lairActions && lairActions !== numActions) {
            actionInfo += `, ${lairActions} in lair`;
        }
        html += `<div class="section-title">Legendary Actions <span class="prof-bonus">(${actionInfo})</span></div>`;
        monster.legendary.forEach(action => {
            html += `<div class="action"><span class="action-name">${formatName(action.name)}.</span> ${formatEntries(action.entries)}</div>`;
        });
    }

    // DM Comment (if provided)
    if (comment && comment.trim()) {
        html += `<div class="divider"></div>`;
        html += `<div class="section-title dm-notes-title">DM Notes</div>`;
        html += `<div class="dm-notes">${escapeHtml(comment)}</div>`;
    }

    return html;
}

export default {
    showStatBlockByNameSource,
    showStatBlock,
    renderStatBlock
};
