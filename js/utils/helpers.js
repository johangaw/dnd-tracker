// UI Helper Utilities

// Escape HTML to prevent XSS
export function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Capitalize first letter
export function capitalizeFirst(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
}

// Format monster size
export function formatSize(size) {
    const sizes = { T: 'Tiny', S: 'Small', M: 'Medium', L: 'Large', H: 'Huge', G: 'Gargantuan' };
    if (Array.isArray(size)) return sizes[size[0]] || size[0];
    return sizes[size] || size;
}

// Format monster type
export function formatType(type) {
    if (typeof type === 'string') return type;
    if (type.type) {
        let result = type.type;
        if (type.tags) result += ` (${type.tags.join(', ')})`;
        return result;
    }
    return 'creature';
}

// Format alignment
export function formatAlignment(alignment) {
    if (!alignment) return 'unaligned';
    const map = { L: 'lawful', N: 'neutral', C: 'chaotic', G: 'good', E: 'evil', U: 'unaligned', A: 'any alignment' };
    if (Array.isArray(alignment)) {
        return alignment.map(a => map[a] || a).join(' ');
    }
    return alignment;
}

// Format speed
export function formatSpeed(speed) {
    if (!speed) return '30 ft.';
    if (typeof speed === 'number') return `${speed} ft.`;
    
    const parts = [];
    if (speed.walk) parts.push(`${speed.walk} ft.`);
    if (speed.fly) parts.push(`fly ${speed.fly} ft.`);
    if (speed.swim) parts.push(`swim ${speed.swim} ft.`);
    if (speed.climb) parts.push(`climb ${speed.climb} ft.`);
    if (speed.burrow) parts.push(`burrow ${speed.burrow} ft.`);
    
    return parts.join(', ') || '30 ft.';
}

// Format a single entry of a damage/condition list. Entries are either plain
// strings ("psychic", "Charmed|XPHB") or group objects that nest their own list
// plus a qualifying note, e.g.
// {"immune": ["bludgeoning"], "note": "from nonmagical attacks", "cond": true}
function formatTypeEntry(entry, key) {
    if (typeof entry === 'string') return entry.split('|')[0];
    if (!entry || typeof entry !== 'object') return '';
    if (entry.special) return entry.special;

    const nested = entry[key];
    const list = Array.isArray(nested) ? nested.map(e => formatTypeEntry(e, key)).filter(Boolean).join(', ') : '';
    const prefix = entry.preNote ? `${entry.preNote} ` : '';
    const suffix = entry.note ? ` ${entry.note}` : '';
    return `${prefix}${list}${suffix}`.trim();
}

// Format damage types (immunities/resistances/vulnerabilities)
export function formatDamageTypes(types, key = 'immune') {
    if (!types) return '';
    return types.map(t => formatTypeEntry(t, key)).filter(Boolean).join(', ');
}

// Format condition immunities, stripping source suffixes like "Grappled|XPHB"
export function formatConditionImmune(conditions) {
    if (!conditions) return '';
    return conditions.map(c => formatTypeEntry(c, 'conditionImmune')).filter(Boolean).join(', ');
}

// Convert spell name to aidedd.org URL format
function spellNameToUrl(name) {
    return name.toLowerCase()
        .replace(/'/g, '-')      // apostrophes become hyphens
        .replace(/[^a-z0-9-]/g, '-')  // non-alphanumeric becomes hyphens
        .replace(/-+/g, '-')     // collapse multiple hyphens
        .replace(/^-|-$/g, '');  // trim leading/trailing hyphens
}

// Generate aidedd.org spell link
function spellLink(name) {
    const url = `https://www.aidedd.org/spell/${spellNameToUrl(name)}`;
    return `<a href="${url}" target="_blank" rel="noopener">${escapeHtml(name)}</a>`;
}

// Generate 5e.tools condition link
// URL format: https://5e.tools/conditionsdiseases.html#blinded_xphb
function conditionLink(name, source = 'xphb') {
    const urlName = name.toLowerCase().replace(/\s+/g, '%20');
    const urlSource = source.toLowerCase();
    const url = `https://5e.tools/conditionsdiseases.html#${urlName}_${urlSource}`;
    return `<a href="${url}" target="_blank" rel="noopener">${escapeHtml(name)}</a>`;
}

// Format action/trait names (handles {@recharge} tags)
export function formatName(name) {
    if (!name) return '';
    return escapeHtml(name)
        .replace(/\{@recharge\}/g, '(Recharge 6)')
        .replace(/\{@recharge (\d)\}/g, '(Recharge $1-6)')
        .replace(/\{@recharge (\d)\|[^}]*\}/g, '(Recharge $1-6)');
}

