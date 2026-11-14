# COMPOSE6 — revisão de C17 e findings próprios de WP11

## Resultado e limites da revisão

**O finding F1 de COMPOSE5 foi superado no código para o caminho histórico delimitado de C17: cálculo original já capturado pelo Atlas, associado ao ledger de um caso que avançou de versão, com fechamento de evidências somente de registros ainda atuais e replay canônico.** Não se mantém a alegação anterior de que o host só chama readers atuais ou de que o BCS não admite cálculo histórico. Esse resultado é uma revisão estática; não demonstra execução composta, prova nativa, aceitação C/D ou prontidão global.

**Dois defects próprios de WP11 foram confirmados e corrigidos no workspace por delegação explícita do root:** a promoção sem operações pulava a preparação do proof de cobertura e o draft de Hot Topic entregava o snapshot de Planner ao verificador de Dashboard. Os quatro arquivos próprios estão congelados para revisão independente/publicação; não houve teste de produto local, Bun ou execução remota por este agente.

Pins examinados:

| Item | Head / tree |
| --- | --- |
| COMPOSE6 | `35b9fd4f532abeb1058f00281d4ad8885ca9966f` / `051391628c61f6a4333c8f13567c5518c4ff8f86` |
| Pai direto COMPOSE5 | `a1e9eb62aa7fa862322622cc38474ef0ff5a7d09` / `2a61f73fc5bf404501d61f71f552861f5e1338e1` |
| Finance próprio de partida | W18 `92f6d97d2df5ebf53cd845f4cfe93355d10b0f6f` / `a843c5d5767c4a055fcacb77668c3798fd8a564c` |

O commit COMPOSE6 e seu pai/tree foram lidos pelo GitHub MCP. Os dez arquivos do `compose6-manifest.json` foram conferidos por Git blob SHA1 e SHA256; todos correspondem ao manifesto. As cópias extras de suporte foram normalizadas aos bytes exatos retornados pelo MCP antes de fixar seus hashes. Nenhuma fonte de host, contrato, C08 compartilhado ou engine foi editada.

## F1 — caminho histórico efetivamente composto

### 1. Leitores explícitos e vínculo ao ledger

O novo `apps/cli/src/sucafina-product/planner-calculation-history.ts` (`9805676b50cb5d12f37a4a91350f01ba227a168f`) deixa de depender da emissão atual para produzir a resolução histórica. Nas linhas 48–80, restringe o cálculo a `planner:scenario` / `planner-runtime-v1`, registros de origem, Request real, principal não local, caso atual participante e versão do caso posterior à versão produtora. A seleção de evento nasce do ledger persistido e passa por `historicalCalculationMatches`; não aceita um evento fornecido pelo chamador.

Nas linhas 93–99, o produtor canônico recebe `requests.readHistorical(before.selection, trusted)` e `results.readHistoricalCalculation(before.selection, trusted)`. Esses callbacks rejeitam qualquer run diferente do run selecionado. O replay usa `createPlannerCalculationEvidence`, que lê o request realmente persistido, autentica a correspondência request/result/ref e executa o Planner duas vezes. Não há reconstrução de input a partir de um subtotal, cópia de fórmula financeira ou retorno de cálculo simulado como resultado aplicado.

O próprio `historicalCalculationMatches` fixa identidade/incarnação do caso, versão produtora/evento/caso, engine, `runId`, request/result digests, período, moeda, fechamento de fontes e presença do mesmo ref no grafo do ledger. Exige que todas as evidências desse grafo pertençam à instalação/projeto atuais. Esse produtor continua sendo a autoridade da associação; o novo helper host o consome.

### 2. Capture protegido, replay e egress

As linhas 90–115 do helper exigem um capture prévio do Atlas cujo ref e projeção correspondam ao cenário persistido. A projeção conserva os bytes originais; `calculationProjection` compara engine, versão, componentes, período, moeda, input/result digests, JSON completo do cenário, subtotal e total, inclusive `null`. O resultado tem `state: historical`, conserva `currentRef` igual ao ref original e declara a diferença de `case.version`; não o reclassifica como fresh.

O capture reader canônico do Atlas (`atlas-memory.ts`, blob `91e8bc8f5d80f83b7756b4647c790cc5e5936d59`, linhas 32–73) reautoriza o caso atual, a partição e o capture ligado a envelope/log durável; compara os digests de capture e envelope. O `business-services.ts` novo evita reabrir `cases.read` ao localizar captures, pois esse read poderia resolver recursivamente o mesmo C17 (linhas 378–400).

