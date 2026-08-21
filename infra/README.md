# Infrastructure

Hosting and backend for the D&D Tracker: a private S3 bucket and an HTTP API,
both behind one CloudFront distribution, defined with the AWS CDK and deployed
from GitHub Actions.

The app and the API share a single origin. CloudFront serves the app from S3 and
routes `/api/*` to API Gateway, so nothing the browser does is cross-origin.
That is what removes CORS configuration, the preflight, and any need to tell the
app where its backend lives.

CI owns infrastructure as well as content, so **pushing to `main` is the single
path to production**. The one exception is the OIDC stack below, which has to be
applied by hand because it is what grants CI its permissions in the first place.

| File | What it is |
|---|---|
| `bin/app.js` | CDK entry point; declares both stacks |
| `lib/app-stack.js` | Everything: S3, CloudFront, Cognito, DynamoDB, Lambda, HTTP API |
| `lib/csp.mjs` | The Content-Security-Policy, shared by the stack, the check and the dev server |
| `lib/github-oidc-stack.js` | The IAM role GitHub Actions assumes. Bootstrap only |
| `lambda/` | The sync handler. Plain `.mjs`, no dependencies, no build step |
| `deploy.sh` | Uploads the app and invalidates the cache. CI runs this same script |
| `csp-check.mjs` | Loads the app under the real CSP and fails on any violation |

This is a separate npm project from the app on purpose: the CDK's dependencies
stay out of the app's install, so `npm ci && npm test` at the root remains fast
and the app itself keeps its zero-runtime-dependency property.

## One-time setup

Needs the [AWS CLI](https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html)
(`brew install awscli`) and credentials with admin rights on your own account
(`aws configure`).

### 1. Bootstrap the CDK

Once per account and region. This creates the roles and asset bucket that
`cdk deploy` uses.

```sh
cd infra
npm install
npx cdk bootstrap
```

### 2. Create the deploy role

```sh
cd infra
npx cdk deploy dnd-tracker-github-oidc
```

If the account already has GitHub's OIDC provider — there can only be one per
issuer, so another project may have created it — add
`-c createOidcProvider=false`.

Take the printed `DeployRoleArn` and add it to the repository under
**Settings → Secrets and variables → Actions**:

- Secret `AWS_DEPLOY_ROLE` — the role ARN
- Variable `AWS_REGION` — optional, defaults to `eu-north-1`

### 3. Push

From here on, every push to `main` runs the tests and then deploys both the
infrastructure and the app. To create everything immediately without waiting for
a push, run the Deploy workflow from the Actions tab, or locally:

```sh
./infra/deploy.sh --stack
```

### 4. Point the app at the backend

Sync stays invisible until `js/config.js` is filled in, so the app ships and runs
purely locally until this step. Read the values off the stack:

```sh
aws cloudformation describe-stacks --stack-name dnd-tracker \
  --query 'Stacks[0].Outputs' --output table
```

Copy `UserPoolId`, `UserPoolClientId` and `CognitoDomain` into
[`js/config.js`](../js/config.js), set `region`, and push. A Sync section then
appears in Settings. There is no API URL to copy: `apiBase` is the literal path
`/api` on the app's own origin.

This file is written by hand rather than generated: none of these values are
secrets — a user pool id and a public app client id are meant to be visible in a
browser — and generating it would mean adding a build step to an app that
deliberately has none.

CloudFront takes 5–15 minutes to roll out the first time. The URL is printed at
the end, and is also available later as:

```sh
aws cloudformation describe-stacks --stack-name dnd-tracker \
  --query "Stacks[0].Outputs[?OutputKey=='SiteUrl'].OutputValue" --output text
```

## Day-to-day

```sh
cd infra
npx cdk diff dnd-tracker         # what would change
npm run synth                    # render the CloudFormation locally
node csp-check.mjs               # after adding any new external resource
```

`csp-check.mjs` needs a browser once: `npx playwright install chromium`.

## Running the app locally

```sh
npm run dev        # http://localhost:3000
```

[`scripts/dev-server.mjs`](../scripts/dev-server.mjs) stands in for CloudFront,
because a plain static file server is not a fair test of anything: it does not
serve the API from the app's own origin, it does not rewrite extensionless paths
to the app shell, and it sends no Content-Security-Policy. UI work developed
against one of those only meets the real conditions after it is merged.

So the dev server does all three. `/api/*` is proxied to the **deployed** HTTP
API, which keeps every request same-origin exactly as in production — no CORS is
involved locally, just as none is involved in production. It finds the endpoint
from the `ApiEndpoint` stack output using your AWS credentials; set
`API_ENDPOINT` to override, or `PORT` to move off 3000.

Sign-in works locally too: `http://localhost:3000/` is a registered Cognito
callback URL, PKCE's secure-context requirement treats localhost as secure, and
Cognito's token endpoint accepts any origin. Port 3000 is the only port where
this holds — the callback URL is registered, not inferred.

None of it is required. With no AWS credentials and an empty `js/config.js` the
server still runs and the app is fully usable offline, which is how it shipped
before sync existed; the startup banner says which of the three are active.

The parity is covered by `tests/tools/dev-server.test.js`, so a change to the
CloudFront behaviours that is not mirrored here shows up as a failing test
rather than as a surprise after deploying.

## Things that are load-bearing

**One stack, not two.** Every interesting value crosses between hosting and
backend: the Cognito callback needs the CloudFront domain, the CSP needs the
Cognito domain, and CloudFront needs the API endpoint as an origin. Split across
stacks those had to be wildcards and hand-copied outputs.

