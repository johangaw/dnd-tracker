// D&D Encounter Tracker - Main Application

// ============================================
// Data Storage
// ============================================
const Storage = {
    ENCOUNTERS_KEY: 'dnd-encounters',
    MONSTER_CACHE_KEY: 'dnd-monster-cache',

    getEncounters() {
        const data = localStorage.getItem(this.ENCOUNTERS_KEY);
        return data ? JSON.parse(data) : [];
    },

    saveEncounters(encounters) {
        localStorage.setItem(this.ENCOUNTERS_KEY, JSON.stringify(encounters));
    },

    getEncounter(id) {
        return this.getEncounters().find(e => e.id === id);
    },

    saveEncounter(encounter) {
        const encounters = this.getEncounters();
        const index = encounters.findIndex(e => e.id === encounter.id);
        if (index >= 0) {
            encounters[index] = encounter;
        } else {
            encounters.push(encounter);
        }
        this.saveEncounters(encounters);
    },

    deleteEncounter(id) {
        const encounters = this.getEncounters().filter(e => e.id !== id);
        this.saveEncounters(encounters);
    },

    getMonsterCache() {
        const data = localStorage.getItem(this.MONSTER_CACHE_KEY);
        return data ? JSON.parse(data) : {};
    },

    cacheMonster(key, monster) {
        const cache = this.getMonsterCache();
        cache[key] = monster;
        localStorage.setItem(this.MONSTER_CACHE_KEY, JSON.stringify(cache));
    }
};

// ============================================
// Monster API (Local data from 5e.tools repo)
// ============================================
const MonsterAPI = {
    BASE_URL: 'data/bestiary',
    
    // All available sources (locally hosted)
    AVAILABLE_SOURCES: [
        'AATM', 'ABH', 'AI', 'AitFR-ISF', 'AitFR-THP', 'AitFR-DN', 'AitFR-FCD', 'AWM', 'BAM', 'BGDIA',
        'BGG', 'BMT', 'CM', 'CoA', 'CoS', 'CRCotN', 'DC', 'DIP', 'DitLCoT', 'DMG', 'DoD', 'DoSI',
        'DSotDQ', 'EFA', 'EGW', 'ERLW', 'ESK', 'FRAiF', 'FTD', 'GGR', 'GoS', 'GotSF', 'HAT-TG',
        'HftT', 'HoL', 'HotB', 'HotDQ', 'IDRotF', 'IMR', 'JttRC', 'KftGV', 'KKW', 'LFL', 'LLK',
        'LMoP', 'LoX', 'LR', 'LRDT', 'MaBJoV', 'MCV1SC', 'MCV2DC', 'MCV3MC', 'MCV4EC', 'MisMV1',
        'MFF', 'MGELFT', 'MM', 'MPMM', 'MPP', 'MOT', 'MTF', 'NF', 'NRH-TCMC', 'NRH-AVitW', 'NRH-ASS',
        'NRH-CoI', 'NRH-TLT', 'NRH-AWoL', 'NRH-AT', 'OotA', 'OoW', 'PaBTSO', 'PSA', 'PSD', 'PSI',
        'PSK', 'PSX', 'PSZ', 'PHB', 'PotA', 'QftIS', 'RMBRE', 'RoT', 'RtG', 'SADS', 'SCC', 'SDW',
        'SKT', 'SLW', 'TCE', 'TTP', 'TftYP', 'ToA', 'ToFW', 'VD', 'VEoR', 'VGM', 'VRGR', 'XGE',
        'WBtW', 'WDH', 'WDMM', 'WttHC', 'XDMG', 'XMM', 'XPHB'
    ],
    
    // Default sources to search when no filter is selected (most common books)
    DEFAULT_SOURCES: ['MM', 'XMM', 'MPMM', 'VGM', 'MTF'],
    
    sourceIndex: null,
    loadedSources: {},
    allMonsters: [],

    async loadIndex() {
        if (this.sourceIndex) return this.sourceIndex;
        
        try {
            const response = await fetch(`${this.BASE_URL}/index.json`);
            this.sourceIndex = await response.json();
            return this.sourceIndex;
        } catch (error) {
            console.error('Failed to load monster index:', error);
            return {};
        }
    },

    async loadSource(sourceCode) {
        if (this.loadedSources[sourceCode]) {
            return this.loadedSources[sourceCode];
        }

        // Check if source is available locally
        if (!this.AVAILABLE_SOURCES.includes(sourceCode)) {
            return [];
        }

        const index = await this.loadIndex();
        const filename = index[sourceCode];
        if (!filename) return [];

        try {
            const response = await fetch(`${this.BASE_URL}/${filename}`);
            const data = await response.json();
            this.loadedSources[sourceCode] = data.monster || [];
            return this.loadedSources[sourceCode];
        } catch (error) {
            console.error(`Failed to load source ${sourceCode}:`, error);
            return [];
        }
    },

    async searchMonsters(query, source = '') {
        const searchQuery = query.toLowerCase().trim();
        if (searchQuery.length < 2) return [];

        // Use specific source, or default sources, or all sources if 'ALL' is specified
        let sourcesToSearch;
        if (source === 'ALL') {
            sourcesToSearch = this.AVAILABLE_SOURCES;
        } else if (source) {
            sourcesToSearch = [source];
        } else {
            sourcesToSearch = this.DEFAULT_SOURCES;
        }

        const results = [];
        
        for (const src of sourcesToSearch) {
            const monsters = await this.loadSource(src);
            for (const monster of monsters) {
                if (monster.name.toLowerCase().includes(searchQuery)) {
                    results.push(monster);
                }
            }
        }

        // Sort by name and limit results
        return results
            .sort((a, b) => a.name.localeCompare(b.name))
            .slice(0, 100);
    },

    async getMonster(name, source) {
        const cacheKey = `${name}|${source}`;
        const cached = Storage.getMonsterCache()[cacheKey];
        if (cached) return cached;

        const monsters = await this.loadSource(source);
        const monster = monsters.find(m => m.name === name && m.source === source);
        
        if (monster) {
            Storage.cacheMonster(cacheKey, monster);
        }
        
        return monster;
    },

    // Format CR for display
    formatCR(cr) {
        if (typeof cr === 'object') {
            return cr.cr || '?';
        }
        return cr || '?';
    },

    // Get HP value
    getHP(monster) {
        if (monster.hp) {
            if (typeof monster.hp === 'object') {
                return monster.hp.average || 0;
            }
            return monster.hp;
        }
        return 0;
    },

    // Get AC value
    getAC(monster) {
        if (!monster.ac) return 10;
        if (Array.isArray(monster.ac)) {
            const first = monster.ac[0];
            if (typeof first === 'object') {
                return first.ac || 10;
            }
            return first;
        }
        return monster.ac;
    },

    // Get ability modifier
    getAbilityMod(score) {
        return Math.floor((score - 10) / 2);
    },

    formatMod(mod) {
        return mod >= 0 ? `+${mod}` : `${mod}`;
    }
};

