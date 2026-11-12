#!/bin/sh
set -eu
if [ "$#" -ne 2 ]; then
  echo 'Usage: start.command /absolute/orchestra-checkout /absolute/private/installation-directory' >&2
  exit 2
fi
case "$1" in /*) ;; *) echo 'Absolute Orchestra checkout required' >&2; exit 2;; esac
case "$2" in /*) ;; *) echo 'Absolute private directory required' >&2; exit 2;; esac
module_directory=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd -P)
[ -f "$1/apps/cli/src/index.ts" ] || { echo 'Orchestra source entry missing' >&2; exit 2; }
[ -f "$2/installation.json" ] || { echo 'Run local/prepare.ts first' >&2; exit 2; }
# Per-child paths are set before Bun imports the host or runs any migration.
# No service registration: this foreground homologation instance cannot replace the existing daemon.
cd "$2"
unset ORCHESTRA_SERVER_PASSWORD ORCHESTRA_SERVER_USERNAME ORCHESTRA_CONFIG ORCHESTRA_CONFIG_CONTENT
export XDG_DATA_HOME="$2/host-data" XDG_CONFIG_HOME="$2/host-config"
export XDG_CACHE_HOME="$2/host-cache" XDG_STATE_HOME="$2/host-state"
export ORCHESTRA_CONFIG_DIR="$2/host-config" ORCHESTRA_INHERIT_CREDENTIALS=0
export ORCHESTRA_DISABLE_PROJECT_CONFIG=1 ORCHESTRA_CREDENTIAL_KEY_FILE="$2/host-credential.key" TMPDIR="$2/host-tmp"
export ORCHESTRA_DB="$2/host-data/orchestra.db" SUCAFINA_LOCAL_CONFIG="$2/installation.json"
case "$(uname -m)" in
  x86_64) omni_platform=darwin-x64 ;;
  arm64) omni_platform=darwin-arm64 ;;
  *) echo 'Unsupported local Mac architecture' >&2; exit 2 ;;
esac
export HUGR_OMNI_ADDON="$2/tools/omni/$omni_platform/hugr_omni.node"
export HUGR_OMNI_SUPERVISOR="$2/tools/omni/$omni_platform/hugr-omni-supervisor"
[ -f "$HUGR_OMNI_ADDON" ] && [ -x "$HUGR_OMNI_SUPERVISOR" ] || { echo 'Build matching native Orchestra artifacts before launch' >&2; exit 2; }
# Validate private ownership, keys and configuration before importing even the host's global path setup.
bun run "$module_directory/local/preflight.ts"
exec bun run "$1/apps/cli/src/index.ts" serve --hostname localhost --port 4110 \
  --installation "$module_directory/local/entry.ts"
