# HANDOFF-sf-review-observation

## SHA e estado

- Branch: `sf-review-observation`.
- Base e merge-base: `f7dd58e32bc834f1485df20b91adbf759b4c4ad0`.
- SHA de código: `d93f7f482b9b24cd895b8f6406727f0f8aab0dd7`.
- Estado: **complete para o recorte compartilhado do observador — gate unitário success e avanço instalado além da causa original.** A jornada Reports inteira continua partial, com bloqueios distintos registrados abaixo.
- Esta branch contém somente o recorte compartilhado do observer, seus testes e este handoff. PR #407 é a entrega compartilhada da Sessão5; não contém a UI nem as alterações de retenção de Responses.

## Causa comprovada

O gate Reports [44653389217](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44653389217), job `136013553891`, executou snapshot `0d7e3ec545def9b247253b5215a5d1ed93b94ae9` sobre código `042fe208f907c779bc4b65aa5544a4ffb4762dc6`. RPT01 e RPT03 chegaram a três seções selecionadas, mas o botão Review selected sections permaneceu desabilitado em `packages/app-shell/e2e/sucafina/reports-support/review-flow.ts:127:25`.

A UI consulta a disponibilidade de `dashboard.dashboard-agenda` e `dashboard.dashboard-review-preserve` em `reviews/agenda`. Os IDs já pertenciam ao contrato, mas nenhum observer instalado os emitia. A ausência era convertida pelo live-context em indisponibilidade. A composição de ações do frame permanece reativa; não foi alterada.

O mesmo gate teve erro distinto no consumo do corpo da Response original em RPT02/RPT04, `review-flow.ts:40:47`. O recorte independente de leitura imediata edb8ec2 não resolveu todos esses erros: Playwright aguarda o término da resposta antes de consultar Network.getResponseBody. A retenção no estágio original da resposta está sendo tratada separadamente; não integra este PR.

## Alteração e autoridade

Arquivos de código:

1. `apps/cli/src/sucafina-product/native-ui/review-agenda-health.ts`: novo observer privado.
2. `apps/cli/src/sucafina-product/host-context.ts`: import e composição no mesmo agregador de observações.
3. `modules/sucafina/Sucafinav1/test/native-ui-contract/review-agenda-health.test.ts`: quatro testes de contrato com autoridade, C08/SQLite, serviços de negócio, HTTP e mount originais.

A observação verifica o contrato POST/json/effect dos dois IDs e a presença na coleção operacional, mas essas condições não concedem disponibilidade. Também exige o mesmo router instalado, o handler original, o método específico e todas as dependências capturadas antes do primeiro await. O binding existente `dashboard.dashboard-review` identifica esse router compartilhado; não concede o grant de nenhuma das operações POST e não amplia a união de nativeReadBinding.

Agenda conserva a admissão original `sf_dashboard_read`. Preserve conserva `human.admit(request, "reviews.preserve", payload)` no handler original; o observer apenas consulta `humanActions(request)` antes e depois das leituras. O callback é o da autoridade original, sem lista de grants fabricada.

O acesso ao namespace reviews usa `selectSfNamespaceHealth` original, em modo read para agenda e write para preserve. O state provider reconhece esse seletor privado e autoriza de fato o modo correspondente. Duas leituras devem concordar em storageVersion, aggregateRevision e incarnation. A observação revalida a admissão e o Request original, a montagem e as identidades de métodos até o fim. Ausência, revogação, alteração ou exceção resultam em ausência de readiness; o live-context conserva sua recusa original.

Nenhuma observação executa agenda, preview, preserve, HTTP de produto, seleção, receipt ou transação de escrita. O observer não altera política, baseline, registry, Schema, runtime/application.ts ou suites.json.

## Testes e revisão

Os testes adicionados exercitam:

- Montagem original por createModule e HTTP real com GET recusado por 405; contexto vivo publica os dois IDs sem dispatch de produto ou mudança de snapshots.
- Política explícita real sem reviews.preserve mantém apenas agenda; ausência de sf_dashboard_read ou de reviews recusa ambos. A mesma autoridade é passada aos serviços originais. Um POST preserve sem grant é recusado pelo handler original por 403.
- Mount removido, binding ausente, accessRevision divergente, Request de outra origem e cancelamento recusam readiness.
- Revogação real da identidade da fixture e substituição por outra instância real do router durante um await de commandIdentity recusam a observação anterior. A barreira é de agendamento na composição da fixture, não mock de handler, admissão, estado ou seleção. Esse teste cobre revogação durante admissão; não reivindica cobertura de uma revogação exatamente na segunda leitura C08.

