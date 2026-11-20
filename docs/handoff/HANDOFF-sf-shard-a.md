# Handoff — sf-shard-a

## Estado do checkpoint

- Estado: **SHARD3_FIX_GATE_IN_PROGRESS**. Os shards 1 e 2 têm resultados completos e todas as suas falhas atuais classificadas. A enumeração inicial do shard 3 foi parcial; seu gate após a correção de sentinela está em andamento.
- Branch: `sf-shard-a`.
- Base fixa: `f7dd58e32bc834f1485df20b91adbf759b4c4ad0`.
- SHA atual de código: `a86e22c9654663a72bd55586059a4254f548c742`.
- Escopo: CI-SF, shards 1, 2 e 3 de 8, módulo `modules/sucafina`.
- Acesso somente pelo GitHub; verificação somente por Actions. `sf-ci` não foi executado.
- Quatro fatias de teste aplicadas; só o run `44665621967` está em andamento nesta sessão. A enumeração de todos os shards encerrou antes do primeiro fix.
- Este checkpoint não declara shards verdes, execução completa do shard 3, cobertura de release nem GO.

| Shard | Último run | Resultado | SHA do fix |
| --- | --- | --- | --- |
| 1 | [44657265518](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44657265518) | 576 pass / 29 fail; completo | `243c083dfef4caefddf88c64adb46ab7f7b88b2f` |
| 2 | [44661562191](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44661562191) | 508 pass / 6 fail; 1 skip / 1 error; completo | `2ee5e96198500ed9d2524b692240b90cce86ed79` |
| 3 | [44665621967](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44665621967) | Em andamento. Base: 255 pass / 21 fail observados, parcial | `a86e22c9654663a72bd55586059a4254f548c742` |

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

A seleção foi materializada nos arquivos exatos. Não foi encontrada dependência de `SF_SUITE_ID`, `SF_SHARD_INDEX` ou `SF_SHARD_COUNT` nos corpos de teste e nos caminhos auditados. Uma revisão adicional leu integralmente 48 arquivos no SHA base: configuração/preloads/Omni (12), helpers (7), runtime (5), produtores (13), composição CLI (10) e rotas (1). O controle Omni usa variáveis próprias em `script/test-omni-control.ts:29–45`; os registros de missão usam `GITHUB_SHA`.

