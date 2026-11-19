# Handoff — finish-retry-20261119

SHA (código): 36398450fc4d0445cf5a88affda1c3292cc14794
SHA UI54/F02 qualificado: f5760ad992f59d258406aa52679e469c512294e5
Data: 2026-11-19
Estado: partial

## Feito

- Os dois contratos originais UI54 dashboard-draft-read e dashboard-hot-topic-draft-outcome foram compostos de 071f99fbf0e0005ad4127051b307d23f37ee1e1f. Os quatro blobs schema/domain/client são idênticos; common/registry recebem somente esses dois IDs, preservando os adapters e o catálogo congelado.
- O outcome permanece POST read, com o corpo fechado original {caseRef}. Somente esse ID aceita a chave original do primeiro save, exige stamp atual e não gera nova chave. Outros POST reads continuam recusando chaves fornecidas; isso não é uma mutação, retry ou nova observação.
- O probe de criação de Procurement confirma que os dois corpos dos formulários são admitidos pelo codec e chegam ao adapter HTTP original no boundary. Como Ops4 não emitiu POST, o motivo real do browser continua exigindo diagnóstico; o probe não cria autoridade ou prova de persistência.

- F02 aceita `retry: "same-intent"` somente por chamada humana explícita para decisions.decision-promote, decisions.decision-choose, decisions.decision-apply, collaboration.thread-create, collaboration.thread-reply, collaboration.thread-edit e collaboration.answer-confirm.
- A memória do transporte retém somente a última intenção de cada uma dessas operações: chave, digest do conteúdo/rota, stamp completo e indicação de recibo original confirmado. Nenhum payload, recibo, permissão ou dado de autoridade é persistido.
- O retry exige a mesma instância de transporte, owner, geração, operação, chave e bytes canônicos. Concorrência permanece bloqueada. Troca de contexto, 401/403, resposta terminal negativa ou nova intenção eliminam a oportunidade anterior.
- O caso de POST original 200 seguido por perda da releitura é admitido: um segundo POST depende do clique humano e repete exatamente a intenção original. O produtor decide o replay C08 sem nova escrita.
- As 29 operações publicadas em SfCollaboration.operations usam o adaptador HTTP original POST `{mount}/dashboard`. Dezesseis operações Decisions usam dashboard (incluindo authoring, controles, current-choice e workbench); as quatro C12 prepare-changes/review/apply/recover usam `{mount}/procurement`. Método, efeito, query, codec e limites foram preservados, sem campo surface/purpose inventado.
- A composição separa SfFrozenOperationRoutes e SfOperationExtensions, preservando as 305 entradas originais e evitando TS2783. Guardas explícitas last/intent corrigem o narrowing de TypeScript sem mudar a política de retry.
- C12 admite somente um retry humano de decisions.decision-apply com a mesma intenção retida. A resposta CAS409 original é preservada e encerra a retenção; nenhum novo reviewDigest, caseRef ou receipt é criado.
- A sobreposição está explícita em SfOperationExtensions; as 305 entradas do catálogo congelado permanecem intactas.
- A fixture NAV-01 declara Content-Type application/json explicitamente, preservando a asserção original após a diferença de serialização do Bun.

## Pendente

- packages/app-shell/src/orchestra/chapters/sucafina/dashboard/hot-topics/proposals/index.tsx: o WP UI54 precisa qualificar draft-read/outcome no produtor instalado; os testes deste checkpoint usam somente respostas de fronteira, não receipts C08.
- packages/client/test/sucafina/procurement-create.test.ts:1: probe passou, mas não explica por si o zero POST real de Ops4. A branch Operations registra apenas reason/classe de exceção; o próximo gate composto discriminará esse retorno.

