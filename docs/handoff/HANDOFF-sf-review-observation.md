# HANDOFF-sf-review-observation

## SHA e estado

- Branch: `sf-review-observation`.
- Base e merge-base: `f7dd58e32bc834f1485df20b91adbf759b4c4ad0`.
- SHA de código: `d93f7f482b9b24cd895b8f6406727f0f8aab0dd7`.
- Estado: **partial — implementação entregue; qualificação por Actions pendente**.
- Esta branch contém somente o recorte compartilhado do observer e seus testes. Nenhum PR, merge, workflow ou deploy foi iniciado pelo autor deste handoff.

## Causa comprovada

O gate Reports [44653389217](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44653389217), job `136013553891`, executou snapshot `0d7e3ec545def9b247253b5215a5d1ed93b94ae9` sobre código `042fe208f907c779bc4b65aa5544a4ffb4762dc6`. RPT01 e RPT03 chegaram a três seções selecionadas, mas o botão Review selected sections permaneceu desabilitado em `packages/app-shell/e2e/sucafina/reports-support/review-flow.ts:127:25`.

A UI consulta a disponibilidade de `dashboard.dashboard-agenda` e `dashboard.dashboard-review-preserve` em `reviews/agenda`. Os IDs já pertenciam ao contrato, mas nenhum observer instalado os emitia. A ausência era convertida pelo live-context em indisponibilidade. A composição de ações do frame permanece reativa; não foi alterada.

O mesmo gate teve erro distinto de consumo tardio do corpo da resposta em RPT02/RPT04, `review-flow.ts:40:47`. Essa causa pertence ao recorte independente `sf-reports-response`, code `edb8ec2c9aeab49440a1110bd08549fa233ecd93`; não foi duplicada aqui.

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

**Nenhum teste ou typecheck foi executado nesta branch.** Acesso desta sessão é somente GitHub; execução e orçamento de Actions são centralizados pelo integrador. O diff publicado foi conferido via GitHub contra f7 e contém exclusivamente os três paths autorizados. Revisão independente de `/root/reports_failure` concluída sobre d93f7f: nenhum ajuste causal adicional identificado; confirmou fences, refs concretas dos seletores, binding compartilhado e autenticidade dos testes. A revisão não substitui Actions nem comprova typecheck/runtime.

## Dependências e composição

- O host-context, report-health e contrato de host da base f7 eram compatíveis e iguais aos usados no código Reports 042fe. Não houve expansão de base.
- A rechecagem de `sf-ui-c02@3050a842dfddd354fe918d5343496c5682b924f6` não encontrou alteração concorrente nesses paths; os commits recentes modificaram lost-created-thread-read, wp04/procurement.spec e preserved/answer.
- Para o próximo gate Reports, compor este recorte com o fix independente de consumo imediato de response.json e a UI/host congelados pelo integrador.
- O teste unitário novo permanece pendente de execução por Actions. Um resultado de Reports não deve ser descrito como execução desse arquivo unitário.
- Guards: não executados neste recorte. O integrador conserva o gate final contra origin/dev e o registro dos protected-paths herdados.
- Ordem de merges deste recorte: nenhuma. Qualificação complete depende do gate correspondente e do handoff atualizado.

## Runs, artefato e pacote

- sf-ci: não disparado por este recorte.
- Artefato do gate anterior falho: `playwright-ubuntu-24.04-1`, ID `14592331717`, sha256 `e1bfae54966126a28c4f382aae22a56ecaa4a6fe31b8aab75befc817440e6ca3`. Referência diagnóstica somente; não é baseline nem prova desta implementação.
- Nenhum novo artefato, baseline ou pacote produzido. Sem GO, sem deploy e sem SF_ORCHESTRA_WEB_PACKAGE_VERIFIED.

## Unbound e retomada

`unbound(packages/app-shell/e2e/sucafina/reports-support/review-flow.ts:127:25)` permanece até gate verde no snapshot composto. A causa concreta foi corrigida nesta branch, mas o resultado ainda não foi observado.

O integrador deve concluir a revisão do commit, compor os deltas de Reports sobre um SHA congelado e executar o gate correspondente uma vez, respeitando até dois gates simultâneos. Não repetir o gate anterior sem mudança concreta. Registrar o resultado por caso e o artefato real; manter este handoff partial se houver falha ou se o teste de contrato continuar sem execução.
