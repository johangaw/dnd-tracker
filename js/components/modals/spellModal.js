// Spell Modal Component
// Displays spell details in a modal similar to monster stat blocks

import { getSpell, getSpellDetails, formatSpellLevel, formatMaterialComponent, getSchoolName } from '../../services/spells.js';
import { escapeHtml } from '../../utils/helpers.js';

/**
 * Show spell modal by name
 * @param {string} spellName - The spell name to look up
 */
export async function showSpellModal(spellName) {
    const spell = await getSpell(spellName);
    if (!spell) {
        console.warn(`Spell not found: ${spellName}`);
        return;
    }

    const modal = document.getElementById('spell-modal');
    if (!modal) {
        console.error('Spell modal not found in DOM');
        return;
    }

    document.getElementById('spell-modal-name').textContent = spell.name;
    document.getElementById('spell-modal-content').innerHTML = renderSpellBlock(spell);
    modal.classList.add('active');
}

/**
 * Render spell block HTML
 * @param {Object} spell - Normalized spell object from spell service
 * @returns {string} HTML string
 */
export function renderSpellBlock(spell) {
    const raw = spell._raw;
    
    // Spell level and school
    const levelSchool = spell.level === 0 
        ? `${spell.school} cantrip`
        : `${formatSpellLevel(spell.level)}-level ${spell.school.toLowerCase()}`;
    
    // Ritual tag
    const ritualTag = spell.ritual ? ' (ritual)' : '';
    
    let html = `
        <div class="spell-header">
            <div class="spell-level-school">${levelSchool}${ritualTag}</div>
            <div class="spell-source">${escapeHtml(spell.sourceName)}</div>
        </div>
        <div class="divider"></div>
        <div class="spell-properties">
            <div class="spell-property"><span class="property-label">Casting Time:</span> ${escapeHtml(spell.castingTime)}</div>
            <div class="spell-property"><span class="property-label">Range:</span> ${escapeHtml(spell.range)}</div>
            <div class="spell-property"><span class="property-label">Components:</span> ${formatComponentsDetailed(raw.components)}</div>
            <div class="spell-property"><span class="property-label">Duration:</span> ${spell.concentration ? 'Concentration, ' : ''}${escapeHtml(spell.duration)}</div>
        </div>
        <div class="divider"></div>
    `;

    // Main description
    if (raw.entries && raw.entries.length > 0) {
        html += `<div class="spell-description">${formatSpellEntries(raw.entries)}</div>`;
    }

    // Higher levels / Cantrip upgrade
    if (raw.entriesHigherLevel && raw.entriesHigherLevel.length > 0) {
        html += `<div class="spell-higher-level">`;
        for (const entry of raw.entriesHigherLevel) {
            if (entry.name) {
                html += `<p><strong>${escapeHtml(entry.name)}.</strong> `;
            }
            if (entry.entries) {
                html += formatSpellEntries(entry.entries);
            }
            html += `</p>`;
        }
        html += `</div>`;
    }

    // Classes (if available)
    if (raw.classes && raw.classes.fromClassList && raw.classes.fromClassList.length > 0) {
        const classes = raw.classes.fromClassList.map(c => c.name).join(', ');
        html += `<div class="spell-classes"><span class="property-label">Classes:</span> ${escapeHtml(classes)}</div>`;
    }

    return html;
}

/**
 * Format components with full material description
 */
function formatComponentsDetailed(comp) {
    if (!comp) return '—';
    
    const parts = [];
    if (comp.v) parts.push('V');
    if (comp.s) parts.push('S');
    if (comp.m) {
        let material = 'M';
        const matText = formatMaterialComponent(comp);
        if (matText) {
            material = `M (${escapeHtml(matText)})`;
        }
        parts.push(material);
    }
    
    return parts.join(', ') || '—';
}

/**
 * Format spell entries (description text)
 * Handles 5etools formatting tags and nested structures
 */
