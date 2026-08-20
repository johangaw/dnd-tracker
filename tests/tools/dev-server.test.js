// The dev server exists to make localhost behave like CloudFront, so what is
// worth testing is exactly that parity. Every assertion here mirrors a rule in
// infra/lib/app-stack.js: the SPA-fallback function, the /api/* behaviour, and
// the response headers policy.

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import http from 'node:http'
import { createDevServer } from '../../scripts/dev-server.mjs'

// Stands in for API Gateway, and reports back what it was actually sent.
let upstream, upstreamPort
let server, port

function listen(s) {
  return new Promise(resolve => s.listen(0, () => resolve(s.address().port)))
}

beforeAll(async () => {
  upstream = http.createServer((req, res) => {
    let body = ''
    req.on('data', c => { body += c })
    req.on('end', () => {
      res.statusCode = 201
      res.setHeader('content-type', 'application/json')
      res.end(JSON.stringify({
        method: req.method,
        url: req.url,
        authorization: req.headers.authorization ?? null,
        host: req.headers.host,
        body
      }))
    })
  })
  upstreamPort = await listen(upstream)

  server = createDevServer({
    apiEndpoint: `http://localhost:${upstreamPort}`,
    cognitoDomain: 'dnd-tracker-123.auth.eu-north-1.amazoncognito.com'
  })
  port = await listen(server)
})

afterAll(async () => {
  await new Promise(resolve => server.close(resolve))
  await new Promise(resolve => upstream.close(resolve))
})

const get = (path, init) => fetch(`http://localhost:${port}${path}`, init)

describe('Dev server', () => {
  describe('Static files, as CloudFront serves them', () => {
    it('serves the app shell at the root', async () => {
      const res = await get('/')
      expect(res.status).toBe(200)
      expect(res.headers.get('content-type')).toBe('text/html')
    })

    it('serves a real file with its own content type', async () => {
      const res = await get('/js/main.js')
      expect(res.status).toBe(200)
      expect(res.headers.get('content-type')).toBe('text/javascript')
    })

    // The CloudFront function rewrites extensionless paths to the shell.
    it('rewrites an extensionless route to the app shell', async () => {
      const res = await get('/encounters')
      expect(res.status).toBe(200)
      expect(res.headers.get('content-type')).toBe('text/html')
    })

    // And deliberately does not, for a missing file: a failed fetch of a
    // bestiary file has to surface as an error rather than as HTML.
    it('404s a missing file instead of returning the shell', async () => {
      const res = await get('/data/bestiary/does-not-exist.json')
      expect(res.status).toBe(404)
    })

    it('does not serve anything outside the project directory', async () => {
      const res = await get('/%2e%2e/%2e%2e/etc/passwd')
      expect(res.headers.get('content-type')).toBe('text/html')
      expect(await res.text()).not.toMatch(/root:/)
    })
  })

  describe('Content-Security-Policy, as CloudFront sends it', () => {
    it('sends the production policy', async () => {
      const csp = (await get('/')).headers.get('content-security-policy')
      expect(csp).toContain("default-src 'self'")
      expect(csp).toContain("script-src 'self'")
      expect(csp).toContain('https://dnd-tracker-123.auth.eu-north-1.amazoncognito.com')
    })

    it('does not allow scripts from anywhere else', async () => {
      const csp = (await get('/')).headers.get('content-security-policy')
      expect(csp).not.toMatch(/script-src[^;]*unsafe-inline/)
    })
  })

  describe('API proxy, as the CloudFront /api behaviour routes it', () => {
    it('forwards the path unchanged, prefix included', async () => {
      const res = await get('/api/sync/pull', { method: 'POST', body: '{}' })
      expect((await res.json()).url).toBe('/api/sync/pull')
    })

    it('forwards the Authorization header', async () => {
      const res = await get('/api/me', { headers: { authorization: 'Bearer token-abc' } })
      expect((await res.json()).authorization).toBe('Bearer token-abc')
    })

    // The API only answers to its own hostname, which is why CloudFront's
    // origin request policy excludes Host.
    it('rewrites Host to the upstream, not the dev server', async () => {
      const res = await get('/api/me')
      expect((await res.json()).host).toBe(`localhost:${upstreamPort}`)
    })

    it('forwards the method and body', async () => {
      const res = await get('/api/sync/push', { method: 'POST', body: '{"records":[]}' })
      const seen = await res.json()
      expect(seen.method).toBe('POST')
      expect(seen.body).toBe('{"records":[]}')
    })

    it('passes the upstream status through rather than inventing one', async () => {
      const res = await get('/api/me')
      expect(res.status).toBe(201)
    })

    it('502s when the API cannot be reached', async () => {
      const offline = createDevServer({ apiEndpoint: 'http://localhost:1' })
      const offlinePort = await listen(offline)
      const res = await fetch(`http://localhost:${offlinePort}/api/me`)

      expect(res.status).toBe(502)
      await new Promise(resolve => offline.close(resolve))
    })

    it('503s when no API endpoint is configured at all', async () => {
      const local = createDevServer({ apiEndpoint: null })
      const localPort = await listen(local)
      const res = await fetch(`http://localhost:${localPort}/api/me`)

      expect(res.status).toBe(503)
      await new Promise(resolve => local.close(resolve))
    })
  })
})
