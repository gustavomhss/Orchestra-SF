# Handoff — sf-shard-a

## Estado do checkpoint

- Estado: BASE_ENUMERATED_PARTIAL — os três runs da base encerraram. Shard2 completo; shards1/3 cancelados no limite existente de45min. Nenhuma correção de teste aplicada neste checkpoint.
- Branch: `sf-shard-a`.
- Base fixa de código: `f7dd58e32bc834f1485df20b91adbf759b4c4ad0`.
- Escopo: CI-SF, shards 1, 2 e 3 de 8, módulo `modules/sucafina`.
- Acesso apenas pelo GitHub; verificação apenas por Actions. `sf-ci` não foi executado.
- Este checkpoint não declara testes verdes, cobertura completa nem GO.

## Preparação corrigida

Na base, o exemplo literal do briefing não é executável:

1. `.github/workflows/test-ci.yml:30-37` aceita somente branches `ci-run-linux-*`.
2. `script/test-ci-request.ts:96-98` exige `args` e valida o ambiente. Os únicos envs permitidos estão em `:12-15`; `SF_SUITE_ID`, `SF_SHARD_INDEX` e `SF_SHARD_COUNT` não são aceitos.
3. `script/test-ci-package.ts:20-35` resolve alias/nome registrado, não o caminho bruto `modules/sucafina`. `script/module-registry.json:35` registra alias `sucafina` para esse diretório.

Requisição efetiva: `package: "sucafina"`, `directory: "modules/sucafina"`, `runner: "bun"`, `args: ["--timeout", "30000", ...arquivosExatosDoShard]`, `env: { "ORCHESTRA_EXPERIMENTAL_OMNI_SPAWNER": "1" }`. O timeout de 30000 é o valor canônico de `.github/workflows/sf-ci.yml:410`; não foi aumentado.

As listas foram derivadas da árvore Git completa e das exclusões já presentes em `sf/ci/suites.json`, aplicando literalmente a partição de `script/sf-ci/gate.mjs:98-112`: SHA256 do caminho relativo ao módulo, primeiros 16 hexadecimais, módulo 8, índice iniciado em 1. Duas derivações independentes concordaram. 924 arquivos brutos menos 40 harness-owned menos 1 release-only = 883 selecionados. Contagens dos oito shards: 113, 107, 99, 118, 119, 109, 103, 115.

| Shard | Arquivos | SHA256 da lista ordenada unida por LF |
| --- | ---: | --- |
| 1 | 113 | `4e8be6efc441cc70161d6e0fcb7fa0ddf9af22c7cf30155c28353a8fc516de2a` |
| 2 | 107 | `821b4521fbf5c5727d52c280ad7a04e7742064b95b1e6c915b2e3df505d01eab` |
| 3 | 99 | `2ca0d89ae5a19956d5c1b62e67bb053c326d141f268862be3f19871217b6b553` |

Esses hashes identificam somente a seleção derivada, não uma cobertura executada.

## Runs de enumeração

| Shard | Run | Snapshot | Resultado observado neste checkpoint |
| --- | --- | --- | --- |
| 1 | [44646013868](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44646013868) | `a4bbf6b042526a0ee3f544243cfa67158236f871` | CANCELLED; 558 PASS observados, 21 marcadores FAIL + 1 falha de asserção sem footer. Sem resumo final |
| 2 | [44646018333](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44646018333) | `dcb0c68d7e866b4df2153eadd26fda2eab45b266` | FAILURE; 504 pass / 10 fail / 1 skip / 1 error; 515 testes, 107 arquivos |
| 3 | [44651344557](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44651344557) | `bce2f0ed56f7073254b4316853eca2ed0c0f5fcb` | CANCELLED; 255 pass / 21 fail observados; 66/99 arquivos iniciados; sem resumo final Bun |

Os snapshots são commits filhos diretos da base, alterando apenas `.ci-run.json`; as branches temporárias são apagadas pelo próprio workflow. Cada requisição permanece legível no SHA do snapshot.

