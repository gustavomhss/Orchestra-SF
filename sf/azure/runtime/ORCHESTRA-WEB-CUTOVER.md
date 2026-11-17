# Orchestra Web + Sucafina native chapter: assembly and VM cutover

Status: **NOT GO-LIVE-READY** (2026-11-17). This is a single-SHA release recipe, not a deployment authorization.

## What already exists

- `apps/web/package.json` builds `@orchestra/web`; `apps/web/vite.config.ts` uses the common `packages/app-shell` Solid shell. `packages/app-shell/src/orchestra/sidebar.tsx` dispatches to `sfNativeChapterEntry`.
- `apps/cli/src/commands/handlers/serve.ts` already mounts `WebUi.resolveRoot([ORCHESTRA_WEB_UI_DIR, <binary-dir>/web, ...])`; `packages/server/src/routes.ts` mounts `WebUi.layer` alongside APIs. **The installed release must actually contain `bin/web/index.html`.** `apps/cli/src/sucafina-product/installation.ts` handles the SF installation, not the web bundle.
- Base `close-final-candidate` at `3b3e86b2` has no `apps/cli/script/sf-factory-package.ts`, no `sf/ci/gate.mjs`, and `prepareDistribution` has no `web` parameter. Do not claim that a base-only package contains the Sucafina factory or Orchestra Web.
- **Correction to earlier assumption:** draft [#262](https://github.com/gustavomhss/Orchestra-SF/pull/262) already builds and packages *real CLI + SF factory + Orchestra Web* at one SHA. `apps/cli/test/factory-distribution-linux.test.ts` builds Vite and calls `prepareDistribution({web: webDist})`. Run **44102855966**, job `linux-factory (compiled + extracted)=success`, proved 1,300 packaged web files, zero web sourcemaps, and published an archive. It does **not** prove Sucafina white-label, authenticated native navigation, or VM deployment.
- Draft [#279](https://github.com/gustavomhss/Orchestra-SF/pull/279) contains official-source `packages/app-shell/public/brand/sucafina/logo-original.svg`, lockups, marks, favicon and web manifest, plus build-time `ORCHESTRA_BRAND=sucafina`. Artwork is **present**, not missing; official-source-derived variants still need brand-owner acceptance. Its run **44101755149** is **failure**: `SF_VISUAL_NATIVE_FRAME_OR_IDENTITY_UNAVAILABLE_today_dark`; diagnostic shows discovery 200 (1 installation), context 200, but native frame count 0 and `/sucafina/api/ui/context` aborted. The failure is not a missing-logo-only issue.

## Minimal code delivery in this PR

`sf/ci/assemble-orchestra-web.mjs` is an explicit, release-only **build + package** command; it does not deploy.

1. Requires Linux x64, Bun 1.3.14, `SOURCE_REVISION` exactly equal to checked-out `HEAD`, and the *source* installation-discovery connection (`serve.ts` + `installation.ts`) and native sidebar.
2. Requires the real Sucafina source artwork; rebuilds the CLI and web at the same source SHA, with `ORCHESTRA_BRAND=sucafina` **at Vite build time** and production channel. The build must have pinned dependencies and native Omni artifacts from the existing CI producer; no external source or prebuilt UI is accepted.
3. Requires `sfFactory: "bin/local/entry.mjs"`, branded `index.html` with `data-sucafina-artwork="ready"`, the actual SVGs, asset JS, a verified distribution manifest, and zero public sourcemaps. Creates a SHA-checked archive only if all guards pass. Existing `prepareDistribution({web})` and `archiveDistribution` are reused; no second packaging implementation.
4. On today's base this intentionally **fails closed** until the separate #262 factory/web producer and #279 branding/discovery wiring are reconciled into *one* reviewed SHA. It does not fabricate the missing assembly prerequisites, bypass guards, or claim the native browser works.

## Candidate order (CI runner only; NOT the Azure VM)

1. Review and integrate #262 and #279 on the *same* release SHA, reconciling their common `installation.ts` / factory and preserving both auth/fence contracts. Obtain brand-owner approval for the SVG derivatives.
2. Finish all relevant CI lanes; in particular the **real** authenticated browser native-frame test currently failing in #279 must pass for that exact SHA. A mere 200 or an HTML shell title is insufficient.
3. Prepare the normal pinned Linux x64 / Bun 1.3.14 / Omni build environment; then:
   ```sh
   export SOURCE_REVISION="$(git rev-parse --verify HEAD)"
   bun sf/ci/assemble-orchestra-web.mjs "/absolute/ci-output/orchestra-sf-orchestra-web-${SOURCE_REVISION}.tar.gz"
   ```
   This does CLI build -> branded Web build -> manifest verification -> archive. Pin and independently verify archive SHA, `distribution.json`, factory closure and Actions source SHA. A failure is a **release blocker**.
4. **After approval**, stage the archive in a *new immutable* `/opt/orchestra-sf/releases/orchestra-<SHA>` directory; do not touch the current release. Extract, check `bin/orchestra`, `bin/local/entry.mjs`, `bin/web/index.html`, `bin/web/brand/sucafina/lockup-primary.svg`, and the hashes. Run loopback smoke with an **isolated test installation configured for its actual origin**; the real Microsoft/OIDC authenticated route must be separately admitted. Do not repoint the live production origin to an unproven second port.
5. One unit is enough: **reuse** `orchestra-sf-staging.service`, same ingress hostname/port/proxy. `serve --installation <new-release>/bin/local/entry.mjs` serves the Orchestra SPA from `<new-release>/bin/web` plus the native SF API. No parallel SF-only UI process, new nginx, or TPM step is intrinsic. `ORCHESTRA_BRAND` set in systemd **does not brand an already-built bundle**.
6. During an authorized maintenance window, only *after* staging/smoke, swap the unit working directory if its `ExecStart` is **not hard-pinned to the previous release**:

   ```sh
   set -eu
   UNIT=orchestra-sf-staging.service
   NEW=/opt/orchestra-sf/releases/orchestra-<APPROVED_SHA>
   OLD="$(systemctl show -P WorkingDirectory "$UNIT")"
   EXEC="$(systemctl show -P ExecStart "$UNIT")"
   test -f "$NEW/bin/orchestra" && test -f "$NEW/bin/local/entry.mjs" && test -f "$NEW/bin/web/index.html"
   case "$EXEC" in *"$OLD"*) echo "STOP: ExecStart pins old release; reissue exact existing argv against NEW" >&2; exit 1;; esac
   sudo install -d -m 0755 "/etc/systemd/system/$UNIT.d"
   printf '[Service]\nWorkingDirectory=%s\n' "$NEW" | sudo tee "/etc/systemd/system/$UNIT.d/99-orchestra-web-release.conf"
   sudo systemctl daemon-reload
   test "$(systemctl show -P WorkingDirectory "$UNIT")" = "$NEW"
   sudo systemctl restart "$UNIT"
   ```

   If the check stops on pinned `ExecStart`, capture `systemctl cat "$UNIT"` and change **both** `WorkingDirectory` and `ExecStart` in the override preserving all original flags, port, owner, secrets and config. No safe literal replacement of unknown live argv can be invented from repository contents. This must be reviewed before activation.
7. After the swap, smoke the **real origin**: SPA `/` branded Sucafina; JS/CSS assets; authorized native `/orchestra/sf-dashboard/executive`, Planner and Procurement frames; actual installation discovery/context; denials/401/403; OIDC; existing `/sucafina/*` original APIs; logs. A 200 fallback alone is **not** proof. On failure restore prior `WorkingDirectory`/validated `ExecStart`, daemon-reload, restart, and verify old application. Preserve `orchsf-qa-freeze-20261117`.

**No deploy, unit mutation, merge or labels are performed by this PR.** Source tests run only via GitHub Actions; no local `bun test`.