**API Gateway verifies the token, not the handler.** The HTTP API's JWT
authorizer checks the Cognito access token's signature, issuer, expiry and
client id before the Lambda is invoked. A bad token therefore costs nothing —
it never reaches a billed invocation — and there is no JWKS-fetching RS256
verifier in this repository to get wrong.

**Every route requires the `openid` scope.** API Gateway cannot tell an access
token from an id token: an id token from the same pool has the same issuer and
the same audience and would otherwise be accepted. Id tokens carry no `scope`
claim, so requiring one rejects them. `lambda/router.mjs` asserts
`token_use === 'access'` as a second, independent check.

**The stage is throttled at 20 requests/second.** The API endpoint is public —
authentication is not the same as rate limiting — so this, the Lambda's reserved
concurrency of 10, the 1 MB body limit and DynamoDB's fixed capacity are what
keep an abusive caller from costing anything.

**There is no CORS configuration anywhere, deliberately.** The browser reaches
the API at `/api/*` on the app's own origin. Adding CORS headers in the handler
as well as the platform used to produce duplicates that browsers reject; now
there is nothing to duplicate.

**Content upload is `aws s3 sync`, not a CDK `BucketDeployment`.** The construct
would bundle the ~17 MB `data/` tree into a CDK asset and push it through a
Lambda-backed custom resource on every deploy. The sync uploads only what
changed.

**`--size-only` on that sync.** A CI checkout gives every file a fresh mtime, so
the default size-and-mtime comparison would re-upload all 100+ bestiary files
every time regardless.

**The invalidation never uses `/*`.** That would evict the immutable bestiary
files too and make every user re-download them. Only `/`, `/index.html`,
`/manifest.json`, `/js/*` and `/css/*` are invalidated — the app's own files are
not content-hashed, which is also why they are served with a 60-second
`max-age` while `data/` gets a year.

**The SPA fallback is a CloudFront function, not a custom error response.**
Mapping 403 and 404 to `/index.html` is the usual trick, but custom error
responses apply to the whole distribution and cannot be scoped to one behaviour.
Once the API shares this distribution, that would have rewritten a genuine 403
or 404 from the API into an HTTP 200 page of HTML. The function rewrites only
extensionless paths, so a failed fetch of a missing bestiary file still surfaces
as an error instead of as the app shell.

**The CSP allows `'unsafe-inline'` for styles but not scripts.** The components
set inline `style` attributes; `index.html` has one external module and no
inline script. `img-src` includes `https://5e.tools` because the stat block
modal loads monster token images from there. `connect-src` is `'self'` plus the
Cognito hosted UI, which is the one host the app genuinely has to reach
cross-origin — the token exchange. `csp-check.mjs` imports the policy directly
from `lib/app-stack.js`, so the check cannot drift from what is actually
deployed.

**The site bucket is `RemovalPolicy.RETAIN`.** Its contents are all reproducible
from git, but retaining means a stack mistake cannot silently delete the live
site. The DynamoDB table and the Cognito user pool are `RETAIN` for a much
stronger reason: they hold the only copy of the users' data and accounts.

**The DynamoDB index has to be right the first time.** `ChangesBySv` is a *local*
secondary index, and AWS only allows an LSI to be created together with its
table. Changing it later means rebuilding the table and migrating the data. It is
what makes the delta pull a single query on one partition.

**DynamoDB is in provisioned mode, with autoscaling off.** The always-free 25
RCU/25 WCU applies to provisioned capacity only; on-demand has no perpetual free
tier. With autoscaling off, a runaway bug throttles and retries instead of
billing.

**Cognito threat protection is off.** It is billed per monthly active user and is
not in the free tier.

**The deploy role's trust policy is scoped to this repository.** Without that
condition any GitHub repository in the world could assume it. Change the repo
via `-c githubRepo=owner/name`.

It accepts two subject claims, and the reason is a trap worth knowing about:
GitHub changes the shape of the `sub` claim depending on the job. A job that
declares an `environment:` — as the deploy job does — gets
`repo:<owner>/<repo>:environment:production`, and that **replaces** the ref
form rather than adding to it. A job without one gets
`repo:<owner>/<repo>:ref:refs/heads/main`. Trusting only the ref form makes
every run fail at "Configure AWS credentials" with nothing more useful than
`Not authorized to perform sts:AssumeRoleWithWebIdentity`.

Because the environment subject carries no branch, the branch restriction for
that path lives in GitHub instead: set a deployment branch policy on the
`production` environment (Settings → Environments → production → Deployment
branches) to limit it to `main`.

**After changing this stack, deploy it by hand** — `npx cdk deploy
dnd-tracker-github-oidc`. CI cannot apply it, because it defines the role CI
authenticates as.

## Cost

Almost everything here has a *permanent* free tier: CloudFront 1 TB/month out,
10M requests and 2M function invocations, Lambda 1M requests, DynamoDB 25 GB
plus 25 provisioned RCU/WCU, Cognito 10,000 monthly active users, CloudWatch
Logs 5 GB. S3 costs a few cents for ~20 MB of storage, and DynamoDB
point-in-time recovery adds roughly $0.02 for a database this size — enabled
deliberately, because it holds the only server copy of the data.

The one exception is **API Gateway**, whose HTTP API free tier is 1M requests a
month for the first twelve months only, and $1.00 per million after that. At
this app's traffic that is a fraction of a cent, and it is the price of not
maintaining a hand-written token verifier.

Expect **$0.00–0.05/month**. Worth setting an AWS Budget alert at $1 anyway.
Adding a custom domain later means a Route 53 hosted zone at $0.50/month (the
ACM certificate itself is free, but must be issued in `us-east-1` for
CloudFront).
