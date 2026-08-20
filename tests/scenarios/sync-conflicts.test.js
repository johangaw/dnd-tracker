// Conflict resolution.
//
// The rule is last-write-wins on the whole record by updatedAt, with ties going
// to the delete and then to the pusher. There is no field-level merge: two
// devices editing different fields of one encounter means one edit is dropped,
// which is a deliberate trade and is what the "updated on another device"
// count in the status is for.

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mockSyncServer, signInFake, installFetchMock } from '../helpers.js'
import { CONFIG } from '../../js/config.js'
import * as Sync from '../../js/services/sync.js'
import * as Auth from '../../js/services/auth.js'
import {
  resetForTests as resetRecords,
  readRaw,
  writeRaw,
  getDirty,
  clearDirty,
  markDirty,
  ENCOUNTERS_KEY
} from '../../js/services/records.js'
import Storage from '../../js/services/storage.js'

let server

beforeEach(() => {
  resetRecords()
  Sync.resetForTests()
  Auth.resetForTests()
  Object.assign(CONFIG, {
    region: 'eu-north-1', userPoolId: 'pool', clientId: 'client',
    cognitoDomain: 'auth.test', apiBase: 'https://api.test'
  })
  server = mockSyncServer()
  installFetchMock([server.matcher])
  signInFake()
})

afterEach(() => {
  Object.assign(CONFIG, { region: '', userPoolId: '', clientId: '', cognitoDomain: '', apiBase: '' })
})

// Puts a record into local storage in a specific dirty/clean state, bypassing
// the change detection so the test controls updatedAt exactly.
function seedLocal(record, { dirty }) {
  writeRaw(ENCOUNTERS_KEY, [{ deletedAt: null, ...record }])
  if (dirty) markDirty(ENCOUNTERS_KEY, [record.id])
  else clearDirty(ENCOUNTERS_KEY, [record.id])
}

