// Cognito access token verification, with no npm dependencies.
//
// Node's crypto can import a JWK directly, so verifying an RS256 signature
// against Cognito's published JWKS needs nothing beyond the standard library.
// That keeps the Lambda a set of plain .mjs files with no bundling step.

import crypto from 'node:crypto';

const CLOCK_SKEW_SECONDS = 60;
// Refetching on every unknown kid would let anyone with a bogus token drive
// requests to Cognito, so failed lookups are rate limited.
const JWKS_REFETCH_INTERVAL_MS = 60_000;

export class TokenError extends Error {
    constructor(message) {
        super(message);
        this.name = 'TokenError';
    }
}

function base64UrlDecode(segment) {
    return Buffer.from(segment.replace(/-/g, '+').replace(/_/g, '/'), 'base64');
}

function parseJson(buffer, what) {
    try {
        return JSON.parse(buffer.toString('utf8'));
    } catch {
        throw new TokenError(`Malformed token ${what}`);
    }
}

// Cached per Lambda container. Cognito rotates signing keys rarely, so this is
// effectively fetched once per cold start.
export function createJwksCache({ jwksUri, fetchImpl = fetch, now = () => Date.now() }) {
    let keys = null;
    let lastFetchAt = 0;

    async function refresh() {
        const response = await fetchImpl(jwksUri);
        if (!response.ok) {
            throw new TokenError(`Could not fetch JWKS (${response.status})`);
        }
        const body = await response.json();
        keys = new Map((body.keys || []).map(key => [key.kid, key]));
        lastFetchAt = now();
    }

    return async function getKey(kid) {
        if (!keys) await refresh();

        if (!keys.has(kid) && now() - lastFetchAt > JWKS_REFETCH_INTERVAL_MS) {
            await refresh();
        }

        const jwk = keys.get(kid);
        if (!jwk) throw new TokenError('Unknown signing key');
        return jwk;
    };
}

export function createVerifier({ issuer, clientId, getKey, now = () => Date.now() }) {
    return async function verify(token) {
        if (typeof token !== 'string' || token.length === 0) throw new TokenError('Missing token');

        const parts = token.split('.');
        if (parts.length !== 3) throw new TokenError('Malformed token');

        const [headerSegment, payloadSegment, signatureSegment] = parts;
        const header = parseJson(base64UrlDecode(headerSegment), 'header');

        // Pinning the algorithm is what stops the classic "alg: none" and
        // HMAC-with-the-public-key substitution attacks.
        if (header.alg !== 'RS256') throw new TokenError(`Unsupported algorithm: ${header.alg}`);
        if (!header.kid) throw new TokenError('Token has no key id');

        const jwk = await getKey(header.kid);
        const publicKey = crypto.createPublicKey({ key: jwk, format: 'jwk' });

        const signatureValid = crypto.verify(
            'RSA-SHA256',
            Buffer.from(`${headerSegment}.${payloadSegment}`, 'utf8'),
            publicKey,
            base64UrlDecode(signatureSegment)
        );
        if (!signatureValid) throw new TokenError('Invalid signature');

        const claims = parseJson(base64UrlDecode(payloadSegment), 'payload');
        const nowSeconds = Math.floor(now() / 1000);

        if (typeof claims.exp !== 'number' || claims.exp + CLOCK_SKEW_SECONDS < nowSeconds) {
            throw new TokenError('Token has expired');
        }
        if (typeof claims.iat === 'number' && claims.iat - CLOCK_SKEW_SECONDS > nowSeconds) {
            throw new TokenError('Token is not valid yet');
        }
        if (claims.iss !== issuer) throw new TokenError('Wrong issuer');

        // Access tokens, not id tokens: id tokens are for describing the user to
        // the client, not for authorising API calls, and carry no client_id.
        if (claims.token_use !== 'access') throw new TokenError('Not an access token');
        if (claims.client_id !== clientId) throw new TokenError('Wrong audience');
        if (!claims.sub) throw new TokenError('Token has no subject');

        return claims;
    };
}

export default { createVerifier, createJwksCache, TokenError };
