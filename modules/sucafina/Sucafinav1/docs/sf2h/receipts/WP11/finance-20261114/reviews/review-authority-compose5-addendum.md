# Adendo independente — autoridade C17 no COMPOSE5

## Pin, escopo e conclusão

Fontes exatas do commit **`a1e9eb62aa7fa862322622cc38474ef0ff5a7d09`**, hidratadas em `/workspace/scratch/a97ca4c53050/foreign-intake/COMPOSE5`. Manifesto: `/workspace/scratch/a97ca4c53050/compose5-manifest.json`. Foram conferidos blob Git e SHA256 dos quatro arquivos abaixo. Este adendo reconcilia os achados externos anteriores contra o código atual; não declara aprovação global do COMPOSE5.

**F1 permanece aberto na integração histórica C17. F2, referente ao Map global de replay, está superado neste pin por inspeção estática do ALS.** Não foram executados testes, typecheck, produto ou CI pelo revisor.

| Fonte de autoridade revisada | Blob Git verificado |
| --- | --- |
| `apps/cli/src/sucafina-product/business-services.ts` | `4b96a408bd43e73a6e614977f959b6f58f9559e0` |
| `apps/cli/src/sucafina-product/planner-calculation-services.ts` | `6678372b0c955d551e9910060e405a6765c79ccd` |
| `modules/sucafina/Sucafinav1/product/host-binding/business-context.ts` | `5f9a4761693beaf2fc0830d03ea8a2421de7f794` |
| `modules/sucafina/Sucafinav1/product/host-binding/atlas-recall-scope.ts` | `30697fcbeee6b7011cc7786a0a3bc64bd0d3449e` |

## F1 — P1: continuidade histórica C17 ainda não composta

### Traço concreto

1. Um cenário canônico persistido pertence ao caso de incarnation `I`, versão produtora `v`. Seu C17 exato integra um evento de ledger aceito, e o mesmo caso avança para `v+1`.
2. `planner-calculation-services.ts:78–104,116–128,155–168,194–201` continua chamando `requests.read` e `results.readForCalculation`, as rotas correntes. Não seleciona as APIs explícitas `readHistorical`/`readHistoricalCalculation`; a versão produtora anterior é recusada por esses leitores correntes.
3. O novo `atlas-recall-scope.ts:153–163` exige que `request.caseRef` e `stored.caseRef` coincidam integralmente com o caso selecionado atual. O cenário `v`/`v+1` não é elegível. Em `:113–128`, a ausência de elegibilidade preserva o caminho original de recall. Portanto o helper novo não resolve esse traço histórico.
4. O terceiro gate também permanece: `business-context.ts:80–84` requer `sameHistoricalSource` e prova de continuidade para uma resolução `historical`. `:150–156` possui ramos para record, document, receipt e case-event, mas não para calculation. Mesmo uma futura resolução histórica do host seria recusada aí até que esse contrato fosse composto.

O efeito é indisponibilidade de evidência de cálculo histórica para um participante ainda autorizado depois da aceitação da análise ou outro incremento legítimo de versão. Não foi identificado nesse traço acesso indevido ou sucesso financeiro falso. A demonstração é por execução lógica dos ramos publicados, sem alegação de prova nativa executada.

### Correção delimitada e gates

A correção depende de uma rota histórica explícita no host, selecionada por associação exata a um membro de ledger persistido e sob autorização atual. Ela deve manter origem canônica, request/result/reference integrais, mesma identidade e incarnation do caso, horizonte admissível, replay de fontes e as APIs próprias `result-store.readHistoricalCalculation` e `scenario-request-store.readHistorical`. O ramo de continuidade C17 do BCS deve ser especificado e validado separadamente.

Os leitores públicos normais devem continuar **current-only**. Não é uma correção válida relaxar sua comparação de versão, transformar a referência antiga em `fresh` por conveniência ou fabricar projeções históricas. Host/BCS pertencem a outra sessão; este relatório só delimita a proposta externa.

É necessária prova composta em Actions com cálculo real persistido, evento real de ledger, incremento de versão e resolução/recall histórico. Contraprovas devem cobrir ausência de associação ao ledger, referência/request/result alterados, outra incarnation ou horizonte, revogação, mudança de fonte e continuidade ausente/revogada, conservando a recusa do leitor normal para versões produtoras antigas.

## F2 — P2 anterior: Map global superado

`planner-calculation-services.ts:116–131` agora usa AsyncLocalStorage. A herança de ancestrais exige escopo aberto, o mesmo objeto de contexto, a mesma Request e o mesmo digest de binding. Cada chamada cria um Set novo; repetição na própria cadeia e profundidade de 16 continuam limitadas. O finally encerra o escopo. Chamadas raiz independentes não compartilham o antigo Map de runs por binding.

Assim, o achado anterior sobre o Map global não deve ser repetido contra este pin. Esta é comprovação de fonte; não foi observado neste adendo recibo de execução concorrente do wrapper COMPOSE5. O guard separado de reutilização em Atlas não é o antigo Map de replay.

## Fatos atuais e limites

- A composição nested C17 existe. Não cabe repetir a alegação antiga de que o host só suporta records.
- A continuidade histórica de records Planner está presente; ela é distinta da continuidade de calculations.
- O helper Atlas reutiliza uma prova concluída dentro de um recall autenticado, com elegibilidade restrita à versão exata selecionada, fences de estado/fontes/dia e verificação final de saída. Ele não chama as APIs históricas próprias.
- As APIs históricas próprias foram revisadas no snapshot W10 `660db9a46e4c1d7ff87c23f6bb37f451cc703ccb`/tree `bbc79890ba339e0fca0fb34f55bd4d1c69a7953e`; sua existência não equivale à composição host/BCS completa.
- As demais mudanças BI/portfolio do COMPOSE5 não integram esta revisão de autoridade.
- Resultado financeiramente completo, ChoiceRecord aceito, efeito aplicado e recibo autoritativo são fronteiras de prova distintas. Nenhuma foi promovida por inferência a partir de callbacks sintéticos.

Nenhum arquivo de produto, host, contrato ou shared store foi modificado por este revisor.