### Falhas de preparação, sem execução de testes

- [44645838424](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44645838424), shard 1, snapshot `c5eaa82f3c8af3200a2a75ee75ea7006efe4a4cf`, job `135988044990`: FAILURE em `script/test-ci-package.ts:35`, `TEST_PACKAGE_NOT_FOUND:modules/sucafina`.
- [44645842999](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44645842999), shard 2, snapshot `77fe323aa101ef11b9d382118ef81ea3f242f4c6`, job `135988061331`: mesma falha de preparação.

Nenhum teste Bun foi executado nesses dois runs; não equivalem a 0 pass / 0 fail. A requisição foi corrigida antes das novas enumerações, sem alteração dos testes da base.

## Falhas enumeradas — shard 2

Prefixo dos caminhos abaixo: `modules/sucafina/Sucafinav1/test/`.

| File:line | Classificação / evidência |
| --- | --- |
| `product/mixed-source-contracts/recorded-fallback.test.ts:11` | Deadline cooperativo 165000ms; proof emitido ao fim das asserções quando o orçamento já estava excedido (~165444ms). close() propaga a expiração; await caro não isolado, sem evidência de cleanup lento. |
| `product/wp08/thread-period-continuity.test.ts:17` | Hot Topic day excede 30000ms; await causador não identificado. Timeout, sem aumento autorizado. |
| `product/wp05/sensitivity-integration.test.ts:9; product/wp05/browser.ts:9` | Chrome launch excede 180000ms; também produz erro não tratado. Lifecycle do Chrome sob Bun; avaliação de fixture compartilhada pendente. |
| `product/operations-fixes/document-search.test.ts:5` | SQLITE_IOERR em runtime/local-store.ts:55 durante autenticação via product/wp06/runtime-fixture.ts:30. Causa final não demonstrada; não atribuir a disco cheio/cleanup sem prova. |
| `product/wp12/native-execution-collaboration-recall.test.ts:143` | Timeout120000ms; prova de pending input emitida, reabertura não comprovada. Desempenho/await sem causa isolada. |
| `product/wp12/native-execution-executive.test.ts:213` | Oracle desatualizado: recebido denied/case-selection-unavailable. Guard C08 precede produtor. Fix concreto proposto, ainda não aplicado. |
| `product/wp10/integration/bi-call-scope.test.ts:402` | unbound: projeção BI09 real sem Planner record drilldown. scenario-bi.ts:47–51 só fornece drilldown para uma única referência; não fabricar alvo. |
| `product/wp10/memory-integrity/revocation-tail.test.ts:87` | unbound: produtor não entrega prova histórica completa no positivo, antes da revogação; analysis-source-unavailable. |
| `product/wp10/memory-integrity/revocation-tail.test.ts:104` | unbound: verifier positivo unavailable antes da revogação; mesma família da prova histórica incompleta. |
| `product/wp10/memory-integrity/revocation-tail.test.ts:124` | unbound: output-proof positivo unavailable antes da revogação; mesma família. |

Skip preexistente: `local-backups.test.ts:209`, condição de usuário root. Erro não tratado: mesma causa do Chrome em `product/wp05/browser.ts:9`; não é uma 11ª falha de teste independente. Nenhum skip foi adicionado.

## Limite observado — shard 1

O job `135988658580` foi cancelado ao atingir os 45 minutos existentes. Não houve resumo final do Bun: as contagens são marcadores observados, não resultado completo. Há 557 linhas iniciadas com PASS e um PASS intercalado no diff, totalizando 558. Há 21 marcadores FAIL e uma falha explícita adicional em `product/routine-native-admission/adapter-boundaries.test.ts:113`, cujo footer não foi emitido no diff.

Entraram 102/113 arquivos; `product/wp10/analysis-composition/alternative-selection.test.ts:375` estava em execução na interrupção. Seus testes em :441, :510, :573, :606 e :626 não iniciaram. As 22 falhas observadas estão classificadas abaixo; arquivos sem header não são declarados como aprovados.

### Falhas observadas — shard 1

