#!/usr/bin/env bash
set -euo pipefail
umask 077

# This file prepares only an ephemeral hosted job. It never installs a package or system service.
test "${GITHUB_ACTIONS:-}" = true
test "${GITHUB_REPOSITORY:-}" = gustavomhss/Orchestra-SF
test "${RUNNER_OS:-}" = Linux
test "${RUNNER_ARCH:-}" = X64
[[ "${GITHUB_REF_NAME:-}" =~ ^tp-scan-[a-f0-9]{24}[1-9][0-9]{0,2}$ ]]
[[ "${GITHUB_RUN_ID:-}" =~ ^[0-9]+$ && "${GITHUB_RUN_ATTEMPT:-}" =~ ^[0-9]+$ ]]
test -d "${RUNNER_TEMP:?}"
test -f "${GITHUB_ENV:?}"
for command in curl sha256sum dpkg-deb ldd timeout node rg; do
  command -v "$command" >/dev/null || { echo "OPERATIONS_SCANNER_TOOL_MISSING:$command" >&2; exit 2; }
done
script_dir=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
# Exact candidate/request admission is mandatory before any daemon allocation.
node "$script_dir/../../sf-ci/team-profile-scanner.mjs" integrity
state_prefix=sf-teams-profile-scan
state=$(mktemp -d "$RUNNER_TEMP/${state_prefix}-${GITHUB_RUN_ID}-${GITHUB_RUN_ATTEMPT}.XXXXXX")
[[ "$state" != *[[:space:]]* ]] || { echo OPERATIONS_SCANNER_PATH_HAS_WHITESPACE >&2; exit 2; }
mkdir -p "$state/evidence" "$state/database" "$state/root" "$state/pids" "$state/tmp"
node "$script_dir/service.mjs" initialize "$state"
printf 'SF_OPERATIONS_SCANNER_STATE=%s\nSF_OPERATIONS_SCANNER_EVIDENCE=%s/evidence\n' "$state" "$state" >> "$GITHUB_ENV"
trap 'status=$?; if [ "$status" -ne 0 ]; then node "$script_dir/service.mjs" fail "$state" "$status" || true; node "$script_dir/service.mjs" cleanup "$state" || true; fi; exit "$status"' EXIT

url=$(node -e 'process.stdout.write(JSON.parse(require("node:fs").readFileSync(process.argv[1], "utf8")).asset.url)' "$script_dir/tools.lock.json")
digest=$(node -e 'process.stdout.write(JSON.parse(require("node:fs").readFileSync(process.argv[1], "utf8")).asset.sha256)' "$script_dir/tools.lock.json")
curl --fail --show-error --silent --location --proto '=https' --proto-redir '=https' \
  --connect-timeout 20 --max-time 180 "$url" -o "$state/clamav.deb"
printf '%s  %s\n' "$digest" "$state/clamav.deb" | sha256sum --check --strict > "$state/evidence/package-sha256.txt"
node "$script_dir/service.mjs" package "$state"
dpkg-deb --info "$state/clamav.deb" > "$state/evidence/package-info.txt"
dpkg-deb --extract "$state/clamav.deb" "$state/root"
prefix="$state/root/usr/local"
clamd="$prefix/sbin/clamd"
freshclam="$prefix/bin/freshclam"
test -x "$clamd" && test -x "$freshclam" || { echo OPERATIONS_SCANNER_RELOCATED_TOOLS_MISSING >&2; exit 2; }
test -d "$prefix/etc/certs" || { echo OPERATIONS_SCANNER_RELOCATED_CERTIFICATES_MISSING >&2; exit 2; }
library_path="$prefix/lib:$prefix/lib64"
# Both tools parse their config before --version. Keep even that first invocation job-local.
printf 'DatabaseDirectory %s\nCVDCertsDirectory %s\n' "$state/database" "$prefix/etc/certs" > "$state/evidence/version.conf"
for tool in "$clamd" "$freshclam"; do
  name=$(basename "$tool")
  LD_LIBRARY_PATH="$library_path" ldd "$tool" > "$state/evidence/$name-ldd.txt"
  if rg -q 'not found' "$state/evidence/$name-ldd.txt"; then
    echo "OPERATIONS_SCANNER_DYNAMIC_DEPENDENCY_MISSING:$name" >&2
    exit 2
  fi
  LD_LIBRARY_PATH="$library_path" "$tool" --config-file="$state/evidence/version.conf" --version > "$state/evidence/$name-version.txt"
done
node "$script_dir/service.mjs" configuration "$state"
if ! CVD_CERTS_DIR="$prefix/etc/certs" LD_LIBRARY_PATH="$library_path" timeout --signal=TERM --kill-after=5s 300s "$freshclam" \
  --config-file="$state/freshclam.conf" --stdout > "$state/evidence/freshclam-output.log" 2>&1; then
  echo OPERATIONS_SCANNER_OFFICIAL_DATABASE_UNAVAILABLE >&2
  exit 2
fi
node "$script_dir/service.mjs" databases "$state"

# Foreground mode keeps each recorded PID the actual daemon; cleanup validates executable/start time.
for kind in main error; do
  LD_LIBRARY_PATH="$library_path" "$clamd" --foreground --config-file="$state/clamd-$kind.conf" \
    > "$state/evidence/clamd-$kind-output.log" 2>&1 &
  printf '%s\n' "$!" > "$state/pids/$kind.pid"
  node "$script_dir/service.mjs" process "$state" "$kind"
done
node "$script_dir/service.mjs" ready "$state"
printf 'SF_OPERATIONS_CLAMD_PORT=3310\nSF_OPERATIONS_CLAMD_ERROR_PORT=3311\n' >> "$GITHUB_ENV"
echo "Operations scanner service ready; product qualification remains a separate required test."
