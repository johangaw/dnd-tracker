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
    editingMonsterIndex: null
};

export function getState() {
    return state;
}

export function setView(view) {
    state.currentView = view;
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
            title.textContent = state.editingEncounter?.id ? 'Edit Encounter' : 'New Encounter';
            break;
        case 'encounter-run':
            backBtn.classList.remove('hidden');
            title.textContent = state.currentEncounter?.title || 'Combat';
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
    setEditingMonsterIndex
};
