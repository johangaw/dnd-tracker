#!/usr/bin/env node
// CDK entry point.
//
// Two stacks: the application, and the IAM role CI deploys it with. Only the
// first is deployed by CI (see infra/README.md).

import { App } from 'aws-cdk-lib';
import { AppStack } from '../lib/app-stack.js';
import { GitHubOidcStack } from '../lib/github-oidc-stack.js';

const app = new App();

const appName = app.node.tryGetContext('appName') ?? 'dnd-tracker';
const githubRepo = app.node.tryGetContext('githubRepo') ?? 'johangaw/dnd-tracker';
const githubBranch = app.node.tryGetContext('githubBranch') ?? 'main';
// Pass -c createOidcProvider=false if this account already has GitHub's OIDC
// provider - there can only be one per issuer.
const createOidcProvider = app.node.tryGetContext('createOidcProvider') !== 'false';

// CDK_DEFAULT_* come from the ambient AWS credentials, so nothing is hardcoded
// to one account.
const env = {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION
};

// Custom domain. Both must be set together, and the certificate has to live in
// us-east-1 no matter which region this stack is in - that is a CloudFront
// requirement. They are read from context rather than passed as flags so CI,
// which runs a bare `cdk deploy`, picks them up from cdk.json too. Leave them
// unset and the app is served from its CloudFront domain, exactly as before.
const domainName = app.node.tryGetContext('domainName') || undefined;
const certificateArn = app.node.tryGetContext('certificateArn') || undefined;

if (Boolean(domainName) !== Boolean(certificateArn)) {
    throw new Error('domainName and certificateArn must be set together: CloudFront will not serve an alias without a matching us-east-1 certificate.');
}

// Only set this once the account's Lambda concurrency limit has been raised
// above the new-account default of 10; below that AWS rejects any reservation.
const reservedConcurrency = Number(app.node.tryGetContext('reservedConcurrency')) || undefined;

new AppStack(app, appName, { env, appName, reservedConcurrency, domainName, certificateArn });

new GitHubOidcStack(app, `${appName}-github-oidc`, {
    env,
    appName,
    githubRepo,
    githubBranch,
    createOidcProvider
});

app.synth();
