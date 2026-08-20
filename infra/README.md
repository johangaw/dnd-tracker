# Infrastructure

Hosting for the D&D Tracker: a private S3 bucket behind CloudFront, defined with
the AWS CDK and deployed from GitHub Actions. Everything here sits inside AWS's
permanently-free tier at this app's scale.

CI owns infrastructure as well as content, so **pushing to `main` is the single
path to production**. The one exception is the OIDC stack below, which has to be
applied by hand because it is what grants CI its permissions in the first place.

| File | What it is |
|---|---|
| `bin/app.js` | CDK entry point; declares all three stacks |
| `lib/site-stack.js` | The site: S3 bucket, CloudFront, OAC, cache and security-header policies |
| `lib/api-stack.js` | Sync backend: DynamoDB, Cognito, and one Lambda behind a Function URL |
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
purely locally until this step. Read the values off the API stack:

```sh
aws cloudformation describe-stacks --stack-name dnd-tracker-api \
  --query 'Stacks[0].Outputs' --output table
```

Copy `ApiBaseUrl`, `UserPoolId`, `UserPoolClientId` and `CognitoDomain` into
[`js/config.js`](../js/config.js), set `region`, and push. A Sync section then
appears in Settings.

This file is written by hand rather than generated: none of these values are
secrets — a user pool id and a public app client id are meant to be visible in a
browser — and generating it would mean adding a build step to an app that
deliberately has none.

CloudFront takes 5–15 minutes to roll out the first time. The URL is printed at
the end, and is also available later as:

```sh
aws cloudformation describe-stacks --stack-name dnd-tracker-site \
  --query "Stacks[0].Outputs[?OutputKey=='SiteUrl'].OutputValue" --output text
```

## Day-to-day

```sh
cd infra
npx cdk diff dnd-tracker-site    # what would change
npm run synth                    # render the CloudFormation locally
node csp-check.mjs               # after adding any new external resource
```

`csp-check.mjs` needs a browser once: `npx playwright install chromium`.

## Things that are load-bearing

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

**403 and 404 both map to `/index.html`.** Under OAC, S3 returns 403 rather than
404 for a key that does not exist, so mapping only 404 would leave stray paths
broken.

**The CSP allows `'unsafe-inline'` for styles but not scripts.** The components
set inline `style` attributes; `index.html` has one external module and no
inline script. `img-src` includes `https://5e.tools` because the stat block
modal loads monster token images from there. `csp-check.mjs` imports the policy
directly from `lib/site-stack.js`, so the check cannot drift from what is
actually deployed — run it after adding any new external resource, or the
breakage will only appear in production.

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

**The Lambda has reserved concurrency of 10.** Its Function URL is `AuthType:
NONE`, so it is reachable by anyone on the internet and the token check in
`lambda/router.mjs` is the only thing in front of the data. The concurrency cap,
the 1 MB body limit and DynamoDB's fixed capacity are the three walls that keep
an abusive caller from costing anything.

**Sync CORS is configured on the Function URL, not in the handler.** Setting the
headers in both places produces duplicates and browsers reject every response.
Preflight is answered by the Function URL and never invokes the function, so it
never appears in the logs.

**Cognito threat protection is off.** It is billed per monthly active user and is
not in the free tier.

**The deploy role's trust policy is pinned** to
`repo:<owner>/<repo>:ref:refs/heads/main`. Without that condition any GitHub
repository in the world could assume it. Change the repo via
`-c githubRepo=owner/name`.

## Cost

Everything used here has a *permanent* free tier: CloudFront 1 TB/month out and
10M requests, Lambda 1M requests, DynamoDB 25 GB plus 25 provisioned RCU/WCU,
Cognito 10,000 monthly active users, CloudWatch Logs 5 GB. S3 costs a few cents
for ~20 MB of storage, and DynamoDB point-in-time recovery adds roughly $0.02 for
a database this size — enabled deliberately, because it holds the only server
copy of the data. Expect **$0.00–0.05/month**.

Worth setting an AWS Budget alert at $1 anyway. Adding a custom domain later
means a Route 53 hosted zone at $0.50/month (the ACM certificate itself is free,
but must be issued in `us-east-1` for CloudFront).
