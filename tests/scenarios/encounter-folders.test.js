// Tests for organizing encounters into folders
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import {
  initApp,
  click,
  longPress,
  tick,
  exists,
  isVisible,
  count,
  seedEncounter,
  getStoredEncounters,
  reloadApp
} from '../helpers.js'
import { EncounterFolders } from '../../js/services/folders.js'

// Both the encounter list and custom monsters views are mounted in the DOM
// at once (only one is shown via CSS), so scope chip lookups to the
// encounter list's own chip container.
function encounterChips() {
  return Array.from(document.querySelectorAll('#folder-chips .folder-chip'))
}

describe('Encounter Folders', () => {
  beforeEach(async () => {
    await initApp()
  })

  afterEach(() => {
    localStorage.clear()
  })

  it('shows only an All chip when no folders exist yet', async () => {
    seedEncounter({ id: '1', title: 'Goblin Ambush' })
    await reloadApp()

    const chips = encounterChips()
    expect(chips).toHaveLength(1)
    expect(chips[0].textContent).toContain('All')
  })

  it('creates a folder from the manage-folders modal', async () => {
    await click('#manage-folders-btn')
    expect(isVisible('#folder-modal')).toBe(true)

    const input = document.querySelector('#folder-modal-new-name')
    input.value = 'Act 1 Bosses'
    await click('#folder-modal-add-btn')

    expect(EncounterFolders.getFolders()).toHaveLength(1)
    expect(EncounterFolders.getFolders()[0].name).toBe('Act 1 Bosses')

    await click('#folder-modal-done-btn')
    expect(isVisible('#folder-modal')).toBe(false)

    // "Unfiled" chip only appears once at least one folder exists
    const chips = encounterChips()
    expect(chips.map(c => c.textContent.trim().split(' ')[0])).toEqual(
      expect.arrayContaining(['All', 'Act', 'Unfiled'])
    )
  })

  it('assigns an encounter to a folder via the context menu and filters the list by it', async () => {
    const folder = EncounterFolders.createFolder('Act 1 Bosses')
    seedEncounter({ id: '1', title: 'Goblin Ambush', folderIds: [folder.id] })
    seedEncounter({ id: '2', title: 'Dragon Lair' })
    await reloadApp()

    // Filtering by the folder shows only the filed encounter
    const folderChip = encounterChips().find(c => c.textContent.includes('Act 1 Bosses'))
    expect(folderChip).toBeTruthy()
    await click(folderChip)

    let cards = document.querySelectorAll('.encounter-card')
    expect(cards).toHaveLength(1)
    expect(cards[0].textContent).toContain('Goblin Ambush')

    // Filtering by Unfiled shows only the unfiled encounter
    const unfiledChip = encounterChips().find(c => c.textContent.includes('Unfiled'))
    await click(unfiledChip)
    cards = document.querySelectorAll('.encounter-card')
    expect(cards).toHaveLength(1)
    expect(cards[0].textContent).toContain('Dragon Lair')

    // All shows both again
    const allChip = encounterChips().find(c => c.textContent.trim().startsWith('All'))
    await click(allChip)
    expect(count('.encounter-card')).toBe(2)
  })

  it('moves an encounter into a folder from the context menu', async () => {
    const folder = EncounterFolders.createFolder('Act 1 Bosses')
    seedEncounter({ id: '1', title: 'Goblin Ambush' })
    await reloadApp()

    const card = document.querySelector('.encounter-card')
    await longPress(card)
    await click('[data-action="folders"]')

    expect(isVisible('#folder-modal')).toBe(true)
    const checkbox = document.querySelector(`[data-folder-checkbox="${folder.id}"]`)
    expect(checkbox).toBeTruthy()
    expect(checkbox.checked).toBe(false)

    checkbox.checked = true
    checkbox.dispatchEvent(new Event('change'))
    await tick()

    expect(getStoredEncounters()[0].folderIds).toEqual([folder.id])
  })

  it('unfiles encounters when their folder is deleted', async () => {
    const folder = EncounterFolders.createFolder('Act 1 Bosses')
    seedEncounter({ id: '1', title: 'Goblin Ambush', folderIds: [folder.id] })
    await reloadApp()

    await click('#manage-folders-btn')
    const deleteBtn = document.querySelector(`[data-delete="${folder.id}"]`)

    // Stub confirm() to accept the deletion
    const originalConfirm = window.confirm
    window.confirm = () => true
    await click(deleteBtn)
    window.confirm = originalConfirm

    expect(EncounterFolders.getFolders()).toEqual([])
    expect(getStoredEncounters()[0].folderIds).toEqual([])
  })
})
