# Handoff — sf-shard-a

## Estado do checkpoint

- Estado: IN_PROGRESS — shard 2 enumerado; shard 1 cancelado pelo limite do job; shard 3 em execução. Nenhuma correção de teste foi aplicada.
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
| 3 | [44651344557](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44651344557) | `bce2f0ed56f7073254b4316853eca2ed0c0f5fcb` | Run tests em andamento; contagem pendente |

Os snapshots são commits filhos diretos da base, alterando apenas `.ci-run.json`; as branches temporárias são apagadas pelo próprio workflow. Cada requisição permanece legível no SHA do snapshot.

### Falhas de preparação, sem execução de testes

- [44645838424](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44645838424), shard 1, snapshot `c5eaa82f3c8af3200a2a75ee75ea7006efe4a4cf`, job `135988044990`: FAILURE em `script/test-ci-package.ts:35`, `TEST_PACKAGE_NOT_FOUND:modules/sucafina`.
- [44645842999](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44645842999), shard 2, snapshot `77fe323aa101ef11b9d382118ef81ea3f242f4c6`, job `135988061331`: mesma falha de preparação.

Nenhum teste Bun foi executado nesses dois runs; não equivalem a 0 pass / 0 fail. A requisição foi corrigida antes das novas enumerações, sem alteração dos testes da base.

## Falhas enumeradas — shard 2

Prefixo dos caminhos abaixo: `modules/sucafina/Sucafinav1/test/`.

| File:line | Classificação / evidência |
| --- | --- |
| `product/mixed-source-contracts/recorded-fallback.test.ts:11` | Deadline cooperativo 165000ms; proof emitido depois das asserções; encerramento excede orçamento. Desempenho/cleanup sem await caro isolado. |
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
| `product/wp01/workbench-analysis.test.ts:144` | unbound/produtor HTTP | prepareInput em apps/cli/src/sucafina-product/analysis-http.ts:79 exclui as skills de enquadrar/contestar exigidas pelo positivo. HTTP400 em vez de200; não reduzir o positivo a rejeição. |
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

## Feito / pendente

Feito: branch isolada; seleção dos três shards conferida; requisição compatível; shard 2 concluído e classificado; shard 1 cancelado sem repetição; shard 3 iniciado somente após shard 2 terminar. Nunca houve mais de dois gates simultâneos.

Pendente: concluir shard 3; depois aplicar duas fatias comprovadas (adapter descriptors no shard 1 e guard C08 no shard 2), com um gate completo por causa. Demais causas permanecem classificadas, com suas asserções intactas.

Asserções removidas: nenhuma até este checkpoint. Testes pulados/removidos: nenhum. Produto, projeções, fixtures e workflows: nenhuma alteração.

## Como retomar

1. Consultar run 44651344557 e job 136006716047 (shard 3), sem repetir gate idêntico. Shards 1/2 estão encerrados.
2. Ler logs dos jobs 135988658580 (shard 1) e 135988673159 (shard 2). Preservar a distinção entre enumeração parcial e resumo final.
3. Completar os três ledgers antes de qualquer correção.
4. Fix concreto identificado: `product/wp12/native-execution-executive.test.ts:213`. A recusa acontece em `apps/cli/src/sucafina-product/business-services.ts:289–291`, antes do produtor (`analysis-host-services.ts:271`); `analysis-http.ts:102` mapeia denied para 403. Substituir o oracle interno por HTTP403 e body exato, mantendo digests e downloads reais.
5. Corrigir apenas causas comprovadas. Manter `runtime/application.ts` intacto. Não recriar console descomissionado, não elevar timeouts nem falsificar baseline/coverage/digest/GO.
6. Mudanças compartilhadas devem ir a PR pequeno separado com `shared:` no título; integrador faz esse merge primeiro. Nenhuma mudança compartilhada aplicada até agora.
7. Registrar produtor sem dado requerido como `unbound`, com file:line. Atualizar este handoff com SHA, evidências e ordem de integração finais.
