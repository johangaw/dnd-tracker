#!/usr/bin/env node
//
// The local development server. Run it with `npm run dev`.
//
// It exists because the deployed app is served by CloudFront, which does three
// things a plain static file server does not: it serves the sync API from /api
// on the app's own origin, it rewrites extensionless paths to the app shell,
// and it sends a strict Content-Security-Policy. Developing against a server
// that does none of those means UI work only meets the real conditions after it
// is merged.
//
// So this mirrors all three. The API calls are proxied to the real deployed
// HTTP API, which keeps every request same-origin exactly as in production -
// no CORS is involved here, just as none is involved there.
//
// Port 3000 is not arbitrary: http://localhost:3000/ is a registered Cognito
// callback URL, so signing in works here and nowhere else locally.

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { buildContentSecurityPolicy } from '../infra/lib/csp.mjs';
import { CONFIG } from '../js/config.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = Number(process.env.PORT || 3000);
const STACK_NAME = process.env.STACK_NAME || 'dnd-tracker';
const AWS_REGION = process.env.AWS_REGION || CONFIG.region || 'eu-north-1';

const TYPES = {
    '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
    '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png',
    '.ico': 'image/x-icon', '.webmanifest': 'application/manifest+json'
};

// Where to send /api. Set API_ENDPOINT to override; otherwise the stack output
// is read once at startup. Failing to find it is not fatal - the app runs
// perfectly well with no backend at all, which is how it shipped originally -
// so sync is simply disabled for the session.
function resolveApiEndpoint() {
    if (process.env.API_ENDPOINT) return process.env.API_ENDPOINT.replace(/\/$/, '');

    try {
        const value = execFileSync('aws', [
            'cloudformation', 'describe-stacks',
            '--region', AWS_REGION,
            '--stack-name', STACK_NAME,
            '--query', "Stacks[0].Outputs[?OutputKey=='ApiEndpoint'].OutputValue",
            '--output', 'text'
        ], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();

        return value && value !== 'None' ? value.replace(/\/$/, '') : null;
    } catch {
        return null;
    }
}

// Forwards a request to the deployed API unchanged. The Authorization header
// has to survive the trip, and Host must not: the API only answers to its own
// execute-api hostname. CloudFront's origin request policy does exactly this.
async function proxyToApi(req, res, apiEndpoint) {
    const body = req.method === 'GET' || req.method === 'HEAD'
        ? undefined
        : await new Promise(resolve => {
            const chunks = [];
            req.on('data', chunk => chunks.push(chunk));
            req.on('end', () => resolve(Buffer.concat(chunks)));
        });

    const headers = { ...req.headers };
    delete headers.host;
    delete headers.connection;

    try {
        const upstream = await fetch(`${apiEndpoint}${req.url}`, {
            method: req.method,
            headers,
            body
        });
        const text = await upstream.text();

        res.statusCode = upstream.status;
        res.setHeader('Content-Type', upstream.headers.get('content-type') || 'application/json');
        res.end(text);
    } catch (e) {
        console.error(`  ${req.method} ${req.url} -> proxy failed: ${e.message}`);
        res.statusCode = 502;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ error: 'Dev proxy could not reach the API' }));
    }
}

// Exported so the parity with CloudFront can actually be tested rather than
// just asserted in a comment.
export function createDevServer({ apiEndpoint = null, cognitoDomain = CONFIG.cognitoDomain } = {}) {
    const contentSecurityPolicy = buildContentSecurityPolicy({ cognitoDomain });

    return http.createServer(async (req, res) => {
        const url = decodeURIComponent(req.url.split('?')[0]);

        if (url.startsWith('/api/')) {
            if (!apiEndpoint) {
                res.statusCode = 503;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ error: 'No API endpoint configured for this dev session' }));
                return;
            }
            await proxyToApi(req, res, apiEndpoint);
            return;
        }

        let file = path.join(ROOT, url === '/' ? 'index.html' : url);

        // The same rule as the CloudFront function: an extensionless path is a
        // route and becomes the app shell, while a missing *file* stays a 404
        // rather than quietly turning into HTML. The ROOT check makes a
        // traversal attempt land on the shell too.
        if (!file.startsWith(ROOT) || !path.extname(file)) {
            file = path.join(ROOT, 'index.html');
        }

        if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) {
            res.statusCode = 404;
            res.end('Not found');
            return;
        }

        res.setHeader('Content-Security-Policy', contentSecurityPolicy);
        res.setHeader('Content-Type', TYPES[path.extname(file)] || 'application/octet-stream');
        res.end(fs.readFileSync(file));
    });
}

// Only when run directly, so importing this for tests does not bind a port.
if (process.argv[1] === fileURLToPath(import.meta.url)) {
    const apiEndpoint = resolveApiEndpoint();

    createDevServer({ apiEndpoint }).listen(PORT, () => {
        console.log(`\n  D&D Tracker  http://localhost:${PORT}\n`);
        console.log(`  api    ${apiEndpoint ? `/api -> ${apiEndpoint}` : 'not configured - the app runs local-only'}`);
        console.log(`  csp    ${CONFIG.cognitoDomain ? 'on, matching production' : 'on, without a Cognito host (js/config.js is empty)'}`);
        console.log(`  auth   ${CONFIG.clientId ? 'sign-in available' : 'unavailable until js/config.js is filled in'}\n`);
    });
}
