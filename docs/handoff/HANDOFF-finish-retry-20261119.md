# Handoff — finish-retry-20261119

SHA (código): 10165e1c05151ac5a952fd511fd3642e43dc9ecd
Data: 2026-11-19
Estado: partial

## Feito

- F02 aceita `retry: "same-intent"` somente por chamada humana explícita para decisions.decision-promote, decisions.decision-choose, collaboration.thread-create, collaboration.thread-reply, collaboration.thread-edit e collaboration.answer-confirm.
- A memória do transporte retém somente a última intenção de cada uma dessas operações: chave, digest do conteúdo/rota, stamp completo e indicação de recibo original confirmado. Nenhum payload, recibo, permissão ou dado de autoridade é persistido.
- O retry exige a mesma instância de transporte, owner, geração, operação, chave e bytes canônicos. Concorrência permanece bloqueada. Troca de contexto, 401/403, resposta terminal negativa ou nova intenção eliminam a oportunidade anterior.
- O caso de POST original 200 seguido por perda da releitura é admitido: um segundo POST depende do clique humano e repete exatamente a intenção original. O produtor decide o replay C08 sem nova escrita.
- As 29 operações publicadas em SfCollaboration.operations usam o adaptador HTTP original POST `{mount}/dashboard`; decisions.decision-promote/choose também usam esse adaptador. Os envelopes fechados não recebem um campo surface inventado. Método, efeito, consulta, codec e limites originais são preservados.
- A sobreposição está explícita em SfOperationExtensions; as 305 entradas do catálogo congelado permanecem intactas.
- A fixture NAV-01 declara Content-Type application/json explicitamente, preservando a asserção original após a diferença de serialização do Bun.

## Pendente

- packages/client/src/sucafina/transport.ts:28: falta qualificar o consumo da opção pelos controles humanos C05 na composição instalada de Reports do engenheiro principal. Os testes desta fatia provam a fronteira cliente/codec/transporte, não C08 instalado.
- packages/client/src/sucafina/transport.ts:131: falta qualificar os controles nativos de promoção/escolha que consumirão a lista fechada conservando a revisão original e a perda real de resposta.
- packages/schema/src/sucafina/operation-registry.ts:57: decision-edit e outros adaptadores Decisions ainda exigem correção própria de rota; os quatro comandos C12 devem usar o adaptador procurement, verificado separadamente.
- packages/schema/src/sucafina/operation-registry.ts:22: a verificação de metadados ainda precisa distinguir IDs sobrepostos explicitamente de IDs novos. O engenheiro principal possui a edição desse teste.
- Não houve typecheck separado de CLI/app/E2E neste gate Bun nem execução do sf-ci completo.

## Decisões e justificativas

- Nenhuma asserção, cenário ou timeout foi removido, pulado ou afrouxado. A asserção de header existente permanece igual; a fixture passou a declarar o MIME que afirma representar.
- O retry é uma exceção fechada, não uma permissão geral para reenviar comandos. Case creation, C12 apply/recover e operações fora da lista continuam recusando essa opção.
- Decisões: product/decisions/mutations.ts:92–94,182–184,229–263 reautoriza, confere a mesma chave/digest/incarnation/participante e consulta o recibo antes dos efeitos/CAS. apps/cli/src/sucafina-product/host-context.ts:174–177 deriva operationIdentity da operação e Idempotency-Key.
- C05: product/host-binding/state-provider.ts:224–238, product/collaboration/recipient-actions.ts:43–117, thread-history.ts:62–105 e answer-reuse.ts:79–112 revalidam o contexto e retornam o resultado persistido com commit:false para a intenção idêntica. A observação original de answer-confirm conserva seu prazo de cinco minutos; o cliente não a renova.
- Rotas C05: apps/cli/src/sucafina-product/host-context.ts:405–406 e product/collaboration/http.ts:20–22 montam o adaptador original nas três superfícies; http-routes.ts:39–74 publica as 29 operações. Dashboard é um destino original suportado, sem restaurar o console HTML.
- Rotas de promoção/escolha: apps/cli/src/sucafina-product/portfolio-http.ts:41–59 aceita dashboard/planner/procurement e encaminha as operações originais.
- Os testes usam respostas sintéticas somente para verificar a fronteira de transporte. Não simulam uma instalação, concessão de acesso ou efeito exatamente uma vez e não são apresentados como essa prova.

## Como retomar

1. Usar o código 10165e1c05151ac5a952fd511fd3642e43dc9ecd da branch finish-retry-20261119; esta branch parte de uma composição de trabalho, portanto integrar apenas os cinco arquivos desta fatia e este handoff.
2. Compor o adaptador com o controle C05 que conserva a intenção/revisão original e dispara retry somente por clique humano.
3. Qualificar os cenários instalados preservando dois POSTs idênticos e uma escrita C08 onde essa é a prova original.
4. Corrigir os demais bindings Decisions explicitamente conforme o adaptador produtor, sem adicionar surface ao payload nem ampliar a lista de retry.
5. Retomar UI35/38 e UI39/40 nas suas posses, mantendo autorização e recibos produzidos pelo sistema real.

## Comandos e resultados

Toda execução foi GitHub Actions. Nenhum shell ou teste local.

| Run | Snapshot | Resultado |
| --- | --- | --- |
| [44592516749](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44592516749) | 9f0e355f7ffdcfc11e6e43495bba3453343e0ef1 | FAILURE, 6 pass / 15 fail / 45 expect. Quatorze casos novos recusados antes do dispatch pela rota com surface ausente; NAV-01 revelou MIME implícito da fixture. |
| [44593918880](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44593918880) | fb4dbf6814f470b07a3345f4d360c66095bc2e4a | SUCCESS, job 135806988410, 22 pass / 0 fail / 316 expect, três arquivos. |
| [44594420036](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44594420036) | 3ae2e53090dfe4c303dcbe2d38f3f56c2fc01203 | SUCCESS, job 135808752647, 24 pass / 0 fail / 400 expect, quatro arquivos, 256 ms. |

Gate final: package client, runner bun, args test/sucafina/human-retry.test.ts, test/sucafina/collaboration-routes.test.ts, test/sucafina/files-transport226/report-retry.test.ts, test/sucafina/transport-type-repair/f02-transport.test.ts.

Typecheck: não executado separadamente. Guards: não executados nesta fatia. sf-ci: não executado.
