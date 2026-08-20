// Tests for autosaving edit views
//
// The character, monster and encounter editors have no Save, Cancel or Delete
// buttons. Every edit is written to storage as it is made, and the header's
// back button is what ends the editing session.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
    initApp, click, type, clearAndType, tick, exists, isVisible, getValue,
    leaveEditView, getStoredEncounters
} from '../helpers.js'
import * as Characters from '../../js/services/characters.js'
import * as CustomMonsters from '../../js/services/customMonsters.js'
import * as Spells from '../../js/services/spells.js'

async function openNewEncounter() {
    await click('#new-encounter-btn')
    await click('#encounter-choice-create-new')
}

async function openNewMonster() {
    await click('#menu-btn')
    await click('#menu-custom-monsters')
    await click('#new-custom-monster-btn')
    await click('#choice-create-new')
}

async function openNewCharacter() {
    await click('#menu-btn')
    await click('#menu-characters')
    await click('#new-character-btn')
    await click('#character-choice-create-new')
}

describe('Autosaving edit views', () => {
    beforeEach(async () => {
        await initApp()
    })

    afterEach(() => {
        localStorage.clear()
        Spells.clearCache()
        vi.restoreAllMocks()
    })

    describe('No save, cancel or delete CTAs', () => {
        it('the encounter editor has none', async () => {
            await openNewEncounter()

            expect(exists('#encounter-form [type="submit"]')).toBe(false)
            expect(exists('#delete-encounter-btn')).toBe(false)
        })

        it('the monster editor has none, but keeps Preview', async () => {
            await openNewMonster()

            expect(exists('#custom-monster-form [type="submit"]')).toBe(false)
            expect(exists('#delete-monster-btn')).toBe(false)
            expect(exists('#preview-monster-btn')).toBe(true)
        })

        it('the character editor has none', async () => {
            await openNewCharacter()

            expect(exists('#character-form [type="submit"]')).toBe(false)
            expect(exists('#delete-character-btn')).toBe(false)
            expect(exists('#cancel-character-btn')).toBe(false)
        })
    })

    describe('Encounters', () => {
        it('saves each field as it is edited', async () => {
            await openNewEncounter()

            await type('#encounter-title', 'Bandit Camp')
            expect(getStoredEncounters()[0].title).toBe('Bandit Camp')

            await type('#encounter-description', 'Six bandits and a captain')
            expect(getStoredEncounters()[0].description).toBe('Six bandits and a captain')
        })

        it('saves a PC as soon as it is named, and again when removed', async () => {
            await openNewEncounter()
            await type('#encounter-title', 'Party Fight')

            await click('#add-pc-btn')
            await type(document.querySelector('.pc-name-input'), 'Thorin')
            expect(getStoredEncounters()[0].pcs).toHaveLength(1)

            await click('.pc-name-input ~ .remove-btn, #pc-list .remove-btn')
            expect(getStoredEncounters()[0].pcs).toHaveLength(0)
        })

        it('does not store an encounter that has no title', async () => {
            await openNewEncounter()

            await type('#encounter-description', 'Notes with nothing else')

            expect(getStoredEncounters()).toHaveLength(0)
            expect(isVisible('#encounter-title-required')).toBe(true)

            await type('#encounter-title', 'Now It Has One')

            expect(getStoredEncounters()).toHaveLength(1)
            expect(isVisible('#encounter-title-required')).toBe(false)
        })

        it('keeps the edit when navigating back', async () => {
            await openNewEncounter()
            await type('#encounter-title', 'Goblin Ambush')
            await leaveEditView()

            expect(isVisible('#encounter-list-view')).toBe(true)
            expect(getStoredEncounters()[0].title).toBe('Goblin Ambush')
        })

        it('writes a keystroke that was still debounced when the view was left', async () => {
            await openNewEncounter()
            await type('#encounter-title', 'Draft')

            // Typing alone - no blur, so no change event - is debounced
            const title = document.querySelector('#encounter-title')
            title.value = 'Draft Extended'
            title.dispatchEvent(new Event('input', { bubbles: true }))
            expect(getStoredEncounters()[0].title).toBe('Draft')

            await leaveEditView()
            expect(getStoredEncounters()[0].title).toBe('Draft Extended')
        })
    })

    describe('Custom monsters', () => {
        it('saves each field as it is edited', async () => {
            await openNewMonster()

            await type('#monster-name', 'Bog Lurker')
            expect(CustomMonsters.getCustomMonsters()[0].name).toBe('Bog Lurker')

            await clearAndType('#monster-hp', '77')
            expect(CustomMonsters.getCustomMonsters()[0].hp.average).toBe(77)
        })

        it('saves traits as they are added, edited and removed', async () => {
            await openNewMonster()
            await type('#monster-name', 'Trait Holder')

            await click('#add-trait-btn')
            await type('.trait-name', 'Amphibious')
            expect(CustomMonsters.getCustomMonsters()[0].trait[0].name).toBe('Amphibious')

            await click('#traits-list .remove-btn')
            expect(CustomMonsters.getCustomMonsters()[0].trait).toHaveLength(0)
        })

        it('keeps the edit when navigating back', async () => {
            const monster = CustomMonsters.createEmptyMonster()
            monster.name = 'Old Name'
            CustomMonsters.saveCustomMonster(monster)

            await click('#menu-btn')
            await click('#menu-custom-monsters')
            await click('.monster-card')
            await click('#monster-context-menu [data-action="edit"]')

            await clearAndType('#monster-name', 'New Name')
            await leaveEditView()

            expect(CustomMonsters.getCustomMonsters()[0].name).toBe('New Name')
        })
    })

    describe('Characters', () => {
        it('saves each field as it is edited', async () => {
            await openNewCharacter()

            await type('#char-name', 'Lyra')
            expect(Characters.getCharacters()[0].name).toBe('Lyra')

            await type('#char-class', 'Bard')
            expect(Characters.getCharacters()[0].class).toBe('Bard')

            await clearAndType('#char-level', '4')
            expect(Characters.getCharacters()[0].level).toBe(4)
        })

        it('does not store a character that has no name', async () => {
            await openNewCharacter()

            await type('#char-class', 'Rogue')

            expect(Characters.getCharacters()).toHaveLength(0)
            expect(isVisible('#char-name-required')).toBe(true)

            await type('#char-name', 'Shade')

            expect(Characters.getCharacters()).toHaveLength(1)
            expect(isVisible('#char-name-required')).toBe(false)
        })

        it('saves attacks as they are added, edited and removed', async () => {
            await openNewCharacter()
            await type('#char-name', 'Fighter')

            await click('#add-attack-btn')
            await type('.attack-name', 'Longsword')
            expect(Characters.getCharacters()[0].attacks[0].name).toBe('Longsword')

            await click('#attacks-list .remove-btn')
            expect(Characters.getCharacters()[0].attacks).toHaveLength(0)
        })

        it('keeps the edit when navigating back to the character sheet', async () => {
            await openNewCharacter()
            await type('#char-name', 'Durnan')
            await leaveEditView()

            expect(document.getElementById('character-edit-view').classList.contains('active')).toBe(false)
            expect(Characters.getCharacters()[0].name).toBe('Durnan')
        })

        it('does not resave the character while a different view is open', async () => {
            await openNewCharacter()
            await type('#char-name', 'Stable')
            await leaveEditView()

            const before = Characters.getCharacters()[0].updatedAt

            await tick(20)
            await click('#menu-btn')
            await click('#menu-encounters')

            expect(Characters.getCharacters()[0].updatedAt).toBe(before)
        })
    })
})
