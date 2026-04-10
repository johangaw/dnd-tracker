// Stat Block Modal Component

import * as MonsterAPI from '../../services/monsterApi.js';
import { escapeHtml, formatSize, formatType, formatAlignment, formatSpeed, formatDamageTypes, formatEntries, capitalizeFirst } from '../../utils/helpers.js';

export async function showStatBlockByNameSource(name, source, comment = '') {
    const monster = await MonsterAPI.getMonster(name, source);
    
    if (!monster) {
        alert('Could not load monster stats');
        return;
    }

    const modal = document.getElementById('stat-block-modal');
    document.getElementById('stat-block-name').textContent = monster.name;
    document.getElementById('stat-block-content').innerHTML = renderStatBlock(monster, comment);
    
    modal.classList.add('active');
}

// Show stat block for a monster object directly (used for custom monsters)
export function showStatBlock(monster, comment = '') {
    if (!monster) {
        alert('Could not load monster stats');
        return;
    }

    const modal = document.getElementById('stat-block-modal');
    document.getElementById('stat-block-name').textContent = monster.name;
    document.getElementById('stat-block-content').innerHTML = renderStatBlock(monster, comment);
    
    modal.classList.add('active');
}

export function renderStatBlock(monster, comment = '') {
    const size = formatSize(monster.size);
    const type = formatType(monster.type);
    const alignment = formatAlignment(monster.alignment);
    
    let html = `
        <div class="monster-header">
            <div class="monster-name">${escapeHtml(monster.name)}</div>
            <div class="monster-type">${size} ${type}, ${alignment}</div>
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
    if (monster.immune) {
        html += `<div class="stat-row"><span class="stat-label">Damage Immunities</span> ${formatDamageTypes(monster.immune)}</div>`;
    }
    if (monster.resist) {
        html += `<div class="stat-row"><span class="stat-label">Damage Resistances</span> ${formatDamageTypes(monster.resist)}</div>`;
    }
    if (monster.vulnerable) {
        html += `<div class="stat-row"><span class="stat-label">Damage Vulnerabilities</span> ${formatDamageTypes(monster.vulnerable)}</div>`;
    }

    // Condition immunities
    if (monster.conditionImmune) {
        html += `<div class="stat-row"><span class="stat-label">Condition Immunities</span> ${monster.conditionImmune.join(', ')}</div>`;
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

    // CR
    html += `<div class="stat-row"><span class="stat-label">Challenge</span> ${MonsterAPI.formatCR(monster.cr)}</div>`;
    html += `<div class="divider"></div>`;

    // Traits
    if (monster.trait) {
        monster.trait.forEach(trait => {
            html += `<div class="trait"><span class="trait-name">${trait.name}.</span> ${formatEntries(trait.entries)}</div>`;
        });
    }

    // Actions
    if (monster.action) {
        html += `<div class="section-title">Actions</div>`;
        monster.action.forEach(action => {
            html += `<div class="action"><span class="action-name">${action.name}.</span> ${formatEntries(action.entries)}</div>`;
        });
    }

    // Legendary actions
    if (monster.legendary) {
        html += `<div class="section-title">Legendary Actions</div>`;
        monster.legendary.forEach(action => {
            html += `<div class="action"><span class="action-name">${action.name}.</span> ${formatEntries(action.entries)}</div>`;
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
