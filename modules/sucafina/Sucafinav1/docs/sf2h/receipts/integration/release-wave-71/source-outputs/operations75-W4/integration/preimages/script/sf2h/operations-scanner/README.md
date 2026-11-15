# Operations63 — ephemeral ClamD qualification service

These scripts are a bounded GitHub Actions setup for the existing `test-ci` lane. They do not install a package or service on the host. They are inactive until45/60 reviews and materializes the complete workflow patch under `docs/sf2h/receipts/operations-scanner-closure/external/ci/`.

## Exact activation

The branch must match `ci-run-linux-operations63-*`, the normalized request must use `ORCHESTRA_CHANNEL=prod`, and its selection must be exactly one of:

- `sucafina`, `modules/sucafina`, Bun, `Sucafinav1/test/product/operations-scanner-closure/real-clamd.check.ts`. The normal uploader suffix `--timeout 120000` is accepted; no other args are accepted for this capability.
- `app`, `packages/app-shell`, Playwright, `e2e/sucafina/operations.spec.ts`, production config `e2e/playwright.production.config.ts`.

The seven existing auxiliary tests and protocol tests do not activate a scanner. The live check is an explicit mandatory CI selection; its `.check.ts` suffix avoids silently requiring this external service in unrelated Bun suites. Absence of the service is a failed prerequisite, never a skip or a clean verdict.

The request env allowlist remains unchanged. Setup publishes the service's own loopback ports through `GITHUB_ENV` only after it has validated its package, official database, processes, listening sockets and discriminating daemon controls:

| Variable | Meaning |
| --- | --- |
| `SF_OPERATIONS_CLAMD_PORT` | Main daemon on `127.0.0.1:3310`, INSTREAM limit16MiB |
| `SF_OPERATIONS_CLAMD_ERROR_PORT` | Error control daemon on `127.0.0.1:3311`, INSTREAM limit1KiB |
| `SF_OPERATIONS_SCANNER_STATE` | One directory created by `mktemp` beneath the job's `RUNNER_TEMP` |
| `SF_OPERATIONS_SCANNER_EVIDENCE` | Its `evidence` subdirectory; no enrollment credentials or business records |

The live product check reads `service.json` and validates run/attempt/SHA, realpath, PID executable/config/start time before stopping only the error daemon for the final DOWN proof. The main daemon remains available to the five original browser journeys. Cleanup tolerates an already stopped daemon and rejects a reused or foreign PID.

## Package and relocation

`tools.lock.json` pins the official ClamAV1.5.4 Linuxx86_64 package URL, size and SHA256 observed from Cisco-Talos release metadata through GitHub MCP. The setup downloads only that URL, checks both byte length and SHA256, and uses `dpkg-deb --extract`; it never invokes package installation, a maintainer script, systemd, sudo or a global service command.

Upstream `INSTALL.md`, `CMakeLists.txt` and the daemon/tool CMake files establish the default `/usr/local` layout and a build-time RPATH. Relocation is not assumed to work: setup sets `LD_LIBRARY_PATH` only for each downloaded tool, checks `ldd` for unresolved libraries, requires both tools to report the pinned version, and supplies explicit config/database/`CVDCertsDirectory` paths. Missing tools, certificates, shared libraries or incompatible runtime are recorded setup failures. The actual downloaded asset has not been executed by the author of this change.

FreshClam runs once with the official mirror and database signature verification, using only the extracted package certificates and a private job directory. Main, daily and bytecode databases must all exist and their byte counts/SHA256s are recorded. `TestDatabases yes` remains enabled; both daemons use `OfficialDatabaseOnly yes`. No synthetic signature database or fallback endpoint exists. Rate limits, unavailable downloads, DNS or blocked egress remain real blockers.

## Service evidence and cleanup

Both daemons run in foreground mode as children of this job. The scripts record executable, PID, config and `/proc` start time; loopback listening socket inodes must belong to those PIDs. Readiness is bounded independently of journey budgets. Setup performs direct PING/VERSION and INSTREAM clean/EICAR/clean-after controls on each daemon, plus a real stream-limit error on the error daemon. These are provisioning controls: the separate product check must call `scanLocalFile`, and the browser journeys must still pass through the real application.

`setup.json` starts at `STARTING`, becomes `READY` only after those observations, and preserves failures. It never claims that product qualification ran. The owner workflow uploads only the evidence subtree, including package identity, version/loader diagnostics, config digests, official DB digests, exact process/socket identities and real control responses.

The cleanup step runs with `always()`. It sends TERM and, only if needed after a bounded wait, KILL to PIDs whose executable, start time and config still match this job. It removes only this setup's extracted package/database/temp files and preserves logs and receipts. No Orchestra process, unrelated ClamD, user directory or global service is touched.

Two full signature databases are resident at once. The hosted runner must have sufficient RAM; OOM is a setup failure. This definition does not claim that Docker, networking, memory, release downloads or ClamD have been successfully exercised on the current candidate.
