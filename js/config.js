// Backend configuration, filled in from the CDK stack outputs.
//
// These are not secrets - a Cognito user pool id and public app client id are
// designed to be visible in a browser - so this file is checked in. It is
// written by hand rather than generated, because generating it would mean
// adding a build step to an app that deliberately has none.
//
// Get the values with:
//   aws cloudformation describe-stacks --stack-name dnd-tracker \
//     --query 'Stacks[0].Outputs' --output table
//
// While these are blank the app runs exactly as it always has: entirely local,
// no accounts, no network. Sync is strictly additive.

export const CONFIG = {
    region: '',
    userPoolId: '',
    clientId: '',
    cognitoDomain: '',
    // Not a stack output and not something to change: CloudFront serves the
    // sync API from this path on the app's own origin, which is what keeps
    // every sync request same-origin and free of CORS. Point it at the
    // ApiEndpoint output only if you are running the app from somewhere that
    // is not behind that distribution.
    apiBase: '/api'
};

export function isSyncConfigured() {
    return Boolean(CONFIG.userPoolId && CONFIG.clientId && CONFIG.cognitoDomain && CONFIG.apiBase);
}

export default { CONFIG, isSyncConfigured };
