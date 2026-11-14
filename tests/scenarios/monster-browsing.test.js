import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { initApp, click, type, clearAndType, tick } from '../helpers.js'
import * as CustomMonsters from '../../js/services/customMonsters.js'
import { getState } from '../../js/services/state.js'
import { searchMonsters } from '../../js/components/modals/monsterSearchModal.js'
import * as MonsterAPI from '../../js/services/monsterApi.js'

async function filter(selector, value) {
    const select = document.querySelector(selector)
    select.value = value
    select.dispatchEvent(new Event('change'))
    await tick()
}
const names = selector => [...document.querySelectorAll(`${selector} .monster-name`)].map(el => el.textContent)
async function encounterSearch() {
    await click('#new-encounter-btn')
    await click('#encounter-choice-create-new')
    await click('#add-monster-btn')
}

describe('Browsing monster lists without a query', () => {
    beforeEach(async () => {
        await initApp()
        for (const name of ['Custom Goblin', 'Custom Wolf']) {
            const monster = CustomMonsters.createEmptyMonster()
            monster.name = name
            CustomMonsters.saveCustomMonster(monster)
        }
    })
    afterEach(() => { localStorage.clear(); vi.restoreAllMocks() })

    it('shows all custom monsters on filter selection and reopening, and can add one', async () => {
        await encounterSearch()
        await filter('#monster-source-filter', 'Custom')
        expect(names('#monster-search-results')).toEqual(['Custom Goblin', 'Custom Wolf'])
        await click('#monster-search-results .search-result-info')
        expect(getState().editingEncounter.monsters[0].name).toBe('Custom Goblin')
        await click('#add-monster-btn')
        expect(names('#monster-search-results')).toHaveLength(2)
    })

    it('filters custom monsters with one character and restores the list when cleared', async () => {
        await encounterSearch()
        await filter('#monster-source-filter', 'Custom')
        await type('#monster-search-input', 'w')
        await tick(350)
        expect(names('#monster-search-results')).toEqual(['Custom Wolf'])
        await clearAndType('#monster-search-input', '')
        await tick(350)
        expect(names('#monster-search-results')).toHaveLength(2)
        await filter('#monster-source-filter', 'ALL')
        expect(names('#monster-search-results')).toHaveLength(0)
        expect(document.querySelector('#monster-search-results').textContent).toContain('Type at least 2')
    })

    it('reports an empty custom collection without requiring a query', async () => {
        CustomMonsters.saveCustomMonsters([])
        await encounterSearch()
        await filter('#monster-source-filter', 'Custom')
        expect(document.querySelector('#monster-search-results').textContent).toBe('No monsters found')
    })

    it('browses custom monsters in combat, opens their stats, and adds the chosen quantity', async () => {
        getState().combatState = { combatants: [], started: false }
        const run = document.querySelector('encounter-run-view')
        run.showCombatMonsterSearch()
        await filter('#combat-monster-source-filter', 'Custom')
        expect(names('#combat-monster-search-results')).toHaveLength(2)
        await click('#combat-monster-search-results .view-stats-btn')
        expect(document.querySelector('stat-block-modal').textContent).toContain('Custom Goblin')
        await click('stat-block-modal .close-modal')
        await click('#qty-increase')
        await click('#combat-monster-search-results .search-result-info')
        expect(getState().combatState.combatants[0].instances).toHaveLength(2)
        run.showCombatMonsterSearch()
        expect(names('#combat-monster-search-results')).toHaveLength(2)
    })

    it('browses custom baselines and can select one without typing', async () => {
        await click('#menu-btn')
        await click('#menu-custom-monsters')
        await click('#new-custom-monster-btn')
        await click('#choice-from-existing')
        await filter('#baseline-source-filter', 'Custom')
        expect(names('#baseline-search-results')).toHaveLength(2)
        await click('#baseline-search-results .search-result-info')
        expect(document.querySelector('#custom-monster-form').textContent).toContain('Preview')
        expect(document.querySelector('#baseline-search-modal').classList.contains('active')).toBe(false)
    })

    it('does not let an older search overwrite the newly selected filter', async () => {
        let finish
        vi.spyOn(MonsterAPI, 'searchMonsters').mockImplementation(() => new Promise(resolve => { finish = resolve }))
        const container = document.querySelector('#monster-search-results')
        const old = searchMonsters({ query: 'gob', source: 'MM', container })
        await searchMonsters({ query: '', source: 'Custom', container })
        finish([{ name: 'Old result', source: 'MM' }])
        await old
        expect(names('#monster-search-results')).toEqual(['Custom Goblin', 'Custom Wolf'])
    })

    it('browses complete selected sources up to 100 entries and requires a query for larger sources', async () => {
        vi.resetModules()
        const api = await import('../../js/services/monsterApi.js')
        globalThis.fetch = vi.fn(async url => ({ ok: true, json: async () => {
            if (url.endsWith('index.json')) return { MM: 'mm.json', XMM: 'xmm.json' }
            const count = url.endsWith('/mm.json') ? 100 : 101
            return { monster: Array.from({ length: count }, (_, i) => ({ name: `Monster ${i}` })) }
        } }))
        expect(await api.searchMonsters('', 'MM')).toHaveLength(100)
        expect(await api.searchMonsters('', 'XMM')).toEqual([])
        expect(await api.searchMonsters('', 'ALL')).toEqual([])
        expect(await api.searchMonsters('', '')).toEqual([])
        expect(await api.searchMonsters('Monster', 'XMM')).toHaveLength(100)
    })
})
