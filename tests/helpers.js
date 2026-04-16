// Test helpers for interacting with the app
import { fireEvent, waitFor, getByText, queryByText, getByPlaceholderText, getByRole } from '@testing-library/dom'
import { mockIndex, mockBestiary, getMockMonster } from './mocks/monsters.js'

// Mock spell data for testing
const mockSpellData = {
  spell: [
    {
      name: 'Magic Missile',
      source: 'XPHB',
      level: 1,
      school: 'V',
      time: [{ number: 1, unit: 'action' }],
      range: { type: 'point', distance: { type: 'feet', amount: 120 } },
      components: { v: true, s: true },
      duration: [{ type: 'instant' }],
      entries: ['You create three glowing darts of magical force.'],
      classes: { fromClassList: [{ name: 'Wizard', source: 'XPHB' }, { name: 'Sorcerer', source: 'XPHB' }] }
    },
    {
      name: 'Fireball',
      source: 'XPHB',
      level: 3,
      school: 'V',
      time: [{ number: 1, unit: 'action' }],
      range: { type: 'point', distance: { type: 'feet', amount: 150 } },
      components: { v: true, s: true, m: 'a tiny ball of bat guano and sulfur' },
      duration: [{ type: 'instant' }],
      entries: ['A bright streak flashes from your pointing finger.'],
      classes: { fromClassList: [{ name: 'Wizard', source: 'XPHB' }, { name: 'Sorcerer', source: 'XPHB' }] }
    },
    {
      name: 'Fire Bolt',
      source: 'XPHB',
      level: 0,
      school: 'V',
      time: [{ number: 1, unit: 'action' }],
      range: { type: 'point', distance: { type: 'feet', amount: 120 } },
      components: { v: true, s: true },
      duration: [{ type: 'instant' }],
      entries: ['You hurl a mote of fire at a creature or object within range.'],
      classes: { fromClassList: [{ name: 'Wizard', source: 'XPHB' }, { name: 'Sorcerer', source: 'XPHB' }] }
    },
    {
      name: 'Healing Word',
      source: 'XPHB',
      level: 1,
      school: 'V',
      time: [{ number: 1, unit: 'bonus' }],
      range: { type: 'point', distance: { type: 'feet', amount: 60 } },
      components: { v: true },
      duration: [{ type: 'instant' }],
      entries: ['A creature of your choice that you can see within range regains hit points.'],
      classes: { fromClassList: [{ name: 'Cleric', source: 'XPHB' }, { name: 'Bard', source: 'XPHB' }, { name: 'Druid', source: 'XPHB' }] }
    },
    {
      name: 'Beacon of Hope',
      source: 'XPHB',
      level: 3,
      school: 'A',
      time: [{ number: 1, unit: 'action' }],
      range: { type: 'point', distance: { type: 'feet', amount: 30 } },
      components: { v: true, s: true },
      duration: [{ type: 'timed', duration: { type: 'minute', amount: 1 }, concentration: true }],
      entries: ['This spell bestows hope and vitality.'],
      classes: { fromClassList: [{ name: 'Cleric', source: 'XPHB' }] }
    },
    {
      name: 'Wish',
      source: 'XPHB',
      level: 9,
      school: 'C',
      time: [{ number: 1, unit: 'action' }],
      range: { type: 'point', distance: { type: 'self' } },
      components: { v: true },
      duration: [{ type: 'instant' }],
      entries: ['Wish is the mightiest spell a mortal creature can cast.'],
      classes: { fromClassList: [{ name: 'Wizard', source: 'XPHB' }, { name: 'Sorcerer', source: 'XPHB' }] }
    }
  ]
}

// Mock legendary groups data
const mockLegendaryGroups = {
  legendaryGroup: [
    {
      name: 'Aboleth',
      source: 'MM',
      lairActions: [
        'When fighting inside its lair, an aboleth can invoke the ambient magic to take lair actions.',
        {
          type: 'list',
          items: [
            'The aboleth casts phantasmal force on any number of creatures it can see within 60 feet of it.'
          ]
        }
      ],
      regionalEffects: [
        'The region containing an aboleth\'s lair is warped by the creature\'s presence.',
        {
          type: 'list',
          items: [
            'Underground surfaces within 1 mile of the aboleth\'s lair are slimy and wet.'
          ]
        }
      ]
    }
  ]
}

