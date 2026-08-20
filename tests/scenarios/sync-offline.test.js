// Sync is additive. With no network, no account, or no backend configured, the
// app has to behave exactly as it did before any of this existed.

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mockSyncServer, signInFake, installFetchMock, initApp, click, tick } from '../helpers.js'
import { CONFIG } from '../../js/config.js'
import * as Sync from '../../js/services/sync.js'
import * as Auth from '../../js/services/auth.js'
import {
  resetForTests as resetRecords,
  getDirty,
  readRaw,
  ENCOUNTERS_KEY
} from '../../js/services/records.js'
import Storage from '../../js/services/storage.js'
import CustomMonsters from '../../js/services/customMonsters.js'
import { MonsterFolders } from '../../js/services/folders.js'

const CONFIGURED = {
  region: 'eu-north-1', userPoolId: 'pool', clientId: 'client',
  cognitoDomain: 'auth.test', apiBase: 'https://api.test'
}
const BLANK = { region: '', userPoolId: '', clientId: '', cognitoDomain: '', apiBase: '' }

beforeEach(() => {
  resetRecords()
  Sync.resetForTests()
  Auth.resetForTests()
})

afterEach(() => {
  Object.assign(CONFIG, BLANK)
})

describe('Working without sync', () => {
  describe('No backend configured', () => {
    beforeEach(() => {
      Object.assign(CONFIG, BLANK)
      installFetchMock()
    })

    it('reports sync as unavailable', () => {
      expect(Sync.isEnabled()).toBe(false)
      expect(Auth.canSignIn()).toBe(false)
    })

    it('does not start syncing on init', () => {
      let fetched = false
      const spy = globalThis.fetch
      globalThis.fetch = async (...args) => { fetched = true; return spy(...args) }

      Sync.initSync()

      expect(fetched).toBe(false)
    })

    it('still creates, edits and deletes encounters', () => {
      Storage.saveEncounter({ id: 'e1', title: 'Crypt', pcs: [], monsters: [] })
      expect(Storage.getEncounter('e1').title).toBe('Crypt')

      Storage.saveEncounter({ ...Storage.getEncounter('e1'), title: 'Renamed' })
      expect(Storage.getEncounter('e1').title).toBe('Renamed')

      Storage.deleteEncounter('e1')
      expect(Storage.getEncounters()).toEqual([])
    })

    it('still creates custom monsters and folders', () => {
      const monster = CustomMonsters.createEmptyMonster()
      monster.name = 'Bone Knight'
      CustomMonsters.saveCustomMonster(monster)
      const folder = MonsterFolders.createFolder('Undead')

      expect(CustomMonsters.getCustomMonster(monster.id).name).toBe('Bone Knight')
      expect(MonsterFolders.getFolders()).toHaveLength(1)
      expect(folder.name).toBe('Undead')
    })

    it('loads the app and renders the encounter list', async () => {
      await initApp()
      expect(document.querySelector('#encounter-list-view').classList.contains('active')).toBe(true)
    })
  })

  describe('Configured but signed out', () => {
    beforeEach(() => {
      Object.assign(CONFIG, CONFIGURED)
      localStorage.removeItem('dnd-auth')
      installFetchMock([mockSyncServer().matcher])
    })

    it('reports sync as disabled', () => {
      expect(Sync.isEnabled()).toBe(false)
    })

    it('skips syncing rather than failing', async () => {
      await expect(Sync.syncNow()).resolves.toEqual({ skipped: true })
    })

    it('still records local changes, ready for a later sign-in', () => {
      Storage.saveEncounter({ id: 'e1', title: 'Crypt', pcs: [], monsters: [] })
      expect(getDirty()[ENCOUNTERS_KEY]).toEqual(['e1'])
    })

    it('does not schedule a sync on change', async () => {
      const server = mockSyncServer()
      installFetchMock([server.matcher])
      Sync.initSync()

      Storage.saveEncounter({ id: 'e1', title: 'Crypt', pcs: [], monsters: [] })
      await new Promise(resolve => setTimeout(resolve, 50))

      expect(server.pushCalls).toHaveLength(0)
    })
  })

  describe('Signed in but the network is down', () => {
    let server

    beforeEach(() => {
      Object.assign(CONFIG, CONFIGURED)
      server = mockSyncServer()
      installFetchMock([server.matcher])
      signInFake()
    })

    it('leaves local data intact when a sync fails', async () => {
      Storage.saveEncounter({ id: 'e1', title: 'Crypt', pcs: [], monsters: [] })
      server.failNextWith = 'network'

      await expect(Sync.syncNow()).rejects.toThrow()

      expect(Storage.getEncounter('e1').title).toBe('Crypt')
    })

    it('keeps unsent changes dirty so they go out next time', async () => {
      Storage.saveEncounter({ id: 'e1', title: 'Crypt', pcs: [], monsters: [] })
      server.failNextWith = 'network'
      await expect(Sync.syncNow()).rejects.toThrow()

      expect(getDirty()[ENCOUNTERS_KEY]).toEqual(['e1'])

      // Network comes back.
      await Sync.syncNow()

      expect(getDirty()[ENCOUNTERS_KEY]).toBeUndefined()
      expect(server.get(ENCOUNTERS_KEY, 'e1').data.title).toBe('Crypt')
    })

    it('does not advance the cursor on a failed pull', async () => {
      server.seed(ENCOUNTERS_KEY, { id: 'e1', title: 'Crypt', updatedAt: 1, sv: 99 })
      server.failNextWith = 'network'
      await expect(Sync.syncNow()).rejects.toThrow()

      expect(Sync.getState().cursor ?? 0).toBe(0)

      await Sync.syncNow()
      expect(Sync.getState().cursor).toBe(99)
    })

    it('surfaces an error status rather than throwing into the app', async () => {
      const seen = []
      Sync.onStatusChange(status => seen.push(status))

      server.failNextWith = 500
      await expect(Sync.syncNow()).rejects.toThrow()

      expect(seen).toContain('syncing')
      expect(seen.at(-1)).toBe('error')
    })

    it('recovers to idle on the next successful sync', async () => {
      server.failNextWith = 500
      await expect(Sync.syncNow()).rejects.toThrow()

      await Sync.syncNow()

      expect(Sync.getStatus()).toBe('idle')
    })

    it('keeps working offline for a whole edit session, then converges', async () => {
      // Three edits while offline.
      server.failNextWith = 'network'
      Storage.saveEncounter({ id: 'e1', title: 'One', pcs: [], monsters: [] })
      await expect(Sync.syncNow()).rejects.toThrow()

      Storage.saveEncounter({ id: 'e2', title: 'Two', pcs: [], monsters: [] })
      Storage.saveEncounter({ id: 'e1', title: 'One edited', pcs: [], monsters: [] })
      Storage.deleteEncounter('e2')

      await Sync.syncNow()

      expect(server.get(ENCOUNTERS_KEY, 'e1').data.title).toBe('One edited')
      expect(server.get(ENCOUNTERS_KEY, 'e2').deletedAt).toBeGreaterThan(0)
      expect(readRaw(ENCOUNTERS_KEY).filter(r => !r.deletedAt)).toHaveLength(1)
    })
  })

  describe('Signing in on a device that already has data', () => {
    it('uploads everything that was created before signing in', async () => {
      Object.assign(CONFIG, CONFIGURED)
      const server = mockSyncServer()
      installFetchMock([server.matcher])

      // Created while signed out.
      Storage.saveEncounter({ id: 'e1', title: 'Made offline', pcs: [], monsters: [] })
      const monster = CustomMonsters.createEmptyMonster()
      monster.name = 'Bone Knight'
      CustomMonsters.saveCustomMonster(monster)

      signInFake()
      await Sync.syncNow()

      expect(server.get(ENCOUNTERS_KEY, 'e1').data.title).toBe('Made offline')
      expect(server.get('dnd-custom-monsters', monster.id).data.name).toBe('Bone Knight')
    })
  })
})
