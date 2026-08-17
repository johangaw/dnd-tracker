import * as CustomMonsters from '../../services/customMonsters.js';
import * as MonsterAPI from '../../services/monsterApi.js';
import { escapeHtml } from '../../utils/helpers.js';

export function renderMonsterResults(results, {
    container,
    onSelect,
    onViewStats,
    emptyMessage = 'No monsters found'
} = {}) {
    const target = container || document.getElementById('monster-search-results');

    if (!target) return;

    if (!results || results.length === 0) {
        target.innerHTML = `<div class="search-empty">${emptyMessage}</div>`;
        return;
    }

    target.innerHTML = results.map(m => {
        const isCustom = m.isCustom || m.source === 'Custom';
        return `
            <div class="search-result-item" data-name="${escapeHtml(m.name)}" data-source="${m.source}" data-id="${m.id || ''}">
                <div class="search-result-info">
                    <div class="monster-name">${escapeHtml(m.name)}</div>
                    <div class="monster-meta">CR ${MonsterAPI.formatCR(m.cr)} | HP ${MonsterAPI.getHP(m)} | ${isCustom ? 'Custom' : m.source}</div>
                </div>
                <button class="btn btn-small view-stats-btn" data-name="${escapeHtml(m.name)}" data-source="${m.source}" data-id="${m.id || ''}">Stats</button>
            </div>
        `;
    }).join('');

    target.querySelectorAll('.search-result-info').forEach(item => {
        item.addEventListener('click', async () => {
            const parent = item.closest('.search-result-item');
            if (!parent || !onSelect) return;
            const name = parent.dataset.name;
            const source = parent.dataset.source;
            const id = parent.dataset.id;
            await onSelect({ name, source, id: id || null });
        });
    });

    target.querySelectorAll('.view-stats-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            e.stopPropagation();
            if (!onViewStats) return;
            const name = btn.dataset.name;
            const source = btn.dataset.source;
            const id = btn.dataset.id;
            await onViewStats({ name, source, id: id || null });
        });
    });
}

export async function searchMonsters({
    query,
    source,
    container,
    onSelect,
    onViewStats,
    emptyMessage = 'No monsters found',
    minQueryLength = 2,
    tooShortMessage = 'Type at least 2 characters...'
}) {
    const target = container || document.getElementById('monster-search-results');
    if (!target) return;

    if (query.length < minQueryLength) {
        target.innerHTML = `<div class="search-empty">${tooShortMessage}</div>`;
        return;
    }

    target.innerHTML = '<div class="search-loading">Searching...</div>';

    try {
        const customMonsters = (!source || source === 'Custom' || source === 'ALL')
            ? CustomMonsters.searchCustomMonsters(query)
            : [];

        const apiMonsters = source === 'Custom'
            ? []
            : await MonsterAPI.searchMonsters(query, source);

        const monsters = [...customMonsters, ...apiMonsters];

        renderMonsterResults(monsters, {
            container: target,
            emptyMessage,
            onSelect,
            onViewStats
        });
    } catch (error) {
        target.innerHTML = '<div class="search-empty">Error searching monsters</div>';
    }
}
