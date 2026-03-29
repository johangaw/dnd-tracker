// Encounter List Component

import * as Storage from '../../services/storage.js';
import { escapeHtml, hideContextMenu } from '../../utils/helpers.js';

// Render encounter list
export function render() {
    const container = document.getElementById('encounter-list');
    const encounters = Storage.getEncounters();

    if (encounters.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <svg viewBox="0 0 24 24"><path fill="currentColor" d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-5 14H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z"/></svg>
                <h3>No Encounters Yet</h3>
                <p>Tap the + button to create your first encounter</p>
            </div>
        `;
        return;
    }

    container.innerHTML = encounters.map(enc => `
        <div class="encounter-card" data-id="${enc.id}">
            <h3>${escapeHtml(enc.title)}</h3>
            ${enc.description ? `<p>${escapeHtml(enc.description)}</p>` : ''}
            <div class="meta">
                <span>${enc.pcs?.length || 0} PCs</span>
                <span>${enc.monsters?.length || 0} Monsters</span>
            </div>
        </div>
    `).join('');

    // Add click handlers
    container.querySelectorAll('.encounter-card').forEach(card => {
        card.addEventListener('click', (e) => {
            const id = card.dataset.id;
            showContextMenu(e, id);
        });
        
        // Long press for mobile
        let pressTimer;
        card.addEventListener('touchstart', (e) => {
            pressTimer = setTimeout(() => {
                const id = card.dataset.id;
                showContextMenu(e, id);
            }, 500);
        });
        card.addEventListener('touchend', () => clearTimeout(pressTimer));
        card.addEventListener('touchmove', () => clearTimeout(pressTimer));
    });
}

// Show context menu
export function showContextMenu(e, encounterId) {
    e.preventDefault();
    const menu = document.getElementById('context-menu');
    menu.classList.remove('hidden');
    menu.dataset.encounterId = encounterId;

    // Position menu
    const x = e.clientX || e.touches?.[0]?.clientX || 100;
    const y = e.clientY || e.touches?.[0]?.clientY || 100;
    
    menu.style.left = `${Math.min(x, window.innerWidth - 180)}px`;
    menu.style.top = `${Math.min(y, window.innerHeight - 200)}px`;

    // Close on click outside
    setTimeout(() => {
        document.addEventListener('click', hideContextMenu, { once: true });
    }, 0);
}

export default {
    render,
    showContextMenu
};