**Gate real success:** [44657226869](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44657226869), snapshot `c182dd60b9b96cd2a0559dcc7236c3a71c0c0dbd`, source `6c37fd3675d092ebc79758be2da846451a6bc670`. Test136026320826 e cleanup136027044889 success; **4 pass / 0 fail / 27 expects**, 1 arquivo,862ms. Nenhum spawn ocorreu; não há claim de prova Omni. Acesso somente GitHub; execução em Actions. O diff publicado foi conferido via GitHub contra f7 e contém exclusivamente os três paths autorizados. Revisão independente de `/root/reports_failure` concluída sobre d93f7f: nenhum ajuste causal adicional identificado; confirmou fences, refs concretas dos seletores, binding compartilhado e autenticidade dos testes. A revisão não substitui Actions nem comprova typecheck/runtime.

## Dependências e composição

- O host-context, report-health e contrato de host da base f7 eram compatíveis e iguais aos usados no código Reports 042fe. Não houve expansão de base.
- A rechecagem de `sf-ui-c02@3050a842dfddd354fe918d5343496c5682b924f6` não encontrou alteração concorrente nesses paths; os commits recentes modificaram lost-created-thread-read, wp04/procurement.spec e preserved/answer.
- Composição instalada testada: código `4ccf99576e6886b178c5502fc02bfa41bef6730c`, com UI f34b8010, ingresso4174, compartilhados até18a9132 e os três blobs exatos deste observador.
- O teste unitário foi executado no gate específico acima. O run Reports [44660375065](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44660375065), snapshot `4cdba6118ff547d9ed23cd5cdb284e55e218d675`, é uma prova distinta: typechecks passaram; jornada total **failure,0pass/4fail**. RPT01 completou o preparo/preservação e chegou ao `exportReview`, falhando depois em `review-flow.ts:415:24`. RPT02 alcançou o preview habilitado/status200, falhando em body `:140:38`; RPT03/04 pararam no body da descoberta `:40:37`. Esses resultados não são chamados de Reports verde.
- Guards: não executados neste recorte. O integrador conserva o gate final contra origin/dev e o registro dos protected-paths herdados.
- Qualificação complete é limitada à causa compartilhada: os quatro contratos passaram em Actions e a composição instalada ultrapassou o botão antes desabilitado. A execução completa de Reports e seus bloqueios posteriores permanecem a cargo dos recortes de UI/transporte, sem mudar ou dispensar suas asserções. Integrar este shared antes da UI, preservando o head esperado.

## Runs, artefato e pacote

- sf-ci: não disparado por este recorte.
- Artefato do gate anterior falho: `playwright-ubuntu-24.04-1`, ID `14592331717`, sha256 `e1bfae54966126a28c4f382aae22a56ecaa4a6fe31b8aab75befc817440e6ca3`. Referência diagnóstica somente; não é baseline nem prova desta implementação.
- Nenhum baseline aprovado ou pacote é produzido por este recorte. O artefato da jornada vermelha é diagnóstico, não baseline. Sem GO, deploy ou SF_ORCHESTRA_WEB_PACKAGE_VERIFIED.

## Limite de qualificação e retomada

A causa original do observador em `review-flow.ts:127:25` está coberta pelo gate unitário verde e pelo avanço de RPT01/RPT02 na composição. Isso permite integrar os três arquivos deste shared, sem promover a jornada inteira.

Permanecem separados: `unbound(packages/app-shell/e2e/sucafina/reports-support/review-flow.ts:415:24)` (UI50 não encontrada na transição de exportação), `:140:38` e `:40:37` (corpo da Response original indisponível ao protocolo). Resolver esses recortes sem refetch, replay, alteração de política, timeout ou asserção; só executar outro gate completo após a correção concreta.

O commit desta atualização altera apenas o handoff; não exige repetir o gate de código idêntico. Preservar a identificação exata do source e as conclusões vermelhas das jornadas anteriores no handoff geral.
