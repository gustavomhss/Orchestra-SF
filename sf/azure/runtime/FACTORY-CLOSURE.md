# SF factory runtime closure — Linux distribution contract

**Source baseline:** `close-final-candidate` at `1cb77b8deb144e01a655c36987922338b1474003`.  
**Scope:** offline, extracted Linux x64 package: `bin/orchestra serve --hostname localhost --port 4110 --installation <absolute extracted factory>`. This is a source audit and a packaging contract, **not** an Azure/Entra or go-live attestation.

## A. Source dependency map

The dynamic import boundary is `apps/cli/src/sucafina-product/installation.ts:loadSfInstallation`: it calls `realpath(file)`, `import(pathToFileURL(...).href)`, requires a default async factory, and supplies the already-linked host `createSfHostRuntime`. `apps/cli/src/commands/handlers/serve.ts:serveForever` constructs the origin from explicit hostname/port and calls that loader before opening the listener. A `--installation` file is **trusted owner-supplied executable code**, not request-controlled content.

The **factory entry** is `modules/sucafina/Sucafinav1/local/entry.ts`. Its runtime static imports cross these exact source roots:

| Source / graph edge | Runtime purpose | Packaging treatment |
| --- | --- | --- |
| `local/entry.ts → ../index.ts` | Domain module registry: `runtime/application.ts`, `runtime/dashboard-{budget,people,operations,portfolio}.ts`, `runtime/planner.ts`, `runtime/procurement.ts`, `src/nav.ts` | Bundle JS/TS transitively |
| `local/entry.ts → ../runtime/{local-store,auth-maintenance,entra-client,operator-identity,application,ui,contract,local-backups,local-recovery,local-jobs,operations,local-identity,local-bootstrap,local-configuration,microsoft-installation,local-scanner}.ts` | Persistence, transport, identity, backup, HTML | Bundle JS/TS transitively |
| `local/entry.ts → ../src/screen-shell.ts` | Host page shell | Bundle |
| `local/entry.ts → ../product/{decisions/current-choice-preview,integration/source-lifecycle,integration/source-inventory,integration/source-projections,integration/bi-http,interface/http,interface/html,integration/decision-controls-link,integration/human-authority,integration/host-presentation,contracts/canonical}.ts` | Domain persistence, BI, presentation and authority | Bundle transitively |
| `local/entry.ts → ../../../../apps/cli/src/sucafina-product/native-ui/{context,router,domain,dashboard-operational,domain-health,action-source,people,operations,work,planner,procurement,decisions,routines}.ts` | Real native projections and request routing | Bundle transitively; this import crosses the factory's source module boundary |
| `local/entry.ts → @orchestra/schema/sucafina/context` | Type-only `SfOperationAvailability`; no emitted JS from this import | None for that import; other transitive `@orchestra/*` runtime imports are resolved by the Bun bundler |
| `local/entry.ts → ../product/contracts/freeze-v1.json` | Operations/grants contract | Embed as JSON in factory JS |
| `local/entry.ts → ../product/integration/generated/bi-entry.txt` | BI browser script; `with { type: "text" }` | Embed as text in factory JS |
| `apps/cli/src/sucafina-product/host-context.ts → modules/sucafina/Sucafinav1/product/ai/resident.ts` | Host-created runtime reads resident AI policy from `sourceRoot` | Host code already bundled in `bin/orchestra`; **physical policy files still required** |

