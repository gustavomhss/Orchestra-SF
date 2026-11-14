# Observação final delimitada dos heads

**Corte único de heads: 2026-11-14 12:19:40 UTC.** As comparações e leituras posteriores usam esses SHAs imutáveis. Este relatório é uma observação independente de fonte; não é intake, execução de produto ou aceite.

## Heads e árvores

| Origem | Head observado | Tree | Estado frente ao pin anterior |
| --- | --- | --- | --- |
| [PR #22](https://github.com/gustavomhss/Orchestra-SF/pull/22) / astra-wp03 | `90c467cea436daa24987ad68a588a7d80f91064e` | `62545e5c8a90e03d6ca92298dc5547853e8ea88a` | Mesmo head. |
| [PR #24](https://github.com/gustavomhss/Orchestra-SF/pull/24) / astra-wp05 | `0881fee21f07bf8a9a1153d7d55727837cdf497a` | `220df3c21c228afee30bc7d06e998eaa4fca2f36` | Mesmo head. |
| [PR #40](https://github.com/gustavomhss/Orchestra-SF/pull/40) / astra-wp11 | `d7775d6f1eb17af1590ccfb98547259eb017cd1b` | `e6831add3e891e020d34540234bd685a7dd05e01` | Avançou4commits; reconciliação ainda necessária. |
| sf2-stack | `6b8b4090cf3c3ec952986a7f4fc602f1266bf6e0` | `acf3b722ad55c090bef8e9dc2b3fac2d9ad570af` | Mesmo head. |
| astra-compose | `00304ac25cc82ffd87ebd3096bd2f5cfec5222e1` | `884138976f1e5ab04d924c3f29f4ba6584acb070` | Avançou1commits; ownership externo. |
| astra-interface | `5fe39f1259d2f8631cef6172aaa7e6c92f436801` | `68a8d13d3d60164670a7e95310b2cf1afb294e43` | Avançou2commits; ownership externo. |

## PR40: quatro commits novos

| Commit | Mensagem |
| --- | --- |
| `14d0cef142561c33076e19bf9c8fb17d1f1e7038` | test(sucafina): declare complete annual training quote in WP11 history |
| `c41d7277be5941bafb105654360a32adea7f0347` | test(sucafina): restore authority and lifecycle in WP11 execution fixtures |
| `1fa71a64faf297fdbae07747d260d4ced7ec9532` | test(sucafina): reconcile WP11 source lifecycle and bounded finance fixtures |
| `d7775d6f1eb17af1590ccfb98547259eb017cd1b` | test(sucafina): exercise real Dashboard edit in WP11 source race |

O compare `65509f0b8c435b88fb0ec9949299571f011d2347...d7775d6f1eb17af1590ccfb98547259eb017cd1b` está ahead4/behind0. São44paths:33recibos novos e11arquivos de código/teste. Nenhum dos33recibos colide com o manifest Finance observado; o arquivo `final-heads-wp11-receipts-tree-elements.json` fornece cada path e blob exato para uma eventual publicação por SHA, sem reinterpretar seus veredictos.

A comparação com Finance usa W29 `96fc3162ae309f8b91b2c55524335026f8704714`, tree `d3fa003182dd1c38778b37e7b7219a5015bb58a2`. Quatro blobs já são idênticos: `product/analytics/decision-view.ts`, WP05 `engine-fixture.ts`, WP11 `case-import-incarnation.test.ts` e `composite-coverage.test.ts`.

| Arquivo WP11 divergente | Delta real e limite |
| --- | --- |
| `calculation-history.test.ts` | Same real renewed UI admission after permanent lease revocation already exists in Finance. Owner adds requestFor(revokedContext) undefined, a new requestId, unchanged principal, and revalidated live lease after source edit. Owner removes Finance's later historical read denial for the revoked context; preserve that existing negative when consuming additions. Variable rename and explicit Request annotation difference are not a product fix. |
| `choice-prepared-execution.test.ts` | Owner loops over dashboard/procurement; Finance already performs the same two ordered initializeSources calls. Only loop/comment spelling differs. No consumer oracle or product behavior delta. |
| `hot-topic-snapshot.test.ts` | Both now seed canonical lowercase open. Owner adds sourceRace.committed captured from the real command transaction and a positive assertion before existing Dashboard snapshot/persistence oracles. Owner additionally initializes Procurement; Finance already initializes Dashboard before first protected transaction. Owner error string lacks Finance's JSON command details. No reason to discard the useful Finance diagnostic on merge. |
| `promotion-coverage-proof.test.ts` | Dashboard initialization already matches Finance behavior. Owner adds canonical Procurement initialization and updates comment. No assertion, source proof, producer or authorization change in this diff. |
| `renewal-choice-fixture.ts` | Owner switches baseline projectForecast, renewalCoverage projection, and renewalProjection from classified planner to sourcePlanner. operationSources.resolveForecastCoverage explicitly returns unavailable; no C10 classification is requested at auxiliary target/source admission. Stored-scenario projection already used sourcePlanner in Finance. Classified Planner remains for judgment/promotion. This is a material fixture adapter difference; independent review and affected Actions required before qualifying. It does not replace Finance's separate W29 per-invocation read transaction helper. |
| `renewal-choice-history.test.ts` | Adds assertions for exactly12 training components,11 confirmed zero months and training:11 amount40000 USD confirmed. All prior financial/choice/history assertions remain in this diff. |
| `renewal-source-fixture.ts` | Finance supplies a 12-element f array with40000/amount at November and zero elsewhere; owner supplies scalar f0...f11 fields with the same values. Both invoke the real canonical OPEX command; no new calculation or amount. Equivalence is intended by the payload and prior Finance S16/S17 evidence; this read alone does not execute the alternate owner payload. |

Os sete arquivos remotos foram lidos no head d777, guardados somente em `final-heads-remote/` e conferidos pelo hash Git blob. Os diffs FinanceW29→PR40d777 estão em `final-heads-diffs/`. Nenhum arquivo do produto foi sobrescrito. O root foi informado antes de qualquer recomendação de intake.

## Novos deltas dos outros owners

### astra-compose — `00304ac25cc82ffd87ebd3096bd2f5cfec5222e1`

- One commit16paths after ed10; adds a private historical calculation read lease for stale analysis settlement with active-case, snapshot, original-authority and final fences.
- New analysis-stale-calculation regression is authored; no claim that it passed at00304.
- BI UI revocation regression narrows current.kind to ui before fixture.ui.finish, statically addressing the previously observed TS2345 at this callsite.
- Four FinanceW23 blobs are consumed, including hot-topic-draft5e0b80a and mutations3e7575c. Finance's later W25 hot-topic d8a151c and mutations e0840d7 must not be overwritten by this older intake.

### astra-interface — `5fe39f1259d2f8631cef6172aaa7e6c92f436801`

- Two commits46paths after4bd1; adds case-work selection/recovery and stabilizes question select labels.
- No Planner, Analytics, Decisions or monthly source file changed in this bounded comparison.
- A published owner-only WP11 case-port fixture patch proposes explicit empty-operation guards for three callers. It is not applied, not tested, and must be assessed against the actual composed contract before intake.

A proposta externa de fixture `wp11-empty-operation-callers.additive.patch` tem blob `5d7413a5547beaad313fb2db1552f4f8b487b1f1`, base alvo `ed68e903fdaaa313ea14b18f194ee319b6dbdf09`, proposta `70671dcc034499ba7fad04d0984ca5407b6cb616`. Ela verifica explicitamente que os três fixtures não têm operações; não é um verificador de autorização semântica para operações reais. Foi apenas preservada como dado externo nesta observação.

## CI externo: metadados observados

| Run | SHA executado | Conclusão |
| --- | --- | --- |
| [43589763353](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43589763353) | `564d04391d009b89718b10e67175d710d9e6b9c9` | completed / failure |
| [43590725536](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43590725536) | `2af8d573e7d2c808e5222d44242eb1ee8f66d467` | completed / failure |
| [43590727281](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43590727281) | `4bd1f807e449d040e3db61c4d2b1e177b205ac69` | completed / failure |
| [43592240575](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43592240575) | `ff98cac1845c831aab7bff01507864314a3254a4` | completed / failure |
| [43592242039](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43592242039) | `edefb5b66706aea866ee45c7e8e76332c27c342a` | completed / failure |

Os jobs conhecidos confirmam falha em Run tests para Compose43589763353/job132431793223 e Interface43590725536/job132434657511; os cleanups terminaram success. O check Interface43590727281/job132434661801 falhou nos typechecks do package Sucafina e da autoridade CLI. A observação não extrai novos totais de testes nem atribui essas execuções a heads posteriores. Os runs Interface43592240575/43592242039 executam snapshots/produto do commit anterior edefb5b; o head final observado5fe39 tem outra alteração.

## Limites

- No product source or repository file changed by this observer.
- No imports, Bun, tests, typecheck, CI dispatch or remote mutations.
- CI metadata/jobs were read; no new passing test counts, native proof or installed acceptance is inferred.
- PR40d777 was newly observed and still requires parent-led reconciliation. Reports do not themselves consume it.
- No READY/DONE or C/D claim.

Retrieval concluído em 2026-11-14 12:22:50 UTC. O JSON companheiro conserva os44paths PR40,16paths Compose e46paths Interface,11comparações de blobs Finance, todos os commits/árvores,33recibos e os metadados CI. Não houve nova leitura dos heads após o corte.
