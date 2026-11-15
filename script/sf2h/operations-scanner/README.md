# Operations scanner qualification

Mission75 uses the campaign-only workflow .github/workflows/sf-operations-scanner.yml because the existing test-ci lane has no scanner setup and belongs to another owner. It reuses the same canonical request validator, package actions, selectors and test commands. No generic workflow, request environment allowlist or compiler lane is changed.

## Mission75 request and provenance

A product commit W contains this workflow and the reviewed implementation. Controls use sourceBranch operations-scanner-proof; the five journeys use sourceBranch sf2-stack after71 composes the released73 and75 material. No shared Procurement runtime file is copied into the75 branch. W's direct-child snapshot S changes only .ci-run.json. The request body must exactly match one of the two fixed selections in request.mjs; it also carries operationsScanner with campaign sf2h-integral-20261112, mission75, the applicable sourceBranch, full productSha W, selection controls or journeys, and requestSha256.

requestSha256 is SHA256 of the validated request without operationsScanner, serialized as JSON with recursively sorted object keys and no whitespace. Arrays keep their order. The branch is sf-ops75- followed by W's first12 hexadecimal characters, c for controls or j for journeys, the request hash's first12 characters, and an attempt number1–99. The guard checks the full source parent, snapshot HEAD, single request delta, request digest, branch and exact request fields. Workflow, config and test hashes are recorded and must remain unchanged during the job.

The controls selection names all three .check.ts files with ./ prefixes, preserving Bun's ordered exact-file semantics: the three original real-clamd.check.ts cases, then real-malformed.check.ts, then private-admission.check.ts. The original DOWN case stops the verified error daemon; subsequent controls use that actual unavailable endpoint and leave the main daemon healthy. The journeys selection preserves all five original Operations identities, actions, oracles and budgets through playwrightArgs: one worker, one repetition and zero retries. It must wait for the actual Procurement73 presentation release and71 composition.

Only one authorized request is queued at a time. The workflow has read-only contents permission, a dedicated branch prefix outside ci-run-*, no full-epic trigger and no branch-deletion privilege. It always attempts bounded cleanup, uploads the exact request/run evidence and ClamD evidence, and makes no integrated or native-parity claim. Compiler checks stay with45. The setup still pins the official engine package and uses official signature databases; product data is scanned only on127.0.0.1.

## Legacy63 exact activation

The original test-ci integration proposal remains in the Operations63 receipt package for its owner. Its branch, selection and behavior remain supported unchanged:

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

Upstream `INSTALL.md`, `CMakeLists.txt` and the daemon/tool CMake files establish the default `/usr/local` layout and a build-time RPATH. Relocation is not assumed to work: setup sets `LD_LIBRARY_PATH` only for each downloaded tool, checks `ldd` for unresolved libraries, requires both tools to report the pinned version, and supplies explicit config/database/`CVDCertsDirectory` paths. Missing tools, certificates, shared libraries or incompatible runtime are recorded setup failures. Actual package relocation and execution are verified separately in each hosted setup.

FreshClam runs once with the official mirror and database signature verification, using only the extracted package certificates and a private job directory. Main, daily and bytecode databases must all exist and their byte counts/SHA256s are recorded. `TestDatabases yes` remains enabled; both daemons use `OfficialDatabaseOnly yes`. No synthetic signature database or fallback endpoint exists. Rate limits, unavailable downloads, DNS or blocked egress remain real blockers.

## Service evidence and cleanup

Both daemons run in foreground mode as children of this job. The scripts record executable, PID, config and `/proc` start time; loopback listening socket inodes must belong to those PIDs. Readiness is bounded independently of journey budgets. Setup performs direct PING/VERSION and INSTREAM clean/EICAR/clean-after controls on each daemon, plus a real stream-limit error on the error daemon. These are provisioning controls: the separate product check must call `scanLocalFile`, and the browser journeys must still pass through the real application.

`setup.json` starts at `STARTING`, becomes `READY` only after those observations, and preserves failures. It never claims that product qualification ran. The owner workflow uploads only the evidence subtree, including package identity, version/loader diagnostics, config digests, official DB digests, exact process/socket identities and real control responses.

The cleanup step runs with `always()`. It sends TERM and, only if needed after a bounded wait, KILL to PIDs whose executable, start time and config still match this job. It removes only this setup's extracted package/database/temp files and preserves logs and receipts. No Orchestra process, unrelated ClamD, user directory or global service is touched.

Two full signature databases are resident at once. The hosted runner must have sufficient RAM; OOM is a setup failure. The exact source/snapshot/run receipts record whether those prerequisites and the product checks actually passed.
