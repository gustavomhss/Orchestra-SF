# Orchestra Web + native Sucafina: release assembly, verification and VM cutover

**Status: BLOCKED / NOT GO-LIVE-READY (2026-11-17).** This is a runbook; it neither authorizes deployment nor constitutes an executed release. Do not replace a missing proof with a screenshot, HTTP 200, or an older Actions run.

## State of the evidence — do not conflate branches

- Owner base: `close-final-candidate`; this PR #305 is a release-only assembler and runbook, **not** an integrated candidate. `sf/ci/assemble-orchestra-web.mjs` intentionally fails closed on the base until prerequisites are integrated at **one exact source SHA**. No SF-only HTML or generic Orchestra Home fallback is permitted.
- [#262](https://github.com/gustavomhss/Orchestra-SF/pull/262) supplies the actual compiled CLI + SF factory + bundled `bin/web`, with `prepareDistribution({web})`, archive and extracted distribution verification. Run [44102855966](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44102855966) passed the generic packaged-factory test (1,300 Web files; zero public source maps); **it is not a Sucafina-branded, authenticated native-frame or 12/12 sf-ci approval**. Subsequent #262 heads/runs must be checked again; earlier receipts do not transfer.
- [#279](https://github.com/gustavomhss/Orchestra-SF/pull/279) supplies the actual official-source Sucafina branding, native discovery wire-up and F04/Q02 browser test. Its run [44101755149](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44101755149) failed `SF_VISUAL_NATIVE_FRAME_OR_IDENTITY_UNAVAILABLE_today_dark` (discovery/context responded, **native frame missing**). Artwork derivatives also require brand-owner approval. Later source/head results must be rechecked; **do not assume the issue is closed**.
- [#306](https://github.com/gustavomhss/Orchestra-SF/pull/306) records removal of the **wrong** SF-only preview releases. On that recorded VM state, `orchsf-vm` / `orchestra-sf-mvp` has `orchestra-sf-staging.service` **stopped** (its unit file may have been removed) and all four `/opt/orchestra-sf/releases/*` **deleted**. The snapshot `orchsf-qa-freeze-20261117` is retained. **There is no runnable prior directory or live unit to swap back to.** Re-observe VM state before operating; do not trust this document as a live SSH receipt.
- The required **full 12/12 `sf-ci` SUCCESS**, matching exact-SHA compiled/extracted factory receipt, branded archive **and authenticated installed native browser** have **not** been jointly shown. #262's known 6/12 run [44102855958](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44102855958) was FAILURE. No promotion or go-live until these gates close on the **same integrated SHA**.

## 1. Merge prerequisites into an approved SHA — no premature packaging

1. An authorized integrator reconciles #262 and #279 on a **separate reviewed release candidate**; preserve `apps/cli/src/sucafina-product/installation.ts`, CLI factory fence, session authority, native sidebar, route/context transport and artwork contracts. The PRs are independent drafts; **do not assume combining their tree objects yields a valid native host**. Review source diff and conflicts. No merge to `close-final-candidate` is implied by this runbook.
2. Record `RELEASE_SHA=$(git rev-parse HEAD)`; check checkout is clean and dependency lock, Bun 1.3.14, Linux x64 and native Omni inputs are pinned. The source SHA must appear identically in every receipt.
3. Require **12/12 exact-SHA `sf-ci` success** including `sf/verify` and a corresponding exact-SHA `sf-factory-package` success (compiled + extracted). Verify job conclusions from Actions **and** artifact source SHA, rather than reading a PR description. A canceled, queued, skipped, partial, red or wrong-SHA job **blocks release**; do not disable gates.
4. On the very same integrated source: authenticate through the installed host (real authorized local-operator/OIDC as configured, no fake session), navigate real `SfPageFrame` on `/orchestra/sf-dashboard/executive`, `/orchestra/sf-planner/overview`, `/orchestra/sf-procurement/contracts`. Verify frame count, installation discovery, API/context, Dark and Light themes, denial paths and screenshots only on an approved synthetic dataset. The exact-SHA F04/Q02 result and human brand-owner sign-off are mandatory; the current #279 failed result is explicitly **not** acceptance.
5. Only after these gates: assemble on the **CI Linux runner**, not the Azure VM. `ORCHESTRA_BRAND=sucafina` is set by the build. A service `ORCHESTRA_BRAND` value will **not** change already-built browser bytes.

```sh
set -eu
export SOURCE_REVISION="$(git rev-parse --verify HEAD)"
# Choose a clean, previously nonexistent absolute output path on the CI runner.
bun sf/ci/assemble-orchestra-web.mjs "/absolute/ci-output/orchestra-web-$SOURCE_REVISION.tar.gz"
sha256sum "/absolute/ci-output/orchestra-web-$SOURCE_REVISION.tar.gz"
```

The assembler validates exact source SHA; CLI/factory and Sucafina Web from the same checkout; branded `index.html`, required SVGs/assets; `distribution.json`; zero public source maps; **then decodes the actual archive outside the checkout and verifies the extracted complete distribution**. It removes its own failed/unqualified archive. Its receipt has `extractedVerified: true`, but **does not imply** authenticated browser success or 12/12; those are separate gates.

## 2. `VITE_*` exposure — browser is public

Vite embeds referenced `import.meta.env.VITE_*` values into **public JS**. Never treat these as private configuration, even when `bin/web` is served behind an authentication gateway. Observed source consumers:

| Name | Consumer / effect | Release handling |
| --- | --- | --- |
| `VITE_ORCHESTRA_SERVER_HOST` / `VITE_ORCHESTRA_SERVER_PORT` | `apps/web/src/entry.tsx`; selects an HTTP server host/port, potentially exposing internal endpoints. | **Forbidden**. Absent => same-origin server. |
| `VITE_SENTRY_DSN` | Browser Sentry DSN in `entry.tsx`; a DSN is client-public **if deliberately approved**. | **Forbidden for this candidate**; Sentry client initialization is off without it. |
| `VITE_SENTRY_ENVIRONMENT` / `VITE_SENTRY_RELEASE` | Browser Sentry metadata in `entry.tsx`. | **Forbidden for this candidate**, even though these are usually public labels. |
| `VITE_ORCHESTRA_CHANNEL` | Explicit constant `"prod"` from `packages/app-shell/vite.js` plugin `define`, independent of runner `VITE_*` variables. | **Public fixed build constant**; not a user secret. |

`import.meta.env.MODE/PROD/DEV` are also public Vite build constants, not `VITE_*` inputs. `ORCHESTRA_BRAND` is a separate build-time flag. `SENTRY_AUTH_TOKEN` is a build-plugin credential **not** to be given a `VITE_` prefix. Never put auth cookies, connection strings, Graph tokens, secrets, private tenant URLs or internal IPs in client defines.

**Fail-closed rule:** for this production assembler there are **zero permitted externally supplied `VITE_*` values**. It rejects any `VITE_*` key inherited from the runner (prints **keys only**, not values) and any `apps/web/.env`, `.env.local`, `.env.production` or `.env.production.local` file before Vite runs. No silent filtering or untracked env-file override. A future intentionally public Sentry value requires a reviewed change to this policy plus a fresh exact-SHA browser/bundle proof. This is an **input control**, not a claim that a branded bundle is currently available; inspect the *assembled* Web assets and manifest before shipping. The only explicitly injected `VITE_` constant in the inspected plugin is `VITE_ORCHESTRA_CHANNEL=prod`. No final branded published archive has yet passed this procedure.

## 3. Independently verify the published archive (runner/VM, before execution)

Record **out of band** the release candidate SHA, Actions run/job IDs, `SF_ORCHESTRA_WEB_PACKAGE_VERIFIED` JSON and trusted archive SHA256 in the release authorization. Do **not** derive the expected hash from the same untrusted tar. Transfer the archive by an approved private channel to an EU-hosted staging destination. Do not publish proprietary customer data, tokens or screenshots.

```sh
set -eu
RELEASE_SHA='PASTE_APPROVED_40_HEX_SOURCE_SHA'
EXPECTED_SHA256='PASTE_INDEPENDENTLY_APPROVED_64_HEX_ARCHIVE_SHA256'
case "$RELEASE_SHA" in *[!0-9a-f]*|"") echo "invalid source SHA" >&2; exit 1;; esac
test "$(printf %s "$RELEASE_SHA" | wc -c)" -eq 40
case "$EXPECTED_SHA256" in *[!0-9a-f]*|"") echo "invalid archive SHA" >&2; exit 1;; esac
test "$(printf %s "$EXPECTED_SHA256" | wc -c)" -eq 64
ARCHIVE="/absolute/approved/orchestra-web-$RELEASE_SHA.tar.gz"
test -f "$ARCHIVE"
printf '%s  %s\n' "$EXPECTED_SHA256" "$ARCHIVE" | sha256sum --check -
# Refuse unsafe paths, links, non-files and duplicate entries BEFORE extracting.
python3 - "$ARCHIVE" <<'PY'
import sys, tarfile
with tarfile.open(sys.argv[1], "r:gz") as tar:
    seen = set()
    for item in tar.getmembers():
        p = item.name
        if (not item.isfile() or not p or p.startswith("/") or
            "\\" in p or any(part in ("", ".", "..") for part in p.split("/")) or p in seen):
            raise SystemExit("unsafe archive member: " + repr(p))
        seen.add(p)
PY
# Verify in a private throwaway directory, not directly in an activated release.
EXTRACT="$(mktemp -d)"
tar --extract --gzip --file "$ARCHIVE" --directory "$EXTRACT" \
  --no-same-owner --no-same-permissions
cd "$EXTRACT"
test -f bin/orchestra && test -f bin/local/entry.mjs && test -f bin/local/closure.json
test -f bin/web/index.html && test -f bin/web/brand/sucafina/lockup-primary.svg
jq -e '.schema=="orchestra-distribution-v1" and .target=="linux-x64-baseline" and
       (.files|type=="array" and length>0)' distribution.json
sha256sum --check checksums.sha256
# All files: entry.mjs, index.html, every JS/CSS asset and every manifest-listed path.
jq -r '.files[] | "\(.sha256)  \(.path)"' distribution.json | sha256sum --check -
for p in bin/local/entry.mjs bin/web/index.html; do
  jq -er --arg p "$p" '.files[]|select(.path==$p)|.sha256' distribution.json
  sha256sum "$p"
done
# Separate assets evidence, and require at least one bundled JS file.
jq -r '.files[]|select(.path|startswith("bin/web/assets/"))|"\(.sha256)  \(.path)"' distribution.json |
  sha256sum --check -
jq -e '[.files[]|select((.path|startswith("bin/web/assets/")) and (.path|endswith(".js")))]|length>0' distribution.json
if find bin/web -type f -name '*.map' | grep -q .; then echo "public sourcemaps detected" >&2; exit 1; fi
# Bun.Archive does not necessarily carry executable mode: restore from descriptor.
jq -r '.files[]|select(.executable)|.path' distribution.json |
  while IFS= read -r p; do chmod 0755 "$p"; done
test -x bin/orchestra
echo "VERIFIED extracted tree: $EXTRACT (NOT DEPLOYED)"
```

For each explicit entry, **SHA256 of extracted bytes must equal its `distribution.json` record**; `checksums.sha256` separately includes `distribution.json`. Confirm the `bin/web/index.html` brand marker `data-orchestra-brand="sucafina"`, title, favicon and asset references, then request JS/CSS on the actual staged HTTP origin (not just local files). Compare archive hash with the **independent** release approval. `jq`, `sha256sum`, `python3` and GNU tar must be available on the verifier host. The final archive must be promoted only from the **same** successful 12/12 + factory + native browser SHA; extraction integrity alone proves **bytes**, not user authorization or UI correctness.

## 4. Staging and first activation on the current empty VM

**Current baseline per #306:** old `orchestra-sf-staging.service` is stopped or its definition missing; its old `WorkingDirectory` points at a **deleted** release. Thus there is no valid `OLD` service to `restart` or to roll back to. `/opt/orchestra-sf/releases` must be treated as empty until verified otherwise; the old 1.18.27 SF-only builds are retained in quarantine **forensics**, not as a production rollback. The VM is in Sweden Central; stage data in EU only.

1. Acquire owner approval and inventory **read-only**: `systemctl cat orchestra-sf-staging.service` (may fail if deleted); `systemctl show -P ActiveState/WorkingDirectory/ExecStart` (query individually); `ls -la /opt/orchestra-sf/releases`; reverse proxy, ingress origin, service user, config/credential sources and existing `--installation` arguments. Record outputs privately, redact secrets. If there is no unit, require a **reviewed new unit** restoring the approved host arguments, identity, port, secrets and ingress contract; do not invent them in this PR. Never resurrect the old preview's binary path.
2. Copy the independently verified temporary tree into a **new, nonexistent** immutable `/opt/orchestra-sf/releases/orchestra-<RELEASE_SHA>` using an authorized deployment identity; preserve the manifest-required executable modes and then rerun all SHA checks in that final location. Set least-privilege service ownership/permissions before start. The validation example runs unprivileged and does **not** deploy. Preserve customer env/OIDC and secrets in the host-only unit/config; `bin/web` must remain public-safe. Verify `bin/orchestra serve --installation <release>/bin/local/entry.mjs` is the real launch path and that the CLI resolves `bin/web`; `apps/cli/src/commands/handlers/serve.ts` and `packages/server/src/routes.ts` describe the corresponding SPA/API mounting behavior.
3. Launch **only on an isolated origin**, with a real test installation matching that origin. Use the actual reviewed unit or isolated equivalent; no fake Microsoft/OIDC token or cross-origin production cookie. Verify branded `/`, CSS/JS, favicon, 15 native chapter links and `SfPageFrame` (especially Dashboard/Planner/Procurement), discovery/context, authority denials, actual authenticated session and legacy APIs. Capture safe synthetic evidence.
4. During authorized maintenance, update/install **the reviewed** `orchestra-sf-staging.service` to point explicitly to the new immutable release, preserving correct user, arguments, systemd `WorkingDirectory`, `ExecStart`, `EnvironmentFile`, ingress, host and security hardening. If reusing a unit with old pinned `ExecStart`, override **both** `ExecStart=` (reset) and replacement command and `WorkingDirectory=` after review. **Do not** run an override based only on `systemctl show -P WorkingDirectory` from a deleted old release. `sudo systemctl daemon-reload`, inspect `systemctl cat` and `systemctl show`, then explicitly `enable/start` only after approval. No automatic switch to an old release.
5. Real-origin post-start check: branded shell HTML/JS/CSS and actual native-frame mounts, logged-in/unauthorized paths, OIDC flows, source SHA and factory proof, Windows/desktop compatibility where applicable, proxy status, and runtime errors. An HTTP 200 or green generic Home is insufficient. On failure **disable/stop the new unit and close ingress**, preserve logs/evidence, and return to the **stopped/quarantined state**. Do not set `WorkingDirectory` back to a nonexistent old directory.

## 5. Snapshot recovery — disaster path, NOT normal rollback to go-live

The snapshot `orchsf-qa-freeze-20261117` predates quarantine and therefore can reintroduce the **wrong old SF standalone UI** if blindly booted. Recover first **under network isolation** with no public ingress/load-balancer exposure; disable the restored service before reconnecting a real hostname. Prefer recreating/redeploying a verified correct candidate over promoting quarantined bytes.

```sh
set -eu
RG=orchestra-sf-mvp
VM=orchsf-vm
SNAP=orchsf-qa-freeze-20261117
az account show --query '{subscription:id,tenant:tenantId}' -o json
az vm show -g "$RG" -n "$VM" --query '{location:location,osDisk:storageProfile.osDisk.managedDisk.id,size:storageProfile.osDisk.diskSizeGb,dataDisks:storageProfile.dataDisks[].managedDisk.id}' -o json
az snapshot show -g "$RG" -n "$SNAP" --query '{id:id,location:location,osType:osType,size:diskSizeGb,source:creationData.sourceResourceId,sku:sku.name,security:securityProfile}' -o json
SNAPSHOT_ID="$(az snapshot show -g "$RG" -n "$SNAP" --query id -o tsv)"
test -n "$SNAPSHOT_ID"
# Review snapshot OS-disk origin, Sweden Central, size, zone, encryption/CMK,
# TrustedLaunch compatibility and retention BEFORE creating a disk.
# Only with an approved unique name + compatible SKU (set outside this file).
: "${APPROVED_RESTORE_DISK_NAME:?select a unique recovery disk name after review}"
: "${APPROVED_RESTORE_DISK_SKU:?select matching disk SKU after review}"
az disk create -g "$RG" -n "$APPROVED_RESTORE_DISK_NAME" --source "$SNAPSHOT_ID" \
  --sku "$APPROVED_RESTORE_DISK_SKU" --location swedencentral
```

For an **explicitly authorized full VM restore only**: isolate network/ingress, retain the current OS disk ID and the data-disk/NIC identity; independently compare disk size, zone, encryption and VM-security compatibility; choose the new disk ID returned by `az disk show`; then stop/deallocate the VM, `az vm update -g "$RG" -n "$VM" --os-disk "<approved-new-disk-resource-ID>"`, verify `az vm show ... --query storageProfile.osDisk.managedDisk.id`, and start **while ingress remains blocked**. Disable `orchestra-sf-staging.service` in the restored guest before permitting any traffic; inspect data and config, and only then rebuild the correct release. Disk swap is operationally destructive/disruptive and **not executed** here; the snapshot might be for a different disk, in which case **STOP** rather than trying an OS swap. Keep the original and restored disks until acceptance; do not delete the snapshot. Azure disk swap guidance: https://learn.microsoft.com/en-us/azure/virtual-machines/linux/os-disk-swap.

**No Azure access, VM mutation, unit activation, merge, labels or local `bun test` is performed in #305.** Only source/build guard changes and Actions-based review are in scope.
