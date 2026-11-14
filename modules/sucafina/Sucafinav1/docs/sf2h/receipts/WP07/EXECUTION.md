# WP07 — execução, resultados e entrega

## Estado e limites

**DRAFT/BLOCKED.** Produto publicado na branch [astra-wp07](https://github.com/gustavomhss/Orchestra-SF/tree/astra-wp07), com [PR #27 contra sf2-stack](https://github.com/gustavomhss/Orchestra-SF/pull/27). As quatro tasks têm implementação, consumidores e correções; nenhuma é declarada integralmente aceita. O typecheck compartilhado e as provas externas ainda impedem READY_FOR_REVIEW.

Produto testado W: **dcde725380e76ff3180b1415e3c0838b9ca7df34**  
Tree W: **c9c97786a5fa8692d861d87663f66e7803440514**  
Base da PR: **6b8b4090cf3c3ec952986a7f4fc602f1266bf6e0**.

A publicação posterior a W acrescenta somente arquivos em docs/sf2h/receipts/WP07. README, produto, testes, fixtures e workflows já estão congelados em W. O head/tree dessa publicação e a comparação W → head serão registrados por root no corpo da PR. Este relatório não inclui seu próprio hash nem atribui a W resultados de outro produto.

## Comportamento entregue

- **T01 — pauta:** ports de domínio, seleção por identidade, prévia dos recortes e contagens, ordem e remoção, recusa de drift e refresh explícito.
- **T02 — revisão estável:** preservação C05 humana, retry idempotente, reabertura autorizada, atualização como nova revisão e remoção do conteúdo após revogação. O recibo compacto evita persistir outra cópia completa da revisão; aceita o formato legado e volta a ler a revisão com autorização corrente.
- **T03 — mudanças:** bases preservadas compatíveis, identidade de registro, antes/depois e delta, notas humanas separadas, navegação e recusa de comparações incompatíveis.
- **T04 — fechamento e relatório:** fechamento por ação canônica, leitores tipados, consumo C11 autorizado, DOCX/PPTX completos, paginação e armazenamento/download privado idempotente.

O consumidor C11 usa o case físico codificado, aceita DecisionBrief sem links conforme o produtor e valida a cobertura do material como conjunto, preservando a ordem do artefato. A UI permite Retry access, exige o envelope compartilhado e mostra os campos reais de provenance. Dados de provenance nos testes continuam explicitamente marcados como fixtures.

## Checks do produto atual

| Seleção | Snapshot S | Resultado hospedado |
| --- | --- | --- |
| Chromium anual e contribuição, 2 arquivos | 1a2b5cdd71a401d07a6abbaa36e8753e4207fc04 | [43537439411](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43537439411): **2 PASS / 0 FAIL** |
| Consumers/exports, 20 arquivos | 33388c5eacd3dd62529a86e5c2228ce0fdb390da | [43537891941](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43537891941): **79 PASS / 0 FAIL** |
| Typecheck, guards e geração | Checkout W | [43537045211](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43537045211): **typecheck FAIL**, guards PASS, geração PASS |

Os dois runs de teste somam **81 PASS, 0 FAIL, 22 arquivos**. O Bun reportou **952 expect() calls** na seleção não browser. Assertions Playwright não foram somadas artificialmente.

As seleções explícitas foram validadas no produto atual por validateRequest/locateTestPackage, com package sucafina, directory modules/sucafina, runner bun e env vazio. Cada S contém apenas .ci-run.json sobre W. [checks.json](checks.json) conserva requests, hashes, blob SHA, árvores, compare URLs e controles canônicos. Ambos os controles finais são **not applicable**; não houve spawn omni, execução nativa ou qualificação private-MCP.

O comando **bun typecheck** terminou com **137 diagnostics: 137 externos em 46 arquivos e 0 próprios**. O resultado permanece FAIL. [TYPECHECK-EXTERNAL.md](TYPECHECK-EXTERNAL.md) identifica owners e deltas; não se presume baseline aprovado sem execução independente.

Guards: **78 regras, 630 paths, 0 gate findings, 11 avisos, 0 erros**, usando a base **a1d37698a7bb097c1578f827eba6a19b9917ef07**. Nenhuma regra foi suprimida.

## Provas novas e fronteiras

A jornada Chromium atual percorre o ano completo de 2027 com Planner, SQLite, autoridade, HTTP, preparação e reunião reais no host de teste. Mantém todas as etapas e os limites originais de 5s. A redução da cópia persistente C05 não introduz cache de autorização, deduplicação de Planner ou truncamento do produtor. A regressão de recibos cobre restart real do SQLite, replay legado, concorrência, adulteração e revogação.

A contribuição possui dois tipos de testemunho: leitura C11/SQLite real com registros persistidos de teste e um teste Chromium do consumidor com envelope completo controlado. Não houve produção dessa contribuição por SessionV2. O fluxo C06/C17 real prova mensagem canônica, reply/resolve, reabertura, revogação persistida e recusa de exclusão/recriação física. Não prova edição v3 → v4, leitura histórica da versão editada ou autorização positiva de uma fonte removida.

A montagem na instalação WP10, o corpo factual C07, os históricos ausentes e as execuções nativas permanecem dependências descritas em [INTEGRATION-DELTA.md](INTEGRATION-DELTA.md), [C11-PRODUCER-RECHECK.md](C11-PRODUCER-RECHECK.md) e [PRODUCER-RECHECK.md](PRODUCER-RECHECK.md).

## Inspeção visual dos exports

Artefato **14090481238**, run **43537045211**, ZIP SHA-256 **1b67106fb6d3a37ed83ee7df4b011680cd58d91b18c6483d85953283b6b58d56**.

| Export | Imagens conferidas |
| --- | ---: |
| PPTX preservado | 39 slides |
| PPTX legado | 26 slides |
| DOCX preservado | 14 páginas |
| DOCX legado | 6 páginas |

O baseline foi aberto integralmente: 85 imagens individuais. Os quatro exports exatos do candidato atual foram renderizados novamente; todas as 85 imagens têm as mesmas dimensões e pixels RGBA do baseline inspecionado, sem diferenças. Não se inferiu equivalência visual somente por XML ou extração de texto. O corpus contém 25 projetos, notas longas, seção vazia, comentário e 36 valores mensais.

[Recibo visual](visual-check-43537045211.json) registra arquivos, hashes, cobertura e método. A geração conserva o manifesto anterior à inspeção, cujo texto pending não é reescrito. A prova visual não concede ACL, continuidade histórica, montagem nativa ou execução C16.

## Critérios

Dos **86 critérios canônicos**, **50** têm prova no escopo indicado e **36** permanecem BLOCKED_EXTERNAL. Nenhum é marcado DONE.

| Grupo | Critérios | VERIFIED_SCOPED | BLOCKED_EXTERNAL |
| --- | ---: | ---: | ---: |
| WP07 | 16 | 7 | 9 |
| WP07.T01 | 13 | 10 | 3 |
| WP07.T02 | 22 | 9 | 13 |
| WP07.T03 | 14 | 9 | 5 |
| WP07.T04 | 21 | 15 | 6 |

Cada ID, texto canônico, implementação, consumidor, teste nominal, run e limitação está em [criteria.json](criteria.json), com aprofundamento T03 em [t03-review.json](t03-review.json). VERIFIED_SCOPED não é aceitação integral.

Critérios ainda bloqueados:

- **WP07:** WP07.DOD.01, WP07.DOD.10, WP07.QLT.01, WP07.CMP.01, WP07.CMP.03, WP07.CMP.10, WP07.SUC.01, WP07.SUC.02, WP07.SUC.10
- **WP07.T01:** WP07.T01.CMP.02, WP07.T01.SUC.01, WP07.T01.SUC.02
- **WP07.T02:** WP07.T02.DOD.02, WP07.T02.DOD.18, WP07.T02.QLT.01, WP07.T02.QLT.18, WP07.T02.CMP.01, WP07.T02.CMP.02, WP07.T02.CMP.18, WP07.T02.SUC.01, WP07.T02.SUC.02, WP07.T02.SUC.18, WP07.T02.CHK.03, WP07.T02.CHK.04, WP07.T02.CHK.18
- **WP07.T03:** WP07.T03.QLT.01, WP07.T03.CMP.01, WP07.T03.SUC.01, WP07.T03.SUC.02, WP07.T03.SUC.03
- **WP07.T04:** WP07.T04.DOD.18, WP07.T04.QLT.18, WP07.T04.CMP.18, WP07.T04.SUC.01, WP07.T04.SUC.18, WP07.T04.CHK.18

## Histórico preservado

A aprovação anual atual não transforma as tentativas anteriores em PASS. As falhas anuais por timeout continuam ligadas ao seu próprio produto:

| Tentativa | Run | Resultado e observação |
| --- | --- | --- |
| 6 | [43528912346](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43528912346) | **FAIL** — Comparison exceeded 5s status assertion; review-comparison HTTP returned 200 after5122ms; Chrome cleanup verified |
| 7 | [43530154667](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43530154667) | **FAIL** — Annual second preservation returned HTTP200 after6509ms; click5s timed out. No claim of annual browser PASS. |
| 10 | [43534944664](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43534944664) | **FAIL** — Annual second preserve took 5475ms and exceeded the existing 5000ms action timeout; contribution browser passed. |
| 12 | [43536210514](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43536210514) | **FAIL** — Annual second preserve measured5172ms and exceeded5000ms action deadline; contribution recovery/provenance test passed. |

A comparação de janeiro de 2027 aprovada na tentativa 8 permanece identificada como mensal. Ela não foi renomeada como execução anual.

| Tentativa | W | S | Run | Conclusão | PASS / FAIL |
| --- | --- | --- | --- | --- | --- |
| 1 | c5db222c5a19 | e994db724acf | [43523764705](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43523764705) | failure | não informado / não informado |
| 2 | 57ceb253dfe7 | 64102b938f7a | [43524675966](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43524675966) | failure | 55 / 5 |
| 3 | 798c096c105b | 7a1f2bf79198 | [43526243469](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43526243469) | failure | 62 / 1 |
| 4 | ee5a07da0a7d | a534817eabb3 | [43527487980](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43527487980) | failure | 0 / 1 |
| 5 | d89084bb0f8e | 2cc9cd47f5a4 | [43528384822](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43528384822) | failure | 66 / 1 |
| 6 | fc59841cec46 | 8a0de0f31766 | [43528912346](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43528912346) | failure | 0 / 1 |
| 7 | 7664de39a567 | b58997866f22 | [43530154667](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43530154667) | failure | 0 / 1 |
| 8 | c5143e6ad6d8 | 9d4670fdf446 | [43530831862](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43530831862) | success | 1 / 0 |
| 9 | c5143e6ad6d8 | c2d96395cb92 | [43531115429](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43531115429) | success | 67 / 0 |
| 10 | 46781943bf93 | 69a18bb37a3b | [43534944664](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43534944664) | failure | 1 / 1 |
| 11 | 46781943bf93 | c3fb1b6c0515 | [43535396085](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43535396085) | success | 78 / 0 |
| 12 | dd30b8238143 | 1fcc5a04be1f | [43536210514](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43536210514) | failure | 1 / 1 |
| 13 | dcde725380e7 | 1a2b5cdd71a4 | [43537439411](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43537439411) | success | 2 / 0 |
| 14 | dcde725380e7 | 33388c5eacd3 | [43537891941](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43537891941) | success | 79 / 0 |

A tentativa 13 teve um retry de disparo: o snapshot inicial **66071da10fce65e51cf47b218d019386aef29485** não apresentou run nas consultas iniciais. Um commit vazio levou a **1a2b5cdd71a401d07a6abbaa36e8753e4207fc04**, com a mesma tree **e2a128a8c33b6b407bd43ecfc0d874ff392bbb1d** e nenhum path alterado entre os dois snapshots. O diff W → S final continua contendo somente .ci-run.json; produto e seleção são idênticos. A observação inicial de ausência de run não é um resultado de teste.

**Sobreposição involuntária registrada.** Depois do retry, o run original também ficou visível. Os dois workflows chegaram a ficar em voo; o limite operacional de um run por vez não foi plenamente cumprido nesse incidente. A seleção unit14 foi disparada somente após ambos terminarem. O run original tardio é preservado abaixo e não é somado novamente aos testes finais.

| Observação adicional | W | S original | Run | PASS / FAIL |
| --- | --- | --- | --- | --- |
| 13-initial-late | dcde725380e7 | 66071da10fce65e51cf47b218d019386aef29485 | [43537466887](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43537466887) | 2 / 0 |

O primeiro run não teve controle omni válido; seu erro não é ocultado. Nos demais, not applicable não constitui prova nativa.

| Check | Run | Typecheck | Próprios / externos | Guards | Exports |
| --- | --- | --- | --- | --- | --- |
| 1 | [43523767480](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43523767480) | FAIL | não contado / não contado | PASS | FAIL |
| 2 | [43524199358](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43524199358) | FAIL | 40 / 137 | PASS | PASS |
| 3 | [43524911748](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43524911748) | FAIL | 2 / 137 | PASS | PASS |
| 4 | [43526207659](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43526207659) | FAIL | 0 / 137 | PASS | PASS |
| 5 | [43527489487](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43527489487) | FAIL | 0 / 137 | PASS | PASS |
| 6 | [43528388078](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43528388078) | FAIL | 1 / 137 | PASS | PASS |
| 7 | [43528915475](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43528915475) | FAIL | 0 / 137 | PASS | PASS |
| 8 | [43530154275](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43530154275) | FAIL | 0 / 137 | PASS | PASS |
| 9 | [43530862046](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43530862046) | FAIL | 0 / 137 | PASS | PASS |
| 10 | [43534947545](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43534947545) | FAIL | 0 / 137 | PASS | PASS |
| 11 | [43536212089](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43536212089) | FAIL | 1 / 137 | PASS | PASS |
| 12 | [43537045211](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43537045211) | FAIL | 0 / 137 | PASS | PASS |

O check11 teve **138 diagnostics**, incluindo **1 próprio** na guarda de currentSnapshots e **137 externos**. O resultado histórico não foi apresentado como zero próprio. O candidato posterior contém a correção e é avaliado pelo seu check específico.

## Entrega a S0

O compare base → W relaciona **60 paths de produto/testes/configuração** e, separadamente, **20 recibos já existentes em W**; a lista completa tem **80 paths**, todos dentro do ownership admitido. Cada entrada conserva blob SHA e status do GitHub.

S0 revisará a PR, integrará os deltas dos owners e sanará o typecheck compartilhado antes da aceitação. SessionV2, SkillLoadReceipt e consumption receipts permanecem vazios; a campanha global, os cenários C/AM01–AM06/D e as oito seleções integradas continuam responsabilidade do integrador.

**Não houve teste local de produto, suíte epic/full, merge em dev ou deploy.** A PR permanece draft e esta entrega não declara GLOBAL_RELEASE.