// ============================================
// State Management
// ============================================
const State = {
    currentView: 'encounter-list',
    currentEncounter: null,
    editingEncounter: null,
    combatState: null,
    selectedMonsterIndex: null,
    selectedInstanceIndex: 0,
    monsterQuantity: 1,
    
    setView(view) {
        this.currentView = view;
        document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
        document.getElementById(`${view}-view`).classList.add('active');
        
        // Update header
        const backBtn = document.getElementById('back-btn');
        const title = document.getElementById('page-title');
        
        switch (view) {
            case 'encounter-list':
                backBtn.classList.add('hidden');
                title.textContent = 'Encounters';
                break;
            case 'encounter-edit':
                backBtn.classList.remove('hidden');
                title.textContent = this.editingEncounter?.id ? 'Edit Encounter' : 'New Encounter';
                break;
            case 'encounter-run':
                backBtn.classList.remove('hidden');
                title.textContent = this.currentEncounter?.title || 'Combat';
                break;
        }
    }
};

// ============================================
// UI Components
// ============================================
const UI = {
    // Render encounter list
    renderEncounterList() {
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
                <h3>${this.escapeHtml(enc.title)}</h3>
                ${enc.description ? `<p>${this.escapeHtml(enc.description)}</p>` : ''}
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
                this.showContextMenu(e, id);
            });
            
            // Long press for mobile
            let pressTimer;
            card.addEventListener('touchstart', (e) => {
                pressTimer = setTimeout(() => {
                    const id = card.dataset.id;
                    this.showContextMenu(e, id);
                }, 500);
            });
            card.addEventListener('touchend', () => clearTimeout(pressTimer));
            card.addEventListener('touchmove', () => clearTimeout(pressTimer));
        });
    },

    // Show context menu
    showContextMenu(e, encounterId) {
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
            document.addEventListener('click', this.hideContextMenu, { once: true });
        }, 0);
    },

    hideContextMenu() {
        document.getElementById('context-menu').classList.add('hidden');
    },

    // Initialize edit form
    initEditForm(encounter = null) {
        State.editingEncounter = encounter || {
            id: Date.now().toString(),
            title: '',
            description: '',
            pcs: [],
            monsters: []
        };

        document.getElementById('encounter-title').value = State.editingEncounter.title;
        document.getElementById('encounter-description').value = State.editingEncounter.description || '';
        
        const deleteBtn = document.getElementById('delete-encounter-btn');
        if (encounter) {
            deleteBtn.classList.remove('hidden');
        } else {
            deleteBtn.classList.add('hidden');
        }

        this.renderPCList();
        this.renderMonsterList();
        State.setView('encounter-edit');
    },

    // Render PC list in edit form
    renderPCList() {
        const container = document.getElementById('pc-list');
        const pcs = State.editingEncounter.pcs || [];

        container.innerHTML = pcs.map((pc, index) => `
            <div class="item-row" data-index="${index}">
                <input type="text" value="${this.escapeHtml(pc.name)}" placeholder="Character name..." class="pc-name-input">
                <button type="button" class="remove-btn" data-index="${index}">
                    <svg viewBox="0 0 24 24" width="20" height="20"><path fill="currentColor" d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>
                </button>
            </div>
        `).join('');

        // Add event listeners
        container.querySelectorAll('.pc-name-input').forEach((input, index) => {
            input.addEventListener('change', () => {
                State.editingEncounter.pcs[index].name = input.value;
            });
        });

        container.querySelectorAll('.remove-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const index = parseInt(btn.dataset.index);
                State.editingEncounter.pcs.splice(index, 1);
                this.renderPCList();
            });
        });
    },

    // Render monster list in edit form
    renderMonsterList() {
        const container = document.getElementById('monster-list');
        const monsters = State.editingEncounter.monsters || [];

        container.innerHTML = monsters.map((monster, index) => `
            <div class="item-row" data-index="${index}">
                <div class="item-info">
                    <div class="item-name">${this.escapeHtml(monster.name)}</div>
                    <div class="item-meta">CR ${MonsterAPI.formatCR(monster.cr)} | HP ${monster.hp} | ${monster.source}</div>
                </div>
                <button type="button" class="remove-btn" data-index="${index}">
                    <svg viewBox="0 0 24 24" width="20" height="20"><path fill="currentColor" d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>
                </button>
            </div>
        `).join('');

        container.querySelectorAll('.remove-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const index = parseInt(btn.dataset.index);
                State.editingEncounter.monsters.splice(index, 1);
                this.renderMonsterList();
            });
        });
    },

    // Monster search modal
    async showMonsterSearch() {
        const modal = document.getElementById('monster-search-modal');
        const input = document.getElementById('monster-search-input');
        const results = document.getElementById('monster-search-results');
        
        modal.classList.add('active');
        input.value = '';
        results.innerHTML = '<div class="search-empty">Type to search for monsters...</div>';
        input.focus();
    },

    async searchMonsters(query, source) {
        const results = document.getElementById('monster-search-results');
        
        if (query.length < 2) {
            results.innerHTML = '<div class="search-empty">Type at least 2 characters...</div>';
            return;
        }

        results.innerHTML = '<div class="search-loading">Searching...</div>';

        try {
            const monsters = await MonsterAPI.searchMonsters(query, source);
            
            if (monsters.length === 0) {
                results.innerHTML = '<div class="search-empty">No monsters found</div>';
                return;
            }

            results.innerHTML = monsters.map(m => `
                <div class="search-result-item" data-name="${this.escapeHtml(m.name)}" data-source="${m.source}">
                    <div>
                        <div class="monster-name">${this.escapeHtml(m.name)}</div>
                        <div class="monster-meta">CR ${MonsterAPI.formatCR(m.cr)} | ${m.source}</div>
                    </div>
                </div>
            `).join('');

            results.querySelectorAll('.search-result-item').forEach(item => {
                item.addEventListener('click', async () => {
                    const name = item.dataset.name;
                    const source = item.dataset.source;
                    await this.addMonsterToEncounter(name, source);
                });
            });
        } catch (error) {
            results.innerHTML = '<div class="search-empty">Error searching monsters</div>';
        }
    },

    async addMonsterToEncounter(name, source) {
        const monster = await MonsterAPI.getMonster(name, source);
        if (!monster) return;

        State.editingEncounter.monsters.push({
            name: monster.name,
            source: monster.source,
            cr: monster.cr,
            hp: MonsterAPI.getHP(monster),
            ac: MonsterAPI.getAC(monster),
            dexMod: MonsterAPI.getAbilityMod(monster.dex)
        });

        this.renderMonsterList();
        this.closeModals();
    },

    // Initialize run mode
    initRunMode(encounter) {
        State.currentEncounter = JSON.parse(JSON.stringify(encounter));
        State.combatState = {
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
                    dexMod: monster.dexMod || 0,
                    instances: []
                };
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
                dexMod: group.dexMod,
                instances: group.instances
            });
        });

        State.combatState.combatants = combatants;

        // Show initiative setup
        document.getElementById('initiative-setup').classList.remove('hidden');
        document.getElementById('combat-tracker').classList.add('hidden');
        
        this.renderInitiativeList();
        State.setView('encounter-run');
    },

    // Add monster to combat (runtime only)
    async addMonsterToCombat(name, source, quantity = 1) {
        const monster = await MonsterAPI.getMonster(name, source);
        if (!monster) return;

        const hp = MonsterAPI.getHP(monster);
        const ac = MonsterAPI.getAC(monster);
        const dexMod = MonsterAPI.getAbilityMod(monster.dex);

        // Check if this monster type already exists in combat
        const existingIndex = State.combatState.combatants.findIndex(
            c => c.type === 'monster' && c.name === name && c.source === source
        );

        if (existingIndex >= 0) {
            // Add instances to existing group
            for (let i = 0; i < quantity; i++) {
                State.combatState.combatants[existingIndex].instances.push({
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
                dexMod: dexMod,
                instances: instances
            };

            State.combatState.combatants.push(newCombatant);
        }

        // Re-render appropriate view
        if (State.combatState.started) {
            this.renderTurnOrder();
        } else {
            this.renderInitiativeList();
        }

        this.closeModals();
    },

    // Add PC to combat (runtime only)
    addPCToCombat(name, initiative = 0) {
        const newPC = {
            id: `pc-${Date.now()}`,
            name: name,
            type: 'pc',
            initiative: initiative
        };

        State.combatState.combatants.push(newPC);

        // Re-sort if combat has started
        if (State.combatState.started) {
            State.combatState.combatants.sort((a, b) => b.initiative - a.initiative);
            this.renderTurnOrder();
        } else {
            this.renderInitiativeList();
        }

        this.closeModals();
    },

    // Remove combatant from combat
    removeCombatant(index) {
        const combatant = State.combatState.combatants[index];
        if (!combatant) return;

        const name = combatant.name;
        if (!confirm(`Remove ${name} from combat?`)) return;

        // Adjust current turn if needed
        if (State.combatState.started) {
            if (index < State.combatState.currentTurn) {
                State.combatState.currentTurn--;
            } else if (index === State.combatState.currentTurn) {
                // If removing current combatant, stay at same index (next combatant slides up)
                if (State.combatState.currentTurn >= State.combatState.combatants.length - 1) {
                    State.combatState.currentTurn = 0;
                    State.combatState.round++;
                }
            }
        }

        State.combatState.combatants.splice(index, 1);

        if (State.combatState.started) {
            this.renderTurnOrder();
        } else {
            this.renderInitiativeList();
        }
    },

    renderInitiativeList() {
        const container = document.getElementById('initiative-list');
        const combatants = State.combatState.combatants;

        container.innerHTML = `
            <button class="btn roll-all-btn" id="roll-all-init">Roll All Monster Initiative</button>
            ${combatants.map((c, i) => {
                const instanceCount = c.type === 'monster' ? c.instances.length : 0;
                const countLabel = instanceCount > 1 ? ` (x${instanceCount})` : '';
                return `
                <div class="initiative-item ${c.type}" data-index="${i}">
                    <input type="number" class="init-input" value="${c.initiative}" data-index="${i}" placeholder="0">
                    <div style="flex:1">
                        <div class="init-name">${this.escapeHtml(c.name)}${countLabel}</div>
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
            this.rollAllMonsterInitiative();
        });

        // Initiative inputs
        container.querySelectorAll('.init-input').forEach(input => {
            input.addEventListener('change', () => {
                const index = parseInt(input.dataset.index);
                State.combatState.combatants[index].initiative = parseInt(input.value) || 0;
            });
        });

        // Remove buttons
        container.querySelectorAll('.remove-combat-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const index = parseInt(btn.dataset.index);
                this.removeCombatant(index);
            });
        });
    },

    rollAllMonsterInitiative() {
        State.combatState.combatants.forEach((c, i) => {
            if (c.type === 'monster') {
                // Roll d20 + dex modifier
                const roll = Math.floor(Math.random() * 20) + 1;
                const dexMod = c.dexMod || 0;
                c.initiative = roll + dexMod;
                
                const input = document.querySelector(`.init-input[data-index="${i}"]`);
                if (input) input.value = c.initiative;
            }
        });
    },

    startCombat() {
        // Sort by initiative
        State.combatState.combatants.sort((a, b) => b.initiative - a.initiative);
        State.combatState.started = true;
        State.combatState.currentTurn = 0;

        document.getElementById('initiative-setup').classList.add('hidden');
        document.getElementById('combat-tracker').classList.remove('hidden');
        
        this.renderTurnOrder();
    },

    renderTurnOrder() {
        const container = document.getElementById('turn-order');
        const { combatants, currentTurn, round } = State.combatState;

        document.getElementById('round-number').textContent = round;

        container.innerHTML = combatants.map((c, i) => {
            const isActive = i === currentTurn;
            
            if (c.type === 'pc') {
                return `
                    <div class="turn-item ${c.type} ${isActive ? 'active' : ''}" data-index="${i}">
                        <div class="turn-init">${c.initiative}</div>
                        <div class="turn-info">
                            <div class="turn-name">${this.escapeHtml(c.name)}</div>
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
                    <div class="turn-init">${c.initiative}</div>
                    <div class="turn-info">
                        <div class="turn-name">${this.escapeHtml(c.name)}${c.instances.length > 1 ? ` (x${c.instances.length})` : ''}</div>
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
                this.showHPModal(index);
            });
        });

        // Stats buttons
        container.querySelectorAll('.stats-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.stopPropagation();
                const index = parseInt(btn.dataset.index);
                await this.showStatBlock(index);
            });
        });

        // Remove buttons
        container.querySelectorAll('.remove-combat-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const index = parseInt(btn.dataset.index);
                this.removeCombatant(index);
            });
        });
    },

    nextTurn() {
        const { combatants } = State.combatState;
        State.combatState.currentTurn++;
        
        if (State.combatState.currentTurn >= combatants.length) {
            State.combatState.currentTurn = 0;
            State.combatState.round++;
        }

        this.renderTurnOrder();
    },

    prevTurn() {
        State.combatState.currentTurn--;
        
        if (State.combatState.currentTurn < 0) {
            State.combatState.currentTurn = State.combatState.combatants.length - 1;
            State.combatState.round = Math.max(1, State.combatState.round - 1);
        }

        this.renderTurnOrder();
    },

    // HP Modal
    showHPModal(combatantIndex) {
        State.selectedMonsterIndex = combatantIndex;
        const combatant = State.combatState.combatants[combatantIndex];
        
        const modal = document.getElementById('hp-modal');
        const instanceSelector = document.getElementById('hp-instance-selector');
        
        document.getElementById('hp-modal-title').textContent = `${combatant.name} HP`;
        
        // Show instance selector if multiple instances
        if (combatant.instances.length > 1) {
            State.selectedInstanceIndex = 0;
            instanceSelector.classList.remove('hidden');
            this.renderInstanceSelector(combatant);
        } else {
            State.selectedInstanceIndex = 0;
            instanceSelector.classList.add('hidden');
        }
        
        const instance = combatant.instances[State.selectedInstanceIndex];
        this.updateHPDisplay(instance.hp, instance.maxHp);
        
        modal.classList.add('active');
    },

    renderInstanceSelector(combatant) {
        const container = document.getElementById('hp-instance-selector');
        container.innerHTML = combatant.instances.map((inst, idx) => {
            const isDead = inst.hp <= 0;
            const isActive = idx === State.selectedInstanceIndex;
            return `
                <button class="instance-btn ${isActive ? 'active' : ''} ${isDead ? 'dead' : ''}" data-instance="${idx}">
                    #${idx + 1}
                    <span class="instance-hp">${inst.hp}/${inst.maxHp}</span>
                </button>
            `;
        }).join('');

        container.querySelectorAll('.instance-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                State.selectedInstanceIndex = parseInt(btn.dataset.instance);
                const combatant = State.combatState.combatants[State.selectedMonsterIndex];
                const instance = combatant.instances[State.selectedInstanceIndex];
                this.updateHPDisplay(instance.hp, instance.maxHp);
                this.renderInstanceSelector(combatant);
            });
        });
    },

    updateHPDisplay(current, max) {
        const display = document.querySelector('.hp-display');
        document.getElementById('current-hp').textContent = current;
        document.getElementById('max-hp').textContent = max;
        
        const percent = current / max;
        display.classList.remove('low', 'critical');
        if (percent <= 0.25) display.classList.add('critical');
        else if (percent <= 0.5) display.classList.add('low');
    },

    adjustHP(amount) {
        if (State.selectedMonsterIndex === null) return;
        
        const combatant = State.combatState.combatants[State.selectedMonsterIndex];
        const instance = combatant.instances[State.selectedInstanceIndex];
        instance.hp = Math.max(0, Math.min(instance.maxHp, instance.hp + amount));
        
        this.updateHPDisplay(instance.hp, instance.maxHp);
        
        // Update instance selector if visible
        if (combatant.instances.length > 1) {
            this.renderInstanceSelector(combatant);
        }
        
        this.renderTurnOrder();
    },

    // Stat Block
    async showStatBlock(combatantIndex) {
        const combatant = State.combatState.combatants[combatantIndex];
        const monster = await MonsterAPI.getMonster(combatant.name, combatant.source);
        
        if (!monster) {
            alert('Could not load monster stats');
            return;
        }

        const modal = document.getElementById('stat-block-modal');
        document.getElementById('stat-block-name').textContent = monster.name;
        document.getElementById('stat-block-content').innerHTML = this.renderStatBlock(monster);
        
        modal.classList.add('active');
    },

    renderStatBlock(monster) {
        const size = this.formatSize(monster.size);
        const type = this.formatType(monster.type);
        const alignment = this.formatAlignment(monster.alignment);
        
        let html = `
            <div class="monster-header">
                <div class="monster-name">${this.escapeHtml(monster.name)}</div>
                <div class="monster-type">${size} ${type}, ${alignment}</div>
            </div>
            <div class="divider"></div>
            <div class="stat-row"><span class="stat-label">Armor Class</span> ${MonsterAPI.getAC(monster)}</div>
            <div class="stat-row"><span class="stat-label">Hit Points</span> ${monster.hp?.average || 0} ${monster.hp?.formula ? `(${monster.hp.formula})` : ''}</div>
            <div class="stat-row"><span class="stat-label">Speed</span> ${this.formatSpeed(monster.speed)}</div>
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
            const skills = Object.entries(monster.skill).map(([k, v]) => `${this.capitalizeFirst(k)} ${v}`).join(', ');
            html += `<div class="stat-row"><span class="stat-label">Skills</span> ${skills}</div>`;
        }

        // Damage immunities/resistances/vulnerabilities
        if (monster.immune) {
            html += `<div class="stat-row"><span class="stat-label">Damage Immunities</span> ${this.formatDamageTypes(monster.immune)}</div>`;
        }
        if (monster.resist) {
            html += `<div class="stat-row"><span class="stat-label">Damage Resistances</span> ${this.formatDamageTypes(monster.resist)}</div>`;
        }
        if (monster.vulnerable) {
            html += `<div class="stat-row"><span class="stat-label">Damage Vulnerabilities</span> ${this.formatDamageTypes(monster.vulnerable)}</div>`;
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
                html += `<div class="trait"><span class="trait-name">${trait.name}.</span> ${this.formatEntries(trait.entries)}</div>`;
            });
        }

        // Actions
        if (monster.action) {
            html += `<div class="section-title">Actions</div>`;
            monster.action.forEach(action => {
                html += `<div class="action"><span class="action-name">${action.name}.</span> ${this.formatEntries(action.entries)}</div>`;
            });
        }

        // Legendary actions
        if (monster.legendary) {
            html += `<div class="section-title">Legendary Actions</div>`;
            monster.legendary.forEach(action => {
                html += `<div class="action"><span class="action-name">${action.name}.</span> ${this.formatEntries(action.entries)}</div>`;
            });
        }

        return html;
    },

    formatSize(size) {
        const sizes = { T: 'Tiny', S: 'Small', M: 'Medium', L: 'Large', H: 'Huge', G: 'Gargantuan' };
        if (Array.isArray(size)) return sizes[size[0]] || size[0];
        return sizes[size] || size;
    },

    formatType(type) {
        if (typeof type === 'string') return type;
        if (type.type) {
            let result = type.type;
            if (type.tags) result += ` (${type.tags.join(', ')})`;
            return result;
        }
        return 'creature';
    },

    formatAlignment(alignment) {
        if (!alignment) return 'unaligned';
        const map = { L: 'lawful', N: 'neutral', C: 'chaotic', G: 'good', E: 'evil', U: 'unaligned', A: 'any alignment' };
        if (Array.isArray(alignment)) {
            return alignment.map(a => map[a] || a).join(' ');
        }
        return alignment;
    },

    formatSpeed(speed) {
        if (!speed) return '30 ft.';
        if (typeof speed === 'number') return `${speed} ft.`;
        
        const parts = [];
        if (speed.walk) parts.push(`${speed.walk} ft.`);
        if (speed.fly) parts.push(`fly ${speed.fly} ft.`);
        if (speed.swim) parts.push(`swim ${speed.swim} ft.`);
        if (speed.climb) parts.push(`climb ${speed.climb} ft.`);
        if (speed.burrow) parts.push(`burrow ${speed.burrow} ft.`);
        
        return parts.join(', ') || '30 ft.';
    },

    formatDamageTypes(types) {
        if (!types) return '';
        return types.map(t => typeof t === 'string' ? t : t.special || JSON.stringify(t)).join(', ');
    },

    formatEntries(entries) {
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
                    .replace(/{@recharge( \d)?}/g, (_, n) => n ? `(Recharge ${n.trim()}-6)` : '(Recharge)')
                    .replace(/{@h}/g, 'Hit: ')
                    .replace(/{@[^}]+}/g, '');
            }
            return '';
        }).join(' ');
    },

    capitalizeFirst(str) {
        return str.charAt(0).toUpperCase() + str.slice(1);
    },

    // Close all modals
    closeModals() {
        document.querySelectorAll('.modal').forEach(m => m.classList.remove('active'));
    },

    // Escape HTML
    escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
};

