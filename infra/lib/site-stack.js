// Static hosting for the D&D Tracker: a private S3 bucket behind CloudFront.
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

// Styles need 'unsafe-inline' because the components set inline style
// attributes; scripts stay strict, since index.html loads a single external
// module and has no inline script. 5e.tools is allowed for images only,
// because the stat block modal loads monster token art from there.
//
// This policy is exercised against every view by infra/csp-check.mjs - widen it
// there first if you add an external resource, or the breakage will only show
// up in production.
//
// connect-src has to cover the two backends the app talks to: the Lambda
// Function URL for sync and the Cognito hosted UI for the token exchange.
// Neither hostname is known here - the API stack is built after this one, and
// making this stack depend on it would be circular - so both are matched by
// host pattern, narrowed to this region where possible.
export function buildContentSecurityPolicy(region) {
    return [
        "default-src 'self'",
        "script-src 'self'",
        "style-src 'self' 'unsafe-inline'",
        "img-src 'self' data: https://5e.tools",
        `connect-src 'self' https://*.lambda-url.${region}.on.aws https://*.auth.${region}.amazoncognito.com`,
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

export class SiteStack extends Stack {
    constructor(scope, id, props = {}) {
        super(scope, id, props);

        const appName = props.appName ?? 'dnd-tracker';

        const bucket = new s3.Bucket(this, 'SiteBucket', {
            bucketName: `${appName}-site-${this.account}`,
            blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
            encryption: s3.BucketEncryption.S3_MANAGED,
            enforceSSL: true,
            // Everything in here can be regenerated from the repository, but
            // retaining avoids a stack mistake quietly deleting the live site.
            removalPolicy: RemovalPolicy.RETAIN
        });

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
                contentSecurityPolicy: { contentSecurityPolicy: buildContentSecurityPolicy(this.region), override: true },
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

        // withOriginAccessControl wires up the OAC and writes a bucket policy
        // scoped to this distribution, so nothing but CloudFront can read it.
        const origin = origins.S3BucketOrigin.withOriginAccessControl(bucket);

        const sharedBehavior = {
            origin,
            viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
            allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD_OPTIONS,
            cachedMethods: cloudfront.CachedMethods.CACHE_GET_HEAD,
            compress: true,
            responseHeadersPolicy: securityHeaders
        };

        const distribution = new cloudfront.Distribution(this, 'Distribution', {
            comment: `${appName} static site`,
            defaultRootObject: 'index.html',
            httpVersion: cloudfront.HttpVersion.HTTP2_AND_3,
            enableIpv6: true,
            // North America and Europe. The free tier covers far more traffic
            // than this app will ever produce.
            priceClass: cloudfront.PriceClass.PRICE_CLASS_100,
            defaultBehavior: { ...sharedBehavior, cachePolicy: appCachePolicy },
            additionalBehaviors: {
                'data/*': { ...sharedBehavior, cachePolicy: dataCachePolicy }
            },
            errorResponses: [
                // Under OAC, S3 returns 403 rather than 404 for a key that does
                // not exist, so both have to be mapped back to the app.
                { httpStatus: 403, responseHttpStatus: 200, responsePagePath: '/index.html', ttl: Duration.seconds(10) },
                { httpStatus: 404, responseHttpStatus: 200, responsePagePath: '/index.html', ttl: Duration.seconds(10) }
            ]
        });

        // Stable logical ids, because deploy.sh reads these by name. CDK would
        // otherwise append a hash and the lookup would break.
        const output = (id, value, description) => {
            const out = new CfnOutput(this, id, { value, description });
            out.overrideLogicalId(id);
            return out;
        };

        output('BucketName', bucket.bucketName, 'S3 bucket holding the app files');
        output('DistributionId', distribution.distributionId, 'CloudFront distribution id, used to invalidate on deploy');
        output('SiteUrl', `https://${distribution.distributionDomainName}`, 'Public URL of the app');

        this.bucket = bucket;
        this.distribution = distribution;
        this.siteUrl = `https://${distribution.distributionDomainName}`;
    }
}
