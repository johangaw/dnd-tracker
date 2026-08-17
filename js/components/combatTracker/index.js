// Combat Tracker Component

import * as MonsterAPI from '../../services/monsterApi.js';
import * as CustomMonsters from '../../services/customMonsters.js';
import { getState, setView, setCurrentEncounter, setCombatState, setSelectedMonsterIndex, setSelectedInstanceIndex, setMonsterQuantity } from '../../services/state.js';
import { escapeHtml, closeModals } from '../../utils/helpers.js';
import { showStatBlockByNameSource, showStatBlock as showStatBlockModal } from '../modals/statBlock.js';

// Initialize run mode (combat)
export function init(encounter) {
    setCurrentEncounter(JSON.parse(JSON.stringify(encounter)));
    
    const combatState = {
        round: 1,
        currentTurn: 0,
        combatants: [],
        started: false
    };

    // Create combatants array
    const combatants = [];
    
    // Add PCs
    (encounter.pcs || []).forEach((pc, i) => {
        combatants.push({
            id: `pc-${Date.now()}-${i}`,
            name: pc.name,
            type: 'pc',
            initiative: 0
        });
    });

    // Only add monsters if autoAddMonsters is enabled
    if (encounter.autoAddMonsters) {
        // Add monsters - group same monsters together with multiple instances
        const monsterGroups = {};
        (encounter.monsters || []).forEach((monster) => {
            const key = `${monster.name}|${monster.source}`;
            if (!monsterGroups[key]) {
                monsterGroups[key] = {
                    name: monster.name,
                    source: monster.source,
                    cr: monster.cr,
                    ac: monster.ac,
                    baseHp: monster.hp,
                    initMod: monster.initMod ?? monster.dexMod ?? 0,
                    comment: monster.comment || '',
                    instances: []
                };
            } else if (monster.comment && !monsterGroups[key].comment) {
                // If this instance has a comment and the group doesn't, use it
                monsterGroups[key].comment = monster.comment;
            } else if (monster.comment && monsterGroups[key].comment && monster.comment !== monsterGroups[key].comment) {
                // Combine different comments
                monsterGroups[key].comment += '\n---\n' + monster.comment;
            }
            monsterGroups[key].instances.push({
                hp: monster.hp,
                maxHp: monster.hp
            });
        });

        // Convert groups to combatants
        Object.values(monsterGroups).forEach((group, i) => {
            combatants.push({
                id: `monster-${Date.now()}-${i}`,
                name: group.name,
                source: group.source,
                type: 'monster',
                initiative: 0,
                cr: group.cr,
                ac: group.ac,
                baseHp: group.baseHp,
                initMod: group.initMod,
                comment: group.comment,
                instances: group.instances
            });
        });
    }

    combatState.combatants = combatants;
    setCombatState(combatState);

    // Show initiative setup
    document.getElementById('initiative-setup').classList.remove('hidden');
    document.getElementById('combat-tracker').classList.add('hidden');
    
    renderInitiativeList();
    setView('encounter-run');
}

// Add monster to combat (runtime only)
export async function addMonsterToCombat(name, source, quantity = 1, keepModalOpen = false, customMonsterId = null) {
    const state = getState();
    let monster;
    
    // Check if it's a custom monster
    if (customMonsterId || source === 'Custom') {
        monster = customMonsterId 
            ? CustomMonsters.getCustomMonster(customMonsterId)
            : CustomMonsters.searchCustomMonsters(name).find(m => m.name === name);
    } else {
        monster = await MonsterAPI.getMonster(name, source);
    }
    
    if (!monster) return;

    const hp = MonsterAPI.getHP(monster);
    const ac = MonsterAPI.getAC(monster);
    const initMod = MonsterAPI.getInitiativeMod(monster);

    // Check if this monster type already exists in combat
    const existingIndex = state.combatState.combatants.findIndex(
        c => c.type === 'monster' && c.name === name && c.source === source
    );

    if (existingIndex >= 0) {
        // Add instances to existing group
        for (let i = 0; i < quantity; i++) {
            state.combatState.combatants[existingIndex].instances.push({
                hp: hp,
                maxHp: hp
            });
        }
    } else {
        // Create new combatant group
        const instances = [];
        for (let i = 0; i < quantity; i++) {
            instances.push({ hp: hp, maxHp: hp });
        }

        const newCombatant = {
            id: `monster-${Date.now()}`,
            name: name,
            source: source,
            type: 'monster',
            initiative: 0,
            cr: monster.cr,
            ac: ac,
            baseHp: hp,
            initMod: initMod,
            customMonsterId: monster.isCustom ? monster.id : undefined,
            instances: instances
        };

        state.combatState.combatants.push(newCombatant);
    }

    // Re-render appropriate view
    if (state.combatState.started) {
        renderTurnOrder();
    } else {
        renderInitiativeList();
    }

    if (!keepModalOpen) {
        closeModals();
    }
}

