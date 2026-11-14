import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { initApp, click } from '../helpers.js'
import { getState } from '../../js/services/state.js'

const monsters = () => [
    { name: 'Zombie', source: 'MM', hp: 22, cr: '1/4', comment: 'Last' },
    { name: 'goblin', source: 'MM', hp: 7, cr: '1/4', comment: 'First' },
    { name: 'Ogre', source: 'MM', hp: 59, cr: '2' }
]

describe('Encounter monster ordering', () => {
    beforeEach(async () => { await initApp() })
    afterEach(() => { localStorage.clear(); vi.restoreAllMocks() })

    it('sorts the editor by name while keeping removal and notes tied to the original monster', async () => {
        await click('#new-encounter-btn')
        await click('#encounter-choice-create-new')
        const state = getState()
        state.editingEncounter.monsters = monsters()
        const editor = document.querySelector('encounter-edit-view')
        editor.renderMonsterList()
        expect([...editor.querySelectorAll('#monster-list .monster-name')].map(el => el.textContent))
            .toEqual(['goblin', 'Ogre', 'Zombie'])
        const notes = vi.spyOn(editor, 'showDMNotesModal')
        await click(editor.querySelector('#monster-list .notes-btn'))
        expect(notes).toHaveBeenCalledWith(1)
        await click(editor.querySelector('#monster-list .remove-btn'))
        expect(state.editingEncounter.monsters.map(m => m.name)).toEqual(['Zombie', 'Ogre'])
    })

    it('sorts the encounter quick-add list without changing stored monster order', () => {
        const state = getState()
        state.currentEncounter = { monsters: monsters() }
        state.combatState = { combatants: [] }
        document.querySelector('encounter-run-view').showEncounterMonstersModal()
        expect([...document.querySelectorAll('.encounter-monster-item .monster-name')].map(el => el.textContent))
            .toEqual(['goblin', 'Ogre', 'Zombie'])
        expect(state.currentEncounter.monsters.map(m => m.name)).toEqual(['Zombie', 'goblin', 'Ogre'])
    })
})
