# N21 — inert shared-patch handoff to integrator 125

**Owner:** 125 / S0-C-e18-browser125 / PR65. **Author:** N21, epoch ux-native-n21-e1, branch sf-ux-n21. **Destination:** sf2-stack. **Do not paste blindly:** recheck the actual live preimage and merge individual blob postimages against integrator current HEAD, not the entire old UX cohort PR branch. This is inert documentation; N21 did not change a shared product file.

## PATCH I18N-125-01: global Orchestra dictionary

Target (shared/125): packages/app-shell/src/i18n/orchestra.ts
Observed sf2-stack **preimage blob**: 91e526cd53e2c020f36efacb60ecad250a4da11b. Recheck preimage. Exact scoped patch over observed preimage:

~~~diff
@@ immediately after import of SF_S05_COPY pair
+import { SF_U36_COPY, SF_U36_COPY_BR } from "./orchestra-chapters/sf-u36"
+import { SF_N21_OVERVIEW_COPY, SF_N21_OVERVIEW_COPY_BR } from "@/orchestra/chapters/sucafina/procurement/overview/copy"
@@ export const ORCHESTRA_COPY (after ...SF_S05_COPY)
+  ...SF_U36_COPY,
+  ...SF_N21_OVERVIEW_COPY,
@@ export const ORCHESTRA_COPY_BR (after ...SF_S05_COPY_BR)
+  ...SF_U36_COPY_BR,
+  ...SF_N21_OVERVIEW_COPY_BR,
~~~

Author leaf postimages:
- packages/app-shell/src/i18n/orchestra-chapters/sf-u36.ts = 1c07c54473d2678f8ec2d9289e829cc6df5406e8
- packages/app-shell/src/orchestra/chapters/sucafina/procurement/overview/copy.ts = ce6b82e4d425eb5f74788b23a1e572a497a7c034

Both are static dictionaries. W12 owns the protected sf-u10.ts. Integrator checks key collision and COPY-01 before applying.

## PATCH ROUTE-125-02: closed F01 native chapter registration

Surface-manifest frozen route:
- CAP24 entry: /orchestra/sf-procurement/overview
- CAP28 entry: /orchestra/sf-procurement/settings

The shared active route composer is owned by 125 and was not present at the N21 base. The exact component import/placement fragment to integrate into the existing 125-owned typed route registry is:

~~~tsx
import { SfProcurementOverviewView } from "@/orchestra/chapters/sucafina/procurement/overview"
import { SfProcurementSettingsView } from "@/orchestra/chapters/sucafina/procurement/settings"

// CAP24 -> SfProcurementOverviewView with real SfSurfaceProps<"CAP24">
// CAP28 -> SfProcurementSettingsView with real SfSurfaceProps<"CAP28">
// Must be inside existing SfContextProvider, current installation and approved owner.
// No new dispatcher, arbitrary href, fake SfSurfaceProps or direct HTML rendering.
~~~

CAP24 primary action remains disabled until integrator provides the frozen F01 authorized same-owner builder for the CAP25 requests route. Do not interpolate arbitrary server or owner refs. This is not W12 queues.

## PATCH OPERATION-125-03: original A03/F02 adapter integration

Before making either leaf available, integrate W11/A03, typed operation family and F02 codecs without adding a generic dispatcher:
- GET domain.page.CAP24: source-summary requests, formSettings, producer metrics (edits=false/open/issued OPEX+CAPEX/approved OPEX+CAPEX/unavailable), no browser FX calculation. W11 source adapter blob: 0751e4861ab025a7bfc0f132fb24409fd29f8198.
- GET domain.page.CAP28: settings/directory/versions.settings.version, original Procurement admin + owner stamp; W11 schema blob 1b69faa66446264d70964f0235a3e77d1979e6fb, client blob 7875c98e14fcde4255bd807f094685cc0fcf60b6.
- POST domain.command.CAP28.save: page Settings/action save/version=settings CAS/values.settings original fieldset, one idempotency key, original Request and same-owner authorized refetch after success.
- POST domain.command.CAP28.reset: intentionally NOT invoked. A03 read offers no authoritative reset-default baseline for a required preview; never fabricate/default/reset blindly.

**Open CAP24 source need (125/W11/U21):** authorized CAP24 DashboardData does not contain versioned holder/stage measured-aging DTO. Actual readProcurementQueueView exists in source but is not included in the admitted CAP24 port. U10-AC01 cannot close. Only integrate measured producer projection under correct owner. No holder guess or timestamp aging approximation.

**Open CAP28 source need (125/W11/S03):** reset requires before/default original producer preview under same authority/CAS with explicit danger confirmation. No preview response is currently typed. S03 also needs authoritative known 4xx/409 pending-operation settlement (N21 fences pending after failed POST rather than silently retry/release).

## PATCH W12-125-04: combined U10

W12 is sole owner of procurement/queues/**, sf-u10.ts and u10.spec.ts (PR127). N21 authored only U10.overview. 125/W12 must integrate combined route and criteria; do not modify W12 files from N21.

## Qualification requests and state

- 119 / PR107: compiler, guards and generated code; check F01/F03/S03 + A03 types. N21 ran no local checks.
- 120 / PR106: surgical GitHub Actions only. u36.spec.ts requires actual installed F04 private manifest and admin session. Exercise 320/768/1024/1280/1440, 200% and 400% reflow, real save/refetch/CAS, stale/denied/owner switch/lost response and blocked reset. u10.spec.ts remains W12-protected.
- 125 / PR65: reconcile each source/postimage, apply global copy/route/operation registration, consume 119/120 evidence. No dev merge/deploy/Goal by N21.

State: ARTIFACT_READY (leaf authoring only); NOT_INTEGRATED, NOT_QUALIFIED, NOT_RELEASED. No canonical producer outcome or installed browser proof claimed. PREPOST.json is the blob record, HANDOFF.json is the acceptance trace.
