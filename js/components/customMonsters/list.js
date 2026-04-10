// Custom Monsters List Component

import * as CustomMonsters from '../../services/customMonsters.js';
import { formatCR, getHP, getAC } from '../../services/monsterApi.js';
import { escapeHtml } from '../../utils/helpers.js';

// Render custom monsters list
export function render() {
    const container = document.getElementById('custom-monsters-list');
    const monsters = CustomMonsters.getCustomMonsters();

    if (monsters.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <svg viewBox="0 0 24 24"><path fill="currentColor" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/></svg>
                <h3>No Custom Monsters</h3>
                <p>Create your own monsters or import from JSON</p>
            </div>
        `;
        return;
    }

    container.innerHTML = monsters.map(monster => {
        const hp = getHP(monster);
        const ac = getAC(monster);
        const cr = formatCR(monster.cr);
        const type = monster.type || 'creature';
        const size = formatSize(monster.size);
        
        return `
            <div class="monster-card" data-id="${monster.id}">
                <div class="monster-card-header">
                    <h3>${escapeHtml(monster.name)}</h3>
                    ${monster.baselineName ? `<span class="baseline-tag">Based on ${escapeHtml(monster.baselineName)}</span>` : ''}
                </div>
                <div class="monster-card-meta">
                    <span>${size} ${type}</span>
                    <span>CR ${cr}</span>
                </div>
                <div class="monster-card-stats">
                    <span>AC ${ac}</span>
                    <span>HP ${hp}</span>
                </div>
            </div>
        `;
    }).join('');

    // Add click handlers
    container.querySelectorAll('.monster-card').forEach(card => {
        card.addEventListener('click', (e) => {
            const id = card.dataset.id;
            showContextMenu(e, id);
        });
    });
}

// Format size code to readable text
function formatSize(size) {
    if (!size) return 'Medium';
    const sizeCode = Array.isArray(size) ? size[0] : size;
    const sizes = {
        'T': 'Tiny',
        'S': 'Small',
        'M': 'Medium',
        'L': 'Large',
        'H': 'Huge',
        'G': 'Gargantuan'
    };
    return sizes[sizeCode] || 'Medium';
}

// Show context menu for monster
export function showContextMenu(e, monsterId) {
    e.preventDefault();
    e.stopPropagation();
    
    const menu = document.getElementById('monster-context-menu');
    
    // If clicking on the same monster while menu is open, just close it
    if (!menu.classList.contains('hidden') && menu.dataset.monsterId === monsterId) {
        hideContextMenu();
        return;
    }
    
    menu.classList.remove('hidden');
    menu.dataset.monsterId = monsterId;

    // Position menu
    const x = e.clientX || e.touches?.[0]?.clientX || 100;
    const y = e.clientY || e.touches?.[0]?.clientY || 100;
    
    menu.style.left = `${Math.min(x, window.innerWidth - 180)}px`;
    menu.style.top = `${Math.min(y, window.innerHeight - 250)}px`;

    // Close on click outside - use setTimeout to avoid the current click triggering it
    setTimeout(() => {
        document.addEventListener('click', hideContextMenu, { once: true });
    }, 0);
}

export function hideContextMenu() {
    document.getElementById('monster-context-menu').classList.add('hidden');
}

export default {
    render,
    showContextMenu,
    hideContextMenu
};