Limite dessa revisão: `packages/core/src/omni.ts:159–170`, `omni-spawner.ts:124–128` e `cross-spawn-spawner.ts:47` herdam ambiente genericamente, sem interpretar esses seletores. Não foi exaurido todo o grafo transitivo nem as dependências externas; buscas indexadas incompletas não foram tratadas como prova de ausência. Os três envs têm consumidores conhecidos de seleção/evidência em `script/sf-ci/gate.mjs:117–119,606,618–619,635–668`. Os resultados deste handoff são resultados Bun observados, sem alegação de equivalência aos gates de release, coverage, receipt ou à execução integral de `sf-ci`.

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
| `product/mixed-source-contracts/recorded-fallback.test.ts:11` | Deadline cooperativo 165000 ms; proof emitido ao fim das asserções quando o orçamento já estava excedido (~165444 ms). close() propaga a expiração; await caro não isolado, sem evidência de cleanup lento. |
| `product/wp08/thread-period-continuity.test.ts:17` | Hot Topic day excede 30000 ms; await causador não identificado. Timeout, sem aumento autorizado. |
| `product/wp05/sensitivity-integration.test.ts:9; product/wp05/browser.ts:9` | Chrome launch excede 180000 ms; também produz erro não tratado. Lifecycle do Chrome sob Bun; avaliação de fixture compartilhada pendente. |
| `product/operations-fixes/document-search.test.ts:5` | SQLITE_IOERR em runtime/local-store.ts:55 durante autenticação via product/wp06/runtime-fixture.ts:30. Causa final não demonstrada; não atribuir a disco cheio/cleanup sem prova. |
| `product/wp12/native-execution-collaboration-recall.test.ts:143` | Timeout 120000 ms; prova de pending input emitida, reabertura não comprovada. Desempenho/await sem causa isolada. |
| `product/wp12/native-execution-executive.test.ts:213` | Oracle desatualizado: recebido denied/case-selection-unavailable. Guard C08 precede produtor. Primeira fatia aplicada em `d582fe3` e recusa C08 confirmada; o caso avançou até a falha de header descrita no histórico dos gates. |
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
| `product/wp10/integration/public-state.test.ts:49` | unbound/UI legado | Renderização de audit legado esperada 200 recebe 404; não restaurar o console. |
| `product/wp10/integration/bi-fallback-lifecycle.test.ts:49` | unbound/UI legado | Enrollment/redirect para antiga superfície BI falha; contrato legado indisponível. |
| `product/installed-bi-closure/temporal-contract.test.ts:12` | timeout/desempenho | Deadline cooperativo165000 ms excedido; não elevar orçamento. |
| `product/installed-bi-closure/temporal-contract.test.ts:69` | timeout/desempenho | Segundo caso excede 165000 ms; helper composition-test-deadline.ts:5. Stack reportado em :61 não é o início desse segundo caso. |
| `product/wp13/source-scenario.test.ts:32` | timeout/desempenho | Cenário Portfolio excede 180000 ms; causa cara ainda não isolada. |
| `product/c12-receipt-recovery/recovery-ui.test.ts:72` | unbound/produtor UI | Produtor decision-apply.ts:38 reabilita Apply reviewed change sem Retry same application; não fornece a recuperação exigida. |
| `product/c12-receipt-recovery/recovery-ui.test.ts:197` | unbound/produtor UI | decision-apply.ts:10 não tem data-recover-change, e script não chama decision-recover. Consumer é UI local real, não console legado. |
| `product/wp12/native-execution-portfolio.test.ts:14; product/wp12/native-portfolio-preparation.ts:150` | precondição de fixture | Fixture registra coverage completa e baseline sem operações; scenario-port.ts:107–118 retorna total 240000/complete. Helper:139–153 aplica indevidamente expectativas de alternativa condicionada ao baseline. Não alterar total real nem enfraquecer cobertura. |
| `product/wp12/native-execution-portfolio.test.ts:134; product/wp12/native-portfolio-preparation.ts:150` | precondição de fixture | Fixture registra coverage completa e baseline sem operações; scenario-port.ts:107–118 retorna total 240000/complete. Helper:139–153 aplica indevidamente expectativas de alternativa condicionada ao baseline. Não alterar total real nem enfraquecer cobertura. |
| `product/wp01/workbench-analysis.test.ts:144` | unbound/produtor HTTP | prepareInput em product/interface/analysis-http.ts:79 exclui as skills de enquadrar/contestar exigidas pelo positivo. HTTP400 em vez de 200; não reduzir o positivo a rejeição. |
| `product/wp01/workbench-analysis.test.ts:380` | fixture-contract | Revogação injetada via models não ocorre em action output. models só participa de start; preservar 403/denied/fechamento de lease e migrar injeção em fatia própria. |
| `product/wp10/integration/analysis-stale-calculation.test.ts:303` | fixture-contract | BCS original retorna historical; teste ainda espera unavailable de contrato antigo com lease privado. |
| `product/wp10/integration/analysis-stale-calculation.test.ts:346` | fixture-contract | Mutação injetada só no private read não ocorre; produtor atual usa o mesmo call original. Não trocar denied por ok. |
| `product/wp10/integration/analysis-stale-calculation.test.ts:410` | fixture-contract | Fault de private admission nunca dispara. Migrar adversários ao Request/authorize/context atuais mantendo fences e negativos, sem remover assertions. |
| `product/routine-native-admission/adapter-boundaries.test.ts:113` | oracle desatualizado | Descriptor registrado depende da publication; owner é revalidado por invocação. Corrigido no commit243c083; o caso e os demais cinco testes do arquivo passaram no gate 44657265518. |

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

Os arquivos acima não iniciaram na enumeração da base. O gate 44657265518, após o fix concreto de descriptors, executou todos eles; não há arquivo pendente no resultado atual do shard 1. O registro histórico da enumeração parcial foi preservado.

## Falhas observadas — shard 3

Prefixo: `modules/sucafina/Sucafinav1/test/`. Job 136006716047 cancelled; cleanup 136025186224 success. São 255 marcadores PASS e 21 FAIL; não há resumo final, marcador skip/todo nem Unhandled error. O grande HTML/diff pertence à falha procurement-integration:180, sem falha adicional oculta.

