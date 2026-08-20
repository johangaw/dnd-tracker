// The IAM role GitHub Actions assumes to deploy, via GitHub's OIDC provider -
// so no long-lived AWS access keys are ever stored in GitHub.
//
// This is the one stack that has to be deployed by hand, because it is what
// grants CI its permissions in the first place. Everything else, including the
// site stack itself, is deployed by CI.

import { Stack, CfnOutput } from 'aws-cdk-lib';
import * as iam from 'aws-cdk-lib/aws-iam';

const GITHUB_ISSUER = 'token.actions.githubusercontent.com';

export class GitHubOidcStack extends Stack {
    constructor(scope, id, props = {}) {
        super(scope, id, props);

        const {
            githubRepo = 'johangaw/dnd-tracker',
            githubBranch = 'main',
            appName = 'dnd-tracker',
            // There can only be one OIDC provider per issuer per account, so if
            // another project already created it, import instead of creating.
            createOidcProvider = true,
            // The CDK bootstrap qualifier. Only change this if the account was
            // bootstrapped with a custom one.
            cdkQualifier = 'hnb659fds'
        } = props;

        const importedArn = `arn:aws:iam::${this.account}:oidc-provider/${GITHUB_ISSUER}`;

        // The L1 CfnOIDCProvider is a native CloudFormation resource. The L2
        // iam.OpenIdConnectProvider is still implemented as a Lambda-backed
        // custom resource, which would mean deploying a function and its role
        // purely to create an OIDC provider.
        const providerArn = createOidcProvider
            ? new iam.CfnOIDCProvider(this, 'GitHubOidcProvider', {
                url: `https://${GITHUB_ISSUER}`,
                clientIdList: ['sts.amazonaws.com']
            }).attrArn
            : importedArn;

        const role = new iam.Role(this, 'DeployRole', {
            roleName: `${appName}-github-deploy`,
            description: 'Assumed by GitHub Actions to deploy the D&D Tracker',
            assumedBy: new iam.WebIdentityPrincipal(providerArn, {
                StringEquals: {
                    [`${GITHUB_ISSUER}:aud`]: 'sts.amazonaws.com'
                },
                StringLike: {
                    // Pinned to one branch of one repository. Without this
                    // condition, any GitHub repo in the world could assume it.
                    [`${GITHUB_ISSUER}:sub`]: `repo:${githubRepo}:ref:refs/heads/${githubBranch}`
                }
            })
        });

        // CI owns infrastructure deployment as well as content. `cdk deploy`
        // works by assuming the roles that `cdk bootstrap` created, so this is
        // the permission that lets CI change infrastructure.
        role.addToPolicy(new iam.PolicyStatement({
            sid: 'AssumeCdkBootstrapRoles',
            actions: ['sts:AssumeRole'],
            resources: [`arn:aws:iam::${this.account}:role/cdk-${cdkQualifier}-*`]
        }));

        // The CDK CLI reads the bootstrap version before it assumes anything.
        role.addToPolicy(new iam.PolicyStatement({
            sid: 'ReadCdkBootstrapVersion',
            actions: ['ssm:GetParameter'],
            resources: [`arn:aws:ssm:*:${this.account}:parameter/cdk-bootstrap/${cdkQualifier}/version`]
        }));

        role.addToPolicy(new iam.PolicyStatement({
            sid: 'ReadStackOutputs',
            actions: ['cloudformation:DescribeStacks'],
            resources: [`arn:aws:cloudformation:*:${this.account}:stack/*`]
        }));

        // The content upload in deploy.sh runs as this role directly, not
        // through CDK, so it needs the site bucket explicitly.
        role.addToPolicy(new iam.PolicyStatement({
            sid: 'SyncSiteFiles',
            actions: ['s3:ListBucket', 's3:GetObject', 's3:PutObject', 's3:DeleteObject'],
            resources: [
                `arn:aws:s3:::${appName}-site-${this.account}`,
                `arn:aws:s3:::${appName}-site-${this.account}/*`
            ]
        }));

        role.addToPolicy(new iam.PolicyStatement({
            sid: 'InvalidateCache',
            actions: ['cloudfront:CreateInvalidation', 'cloudfront:GetInvalidation'],
            resources: [`arn:aws:cloudfront::${this.account}:distribution/*`]
        }));

        const out = new CfnOutput(this, 'DeployRoleArn', {
            value: role.roleArn,
            description: 'Set this as the AWS_DEPLOY_ROLE secret in GitHub'
        });
        out.overrideLogicalId('DeployRoleArn');

        this.role = role;
    }
}
