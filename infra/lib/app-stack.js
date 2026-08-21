// The whole application: static hosting, identity, storage, and the sync API.
//
// One stack rather than two, because every interesting value crosses between
// them. The Cognito callback needs the CloudFront domain, the CSP needs the
// Cognito domain, and CloudFront needs the API endpoint as an origin. Split
// across stacks those had to be wildcards and hand-copied outputs; in one
// stack they are just references.
//
// The bucket holds only files that are reproducible from git, and the actual
// upload is done by infra/deploy.sh rather than a BucketDeployment construct.
// That is deliberate: BucketDeployment would bundle the ~17 MB data/ tree into
// a CDK asset and push it through a Lambda-backed custom resource on every
// deploy, where `aws s3 sync --size-only` uploads only what actually changed.

import { Stack, CfnOutput, RemovalPolicy, Duration } from 'aws-cdk-lib';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as apigw from 'aws-cdk-lib/aws-apigatewayv2';
import { HttpUserPoolAuthorizer } from 'aws-cdk-lib/aws-apigatewayv2-authorizers';
import { HttpLambdaIntegration } from 'aws-cdk-lib/aws-apigatewayv2-integrations';
import { buildContentSecurityPolicy } from './csp.mjs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));

export class AppStack extends Stack {
    constructor(scope, id, props = {}) {
        super(scope, id, props);

        const appName = props.appName ?? 'dnd-tracker';
        // See the note on the sync function below: only usable once the
        // account's Lambda concurrency limit has been raised above 10.
        const reservedConcurrency = props.reservedConcurrency;

        // ---------------------------------------------------------------
        // Storage
        // ---------------------------------------------------------------

        const bucket = new s3.Bucket(this, 'SiteBucket', {
            bucketName: `${appName}-site-${this.account}`,
            blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
            encryption: s3.BucketEncryption.S3_MANAGED,
            enforceSSL: true,
            // Everything in here can be regenerated from the repository, but
            // retaining avoids a stack mistake quietly deleting the live site.
            removalPolicy: RemovalPolicy.RETAIN
        });

        // One table, one partition per user. The only key the Lambda ever
        // builds is USER#<sub> taken from verified claims, so no query in the
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

        // The prefix is derived rather than generated, so the CSP below can
        // name this domain before the resource exists.
        const cognitoDomainPrefix = `${appName}-${this.account}`;
        const cognitoDomain = `${cognitoDomainPrefix}.auth.${this.region}.amazoncognito.com`;

        userPool.addDomain('UserPoolDomain', {
            cognitoDomain: { domainPrefix: cognitoDomainPrefix }
        });

        // ---------------------------------------------------------------
        // Hosting
        // ---------------------------------------------------------------

        // The app's own files are not content-hashed, so they cannot be cached
        // hard - a deploy has to be able to take effect. One minute, plus an
        // invalidation on deploy, keeps that honest without hammering S3.
        const appCachePolicy = new cloudfront.CachePolicy(this, 'AppCachePolicy', {
            cachePolicyName: `${appName}-app`,
            defaultTtl: Duration.minutes(1),
            minTtl: Duration.seconds(0),
            maxTtl: Duration.minutes(5),
            enableAcceptEncodingGzip: true,
            enableAcceptEncodingBrotli: true,
            // Share links carry ?import=..., but the response is the same
            // index.html regardless, so query strings stay out of the cache key.
            queryStringBehavior: cloudfront.CacheQueryStringBehavior.none(),
            headerBehavior: cloudfront.CacheHeaderBehavior.none(),
            cookieBehavior: cloudfront.CacheCookieBehavior.none()
        });

        // The bestiary, spell and class files are immutable reference data.
        const dataCachePolicy = new cloudfront.CachePolicy(this, 'DataCachePolicy', {
            cachePolicyName: `${appName}-data`,
            defaultTtl: Duration.days(365),
            minTtl: Duration.days(1),
            maxTtl: Duration.days(365),
            enableAcceptEncodingGzip: true,
            enableAcceptEncodingBrotli: true,
            queryStringBehavior: cloudfront.CacheQueryStringBehavior.none(),
            headerBehavior: cloudfront.CacheHeaderBehavior.none(),
            cookieBehavior: cloudfront.CacheCookieBehavior.none()
        });

        const securityHeaders = new cloudfront.ResponseHeadersPolicy(this, 'SecurityHeadersPolicy', {
            responseHeadersPolicyName: `${appName}-security-headers`,
            securityHeadersBehavior: {
                contentSecurityPolicy: {
                    contentSecurityPolicy: buildContentSecurityPolicy({ cognitoDomain }),
                    override: true
                },
                contentTypeOptions: { override: true },
                frameOptions: { frameOption: cloudfront.HeadersFrameOption.DENY, override: true },
                referrerPolicy: {
                    referrerPolicy: cloudfront.HeadersReferrerPolicy.SAME_ORIGIN,
                    override: true
                },
                strictTransportSecurity: {
                    accessControlMaxAge: Duration.days(365),
                    includeSubdomains: true,
                    override: true
                }
            }
        });

        // The app is hash-routed, so every real path is a real file. This only
        // catches the rest: a bare /encounters, a stale link, a typo.
        //
        // It replaces what used to be a pair of distribution-wide 403/404 ->
        // index.html error responses. Those cannot be scoped to one behaviour,
        // so once the API shares this distribution they would have rewritten a
        // genuine 403 or 404 from the API into an HTTP 200 page of HTML.
        const spaFallback = new cloudfront.Function(this, 'SpaFallback', {
            functionName: `${appName}-spa-fallback`,
            runtime: cloudfront.FunctionRuntime.JS_2_0,
            code: cloudfront.FunctionCode.fromInline(`
function handler(event) {
    var request = event.request;
    var lastSegment = request.uri.slice(request.uri.lastIndexOf('/') + 1);
    // Anything without a file extension is a route, not a file. Requests for a
    // missing *file* are deliberately left alone, so a failed fetch of a
    // bestiary file surfaces as an error rather than as HTML.
    if (lastSegment.indexOf('.') === -1) request.uri = '/index.html';
    return request;
}
            `.trim())
        });

        // withOriginAccessControl wires up the OAC and writes a bucket policy
        // scoped to this distribution, so nothing but CloudFront can read it.
        const siteOrigin = origins.S3BucketOrigin.withOriginAccessControl(bucket);

        const sharedBehavior = {
            origin: siteOrigin,
            viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
            allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD_OPTIONS,
            cachedMethods: cloudfront.CachedMethods.CACHE_GET_HEAD,
            compress: true,
            responseHeadersPolicy: securityHeaders
        };

        const distribution = new cloudfront.Distribution(this, 'Distribution', {
            comment: `${appName} app and sync API`,
            defaultRootObject: 'index.html',
            httpVersion: cloudfront.HttpVersion.HTTP2_AND_3,
            enableIpv6: true,
            // North America and Europe. The free tier covers far more traffic
            // than this app will ever produce.
            priceClass: cloudfront.PriceClass.PRICE_CLASS_100,
            defaultBehavior: {
                ...sharedBehavior,
                cachePolicy: appCachePolicy,
                functionAssociations: [{
                    function: spaFallback,
                    eventType: cloudfront.FunctionEventType.VIEWER_REQUEST
                }]
            },
            additionalBehaviors: {
                'data/*': { ...sharedBehavior, cachePolicy: dataCachePolicy }
            }
        });

        const siteUrl = `https://${distribution.distributionDomainName}`;

        // ---------------------------------------------------------------
        // Identity, continued: the client needs the site URL as its callback
        // ---------------------------------------------------------------

        // Cognito permits plain http only for localhost, so a phone on the LAN
        // cannot be used for sign-in - it needs the deployed https origin.
        const callbackOrigins = [siteUrl, 'http://localhost:3000'];

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
                callbackUrls: callbackOrigins.map(origin => `${origin}/`),
                logoutUrls: callbackOrigins.map(origin => `${origin}/`)
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
        // Sync API
        // ---------------------------------------------------------------

        const logGroup = new logs.LogGroup(this, 'SyncFunctionLogs', {
            logGroupName: `/aws/lambda/${appName}-sync`,
            // Without an explicit retention, logs accumulate forever.
            retention: logs.RetentionDays.ONE_WEEK,
            removalPolicy: RemovalPolicy.DESTROY
        });

        const syncFunction = new lambda.Function(this, 'SyncFunction', {
            functionName: `${appName}-sync`,
            runtime: lambda.Runtime.NODEJS_24_X,
            handler: 'index.handler',
            // Plain .mjs files with no dependencies: the AWS SDK ships in the
            // managed runtime, so there is nothing to install or bundle.
            code: lambda.Code.fromAsset(path.join(HERE, '..', 'lambda')),
            memorySize: 256,
            timeout: Duration.seconds(10),
            logGroup,
            environment: { TABLE_NAME: table.tableName },
            // Reserving concurrency is opt-in, because a new AWS account has a
            // total concurrency limit of 10 and Lambda refuses any reservation
            // that would leave fewer than 10 unreserved - which means *no*
            // reservation is possible until the account limit is raised.
            //
            // Nothing is really lost by leaving it off. The guards that matter
            // are the JWT authorizer, which stops unauthenticated calls
            // reaching the function at all, and the stage throttle below. On a
            // 10-concurrency account the account limit is itself the cap.
            //
            // Once the limit has been raised, pass -c reservedConcurrency=10 to
            // stop this one function from monopolising the pool.
            ...(reservedConcurrency ? { reservedConcurrentExecutions: reservedConcurrency } : {})
        });

        table.grantReadWriteData(syncFunction);

        // API Gateway verifies the Cognito access token - signature, issuer,
        // expiry, and client id - before the function is ever invoked. That
        // replaces a hand-written JWKS-fetching RS256 verifier, and it means an
        // invalid token costs nothing: it is rejected at the edge of the API
        // rather than inside a billed invocation.
        const authorizer = new HttpUserPoolAuthorizer('CognitoAuthorizer', userPool, {
            userPoolClients: [userPoolClient],
            identitySource: ['$request.header.Authorization']
        });

        const httpApi = new apigw.HttpApi(this, 'SyncApi', {
            apiName: `${appName}-sync`,
            description: 'Delta sync for the D&D Tracker',
            // No CORS configuration anywhere, deliberately: the browser reaches
            // this through CloudFront at /api/* on the app's own origin, so
            // there is no cross-origin request to preflight.
            createDefaultStage: true
        });

        // Routes carry the /api prefix that CloudFront forwards verbatim, so
        // nothing has to rewrite the path on the way through.
        httpApi.addRoutes({
            path: '/api/sync/pull',
            methods: [apigw.HttpMethod.POST],
            integration: new HttpLambdaIntegration('SyncPull', syncFunction),
            authorizer,
            // An access token carries `scope`; a Cognito id token does not, so
            // requiring a scope is what stops an id token from being accepted
            // as an API credential. API Gateway itself cannot tell the two
            // apart. The handler asserts `token_use` as well.
            authorizationScopes: ['openid']
        });
        httpApi.addRoutes({
            path: '/api/sync/push',
            methods: [apigw.HttpMethod.POST],
            integration: new HttpLambdaIntegration('SyncPush', syncFunction),
            authorizer,
            authorizationScopes: ['openid']
        });
        httpApi.addRoutes({
            path: '/api/me',
            methods: [apigw.HttpMethod.GET],
            integration: new HttpLambdaIntegration('Me', syncFunction),
            authorizer,
            authorizationScopes: ['openid']
        });

        // The API endpoint is public, so this is the wall that keeps an abusive
        // caller from costing anything. There is no CDK-level prop for it.
        httpApi.defaultStage.node.defaultChild.defaultRouteSettings = {
            throttlingRateLimit: 20,
            throttlingBurstLimit: 40
        };

        // ---------------------------------------------------------------
        // Hosting, continued: the API as a second origin on one domain
        // ---------------------------------------------------------------

        // Serving the API from the app's own origin is what removes CORS, the
        // preflight, the wildcard in connect-src, and the absolute API URL the
        // app used to have to be told about.
        const apiDomain = `${httpApi.apiId}.execute-api.${this.region}.${this.urlSuffix}`;

        distribution.addBehavior('api/*', new origins.HttpOrigin(apiDomain), {
            viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.HTTPS_ONLY,
            allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
            // A sync response is per-user and never reusable.
            cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
            // Forwards the Authorization header. Host is excluded because the
            // origin has to see its own execute-api hostname, not the app's.
            originRequestPolicy: cloudfront.OriginRequestPolicy.ALL_VIEWER_EXCEPT_HOST_HEADER
        });

        // ---------------------------------------------------------------
        // Outputs
        // ---------------------------------------------------------------

        // Stable logical ids, because deploy.sh reads these by name. CDK would
        // otherwise append a hash and the lookup would break.
        const output = (id, value, description) => {
            const out = new CfnOutput(this, id, { value, description });
            out.overrideLogicalId(id);
        };

        output('BucketName', bucket.bucketName, 'S3 bucket holding the app files');
        output('DistributionId', distribution.distributionId, 'CloudFront distribution id, used to invalidate on deploy');
        output('SiteUrl', siteUrl, 'Public URL of the app');
        // These three are what js/config.js needs. There is no fourth: the API
        // lives at /api on this same origin.
        output('UserPoolId', userPool.userPoolId, 'Cognito user pool id');
        output('UserPoolClientId', userPoolClient.userPoolClientId, 'Cognito app client id');
        output('CognitoDomain', cognitoDomain, 'Cognito hosted UI domain');
        output('ApiEndpoint', httpApi.apiEndpoint, 'Direct API Gateway endpoint, bypassing CloudFront');

        this.bucket = bucket;
        this.distribution = distribution;
        this.table = table;
        this.userPool = userPool;
        this.siteUrl = siteUrl;
    }
}
