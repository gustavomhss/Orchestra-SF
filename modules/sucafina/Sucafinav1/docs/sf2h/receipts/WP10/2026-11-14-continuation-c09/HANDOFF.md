# WP10 — continuação terminal de W27 a W30

## Estado para retomada

A branch permanece **astra-wp10**, na **PR29**, base **sf2-stack**, aberta e draft. O candidato de produto/testes desta continuação é **W30 `d4fb072fa9bd32ebfef2b9cbc9b27b998d34f4e7`**, tree `8f2cd84288df2a9d70402219df871765fe1890ca`. O commit que acrescenta este handoff contém apenas novos recibos WP10; não muda o candidato nem recibos anteriores.

**C09 → resolver real → contexto/continuidade C17 passou no corte cirúrgico. A jornada X e o gate de UI permanecem HOLD.** Não há aceite global, FINAL W/D ou GLOBAL_RELEASE. Os 171 critérios, sete tasks e 80 obrigações permanecem integrais; os vínculos novos são contribuições parciais, sem substituir a matriz canônica.

Este documento consolida a execução já feita. Não é um segundo planejamento. Antes de escrever, foram reconciliados os handoffs, commits posteriores, runs em voo, diagnósticos e revisões independentes. Nenhuma instância concorrente comprovadamente ativa foi observada; silêncio no Git e término de CI não foram tratados como prova de encerramento da sessão anterior. As atualizações de ref usam `expected_sha` e fast-forward, sem force.

### Identidade dos commits

| Identidade | SHA | Mudança desta continuação |
| --- | --- | --- |
| W27 herdado | `ab8fb4f29d078d179742a77679ef85e5c549b114` | Ponto reconciliado, filho de W26 `a1434e7ea7340aa1d1c8ce6bb48958b724218170`. |
| W28 | `90f2c4f81f74edc26a1783bfda7891638b429fa6` | Intake exato de dois arquivos próprios da PR59; três testes próprios novos; recibos. |
| W29 | `813806af6c2ce74b2a087139c544e90dd1adcbe4` | Corrige tipos e oracle dos dois testes novos; produto e teste C09 inalterados. |
| W30 | `d4fb072fa9bd32ebfef2b9cbc9b27b998d34f4e7` | Corrige seleção do campo Comparison no teste de UI, acrescenta fases e timeouts nativos limitados; mantém as 17 asserções e budget Bun de 30s; novos recibos. |
| Entrega documental | Commit que contém este arquivo | Somente adições de recibos. O SHA exato e o resultado do guard desta entrega estão na PR29. Não é FINAL_D. |

Comparações preservadas: [W28–W29](comparisons/W28-W29.json) e [W29–W30](comparisons/W29-W30.json). Todos os blobs de runtime são idênticos de W28 a W30. Evidências antigas conservam seus W/S originais; identidade de blobs permite aproveitamento limitado, sem apresentar execução antiga como run novo.

### Entradas imutáveis lidas

- AGENTS aplicáveis e workflow/validadores de CI existentes.
- COMMON.md e existing-owner-deltas.json em `30e2215749d5295f81fdeafccb9e69ba21d0cdb8`.
- WP10.pack.json completo em `a3d29d011ba3607a57914701300f09117a3e2de9`.
- PR50 / review-finance `7155f90a6492597a3dd79cfcfda9330fef8be2a2`.
- PR51 / review-contracts `fa520193f5df9d6585d5f4c40d071215efb42923`.
- Plano `dbf9547211d9b0fade619790de7c19c0869b7c7d`; campanha SHA256 `703dd257274bed829a978705de548cd1383225bf7aac76445104c053e2bb5fba`.
- Diagnose-memory PR55 `0d7fb6f12ed053340391ff6e4f95b6f3c1276ea8` e diagnose-calculation PR59 `e80fdc933dfd25956a50c22dea76bf077e79815b`, antes de trabalhar nesses temas.

## FIN-IND-002: contrato instalado reconciliado e prova funcional

A revisão financeira examinou o candidato `4f82cf10ae6766c56e9bf1862fc5198a5246cb5c`, cujo produtor `source-access.ts` tinha blob `3cff741ce7dd96b7fdec8ac803e3b27c6170a463` e contrato `{host,cases}`. A incompatibilidade apontada pertencia a esse contrato.

