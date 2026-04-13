// Character List Component

import * as Characters from '../../services/characters.js';
import { escapeHtml } from '../../utils/helpers.js';

// Render character list
export function render() {
    const container = document.getElementById('characters-list');
    const characters = Characters.getCharacters();

    if (characters.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <svg viewBox="0 0 24 24"><path fill="currentColor" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z"/></svg>
                <h3>No Characters</h3>
                <p>Create your first D&D character sheet</p>
            </div>
        `;
        return;
    }

    container.innerHTML = characters.map(character => {
        const profBonus = Characters.getProficiencyBonus(character.level);
        const hpDisplay = character.hitPointsCurrent !== undefined 
            ? `${character.hitPointsCurrent}/${character.hitPointsMax}`
            : character.hitPointsMax || '-';
        
        return `
            <div class="character-card" data-id="${character.id}">
                <div class="character-card-header">
                    <h3>${escapeHtml(character.name) || 'Unnamed Character'}</h3>
                </div>
                <div class="character-card-meta">
                    <span class="character-class">${escapeHtml(character.class) || 'No Class'} ${character.level}</span>
                    <span class="character-species">${escapeHtml(character.species) || 'No Species'}</span>
                </div>
                <div class="character-card-stats">
                    <span>AC ${character.armorClass || 10}</span>
                    <span>HP ${hpDisplay}</span>
                    <span>Prof +${profBonus}</span>
                </div>
            </div>
        `;
    }).join('');

    // Add click handlers
    container.querySelectorAll('.character-card').forEach(card => {
        card.addEventListener('click', (e) => {
            const id = card.dataset.id;
            showContextMenu(e, id);
        });
    });
}

// Show context menu for character
export function showContextMenu(e, characterId) {
    e.preventDefault();
    e.stopPropagation();
    
    const menu = document.getElementById('character-context-menu');
    
    // If clicking on the same character while menu is open, just close it
    if (!menu.classList.contains('hidden') && menu.dataset.characterId === characterId) {
        hideContextMenu();
        return;
    }
    
    menu.classList.remove('hidden');
    menu.dataset.characterId = characterId;

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
    document.getElementById('character-context-menu').classList.add('hidden');
}

export default {
    render,
    showContextMenu,
    hideContextMenu
};