describe('Sync conflicts', () => {
  describe('A locally edited record versus a remote one', () => {
    it('keeps the remote copy when it is newer', async () => {
      seedLocal({ id: 'e1', title: 'Local edit', updatedAt: 1000 }, { dirty: true })
      server.seed(ENCOUNTERS_KEY, { id: 'e1', title: 'Remote edit', updatedAt: 2000, sv: 10 })

      const result = await Sync.syncNow()

      expect(Storage.getEncounter('e1').title).toBe('Remote edit')
      expect(result.overwritten).toBe(1)
      expect(getDirty()[ENCOUNTERS_KEY]).toBeUndefined()
    })

    it('keeps the local copy when it is newer, and pushes it', async () => {
      seedLocal({ id: 'e1', title: 'Local edit', updatedAt: 3000 }, { dirty: true })
      server.seed(ENCOUNTERS_KEY, { id: 'e1', title: 'Remote edit', updatedAt: 2000, sv: 10 })

      const result = await Sync.syncNow()

      expect(Storage.getEncounter('e1').title).toBe('Local edit')
      expect(server.get(ENCOUNTERS_KEY, 'e1').data.title).toBe('Local edit')
      expect(result.overwritten).toBe(0)
    })

    it('gives the tie to the pusher when timestamps are identical', async () => {
      seedLocal({ id: 'e1', title: 'Local edit', updatedAt: 2000 }, { dirty: true })
      server.seed(ENCOUNTERS_KEY, { id: 'e1', title: 'Remote edit', updatedAt: 2000, sv: 10 })

      await Sync.syncNow()

      expect(Storage.getEncounter('e1').title).toBe('Local edit')
    })
  })

  describe('Deletes', () => {
    it('lets a remote delete win over an older local edit', async () => {
      seedLocal({ id: 'e1', title: 'Local edit', updatedAt: 1000 }, { dirty: true })
      server.seed(ENCOUNTERS_KEY, { id: 'e1', updatedAt: 2000, deletedAt: 2000, sv: 10 })

      await Sync.syncNow()

      expect(Storage.getEncounters()).toEqual([])
    })

    it('lets a newer local edit win over an older remote delete', async () => {
      seedLocal({ id: 'e1', title: 'Local edit', updatedAt: 3000 }, { dirty: true })
      server.seed(ENCOUNTERS_KEY, { id: 'e1', updatedAt: 2000, deletedAt: 2000, sv: 10 })

      await Sync.syncNow()

      expect(Storage.getEncounter('e1').title).toBe('Local edit')
      expect(server.get(ENCOUNTERS_KEY, 'e1').deletedAt).toBeNull()
    })

    it('gives a tie to the delete rather than resurrecting the record', async () => {
      seedLocal({ id: 'e1', title: 'Local edit', updatedAt: 2000 }, { dirty: true })
      server.seed(ENCOUNTERS_KEY, { id: 'e1', updatedAt: 2000, deletedAt: 2000, sv: 10 })

      await Sync.syncNow()

      expect(Storage.getEncounters()).toEqual([])
    })

    it('does not resurrect a record deleted locally while it is still on the server', async () => {
      Storage.saveEncounter({ id: 'e1', title: 'Crypt', pcs: [], monsters: [] })
      await Sync.syncNow()

      Storage.deleteEncounter('e1')
      await Sync.syncNow()
      // A later sync pulls the tombstone back down; it must stay deleted.
      await Sync.syncNow()

      expect(Storage.getEncounters()).toEqual([])
    })
  })

  describe('Rejected pushes', () => {
    it('adopts the server copy when the server refuses a stale write', async () => {
      // The server got a newer write between this device's pull and its push.
      seedLocal({ id: 'e1', title: 'Local edit', updatedAt: 1000 }, { dirty: true })
      server.seed(ENCOUNTERS_KEY, { id: 'e1', title: 'Newer on server', updatedAt: 5000, sv: 0 })

      const result = await Sync.syncNow()

      expect(Storage.getEncounter('e1').title).toBe('Newer on server')
      expect(getDirty()[ENCOUNTERS_KEY]).toBeUndefined()
      expect(result.overwritten).toBeGreaterThan(0)
    })

    it('leaves nothing dirty afterwards, so sync does not loop forever', async () => {
      seedLocal({ id: 'e1', title: 'Local edit', updatedAt: 1000 }, { dirty: true })
      server.seed(ENCOUNTERS_KEY, { id: 'e1', title: 'Newer', updatedAt: 5000, sv: 0 })

      await Sync.syncNow()
      const pushesAfterFirst = server.pushCalls.length
      await Sync.syncNow()

      expect(server.pushCalls.length).toBe(pushesAfterFirst)
    })
  })

  describe('Convergence', () => {
    it('leaves both devices holding the same record', async () => {
      seedLocal({ id: 'e1', title: 'Device A', updatedAt: 3000 }, { dirty: true })
      server.seed(ENCOUNTERS_KEY, { id: 'e1', title: 'Device B', updatedAt: 2000, sv: 10 })

      await Sync.syncNow()

      const local = Storage.getEncounter('e1')
      const remote = server.get(ENCOUNTERS_KEY, 'e1')
      expect(local.title).toBe(remote.data.title)
      expect(local.updatedAt).toBe(remote.updatedAt)
    })

    it('is stable when run repeatedly with no changes', async () => {
      seedLocal({ id: 'e1', title: 'Crypt', updatedAt: 1000 }, { dirty: true })

      await Sync.syncNow()
      const afterFirst = readRaw(ENCOUNTERS_KEY)
      await Sync.syncNow()
      await Sync.syncNow()

      // Compared by value, not by serialised form: a record that has been round
      // tripped through the server comes back with its keys in a different
      // order, which the records layer deliberately treats as unchanged.
      expect(readRaw(ENCOUNTERS_KEY)).toEqual(afterFirst)
      expect(getDirty()[ENCOUNTERS_KEY]).toBeUndefined()
    })
  })

  describe('Account switching', () => {
    it('refuses to sync unsynced data into a different account', async () => {
      localStorage.setItem('dnd-sync-state', JSON.stringify({ ownerSub: 'first-user', cursor: 0 }))
      seedLocal({ id: 'e1', title: 'Belongs to the first user', updatedAt: 1000 }, { dirty: true })
      signInFake({ sub: 'second-user', email: 'other@example.com' })

      await expect(Sync.syncNow()).rejects.toThrow(/different account/)
      expect(server.pushCalls).toHaveLength(0)
      // Local data must survive the refusal untouched.
      expect(Storage.getEncounter('e1').title).toBe('Belongs to the first user')
    })

    it('allows a different account when there is nothing unsynced', async () => {
      localStorage.setItem('dnd-sync-state', JSON.stringify({ ownerSub: 'first-user', cursor: 0 }))
      signInFake({ sub: 'second-user' })

      await expect(Sync.syncNow()).resolves.toBeTruthy()
    })
  })
})
