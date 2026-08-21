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

// Only set this once the account's Lambda concurrency limit has been raised
// above the new-account default of 10; below that AWS rejects any reservation.
const reservedConcurrency = Number(app.node.tryGetContext('reservedConcurrency')) || undefined;

new AppStack(app, appName, { env, appName, reservedConcurrency });

new GitHubOidcStack(app, `${appName}-github-oidc`, {
    env,
    appName,
    githubRepo,
    githubBranch,
    createOidcProvider
});

app.synth();
