# C17 — revisão da fronteira de leitura durante publicação

Data: 2026-11-20 UTC.

**Decisão: suspender a implementação do decorator READ irrestrito.** Este documento registra uma análise estática, não um teste executado nem uma qualificação de prazo. Nenhum produto, teste, fixture, timeout, fila SQLite, workflow ou grant foi alterado para esta revisão.

## Base e evidência

- Base de produto: `1542afe3a79550d6f3002eff8dcdbc442c981a79`, árvore `06d5a4e4afb84aa4e2f4fd0e6e8e19f2447e1841`.
- Diagnóstico síncrono: run `44679705156`, job `136099896762`, snapshot `71e6d4567616a7e38e59fb53ecd3d3a4974994f0`, produto instrumentado `76623a1f53f8353b928e98cbc49f0c0bce028ca7`.
- Resultado: **0 pass / 1 fail / 2 expects**, prazo cooperativo original de `105000 ms`; não houve qualificação verde de C17.
- JSON completo verificado contra o log: commit `8ae2c4e48f373712d6b7cdc4004a6876b6367cbf`, `docs/handoff/evidence/c17-synchronous-44679705156.json`, blob `f273058b6025e064f6f60f43d9e33b29a022a14b`.
- Esse diagnóstico contém 24 registros numéricos, seis marcos do caso original, duas contagens de leituras e 29.190.800 leituras do relógio pelos probes. A instrumentação não faz parte da candidata de produto.

Os spans internos completos observados na primeira publicação externa foram:

| Fase | Duração inclusiva | Conexões SQLite | Limite da interpretação |
| --- | ---: | ---: | --- |
| `publish.replay` | 3429.850 ms | 5381 | Replay original anterior à captura de publicação. |
| `publish.persist` | 16250.525 ms | 24087 | Inclui validações de leitura e a gravação; não é uma região inteiramente readonly. |
| `publish.register` | 26671.245 ms | 37238 | Inclui escrita do request e verificação posterior; não pode receber uma raiz readonly inteira. |
| Primeiro `mixed.produce` | 43561.955 ms | 1 | Completou dentro de uma raiz; 102 joins e um egress aceito. |

No último span, `canonical.digest` acumulou 19045.196 ms e `currentSnapshots` 10804.922 ms. `snapshot.materialize` acumulou 11866.199 ms, com sobreposição com as cópias de snapshots; `canonical.bytes` também está incluído no digest. Os custos não devem ser somados como componentes exclusivos. `root.live` (55.328 ms) e `sameOwner` (177.827 ms) não explicam, por si, a duração de 43,56 s.

Esses números motivaram examinar a reprodução de leitura anterior às escritas. Não provam que uma nova raiz fecharia o prazo, que os callbacks são independentes, nem que os custos do perfil antigo de 094d se repetem nesta base.

## Fronteira candidata examinada

O desenho considerado era decorar apenas as chamadas originais de `simulateScenario`, com um dono comum anterior ao `Promise.all` do produtor. Não seria correto envolver `persist` ou `register` inteiros.

| Ponto na base 1542 | Comportamento real | Tratamento que seria necessário |
| --- | --- | --- |
| `apps/cli/src/sucafina-product/planner-calculation-services.ts:284–294` | Clona o input, lê source fences em :288, reproduz em :290 e só então instala `captures` em :294. | Uma reprodução por fase, com identidade de Request/call/input preservada; sem deslocar ou renovar silenciosamente os fences capturados. |
| `planner-calculation-services.ts:296` | Passa `input.replayScenario` a `input.persist` como `comparisonReplay.simulateScenario`. | Decorar essa função preservaria os dois replays reais de validação. |
| `modules/sucafina/Sucafinav1/product/planner/persistence.ts:37–54` | `validate` reproduz em :38, confirma o caso em :41–43; :46 valida antes, :50 escreve, :52 valida depois. | Cada reprodução poderia ter uma fase separada; a escrita e o CAS permaneceriam fora. Nenhuma prova atravessaria a escrita. |
| `modules/sucafina/Sucafinav1/product/decisions/scenario-request-store.ts:75–100` | Autoriza o produtor e o caso, escreve o request em :98 e executa o `readRequest` completo em :100. | Não está integralmente coberto pelo decorator de replay e não é seguro rotular todo o span como leitura. |
| `modules/sucafina/Sucafinav1/product/planner/scenario-port.ts:50–52,104` | Resolve as evidências reais com `Promise.all`, tanto na admissão quanto no egress. | Os irmãos do mesmo replay precisariam compartilhar o mesmo dono físico; raízes independentes por BCS não preservam esse contrato. |

