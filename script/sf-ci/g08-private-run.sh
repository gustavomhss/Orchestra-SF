#!/usr/bin/env bash
# Run only on the already authorized, exclusive QA host; this driver never installs or restarts.
set -euo pipefail
set -C
umask 077
: "${SF_G08_PRIVATE_ROOT:?private root required}"
: "${SF_G08_INVOCATION_ID:?invocation id required}"
: "${GITHUB_WORKSPACE:?Actions checkout required}"
cd "$GITHUB_WORKSPACE"
export SF_G08_CANDIDATE_SHA="$(git rev-parse HEAD)"
export SF_G08_CANDIDATE_TREE="$(git rev-parse 'HEAD^{tree}')"
test "$SF_G08_CANDIDATE_SHA" = "$GITHUB_SHA"
git diff --exit-code >/dev/null
git diff --cached --exit-code >/dev/null
# Fail before any browser connection if the reservation, pin or package receipt does not match.
node script/sf-ci/g08-private-evidence.mjs admit
python3 script/sf-ci/g08-installed-preflight.py before > "$SF_G08_PRIVATE_ROOT/host-before.log" 2>&1
set +e
(
  cd packages/app-shell
  bunx --no-install playwright test --config e2e/sucafina/g08/playwright.config.ts
) > "$SF_G08_PRIVATE_ROOT/playwright-command.log" 2>&1
test_status=$?
set -e
printf '%s\n' "$test_status" > "$SF_G08_PRIVATE_ROOT/exit-code.txt"
set +e
python3 script/sf-ci/g08-installed-preflight.py after > "$SF_G08_PRIVATE_ROOT/host-after.log" 2>&1
host_status=$?
git diff --exit-code > "$SF_G08_PRIVATE_ROOT/tracked-diff-after.txt" 2>&1
diff_status=$?
git diff --cached --exit-code > "$SF_G08_PRIVATE_ROOT/staged-diff-after.txt" 2>&1
staged_status=$?
node script/sf-ci/g08-private-evidence.mjs verify > "$SF_G08_PRIVATE_ROOT/verification.log" 2>&1
verification_status=$?
set -e
test "$test_status" -eq 0 && test "$host_status" -eq 0 && test "$diff_status" -eq 0 &&
  test "$staged_status" -eq 0 && test "$verification_status" -eq 0
