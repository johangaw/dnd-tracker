// Test setup - runs before each test file
import { beforeEach, afterEach, vi } from 'vitest'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

// Import main.js once, eagerly, so every custom element it registers
// (view and modal web components) is defined *before* the first
// `document.body.innerHTML = ...` assignment below. happy-dom's custom
// element upgrade path (defining an element after matching tags already
// exist in the DOM) does not reliably restore attributes such as `class`,
// so elements must be parsed after their definition rather than upgraded
// into it.
import '../js/main.js'
import { resetForTests as resetRecords } from '../js/services/records.js'

// happy-dom does not always provide the WebCrypto APIs the app relies on for
// id generation, so fall back to Node's implementation.
if (!globalThis.crypto?.randomUUID) {
  const { webcrypto } = await import('node:crypto')
  globalThis.crypto = webcrypto
}

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.resolve(__dirname, '..')

// Read the HTML file
const htmlContent = fs.readFileSync(path.join(rootDir, 'index.html'), 'utf-8')

// Extract just the body content (without the script tag that would auto-initialize)
const bodyMatch = htmlContent.match(/<body>([\s\S]*)<\/body>/i)
const bodyContent = bodyMatch ? bodyMatch[1].replace(/<script[\s\S]*?<\/script>/gi, '') : ''

// Store original fetch
let originalFetch

beforeEach(async () => {
  // Reset the DOM
  document.body.innerHTML = bodyContent
  
  // Clear localStorage. The records layer runs the schema migration lazily and
  // remembers that it did, so it has to be reset too or data seeded by the next
  // test would never be migrated.
  localStorage.clear()
  resetRecords()

  // Store original fetch and set up mock
  originalFetch = globalThis.fetch
  
  // Reset URL
  window.history.replaceState({}, '', '/')
})

afterEach(() => {
  // Restore original fetch
  globalThis.fetch = originalFetch
  
  // Clear any vi mocks
  vi.restoreAllMocks()
})

// Make vi available globally for tests
globalThis.vi = vi
