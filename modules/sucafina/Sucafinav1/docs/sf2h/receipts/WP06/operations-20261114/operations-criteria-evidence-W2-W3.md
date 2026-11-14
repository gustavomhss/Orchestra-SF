# WP06 — adendo de evidência W1/W2/W3 aos 140 critérios

Este adendo preserva o mapa canônico completo e seus estados históricos. Acrescenta observações pinadas; não aceita automaticamente critério, WP ou gate global.

## Execuções reconciliadas

| Check | Produto | Run | Resultado e limite |
|---|---|---|---|
| OPS-CHECK-W1 | `de6959db82dbe48bd59e3d012ff668a86347a6cd` | [43578238861](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43578238861) | CLI e guards verdes; Sucafina falha no consumidor Atlas WP14. |
| OPS-BUN43-W1 | `de6959db82dbe48bd59e3d012ff668a86347a6cd` | [43578845234](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43578845234) | 100 pass, 1 fail, 0 skip, 43 arquivos; seleção completa falhou. O caso forecast/intent foi interrompido aos 300s. |
| OPS-CHECK-W2 | `5e0c79ee7013ea84329ff1fab8b32ab04ebdc2c3` | [43580277793](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43580277793) | Dois typechecks falharam; guards verdes. Diagnósticos próprios e consumidor externo preservados. |
| OPS-BROWSER-W2 | `5e0c79ee7013ea84329ff1fab8b32ab04ebdc2c3` | [43580401528](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43580401528) | 30 pass, 0 retries/skips/flaky; 14 imports +8 documentos +8 Procurement. HTTP sintético explicitado nos WP06. |
| OPS-CHECK-W3 | `d7d343ecb2ef4b4ccff925f50a5a60324d22b371` | [43580747934](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43580747934) | CLI e guards verdes; Sucafina falha somente no consumidor Atlas WP14. |
| OPS-NATIVE-W3 | `d7d343ecb2ef4b4ccff925f50a5a60324d22b371` | [43580976466](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43580976466) | 2 pass, 0 fail/skip, 123 asserts, 1 arquivo; 311,30s totais. Mesmo teste/budget; Omni não aplicável. |

## Nativo: resultado atual e histórico

O mesmo caso forecast/intent passou isolado em **272633,35ms** no W3; o primeiro caso de quatro admissões Session/MCP passou em **37509,61ms**. O orçamento cooperativo de 300000ms e o timeout Bun de 360000ms do caso combinado permanecem intactos, assim como suas asserções. O controle U20 havia passado em 234691,80ms. A execução W1 anterior conserva sua falha de 300101,81ms e os checkpoints/asserções não concluídos. A comparação de 256 etapas registra lentidão acumulada, sem estabelecer uma causa específica.

A observação cobre stores/sessões, skill load, adaptadores nativos e MCP com ingresso público pré-gravado. Não demonstra execução de modelo/Omni, scanner instalado, medidas humanas ou GNATIVE global.

## Dossiê consumido do responsável

O owner publicou exatamente os dois blobs propostos em `4306b310e4d6dac77f9beab461adad4e8e924849`. Os novos testes próprios preservam os 3 formatos documentais reais e os 8 casos browser; adicionam 2 interleavings reais de mudança de fonte/revogação e asserções visíveis de comparação, termos, escolha humana, rejeitado e próximos passos. Ainda aguardam Actions. O spec de documentos precisa de nova prova; o PASS browser W2 permanece histórico. O PNG WP06 será produzido pelo novo caso assertivo, não é evidência já obtida.

A inspeção dos imports, factories, HTML e CSP demonstra que estes dois consumidores não entram no caminho do teste nativo de importação. A reutilização W3 fica condicionada à conferência do diff final, conforme `owner-dossier-impact.json`.

## Referências compactas e obrigações

`operations-criteria-evidence-W2-W3.json` contém os 140 IDs com referências deduplicadas às observações e checks. Os textos exatos, critérios, consumidores, tarefas, packs, AMs e limites permanecem em `operations-criteria-140.normalized.json`. O arquivo adicional de 81 testes diferencia 31 testes já selecionados no Bun43, 31 históricos com fechamento de dependências demonstrado, 18 adicionais e 1 consumidor Atlas do owner.

OPS-HOST-01B continua como patch do segundo caminho de business services. OPS-CONSUMER-02 permanece o reparo de fixture Atlas atribuído ao owner. Nenhum desses requisitos é omitido pelo sucesso dos testes de componente. S0 mantém revisão, composição de todos os WPs e epic do bundle final.