Prefixo: `modules/sucafina/Sucafinav1/test/`. A última falha da tabela é uma asserção explícita sem footer FAIL; o run cancelado não fornece contagem final.

| File:line | Classe | Evidência / próximo passo |
| --- | --- | --- |
| `runtime-http.test.ts:169` | unbound/UI legado | Botão Add risk não localizado; teste mantém contrato do console descomissionado. Não recriar console. |
| `business-browser.test.ts:22; business-browser.test.ts:49` | unbound/UI legado | Navegação :4110 recusada. Cenário de formulário legado; não redirecionar o browser para esse serviço. |
| `business-browser.test.ts:210` | unbound/UI legado | Navegação :4110 recusada no cenário de duas abas. |
| `parity-polling-browser.test.ts:10` | unbound/UI legado | Navegação :4110 recusada; cenário de polling do console legado. |
| `product/wp02/host-workbench.test.ts:147` | unbound/UI legado | Enrollment seguido de redirect sem superfície HTML; cenário exige controles do console descomissionado. |
| `product/wp02/host-workbench.test.ts:280` | unbound/UI legado | Mesmo fluxo de enrollment/HTML ausente, caso de conflito de draft. |
| `product/wp02/host-workbench.test.ts:468` | unbound/UI legado | Mesmo fluxo de enrollment/HTML ausente, caso de revogação de escrita. |
| `product/wp10/integration/public-state.test.ts:49` | unbound/UI legado | Renderização de audit legado esperada200 recebe404; não restaurar o console. |
| `product/wp10/integration/bi-fallback-lifecycle.test.ts:49` | unbound/UI legado | Enrollment/redirect para antiga superfície BI falha; contrato legado indisponível. |
| `product/installed-bi-closure/temporal-contract.test.ts:12` | timeout/desempenho | Deadline cooperativo165000ms excedido; não elevar orçamento. |
| `product/installed-bi-closure/temporal-contract.test.ts:69` | timeout/desempenho | Segundo caso excede165000ms; helper composition-test-deadline.ts:5. Stackdecleanup:61 não é o início desse segundo caso. |
| `product/wp13/source-scenario.test.ts:32` | timeout/desempenho | Cenário Portfolio excede180000ms; causa cara ainda não isolada. |
| `product/c12-receipt-recovery/recovery-ui.test.ts:72` | unbound/produtor UI | Produtor decision-apply.ts:38 reabilita Apply reviewed change sem Retry same application; não fornece a recuperação exigida. |
| `product/c12-receipt-recovery/recovery-ui.test.ts:197` | unbound/produtor UI | decision-apply.ts:10 não tem data-recover-change, e script não chama decision-recover. Consumer é UI local real, não console legado. |
| `product/wp12/native-execution-portfolio.test.ts:14; product/wp12/native-portfolio-preparation.ts:150` | precondição de fixture | Fixture registra coverage completa e baseline sem operações; scenario-port.ts:107–118 retorna total240000/complete. Helper:139–153 aplica indevidamente expectativas de alternativa condicionada ao baseline. Não alterar total real nem enfraquecer cobertura. |
| `product/wp12/native-execution-portfolio.test.ts:134; product/wp12/native-portfolio-preparation.ts:150` | precondição de fixture | Fixture registra coverage completa e baseline sem operações; scenario-port.ts:107–118 retorna total240000/complete. Helper:139–153 aplica indevidamente expectativas de alternativa condicionada ao baseline. Não alterar total real nem enfraquecer cobertura. |
| `product/wp01/workbench-analysis.test.ts:144` | unbound/produtor HTTP | prepareInput em product/interface/analysis-http.ts:79 exclui as skills de enquadrar/contestar exigidas pelo positivo. HTTP400 em vez de200; não reduzir o positivo a rejeição. |
| `product/wp01/workbench-analysis.test.ts:380` | fixture-contract | Revogação injetada via models não ocorre em action output. models só participa de start; preservar403/denied/fechamento de lease e migrar injeção em fatia própria. |
| `product/wp10/integration/analysis-stale-calculation.test.ts:303` | fixture-contract | BCS original retorna historical; teste ainda espera unavailable de contrato antigo com lease privado. |
| `product/wp10/integration/analysis-stale-calculation.test.ts:346` | fixture-contract | Mutação injetada só no private read não ocorre; produtor atual usa o mesmo call original. Não trocar denied porok. |
| `product/wp10/integration/analysis-stale-calculation.test.ts:410` | fixture-contract | Fault de private admission nunca dispara. Migrar adversários ao Request/authorize/context atuais mantendo fences e negativos, sem remover assertions. |
| `product/routine-native-admission/adapter-boundaries.test.ts:113` | oracle desatualizado | Descriptor registrado depende da publication; owner é revalidado por invocação. Fix concreto pendente antes da primeira fatia. |

