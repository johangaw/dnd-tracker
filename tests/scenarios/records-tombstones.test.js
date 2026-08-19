// The records layer: change detection, tombstones, and dirty tracking.
//
// These are the primitives sync is built on. A deleted record has to leave a
// tombstone behind, otherwise the next pull from another device would see a
// record the server still knows about and resurrect it. And a save that changed
// nothing must not bump updatedAt, or every load would look like an edit and
// win conflicts it should lose.

import { describe, it, expect, beforeEach } from 'vitest'
import {
  readCollection,
  writeCollection,
  readRaw,
  getDirty,
  clearDirty,
  hasDirty,
  onChange,
  setClockOffset,
  resetForTests as resetRecords,
  ENCOUNTERS_KEY
} from '../../js/services/records.js'
import Storage from '../../js/services/storage.js'
import CustomMonsters from '../../js/services/customMonsters.js'
import * as Characters from '../../js/services/characters.js'
import { MonsterFolders } from '../../js/services/folders.js'
import { isUuid } from '../../js/utils/uuid.js'

describe('Records layer', () => {
  beforeEach(() => {
    resetRecords()
  })

  describe('Change detection', () => {
    it('stamps updatedAt on a new record', () => {
      writeCollection(ENCOUNTERS_KEY, [{ id: 'a', title: 'Crypt' }])
      expect(readCollection(ENCOUNTERS_KEY)[0].updatedAt).toBeGreaterThan(0)
    })

    it('assigns an id to a record that arrives without one', () => {
      writeCollection(ENCOUNTERS_KEY, [{ title: 'Nameless' }])
      expect(isUuid(readCollection(ENCOUNTERS_KEY)[0].id)).toBe(true)
    })

    it('leaves updatedAt alone when a save changes nothing', () => {
      writeCollection(ENCOUNTERS_KEY, [{ id: 'a', title: 'Crypt' }])
      const before = readCollection(ENCOUNTERS_KEY)[0].updatedAt

      setClockOffset(60000) // any re-stamp would be obvious
      writeCollection(ENCOUNTERS_KEY, readCollection(ENCOUNTERS_KEY))

      expect(readCollection(ENCOUNTERS_KEY)[0].updatedAt).toBe(before)
    })

    it('bumps updatedAt on a real edit', () => {
      writeCollection(ENCOUNTERS_KEY, [{ id: 'a', title: 'Crypt' }])
      const before = readCollection(ENCOUNTERS_KEY)[0].updatedAt

      setClockOffset(60000)
      writeCollection(ENCOUNTERS_KEY, [{ id: 'a', title: 'Crypt of the Sun' }])

      expect(readCollection(ENCOUNTERS_KEY)[0].updatedAt).toBeGreaterThan(before)
    })

    it('does not treat a reordered object as an edit', () => {
      writeCollection(ENCOUNTERS_KEY, [{ id: 'a', title: 'Crypt', description: 'dark' }])
      const before = readCollection(ENCOUNTERS_KEY)[0].updatedAt

      setClockOffset(60000)
      // Same data, different key order - as happens after a round trip
      // through JSON on the server.
      writeCollection(ENCOUNTERS_KEY, [{ description: 'dark', title: 'Crypt', id: 'a', updatedAt: before }])

      expect(readCollection(ENCOUNTERS_KEY)[0].updatedAt).toBe(before)
    })

    it('only touches the record that actually changed', () => {
      writeCollection(ENCOUNTERS_KEY, [{ id: 'a', title: 'One' }, { id: 'b', title: 'Two' }])
      const [a, b] = readCollection(ENCOUNTERS_KEY)

      setClockOffset(60000)
      writeCollection(ENCOUNTERS_KEY, [{ ...a, title: 'One Edited' }, b])

      const after = readCollection(ENCOUNTERS_KEY)
      expect(after.find(e => e.id === 'a').updatedAt).toBeGreaterThan(a.updatedAt)
      expect(after.find(e => e.id === 'b').updatedAt).toBe(b.updatedAt)
    })
  })

  describe('Tombstones', () => {
    it('leaves a tombstone when a record is removed', () => {
      writeCollection(ENCOUNTERS_KEY, [{ id: 'a', title: 'Crypt' }])
      writeCollection(ENCOUNTERS_KEY, [])

      const raw = readRaw(ENCOUNTERS_KEY)
      expect(raw).toHaveLength(1)
      expect(raw[0].id).toBe('a')
      expect(raw[0].deletedAt).toBeGreaterThan(0)
    })

    it('hides tombstones from normal reads', () => {
      writeCollection(ENCOUNTERS_KEY, [{ id: 'a', title: 'Crypt' }])
      writeCollection(ENCOUNTERS_KEY, [])
      expect(readCollection(ENCOUNTERS_KEY)).toEqual([])
    })

    it('carries existing tombstones forward without re-stamping them', () => {
      writeCollection(ENCOUNTERS_KEY, [{ id: 'a', title: 'Crypt' }])
      writeCollection(ENCOUNTERS_KEY, [])
      const buried = readRaw(ENCOUNTERS_KEY)[0].deletedAt

      setClockOffset(60000)
      writeCollection(ENCOUNTERS_KEY, [{ id: 'b', title: 'Other' }])

      const tombstone = readRaw(ENCOUNTERS_KEY).find(r => r.id === 'a')
      expect(tombstone.deletedAt).toBe(buried)
    })

    it('revives a record when an id comes back after being deleted', () => {
      writeCollection(ENCOUNTERS_KEY, [{ id: 'a', title: 'Crypt' }])
      writeCollection(ENCOUNTERS_KEY, [])

      setClockOffset(60000)
      writeCollection(ENCOUNTERS_KEY, [{ id: 'a', title: 'Crypt' }])

      const raw = readRaw(ENCOUNTERS_KEY)
      expect(raw).toHaveLength(1)
      expect(raw[0].deletedAt).toBeNull()
      expect(readCollection(ENCOUNTERS_KEY)).toHaveLength(1)
    })
  })

  describe('Dirty tracking', () => {
    it('marks changed records dirty and leaves untouched ones clean', () => {
      writeCollection(ENCOUNTERS_KEY, [{ id: 'a', title: 'One' }, { id: 'b', title: 'Two' }])
      clearDirty(ENCOUNTERS_KEY, ['a', 'b'])
      expect(hasDirty()).toBe(false)

      writeCollection(ENCOUNTERS_KEY, [{ id: 'a', title: 'Changed' }, { id: 'b', title: 'Two', updatedAt: readCollection(ENCOUNTERS_KEY)[1].updatedAt }])

      expect(getDirty()[ENCOUNTERS_KEY]).toEqual(['a'])
    })

    it('marks a deleted record dirty so the deletion gets pushed', () => {
      writeCollection(ENCOUNTERS_KEY, [{ id: 'a', title: 'One' }])
      clearDirty(ENCOUNTERS_KEY, ['a'])

      writeCollection(ENCOUNTERS_KEY, [])

      expect(getDirty()[ENCOUNTERS_KEY]).toEqual(['a'])
    })

    it('notifies a listener when data changes, so sync can be scheduled', () => {
      const calls = []
      onChange((key, ids) => calls.push([key, ids]))

      writeCollection(ENCOUNTERS_KEY, [{ id: 'a', title: 'One' }])
      expect(calls).toEqual([[ENCOUNTERS_KEY, ['a']]])

      // A no-op save should not wake sync up.
      writeCollection(ENCOUNTERS_KEY, readCollection(ENCOUNTERS_KEY))
      expect(calls).toHaveLength(1)
    })
  })

  // The migration runs once. Anything that mints an id afterwards must produce
  // a UUID directly, or it writes a legacy id that will never be migrated and
  // can collide with a record created on another device.
  describe('Every path that mints an id produces a UUID', () => {
    it('when creating records from scratch', () => {
      expect(isUuid(Characters.createEmptyCharacter().id)).toBe(true)
      expect(isUuid(CustomMonsters.createEmptyMonster().id)).toBe(true)
      expect(isUuid(CustomMonsters.createFromBaseline({ name: 'Goblin', source: 'MM' }).id)).toBe(true)
      expect(isUuid(MonsterFolders.createFolder('Undead').id)).toBe(true)
    })

    it('when importing from pasted JSON', () => {
      expect(isUuid(Storage.importEncounterFromJSON('{"title":"Crypt"}').id)).toBe(true)
      expect(isUuid(CustomMonsters.importMonsterFromJSON('{"name":"Bone Knight"}').id)).toBe(true)
      expect(isUuid(Characters.importCharacterFromJSON('{"name":"Bran"}').id)).toBe(true)
    })

    it('when duplicating an existing record', async () => {
      const { initApp, click, tick, longPress, reloadApp } = await import('../helpers.js')
      await initApp()

      Storage.saveEncounter({ id: 'e1', title: 'Crypt', pcs: [], monsters: [], folderIds: [] })
      await reloadApp()

      await longPress(document.querySelector('.encounter-card'))
      await click('#context-menu [data-action="copy"]')
      await tick()

      const copy = Storage.getEncounters().find(e => e.title.includes('Copy'))
      expect(copy).toBeDefined()
      expect(isUuid(copy.id)).toBe(true)
    })
  })

  describe('Through the service APIs', () => {
    it('tombstones an encounter deleted via the storage service', () => {
      Storage.saveEncounter({ id: 'e1', title: 'Crypt', monsters: [], pcs: [] })
      Storage.deleteEncounter('e1')

      expect(Storage.getEncounters()).toEqual([])
      expect(readRaw(ENCOUNTERS_KEY)[0].deletedAt).toBeGreaterThan(0)
    })

    it('tombstones a custom monster deleted via the service', () => {
      const monster = CustomMonsters.createEmptyMonster()
      monster.name = 'Bone Knight'
      CustomMonsters.saveCustomMonster(monster)
      CustomMonsters.deleteCustomMonster(monster.id)

      expect(CustomMonsters.getCustomMonster(monster.id)).toBeUndefined()
      expect(readRaw('dnd-custom-monsters')[0].deletedAt).toBeGreaterThan(0)
    })

    it('tombstones a folder and dirties the items it was stripped from', () => {
      const folder = MonsterFolders.createFolder('Undead')
      const monster = CustomMonsters.createEmptyMonster()
      monster.name = 'Bone Knight'
      monster.folderIds = [folder.id]
      CustomMonsters.saveCustomMonster(monster)
      clearDirty('dnd-custom-monsters', [monster.id])

      MonsterFolders.deleteFolder(folder.id, {
        getItems: CustomMonsters.getCustomMonsters,
        saveItems: CustomMonsters.saveCustomMonsters
      })

      expect(MonsterFolders.getFolders()).toEqual([])
      expect(readRaw('dnd-monster-folders')[0].deletedAt).toBeGreaterThan(0)
      // The monster lost a folder reference, so it needs pushing too.
      expect(getDirty()['dnd-custom-monsters']).toEqual([monster.id])
      expect(CustomMonsters.getCustomMonster(monster.id).folderIds).toEqual([])
    })
  })
})
