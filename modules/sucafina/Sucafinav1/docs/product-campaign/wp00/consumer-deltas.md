# WP00 — integração pendente dos consumidores

## Execução posterior com verificações independentes

[Run 43538370444](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43538370444), produto `d456bdd9cb4c8d921648b8c885d49cf71e592402`, snapshot `8e85876ff0243dbfd83782e7014b16672f9426ca`: **44 PASS / 16 FAIL em 60 testes**, quatro arquivos e 125 assertions. O [recibo individual](../../sf2h/receipts/WP00/consumer-coverage-observations.json) conserva todos os nomes e resultados. A presença de cada um dos 39 exports agora é verificada separadamente: 33 presentes, seis funções C07 ausentes. Isso não significa que 33 operações foram invocadas.

Os seis fences aditivos também executaram independentemente. `decisionResults` e `nativeRuns` passaram; `claimBindings`, `commandProposals`, `compositeScenarios` e `biArtifacts` falharam. Migração/retry, stale-read, autorização de leitura e leitura negada capturam callbacks, versões e estado antes da assertion agregada. A contagem maior de falhas discrimina lacunas antes encobertas pelo primeiro erro; não demonstra 16 regressões novas. C15, namespace BI e demais invariantes continuam gates positivos, sem skip ou expected failure. As fontes e o patch abaixo permanecem propostas de integração para os owners.

## Inventário de fontes e deltas

Estado: `BLOCKED` no candidato derivado do seed `7631b186e4249abd0fc24c7d10beb62355db3f3b`. A revisão 7 dos contratos não declara aceite do produto. As observações abaixo são leitura de fontes públicas pelo GitHub MCP; resultados de execução pertencem aos recibos de CI da entrega, não a este inventário estático.

O contrato congelado pode ser consumido pelas frentes. Para afirmar que os consumidores do candidato o satisfazem, o integrador precisa reconciliar os deltas dos owners e executar as assertions positivas de `test/product/wp00/contract-consumers.test.ts` sobre a árvore composta. Este WP não edita `product/host-binding`, `product/ai` ou `product/routines`.

## C08 — doze namespaces e campos aditivos

