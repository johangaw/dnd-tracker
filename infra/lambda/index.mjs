// Lambda entry point, invoked through a Function URL.
//
// The Function URL is AuthType NONE, so this handler is publicly reachable and
// the token check in router.mjs is the only thing standing in front of the
// data. Reserved concurrency and the body size limit are the other two walls -
// see infra/lib/api-stack.js.
//
// CORS headers are configured on the Function URL itself, not here: setting
// them in both places produces duplicate headers and browsers reject every
// response.

import { createVerifier, createJwksCache } from './jwt.mjs';
import { route } from './router.mjs';
import { createDdb } from './ddb.mjs';

const {
    TABLE_NAME,
    COGNITO_USER_POOL_ID,
    COGNITO_CLIENT_ID,
    AWS_REGION
} = process.env;

const issuer = `https://cognito-idp.${AWS_REGION}.amazonaws.com/${COGNITO_USER_POOL_ID}`;

// Built once per container and reused across invocations, so the JWKS is
// fetched on cold start rather than per request.
const verify = createVerifier({
    issuer,
    clientId: COGNITO_CLIENT_ID,
    getKey: createJwksCache({ jwksUri: `${issuer}/.well-known/jwks.json` })
});

const ddb = createDdb({ tableName: TABLE_NAME });

export async function handler(event) {
    const request = {
        method: event.requestContext?.http?.method ?? 'GET',
        path: event.rawPath ?? '/',
        headers: event.headers ?? {},
        body: event.isBase64Encoded && event.body
            ? Buffer.from(event.body, 'base64').toString('utf8')
            : event.body
    };

    const { statusCode, body } = await route(request, {
        verify,
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
