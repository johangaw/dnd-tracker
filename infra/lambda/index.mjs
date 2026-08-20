// Lambda entry point, invoked by API Gateway through a Lambda proxy
// integration (payload format 2.0).
//
// Authentication happens before this runs: the HTTP API's JWT authorizer has
// already verified the Cognito access token's signature, issuer, expiry and
// client id, and rejected the request outright if any of that failed. What
// arrives here is a set of trusted claims, so there is no token handling in
// this codebase at all.
//
// CORS is absent for the same reason it is absent from the stack: the browser
// reaches this at /api/* on the app's own CloudFront origin, so nothing about
// these requests is cross-origin.

import { route } from './router.mjs';
import { createDdb } from './ddb.mjs';

const { TABLE_NAME } = process.env;

const ddb = createDdb({ tableName: TABLE_NAME });

export async function handler(event) {
    const request = {
        method: event.requestContext?.http?.method ?? 'GET',
        path: event.rawPath ?? '/',
        // Verified by API Gateway. Every value in this map is a string.
        claims: event.requestContext?.authorizer?.jwt?.claims ?? null,
        body: event.isBase64Encoded && event.body
            ? Buffer.from(event.body, 'base64').toString('utf8')
            : event.body
    };

    const { statusCode, body } = await route(request, {
        ddb,
        now: Date.now,
        logError: e => console.error('Unhandled error:', e)
    });

    return {
        statusCode,
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body)
    };
}
