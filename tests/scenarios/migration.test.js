// Migrating legacy locally-stored data to stable UUIDs.
//
// Records used to be keyed by Date.now()-derived ids, which collide across
// devices. The migration replaces them with UUIDs, which means every id that is
// referenced from another collection has to be remapped in step.

import { describe, it, expect, beforeEach } from 'vitest'
import { runMigrations, getSchemaVersion } from '../../js/services/migrations.js'
import { resetForTests as resetRecords, readRaw } from '../../js/services/records.js'
import { isUuid } from '../../js/utils/uuid.js'
import Storage from '../../js/services/storage.js'
import CustomMonsters from '../../js/services/customMonsters.js'
import Characters from '../../js/services/characters.js'
import { MonsterFolders, EncounterFolders } from '../../js/services/folders.js'

// Data in the shape the app wrote before the migration existed: numeric-string
// ids, no updatedAt, no schema version key.
function seedLegacyData() {
  localStorage.setItem('dnd-monster-folders', JSON.stringify([
    { id: 'mf1', name: 'Undead' },
    { id: 'mf2', name: 'Dragons' }
  ]))
  localStorage.setItem('dnd-encounter-folders', JSON.stringify([
    // Deliberately shares an id with a monster folder: the two stores had
    // independent id spaces, so this was possible and must not cross-map.
    { id: 'mf1', name: 'Act One' }
  ]))
  localStorage.setItem('dnd-custom-monsters', JSON.stringify([
    { id: '1700000000001', name: 'Bone Knight', isCustom: true, folderIds: ['mf1'] },
    { id: '1700000000002', name: 'Ash Wyrm', isCustom: true, folderIds: ['mf2', 'gone'] }
  ]))
  localStorage.setItem('dnd-encounters', JSON.stringify([
    {
      id: '1700000000003',
      title: 'Crypt',
      folderIds: ['mf1'],
      monsters: [
        { name: 'Bone Knight', source: 'Custom', customMonsterId: '1700000000001' },
        { name: 'Goblin', source: 'MM' },
        { name: 'Ghost', source: 'Custom', customMonsterId: 'deleted-long-ago' }
      ]
    }
  ]))
  localStorage.setItem('dnd-characters', JSON.stringify([
    { id: '1700000000004-1', name: 'Bran', createdAt: 111, updatedAt: 222 }
  ]))
}

describe('Schema migration to UUIDs', () => {
  beforeEach(() => {
    resetRecords()
    seedLegacyData()
  })

  it('replaces every legacy id with a UUID', () => {
    runMigrations()

    for (const item of [
      ...Storage.getEncounters(),
      ...CustomMonsters.getCustomMonsters(),
      ...Characters.getCharacters(),
      ...MonsterFolders.getFolders(),
      ...EncounterFolders.getFolders()
    ]) {
      expect(isUuid(item.id)).toBe(true)
    }
  })

  it('remaps customMonsterId so encounters still resolve their custom monsters', () => {
    runMigrations()

    const boneKnight = CustomMonsters.getCustomMonsters().find(m => m.name === 'Bone Knight')
    const encounter = Storage.getEncounters()[0]
    const entry = encounter.monsters.find(m => m.name === 'Bone Knight')

    expect(entry.customMonsterId).toBe(boneKnight.id)
    expect(CustomMonsters.getCustomMonster(entry.customMonsterId).name).toBe('Bone Knight')
  })

  it('drops customMonsterId when the custom monster no longer exists', () => {
    runMigrations()

    const ghost = Storage.getEncounters()[0].monsters.find(m => m.name === 'Ghost')
    expect(ghost).toBeDefined()
    expect(ghost.customMonsterId).toBeUndefined()
  })

  it('leaves SRD monster entries, which are keyed by name and source, alone', () => {
    runMigrations()

    const goblin = Storage.getEncounters()[0].monsters.find(m => m.name === 'Goblin')
    expect(goblin).toEqual({ name: 'Goblin', source: 'MM' })
  })

  it('remaps folderIds through each store independently', () => {
    runMigrations()

    const undead = MonsterFolders.getFolders().find(f => f.name === 'Undead')
    const actOne = EncounterFolders.getFolders().find(f => f.name === 'Act One')
    expect(undead.id).not.toBe(actOne.id)

    const boneKnight = CustomMonsters.getCustomMonsters().find(m => m.name === 'Bone Knight')
    expect(boneKnight.folderIds).toEqual([undead.id])
    expect(Storage.getEncounters()[0].folderIds).toEqual([actOne.id])
  })

  it('drops folderIds pointing at folders that no longer exist', () => {
    runMigrations()

    const dragons = MonsterFolders.getFolders().find(f => f.name === 'Dragons')
    const wyrm = CustomMonsters.getCustomMonsters().find(m => m.name === 'Ash Wyrm')
    expect(wyrm.folderIds).toEqual([dragons.id])
  })

  it('stamps updatedAt on records that lacked one, and preserves existing timestamps', () => {
    runMigrations()

    expect(Storage.getEncounters()[0].updatedAt).toBeGreaterThan(0)

    const bran = Characters.getCharacters()[0]
    expect(bran.updatedAt).toBe(222)
    expect(bran.createdAt).toBe(111)
  })

  it('is idempotent - running it again changes nothing', () => {
    runMigrations()
    const after = readRaw('dnd-encounters')

    resetRecords()
    const ranAgain = runMigrations()

    expect(ranAgain).toBe(false)
    expect(readRaw('dnd-encounters')).toEqual(after)
  })

  it('re-runs cleanly if it was interrupted before the version was bumped', () => {
    runMigrations()
    const migrated = readRaw('dnd-custom-monsters')

    // Simulate a crash between writing the data and bumping the version.
    localStorage.removeItem('dnd-schema-version')
    resetRecords()
    runMigrations()

    // Already-UUID ids are recognised and kept, so nothing is regenerated and
    // no cross-collection reference is broken.
    expect(readRaw('dnd-custom-monsters')).toEqual(migrated)
    const encounter = Storage.getEncounters()[0]
    const entry = encounter.monsters.find(m => m.name === 'Bone Knight')
    expect(CustomMonsters.getCustomMonster(entry.customMonsterId)).toBeDefined()
  })

  it('records the schema version so it does not run on every load', () => {
    expect(getSchemaVersion()).toBe(0)
    runMigrations()
    expect(getSchemaVersion()).toBe(1)
  })

  it('handles an empty install without error', () => {
    localStorage.clear()
    resetRecords()

    expect(() => runMigrations()).not.toThrow()
    expect(Storage.getEncounters()).toEqual([])
  })

  it('runs automatically on first read, since data can be seeded after load', () => {
    // No explicit runMigrations() call here.
    const encounters = Storage.getEncounters()
    expect(isUuid(encounters[0].id)).toBe(true)
    expect(getSchemaVersion()).toBe(1)
  })
})