| File:line | Classe | Evidência / próximo passo |
| --- | --- | --- |
| `io-browser.test.ts:26` | unbound/UI legado | ERR_CONNECTION_REFUSED em :4110; primeira jornada. |
| `io-browser.test.ts:114` | unbound/UI legado | ERR_CONNECTION_REFUSED em :4110; segunda jornada. |
| `visual-layout.test.ts:37` | unbound/UI legado | POST ECONNREFUSED no serviço legado; caso declarado em :15. |
| `product/wp05/procurement-integration.test.ts:180` | falso positivo de fixture | O sentinel privado `hidden` colide com o atributo HTML legítimo `<fieldset hidden>`. A projeção e a seleção anteriores passaram. Próxima fatia: sentinel inequívoco no seed e em todos os checks, mantendo data privada e revogação. |
| `product/wp13/sensitivity-units-boundary.test.ts:54` | timeout/desempenho | Timeout Bun de 30000 ms; duração observada de 74999 ms, após replay-ready em ~73119 ms. Await caro não isolado; manter orçamento. |
| `product/wp13/persistence-recovery.test.ts:21` | timeout/desempenho | Timeout Bun de 30000 ms; duração de 31236 ms na segunda variação portfolioRecovery(after). Await exato não isolado. |
| `product/operations-fixes/c12-concurrency.test.ts:34` | oracle C12 desatualizado | Esperado409, recebido200. A fixture altera só objective/version após receipt; apply.ts:125–162 reconcilia edits não relacionados e mantém fences de choice/change. Migrar a contraprova inteira, sem apenas trocar409 por200. |
| `product/operations-fixes/c12-concurrency.test.ts:103` | oracle C12 desatualizado | Mesma causa do caso anterior. O teste para antes de provar retry/reload; preservar controles de receipt e autorização. |
| `product/installed-bi-closure/numerical-coverage.test.ts:20` | timeout/desempenho | Caso omitted: deadline de 165000 ms em advantage.persist, após comparison.persist custar ~112–125s. Não há falha numérica comprovada. |
| `product/installed-bi-closure/numerical-coverage.test.ts:20` | timeout/desempenho | Caso confirmed: deadline de 165000 ms em advantage.persist, após comparison.persist custar ~112–125s. Não há falha numérica comprovada. |
| `product/installed-bi-closure/numerical-coverage.test.ts:20` | timeout/desempenho | Caso zero: deadline de 165000 ms em advantage.persist, após comparison.persist custar ~112–125s. Não há falha numérica comprovada. |
| `product/installed-bi-closure/numerical-coverage.test.ts:20` | timeout/desempenho | Caso null: deadline de 165000 ms em advantage.persist, após comparison.persist custar ~112–125s. Não há falha numérica comprovada. |
| `product/wp12/native-execution-bi-kpi.test.ts:312` | oracle de URL legado | HTTP200 e links autorizados; teste busca Budget+Overview/Budget%20Overview. apps/cli/src/sucafina-product/extended-source-links.ts:55–78 produz /orchestra/sf-dashboard/budget com year. Migrar URL/origin/ano mantendo proveniência, isolamento e reload. |
| `product/wp12/native-execution-bi-public-selection.test.ts:326` | oracle de URL legado | Mesma migração de rota Budget Overview para /orchestra/sf-dashboard/budget. Manter seleção pública, isolamento de caso e consumidores reais. |
| `product/bi-cost-waterfall/presentation.test.ts:17` | timeout/desempenho | Deadline cooperativo de 105000 ms em BI09.dispatch; não elevar orçamento nem atribuir a cleanup lento. |
| `product/bi-cost-waterfall/presentation.test.ts:66` | timeout/desempenho | Deadline cooperativo de 105000 ms em BI09.dispatch; não elevar orçamento nem atribuir a cleanup lento. |
| `product/bi-cost-waterfall/presentation.test.ts:97` | timeout/desempenho | Deadline cooperativo de 105000 ms em BI09.dispatch; não elevar orçamento nem atribuir a cleanup lento. |
| `product/bi-cost-waterfall/presentation.test.ts:113` | timeout/desempenho | Deadline cooperativo de 105000 ms em BI09.dispatch; não elevar orçamento nem atribuir a cleanup lento. |
| `product/bi-cost-waterfall/presentation.test.ts:133` | timeout/desempenho | Deadline de 105000 ms em portfolio.persist, após portfolio.select de ~49.5s. Custo de composição; não prova de erro numérico. |
| `product/bi-cost-waterfall/presentation.test.ts:242` | timeout/desempenho | Deadline de 105000 ms em BI10.dispatch; manter orçamento e asserções. |
| `product/wp00/baseline-corpus-coverage.test.ts:60` | unbound/inventário documental | docs/product-campaign/wp00/oracles/journeys-j01-j08.json não fornece fixtureBindings nem executionStatus nos 8 registros. Não fabricar NOT_RUN/bindings. Eventual mudança documental exige evidência real e PR shared:. |