- packages/client/src/sucafina/transport.ts:28: falta qualificar o consumo da opção pelos controles humanos C05 na composição instalada de Reports do engenheiro principal. Os testes desta fatia provam a fronteira cliente/codec/transporte, não C08 instalado.
- packages/client/src/sucafina/transport.ts:131: falta qualificar os controles nativos de promoção/escolha que consumirão a lista fechada conservando a revisão original e a perda real de resposta.
- packages/client/src/sucafina/transport.ts:131: requalificar decisions.decision-apply no host C12/SQLite original do WP de ingresso. O gate F02 sintético comprova apenas retenção/dispatch/recusa.
- packages/app-shell/e2e/sucafina/decisions-support/choice-history.ts:54–74: a prova original exige reload antes do segundo POST. product/ui/decision-choice.ts:9–26,73,297–323 conserva body/key em sessionStorage por identidade/caso; o F02 atual só recupera intenção da mesma instância e precisa de uma recuperação nativa explícita, tipada e sujeita à autoridade atual. Não remover reload nem contagem de um único choice.
- Não houve typecheck separado de CLI/app/E2E neste gate Bun nem execução do sf-ci completo.

## Decisões e justificativas

- UI54: apps/cli/src/sucafina-product/dashboard-http.ts:33–41 e :88–89 valida a chave original, admite decisions.edit e chama lookupFirstSave. hot-topic-draft.ts:133–145 deriva a mesma transactionKey original. Uma chave nova leria outra identidade; a exceção F02 conserva efeito read, body, contexto e geração e não concede acesso por conhecer uma chave.

- Nenhuma asserção, cenário ou timeout foi removido, pulado ou afrouxado. A asserção de header existente permanece igual; a fixture passou a declarar o MIME que afirma representar.
- O retry é uma exceção fechada, não uma permissão geral para reenviar comandos. Case creation, C12 recover e operações fora da lista continuam recusando essa opção. O apply foi incluído somente após conferir o produtor original.
- Decisões: product/decisions/mutations.ts:92–94,182–184,229–263 reautoriza, confere a mesma chave/digest/incarnation/participante e consulta o recibo antes dos efeitos/CAS. apps/cli/src/sucafina-product/host-context.ts:174–177 deriva operationIdentity da operação e Idempotency-Key.
- C05: product/host-binding/state-provider.ts:224–238, product/collaboration/recipient-actions.ts:43–117, thread-history.ts:62–105 e answer-reuse.ts:79–112 revalidam o contexto e retornam o resultado persistido com commit:false para a intenção idêntica. A observação original de answer-confirm conserva seu prazo de cinco minutos; o cliente não a renova.
- Rotas C05: apps/cli/src/sucafina-product/host-context.ts:405–406 e product/collaboration/http.ts:20–22 montam o adaptador original nas três superfícies; http-routes.ts:39–74 publica as 29 operações. Dashboard é um destino original suportado, sem restaurar o console HTML.
- Rotas Decisions: apps/cli/src/sucafina-product/portfolio-http.ts:41–60, decision-domain-http.ts:25 e current-choice-http.ts:19–20 aceitam os mounts originais. host-context.ts:1052 chama portfolioHttp antes de procurementDecisionHttp: o review C12 nativo conserva o envelope público de três campos, sem purpose:'review' da entrada fallback isolada.
- C12: modules/sucafina/Sucafinav1/product/procurement/decision-host.ts:240–283 verifica autorização humana, mesma intenção/digest e receipt original; readChange:103–112 conserva CAS e revalidação. Retry não equivale a sucesso e não elimina o409 legítimo.
- Os testes usam respostas sintéticas somente para verificar a fronteira de transporte. Não simulam uma instalação, concessão de acesso ou efeito exatamente uma vez e não são apresentados como essa prova.

## Como retomar

