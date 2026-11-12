#!/bin/sh
set -eu
umask 077
if [ "$#" -ne 3 ]; then
  echo 'Usage: install-startup.command --prepare|--activate /absolute/product-checkout /absolute/private-directory' >&2
  exit 2
fi
case "$1" in --prepare|--activate) ;; *) echo 'Explicit --prepare or --activate required' >&2; exit 2;; esac
module_directory=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd -P)
bun_path=$(command -v bun) || { echo 'Bun executable required on PATH' >&2; exit 2; }
case "$bun_path" in /*) ;; *) echo 'Absolute Bun executable required' >&2; exit 2;; esac
exec "$bun_path" run "$module_directory/local/service-plan.ts" "$@"
