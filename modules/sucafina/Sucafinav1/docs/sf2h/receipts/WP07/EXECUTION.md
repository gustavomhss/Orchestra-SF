# WP07 — execução, resultados e entrega

## Estado publicado

**DRAFT/BLOCKED.** A implementação própria foi publicada na branch [astra-wp07](https://github.com/gustavomhss/Orchestra-SF/tree/astra-wp07), com [PR #27 contra sf2-stack](https://github.com/gustavomhss/Orchestra-SF/pull/27). As quatro tasks receberam implementação, consumidores e correções; nenhuma é declarada integralmente aceita. Dos 86 critérios canônicos, 50 têm prova aprovada no escopo declarado e 36 conservam dependências externas. Typecheck global e jornada anual impedem declarar READY_FOR_REVIEW.

Produto testado W: **c5143e6ad6d8dca61b09572c60f5a6ed64093f74**  
Tree W: **889fe8f2c5dfc25ba9d8c25962e984454a12bd81**  
Base da PR: **6b8b4090cf3c3ec952986a7f4fc602f1266bf6e0**.

A publicação posterior a W contém somente documentação e recibos, incluindo esclarecimento no README. O head/tree final e a comparação de W com essa publicação ficam no corpo da PR, evitando recibo que tente incluir seu próprio hash. Os blobs executáveis, testes, fixtures e workflow não mudam nessa publicação.

## Comportamento entregue

- **T01 — pauta:** composição real com ports de domínio, seleção por identidade, prévia de períodos/contagens/valores/notas, ordenação, remoção de seção e registro, seleção inválida após drift/expiração e refresh explícito.
- **T02 — revisão estável:** preservação humana C05, vínculo à versão e evidências, retry idempotente após perda de resposta, leitura histórica autorizada, comparação e navegação do modo reunião, nova identidade na atualização e remoção do conteúdo após revogação.
- **T03 — mudanças:** comparação de bases preservadas compatíveis, identidade de registro, before/after, remoções/status/prazo, notas humanas separadas, recusa de delta em unidade/moeda/período incompatível e estado canônico corrente do encaminhamento mostrado separadamente.
- **T04 — fechamento e relatório:** fechamento humano pela ação canônica, readers de resultado/decisão/observado, consumer C11 com recusa explícita quando o produtor não fornece corpo/proveniência, export completo DOCX/PPTX, paginação, valores/figuras/legendas e armazenamento/download privado idempotente.

As factories e handlers concretos estão no escopo WP07. A montagem no host da instalação e o registro nativo são deltas externos explícitos, não uma capacidade alegada desta PR.

## Checks finais

| Prova | Produto W / snapshot S | Run e resultado |
| --- | --- | --- |
| Chromium, janeiro2027, 1 arquivo | W c5143e6ad6d8dca61b09572c60f5a6ed64093f74 / S 9d4670fdf446d5e7acc01b95842209f68bd18e0b | [43530831862](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43530831862): **1 PASS, 0 FAIL** |
| Consumers/exports, 19 arquivos exatos | Mesmo W / S c2d96395cb923a92c7a8f09c3190d5c42439e617 | [43531115429](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43531115429): **67 PASS, 0 FAIL; 826 assertions Bun** |
| Typecheck/guards/geração | Mesmo W, sem snapshot de request | [43530862046](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43530862046): **typecheck FAIL**, guards e geração PASS |

As duas seleções finais somam **68 testes aprovados, zero falhas, 20 arquivos**. O total de 826 assertions é reportado pelo Bun na seleção não browser; não se inventou contagem adicional das assertions Playwright.

As seleções foram validadas pelos validadores canônicos, com package sucafina, directory modules/sucafina, runner bun e env vazio. A união final contém todos os 20 arquivos selecionados, sem filtro amplo. O browser usa a biblioteca Playwright dentro do teste Bun, não uma configuração Playwright inventada. Cada snapshot S contém exatamente uma alteração: .ci-run.json. [checks.json](checks.json) registra árvores, hashes de requests, compare URLs e prova de identidade de todos os demais blobs. Os dois runs finais apresentam omni positive control **not applicable**, validado pelo parser canônico; não executaram nem qualificaram omni.

O typecheck executou **bun typecheck** no package e terminou com **137 diagnostics externos em 46 arquivos, zero em arquivos próprios**. Isso continua sendo FAIL. O inventário e os deltas por proprietário estão em [TYPECHECK-EXTERNAL.md](TYPECHECK-EXTERNAL.md). Não se presume que cada erro já existia antes sem um run de baseline independente.

Guards: **78 regras, 608 paths, zero gate findings, 11 avisos externos, zero erros**, usando origin/dev em **a1d37698a7bb097c1578f827eba6a19b9917ef07**. Não houve supressão de regra ou label de aprovação.

## Prova visual dos exports

Artefato **14086898379**, run **43530862046**, job **132247907151**, tentativa1. ZIP SHA-256: **694d23b69f97ecab2537211281f52475be75db4ed1bdf0d1cce0807779a3286b**.

| Export | Saída renderizada |
| --- | ---: |
| PPTX preservado | 39 slides |
| PPTX legado | 26 slides |
| DOCX preservado | 14 páginas |
| DOCX legado | 6 páginas |

O baseline foi aberto e inspecionado integralmente: **85 imagens individuais**. Os quatro arquivos exatos do candidato final foram renderizados novamente, e **85/85 imagens** têm mesmas dimensões e todos os pixels RGBA idênticos ao baseline inspecionado; zero diferenças. A comparação é integral, não por amostra ou só texto/XML. O corpus inclui 25 projetos, notas extensas, seção vazia, comentário preservado e trajetória financeira com todos os 36 valores mensais. Os 26 registros da revisão são 25 projetos e uma origem financeira, não a quantidade de métricas.

[Recibo visual final](visual-check-43530862046.md) e [manifesto de inspeção](visual-check-43530862046.json) vinculam os hashes dos arquivos, renderizadores, cobertura e limites. Essa prova não concede ACL, C17 físico, native/MCP ou montagem do host. A captura PNG do teste Bun não foi publicada por esse runner; não se oferece screenshot de navegador inacessível como artefato de prova.

## Critérios e bloqueios

| Grupo | Critérios | VERIFIED_SCOPED | BLOCKED_EXTERNAL |
| --- | ---: | ---: | ---: |
| WP07 | 16 | 7 | 9 |
| WP07.T01 | 13 | 10 | 3 |
| WP07.T02 | 22 | 9 | 13 |
| WP07.T03 | 14 | 9 | 5 |
| WP07.T04 | 21 | 15 | 6 |

Cada ID, texto canônico, implementação, consumidor, teste individual, run e limitação está em [criteria.json](criteria.json); o aprofundamento de comparação está em [t03-review.json](t03-review.json). VERIFIED_SCOPED não significa DONE nem qualificação global.

Critérios sem comprovação integral, mantidos como BLOCKED_EXTERNAL:

- **WP07:** WP07.DOD.01, WP07.DOD.10, WP07.QLT.01, WP07.CMP.01, WP07.CMP.03, WP07.CMP.10, WP07.SUC.01, WP07.SUC.02, WP07.SUC.10
- **WP07.T01:** WP07.T01.CMP.02, WP07.T01.SUC.01, WP07.T01.SUC.02
- **WP07.T02:** WP07.T02.DOD.02, WP07.T02.DOD.18, WP07.T02.QLT.01, WP07.T02.QLT.18, WP07.T02.CMP.01, WP07.T02.CMP.02, WP07.T02.CMP.18, WP07.T02.SUC.01, WP07.T02.SUC.02, WP07.T02.SUC.18, WP07.T02.CHK.03, WP07.T02.CHK.04, WP07.T02.CHK.18
- **WP07.T03:** WP07.T03.QLT.01, WP07.T03.CMP.01, WP07.T03.SUC.01, WP07.T03.SUC.02, WP07.T03.SUC.03
- **WP07.T04:** WP07.T04.DOD.18, WP07.T04.QLT.18, WP07.T04.CMP.18, WP07.T04.SUC.01, WP07.T04.SUC.18, WP07.T04.CHK.18

Os bloqueios incluem política estreita C08 para relatório de viewer; corpo factual imutável C07; tópicos Dashboard e continuidade page-to-record; reader C06 histórico real; histórico de comparação/sensibilidade/observado; continuidade/tombstone físico C17; host WP10/native/private-MCP e prova positiva C11. [INTEGRATION-DELTA.md](INTEGRATION-DELTA.md) traz paths, owners, contratos, proposta de alteração e provas requeridas.

## Falha anual preservada e limite do browser

O PASS de Chromium usa o recorte real de janeiro2027 do Planner, sem truncar a projeção devolvida, remover passos ou aumentar os limites das ações. Exercita seleção, reorder/removal, stale/refresh, perda de resposta, retry com mesma identidade, source unavailable, nova revisão, consulta de atualização, before/after, comentários, primeira revisão e revogação de fontes/itens.

Os runs anuais permanecem **FAIL**: [43528912346](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43528912346) recebeu a comparação em 5.122ms; [43530154667](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43530154667) recebeu a segunda preservação em 6.509ms, ambos ultrapassando limites de 5s. O segundo run não alcançou a comparação. A inspeção estática encontrou materialização profunda repetida dos três snapshots em currentSnapshots/autoridade, fora do ownership WP07, mas não houve perfil CPU para atribuir todo o tempo a uma função. A seção6 do delta externo define a investigação/correção do owner. O PASS mensal não reclassifica esses runs.

## Histórico de testes hospedados

| Tentativa | W curto | S curto | Run | Conclusão | PASS / FAIL |
| --- | --- | --- | --- | --- | --- |
| 1 | c5db222c5a19 | e994db724acf | [43523764705](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43523764705) | failure | not reported / not reported |
| 2 | 57ceb253dfe7 | 64102b938f7a | [43524675966](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43524675966) | failure | 55 / 5 |
| 3 | 798c096c105b | 7a1f2bf79198 | [43526243469](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43526243469) | failure | 62 / 1 |
| 4 | ee5a07da0a7d | a534817eabb3 | [43527487980](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43527487980) | failure | 0 / 1 |
| 5 | d89084bb0f8e | 2cc9cd47f5a4 | [43528384822](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43528384822) | failure | 66 / 1 |
| 6 | fc59841cec46 | 8a0de0f31766 | [43528912346](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43528912346) | failure | 0 / 1 |
| 7 | 7664de39a567 | b58997866f22 | [43530154667](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43530154667) | failure | 0 / 1 |
| 8 | c5143e6ad6d8 | 9d4670fdf446 | [43530831862](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43530831862) | success | 1 / 0 |
| 9 | c5143e6ad6d8 | c2d96395cb92 | [43531115429](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43531115429) | success | 67 / 0 |

O primeiro run não tem veredito omni válido e também não é PASS. Os demais históricos mantêm seus erros reais. O ledger completo inclui request, SHA/árvore, jobs, hashes dos logs, testes selecionados e controles, sem usar um green antigo para outro produto.

## Entrega a S0

Os 58 paths alterados no produto testado estão enumerados com blob SHA em checks.json. Todos estão nos prefixes/arquivos atribuídos, incluindo a exceção de workflow cirúrgico do handoff; recibos e README acrescentados depois são documentação própria.

S0 deve integrar os deltas dos proprietários, sanar o typecheck compartilhado, repetir a jornada anual e coletar as provas reais de host/C11/C16/C17 e recibos nativos antes de aceitar os critérios afetados. SessionV2, SkillLoadReceipt e consumption receipts permanecem vazios nesta entrega. A composição global C/AM01–AM06/D e as oito seleções finais continuam no bundle do integrador.

**Não houve teste local de produto, suíte epic/full, merge em dev ou deploy.** A PR permanece draft; esta entrega não declara GLOBAL_RELEASE.
