// Tests for the Folders service (organizing monsters and encounters into folders)
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { MonsterFolders, EncounterFolders } from '../../js/services/folders.js'

describe('Folders Service', () => {
  afterEach(() => {
    localStorage.clear()
  })

  describe('basic CRUD', () => {
    it('starts with no folders', () => {
      expect(MonsterFolders.getFolders()).toEqual([])
    })

    it('creates a folder', () => {
      const folder = MonsterFolders.createFolder('Undead')
      expect(folder.name).toBe('Undead')
      expect(folder.id).toBeDefined()
      expect(MonsterFolders.getFolders()).toHaveLength(1)
    })

    it('trims folder names and ignores blank names', () => {
      const folder = MonsterFolders.createFolder('  Dragons  ')
      expect(folder.name).toBe('Dragons')

      const blank = MonsterFolders.createFolder('   ')
      expect(blank).toBeNull()
      expect(MonsterFolders.getFolders()).toHaveLength(1)
    })

    it('renames a folder', () => {
      const folder = MonsterFolders.createFolder('Undead')
      MonsterFolders.renameFolder(folder.id, 'Undead Horde')
      expect(MonsterFolders.getFolder(folder.id).name).toBe('Undead Horde')
    })

    it('deletes a folder', () => {
      const folder = MonsterFolders.createFolder('Undead')
      MonsterFolders.deleteFolder(folder.id, {})
      expect(MonsterFolders.getFolders()).toEqual([])
    })
  })

  describe('deleting a folder prunes it from items', () => {
    it('removes the deleted folder id from every item that referenced it', () => {
      const folder = MonsterFolders.createFolder('Undead')
      const other = MonsterFolders.createFolder('Dragons')

      let items = [
        { id: '1', name: 'Zombie', folderIds: [folder.id] },
        { id: '2', name: 'Skeleton', folderIds: [folder.id, other.id] },
        { id: '3', name: 'Red Dragon', folderIds: [other.id] }
      ]

      const getItems = () => items
      const saveItems = (updated) => { items = updated }

      MonsterFolders.deleteFolder(folder.id, { getItems, saveItems })

      expect(items.find(i => i.id === '1').folderIds).toEqual([])
      expect(items.find(i => i.id === '2').folderIds).toEqual([other.id])
      expect(items.find(i => i.id === '3').folderIds).toEqual([other.id])
      expect(MonsterFolders.getFolders().map(f => f.id)).toEqual([other.id])
    })
  })

  describe('independence between entity types', () => {
    it('keeps monster folders and encounter folders separate', () => {
      MonsterFolders.createFolder('Bestiary Folder')
      EncounterFolders.createFolder('Campaign Folder')

      expect(MonsterFolders.getFolders()).toHaveLength(1)
      expect(EncounterFolders.getFolders()).toHaveLength(1)
      expect(MonsterFolders.getFolders()[0].name).toBe('Bestiary Folder')
      expect(EncounterFolders.getFolders()[0].name).toBe('Campaign Folder')
    })
  })
})
