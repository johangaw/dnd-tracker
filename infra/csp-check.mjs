#!/usr/bin/env node
//
// Loads the app under the exact Content-Security-Policy that CloudFront will
// serve, and fails if any view triggers a violation.
//
// A CSP mistake is invisible locally and only breaks things once deployed, so
// this imports the policy straight from the CDK stack rather than restating it.
//
// Run it with:
//   npx playwright install chromium     # once
//   node infra/csp-check.mjs
//
// Not wired into CI, because it would mean shipping a browser download into the
// deploy path. Run it whenever the app starts loading a new kind of resource.

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildContentSecurityPolicy } from './lib/site-stack.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = 4322;
const REGION = process.env.AWS_REGION || 'eu-north-1';
const CONTENT_SECURITY_POLICY = buildContentSecurityPolicy(REGION);

// Stand-ins for the real backends, matching the shapes the policy has to allow.
const FAKE_API = `https://abcdef123.lambda-url.${REGION}.on.aws`;
const FAKE_COGNITO = `dnd-tracker-123.auth.${REGION}.amazoncognito.com`;

let chromium;
try {
    ({ chromium } = await import('playwright'));
} catch {
    console.error('playwright is not installed. Run:\n  npm i -D playwright && npx playwright install chromium');
    process.exit(2);
}

const TYPES = {
    '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
    '.json': 'application/json', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json'
};

const server = http.createServer((req, res) => {
    const url = decodeURIComponent(req.url.split('?')[0]);
    let file = path.join(ROOT, url === '/' ? 'index.html' : url);
    // Mirror CloudFront's 403/404 fallback to the app shell.
    if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
        file = path.join(ROOT, 'index.html');
    }
    res.setHeader('Content-Security-Policy', CONTENT_SECURITY_POLICY);
    res.setHeader('Content-Type', TYPES[path.extname(file)] || 'application/octet-stream');
    res.end(fs.readFileSync(file));
});

await new Promise(resolve => server.listen(PORT, resolve));
console.log(`Policy under test:\n  ${CONTENT_SECURITY_POLICY}\n`);

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 420, height: 860 } });

const violations = [];
const errors = [];
page.on('console', m => {
    const text = m.text();
    if (/Content Security Policy|Refused to/i.test(text)) violations.push(text);
    else if (m.type() === 'error') errors.push(text);
});
page.on('pageerror', e => errors.push(String(e)));

// Seed an encounter so the detail views have something to render.
await page.addInitScript(() => {
    localStorage.setItem('dnd-schema-version', '1');
    localStorage.setItem('dnd-encounters', JSON.stringify([{
        id: 'aaaaaaaa-0000-4000-8000-000000000001',
        title: 'CSP Check',
        pcs: [{ name: 'Hero' }],
        monsters: [{ name: 'Goblin', source: 'MM', cr: '1/4', hp: 7 }],
        folderIds: [],
        updatedAt: Date.now()
    }]));
});

const routes = [
    '#/encounters',
    '#/monsters',
    '#/characters',
    '#/settings',
    '#/characters/new',
    '#/encounters/aaaaaaaa-0000-4000-8000-000000000001'
];

for (const route of routes) {
    await page.goto(`http://localhost:${PORT}/${route}`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(400);
    const rendered = await page.locator('.view.active').count() > 0;
    console.log(`  ${rendered ? 'ok  ' : 'FAIL'} ${route}`);
    if (!rendered) errors.push(`No active view rendered for ${route}`);
}

// The bestiary is fetched at runtime, so connect-src has to allow it.
const dataFetched = await page.evaluate(async () => (await fetch('/data/bestiary/index.json')).ok);
console.log(`  ${dataFetched ? 'ok  ' : 'FAIL'} reference data fetch`);
if (!dataFetched) errors.push('Could not fetch /data/bestiary/index.json under the policy');

// The two backends the app talks to. A CSP that blocks these would leave the
// app looking fine until the moment someone tries to sign in or sync, so they
// are checked explicitly rather than left to be discovered in production.
// Both are stubbed, so what is being tested is whether the request is allowed
// to leave the page at all, not whether anything answers.
for (const [label, url] of [
    ['sync API request allowed', `${FAKE_API}/sync/pull`],
    ['Cognito token request allowed', `https://${FAKE_COGNITO}/oauth2/token`]
]) {
    await page.route(url, r => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }));
    const allowed = await page.evaluate(async target => {
        try {
            await fetch(target, { method: 'POST', body: '{}' });
            return true;
        } catch {
            // A CSP block surfaces to the page as a rejected fetch.
            return false;
        }
    }, url);
    console.log(`  ${allowed ? 'ok  ' : 'FAIL'} ${label}`);
    if (!allowed) errors.push(`Policy blocks ${url}`);
}

await browser.close();
server.close();

if (violations.length || errors.length) {
    if (violations.length) console.error('\nCSP violations:\n' + violations.map(v => '  ' + v).join('\n'));
    if (errors.length) console.error('\nErrors:\n' + errors.map(e => '  ' + e).join('\n'));
    process.exit(1);
}

console.log('\nNo CSP violations.');
