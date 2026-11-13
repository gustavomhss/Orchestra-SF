# Rechecagem técnica de T2-F01 e bordas alteradas

## Veredicto

**APPROVED_FOR_EXECUTION**, na especialidade técnica reavaliada, para o commit **`1feb949244357b8ee7ea7a0c27310281accc7592`**.

**T2-F01 está CLOSED como contradição de planejamento resolvida.** Não há novo P0, P1 ou P2 demonstrável nesta rechecagem. T-F01, T-F02 e T-F03 continuam CLOSED, com seus fechamentos ratificados nas bordas alteradas.

**implementation_test_status: NOT_RUN.** Nenhum bundle foi gerado, guard executado ou comportamento de produto testado. A aprovação permite executar o plano técnico corrigido; não aceita a implementação futura.

| Campo | Valor |
| --- | --- |
| Revisor / ID | Técnico independente · SF2H-R2-T-RECHECK-1feb949 |
| Candidato atual | `1feb949244357b8ee7ea7a0c27310281accc7592` |
| Candidato do parecer inicial | `38986380cd7b5697c0be30c1f55d43eddee63045` |
| Baseline do código primário | `9e4f3d35833f9b2cea6abdf58f42331f3973d9bf` |
| T2-F01 | **CLOSED** no planejamento |
| T-F01 / T-F02 / T-F03 | **CLOSED · RATIFIED** |
| Novos achados | Nenhum |
| Implementação / builds / testes | **NOT_RUN** |

O [parecer inicial](sandbox:/workspace/scratch/838a0195183d/sf2h-recheck/contracts.md) e seu [JSON](sandbox:/workspace/scratch/838a0195183d/sf2h-recheck/contracts.json) permanecem preservados. Sua conclusão REQUIRES_CHANGES continua correta para o candidato anterior; esta rechecagem julga outro SHA.

## Método

Cópia congelada sf2h-candidate-1feb949. Recibo sf2h-work/candidate-1feb949.json do integrador registra 110 blobs com SHA1 coincidente, 49 mudanças apenas sob docs/sf2h-plan, parent 3898638 e candidato 1feb949. Não repeti a verificação de todos os blobs.

Leitura do novo C16/C17, diff C11/C15–C17 contra o candidato anterior, especificação de packaging, resident_packaging, WP10.T07 completo, ownership, receitas e AM02/05/06. Rotas e concessões foram recalculadas a partir dos JSONs. Fontes remotas somente por GitHub MCP no SHA de baseline; APIs do scanner/boundary/guard/dependências foram reabertas.

Rechecagem concentrada na correção e bordas alteradas; a análise primária anterior permanece referenciada para APIs não modificadas. Em módulos Memory/Kernel, a rechecagem examinou principalmente declarações/imports e a ausência de outra aresta de scanner, não constituiu nova auditoria integral dos algoritmos.

Sem autoria, alteração do candidato ou leitura de pareceres alheios. Declarações do autor sobre correção/validação não foram tomadas como prova. Nenhuma implementação, build, bundle, scanner, guard ou teste de produto foi executado.

Somente inspeção, diff e cálculo de relações dos documentos. campaign.contracts e campaign.resident_ai coincidem com seus espelhos; tasks de WP10 também coincidem. Os relatórios JSON/Markdown são os únicos artefatos escritos.

## T2-F01 — por que o contraexemplo deixa de ser imposto

O defeito original exigia simultaneamente um novo `business-memory-ports.js` contendo o scanner real e a preservação de uma allowlist que não admitia esse novo site de subprocesso. O candidato corrigido altera o grafo de empacotamento, mantendo o scanner no artefato existente já admitido.

| Superfície | Conteúdo planejado | Origem do scanner |
| --- | --- | --- |
| `@orchestra/atlas-boundary/business-memory-ports` | Factories `createMemoryRead`/`createMemoryEmit`, fold, validators e tipos de memória | Import literal de `NO_SCANNER_NAME` do subpath nativo; nenhum corpo ou export runtime de scanner |
| `@orchestra/atlas-boundary/native-memory` | Todos os exports bound anteriores, mais os quatro valores e dois tipos canônicos de scanner | `scanner.ts`, incorporado no mesmo `generated/native-memory.js` já admitido |