O produtor canônico **instalado** em W27–W30 tem blob **`41741c5131ea66242c881126c22c6d03cfd9c3c3`** e contrato **`{host,state,authorizeCase,authorizeEvidence}`**. O caller `business-context.ts`, blob `5cca27ce239c92a8e3c9f9f92f816f5224562904`, fornece o contrato atual. Portanto, não se adicionou uma propriedade obsoleta `cases` e não se substituiu o leitor por fixture permissiva.

Proveniência preservada: composição inicial `d02c64430d459d183eeb9e467e1c35d9a6b958f8`, origem do produtor WP14 `02ac8172c17ad57e830bfb23d3ff1d1b1191852b`; composição de validação W13 `f075e9824b7d8aed50b7f42c597528ef198177db` com input PR36 `2fb7e9c792327725384d99d656cc44b232ddc485`; produtor atual proveniente do input PR36 `46c904ead4e9b363422f6739258e492913ae6e2e`. Não se adotou automaticamente o último head de WP14 com diferenças adicionais.

### Resultado observado

[**C28 / 43627315630**](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43627315630), W28 / S `8dedb1fa71a0805505e50eda8c0a038de79276a8`, job `132546009522`: os **dois testes C09 passaram**, em 6577,14ms e 9035,97ms. O run misto inteiro continua FAIL 8/1.

Teste: `test/product/wp10/atlas-business/case-event-continuity.test.ts`, blob **`3cab95503375cd8c3ed4ea473a2443099a046379`**, SHA256 `f5eb31b146cfd1ca3e5286b89e7a855a1345c547cb1da1d3fc6ef62d8cf2ceac`.

A fixture reutiliza C08/SQLite, autoridade, cases.draft/read, enqueue/outbox, leitor canônico, resolver/contexto BCS e captura/continuidade Atlas reais. O scanner Gitleaks 8.30.1 foi executado através de Omni. O conteúdo narrativo do ledger é **dado sintético autorizado declarado**; isso não representa uma decisão financeira completa.

Observações e contraprovas executadas:

1. Caso/evento válido resolvem como fresh, mantendo referências, identidade e mapas originais. Captura aprovada pelo scanner e replay recuperam o mesmo recibo, com uma única entrada Atlas.
2. O caso avança de versão **2 para 3**; o evento continua referindo a identidade histórica original, sem reescrevê-la para a versão atual.
3. Revogação do ator atual dentro do lease admitido torna a leitura unavailable, sem projeção nem continuidade. Restauração seguida de **nova admissão** permite replay autorizado.
4. Fechamento e reabertura do driver/serviços recuperam o mesmo recibo e uma única entrada. Isso é reabertura de driver, não reinício de processo.
5. Cinco referências forjadas com digest coerente são recusadas: eventId, incarnation, caseVersion, outputDigest e evidenceRefs.
6. Alteração material da fonte, com a mesma incarnation e versão superior, produz contexto historical: projeção original, currentRef e diferença exata. O evento permanece fresh e a continuidade autorizada permanece verdadeira.
7. Exclusão e recriação física da fonte mudam a incarnation: leitura unavailable e continuidade falsa.

Autorizações atuais, identidade, versões, digest, mapas, continuidade e revogação foram exercitados. Os leitores e verificações de ancestrais existentes não foram enfraquecidos; não se acrescentou uma prova específica de ciclo de ancestrais. O teste e seu runtime permanecem idênticos até W30.

**Limites:** não prova restart de processo → recall → UI, jornada financeira integral, todos os owners/campos/scanners, nem fecha a pendência instalada de headers C17 entre observações externas de cálculo.

## Outros deltas: origem e evidência preservadas

