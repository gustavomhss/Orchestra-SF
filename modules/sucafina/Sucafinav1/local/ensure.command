#!/bin/sh
set -eu
umask 077
if [ "$#" -ne 1 ]; then
  echo 'Usage: ensure.command /absolute/private/installation.json' >&2
  exit 2
fi
case "$1" in /*) ;; *) echo 'Absolute private configuration file required' >&2; exit 2;; esac
module_directory=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd -P)
bun_path=$(command -v bun) || { echo 'Bun executable required on PATH' >&2; exit 2; }
case "$bun_path" in /*) ;; *) echo 'Absolute Bun executable required' >&2; exit 2;; esac
private_directory=$(dirname -- "$1")
if [ -e "$private_directory/recovery/recovery.json" ]; then
  "$bun_path" run "$module_directory/local/recovery-service.ts" --ensure "$1" "$private_directory/tools/litestream/litestream"
fi
exec "$bun_path" run "$module_directory/local/service-plan.ts" --ensure "$1"