A especificação não se limita a remover os exports de scanner da nova entry. A fonte primária confirma que **`memory-emit.ts:62` importa `NO_SCANNER_NAME` de `./scanner.js` em runtime**. Sem tratar essa dependência, ainda seria possível incorporar `child_process` no novo bundle.

A regra nova tem três condições simultâneas: descritor `business-memory-ports`, importer absoluto/normalizado exatamente `memory-emit.ts` e specifier literal exatamente `./scanner.js`. Apenas essa aresta retorna `@orchestra/atlas-boundary/native-memory` como external. A ausência ou mudança da aresta deve falhar a geração. Todos os demais descritores, inclusive `native-memory`, mantêm a resolução canônica. A regra está em [C17](https://github.com/gustavomhss/Orchestra-SF/blob/1feb949244357b8ee7ea7a0c27310281accc7592/modules/sucafina/Sucafinav1/docs/sf2h-plan/contracts.json), [resident_packaging](https://github.com/gustavomhss/Orchestra-SF/blob/1feb949244357b8ee7ea7a0c27310281accc7592/modules/sucafina/Sucafinav1/docs/sf2h-plan/campaign.json) e na [especificação de packaging](https://github.com/gustavomhss/Orchestra-SF/blob/1feb949244357b8ee7ea7a0c27310281accc7592/modules/sucafina/Sucafinav1/docs/sf2h-plan/specs/atlas-packaging.md).

1. No candidato inicial, reexportar runScanner no novo bundle preservava execFileSync em um path não admitido. O candidato atual proíbe esses exports empresariais e atribui os reexports reais à native entry existente.
2. Remover somente os exports não bastaria: memory-emit.ts:62 importa NO_SCANNER_NAME em runtime. Esse ponto foi confirmado e está tratado por uma regra exata e limitada ao descritor empresarial.
3. O valor continua proveniente de scanner.ts por native-bound → native-memory. Native-memory mantém o descritor canônico e não volta a importar o business bundle: não há ciclo exigido nem necessidade de copiar constante.
4. A regra existente de spawning continua rejeitando qualquer ocorrência no novo bundle. O plano exige examiná-la na árvore após geração, junto de AST, exports/declarations e digests inalterados de guard/allowlist. Portanto o contraexemplo original não é mais uma consequência obrigatória do plano.

A constante continua proveniente da mesma fonte; não existe literal copiado, shim, scanner sempre limpo, import computado ou alteração de engine necessária. A resolução do subpath público já existe no package. O bundle nativo não passa a depender do novo bundle empresarial, portanto a proposta não exige um ciclo.

### Preservação de API e tipos

A [entry nativa existente](https://github.com/gustavomhss/Orchestra-SF/blob/9e4f3d35833f9b2cea6abdf58f42331f3973d9bf/modules/atlas/packages/adapter-io/src/native-bound.ts) exporta `createNativeMemory`, `decideProjectRule`, `proposeProjectRule` e seus tipos. A alteração proposta é aditiva, limitada a `detectAvailableScanner`, `runScanner`, `KNOWN_SCANNERS`, `NO_SCANNER_NAME`, `ScannerBinarySpec` e `ScanVerdict`, todos encontrados em [scanner.ts](https://github.com/gustavomhss/Orchestra-SF/blob/9e4f3d35833f9b2cea6abdf58f42331f3973d9bf/modules/atlas/packages/adapter-io/src/scanner.ts).

O código de [createNativeMemory](https://github.com/gustavomhss/Orchestra-SF/blob/9e4f3d35833f9b2cea6abdf58f42331f3973d9bf/modules/atlas/packages/adapter-io/src/native-memory.ts) fixa a cópia do binding e o root do store; o recall estreita a query e força o owner do binding. Acrescentar exports de funções de scanner não altera esses corpos nem expõe `createMemoryRead`, `createMemoryEmit` ou `createDurableMemory` pela entry bound. Os factories para o store SF ficam exclusivamente na nova superfície empresarial.

A [declaração nativa já gerada](https://github.com/gustavomhss/Orchestra-SF/blob/9e4f3d35833f9b2cea6abdf58f42331f3973d9bf/modules/atlas/boundary/src/generated/native-memory.d.ts) contém os contratos bound e o tipo `ScannerBinarySpec` usado por `AtlasBinding`; os novos tipos são reexports explícitos de fontes reais. O plano exige regenerar os dois pares JS/d.ts pelo mesmo gerador, sem escrever declarações ou artefatos manualmente. A regra Bun altera a ligação do valor em runtime; não requer reescrever a assinatura de `MemoryEmit` ou materializar I/O de tipos.

### Dependências e ownership

O helper [@orchestra/script/spawn-imports](https://github.com/gustavomhss/Orchestra-SF/blob/9e4f3d35833f9b2cea6abdf58f42331f3973d9bf/packages/script/package.json) é um export público real. O [catálogo raiz](https://github.com/gustavomhss/Orchestra-SF/blob/9e4f3d35833f9b2cea6abdf58f42331f3973d9bf/package.json) contém TypeScript 5.8.2, e o workspace inclui `packages/*` e a boundary Atlas. O novo plano declara `typescript: catalog:` e `@orchestra/script: workspace:*` diretamente como devDependencies da boundary. Não depende de uma resolução incidental por hoisting.

A atualização do lock fica com WP10.T01/S0, que já possui o `bun.lock` da raiz. A rechecagem encontrou **nove paths Atlas distintos**, todos com exceção exata `WP10 / WP10.T07 / S0-A`, e nenhuma divergência nessa relação. `atlas-scanner.ts` e `capabilities.ts` também constam da reserva de S0-A. O [ownership](https://github.com/gustavomhss/Orchestra-SF/blob/1feb949244357b8ee7ea7a0c27310281accc7592/modules/sucafina/Sucafinav1/docs/sf2h-plan/ownership.json) mantém guard/allowlist e implementações de scanner/memory-emit/native-memory fora do escopo de edição.

### Gates que continuam obrigatórios

- Geração real dos dois pares JS/d.ts e resolução dos subpaths a partir do consumidor SF.
- Verificação AST/hits, check:generated, typecheck e check:spawn-imports na árvore candidata, sem alterações de guard/allowlist.
- Suite da boundary em GitHub Actions, preservação dos exports bound e negativos que reintroduzem scanner no novo bundle ou removem a regra external.
- AM05 real com scanner, facade DurableMemory, commit/restart, idempotência e autorização corrente.

O comando real `bun run check:spawn-imports` existe na raiz e agora está explícito no gate `CHECK-SPAWNS`. O [guard](https://github.com/gustavomhss/Orchestra-SF/blob/9e4f3d35833f9b2cea6abdf58f42331f3973d9bf/script/check-spawn-imports.ts) continua cobrindo `.js` gerado e usando caminhos exatos. A [allowlist](https://github.com/gustavomhss/Orchestra-SF/blob/9e4f3d35833f9b2cea6abdf58f42331f3973d9bf/script/spawn-allowlist.json) continua admitindo `generated/native-memory.js`, sem novo caminho. [WP10.T07](https://github.com/gustavomhss/Orchestra-SF/blob/1feb949244357b8ee7ea7a0c27310281accc7592/modules/sucafina/Sucafinav1/docs/sf2h-plan/work-packages/WP10.json), [ci-recipes](https://github.com/gustavomhss/Orchestra-SF/blob/1feb949244357b8ee7ea7a0c27310281accc7592/modules/sucafina/Sucafinav1/docs/sf2h-plan/ci-recipes.json) e [AM05](https://github.com/gustavomhss/Orchestra-SF/blob/1feb949244357b8ee7ea7a0c27310281accc7592/modules/sucafina/Sucafinav1/docs/sf2h-plan/resident-proof-plan.json) exigem os digests dos quatro artefatos, guard/allowlist inalterados, AST, imports públicos e contraprovas que reintroduzem a dependência errada.

Esse conjunto fecha o problema **do plano** porque já não obriga um resultado que o guard rejeita. O fato de os gates futuros poderem detectar uma implementação incorreta não é evidência de que já passaram.

## C16 — rotas positivas e autoridade

Recalculei as relações a partir dos documentos do candidato, sem executar o produto.

| Relação estática | Resultado |
| --- | --- |
| Perfis / skills / packs / operações | 5 / 18 / 8 / 39 |
| Rotas positivas / operações distintas cobertas | 39 / 39 |
| Operações sem rota | Nenhuma |
| Divergências de perfil, skill ou grants | Nenhuma |
| Divergências de pack, input/output, produtor ou consumidores | Nenhuma |
| Rotas exigindo SkillLoadReceipt | 39 |
| Espelhos de contratos, manifesto e tasks WP10 | Coincidentes |

Cada rota foi comparada com `profile.allowed_operations`, `skill.allowed_operations`, `skill.profiles`, `operation.profiles`, pack, schema de input, output, produtor e consumidores. A fonte é [operation_call_routes no manifesto](https://github.com/gustavomhss/Orchestra-SF/blob/1feb949244357b8ee7ea7a0c27310281accc7592/modules/sucafina/Sucafinav1/docs/sf2h-plan/agents-atlas-mcp.json), cujo conteúdo coincide com `campaign.resident_ai`.

Quatro skills recebem concessões adicionais dentro dos perfis e operações já contratados:

| Skill | Concessões acrescentadas | Limite preservado |
| --- | --- | --- |
| `sf-enquadrar-decisao` | `sf_import_preview` | Prévia de arquivo admitido; nenhuma aplicação de importação |
| `sf-explicar-forecast` | `sf_import_preview` | Mesmo manifesto C04, simulação identificada e domínio não aplicado |
| `sf-produzir-bi-contextual` | `sf_dashboard_read` | Mesma AuthorizedDashboard e ACL corrente da UI |
| `sf-preparar-revisao-executiva` | Catálogo, preparar, run, status e resultado de rotina | Run somente com admissão C07 vigente; modo de resultado não inicia rotina filha |

C11 conserva `importPreviewRef`, `analysisBasis=import-preview` e `domainApplied=false`; `DecisionBrief` conserva `runRef/resultRef`. Esses campos impedem a prévia de ser tratada como domínio gravado ou a síntese de ser tratada como nova aprovação. Nenhuma das skills recebe uma ferramenta genérica de apply/approve.

**HostBoundEntryMode é definido pelo host.** A skill não escolhe o modo em argumentos. No percurso interativo, `prepare` produz a proposta do fluxo C07 e `run` exige admissão real atual; a rota de `sf_routine_run` declara `requires_current_c07_admission:true`. Em `routine-result`, prepare/run são recusados, inclusive via chamada direta ou retry, e a skill apenas consulta o run autorizado e sintetiza seu resultado. Faltando admissão, o run termina com proposta/needs-input e uma resposta humana inicia outro run.

C16 mantém o binding confiável, SkillLoadReceipt, lease, checks de perfil, dispatch de domínio e revalidação de autorização. O harness de prova não recebe um ingresso privilegiado sem skill. [AM02 e AM06](https://github.com/gustavomhss/Orchestra-SF/blob/1feb949244357b8ee7ea7a0c27310281accc7592/modules/sucafina/Sucafinav1/docs/sf2h-plan/resident-proof-plan.json) exigem o percurso permitido real e os negativos de skill ausente, execução sem admissão e loop recusado. Não encontrei uma ampliação de autoridade empresarial causada por essa mudança.

## Ratificação dos achados originais

| Achado | Estado | Fundamentação |
| --- | --- | --- |
| T-F01 | **CLOSED · RATIFIED** | C15 conserva registro/carga/digests/shipping/execução própria do Revisor e adiciona a obrigação de uma rota efetiva por operação. C11 adiciona refs de import-preview e run/result sem retirar a prova de carga/consumo ou independência. A ampliação de grants de quatro skills está dentro das concessões dos perfis e do domínio. |
| T-F02 | **CLOSED · RATIFIED** | C16 conserva binding host-only, CallLease, transporte privado, dispatch e autorização atual. A chamada direta continua exigindo SkillLoadReceipt. HostBoundEntryMode é dado do host, não argumento; routine-result bloqueia prepare/run. sf_routine_run continua exigindo admissão C07 vigente, inclusive no caminho positivo. |
| T-F03 | **CLOSED · RATIFIED** | Referências, mappings task/project, owners separados de principal, ACL antes do store Atlas, transação externa e outbox permanecem. A mudança corrige a distribuição dos módulos e não altera templates, memória canônica, source resolver, proteção do namespace ou scanner real. |

Esses estados continuam significando fechamento de lacunas de planejamento. A execução das skills, segurança do transporte e persistência Atlas permanecem sujeitas às provas GNATIVE/AM01–AM06.

## Evidência examinada para o fechamento

1. [modules/sucafina/Sucafinav1/docs/sf2h-plan/contracts.json](https://github.com/gustavomhss/Orchestra-SF/blob/1feb949244357b8ee7ea7a0c27310281accc7592/modules/sucafina/Sucafinav1/docs/sf2h-plan/contracts.json) — **C17.content e C17.exports**. Scanners saem dos exports de business-memory-ports. O novo contrato usa native-memory para os scanners e externaliza somente a aresta literal memory-emit.ts → ./scanner.js do descritor empresarial, mantendo a constante canônica e proibindo alteração do scanner/engine/guard.
2. [modules/sucafina/Sucafinav1/docs/sf2h-plan/specs/atlas-packaging.md](https://github.com/gustavomhss/Orchestra-SF/blob/1feb949244357b8ee7ea7a0c27310281accc7592/modules/sucafina/Sucafinav1/docs/sf2h-plan/specs/atlas-packaging.md) — **§§2–4**. Define os quatro valores e dois tipos aditivos da native entry; três condições simultâneas do resolver; dts/JS canônicos; falha em aresta ausente/alterada; AST/hits e guard real. Não usa tree-shaking como premissa.
3. [modules/sucafina/Sucafinav1/docs/sf2h-plan/campaign.json](https://github.com/gustavomhss/Orchestra-SF/blob/1feb949244357b8ee7ea7a0c27310281accc7592/modules/sucafina/Sucafinav1/docs/sf2h-plan/campaign.json) — **resident_packaging**. A rota completa, external_edges, source_policy, imports públicos, devDependencies, writer do lock, nove paths e admissão estática são normativos e coerentes com C17.
4. [modules/atlas/packages/adapter-io/src/memory-emit.ts](https://github.com/gustavomhss/Orchestra-SF/blob/9e4f3d35833f9b2cea6abdf58f42331f3973d9bf/modules/atlas/packages/adapter-io/src/memory-emit.ts) — **imports, linhas 47–62; MemoryEmitDeps/MemoryEmit, linhas 98–112**. A dependência runtime a NO_SCANNER_NAME é exatamente './scanner.js'; o DurableMemory é importado como tipo. Externalizar a aresta declarada mantém o valor utilizado pelo factory, sem importar o store em disco.
5. [modules/atlas/packages/adapter-io/src/memory-read.ts](https://github.com/gustavomhss/Orchestra-SF/blob/9e4f3d35833f9b2cea6abdf58f42331f3973d9bf/modules/atlas/packages/adapter-io/src/memory-read.ts) — **imports, linhas 47–66**. DurableMemory/MemoryRead são type-only. As dependências runtime são funções de @atlas/memory, cuja cadeia Memory/Kernel foi inspecionada; não há uma segunda aresta de scanner nessas portas.
6. [modules/atlas/packages/adapter-io/src/native-bound.ts](https://github.com/gustavomhss/Orchestra-SF/blob/9e4f3d35833f9b2cea6abdf58f42331f3973d9bf/modules/atlas/packages/adapter-io/src/native-bound.ts) — **linhas 3–11 e 12–41**. Entry real é composta por reexports; publica createNativeMemory/decideProjectRule/proposeProjectRule e tipos bound. A alteração aditiva declarada não exige trocar essas funções nem publicar factories crus.
7. [modules/atlas/packages/adapter-io/src/native-memory.ts](https://github.com/gustavomhss/Orchestra-SF/blob/9e4f3d35833f9b2cea6abdf58f42331f3973d9bf/modules/atlas/packages/adapter-io/src/native-memory.ts) — **imports 67–76; createNativeMemory 198–202; recall 270–280; write 300; scannerFor 539–563**. O scanner já pertence à composição nativa; o binding fixa store/root/owner e o recall força owner após estreitar a query. Reexports adicionais do scanner não alteram essas implementações.
8. [modules/atlas/packages/adapter-io/src/scanner.ts](https://github.com/gustavomhss/Orchestra-SF/blob/9e4f3d35833f9b2cea6abdf58f42331f3973d9bf/modules/atlas/packages/adapter-io/src/scanner.ts) — **ScanVerdict/ScannerBinarySpec 40–56; KNOWN_SCANNERS 81; NO_SCANNER_NAME 100; detectAvailableScanner 139; runScanner 165**. Todos os quatro valores e dois tipos prometidos existem na fonte canônica. A função continua retornando clean/hit/could-not-run e permanece no mesmo site já admitido.
9. [modules/atlas/boundary/package.json](https://github.com/gustavomhss/Orchestra-SF/blob/9e4f3d35833f9b2cea6abdf58f42331f3973d9bf/modules/atlas/boundary/package.json) — **exports ./native-memory, linhas 19–22; scripts, linhas 44–49**. O subpath externo proposto já existe, com JS e d.ts. O plano adiciona somente o subpath empresarial e regenera os artefatos afetados.
10. [modules/atlas/boundary/script/build.ts](https://github.com/gustavomhss/Orchestra-SF/blob/9e4f3d35833f9b2cea6abdf58f42331f3973d9bf/modules/atlas/boundary/script/build.ts) — **descritor native-memory; Bun.build/plugins; generateDtsBundle e emissão/check**. O gerador possui resolução por plugin, descritor explícito da native entry e geração separada de JS/d.ts; a alteração proposta cabe nesse arquivo concedido. Mantém a resolução original nos demais descritores.
11. [modules/atlas/boundary/src/generated/native-memory.d.ts](https://github.com/gustavomhss/Orchestra-SF/blob/9e4f3d35833f9b2cea6abdf58f42331f3973d9bf/modules/atlas/boundary/src/generated/native-memory.d.ts) — **exports bound; ScannerBinarySpec 382; AtlasBinding 390; funções 523/531/553**. A declaração existente inclui os contratos bound e já conhece o tipo ScannerBinarySpec. Reexportar explicitamente seus tipos na fonte é compatível com a geração; não requer edição manual de d.ts.
12. [packages/script/package.json](https://github.com/gustavomhss/Orchestra-SF/blob/9e4f3d35833f9b2cea6abdf58f42331f3973d9bf/packages/script/package.json) — **dependencies e exports ./spawn-imports**. @orchestra/script/spawn-imports é um export público real; typescript já é dependência catalog do pacote. A boundary passará a declarar ambas as devDependencies diretamente, sem depender de hoisting incidental.
13. [package.json](https://github.com/gustavomhss/Orchestra-SF/blob/9e4f3d35833f9b2cea6abdf58f42331f3973d9bf/package.json) — **workspaces.packages/catalog.typescript e scripts.check:spawn-imports**. A raiz inclui packages/* e modules/atlas/boundary; typescript do catálogo é 5.8.2 e o comando real check:spawn-imports está definido.
14. [script/check-spawn-imports.ts](https://github.com/gustavomhss/Orchestra-SF/blob/9e4f3d35833f9b2cea6abdf58f42331f3973d9bf/script/check-spawn-imports.ts) — **SOURCE/SKIPPED, linhas 22–23; consulta allowed[file], linhas 49–52**. A regra continua exata por path e cobre .js gerado. O plano novo deixa de exigir child_process no path novo, mantendo o import no path admitido.
15. [script/spawn-allowlist.json](https://github.com/gustavomhss/Orchestra-SF/blob/9e4f3d35833f9b2cea6abdf58f42331f3973d9bf/script/spawn-allowlist.json) — **linhas 23 e 29–32**. scanner.ts e generated/native-memory.js já são admitidos. O plano proíbe qualquer mudança à allowlist e não acrescenta site de spawning.
16. [modules/sucafina/Sucafinav1/docs/sf2h-plan/work-packages/WP10.json](https://github.com/gustavomhss/Orchestra-SF/blob/1feb949244357b8ee7ea7a0c27310281accc7592/modules/sucafina/Sucafinav1/docs/sf2h-plan/work-packages/WP10.json) — **WP10.T07.work/outputs; CHK.10/40/60/61/62; cinco famílias de axiomas**. Entrega deve incluir ambos subpaths, quatro artefatos, AST, guard real inalterado e preservação dos exports bound. Negativos impedem retornar ao bundle defeituoso ou exportar factories brutos na native entry.
17. [modules/sucafina/Sucafinav1/docs/sf2h-plan/ownership.json](https://github.com/gustavomhss/Orchestra-SF/blob/1feb949244357b8ee7ea7a0c27310281accc7592/modules/sucafina/Sucafinav1/docs/sf2h-plan/ownership.json) — **exact_exceptions, technical_allocations e reserva S0-A/WP10.T07**. Nove paths Atlas distintos possuem owner WP10, task T07 e actor S0-A. atlas-scanner.ts e capabilities.ts estão na reserva. package/lock da raiz continuam sob writer existente.
18. [modules/sucafina/Sucafinav1/docs/sf2h-plan/ci-recipes.json](https://github.com/gustavomhss/Orchestra-SF/blob/1feb949244357b8ee7ea7a0c27310281accc7592/modules/sucafina/Sucafinav1/docs/sf2h-plan/ci-recipes.json) — **BUILD-ATLAS, CHECK-ATLAS-GENERATED, TYPECHECK-ATLAS, CHECK-SPAWNS e CI-ATLAS-BUSINESS**. A geração e o guard da raiz têm comandos/receipts explícitos; a suíte da boundary permanece CI. Digests de guard/allowlist e quatro artefatos são obrigatórios.
19. [modules/sucafina/Sucafinav1/docs/sf2h-plan/resident-proof-plan.json](https://github.com/gustavomhss/Orchestra-SF/blob/1feb949244357b8ee7ea7a0c27310281accc7592/modules/sucafina/Sucafinav1/docs/sf2h-plan/resident-proof-plan.json) — **AM05.checks**. Mantém módulo real, scanner clean/canary/ausente/timeout, commit/restart, ACL e idempotência; acrescenta origem dos imports, quatro digests, exports bound e check:spawn-imports.

## Incertezas residuais

- Os quatro artefatos futuros não foram gerados. A ausência final de spawning no bundle empresarial, self-import público, reproducibilidade e declarações só podem ser aceitos após gates reais.
- A regra de resolução exata precisa ser implementada com o triplo match e falhar em ausência/alteração da aresta; um alias global ou externalização incompleta não satisfaz o plano aprovado.
- A preservação de comportamento dos consumidores bound e a identidade das funções reexportadas precisam da suite real da boundary. Scanner, template, owner/root e engine permanecem fora do escopo de alteração.
- Os devDependencies e bun.lock ainda serão materializados pelo writer designado. Existência do catálogo e do export público é evidência de viabilidade, não receipt de instalação/build.
- As 39 rotas conferidas são relações estáticas coerentes. AM02/AM03/AM06 ainda precisam provar chamadas reais, C07, modo host, revogação, expiry/replay e consumidores.
- Os gates de modelo, scanner, identidade revalidável, persistência e ambiente continuam sujeitos a HOLD quando indisponíveis. Nenhuma aprovação de planejamento transforma NOT_RUN em PASS.
- Sem edição de candidato/GitHub, sem testes locais de produto, sem consulta a pareceres de outros revisores. O parecer anterior continua válido para o SHA anterior.

## Caminhos examinados nesta rechecagem

### Candidato

- `modules/sucafina/Sucafinav1/docs/sf2h-plan/contracts.json`
- `modules/sucafina/Sucafinav1/docs/sf2h-plan/campaign.json`
- `modules/sucafina/Sucafinav1/docs/sf2h-plan/agents-atlas-mcp.json`
- `modules/sucafina/Sucafinav1/docs/sf2h-plan/specs/atlas-packaging.md`
- `modules/sucafina/Sucafinav1/docs/sf2h-plan/specs/resident-runtime.md`
- `modules/sucafina/Sucafinav1/docs/sf2h-plan/ownership.json`
- `modules/sucafina/Sucafinav1/docs/sf2h-plan/resident-proof-plan.json`
- `modules/sucafina/Sucafinav1/docs/sf2h-plan/ci-recipes.json`
- `modules/sucafina/Sucafinav1/docs/sf2h-plan/work-packages/WP10.json`
- `modules/sucafina/Sucafinav1/docs/sf2h-plan/work-packages/WP12.json`
- `modules/sucafina/Sucafinav1/docs/sf2h-plan/work-packages/WP09.json`

### Fontes primárias da baseline

- `package.json`
- `packages/script/package.json`
- `packages/script/src/spawn-imports.ts`
- `script/check-spawn-imports.ts`
- `script/spawn-allowlist.json`
- `modules/atlas/boundary/package.json`
- `modules/atlas/boundary/script/build.ts`
- `modules/atlas/boundary/script/tsconfig.json`
- `modules/atlas/boundary/src/generated/native-memory.d.ts`
- `modules/atlas/packages/adapter-io/src/native-bound.ts`
- `modules/atlas/packages/adapter-io/src/native-memory.ts`
- `modules/atlas/packages/adapter-io/src/memory-read.ts`
- `modules/atlas/packages/adapter-io/src/memory-emit.ts`
- `modules/atlas/packages/adapter-io/src/scanner.ts`
- `modules/atlas/packages/memory/src/index.ts`
- `modules/atlas/packages/memory/src/portable.ts`
- `modules/atlas/packages/memory/src/respawn.ts`
- `modules/atlas/packages/memory/src/inject.ts`
- `modules/atlas/packages/memory/src/kinds.ts`
- `modules/atlas/packages/memory/src/awareness.ts`
- `modules/atlas/packages/memory/src/orient.ts`
- `modules/atlas/packages/memory/src/rules.ts`
- `modules/atlas/packages/memory/src/template.ts`
- `modules/atlas/packages/memory/src/logbook.ts`
- `modules/atlas/packages/kernel/src/index.ts`
- `modules/atlas/packages/kernel/src/brand.ts`
- `modules/atlas/packages/kernel/src/encoder.ts`
- `modules/atlas/packages/kernel/src/canonical.ts`
- `modules/atlas/packages/kernel/src/store.ts`
- `modules/atlas/packages/kernel/src/log.ts`
- `modules/atlas/packages/kernel/src/fold.ts`
- `modules/atlas/packages/kernel/src/jsonl.ts`
- `modules/atlas/packages/kernel/src/portable.ts`

**APPROVED_FOR_EXECUTION — escopo técnico de planejamento. implementation_test_status: NOT_RUN.**
