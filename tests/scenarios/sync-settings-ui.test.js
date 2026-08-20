// The sync controls in Settings.

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { initApp, click, tick, mockSyncServer, signInFake, installFetchMock } from '../helpers.js'
import { CONFIG } from '../../js/config.js'
import * as Sync from '../../js/services/sync.js'
import * as Auth from '../../js/services/auth.js'
import { resetForTests as resetRecords, ENCOUNTERS_KEY } from '../../js/services/records.js'
import Storage from '../../js/services/storage.js'

const CONFIGURED = {
  region: 'eu-north-1', userPoolId: 'pool', clientId: 'client',
  cognitoDomain: 'auth.test', apiBase: 'https://api.test'
}
const BLANK = { region: '', userPoolId: '', clientId: '', cognitoDomain: '', apiBase: '' }

let server

async function openSettings() {
  window.location.hash = '#/settings'
  window.dispatchEvent(new Event('hashchange'))
  await tick()
}

const syncSection = () => document.getElementById('sync-section')
const syncHint = () => document.getElementById('sync-hint')?.textContent ?? ''

beforeEach(() => {
  resetRecords()
  Sync.resetForTests()
  Auth.resetForTests()
  server = mockSyncServer()
  installFetchMock([server.matcher])
})

afterEach(() => {
  Object.assign(CONFIG, BLANK)
})

describe('Sync settings', () => {
  describe('With no backend configured', () => {
    beforeEach(async () => {
      Object.assign(CONFIG, BLANK)
      await initApp({ fetchMatchers: [server.matcher] })
      await openSettings()
    })

    it('hides the sync section entirely', () => {
      expect(syncSection().hidden).toBe(true)
    })

    it('still shows backup and restore', () => {
      expect(document.getElementById('backup-download-btn')).toBeTruthy()
      expect(document.getElementById('backup-import-btn')).toBeTruthy()
    })
  })

  describe('Signed out', () => {
    beforeEach(async () => {
      Object.assign(CONFIG, CONFIGURED)
      localStorage.removeItem('dnd-auth')
      await initApp({ fetchMatchers: [server.matcher] })
      await openSettings()
    })

    it('shows the sync section', () => {
      expect(syncSection().hidden).toBe(false)
    })

    it('explains that sign-in needs https on an insecure origin', () => {
      // happy-dom serves the tests from a non-secure context, which is exactly
      // the situation of opening the dev server from a phone over the LAN.
      expect(Auth.canSignIn()).toBe(false)
      expect(syncHint()).toMatch(/secure \(https\) connection/)
    })

    it('offers no sync-now button while signed out', () => {
      expect(document.querySelector('[data-sync-action="sync-now"]')).toBeNull()
    })
  })

  describe('Signed in', () => {
    beforeEach(async () => {
      Object.assign(CONFIG, CONFIGURED)
      signInFake({ email: 'dm@example.com' })
      await initApp({ fetchMatchers: [server.matcher] })
      await openSettings()
    })

    it('names the signed-in account', () => {
      expect(syncHint()).toContain('dm@example.com')
    })

    it('offers sync now and sign out', () => {
      expect(document.querySelector('[data-sync-action="sync-now"]')).toBeTruthy()
      expect(document.querySelector('[data-sync-action="sign-out"]')).toBeTruthy()
    })

    it('syncs when Sync now is pressed', async () => {
      server.seed(ENCOUNTERS_KEY, { id: 'e-remote', title: 'From other device', updatedAt: 1, sv: 1 })

      await click('[data-sync-action="sync-now"]')
      await tick()

      expect(Storage.getEncounter('e-remote').title).toBe('From other device')
      expect(document.querySelector('.toast')?.textContent).toMatch(/Synced/)
    })

    it('reports how many items another device changed', async () => {
      Storage.saveEncounter({ id: 'e1', title: 'Local', pcs: [], monsters: [] })
      server.seed(ENCOUNTERS_KEY, { id: 'e1', title: 'Newer elsewhere', updatedAt: Date.now() + 60_000, sv: 5 })

      await click('[data-sync-action="sync-now"]')
      await tick()

      expect(document.querySelector('.toast')?.textContent).toMatch(/1 item updated from another device/)
    })

    it('reports a failed sync without losing data', async () => {
      Storage.saveEncounter({ id: 'e1', title: 'Crypt', pcs: [], monsters: [] })
      server.failNextWith = 500

      await click('[data-sync-action="sync-now"]')
      await tick()

      expect(Storage.getEncounter('e1').title).toBe('Crypt')
      expect(syncHint()).toMatch(/failed/)
    })

    it('mentions changes that have not been sent yet', async () => {
      Storage.saveEncounter({ id: 'e1', title: 'Crypt', pcs: [], monsters: [] })
      await openSettings()

      expect(syncHint()).toMatch(/waiting to be sent/)
    })

    it('signs out and keeps the local data', async () => {
      Storage.saveEncounter({ id: 'e1', title: 'Crypt', pcs: [], monsters: [] })

      await click('[data-sync-action="sign-out"]')
      await tick()

      expect(Auth.isSignedIn()).toBe(false)
      expect(Storage.getEncounter('e1').title).toBe('Crypt')
    })
  })
})
