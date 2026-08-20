#!/usr/bin/env node
// CDK entry point. Both stacks are declared here; only the site stack is
// deployed by CI (see infra/README.md).

import { App } from 'aws-cdk-lib';
import { SiteStack } from '../lib/site-stack.js';
import { ApiStack } from '../lib/api-stack.js';
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

const site = new SiteStack(app, `${appName}-site`, { env, appName });

// The API needs the site's URL for the Cognito callback and for CORS, so CDK
// deploys the site stack first and passes the value across.
new ApiStack(app, `${appName}-api`, {
    env,
    appName,
    siteUrl: site.siteUrl
});

new GitHubOidcStack(app, `${appName}-github-oidc`, {
    env,
    appName,
    githubRepo,
    githubBranch,
    createOidcProvider
});

app.synth();
