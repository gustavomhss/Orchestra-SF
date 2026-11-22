# Analytics source equivalence

## Status and scope

This record binds UI42–UI46 to source composition `ef8d53e59c779e36bfddf0b375dbcf7c92541706`, from pinned dev `d3ccea42b5f8409c8d6c68e4909f7b868b50322c`. It records source identity and the purpose of each adapter change. At this revision, the installed portfolio/sensitivity journey is running in [44986981782](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44986981782); the BI temporal-source correction is still pending. This is not a completed five-area qualification or user visual approval. Failed attempts and actual inspected screenshots remain in [ATTEMPTS.md](ATTEMPTS.md); the narrow diagnostic receipts are in [DIAGNOSTICS.md](DIAGNOSTICS.md).

| Area | Presentation and authoritative content |
| --- | --- |
| UI42 scenarios | Authorized case collection, selected case facts, candidate/constraint/priority editing, preview, review and original recorded history. Selection remains a draft until the explicit original evaluation. |
| UI43 portfolio result | Original persisted result reference, combinations, eligibility, comparison state, source references and limitations. No complete total is inferred from conditioned coverage. |
| UI44 sensitivity | Source-issued scenario/parameter/unit selection, bounded editor, retained review draft and original persisted samples/threshold evidence. Sampled intervals remain sampled; absent exact thresholds remain absent. |
| UI45 BI catalog | Eleven existing questions in the original finance, operations and decisions families; explicit original context/period selection and read stages. |
| UI46 contextual BI | Original financial/operational projection values, evidence, units, dates and missing states. Named local chart/table scrolling and exact value-source actions preserve the producer identities. Genuine empty source options remain empty. |

Every page opts into the shared frame with `data-sf-wave="five"`. The established 1160px axis, 32/24/16px gutters, 44px controls, native fonts/tokens and quiet glass remain the design vocabulary. The global shell, palette mechanics and numerical calculation owners are unchanged. Lists, details, editors and reviews receive distinct work stages without replacing draft or command owners.

## Original contracts, source handlers and copy

The following fourteen files have identical Git blobs in pinned dev and the composition above. This includes all four relevant i18n catalogs: no existing English or Brazilian Portuguese key/text was changed and no new product copy was introduced.

