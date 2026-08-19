// Whole-app backup and restore, via the Settings view.
//
// Sharing has always been per-item; this is the "move everything to my other
// device" path. Restoring merges rather than replaces, so importing an older
// backup must never clobber newer work.

import { describe, it, expect, beforeEach } from 'vitest'
import { initApp, click, tick, waitForText, getText } from '../helpers.js'
import * as Backup from '../../js/services/backup.js'
import { resetForTests as resetRecords, readCollection } from '../../js/services/records.js'
import Storage from '../../js/services/storage.js'
import Characters from '../../js/services/characters.js'
import { MonsterFolders } from '../../js/services/folders.js'

function seedSomeData() {
  Storage.saveEncounter({ id: 'e1', title: 'Crypt', pcs: [], monsters: [], folderIds: [] })
  MonsterFolders.createFolder('Undead')
  const character = Characters.createEmptyCharacter()
  character.name = 'Bran'
  Characters.saveCharacter(character)
}

describe('Backup and restore', () => {
  beforeEach(() => {
    resetRecords()
  })

  describe('Export', () => {
    it('includes every synced collection', () => {
      seedSomeData()
      const backup = JSON.parse(Backup.exportAllData())

      expect(backup.version).toBe(1)
      expect(backup.exportedAt).toBeTruthy()
      expect(backup.collections['dnd-encounters']).toHaveLength(1)
      expect(backup.collections['dnd-characters']).toHaveLength(1)
      expect(backup.collections['dnd-monster-folders']).toHaveLength(1)
    })

    it('leaves out the regenerable monster cache', () => {
      localStorage.setItem('dnd-monster-cache', JSON.stringify({ 'Goblin|MM': { name: 'Goblin' } }))
      const backup = JSON.parse(Backup.exportAllData())
      expect(backup.collections['dnd-monster-cache']).toBeUndefined()
    })

    it('leaves out deleted records', () => {
      Storage.saveEncounter({ id: 'e1', title: 'Crypt', pcs: [], monsters: [] })
      Storage.deleteEncounter('e1')

      const backup = JSON.parse(Backup.exportAllData())
      expect(backup.collections['dnd-encounters']).toEqual([])
    })
  })

  describe('Import', () => {
    it('restores everything into an empty install', () => {
      seedSomeData()
      const exported = Backup.exportAllData()

      localStorage.clear()
      resetRecords()
      const summary = Backup.importAllData(exported)

      expect(summary.added).toBe(3)
      expect(Storage.getEncounters()[0].title).toBe('Crypt')
      expect(Characters.getCharacters()[0].name).toBe('Bran')
      expect(MonsterFolders.getFolders()[0].name).toBe('Undead')
    })

    it('is a no-op when the same backup is imported twice', () => {
      seedSomeData()
      const exported = Backup.exportAllData()

      const summary = Backup.importAllData(exported)

      expect(summary.added).toBe(0)
      expect(summary.updated).toBe(0)
      expect(Storage.getEncounters()).toHaveLength(1)
    })

    it('merges into existing data instead of replacing it', () => {
      Storage.saveEncounter({ id: 'e1', title: 'Crypt', pcs: [], monsters: [] })
      const exported = Backup.exportAllData()

      localStorage.clear()
      resetRecords()
      Storage.saveEncounter({ id: 'e2', title: 'Tavern', pcs: [], monsters: [] })
      Backup.importAllData(exported)

      const titles = Storage.getEncounters().map(e => e.title).sort()
      expect(titles).toEqual(['Crypt', 'Tavern'])
    })

    it('keeps the newer version when the same item exists on both sides', () => {
      Storage.saveEncounter({ id: 'e1', title: 'Old name', pcs: [], monsters: [] })
      const staleBackup = Backup.exportAllData()

      // Edit locally after taking the backup.
      const encounter = Storage.getEncounter('e1')
      Storage.saveEncounter({ ...encounter, title: 'New name', updatedAt: encounter.updatedAt + 1000 })

      const summary = Backup.importAllData(staleBackup)

      expect(summary.skipped).toBe(1)
      expect(Storage.getEncounter('e1').title).toBe('New name')
    })

    it('applies the backup when it is the newer side', () => {
      Storage.saveEncounter({ id: 'e1', title: 'Old name', pcs: [], monsters: [] })
      const backup = JSON.parse(Backup.exportAllData())
      backup.collections['dnd-encounters'][0].title = 'Newer name'
      backup.collections['dnd-encounters'][0].updatedAt += 5000

      const summary = Backup.importAllData(JSON.stringify(backup))

      expect(summary.updated).toBe(1)
      expect(Storage.getEncounter('e1').title).toBe('Newer name')
    })

    it('rejects input that is not JSON', () => {
      expect(() => Backup.importAllData('not json at all')).toThrow(/valid JSON/)
    })

    it('rejects JSON that is not a backup file', () => {
      expect(() => Backup.importAllData('{"title":"Crypt"}')).toThrow(/backup file/)
    })

    it('rejects a backup from a newer version of the app', () => {
      expect(() => Backup.importAllData('{"version":99,"collections":{}}')).toThrow(/newer version/)
    })

    it('leaves existing data untouched when the import fails', () => {
      Storage.saveEncounter({ id: 'e1', title: 'Crypt', pcs: [], monsters: [] })
      expect(() => Backup.importAllData('garbage')).toThrow()
      expect(Storage.getEncounters()).toHaveLength(1)
    })
  })

  describe('Settings view', () => {
    beforeEach(async () => {
      await initApp()
    })

    it('is reachable from the main navigation', async () => {
      await click(document.getElementById('menu-settings'))
      await tick()

      expect(document.getElementById('settings-view').classList.contains('active')).toBe(true)
      expect(getText('#page-title')).toBe('Settings')
    })

    it('shows how many records each collection holds', async () => {
      seedSomeData()
      window.location.hash = '#/settings'
      await tick()

      await waitForText('Encounters')
      const stats = [...document.querySelectorAll('#settings-stats .settings-stat')]
        .map(li => li.textContent.replace(/\s+/g, ' ').trim())

      expect(stats).toContain('Encounters 1')
      expect(stats).toContain('Characters 1')
      expect(stats).toContain('Monster folders 1')
    })

    it('imports a pasted backup and refreshes the counts', async () => {
      seedSomeData()
      const exported = Backup.exportAllData()

      localStorage.clear()
      resetRecords()
      window.location.hash = '#/settings'
      await tick()

      document.getElementById('backup-paste').value = exported
      await click(document.getElementById('backup-import-btn'))
      await tick()

      expect(readCollection('dnd-encounters')).toHaveLength(1)
      const stats = [...document.querySelectorAll('#settings-stats .settings-stat')]
        .map(li => li.textContent.replace(/\s+/g, ' ').trim())
      expect(stats).toContain('Encounters 1')
      // The textarea is cleared so a second click cannot re-import by accident.
      expect(document.getElementById('backup-paste').value).toBe('')
    })

    it('reports an error for an unusable paste and changes nothing', async () => {
      Storage.saveEncounter({ id: 'e1', title: 'Crypt', pcs: [], monsters: [] })
      window.location.hash = '#/settings'
      await tick()

      document.getElementById('backup-paste').value = 'nonsense'
      await click(document.getElementById('backup-import-btn'))
      await tick()

      expect(Storage.getEncounters()).toHaveLength(1)
      expect(document.querySelector('.toast')?.textContent).toMatch(/valid JSON/)
    })
  })
})
