#!/usr/bin/env bash
# Original installed invocations only. No installation, service restart or production cutover.
set -euo pipefail
umask 077
: "${GITHUB_WORKSPACE:?Actions checkout required}"
: "${SF_G08_PRIVATE_ROOT:?authorized private root required}"
cd "$GITHUB_WORKSPACE"
test "$#" -eq 1
exec bun script/sf-ci/g08-installed-evidence.mjs run "$1"