**Transitive dependency classes:** the imported `runtime/`, `product/`, `src/`, and `native-ui/` modules import one another, workspace packages under `packages/*` (notably `@orchestra/core`, `@orchestra/schema`), and installed third-party packages (notably the SF package's `docx`, `exceljs`, `jose`, `jszip`, `pptxgenjs`, `saxes`, `xlsx`, plus shared `effect`). **Do not copy source and assume `node_modules` is present**. Build the complete *transitively resolved import graph* into a single Bun ESM entry and reject missing assets/build outputs. The generated compiler input ledger enumerates each bundler-observed code/JSON/text input with SHA-256; it is a concrete input graph rather than an unsupported guess that only the entry's direct imports matter.

**Deliberate runtime disk reads:** `entry.ts:createConfiguredInstallation` passes `sourceRoot: path.resolve(import.meta.dir, "../product/ai")` to the host. `apps/cli/src/sucafina-product/host-context.ts` calls `createResidentAiBundle({root: sourceRoot, manifestPath: path.join(sourceRoot, "manifests/resident.json")})`. `product/ai/resident.ts` reads and verifies file bytes at runtime with `realpath` and `Bun.file`, so bundling JS alone is insufficient. The required resident files are:
- `product/ai/manifests/resident.json` (5 profiles, 18 skills; expected policy/routes).
- `product/ai/profiles/sf_{maestro,finance,procurement,portfolio,reviewer}.json`.
- `product/ai/skills/<each of the 18 declared sf-* skills>/SKILL.md`.

`product/ai/manifests/native-probe.json` also exists but is a separate probe fixture, not referenced by the resident loader. Private keys, installation JSON, SQLite, tenant secrets, ClamAV, Litestream and Microsoft/Entra credentials are **NOT** factory distribution files; they are deployment inputs. Tests must prepare ephemeral owner-only configuration and cannot publish it.

## B. Current producer vs required payload

At this baseline `apps/cli/script/build.ts` compiles **only** `./src/omni-entry.ts` into `dist/cli-<target>/bin/orchestra` and explicitly copies Omni, tree-sitter, ripgrep, Lean notices and `package.json`. The factory is **not an entrypoint** of that compiled binary: `loadSfInstallation` uses an absolute, runtime-selected `import(file://...)`. Thus it cannot be assumed to be transitively captured in the CLI compile evidence. There is no call in `build.ts` that copies `modules/sucafina/Sucafinav1/local/entry.ts`, `product/ai`, or the `native-ui` dependency closure.

`apps/cli/script/distribution-payload.ts:prepareDistribution` captures only `dist/cli-<target>`, rejecting root files other than `package.json` or `bin/**`; it writes a sorted `distribution.json` with SHA-256/executable bits for every captured file and `checksums.sha256`. `archiveDistribution` archives precisely those captured files. Its previously required companions do **not** include the SF factory. The observed `dev` web-build artifact (run `43982346743`) proving `bin/orchestra` plus `bin/web` is **not** proof of the SF factory, and is on another revision. Web static files are qualified separately; this change does not claim their coverage.

## C. Frozen package layout and acceptance

The additive layout for the SF-capable build is:
- `bin/orchestra` — existing executable, unchanged host entry.
- `bin/local/entry.mjs` — **single bundled** factory ESM entry, passed by absolute path to `--installation`.
- `bin/local/closure.json` — bundler-observed relative inputs and SHA-256; contains no absolute checkout paths.
- `bin/product/ai/{manifests/resident.json,profiles/*.json,skills/*/SKILL.md}` — only runtime-read resident policy/skill bytes; exact source bytes.
- `distribution.json` and `checksums.sha256` — existing archive-level integrity witness, including all above files. No `node_modules`, `modules/sucafina` source tree, private configuration, symlinks or tenant state in the archive.

The build **fails closed** if Bun cannot bundle into exactly one ESM output, if a resident policy/skill is missing, if source asset paths leave the approved tree, or if published hashes differ. The extracted proof must invoke the **compiled** `bin/orchestra` from a temp directory outside the checkout with `--installation <extracted/bin/local/entry.mjs>`, observe a real `GET /sucafina/status` response from the factory, and verify the extracted per-file SHA-256 against `distribution.json`. This validates import/initialization at the no-credentials status tier only: authenticated Microsoft/Entra, source producers, AI execution, Azure TLS, full UI and enterprise go-live still require their own gates.

## Evidence boundaries

- Code inspection: `apps/cli/src/sucafina-product/installation.ts`, `apps/cli/src/commands/handlers/serve.ts`, `modules/sucafina/Sucafinav1/local/entry.ts`, `modules/sucafina/Sucafinav1/index.ts`, `modules/sucafina/Sucafinav1/product/ai/resident.ts`, `apps/cli/src/sucafina-product/host-context.ts`.
- Producer inspection: `apps/cli/script/build.ts`, `apps/cli/script/distribution-payload.ts`, `apps/cli/script/release.ts`, `apps/cli/script/targets.ts`.
- Build/CI run IDs and conclusions are evidence only if observed, never predicted. An on-paper contract does not imply that Bun has successfully bundled this graph or that the extracted native binary has loaded it.


## D. Integrated Web hardening from PR #254

`origin/sf-package-guard@b67cb17eef6962e4007dab7a0cde27672367f92b`
is the second parent of the merge commit
`2a947d4e0d88fb8441bb1a9a40eb5d96c45d7eb4`, with the
original SF factory branch as first parent
`55a366a8920affff20adb18dd8ff32402952db29`.
The overlapping `apps/cli/script/distribution-payload.ts` was resolved
**on top of PR #254's Web hardening**: its optional `web` input,
`isWebSourceMap` filter, inline `sourceMappingURL=data:` rejection and
`verifyCaptured` policy were preserved; `requireSfFactory` was added
only after these checks. Its two Web distribution tests, native fixture update
and Deno pin export were imported unchanged with their original Git blobs.

The previous 2026-11-16 `dev` bundle
(`app-build` run `43982346743`) carried 2,289 `bin/web` files,
including 989 `.map` files (owner-inspected historical evidence). It must
not be distributed as a public SF installation. In the integrated contract:
- the original `apps/web/dist` remains available to the build owner with
  source maps; neither its files nor its hashes are rewritten by the producer;
- `prepareDistribution({ dist, web, ... })` captures regular Web files,
  **omits** `.map`, `.map.gz`, `.map.br` and rejects inline maps in JS/CSS;
- `verifyDistribution` refuses any externally reintroduced map or inline
  source map; `archiveDistribution` ships only the admitted file set;
- the **same archive** must include `bin/orchestra`, `bin/local/entry.mjs`,
  `bin/product/ai/*` and `bin/web/index.html`, and the test must prove
  native `GET /sucafina/status` **and** the static `GET /` original Web
  content hash from an extracted folder outside the checkout;
- the combined proof receipt must record `web.originalSourceMapCount > 0`,
  `web.publishedSourceMapCount === 0`, the exact number of published Web
  files, and `web.indexSha256`; the `distribution.json` inventory must
  contain no `bin/web/**/*.map*` entry.

## E. Receipt identity incident and source provenance

### Determined cause (not a race)

Historical PR workflow run `43988598685` reports branch
`head_sha=55a366a8920affff20adb18dd8ff32402952db29` but its test
receipt had `sourceSHA=6d1ff11e018d9cca6cee82baa6a4af9cf29b4fed`.
The latter is a **real synthetic GitHub PR merge commit**:
- parent 1: `42d344a0efc4d85187388f149c54acac2db171da`
  (`close-final-candidate` state at that event);
- parent 2: `55a366a8920affff20adb18dd8ff32402952db29`
  (the actual PR head).

In `pull_request` workflows, GitHub's `github.sha` and `GITHUB_SHA`
refer to `refs/pull/N/merge` by default, while a `push` event uses the
branch commit. The old workflow used an implicit
`actions/checkout` ref and the test wrote
`sourceSHA: process.env.GITHUB_SHA` without checking
`git rev-parse HEAD` or `github.event.pull_request.head.sha`.
It therefore **certified the synthetic merge ref as the application source**,
rather than the explicitly advertised PR head. The differing archive SHA
can follow from differing checkout bytes; it is **not** evidence of shared
runner contamination. GitHub-hosted workspaces are per-job, but the old
artifact names were not run-attempt scoped.

### Fail-closed contract

`.github/workflows/sf-factory-package.yml` now checks out
`github.event.pull_request.head.sha || github.sha` explicitly, passes
the selected branch `SF_FACTORY_EXPECTED_SOURCE_SHA`, and separately
retains the `github.sha` workflow identity. The test reads the actual
`git rev-parse --verify HEAD` both before building and just before
writing success evidence. `requireSfFactoryRunIdentity` rejects a
`sourceSHA` or checkout SHA different from the selected branch commit.
On `push`, it additionally requires `workflowSHA === sourceSHA`;
on `pull_request`, the synthetic `workflowSHA` may correctly differ,
and must be recorded **as a separate field**, never misidentified as
`sourceSHA`.

Both the isolated extraction folder and the uploaded artifact directory
use the exact validated `github.run_id` and `github.run_attempt`;
the uploaded artifact name also includes this pair and the selected
source commit SHA. An invalid/mismatched identity fails before a receipt
or qualified artifact can be published. The negative identity tests
explicitly reject the historical PR-merge-as-source mistake, a changed
checkout SHA, a changed expected PR head SHA, an invalid run ID and a
push event with differing workflow SHA.

**Important evidence rule:** a green result from an earlier HEAD does not
certify this merged source. Report only the final branch HEAD, successful
`push` and `pull_request` run IDs, the observed complete
`SF_FACTORY_PACKAGE_QUALIFIED` line, and independently confirmed
`head_sha === receipt.sourceSHA === receipt.checkoutSHA ===
receipt.expectedSourceSHA`. `receipt.workflowSHA` is separate for
PR events by GitHub design.

## F. Packaging branch consolidation (single owner)

Compared GitHub branch heads, retaining source provenance instead of merging
unrelated deployments:

| Branch | Head inspected | Result |
| --- | --- | --- |
| `sf-package-guard` (#254) | `b67cb17eef6962e4007dab7a0cde27672367f92b` | Its Web sourcemap filter, inline map rejection, and unit/native tests were already merged unchanged in commit `2a947d4e0d88fb8441bb1a9a40eb5d96c45d7eb4`. |
| `sf-package-unified` | `cfb01f61e8c48c5779288b0b4b24220cc28662ab` | Its tree `9123743c0b9cccd0f5b24aa9cd76df554a32c8d8` is **byte-identical** to the earlier factory/guard merge tree. In particular, `apps/cli/script/distribution-payload.ts` and `apps/cli/test/distribution-web-native.test.ts` have the **same Git blob SHAs** in both branches. It is **not** a superset: `sfa-factory-package` has additional SHA-provenance, concurrency, Web+factory combined proof, and negative tests. The consolidation merge therefore retains this branch's newer tree. |
| `sf-package-qualify` | `bc84775c05c526ad9b89ae7a4875aee81eeb69e5` | A legacy qualification lineage with `app-build.yml`, Azure infrastructure, and an **older** `distribution-payload.ts` (no `isWebSourceMap`), no packaged SF factory. Merging its source wholesale would silently restore the sourcemap leak and add unrelated infrastructure. Retain current producer bytes, absorb the useful **independent receipt/manifest/archive verifier** idea as `apps/cli/script/factory-receipt-check.ts` in the existing native factory workflow. |

The merge commits record both source lineages as parents while intentionally
keeping the owner-scoped factory+Web producer source tree. This is a content
reconciliation, **not** approval for either old alternative PR, or for a
different Azure/app-build release workflow. Do not close those PRs as an agent.

### Independent final receipt validator

The standalone `apps/cli/script/factory-receipt-check.ts` is executed by
`.github/workflows/sf-factory-package.yml` **after** the real extracted
factory smoke and installed Web/Omni proof, **before** artifact upload.
It reads the persisted, run-ID-scoped JSON receipt, `distribution.json`,
`factory-closure.json`, and exact published `.tar.gz`; independently hashes
the archive and manifest and every archived file, checks the gzip archive
file set and checksum table, checks declared factory/asset/compiled input
counts and source identity, and fails if even one `bin/web` sourcemap
appears in the descriptor. It cross-checks the Web HTML digest, Web file counts
and `publishedSourceMapCount=0`. Its verification outcome is explicitly
`SF_FACTORY_RECEIPT_VERIFIED`, not inferred from a build result.

Two additional **real negative controls** modify the staged evidence:
a mismatched `sourceSHA` receipt must raise
`SF_FACTORY_RECEIPT_SOURCE_SHA_MISMATCH`, and altered
`distribution.json` bytes must raise
`SF_FACTORY_RECEIPT_ARCHIVE_OR_MANIFEST_DIGEST_MISMATCH`; authentic
bytes are restored and independently reverified before emitting
`SF_FACTORY_PACKAGE_QUALIFIED`.

Scope remains Linux x64 native. The qualified archive proves a closed
factory, Web without source maps and owner-owned ephemeral local
`/sucafina/status` (200); Azure Entra, external integrations, governance,
secrets and production restore are separately owner-gated.
