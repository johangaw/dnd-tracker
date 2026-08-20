// The sync round trip: pulling remote changes down and pushing local ones up.

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mockSyncServer, signInFake, installFetchMock } from '../helpers.js'
import { CONFIG } from '../../js/config.js'
import * as Sync from '../../js/services/sync.js'
import * as Auth from '../../js/services/auth.js'
import {
  resetForTests as resetRecords,
  readRaw,
  getDirty,
  clearDirty,
  ENCOUNTERS_KEY
} from '../../js/services/records.js'
import Storage from '../../js/services/storage.js'
import CustomMonsters from '../../js/services/customMonsters.js'

let server

function configureSync() {
  Object.assign(CONFIG, {
    region: 'eu-north-1',
    userPoolId: 'eu-north-1_test',
    clientId: 'test-client',
    cognitoDomain: 'auth.test',
    apiBase: 'https://api.test'
  })
}

function unconfigureSync() {
  Object.assign(CONFIG, { region: '', userPoolId: '', clientId: '', cognitoDomain: '', apiBase: '' })
}

beforeEach(() => {
  resetRecords()
  Sync.resetForTests()
  Auth.resetForTests()
  configureSync()
  server = mockSyncServer()
  installFetchMock([server.matcher])
  signInFake()
})

afterEach(() => {
  unconfigureSync()
})