| Finding | Origem e resultado desta reconciliação |
| --- | --- |
| FIN-IND-001 | `verifyScenarioOperations` instalado em `87f7317d5f983adb255a5707b65d6f07bfa5a0d4`; business-services blob `385dd1998ec3fb73b32f77ab3dec9c93beb440d1`. Preservado. A27 passou analysis-services com autoridade/readers reais e produtor/verificador de análise explícitos de fixture; C28 acrescenta cases.read canônico real. A preparação completa de forecast pelo Planner real continua distinta e não foi declarada provada. |
| FIN-IND-003 | Prefixo privado `sf:portfolio:campaign:` presente desde `d41ea01b8d9aa068301c1643c1ec3dc088900533`; provider blob `2fd55c7304add0829d7434917c80664fe86356b9`. Arquivo de autoridade existente blob `533faeeb846987f99c67cbc69e86eb80f67054fc` passou **5/5 no C28**. Recheck justificado pelas mudanças de migração/guard desde W1. A recusa do grant Dashboard errado não prova toda a jornada positiva de campanha/reabertura. |
| CR-C11-001 | Observation instalada em `c3b02c7693c1ff3b702596c7c8458f913972a404`; wrapper blob `9f574a7573538c2a46796dfd650fadbac052dc80`. Quatro casos específicos passaram no A21 `43604032487`, job `132474686748`, W `532da498e08fa36fadbd3c01e3e7da00d869dd47`, S `43e3f3cc819a0e154dbe927662a0b473ffa6a401`. Seis blobs relevantes permanecem idênticos; não houve reimplementação/rerun. O A21 integral permanece FAIL 188/11. |
| FIN-IND-004 | UI instalada byte-idêntica a `astra-wp12@ba27411a7cda9301aa162680a94153a5e643be4d`, blob `973a2f09b394426364c514b923ecdc8e10ffb184`; composta via `d02c64430d459d183eeb9e467e1c35d9a6b958f8`, input WP01 `516f1d15f76e5e340609bd4a4b905e3a5f877cab`. O submit real alcança o resultado no U30, mas o gate positivo falha na visibilidade de Cancel analysis. Nenhum arquivo de UI do owner foi alterado. |

## FIN-IND-004: resultado real do navegador e novo hold delimitado

O selector instalado `button:not([type]), button[type=submit]` inclui o botão de submit implícito. O teste próprio usa renderer/controller/shell, browser e catálogo residentes reais, com **caso, modelo e fronteira HTTP de análise explicitamente de fixture**. Não prova agente financeiro/nativo real, AM05 ou a jornada persistida completa.

C29 atingiu o timeout Bun de 30s no cenário positivo; a segunda aquisição do pool falhou, e o finalizador reportou invariantes inválidas. O processo físico terminou. Esse FAIL permanece preservado.

W30 altera somente o teste: usa o select canônico `form.locator('select[name="candidateRef"]')`, acrescenta fases/client/HTTP e timeouts nativos de ação/navegação até 5s limitados pelo tempo restante. Budget cooperativo 18s, Bun 30s e release existente até 5+5s; todas as 17 asserções mantidas. O limite cooperativo não promete cancelamento universal de qualquer await. Não há novo race destacado ou infraestrutura de browser paralela.

[**U30 / 43629303473**](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43629303473), W30 / S `84432d8ab3a5f1619eb2e96652290434d2bb0a2e`, job `132552127580`: **FAIL 3 pass / 1 fail, 35 expects, quatro testes, três arquivos, 13,66s**.

- Clique positivo: guarda local de seleção duplicada observada; seleção válida e submit chegam a prepare/start/read/output HTTP200. Estado ready e corpo do resultado são renderizados. Ordem prepare → start → read → output e payloads start/read/output foram assertados.
- Falha: `forecast-submit.test.ts:164:113`, fase **analysis.cancel-hidden**, aos 2070ms. Esperado `isVisible() === false`; recebido **true**.
- **NOT_REACHED no caso positivo:** igualdade do payload prepare, `every(key)`, submit/currency reabilitados, valor EUR preservado e asserção final de pageErrors. Os dados observados não substituem essas asserções.
- Enter no caso rejeitado: HTTP409, nenhum start/read/output, nenhum corpo de análise; todas as suas asserções de payload/key/reabilitação/moeda passaram.
- Startup e lifecycle passaram: 1 launch, 2 aquisições, 2 liberações, 0 contextos, activeLease=false; browser desconectado, driver encerrado e processos exit0.
- Cleanup `132552703448` success; artefatos `[]`; Omni PASS, nonce `bceba14f449cce8e07472045234fb8ed`, 1 declaração/1 spawn/0 delegação.