// ============================================
// Event Handlers
// ============================================
function initEventHandlers() {
    // Back button
    document.getElementById('back-btn').addEventListener('click', () => {
        if (State.currentView === 'encounter-edit') {
            State.setView('encounter-list');
            UI.renderEncounterList();
        } else if (State.currentView === 'encounter-run') {
            if (confirm('End combat and return to encounter list?')) {
                State.setView('encounter-list');
                UI.renderEncounterList();
            }
        }
    });

    // New encounter button
    document.getElementById('new-encounter-btn').addEventListener('click', () => {
        UI.initEditForm();
    });

    // Add PC button
    document.getElementById('add-pc-btn').addEventListener('click', () => {
        State.editingEncounter.pcs.push({ name: '' });
        UI.renderPCList();
        // Focus the new input
        const inputs = document.querySelectorAll('.pc-name-input');
        if (inputs.length > 0) {
            inputs[inputs.length - 1].focus();
        }
    });

    // Add monster button
    document.getElementById('add-monster-btn').addEventListener('click', () => {
        UI.showMonsterSearch();
    });

    // Monster search input
    let searchTimeout;
    document.getElementById('monster-search-input').addEventListener('input', (e) => {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => {
            const source = document.getElementById('monster-source-filter').value;
            UI.searchMonsters(e.target.value, source);
        }, 300);
    });

    document.getElementById('monster-source-filter').addEventListener('change', () => {
        const query = document.getElementById('monster-search-input').value;
        if (query.length >= 2) {
            const source = document.getElementById('monster-source-filter').value;
            UI.searchMonsters(query, source);
        }
    });

    // Encounter form submit
    document.getElementById('encounter-form').addEventListener('submit', (e) => {
        e.preventDefault();
        
        State.editingEncounter.title = document.getElementById('encounter-title').value;
        State.editingEncounter.description = document.getElementById('encounter-description').value;
        
        // Filter out empty PCs
        State.editingEncounter.pcs = State.editingEncounter.pcs.filter(pc => pc.name.trim());
        
        Storage.saveEncounter(State.editingEncounter);
        State.setView('encounter-list');
        UI.renderEncounterList();
    });

    // Delete encounter button
    document.getElementById('delete-encounter-btn').addEventListener('click', () => {
        if (confirm('Delete this encounter?')) {
            Storage.deleteEncounter(State.editingEncounter.id);
            State.setView('encounter-list');
            UI.renderEncounterList();
        }
    });

    // Context menu actions
    document.querySelectorAll('.context-item').forEach(item => {
        item.addEventListener('click', () => {
            const menu = document.getElementById('context-menu');
            const encounterId = menu.dataset.encounterId;
            const action = item.dataset.action;
            const encounter = Storage.getEncounter(encounterId);

            switch (action) {
                case 'edit':
                    UI.initEditForm(encounter);
                    break;
                case 'copy':
                    const copy = JSON.parse(JSON.stringify(encounter));
                    copy.id = Date.now().toString();
                    copy.title = `${copy.title} (Copy)`;
                    Storage.saveEncounter(copy);
                    UI.renderEncounterList();
                    break;
                case 'run':
                    UI.initRunMode(encounter);
                    break;
                case 'delete':
                    if (confirm('Delete this encounter?')) {
                        Storage.deleteEncounter(encounterId);
                        UI.renderEncounterList();
                    }
                    break;
            }

            UI.hideContextMenu();
        });
    });

    // Start combat button
    document.getElementById('start-combat-btn').addEventListener('click', () => {
        UI.startCombat();
    });

    // Add monster to combat buttons (both in setup and during combat)
    document.getElementById('add-combat-monster-btn').addEventListener('click', () => {
        showCombatMonsterSearch();
    });
    document.getElementById('add-combat-monster-btn-2').addEventListener('click', () => {
        showCombatMonsterSearch();
    });

    // Add PC to combat button
    document.getElementById('add-combat-pc-btn').addEventListener('click', () => {
        document.getElementById('combat-pc-name').value = '';
        document.getElementById('combat-pc-initiative').value = '';
        document.getElementById('combat-pc-modal').classList.add('active');
        document.getElementById('combat-pc-name').focus();
    });

    // Confirm add PC to combat
    document.getElementById('add-combat-pc-confirm').addEventListener('click', () => {
        const name = document.getElementById('combat-pc-name').value.trim();
        const initiative = parseInt(document.getElementById('combat-pc-initiative').value) || 0;
        if (name) {
            UI.addPCToCombat(name, initiative);
        }
    });

    // Combat monster search
    let combatSearchTimeout;
    document.getElementById('combat-monster-search-input').addEventListener('input', (e) => {
        clearTimeout(combatSearchTimeout);
        combatSearchTimeout = setTimeout(() => {
            const source = document.getElementById('combat-monster-source-filter').value;
            searchCombatMonsters(e.target.value, source);
        }, 300);
    });

    document.getElementById('combat-monster-source-filter').addEventListener('change', () => {
        const query = document.getElementById('combat-monster-search-input').value;
        if (query.length >= 2) {
            const source = document.getElementById('combat-monster-source-filter').value;
            searchCombatMonsters(query, source);
        }
    });

    // Quantity controls
    document.getElementById('qty-decrease').addEventListener('click', () => {
        State.monsterQuantity = Math.max(1, State.monsterQuantity - 1);
        document.getElementById('monster-quantity').textContent = State.monsterQuantity;
    });

    document.getElementById('qty-increase').addEventListener('click', () => {
        State.monsterQuantity = Math.min(20, State.monsterQuantity + 1);
        document.getElementById('monster-quantity').textContent = State.monsterQuantity;
    });

    // Turn navigation
    document.getElementById('next-turn-btn').addEventListener('click', () => {
        UI.nextTurn();
    });

    document.getElementById('prev-turn-btn').addEventListener('click', () => {
        UI.prevTurn();
    });

    // HP adjustment buttons
    document.querySelectorAll('.hp-controls .hp-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const amount = parseInt(btn.dataset.amount);
            UI.adjustHP(amount);
        });
    });

    document.getElementById('hp-damage-btn').addEventListener('click', () => {
        const amount = parseInt(document.getElementById('hp-custom-amount').value) || 0;
        UI.adjustHP(-amount);
        document.getElementById('hp-custom-amount').value = '';
    });

    document.getElementById('hp-heal-btn').addEventListener('click', () => {
        const amount = parseInt(document.getElementById('hp-custom-amount').value) || 0;
        UI.adjustHP(amount);
        document.getElementById('hp-custom-amount').value = '';
    });

    // Close modals
    document.querySelectorAll('.close-modal').forEach(btn => {
        btn.addEventListener('click', () => {
            UI.closeModals();
        });
    });

    // Close modal on backdrop click
    document.querySelectorAll('.modal').forEach(modal => {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                UI.closeModals();
            }
        });
    });

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            UI.closeModals();
            UI.hideContextMenu();
        }
    });
}

