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
    characterEditSource: null // 'list' or 'view' - tracks where character-edit was entered from
};

export function getState() {
    return state;
}

export function setView(view) {
    state.currentView = view;
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    
    // Map view names to element IDs
    const viewIdMap = {
        'character-view': 'character-view-section'
    };
    const viewId = viewIdMap[view] || `${view}-view`;
    document.getElementById(viewId)?.classList.add('active');
    
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
            backBtn.classList.remove('hidden');
            title.textContent = 'Custom Monsters';
            break;
        case 'custom-monster-edit':
            backBtn.classList.remove('hidden');
            title.textContent = state.editingMonster?.id ? 'Edit Monster' : 'New Monster';
            break;
        case 'characters':
            backBtn.classList.remove('hidden');
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
    setCharacterEditSource
};
