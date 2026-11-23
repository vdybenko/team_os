#!/bin/sh
set -eu
cd "$(dirname "$0")/.."
if [ -n "$(git status --porcelain --untracked-files=normal)" ]; then
  echo 'Release requires a clean checkout.' >&2
  exit 1
fi
local_head=$(git rev-parse HEAD)
remote_head=$(git ls-remote origin refs/heads/main | cut -f1)
if [ -z "$remote_head" ] || [ "$local_head" != "$remote_head" ]; then
  echo 'Checkout must match origin/main before release.' >&2
  exit 1
fi
npm test
node scripts/check-staging.mjs
ssh -4 -T -i "$HOME/.ssh/teamos_release" \
  -o IdentitiesOnly=yes -o BatchMode=yes -o StrictHostKeyChecking=yes \
  -o UserKnownHostsFile="$HOME/.ssh/teamos_known_hosts" \
  teamos-release@sb.uselinxa.com deploy
