#!/usr/bin/env bash
#
# Uploads the app to S3 and invalidates the CloudFront cache.
#
#   ./infra/deploy.sh              upload content only
#   ./infra/deploy.sh --stack      run `cdk deploy` for the infrastructure first
#
# Infrastructure itself is defined with the CDK (infra/lib/*.js) and is deployed
# by CI. Content upload stays here rather than using a CDK BucketDeployment,
# because that would push the ~17 MB data/ tree through a Lambda-backed custom
# resource on every deploy instead of syncing only what changed.

set -euo pipefail

STACK_NAME="${STACK_NAME:-dnd-tracker}"
AWS_REGION="${AWS_REGION:-eu-north-1}"
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

APP_NAME="${APP_NAME:-dnd-tracker}"

if [[ "${1:-}" == "--stack" ]]; then
  # The OIDC stack is not deployed here: it defines the role CI runs as, and is
  # applied by hand once during setup.
  echo "==> Deploying infrastructure with CDK"
  (cd "$ROOT_DIR/infra" && npx cdk deploy "$APP_NAME" --require-approval never)
fi

stack_output() {
  aws cloudformation describe-stacks \
    --region "$AWS_REGION" \
    --stack-name "$STACK_NAME" \
    --query "Stacks[0].Outputs[?OutputKey=='$1'].OutputValue" \
    --output text
}

BUCKET="$(stack_output BucketName)"
DISTRIBUTION_ID="$(stack_output DistributionId)"
SITE_URL="$(stack_output SiteUrl)"

if [[ -z "$BUCKET" || "$BUCKET" == "None" ]]; then
  echo "Could not read stack outputs. Has the stack been deployed? Try: $0 --stack" >&2
  exit 1
fi

# Everything that is not part of the running app.
EXCLUDES=(
  # Dotfiles and dot-directories, which are all tooling: .git, .github,
  # .claude, .vscode, .gitignore, .DS_Store. Matched generically so a new one
  # does not silently end up published.
  --exclude '.*'
  --exclude '.*/*'
  --exclude '*/.*'
  --exclude 'node_modules/*'
  --exclude 'tests/*'
  --exclude 'infra/*'
  --exclude 'scripts/*'
  --exclude '*.md'
  --exclude 'package.json'
  --exclude 'package-lock.json'
  --exclude 'vitest.config.js'
  --exclude 'vitest.workspace.js'
  --exclude 'monster-schema.json'
)

# --size-only matters more than it looks: a CI checkout gives every file a fresh
# mtime, so the default size-and-mtime comparison would re-upload the ~17 MB
# data/ tree on every single deploy.
echo "==> Uploading reference data to s3://$BUCKET"
aws s3 sync "$ROOT_DIR/data" "s3://$BUCKET/data" \
  --region "$AWS_REGION" \
  --size-only \
  --delete \
  --cache-control 'public,max-age=31536000,immutable'

echo "==> Uploading app files to s3://$BUCKET"
aws s3 sync "$ROOT_DIR" "s3://$BUCKET" \
  --region "$AWS_REGION" \
  --size-only \
  --delete \
  --exclude 'data/*' \
  "${EXCLUDES[@]}" \
  --cache-control 'public,max-age=60'

# Never invalidate '/*': it would evict the whole immutable data/ tree and make
# every user re-download it. Only the files that actually change are listed.
echo "==> Invalidating CloudFront cache"
INVALIDATION_ID="$(aws cloudfront create-invalidation \
  --distribution-id "$DISTRIBUTION_ID" \
  --paths '/' '/index.html' '/manifest.json' '/js/*' '/css/*' \
  --query 'Invalidation.Id' \
  --output text)"

echo "==> Waiting for invalidation $INVALIDATION_ID"
aws cloudfront wait invalidation-completed \
  --distribution-id "$DISTRIBUTION_ID" \
  --id "$INVALIDATION_ID"

echo
echo "Deployed: $SITE_URL"