function formatSpellEntries(entries) {
    if (!entries) return '';
    
    return entries.map(entry => {
        if (typeof entry === 'string') {
            return `<p>${cleanSpellText(entry)}</p>`;
        }
        
        if (typeof entry === 'object') {
            // Handle list entries
            if (entry.type === 'list') {
                const items = (entry.items || []).map(item => {
                    if (typeof item === 'string') {
                        return `<li>${cleanSpellText(item)}</li>`;
                    }
                    if (item.type === 'item' && item.name && item.entries) {
                        return `<li><strong>${escapeHtml(item.name)}.</strong> ${formatSpellEntries(item.entries)}</li>`;
                    }
                    if (item.entries) {
                        return `<li>${formatSpellEntries(item.entries)}</li>`;
                    }
                    return '';
                }).join('');
                return `<ul class="spell-list-entries">${items}</ul>`;
            }
            
            // Handle named entries (sub-sections)
            if (entry.type === 'entries' && entry.name) {
                return `<p><strong>${escapeHtml(entry.name)}.</strong> ${formatSpellEntries(entry.entries || [])}</p>`;
            }
            
            // Handle table entries
            if (entry.type === 'table') {
                return formatSpellTable(entry);
            }
            
            // Handle item entries (like in lists)
            if (entry.type === 'item' && entry.name && entry.entries) {
                return `<p><strong>${escapeHtml(entry.name)}.</strong> ${formatSpellEntries(entry.entries)}</p>`;
            }
            
            // Fallback for entries arrays
            if (entry.entries) {
                return formatSpellEntries(entry.entries);
            }
        }
        
        return '';
    }).join('');
}

/**
 * Format a table entry
 */
function formatSpellTable(table) {
    let html = '<table class="spell-table">';
    
    // Caption
    if (table.caption) {
        html += `<caption>${escapeHtml(table.caption)}</caption>`;
    }
    
    // Headers
    if (table.colLabels && table.colLabels.length > 0) {
        html += '<thead><tr>';
        for (const label of table.colLabels) {
            html += `<th>${cleanSpellText(label)}</th>`;
        }
        html += '</tr></thead>';
    }
    
    // Rows
    if (table.rows && table.rows.length > 0) {
        html += '<tbody>';
        for (const row of table.rows) {
            html += '<tr>';
            for (const cell of row) {
                html += `<td>${cleanSpellText(String(cell))}</td>`;
            }
            html += '</tr>';
        }
        html += '</tbody>';
    }
    
    html += '</table>';
    return html;
}

/**
 * Clean up 5etools formatting tags in spell text
 */
