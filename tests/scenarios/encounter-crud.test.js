// Encounter CRUD Tests
// Tests for creating, reading, updating, and deleting encounters

import { describe, it, expect, beforeEach } from 'vitest'
import { 
  initApp, 
  click, 
  type, 
  submitForm, 
  tick,
  exists, 
  isVisible, 
  getText, 
  getAll, 
  count,
  seedEncounter,
  getStoredEncounters,
  setChecked,
  longPress
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
    it('opens new encounter form when clicking FAB', async () => {
      await click('#new-encounter-btn')
      
      // Should switch to edit view
      expect(isVisible('#encounter-edit-view')).toBe(true)
      // Note: Title shows "Edit Encounter" even for new encounters since ID is generated immediately
      expect(getText('#page-title')).toBe('Edit Encounter')
    })

    it('creates a simple encounter with just a title', async () => {
      await click('#new-encounter-btn')
      await type('#encounter-title', 'Goblin Ambush')
      await submitForm('#encounter-form')
      
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
      await type('#encounter-title', 'Forest Encounter')
      await type('#encounter-description', 'A group of bandits blocks the road')
      await submitForm('#encounter-form')
      
      const encounters = getStoredEncounters()
      expect(encounters[0].description).toBe('A group of bandits blocks the road')
    })

    it('creates an encounter with PCs', async () => {
      await click('#new-encounter-btn')
      await type('#encounter-title', 'Party Fight')
      
      // Add first PC
      await click('#add-pc-btn')
      const pcInputs1 = getAll('.pc-name-input')
      await type(pcInputs1[0], 'Thorin')
      
      // Add second PC
      await click('#add-pc-btn')
      const pcInputs2 = getAll('.pc-name-input')
      await type(pcInputs2[1], 'Gandalf')
      
      await submitForm('#encounter-form')
      
      const encounters = getStoredEncounters()
      expect(encounters[0].pcs).toHaveLength(2)
      expect(encounters[0].pcs[0].name).toBe('Thorin')
      expect(encounters[0].pcs[1].name).toBe('Gandalf')
    })

    it('creates an encounter with auto-add monsters setting enabled', async () => {
      await click('#new-encounter-btn')
      await type('#encounter-title', 'Auto Combat')
      await setChecked('#auto-add-monsters', true)
      await submitForm('#encounter-form')
      
      const encounters = getStoredEncounters()
      expect(encounters[0].autoAddMonsters).toBe(true)
    })

    it('filters out empty PC names when saving', async () => {
      await click('#new-encounter-btn')
      await type('#encounter-title', 'Test')
      
      // Add PC but leave name empty
      await click('#add-pc-btn')
      
      // Add another PC with a name
      await click('#add-pc-btn')
      const inputs = getAll('.pc-name-input')
      await type(inputs[1], 'Fighter')
      
      await submitForm('#encounter-form')
      
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
      await initApp()
    })

    it('opens edit form via context menu', async () => {
      const card = document.querySelector('.encounter-card')
      await longPress(card)
      
      // Context menu should appear
      expect(isVisible('#context-menu')).toBe(true)
      
      // Click edit
      await click('[data-action="edit"]')
      
      // Should open edit view with data loaded
      expect(isVisible('#encounter-edit-view')).toBe(true)
      expect(document.querySelector('#encounter-title').value).toBe('Original Title')
    })

    it('saves changes to existing encounter', async () => {
      const card = document.querySelector('.encounter-card')
      await longPress(card)
      await click('[data-action="edit"]')
      
      // Change the title
      const titleInput = document.querySelector('#encounter-title')
      titleInput.value = ''
      await type('#encounter-title', 'Updated Title')
      
      await submitForm('#encounter-form')
      
      // Should be back to list with updated title
      expect(document.body.textContent).toContain('Updated Title')
      expect(document.body.textContent).not.toContain('Original Title')
      
      // localStorage should be updated
      const encounters = getStoredEncounters()
      expect(encounters[0].title).toBe('Updated Title')
    })

    it('shows delete button when editing existing encounter', async () => {
      const card = document.querySelector('.encounter-card')
      await longPress(card)
      await click('[data-action="edit"]')
      
      expect(isVisible('#delete-encounter-btn')).toBe(true)
    })
  })

  describe('Delete Encounter', () => {
    beforeEach(async () => {
      seedEncounter({ id: 'delete-test', title: 'To Be Deleted' })
      await initApp()
    })

    it('deletes encounter via context menu', async () => {
      // Confirm exists first
      expect(document.body.textContent).toContain('To Be Deleted')
      
      const card = document.querySelector('.encounter-card')
      await longPress(card)
      
      // Mock window.confirm
      const originalConfirm = window.confirm
      window.confirm = () => true
      
      await click('[data-action="delete"]')
      
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
      
      await click('[data-action="delete"]')
      
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
      await initApp()
    })

    it('duplicates encounter via context menu', async () => {
      const card = document.querySelector('.encounter-card')
      await longPress(card)
      await click('[data-action="copy"]')
      
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
      await click('[data-action="copy"]')
      
      const encounters = getStoredEncounters()
      const ids = encounters.map(e => e.id)
      expect(new Set(ids).size).toBe(2) // All IDs unique
    })
  })
})
