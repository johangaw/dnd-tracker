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

// Format damage types
export function formatDamageTypes(types) {
    if (!types) return '';
    return types.map(t => typeof t === 'string' ? t : t.special || JSON.stringify(t)).join(', ');
}

// Format 5e.tools entries (clean up formatting tags)
export function formatEntries(entries) {
    if (!entries) return '';
    return entries.map(e => {
        if (typeof e === 'string') {
            // Clean up 5e.tools formatting tags
            return e
                .replace(/{@atk ([^}]+)}/g, '$1')
                .replace(/{@hit (\d+)}/g, '+$1')
                .replace(/{@damage ([^}]+)}/g, '$1')
                .replace(/{@dice ([^}]+)}/g, '$1')
                .replace(/{@dc (\d+)}/g, 'DC $1')
                .replace(/{@condition ([^}]+)}/g, '$1')
                .replace(/{@skill ([^}]+)}/g, '$1')
                .replace(/{@creature ([^}]+)}/g, '$1')
                .replace(/{@spell ([^}]+)}/g, '$1')
                .replace(/{@item ([^}]+)}/g, '$1')
                .replace(/{@recharge( \d)?(\|[^}]*)?}/g, (_, n) => n ? `(Recharge ${n.trim()}-6)` : '(Recharge 6)')
                .replace(/{@h}/g, 'Hit: ')
                .replace(/{@[^}]+}/g, '');
        }
        return '';
    }).join(' ');
}

// Close all modals
export function closeModals() {
    document.querySelectorAll('.modal').forEach(m => m.classList.remove('active'));
}

// Hide context menu
export function hideContextMenu() {
    document.getElementById('context-menu').classList.add('hidden');
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
    closeModals,
    hideContextMenu
};
