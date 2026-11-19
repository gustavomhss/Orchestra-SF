# Handoff — finish-foundation-20261119

SHA do código: e67804463bf26f23ffc81701f2c2a3f11917be4f
Data: 2026-11-19
Estado: complete (escopo de ingresso; integração e gate final coordenados pela raiz)

## Feito

- Branch cirúrgico com 18 arquivos de código a partir de sf-join-four em 9af8b42ddb574ab1e58672fa382a3d39e5281fab. Os 17 blobs de ingresso vêm da composição 21 em 8a279c2e011954b3fa27e9f69f7b1fb78b4d3104; o transporte parte do próprio sf-join-four e recebe apenas tipos.
- CLI aceita origem pública explícita; defaults locais permanecem. Preparação e enrollment reais usam a origem do shell 3000. O proxy de E2E conserva path, Origin, Host, headers, cookies e a resposta original. O browser não acessa o listener 4110.
- Shell usa o caminho original de recuperação de servidor e seleção visual do projeto. F01 usa a instância opaca do transporte autenticado para a geração corrente. Refresh access e Sign out continuam ações originais, com 204 e posterior 401 exigidos no spec.
- CAP23 usa o resultado real ok/warnings da primeira gravação e relê a coleção autorizada. A lista conserva o ano; o usuário seleciona o registro produzido para editar e recarregar. Campos editáveis acompanham o draft real. Controllers consumidos deixam de abortar retrospectivamente a resposta, conservando o cancelamento de pedidos pendentes.
- Transporte: somente alias SfTransportFetch com Parameters/ReturnType de globalThis.fetch e uso nos três tipos de fetch existentes. Nenhuma mudança executável de transporte, retry, operação, registry ou autoridade.
- O subconjunto foi qualificado por [run 44607176525](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44607176525): SUCCESS, 2 passed (1.8m), job 135853860822. Snapshot ba016e0794008ca65b99527e365780f09fcdf7fe, código e67804463bf26f23ffc81701f2c2a3f11917be4f. O typecheck dos fontes SF E2E e o cleanup também passaram.

### Arquivos

- apps/cli/src/commands/commands.ts
- apps/cli/src/commands/handlers/serve.ts
- modules/sucafina/Sucafinav1/runtime/local-configuration.ts
- apps/web/vite.config.ts
- packages/app-shell/e2e/playwright.production.config.ts
- packages/app-shell/e2e/sucafina/installed-shell.ts
- packages/app-shell/e2e/sucafina/decisions-support/operator-session-cookie.ts
- packages/app-shell/e2e/sucafina/wp03/installation-fixture.ts
- packages/app-shell/e2e/sucafina/wp03/installation-setup.ts
- packages/app-shell/e2e/sucafina/wp03/native-ingress.spec.ts
- packages/app-shell/e2e/sucafina/bi-installed/installed-planner-ingress.spec.ts
- packages/app-shell/src/app.tsx
- packages/app-shell/src/i18n/orchestra-chapters/sf-context.ts
- packages/app-shell/src/orchestra/chapters/sucafina/host/owner-runtime231.tsx
- packages/app-shell/src/orchestra/chapters/sucafina/context/index.tsx
- packages/app-shell/src/orchestra/chapters/sucafina/planner/versions/index.tsx
- packages/app-shell/src/orchestra/chapters/sucafina/planner/versions/model.ts
- packages/client/src/sucafina/transport.ts

## Pendente

- Nenhum unbound de implementação no escopo de ingresso destes 18 arquivos.
- Merge em sf-join-four: responsabilidade do integrador. Este agente não executou o merge.
- Guards, demais WPs e o único sf-ci final: permanecem com o integrador; o resultado acima não é uma declaração de GO.

## Decisões e justificativas

- Asserções removidas: nenhuma prova de negócio. A suposição antiga de que o POST de criação retorna body.value foi substituída pela leitura CAP23 original: coleção inicial vazia, exatamente um registro novo, ID/nome/ano presentes, seleção, editabilidade, reload e exatamente um POST. O produtor original retorna ok/warnings sem identidade; o capítulo não fabrica ID.
- Nenhum controle legado foi recriado. O spec de ingresso usa o shell e CAP23 nativos.
- Dependências conferidas: installed-planner-ingress usa diretamente startPlannerInstallation e somente asRecord do journey existente; não depende de installed-fixture BI nem do harness C12. installation-setup chama prepareLocalConfiguration diretamente, portanto local/prepare.ts não é necessário. Nenhuma alteração de produto C12, UI54, Reports, Dashboard, registry ou host-context foi incluída.
- O template não está em sf-join-four neste SHA; foi lido em sf-handoff-brief/docs/handoff/HANDOFF-TEMPLATE.md, conforme briefing.
- O primeiro snapshot usou o nome ci-run-foundation-ingress-20261119. O guard do workflow rejeitou esse nome antes do checkout, pois exige ci-run-linux-*. O mesmo SHA foi publicado com o prefixo correto; nenhuma alteração de código, asserção ou timeout ocorreu entre esses dois runs.

## Como retomar

1. Revisar finish-foundation-20261119: código e67804463bf26f23ffc81701f2c2a3f11917be4f e este handoff posterior.
2. Conferir o run 44607176525 no snapshot ba016e0794008ca65b99527e365780f09fcdf7fe. O pedido foi package=app, runner=playwright, config=e2e/playwright.production.config.ts, com os dois specs listados abaixo.
3. Integrar somente este ramo cirúrgico. Não transportar os 103 commits da composição ampla.
4. Continuar os WPs e o gate final sob coordenação do integrador.

## Comandos e resultados

- test-ci / typecheck dos fontes SF E2E: SUCCESS, run 44607176525, job 135853860822.
- test-ci / Playwright: SUCCESS, 2 passed (1.8m), sem retries; e2e/sucafina/wp03/native-ingress.spec.ts e e2e/sucafina/bi-installed/installed-planner-ingress.spec.ts.
- test-ci / cleanup: SUCCESS, run 44607176525, job 135856537656.
- Tentativa anterior [44606846796](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44606846796): FAILURE no guard do nome da branch antes do checkout, job 135852688680. Nenhum teste foi executado. Resolvida pelo mesmo snapshot no nome ci-run-linux-foundation-ingress-20261119.
- Evidência anterior da composição ampla: [44601687942](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44601687942), SUCCESS, 2 passed (1.7m), snapshot cb5f14e62c934c32ef084eebeae1a0028918734b, código 15388053117883174329454207e60e2a878f5426. O run novo acima qualifica especificamente o subconjunto cirúrgico.
- bun run check:guards --base origin/dev e sf-ci: não executados neste ramo; gates finais coordenados pelo integrador.