// Setup fetch mock for monster data
export function setupFetchMock() {
  globalThis.fetch = async (url) => {
    // Handle index.json
    if (url.includes('index.json')) {
      return {
        ok: true,
        json: async () => mockIndex
      }
    }
    
    // Handle bestiary files
    if (url.includes('bestiary-')) {
      return {
        ok: true,
        json: async () => mockBestiary
      }
    }
    
    // Handle legendary groups
    if (url.includes('legendarygroups.json')) {
      return {
        ok: true,
        json: async () => mockLegendaryGroups
      }
    }
    
    // Handle spell files
    if (url.includes('/data/spells/')) {
      return {
        ok: true,
        json: async () => mockSpellData
      }
    }
    
    // Default: return empty
    return {
      ok: false,
      json: async () => ({})
    }
  }
}

// Initialize the app by importing main.js
export async function initApp() {
  setupFetchMock()
  
  // Dynamically import main.js to trigger initialization
  // We need to reset the module cache first
  const mainModule = await import('../js/main.js')
  
  // Reset initialization state to allow re-initialization
  if (mainModule.resetForTests) {
    mainModule.resetForTests()
  }
  
  // Trigger DOMContentLoaded manually since happy-dom doesn't fire it automatically
  const event = new Event('DOMContentLoaded', {
    bubbles: true,
    cancelable: true
  })
  document.dispatchEvent(event)
  
  // Wait for any async initialization
  await new Promise(resolve => setTimeout(resolve, 50))
  
  return mainModule
}

// Click an element
export async function click(elementOrSelector) {
  const element = typeof elementOrSelector === 'string' 
    ? document.querySelector(elementOrSelector)
    : elementOrSelector
    
  if (!element) {
    throw new Error(`Element not found: ${elementOrSelector}`)
  }
  
  fireEvent.click(element)
  await tick()
}

// Type into an input
export async function type(elementOrSelector, text) {
  const element = typeof elementOrSelector === 'string'
    ? document.querySelector(elementOrSelector)
    : elementOrSelector
    
  if (!element) {
    throw new Error(`Element not found: ${elementOrSelector}`)
  }
  
  element.value = text
  fireEvent.input(element, { target: { value: text } })
  fireEvent.change(element, { target: { value: text } })
  await tick()
}

// Clear and type into an input
export async function clearAndType(elementOrSelector, text) {
  const element = typeof elementOrSelector === 'string'
    ? document.querySelector(elementOrSelector)
    : elementOrSelector
    
  if (!element) {
    throw new Error(`Element not found: ${elementOrSelector}`)
  }
  
  element.value = ''
  fireEvent.input(element, { target: { value: '' } })
  await type(element, text)
}

// Submit a form
export async function submitForm(formSelector) {
  const form = document.querySelector(formSelector)
  if (!form) {
    throw new Error(`Form not found: ${formSelector}`)
  }
  
  fireEvent.submit(form)
  await tick()
}

// Wait for next tick (microtask)
export function tick(ms = 10) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

// Wait for element to appear
export async function waitForElement(selector, timeout = 1000) {
  const startTime = Date.now()
  
  while (Date.now() - startTime < timeout) {
    const element = document.querySelector(selector)
    if (element) return element
    await tick(50)
  }
  
  throw new Error(`Timeout waiting for element: ${selector}`)
}

// Wait for text to appear
export async function waitForText(text, timeout = 1000) {
  const startTime = Date.now()
  
  while (Date.now() - startTime < timeout) {
    if (document.body.textContent.includes(text)) {
      return true
    }
    await tick(50)
  }
  
  throw new Error(`Timeout waiting for text: ${text}`)
}

// Check if element exists
export function exists(selector) {
  return document.querySelector(selector) !== null
}

// Check if element is visible (has 'active' class for modals, or not 'hidden')
export function isVisible(selector) {
  const element = document.querySelector(selector)
  if (!element) return false
  
  // Check for modal active class
  if (element.classList.contains('modal')) {
    return element.classList.contains('active')
  }
  
  // Check for hidden class
  return !element.classList.contains('hidden')
}

// Get text content of element
export function getText(selector) {
  const element = document.querySelector(selector)
  return element ? element.textContent.trim() : null
}

