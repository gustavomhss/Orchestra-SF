# Contract freeze revision 12 — amended producer chain

Status: **draft / NOT_REVALIDATED**. This amends the same unmerged, ungated revision-12 proposal. It does not create revision 13 and does not replace an SF campaign baseline candidate/artifact.

## Proposal history and current integration base

- Original revision-12 proposal: [`28c9fa4ca71ddb3cf6b444a3fd6c64cdb6bd4278`](https://github.com/gustavomhss/Orchestra-SF/commit/28c9fa4ca71ddb3cf6b444a3fd6c64cdb6bd4278), manifest blob `02d41d3f125b40f598dccd4208b978789564ea54`, SHA-256 `7b15b11f26643868af7ce0fa15e6836e00a69880eb281a392ccfe04850672aad`. It had no candidate gate or merge. PR #431 changed the same pinned consumer before qualification, so its bytes must be incorporated into this proposal.
- Current parent: [`b180588c63e41eecd6d73d839d078755d68cad3d`](https://github.com/gustavomhss/Orchestra-SF/commit/b180588c63e41eecd6d73d839d078755d68cad3d) on `sf-join-four`, tree `04cd286a3f2d34bb31bdbfc440fc37332e6d9e6e`. This proposal starts from that integrated tree and preserves its other changes.
- All 38 artifact paths were fetched and hashed at [`573678d0acf9e91654efb7e67af7d30ebe45312b`](https://github.com/gustavomhss/Orchestra-SF/commit/573678d0acf9e91654efb7e67af7d30ebe45312b): **37 exact matches / 1 mismatch / 0 missing** against revision 11. During preparation, [PR #437](https://github.com/gustavomhss/Orchestra-SF/pull/437) advanced the base to the current parent. The complete GitHub comparison contains only `native-ui/domain/projection.ts` and `budget-deviation-projection.test.ts`; neither is a pinned artifact, the manifest or the version test. Thus the audited 38 artifact bytes are unchanged at the current parent.

## Preserved revision-11 evidence

Revision 11 remains identified by original source [`f86d423436380812e4ce0835d4dbe4efced1d825`](https://github.com/gustavomhss/Orchestra-SF/commit/f86d423436380812e4ce0835d4dbe4efced1d825), [PR #417](https://github.com/gustavomhss/Orchestra-SF/pull/417), merge `687759276c2c9121c2cfd20a5994b277ceb7ee4d`, manifest blob `cdb20738b2be071f4ea64badca137d4e70431ff8`, SHA-256 `7191ceead8b31077d2fd763f048ea26d0ed08b6a8d2e78dece84011c9858171e`. The complete nested prior provenance is unchanged.

The previously inspected [run 44662549289](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44662549289), snapshot `d9284bc1079b580af9d6224c5d2b141ee02a0d6f`, test job 136043993374, recorded **5 pass / 0 fail / 913 expects / 174 ms** for the strict freeze test. That PASS belongs to revision 11 on its exact source. [The integration note](https://github.com/gustavomhss/Orchestra-SF/pull/417#issuecomment-7028754674) already states that later producer bytes require explicit reconciliation.

## Exact CLI producer chain since revision 11

| Stage | Qualified source / integration | CLI Git blob | CLI SHA-256 |
| --- | --- | --- | --- |
| Revision 11 | [`f86d423436380812e4ce0835d4dbe4efced1d825`](https://github.com/gustavomhss/Orchestra-SF/blob/f86d423436380812e4ce0835d4dbe4efced1d825/apps/cli/src/sucafina-product/host-context.ts) | `6d7cfc7b7bd9c986fda2abbda87151990ffb89c3` | `d53acf169806bc6e809542a3eca38bda49803da16f31c6c7158d1c56a6025358` |
| PR #407 | Code `d93f7f482b9b24cd895b8f6406727f0f8aab0dd7`; head `713f9829e896fee44a610dfbda16f893be2e5be5`; merge `d548a76a4e7838bccdb20e98c1ad16fdeca0b391` | `b30a7782259f8eaf23af34a3e93bd41c95b4cb5f` | `60e6358d1597d7cbb08a25b7d4123ecc5bd9f3d67ecd5809679537aecf50dfa4` |
| PR #431 | Qualified code tree `3041fcd305c9014c1558197c30863952a2abbdbe`; tested source `6732ff508922b097e5c9c42b457e3dc8dc6c65ae`; head `92dd01c6d69c0ce2b5fdeb44b7db4e754a9fe8f8`; merge `295c2bdca05c2373f821d50aab5d3ee3d3fb218b` | `3f6863be244ce79dc6538564ac0c0b6b8b58e8c1` | `51641a232525128ea4338034ff095a828204a5411dc7dd3334283c00fe6e57bd` |
| Current integration | [`b180588c63e41eecd6d73d839d078755d68cad3d`](https://github.com/gustavomhss/Orchestra-SF/blob/b180588c63e41eecd6d73d839d078755d68cad3d/apps/cli/src/sucafina-product/host-context.ts) | `3f6863be244ce79dc6538564ac0c0b6b8b58e8c1` | `51641a232525128ea4338034ff095a828204a5411dc7dd3334283c00fe6e57bd` |

### Reviews observer — PR #407

[PR #407](https://github.com/gustavomhss/Orchestra-SF/pull/407) adds 11 host lines: an import and the composition of `observeSfReviewAgendaHealth`. It observes original installed producer identities, current request/admission and C08 authorization. Its [focused run 44657226869](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44657226869), snapshot `c182dd60b9b96cd2a0559dcc7236c3a71c0c0dbd`, records **4 pass / 0 fail / 27 expects**. The intermediate host blob/hash above was rechecked against its source during this amendment.

That receipt qualifies the bounded observer. The source PR separately retains [Reports run 44660375065](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44660375065) at **0 pass / 4 fail** on its own source. Neither the original proposal nor this amendment converts that result into complete Reports/UI acceptance.

### Attachments and Import observers — PR #431

[PR #431](https://github.com/gustavomhss/Orchestra-SF/pull/431) adds nine lines to the already-updated host: import/composition of `observeSfImportHealth`. The full qualified source also introduces the original attachment observation, configures its original services and shares the existing role-only predicate with the asset command while retaining record checks. The final code correction `3041fcd305c9014c1558197c30863952a2abbdbe` validates the original admission before asking for its consumed Request; this is part of the qualified tree, not a relaxed authority boundary.

The asset observer uses the mounted application, current actor/roles, original read-only persistence and original asset services. The Import observer uses its original service/router, current `sf_import_preview` admission, exact Request/stamp, C08 namespace authority and existing human actions. They do not acquire an Import source, scan uploaded bytes or perform a mutation. The private scanner-configuration identity is not proof that a live ClamD call succeeded or that any uploaded bytes are clean.

## Actual #431 gate and blob comparison

[Run 44666552454](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44666552454), snapshot `5038302de56e1dc4c4a255eace3ab5210d6ae535`, is completed/success. The snapshot is a direct child of `6732ff508922b097e5c9c42b457e3dc8dc6c65ae` and adds only `.ci-run.json`. The comparison from final code `3041fcd...` to tested source and from tested source to PR head changes only the handoff document. Test job [136057127618](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44666552454/job/136057127618) and cleanup 136057491026 both succeeded.

The decoded test log was read directly: **26 pass / 0 fail / 182 expects / 729 ms across three files**. The request selects exactly:

- `Sucafinav1/test/native-ui-contract/asset-health.test.ts` — four original-application/SQLite/policy observation tests.
- `Sucafinav1/test/native-ui-contract/import-health.test.ts` — four original Import/authority/C08 observation tests.
- `Sucafinav1/test/assets.test.ts` — all 18 original asset regressions.

The eight changed code/test files below have identical Git blobs in the actual green snapshot, PR head and audited integration. The original assets regression file was also compared. Equality establishes which bytes the gate contained; it does not mean an E2E journey or every entrypoint in the snapshot was executed.

| File | Identical gate / integrated blob |
| --- | --- |
| `apps/cli/src/sucafina-product/host-context.ts` | `3f6863be244ce79dc6538564ac0c0b6b8b58e8c1` |
| `apps/cli/src/sucafina-product/native-ui/asset-health.ts` | `a38c6bb03de1a52b0746728b42939f40ebb3d0e8` |
| `apps/cli/src/sucafina-product/native-ui/import-health.ts` | `c47f7d4d43db60f58a9be5e14f11838594de5f33` |
| `modules/sucafina/Sucafinav1/local/entry.ts` | `645b86fb48ac84e2b9c1392020eae9c5cf29fc50` |
| `modules/sucafina/Sucafinav1/runtime/assets.ts` | `381dd986d26fe0dd65f8ba77e345436c580d113b` |
| `modules/sucafina/Sucafinav1/test/native-ui-contract/asset-health.test.ts` | `c723387384640f2466355bb10f740c0e205d69cf` |
| `modules/sucafina/Sucafinav1/test/native-ui-contract/import-health.test.ts` | `d7073e6a140144591467b4d3fbd680ff2e58a596` |
| `packages/app-shell/e2e/sucafina/operations-support/installation.ts` | `cecf2dc87f81db48efee4cbd51256e14a19f2d5a` |
| `modules/sucafina/Sucafinav1/test/assets.test.ts` | `4313739cb47a02dd8234fec19ea2dc26e3f30e52` |

The log covers readiness and permission distinctions, missing configuration, stale/foreign/aborted calls, genuine revocation/replacement, and existing upload/scan/CAS/redaction/storage regressions. Its omni control is not applicable and records no spawn; this is not an Omni lifecycle proof.

The broader [Operations run 44662419134](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44662419134), recorded by the source PR at **1 pass / 4 fail** on its prior source, is not reclassified. This gate did not execute the full Operations E2E selection, resolve all Import UI selectors, qualify the Sourcing timeout, prove live ClamD health or grant a release decision.

## Minimal amended pin delta

Paths below are relative to `product/contracts`. Only the CLI production pin and the actually revised contracts narrative change from revision 11. No production file is edited by this proposal.

| Artifact | Revision-11 SHA-256 | Amended revision-12 SHA-256 |
| --- | --- | --- |
| `../../../../../apps/cli/src/sucafina-product/host-context.ts` | `d53acf169806bc6e809542a3eca38bda49803da16f31c6c7158d1c56a6025358` | `51641a232525128ea4338034ff095a828204a5411dc7dd3334283c00fe6e57bd` |
| `../../docs/product-campaign/wp00/contracts-v1.md` | `d5c3fc5ed53dceafdf830ca7b11e22d2ad566d2fbe1d837e5250a2c9b3bc709d` | `76090aa822286b52e4989c561c447fab5eee49287ee05c94b4d3ed8848f42da0` |

Amended revision-12 manifest SHA-256: `638de9a149903f83e297b45b94226d70babd7a84bf0f352bd80632bba5a665cf`. The manifest still does not hash itself. Its current proposal status remains `NOT_REVALIDATED`; the source gates above are historical receipts for their own scopes.

## Complete 38-artifact audit against revision 11

The following bytes were fetched at the initial audited integration and proven unchanged through the current parent as described above. No artifact was omitted or exempted.

| Artifact relative to `product/contracts` | Observed Git blob | Observed SHA-256 | Against revision 11 |
| --- | --- | --- | --- |
| `business-context.ts` | `102c849084980ae52223809d33bdeea36a58536b` | `6047c7239f2dbb36d40ed09880f908dc9033e362a599a6921798bbdccbef031a` | match |
| `canonical.ts` | `1769271386cdda1017c38023b0988ce2d64423d2` | `c3b11a2acabf6539c09e33489accfc53d8ee61a38063294c7d9003b74c753291` | match |
| `context.ts` | `ae2d6b73a24970ba23d21e17694b54fd32d1a700` | `a703d59373a826021214617867191e0a8bba920cef9ead22dc064e0f018e6517` | match |
| `coverage-inventory.ts` | `e4d72cc7cf5beed1a76a61b1b9a28acfd0d121d8` | `b55dbfb3edb5235cb6f8120773fee243d440f40fe118bde3c86c9a6e8a1d2da7` | match |
| `decisions.ts` | `f59c197a9125542a2715fce01afd942836b22a27` | `2d83401c08247757c4914de9afed6717f424355b66925c8c6878e20f2192fde7` | match |
| `generate-output-schemas.ts` | `eef174095e02eb4448a6c53d6119ce7a8fda4a9d` | `d20f720d0f27cbcc71699a4ed24d26dcc337bc69a51bb16bebfef854584e495a` | match |
| `host-context.ts` | `b9853f15305d94a0893b45457f17fe15fcefc697` | `a6d97ff4c581b4cd27e19b98f25dadb59dd27594107849d6204706f68beafeab` | match |
| `normative-contracts.json` | `a59ecb7ea7315504cb78ced5c6b6dd828e238730` | `e38bc7b39d7dc1c25f9eb5a89cf43b7597a4ed1c00f443dc01a89b792665e2f1` | match |
| `operations.ts` | `88550f78693ba1a66b285f2f53abcd3f8c09afdc` | `4b4dea78486ca436a03725e44d98951333ca15f353bdf02e204e8a0914f58527` | match |
| `output-schemas.ts` | `0d9fc51d26a0ca726d32e74605b555f871d99af6` | `47da83871b556f7623399062dc95ab5a397c83de3661087defb2c134251fb20e` | match |
| `outputs.ts` | `4db2e631bd83ccda67442824557881c2ed990c92` | `4de7c758a68bab91ed464dd465d9e17ba7146a05e2a4b8c66ad1161297534a80` | match |
| `ports.ts` | `88b6efb4840b8731f707862a8baf14683526c7a9` | `4f7effda926f72b7c6a61b944e5e9a9acd6dce4a39d0780e735ab6efed3471b1` | match |
| `resident-ai.ts` | `38e3d664f4dedb56f3e614bde41d51548e44f805` | `12bd719f16aae9d41dc58baaaa090285cd9e5f11b3a790d67351c14d59e58697` | match |
| `runtime.ts` | `beba733084e87da8664b0f4067b52d4b29795c5c` | `b3677455be84df9549d3230eefbdbbc97a3bae33445fff119e3bd2e4ddcde4f1` | match |
| `schema-admission.ts` | `c0c615b006d4b638015217e9d5b4d353b4ea41e6` | `bdd708ed81e9f96efb7de872ff4085444fb3b58ee5711e1b678d3fb79d6df171` | match |
| `sf-execution.ts` | `78a2f6ab5f33c6fd8338da77980ef57a328f2e95` | `a3cf340b5c4e73b9a6cb64892ee47de1c2176bb77a34d93cec326b09f5fdc1d6` | match |
| `skill-inputs.ts` | `e57131cc3c5b03ca894d57437b22040cf69dd3db` | `db1081f488c897caf6ed10b02d1389326a02f0edd124c657e9c4ffc805b1abc7` | match |
| `state-layout.ts` | `c3a6e039badc5ed49b20caa7153cb01979ebec9a` | `a8c13adf11aac2e421dc4dd84018c700e142d2c453277d32cfcdf90036bff08c` | match |
| `state.ts` | `755639b2a16265fe164ba2e6343738c1362d168c` | `ed588ca9aa44aac43882c31a0d7b75857adb5790790b3a0e44ddac75f3bc0af0` | match |
| `validation.ts` | `44e79b3009076e9fae595e79a8c72a8f3918f14b` | `2fe8236bd56162cb9e5398b1155320057fd12f5f51f3700eb46aee2a8d7b1b15` | match |
| `../../docs/product-campaign/wp00/baseline-capabilities.json` | `5d110579ac7b8b38307225a0ca6035ba88e9fdd7` | `43b93d97fcd616d732de089aa7ba945200af3392848f5721c02e84ff5ab01fca` | match |
| `../../docs/product-campaign/wp00/baseline-decisions.md` | `c8da79ce0ead3142d7a6fae9cc8760d60fc5a4b7` | `91282614038b85dc6e6160f78ddd72fb6c2dbcbf62286b7230e97ba30af3dcf7` | match |
| `../../docs/product-campaign/wp00/baseline-new-capabilities.json` | `ebba142430741f50f8431017d30c1a8f12458663` | `1f93000c2c011c269e0ca573f3988e2d7e336b5571270b3ad8624d3621f30c23` | match |
| `../../docs/product-campaign/wp00/check-ownership.ts` | `058e69fc3abd8157ea4c42dfa27f75de96327104` | `190cf52b2c300e2fe780f49097f9461845960db4cd1987bc8f35dd65fad730f7` | match |
| `../../docs/product-campaign/wp00/ci-selection.json` | `08b1c255394e2514d1ca9fe1de8eb8375c35a4cc` | `b22148940a23772a50d266aaeb1d1af03f49fa705b2919b1d55a73e0be5dd4db` | match |
| `../../docs/product-campaign/wp00/consumer-deltas.md` | `311e3753123b1feed4e6cbe08594f40c835a23d9` | `0db0e0f767ca8c2ebf8c572630c4af8da9f680fba6361f057e848f4043465437` | match |
| `../../docs/product-campaign/wp00/consumer-deltas.patch` | `ccdf1fae37b5f30e5ae2a16aa1dfd71075d59bf5` | `83a7624bdbbfce641ed82d01a7a5d855742cec2a39bbf40057cb97d1e3eb618f` | match |
| `../../docs/product-campaign/wp00/contracts-v1.md` | `6052ba0d20b8c26106d07b1d0030b5e1326bfc04` | `d5c3fc5ed53dceafdf830ca7b11e22d2ad566d2fbe1d837e5250a2c9b3bc709d` | match |
| `../../docs/product-campaign/wp00/criterion-map.json` | `82463f1e2496d44ba53843df533b12944605ca47` | `1c146668c033a86c13692280973b0f1cd9ba8c8ef20fe0faa3562932873359f4` | match |
| `../../docs/product-campaign/wp00/oracles/corpus-consumers.json` | `0f9be4f73a447ccd194e11fe4f86984225ebb183` | `2b059151a9c1c24eff6e9d7a852f4208fb4e0ce38b46ae781496c5e61da7a60c` | match |
| `../../docs/product-campaign/wp00/oracles/journeys-j01-j08.json` | `996a1b42d3833d3b62ca9cee5ebb7955e339f1b9` | `89430a541094f1e7c56598f59e1983a3da482beaf916f6750f5e88457e14f1af` | match |
| `../../docs/product-campaign/wp00/oracles/measurement-protocol.md` | `2bc6ea8103463da6611ab164af19cbabdcd92b10` | `b94b1568563ea678431521b10ef160be70bbe30b98818735740d69bc88e06185` | match |
| `../../docs/product-campaign/wp00/oracles/t01-t03-evidence.json` | `af423309734fa1de4106b9420eda9ad0fc11ea26` | `da8ca6bbe67c577389c0f1389fb3da7d1a06d7c81a972982760996c3da07c344` | match |
| `../../docs/product-campaign/wp00/ownership-v1.json` | `cab4ab5ad52bf350c610a0bd88f97f71998413c5` | `d66c096565b41b0fa86c8bef317e11ab95aaa83a09e398acc7151f120f50d773` | match |
| `../../docs/product-campaign/wp00/state-consumer-matrix.json` | `db93d9dc03fab4d5e28aafe1ce4fd648f381033e` | `526903fb47294acd6900467398c2a04551f05b1fa9f59378f0f956af036eed64` | match |
| `../../docs/product-campaign/wp00/state-consumer-matrix.md` | `11a49e4c4212f35baa78e8b02ea7deb280b86dce` | `3d519f43055cd7afc6e5b8bf534724e2a246e2af04efddc3e40e31554a3d46b8` | match |
| `../../docs/product-campaign/wp00/t02-criteria.json` | `e49fa449b798c07e2e854d2e583eeccc11c73c5d` | `17f290f3b2f6932ea946177984b6cc562c052cc2222a5eb2605c856f02266883` | match |
| `../../../../../apps/cli/src/sucafina-product/host-context.ts` | `3f6863be244ce79dc6538564ac0c0b6b8b58e8c1` | `51641a232525128ea4338034ff095a828204a5411dc7dd3334283c00fe6e57bd` | mismatch: #407 + #431 |

## Preserved contract and handoff

- All 38 artifact keys and their order remain unchanged. Applying the explicit CLI/narrative pins yields 38/38 matches in a static byte audit of this proposal; this is not a new product-test result.
- The previous revision-11 manifest identity and complete prior `revisionProvenance` remain exact. The ungated first revision-12 proposal is recorded by its own commit/blob/hash instead of being treated as an approved revision.
- All other top-level fields remain exact: contract definitions, operations, profiles, skills, packs, routes, AM01–AM06, schemas, storage ownership, planning/canonical identities, historical code baseline, implementation status and the entire `consumerAcceptance` object.
- `consumerAcceptance.status` remains `BLOCKED`, including its original observed commit and required handoffs. No SF baseline candidate/artifact, coverage result, execution-evidence digest, GO or global/native acceptance is fabricated or promoted.
- The only test change from the integrated base is `expect(freeze.revision).toBe(11)` → `expect(freeze.revision).toBe(12)`. Every other byte, export, matrix, schema, route and ownership assertion is unchanged.
- No CI, local product test, merge or main-branch write was performed by this amendment task. The coordinator owns review and the strict `Sucafinav1/test/product/wp00/contract-freeze.test.ts` gate on the amended candidate.