O último arquivo `product/wp08/review-answer-confirmation.test.ts` teve 5 PASS e foi interrompido no sexto caso, `:228`, após `current-lease reply-denied-at-last-human-await`. Não contar essa interrupção como falha emitida.

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

## Fatias aplicadas e gates

SHA atual de código: `a86e22c9654663a72bd55586059a4254f548c742`. Foram alterados três arquivos de teste, pertencentes aos shards 1/2/3; as duas fatias executivas estão no mesmo arquivo do shard 2. Nenhum produto, projeção, fixture compartilhada ou workflow foi alterado.

| Shard | Causa | SHA do fix | Snapshot do gate | Run | Estado |
| --- | --- | --- | --- | --- | --- |
| 1 | Registro de descriptors versus admissão por owner | `243c083dfef4caefddf88c64adb46ab7f7b88b2f` | `3edf1737c390f89220337cbcbc0efdf9f689ad51` | [44657265518](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44657265518) | FAILURE; 576 pass / 29 fail; todos 113 arquivos |
| 2 | Recusa C08 anterior ao produtor após revisão da fonte | `d582fe32ca6fcab503a364065d846715642e8837` | `0c352eef4965c9e8c59ca123a95d7ebfba491f8b` | [44657300808](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44657300808) | FAILURE; 507 pass / 7 fail / 1 skip / 1 error |
| 2 | Recusa anônima com header ausente e corpo textual exato | `2ee5e96198500ed9d2524b692240b90cce86ed79` | `460ca5cbcbe85af34bc1945af832e52ac8db07cc` | [44661562191](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44661562191) | FAILURE; 508 pass / 6 fail / 1 skip / 1 error |
| 3 | Sentinela privada sem colisão com atributo HTML hidden | `a86e22c9654663a72bd55586059a4254f548c742` | `3caf96c9115b30f8a1150532e08b4a1714345a4a` | [44665621967](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44665621967) | Em andamento; contagem pendente |

Jobs: shard 3 `136054050430`; shard 1 `136026453241`; primeiro gate do shard 2 `136026570741`; segundo gate do shard 2 `136040769695`. Cada gate usa exatamente a requisição da enumeração de seu shard (113/107/99 arquivos, timeout 30000). Não houve rerun idêntico; o gate do shard 3 começou após seu fix concreto. Máximo de 2 gates simultâneos **desta sessão**.

As mudanças foram relidas e comparadas no GitHub: fatia 1 modifica apenas `product/routine-native-admission/adapter-boundaries.test.ts` (8 adições/3 remoções); fatia 2 apenas `product/wp12/native-execution-executive.test.ts` (3 adições/1 remoção). A fatia 3 modifica apenas o mesmo arquivo executivo (2 adições/1 remoção). A fatia 4 altera somente `product/wp05/procurement-integration.test.ts` (7 adições/6 remoções), com constante de sentinela e seis linhas atualizadas. O adapter passou no gate do shard 1; o caso executivo passou inteiro no segundo gate do shard 2. A validação da sentinela depende do gate do shard 3.

### Resultado completo do gate do shard 1

Run 44657265518 terminou em FAILURE: **576 pass / 29 fail**, 605 testes em 113 arquivos, 6345 expectativas, 2418.23s. Nenhum skip/error observado. Cleanup 136043313009 terminou com success. Todos os 113 arquivos da requisição têm execução concluída; a lacuna de 11 arquivos da enumeração inicial foi encerrada.

O caso corrigido de descriptors passou em 12.84 ms, e o arquivo `product/routine-native-admission/adapter-boundaries.test.ts` teve 6 casos PASS. A comparação por arquivo+título mostra que os 558 casos PASS da base continuaram PASS; somaram-se o caso corrigido e 17 casos antes não concluídos. As 21 falhas antigas com marker persistiram; outros8 casos agora alcançados falharam, totalizando29.

