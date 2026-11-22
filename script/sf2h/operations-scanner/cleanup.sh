#!/usr/bin/env bash
set -euo pipefail
if [ -z "${SF_OPERATIONS_SCANNER_STATE:-}" ]; then
  echo "Operations scanner setup did not allocate a service."
  exit 0
fi
script_dir=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
node "$script_dir/service.mjs" cleanup "$SF_OPERATIONS_SCANNER_STATE"
