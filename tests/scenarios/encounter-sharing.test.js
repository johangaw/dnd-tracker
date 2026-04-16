// Encounter Sharing Tests
// Tests for exporting encounters to URLs and importing from URLs

import { describe, it, expect, beforeEach } from 'vitest'
import { decompress } from '../../js/utils/compression.js'
import { 
  initApp, 
  click, 
  tick,
  exists, 
  isVisible, 
  getText,
  seedEncounter,
  getStoredEncounters,
  longPress
} from '../helpers.js'

describe('Encounter Sharing', () => {
  describe('Export to URL', () => {
    beforeEach(async () => {
      seedEncounter({
        id: 'share-test',
        title: 'Shareable Encounter',
        description: 'Test description',
        pcs: [{ name: 'Fighter' }, { name: 'Wizard' }],
        monsters: [
          { name: 'Goblin', source: 'MM', cr: '1/4', hp: 7, comment: '' },
          { name: 'Orc', source: 'MM', cr: '1/2', hp: 15, comment: 'Leader' }
        ],
        autoAddMonsters: true
      })
      await initApp()
    })

    it('shows share option in context menu', async () => {
      const card = document.querySelector('.encounter-card')
      await longPress(card)
      
      expect(isVisible('#context-menu')).toBe(true)
      expect(exists('[data-action="share"]')).toBe(true)
    })

    it('copies share URL to clipboard when share is clicked', async () => {
      let copiedText = null
      
      // Mock clipboard API
      const originalClipboard = navigator.clipboard
      Object.defineProperty(navigator, 'clipboard', {
        value: {
          writeText: async (text) => {
            copiedText = text
            return Promise.resolve()
          }
        },
        writable: true,
        configurable: true
      })
      
      // Mock alert
      const originalAlert = window.alert
      window.alert = () => {}
      
      const card = document.querySelector('.encounter-card')
      await longPress(card)
      await click('#context-menu [data-action="share"]')
      
      // Restore mocks
      window.alert = originalAlert
      Object.defineProperty(navigator, 'clipboard', {
        value: originalClipboard,
        writable: true,
        configurable: true
      })
      
      // Should have copied a URL with import parameter
      expect(copiedText).toBeTruthy()
      expect(copiedText).toContain('?import=')
    })

    it('exported URL contains encoded encounter data', async () => {
      let copiedText = null
      
      Object.defineProperty(navigator, 'clipboard', {
        value: {
          writeText: async (text) => {
            copiedText = text
            return Promise.resolve()
          }
        },
        writable: true,
        configurable: true
      })
      
      const originalAlert = window.alert
      window.alert = () => {}
      
      const card = document.querySelector('.encounter-card')
      await longPress(card)
      await click('#context-menu [data-action="share"]')
      
      // Wait for async compression to complete
      await tick()
      await tick()
      
      window.alert = originalAlert
      
      // Decode the URL to verify data
      const url = new URL(copiedText)
      const importParam = url.searchParams.get('import')
      expect(importParam).toBeTruthy()
      
      // Decode the compressed data
      const decoded = JSON.parse(await decompress(importParam))
      
      // Verify encounter data is present
      expect(decoded.t).toBe('Shareable Encounter') // title
      expect(decoded.d).toBe('Test description') // description
      expect(decoded.p).toHaveLength(2) // pcs
      expect(decoded.m).toHaveLength(2) // monsters
      expect(decoded.a).toBe(1) // autoAddMonsters
    })
  })

  describe('Import from URL', () => {
    it('shows import modal when URL has import parameter', async () => {
      // Create encoded encounter data
      const encounterData = {
        t: 'Imported Battle',
        d: 'From a friend',
        p: ['Paladin', 'Rogue'],
        m: [{ n: 'Skeleton', s: 'MM', c: '1/4', h: 13, cm: '' }],
        a: 0
      }
      const encoded = btoa(encodeURIComponent(JSON.stringify(encounterData)))
      
      // Set the URL before initializing
      window.history.replaceState({}, '', `/?import=${encoded}`)
      
      await initApp()
      
      // Import modal should be visible
      expect(isVisible('#import-modal')).toBe(true)
    })

    it('displays encounter info in import modal', async () => {
      const encounterData = {
        t: 'Dragon Lair',
        d: 'Face the ancient red',
        p: ['Hero1', 'Hero2', 'Hero3'],
        m: [
          { n: 'Young Red Dragon', s: 'MM', c: '10', h: 178, cm: '' },
          { n: 'Kobold', s: 'MM', c: '1/8', h: 5, cm: '' }
        ],
        a: 1
      }
      const encoded = btoa(encodeURIComponent(JSON.stringify(encounterData)))
      window.history.replaceState({}, '', `/?import=${encoded}`)
      
      await initApp()
      
      const modalInfo = getText('#import-encounter-info')
      expect(modalInfo).toContain('Dragon Lair')
      expect(modalInfo).toContain('3 PCs')
      expect(modalInfo).toContain('2 monsters')
    })

    it('imports encounter when user confirms', async () => {
      const encounterData = {
        t: 'Confirmed Import',
        d: '',
        p: ['Test PC'],
        m: [],
        a: 0
      }
      const encoded = btoa(encodeURIComponent(JSON.stringify(encounterData)))
      window.history.replaceState({}, '', `/?import=${encoded}`)
      
      await initApp()
      
      // Click import button
      await click('#import-confirm-btn')
      
      // Modal should close
      expect(isVisible('#import-modal')).toBe(false)
      
      // Encounter should be saved
      const encounters = getStoredEncounters()
      expect(encounters).toHaveLength(1)
      expect(encounters[0].title).toBe('Confirmed Import')
      expect(encounters[0].pcs).toHaveLength(1)
      expect(encounters[0].pcs[0].name).toBe('Test PC')
    })

    it('does not import when user cancels', async () => {
      const encounterData = {
        t: 'Cancelled Import',
        d: '',
        p: [],
        m: [],
        a: 0
      }
      const encoded = btoa(encodeURIComponent(JSON.stringify(encounterData)))
      window.history.replaceState({}, '', `/?import=${encoded}`)
      
      await initApp()
      
      // Click cancel button
      await click('#import-cancel-btn')
      
      // Modal should close
      expect(isVisible('#import-modal')).toBe(false)
      
      // No encounter should be saved
      const encounters = getStoredEncounters()
      expect(encounters).toHaveLength(0)
    })

    it('clears import parameter from URL after import', async () => {
      const encounterData = {
        t: 'Clear URL Test',
        d: '',
        p: [],
        m: [],
        a: 0
      }
      const encoded = btoa(encodeURIComponent(JSON.stringify(encounterData)))
      window.history.replaceState({}, '', `/?import=${encoded}`)
      
      await initApp()
      await click('#import-confirm-btn')
      
      // URL should no longer have import parameter
      expect(window.location.search).not.toContain('import=')
    })

    it('clears import parameter from URL when cancelled', async () => {
      const encounterData = {
        t: 'Cancel Clear Test',
        d: '',
        p: [],
        m: [],
        a: 0
      }
      const encoded = btoa(encodeURIComponent(JSON.stringify(encounterData)))
      window.history.replaceState({}, '', `/?import=${encoded}`)
      
      await initApp()
      await click('#import-cancel-btn')
      
      expect(window.location.search).not.toContain('import=')
    })

    it('generates new ID for imported encounter', async () => {
      const encounterData = {
        t: 'New ID Test',
        d: '',
        p: [],
        m: [],
        a: 0
      }
      const encoded = btoa(encodeURIComponent(JSON.stringify(encounterData)))
      window.history.replaceState({}, '', `/?import=${encoded}`)
      
      await initApp()
      await click('#import-confirm-btn')
      
      const encounters = getStoredEncounters()
      expect(encounters[0].id).toBeTruthy()
      expect(typeof encounters[0].id).toBe('string')
    })

    it('imports encounter with monsters correctly', async () => {
      const encounterData = {
        t: 'Monster Import',
        d: '',
        p: [],
        m: [
          { n: 'Goblin', s: 'MM', c: '1/4', h: 7, cm: 'Scout' },
          { n: 'Hobgoblin', s: 'MM', c: '1/2', h: 11, cm: '' }
        ],
        a: 1
      }
      const encoded = btoa(encodeURIComponent(JSON.stringify(encounterData)))
      window.history.replaceState({}, '', `/?import=${encoded}`)
      
      await initApp()
      await click('#import-confirm-btn')
      
      const encounters = getStoredEncounters()
      expect(encounters[0].monsters).toHaveLength(2)
      expect(encounters[0].monsters[0].name).toBe('Goblin')
      expect(encounters[0].monsters[0].source).toBe('MM')
      expect(encounters[0].monsters[0].cr).toBe('1/4')
      expect(encounters[0].monsters[0].hp).toBe(7)
      expect(encounters[0].monsters[0].comment).toBe('Scout')
      expect(encounters[0].autoAddMonsters).toBe(true)
    })

    it('handles invalid import data gracefully', async () => {
      // Set invalid base64 data
      window.history.replaceState({}, '', '/?import=invalid-base64-data!!!')
      
      // Should not throw, should just not show modal
      await initApp()
      
      // Import modal should not appear for invalid data
      expect(isVisible('#import-modal')).toBe(false)
    })

    it('does not show import modal when no import parameter', async () => {
      window.history.replaceState({}, '', '/')
      
      await initApp()
      
      expect(isVisible('#import-modal')).toBe(false)
    })
  })

  describe('Round-trip Export/Import', () => {
    it('preserves all encounter data through export and import', async () => {
      // Create original encounter
      const original = {
        id: 'roundtrip',
        title: 'Round Trip Test',
        description: 'Testing full cycle',
        pcs: [{ name: 'Alice' }, { name: 'Bob' }],
        monsters: [
          { name: 'Dragon', source: 'MM', cr: '10', hp: 178, comment: 'Boss' }
        ],
        autoAddMonsters: true
      }
      seedEncounter(original)
      await initApp()
      
      // Export
      let exportedUrl = null
      Object.defineProperty(navigator, 'clipboard', {
        value: {
          writeText: async (text) => {
            exportedUrl = text
            return Promise.resolve()
          }
        },
        writable: true,
        configurable: true
      })
      window.alert = () => {}
      
      const card = document.querySelector('.encounter-card')
      await longPress(card)
      await click('#context-menu [data-action="share"]')
      
      // Clear storage and import
      localStorage.clear()
      
      const url = new URL(exportedUrl)
      const importParam = url.searchParams.get('import')
      window.history.replaceState({}, '', `/?import=${importParam}`)
      
      await initApp()
      await click('#import-confirm-btn')
      
      // Verify imported data matches original
      const imported = getStoredEncounters()[0]
      expect(imported.title).toBe(original.title)
      expect(imported.description).toBe(original.description)
      expect(imported.pcs).toHaveLength(original.pcs.length)
      expect(imported.pcs.map(p => p.name)).toEqual(original.pcs.map(p => p.name))
      expect(imported.monsters).toHaveLength(original.monsters.length)
      expect(imported.monsters[0].name).toBe(original.monsters[0].name)
      expect(imported.monsters[0].comment).toBe(original.monsters[0].comment)
      expect(imported.autoAddMonsters).toBe(original.autoAddMonsters)
    })
  })
})
