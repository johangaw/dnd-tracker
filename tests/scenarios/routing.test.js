// Routing Tests
// Tests for client-side hash routing

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { 
  initApp, 
  click, 
  tick,
  isVisible, 
  seedEncounter,
  longPress,
  reloadApp
} from '../helpers.js'
import * as Router from '../../js/utils/router.js'
import * as Characters from '../../js/services/characters.js'
import * as CustomMonsters from '../../js/services/customMonsters.js'

describe('Routing', () => {
  beforeEach(async () => {
    // Clear hash before each test
    window.location.hash = ''
    await initApp()
  })

  afterEach(() => {
    localStorage.clear()
    window.location.hash = ''
    vi.restoreAllMocks()
  })

  describe('Router Module', () => {
    describe('parseHash', () => {
      it('parses empty hash as encounter list', () => {
        const result = Router.parseHash('')
        expect(result).toEqual({ type: 'encounters', view: 'list', id: null, action: null })
      })

      it('parses #/ as encounter list', () => {
        const result = Router.parseHash('#/')
        expect(result).toEqual({ type: 'encounters', view: 'list', id: null, action: null })
      })

      it('parses #/encounters as encounter list', () => {
        const result = Router.parseHash('#/encounters')
        expect(result).toEqual({ type: 'encounters', view: 'list', id: null, action: null })
      })

      it('parses #/encounters/:id as encounter item', () => {
        const result = Router.parseHash('#/encounters/123')
        expect(result).toEqual({ type: 'encounters', view: 'item', id: '123', action: null })
      })

      it('parses #/monsters as monster list', () => {
        const result = Router.parseHash('#/monsters')
        expect(result).toEqual({ type: 'monsters', view: 'list', id: null, action: null })
      })

      it('parses #/monsters/:id as monster item', () => {
        const result = Router.parseHash('#/monsters/456')
        expect(result).toEqual({ type: 'monsters', view: 'item', id: '456', action: null })
      })

      it('parses #/characters as character list', () => {
        const result = Router.parseHash('#/characters')
        expect(result).toEqual({ type: 'characters', view: 'list', id: null, action: null })
      })

      it('parses #/characters/:id as character item', () => {
        const result = Router.parseHash('#/characters/789')
        expect(result).toEqual({ type: 'characters', view: 'item', id: '789', action: null })
      })

      it('parses #/characters/:id/edit as character edit', () => {
        const result = Router.parseHash('#/characters/789/edit')
        expect(result).toEqual({ type: 'characters', view: 'edit', id: '789', action: 'edit' })
      })

      it('falls back to encounter list for unknown routes', () => {
        const result = Router.parseHash('#/unknown/path')
        expect(result).toEqual({ type: 'encounters', view: 'list', id: null, action: null })
      })
    })

    describe('generateHash', () => {
      it('generates list hash without id', () => {
        expect(Router.generateHash('encounters')).toBe('#/encounters')
        expect(Router.generateHash('monsters')).toBe('#/monsters')
        expect(Router.generateHash('characters')).toBe('#/characters')
      })

      it('generates item hash with id', () => {
        expect(Router.generateHash('encounters', '123')).toBe('#/encounters/123')
        expect(Router.generateHash('monsters', '456')).toBe('#/monsters/456')
        expect(Router.generateHash('characters', '789')).toBe('#/characters/789')
      })

      it('generates edit hash with id and action', () => {
        expect(Router.generateHash('characters', '789', 'edit')).toBe('#/characters/789/edit')
      })
    })

    describe('getViewForRoute', () => {
      it('returns correct view for encounter list', () => {
        const routeInfo = { type: 'encounters', view: 'list', id: null }
        expect(Router.getViewForRoute(routeInfo)).toBe('encounter-list')
      })

      it('returns correct view for encounter item', () => {
        const routeInfo = { type: 'encounters', view: 'item', id: '123' }
        expect(Router.getViewForRoute(routeInfo)).toBe('encounter-edit')
      })

      it('returns correct view for monster list', () => {
        const routeInfo = { type: 'monsters', view: 'list', id: null }
        expect(Router.getViewForRoute(routeInfo)).toBe('custom-monsters')
      })

      it('returns correct view for monster item', () => {
        const routeInfo = { type: 'monsters', view: 'item', id: '456' }
        expect(Router.getViewForRoute(routeInfo)).toBe('custom-monster-edit')
      })

      it('returns correct view for character list', () => {
        const routeInfo = { type: 'characters', view: 'list', id: null }
        expect(Router.getViewForRoute(routeInfo)).toBe('characters')
      })

      it('returns correct view for character item', () => {
        const routeInfo = { type: 'characters', view: 'item', id: '789' }
        expect(Router.getViewForRoute(routeInfo)).toBe('character-view')
      })

      it('returns correct view for character edit', () => {
        const routeInfo = { type: 'characters', view: 'edit', id: '789' }
        expect(Router.getViewForRoute(routeInfo)).toBe('character-edit')
      })
    })

    describe('getRouteTypeFromView', () => {
      it('returns encounters for encounter views', () => {
        expect(Router.getRouteTypeFromView('encounter-list')).toBe('encounters')
        expect(Router.getRouteTypeFromView('encounter-edit')).toBe('encounters')
      })

      it('returns monsters for monster views', () => {
        expect(Router.getRouteTypeFromView('custom-monsters')).toBe('monsters')
        expect(Router.getRouteTypeFromView('custom-monster-edit')).toBe('monsters')
      })

      it('returns characters for character views', () => {
        expect(Router.getRouteTypeFromView('characters')).toBe('characters')
        expect(Router.getRouteTypeFromView('character-view')).toBe('characters')
        expect(Router.getRouteTypeFromView('character-edit')).toBe('characters')
      })

      it('falls back to encounters for unknown views', () => {
        expect(Router.getRouteTypeFromView('unknown')).toBe('encounters')
      })
    })

    describe('isItemRoute', () => {
      it('returns truthy for item routes with id', () => {
        expect(Router.isItemRoute({ type: 'encounters', view: 'item', id: '123' })).toBeTruthy()
      })

      it('returns truthy for edit routes with id', () => {
        expect(Router.isItemRoute({ type: 'characters', view: 'edit', id: '123' })).toBeTruthy()
      })

      it('returns falsy for list routes', () => {
        expect(Router.isItemRoute({ type: 'encounters', view: 'list', id: null })).toBeFalsy()
      })

      it('returns falsy for item view without id', () => {
        expect(Router.isItemRoute({ type: 'encounters', view: 'item', id: null })).toBeFalsy()
      })
    })
  })

  describe('Navigation via Header', () => {
    it('shows the main sections in the header navigation', () => {
      const navItems = document.querySelectorAll('.main-nav .nav-item')

      expect(navItems.length).toBe(3)
      expect(Array.from(navItems).map(item => item.dataset.nav)).toEqual(['encounters', 'custom-monsters', 'characters'])
    })

    it('hides the main nav when editing a detail view', async () => {
      const nav = document.querySelector('.main-nav')
      expect(nav.classList.contains('hidden')).toBe(false)

      seedEncounter({ id: 'test-encounter-1', title: 'Test Encounter' })
      window.location.hash = '#/encounters/test-encounter-1'
      window.dispatchEvent(new Event('hashchange'))
      await tick()

      expect(nav.classList.contains('hidden')).toBe(true)
    })

    it('updates hash when clicking Monsters nav', async () => {
      await click('#menu-custom-monsters')

      expect(window.location.hash).toBe('#/monsters')
    })

    it('updates hash when clicking Characters nav', async () => {
      await click('#menu-characters')

      expect(window.location.hash).toBe('#/characters')
    })
  })

  describe('Navigation to Items', () => {
    it('updates hash when editing an encounter via context menu', async () => {
      // Seed an encounter
      seedEncounter({ id: 'test-encounter-1', title: 'Test Encounter' })
      await reloadApp()
      
      // Long press to get context menu
      const card = document.querySelector('.encounter-card')
      await longPress(card)
      
      // The context menu should set data attribute on the element
      const menu = document.getElementById('context-menu')
      expect(menu.classList.contains('hidden')).toBe(false)
      expect(menu.dataset.encounterId).toBe('test-encounter-1')
      
      // Find the edit button inside context-menu specifically
      const editBtn = menu.querySelector('[data-action="edit"]')
      await click(editBtn)
      
      expect(window.location.hash).toBe('#/encounters/test-encounter-1')
    })

    it('updates hash when viewing a character via context menu', async () => {
      // Create a character directly using createEmptyCharacter
      const character = Characters.createEmptyCharacter()
      character.name = 'Test Character'
      character.race = 'Human'
      character.class = 'Fighter'
      character.level = 1
      Characters.saveCharacter(character)
      
      // Navigate to characters list
      await click('#menu-btn')
      await tick()
      await click('#menu-characters')
      await tick()
      
      // Long press to get context menu, then view
      const card = document.querySelector('.character-card')
      if (card) {
        await longPress(card)
        
        // Verify context menu has the characterId
        const menu = document.getElementById('character-context-menu')
        expect(menu.dataset.characterId).toBe(character.id)
        
        await click('#character-context-menu [data-action="view"]')
        
        expect(window.location.hash).toBe(`#/characters/${character.id}`)
      }
    })
  })

  describe('Direct URL Navigation', () => {
    it('shows encounter list for #/encounters', async () => {
      window.location.hash = '#/encounters'
      
      // Trigger hashchange event
      window.dispatchEvent(new HashChangeEvent('hashchange'))
      await tick()
      
      expect(isVisible('#encounter-list-view')).toBe(true)
    })

    it('shows monster list for #/monsters', async () => {
      window.location.hash = '#/monsters'
      
      window.dispatchEvent(new HashChangeEvent('hashchange'))
      await tick()
      
      expect(isVisible('#custom-monsters-view')).toBe(true)
    })

    it('shows character list for #/characters', async () => {
      window.location.hash = '#/characters'
      
      window.dispatchEvent(new HashChangeEvent('hashchange'))
      await tick()
      
      expect(isVisible('#characters-view')).toBe(true)
    })

    it('shows encounter edit for #/encounters/:id with valid encounter', async () => {
      // Seed an encounter first
      seedEncounter({ id: 'direct-nav-test', title: 'Direct Nav Test' })
      
      window.location.hash = '#/encounters/direct-nav-test'
      
      window.dispatchEvent(new HashChangeEvent('hashchange'))
      await tick()
      
      expect(isVisible('#encounter-edit-view')).toBe(true)
    })

    it('falls back to list for #/encounters/:id with invalid encounter', async () => {
      window.location.hash = '#/encounters/nonexistent'
      
      window.dispatchEvent(new HashChangeEvent('hashchange'))
      await tick()
      
      // Should fall back to list view
      expect(isVisible('#encounter-list-view')).toBe(true)
    })
  })

  describe('Back Button Navigation', () => {
    it('navigates back to encounter list from encounter edit', async () => {
      // Seed an encounter
      seedEncounter({ id: 'back-btn-test', title: 'Back Button Test' })
      await reloadApp()
      
      // Navigate to edit
      window.location.hash = '#/encounters/back-btn-test'
      window.dispatchEvent(new HashChangeEvent('hashchange'))
      await tick()
      
      // Click back button
      await click('#back-btn')
      
      expect(window.location.hash).toBe('#/encounters')
      expect(isVisible('#encounter-list-view')).toBe(true)
    })

    it('navigates back to monster list from monster edit', async () => {
      // Create a custom monster directly in storage
      const monsters = [{
        id: 'test-monster-1',
        name: 'Test Monster',
        size: 'Medium',
        type: 'beast',
        hp: { average: 10 },
        ac: [{ ac: 12 }]
      }]
      localStorage.setItem('dnd-custom-monsters', JSON.stringify(monsters))
      
      // Navigate to edit
      window.location.hash = '#/monsters/test-monster-1'
      window.dispatchEvent(new HashChangeEvent('hashchange'))
      await tick()
      
      // Click back button
      await click('#back-btn')
      
      expect(window.location.hash).toBe('#/monsters')
    })

    it('navigates back to character list from character view', async () => {
      // Create a character using createEmptyCharacter
      const character = Characters.createEmptyCharacter()
      character.name = 'Back Test Character'
      character.race = 'Elf'
      character.class = 'Wizard'
      character.level = 5
      Characters.saveCharacter(character)
      
      // Navigate to view
      window.location.hash = `#/characters/${character.id}`
      window.dispatchEvent(new HashChangeEvent('hashchange'))
      await tick()
      
      // Click back button
      await click('#back-btn')
      
      expect(window.location.hash).toBe('#/characters')
    })

    it('navigates back to character list from character edit when loaded directly', async () => {
      // Create a character using createEmptyCharacter
      const character = Characters.createEmptyCharacter()
      character.name = 'Edit Back Test Character'
      character.race = 'Dwarf'
      character.class = 'Cleric'
      character.level = 3
      Characters.saveCharacter(character)
      
      // Navigate to edit directly (simulates direct URL load)
      window.location.hash = `#/characters/${character.id}/edit`
      window.dispatchEvent(new HashChangeEvent('hashchange'))
      await tick()
      
      // Click back button - should go to list since we loaded directly
      await click('#back-btn')
      
      expect(window.location.hash).toBe('#/characters')
    })

    it('navigates back to character view from character edit when coming from view', async () => {
      // Create a character
      const character = Characters.createEmptyCharacter()
      character.name = 'View Edit Back Test Character'
      character.race = 'Human'
      character.class = 'Paladin'
      character.level = 5
      Characters.saveCharacter(character)
      
      // First navigate to character view
      window.location.hash = `#/characters/${character.id}`
      window.dispatchEvent(new HashChangeEvent('hashchange'))
      await tick()
      
      // Then click edit button (which sets source to 'view')
      await click('#character-view-edit')
      await tick()
      
      // Verify we're on edit page
      expect(window.location.hash).toBe(`#/characters/${character.id}/edit`)
      
      // Click back button - should go back to character view
      await click('#back-btn')
      
      expect(window.location.hash).toBe(`#/characters/${character.id}`)
    })
  })

  describe('Initial Load', () => {
    it('handles initial encounter list route on load', async () => {
      localStorage.clear()
      window.location.hash = '#/encounters'
      
      // Re-initialize app
      await initApp()
      
      expect(isVisible('#encounter-list-view')).toBe(true)
    })

    it('handles initial monster list route on load', async () => {
      localStorage.clear()
      window.location.hash = '#/monsters'
      
      await initApp()
      
      expect(isVisible('#custom-monsters-view')).toBe(true)
    })

    it('handles initial character list route on load', async () => {
      localStorage.clear()
      window.location.hash = '#/characters'
      
      await initApp()
      
      expect(isVisible('#characters-view')).toBe(true)
    })
  })
})
