// Sync API routing, validation and identity handling.
//
// API Gateway's JWT authorizer verifies the token before the handler runs, so
// the security-relevant assertions here are about what the handler does with
// the claims it is handed: it must refuse anything that is not a Cognito
// access token, and a caller must never be able to cause a key outside their
// own partition to be touched.

import { describe, it, expect, beforeEach } from 'vitest'
import { route, MAX_RECORDS_PER_PUSH, PULL_SLACK_MS } from '../../infra/lambda/router.mjs'

// Records what it was asked to do, so tests can assert on the partition key.
function fakeDdb() {
  return {
    changes: [],
    maxSv: 0,
    listChangesCalls: [],
    putCalls: [],
    conflictsToReturn: [],
    async listChanges(args) {
      this.listChangesCalls.push(args)
      return { records: this.changes, maxSv: this.maxSv }
    },
    async putRecords(args) {
      this.putCalls.push(args)
      return {
        applied: args.records.map(r => ({ col: r.col, id: r.id, sv: r.sv })),
        conflicts: this.conflictsToReturn
      }
    }
  }
}

let ddb, clock

function deps(overrides = {}) {
  return { ddb, now: () => clock, ...overrides }
}

// What API Gateway hands the handler after a successful token verification.
const ACCESS_CLAIMS = {
  sub: 'user-123',
  email: 'dm@example.com',
  token_use: 'access',
  scope: 'openid email'
}

function request(method, path, body, { claims = ACCESS_CLAIMS } = {}) {
  return {
    method,
    path,
    claims,
    body: body === undefined ? undefined : JSON.stringify(body)
  }
}

beforeEach(() => {
  ddb = fakeDdb()
  clock = 1_700_000_000_000
})