Finding **WP10-U30-CANCEL-VISIBILITY**, aberto para composição **owner/S0**. O shell instalado `src/screen-shell.ts`, blob `d69bb554ba35863b0bf248c6aa0382205614d12a`, contém CSS de autor `button,.button { display:inline-flex }`; o controller escreve `cancel.hidden = !active`. Uma interação de cascata é **hipótese estática**, não causa confirmada: hidden/computedStyle não foram capturados na falha. Não se ocultou o botão na fixture, não se removeu a asserção e não se iniciou implementação concorrente em UI estrangeira.

## Diagnose-calculation PR59: intake qualificado, jornada X ainda aberta

Foi aplicada exatamente a entrega `e80fdc933dfd25956a50c22dea76bf077e79815b`, tree `f1ef898362d27d16f53aebfc278eee6d6ff9d73d`, com preimages W26/W27 verificados:

| Arquivo próprio | Preimage | Instalado em W28–W30 |
| --- | --- | --- |
| product/integration/source-lifecycle.ts | `65867a3e6aa9b5b85266bb637fb22cf1c6c6d539` | `d43a630254142bc5e5fb3589d1120a328abf2d1c` |
| product/integration/planner-sources.ts | `6230f22e7dd66fec1103f28cc9a7937b2dca1449` | `02d75207b2978cc5c05368cc7e3517efeb3ce3ce` |

A capacidade opcional `readScopedSourcePrepared` faz preparação sobre clone isolado e o kernel original de observação/materialização dentro da mesma transação. Preserva fallback, duas observações frescas, comparação current-again, identidade/digest/ABA, autenticação e revalidação externas e o sinal do Request. Não altera fórmulas, engines, Memory ou leitor C17.

O teste próprio `calculation-source-observation.test.ts`, blob atual `1085cf4ad7e747cd03ebb86c8c36454e3ffed20a`, teve dois casos **PASS no C29**, incluindo sua asserção final de estado durável. O primeiro C28 havia falhado no oracle após revogação; W29 passou a verificar explicitamente `requestFor(call) === undefined` e zero revalidações nessa nova chamada sem admissão. Não enfraqueceu guard de produto.

Medição funcional de estrutura: fallback **4 transações / 6 autenticações diretas / 4 revalidações**; caminho preparado **2 / 6 / 4**, repetido com novas observações. ABA 2/6/3 stale; revogação na saída 2/6/4 stale; chamada subsequente sem admissão 0/0/0 denied; abort 1/3/1 denied.

[**F29 / 43628418430**](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43628418430) passou integralmente: **10/0, 132 expects, três arquivos completos, 1044ms** — source-lifecycle, source-read-fence, source-fence-read.

### X29: hipótese nova executada uma vez, sem ganho integral demonstrado

Após C29 estrutural e F29 passarem, foi admitido **um** X novo sobre W29. O teste X é idêntico ao X27, blob `fa4bdf61e69af2498b5668a5dfceb9286613d0bd`, com 40 asserções configuradas e budgets cooperativo/Bun **285000/300000ms** preservados.

[**X29 / 43628663680**](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43628663680), S `d356d543298835b09b0452777fbd76cdaea77c85`, job `132550149012`: **FAIL 0/1, três expects, um teste/arquivo, 285,80s**. Cleanup `132551901878` success, artefatos `[]`, Omni not applicable.

| Marco | X27 | X29 |
| --- | ---: | ---: |
| Raw sensitivity write concluído | 209914ms | 221651ms |
| Environment reads nesse marco | 1919 | 1919 |
| Primeiro bind iniciado | 209916ms | 221653ms |
| Primeira prova iniciada | 212103ms | 224058ms |
| Terceira amostra reavaliada nessa prova | 268073ms | 281581ms |
| Environment reads ao abort final | 2246 | 2187 |