No [provider do seed](https://github.com/gustavomhss/Orchestra-SF/blob/7631b186e4249abd0fc24c7d10beb62355db3f3b/modules/sucafina/Sucafinav1/product/host-binding/state-provider.ts), `namespaces` contém onze entradas, `emptySfState` não cria a versão `bi-artifacts` e `readSfState` exige exatamente onze. `checkNamespaces` não é utilizado. Os fences de callback não cobrem `claimBindings`, `commandProposals`, `compositeScenarios` e `biArtifacts`. O contrato `state.ts` já exige a nova versão e declara essas estruturas, portanto a divergência existe antes das alterações desta PR.

O produtor atual já publicou uma implementação candidata: [`sf2-host-ready` em `dc6bf9e4e8f3d2fa01d01c76d5575892a8ced82f`](https://github.com/gustavomhss/Orchestra-SF/blob/dc6bf9e4e8f3d2fa01d01c76d5575892a8ced82f/modules/sucafina/Sucafinav1/product/host-binding/state-provider.ts), blob `e899bc20f0e4661851a1a6ab9fc3bd31774b0622`. Ela inclui o namespace/migração BI, `checkNamespaces` com autorização de leitura e CAS, `sourceFence`, e os fences dos campos aditivos. Isso demonstra disponibilidade de fonte candidata, sem atribuir a ela um CI nem afirmar que foi integrada aqui.

Delta a WP10.T01/S0:

1. Reconciliar o provider publicado com o `state.ts` do candidato composto; não substituir `host-context.ts` ou `runtime.ts` por snapshots históricos.
2. Consumir `state-layout.ts` ou manter os mesmos campos/namespaces de forma exaustiva. Os metadados de provider permanecem fora do callback autorizado; inicialização/migração não cria outro store.
3. Manter migração aditiva v1 em staging, preservação de dados/incarnação e leitura/preview sem efeito. Retry exato recupera o recibo, sem segunda migração/efeito.
4. Exigir read authority e CAS de cada `checkNamespaces`, sem incrementar a revisão consultada; guardar a distinção entre fences de leitura e de escrita.
5. Executar os testes positivos de C08 adicionados por WP00, mais a seleção WP10 pertinente. A existência de código remoto não fecha nenhuma dessas assertions.

## C15/C11 — AlternativeDraft e bytes distribuídos

O [manifesto do seed](https://github.com/gustavomhss/Orchestra-SF/blob/7631b186e4249abd0fc24c7d10beb62355db3f3b/modules/sucafina/Sucafinav1/product/ai/manifests/resident.json) não declara `AlternativeDraft` no perfil `sf_portfolio` ou na skill `sf-compor-portfolio`. O contrato normativo do mesmo seed já o inclui. [`createResidentAiBundle`](https://github.com/gustavomhss/Orchestra-SF/blob/7631b186e4249abd0fc24c7d10beb62355db3f3b/modules/sucafina/Sucafinav1/product/ai/resident.ts) compara a política e recusa o perfil divergente. Recalcular apenas o freeze não conserta esse consumidor.

O produtor [`sf2-ai-ready` em `574841e2409a9523000c4c1976c81804c9a86fde`](https://github.com/gustavomhss/Orchestra-SF/commit/574841e2409a9523000c4c1976c81804c9a86fde) publicou os três arquivos reconciliados:

| Arquivo relativo a `product/ai/` | Blob publicado |
| --- | --- |
| `profiles/sf_portfolio.json` | `744918076fa510339a3216487da8f59b06fe45e8` |
| `skills/sf-compor-portfolio/SKILL.md` | `255226879e40d87bfba55a644b67fd7bc7371115` |
| `manifests/resident.json` | `453c6f3a5b48c081223909af8293f854ad31d7c8` |

A fonte da skill condiciona `AlternativeDraft` ao retorno real de `sf_alternative_draft`, preserva `domainApplied: false` e confirmação humana separada. O manifesto atual identifica SHA-256 `249ec91f7d1a76fef83c4408795b66953589d3b3f45e91c64ca691c60c8c2b83` para os bytes do perfil, `8910dd159591b5849f60a734ed27549e57ec3de6d05c125b004202c217166642` para os bytes da skill e `0f6f8d575fd60b062fe2b700cde10fadd9e93bcb47409a0b8b362f028629cd07` para as instruções parseadas. Esses digests não são SkillLoadReceipt.

Delta a WP12.T01/T02/S0: integrar os três arquivos como um conjunto, conferir os bytes com o loader real e executar a assertion de bundle 5/18. Não remover `AlternativeDraft` do contrato, não substituir os hashes por placeholders e não declarar carga nativa a partir da validação do catálogo.

## C16/C07 — produtores ausentes do candidato

O inventário Git da árvore do seed contém onze dos doze paths distintos de `freeze.operations.handlerPath`; `product/routines/capabilities.ts` está ausente. As seis operações de rotina continuam no contrato e na matriz 39/39. Seu produtor é WP09, com transporte e autoridade WP10. A assertion positiva de exports em `contract-consumers.test.ts` exige esse path e seus exports reais; não há stub, remoção de operações nem catálogo executável fabricado nesta PR.

O produtor remoto atual [`sf2-relay-ready` em `b58601f92f3bc8742e5a7c72a34d5ddf1fd87fe8`](https://github.com/gustavomhss/Orchestra-SF/blob/b58601f92f3bc8742e5a7c72a34d5ddf1fd87fe8/modules/sucafina/Sucafinav1/product/routines/capabilities.ts) contém o blob `8f07a33f0f40d66946724232935c8a9d6729d6bb`, com `readRoutineCatalog`, `prepareRoutine`, `runAdmittedRoutine`, `readRoutineStatus`, `readRoutineResult`, `prepareWatch` e `createRoutineCapabilities`. S0/WP09 devem integrar esse produtor junto às dependências da sua factory; copiar somente os seis exports ou o catálogo não cria admissão C07 nem prova AM06.

O congelamento dos oito packs é permitido antes da implementação posterior. GNATIVE e AM06 continuam exigindo as cadeias nativas descritas pelo pack; uma verificação de exports não as substitui. A fonte atual de rotinas, composição nativa e seus bloqueios são tratados no recibo WP00.T04 da entrega.

## Patch candidato e prova de consumo

[`consumer-deltas.patch`](consumer-deltas.patch) contém somente os quatro deltas dos produtores citados: um provider C08 e os três assets WP12. Foi preparado comparando os bytes do seed com esses pins; **não foi aplicado** aos arquivos dos owners. Ele preserva alterações aditivas presentes no provider atual, inclusive fences adicionais de metadados. S0 deve reconciliar contra os heads observados no momento de integrar; não aplicar um arquivo inteiro sem conferir a divergência.

`contract-freeze.test.ts` é um gate de definição: hashes dos contratos, C01–C17, 5/18/8/39/6, schemas, interseção de concessões e ownership declarativo. `contract-consumers.test.ts` é um gate distinto: asserts positivos de produtores presentes, loader real compatível, migração/CAS e isolamento C08. Seus resultados não são intercambiáveis. Testes de estado usam o fixture sintético `testPersistence` existente, sem alegar durabilidade de produção, modelos reais, scanner real ou autorização empresarial.

Depois da integração, repetir somente a seleção afetada no SHA composto e vincular o resultado aos recibos de WP00/WP10/WP12. Até esse ponto, os critérios de confirmação de consumidores e as provas nativas permanecem abertos.