describe('Sync API', () => {
  describe('Identity', () => {
    it('rejects a request that arrives with no claims', async () => {
      const res = await route(request('POST', '/sync/pull', {}, { claims: null }), deps())
      expect(res.statusCode).toBe(401)
    })

    it('rejects an id token', async () => {
      const claims = { sub: 'user-123', email: 'dm@example.com', token_use: 'id' }
      const res = await route(request('POST', '/sync/pull', {}, { claims }), deps())
      expect(res.statusCode).toBe(401)
    })

    it('rejects claims with no subject', async () => {
      const claims = { ...ACCESS_CLAIMS, sub: undefined }
      const res = await route(request('POST', '/sync/pull', {}, { claims }), deps())
      expect(res.statusCode).toBe(401)
    })

    it('never touches the database when the claims are unusable', async () => {
      await route(request('POST', '/sync/push', { records: [] }, { claims: null }), deps())
      expect(ddb.putCalls).toHaveLength(0)
      expect(ddb.listChangesCalls).toHaveLength(0)
    })
  })

  describe('Isolation between users', () => {
    it('scopes a pull to the subject from the verified claims', async () => {
      await route(request('POST', '/sync/pull', { cursor: 0 }), deps())
      expect(ddb.listChangesCalls[0].sub).toBe('user-123')
    })

    it('ignores any subject supplied in the request body', async () => {
      await route(request('POST', '/sync/pull', { cursor: 0, sub: 'someone-else' }), deps())
      expect(ddb.listChangesCalls[0].sub).toBe('user-123')
    })

    it('ignores a subject smuggled into a pushed record', async () => {
      await route(request('POST', '/sync/push', {
        records: [{ col: 'dnd-encounters', id: 'e1', updatedAt: 1, sub: 'victim', PK: 'USER#victim', data: {} }]
      }), deps())
      expect(ddb.putCalls[0].sub).toBe('user-123')
    })
  })

  describe('Pull', () => {
    it('returns records and a cursor', async () => {
      ddb.changes = [{ col: 'dnd-encounters', id: 'e1', sv: 500, updatedAt: 400, deletedAt: null, data: { title: 'Crypt' } }]
      ddb.maxSv = 500

      const res = await route(request('POST', '/sync/pull', { cursor: 0 }), deps())

      expect(res.statusCode).toBe(200)
      expect(res.body.records).toHaveLength(1)
      expect(res.body.cursor).toBe(500)
      expect(res.body.now).toBe(clock)
    })

    it('looks back beyond the cursor, so a concurrent write cannot be skipped', async () => {
      await route(request('POST', '/sync/pull', { cursor: 10_000_000 }), deps())
      expect(ddb.listChangesCalls[0].sinceSv).toBe(10_000_000 - PULL_SLACK_MS)
    })

    it('never asks for a negative starting point', async () => {
      await route(request('POST', '/sync/pull', { cursor: 5 }), deps())
      expect(ddb.listChangesCalls[0].sinceSv).toBe(0)
    })

    it('starts from the beginning when no cursor is given', async () => {
      await route(request('POST', '/sync/pull', {}), deps())
      expect(ddb.listChangesCalls[0].sinceSv).toBe(0)
    })

    it('does not rewind the cursor when there is nothing new', async () => {
      ddb.maxSv = 0
      const res = await route(request('POST', '/sync/pull', { cursor: 9_999 }), deps())
      expect(res.body.cursor).toBe(9_999)
    })
  })

  describe('Push', () => {
    const record = (overrides = {}) => ({
      col: 'dnd-encounters', id: 'e1', updatedAt: 1000, data: { title: 'Crypt' }, ...overrides
    })

    it('stores a record and reports it applied', async () => {
      const res = await route(request('POST', '/sync/push', { records: [record()] }), deps())

      expect(res.statusCode).toBe(200)
      expect(res.body.applied).toEqual([{ col: 'dnd-encounters', id: 'e1', sv: clock }])
    })

    it('stamps a server-side sv rather than trusting the client', async () => {
      await route(request('POST', '/sync/push', { records: [record({ sv: 999_999_999 })] }), deps())
      expect(ddb.putCalls[0].records[0].sv).toBe(clock)
    })

    it('gives every record in one push a distinct sv', async () => {
      const records = ['a', 'b', 'c'].map(id => record({ id }))
      await route(request('POST', '/sync/push', { records }), deps())

      const svs = ddb.putCalls[0].records.map(r => r.sv)
      expect(new Set(svs).size).toBe(3)
      expect(svs).toEqual([...svs].sort((x, y) => x - y))
    })

    it('accepts a tombstone with no data', async () => {
      const res = await route(request('POST', '/sync/push', {
        records: [{ col: 'dnd-encounters', id: 'e1', updatedAt: 1000, deletedAt: 1000 }]
      }), deps())
      expect(res.statusCode).toBe(200)
    })

    it('passes conflicts back to the client', async () => {
      ddb.conflictsToReturn = [{ col: 'dnd-encounters', id: 'e1', updatedAt: 5000, data: { title: 'Newer' } }]
      const res = await route(request('POST', '/sync/push', { records: [record()] }), deps())
      expect(res.body.conflicts[0].data.title).toBe('Newer')
    })
  })

  describe('Push validation', () => {
    const push = records => route(request('POST', '/sync/push', { records }), deps())

    it('rejects a body that is not a records array', async () => {
      const res = await route(request('POST', '/sync/push', { records: 'nope' }), deps())
      expect(res.statusCode).toBe(400)
    })

    it('rejects an unknown collection, so the table cannot be used as scratch space', async () => {
      const res = await push([{ col: 'dnd-secrets', id: 'x', updatedAt: 1, data: {} }])
      expect(res.statusCode).toBe(400)
      expect(res.body.error).toMatch(/Unknown collection/)
      expect(ddb.putCalls).toHaveLength(0)
    })

    it.each([
      ['a missing id', { col: 'dnd-encounters', updatedAt: 1, data: {} }],
      ['a non-string id', { col: 'dnd-encounters', id: 42, updatedAt: 1, data: {} }],
      ['a missing updatedAt', { col: 'dnd-encounters', id: 'e1', data: {} }],
      ['a non-numeric updatedAt', { col: 'dnd-encounters', id: 'e1', updatedAt: 'soon', data: {} }],
      ['a live record with no data', { col: 'dnd-encounters', id: 'e1', updatedAt: 1 }]
    ])('rejects %s', async (_label, record) => {
      const res = await push([record])
      expect(res.statusCode).toBe(400)
      expect(ddb.putCalls).toHaveLength(0)
    })

    it('rejects more records than one batch allows', async () => {
      const records = Array.from({ length: MAX_RECORDS_PER_PUSH + 1 }, (_, i) => ({
        col: 'dnd-encounters', id: `e${i}`, updatedAt: 1, data: {}
      }))
      const res = await push(records)
      expect(res.statusCode).toBe(400)
    })

    it('rejects a record too large for DynamoDB', async () => {
      const res = await push([{
        col: 'dnd-characters', id: 'c1', updatedAt: 1, data: { notes: 'x'.repeat(400_000) }
      }])
      expect(res.statusCode).toBe(413)
      expect(ddb.putCalls).toHaveLength(0)
    })

    it('rejects an oversized request body before parsing it', async () => {
      const res = await route({
        method: 'POST', path: '/sync/push',
        claims: ACCESS_CLAIMS,
        body: 'x'.repeat(1_000_001)
      }, deps())
      expect(res.statusCode).toBe(413)
    })

    it('rejects a body that is not JSON', async () => {
      const res = await route({
        method: 'POST', path: '/sync/push',
        claims: ACCESS_CLAIMS,
        body: 'not json'
      }, deps())
      expect(res.statusCode).toBe(400)
    })
  })

  describe('Routing', () => {
    it('returns the caller identity from /me', async () => {
      const res = await route(request('GET', '/me'), deps())
      expect(res.body).toMatchObject({ sub: 'user-123', email: 'dm@example.com' })
    })

    // CloudFront forwards /api/* to API Gateway verbatim, so this is the path
    // the handler actually sees in production.
    it('accepts the /api prefix CloudFront forwards', async () => {
      const res = await route(request('GET', '/api/me'), deps())
      expect(res.statusCode).toBe(200)
    })

    it('still accepts a path without the prefix', async () => {
      const res = await route(request('GET', '/me'), deps())
      expect(res.statusCode).toBe(200)
    })

    it('404s an unknown path under the prefix', async () => {
      const res = await route(request('GET', '/api/admin'), deps())
      expect(res.statusCode).toBe(404)
    })

    it('tolerates a trailing slash', async () => {
      const res = await route(request('GET', '/me/'), deps())
      expect(res.statusCode).toBe(200)
    })

    it('404s an unknown path', async () => {
      const res = await route(request('GET', '/admin'), deps())
      expect(res.statusCode).toBe(404)
    })

    it('405s the wrong method', async () => {
      const res = await route(request('GET', '/sync/push'), deps())
      expect(res.statusCode).toBe(405)
    })

    it('turns an unexpected failure into a 500 without leaking details', async () => {
      const exploding = { ...deps(), ddb: { async listChanges() { throw new Error('table on fire') } } }
      const res = await route(request('POST', '/sync/pull', {}), exploding)

      expect(res.statusCode).toBe(500)
      expect(JSON.stringify(res.body)).not.toMatch(/on fire/)
    })
  })
})