// Add PC to combat (runtime only)
export function addPCToCombat(name, initiative = 0) {
    const state = getState();
    const newPC = {
        id: `pc-${Date.now()}`,
        name: name,
        type: 'pc',
        initiative: initiative
    };

    state.combatState.combatants.push(newPC);

    // Re-sort if combat has started
    if (state.combatState.started) {
        state.combatState.combatants.sort((a, b) => b.initiative - a.initiative);
        renderTurnOrder();
    } else {
        renderInitiativeList();
    }

    closeModals();
}

// Remove combatant from combat
export function removeCombatant(index) {
    const state = getState();
    const combatant = state.combatState.combatants[index];
    if (!combatant) return;

    const name = combatant.name;
    if (!confirm(`Remove ${name} from combat?`)) return;

    // Adjust current turn if needed
    if (state.combatState.started) {
        if (index < state.combatState.currentTurn) {
            state.combatState.currentTurn--;
        } else if (index === state.combatState.currentTurn) {
            // If removing current combatant, stay at same index (next combatant slides up)
            if (state.combatState.currentTurn >= state.combatState.combatants.length - 1) {
                state.combatState.currentTurn = 0;
                state.combatState.round++;
            }
        }
    }

    state.combatState.combatants.splice(index, 1);

    if (state.combatState.started) {
        renderTurnOrder();
    } else {
        renderInitiativeList();
    }
}

// Render initiative list (before combat starts)
export function renderInitiativeList() {
    const state = getState();
    const container = document.getElementById('initiative-list');
    const combatants = state.combatState.combatants;

    container.innerHTML = `
        <button class="btn roll-all-btn" id="roll-all-init">Roll All Monster Initiative</button>
        ${combatants.map((c, i) => {
            const instanceCount = c.type === 'monster' ? c.instances.length : 0;
            const countLabel = instanceCount > 1 ? ` (x${instanceCount})` : '';
            return `
            <div class="initiative-item ${c.type}" data-index="${i}">
                <input type="number" class="init-input" value="${c.initiative}" data-index="${i}" placeholder="0">
                <div style="flex:1">
                    <div class="init-name">${escapeHtml(c.name)}${countLabel}</div>
                    ${c.type === 'monster' ? `<div class="init-meta">CR ${MonsterAPI.formatCR(c.cr)} | HP ${c.baseHp}</div>` : ''}
                </div>
                <button class="remove-combat-btn" data-index="${i}" title="Remove">
                    <svg viewBox="0 0 24 24" width="20" height="20"><path fill="currentColor" d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>
                </button>
            </div>
        `}).join('')}
    `;

    // Roll all button
    document.getElementById('roll-all-init').addEventListener('click', () => {
        rollAllMonsterInitiative();
    });

    // Initiative inputs
    container.querySelectorAll('.init-input').forEach(input => {
        input.addEventListener('change', () => {
            const index = parseInt(input.dataset.index);
            state.combatState.combatants[index].initiative = parseInt(input.value) || 0;
        });
    });

    // Remove buttons
    container.querySelectorAll('.remove-combat-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const index = parseInt(btn.dataset.index);
            removeCombatant(index);
        });
    });
}

export function rollAllMonsterInitiative() {
    const state = getState();
    state.combatState.combatants.forEach((c, i) => {
        if (c.type === 'monster') {
            // Roll d20 + initiative modifier (DEX mod + proficiency if applicable)
            const roll = Math.floor(Math.random() * 20) + 1;
            const initMod = c.initMod ?? c.dexMod ?? 0;
            c.initiative = roll + initMod;
            
            const input = document.querySelector(`.init-input[data-index="${i}"]`);
            if (input) input.value = c.initiative;
        }
    });
}

