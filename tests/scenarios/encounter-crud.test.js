// Encounter CRUD Tests
// Tests for creating, reading, updating, and deleting encounters

import { describe, it, expect, beforeEach } from 'vitest'
import { 
  initApp, 
  click, 
  type, 
  leaveEditView,
  tick,
  exists, 
  isVisible, 
  getText, 
  getAll, 
  count,
  seedEncounter,
  getStoredEncounters,
  setChecked,
  longPress,
  reloadApp
} from '../helpers.js'

describe('Encounter CRUD', () => {
  beforeEach(async () => {
    await initApp()
  })

  describe('Empty State', () => {
    it('shows empty state message when no encounters exist', async () => {
      // Should show the empty state
      expect(exists('.empty-state')).toBe(true)
      expect(document.body.textContent).toContain('No Encounters Yet')
    })

    it('shows the new encounter FAB button', async () => {
      expect(exists('#new-encounter-btn')).toBe(true)
    })
  })

  describe('Create Encounter', () => {
    it('opens choice modal when clicking FAB', async () => {
      await click('#new-encounter-btn')
      
      // Should show the choice modal
      expect(isVisible('#add-encounter-choice-modal')).toBe(true)
    })

    it('opens new encounter form when clicking Create New', async () => {
      await click('#new-encounter-btn')
      await click('#encounter-choice-create-new')
      
      // Should switch to edit view
      expect(isVisible('#encounter-edit-view')).toBe(true)
      // Note: Title shows "Edit Encounter" even for new encounters since ID is generated immediately
      expect(getText('#page-title')).toBe('Edit Encounter')
    })

    it('creates a simple encounter with just a title', async () => {
      await click('#new-encounter-btn')
      await click('#encounter-choice-create-new')
      await type('#encounter-title', 'Goblin Ambush')
      await leaveEditView()
      
      // Should return to list view
      expect(isVisible('#encounter-list-view')).toBe(true)
      
      // Should show the encounter in the list
      expect(document.body.textContent).toContain('Goblin Ambush')
      
      // Should be saved in localStorage
      const encounters = getStoredEncounters()
      expect(encounters).toHaveLength(1)
      expect(encounters[0].title).toBe('Goblin Ambush')
    })

    it('creates an encounter with title and description', async () => {
      await click('#new-encounter-btn')
      await click('#encounter-choice-create-new')
      await type('#encounter-title', 'Forest Encounter')
      await type('#encounter-description', 'A group of bandits blocks the road')
      await leaveEditView()
      
      const encounters = getStoredEncounters()
      expect(encounters[0].description).toBe('A group of bandits blocks the road')
    })

    it('creates an encounter with PCs', async () => {
      await click('#new-encounter-btn')
      await click('#encounter-choice-create-new')
      await type('#encounter-title', 'Party Fight')
      
      // Add first PC
      await click('#add-pc-btn')
      const pcInputs1 = getAll('.pc-name-input')
      await type(pcInputs1[0], 'Thorin')
      
      // Add second PC
      await click('#add-pc-btn')
      const pcInputs2 = getAll('.pc-name-input')
      await type(pcInputs2[1], 'Gandalf')
      
      await leaveEditView()
      
      const encounters = getStoredEncounters()
      expect(encounters[0].pcs).toHaveLength(2)
      expect(encounters[0].pcs[0].name).toBe('Thorin')
      expect(encounters[0].pcs[1].name).toBe('Gandalf')
    })

    it('creates an encounter with auto-add monsters setting enabled', async () => {
      await click('#new-encounter-btn')
      await click('#encounter-choice-create-new')
      await type('#encounter-title', 'Auto Combat')
      await setChecked('#auto-add-monsters', true)
      await leaveEditView()
      
      const encounters = getStoredEncounters()
      expect(encounters[0].autoAddMonsters).toBe(true)
    })

    it('filters out empty PC names when saving', async () => {
      await click('#new-encounter-btn')
      await click('#encounter-choice-create-new')
      await type('#encounter-title', 'Test')
      
      // Add PC but leave name empty
      await click('#add-pc-btn')
      
      // Add another PC with a name
      await click('#add-pc-btn')
      const inputs = getAll('.pc-name-input')
      await type(inputs[1], 'Fighter')
      
      await leaveEditView()
      
      const encounters = getStoredEncounters()
      expect(encounters[0].pcs).toHaveLength(1)
      expect(encounters[0].pcs[0].name).toBe('Fighter')
    })
  })

  describe('Read/Display Encounters', () => {
    it('displays encounter in list after creation', async () => {
      // Seed an encounter
      seedEncounter({
        id: '1',
        title: 'Cave of Wonders',
        description: 'Magical cave adventure',
        pcs: [{ name: 'Aladdin' }],
        monsters: []
      })
      
      // Re-init to load the seeded data
      await initApp()
      
      // Should show the encounter
      expect(document.body.textContent).toContain('Cave of Wonders')
      expect(count('.encounter-card')).toBe(1)
    })

    it('displays multiple encounters', async () => {
      seedEncounter({ id: '1', title: 'Encounter One' })
      seedEncounter({ id: '2', title: 'Encounter Two' })
      seedEncounter({ id: '3', title: 'Encounter Three' })
      
      await initApp()
      
      expect(count('.encounter-card')).toBe(3)
      expect(document.body.textContent).toContain('Encounter One')
      expect(document.body.textContent).toContain('Encounter Two')
      expect(document.body.textContent).toContain('Encounter Three')
    })
  })

  describe('Edit Encounter', () => {
    beforeEach(async () => {
      seedEncounter({
        id: 'edit-test',
        title: 'Original Title',
        description: 'Original description',
        pcs: [{ name: 'Original PC' }],
        monsters: []
      })
      // Use reloadApp() instead of initApp() to avoid re-adding event handlers
      await reloadApp()
    })

    it('opens edit form via context menu', async () => {
      const card = document.querySelector('.encounter-card')
      await longPress(card)
      
      // Context menu should appear
      expect(isVisible('#context-menu')).toBe(true)
      
      // Click edit (use specific selector to avoid matching character context menu)
      await click('#context-menu [data-action="edit"]')
      
      // Should open edit view with data loaded
      expect(isVisible('#encounter-edit-view')).toBe(true)
      expect(document.querySelector('#encounter-title').value).toBe('Original Title')
    })

    it('saves changes to existing encounter', async () => {
      const card = document.querySelector('.encounter-card')
      await longPress(card)
      await click('#context-menu [data-action="edit"]')
      
      // Change the title
      const titleInput = document.querySelector('#encounter-title')
      titleInput.value = ''
      await type('#encounter-title', 'Updated Title')
      
      await leaveEditView()
      
      // Should be back to list with updated title
      expect(document.body.textContent).toContain('Updated Title')
      expect(document.body.textContent).not.toContain('Original Title')
      
      // localStorage should be updated
      const encounters = getStoredEncounters()
      expect(encounters[0].title).toBe('Updated Title')
    })

    it('has no save or delete buttons - edits autosave', async () => {
      const card = document.querySelector('.encounter-card')
      await longPress(card)
      await click('#context-menu [data-action="edit"]')

      expect(exists('#delete-encounter-btn')).toBe(false)
      expect(exists('#encounter-form [type="submit"]')).toBe(false)
    })
  })

  describe('Delete Encounter', () => {
    beforeEach(async () => {
      seedEncounter({ id: 'delete-test', title: 'To Be Deleted' })
      // Use reloadApp() instead of initApp() to avoid re-adding event handlers
      await reloadApp()
    })

    it('deletes encounter via context menu', async () => {
      // Confirm exists first
      expect(document.body.textContent).toContain('To Be Deleted')
      
      const card = document.querySelector('.encounter-card')
      await longPress(card)
      
      // Mock window.confirm
      const originalConfirm = window.confirm
      window.confirm = () => true
      
      await click('#context-menu [data-action="delete"]')
      
      window.confirm = originalConfirm
      
      // Should be removed from display
      expect(document.body.textContent).not.toContain('To Be Deleted')
      
      // Should be removed from localStorage
      const encounters = getStoredEncounters()
      expect(encounters).toHaveLength(0)
    })

    it('does not delete when user cancels confirmation', async () => {
      const card = document.querySelector('.encounter-card')
      await longPress(card)
      
      // Mock window.confirm to return false
      const originalConfirm = window.confirm
      window.confirm = () => false
      
      await click('#context-menu [data-action="delete"]')
      
      window.confirm = originalConfirm
      
      // Should still exist
      expect(document.body.textContent).toContain('To Be Deleted')
      expect(getStoredEncounters()).toHaveLength(1)
    })
  })

  describe('Duplicate Encounter', () => {
    beforeEach(async () => {
      seedEncounter({
        id: 'original',
        title: 'Original Encounter',
        pcs: [{ name: 'Hero' }],
        monsters: []
      })
      // Use reloadApp() instead of initApp() to avoid re-adding event handlers
      await reloadApp()
    })

    it('duplicates encounter via context menu', async () => {
      const card = document.querySelector('.encounter-card')
      await longPress(card)
      await click('#context-menu [data-action="copy"]')
      
      // Should now have two encounters
      expect(count('.encounter-card')).toBe(2)
      
      // One should be named "(Copy)"
      expect(document.body.textContent).toContain('Original Encounter (Copy)')
      
      // Both should exist in localStorage
      const encounters = getStoredEncounters()
      expect(encounters).toHaveLength(2)
      expect(encounters.find(e => e.title === 'Original Encounter')).toBeTruthy()
      expect(encounters.find(e => e.title === 'Original Encounter (Copy)')).toBeTruthy()
    })

    it('duplicated encounter has different ID', async () => {
      const card = document.querySelector('.encounter-card')
      await longPress(card)
      await click('#context-menu [data-action="copy"]')
      
      const encounters = getStoredEncounters()
      const ids = encounters.map(e => e.id)
      expect(new Set(ids).size).toBe(2) // All IDs unique
    })

    it('copies encounter JSON to clipboard via context menu', async () => {
      // Mock clipboard API using Object.defineProperty
      let clipboardContent = ''
      Object.defineProperty(navigator, 'clipboard', {
        value: {
          writeText: async (text) => { clipboardContent = text }
        },
        writable: true,
        configurable: true
      })
      
      const card = document.querySelector('.encounter-card')
      await longPress(card)
      await click('#context-menu [data-action="copy-json"]')
      
      // Should have copied JSON to clipboard
      expect(clipboardContent).toContain('Original Encounter')
      const parsed = JSON.parse(clipboardContent)
      expect(parsed.title).toBe('Original Encounter')
      expect(parsed.pcs).toBeDefined()
      expect(parsed.monsters).toBeDefined()
    })
  })

  describe('JSON Import/Export', () => {
    it('shows choice modal when clicking new encounter button', async () => {
      await click('#new-encounter-btn')
      
      // Should show the choice modal
      expect(isVisible('#add-encounter-choice-modal')).toBe(true)
      expect(exists('#encounter-choice-create-new')).toBe(true)
      expect(exists('#encounter-choice-import-json')).toBe(true)
    })

    it('creates new encounter when choosing Create New', async () => {
      await click('#new-encounter-btn')
      await click('#encounter-choice-create-new')
      
      // Should switch to edit view
      expect(isVisible('#encounter-edit-view')).toBe(true)
      expect(isVisible('#add-encounter-choice-modal')).toBe(false)
    })

    it('opens import JSON modal when choosing Import JSON', async () => {
      await click('#new-encounter-btn')
      await click('#encounter-choice-import-json')
      
      // Should show the import JSON modal
      expect(isVisible('#import-encounter-json-modal')).toBe(true)
      expect(exists('#import-encounter-json-input')).toBe(true)
    })

    it('imports encounter from valid JSON', async () => {
      await click('#new-encounter-btn')
      await click('#encounter-choice-import-json')
      
      const jsonData = JSON.stringify({
        title: 'Imported Encounter',
        description: 'Test description',
        pcs: [{ name: 'Fighter' }, { name: 'Wizard' }],
        monsters: [{ name: 'Goblin', source: 'MM', cr: '1/4', hp: 7 }]
      })
      
      await type('#import-encounter-json-input', jsonData)
      await click('#import-encounter-json-confirm-btn')
      
      // Should close modal and show encounter in list
      expect(isVisible('#import-encounter-json-modal')).toBe(false)
      
      // Check the encounter was saved
      const encounters = getStoredEncounters()
      expect(encounters).toHaveLength(1)
      expect(encounters[0].title).toBe('Imported Encounter')
      expect(encounters[0].pcs).toHaveLength(2)
      expect(encounters[0].monsters).toHaveLength(1)
    })

    it('shows error for invalid JSON', async () => {
      await click('#new-encounter-btn')
      await click('#encounter-choice-import-json')
      
      await type('#import-encounter-json-input', 'not valid json')
      await click('#import-encounter-json-confirm-btn')
      
      // Should show error
      expect(isVisible('#import-encounter-json-error')).toBe(true)
      expect(getText('#import-encounter-json-error')).toContain('Invalid JSON')
    })

    it('shows error for JSON without title', async () => {
      await click('#new-encounter-btn')
      await click('#encounter-choice-import-json')
      
      await type('#import-encounter-json-input', '{"pcs": []}')
      await click('#import-encounter-json-confirm-btn')
      
      // Should show error
      expect(isVisible('#import-encounter-json-error')).toBe(true)
      expect(getText('#import-encounter-json-error')).toContain('title')
    })

    it('cancels import when clicking cancel', async () => {
      await click('#new-encounter-btn')
      await click('#encounter-choice-import-json')
      
      await type('#import-encounter-json-input', '{"title": "Test"}')
      await click('#import-encounter-json-cancel-btn')
      
      // Should close modal without importing
      expect(isVisible('#import-encounter-json-modal')).toBe(false)
      expect(getStoredEncounters()).toHaveLength(0)
    })
  })
})
