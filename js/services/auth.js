// Sign-in against Cognito's hosted UI, using the authorization code flow with
// PKCE and no AWS SDK.
//
// A browser cannot keep a client secret, so the app client is public and PKCE
// is what stops an intercepted authorization code from being redeemed by
// anyone else. The whole flow is three fetches and a redirect, which is far
// less machinery than pulling in amazon-cognito-identity-js would be.

import { CONFIG, isSyncConfigured } from '../config.js';

const AUTH_KEY = 'dnd-auth';
const PKCE_KEY = 'dnd-auth-pkce';
// Refresh a little before expiry so a sync in flight cannot straddle it.
const REFRESH_MARGIN_MS = 60_000;

function base64UrlEncode(bytes) {
    let binary = '';
    for (const byte of new Uint8Array(bytes)) binary += String.fromCharCode(byte);
    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function randomString(byteLength = 32) {
    return base64UrlEncode(crypto.getRandomValues(new Uint8Array(byteLength)));
}

// The redirect URI has to match what Cognito has registered byte for byte,
// including the trailing slash.
export function redirectUri() {
    return `${window.location.origin}/`;
}

// PKCE needs crypto.subtle, which browsers only expose in a secure context. So
// sign-in works on https and on localhost, but not when the dev server is
// opened from a phone at http://192.168.x.x.
export function canSignIn() {
    return isSyncConfigured() && Boolean(globalThis.isSecureContext && globalThis.crypto?.subtle);
}

export function readStored() {
    try {
        return JSON.parse(localStorage.getItem(AUTH_KEY)) || null;
    } catch {
        return null;
    }
}

function writeStored(auth) {
    if (auth) localStorage.setItem(AUTH_KEY, JSON.stringify(auth));
    else localStorage.removeItem(AUTH_KEY);
}

export function isSignedIn() {
    const auth = readStored();
    return Boolean(auth?.refreshToken);
}

export function getIdentity() {
    const auth = readStored();
    return auth ? { sub: auth.sub, email: auth.email } : null;
}

// The id token is our own and is only read for display and for the
// account-switch guard, never for authorisation, so decoding without verifying
// is fine here. The Lambda verifies the access token properly.
function decodeIdToken(idToken) {
    try {
        const payload = idToken.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
        return JSON.parse(atob(payload));
    } catch {
        return {};
    }
}

async function sha256(text) {
    return crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
}

export async function buildAuthorizeUrl() {
    const verifier = randomString();
    const state = randomString(16);
    const challenge = base64UrlEncode(await sha256(verifier));

    // sessionStorage, not localStorage: the verifier is only needed for this
    // one redirect and should not outlive the tab.
    sessionStorage.setItem(PKCE_KEY, JSON.stringify({ verifier, state }));

    const params = new URLSearchParams({
        response_type: 'code',
        client_id: CONFIG.clientId,
        redirect_uri: redirectUri(),
        scope: 'openid email',
        state,
        code_challenge_method: 'S256',
        code_challenge: challenge
    });

    return `https://${CONFIG.cognitoDomain}/oauth2/authorize?${params}`;
}

export async function signIn() {
    if (!canSignIn()) throw new Error('Signing in needs a secure (https) connection');
    window.location.assign(await buildAuthorizeUrl());
}

export function signOut({ redirect = true } = {}) {
    writeStored(null);
    sessionStorage.removeItem(PKCE_KEY);

    if (redirect && isSyncConfigured()) {
        const params = new URLSearchParams({
            client_id: CONFIG.clientId,
            logout_uri: redirectUri()
        });
        window.location.assign(`https://${CONFIG.cognitoDomain}/logout?${params}`);
    }
}

async function exchange(body) {
    const response = await fetch(`https://${CONFIG.cognitoDomain}/oauth2/token`, {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ client_id: CONFIG.clientId, ...body })
    });

    if (!response.ok) {
        const detail = await response.text().catch(() => '');
        throw new Error(`Token request failed (${response.status}) ${detail}`.trim());
    }
    return response.json();
}

function store(tokens, existingRefreshToken) {
    const claims = tokens.id_token ? decodeIdToken(tokens.id_token) : {};
    const auth = {
        accessToken: tokens.access_token,
        // Cognito does not return the refresh token again on a refresh grant.
        refreshToken: tokens.refresh_token || existingRefreshToken,
        expiresAt: Date.now() + (tokens.expires_in ?? 3600) * 1000,
        sub: claims.sub ?? readStored()?.sub ?? null,
        email: claims.email ?? readStored()?.email ?? null
    };
    writeStored(auth);
    return auth;
}

// Handles the ?code=... Cognito redirects back to. Must run before the router,
// so that a share link opened while signed out still works afterwards.
export async function handleRedirect() {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    const returnedState = params.get('state');
    const error = params.get('error');

    if (!code && !error) return null;

    clearAuthParams();

    if (error) {
        throw new Error(params.get('error_description') || error);
    }

    let pkce = null;
    try {
        pkce = JSON.parse(sessionStorage.getItem(PKCE_KEY));
    } catch { /* treated as missing below */ }
    sessionStorage.removeItem(PKCE_KEY);

    if (!pkce?.verifier) throw new Error('Sign-in could not be completed; please try again');
    // Guards against a code injected by another page.
    if (pkce.state !== returnedState) throw new Error('Sign-in state did not match; please try again');

    const tokens = await exchange({
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri(),
        code_verifier: pkce.verifier
    });

    return store(tokens);
}

export function clearAuthParams() {
    const url = new URL(window.location);
    for (const key of ['code', 'state', 'error', 'error_description']) {
        url.searchParams.delete(key);
    }
    window.history.replaceState({}, '', url);
}

let refreshInFlight = null;

// Returns a usable access token, refreshing it if it is close to expiry.
// Concurrent callers share one refresh rather than racing.
export async function getAccessToken() {
    const auth = readStored();
    if (!auth?.refreshToken) return null;

    if (auth.accessToken && auth.expiresAt - REFRESH_MARGIN_MS > Date.now()) {
        return auth.accessToken;
    }

    if (!refreshInFlight) {
        refreshInFlight = (async () => {
            try {
                const tokens = await exchange({
                    grant_type: 'refresh_token',
                    refresh_token: auth.refreshToken
                });
                return store(tokens, auth.refreshToken).accessToken;
            } catch (e) {
                // Cognito does not rotate refresh tokens, so after 30 days this
                // is simply how a session ends. Signing out locally leaves all
                // local data untouched.
                signOut({ redirect: false });
                throw e;
            } finally {
                refreshInFlight = null;
            }
        })();
    }

    return refreshInFlight;
}

export function resetForTests() {
    refreshInFlight = null;
}

export default {
    canSignIn,
    isSignedIn,
    getIdentity,
    signIn,
    signOut,
    handleRedirect,
    getAccessToken,
    buildAuthorizeUrl,
    redirectUri
};
