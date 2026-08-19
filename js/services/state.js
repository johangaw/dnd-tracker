// State Management Service - Handles application state

const state = {
    currentView: 'encounter-list',
    currentEncounter: null,
    editingEncounter: null,
    combatState: null,
    selectedMonsterIndex: null,
    selectedInstanceIndex: 0,
    monsterQuantity: 1,
    hpDelta: 0,
    editingMonsterIndex: null,
    importingEncounter: null,
    editingMonster: null,
    importingMonster: null,
    editingCharacter: null,
    characterEditSource: null, // 'list' or 'view' - tracks where character-edit was entered from
    importingCharacter: null
};

export function getState() {
    return state;
}

export function setView(view) {
    state.currentView = view;
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));

    const nav = document.querySelector('.main-nav');
    const isListView = ['encounter-list', 'custom-monsters', 'characters'].includes(view);
    nav?.classList.toggle('hidden', !isListView);

    const navSelection = {
        'encounter-list': 'encounters',
        'encounter-edit': 'encounters',
        'encounter-run': 'encounters',
        'custom-monsters': 'custom-monsters',
        'custom-monster-edit': 'custom-monsters',
        'characters': 'characters',
        'character-view': 'characters',
        'character-edit': 'characters'
    };

    const activeNav = navSelection[view] || 'encounters';
    document.querySelectorAll('.nav-item').forEach((navItem) => {
        const isActive = isListView && navItem.dataset.nav === activeNav;
        navItem.classList.toggle('active', isActive);
        navItem.setAttribute('aria-current', isActive ? 'page' : 'false');
    });
    
    // Map view names to element IDs
    const viewIdMap = {
        'character-view': 'character-view-section'
    };
    const viewId = viewIdMap[view] || `${view}-view`;
    // Views are custom elements. Look them up both ways: getElementById and
    // querySelector can disagree for custom elements in some DOM
    // implementations, and both lookups are used across the app.
    const viewEl = document.querySelector(`#${viewId}`);
    viewEl?.classList.add('active');
    const viewElById = document.getElementById(viewId);
    if (viewElById && viewElById !== viewEl) viewElById.classList.add('active');
    
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
            title.textContent = state.editingEncounter?.id ? 'Edit Encounter' : 'New Encounter';
            break;
        case 'encounter-run':
            backBtn.classList.remove('hidden');
            title.textContent = state.currentEncounter?.title || 'Combat';
            break;
        case 'custom-monsters':
            backBtn.classList.add('hidden');
            title.textContent = 'Custom Monsters';
            break;
        case 'custom-monster-edit':
            backBtn.classList.remove('hidden');
            title.textContent = state.editingMonster?.id ? 'Edit Monster' : 'New Monster';
            break;
        case 'characters':
            backBtn.classList.add('hidden');
            title.textContent = 'Characters';
            break;
        case 'character-view':
            backBtn.classList.remove('hidden');
            title.textContent = 'Character Sheet';
            break;
        case 'character-edit':
            backBtn.classList.remove('hidden');
            title.textContent = state.editingCharacter?.id ? 'Edit Character' : 'New Character';
            break;
    }
}

export function setCurrentEncounter(encounter) {
    state.currentEncounter = encounter;
}

export function setEditingEncounter(encounter) {
    state.editingEncounter = encounter;
}

export function setCombatState(combatState) {
    state.combatState = combatState;
}

export function setSelectedMonsterIndex(index) {
    state.selectedMonsterIndex = index;
}

export function setSelectedInstanceIndex(index) {
    state.selectedInstanceIndex = index;
}

export function setMonsterQuantity(quantity) {
    state.monsterQuantity = quantity;
}

export function setEditingMonsterIndex(index) {
    state.editingMonsterIndex = index;
}

export function setImportingEncounter(encounter) {
    state.importingEncounter = encounter;
}

export function setEditingMonster(monster) {
    state.editingMonster = monster;
}

export function setImportingMonster(monster) {
    state.importingMonster = monster;
}

export function setEditingCharacter(character) {
    state.editingCharacter = character;
}

export function setCharacterEditSource(source) {
    state.characterEditSource = source;
}

export function setImportingCharacter(character) {
    state.importingCharacter = character;
}

// Default export for backward compatibility
export default {
    getState,
    setView,
    setCurrentEncounter,
    setEditingEncounter,
    setCombatState,
    setSelectedMonsterIndex,
    setSelectedInstanceIndex,
    setMonsterQuantity,
    setEditingMonsterIndex,
    setImportingEncounter,
    setEditingMonster,
    setImportingMonster,
    setEditingCharacter,
    setCharacterEditSource,
    setImportingCharacter
};