O helper tira snapshots em C08 `cases` e `preferences` antes/depois. O fence inclui caso/ledger, resultado, request persistido, seleção, Atlas, source fences, binding, ref selecionado e dia UTC. `withCalculationCase` retém a seleção exata até o callback final de egress, revalida Request/binding/membership e libera o retainer em `finally`. O helper relê o capture após replay e novamente no egress e compara o fence integral. O resultado histórico é somente de leitura: o request store local nega producer writes, seu verificador de write é falso, e não há append ao Atlas neste caminho.

### 3. BCS e Atlas não dependem mais da elegibilidade atual

Em `product/host-binding/business-context.ts` (`5cca27ce239c92a8e3c9f9f92f816f5224562904`), `sameHistoricalSource` agora aceita apenas a igualdade integral de refs de cálculo (linha 156). O resolver tenta o caminho atual; se não for fresh, tenta o callback histórico (linhas 339–346). A continuidade histórica faz duas resoluções completas e compara ref, projeção e diferenças com Request/binding/autoridade atuais (linhas 348–360). O BCS ainda exige projeção, currentRef, diferenças e continuidade para admitir `historical`.

O `atlas-recall-scope.ts` de COMPOSE5 continua exigindo mesma versão produtora para sua otimização atual. Isso já não constitui o bloqueio genérico antigo: quando a elegibilidade não existe, seu fallback executa o recall canônico, cujo BCS agora possui o caminho histórico. O recall canônico do Atlas compara o capture original e admite resolução histórica com diferenças explícitas. Não houve relaxamento da elegibilidade da otimização para tratar ref antigo como atual.

### 4. Readers atuais e isolamento de chamadas preservados

`planner-calculation-services.ts` (`bc224c0b2830fe54a02c3b2bc356cb6bf2b1c327`) mantém `requests.read`, `results.readForCalculation`, `issue` e `resolveEvidence` atuais (linhas 81–112, 120–135, 159–205). O histórico é um callback separado `resolveHistoricalEvidence`, ligado internamente pelo host. O wrapper não registra um request novo nem emite um grant durável.

F2, o antigo finding de guarda global compartilhada entre chamadas, permanece superado. As guardas de replay atuais e históricas usam `AsyncLocalStorage`, limitam ancestralidade à mesma invocação/contexto/Request/binding e fecham seu escopo em `finally`; mantêm recusa de ciclo e profundidade 16. O Map do BCS é local a uma chamada de `context`; não é cache de autorização entre chamadas. A otimização de recall conserva seu proof somente dentro do recall autenticado e cercado por estado/fontes/dia.

## Limites que continuam pendentes

| Limite | Consequência precisa |
| --- | --- |
| Capture prévio obrigatório | Um primeiro append do Atlas somente depois do avanço do caso, sem capture protegido anterior, permanece indisponível. Não há capture inventado. |
| Fechamento histórico só de records | Cálculo histórico aninhado/misto, assumptions e replacement refs não são cobertos pelo novo helper. O caminho atual aninhado permanece separado. Operações diretas sem replacement podem chegar ao replay record-only; sua admissibilidade depende do produtor canônico. |
| Origem precisa continuar fresh | Alteração material da fonte original torna o histórico indisponível; não se recalcula usando os bytes capturados como uma fonte atual. |
| Dependências próprias ainda são pins distintos | COMPOSE6 contém result/request stores anteriores às cercas finais adicionais de W18. A API é compatível na inspeção, mas o candidato com W18 deve ser composto e validado nos SHAs reais. |
| Prova de runtime não executada aqui | Reabertura SQLite/Atlas, versão v→v+1, recusa sem ledger/capture, revogação durante replay, abort/lease, source drift e concorrência precisam dos testes compostos no candidato. |
| Nativa / C / D / bundle | Permanecem de S0/integração; nenhum PASS de outra seleção ou hash foi transferido. |

As seleções cirúrgicas propostas pelo owner de integração são `test/product/wp10/integration/planner-calculation.test.ts`, `calculation-ancestry-composition.test.ts` e `calculation-case-scope.test.ts`. A receipt COMPOSE6 declara `NOT_RUN`; esta revisão não muda esse estado. O novo caminho chama replay várias vezes na resolução/continuidade/recall; esta revisão constata a composição desses callbacks, sem medir seu custo ou alterar seus limites de tempo.

## WP11 — promoção sem operações

O owner finding `ASTRA-WP10-PROMOTION-PROOF-01` aponta `mutations.addAlternative`, **não** `analysis-promotion.ts`. O caminho causal foi confirmado nas fontes atuais:

