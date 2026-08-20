// Request routing and record validation for the sync API.
//
// Deliberately pure: `route()` takes its dependencies as arguments so the whole
// surface can be tested with a fake DynamoDB, without the AWS SDK ever being
// imported.
//
// Tokens are not handled here. API Gateway's JWT authorizer verifies the
// Cognito access token before the function is invoked and hands over the
// claims, so this module's job is to trust `sub` and nothing else.

// Mirrors SYNCED_KEYS in js/services/records.js. Anything not listed here is
// rejected, so a client cannot invent collections and use the table as
// arbitrary storage.
export const COLLECTIONS = {
    'dnd-encounters': 'ENC',
    'dnd-custom-monsters': 'MON',
    'dnd-characters': 'CHR',
    'dnd-monster-folders': 'FLDM',
    'dnd-encounter-folders': 'FLDE'
};

export const MAX_RECORDS_PER_PUSH = 25;
export const MAX_RECORD_BYTES = 350_000; // DynamoDB's item limit is 400 KB
export const MAX_BODY_BYTES = 1_000_000;
export const PULL_PAGE_LIMIT = 200;

// Records are ordered by `sv`, a server-assigned millisecond timestamp, and the
// client pulls everything with sv > cursor. Two devices pushing at the same
// moment can interleave: device A can be assigned an sv, device B can be
// assigned a later one and commit first, and a pull in between would advance
// the cursor past A's record before it lands - losing it silently.
//
// So the server always looks back a fixed window beyond the cursor. Re-fetching
// a record is harmless because applying a pull is idempotent (the client
// compares updatedAt and keeps the newer copy), and the window only has to
// cover how long a write can be in flight, which is bounded by the Lambda
// timeout of a few seconds. Five minutes is enormous by comparison.
export const PULL_SLACK_MS = 5 * 60 * 1000;

// CloudFront serves the API under /api on the app's own origin and forwards the
// path unchanged, so the routes below are declared without the prefix and it is
// stripped on the way in.
const PATH_PREFIX = '/api';

class HttpError extends Error {
    constructor(statusCode, message) {
        super(message);
        this.statusCode = statusCode;
    }
}

const ok = body => ({ statusCode: 200, body });

function assert(condition, statusCode, message) {
    if (!condition) throw new HttpError(statusCode, message);
}

function parseBody(request) {
    if (!request.body) return {};
    assert(Buffer.byteLength(request.body, 'utf8') <= MAX_BODY_BYTES, 413, 'Request body too large');
    try {
        return JSON.parse(request.body);
    } catch {
        throw new HttpError(400, 'Request body is not valid JSON');
    }
}

// The authorizer cannot reach this function without a valid token, so these
// checks are about what *kind* of token it was, not whether it was genuine.
function identify(request) {
    const claims = request.claims;
    assert(claims && typeof claims === 'object', 401, 'Missing token claims');
    // An id token from the same pool has the same issuer and audience and would
    // satisfy a plain JWT check. Routes require the `openid` scope, which id
    // tokens do not carry, and this is the second half of that guard.
    assert(claims.token_use === 'access', 401, 'Not an access token');
    assert(typeof claims.sub === 'string' && claims.sub.length > 0, 401, 'Token has no subject');

    return { sub: claims.sub, email: claims.email ?? null };
}

function validateRecord(record) {
    assert(record && typeof record === 'object', 400, 'Each record must be an object');
    assert(COLLECTIONS[record.col], 400, `Unknown collection: ${record.col}`);
    assert(typeof record.id === 'string' && record.id.length > 0 && record.id.length <= 128,
        400, 'Each record needs a string id');
    assert(Number.isFinite(record.updatedAt), 400, 'Each record needs a numeric updatedAt');

    const isTombstone = record.deletedAt != null;
    assert(isTombstone || (record.data && typeof record.data === 'object'),
        400, 'A live record needs a data object');

    if (record.data) {
        assert(Buffer.byteLength(JSON.stringify(record.data), 'utf8') <= MAX_RECORD_BYTES,
            413, `Record ${record.id} is too large to store`);
    }
}

async function handlePull(request, { sub }, { ddb, now }) {
    const { cursor } = parseBody(request);
    const since = Number.isFinite(cursor) ? Math.max(0, cursor - PULL_SLACK_MS) : 0;

    const { records, maxSv } = await ddb.listChanges({ sub, sinceSv: since, limit: PULL_PAGE_LIMIT });

    return ok({
        records,
        // Never move the cursor backwards: an empty page must not rewind a
        // client that is already up to date.
        cursor: Math.max(maxSv ?? 0, Number.isFinite(cursor) ? cursor : 0),
        now: now()
    });
}

async function handlePush(request, { sub }, { ddb, now }) {
    const { records } = parseBody(request);
    assert(Array.isArray(records), 400, 'Expected a records array');
    assert(records.length <= MAX_RECORDS_PER_PUSH, 400,
        `At most ${MAX_RECORDS_PER_PUSH} records per push`);

    records.forEach(validateRecord);

    // Server time, made unique within this request so that two records written
    // together can never share an sv and hide each other behind the cursor.
    let previousSv = 0;
    const stamped = records.map(record => {
        const sv = Math.max(now(), previousSv + 1);
        previousSv = sv;
        return { ...record, sv };
    });

    const { applied, conflicts } = await ddb.putRecords({ sub, records: stamped });

    return ok({ applied, conflicts, now: now() });
}

async function handleMe(_request, identity, { now }) {
    return ok({ sub: identity.sub, email: identity.email, now: now() });
}

const ROUTES = [
    { method: 'POST', path: '/sync/pull', handler: handlePull },
    { method: 'POST', path: '/sync/push', handler: handlePush },
    { method: 'GET', path: '/me', handler: handleMe }
];

export async function route(request, deps) {
    try {
        let path = (request.path || '/').replace(/\/+$/, '') || '/';
        if (path.startsWith(PATH_PREFIX)) path = path.slice(PATH_PREFIX.length) || '/';

        const match = ROUTES.find(r => r.path === path);

        if (!match) throw new HttpError(404, 'Not found');
        assert(match.method === request.method, 405, 'Method not allowed');

        // `sub` comes only from the verified claims. No handler ever reads an
        // identity from the body, so a caller cannot address another user's
        // partition.
        const identity = identify(request);

        return await match.handler(request, identity, deps);
    } catch (e) {
        if (e instanceof HttpError) {
            return { statusCode: e.statusCode, body: { error: e.message } };
        }
        deps.logError?.(e);
        return { statusCode: 500, body: { error: 'Internal error' } };
    }
}

export default { route, COLLECTIONS };
