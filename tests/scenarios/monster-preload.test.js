import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { initApp } from '../helpers.js'
import * as startupAPI from '../../js/services/monsterApi.js'

let api
const json = data => ({ ok: true, json: async () => data })
const sourceData = { monster: [{ name: 'Goblin', hp: { average: 7 }, cr: '1/4' }] }
const index = { MM: 'bestiary-mm.json', XMM: 'bestiary-xmm.json' }

describe('Monster preloading', () => {
    beforeEach(async () => {
        await initApp()
        vi.resetModules()
        api = await import('../../js/services/monsterApi.js')
    })
    afterEach(() => { localStorage.clear(); vi.restoreAllMocks() })

    it('starts preloading on app initialization', async () => {
        const preload = vi.spyOn(startupAPI, 'preloadMonsters').mockResolvedValue()
        await initApp()
        expect(preload).toHaveBeenCalledOnce()
        expect(document.querySelector('encounter-list-view')).not.toBeNull()
    })

    it('shares in-flight index and source downloads with search and reuses the warm cache', async () => {
        let release
        const gate = new Promise(resolve => { release = resolve })
        const fetch = vi.fn(async url => {
            if (url.endsWith('index.json')) return json(index)
            await gate
            return json(structuredClone(sourceData))
        })
        globalThis.fetch = fetch
        const preload = api.preloadMonsters()
        const search = api.searchMonsters('gob', 'MM')
        await vi.waitFor(() => expect(fetch.mock.calls.some(([url]) => url.endsWith('bestiary-mm.json'))).toBe(true))
        release()
        await preload
        expect(await search).toHaveLength(1)
        await api.searchMonsters('gob', 'MM')
        expect(fetch.mock.calls.filter(([url]) => url.endsWith('index.json'))).toHaveLength(1)
        expect(fetch.mock.calls.filter(([url]) => url.endsWith('bestiary-mm.json'))).toHaveLength(1)
        expect(fetch.mock.calls.filter(([url]) => url.endsWith('bestiary-xmm.json'))).toHaveLength(1)
    })

    it('limits background downloads to six at a time', async () => {
        const sources = api.default.AVAILABLE_SOURCES
        const all = Object.fromEntries(sources.map(source => [source, `${source}.json`]))
        let active = 0, peak = 0
        globalThis.fetch = vi.fn(async url => {
            if (url.endsWith('index.json')) return json(all)
            active++
            peak = Math.max(peak, active)
            await new Promise(resolve => setTimeout(resolve, 1))
            active--
            return json({ monster: [] })
        })
        await api.preloadMonsters()
        expect(peak).toBeGreaterThan(1)
        expect(peak).toBeLessThanOrEqual(6)
        expect(globalThis.fetch).toHaveBeenCalledTimes(sources.length + 1)
    })

    it('retries a failed source when searched instead of caching its failure', async () => {
        vi.spyOn(console, 'error').mockImplementation(() => {})
        let failed = false
        globalThis.fetch = vi.fn(async url => {
            if (url.endsWith('index.json')) return json(index)
            if (url.endsWith('bestiary-mm.json') && !failed) {
                failed = true
                return { ok: false, status: 503 }
            }
            return json(structuredClone(sourceData))
        })
        await api.preloadMonsters()
        expect(await api.searchMonsters('gob', 'MM')).toHaveLength(1)
        expect(globalThis.fetch.mock.calls.filter(([url]) => url.endsWith('bestiary-mm.json'))).toHaveLength(2)
    })
})