export function startCombat() {
    const state = getState();
    // Sort by initiative
    state.combatState.combatants.sort((a, b) => b.initiative - a.initiative);
    state.combatState.started = true;
    state.combatState.currentTurn = 0;

    document.getElementById('initiative-setup').classList.add('hidden');
    document.getElementById('combat-tracker').classList.remove('hidden');
    
    renderTurnOrder();
}

export function renderTurnOrder() {
    const state = getState();
    const container = document.getElementById('turn-order');
    const { combatants, currentTurn, round } = state.combatState;

    document.getElementById('round-number').textContent = round;

    container.innerHTML = combatants.map((c, i) => {
        const isActive = i === currentTurn;
        
        if (c.type === 'pc') {
            return `
                <div class="turn-item ${c.type} ${isActive ? 'active' : ''}" data-index="${i}">
                    <div class="turn-init clickable" data-index="${i}" title="Click to edit">${c.initiative}</div>
                    <div class="turn-info">
                        <div class="turn-name">${escapeHtml(c.name)}</div>
                    </div>
                    <div class="turn-actions">
                        <button class="remove-combat-btn" data-index="${i}" title="Remove">
                            <svg viewBox="0 0 24 24" width="18" height="18"><path fill="currentColor" d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>
                        </button>
                    </div>
                </div>
            `;
        }

        // Monster with instances
        const allDead = c.instances.every(inst => inst.hp <= 0);
        const instanceTags = c.instances.map((inst, idx) => {
            const isDead = inst.hp <= 0;
            const hpPercent = inst.hp / inst.maxHp;
            let hpClass = '';
            if (isDead) hpClass = 'dead';
            else if (hpPercent <= 0.25) hpClass = 'critical';
            else if (hpPercent <= 0.5) hpClass = 'low';
            
            const label = c.instances.length > 1 ? `#${idx + 1}: ${inst.hp}` : `${inst.hp}/${inst.maxHp}`;
            return `<span class="instance-tag ${hpClass}">${label}</span>`;
        }).join('');

        return `
            <div class="turn-item ${c.type} ${isActive ? 'active' : ''} ${allDead ? 'dead' : ''}" data-index="${i}">
                <div class="turn-init clickable" data-index="${i}" title="Click to edit">${c.initiative}</div>
                <div class="turn-info">
                    <div class="turn-name">${escapeHtml(c.name)}${c.instances.length > 1 ? ` (x${c.instances.length})` : ''}</div>
                    <div class="monster-instances">${instanceTags}</div>
                </div>
                <div class="turn-actions">
                    <button class="hp-btn" data-index="${i}">HP</button>
                    <button class="stats-btn" data-index="${i}">Stats</button>
                    <button class="remove-combat-btn" data-index="${i}" title="Remove">
                        <svg viewBox="0 0 24 24" width="18" height="18"><path fill="currentColor" d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>
                    </button>
                </div>
            </div>
        `;
    }).join('');

    // HP buttons
    container.querySelectorAll('.hp-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const index = parseInt(btn.dataset.index);
            showHPModal(index);
        });
    });

    // Stats buttons
    container.querySelectorAll('.stats-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            e.stopPropagation();
            const index = parseInt(btn.dataset.index);
            await showStatBlock(index);
        });
    });

    // Remove buttons
    container.querySelectorAll('.remove-combat-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const index = parseInt(btn.dataset.index);
            removeCombatant(index);
        });
    });

    // Initiative click to edit
    container.querySelectorAll('.turn-init.clickable').forEach(init => {
        init.addEventListener('click', (e) => {
            e.stopPropagation();
            const index = parseInt(init.dataset.index);
            showInitiativeModal(index);
        });
    });
}

export function nextTurn() {
    const state = getState();
    const { combatants } = state.combatState;
    state.combatState.currentTurn++;
    
    if (state.combatState.currentTurn >= combatants.length) {
        state.combatState.currentTurn = 0;
        state.combatState.round++;
    }

    renderTurnOrder();
}

export function prevTurn() {
    const state = getState();
    state.combatState.currentTurn--;
    
    if (state.combatState.currentTurn < 0) {
        state.combatState.currentTurn = state.combatState.combatants.length - 1;
        state.combatState.round = Math.max(1, state.combatState.round - 1);
    }

    renderTurnOrder();
}