Prefixo da primeira coluna: `modules/sucafina/Sucafinav1/test/`.

| File:line | Classificação | Evidência / como retomar |
| --- | --- | --- |
| `runtime-http.test.ts:146` | unbound/UI legado | Timeout externo45000 ms após page loaded. A base apontava Add risk em:169; o contrato depende do console descomissionado. |
| `business-browser.test.ts:22; business-browser.test.ts:49` | unbound/UI legado | Navegação :4110 recusada. Cenário de formulário legado; não redirecionar o browser para esse serviço. |
| `business-browser.test.ts:210` | unbound/UI legado | Navegação :4110 recusada no cenário de duas abas. |
| `parity-polling-browser.test.ts:10` | unbound/UI legado | Navegação :4110 recusada; cenário de polling do console legado. |
| `product/wp02/host-workbench.test.ts:147` | unbound/UI legado | Enrollment seguido de redirect sem superfície HTML; cenário exige controles do console descomissionado. |
| `product/wp02/host-workbench.test.ts:280` | unbound/UI legado | Mesmo fluxo de enrollment/HTML ausente, caso de conflito de draft. |
| `product/wp02/host-workbench.test.ts:468` | unbound/UI legado | Mesmo fluxo de enrollment/HTML ausente, caso de revogação de escrita. |
| `product/wp10/integration/public-state.test.ts:49` | unbound/UI legado | Renderização de audit legado esperada 200 recebe 404; não restaurar o console. |
| `product/wp10/integration/bi-fallback-lifecycle.test.ts:49` | unbound/UI legado | Enrollment/redirect para antiga superfície BI falha; contrato legado indisponível. |
| `product/installed-bi-closure/temporal-contract.test.ts:12` | timeout/desempenho | Deadline cooperativo165000 ms excedido; não elevar orçamento. |
| `product/installed-bi-closure/temporal-contract.test.ts:69` | timeout/desempenho | Segundo caso excede 165000 ms; helper composition-test-deadline.ts:5. Stack reportado em :61 não é o início desse segundo caso. |
| `product/wp13/source-scenario.test.ts:32` | timeout/desempenho | Cenário Portfolio excede 180000 ms; causa cara ainda não isolada. |
| `product/c12-receipt-recovery/recovery-ui.test.ts:72` | unbound/produtor UI | Produtor decision-apply.ts:38 reabilita Apply reviewed change sem Retry same application; não fornece a recuperação exigida. |
| `product/c12-receipt-recovery/recovery-ui.test.ts:197` | unbound/produtor UI | decision-apply.ts:10 não tem data-recover-change, e script não chama decision-recover. Consumer é UI local real, não console legado. |
| `product/wp12/native-execution-portfolio.test.ts:14; product/wp12/native-portfolio-preparation.ts:150` | precondição de fixture | Fixture registra coverage completa e baseline sem operações; scenario-port.ts:107–118 retorna total 240000/complete. Helper:139–153 aplica indevidamente expectativas de alternativa condicionada ao baseline. Não alterar total real nem enfraquecer cobertura. |
| `product/wp12/native-execution-portfolio.test.ts:134; product/wp12/native-portfolio-preparation.ts:150` | precondição de fixture | Fixture registra coverage completa e baseline sem operações; scenario-port.ts:107–118 retorna total 240000/complete. Helper:139–153 aplica indevidamente expectativas de alternativa condicionada ao baseline. Não alterar total real nem enfraquecer cobertura. |
| `product/wp01/workbench-analysis.test.ts:144` | unbound/produtor HTTP | prepareInput em product/interface/analysis-http.ts:79 exclui as skills de enquadrar/contestar exigidas pelo positivo. HTTP400 em vez de 200; não reduzir o positivo a rejeição. |
| `product/wp01/workbench-analysis.test.ts:380` | fixture-contract | Revogação injetada via models não ocorre em action output. models só participa de start; preservar 403/denied/fechamento de lease e migrar injeção em fatia própria. |
| `product/wp10/integration/analysis-stale-calculation.test.ts:303` | fixture-contract | BCS original retorna historical; teste ainda espera unavailable de contrato antigo com lease privado. |
| `product/wp10/integration/analysis-stale-calculation.test.ts:346` | fixture-contract | Mutação injetada só no private read não ocorre; produtor atual usa o mesmo call original. Não trocar denied por ok. |
| `product/wp10/integration/analysis-stale-calculation.test.ts:410` | fixture-contract | Fault de private admission nunca dispara. Migrar adversários ao Request/authorize/context atuais mantendo fences e negativos, sem remover assertions. |
| `product/wp10/analysis-composition/alternative-selection.test.ts:456` | oracle de invólucro desatualizado | Caso:441 revoga state.control.active em:490, comprova negação interna, mas exige ok do withCase externo. business-services.ts:297–300 corretamente revalida e devolve denied/case-selection-authority-changed. Preservar contraprovas internas ao migrar a expectativa externa. |
| `product/wp10/analysis-composition/alternative-selection.test.ts:573` | timeout/desempenho anual | Deadline 105000 ms do helper:50, fase draft em:585 com 71161 ms. Não há prova de dado ausente nem erro financeiro. |
| `product/wp10/analysis-composition/alternative-selection.test.ts:606` | timeout/desempenho anual | Mesmo deadline 105000 ms; draft.selection-change em:618 consumiu 49286 ms, incluindo seleção concorrente de 15812 ms. |
| `product/wp06/documents/ws3-rejection.test.ts:65` | contrato HTTP compartilhado | Conflict/candidate-schema-conflict é convertido em failed por apps/cli/src/sucafina-product/document-services.ts:38 e em 503 por product/interface/document-http.ts:158. O teste espera 409. Rejeição/confirmação já verificadas; checks pós-reextração:66–68 não executaram. Decidir contrato; eventual fix exige shared:. |
| `product/review-fixes/procurement-apply/refusals.test.ts:29` | oracle de recusa desatualizado | po_draft é negado pelo lifecycle atual: decision-preparation.ts:97–104,186 retorna denied/requisition-action-unavailable e decision-http.ts:76 mapeia 403. Teste ainda espera 400 do guard antigo. Preservar ausência de efeito e recibo. |
| `product/review-fixes/procurement-apply/refusals.test.ts:59` | fixture sem comando draft explícito | seedLegacyChange em choice.ts:67 omite command.confirmed:false. prepared-review.ts:17 exige esse valor antes de avaliar no-op; não se chega ao motivo requisition-already-matches. |
| `product/review-fixes/procurement-apply/refusals.test.ts:96` | fixture sem comando draft explícito | preparationInput em refusals.test.ts:122 omite confirmed:false. prepared.ts:96–100 recusa antes de produzir a mutation do cenário misto. Manter CAS, histórico e contraprovas. |
| `product/integrated-proofs/am04/receipt-key-collision.test.ts:53` | fixture sem lease ativo de Apply | Probe direto de C08 usa novo Request após Apply. decision-host.ts:272,283,287–294 exige escopo ativo; state-provider.ts:220–235 autoriza target antes do replay. Denied/target-access-unavailable corresponde à proteção atual desse probe sem escopo. Colisão de digest:55–60 não executou; não relaxar autorização. |

