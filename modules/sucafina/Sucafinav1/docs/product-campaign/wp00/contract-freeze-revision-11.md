# Contract freeze revision 11 — producer provenance and review boundary

Status: **draft / NOT_REVALIDATED**. This is a versioned contract-manifest proposal. Its byte bindings require review and a GitHub Actions gate on the resulting candidate before integration. It is not an SF campaign baseline artifact and creates no GO decision.

## Candidate and exact prior manifest

- Integration base: [`72830e53adfcb2059575b249e76c88753beb04e8`](https://github.com/gustavomhss/Orchestra-SF/commit/72830e53adfcb2059575b249e76c88753beb04e8), descended from user-selected [`f7dd58e32bc834f1485df20b91adbf759b4c4ad0`](https://github.com/gustavomhss/Orchestra-SF/commit/f7dd58e32bc834f1485df20b91adbf759b4c4ad0). No pinned production path changed between those two commits.
- Dependency: [PR #415](https://github.com/gustavomhss/Orchestra-SF/pull/415), `fa25e59bbcadc41823cdad47b24e75fac3095d37`, restores 14 exact original document blobs without repinning. See [restoration ledger](provenance-restoration-2026-11-20.md). This revision is a separate commit/PR on that restoration.
- Prior revision 10: original source [PR #32](https://github.com/gustavomhss/Orchestra-SF/pull/32) at [`ed10a3806a4ffdf6ad5891e2065d93a4c91412cf`](https://github.com/gustavomhss/Orchestra-SF/commit/ed10a3806a4ffdf6ad5891e2065d93a4c91412cf), Git blob `b20cf5cecf22885dd8858f3659056a50ab88f485`, SHA-256 `fb41c5f7c7889fbb058541d9a415c034f403eedcc30c273a0cd948b1b6466c01`. The revision-10 manifest is identical in the restored parent; its complete nested revision provenance is retained under `previousRevisionProvenance`.
- Proposed revision-11 manifest SHA-256: `7191ceead8b31077d2fd763f048ea26d0ed08b6a8d2e78dece84011c9858171e`. The manifest does not pin itself. The containing Git commit identifies the proposal; this ledger does not invent a future run or commit.

## Exact pin delta

Paths are relative to `product/contracts`. There are exactly four changed digests: three already-integrated production files, plus the contracts narrative that documents this actual revision. All 38 original artifact keys remain present, in their existing order. All other pins remain byte-identical.

| Artifact | Revision-10 pin / verified original SHA-256 | Revision-11 pin / observed or edited SHA-256 |
| --- | --- | --- |
| `decisions.ts` | `d2929cd8cf8f67e697b2584684491346905657c69cfed2ab144d26a9a646deaf` | `2d83401c08247757c4914de9afed6717f424355b66925c8c6878e20f2192fde7` |
| `host-context.ts` | `0476febc21bf87c35a734e4cae028bc4fee2f72ccfebfd30a0490ecf44fae055` | `a6d97ff4c581b4cd27e19b98f25dadb59dd27594107849d6204706f68beafeab` |
| `../../../../../apps/cli/src/sucafina-product/host-context.ts` | `6a608e24847fe730b645d5f51f86e47d83e803875162820038e0c05d18f96772` | `d53acf169806bc6e809542a3eca38bda49803da16f31c6c7158d1c56a6025358` |
| `../../docs/product-campaign/wp00/contracts-v1.md` | `cda99c5e29356af537886240c9f86ef65a49d672c7cdc156a5c97d340a93504d` | `d5c3fc5ed53dceafdf830ca7b11e22d2ad566d2fbe1d837e5250a2c9b3bc709d` |

## Verified preimages and current producer objects

| Artifact | Original preimage | Current producer bytes already integrated |
| --- | --- | --- |
| `decisions.ts` | [`00dd072ce891617a4dc66c5ef49b5e17200537a0`](https://github.com/gustavomhss/Orchestra-SF/blob/00dd072ce891617a4dc66c5ef49b5e17200537a0/modules/sucafina/Sucafinav1/product/contracts/decisions.ts), blob `f22b00f0a97ab138d1d8b86855f432c6ef709c36`; SHA-256 equals the revision-10 pin. | [PR #311 merge `569ea1b12599be5360242812d50793b20c560da4`](https://github.com/gustavomhss/Orchestra-SF/commit/569ea1b12599be5360242812d50793b20c560da4), blob `f59c197a9125542a2715fce01afd942836b22a27`. |
| Typed `host-context.ts` | [Composition `46cb4dd02f0a6d11b3fa7a0deac7f839e7b7af3c`](https://github.com/gustavomhss/Orchestra-SF/blob/46cb4dd02f0a6d11b3fa7a0deac7f839e7b7af3c/modules/sucafina/Sucafinav1/product/contracts/host-context.ts), blob `920fda293db553096f4d8ab7004fcd9652a69291`; SHA-256 equals the revision-10 pin. | [Latest producer `c00b150b48f576a79a7c8b33f15c4fb55d72dfd1`](https://github.com/gustavomhss/Orchestra-SF/commit/c00b150b48f576a79a7c8b33f15c4fb55d72dfd1), blob `b9853f15305d94a0893b45457f17fe15fcefc697`, integrated by PR #391. |
| CLI `host-context.ts` | [Actual revision-10 source `ed10a3806a4ffdf6ad5891e2065d93a4c91412cf`](https://github.com/gustavomhss/Orchestra-SF/blob/ed10a3806a4ffdf6ad5891e2065d93a4c91412cf/apps/cli/src/sucafina-product/host-context.ts), blob `834b3c967d73411771e1f5aa82b683c6427e6769`; SHA-256 equals the revision-10 pin. The earlier composition `46cb4dd0` already had different CLI bytes, so it is not falsely used as this preimage. | [Latest producer `c00b150b48f576a79a7c8b33f15c4fb55d72dfd1`](https://github.com/gustavomhss/Orchestra-SF/commit/c00b150b48f576a79a7c8b33f15c4fb55d72dfd1), blob `6d7cfc7b7bd9c986fda2abbda87151990ffb89c3`, integrated by PR #391. |

`contracts-v1.md` was first restored exactly from PR #32 by #415 (blob `2c2e46afda5ac27e5c8b7f9dd8c73d5072ade883`, matching the old pin). This proposal changes its current revision header and appends the revision-11 explanation; earlier revision narratives stay intact.

## Why the three production differences exist

### Document evidence

PR #311 adds one optional member to `DocumentEvidence`: `rejection?: { reason: string; page: number }`. The existing `rejected` state is retained. The source change stores the human rejection reason/page through the existing governed document mutation and adds real document rejection and scenario-consumer tests. This manifest revision does not modify that producer or claim that its complete journey has passed on the present candidate.

### Typed host contract

The typed host preimage-to-current diff adds optional composition capabilities for case-creation recovery, the original A07 review projection, authorized work destinations and terminal verification, installed operational/read-binding observation, original-request/page-derived native actions, configured authentication mode/authentication callback, and the shared current-choice fence. Import additions provide the corresponding existing producer types. These are the actual integrated public type bytes; they are not replaced by a test stub or a permissive structural fence.

The normative operation input/output schemas, operation IDs, profiles, skills, packs and storage ownership have unchanged pins. The public host type itself did change; this revision records that fact instead of describing all typed contracts as byte-identical.

### CLI host consumer

The consumer accumulated the matching original producers, domain/authority observations, current-choice constructor sharing, native phase ownership, review context, and Decisions creation/revision/recovery. The history below is taken from GitHub's file history for the selected integration base. This proposal neither revives retired console routes nor substitutes historical CLI bytes for the current native composition.

## Merged integration evidence and its limits

GitHub PR metadata confirms the following owner merges. A merged PR establishes integration provenance; it is not automatically an independent review, a current passing gate or authorization to claim GLOBAL_RELEASE.

| PR | Head | Merge commit | Verified merge actor | Evidence scope retained |
| --- | --- | --- | --- | --- |
| [#286](https://github.com/gustavomhss/Orchestra-SF/pull/286) | `d121b80b8deda3b1b08db8338ac429c7e6ab08d5` | `8e456b229bf58d06bb542f83f9057687855c77d2` | `gustavomhss` | Original constructor identity and extracted-package path; PR records later authenticated evidence separately from its earlier 403 observations. |
| [#311](https://github.com/gustavomhss/Orchestra-SF/pull/311) | `55fe2e8e4b4ca79954931960b6809bfaeaf8a7c5` | `569ea1b12599be5360242812d50793b20c560da4` | `gustavomhss` | One optional document rejection member and governed producer/test changes. Its body still says verification pending CI; this audit does not invent a missing approval. |
| [#313](https://github.com/gustavomhss/Orchestra-SF/pull/313) | `794710cb8b77db69006b2dac8e6951102a9ee5c1` | `e3562b78a0e46a53dbf1d432869ae756136dcfd7` | `gustavomhss` | Native task/contribution wiring; the PR explicitly leaves authenticated cancellation unavailable and says not to call the work fully closed. |
| [#384](https://github.com/gustavomhss/Orchestra-SF/pull/384) | `4c07852b892b7709711fb442c017da3ce17adce9` | `625a33907532205e83325e63b69c413b56b5603a` | `gustavomhss` | Qualified UI33/UI34 creation and human revision; PR cites run 44601715581. This ledger does not reclassify that receipt as current full-suite evidence. |
| [#391](https://github.com/gustavomhss/Orchestra-SF/pull/391) | `60a641a44607e9902c33f4f0c097f9fa347c3749` | `f7dd58e32bc834f1485df20b91adbf759b4c4ad0` | `gustavomhss` | C12 review/retry/recovery; PR cites run 44632508338 on snapshot 9f14610bfd810b51bb8da4ccc6e65728974239ec. Its merge is the user-selected f7dd base. |

The review endpoints inspected for #311 and #391 returned no formal review entries. Earlier host increments below are integrated ancestry, not separately asserted independent approvals. Any unresolved semantic approval remains a review item for this draft; no historical status is upgraded. CI citations in the producer PR bodies belong to their own W/S; only the original WP00 85-test receipt was directly read for the accompanying restoration audit.

## Integrated host file history

The following file-history entries run back to the composition that imported the old freeze. A source commit may be a direct integration commit or a merge; a row is not an assertion that an independent PR review occurred.

| Commit | Paths touched in this history | Recorded commit subject |
| --- | --- | --- |
| [`c00b150b48f576a79a7c8b33f15c4fb55d72dfd1`](https://github.com/gustavomhss/Orchestra-SF/commit/c00b150b48f576a79a7c8b33f15c4fb55d72dfd1) | typed host + CLI host | fix(sf): close native C12 review retry and durable receipt recovery |
| [`6ea5bf225b8eb7f3e3407c4ae4a227549ab852d4`](https://github.com/gustavomhss/Orchestra-SF/commit/6ea5bf225b8eb7f3e3407c4ae4a227549ab852d4) | typed host + CLI host | fix(sf): integrate qualified native Decisions creation and human revision |
| [`32da65476471415b26e11d4e5877c4c866be10d6`](https://github.com/gustavomhss/Orchestra-SF/commit/32da65476471415b26e11d4e5877c4c866be10d6) | CLI host | feat(sucafina): expose the review thread context pin |
| [`26ffe24cf85657d17d7ba954d351e811c72c4c6e`](https://github.com/gustavomhss/Orchestra-SF/commit/26ffe24cf85657d17d7ba954d351e811c72c4c6e) | CLI host | feat(sf): retire legacy HTML routes on the phase owner hook |
| [`f94920314d0d23bf13ef5d3c7ef4cf2dabd43640`](https://github.com/gustavomhss/Orchestra-SF/commit/f94920314d0d23bf13ef5d3c7ef4cf2dabd43640) | CLI host | feat(sf): retire legacy console HTML routes |
| [`57c2c960ed4df637f7f395dd1ea4fd859fb83ee3`](https://github.com/gustavomhss/Orchestra-SF/commit/57c2c960ed4df637f7f395dd1ea4fd859fb83ee3) | CLI host | fix(cli): restore the native phase owner hook |
| [`1faff17a436aa755f79b8f4fa5d4dd307cb45b8c`](https://github.com/gustavomhss/Orchestra-SF/commit/1faff17a436aa755f79b8f4fa5d4dd307cb45b8c) | CLI host | fix(sf): keep the hosted current-choice fence export |
| [`76e38b3542a425cc88453d04326fae2874f26954`](https://github.com/gustavomhss/Orchestra-SF/commit/76e38b3542a425cc88453d04326fae2874f26954) | CLI host | feat(sf): port coherent native-ui and desktop sets |
| [`0bb8a86f8b076a9f43735c83793043b30d5529ff`](https://github.com/gustavomhss/Orchestra-SF/commit/0bb8a86f8b076a9f43735c83793043b30d5529ff) | CLI host | feat(sf): port B1 residual from #199 |
| [`e3562b78a0e46a53dbf1d432869ae756136dcfd7`](https://github.com/gustavomhss/Orchestra-SF/commit/e3562b78a0e46a53dbf1d432869ae756136dcfd7) | CLI host | fix(sf): WS-5 P0 native agent execution and contribution proof (UI65/UI70) (#313) |
| [`569ea1b12599be5360242812d50793b20c560da4`](https://github.com/gustavomhss/Orchestra-SF/commit/569ea1b12599be5360242812d50793b20c560da4) | CLI host | fix(sf): WS-3 P0 document upload, rejection and governed scenario evidence links (#311) |
| [`8e456b229bf58d06bb542f83f9057687855c77d2`](https://github.com/gustavomhss/Orchestra-SF/commit/8e456b229bf58d06bb542f83f9057687855c77d2) | CLI host | fix(sf): keep current-choice fence identity across packaged CLI and factory (#286) |
| [`3a99b06c585f8963af754b977f1b9f710d3ddba9`](https://github.com/gustavomhss/Orchestra-SF/commit/3a99b06c585f8963af754b977f1b9f710d3ddba9) | CLI host | fix(sf): resolve remaining static and e2e typecheck diagnostics |
| [`31cb526055d5d0cc70f5edf2e3921c6b4953e86f`](https://github.com/gustavomhss/Orchestra-SF/commit/31cb526055d5d0cc70f5edf2e3921c6b4953e86f) | CLI host | fix(sucafina): provide original location map service for skill receipt verification |
| [`324185efc16657faf1aae86faf32b2cc278c8ced`](https://github.com/gustavomhss/Orchestra-SF/commit/324185efc16657faf1aae86faf32b2cc278c8ced) | CLI host | fix(sucafina): use installed location registry for governed-load verification |
| [`67df0a03891badb7e5d25a6eeccf002a55cef650`](https://github.com/gustavomhss/Orchestra-SF/commit/67df0a03891badb7e5d25a6eeccf002a55cef650) | CLI host | Merge branch 'go-live-close' into HEAD |
| [`4f6752b3fcdf38088f0c16f3b836392de14c72f7`](https://github.com/gustavomhss/Orchestra-SF/commit/4f6752b3fcdf38088f0c16f3b836392de14c72f7) | CLI host | feat(sucafina): compose native phase bridge into the host |
| [`ae1a9c0ccc1436e475f6713f9223becbbf2636ad`](https://github.com/gustavomhss/Orchestra-SF/commit/ae1a9c0ccc1436e475f6713f9223becbbf2636ad) | typed host + CLI host | fix(sucafina): observe installed review reads |
| [`06d95b9b242e7ad3bdd7ba61f39f2de65c1b1ff8`](https://github.com/gustavomhss/Orchestra-SF/commit/06d95b9b242e7ad3bdd7ba61f39f2de65c1b1ff8) | CLI host | fix(sucafina): extend scoped planner and budget actions |
| [`def17d0e6e7a6ff69eb034251f69aa6d9df119de`](https://github.com/gustavomhss/Orchestra-SF/commit/def17d0e6e7a6ff69eb034251f69aa6d9df119de) | CLI host | fix(sucafina): observe review and recall source health |
| [`1f8a7105059617ae220262dd26f388bc9fc9c63e`](https://github.com/gustavomhss/Orchestra-SF/commit/1f8a7105059617ae220262dd26f388bc9fc9c63e) | typed host + CLI host | fix(sucafina): derive native actions from original producers |
| [`27a2a5a4de019b6319a1751651ea86a4bf43dd5d`](https://github.com/gustavomhss/Orchestra-SF/commit/27a2a5a4de019b6319a1751651ea86a4bf43dd5d) | typed host + CLI host | feat(sucafina): observe installed planner availability |
| [`425395b82037e33903057091c97d1a2d6254d201`](https://github.com/gustavomhss/Orchestra-SF/commit/425395b82037e33903057091c97d1a2d6254d201) | CLI host | fix(sucafina): connect similar case producer |
| [`395012bcf4e142f0769ae6fa8138c4b7097a04b9`](https://github.com/gustavomhss/Orchestra-SF/commit/395012bcf4e142f0769ae6fa8138c4b7097a04b9) | CLI host | feat(sucafina): compose staged closure integration |
| [`fbbbf07c9622f449e77856bbe09077f9e38bd2c7`](https://github.com/gustavomhss/Orchestra-SF/commit/fbbbf07c9622f449e77856bbe09077f9e38bd2c7) | typed host + CLI host | fix(sf): bind existing A07 review projection into F02 live host [skip ci] |
| [`b36de3e0b3aee61c0de25ef3cc5440a48e3c307d`](https://github.com/gustavomhss/Orchestra-SF/commit/b36de3e0b3aee61c0de25ef3cc5440a48e3c307d) | CLI host | fix(sf2h): reconcile 161 native-session cleanup with durable C08 terminal ownership [skip ci] |
| [`77e58de895b5157b2a32e3427483bd12f40a7525`](https://github.com/gustavomhss/Orchestra-SF/commit/77e58de895b5157b2a32e3427483bd12f40a7525) | typed host + CLI host | feat(sf2h): connect F01/A12 live authority and private navigation [skip ci] |
| [`3f4643d993c71b0edd197e8c3a1090bfd5ba533a`](https://github.com/gustavomhss/Orchestra-SF/commit/3f4643d993c71b0edd197e8c3a1090bfd5ba533a) | typed host + CLI host | feat(sucafina): compose C54 creation recovery 96 and 111 [skip ci] |
| [`1c0004563b157f0dbc3fb72c40a2f2a63facba66`](https://github.com/gustavomhss/Orchestra-SF/commit/1c0004563b157f0dbc3fb72c40a2f2a63facba66) | CLI host | feat(sucafina): compose gated native origin and historical reader C49 [skip ci] |
| [`7e64ed4f2e59e0baabcc8655b8067ff9eb847665`](https://github.com/gustavomhss/Orchestra-SF/commit/7e64ed4f2e59e0baabcc8655b8067ff9eb847665) | CLI host | feat(sucafina): compose released native64 with activation held as C31 [skip ci] |
| [`7f3f4f0066269f7642c82b5694f21c9c9741e9d5`](https://github.com/gustavomhss/Orchestra-SF/commit/7f3f4f0066269f7642c82b5694f21c9c9741e9d5) | typed host + CLI host | feat(sf2): integrate released CurrentChoice46 candidate C20 [skip ci] |
| [`0fe4f1105e8e1e71ce07fa3fbf51bd9ff01a7364`](https://github.com/gustavomhss/Orchestra-SF/commit/0fe4f1105e8e1e71ce07fa3fbf51bd9ff01a7364) | CLI host | feat(sf2): integrate released Procurement37 candidate C15 [skip ci] |
| [`c1bd1c91b0e0d32db3074408e815e36107384073`](https://github.com/gustavomhss/Orchestra-SF/commit/c1bd1c91b0e0d32db3074408e815e36107384073) | CLI host | feat(sucafina): integrate terminal Routines30 assembly as C9 |
| [`46cb4dd02f0a6d11b3fa7a0deac7f839e7b7af3c`](https://github.com/gustavomhss/Orchestra-SF/commit/46cb4dd02f0a6d11b3fa7a0deac7f839e7b7af3c) | typed host + CLI host | feat(sucafina): compose owned SF2 product deliveries and consumers |

## Contract and acceptance invariants

- All 38 artifact keys remain mandatory. The candidate-byte audit finds 38 exact matches after the 14-document restoration and these four explicit pin changes; this is static hashing, not a product test execution.
- The 17 contract definitions, 5 profiles, 18 skills, 8 packs, 39 operations and AM01–AM06 assignments remain exactly unchanged in the manifest. Normative schemas, grants/routes, storage field ownership, planning SHA, canonical SHA and historical code baseline remain unchanged.
- `implementationStatus: CONTRACT_FROZEN_CONSUMERS_BLOCKED` and the complete original `consumerAcceptance` object, including `status: BLOCKED`, observed product commit and required handoffs, remain unchanged.
- The only test edit is `expect(freeze.revision).toBe(10)` to `expect(freeze.revision).toBe(11)`. Every digest equality, export, cardinality, schema, route and storage-ownership assertion remains byte-identical.
- Historical `NOT_RUN` and blocked consumer documents remain archival facts. This draft does not assert that no later journeys executed, and does not derive a current result from old fixtures.
- No SF baseline candidate/artifact, coverage report, execution evidence digest, GO decision or independent-review verdict is created, substituted or relabeled.

## Validation to be owned by the coordinating session

1. Review the exact three production preimage/current deltas and the document revision above, including the recorded approval limitations.
2. Run the strict `Sucafinav1/test/product/wp00/contract-freeze.test.ts` gate against the composed candidate that includes #415 and this proposal. Preserve the existing package/static gates required by the selected CI runner.
3. Record the resulting run, candidate SHA and actual counts without inheriting the old WP00 or producer-PR results. Keep all other shard failures and native acceptance requirements independently accounted for.

No CI, local product tests or merge were started by the author of this proposal. The manifest remains `NOT_REVALIDATED` until candidate-specific verification is recorded; versioning the manifest itself is not product acceptance.
