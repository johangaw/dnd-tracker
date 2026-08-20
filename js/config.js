// Backend configuration, filled in from the CDK stack outputs.
//
// These are not secrets - a Cognito user pool id and public app client id are
// designed to be visible in a browser - so this file is checked in. It is
// written by hand rather than generated, because generating it would mean
// adding a build step to an app that deliberately has none.
//
// Get the values with:
//   aws cloudformation describe-stacks --stack-name dnd-tracker-api \
//     --query 'Stacks[0].Outputs' --output table
//
// While these are blank the app runs exactly as it always has: entirely local,
// no accounts, no network. Sync is strictly additive.

export const CONFIG = {
    region: '',
    userPoolId: '',
    clientId: '',
    cognitoDomain: '',
    apiBase: ''
};

export function isSyncConfigured() {
    return Boolean(CONFIG.userPoolId && CONFIG.clientId && CONFIG.cognitoDomain && CONFIG.apiBase);
}

export default { CONFIG, isSyncConfigured };
