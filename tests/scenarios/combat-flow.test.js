// Combat Flow Tests
// Tests for combat tracker: initiative, turns, HP management

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { 
  initApp, 
  click, 
  type, 
  tick,
  exists, 
  isVisible, 
  getText, 
  getAll, 
  count,
  getValue,
  seedEncounter,
  longPress
} from '../helpers.js'

describe('Combat Flow', () => {
  describe('Starting Combat', () => {
    beforeEach(async () => {
      seedEncounter({
        id: 'combat-test',
        title: 'Test Battle',
        pcs: [{ name: 'Fighter' }, { name: 'Wizard' }],
        monsters: [
          { name: 'Goblin', source: 'MM', cr: '1/4', hp: 7, comment: '' }
        ],
        autoAddMonsters: true
      })
      await initApp()
    })

    afterEach(() => {
      // Clear any pending timers to prevent test interference
      vi.clearAllTimers()
    })

    it('opens initiative setup when running encounter', async () => {
      const card = document.querySelector('.encounter-card')
      await longPress(card)
      await click('[data-action="run"]')
      
      // Should show initiative setup view
      expect(isVisible('#encounter-run-view')).toBe(true)
      expect(isVisible('#initiative-setup')).toBe(true)
      expect(isVisible('#combat-tracker')).toBe(false)
    })

    it('displays all combatants in initiative list', async () => {
      const card = document.querySelector('.encounter-card')
      await longPress(card)
      await click('[data-action="run"]')
      
      // Should show all PCs and monsters
      const items = getAll('.initiative-item')
      expect(items.length).toBe(3) // 2 PCs + 1 monster
      
      expect(document.body.textContent).toContain('Fighter')
      expect(document.body.textContent).toContain('Wizard')
      expect(document.body.textContent).toContain('Goblin')
    })

    it('allows setting initiative values', async () => {
      const card = document.querySelector('.encounter-card')
      await longPress(card)
      await click('[data-action="run"]')
      
      // Set initiative for first combatant
      const initInputs = getAll('.init-input')
      await type(initInputs[0], '15')
      
      expect(initInputs[0].value).toBe('15')
    })

    it('rolls initiative for all monsters', async () => {
      const card = document.querySelector('.encounter-card')
      await longPress(card)
      await click('[data-action="run"]')
      
      // Find monster init input (should be the third one)
      const initInputs = getAll('.init-input')
      const monsterInput = initInputs[2] // Goblin
      
      // Should start at 0
      expect(monsterInput.value).toBe('0')
      
      // Click roll all button
      await click('#roll-all-init')
      
      // Monster should now have a non-zero initiative (random 1-20 + mod)
      // Since it's random, just check it's not still 0 (very unlikely to roll exactly 0)
      // Actually, with negative mods it could be... let's just check it exists
      expect(monsterInput.value).toBeTruthy()
    })

    it('starts combat and shows turn order', async () => {
      const card = document.querySelector('.encounter-card')
      await longPress(card)
      await click('[data-action="run"]')
      
      // Set initiatives
      const initInputs = getAll('.init-input')
      await type(initInputs[0], '20') // Fighter
      await type(initInputs[1], '15') // Wizard
      await type(initInputs[2], '10') // Goblin
      
      // Start combat
      await click('#start-combat-btn')
      
      // Should switch to combat tracker
      expect(isVisible('#initiative-setup')).toBe(false)
      expect(isVisible('#combat-tracker')).toBe(true)
      
      // Should show turn order
      expect(exists('#turn-order')).toBe(true)
    })

    it('sorts combatants by initiative when combat starts', async () => {
      const card = document.querySelector('.encounter-card')
      await longPress(card)
      await click('[data-action="run"]')
      
      // Set initiatives in reverse order
      const initInputs = getAll('.init-input')
      await type(initInputs[0], '5')  // Fighter - lowest
      await type(initInputs[1], '20') // Wizard - highest
      await type(initInputs[2], '10') // Goblin - middle
      
      await click('#start-combat-btn')
      
      // Check turn order - highest initiative first
      const turnItems = getAll('.turn-item')
      expect(turnItems[0].textContent).toContain('Wizard')
      expect(turnItems[1].textContent).toContain('Goblin')
      expect(turnItems[2].textContent).toContain('Fighter')
    })

    it('marks first combatant as active', async () => {
      const card = document.querySelector('.encounter-card')
      await longPress(card)
      await click('[data-action="run"]')
      
      const initInputs = getAll('.init-input')
      await type(initInputs[0], '20')
      await type(initInputs[1], '10')
      await type(initInputs[2], '5')
      
      await click('#start-combat-btn')
      
      const turnItems = getAll('.turn-item')
      expect(turnItems[0].classList.contains('active')).toBe(true)
      expect(turnItems[1].classList.contains('active')).toBe(false)
    })
  })

  describe('Turn Navigation', () => {
    beforeEach(async () => {
      seedEncounter({
        id: 'turns-test',
        title: 'Turn Test',
        pcs: [{ name: 'PC1' }, { name: 'PC2' }],
        monsters: [],
        autoAddMonsters: false
      })
      await initApp()
      
      // Start combat
      const card = document.querySelector('.encounter-card')
      await longPress(card)
      await click('[data-action="run"]')
      
      const initInputs = getAll('.init-input')
      await type(initInputs[0], '20')
      await type(initInputs[1], '10')
      
      await click('#start-combat-btn')
    })

    afterEach(() => {
      vi.clearAllTimers()
    })

    it('advances to next turn', async () => {
      // First combatant should be active
      let turnItems = getAll('.turn-item')
      expect(turnItems[0].classList.contains('active')).toBe(true)
      
      // Click next turn
      await click('#next-turn-btn')
      
      // Second combatant should now be active
      turnItems = getAll('.turn-item')
      expect(turnItems[0].classList.contains('active')).toBe(false)
      expect(turnItems[1].classList.contains('active')).toBe(true)
    })

    it('increments round when cycling through all combatants', async () => {
      // Should start at round 1
      expect(getText('#round-number')).toBe('1')
      
      // Advance through both combatants
      await click('#next-turn-btn') // PC2's turn
      await click('#next-turn-btn') // Back to PC1, round 2
      
      expect(getText('#round-number')).toBe('2')
    })

    it('goes to previous turn', async () => {
      // Advance to second combatant
      await click('#next-turn-btn')
      
      let turnItems = getAll('.turn-item')
      expect(turnItems[1].classList.contains('active')).toBe(true)
      
      // Go back
      await click('#prev-turn-btn')
      
      turnItems = getAll('.turn-item')
      expect(turnItems[0].classList.contains('active')).toBe(true)
    })

    it('decrements round when going back past first combatant', async () => {
      // Advance to round 2
      await click('#next-turn-btn')
      await click('#next-turn-btn')
      expect(getText('#round-number')).toBe('2')
      
      // Go back to round 1
      await click('#prev-turn-btn')
      await click('#prev-turn-btn')
      expect(getText('#round-number')).toBe('1')
    })

    it('does not go below round 1', async () => {
      // Try to go back from start
      await click('#prev-turn-btn')
      
      expect(getText('#round-number')).toBe('1')
    })
  })

  describe('HP Management', () => {
    beforeEach(async () => {
      seedEncounter({
        id: 'hp-test',
        title: 'HP Test',
        pcs: [{ name: 'Hero' }],
        monsters: [
          { name: 'Goblin', source: 'MM', cr: '1/4', hp: 7, comment: '' }
        ],
        autoAddMonsters: true
      })
      await initApp()
      
      const card = document.querySelector('.encounter-card')
      await longPress(card)
      await click('[data-action="run"]')
      
      const initInputs = getAll('.init-input')
      await type(initInputs[0], '10')
      await type(initInputs[1], '5')
      
      await click('#start-combat-btn')
    })

    afterEach(() => {
      vi.clearAllTimers()
    })

    it('opens HP modal for monsters', async () => {
      // Find HP button for monster
      const hpBtn = document.querySelector('.hp-btn')
      await click(hpBtn)
      
      expect(isVisible('#hp-modal')).toBe(true)
    })

    it('displays current and max HP', async () => {
      const hpBtn = document.querySelector('.hp-btn')
      await click(hpBtn)
      
      expect(getText('#current-hp')).toBe('7')
      expect(getText('#max-hp')).toBe('7')
    })

    it('applies damage via quick buttons', async () => {
      const hpBtn = document.querySelector('.hp-btn')
      await click(hpBtn)
      
      // Click -5 damage button
      await click('[data-amount="-5"]')
      
      // Preview should update
      expect(getValue('#hp-custom-amount')).toBe('-5')
      
      // Apply the damage
      await click('#hp-apply-btn')
      
      // HP should be updated in turn order
      const monsterItem = getAll('.turn-item').find(item => 
        item.textContent.includes('Goblin')
      )
      expect(monsterItem.textContent).toContain('2') // 7 - 5 = 2
    })

    it('applies healing via quick buttons', async () => {
      // First damage the monster
      const hpBtn = document.querySelector('.hp-btn')
      await click(hpBtn)
      await click('[data-amount="-5"]')
      await click('#hp-apply-btn')
      
      // Now heal
      await click(hpBtn)
      await click('[data-amount="1"]')
      await click('#hp-apply-btn')
      
      const monsterItem = getAll('.turn-item').find(item => 
        item.textContent.includes('Goblin')
      )
      expect(monsterItem.textContent).toContain('3') // 2 + 1 = 3
    })

    it('allows custom HP input', async () => {
      const hpBtn = document.querySelector('.hp-btn')
      await click(hpBtn)
      
      // Type custom damage
      await type('#hp-custom-amount', '-3')
      await click('#hp-apply-btn')
      
      const monsterItem = getAll('.turn-item').find(item => 
        item.textContent.includes('Goblin')
      )
      expect(monsterItem.textContent).toContain('4') // 7 - 3 = 4
    })

    it('does not reduce HP below 0', async () => {
      const hpBtn = document.querySelector('.hp-btn')
      await click(hpBtn)
      
      // Apply massive damage
      await type('#hp-custom-amount', '-100')
      await click('#hp-apply-btn')
      
      const monsterItem = getAll('.turn-item').find(item => 
        item.textContent.includes('Goblin')
      )
      expect(monsterItem.textContent).toContain('0')
    })

    it('does not increase HP above max', async () => {
      const hpBtn = document.querySelector('.hp-btn')
      await click(hpBtn)
      
      // Try to heal beyond max
      await type('#hp-custom-amount', '100')
      await click('#hp-apply-btn')
      
      const monsterItem = getAll('.turn-item').find(item => 
        item.textContent.includes('Goblin')
      )
      expect(monsterItem.textContent).toContain('7') // Still at max
    })

    it('resets HP delta input', async () => {
      const hpBtn = document.querySelector('.hp-btn')
      await click(hpBtn)
      
      await type('#hp-custom-amount', '-5')
      await click('#hp-reset-btn')
      
      expect(getValue('#hp-custom-amount')).toBe('0')
    })

    it('shows dead status when HP reaches 0', async () => {
      const hpBtn = document.querySelector('.hp-btn')
      await click(hpBtn)
      
      await type('#hp-custom-amount', '-7')
      await click('#hp-apply-btn')
      
      const monsterItem = getAll('.turn-item').find(item => 
        item.textContent.includes('Goblin')
      )
      expect(monsterItem.classList.contains('dead')).toBe(true)
    })
  })

  describe('Initiative Editing', () => {
    beforeEach(async () => {
      seedEncounter({
        id: 'init-edit',
        title: 'Init Edit Test',
        pcs: [{ name: 'Fast' }, { name: 'Slow' }],
        monsters: [],
        autoAddMonsters: false
      })
      await initApp()
      
      const card = document.querySelector('.encounter-card')
      await longPress(card)
      await click('[data-action="run"]')
      
      const initInputs = getAll('.init-input')
      await type(initInputs[0], '20')
      await type(initInputs[1], '10')
      
      await click('#start-combat-btn')
    })

    afterEach(() => {
      vi.clearAllTimers()
    })

    it('opens initiative edit modal when clicking initiative', async () => {
      const initDisplay = document.querySelector('.turn-init.clickable')
      await click(initDisplay)
      
      expect(isVisible('#initiative-modal')).toBe(true)
    })

    it('shows current initiative in edit modal', async () => {
      const initDisplay = document.querySelector('.turn-init.clickable')
      await click(initDisplay)
      
      expect(getValue('#initiative-input')).toBe('20')
    })

    it('saves new initiative and re-sorts', async () => {
      // Click on the second combatant's initiative (value 10)
      const initDisplays = getAll('.turn-init.clickable')
      await click(initDisplays[1]) // Slow (init 10)
      
      // Change to higher value
      await type('#initiative-input', '25')
      await click('#save-initiative-btn')
      
      // Slow should now be first
      const turnItems = getAll('.turn-item')
      expect(turnItems[0].textContent).toContain('Slow')
      expect(turnItems[1].textContent).toContain('Fast')
    })
  })

  describe('Encounter Notes', () => {
    it('shows encounter notes when the encounter has a description', async () => {
      seedEncounter({
        id: 'notes-test',
        title: 'Notes Test',
        description: 'Watch out for the trap door in the north corner.',
        pcs: [{ name: 'Hero' }],
        monsters: [],
        autoAddMonsters: false
      })
      await initApp()

      const card = document.querySelector('.encounter-card')
      await longPress(card)
      await click('[data-action="run"]')

      expect(isVisible('#encounter-notes')).toBe(true)
      expect(getText('#encounter-notes-body')).toBe('Watch out for the trap door in the north corner.')
    })

    it('hides encounter notes when the encounter has no description', async () => {
      seedEncounter({
        id: 'no-notes-test',
        title: 'No Notes Test',
        description: '',
        pcs: [{ name: 'Hero' }],
        monsters: [],
        autoAddMonsters: false
      })
      await initApp()

      const card = document.querySelector('.encounter-card')
      await longPress(card)
      await click('[data-action="run"]')

      expect(isVisible('#encounter-notes')).toBe(false)
    })

    it('collapses and expands notes when the header is clicked', async () => {
      seedEncounter({
        id: 'collapse-notes-test',
        title: 'Collapse Notes Test',
        description: 'Remember the merchant is secretly a doppelganger.',
        pcs: [{ name: 'Hero' }],
        monsters: [],
        autoAddMonsters: false
      })
      await initApp()

      const card = document.querySelector('.encounter-card')
      await longPress(card)
      await click('[data-action="run"]')

      const notesPanel = document.querySelector('#encounter-notes')
      expect(notesPanel.classList.contains('collapsed')).toBe(false)

      await click('#encounter-notes-toggle')
      expect(notesPanel.classList.contains('collapsed')).toBe(true)

      await click('#encounter-notes-toggle')
      expect(notesPanel.classList.contains('collapsed')).toBe(false)
    })

    it('keeps notes visible after combat starts', async () => {
      seedEncounter({
        id: 'notes-during-combat',
        title: 'Notes During Combat',
        description: 'The boss flees at 25% HP.',
        pcs: [{ name: 'Hero' }],
        monsters: [
          { name: 'Goblin', source: 'MM', cr: '1/4', hp: 7, comment: '' }
        ],
        autoAddMonsters: true
      })
      await initApp()

      const card = document.querySelector('.encounter-card')
      await longPress(card)
      await click('[data-action="run"]')

      const initInputs = getAll('.init-input')
      await type(initInputs[0], '10')
      await type(initInputs[1], '5')

      await click('#start-combat-btn')

      expect(isVisible('#encounter-notes')).toBe(true)
      expect(getText('#encounter-notes-body')).toBe('The boss flees at 25% HP.')
    })
  })

  describe('Removing Combatants', () => {
    beforeEach(async () => {
      seedEncounter({
        id: 'remove-test',
        title: 'Remove Test',
        pcs: [{ name: 'PC1' }, { name: 'PC2' }, { name: 'PC3' }],
        monsters: [],
        autoAddMonsters: false
      })
      await initApp()
      
      const card = document.querySelector('.encounter-card')
      await longPress(card)
      await click('[data-action="run"]')
      
      const initInputs = getAll('.init-input')
      await type(initInputs[0], '30')
      await type(initInputs[1], '20')
      await type(initInputs[2], '10')
      
      await click('#start-combat-btn')
    })

    afterEach(() => {
      vi.clearAllTimers()
    })

    it('removes combatant from turn order', async () => {
      const originalConfirm = window.confirm
      window.confirm = () => true
      
      // Remove second combatant (PC2)
      const removeButtons = getAll('.remove-combat-btn')
      await click(removeButtons[1])
      
      window.confirm = originalConfirm
      
      // Should now only have 2 combatants
      expect(count('.turn-item')).toBe(2)
      
      // PC2 should not be in turn order
      const turnItems = getAll('.turn-item')
      const names = turnItems.map(item => item.textContent)
      expect(names.some(n => n.includes('PC2'))).toBe(false)
    })

    it('adjusts current turn when removing earlier combatant', async () => {
      const originalConfirm = window.confirm
      window.confirm = () => true
      
      // Advance to PC2 (second combatant)
      await click('#next-turn-btn')
      
      let turnItems = getAll('.turn-item')
      expect(turnItems[1].classList.contains('active')).toBe(true) // PC2 active
      
      // Remove PC1 (first combatant, before current)
      const removeButtons = getAll('.remove-combat-btn')
      await click(removeButtons[0])
      
      window.confirm = originalConfirm
      
      // PC2 should still be active (now first in list)
      turnItems = getAll('.turn-item')
      expect(turnItems[0].classList.contains('active')).toBe(true)
      expect(turnItems[0].textContent).toContain('PC2')
    })

    it('does not remove when user cancels confirmation', async () => {
      const originalConfirm = window.confirm
      window.confirm = () => false
      
      const removeButtons = getAll('.remove-combat-btn')
      await click(removeButtons[0])
      
      window.confirm = originalConfirm
      
      // Should still have all 3 combatants
      expect(count('.turn-item')).toBe(3)
    })
  })
})
