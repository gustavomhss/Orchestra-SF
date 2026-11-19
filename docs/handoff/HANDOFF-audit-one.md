# Handoff — audit-one

SHA: f4ed9e86d4259d12dc38113cd250b8c683c70161 (último commit integrado de produto antes deste registro; o commit documental é identificável no histórico deste arquivo)
Data: 2026-11-19T13:48:00-03:00
Estado: partial

## Feito

- PR existente: [#349](https://github.com/gustavomhss/Orchestra-SF/pull/349), base `close-final-candidate`. Nenhum PR novo.
- Os dois commits de `audit-one-tip`, `043798870304ed15a6f7ad852c9e7a9f7aeac9cb` e `dcdaa904af530dfd020b0454329f8e7808e3097f`, foram incorporados antes das outras alterações.
- WP1: executados os comandos reais `bun run typecheck` de core e CLI. [44553716279](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44553716279): 2 testes do harness passaram, 0 falharam. A compilação conjunta das mudanças posteriores ainda está pendente.
- WP2: `operations.spec.ts` completo com ClamD real. [44553973512](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44553973512): 5 passaram, 0 falharam. O fornecedor único filtrado fica aberto; nenhum assert de upload foi removido.
- Componentes nativos compartilhados SF-2/SF-8: `packages/core/src/session/run-coordinator.ts`, seu teste e `product/native-phase-bridge/fixture.ts`. O resultado exclusivo só publica depois de o próprio runner encerrar; fixture usa a identidade canônica e banco privado real. [44556979548](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44556979548): 31/31 core. [44557097018](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44557097018): 7/7 componentes. Controle com coordenador antigo e a mesma fixture: [44557988536](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44557988536), 0/1, reproduziu runner pai ainda ativo. Integrado.
- C08: `product/decisions/apply.ts` aceita no fechamento a mesma retomada de recibo já admitida na preparação; conserva provas, versão e digest completos. `wp13/handoff-c08-integration.test.ts` mantém o Request original e anuncia indisponibilidade conhecida no preflight. [44558502952](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44558502952): 1/1, 59 asserts. Os seis negativos de recuperação também passaram em [44557577263](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44557577263). Integrado.
- Leitura de registro Dashboard: `product/dashboard/sources.ts` compõe ambiente/projeção dentro das duas observações canônicas existentes, preservando os limites independentes de leitura e o fechamento de autoridade. Seis novos negativos/controles em `wp08/record-read-observation.test.ts`. [44565128087](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44565128087): 19/19. Os dois arquivos estão integrados; o gate também continha a correção temporal SF-2 ainda pendente de integração.
- Memory: `product/host-binding/atlas-memory.ts`, `apps/cli/src/sucafina-product/memory-case-read-scope.ts`, `wp10/memory-integrity/revocation-tail.test.ts`. O testemunho canônico só pode ser reutilizado pelo mesmo owner ativo, com todas as revalidações, e é invalidado ao fechar o owner. [44558828718](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44558828718): 1/1, 8 asserts. Os 11 negativos/tails passaram em [44557337510](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44557337510); o histórico excedeu seu budget nesse processo combinado. Isolado, com o mesmo budget: [44564898010](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44564898010), 1/1, 1.159 asserts, 200,664 s. Integrado.

## Pendente

As linhas abaixo identificam os casos do brief, antes das inserções de testes adicionais.

- WP3 — `packages/app-shell/e2e/sucafina/decisions.spec.ts:20-21,26`: controles reais já conectados na branch `audit-ui`, ainda sem gate completo verde. [44566586548](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44566586548): 1 passou, 4 falharam. Duas jornadas param no timeout HTTP de comparação; a rota de listagem e o texto da recuperação foram corrigidos depois. A rota real `decision-list` passou 1/1 e 16 asserts em [44568689037](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44568689037). Ainda falta executar novamente os cinco casos completos. Nenhuma aprovação C12 foi fabricada.
- WP4 — `packages/app-shell/e2e/sucafina/reports.spec.ts:29,44`: entrada real no Workbench corrigida em `audit-ui`; [44560242503](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44560242503) passou 6/6 contratos de entrada/rotas. O e2e completo [44566617187](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44566617187) ainda falhou nos quatro casos. Há espera excessiva na continuação de import/renderização e nas leituras de reunião/atualização de agenda. O diagnóstico isolado [44565733175](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44565733175) renderizou o mesmo relatório real em cerca de 355 ms; isso não é aprovação do fluxo UI.
- WP5 — `product/wp12/native-execution-executive.test.ts:270,432`: em [44563889842](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44563889842), nove testes passaram, incluindo o executivo em 93,96 s; treinamento pendente ultrapassou os 120 s originais. A branch `audit-authority-snapshot` adiciona cópia isolada de uma única superfície, eliminando apenas uma cópia Dashboard descartada na autenticação. Gate [44569728195](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44569728195) em andamento.
- WP5/SF-8 — `product/wp10/integration/bi-call-scope.test.ts:99,104`: provar a composição final de projeções canônicas e drilldown com proveniência exata. O caso de dispatch já passou em [44566833078](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44566833078); o drilldown ainda falhou. Correção posterior em `audit-sf8`, gate [44568747068](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44568747068) em andamento.
- WP6 — Finance e fechamento dos dez casos originais: a ordem canônica das provas e os negativos de binding foram corrigidos na branch `audit-sf8`. O gate mais amplo teve 59 passes e um negativo novo inicialmente vermelho em [44554437644](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44554437644); esse negativo foi corrigido depois. Ainda faltam comprovar os budgets originais de Finance: [44566652143](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44566652143) em andamento.
- WP7: nenhum `sf-ci` completo foi disparado nesta campanha. Não executar até fechar os WPs. Os shards cancelados do run inicial continuam sem resultado novo.
- Compilação/guards conjuntos: candidato diagnóstico `audit-qualification1` em `f8ee8890dd6891edec0fc3e236694c253e40e2f5`, gate [44569979607](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44569979607) em andamento. Não equivale a integração nem a aprovação dos WPs de runtime.

## Decisões e justificativas

- Asserções removidas: nenhuma. Nenhum budget de teste original foi aumentado. Um matcher negativo de Content-Type trata header ausente como string vazia, mantendo a proibição de MIME Office numa resposta negada.
- Controles que não existem: o console legado sem query continua deliberadamente inexistente. `GET /sucafina/dashboard|planner|procurement` sem query deve seguir 404 com `legacy console decommissioned — use /`. `?page=` é shell; `?asset=page` é fragmento; operações reais continuam explícitas por `?sf=`.
- Não inventar permissões, provas, resultados, dados ou aprovação humana para satisfazer UI.
- Cada validação usa snapshot `ci-run-linux-*` e `.ci-run.json`. Na implementação atual do workflow, Playwright usa package `app` e configuração de produção; o runner Bun executa `bun test`, portanto typechecks reais usam harness Node CI-only.
- Harnesses, traces, pedidos `.ci-run.json` e workflows diagnósticos não pertencem à integração de produto.
- Os experimentos de hash one-shot e comparação estrutural de snapshots não demonstraram ganho suficiente e não foram integrados.
- `apps/cli/script/distribution-payload.ts` não foi alterado por esta campanha; não repetir o pacote já aprovado sem alteração desse arquivo.
- Commits intermediários em `audit-one` usam `[skip ci]` para reservar a execução completa para o fechamento.

## Como retomar

1. Ler este arquivo e verificar o HEAD atual de `audit-one`; produto integrado neste checkpoint: `f4ed9e86d4259d12dc38113cd250b8c683c70161`. Não substituir o teste WP13 integrado pelo mais antigo da branch SF-2: o blob correto é `59756ace4ed97c0d90c29b933da01bb466a20430`.
2. Primeiro comando via GitHub: consultar jobs e logs dos gates 44569728195, 44568747068, 44566652143, 44569979607. Nenhum teste local ou shell é necessário.
3. Branches de trabalho neste checkpoint: `audit-authority-snapshot` = `02e795c8f0e1054754c13e551f7a84800c4de041`; `audit-sf8` = `19b74c684dabb689ab73695ad8f5a4fba5662b82`; `audit-ui` = `f6b5a93d7eca7534cc3438c2b179bbf45e519654`. Integrar sequencialmente somente os arquivos próprios revisados e qualificados. A correção temporal `planner/port.ts` é dependência do gate BI.
4. Resolver o ponto real ainda vermelho, executar o respectivo WP completo com os asserts/budgets originais e conferir logs. Fechar a compilação e guards no produto integrado.
5. Só então disparar um `sf-ci`, ler todos os shards, atualizar este handoff com o SHA e os resultados reais. Não abrir outro PR.

## Comandos e resultados

- `bun run typecheck` (core/CLI): aprovado em 44553716279, antes das mudanças posteriores.
- `bun run typecheck` (sucafina/core/CLI/app-shell) e `bun run typecheck:sf-e2e` (app-shell): em execução conjunta no gate 44569979607.
- `bun run check:spawn-imports` e `bun run check:guards --base origin/dev`: em execução no mesmo gate; também comparado contra a base real do PR `52d2c24f4f8cb776889b97894131df6ada43ce98`.
- `bun run test:ci`: equivalente via snapshots/pedidos GitHub descritos acima; arquivos exatos de cada escopo constam no `.ci-run.json` do SHA do respectivo run.
- `sf-ci`: ainda não executado. Este registro não declara o PR verde.