A fixture de cálculo histórico ainda injeta falhas em uma admissão privada que deixou de existir. `apps/cli/src/sucafina-product/business-services.ts:356–392` usa escopo histórico lexical sobre o mesmo call/Request; `analysis-stale-commit.ts:53–55,83–86` mantém identidade, autorização antes/depois e digest do snapshot. Migrar o conjunto dos adversários para esses pontos atuais em uma fatia dedicada; não trocar denied por ok nem aceitar `every([])` como prova.

Arquivos não iniciados, prefixo `modules/sucafina/Sucafinav1/test/product/`:

- `diagnostics/memory/persistence-observer.test.ts`
- `integrated-proofs/am04/receipt-key-collision.test.ts`
- `integrated-proofs/am05/authorized-original-replay.test.ts`
- `integrated-proofs/am05/c08-rollback.test.ts`
- `review-fixes/procurement-apply/refusals.test.ts`
- `wp06/documents/docx.test.ts`
- `wp06/documents/request-selection.test.ts`
- `wp06/documents/ws3-rejection.test.ts`
- `wp06/imports/admission-boundaries.test.ts`
- `wp06/imports/detail.test.ts`
- `wp06/imports/export-download-privacy.test.ts`

Os arquivos acima são pendência de execução, não falhas observadas nem PASS. Nenhum gate idêntico será repetido apenas para obter uma contagem.

## Falhas observadas — shard 3

Prefixo: `modules/sucafina/Sucafinav1/test/`. Job136006716047 cancelled; cleanup136025186224 success. São255 marcadores PASS e21 FAIL; não há resumo final, marcador skip/todo nem Unhandled error. O grande HTML/diff pertence à falha procurement-integration:180, sem falha adicional oculta.

