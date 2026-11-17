#!/usr/bin/env bash
set -euo pipefail

# CI-UI-OPERATIONS admits real private bytes. Keep the production scanner
# fail-closed: only a ready, loopback-bound, signature-backed ClamD qualifies.
test "$RUNNER_OS" = Linux && test "$RUNNER_ARCH" = X64
docker run --detach --rm --name sf-ci-operations-clamd \
  --publish 127.0.0.1:3310:3310 \
  clamav/clamav:1.5.4-debian13-slim

# A live protocol reply is required; an open port alone is not readiness.
python3 - <<'PY'
import socket
import time

deadline = time.monotonic() + 120
while time.monotonic() < deadline:
    try:
        with socket.create_connection(("127.0.0.1", 3310), timeout=1) as connection:
            connection.settimeout(1)
            connection.sendall(b"zPING\0")
            if connection.recv(16) == b"PONG\0":
                break
    except OSError:
        pass
    time.sleep(2)
else:
    raise SystemExit("SF_REAL_CLAMD_NOT_READY")
PY

# Use the product INSTREAM adapter; never substitute a fake scanner or stub.
bun -e 'import { scanLocalFile } from "./modules/sucafina/Sucafinav1/runtime/local-scanner.ts"; if (!await scanLocalFile(new TextEncoder().encode("SF_CI_CLEAN_FILE_PROBE\n"), { host: "127.0.0.1", port: 3310 })) process.exit(1)'
echo "SF_REAL_CLAMD_INSTREAM_READY"