Raw write retornou ok; **host.evaluate-and-store não retornou**. Primeiros denied/false apareceram aos 285244ms na fronteira do abort, sem negação funcional anterior demonstrada. Persistência utilizável pelo host, releitura recomposta, retry e revogação permanecem **NOT_REACHED/NOT_PROVEN**. A recomposição desse teste usa o mesmo C08 aberto: não seria restart de processo nem reabertura SQLite.

Houve 22 chamadas numéricas reais com resultado ok. Contagens finais menores representam trabalho truncado em ponto diferente pelo deadline, não redução causal. Spans inclusivos/encadeados não foram somados como tempo de parede. O raw write mais lento nesta amostra também não estabelece regressão geral.

O patch fica estruturalmente qualificado no candidato draft; a jornada/performance integral continua HOLD. **Não repetir X29 inalterado.**

A inspeção de alcançabilidade dos três arquivos financeiros sugeridos — WP13 coverage-sensitivity-integration, WP11 composite-coverage, WP13 threshold-recertification — mostrou fontes Planner explícitas de fixture que não alcançam os dois módulos alterados. Não foram repetidos como suposta prova 4→2; suas obrigações globais continuam abertas. Relatório em [diagnostics](diagnostics/wp10-pr59-financial-gate-reachability.md).

## Matriz terminal dos runs desta continuação

W = candidato de produto; S = snapshot exclusivo do envelope. Os recibos individuais incluem requests exatos, seleção efetiva, jobs, Omni, artefatos e logs brutos.

| Run | W | S | Resultado integral |
| --- | --- | --- | --- |
| C28 `43627315630` | W28 | `8dedb1fa71a0805505e50eda8c0a038de79276a8` | FAIL 8/1, 136 expects, nove testes/três arquivos, 16,27s. C09 2/2 e autoridade 5/5 PASS; um oracle de cálculo falhou. |
| CHECK28 `43627330840` | W28 | `66d3a7fc3160a54aad1766e096a6b4cb397ab82b` | FAIL: 13 externos + 3 tipos próprios de testes, corrigidos em W29. |
| C29 `43628006308` | W29 | `d33cc53660250bde7bfb19a26401f4c722fe4875` | FAIL 3/3, 36 expects, seis testes/quatro arquivos, 42,39s. Cálculo 2/2 PASS; UI/pool FAIL. |
| CHECK29 `43628024706` | W29 | `92319dad2957a023cf1a7c9cfe0e03e77e2242af` | FAIL: somente 13 externos; zero WP10. |
| F29 `43628418430` | W29 | `e71d4beacdc1309c1affa571454809dce172b8c1` | PASS 10/0, 132 expects, dez testes/três arquivos, 1044ms. |
| X29 `43628663680` | W29 | `d356d543298835b09b0452777fbd76cdaea77c85` | FAIL 0/1, três expects, um teste/arquivo, 285,80s. |
| CHECK30 `43629131094` | W30 | `00d1ba5220121c8490ae28ed0fc839c56b0b7192` | FAIL: mesmos 13 externos; zero WP10. |
| U30 `43629303473` | W30 | `84432d8ab3a5f1619eb2e96652290434d2bb0a2e` | FAIL 3/1, 35 expects, quatro testes/três arquivos, 13,66s. |

C28 preserva o request original sem prefixo `./`; a ordem efetiva foi calculation → authority → C09. Desde C29 os requests usam paths literais `./`, conforme o normalizador instalado, e a ordem pedida foi observada. F28/U28 foram apenas preparados: não recebem resultado de F29/U30. Cada S de test-ci modifica apenas `.ci-run.json`; cada S de check modifica somente `.astra-wp10-check.json`, preservando o check anterior como segundo pai sem force. Nenhum test-ci WP10 se sobrepôs a outro test-ci WP10.

### Typecheck e guards

CHECK30 job `132551590764`: os 13 headlines externos são idênticos aos do CHECK29, **WP04=3, WP06=4, WP08=5, WP09=1; WP10=0**. O typecheck integral Sucafina permanece FAIL. Passaram WP10 test typecheck, CLI, geração/check/diff Atlas, Atlas typecheck, subprocess imports e guards contra `origin/dev`. Guard base `a1d37698a7bb097c1578f827eba6a19b9917ef07`; 78 regras, 2160 paths, zero gates, 53 avisos, zero erros.

