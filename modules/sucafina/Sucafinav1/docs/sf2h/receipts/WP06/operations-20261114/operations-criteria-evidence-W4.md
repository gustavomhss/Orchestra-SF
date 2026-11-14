# WP06 — resultado W4 anexado aos 140 critérios

Produto `644324778e4a21d22424515dd698d5b8d6c01893`, árvore `6ec8797d360ecec89f1734031b0d1e3e98dd3605`. Este adendo preserva o mapa canônico e as observações anteriores; não declara aceite integral.

## Resultado e qualificação

| Prova | Run | Resultado |
|---|---|---|
| Bun24 | [43582205250](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43582205250) | **FAIL agregado: 114 pass / 3 fail / 0 skip**, 117 casos, 24 arquivos, 1.445 assertions. H02/H03/H05 WP04 falham; os 22 arquivos selecionados do corpus histórico81 passaram individualmente. |
| Documents browser | [43582881446](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43582881446) | **8 pass**, renderer de Documents/dossiê/scenario com endpoints HTTP explicitamente sintéticos. Recibo, tentativas e PNG preservados no check JSON. |
| Typechecks/guards | [43582192808](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43582192808) | CLI e guards **PASS** (78 regras, 740 paths, zero gates/erros, 11 warnings); Sucafina e aggregate **FAIL** somente por TS2741 na fixture Atlas WP14, `procurementEvidenceWrites` ausente. |

## Dossiê de sourcing entregue pelo owner

O serviço CLI e o renderer publicados por Compose foram consumidos byte a byte. Os cinco casos reais de runtime preservam PDF digital/DOCX/texto e acrescentam termos comerciais, FX submetido, escolha humana e recusa após mudança de fonte/revogação durante a releitura. Os oito casos browser preservam os fluxos documentais e demonstram explanation, next steps, termos, rejeitado sem abertura indevida e limpeza de conteúdo após 403/409.

Essa prova pertence ao consumidor CLI de dossiê. A via `business.procurementDossier` tem um patch owner separado, com H01 próprio preparado. O script de confirmação também exige H09 real UI→HTTP. A mutação de fonte invalida o selector além do payload de sourcing; não representa uma prova isolada só da igualdade de sourcing.

## Corpus histórico81 reconciliado

31 arquivos históricos com 137 passes e 2 skips preservados; 26 arquivos com 63 passes individuais W1; 1 arquivo nativo com 2 passes W3; **22 arquivos com 99 passes individuais W4**; 1 consumidor Atlas permanece atribuído ao owner. O JSON contém as 81 linhas e as observações deduplicadas, além dos resultados Bun24 fora desse corpus.

Imports browser14 e Procurement browser8 continuam vinculados ao W2 e ao fechamento explícito de dependências. Native import-analysis permanece vinculado ao W3, com o mesmo orçamento e as mesmas asserções; a falha anterior W1 continua registrada. O parecer completo de W5 cobre wrapper de dossiê, UI, restauração CAS e quatro fixtures Chromium. É condicionado aos blobs publicados e não libera alterações adicionais.

Os 140 IDs referenciam os checks e casos novos sem duplicar o catálogo completo. Todos os textos exatos, tarefas, consumidores, AMs, provas não qualificadas e pendências históricas continuam no mapa original. GNATIVE real, aceites humanos e epic de todo o bundle permanecem fora deste aceite de componente.
