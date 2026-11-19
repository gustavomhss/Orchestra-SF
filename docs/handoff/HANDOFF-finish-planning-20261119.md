# Handoff — finish-planning-20261119

SHA: 5a94a0f657472c8c9de9c9fd42a97dfff7ccd744 (código qualificado; este handoff é o commit seguinte)
Data: 2026-11-19
Estado: complete

## Feito

- Mantida a prova de que revogar a Request interrompe somente o runner original e seu Task child. O teste observa uma passagem do scheduler antes da mesma igualdade exata de `active` com Set vazio.
- Verificada a falha tipada `BridgeError` e seu `reason` exato para o motor sem observador genuíno de governed load. Permanecem zero chamadas ao provider, exatamente um parent e nenhum user prompt.
- Ligada a fixture ao banco SQLite privado por `Database.layerFromPath`, sem substituir Session, runner, coordinator, Task, skill loader ou autoridade. O banco global anterior retinha sete parents de cenários precedentes.
- Requalificados os sete consumidores dos dois specs que usam essa fixture nesta fatia. Acrescentado abaixo o inventário histórico solicitado para planejar os gates dos demais grupos.

## Pendente

- Nenhum pendente na fatia de native planning qualificada abaixo.
- `modules/sucafina/Sucafinav1/test/product/wp08/thread-period-continuity.test.ts:17` — duas jornadas mantêm suas asserções mas excedem o timeout original; o diagnóstico 44577354321 observou 1 pass/2 fail/55 expects. Nova medição de volume de seed está isolada em snapshot e4011fa7bb1697db21cdb9b3088abb7b1f5a976c; não integra esta branch.
- Os locais do catálogo histórico abaixo precisam de migração ou requalificação por grupo. A ausência de um gate posterior nesta tabela não é afirmação de que a falha antiga persiste no head atual.
- Este complete cobre somente native planning. Não é qualificação global de sf-ci ou pacote.

## Decisões e justificativas

- `packages/core/src/session/run-coordinator.ts:145–150` publica o resultado da operação antes de `settle` remover ownership (:83–96). Uma `Effect.yieldNow` observa essa mesma limpeza; o teste não chama interrupt por ID, não apaga active e não amplia timeout.
- `routine-native-phase-bridge.ts:42–44, 370–371` define o erro tipado e preserva a razão do produtor. `Cause.pretty` não serializa esse campo de forma contratual; a igualdade do reason agora é exata.
- `packages/core/src/database/database.ts:50–67` fornece `layerFromPath`, enquanto o node padrão escolhe o Global.Path estático. Só sobrepor `Global.layerWith` na fixture não mudava esse banco. O teste agora usa um arquivo real na pasta privada temporária, pelo mesmo serviço original.
- Asserções removidas: nenhuma regra de negócio/segurança. A verificação textual de pretty foi substituída por classe e reason exatos. A contagem de parents permaneceu 1, sem filtrar os parents antigos para ocultar a falta de isolamento.
- O provider de LLM permanece o stream determinístico explicitamente documentado pela fixture; esta é uma prova de componente e não de uma conta externa, aprovação nativa humana ou Relay em produção.
- Nenhum timeout, skip, baseline, coverage, workflow ou runtime/application.ts alterado.

## Como retomar

1. Integrar a fatia de dois arquivos no responsável por sf-join-four.
2. Continuar continuity e os dois mounts do grupo2; WP5 assumiu grupo1 de browser legado. Root continua Reviews/agenda/source-destinations, e WP2 ingresso/BI.
3. Depois das causas compartilhadas, executar um gate change-scoped agregado com os consumidores históricos realmente afetados. Não inferir a passagem de todos os 8 shards a partir dos pequenos gates desta rodada.
4. Executar o sf-ci final somente pela coordenação do root, após esse agregado.

## Comandos e resultados