| File:line | Classe inicial | Evidência / pendência |
| --- | --- | --- |
| `io-browser.test.ts:26` | unbound/UI legado | ERR_CONNECTION_REFUSED em :4110; primeira jornada. |
| `io-browser.test.ts:114` | unbound/UI legado | ERR_CONNECTION_REFUSED em :4110; segunda jornada. |
| `visual-layout.test.ts:37` | unbound/UI legado | POST ECONNREFUSED no serviço legado; teste declarado em :15. |
| `product/wp05/procurement-integration.test.ts:180` | contrato de projeção/UI | not.toContain falhou no HTML após revogação; causa detalhada em investigação. |
| `product/wp13/sensitivity-units-boundary.test.ts:54` | timeout/desempenho | Timeout Bun30000ms; duração observada74999ms. |
| `product/wp13/persistence-recovery.test.ts:21` | timeout/desempenho | Timeout Bun30000ms; duração observada31236ms. |
| `product/operations-fixes/c12-concurrency.test.ts:34` | contrato C12 | Diferença de resultado na primeira jornada; causa detalhada em investigação. |
| `product/operations-fixes/c12-concurrency.test.ts:103` | contrato C12 | Diferença de resultado no controle de API; causa detalhada em investigação. |
| `product/installed-bi-closure/numerical-coverage.test.ts:20` | timeout/desempenho | Caso omitted: deadline cooperativo165000ms excedido. |
| `product/installed-bi-closure/numerical-coverage.test.ts:20` | timeout/desempenho | Caso confirmed: deadline cooperativo165000ms excedido. |
| `product/installed-bi-closure/numerical-coverage.test.ts:20` | timeout/desempenho | Caso zero: deadline cooperativo165000ms excedido. |
| `product/installed-bi-closure/numerical-coverage.test.ts:20` | timeout/desempenho | Caso null: deadline cooperativo165000ms excedido. |
| `product/wp12/native-execution-bi-kpi.test.ts:312` | contrato BI | readSourceLinks falha; causa detalhada em investigação. |
| `product/wp12/native-execution-bi-public-selection.test.ts:326` | contrato BI | assertPresentation falha; causa detalhada em investigação. |
| `product/bi-cost-waterfall/presentation.test.ts:17` | timeout/desempenho | Deadline cooperativo105000ms excedido; não elevar orçamento. |
| `product/bi-cost-waterfall/presentation.test.ts:66` | timeout/desempenho | Deadline cooperativo105000ms excedido; não elevar orçamento. |
| `product/bi-cost-waterfall/presentation.test.ts:97` | timeout/desempenho | Deadline cooperativo105000ms excedido; não elevar orçamento. |
| `product/bi-cost-waterfall/presentation.test.ts:113` | timeout/desempenho | Deadline cooperativo105000ms excedido; não elevar orçamento. |
| `product/bi-cost-waterfall/presentation.test.ts:133` | timeout/desempenho | Deadline cooperativo105000ms excedido; não elevar orçamento. |
| `product/bi-cost-waterfall/presentation.test.ts:242` | timeout/desempenho | Deadline cooperativo105000ms excedido; não elevar orçamento. |
| `product/wp00/baseline-corpus-coverage.test.ts:60` | contrato de inventário | Asserção de vínculo de requirements/journeys falha; não forjar baseline/coverage. |

O último arquivo `product/wp08/review-answer-confirmation.test.ts` teve5 PASS e foi interrompido no sexto caso, `:228`, após `current-lease reply-denied-at-last-human-await`. Não contar essa interrupção como falha emitida.

### Arquivos não iniciados no shard 3

Caminhos relativos a `modules/sucafina/`:

- `Sucafinav1/test/product/c12-receipt-recovery/normal-retry.test.ts`
- `Sucafinav1/test/product/reports-draft-reconciliation/installed-read-integrity.test.ts`
- `Sucafinav1/test/product/review-fixes/finance-resume-performance/journey-phase.test.ts`
- `Sucafinav1/test/product/review-fixes/import-recovery/apply-restart.test.ts`
- `Sucafinav1/test/product/ui-split/ui-source/static-checks.test.ts`
- `Sucafinav1/test/product/ui-split/ui-work/static-gates.test.ts`
- `Sucafinav1/test/product/wp02/backup-consumer.test.ts`
- `Sucafinav1/test/product/wp02/keyed-update.test.ts`
- `Sucafinav1/test/product/wp02/kpi-comparison.test.ts`
- `Sucafinav1/test/product/wp02/prepared.test.ts`
- `Sucafinav1/test/product/wp02/review-completion.test.ts`
- `Sucafinav1/test/product/wp02/signals.test.ts`
- `Sucafinav1/test/product/wp02/workbench-recovery.test.ts`
- `Sucafinav1/test/product/wp06/documents/resolver.test.ts`
- `Sucafinav1/test/product/wp06/imports/dashboard-backup-e2e.test.ts`
- `Sucafinav1/test/product/wp06/imports/end-to-end.test.ts`
- `Sucafinav1/test/product/wp06/imports/planner-roundtrip-runtime.test.ts`
- `Sucafinav1/test/product/wp06/imports/roster-runtime.test.ts`
- `Sucafinav1/test/product/wp06/imports/sqlite-planner.test.ts`
- `Sucafinav1/test/product/wp08/answer-reuse.test.ts`
- `Sucafinav1/test/product/wp08/case-selection-cas.test.ts`
- `Sucafinav1/test/product/wp08/collaboration-journey.test.ts`
- `Sucafinav1/test/product/wp08/confirmation-real-dependencies.test.ts`
- `Sucafinav1/test/product/wp08/mutation-fence.test.ts`
- `Sucafinav1/test/product/wp08/work-presentation.test.ts`
- `Sucafinav1/test/product/wp10/integration/browser-bundle-literals.test.ts`
- `Sucafinav1/test/product/wp10/integration/dashboard-preview.test.ts`
- `Sucafinav1/test/product/wp10/integration/memory-services.test.ts`
- `Sucafinav1/test/product/wp10/integration/portfolio-reconciliation.test.ts`
- `Sucafinav1/test/product/wp10/integration/store-read-scope.test.ts`
- `Sucafinav1/test/product/wp10/integration/ui-authority.test.ts`
- `Sucafinav1/test/product/wp10/memory-integrity/identity.test.ts`
- `Sucafinav1/test/product/wp10/native-host/execution-host-guard.test.ts`

