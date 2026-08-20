// Sign-in with the authorization code flow and PKCE.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { installFetchMock } from '../helpers.js'
import { CONFIG } from '../../js/config.js'
import * as Auth from '../../js/services/auth.js'

const CONFIGURED = {
  region: 'eu-north-1', userPoolId: 'eu-north-1_pool', clientId: 'test-client',
  cognitoDomain: 'auth.test', apiBase: 'https://api.test'
}

const b64 = obj => btoa(JSON.stringify(obj)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
const idToken = claims => `header.${b64(claims)}.signature`

// Stands in for Cognito's /oauth2/token endpoint.
function mockTokenEndpoint({ onRequest = () => {}, fail = false } = {}) {
  return async (url, options) => {
    if (!url.includes('/oauth2/token')) return null
    const params = new URLSearchParams(options.body)
    onRequest(Object.fromEntries(params))

    if (fail) return { ok: false, status: 400, text: async () => 'invalid_grant', json: async () => ({}) }

    return {
      ok: true,
      status: 200,
      json: async () => ({
        access_token: 'new-access-token',
        refresh_token: 'new-refresh-token',
        id_token: idToken({ sub: 'user-123', email: 'dm@example.com' }),
        expires_in: 3600
      })
    }
  }
}

function setUrl(search) {
  window.history.replaceState({}, '', `/${search}`)
}

beforeEach(() => {
  Object.assign(CONFIG, CONFIGURED)
  Auth.resetForTests()
  sessionStorage.clear()
  installFetchMock()
  setUrl('')
})

afterEach(() => {
  Object.assign(CONFIG, { region: '', userPoolId: '', clientId: '', cognitoDomain: '', apiBase: '' })
  vi.restoreAllMocks()
})

describe('Authentication', () => {
  describe('Authorize request', () => {
    it('builds a PKCE authorize URL with the right parameters', async () => {
      const url = new URL(await Auth.buildAuthorizeUrl())
      const params = url.searchParams

      expect(url.host).toBe('auth.test')
      expect(url.pathname).toBe('/oauth2/authorize')
      expect(params.get('response_type')).toBe('code')
      expect(params.get('client_id')).toBe('test-client')
      expect(params.get('scope')).toBe('openid email')
      expect(params.get('code_challenge_method')).toBe('S256')
      expect(params.get('code_challenge')).toBeTruthy()
      expect(params.get('state')).toBeTruthy()
    })

    it('sends a challenge, never the verifier itself', async () => {
      const params = new URL(await Auth.buildAuthorizeUrl()).searchParams
      const { verifier } = JSON.parse(sessionStorage.getItem('dnd-auth-pkce'))

      expect(verifier).toBeTruthy()
      expect(params.get('code_challenge')).not.toBe(verifier)
      expect(String(params)).not.toContain(verifier)
    })

    it('uses a fresh verifier and state each time', async () => {
      await Auth.buildAuthorizeUrl()
      const first = JSON.parse(sessionStorage.getItem('dnd-auth-pkce'))
      await Auth.buildAuthorizeUrl()
      const second = JSON.parse(sessionStorage.getItem('dnd-auth-pkce'))

      expect(second.verifier).not.toBe(first.verifier)
      expect(second.state).not.toBe(first.state)
    })

    it('redirects back to the app root, matching what Cognito has registered', () => {
      expect(Auth.redirectUri()).toBe(`${window.location.origin}/`)
      expect(Auth.redirectUri().endsWith('/')).toBe(true)
    })
  })

  describe('Handling the redirect back', () => {
    it('does nothing when there is no code in the URL', async () => {
      await expect(Auth.handleRedirect()).resolves.toBeNull()
    })

    it('exchanges the code and stores the tokens', async () => {
      let sent
      installFetchMock([mockTokenEndpoint({ onRequest: p => { sent = p } })])

      const { state, verifier } = JSON.parse(
        (await Auth.buildAuthorizeUrl(), sessionStorage.getItem('dnd-auth-pkce'))
      )
      setUrl(`?code=the-code&state=${encodeURIComponent(state)}`)

      const auth = await Auth.handleRedirect()

      expect(sent.grant_type).toBe('authorization_code')
      expect(sent.code).toBe('the-code')
      expect(sent.code_verifier).toBe(verifier)
      expect(sent.client_id).toBe('test-client')
      // Public client: there is no secret to send.
      expect(sent.client_secret).toBeUndefined()

      expect(auth.sub).toBe('user-123')
      expect(auth.email).toBe('dm@example.com')
      expect(Auth.isSignedIn()).toBe(true)
    })

    it('strips the code and state from the URL afterwards', async () => {
      installFetchMock([mockTokenEndpoint()])
      const { state } = JSON.parse((await Auth.buildAuthorizeUrl(), sessionStorage.getItem('dnd-auth-pkce')))
      setUrl(`?code=the-code&state=${encodeURIComponent(state)}`)

      await Auth.handleRedirect()

      expect(window.location.search).not.toContain('code=')
      expect(window.location.search).not.toContain('state=')
    })

    it('leaves an import share link in the URL intact', async () => {
      installFetchMock([mockTokenEndpoint()])
      const { state } = JSON.parse((await Auth.buildAuthorizeUrl(), sessionStorage.getItem('dnd-auth-pkce')))
      setUrl(`?import=abc123&code=the-code&state=${encodeURIComponent(state)}`)

      await Auth.handleRedirect()

      expect(new URLSearchParams(window.location.search).get('import')).toBe('abc123')
    })

    it('rejects a mismatched state, which is the CSRF guard', async () => {
      installFetchMock([mockTokenEndpoint()])
      await Auth.buildAuthorizeUrl()
      setUrl('?code=injected-code&state=not-the-right-state')

      await expect(Auth.handleRedirect()).rejects.toThrow(/state did not match/)
      expect(Auth.isSignedIn()).toBe(false)
    })

    it('rejects a code with no stored verifier', async () => {
      installFetchMock([mockTokenEndpoint()])
      sessionStorage.clear()
      setUrl('?code=the-code&state=whatever')

      await expect(Auth.handleRedirect()).rejects.toThrow(/could not be completed/)
    })

    it('surfaces an error returned by Cognito', async () => {
      setUrl('?error=access_denied&error_description=User+cancelled')
      await expect(Auth.handleRedirect()).rejects.toThrow(/User cancelled/)
    })

    it('clears the verifier so a code cannot be replayed', async () => {
      installFetchMock([mockTokenEndpoint()])
      const { state } = JSON.parse((await Auth.buildAuthorizeUrl(), sessionStorage.getItem('dnd-auth-pkce')))
      setUrl(`?code=the-code&state=${encodeURIComponent(state)}`)

      await Auth.handleRedirect()

      expect(sessionStorage.getItem('dnd-auth-pkce')).toBeNull()
    })
  })

  describe('Access tokens', () => {
    it('returns null when signed out', async () => {
      await expect(Auth.getAccessToken()).resolves.toBeNull()
    })

    it('reuses a token that is still valid', async () => {
      let calls = 0
      installFetchMock([mockTokenEndpoint({ onRequest: () => calls++ })])
      localStorage.setItem('dnd-auth', JSON.stringify({
        accessToken: 'still-good', refreshToken: 'r', expiresAt: Date.now() + 3600_000, sub: 'user-123'
      }))

      await expect(Auth.getAccessToken()).resolves.toBe('still-good')
      expect(calls).toBe(0)
    })

    it('refreshes a token that is about to expire', async () => {
      let sent
      installFetchMock([mockTokenEndpoint({ onRequest: p => { sent = p } })])
      localStorage.setItem('dnd-auth', JSON.stringify({
        accessToken: 'nearly-expired', refreshToken: 'the-refresh-token',
        expiresAt: Date.now() + 5_000, sub: 'user-123'
      }))

      await expect(Auth.getAccessToken()).resolves.toBe('new-access-token')
      expect(sent.grant_type).toBe('refresh_token')
      expect(sent.refresh_token).toBe('the-refresh-token')
    })

    it('shares a single refresh between concurrent callers', async () => {
      let calls = 0
      installFetchMock([mockTokenEndpoint({ onRequest: () => calls++ })])
      localStorage.setItem('dnd-auth', JSON.stringify({
        accessToken: 'old', refreshToken: 'r', expiresAt: Date.now() - 1, sub: 'user-123'
      }))

      await Promise.all([Auth.getAccessToken(), Auth.getAccessToken(), Auth.getAccessToken()])

      expect(calls).toBe(1)
    })

    it('signs out locally when the refresh token is no longer accepted', async () => {
      installFetchMock([mockTokenEndpoint({ fail: true })])
      localStorage.setItem('dnd-auth', JSON.stringify({
        accessToken: 'old', refreshToken: 'expired', expiresAt: Date.now() - 1, sub: 'user-123'
      }))

      await expect(Auth.getAccessToken()).rejects.toThrow()
      expect(Auth.isSignedIn()).toBe(false)
    })

    it('leaves local data untouched when a session ends', async () => {
      installFetchMock([mockTokenEndpoint({ fail: true })])
      localStorage.setItem('dnd-encounters', JSON.stringify([{ id: 'e1', title: 'Crypt', updatedAt: 1 }]))
      localStorage.setItem('dnd-auth', JSON.stringify({
        accessToken: 'old', refreshToken: 'expired', expiresAt: Date.now() - 1, sub: 'user-123'
      }))

      await expect(Auth.getAccessToken()).rejects.toThrow()

      expect(JSON.parse(localStorage.getItem('dnd-encounters'))).toHaveLength(1)
    })
  })

  describe('Signing out', () => {
    it('forgets the tokens but keeps the data', () => {
      localStorage.setItem('dnd-auth', JSON.stringify({ refreshToken: 'r', sub: 'user-123' }))
      localStorage.setItem('dnd-encounters', JSON.stringify([{ id: 'e1', title: 'Crypt', updatedAt: 1 }]))

      Auth.signOut({ redirect: false })

      expect(Auth.isSignedIn()).toBe(false)
      expect(Auth.getIdentity()).toBeNull()
      expect(JSON.parse(localStorage.getItem('dnd-encounters'))).toHaveLength(1)
    })
  })

  describe('Availability', () => {
    it('is unavailable when the backend is not configured', () => {
      Object.assign(CONFIG, { userPoolId: '', clientId: '', cognitoDomain: '', apiBase: '' })
      expect(Auth.canSignIn()).toBe(false)
    })
  })
})