Um frame de publicação teria de ser distinto de um frame de cálculo persistido: caso real, Request exato, fingerprint, binding, lifetime e conjunto de ancestrais reais, **sem runId inventado**. Os filhos continuariam a executar seus selectors, loaders, replays e fences originais e a ingressar no protocolo de join.

Não se pode reutilizar `createSfPlannerCalculationReadScope.open` fingindo que o resultado ainda não gravado já existe. `planner-calculation-read-scope.ts:54–57,73–77` exige resultado e request persistidos; :104–115 observa exatamente dois retornos de cada loader canônico. Um witness de fase teria de ser separado e observar o caso real, C08 completo, fontes, ambiente, autoridade e input atual. Nada disso, sozinho, prova a independência de callbacks opacos.

Outra ressalva de ordem: o source fence da publicação já é capturado em `planner-calculation-services.ts:288`, antes do primeiro replay. Um aquecimento acrescentado somente dentro do replay pode materializar metadata depois desse fence. Não é permitido atualizar a captura para fazer um positivo passar, nem declarar que um baseline posterior substitui o fence original de registro.

## Contraprova estática: duas publicações coordenadas

O owner comum resolve a concorrência dos irmãos **dentro de uma invocação**. Ele não demonstra segurança para duas publicações independentes, A e B, que usam o mesmo store e callbacks de cobertura coordenados.

O contrato atual aceita funções assíncronas de cobertura cujo comportamento depende de um fechamento mutável. A identidade da função não prova pureza, ausência de escrita ou independência de outra invocação. Há um exemplo real dessa forma de callback em `calculation-case-scope.test.ts:44–59,227–231`: o wrapper permanece o mesmo e delega a `control.coverage`, que pode esperar entradas de dois replays. Esse teste qualifica emissão concorrente de cálculos; não foi executado aqui como teste de duas publicações.

Se cada reprodução de publicação passar a abrir uma raiz física, a seguinte dependência é possível:

| Passo | Publicação A | Publicação B |
| --- | --- | --- |
| 1 | Obtém a raiz readonly e entra na cobertura real. | Foi iniciada com seu próprio call/Request real; prepara seu replay. |
| 2 | A cobertura espera uma entrada ou um efeito da cobertura de B. | Tenta abrir sua raiz de leitura física. |
| 3 | Mantém a raiz aberta enquanto aguarda B. | Aguarda a fila que só progride quando A encerra a raiz. |

`runtime/local-store.ts:226` abre `readSnapshotRoot` por `operation(true)`. Em `operation`, :169–175 conserva a fila do writer anterior e :179 executa `BEGIN IMMEDIATE`. Logo o novo lock pode impedir B de alcançar o callback do qual A depende. Admissão e aquecimento prévios não provam que a próxima execução do mesmo callback terá comportamento independente.

A contraprova não exige compartilhar uma lease ou fabricar aprovação. Pode usar dois calls/Requests admitidos independentemente. Mesmo no caso de um único call, `captures.has(call)` em `planner-calculation-services.ts:286` não exclui o primeiro replay concorrente: a entrada só é instalada em :294, depois de :290. `product/planner/capabilities.ts:26–49` chama o replay e depois a persistência; não fornece ali um mutex de publicação.