| Check | Artefato | SHA256 |
| --- | --- | --- |
| CHECK28 | `14127220650`, 5469 bytes | `dd6776908d198c4e130ba5c114da7f5d2eb0a66d0487da99753894228735e42a` |
| CHECK29 | `14127078300`, 4364 bytes | `b660a75b3b9ea3aa76837c47fbe4abbe4a1c6e96ee2106291333cedae29124f5` |
| CHECK30 | `14126584278`, 4363 bytes | `310967dbfb665fc8e68640d8ddc8386d5e8602fc80a06be16e179267b862eb84` |

Os downloads foram obtidos pelo GitHub MCP e os retornos preservados; não se alegou leitura dos ZIPs não materializados. Logs brutos completos constam nos recibos.

O commit documental deve passar pelo **modo delivery já existente**, com candidateSha=W30, productSha=commit desta entrega e devSha observado. Esse modo comprova apenas adições de recibos e executa spawn/guards; não repete typecheck nem converte CHECK30 em PASS. O resultado real desse check, inclusive seu W/S, job e artefato, será registrado duravelmente na PR29 após sua conclusão. Este arquivo não antecipa o resultado.

## Runs herdados reanexados, sem apagar failures

| Run original | Resultado preservado |
| --- | --- |
| CHECK27 `43623374771` | FAIL 13 externos, zero próprios; artefato `14125043272`. |
| X27 `43623440133` | FAIL 0/1, três expects, 285,57s; abort no primeiro binding/prova. |
| A27 `43624030665` | FAIL 59/1, 1447 expects, 60 testes/oito arquivos, 297,68s. Assertion de integridade, não timeout. |
| R27 `43624794783` | FAIL 34/13, 839 expects, 47 testes/dez arquivos, 1052,08s. Cleanup success. |

Logs, requests, jobs, W/S e hashes herdados estão em [previous-runs](previous-runs/). A27/X27/R27 não foram cancelados nem reatribuídos a outro candidato. Diagnose-memory não foi reaplicada nem duplicada.

## Pendências exatas que continuam

1. **Memory A27:** após Atlas recusar registro corrompido, `stale.preflight` retorna ok em `historical-memory.test.ts:580:103`. Same-request-new-proof e stale.preserve positivo foram alcançados; três contraprovas finais de revogação não. PR55 consultada; proposta não aplicada. A hipótese anterior de clonagem lenta não é uma correção comprovada para essa assertion.
2. **X29:** primeiro binding/prova ainda excede o budget. Sem resultado utilizável do host, reload/retry/revogação; patch PR59 não recebeu crédito de ganho integral. Nova execução exige hipótese discriminante adicional.
3. **UI U30:** cancel permanece visível no estado ready. Entrega compatível do owner/S0 ainda necessária; manter assertion, fixture explícita e limites. Preparação financeira real continua separada.
4. **13 diagnósticos externos:** requerem entregas compatíveis WP04/WP06/WP08/WP09. Não editar esses testes/features para fazer o check passar.
5. **B26:** 38/2. Ancestry próprio excede 105s durante produce-outer; `wp11/calculation-persistence.test.ts` excede 180s em C17 aninhado. Não atribuir esse timeout a composite-coverage.
6. **H05/Freeze10/CurrentChoice:** H25 42/1, H05 esperado409/recebido200; combinação compatível WP04/WP11 pendente. Freeze10 37/38, host SHA256 esperado `6a608e24847fe730b645d5f51f86e47d83e803875162820038e0c05d18f96772` contra composto `42839b627194c59febff34052b813a6e4725414dcf84c8308397539b734b3893`; não reescrever expectativa estrangeira. Cohort CurrentChoice PR35 **retido, não instalado**; seu hold de lease final não é defeito demonstrado do runtime instalado.
7. **R27 BI/Review:** seis setups bi-call-scope e um bi-case-access divergem na ordem da evidência; quatro lifecycle recebem403 em choices; um contador de autenticação é0; Review focus excede transporte10s com handlers200 em aproximadamente13,65s. Probes posteriores não alcançados. Não classificar as13falhas como13defeitos de autorização.
8. **C17 entre observações externas:** finding `R1-W23-C17-BETWEEN-OBSERVATIONS`, estático em código estrangeiro **instalado**, não breach executado. `business-context.ts` blob `5cca27ce239c92a8e3c9f9f92f816f5224562904`, owner WP00/PR32@`35b9fd4f532abeb1058f00281d4ad8885ca9966f`, SHA256 `9791fd4c605693711a4508b3b496c0fb67a407c1009d734408659ed10664fefc`. Duas chamadas historicalCalculation prendem request/binding/refs/maps/projeção, sem prender todos os headers entre ambas. Negativos dentro de uma observação, inclusive planner-calculation, e o C09 positivo não fecham essa janela.
9. **Demais cortes financeiros/browser/CLI/D/P/Q:** P27/Q27 continuam requests, sem PASS; D22 foi cancelado parcialmente, sem resumo Bun terminal, com evidência estrangeira de blob anterior que não se transfere. Relatório de alcançabilidade financeira mantém obrigações mesmo quando o corte não discrimina4→2.
10. **Jornadas nativas e aceites:** Task real com nome/input persistidos, cadeia Relay/governança C07, resolver público de anchors com Session real, Watch com descritores/admissão/schedule/ocorrência/owner continuam sem prova integral. Permanecem nove operações nativas, cinco callables, 39 rotas, oito packs, cinco perfis e 18 skills; AM/GNATIVE e jornadas instaladas não vazias não foram aceitos.
11. **Três pareceres FINAL independentes** ainda faltam no candidato terminal. Revisões internas de preflight/consistência nesta continuação não recebem esse crédito. S0 mantém a decisão de integração.