describe('Sync', () => {
  describe('Enablement', () => {
    it('is enabled when configured and signed in', () => {
      expect(Sync.isEnabled()).toBe(true)
    })

    it('is disabled when signed out', () => {
      localStorage.removeItem('dnd-auth')
      expect(Sync.isEnabled()).toBe(false)
    })

    it('is disabled when the backend is not configured', () => {
      unconfigureSync()
      expect(Sync.isEnabled()).toBe(false)
    })

    it('does nothing at all when disabled', async () => {
      localStorage.removeItem('dnd-auth')
      const result = await Sync.syncNow()

      expect(result).toEqual({ skipped: true })
      expect(server.pullCalls).toHaveLength(0)
      expect(server.pushCalls).toHaveLength(0)
    })
  })

  describe('Pull', () => {
    it('brings down a record created on another device', async () => {
      server.seed(ENCOUNTERS_KEY, {
        id: 'e-remote', title: 'Crypt', pcs: [], monsters: [], updatedAt: 1000, sv: 1
      })

      await Sync.syncNow()

      const encounter = Storage.getEncounter('e-remote')
      expect(encounter.title).toBe('Crypt')
      expect(encounter.updatedAt).toBe(1000)
    })

    it('applies a remote deletion instead of resurrecting the record', async () => {
      Storage.saveEncounter({ id: 'e1', title: 'Crypt', pcs: [], monsters: [] })
      clearDirty(ENCOUNTERS_KEY, ['e1'])
      server.seed(ENCOUNTERS_KEY, { id: 'e1', updatedAt: 9999, deletedAt: 9999, sv: 5 })

      await Sync.syncNow()

      expect(Storage.getEncounters()).toEqual([])
      expect(readRaw(ENCOUNTERS_KEY)[0].deletedAt).toBe(9999)
    })

    it('overwrites a clean local record, which is only a cached copy', async () => {
      Storage.saveEncounter({ id: 'e1', title: 'Stale', pcs: [], monsters: [] })
      clearDirty(ENCOUNTERS_KEY, ['e1'])
      // Deliberately older than the local copy: a clean record still loses,
      // because the server is authoritative for anything not edited here.
      server.seed(ENCOUNTERS_KEY, { id: 'e1', title: 'From server', pcs: [], monsters: [], updatedAt: 1, sv: 3 })

      await Sync.syncNow()

      expect(Storage.getEncounter('e1').title).toBe('From server')
    })

    it('does not mark pulled records dirty', async () => {
      server.seed(ENCOUNTERS_KEY, { id: 'e-remote', title: 'Crypt', updatedAt: 1000, sv: 1 })

      await Sync.syncNow()

      expect(getDirty()[ENCOUNTERS_KEY] ?? []).toEqual([])
      expect(server.pushCalls).toHaveLength(0)
    })

    it('ignores collections it does not recognise', async () => {
      server.seed('dnd-something-new', { id: 'x', updatedAt: 1, sv: 1 })

      await expect(Sync.syncNow()).resolves.toBeTruthy()
      expect(localStorage.getItem('dnd-something-new')).toBeNull()
    })

    it('sends the stored cursor on the next sync', async () => {
      server.seed(ENCOUNTERS_KEY, { id: 'e1', title: 'Crypt', updatedAt: 1, sv: 42 })

      await Sync.syncNow()
      await Sync.syncNow()

      expect(server.pullCalls[0].cursor).toBe(0)
      expect(server.pullCalls[1].cursor).toBe(42)
    })

    it('does not re-apply records it has already seen', async () => {
      server.seed(ENCOUNTERS_KEY, { id: 'e1', title: 'Crypt', updatedAt: 1, sv: 7 })
      await Sync.syncNow()

      Storage.saveEncounter({ ...Storage.getEncounter('e1'), title: 'Edited locally' })
      await Sync.syncNow()

      expect(Storage.getEncounter('e1').title).toBe('Edited locally')
    })
  })

  describe('Push', () => {
    it('uploads a locally created encounter', async () => {
      Storage.saveEncounter({ id: 'e1', title: 'Crypt', pcs: [], monsters: [] })

      await Sync.syncNow()

      expect(server.get(ENCOUNTERS_KEY, 'e1').data.title).toBe('Crypt')
    })

    it('clears the dirty flag once the server accepts it', async () => {
      Storage.saveEncounter({ id: 'e1', title: 'Crypt', pcs: [], monsters: [] })
      expect(getDirty()[ENCOUNTERS_KEY]).toEqual(['e1'])

      await Sync.syncNow()

      expect(getDirty()[ENCOUNTERS_KEY]).toBeUndefined()
    })

    it('sends only dirty records', async () => {
      Storage.saveEncounter({ id: 'e1', title: 'One', pcs: [], monsters: [] })
      Storage.saveEncounter({ id: 'e2', title: 'Two', pcs: [], monsters: [] })
      await Sync.syncNow()

      Storage.saveEncounter({ ...Storage.getEncounter('e1'), title: 'One edited' })
      await Sync.syncNow()

      const lastPush = server.pushCalls.at(-1)
      expect(lastPush.records.map(r => r.id)).toEqual(['e1'])
    })

    it('pushes a deletion as a tombstone', async () => {
      Storage.saveEncounter({ id: 'e1', title: 'Crypt', pcs: [], monsters: [] })
      await Sync.syncNow()

      Storage.deleteEncounter('e1')
      await Sync.syncNow()

      const stored = server.get(ENCOUNTERS_KEY, 'e1')
      expect(stored.deletedAt).toBeGreaterThan(0)
      expect(stored.data).toBeNull()
    })

    it('syncs custom monsters and folders, but never the monster cache', async () => {
      const monster = CustomMonsters.createEmptyMonster()
      monster.name = 'Bone Knight'
      CustomMonsters.saveCustomMonster(monster)
      localStorage.setItem('dnd-monster-cache', JSON.stringify({ 'Goblin|MM': { name: 'Goblin' } }))

      await Sync.syncNow()

      const collections = new Set(server.all().map(r => r.col))
      expect(collections.has('dnd-custom-monsters')).toBe(true)
      expect(collections.has('dnd-monster-cache')).toBe(false)
    })

    it('splits more than one batch worth of records across requests', async () => {
      for (let i = 0; i < 30; i++) {
        Storage.saveEncounter({ id: `e${i}`, title: `Encounter ${i}`, pcs: [], monsters: [] })
      }

      await Sync.syncNow()

      expect(server.pushCalls.length).toBeGreaterThan(1)
      expect(server.pushCalls.every(call => call.records.length <= 25)).toBe(true)
      expect(server.all().filter(r => r.col === ENCOUNTERS_KEY)).toHaveLength(30)
    })

    it('does not send anything when there is nothing to send', async () => {
      await Sync.syncNow()
      expect(server.pushCalls).toHaveLength(0)
    })
  })

  describe('Round trip between two devices', () => {
    it('carries an edit from one device to the other', async () => {
      // Device one creates and pushes.
      Storage.saveEncounter({ id: 'e1', title: 'Crypt', pcs: [], monsters: [] })
      await Sync.syncNow()

      // Device two: same server, empty local storage.
      const encounters = localStorage.getItem('dnd-encounters')
      localStorage.removeItem('dnd-encounters')
      localStorage.removeItem('dnd-sync-state')
      localStorage.removeItem('dnd-sync-dirty')
      resetRecords()
      Sync.resetForTests()

      await Sync.syncNow()

      expect(Storage.getEncounter('e1').title).toBe('Crypt')
      expect(encounters).toBeTruthy()
    })
  })

  describe('Concurrency', () => {
    it('coalesces overlapping syncs into one', async () => {
      Storage.saveEncounter({ id: 'e1', title: 'Crypt', pcs: [], monsters: [] })

      await Promise.all([Sync.syncNow(), Sync.syncNow(), Sync.syncNow()])

      expect(server.pullCalls).toHaveLength(1)
    })
  })
})