| Original file | Unchanged Git blob |
| --- | --- |
| [packages/app-shell/src/i18n/orchestra-chapters/sf-u19.ts](https://github.com/gustavomhss/Orchestra-SF/blob/ef8d53e59c779e36bfddf0b375dbcf7c92541706/packages/app-shell/src/i18n/orchestra-chapters/sf-u19.ts) | `71c55406b4794f445f6a9c5f6db33c393d1f650e` |
| [packages/app-shell/src/i18n/orchestra-chapters/sf-u20.ts](https://github.com/gustavomhss/Orchestra-SF/blob/ef8d53e59c779e36bfddf0b375dbcf7c92541706/packages/app-shell/src/i18n/orchestra-chapters/sf-u20.ts) | `6f0237007c20c286a33cefcc94bb1f9f3dd7bcfe` |
| [packages/app-shell/src/i18n/orchestra-chapters/sf-u21.ts](https://github.com/gustavomhss/Orchestra-SF/blob/ef8d53e59c779e36bfddf0b375dbcf7c92541706/packages/app-shell/src/i18n/orchestra-chapters/sf-u21.ts) | `60896d37fadeeb4daa8253f3e3f013c67db14d8f` |
| [packages/app-shell/src/i18n/orchestra-chapters/sf-u22.ts](https://github.com/gustavomhss/Orchestra-SF/blob/ef8d53e59c779e36bfddf0b375dbcf7c92541706/packages/app-shell/src/i18n/orchestra-chapters/sf-u22.ts) | `38756143173b153e242dc0e53a4fb3a63809534c` |
| [packages/schema/src/sucafina/portfolio.ts](https://github.com/gustavomhss/Orchestra-SF/blob/ef8d53e59c779e36bfddf0b375dbcf7c92541706/packages/schema/src/sucafina/portfolio.ts) | `5ace759126c6e810d9718df01ce22779146193ce` |
| [packages/schema/src/sucafina/decisions.ts](https://github.com/gustavomhss/Orchestra-SF/blob/ef8d53e59c779e36bfddf0b375dbcf7c92541706/packages/schema/src/sucafina/decisions.ts) | `c42b12d9189862399cd166924d212c84114b5fb3` |
| [packages/schema/src/sucafina/bi.ts](https://github.com/gustavomhss/Orchestra-SF/blob/ef8d53e59c779e36bfddf0b375dbcf7c92541706/packages/schema/src/sucafina/bi.ts) | `02504f838da6680a5fff1d1f9f6a337d075d68ca` |
| [packages/schema/src/sucafina/operation-registry.ts](https://github.com/gustavomhss/Orchestra-SF/blob/ef8d53e59c779e36bfddf0b375dbcf7c92541706/packages/schema/src/sucafina/operation-registry.ts) | `69ddae805e20e4ed8a9724bd9613226865cd632d` |
| [apps/cli/src/sucafina-product/portfolio-http.ts](https://github.com/gustavomhss/Orchestra-SF/blob/ef8d53e59c779e36bfddf0b375dbcf7c92541706/apps/cli/src/sucafina-product/portfolio-http.ts) | `6cbfc373ea72a90351e4f9997f65663e0f5fc775` |
| [apps/cli/src/sucafina-product/decision-controls.ts](https://github.com/gustavomhss/Orchestra-SF/blob/ef8d53e59c779e36bfddf0b375dbcf7c92541706/apps/cli/src/sucafina-product/decision-controls.ts) | `23721ab89535bcf8644a98cf3ed2de65a929a329` |
| [apps/cli/src/sucafina-product/extended-bi-options.ts](https://github.com/gustavomhss/Orchestra-SF/blob/ef8d53e59c779e36bfddf0b375dbcf7c92541706/apps/cli/src/sucafina-product/extended-bi-options.ts) | `865eb0ca54fce9dd9c85ea227b0bc6e947f9e170` |
| [apps/cli/src/sucafina-product/extended-source-links.ts](https://github.com/gustavomhss/Orchestra-SF/blob/ef8d53e59c779e36bfddf0b375dbcf7c92541706/apps/cli/src/sucafina-product/extended-source-links.ts) | `d4d61b34e294463f7adf300cb813654b16db9a1f` |
| [packages/app-shell/e2e/sucafina/design-support/wave-four-decisions-seed.ts](https://github.com/gustavomhss/Orchestra-SF/blob/ef8d53e59c779e36bfddf0b375dbcf7c92541706/packages/app-shell/e2e/sucafina/design-support/wave-four-decisions-seed.ts) | `32b39933bf81c220729d3af910809e7d7b88910f` |
| [packages/app-shell/src/orchestra/chapters/sucafina/bi/safe-destination.ts](https://github.com/gustavomhss/Orchestra-SF/blob/ef8d53e59c779e36bfddf0b375dbcf7c92541706/packages/app-shell/src/orchestra/chapters/sucafina/bi/safe-destination.ts) | `1e019132a0aeb7c94761138adaadf828061b4570` |

The canonical portfolio family still contains its original ten operations and closed inputs without a top-level surface. Native leaves use seven of those existing operations. No operation registry, schema, permission, grant, source handler or authorization rule was broadened by the analytics presentation work.

The unchanged four-decisions fixture remains the source of its actual installed dashboard/Planner/case setup. The additional owned preparation reopens the authorized forecast and its issued coverage receipt, selects a confirmed February component, and submits one explicit replacement hypothesis through the original decision-promote operation with that exact amount, currency, period and identity. It then reopens original controls to use the returned alternative/scenario/parameter references. It does not insert a portfolio/sensitivity result or retroactively patch a source-only scenario.

## Narrow runtime repairs

**Native operation readiness and units.** The integration owner repaired independent-operation admission so an exact ready/operational operation remains usable in an original partially available resource. It still requires the exact family and operation. The units adapter decodes the original closed output and compares its case, scenario, baseline and parameter binding exactly before exposing units. The source context still reports unavailable siblings honestly.

**A05 installed route.** The client recognizes the family through the original SfPortfolio catalog and validates its input with the original codec before selecting the installed dashboard source route. The surface is route metadata, not a new request field. The wire input/body and closed source contract are unchanged. The URL constructor retains installed origin/mount/identity checks. Fourteen targeted pure route/codec cases passed in [44984522074](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44984522074), job `137092065071`, snapshot `af362894ef621eafb4e2c649c5809373c47d50a4`; the failed earlier unrelated-route oracle is retained in the campaign record.

**Reactive native values.** Real Solid browser proxies and the raw objects they have already touched are not wire DTOs. The native adapter now unwraps and structurally clones those values before the same original closed source decoder. It selects no field subset and preserves extra string fields for rejection. Eighteen focused browser cases passed in [44986712960](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44986712960), job `137098765694`, with 147 assertions and a passing declared omni spawn. The exact positive and negative cases and failed reproduction are in the diagnostic ledger. This gate proves structural normalization; it does not substitute for the actual installed source journey.

**Exact BI value/source identity.** Plot, timeline, waterfall and table selection carry the original value ID, reference ID and reference digest. The catalog resolves a unique value in the current projection and rejects ambiguity or mismatch. Table selection uses its original row identity; legacy callbacks remain compatible. The actual financial journey in [44984280433](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44984280433) proved two different published values sharing one reference, with two exact original source requests and original links retained.

**Native BI destinations.** The new helper admits only a canonical absolute URL at the bound public origin and recognizes its path with the original native route matcher. It rejects credentials, fragments, control characters, duplicate query keys and owner selectors supplied by a producer. It preserves the original path/filter query and adds the current F01 server/project/installation selection. F01 still admits the destination when opened. The legacy safeBiDestination file is byte-identical, as recorded above. Eight focused destination cases passed in [44984291851](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44984291851), job `137091355355`; that overall job remains failed because the then-current unrelated A05 test oracle was wrong. Its eight passing cases are not a claim that the entire job passed.

The shared chart region is named from its existing caption and keyboard reachable. These presentation changes introduce no new source model. All source calculations, known-versus-missing distinctions, conditioned comparisons and original limitations remain producer-owned.

## Exact composed runtime files

The following blobs were read directly from the composition above. The integration branch includes the root-owned BI identity/destination and shared frame fixes; the isolated analytics branch is not a replacement for those composed files. Integrate only the supplied owned deltas, preserving the root-owned runtime corrections.

| Runtime file | Composed Git blob |
| --- | --- |
| [packages/app-shell/src/orchestra/chapters/sucafina/portfolio/scenarios/index.tsx](https://github.com/gustavomhss/Orchestra-SF/blob/ef8d53e59c779e36bfddf0b375dbcf7c92541706/packages/app-shell/src/orchestra/chapters/sucafina/portfolio/scenarios/index.tsx) | `d72825c63969315d3b17aaec37ca95880ceb25ea` |
| [packages/app-shell/src/orchestra/chapters/sucafina/portfolio/scenarios/scenarios.css](https://github.com/gustavomhss/Orchestra-SF/blob/ef8d53e59c779e36bfddf0b375dbcf7c92541706/packages/app-shell/src/orchestra/chapters/sucafina/portfolio/scenarios/scenarios.css) | `e022f62e5df806ac73f7e8f07a62d4584185994d` |
| [packages/app-shell/src/orchestra/chapters/sucafina/portfolio/scenarios/producer.ts](https://github.com/gustavomhss/Orchestra-SF/blob/ef8d53e59c779e36bfddf0b375dbcf7c92541706/packages/app-shell/src/orchestra/chapters/sucafina/portfolio/scenarios/producer.ts) | `16f7ce59dea1ec16eb5ff0146e299b8a935dd2ee` |
| [packages/app-shell/src/orchestra/chapters/sucafina/portfolio/scenarios/source-input.ts](https://github.com/gustavomhss/Orchestra-SF/blob/ef8d53e59c779e36bfddf0b375dbcf7c92541706/packages/app-shell/src/orchestra/chapters/sucafina/portfolio/scenarios/source-input.ts) | `1e479e87f4cbf3e52658cb66a8ddcddfe836e1db` |
| [packages/app-shell/src/orchestra/chapters/sucafina/portfolio/sensitivity/index.tsx](https://github.com/gustavomhss/Orchestra-SF/blob/ef8d53e59c779e36bfddf0b375dbcf7c92541706/packages/app-shell/src/orchestra/chapters/sucafina/portfolio/sensitivity/index.tsx) | `4513d665f8fce10c7391ba8b3b017d349a93ad7f` |
| [packages/app-shell/src/orchestra/chapters/sucafina/portfolio/sensitivity/sensitivity.css](https://github.com/gustavomhss/Orchestra-SF/blob/ef8d53e59c779e36bfddf0b375dbcf7c92541706/packages/app-shell/src/orchestra/chapters/sucafina/portfolio/sensitivity/sensitivity.css) | `d6a1961b9df78ffe609af56d073eb831b5b5780d` |
| [packages/app-shell/src/orchestra/chapters/sucafina/bi/catalog/index.tsx](https://github.com/gustavomhss/Orchestra-SF/blob/ef8d53e59c779e36bfddf0b375dbcf7c92541706/packages/app-shell/src/orchestra/chapters/sucafina/bi/catalog/index.tsx) | `247dbf04887dd9ca9a2e0de7971884ecae3fad04` |
| [packages/app-shell/src/orchestra/chapters/sucafina/bi/catalog/catalog.css](https://github.com/gustavomhss/Orchestra-SF/blob/ef8d53e59c779e36bfddf0b375dbcf7c92541706/packages/app-shell/src/orchestra/chapters/sucafina/bi/catalog/catalog.css) | `df47a57ab7344034184caa9cfc2f6eb338e8bd97` |
| [packages/app-shell/src/orchestra/chapters/sucafina/bi/finance/visual.tsx](https://github.com/gustavomhss/Orchestra-SF/blob/ef8d53e59c779e36bfddf0b375dbcf7c92541706/packages/app-shell/src/orchestra/chapters/sucafina/bi/finance/visual.tsx) | `e18bd0d14cfdc637ebe1a7c9e6126c76ab87b754` |
| [packages/app-shell/src/orchestra/chapters/sucafina/bi/decisions/index.tsx](https://github.com/gustavomhss/Orchestra-SF/blob/ef8d53e59c779e36bfddf0b375dbcf7c92541706/packages/app-shell/src/orchestra/chapters/sucafina/bi/decisions/index.tsx) | `2ca011f63816c5013958061ad210b5d476061df1` |
| [packages/app-shell/src/orchestra/chapters/sucafina/bi/finance/model.ts](https://github.com/gustavomhss/Orchestra-SF/blob/ef8d53e59c779e36bfddf0b375dbcf7c92541706/packages/app-shell/src/orchestra/chapters/sucafina/bi/finance/model.ts) | `cb7a6c3b7e081f0d461230999a2884fa98f00cff` |
| [packages/app-shell/src/orchestra/chapters/sucafina/bi/source-destination.ts](https://github.com/gustavomhss/Orchestra-SF/blob/ef8d53e59c779e36bfddf0b375dbcf7c92541706/packages/app-shell/src/orchestra/chapters/sucafina/bi/source-destination.ts) | `08d9b3b879250a3a513ed493ded2469bc624e684` |
| [packages/client/src/sucafina/transport.ts](https://github.com/gustavomhss/Orchestra-SF/blob/ef8d53e59c779e36bfddf0b375dbcf7c92541706/packages/client/src/sucafina/transport.ts) | `6f28a2ecb4ef14375748c2685ac0acd24bece600` |
| [packages/client/src/sucafina/transport/portfolio.ts](https://github.com/gustavomhss/Orchestra-SF/blob/ef8d53e59c779e36bfddf0b375dbcf7c92541706/packages/client/src/sucafina/transport/portfolio.ts) | `2741d8472a46329c8c27b1a883be0d32bfcdc0c7` |
| [packages/app-shell/src/orchestra/chapters/sucafina/shared/frame/index.tsx](https://github.com/gustavomhss/Orchestra-SF/blob/ef8d53e59c779e36bfddf0b375dbcf7c92541706/packages/app-shell/src/orchestra/chapters/sucafina/shared/frame/index.tsx) | `84e57b6ce70df53bf5faadf6ce735ade8876972f` |
| [packages/app-shell/src/orchestra/chapters/sucafina/shared/frame/frame.css](https://github.com/gustavomhss/Orchestra-SF/blob/ef8d53e59c779e36bfddf0b375dbcf7c92541706/packages/app-shell/src/orchestra/chapters/sucafina/shared/frame/frame.css) | `9d9c3c95108043eeaeb5080a46bbccb28a949f97` |
| [packages/app-shell/src/orchestra/chapters/sucafina/host/owner-runtime231.tsx](https://github.com/gustavomhss/Orchestra-SF/blob/ef8d53e59c779e36bfddf0b375dbcf7c92541706/packages/app-shell/src/orchestra/chapters/sucafina/host/owner-runtime231.tsx) | `7f261bc6a4351560bc9e1218669de2172eb7ba5a` |

The permanent grouped spec is blob `30fa384f032e2e8e3d509c68d67954362cd3a314`; its capture helper is `c3f03a6553c83bae7b9665cec204c834bac20c46` and genuine source-preparation helper is `22245ef7d79206f2574633b1a8cad543bcc5f8c0`. The current first-journey snapshot `643a70c8de5e37bfff63b4cb56ae4a5b82c041fa` removes only the second test declaration. The first declaration is byte-identical to the permanent spec, and the unchanged production configuration selects exactly that named file with one worker and no retries. Both strict omni control and production channel are requested.

The source/technical checks precede the final installed outcome. The earlier composed gate [44981671317](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44981671317), job `137083298996`, passed twelve gates with ninety-four source/adapter regressions; focused route, destination and input tests above cover later concrete changes. These are separate receipts on explicit source compositions, not one invented aggregate test run.

## Evidence boundaries

No HTTP route or source response is mocked. No synthetic evaluation, history row, threshold, receipt, ready state or permission is seeded. Browser screenshots are actual Chromium output from the installed production bundle, and a capture is marked reviewed only after its original JPEG bytes were emitted as an image and inspected. Canonical artifacts and failed execution remain recorded.

The UI46 BI09 decision-table wrapper currently has source review only; the required runtime scope uses real financial data, operational data and the genuine BI11 empty selection catalog. Narrow viewport reflow is not actual browser zoom. Browser transport is the qualification target; no additional installed D01 broker URL constructor was found in this checkout. User design acceptance and merging remain separate from implementation and test evidence.

[Machine-readable source/implementation map](SOURCE-EQUIVALENCE.json) contains the exact hashes and scope.