1. `planner/scenario-port.ts` 107–118 retorna o assessment original em um cenário sem operações/assumptions.
2. O ramo antigo de `mutations.ts` 111–114 pulava `coverageEvidence.entries` quando esse assessment coincidia.
3. O consumidor canônico `portfolio-coverage.ts` (`d8a668281ea9cac6a3a04c6bea19811ee8954808`) apaga proof no `remember`, prepara `proofs.set` exclusivamente em `entries`, exige esse proof no `resolve` e compara o resultado completo no `verifySnapshot`.
4. `saveCase` chama o source fence sempre que o provider existe. Sem preparação, o commit é recusado. Apenas disparar `entries` também é insuficiente: a ordem dos `evaluatedSourceRefs` pode mudar de source-first para basis-first no reassessment canônico, fazendo o digest integral diferir.

O delta sempre chama `entries` quando há provider e sempre usa `reassessScenarioCoverage` com suas entries/resolver/supports. Mantém o fallback existente sem provider para assessment coincidente, `validateScenarioCoverage`, recusa de resultado complete sem source fence, intent, CAS, idempotência e o verificador de snapshot. Nenhuma fórmula ou autorização foi reproduzida. O provider é consumido, não substituído.

A receipt de integração relata HTTP409 em sete testes BI do run `43584781236`, sem body/reason no log. Este agente verificou a causa estática e a receipt; não releu esse run. `case-changed` continua sendo inferência de fonte, não uma mensagem observada por este agente. O novo delta não promove um cenário hipotético de `total: null` para total completo; portanto não se atribui a ele a correção automática de outra falha de ChoiceRecord/BI que espere total completo.

## WP11 — snapshot do draft de Hot Topic

`hot-topic-draft.ts.valid` só admite target `dashboard` / `hotTopics`. A transação usava `domainSurface: planner`, e C08 passa ao work o snapshot da superfície indicada. O consumidor real `dashboard-decisions.ts` (`f8914c141ba5c72439f5fdba50e9153c4cd477d4`), linhas 89–93, verifica `dashboardSourceCurrent(snapshot, draft.target, ...)` e todos os refs de Dashboard. A combinação recusava o draft legítimo quando recebia Planner.

O delta altera somente a superfície para `dashboard`. Continua exigindo grant humano, current case, source verification, C08 preferences/cases CAS, metadata writer permitido, snapshot proof e leitura de confirmação. É correção de indisponibilidade por recusa conservadora; não se afirma bypass de acesso. O C08 real fornece `currentSnapshots` também na transação Dashboard; não foi necessário editar o store.

## Arquivos próprios congelados e regressões

| Delta | Arquivo | Git blob |
| --- | --- | --- |
| No-op | `product/decisions/mutations.ts` | `3e7575cddfd52d9f5751c0ee6179c747bb318c98` |
| No-op | `test/product/wp11/source-promotion-coverage.test.ts` | `1c2d45332907483ec7c816ebdc64ea81ee8b215e` |
| Hot Topic | `product/decisions/hot-topic-draft.ts` | `5e0b80a470958dd201db4283bde96d594935e68d` |
| Hot Topic | `test/product/wp11/hot-topic-draft-domain.test.ts` | `d75d700de4a9a607550691382dc0e14237c289a0` |

Os testes novos de no-op cobrem duas promoções reais de source observations com ordem oposta das fontes, persistência de alternative/result, replay idempotente, ausência de ChoiceRecord/aplicação, cenário alterado mantendo total hipotético `null`, e recusas por entries indisponíveis, alteração real da fonte, CAS concorrente do caso, revogação e abort. O teste de Hot Topic usa conteúdos distintos em Dashboard/Planner para discriminar o snapshot recebido, verifica grant negado, commit/replay único e source race sem escrita parcial de draft/caso.

Esses testes usam Planner, classificação/reassessment de cobertura, C08 e local-store reais. Os grants humanos e os callbacks de proof/source são fronteiras sintéticas declaradas; não demonstram o produtor de autorização instalado nem os consumidores BI/Atlas/HTTP reais. Foram criados com limite de 60000ms por caso, sem alterar assertion ou timeout de teste existente. **Status: authored, static review requested, NOT_RUN.** Root executa typecheck/guards e seleções Actions pelo protocolo CI, publica os commits e entrega seus pins à integração.

O manifesto `late-own-deltas-manifest.json` registra SHA256, bytes e os dois deltas separadamente. Esta revisão preserva os findings superados como histórico e mantém os limites de composição/prova listados acima; não declara READY ou DONE.