// Helper function to show combat monster search modal
function showCombatMonsterSearch() {
    State.monsterQuantity = 1;
    document.getElementById('monster-quantity').textContent = '1';
    document.getElementById('combat-monster-search-input').value = '';
    document.getElementById('combat-monster-search-results').innerHTML = 
        '<div class="search-empty">Type to search for monsters...</div>';
    document.getElementById('combat-monster-search-modal').classList.add('active');
    document.getElementById('combat-monster-search-input').focus();
}

// Helper function to search monsters for combat modal
async function searchCombatMonsters(query, source) {
    const results = document.getElementById('combat-monster-search-results');
    
    if (query.length < 2) {
        results.innerHTML = '<div class="search-empty">Type at least 2 characters...</div>';
        return;
    }

    results.innerHTML = '<div class="search-loading">Searching...</div>';

    try {
        const monsters = await MonsterAPI.searchMonsters(query, source);
        
        if (monsters.length === 0) {
            results.innerHTML = '<div class="search-empty">No monsters found</div>';
            return;
        }

        results.innerHTML = monsters.map(m => `
            <div class="search-result-item" data-name="${UI.escapeHtml(m.name)}" data-source="${m.source}">
                <div>
                    <div class="monster-name">${UI.escapeHtml(m.name)}</div>
                    <div class="monster-meta">CR ${MonsterAPI.formatCR(m.cr)} | HP ${MonsterAPI.getHP(m)} | ${m.source}</div>
                </div>
            </div>
        `).join('');

        results.querySelectorAll('.search-result-item').forEach(item => {
            item.addEventListener('click', async () => {
                const name = item.dataset.name;
                const source = item.dataset.source;
                await UI.addMonsterToCombat(name, source, State.monsterQuantity);
            });
        });
    } catch (error) {
        results.innerHTML = '<div class="search-empty">Error searching monsters</div>';
    }
}

// ============================================
// Initialize App
// ============================================
document.addEventListener('DOMContentLoaded', () => {
    initEventHandlers();
    UI.renderEncounterList();
    
    // Preload monster index
    MonsterAPI.loadIndex();
});