### Resultado do primeiro gate executivo

Run 44657300808 terminou em FAILURE: **507 pass / 7 fail / 1 skip / 1 error**, 515 testes em 107 arquivos, 9141 expectativas, 1738.67s. Cleanup 136038955419 terminou com success.

As novas asserções C08 em `native-execution-executive.test.ts:214–215` passaram; o GET anônimo também retornou 403 em `:219`. O caso inteiro ainda falhou em `:220`, pois o matcher de string recebeu Content-Type null. O marcador final de reopen não foi emitido. Isso motivou a terceira fatia, sem atribuir ao primeiro fix um PASS que não ocorreu.

| Falha restante nesse run | Classificação |
| --- | --- |
| `product/wp05/sensitivity-integration.test.ts:9`; `product/wp05/browser.ts:9` | Chrome launch180000 ms; mesmo evento produz o erro não tratado |
| `product/wp12/native-execution-collaboration-recall.test.ts:143` | Timeout 120000 ms; pending input comprovado, reabertura não comprovada |
| `product/wp12/native-execution-executive.test.ts:220` | Matcher sobre header null; corrigido na terceira fatia e caso inteiro aprovado no run 44661562191 |
| `product/wp10/integration/bi-call-scope.test.ts:402` | unbound: Planner record drilldown ausente |
| `product/wp10/memory-integrity/revocation-tail.test.ts:87` | unbound: positivo do producer indisponível |
| `product/wp10/memory-integrity/revocation-tail.test.ts:104` | unbound: positivo do verifier indisponível |
| `product/wp10/memory-integrity/revocation-tail.test.ts:124` | unbound: positivo de output proof indisponível |