// Initiative Modal
export function showInitiativeModal(combatantIndex) {
    const state = getState();
    setSelectedMonsterIndex(combatantIndex);
    const combatant = state.combatState.combatants[combatantIndex];
    
    document.getElementById('initiative-modal-title').textContent = `${combatant.name} Initiative`;
    document.getElementById('initiative-input').value = combatant.initiative;
    document.getElementById('initiative-modal').classList.add('active');
    document.getElementById('initiative-input').focus();
    document.getElementById('initiative-input').select();
}

export function saveInitiative() {
    const state = getState();
    if (state.selectedMonsterIndex === null) return;
    
    const newInit = parseInt(document.getElementById('initiative-input').value) || 0;
    state.combatState.combatants[state.selectedMonsterIndex].initiative = newInit;
    
    // Re-sort combatants by initiative
    const currentCombatant = state.combatState.combatants[state.combatState.currentTurn];
    state.combatState.combatants.sort((a, b) => b.initiative - a.initiative);
    
    // Update current turn to follow the same combatant
    state.combatState.currentTurn = state.combatState.combatants.indexOf(currentCombatant);
    
    closeModals();
    renderTurnOrder();
}

// HP Modal
export function showHPModal(combatantIndex) {
    const state = getState();
    setSelectedMonsterIndex(combatantIndex);
    const combatant = state.combatState.combatants[combatantIndex];
    
    const modal = document.getElementById('hp-modal');
    const instanceSelector = document.getElementById('hp-instance-selector');
    
    document.getElementById('hp-modal-title').textContent = `${combatant.name} HP`;
    document.getElementById('hp-custom-amount').value = '0';
    
    // Show instance selector if multiple instances
    if (combatant.instances.length > 1) {
        setSelectedInstanceIndex(0);
        instanceSelector.classList.remove('hidden');
        renderInstanceSelector(combatant);
    } else {
        setSelectedInstanceIndex(0);
        instanceSelector.classList.add('hidden');
    }
    
    const instance = combatant.instances[state.selectedInstanceIndex];
    updateHPDisplay(instance.hp, instance.maxHp);
    updateHPPreview();
    
    modal.classList.add('active');
}

export function renderInstanceSelector(combatant) {
    const state = getState();
    const container = document.getElementById('hp-instance-selector');
    container.innerHTML = combatant.instances.map((inst, idx) => {
        const isDead = inst.hp <= 0;
        const isActive = idx === state.selectedInstanceIndex;
        return `
            <button class="instance-btn ${isActive ? 'active' : ''} ${isDead ? 'dead' : ''}" data-instance="${idx}">
                #${idx + 1}
                <span class="instance-hp">${inst.hp}/${inst.maxHp}</span>
            </button>
        `;
    }).join('');

    container.querySelectorAll('.instance-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            setSelectedInstanceIndex(parseInt(btn.dataset.instance));
            document.getElementById('hp-custom-amount').value = '0';
            const combatant = state.combatState.combatants[state.selectedMonsterIndex];
            const instance = combatant.instances[state.selectedInstanceIndex];
            updateHPDisplay(instance.hp, instance.maxHp);
            updateHPPreview();
            renderInstanceSelector(combatant);
        });
    });
}

export function updateHPDisplay(current, max) {
    const display = document.querySelector('.hp-display');
    document.getElementById('current-hp').textContent = current;
    document.getElementById('max-hp').textContent = max;
    
    const percent = current / max;
    display.classList.remove('low', 'critical');
    if (percent <= 0.25) display.classList.add('critical');
    else if (percent <= 0.5) display.classList.add('low');
}

export function updateHPPreview() {
    const state = getState();
    const input = document.getElementById('hp-custom-amount');
    const preview = document.getElementById('hp-preview');
    const previewValue = document.getElementById('hp-preview-value');
    
    const delta = parseInt(input.value) || 0;
    
    if (delta === 0) {
        preview.classList.add('hidden');
        input.classList.remove('damage', 'heal');
        return;
    }
    
    preview.classList.remove('hidden');
    input.classList.remove('damage', 'heal');
    input.classList.add(delta < 0 ? 'damage' : 'heal');
    
    // Calculate and show preview
    const combatant = state.combatState.combatants[state.selectedMonsterIndex];
    const instance = combatant.instances[state.selectedInstanceIndex];
    const newHp = Math.max(0, Math.min(instance.maxHp, instance.hp + delta));
    previewValue.textContent = newHp;
    previewValue.classList.toggle('dead', newHp <= 0);
}

