// The sync backend: DynamoDB, Cognito, and one Lambda behind a Function URL.
//
// Everything here is inside AWS's permanently-free tier at this app's scale.
// The two things that cost money if you get them wrong are DynamoDB's billing
// mode and an uncapped public Lambda, and both are pinned below.

import { Stack, CfnOutput, RemovalPolicy, Duration } from 'aws-cdk-lib';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));

export class ApiStack extends Stack {
    constructor(scope, id, props = {}) {
        super(scope, id, props);

        const appName = props.appName ?? 'dnd-tracker';
        // Origins allowed to call the API and to receive the OAuth redirect.
        // Cognito permits plain http only for localhost, so a phone on the LAN
        // cannot be used for sign-in - it needs the deployed https origin.
        const allowedOrigins = [props.siteUrl, 'http://localhost:3000'].filter(Boolean);

        // ---------------------------------------------------------------
        // Storage
        // ---------------------------------------------------------------

        // One table, one partition per user. The only key the Lambda ever
        // builds is USER#<sub> taken from a verified token, so no query in the
        // system can cross from one user's data to another's - isolation is
        // structural rather than a rule that has to be applied correctly.
        const table = new dynamodb.Table(this, 'SyncTable', {
            tableName: `${appName}-sync`,
            partitionKey: { name: 'PK', type: dynamodb.AttributeType.STRING },
            sortKey: { name: 'SK', type: dynamodb.AttributeType.STRING },
            // The always-free 25 RCU/25 WCU applies to provisioned mode only;
            // on-demand has no perpetual free tier. Autoscaling is left off so
            // that a bug throttles and retries rather than billing.
            billingMode: dynamodb.BillingMode.PROVISIONED,
            readCapacity: 5,
            writeCapacity: 5,
            pointInTimeRecoverySpecification: { pointInTimeRecoveryEnabled: true },
            // This is the users' actual data. Never let a stack operation
            // delete it.
            removalPolicy: RemovalPolicy.RETAIN
        });

        // Delta pull: query one partition for everything written after the
        // client's cursor. A local secondary index shares the table's
        // partition key and its provisioned capacity, so this needs no extra
        // capacity allocation the way a GSI would.
        //
        // The index is sparse - only items carrying an `sv` attribute appear in
        // it - and, critically, an LSI can only be created together with the
        // table. Adding one later means rebuilding the table, so this has to be
        // right before the first deploy.
        table.addLocalSecondaryIndex({
            indexName: 'ChangesBySv',
            sortKey: { name: 'sv', type: dynamodb.AttributeType.NUMBER },
            projectionType: dynamodb.ProjectionType.ALL
        });

        // ---------------------------------------------------------------
        // Identity
        // ---------------------------------------------------------------

        const userPool = new cognito.UserPool(this, 'UserPool', {
            userPoolName: `${appName}-users`,
            selfSignUpEnabled: true,
            signInAliases: { email: true },
            autoVerify: { email: true },
            standardAttributes: { email: { required: true, mutable: true } },
            passwordPolicy: {
                minLength: 12,
                requireLowercase: true,
                requireUppercase: false,
                requireDigits: true,
                requireSymbols: false
            },
            accountRecovery: cognito.AccountRecovery.EMAIL_ONLY,
            // Deleting the pool would delete every account in it.
            removalPolicy: RemovalPolicy.RETAIN
        });

        // Advanced security / threat protection is billed per monthly active
        // user and is deliberately left off.

        const userPoolDomain = userPool.addDomain('UserPoolDomain', {
            cognitoDomain: { domainPrefix: `${appName}-${this.account}` }
        });

        const userPoolClient = userPool.addClient('WebClient', {
            userPoolClientName: `${appName}-web`,
            // A browser cannot keep a secret, so this is a public client and
            // sign-in uses PKCE instead.
            generateSecret: false,
            oAuth: {
                flows: {
                    authorizationCodeGrant: true,
                    // Implicit grant puts tokens in the URL and browser history.
                    implicitCodeGrant: false
                },
                scopes: [cognito.OAuthScope.OPENID, cognito.OAuthScope.EMAIL],
                callbackUrls: allowedOrigins.map(origin => `${origin}/`),
                logoutUrls: allowedOrigins.map(origin => `${origin}/`)
            },
            accessTokenValidity: Duration.hours(1),
            idTokenValidity: Duration.hours(1),
            // Cognito does not rotate refresh tokens, so this is how long a
            // device can go without a fresh sign-in.
            refreshTokenValidity: Duration.days(30),
            preventUserExistenceErrors: true,
            enableTokenRevocation: true
        });

        // ---------------------------------------------------------------
        // API
        // ---------------------------------------------------------------

        const logGroup = new logs.LogGroup(this, 'SyncFunctionLogs', {
            logGroupName: `/aws/lambda/${appName}-sync`,
            // Without an explicit retention, logs accumulate forever.
            retention: logs.RetentionDays.ONE_WEEK,
            removalPolicy: RemovalPolicy.DESTROY
        });

        const syncFunction = new lambda.Function(this, 'SyncFunction', {
            functionName: `${appName}-sync`,
            runtime: lambda.Runtime.NODEJS_22_X,
            handler: 'index.handler',
            // Plain .mjs files with no dependencies: the AWS SDK ships in the
            // managed runtime, so there is nothing to install or bundle.
            code: lambda.Code.fromAsset(path.join(HERE, '..', 'lambda')),
            memorySize: 256,
            timeout: Duration.seconds(10),
            logGroup,
            environment: {
                TABLE_NAME: table.tableName,
                COGNITO_USER_POOL_ID: userPool.userPoolId,
                COGNITO_CLIENT_ID: userPoolClient.userPoolClientId
            },
            // The Function URL below is unauthenticated at the edge, so this
            // cap is what stops anyone on the internet from running up a bill
            // or exhausting the account's concurrency.
            reservedConcurrentExecutions: 10
        });

        table.grantReadWriteData(syncFunction);

        const functionUrl = syncFunction.addFunctionUrl({
            // The handler verifies a Cognito token itself. IAM auth here would
            // require SigV4 from the browser, which means the AWS SDK and a
            // build step - neither of which this app has.
            authType: lambda.FunctionUrlAuthType.NONE,
            cors: {
                // Configured here and *only* here. Setting CORS headers in the
                // handler as well produces duplicates, and browsers reject
                // every response that has them.
                allowedOrigins,
                allowedMethods: [lambda.HttpMethod.GET, lambda.HttpMethod.POST],
                allowedHeaders: ['content-type', 'authorization'],
                maxAge: Duration.days(1)
            }
        });

        const output = (id, value, description) => {
            const out = new CfnOutput(this, id, { value, description });
            out.overrideLogicalId(id);
        };

        // These four are what js/config.js needs.
        output('ApiBaseUrl', functionUrl.url.replace(/\/$/, ''), 'Sync API base URL');
        output('UserPoolId', userPool.userPoolId, 'Cognito user pool id');
        output('UserPoolClientId', userPoolClient.userPoolClientId, 'Cognito app client id');
        output('CognitoDomain', `${userPoolDomain.domainName}.auth.${this.region}.amazoncognito.com`,
            'Cognito hosted UI domain');

        this.table = table;
        this.userPool = userPool;
    }
}