| Run | Snapshot / código | Resultado e motivo |
| --- | --- | --- |
| 44577888184 | snapshot 55e453c3726dd92e452948c3d5c8367b001f6af8; base 4c9132 | FAILURE, 2 pass/2 fail/25 expects; ownership ainda visível antes de settle e erro reason omitido por pretty. Job 135750254320; cleanup 135751587443 SUCCESS. |
| 44579589481 | snapshot 06d6b305a16860be67cc68f57b9847fd41a06d2b; código 53e982292f1e35a5a29790e28f1d643528e71d3e | FAILURE, 3 pass/1 fail/27 expects; novo ponto alcançado contou7 parents no banco global. Job 135756309713; cleanup 135757477799 SUCCESS. |
| 44580501918 | snapshot 32db6ed51aaf7eb34e879364744ce4340e813839; código 5a94a0f657472c8c9de9c9fd42a97dfff7ccd744 | SUCCESS, 7 pass/0 fail/50 expects em 2 arquivos, 28.03s. Testjob 135759534520 e cleanup 135761203920 SUCCESS. |

- Run qualificador: https://github.com/gustavomhss/Orchestra-SF/actions/runs/44580501918
- Configuração: `{"package":"sucafina","runner":"bun","args":["Sucafinav1/test/product/native-phase-bridge/planning-runner.test.ts","Sucafinav1/test/product/native-phase-bridge/native-context.test.ts"]}`.
- Branch CI criada atomicamente após o commit da configuração; sem bootstrap sem .ci-run.json.
- Typecheck app-shell e guards: não executados por este gate Bun. sf-ci e package: não disparados.

## Inventário histórico para o fechamento das unidades

Origem: https://github.com/gustavomhss/Orchestra-SF/actions/runs/44551871355. O catálogo registra a primeira linha de stacktrace localizada por arquivo nos logs daquele run. São **124 locais distintos**, incluindo fixtures/limites de composição; isso não equivale ao número de testes nem a um resultado atual. Os jobs cancelados oferecem apenas o trecho que chegou a executar. Este catálogo não altera suites, baseline, coverage ou critérios.

| Shard | Job histórico |
| --- | --- |
| SF1 | 135658029517 |
| SF2 | 135658029414 |
| SF3 | 135658029561 |
| SF4 | 135658029527 |
| SF5 | 135658029528 |
| SF6 | 135658029453 |
| SF7 | 135658029581 |
| SF8 | 135658029571 |