O skip segue sendo `local-backups.test.ts:209`, preexistente e dependente de root. O primeiro recorded-fallback, Hot Topic day e document-search passaram sem correção própria; a diferença de 3 PASS não deve ser atribuída ao patch executivo. O SQLITE_IOERR não reapareceu nesse run.

### Resultado completo do segundo gate executivo

[Run 44661562191](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44661562191) terminou em **FAILURE: 508 pass / 6 fail / 1 skip / 1 error**, 515 testes em 107 arquivos, 9142 expectativas e 1791.93 s. Job de testes `136040769695`; cleanup `136052534121` terminou com success. Os 107 headers únicos correspondem exatamente aos arquivos da requisição; nenhum ausente, extra ou duplicado.

O caso executivo inteiro passou em 172082.04 ms. O marcador `SF_WP12_NATIVE_REVIEW_REOPEN` foi emitido com o SHA do snapshot `460ca5cbcbe85af34bc1945af832e52ac8db07cc`, `inputReopened:true`, `preservedAfterSourceChange:true`, `newAnalysisFromHistoricalSourceRefused:true` e `unauthenticatedDownloadRefused:true`. Os downloads reais por GET produziram DOCX de 10809 bytes e PPTX de 535980 bytes. O marcador mantém as flags C07/native como false; este PASS não certifica essas capacidades nem GO.

Prefixo: `modules/sucafina/Sucafinav1/test/`.

| File:line | Classificação / evidência atual |
| --- | --- |
| `product/wp05/sensitivity-integration.test.ts:9; product/wp05/browser.ts:9` | Timeout de lançamento do Chrome (180000 ms); chamada no teste em :43. A mesma exceção gera o único erro não tratado. Causa interna ainda não comprovada; não atribuir a stdio somente pelo comentário do driver. |
| `product/wp12/native-execution-collaboration-recall.test.ts:143` | Timeout de 120000 ms, com 224963.61 ms observados. Input/preview reais foram emitidos; reabertura não comprovada e await caro não isolado. Não classificar dado ausente apenas pelo timeout. |
| `product/wp10/integration/bi-call-scope.test.ts:402` | unbound: projeção BI09 sem o Planner record drilldown exigido. Preservar a precondição positiva; não fabricar destino. |
| `product/wp10/memory-integrity/revocation-tail.test.ts:87` | unbound: positivo histórico do producer retorna unavailable/analysis-source-unavailable antes da revogação. |
| `product/wp10/memory-integrity/revocation-tail.test.ts:104` | unbound: positivo histórico do verifier retorna unavailable antes da revogação. |
| `product/wp10/memory-integrity/revocation-tail.test.ts:124` | unbound: positivo histórico de output proof retorna unavailable antes da revogação. |

O skip preexistente continua em `local-backups.test.ts:209`, dependente de privilégios root. O erro não tratado é o mesmo lançamento de Chrome, não um sétimo teste falhando. Os três casos de memória falham antes da revogação; não demonstram a contraprova posterior.

As três falhas da base que passaram sem fix próprio continuaram PASS: `recorded-fallback.test.ts:11` (145556.93 ms), `thread-period-continuity.test.ts:17` (34746.10 ms) e `document-search.test.ts:5` (25910.80 ms). São falhas não reproduzidas nesses gates, sem atribuir sua melhora à correção executiva. Histórico: base 504/10, primeiro gate 507/7, segundo gate 508/6.

## Feito / pendente

Feito: seleção e requisições conferidas; três enumerações encerradas antes de qualquer fix; falhas observadas classificadas; quatro fatias isoladas aplicadas, com um gate por causa. O adapter e o executivo passaram integralmente nos respectivos gates. Nenhum gate idêntico foi repetido.

