// Access token verification.
//
// This is the only thing standing between a public Function URL and the data,
// so the tests cover the ways a forged token tries to get past it, not just the
// happy path.

import { describe, it, expect, beforeAll } from 'vitest'
import crypto from 'node:crypto'
import { createVerifier, createJwksCache } from '../../infra/lambda/jwt.mjs'

const ISSUER = 'https://cognito-idp.eu-north-1.amazonaws.com/eu-north-1_test'
const CLIENT_ID = 'test-client-id'
const KID = 'test-key-1'

let privateKey, jwks

beforeAll(() => {
  const pair = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 })
  privateKey = pair.privateKey
  const jwk = pair.publicKey.export({ format: 'jwk' })
  jwks = { keys: [{ ...jwk, kid: KID, alg: 'RS256', use: 'sig' }] }
})

const b64 = obj => Buffer.from(JSON.stringify(obj)).toString('base64url')

function signToken(claims, { header = {}, key } = {}) {
  const fullHeader = { alg: 'RS256', kid: KID, ...header }
  const signingInput = `${b64(fullHeader)}.${b64(claims)}`
  const signature = crypto.sign('RSA-SHA256', Buffer.from(signingInput), key ?? privateKey)
  return `${signingInput}.${signature.toString('base64url')}`
}

function validClaims(overrides = {}) {
  const nowSeconds = Math.floor(Date.now() / 1000)
  return {
    sub: 'user-123',
    email: 'dm@example.com',
    iss: ISSUER,
    client_id: CLIENT_ID,
    token_use: 'access',
    iat: nowSeconds,
    exp: nowSeconds + 3600,
    ...overrides
  }
}

function makeVerifier(overrides = {}) {
  const fetchImpl = async () => ({ ok: true, json: async () => jwks })
  return createVerifier({
    issuer: ISSUER,
    clientId: CLIENT_ID,
    getKey: createJwksCache({ jwksUri: 'https://example.test/jwks.json', fetchImpl }),
    ...overrides
  })
}

describe('Access token verification', () => {
  it('accepts a correctly signed token', async () => {
    const claims = await makeVerifier()(signToken(validClaims()))
    expect(claims.sub).toBe('user-123')
    expect(claims.email).toBe('dm@example.com')
  })

  describe('Signature', () => {
    it('rejects a token signed by a different key', async () => {
      const attacker = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 })
      const token = signToken(validClaims(), { key: attacker.privateKey })
      await expect(makeVerifier()(token)).rejects.toThrow(/Invalid signature/)
    })

    it('rejects a token whose payload was edited after signing', async () => {
      const token = signToken(validClaims())
      const [header, , signature] = token.split('.')
      const tampered = `${header}.${b64(validClaims({ sub: 'someone-else' }))}.${signature}`
      await expect(makeVerifier()(tampered)).rejects.toThrow(/Invalid signature/)
    })

    it('rejects "alg": "none"', async () => {
      const token = `${b64({ alg: 'none', kid: KID })}.${b64(validClaims())}.`
      await expect(makeVerifier()(token)).rejects.toThrow(/Unsupported algorithm/)
    })

    it('rejects an HMAC token signed with the public key', async () => {
      // The classic algorithm-confusion attack: sign with HS256 using the
      // public key as the shared secret, hoping the verifier trusts the header.
      const header = b64({ alg: 'HS256', kid: KID })
      const payload = b64(validClaims())
      const publicPem = crypto.createPublicKey(privateKey).export({ type: 'spki', format: 'pem' })
      const signature = crypto.createHmac('sha256', publicPem)
        .update(`${header}.${payload}`).digest('base64url')

      await expect(makeVerifier()(`${header}.${payload}.${signature}`))
        .rejects.toThrow(/Unsupported algorithm/)
    })

    it('rejects a token with an unknown key id', async () => {
      const token = signToken(validClaims(), { header: { kid: 'not-a-real-key' } })
      await expect(makeVerifier()(token)).rejects.toThrow(/Unknown signing key/)
    })
  })

  describe('Claims', () => {
    it('rejects an expired token', async () => {
      const nowSeconds = Math.floor(Date.now() / 1000)
      const token = signToken(validClaims({ exp: nowSeconds - 3600 }))
      await expect(makeVerifier()(token)).rejects.toThrow(/expired/)
    })

    it('allows a little clock skew either way', async () => {
      const nowSeconds = Math.floor(Date.now() / 1000)
      const token = signToken(validClaims({ exp: nowSeconds - 30, iat: nowSeconds + 30 }))
      await expect(makeVerifier()(token)).resolves.toBeTruthy()
    })

    it('rejects a token from another issuer', async () => {
      const token = signToken(validClaims({ iss: 'https://evil.example.com' }))
      await expect(makeVerifier()(token)).rejects.toThrow(/Wrong issuer/)
    })

    it('rejects a token issued for a different app client', async () => {
      const token = signToken(validClaims({ client_id: 'some-other-app' }))
      await expect(makeVerifier()(token)).rejects.toThrow(/Wrong audience/)
    })

    it('rejects an id token, which is not meant to authorise anything', async () => {
      const token = signToken(validClaims({ token_use: 'id' }))
      await expect(makeVerifier()(token)).rejects.toThrow(/Not an access token/)
    })
  })

  describe('Malformed input', () => {
    it.each([
      ['not a jwt at all', /Malformed token/],
      ['only.two', /Malformed token/],
      ['', /Missing token/]
    ])('rejects %s', async (token, expected) => {
      await expect(makeVerifier()(token)).rejects.toThrow(expected)
    })

    it('rejects a non-string token', async () => {
      await expect(makeVerifier()(undefined)).rejects.toThrow(/Missing token/)
    })
  })

  describe('JWKS cache', () => {
    it('fetches once and reuses the result', async () => {
      let fetches = 0
      const fetchImpl = async () => { fetches++; return { ok: true, json: async () => jwks } }
      const verify = makeVerifier({
        getKey: createJwksCache({ jwksUri: 'https://example.test/jwks.json', fetchImpl })
      })

      await verify(signToken(validClaims()))
      await verify(signToken(validClaims()))

      expect(fetches).toBe(1)
    })

    it('refetches when it sees an unknown key id, in case keys rotated', async () => {
      let fetches = 0
      let currentJwks = { keys: [] }
      const fetchImpl = async () => { fetches++; return { ok: true, json: async () => currentJwks } }
      const clock = { value: Date.now() }
      const verify = makeVerifier({
        getKey: createJwksCache({
          jwksUri: 'https://example.test/jwks.json',
          fetchImpl,
          now: () => clock.value
        })
      })

      await expect(verify(signToken(validClaims()))).rejects.toThrow(/Unknown signing key/)

      // Cognito rotates in the new key, and enough time passes for a refetch.
      currentJwks = jwks
      clock.value += 120_000

      await expect(verify(signToken(validClaims()))).resolves.toBeTruthy()
      expect(fetches).toBe(2)
    })

    it('does not refetch repeatedly for a bogus key id', async () => {
      let fetches = 0
      const fetchImpl = async () => { fetches++; return { ok: true, json: async () => jwks } }
      const verify = makeVerifier({
        getKey: createJwksCache({ jwksUri: 'https://example.test/jwks.json', fetchImpl })
      })

      for (let i = 0; i < 5; i++) {
        await expect(verify(signToken(validClaims(), { header: { kid: 'bogus' } })))
          .rejects.toThrow(/Unknown signing key/)
      }

      // One initial fetch; the rate limit suppresses the rest.
      expect(fetches).toBe(1)
    })
  })
})