| Local histórico (file:line) | Shard | Situação conhecida / próximo responsável |
| --- | --- | --- |
| `modules/sucafina/Sucafinav1/test/business-browser.test.ts:22` | SF1 | Grupo1; WP5 migra console/fixture; ainda histórico |
| `modules/sucafina/Sucafinav1/test/fixture/local-browser.ts:133` | SF1 | Grupo1; WP5 migra console/fixture; ainda histórico |
| `modules/sucafina/Sucafinav1/test/form-layout.test.ts:32` | SF8 | Grupo1; WP5 migra console/fixture; ainda histórico |
| `modules/sucafina/Sucafinav1/test/full-module.test.ts:70` | SF6 | Grupo1; WP5 migra console/fixture; ainda histórico |
| `modules/sucafina/Sucafinav1/test/io-browser.test.ts:192` | SF3 | Grupo1; WP5 migra console/fixture; ainda histórico |
| `modules/sucafina/Sucafinav1/test/local-controls-browser.test.ts:23` | SF2 | Grupo1; WP5 migra console/fixture; ainda histórico |
| `modules/sucafina/Sucafinav1/test/local-entry.test.ts:120` | SF8 | Fatia posterior qualificada: PR 363; run 44571370644 |
| `modules/sucafina/Sucafinav1/test/microsoft-composition.test.ts:23` | SF7 | Fatia posterior qualificada: PR 359; run 44567379453 |
| `modules/sucafina/Sucafinav1/test/microsoft-first-login.test.ts:50` | SF8 | Fatia posterior qualificada: PR 359; run 44567379453 |
| `modules/sucafina/Sucafinav1/test/microsoft-login/integration-fixture.ts:13` | SF2, SF7 | Histórico; sem gate posterior atribuído neste inventário |
| `modules/sucafina/Sucafinav1/test/microsoft-node.test.ts:30` | SF2 | Fatia posterior qualificada: PR 359; run 44567379453 |
| `modules/sucafina/Sucafinav1/test/microsoft-routes.test.ts:83` | SF2 | Fatia posterior qualificada: PR 359; run 44567379453 |
| `modules/sucafina/Sucafinav1/test/operator-browser.test.ts:30` | SF7 | Grupo1; WP5 migra console/fixture; ainda histórico |
| `modules/sucafina/Sucafinav1/test/operator-identity.test.ts:277` | SF4 | Fatia posterior qualificada: PR 370; run 44580496160 |
| `modules/sucafina/Sucafinav1/test/parity-polling-browser.test.ts:12` | SF1 | Grupo1; WP5 migra console/fixture; ainda histórico |
| `modules/sucafina/Sucafinav1/test/product/auth-retention-fix/races.test.ts:147` | SF4 | Fatia posterior qualificada: PR 370; run 44580496160 |
| `modules/sucafina/Sucafinav1/test/product/bi-cost-waterfall/presentation.test.ts:17` | SF3 | Histórico; sem gate posterior atribuído neste inventário |
| `modules/sucafina/Sucafinav1/test/product/bi-cost-waterfall/rendering.test.ts:20` | SF7 | Histórico; sem gate posterior atribuído neste inventário |
| `modules/sucafina/Sucafinav1/test/product/c12-receipt-recovery/consumer.ts:81` | SF4 | Histórico; sem gate posterior atribuído neste inventário |
| `modules/sucafina/Sucafinav1/test/product/c12-receipt-recovery/recovery-ui.test.ts:72` | SF1 | Histórico; sem gate posterior atribuído neste inventário |
| `modules/sucafina/Sucafinav1/test/product/canonical-read-cost/calculation-sources.test.ts:114` | SF5 | Histórico; sem gate posterior atribuído neste inventário |
| `modules/sucafina/Sucafinav1/test/product/dashboard-installed-closure/confirmation.test.ts:213` | SF1 | Histórico; sem gate posterior atribuído neste inventário |
| `modules/sucafina/Sucafinav1/test/product/dashboard-installed-closure/consumer-read.test.ts:64` | SF6 | Histórico; sem gate posterior atribuído neste inventário |
| `modules/sucafina/Sucafinav1/test/product/dashboard-installed-closure/signals.test.ts:57` | SF4 | Histórico; sem gate posterior atribuído neste inventário |
| `modules/sucafina/Sucafinav1/test/product/dashboard-installed-closure/source-continuity.test.ts:50` | SF1 | Histórico; sem gate posterior atribuído neste inventário |
| `modules/sucafina/Sucafinav1/test/product/diagnostics/calculation/source-observation.test.ts:86` | SF7 | Histórico; sem gate posterior atribuído neste inventário |
| `modules/sucafina/Sucafinav1/test/product/http-body-limit-fix/microsoft-bridge.test.ts:80` | SF3 | Histórico; sem gate posterior atribuído neste inventário |
| `modules/sucafina/Sucafinav1/test/product/installed-bi-closure/numerical-coverage.test.ts:20` | SF3 | Histórico; sem gate posterior atribuído neste inventário |
| `modules/sucafina/Sucafinav1/test/product/installed-bi-closure/sensitivity-history.test.ts:19` | SF5 | Histórico; sem gate posterior atribuído neste inventário |
| `modules/sucafina/Sucafinav1/test/product/installed-bi-closure/temporal-contract.test.ts:12` | SF1 | Histórico; sem gate posterior atribuído neste inventário |
| `modules/sucafina/Sucafinav1/test/product/installed-post-cause/probe.test.ts:141` | SF4 | Grupo2; ci_read migra mount/transporte; ainda histórico |
| `modules/sucafina/Sucafinav1/test/product/integrated-proofs/am02/performance-public-c16-reopen.test.ts:160` | SF7 | Histórico; sem gate posterior atribuído neste inventário |
| `modules/sucafina/Sucafinav1/test/product/native-phase-bridge/planning-runner.test.ts:84` | SF2 | Fatia posterior qualificada: Esta fatia; run 44580501918 |
| `modules/sucafina/Sucafinav1/test/product/operations-functional-closure/mount-boundary.test.ts:97` | SF4 | Grupo2; ci_read migra mount/transporte; ainda histórico |
| `modules/sucafina/Sucafinav1/test/product/proof234/am04-c12-return.test.ts:84` | SF4 | Histórico; sem gate posterior atribuído neste inventário |
| `modules/sucafina/Sucafinav1/test/product/reports-draft-reconciliation/review-read-boundary-fixture.ts:104` | SF1 | Reviews/agenda; root responsável; sem estado atual atribuído aqui |
| `modules/sucafina/Sucafinav1/test/product/reports-draft-reconciliation/review-read-boundary.test.ts:109` | SF1 | Reviews/agenda; root responsável; sem estado atual atribuído aqui |
| `modules/sucafina/Sucafinav1/test/product/review-fixes/finance-resume-performance/persisted-recertification.test.ts:25` | SF8 | Fatia posterior qualificada: PR 366; run 44575131915 |
| `modules/sucafina/Sucafinav1/test/product/review-fixes/procurement-apply/real-apply.test.ts:12` | SF7 | Fatia posterior qualificada: PR 368; run 44577219415 |
| `modules/sucafina/Sucafinav1/test/product/similarity217/installed.test.ts:53` | SF5 | Histórico; sem gate posterior atribuído neste inventário |
| `modules/sucafina/Sucafinav1/test/product/ui-split/ui-recovery/fixture.ts:9` | SF5 | Histórico; sem gate posterior atribuído neste inventário |
| `modules/sucafina/Sucafinav1/test/product/ui-split/ui-recovery/recovery.test.ts:16` | SF5 | Histórico; sem gate posterior atribuído neste inventário |
| `modules/sucafina/Sucafinav1/test/product/ui-split/ui-source/draft-replay.test.ts:32` | SF4 | Histórico; sem gate posterior atribuído neste inventário |
| `modules/sucafina/Sucafinav1/test/product/ui-split/ui-work/guards.test.ts:23` | SF4 | Contrato/guards: manter baseline e verificações; sem estado atual inferido |
| `modules/sucafina/Sucafinav1/test/product/work-split/work-reuse/static-gates.test.ts:27` | SF7 | Contrato/guards: manter baseline e verificações; sem estado atual inferido |
| `modules/sucafina/Sucafinav1/test/product/wp00/baseline-corpus-coverage.test.ts:60` | SF3 | Contrato/guards: manter baseline e verificações; sem estado atual inferido |
| `modules/sucafina/Sucafinav1/test/product/wp00/contract-freeze.test.ts:19` | SF5 | Contrato/guards: manter baseline e verificações; sem estado atual inferido |
| `modules/sucafina/Sucafinav1/test/product/wp01/alternative-contribution.test.ts:46` | SF6 | Histórico; sem gate posterior atribuído neste inventário |
| `modules/sucafina/Sucafinav1/test/product/wp01/http.test.ts:56` | SF6 | Histórico; sem gate posterior atribuído neste inventário |
| `modules/sucafina/Sucafinav1/test/product/wp01/import-receipt-browser.test.ts:26` | SF6 | Histórico; sem gate posterior atribuído neste inventário |
| `modules/sucafina/Sucafinav1/test/product/wp01/personal-views.test.ts:82` | SF6 | Histórico; sem gate posterior atribuído neste inventário |
| `modules/sucafina/Sucafinav1/test/product/wp01/planner-monthly.test.ts:44` | SF5 | Histórico; sem gate posterior atribuído neste inventário |
| `modules/sucafina/Sucafinav1/test/product/wp01/workbench-analysis.test.ts:144` | SF1 | Histórico; sem gate posterior atribuído neste inventário |
| `modules/sucafina/Sucafinav1/test/product/wp02/collaboration-consumer.test.ts:174` | SF5 | Fatia posterior qualificada: PR 361; run 44569329744 |
| `modules/sucafina/Sucafinav1/test/product/wp02/dashboard-browser.test.ts:74` | SF7 | Histórico; sem gate posterior atribuído neste inventário |
| `modules/sucafina/Sucafinav1/test/product/wp02/host-workbench.test.ts:147` | SF1 | Histórico; sem gate posterior atribuído neste inventário |
| `modules/sucafina/Sucafinav1/test/product/wp02/hot-topics.test.ts:33` | SF7 | Causa Hot Topics alterada PR 358/360; conferir consumidor no gate agregado |
| `modules/sucafina/Sucafinav1/test/product/wp02/import-report-consumer.test.ts:100` | SF7 | Histórico; sem gate posterior atribuído neste inventário |
| `modules/sucafina/Sucafinav1/test/product/wp02/workbench-recovery.test.ts:13` | SF3 | Histórico; sem gate posterior atribuído neste inventário |
| `modules/sucafina/Sucafinav1/test/product/wp04/capabilities.test.ts:88` | SF6 | Histórico; sem gate posterior atribuído neste inventário |
| `modules/sucafina/Sucafinav1/test/product/wp04/ui-sourcing-analysis.test.ts:98` | SF6 | Histórico; sem gate posterior atribuído neste inventário |
| `modules/sucafina/Sucafinav1/test/product/wp05/browser.ts:42` | SF8 | Histórico; sem gate posterior atribuído neste inventário |
| `modules/sucafina/Sucafinav1/test/product/wp05/contributions-browser.test.ts:53` | SF7 | Histórico; sem gate posterior atribuído neste inventário |
| `modules/sucafina/Sucafinav1/test/product/wp05/planner-origins.test.ts:97` | SF8 | Histórico; sem gate posterior atribuído neste inventário |
| `modules/sucafina/Sucafinav1/test/product/wp05/view-browser.test.ts:46` | SF4 | Histórico; sem gate posterior atribuído neste inventário |
| `modules/sucafina/Sucafinav1/test/product/wp06/runtime-fixture.ts:46` | SF2 | Histórico; sem gate posterior atribuído neste inventário |
| `modules/sucafina/Sucafinav1/test/product/wp07/browser-ui.test.ts:45` | SF4 | Reviews/agenda; root responsável; sem estado atual atribuído aqui |
| `modules/sucafina/Sucafinav1/test/product/wp07/closure-work.test.ts:70` | SF2 | Reviews/agenda; root responsável; sem estado atual atribuído aqui |
| `modules/sucafina/Sucafinav1/test/product/wp07/comment-continuity.test.ts:100` | SF3 | Reviews/agenda; root responsável; sem estado atual atribuído aqui |
| `modules/sucafina/Sucafinav1/test/product/wp07/projection-access.test.ts:46` | SF5 | Reviews/agenda; root responsável; sem estado atual atribuído aqui |
| `modules/sucafina/Sucafinav1/test/product/wp07/review-port.test.ts:79` | SF1 | Reviews/agenda; root responsável; sem estado atual atribuído aqui |
| `modules/sucafina/Sucafinav1/test/product/wp07/review-thread-context.test.ts:151` | SF5 | Reviews/agenda; root responsável; sem estado atual atribuído aqui |
| `modules/sucafina/Sucafinav1/test/product/wp08/answer-evidence.test.ts:30` | SF6 | Fatia posterior qualificada: PR 362; run 44570928786 |
| `modules/sucafina/Sucafinav1/test/product/wp08/handoff-boundaries.test.ts:47` | SF5 | Fatia posterior qualificada: PR 362; run 44570928786 |
| `modules/sucafina/Sucafinav1/test/product/wp08/handoff-real-boundaries.test.ts:40` | SF8 | Causa Hot Topics alterada PR 358/360; conferir consumidor no gate agregado |
| `modules/sucafina/Sucafinav1/test/product/wp08/handoff-relation-continuity.test.ts:16` | SF5 | Causa Hot Topics alterada PR 358/360; conferir consumidor no gate agregado |
| `modules/sucafina/Sucafinav1/test/product/wp08/handoff.test.ts:44` | SF6 | Causa Hot Topics alterada PR 358/360; conferir consumidor no gate agregado |
| `modules/sucafina/Sucafinav1/test/product/wp08/hot-topic-host.test.ts:34` | SF6 | Causa Hot Topics alterada PR 358/360; conferir consumidor no gate agregado |
| `modules/sucafina/Sucafinav1/test/product/wp08/persistence.test.ts:39` | SF6 | Fatia posterior qualificada: PR 362; run 44570928786 |
| `modules/sucafina/Sucafinav1/test/product/wp08/reissue.test.ts:71` | SF5 | Fatia posterior qualificada: PR 362; run 44570928786 |
| `modules/sucafina/Sucafinav1/test/product/wp08/relations-fixture.ts:35` | SF1, SF2, SF5 | Histórico; sem gate posterior atribuído neste inventário |
| `modules/sucafina/Sucafinav1/test/product/wp09/followup-consumer.test.ts:127` | SF4 | Causa Hot Topics alterada PR 358/360; conferir consumidor no gate agregado |
| `modules/sucafina/Sucafinav1/test/product/wp10/analysis-composition/historical-memory.test.ts:292` | SF7 | Histórico; sem gate posterior atribuído neste inventário |
| `modules/sucafina/Sucafinav1/test/product/wp10/atlas-business/atlas-recovery.test.ts:137` | SF7 | Histórico; sem gate posterior atribuído neste inventário |
| `modules/sucafina/Sucafinav1/test/product/wp10/integration/analysis-stale-calculation.test.ts:303` | SF1 | Histórico; sem gate posterior atribuído neste inventário |
| `modules/sucafina/Sucafinav1/test/product/wp10/integration/bi-access-browser-fixture.ts:198` | SF6 | Histórico; sem gate posterior atribuído neste inventário |
| `modules/sucafina/Sucafinav1/test/product/wp10/integration/bi-call-scope.test.ts:402` | SF2 | Histórico; sem gate posterior atribuído neste inventário |
| `modules/sucafina/Sucafinav1/test/product/wp10/integration/bi-fallback-lifecycle.test.ts:49` | SF1 | Histórico; sem gate posterior atribuído neste inventário |
| `modules/sucafina/Sucafinav1/test/product/wp10/integration/calculation-ancestry-composition.test.ts:26` | SF6 | Histórico; sem gate posterior atribuído neste inventário |
| `modules/sucafina/Sucafinav1/test/product/wp10/integration/composition-test-deadline.ts:5` | SF1, SF3, SF5, SF6, SF7 | Histórico; sem gate posterior atribuído neste inventário |
| `modules/sucafina/Sucafinav1/test/product/wp10/integration/planner-calculation.test.ts:615` | SF5 | Histórico; sem gate posterior atribuído neste inventário |
| `modules/sucafina/Sucafinav1/test/product/wp10/integration/source-destinations.test.ts:40` | SF7 | Reviews/agenda; root responsável; sem estado atual atribuído aqui |
| `modules/sucafina/Sucafinav1/test/product/wp10/memory-integrity/fixture.ts:41` | SF2, SF5 | Histórico; sem gate posterior atribuído neste inventário |
| `modules/sucafina/Sucafinav1/test/product/wp10/memory-integrity/revocation-tail.test.ts:87` | SF2 | Histórico; sem gate posterior atribuído neste inventário |
| `modules/sucafina/Sucafinav1/test/product/wp10/native-host/routine-services.test.ts:34` | SF4 | Histórico; sem gate posterior atribuído neste inventário |
| `modules/sucafina/Sucafinav1/test/product/wp11/fixture-trace.ts:15` | SF4 | Histórico; sem gate posterior atribuído neste inventário |
| `modules/sucafina/Sucafinav1/test/product/wp11/promotion-coverage-proof.test.ts:62` | SF8 | Fatia posterior qualificada: PR 365; run 44572956345 |
| `modules/sucafina/Sucafinav1/test/product/wp11/renewal-source-fixture.ts:122` | SF4 | Histórico; sem gate posterior atribuído neste inventário |
| `modules/sucafina/Sucafinav1/test/product/wp11/source-promotion-coverage.test.ts:182` | SF5 | Histórico; sem gate posterior atribuído neste inventário |
| `modules/sucafina/Sucafinav1/test/product/wp12/native-execution-dashboard-answer.test.ts:264` | SF7 | Histórico; sem gate posterior atribuído neste inventário |
| `modules/sucafina/Sucafinav1/test/product/wp12/native-execution-dependencies.test.ts:60` | SF7 | Histórico; sem gate posterior atribuído neste inventário |
| `modules/sucafina/Sucafinav1/test/product/wp12/native-execution-executive.test.ts:213` | SF2 | Histórico; sem gate posterior atribuído neste inventário |
| `modules/sucafina/Sucafinav1/test/product/wp12/native-execution-question-handoff.test.ts:274` | SF7 | Histórico; sem gate posterior atribuído neste inventário |
| `modules/sucafina/Sucafinav1/test/product/wp12/native-execution-questions.test.ts:340` | SF7 | Histórico; sem gate posterior atribuído neste inventário |
| `modules/sucafina/Sucafinav1/test/product/wp12/native-execution-scenarios-review.test.ts:39` | SF7 | Histórico; sem gate posterior atribuído neste inventário |
| `modules/sucafina/Sucafinav1/test/product/wp12/native-execution-work-list.test.ts:616` | SF6 | Histórico; sem gate posterior atribuído neste inventário |
| `modules/sucafina/Sucafinav1/test/product/wp12/native-mission-harness.ts:154` | SF6, SF7 | Histórico; sem gate posterior atribuído neste inventário |
| `modules/sucafina/Sucafinav1/test/product/wp12/native-portfolio-preparation.ts:150` | SF1, SF4 | Finance/C08: causas compartilhadas PR 366–368; consumidor exige gate agregado |
| `modules/sucafina/Sucafinav1/test/product/wp12/native-procurement-preparation.ts:193` | SF4, SF6 | Histórico; sem gate posterior atribuído neste inventário |
| `modules/sucafina/Sucafinav1/test/product/wp12/native-question-consumer.test.ts:28` | SF6 | Histórico; sem gate posterior atribuído neste inventário |
| `modules/sucafina/Sucafinav1/test/product/wp12/native-question-preparation.ts:106` | SF6, SF7 | Histórico; sem gate posterior atribuído neste inventário |
| `modules/sucafina/Sucafinav1/test/product/wp12/native-verifier-negatives.test.ts:147` | SF6 | Histórico; sem gate posterior atribuído neste inventário |
| `modules/sucafina/Sucafinav1/test/product/wp13/coverage-sensitivity-integration.test.ts:34` | SF4 | Finance/C08: causas compartilhadas PR 366–368; consumidor exige gate agregado |
| `modules/sucafina/Sucafinav1/test/product/wp13/handoff-c08-integration.test.ts:72` | SF2 | Fatia posterior qualificada: PR 367; run 44576825831 |
| `modules/sucafina/Sucafinav1/test/product/wp13/handoff-c08-predispatch.test.ts:242` | SF4 | Finance/C08: causas compartilhadas PR 366–368; consumidor exige gate agregado |
| `modules/sucafina/Sucafinav1/test/product/wp13/handoff-canonical-integration.test.ts:176` | SF4 | Finance/C08: causas compartilhadas PR 366–368; consumidor exige gate agregado |
| `modules/sucafina/Sucafinav1/test/product/wp13/handoff-domain-integration.test.ts:392` | SF4 | Finance/C08: causas compartilhadas PR 366–368; consumidor exige gate agregado |
| `modules/sucafina/Sucafinav1/test/product/wp13/handoff-integration.test.ts:176` | SF7 | Fatia posterior qualificada: PR 367; run 44576825831 |
| `modules/sucafina/Sucafinav1/test/product/wp13/handoff-persistence.test.ts:95` | SF4 | Finance/C08: causas compartilhadas PR 366–368; consumidor exige gate agregado |
| `modules/sucafina/Sucafinav1/test/product/wp13/semantic-union-source-scenario.test.ts:50` | SF6 | Finance/C08: causas compartilhadas PR 366–368; consumidor exige gate agregado |
| `modules/sucafina/Sucafinav1/test/product/wp13/sensitivity-read-scope.test.ts:23` | SF6 | Finance/C08: causas compartilhadas PR 366–368; consumidor exige gate agregado |
| `modules/sucafina/Sucafinav1/test/product/wp14/domain-outcome.test.ts:65` | SF2 | Reviews/agenda; root responsável; sem estado atual atribuído aqui |
| `modules/sucafina/Sucafinav1/test/t8-auth-frontier.test.ts:82` | SF4 | Fatia posterior qualificada: PR 370; run 44580496160 |
| `modules/sucafina/Sucafinav1/test/visual-layout.test.ts:10` | SF3 | Grupo1; WP5 migra console/fixture; ainda histórico |

Os runs posteriores citados qualificam as fatias declaradas em seus próprios handoffs. Mudança de uma fixture compartilhada pode resolver consumidores adicionais, mas esse efeito precisa ser demonstrado pelo gate agregado; a tabela não transforma hipótese em SUCCESS.