Pendente: aguardar o gate do shard 3, run `44665621967`, registrar seu resultado e classificar quaisquer falhas adicionais alcançadas. Até ele terminar, os 33 arquivos não iniciados na enumeração da base continuam sem resultado.

Nenhum teste foi apagado ou pulado e nenhum timeout foi aumentado. Três expectativas foram substituídas por contratos exatos e uma sentinela de fixture foi corrigida; as justificativas seguem abaixo. Produto, projeções, fixtures compartilhadas e workflows permanecem sem alterações.

### Justificativas das mudanças de expectativas e de fixture

- Adapter (`product/routine-native-admission/adapter-boundaries.test.ts:113`): a expectativa de array vazio para qualquer perda de binding foi substituída pela lista exata de cinco IDs quando publication existir, e por array vazio somente quando publication faltar. A ausência de watch permanece coberta pela lista fechada. Foi acrescentada a chamada real de `routines.readAdmission`, exigindo o erro exato de reader indisponível e contadores exatamente zero. Não é uma redução para nonempty/truthy.
- Executive (`product/wp12/native-execution-executive.test.ts:213`): o oracle parcial `unavailable/analysis-source-unavailable` foi substituído por HTTP403 e body exato `denied/case-selection-unavailable`, pois o guard C08 externo precede o produtor. Todas as asserções de digest, preservação histórica, downloads GET reais e recusa anônima permanecem.

- Recusa anônima (`product/wp12/native-execution-executive.test.ts:220–221` no terceiro fix): o matcher de string sobre Content-Type null foi substituído por ausência explícita do header e pelo corpo exato `Access denied`, mantendo HTTP403. `product/reviews/application.ts:41,45–46` produz esse corpo textual quando a admissão é negada. Não foi usado fallback para string vazia nem expectativa de zero bytes; o corpo exato comprova a recusa sem receber o documento.

- Sentinela privada (`product/wp05/procurement-integration.test.ts:23,33,68,93,104,146,181`): `hidden` era tanto o identificador do registro privado de b quanto um atributo HTML legítimo produzido por `product/analytics/source-navigation.ts:37–40`. A constante `privateRequestId` passa a identificar realmente a chave e o número desse registro e as quatro negativas, além do check de prefixo. Permanecem 56 asserções, as cinco ocorrências da data privada e os checks de revogação em `:184–186`. Continua sendo inspecionado o HTML completo, inclusive atributos e elementos ocultos; não foi trocado por texto visível.

As mudanças foram aplicadas somente depois de os três runs da base encerrarem e suas listas de falhas serem publicadas.

## Como retomar

1. Aguardar somente o run `44665621967`, snapshot `3caf96c9115b30f8a1150532e08b4a1714345a4a`, job `136054050430`. Os demais runs desta sessão terminaram. Conferir PASS do caso de privacidade até a revogação, a contagem final, o conjunto de 99 arquivos e as falhas restantes.
2. Partir da branch `sf-shard-a`, com código em `a86e22c9654663a72bd55586059a4254f548c742`. O commit posterior é somente este handoff. Não rerodar gate sem mudança concreta.
3. Preservar a distinção entre contagem observada e resumo final. Não declarar PASS para arquivos não executados nem contar o caso interrompido como FAIL.
4. Manter todas as garantias nos casos de fixture/oracle: efeitos e recibos, CAS, histórico, revogação, digests e autorização. Produtor sem o dado exigido segue `unbound`; não substituir o positivo por check vazio ou simples recusa.
5. Corrigir somente causas comprovadas, uma por commit, usando a requisição exata do shard correspondente após o fix. Máximo de dois gates simultâneos; sem gates exploratórios ou repetição idêntica.
6. Manter `runtime/application.ts` intacto. Não recriar console legado, apontar browser para `:4110`, elevar timeouts ou fabricar baseline/coverage/digest/GO. Preservar exports `Schema.Never` e downloads reais somente por GET `?sf=review-download`.
7. Nenhuma mudança compartilhada foi aplicada; estas quatro fatias não introduzem precedência de merge `shared:`. Eventual correção de produto, projeção ou fixture compartilhada exige PR pequeno separado. O integrador deve mergear `shared:` antes da fatia de testes dependente, sem rebase dos outros branches.
8. Concluir o handoff com o resultado do gate do shard 3. Sem shell, sem `sf-ci` e sem push nos quatro branches vedados no briefing.
