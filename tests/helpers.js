// Test helpers for interacting with the app
import { fireEvent, waitFor, getByText, queryByText, getByPlaceholderText, getByRole } from '@testing-library/dom'
import { mockIndex, mockBestiary, getMockMonster } from './mocks/monsters.js'
import { uuid } from '../js/utils/uuid.js'

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

const jsonResponse = (data, ok = true, status = 200) => ({
  ok,
  status,
  json: async () => data,
  text: async () => JSON.stringify(data)
})

// The reference data the app loads from data/ at runtime.
export const referenceDataMatchers = [
  url => url.includes('index.json') && jsonResponse(mockIndex),
  url => url.includes('bestiary-') && jsonResponse(mockBestiary),
  url => url.includes('legendarygroups.json') && jsonResponse(mockLegendaryGroups),
  url => url.includes('data/spells/') && jsonResponse(mockSpellData)
]

// Installs a fetch mock built from a list of matchers, each of which returns a
// response or a falsy value to decline. Sync and auth mocks layer on top of the
// reference data ones rather than replacing them.
export function installFetchMock(matchers = []) {
  const all = [...matchers, ...referenceDataMatchers]

  globalThis.fetch = async (url, options) => {
    for (const matcher of all) {
      const response = await matcher(String(url), options)
      if (response) return response
    }
    return jsonResponse({}, false, 404)
  }
}

// Setup fetch mock for monster data
export function setupFetchMock() {
  installFetchMock()
}

// A stand-in for the sync Lambda that implements the same conditional-write
// semantics, so client tests assert against realistic behaviour rather than
// hand-written responses.
export function mockSyncServer({ apiBase = 'https://api.test', now = () => Date.now() } = {}) {
  const server = {
    // col -> id -> { updatedAt, deletedAt, data, sv }
    records: new Map(),
    pullCalls: [],
    pushCalls: [],
    failNextWith: null,

    seed(col, record) {
      if (!server.records.has(col)) server.records.set(col, new Map())
      const { updatedAt, deletedAt, ...data } = record
      server.records.get(col).set(record.id, {
        updatedAt,
        deletedAt: deletedAt ?? null,
        data: deletedAt ? null : data,
        sv: record.sv ?? now()
      })
      return server
    },

    all() {
      const out = []
      for (const [col, byId] of server.records) {
        for (const [id, item] of byId) out.push({ col, id, ...item })
      }
      return out
    },

    get(col, id) {
      return server.records.get(col)?.get(id)
    }
  }

  let sequence = 0
  const nextSv = () => Math.max(now(), ++sequence)

  const matcher = async (url, options) => {
    if (!url.startsWith(apiBase)) return null

    if (server.failNextWith) {
      const failure = server.failNextWith
      server.failNextWith = null
      if (failure === 'network') throw new TypeError('Failed to fetch')
      return jsonResponse({ error: 'Server error' }, false, failure)
    }

    // Every route requires a bearer token, as the real one does.
    if (!options?.headers?.authorization?.startsWith('Bearer ')) {
      return jsonResponse({ error: 'Missing bearer token' }, false, 401)
    }

    const body = options.body ? JSON.parse(options.body) : {}

    if (url.endsWith('/sync/pull')) {
      server.pullCalls.push(body)
      const cursor = body.cursor ?? 0
      const records = server.all().filter(r => r.sv > cursor)
      const maxSv = records.reduce((max, r) => Math.max(max, r.sv), cursor)
      return jsonResponse({ records, cursor: maxSv, now: now() })
    }

    if (url.endsWith('/sync/push')) {
      server.pushCalls.push(body)
      const applied = []
      const conflicts = []

      for (const record of body.records ?? []) {
        const existing = server.get(record.col, record.id)
        // The same condition the real handler puts on the write.
        if (existing && existing.updatedAt > record.updatedAt) {
          conflicts.push({ col: record.col, id: record.id, ...existing })
          continue
        }
        if (!server.records.has(record.col)) server.records.set(record.col, new Map())
        const sv = nextSv()
        server.records.get(record.col).set(record.id, {
          updatedAt: record.updatedAt,
          deletedAt: record.deletedAt ?? null,
          data: record.data,
          sv
        })
        applied.push({ col: record.col, id: record.id, sv })
      }

      return jsonResponse({ applied, conflicts, now: now() })
    }

    return jsonResponse({ error: 'Not found' }, false, 404)
  }

  server.matcher = matcher
  return server
}

// Pretends the user is signed in, with a token that will not need refreshing.
export function signInFake({ sub = 'user-123', email = 'dm@example.com' } = {}) {
  localStorage.setItem('dnd-auth', JSON.stringify({
    accessToken: 'fake-access-token',
    refreshToken: 'fake-refresh-token',
    expiresAt: Date.now() + 3600_000,
    sub,
    email
  }))
}

// Initialize the app by importing main.js.
// Pass extra fetch matchers (e.g. a mockSyncServer) to layer them on top of the
// reference-data ones, since this reinstalls the fetch mock.
export async function initApp({ fetchMatchers = [] } = {}) {
  installFetchMock(fetchMatchers)

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
    id: encounter.id || uuid(),
    title: encounter.title || 'Test Encounter',
    description: encounter.description || '',
    pcs: encounter.pcs || [],
    monsters: encounter.monsters || [],
    autoAddMonsters: encounter.autoAddMonsters || false,
    folderIds: encounter.folderIds || [],
    updatedAt: encounter.updatedAt || Date.now()
  })
  localStorage.setItem('dnd-encounters', JSON.stringify(encounters))
}

// Get all live encounters from localStorage. Deleted records are kept in
// storage as tombstones so the deletion can propagate to other devices, so
// they have to be filtered out the same way readCollection() does.
export function getStoredEncounters() {
  return JSON.parse(localStorage.getItem('dnd-encounters') || '[]').filter(e => !e.deletedAt)
}

// Deleted records, for tests that assert on tombstoning itself
export function getStoredTombstones(key = 'dnd-encounters') {
  return JSON.parse(localStorage.getItem(key) || '[]').filter(e => e.deletedAt)
}

// Re-render the encounter list without re-initializing the app
// Use this after seedEncounter() when initApp() was already called
export async function reloadApp() {
  // Import the module and re-render
  const encounterList = await import('../js/components/encounter-list-view/index.js')
  encounterList.render()
  await tick()
}

// Re-export testing-library utilities
export { fireEvent, waitFor, getByText, queryByText, getByPlaceholderText, getByRole }
