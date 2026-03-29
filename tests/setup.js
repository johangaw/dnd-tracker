// Test setup - runs before each test file
import { beforeEach, afterEach, vi } from 'vitest'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

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
  
  // Clear localStorage
  localStorage.clear()
  
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
