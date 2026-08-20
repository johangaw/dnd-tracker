# Infrastructure

Hosting for the D&D Tracker: a private S3 bucket behind CloudFront, deployed
from GitHub Actions. Everything here sits inside AWS's permanently-free tier at
this app's scale.

Plain CloudFormation and the `aws` CLI, deliberately. CDK needs Node
dependencies and a bootstrap stack, SAM needs its own CLI and a build step, and
Terraform needs state storage and a binary — while this repo has no build
tooling at all and the app is served exactly as it sits in git.

| File | What it is |
|---|---|
| `template.yaml` | The site: S3 bucket, CloudFront distribution, OAC, cache and security-header policies |
| `github-oidc.yaml` | The IAM role GitHub Actions assumes to deploy. Separate stack because the OIDC provider is account-wide |
| `deploy.sh` | Uploads the app and invalidates the cache. CI runs this same script |

## One-time setup

Needs the [AWS CLI](https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html)
(`brew install awscli`) and credentials with admin rights on your own account
(`aws configure`).

### 1. Create the site

```sh
./infra/deploy.sh --stack
```

This creates the stack and does the first upload. CloudFront takes 5–15 minutes
to finish rolling out the first time. The script prints the URL when it is done;
you can also get it later with:

```sh
aws cloudformation describe-stacks --stack-name dnd-tracker-site \
  --query "Stacks[0].Outputs[?OutputKey=='SiteUrl'].OutputValue" --output text
```

### 2. Let GitHub Actions deploy

```sh
aws cloudformation deploy \
  --stack-name dnd-tracker-github-oidc \
  --template-file infra/github-oidc.yaml \
  --capabilities CAPABILITY_NAMED_IAM \
  --parameter-overrides GitHubRepo=johangaw/dnd-tracker
```

If the account already has GitHub's OIDC provider (another project may have
created it — there can only be one), add
`CreateOIDCProvider=false` to the parameter overrides.

Then take the printed role ARN and add it to the repository under
**Settings → Secrets and variables → Actions**:

- Secret `AWS_DEPLOY_ROLE` — the role ARN
- Variable `AWS_REGION` — optional, defaults to `eu-north-1`

From then on every push to `main` runs the tests and, if they pass, deploys.

## Day-to-day

- **App changes** deploy themselves on push to `main`. Nothing to run by hand.
- **Infrastructure changes** are applied locally with `./infra/deploy.sh --stack`.
  The CI role deliberately cannot modify the stack — it can only upload files
  and invalidate the cache — so a compromised workflow cannot rewrite your
  infrastructure.
- **Re-deploy without a commit**: the Deploy workflow has a `workflow_dispatch`
  trigger, so you can run it from the Actions tab.

## Things that are load-bearing

**`--size-only` on `aws s3 sync`.** A CI checkout gives every file a fresh
mtime, so the default size-and-mtime comparison would re-upload the ~17 MB
`data/` tree on every single deploy.

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
modal loads monster token images from there. The policy is verified against
every view in the app — if you add a new external resource, expect a silent
breakage in production unless you widen it here.

**The bucket policy is scoped to this distribution's ARN**, so another
account's distribution cannot be pointed at the bucket.

## Cost

Everything used here has a *permanent* free tier: CloudFront 1 TB/month out and
10M requests, S3 at a few cents for ~20 MB of storage. Expect **$0.00–0.01/month**.

Worth setting an AWS Budget alert at $1 anyway, and note that adding a custom
domain later means a Route 53 hosted zone at $0.50/month (the ACM certificate
itself is free, but must be issued in `us-east-1` for CloudFront).