export function addToHPDelta(amount) {
    const input = document.getElementById('hp-custom-amount');
    const currentValue = parseInt(input.value) || 0;
    input.value = currentValue + amount;
    updateHPPreview();
}

export function resetHPDelta() {
    document.getElementById('hp-custom-amount').value = '0';
    updateHPPreview();
}

export function applyHPDelta() {
    const state = getState();
    if (state.selectedMonsterIndex === null) return;
    
    const input = document.getElementById('hp-custom-amount');
    const delta = parseInt(input.value) || 0;
    
    if (delta === 0) return;
    
    const combatant = state.combatState.combatants[state.selectedMonsterIndex];
    const instance = combatant.instances[state.selectedInstanceIndex];
    instance.hp = Math.max(0, Math.min(instance.maxHp, instance.hp + delta));
    
    updateHPDisplay(instance.hp, instance.maxHp);
    input.value = '0';
    updateHPPreview();
    
    // Update instance selector if visible
    if (combatant.instances.length > 1) {
        renderInstanceSelector(combatant);
    }
    
    renderTurnOrder();
}

// Legacy function kept for compatibility
export function adjustHP(amount) {
    const state = getState();
    if (state.selectedMonsterIndex === null) return;
    
    const combatant = state.combatState.combatants[state.selectedMonsterIndex];
    const instance = combatant.instances[state.selectedInstanceIndex];
    instance.hp = Math.max(0, Math.min(instance.maxHp, instance.hp + amount));
    
    updateHPDisplay(instance.hp, instance.maxHp);
    
    // Update instance selector if visible
    if (combatant.instances.length > 1) {
        renderInstanceSelector(combatant);
    }
    
    renderTurnOrder();
}

// Stat Block
export async function showStatBlock(combatantIndex) {
    const state = getState();
    const combatant = state.combatState.combatants[combatantIndex];
    const comment = combatant.comment || '';
    
    // Check if it's a custom monster
    if (combatant.customMonsterId || combatant.source === 'Custom') {
        const monster = combatant.customMonsterId 
            ? CustomMonsters.getCustomMonster(combatant.customMonsterId)
            : CustomMonsters.searchCustomMonsters(combatant.name).find(m => m.name === combatant.name);
        if (monster) {
            showStatBlockModal(monster, comment);
            return;
        }
    }
    
    await showStatBlockByNameSource(combatant.name, combatant.source, comment);
}

// Combat monster search
export async function searchCombatMonsters(query, source) {
    const results = document.getElementById('combat-monster-search-results');
    
    if (query.length < 2) {
        results.innerHTML = '<div class="search-empty">Type at least 2 characters...</div>';
        return;
    }

    results.innerHTML = '<div class="search-loading">Searching...</div>';

    try {
        // Search custom monsters when no source filter is active, when showing custom only,
        // or when the user selects the All Sources option.
        const customMonsters = (!source || source === 'Custom' || source === 'ALL')
            ? CustomMonsters.searchCustomMonsters(query)
            : [];

        // Search API monsters unless the filter is narrowed to custom monsters only.
        const apiMonsters = source === 'Custom'
            ? []
            : await MonsterAPI.searchMonsters(query, source);
        
        // Combine results, custom monsters first
        const monsters = [...customMonsters, ...apiMonsters];
        
        if (monsters.length === 0) {
            results.innerHTML = '<div class="search-empty">No monsters found</div>';
            return;
        }

        results.innerHTML = monsters.map(m => {
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

        // Add click handler for adding monster
        results.querySelectorAll('.search-result-info').forEach(item => {
            item.addEventListener('click', async () => {
                const state = getState();
                const parent = item.closest('.search-result-item');
                const name = parent.dataset.name;
                const source = parent.dataset.source;
                const id = parent.dataset.id;
                await addMonsterToCombat(name, source, state.monsterQuantity, false, id || null);
            });
        });

        // Add click handler for viewing stats
        results.querySelectorAll('.view-stats-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.stopPropagation();
                const name = btn.dataset.name;
                const source = btn.dataset.source;
                const id = btn.dataset.id;
                
                if (id && source === 'Custom') {
                    // Show custom monster stat block
                    const monster = CustomMonsters.getCustomMonster(id);
                    if (monster) {
                        showStatBlockModal(monster);
                    }
                } else {
                    await showStatBlockByNameSource(name, source);
                }
            });
        });
    } catch (error) {
        results.innerHTML = '<div class="search-empty">Error searching monsters</div>';
    }
}

