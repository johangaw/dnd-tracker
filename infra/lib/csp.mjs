// The Content-Security-Policy CloudFront serves, as a plain module with no
// dependencies.
//
// It lives apart from the stack so that three things can share one definition:
// the CDK stack that deploys it, infra/csp-check.mjs which tests the app under
// it, and scripts/dev-server.mjs which serves it locally. Importing it from the
// stack would drag aws-cdk-lib into the app's dev loop.
//
// Everything the browser fetches is same-origin, because CloudFront serves the
// API at /api/* from the same domain as the app. The one exception is Cognito:
// the token exchange is a cross-origin POST to the hosted UI domain, and no
// amount of routing changes that.
//
// Styles need 'unsafe-inline' because the components set inline style
// attributes; scripts stay strict, since index.html loads a single external
// module and has no inline script. 5e.tools is allowed for images only,
// because the stat block modal loads monster token art from there.
//
// This policy is exercised against every view by infra/csp-check.mjs - widen it
// there first if you add an external resource, or the breakage will only show
// up in production.
export function buildContentSecurityPolicy({ cognitoDomain } = {}) {
    // Before js/config.js is filled in there is no hosted UI to allow, and an
    // empty host would make connect-src unparseable.
    const connectSrc = ["connect-src 'self'", cognitoDomain && `https://${cognitoDomain}`]
        .filter(Boolean)
        .join(' ');

    return [
        "default-src 'self'",
        "script-src 'self'",
        "style-src 'self' 'unsafe-inline'",
        "img-src 'self' data: https://5e.tools",
        connectSrc,
        "font-src 'self'",
        "manifest-src 'self'",
        "object-src 'none'",
        "base-uri 'self'",
        // The sign-in redirect leaves the app entirely, so this only has to
        // permit the Cognito hosted UI to be navigated to as a form target.
        "form-action 'self'",
        "frame-ancestors 'none'"
    ].join('; ');
}

export default { buildContentSecurityPolicy };
