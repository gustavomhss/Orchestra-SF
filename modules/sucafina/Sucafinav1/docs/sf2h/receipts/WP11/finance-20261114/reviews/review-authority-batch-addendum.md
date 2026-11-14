# Adendo independente — batch Planner W15

## Escopo e conclusão

Revisão somente leitura dos três deltas de produto e dos dois arquivos de teste capturados para **W15 `61d92392e9bded167eb2794995a623b2719cc4ba`**, tree **`ffb3cd9e1ee689732cbae33658506c628539d032`**. Não foi identificado novo bloqueador concreto no delta de produto examinado. Esta é uma conclusão estática delimitada; não declara prontidão global ou encerramento dos timeouts.

Captura: `/workspace/scratch/a97ca4c53050/finance-W15-changes.json`. Seus cinco conteúdos foram conferidos pelo hash Git de blob; SHA256 e linhas estão no JSON associado. Nenhum produto, teste, typecheck ou CI foi executado por este revisor.

| Arquivo publicado | Blob Git verificado |
| --- | --- |
| `modules/sucafina/Sucafinav1/product/planner/stored-scenarios.ts` | `fca509789efd2bf1b7d9453d09a3a460ee778feb` |
| `modules/sucafina/Sucafinav1/product/planner/scenario-comparison-port.ts` | `1782c2094239c3712d3a895a6a25f4160fb429c7` |
| `modules/sucafina/Sucafinav1/product/planner/sensitivity-units.ts` | `1673c86995cf71b61e288d91492ae7b691934171` |
| `modules/sucafina/Sucafinav1/test/product/wp11/scenario-batch-fixture.ts` | `76602236238df061e96af1338d05d01799c5ecab` |
| `modules/sucafina/Sucafinav1/test/product/wp11/scenario-batch.test.ts` | `044de4c276dde8850abdacd9c2328c7f2836fdd0` |

## Integridade e autoridade preservadas

- `stored-scenarios.ts:19–30` mantém cada leitura autenticada de resultado, inclusive referências repetidas, e captura cada objeto com clone imediatamente após o await.
- `stored-scenarios.ts:20–24,31,60` usa a caseRef produtora completa como chave local. Os mapas inicial e final são objetos distintos por invocação. Versões produtoras diferentes continuam aceitas em grupos separados. Nenhuma observação ou autorização sobrevive para outra chamada.
- `stored-scenarios.ts:38–50` mantém a seleção de alternativa por digests integrais, a unicidade da base/fonte e cada projeção `compareForecast`. O callback de coverage recebe um clone.
- `stored-scenarios.ts:54–66` completa todos os rereads individuais de resultados antes de iniciar a fase final de casos. O digest integral do caso verifica alterações de ledger, participantes, alternativas e bases; cada retorno é clonado separadamente.
- `scenario-comparison-port.ts:27,48,64,75–84` inicia um batch novo a cada observação, conserva ordem/cardinalidade e recusas, sem tentar fallback depois de uma recusa do batch. O fallback para um host legado continua sequencial e captura cada retorno antes da próxima chamada.
- `sensitivity-units.ts:31–35,45,57–63` mantém os casos externos, resultados e evidências. As duas fases usam dois batches distintos. `preview-comparison.ts` não mudou nesta captura.

## Prova prevista nos testes e seus limites

Os nove testes novos inspecionados cobrem chamadas canônicas, equivalência com fallback, independência de fases e contextos, duplicatas com objetos distintos, casos/versões produtoras diferentes, alterações de ledger/alternativa/base, revogação depois dos rereads, mudança real de fonte Planner, objetos retidos e recusas sem fallback.

A comparação de unidades exige **6 chamadas do case port com batch contra 10 no fallback**, conservando **12 leituras de resultado e 4 forecasts**. Trata-se da fronteira `DecisionCasePort.read`, não da contagem de toda leitura interna de C08. O teste de comparação mantém `conditioned` e `completeDifference: null`; não promove cobertura financeira incompleta a completa.

O fixture usa estado C08, case port, result store, persistência/fonte Planner e primitivas de cálculo reais. A cobertura é fornecida pelo fixture, e o adaptador de evidência valida leituras reais de fonte sem constituir a composição BCS/native. Estes testes não provam dispatch nativo, publicação Atlas, aplicação Choice ou recibo de efeito.

## Correção de admissão do fixture W16

Foi conferido separadamente o blob **`0903057cf81a6c40289544ff6ff6dd40ffee9a36`** em `finance-W16-changes.json`, para `test/product/wp11/scenario-batch-fixture.ts`. Ele difere do W15 somente em duas chamadas:

1. A admissão inicial passa `"finance", true`.
2. O helper de admissão passa `principal, true`.

O parâmetro `true` consome a intenção via validação UI canônica antes de `requestFor`; não cria um stub de autorização. A string `0903057…` é **blob Git do fixture**, não SHA de commit. Não foi fornecido/verificado neste adendo o SHA final de publicação W16. O outro arquivo WP05 contido na captura W16 está fora desta revisão. O delta do fixture não altera os três produtos revisados em W15.

## Evidência ainda necessária

- Execução Actions do fixture corrigido, vinculada ao commit publicado.
- Execução relevante que encerre os quatro timeouts S4; a redução estrutural de leituras não prova desempenho suficiente.
- Revisão própria do delta de aplicação PR40 quando a união da segunda consulta de recibo estiver congelada.

A revisão histórica C17 do COMPOSE5 está em relatório separado. Não houve edição de produto, contrato, host ou shared store por este revisor.
