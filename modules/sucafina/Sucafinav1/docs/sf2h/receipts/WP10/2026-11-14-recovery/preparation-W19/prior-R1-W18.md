# Parecer independente R1 — W18

**HOLD.** A revisão de fonte identificou a correção do histórico C17 para o cenário delimitado de **cálculo record-only com fontes ainda fresh**, preservando a seleção original do run. A prova funcional desse caminho continua pendente no lote A. O check do candidato terminou **FAILURE**: há 14 diagnósticos em arquivos estrangeiros, incluindo uma dependência nova não composta, `sfPlannerEvidenceRef`. O W18 não recebe aprovação funcional, nativa ou global.

| Identidade | Valor |
| --- | --- |
| Produto W18 | `8b1cc71d8ab2484055a0d055c8487d4579476b9b` |
| Árvore | `6bace347fcd4deec2018185aff7ec152d79eaec5` |
| Parent W17 | `2ec17b2c8204d5e953eec3186b7e236c0faaad47` |
| Revisor | R1 — `/root/independent_r1_w16` |
| Independência | Sem autoria ou edição de produto/testes; sem execução local de produto; sem publicação ou mutação remota |
| PR / base | [PR29](https://github.com/gustavomhss/Orchestra-SF/pull/29) → `sf2-stack` |

O inventário JSON distingue leitura de fonte atual, inspeção parcial de deltas e reuso da minha revisão independente W17 somente para bytes idênticos. Audits do implementador foram tratados como contexto, não como aceite.

## C17 e reentrada de lifecycle

### R1-W17-CALCULATION-HISTORY-01

**SOURCE_FIXED_SCOPED_RECORD_ONLY_FRESH_SOURCES / HOSTED_RECHECK_PENDING.** O finding não está fechado funcionalmente.

O W17 tentava reabrir todo cálculo através dos leitores correntes. Estes exigem a versão original do caso; assim, uma referência preservada no ledger em v1 impedia a leitura do caso após avanço legítimo a v2. O W18 compõe explicitamente os leitores históricos publicados, através de `planner-calculation-history.ts`.

A seleção é derivada do resultado persistido e de um evento real do ledger do caso corrente. O reader exige request, resultado, referência, fontes, caso e captura Atlas correspondentes, além da autoridade corrente. A projeção histórica vem da captura protegida real e é comparada ao resultado persistido; o replay usa o produtor canônico. Estado C08, fontes, binding e dia são cercados por leituras repetidas. A rota não registra novo request, não escreve Atlas e não fornece um resultado corrente.

A alteração decisiva de composição fica em `business-services.ts`: o escopo histórico usa AsyncLocalStorage privado com Request, binding, seleção corrente e referência ao scope original. **Não substitui `caseBindings`.** Portanto, um run originalmente selecionado em v1 pode autenticar a leitura histórica do caso atual v2, enquanto `selectedCase`, `resolveCase`, o baseline exposto e a emissão de cálculo corrente permanecem presos à seleção original. A autoridade e a identidade do Request são verificadas novamente após os awaits, e o scope encerra em finally.

O BCS tenta primeiro a resolução corrente. O fallback histórico precisa devolver estado historical, referência exata, projeção original e diferenças. A prova de continuidade repete a leitura histórica e compara as duas provas. O cache de recall corrente continua usando o resolver fresh. Não encontrei promoção para fresh ou ciclo ilimitado na costura inspecionada.

**Limite explícito:** o reader só admite referências cujas fontes são records e continuam atuais. Cálculos com fontes mistas/aninhadas ou drift material das fontes permanecem indisponíveis. O resultado deste parecer não autoriza classificar todo histórico C17 como concluído. Esses cenários precisam de seus próprios contratos e provas de origem autenticada.

### R1-W16-LIFECYCLE-CASE-01

**SOURCE_FIXED_WITH_REAL_REENTRY_TEST_ADDED / HOSTED_RECHECK_PENDING.**

O helper `analysis-run-context.ts` é byte-idêntico ao que revisei no W17. O teste novo do W18 resolve a lacuna anterior de cobertura de fonte: usa `createSfAnalysisRunContext`, o wrapper real de stale, `createSfRunStore` e `preserveStale`, com cálculo/request/captura Atlas efetivamente persistidos e reabertos, caso atual v2 e selector original v1. Verifica a recusa de seleção fresh durante o próprio replay, preservação do output e da metadata original, avanço do estado stale e limpeza de contexto/lease.

Os testes adicionais de C17 cobrem evento ausente ou alterado, encarnação substituída, request/result adulterados, captura ausente, mudanças de fonte, revogação de principal, Request abortado, perda de lease e recursão. Foram inspecionados em fonte; **o resultado hospedado ainda não foi observado**.

O run desse teste tem metadata nativa explicitamente sem execução. A fixture não demonstra Task, Session, skill carregada nem execução de modelo. A persistência e os produtores reais usados no teste não transformam essa metadata em aceite nativo.

### R1-W16-TYPES-02

**CLOSED_SCOPED_EXACT_W18_TYPECHECK.** O check W18 confirma zero diagnósticos próprios, com CLI e consumidores de testes WP10 aprovados. Isso fecha somente os dois erros de tipos próprios anteriormente apontados; não fecha o typecheck SF integral nem qualquer comportamento funcional.

## Achado obrigatório do W18

### R1-W18-PLANNER-DEPENDENCY-01 — export do produtor não composto

**Alto / bloqueante de composição / aberto.**

O blob estrangeiro publicado `product/planner/evidence-reader.ts` importa `sfPlannerEvidenceRef` de `product/integration/planner-sources.ts` na linha 8. A exportação não existe no W18. A inspeção de fonte e o check exato concordam: **TS2305**, sem export com esse nome.

Conferi por GitHub MCP o mesmo blob `9c11e2ad6977573a14725a0b514528c09e34bcc4` no candidato W18 e no produtor PR34 `ba8a09e371ce8d93eb917eabb102caaee5affaf4`. O problema não é alteração informal do reader estrangeiro; é a composição incompleta de sua dependência.

**Impacto:** o typecheck SF falha e o caminho que carrega o reader não está fechado como dependência de produto. É um bloqueio de composição, sem alegação de vazamento. O diagnóstico estar num path estrangeiro não torna o check aprovado nem elimina a responsabilidade WP10 de consumir o output compatível.

**Correção e prova requeridas:** compor o output publicado exato de `planner-sources.ts` com pin, rever seu delta e preservar os fences existentes, publicar novo candidato e observar seu check. Não reimplementar o produtor estrangeiro apenas para obter resultado verde.

O implementador informou o blob compatível `6230f22e7dd66fec1103f28cc9a7937b2dca1449` como preparação de W19. Esse output **não faz parte do W18** e não fecha este finding. Os outros 13 diagnósticos estrangeiros também continuam abertos.

## Outros limites e costuras inspecionadas

O acesso a operações Planner gravadas agora exige que o cenário e o resultado pertençam às alternatives/choices efetivamente persistidas no caso. A rota usa o C08 corrente e duas resoluções BCS reais, conserva os valores originais, recusa recursão e não simula nem publica nova operação. A rota de execução corrente conserva suas validações próprias.

Em C12, o helper próprio `prepared-application-egress.ts` conserva o intent clonado, o Request, o binding e a lease humana antes e depois do produtor. O delta exato PR35 acrescenta reserva durável antes do dispatch e reconciliação com o caso relido após o recibo do domínio. A comparação de recibo e caso reaparece no retorno. A inspeção estática não fecha atomicidade, retry, perda de resposta ou revogação durante execução sem as respectivas provas hospedadas.

Os deltas próprios de Review e promoção Alternative foram examinados como fronteiras de composição. A promoção no-op conserva a identidade efetivamente alocada pelo mutator e a verificação de snapshot; o proof não é mantido como autorização durável. O novo scope Review é local à Request/call e compara snapshots completos antes de reutilizar uma prova. Leitores externos, outcomes nativos e comments continuam na rota conservadora. Este exame não substitui a revisão UI/visual dos outros revisores.

## Árvore, pins, exclusões e arquivos arquivados

A auditoria independente de dados confirmou:

| Verificação | W18 |
| --- | ---: |
| Blobs na árvore completa | 16.120 |
| Arquivos hidratados verificados por SHA Git | 1.142 |
| Alterações reais, todas presentes no manifesto | 47 |
| Alterações próprias de código/testes | 23 |
| Novos recibos próprios | 18 |
| Blobs estrangeiros alterados, exatos | 6 |
| Pins efetivos únicos conferidos contra a árvore | 401 |
| Deletes | 0 |
| Violações de ownership/exclusões | 0 |
| Recibos anteriores alterados | 0 |

A hidratação local é parcial; ausência de um arquivo no snapshot não foi tratada como delete. Fiz **10 leituras remotas próprias**, relativas a oito paths candidatos, incluindo `apply.ts` e `evidence-reader.ts` também nos respectivos commits produtores. Os conteúdos remotos foram verificados por SHA Git e igualdade byte a byte com o snapshot. Os demais pins foram conferidos pela árvore completa; não alego refetch individual de todos os 401 inputs.

O recibo arquivado `stop-handoff.json` permanece no blob `d1ac5e6da263fc2dd1766f13e4368b898bcceab5`, SHA-256 `bc761d68afd64bcb7e49d2abbe98f849ee113b197b579b16f561b12622f65166`, com 128 cópias estrangeiras e 131 inputs registrados como somente leitura. Todos os recibos anteriores mantêm seus blobs. Essa confirmação não é uma nova auditoria de cada cópia arquivada fora do repositório.

## Integridade dos 171 critérios e freeze

Comparei novamente ID, texto, família, task e título de task do draft W18 contra o pack canônico: **171 critérios / 7 tasks preservados literalmente**. O draft aceita zero critérios, não contém candidate SHA/tree e permanece paramétrico. Portanto, não constitui evidência funcional do W18.

O mapa final precisa vincular os resultados reais do candidato final, o finding de dependência e os fechamentos apenas delimitados de C17/lifecycle. Não é correto converter presença de código, coleta de testes, metadata nativa ou sucesso dos consumidores de tipos em aceite de critérios funcionais.

O freeze9 permanece **37/38**. O único mismatch continua sendo o host:

| Binding | SHA-256 |
| --- | --- |
| Esperado pelo freeze9 | `4c654665a12aa02a6d5a851cdbe662f6f0fabdacf21e4b600f598e499a3a1922` |
| Host efetivo W18 | `6a608e24847fe730b645d5f51f86e47d83e803875162820038e0c05d18f96772` |

O binding publicado correspondente continua pendente de WP00. Não houve edição própria do freeze estrangeiro para fazê-lo passar.

## CI exato observado

### Check W18

| Identidade | Valor |
| --- | --- |
| Snapshot S | `6d72852aa48f864338caa93204ae894ec1e978fe` |
| Árvore S | `4e55a9cc4bf3abcfc7aae1d8c06157aad83f465d` |
| Run / job | [43591239877](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43591239877) / `132436212526` |
| Conclusão consultada por R1 via GitHub MCP | **failure** |
| Artifact | `14112034219` |
| ZIP SHA-256 | `08329a4279831996b48cd01911e58a5caf164185103a2acf8268d33640ec063d` |

Verifiquei o hash do ZIP e dos 11 arquivos do artifact. `revisions.txt` corresponde ao SHA e à árvore W18; o log confirma o checkout do produto exato. O compare salvo do envelope altera somente `.astra-wp10-check.json`.

| Gate | Resultado observado |
| --- | --- |
| Typecheck SF | **FAIL — 14 diagnósticos, zero próprios** |
| Typecheck CLI | PASS |
| Typecheck consumidores de testes WP10 | PASS |
| Geração e verificação Atlas | PASS |
| Typecheck Atlas | PASS |
| Spawn-imports | PASS |
| Guards | PASS — 78 regras, 1.328 paths, zero gate findings, 48 warnings, zero errors |

### Lote funcional A

A consulta independente mais recente observou **in_progress**, sem conclusão, no run [43591262845](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43591262845), job `132436280987`, snapshot `f84d2f41bb5755d350d524053c391fc8338e7bdd`, árvore `16b526a1b18be5c977b28f3e04c54a1b1aacd0a1`. São 22 arquivos selecionados. **Não há contagem terminal aceita neste parecer.**

B8/C26/D10 foram informados como validados e ainda não disparados. Nenhum resultado antigo foi transferido como aceite W18. O check de tipos não substitui os resultados funcionais em andamento.

## Pendências para o pacote de revisão

Continuam abertos: dependência de composição do Planner, demais diagnósticos estrangeiros, binding WP00, C07 real e recibos correspondentes, provas funcionais exatas, execução residente/nativa e epic global após o bundle total. Cinco descritores de rotina omitidos não viram aceite de 39 operações ou oito packs.

Um novo candidato exige revisão do delta e rechecagem das provas afetadas. O pacote final deve conservar os 171 critérios, três pareceres independentes, SHAs/run IDs reais e as pendências descritas. Este relatório W18 deve ser preservado mesmo depois de existir W19.

**Nenhum produto, build, teste, typecheck ou navegador foi executado localmente por R1. Nenhuma aprovação funcional, nativa ou global foi emitida.**