1. Usar o código 36398450fc4d0445cf5a88affda1c3292cc14794 da branch finish-retry-20261119; esta branch parte de uma composição de trabalho, portanto integrar somente o delta da fatia: transport.ts, operation-registry.ts, human-retry.test.ts, collaboration-routes.test.ts, decision-routes.test.ts, decision-edit.test.ts, f02-transport.test.ts e este handoff.
2. Compor o adaptador com o controle C05 que conserva a intenção/revisão original e dispara retry somente por clique humano.
3. Qualificar os cenários instalados preservando dois POSTs idênticos e uma escrita C08 onde essa é a prova original.
4. Qualificar UI35/38 e C12 sobre as rotas verificadas; qualquer nova operação exige contrato produtor e teste de fronteira. Não adicionar surface ao payload.
5. Retomar UI35/38 e UI39/40 nas suas posses, mantendo autorização e recibos produzidos pelo sistema real.

## Comandos e resultados

Toda execução foi GitHub Actions. Nenhum shell ou teste local.

| Run | Snapshot | Resultado |
| --- | --- | --- |
| [44592516749](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44592516749) | 9f0e355f7ffdcfc11e6e43495bba3453343e0ef1 | FAILURE, 6 pass / 15 fail / 45 expect. Quatorze casos novos recusados antes do dispatch pela rota com surface ausente; NAV-01 revelou MIME implícito da fixture. |
| [44593918880](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44593918880) | fb4dbf6814f470b07a3345f4d360c66095bc2e4a | SUCCESS, job 135806988410, 22 pass / 0 fail / 316 expect, três arquivos. |
| [44594420036](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44594420036) | 3ae2e53090dfe4c303dcbe2d38f3f56c2fc01203 | SUCCESS, job 135808752647, 24 pass / 0 fail / 400 expect, quatro arquivos, 256 ms. |
| [44595851490](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44595851490) | 9ed42cd7f5ecee3c622acbb04e47993c097a8266 | FAILURE, job135813772004, 21 pass/1 fail/526 expect. Os20 bindings e12 probes novos passaram; decision-edit.test ainda esperava a rota antiga. |
| [44596513565](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44596513565) | 84e28fa5e64d8a0b7c6671c6c36d9b9ad019efd8 | SUCCESS, job135816130511, 5 pass/0 fail/162 expect, decision-routes e decision-edit. |
| [44601578214](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44601578214) | 7409fd16e50dc5f5a007ab71ab20992ef9fb586a | SUCCESS, job135834095072, 17 pass/0 fail/339 expect, human-retry incluindo C12 e sua negativa409. |


Gate C05/Decisions inicial: package client, runner bun, args test/sucafina/human-retry.test.ts, test/sucafina/collaboration-routes.test.ts, test/sucafina/files-transport226/report-retry.test.ts, test/sucafina/transport-type-repair/f02-transport.test.ts.

Gate C12: {"package":"client","runner":"bun","args":["test/sucafina/human-retry.test.ts"]}.

Typecheck: os gates Bun não o executam. As falhas compostas de TS2783 foram corrigidas em19aa; o narrowing em transport foi corrigido em b470. A validação instalada pertence ao snapshot composto do integrador. Guards: não executados nesta fatia. sf-ci: não executado. Não há declaração de GO.

- [44604361124](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44604361124) SUCCESS, job135843955037, cleanup135845556147 SUCCESS. Snapshot9a541ff36821c6952aa2f5b7d0a26fef260f3ccd, códigof5760ad. 19 pass / 0 fail / 380 expect,255ms. Args: test/sucafina/dashboard-draft-read.test.ts e test/sucafina/human-retry.test.ts. Confere URL/corpo/chave originais, contexto ausente, key ausente/inválida, retry indevido, outros reads, revogação e geração antiga.
- [44605110108](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44605110108) SUCCESS, job135846593795, cleanup135847589675 SUCCESS. Snapshot5c2c1add30fa239e4cc28cdff2e1a57377eb115a, código36398450. 2 pass / 0 fail / 20 expect,227ms. Args: test/sucafina/procurement-create.test.ts. Somente boundary codec/F02; nenhuma execução nativa ou gravação Procurement é inferida.