As demais pendências e pins do handoff original continuam por referência integral, sem removê-los deste escopo.

## Critérios e recibos para a próxima continuidade

[criteria-current-contribution.json](criteria-current-contribution.json) acrescenta resultados terminais ao [crosswalk pré-run preservado](runs/W28/criterion-crosswalk-preflight.json), com textos e ponteiros literais do pack:

| Prova | Critérios relacionados | Crédito permitido |
| --- | --- | --- |
| C09 real | WP10.T07.DOD.01, T07.INV.01, T07.CMP.01 | Contribuição parcial observada; nenhum critério integral encerrado. |
| Preparação/observação de fonte | WP10.T01.INV.01, T01.QLT.01 | Estrutura e fences passaram; jornada X/performance HOLD. |
| Submit forecast | WP10.T02.DOD.01, T02.INV.01, T02.QLT.01 | Comportamento parcial observado e nova falha registrada; gate HOLD. |

Não promover T07.CHK.02 (restart→recall→UI), T02.CHK.05 (30 repetições/p95/200ms) ou CAMP.DOD.02 (todas as jornadas de produtores reais).

- [outcomes.json](outcomes.json): identidades, resultados, deltas e pendências estruturadas.
- [runs/W28](runs/W28/), [runs/W29](runs/W29/), [runs/F29](runs/F29/), [runs/X29](runs/X29/), [runs/W30](runs/W30/): evidência integral.
- [reconciliation.json](reconciliation.json) e [PREPARATION.md](PREPARATION.md): decisão inicial preservada, sem apagar seus estados históricos então NOT_RUN.
- [prior-PR29-body.md](prior-PR29-body.md), [PR29-W28-observation.md](PR29-W28-observation.md), [PR29-W29-observation.md](PR29-W29-observation.md): estados anteriores da PR preservados.
- [final-ref-observation.json](final-ref-observation.json): observação das refs e ausência de runs WP10 ativos/queued no corte, sem inferência sobre encerramento de autor.
- [delivery-files-manifest.json](delivery-files-manifest.json): hashes/bytes das novas evidências desta entrega.

Todas as operações remotas foram pelo GitHub MCP. Testes de produto e typechecks ocorreram somente em GitHub Actions. Não houve teste local, epic/full suite, novo dispatcher global, outra branch de produto/PR, force push, merge, deploy, novos acessos, alteração de engines Maestro/Relay/Schedule ou reinício de Orchestra.