O argumento prova uma lacuna do desenho proposto: **não foi observado um deadlock no produto atual neste trabalho**. Também não afirma que duas publicações sempre terminam ambas com sucesso; as regras originais de escrita, idempotência, source fence e CAS continuam decidindo seus resultados. A propriedade relevante é que o novo lock pode impedir o progresso dos callbacks antes de essas regras produzirem o resultado original.

## Limites que o desenho não pode contornar

1. Um token privado do callsite ou uma identidade estável de método distingue proveniência, mas não certifica pureza ou independência do callback.
2. Unir publicações independentes por WeakMap de call, Request, binding ou source ref emprestaria ownership entre invocações. Não é equivalente ao owner lexical do mesmo replay.
3. Uma raiz estrangeira existente deve conservar sua rota original, sem aquecimento ou traversal de admissão novo. Raiz própria inválida, encerrada ou envenenada deve recusar, sem retry externo.
4. A forma do grafo local pode determinar `unsupported` antes da raiz; falha, throw, revogação, drift ou poison não podem ser convertidos em fallback autorizado.
5. Os callbacks, loaders, replays, reautorizações, clones de egress e checks de resultado continuam necessários. Nenhuma observação de preparação é um grant.
6. O issue público record-only e seus controles reais de concorrência não podem ser alterados para justificar a otimização de publicação.
7. A fila, `BEGIN IMMEDIATE`, o lifecycle das conexões e o comportamento de writes não serão modificados neste WP para acomodar o decorator. Não há autorização para pooling global.

## Decisão e próximo trabalho

O decorator READ comum fica **suspenso como rota de implementação**. O desenho mecânico de uma fase com witness próprio não fecha a contraprova de concorrência externa, e este documento não propõe que um callback seja marcado como puro por conveniência.

A análise seguinte é uma projeção física fresca de dados de autoridade consumidos dentro de uma raiz readonly já existente, com proveniência canônica e fallback íntegro. Essa alternativa deve ser revisada por concorrência, abort, owner, reautorização, getters e isolamento das cópias; ela não está implementada nem aprovada por este documento. Não se cria outra raiz, cache de grants, compartilhamento de snapshots mutáveis ou dispensa de callback.

Não houve novo run para esta revisão. C17 permanece vermelho. Os dois diagnósticos anteriores não autorizam ampliar `105000/120000`, remover asserções ou declarar os passos de reopen/cycle/revocation concluídos.

## Blobs consultados na base 1542

| Arquivo | Blob |
| --- | --- |
| `apps/cli/src/sucafina-product/planner-calculation-services.ts` | `c6df413eda5cd650fad8c9034c18a2d5979fbd21` |
| `apps/cli/src/sucafina-product/planner-calculation-root.ts` | `62f21082b6a133750fe2a72dc6604fce08d83556` |
| `apps/cli/src/sucafina-product/planner-calculation-read-scope.ts` | `547cb64992eecf81d8a39735a7eccf53ad69f193` |
| `apps/cli/src/sucafina-product/business-services.ts` | `9fe2765fef426ee6c5eb6b8655734e5701fb63a9` |
| `modules/sucafina/Sucafinav1/product/planner/persistence.ts` | `1d750c4d699eb27acd2b5066d23b66307f5ae931` |
| `modules/sucafina/Sucafinav1/product/planner/scenario-port.ts` | `fc15d2d9130e23d0a290f5a14f61423152d2c72c` |
| `modules/sucafina/Sucafinav1/product/planner/capabilities.ts` | `0947902acfba1b45d7f2950e8aaa64e1c7305f6d` |
| `modules/sucafina/Sucafinav1/product/decisions/scenario-request-store.ts` | `13b41a023714ca58409d8860d1a7851e58ea8e69` |
| `modules/sucafina/Sucafinav1/runtime/local-store.ts` | `83f513c9b9c3c9a7f4497eea80c9e4aa896c9be9` |
| `modules/sucafina/Sucafinav1/test/product/wp10/integration/calculation-case-scope.test.ts` | `bd6fe733ecc35b7e82161c0d3456880c552c4e56` |