// Show combat monster search modal
export function showCombatMonsterSearch() {
    setMonsterQuantity(1);
    document.getElementById('monster-quantity').textContent = '1';
    document.getElementById('combat-monster-search-input').value = '';
    document.getElementById('combat-monster-search-results').innerHTML = 
        '<div class="search-empty">Type to search for monsters...</div>';
    document.getElementById('combat-monster-search-modal').classList.add('active');
    document.getElementById('combat-monster-search-input').focus();
}

// Show encounter monsters modal for quick adding
export function showEncounterMonstersModal() {
    const state = getState();
    const container = document.getElementById('encounter-monsters-list');
    
    // Get unique monsters from the encounter
    const encounterMonsters = state.currentEncounter?.monsters || [];
    
    if (encounterMonsters.length === 0) {
        container.innerHTML = '<div class="search-empty">No monsters in this encounter</div>';
        document.getElementById('encounter-monsters-modal').classList.add('active');
        return;
    }
    
    // Group monsters by name/source to show unique types
    const uniqueMonsters = {};
    encounterMonsters.forEach(m => {
        const key = `${m.name}|${m.source}`;
        if (!uniqueMonsters[key]) {
            uniqueMonsters[key] = { ...m, count: 1 };
        } else {
            uniqueMonsters[key].count++;
        }
    });
    
    // Get current counts in combat
    const combatCounts = {};
    state.combatState.combatants.forEach(c => {
        if (c.type === 'monster') {
            const key = `${c.name}|${c.source}`;
            combatCounts[key] = c.instances?.length || 1;
        }
    });
    
    container.innerHTML = Object.values(uniqueMonsters).map(m => {
        const key = `${m.name}|${m.source}`;
        const inCombat = combatCounts[key] || 0;
        return `
        <div class="search-result-item encounter-monster-item" data-name="${escapeHtml(m.name)}" data-source="${m.source}">
            <div class="search-result-info">
                <div class="monster-name">${escapeHtml(m.name)}</div>
                <div class="monster-meta">CR ${MonsterAPI.formatCR(m.cr)} | HP ${m.hp} | ${m.source}</div>
            </div>
            <span class="in-combat-count ${inCombat > 0 ? 'has-count' : ''}" data-name="${escapeHtml(m.name)}" data-source="${m.source}">${inCombat > 0 ? inCombat : ''}</span>
            <button class="btn btn-small view-stats-btn" data-name="${escapeHtml(m.name)}" data-source="${m.source}">Stats</button>
        </div>
    `}).join('');
    
    // Add click handlers for adding monster
    container.querySelectorAll('.encounter-monster-item .search-result-info').forEach(item => {
        item.addEventListener('click', async () => {
            const parent = item.closest('.encounter-monster-item');
            const name = parent.dataset.name;
            const source = parent.dataset.source;
            
            // Add visual feedback
            parent.classList.add('added-flash');
            
            await addMonsterToCombat(name, source, 1, true);
            
            // Update the count badge
            const combatant = state.combatState.combatants.find(c => c.type === 'monster' && c.name === name && c.source === source);
            const newCount = combatant?.instances?.length || 0;
            const countBadge = parent.querySelector('.in-combat-count');
            if (countBadge) {
                countBadge.textContent = newCount;
                countBadge.classList.add('has-count');
            }
            
            // Remove flash class after animation
            setTimeout(() => parent.classList.remove('added-flash'), 300);
        });
    });
    
    // Add click handlers for viewing stats
    container.querySelectorAll('.view-stats-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            e.stopPropagation();
            const name = btn.dataset.name;
            const source = btn.dataset.source;
            await showStatBlockByNameSource(name, source);
        });
    });
    
    document.getElementById('encounter-monsters-modal').classList.add('active');
}

export default {
    init,
    addMonsterToCombat,
    addPCToCombat,
    removeCombatant,
    renderInitiativeList,
    rollAllMonsterInitiative,
    startCombat,
    renderTurnOrder,
    nextTurn,
    prevTurn,
    showInitiativeModal,
    saveInitiative,
    showHPModal,
    renderInstanceSelector,
    updateHPDisplay,
    updateHPPreview,
    addToHPDelta,
    resetHPDelta,
    applyHPDelta,
    adjustHP,
    showStatBlock,
    searchCombatMonsters,
    showCombatMonsterSearch,
    showEncounterMonstersModal
};