// Format 5e.tools entries (clean up formatting tags)
export function formatEntries(entries) {
    if (!entries) return '';
    return entries.map(e => {
        if (typeof e === 'string') {
            // Clean up 5e.tools formatting tags first, then escape remaining HTML
            // Note: Many tags have optional source suffix like {@condition Grappled|XPHB} - strip the |SOURCE part
            let cleaned = e
                .replace(/{@atk ([^}]+)}/g, '$1')
                .replace(/{@hit (\d+)}/g, '+$1')
                .replace(/{@damage ([^|}]+)(\|[^}]*)?}/g, '$1')
                .replace(/{@dice ([^|}]+)(\|[^}]*)?}/g, '$1')
                .replace(/{@dc (\d+)}/g, 'DC $1')
                .replace(/{@condition ([^|}]+)\|([^}]+)}/g, (_, name, source) => conditionLink(name, source))
                .replace(/{@condition ([^|}]+)}/g, (_, name) => conditionLink(name))
                .replace(/{@skill ([^|}]+)(\|[^}]*)?}/g, '$1')
                .replace(/{@creature ([^|}]+)(\|[^}]*)?}/g, '$1')
                .replace(/{@spell ([^|}]+)(\|[^}]*)?}/g, (_, name) => spellLink(name))
                .replace(/{@item ([^|}]+)(\|[^}]*)?}/g, '$1')
                .replace(/{@sense ([^|}]+)(\|[^}]*)?}/g, '$1')
                .replace(/{@status ([^|}]+)(\|[^}]*)?}/g, '$1')
                .replace(/{@action ([^|}]+)(\|[^}]*)?}/g, '$1')
                .replace(/{@variantrule ([^|}]+)(\|[^}|]+)?(\|([^}]+))?}/g, (_, rule, _src, _pipe, displayText) => displayText || rule)
                .replace(/{@recharge(\|[^}]*)?}/g, '(Recharge 6)')
                .replace(/{@recharge (\d)(\|[^}]*)?}/g, '(Recharge $1-6)')
                .replace(/{@h}/g, 'Hit: ')
                .replace(/{@[^}]+}/g, '');
            return cleaned;
        }
        return '';
    }).join('<span class="entry-break"></span>');
}

// Format spell list (clean up 5e.tools spell formatting)
export function formatSpellList(spells) {
    if (!spells || !Array.isArray(spells)) return '';
    return spells.map(spell => {
        if (typeof spell === 'string') {
            // Clean up {@spell name} tags, create links to aidedd.org
            return spell
                .replace(/{@spell ([^|}]+)(\|[^}]*)?}/g, (_, name) => {
                    const url = `https://www.aidedd.org/spell/${spellNameToUrl(name)}`;
                    return `<a href="${url}" target="_blank" rel="noopener"><i>${escapeHtml(name)}</i></a>`;
                })
                .replace(/{@[^}]+}/g, '');
        }
        return '';
    }).join(', ');
}

// Close all modals
export function closeModals() {
    document.querySelectorAll('.modal').forEach(m => m.classList.remove('active'));
}


// Show toast notification
export function showToast(message, type = 'success') {
    const container = document.getElementById('toast-container');
    if (!container) return;
    
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    
    container.appendChild(toast);
    
    // Remove after animation completes
    setTimeout(() => {
        toast.remove();
    }, 3000);
}

export default {
    escapeHtml,
    capitalizeFirst,
    formatSize,
    formatType,
    formatAlignment,
    formatSpeed,
    formatDamageTypes,
    formatEntries,
    formatSpellList,
    closeModals,
    showToast
};
