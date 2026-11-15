import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { initApp, click, type, setChecked, waitFor, leaveEditView } from '../helpers.js'
import * as CustomMonsters from '../../js/services/customMonsters.js'
import * as MonsterAPI from '../../js/services/monsterApi.js'
import { getState } from '../../js/services/state.js'
import { mockMonsters } from '../mocks/monsters.js'

describe('Import monster features', () => {
    let editor, modal, target
    beforeEach(async () => {
        await initApp()
        editor = document.querySelector('custom-monster-edit-view')
        target = CustomMonsters.createEmptyMonster()
        target.name = 'My Monster'
        target.trait = [{ name: 'Existing', entries: ['Keep me'] }]
        editor.render(target)
        modal = editor.querySelector('import-features-modal')
        await click('#import-features-btn')
    })
    afterEach(() => {
        localStorage.clear()
        vi.restoreAllMocks()
    })

    async function searchAndSelect(query, source) {
        await type('#feature-source', source)
        await type('#feature-monster-search', query)
        await waitFor(() => expect(modal.querySelector('.search-result-info')).toBeTruthy())
        await click(modal.querySelector('.search-result-info'))
        await waitFor(() => expect(modal.querySelector('input[name="feature"]')).toBeTruthy())
    }

    it('searches official monsters and imports only selected attacks without replacing traits or stats', async () => {
        await searchAndSelect('Goblin', 'MM')
        expect(modal.querySelector('#feature-search-step').hidden).toBe(true)
        expect(modal.querySelector('#feature-selection-step').hidden).toBe(false)
        expect(modal.querySelector('.feature-description').textContent).toContain('slashing damage')
        expect(modal.querySelector('.feature-description').textContent).not.toContain('{@')
        await setChecked('import-features-modal input[name="feature"]', true)
        await click('#import-selected-features')
        expect(modal.classList.contains('active')).toBe(false)
        expect(getState().editingMonster.action).toEqual(mockMonsters.goblin.action)
        expect(getState().editingMonster.trait).toEqual(target.trait)
        expect(getState().editingMonster.name).toBe('My Monster')
        expect(getState().editingMonster.hp.average).toBe(target.hp.average)
        expect(editor.querySelector('.action-name').value).toBe('Scimitar')
        await leaveEditView()
        expect(CustomMonsters.getCustomMonster(target.id).action).toEqual(mockMonsters.goblin.action)
    })

    it('copies selected custom traits and structured spellcasting independently and persists edits', async () => {
        const source = CustomMonsters.createEmptyMonster()
        source.name = 'Source Mage'
        source.trait = [{ name: 'Magic Resistance', entries: [{ type: 'list', items: ['Resists magic'] }] }]
        source.action = [{ name: 'Unselected attack', entries: ['Do not copy'] }]
        source.spellcasting = [{
            name: 'Innate Spellcasting', type: 'spellcasting', ability: 'cha',
            headerEntries: ['Spell save DC 15'], daily: { '1e': ['{@spell fireball}'] },
            spells: { '1': { slots: 4, spells: ['{@spell shield}'] } },
            footerEntries: ['Special restriction'], hidden: ['daily']
        }]
        CustomMonsters.saveCustomMonster(source)
        const loadSource = vi.spyOn(CustomMonsters, 'getCustomMonster').mockReturnValueOnce(source)
        await searchAndSelect('Source Mage', 'Custom')
        loadSource.mockRestore()
        expect(modal.querySelector('.feature-description li').textContent).toBe('Resists magic')
        const preview = modal.querySelectorAll('.feature-description')[2]
        expect(preview.textContent).toContain('Spell save DC 15')
        expect(preview.textContent).toContain('1/day each: fireball')
        expect(preview.textContent).toContain('Level 1 (4 slots): shield')
        expect(preview.textContent).toContain('Special restriction')
        for (const input of modal.querySelectorAll('input[name="feature"]')) {
            if (input.closest('label').textContent.includes('Unselected')) continue
            await setChecked(`import-features-modal input[name="feature"][value="${input.value}"]`, true)
        }
        await click('#import-selected-features')
        const monster = getState().editingMonster
        expect(monster.trait).toEqual([{ name: 'Existing', entries: ['Keep me'] }, ...source.trait])
        expect(monster.action || []).toEqual([])
        expect(monster.spellcasting).toEqual(source.spellcasting)
        expect(monster.spellcasting[0]).not.toBe(source.spellcasting[0])
        monster.spellcasting[0].daily['1e'].push('Another spell')
        expect(source.spellcasting[0].daily['1e']).toEqual(['{@spell fireball}'])
        expect(CustomMonsters.getCustomMonster(source.id).spellcasting).toEqual(source.spellcasting)
        await type(editor.querySelectorAll('.trait-name')[1], 'Edited trait')
        expect(CustomMonsters.getCustomMonster(target.id).trait[1].name).toBe('Edited trait')
        expect(CustomMonsters.getCustomMonster(source.id).trait[0].name).toBe('Magic Resistance')
        expect(CustomMonsters.getCustomMonster(target.id).spellcasting[0].footerEntries).toEqual(['Special restriction'])
    })

    it('cancels without importing and resets selection when reopened', async () => {
        await searchAndSelect('Goblin', 'MM')
        await setChecked('import-features-modal input[name="feature"]', true)
        await click(modal.querySelector('.close-modal'))
        await click('#import-features-btn')
        expect(modal.querySelector('#import-selected-features').disabled).toBe(true)
        expect(modal.querySelectorAll('input[name="feature"]')).toHaveLength(0)
        expect(getState().editingMonster.action || []).toEqual([])
    })

    it('returns to the search results without importing and clears the selection count', async () => {
        await searchAndSelect('Goblin', 'MM')
        await setChecked('import-features-modal input[name="feature"]', true)
        expect(modal.querySelector('#feature-selection-count').textContent).toBe('1 selected')
        await click('#feature-change-monster')
        expect(modal.querySelector('#feature-search-step').hidden).toBe(false)
        expect(modal.querySelector('#feature-selection-step').hidden).toBe(true)
        expect(modal.querySelector('#feature-monster-search').value).toBe('Goblin')
        expect(modal.querySelector('.search-result-info')).toBeTruthy()
        expect(modal.querySelector('#feature-selection-count').textContent).toBe('No features selected')
        expect(modal.querySelector('#import-selected-features').disabled).toBe(true)
        expect(getState().editingMonster.action || []).toEqual([])
        await click('#feature-cancel')
        expect(modal.classList.contains('active')).toBe(false)
    })

    it('renders homebrew descriptions as text rather than executable HTML', async () => {
        vi.spyOn(MonsterAPI, 'getMonster').mockResolvedValue({
            name: 'Homebrew', trait: [{ name: 'Trait', entries: ['<img src=x onerror="alert(1)">', { type: 'entries', name: 'Detail', entries: ['{@dc 12} to resist.'] }] }]
        })
        await modal.selectMonster({ name: 'Homebrew', source: 'MM' })
        expect(modal.querySelector('.feature-description img')).toBeNull()
        expect(modal.querySelector('.feature-description').textContent).toContain('<img')
        expect(modal.querySelector('.feature-description').textContent).toContain('DC 12 to resist.')
    })

    it('shows empty and error states and ignores an older monster load', async () => {
        const empty = { name: 'Empty Monster' }
        vi.spyOn(MonsterAPI, 'getMonster').mockResolvedValue(empty)
        await modal.selectMonster({ name: 'Empty', source: 'MM' })
        expect(modal.textContent).toContain('no features to import')
        expect(modal.querySelector('#import-selected-features').disabled).toBe(true)
        MonsterAPI.getMonster.mockRejectedValueOnce(new Error('Offline'))
        await modal.selectMonster({ name: 'Missing', source: 'MM' })
        expect(modal.textContent).toContain('Unable to load monster')
        let resolveOld
        MonsterAPI.getMonster.mockImplementationOnce(() => new Promise(resolve => { resolveOld = resolve }))
        const old = modal.selectMonster({ name: 'Slow', source: 'MM' })
        await modal.selectMonster({ name: 'Empty', source: 'MM' })
        resolveOld(mockMonsters.goblin)
        await old
        expect(modal.textContent).toContain('Empty Monster')
        expect(modal.querySelectorAll('input[name="feature"]')).toHaveLength(0)
    })
})
