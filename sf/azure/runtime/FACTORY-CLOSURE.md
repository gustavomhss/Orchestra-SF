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
