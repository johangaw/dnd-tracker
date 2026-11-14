import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import fs from 'node:fs'
import { initApp } from '../helpers.js'
import { cacheMonster } from '../../js/services/storage.js'

let api
const read = file => JSON.parse(fs.readFileSync(`data/bestiary/${file}`, 'utf8'))

describe('Bestiary aliases', () => {
    beforeEach(async () => {
        await initApp()
        // A fresh service cache and the real bestiary reproduce the reported bug.
        vi.resetModules()
        api = await import('../../js/services/monsterApi.js')
        globalThis.fetch = vi.fn(async url => ({ ok: true, json: async () => read(String(url).split('/').at(-1)) }))
    })
    afterEach(() => { localStorage.clear(); vi.restoreAllMocks() })

    it('loads Young Winter Wolf with inherited stats and its own identity', async () => {
        const monster = await api.getMonster('Young Winter Wolf', 'TftYP')
        expect(monster).toMatchObject({ name: 'Young Winter Wolf', source: 'TftYP', page: 181,
            type: 'beast', str: 17, hp: { average: 37 }, cr: '1' })
        expect(monster.action[0].name).toBe('Bite')
        expect(monster._copy).toBeUndefined()
        const { renderStatBlock, showStatBlockByNameSource } = await import('../../js/components/modals/statBlock.js')
        expect(renderStatBlock(monster)).toContain('Pack Tactics')
        expect(renderStatBlock(monster)).not.toContain('undefined')
        await showStatBlockByNameSource('Young Winter Wolf', 'TftYP')
        expect(document.querySelector('stat-block-modal').textContent).toContain('Pack Tactics')
        const base = await api.getMonster('Dire Wolf', 'MM')
        expect(base.name).toBe('Dire Wolf')
        monster.action[0].name = 'Changed'
        expect(base.action[0].name).toBe('Bite')
    })

    it('returns inherited HP and CR from search before adding the monster to an encounter', async () => {
        const [monster] = await api.searchMonsters('Young Winter Wolf', 'TftYP')
        expect(api.getHP(monster)).toBe(37)
        expect(api.formatCR(monster.cr)).toBe('1')
        expect(monster.source).toBe('TftYP')
    })

    it('refreshes an unresolved alias left in persistent storage by an older version', async () => {
        cacheMonster('Young Winter Wolf|TftYP', { name: 'Young Winter Wolf', source: 'TftYP', _copy: { name: 'Dire Wolf', source: 'MM' } })
        expect((await api.getMonster('Young Winter Wolf', 'TftYP')).hp.average).toBe(37)
    })
})
