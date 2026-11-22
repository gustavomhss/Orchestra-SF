# Wave four — validation

Status: **IN_PROGRESS**. Twelve of twenty areas have passed their complete browser journeys and visual review. The source refusal in Decisions is now diagnosed: an expired global Procurement selection was checked before case eligibility, vetoing an unrelated Planner read. The minimal correction has passed independent static review. Decisions14 is running on that correction; the scoped canonical regression is being completed.

## Candidate and scope

- Product code: `e5494ff044ee46cdd80c1d754131c284538d4d31`.
- Incorporated dev: `2eeb114266f8b9c9df9bb8f78a02ccf242cdc68b`.
- Isolated branch: `sf-design-twenty`; [draft PR #588](https://github.com/gustavomhss/Orchestra-SF/pull/588).
- Earlier block: PR #587 merged as `d9ab14b6d9cab74843b0689d5d67d1c70d45cc02`.
- This block: 20 inventory areas, 49 registered route patterns. Recognition of a route is not independent qualification of every state.
- Browser and technical snapshots retain their exact parent commits below. User acceptance of this block is pending; it has not been merged.

| Area | Native surface | Registered patterns | Evidence group |
| --- | --- | ---: | --- |
| CAP20 | Headcount | 6 | planner |
| CAP21 | Alocações | 3 | planner |
| CAP22 | Câmbio / FX | 1 | planner |
| CAP23 | Versões e comparação | 4 | planner |
| CAP24 | Compras — visão geral | 1 | procurement |
| CAP25 | Requisições, fila e sourcing | 8 | procurement |
| CAP26 | Aprovações | 3 | procurement |
| CAP27 | Fornecedores | 4 | procurement |
| CAP28 | Configurações de compras | 1 | procurement |
| UI30 | Meu trabalho | 1 | work |
| UI31 | Busca Sucafina | 1 | work |
| UI32 | Visões salvas | 3 | work |
| UI34 | Intenção do caso | 1 | decisions |
| UI35 | Alternativas | 3 | decisions |
| UI36 | Premissas e divergências | 1 | decisions |
| UI37 | Perguntas e respostas | 1 | decisions |
| UI38 | Escolha da decisão | 1 | decisions |
| UI39 | Alterações preparadas | 2 | decisions |
| UI40 | Histórico e recibos | 2 | decisions |
| UI41 | Análises | 2 | decisions |

## Hosted technical verification

[Gate16 / run 44971393754](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44971393754), job `137051745585`, snapshot `1fe0927db37e63f6e9d70537c524ec5f6ead6ac0`, passed **14 checks / 87 regression cases** on product `d179d4abbc4c189d9135e5cc2d38487b6e4ba99c`, including the third upstream composition. The subsequent case-read correction and its new regression require the final technical gate.

| Check | Result |
| --- | --- |
| Application declaration build | PASS |
| E2E semantic typecheck | PASS |
| Full CLI package typecheck | PASS, zero diagnostics |
| Exact-dev repository guards | PASS: 78 rules, 0 errors, 21 warnings, 0 approvals |
| Generated palette parity | PASS: all 7 files byte-identical |
| Portfolio CAS | 3 cases passed |
| Vendor browser DTO | 4 cases passed |
| Decision browser DTO | 5 cases passed |
| Procurement browser DTO | 10 cases passed |
| Work/Search source health | 18 cases passed |
| Original installed-host smoke | 1 test, 15 original assertions passed |
| Decision source health | 24 cases passed |
| Analysis source health | 19 cases passed |
| Saved Views browser DTO | 3 cases passed |

Twenty guard warnings concern bounded canonical I/O timeouts. The remaining double-cast warning is inherited from the original CAP20 expression; the diff changes its signal access, not the cast's meaning. No warning approval was used. Guards, workflow definitions and allowlists were unchanged.

The E2E project retains strict semantic checking and noEmit, with declaration emission/composite disabled for that test project. The independent application declaration build remains enabled. Historical full-CLI diagnostics were fixed by incorporated upstream commits; they are not a current limitation. See [TYPECHECK.md](TYPECHECK.md), [cli-type-audit.json](cli-type-audit.json) and [technical-verification.json](technical-verification.json).

## Original browser journeys and provenance

| Scope | Run | Snapshot | Product parent | Observed result |
| --- | --- | --- | --- | --- |
| Planner | [44961772161](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44961772161) | `9f52fd75da5f789f91b61d595a86651277ec2ec0` | `70b756800304adb9c0e9ff494f3cd3fc189fe828` | 2 passed; 5 writes/readbacks; 40 captures |
| Procurement | [44965165654](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44965165654) | `7f3de0206fc25b2925d7c55947d9b5785bdfe7ba` | `331cafc50bee2112f6366ff428658de938c6f58e` | 4 passed; 11 POSTs/readbacks; 43 captures |
| Work/Search/Saved Views | [44965705732](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44965705732) | `6bff36e3308c4ac205a59011827c8f19c06c5873` | `87a738830c83bf1fa9ee30c32b38fb1e297b30f8` | 3 passed; 1 view save/readback; 22 captures |
| Decisions | [44966014444](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44966014444) | `8cfd3eb141d31d18ee2b32dda629d67e7d44c10a` | `250e8faf80931c807a86c5f06c0e797de469adca` | Failed from UI41 light original-source coverage onward; followed by diagnostic Decisions11 |
| Decisions diagnostic11 | [44968620170](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44968620170) | `47cbbb5eb1f9b8518f3cada5838429fcb4d4a5ab` | `218a5ee39935336c88abeb92b0a4d2cc980f21de` | Failed on UI41 light real-content assertion; original503 reason identified; guard discriminator pending |
| Decisions corrected journey14 | [44972048219](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44972048219) | `58def9db4b3aa4c156a041eb86fbbd41de95bba7` | `e5494ff044ee46cdd80c1d754131c284538d4d31` | Running after the minimal case-read scope correction; includes focused UI35 comparison notice |
| Previous six native areas | [44963871177](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44963871177) | `f6533b5856840c4722f38d3e5070204c8e4d4877` | `7c0caf8da905a03579379c35ce1cd49375a87509` | 2 passed; 67 complete previews; 6 representative JPEGs persisted |
| Planner + previous six after dev composition | [44965221018](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44965221018) | `fcd8c3099ecc04ae7fd47c3d323e889b4b1af0a8` | `331cafc50bee2112f6366ff428658de938c6f58e` | Workflow and Run tests step PASS; combined decoded log unavailable |

The earlier composition run on dev3ce selected the original Planner and first/second-wave specs. Its job, test step, artifact upload and cleanup completed successfully. MCP returned “Transport closed” for both combined-log retrieval attempts. No combined test, capture, error or write total is inferred from that unavailable log. The original separately read Planner and regression galleries retain their exact source commits. [Composition manifest](evidence/composition/manifest.json).

Work's selected gallery retains seven UI30 images from Work9 and six UI31 images from Work8; all three areas then passed together in Work10. Nine UI32 images are from Work10. A selected area's earlier successful images are not relabeled as images from the latest product.

## Meaningful source outcomes

### Planner — CAP20–CAP23

The real source recorded FTE 1 → 0.9, allocation 65/35 → 60/40, EUR 1.08 → 1.09 with provenance, a version rename and a copy found in a fresh original list. Drafts survive cancel/revise, original version/CAS remains attached, and absent FX/financial values remain distinct from zero. Comparison exposes all twelve months through keyboard-accessible internal scrolling.

All 40 images were reviewed, including 320px and pt-BR. The root independently reviewed ten representative states. Minor nonblocking observations are a final-letter wrap in a Portuguese infrastructure label and repeated source-unavailability explanations. Unavailable roster/import impact is rendered honestly and its write is not claimed. [Planner report](planner/PLANNER9-REVIEW.md).

### Procurement — CAP24–CAP28

Eleven original producer POSTs each had a fresh canonical source readback: save/create/submit requisitions, save sourcing, approve PR, approve sourcing, reject PO, save PO draft, create/edit supplier and save settings. Sourcing retains selected quotation identity, evaluator, descriptions and notes; order editing retains existing line notes. Settings read back reminder 9 while minimum quotes 3 and USD remain unchanged.

All eleven responses passed HTTP 200 and JSON content-type assertions. Six bodies were readable and contained ok:true; five were unavailable to the collector, with class Error and no established cause. Those five were not treated as readable positive bodies. They additionally required original review completion, ready provider/view, exactly one POST and command-specific source readback. Readable negative or malformed responses still fail. [Procurement report](procurement/HANDOFF.md).

All 43 captures were reviewed; the root independently inspected a sample from each area. Dense tables retain internal horizontal scrolling. Original empty Actions columns and the repeated PO heading/fieldset are recorded as nonblocking observations.

### Work, Search and Saved Views — UI30–UI32

Work uses an original local Hot Topic handoff with genuine source owner/version and two independent authorized destination opens. Both reauthorizations returned HTTP 200 before the native Hot Topic page appeared. The returned owner label “unknown” remains unchanged.

Search performs the actual private query and a separate original read confirms matches:[]. Local filtering does not send a second query. The isolated source contains no uploaded searchable document; nonempty results and their destinations are not qualified.

Saved Views edits an original V1 view, reviews/cancels/revises, confirms one save and rereads version 2 through the source and a fresh native route. Name/density change while exact period and filters survive. Removal is reviewed and canceled. Native V2 views and preferred entry remain unavailable. No V2 command or deletion was performed. All 22 selected images were reviewed; the root sampled each area. [Work report](evidence/work/README.md).

### Decisions — UI34–UI41

Complete qualification remains pending. The original Decisions11 case probe returned HTTP503 / unavailable / procurement-case-read-changed, followed by current-choice403 / current-choice-case-unavailable. Context remained200 and the four required operations remained ready.

The disposable diagnostic [Decisions13](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44970679515) then identified the first false predicate: selection-expired on a global Procurement selection. Its log contains 63 global-origin observations and 10 expiry failures at transaction entry/egress, with no competing request, identity or exception failure. The original decision-controls reader creates that selection through an admitted sf_work_list using the case horizon, even for a Planner case. Its cleanup releases the collection reference and child lease, while the global period entry remains for five minutes. This establishes both the selection's real origin and the failing branch.

The correction in procurement-case-read-scope.ts preserves common Request, signal, binding/input digests, authority and C08 actor/participant checks. It applies the original selection, reader and expiry checks after the unchanged C12 eligibility predicate and retains them through eligible Procurement egress. Noneligible cases return to the canonical reader outside the SQLite lock. TTL, original controls, source/authorization contracts and seed are unchanged. Independent static review passed; runtime and the new scoped regression remain pending. The regression will distinguish a canonical Planner positive from structural negative Procurement guard fixtures; no positive C12 preparation/application coverage is inferred.

The original source and fixture instrumentation used for diagnosis is absent from the product. Decisions12 failed before startup because of a diagnostic forwarding syntax error and is explicitly not source evidence. The [diagnostic record](decisions-source-diagnostic.json) and [attempt ledger](attempts.json) retain these distinctions.

The coordinator reviewed ten source-positive partial images from Decisions11 across all eight areas, finding no visual blocker. UI35's final journey adds a focused 320px capture of the original comparison limitation notice. Partial images from a failed journey do not qualify later light/narrow/Portuguese states. UI38 retains a Portuguese producer-provided reason in the English chrome; that original source copy is not rewritten as a catalog literal. [A15 contract review](A15-REVIEW.md) remains separate from runtime evidence.

## Implementation boundaries and corrective work

The redesign uses the existing native glass surfaces and tokens, a 1160px content axis, 32/24/16 spacing, 44px controls and focused list/editor/review compositions. It preserves canonical empty, unavailable, unknown, pending and conflicted states. It does not synthesize success, zero, receipt or actor data.

The functional work includes plain command snapshots at strict schema boundaries (Solid stores remain reactive in the UI); exact numeric and nested-field preservation; native Procurement source projection forwarding and period-compatible approval lookup; a CAP28 reactive-loop correction that preserves remote-conflict checks; exact original-source health for Decision and Analysis reads; and seven A15 route descriptors targeting the already supported original dashboard handler. These are real integration changes, not solely styling. Frozen catalogs, original producer contracts, grants and the F02 codec remain closed.

All 574 preexisting English literals across the ten audited catalogs are unchanged. Nine new English keys have explicit Brazilian Portuguese literals; all 583 current keys have BR values. The audit does not claim to cover unrelated catalogs. [Copy audit](copy-audit.json).

## Limits and review status

- Chromium only; desktop and narrow CSS viewport samples. Actual browser zoom and measured contrast ratios were not tested.
- Planner/Procurement include pt-BR narrow samples. Work has pt-BR desktop initial states, not pt-BR 320px.
- The 49 route patterns are source inventory, not a route × state × locale × theme cross-product.
- Work's successful destination is the genuine Hot Topic path. Earlier original Procurement-detail calls returned HTTP 503; that successful path is not qualified, and its cause is not established. C58/clock/source fences remain unchanged.
- No supplier bank write, activation, policy reset, external order delivery or external notification was exercised.
- Original unavailable analysis models/operations must remain unavailable; catalog/history success cannot qualify prepare/start/cancel/read/output without their own real operation/run evidence.
- No original changes or application receipts are fabricated to populate UI39/UI40.
- All runtime work used existing test-ci snapshots through GitHub. No owner-machine runtime, alternate CI lane, workflow change, authorization bypass or response mock was used.
- This block remains in draft PR #588. Prior acceptance of 21 earlier areas does not approve these twenty.

The complete attempt ledger, including failures and corrections, is [attempts.json](attempts.json).