// Get all elements matching selector
export function getAll(selector) {
  return Array.from(document.querySelectorAll(selector))
}

// Count elements matching selector
export function count(selector) {
  return document.querySelectorAll(selector).length
}

// Trigger long press / context menu on element
// Optimized: the app handles click on encounter cards the same as long press
export async function longPress(elementOrSelector) {
  const element = typeof elementOrSelector === 'string'
    ? document.querySelector(elementOrSelector)
    : elementOrSelector
    
  if (!element) {
    throw new Error(`Element not found: ${elementOrSelector}`)
  }
  
  // The app shows context menu on click too, so we can just click
  // This is much faster than simulating a 500ms touch hold
  fireEvent.click(element)
  await tick()
}

// Get value of input element
export function getValue(selector) {
  const element = document.querySelector(selector)
  return element ? element.value : null
}

// Check if checkbox is checked
export function isChecked(selector) {
  const element = document.querySelector(selector)
  return element ? element.checked : false
}

// Set checkbox state
export async function setChecked(selector, checked) {
  const element = document.querySelector(selector)
  if (!element) {
    throw new Error(`Checkbox not found: ${selector}`)
  }
  
  element.checked = checked
  fireEvent.change(element)
  await tick()
}

// Helper to create an encounter via the UI
export async function createEncounterViaUI({ title, description = '', pcs = [], monsters = [], autoAddMonsters = false }) {
  // Click new encounter button
  await click('#new-encounter-btn')
  
  // Click "Create New" in the choice modal
  await click('#encounter-choice-create-new')
  
  // Fill in title
  await type('#encounter-title', title)
  
  // Fill in description if provided
  if (description) {
    await type('#encounter-description', description)
  }
  
  // Add PCs
  for (const pcName of pcs) {
    await click('#add-pc-btn')
    const inputs = document.querySelectorAll('.pc-name-input')
    const lastInput = inputs[inputs.length - 1]
    await type(lastInput, pcName)
  }
  
  // Set auto-add monsters checkbox
  if (autoAddMonsters) {
    await setChecked('#auto-add-monsters', true)
  }
  
  // Save the encounter
  await submitForm('#encounter-form')
}

// Helper to add a monster to encounter (requires monster search modal to be working)
export async function addMonsterToEncounterViaUI(monsterName) {
  await click('#add-monster-btn')
  await tick(100) // Wait for modal
  
  // Type in search
  await type('#monster-search-input', monsterName)
  await tick(400) // Wait for search debounce
  
  // Click the first result
  const result = document.querySelector('.search-result-info')
  if (result) {
    await click(result)
  }
}

// Helper to run an encounter from the list
export async function runEncounterByTitle(title) {
  // Find the encounter card
  const cards = getAll('.encounter-card')
  const card = cards.find(c => c.textContent.includes(title))
  
  if (!card) {
    throw new Error(`Encounter not found: ${title}`)
  }
  
  // Long press to show context menu
  await longPress(card)
  
  // Click "Run Encounter"
  const runBtn = document.querySelector('[data-action="run"]')
  if (runBtn) {
    await click(runBtn)
  }
}

// Pre-populate localStorage with an encounter (bypasses UI)
export function seedEncounter(encounter) {
  const encounters = JSON.parse(localStorage.getItem('dnd-encounters') || '[]')
  encounters.push({
    id: encounter.id || Date.now().toString(),
    title: encounter.title || 'Test Encounter',
    description: encounter.description || '',
    pcs: encounter.pcs || [],
    monsters: encounter.monsters || [],
    autoAddMonsters: encounter.autoAddMonsters || false
  })
  localStorage.setItem('dnd-encounters', JSON.stringify(encounters))
}

// Get all encounters from localStorage
export function getStoredEncounters() {
  return JSON.parse(localStorage.getItem('dnd-encounters') || '[]')
}

// Re-render the encounter list without re-initializing the app
// Use this after seedEncounter() when initApp() was already called
export async function reloadApp() {
  // Import the module and re-render
  const encounterList = await import('../js/components/encounterList/index.js')
  encounterList.render()
  await tick()
}

// Re-export testing-library utilities
export { fireEvent, waitFor, getByText, queryByText, getByPlaceholderText, getByRole }