function cleanSpellText(text) {
    if (!text) return '';
    
    return text
        // Dice and damage
        .replace(/{@damage ([^|}]+)(\|[^}]*)?}/g, '$1')
        .replace(/{@dice ([^|}]+)(\|[^}]*)?}/g, '$1')
        .replace(/{@scaledamage ([^|]+)\|[^|]+\|([^}]+)}/g, '$2')
        .replace(/{@scaledice ([^|]+)\|[^|]+\|([^}]+)}/g, '$2')
        
        // DC and hit
        .replace(/{@dc (\d+)}/g, 'DC $1')
        .replace(/{@hit (\d+)}/g, '+$1')
        .replace(/{@h}/g, '<em>Hit:</em> ')
        
        // Conditions (link to 5e.tools)
        .replace(/{@condition ([^|}]+)\|([^}]+)}/g, (_, name, source) => {
            const slug = `${name}_${source}`.toLowerCase().replace(/\s+/g, '%20');
            return `<a href="https://5e.tools/conditionsdiseases.html#${slug}" target="_blank" rel="noopener noreferrer"><em>${name}</em></a>`;
        })
        .replace(/{@condition ([^|}]+)}/g, (_, name) => {
            const slug = name.toLowerCase().replace(/\s+/g, '%20');
            return `<a href="https://5e.tools/conditionsdiseases.html#${slug}" target="_blank" rel="noopener noreferrer"><em>${name}</em></a>`;
        })
        
        // Spells (make clickable)
        .replace(/{@spell ([^|}]+)(\|[^}]*)?}/g, '<a href="#" class="spell-link" data-spell="$1"><em>$1</em></a>')
        
        // Creatures (link to 5e.tools bestiary)
        .replace(/{@creature ([^|}]+)\|([^}]+)}/g, (_, name, source) => {
            const slug = `${name}_${source}`.toLowerCase().replace(/\s+/g, '%20');
            return `<a href="https://5e.tools/bestiary.html#${slug}" target="_blank" rel="noopener noreferrer">${name}</a>`;
        })
        .replace(/{@creature ([^|}]+)}/g, (_, name) => {
            const slug = name.toLowerCase().replace(/\s+/g, '%20');
            return `<a href="https://5e.tools/bestiary.html#${slug}" target="_blank" rel="noopener noreferrer">${name}</a>`;
        })
        
        // Items (link to 5e.tools)
        .replace(/{@item ([^|}]+)\|([^}]+)}/g, (_, name, source) => {
            const slug = `${name}_${source}`.toLowerCase().replace(/\s+/g, '%20');
            return `<a href="https://5e.tools/items.html#${slug}" target="_blank" rel="noopener noreferrer">${name}</a>`;
        })
        .replace(/{@item ([^|}]+)}/g, (_, name) => {
            const slug = name.toLowerCase().replace(/\s+/g, '%20');
            return `<a href="https://5e.tools/items.html#${slug}" target="_blank" rel="noopener noreferrer">${name}</a>`;
        })
        
        // Races (link to 5e.tools)
        .replace(/{@race ([^|}]+)\|([^}]+)}/g, (_, name, source) => {
            const slug = `${name}_${source}`.toLowerCase().replace(/\s+/g, '%20');
            return `<a href="https://5e.tools/races.html#${slug}" target="_blank" rel="noopener noreferrer">${name}</a>`;
        })
        .replace(/{@race ([^|}]+)}/g, (_, name) => {
            const slug = name.toLowerCase().replace(/\s+/g, '%20');
            return `<a href="https://5e.tools/races.html#${slug}" target="_blank" rel="noopener noreferrer">${name}</a>`;
        })
        
        // Skills, senses, actions
        .replace(/{@skill ([^|}]+)(\|[^}]*)?}/g, '$1')
        .replace(/{@sense ([^|}]+)(\|[^}]*)?}/g, '$1')
        .replace(/{@action ([^|}]+)(\|[^}]*)?}/g, '$1')
        .replace(/{@status ([^|}]+)(\|[^}]*)?}/g, '$1')
        
        // Hazards (link to 5e.tools)
        .replace(/{@hazard ([^|}]+)\|([^}]+)}/g, (_, name, source) => {
            const slug = `${name}_${source}`.toLowerCase().replace(/\s+/g, '%20');
            return `<a href="https://5e.tools/trapshazards.html#${slug}" target="_blank" rel="noopener noreferrer">${name}</a>`;
        })
        .replace(/{@hazard ([^|}]+)}/g, (_, name) => {
            const slug = name.toLowerCase().replace(/\s+/g, '%20');
            return `<a href="https://5e.tools/trapshazards.html#${slug}" target="_blank" rel="noopener noreferrer">${name}</a>`;
        })
        
        // Variant rules (like areas of effect)
        .replace(/{@variantrule ([^|}]+)(\|[^}|]+)?(\|([^}]+))?}/g, (_, rule, _src, _pipe, displayText) => {
            return displayText || rule;
        })
        
        // Filter links (for creature lists)
        .replace(/{@filter ([^|}]+)(\|[^}]*)?}/g, '$1')
        
        // Chance/probability
        .replace(/{@chance (\d+)[^}]*}/g, '$1%')
        
        // Book references
        .replace(/{@book ([^|}]+)(\|[^}]*)?}/g, '<em>$1</em>')
        
        // Quick references
        .replace(/{@quickref ([^|}]+)(\|[^}|]+)?(\|[^}|]+)?(\|([^}]+))?}/g, (_, ref, _src, _src2, _pipe, displayText) => {
            return displayText || ref;
        })
        
        // Bold and italic
        .replace(/{@b ([^}]+)}/g, '<strong>$1</strong>')
        .replace(/{@bold ([^}]+)}/g, '<strong>$1</strong>')
        .replace(/{@i ([^}]+)}/g, '<em>$1</em>')
        .replace(/{@italic ([^}]+)}/g, '<em>$1</em>')
        
        // Note tag
        .replace(/{@note ([^}]+)}/g, '<em>($1)</em>')
        
        // Attack type
        .replace(/{@atk ([^}]+)}/g, '<em>$1</em>')
        
        // Recharge
        .replace(/{@recharge(\|[^}]*)?}/g, '(Recharge 6)')
        .replace(/{@recharge (\d)(\|[^}]*)?}/g, '(Recharge $1-6)')
        
        // Clean up any remaining tags
        .replace(/{@[^}]+}/g, '');
}

export default {
    showSpellModal,
    renderSpellBlock
};
