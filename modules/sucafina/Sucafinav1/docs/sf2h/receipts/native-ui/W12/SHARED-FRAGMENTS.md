# W12 — fragments for integrator 114 (inert, not applied)

**Output:** U10.queue only. **Status:** BLOCKED_CONTRACT; never interpret as installation, approval, or successful source read.

## Typed i18n leaf fragment

Current W12-owned producer of the strings:
\`packages/app-shell/src/orchestra/chapters/sucafina/procurement/queues/copy.ts\`

Target owned elsewhere:
\`packages/app-shell/src/i18n/orchestra-chapters/sf-u10.ts\`

The target is not in the W12 allowlist. For 114/remaining U10 output only, the
complete proposed *new file* content is:

\`\`\`ts
// W12 queue keys; U10.overview owner may extend this module later.
export {
  SF_U10_QUEUE_COPY as SF_U10_COPY,
  SF_U10_QUEUE_COPY_BR as SF_U10_COPY_BR,
} from "../../orchestra/chapters/sucafina/procurement/queues/copy"
\`\`\`

This is a **new-file fragment** (preimage absent at frozen C58), not an
instruction to overwrite any subsequently created \`sf-u10.ts\`. 114 must
re-read the target at integration and merge against any newer U10 owner. The
existing \`packages/app-shell/src/i18n/orchestra.ts\` and central typed keys
are shared registries: 114 owns their current preimage/full patch and must
merge these exact local dictionary keys, never write them from W12.

Frozen keys used in W12 outside the leaf are from CAP24 title/primary and
the common-copy table in \`surface-manifest.json\`. No additional global keys
or unpinned pt-BR translations were introduced.

## Native page / route registry is blocked

Expected export after A03 contract admission:
\`SfProcurementQueueView(props: SfSurfaceProps): JSX.Element\` from
\`packages/app-shell/src/orchestra/chapters/sucafina/procurement/queues/index.tsx\`.

**There is intentionally NO proposed registration yet.** The existing A03
\`domain.page.CAP24\` JSON envelope lacks:
\`ProcurementQueueRow\` evidence ref/digest, version, status, subject, holder,
approvalStage, stageEnteredAt, ageDays, base/submitted/original amounts, reason
and nextStep, plus server-side \`procurementApprovalGroups\` grouping. Its
\`DashboardData\` contract only contains \`requests\`, \`formSettings\` and
\`metrics\`. CAP26 is outside this W12 operation-refs list and its grouped
requests do not supply measured C02 age/source evidence. Do not derive them
from browser clocks, principalRef, approver lists or financial summaries.

114 and A03 must explicitly resolve the CAP24 typed queue projection and
contract digest, with its actual producer/read current visibility and owner
fence. F01 must supply the named same-owner route builder/selection-state
public API so the W12 page can bridge the row's original \`SfRef\` and
source evidence to U11/Requests without URL concatenation. Page code and
central registry must then be authored only against those real exports.

## Independent artifact supplied now

\`SfProcurementQueuePanel\` in \`queues/panel.tsx\` is a pure Solid
presentation with injected authenticated context/tabs/state/table pagination
and F01-owned source navigation callbacks. It does not fetch, dispatch,
guess access or cache across owners.

\`queues/model.ts\` consumes already authorized producer rows and server-
assigned approval groups. It makes only display filters and missing/zero
distinctions. \`queues/queue.css\` uses reflow only; \`queues/copy.ts\` is the
localized fragment. \`w12-queue.test.ts\` is a component-level fixture, not
installed product proof.

## Handoff fencing

- Only integrate the W12-owned paths after matching pre/post blobs and
  current owner lease. Do not merge PR127's whole branch/history.
- 114/C00 alone admits, composes and records consumer ACK.
- 120 alone runs the relevant GitHub Actions selections.
- 119 alone performs compiler/guards.
- No local tests, merge, deploy, Azure, generated SDK edits or external agent messages.