## Feito / pendente

Feito: branch isolada; seleção dos três shards conferida; requisição compatível; shard 2 concluído e classificado; shard 1 cancelado sem repetição; shard 3 iniciado somente após shard 2 terminar. Nunca houve mais de dois gates simultâneos.

Pendente: concluir a classificação detalhada do shard3; aplicar duas fatias comprovadas (adapter descriptors no shard 1 e guard C08 no shard 2), com um gate completo por causa. Demais causas permanecem classificadas, com suas asserções intactas.

Asserções removidas: nenhuma até este checkpoint. Testes pulados/removidos: nenhum. Produto, projeções, fixtures e workflows: nenhuma alteração.

### Justificativas das duas substituições propostas

- Adapter (`product/routine-native-admission/adapter-boundaries.test.ts:113`): a expectativa de array vazio para qualquer perda de binding será substituída pela lista exata de cinco IDs quando publication existir, e por array vazio somente quando publication faltar. A ausência de watch permanece coberta pela lista fechada. Será acrescentada a chamada real de `routines.readAdmission`, exigindo o erro exato de reader indisponível e contadores exatamente zero. Não é uma redução para nonempty/truthy.
- Executive (`product/wp12/native-execution-executive.test.ts:213`): o oracle parcial `unavailable/analysis-source-unavailable` será substituído por HTTP403 e body exato `denied/case-selection-unavailable`, pois o guard C08 externo precede o produtor. Todas as asserções de digest, preservação histórica, downloads GET reais e recusa anônima permanecem.

Essas propostas ainda não foram aplicadas neste checkpoint. Os três runs encerraram e suas listas de falhas foram publicadas antes de qualquer correção.

## Como retomar

1. Os três runs de enumeração estão encerrados; não repetir gates idênticos. Shards1/3 têm resultados parciais por limite do job.
2. Ler logs dos jobs 135988658580 (shard 1) e 135988673159 (shard 2). Preservar a distinção entre enumeração parcial e resumo final.
3. Os três ledgers da base foram publicados antes das correções; completar a classificação das causas do shard3 enquanto as fatias revisadas são verificadas.
4. Fix concreto identificado: `product/wp12/native-execution-executive.test.ts:213`. A recusa acontece em `apps/cli/src/sucafina-product/business-services.ts:289–291`, antes do produtor (`analysis-host-services.ts:271`); `analysis-http.ts:102` mapeia denied para 403. Substituir o oracle interno por HTTP403 e body exato, mantendo digests e downloads reais.
5. Corrigir apenas causas comprovadas. Manter `runtime/application.ts` intacto. Não recriar console descomissionado, não elevar timeouts nem falsificar baseline/coverage/digest/GO.
6. Mudanças compartilhadas devem ir a PR pequeno separado com `shared:` no título; integrador faz esse merge primeiro. Nenhuma mudança compartilhada aplicada até agora.
7. Registrar produtor sem dado requerido como `unbound`, com file:line. Atualizar este handoff com SHA, evidências e ordem de integração finais.
