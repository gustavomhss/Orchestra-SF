# Handoff — finish-foundation-20261119

SHA: e67804463bf26f23ffc81701f2c2a3f11917be4f
Data: 2026-11-19
Estado: partial

## Feito

- Branch cirúrgico com18arquivos a partir de sf-join-four em9af8b42ddb574ab1e58672fa382a3d39e5281fab. Os17blobs de ingresso vêm da composição21 em8a279c2e011954b3fa27e9f69f7b1fb78b4d3104; o transporte parte do próprio sf-join-four e recebe apenas tipos.
- CLI aceita origem pública explícita; defaults locais permanecem. Preparação e enrollment reais usam a origem do shell3000. Proxy de E2E preserva path, Origin, Host, headers, cookies e resposta original. Browser não acessa o listener4110.
- Shell usa o caminho original de recuperação de servidor e seleção visual do projeto; F01 usa a instância opaca do transporte autenticado para a geração corrente. Refresh access e Sign out são ações originais, com204 e posterior401 exigidos no spec.
- CAP23 usa o resultado real ok/warnings da primeira gravação e relê a coleção autorizada. A lista conserva o ano; o usuário seleciona o registro produzido para editar e recarregar. Campos editáveis acompanham o draft real. Controllers consumidos deixam de abortar retrospectivamente a resposta, sem retirar cancelamento de pedidos pendentes.
- Transporte: somente alias SfTransportFetch com Parameters/ReturnType de globalThis.fetch e uso nos3tipos de fetch existentes. Não há mudança executável, retry, operação, registry ou autoridade.
- Evidência anterior do conjunto amplo: run [44601687942](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44601687942) success,2passed/1.7m, snapshotcb5f14e62c934c32ef084eebeae1a0028918734b, código15388053117883174329454207e60e2a878f5426. Esse resultado não é apresentado como prova do novo subconjunto; o gate abaixo qualifica a separação.

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

- Qualificar o subconjunto: packages/app-shell/e2e/sucafina/wp03/native-ingress.spec.ts:7 e bi-installed/installed-planner-ingress.spec.ts:12 — risco concreto de dependência removida ao separar a foundation da composição ampla. Gate estreito será criado no SHA deste branch.
- Merge em sf-join-four: responsabilidade do integrador após resultado; não executado por este agente.
- Guards e sf-ci final: permanecem com o integrador, uma execução final coordenada.

## Decisões e justificativas

- Asserções removidas: nenhuma prova de negócio. A suposição antiga de que POST de criação retorna body.value foi substituída por leitura CAP23 original: coleção inicial vazia, exatamente1registro novo, ID/nome/ano presentes, seleção, editabilidade, reload e exatamente1POST. O produtor original retorna ok/warnings sem identidade; nenhum ID é fabricado pelo capítulo.
- Controles que não existem: nenhum controle legado foi recriado. O spec de ingresso usa apenas o shell e CAP23 nativos.
- Dependências conferidas: installed-planner-ingress usa diretamente startPlannerInstallation e somente asRecord do journey existente; não depende de installed-fixture BI nem do harness C12. installation-setup chama prepareLocalConfiguration diretamente, portanto local/prepare.ts não é necessário. Nenhum arquivo C12, UI54, Reports, Dashboard, registry ou host-context foi incluído.
- O template não está em sf-join-four neste SHA; foi lido em sf-handoff-brief/docs/handoff/HANDOFF-TEMPLATE.md, conforme briefing.

## Como retomar

1. Partir de finish-foundation-20261119 eme67804463bf26f23ffc81701f2c2a3f11917be4f e deste handoff posterior.
2. Criar ci-run-foundation-ingress-20261119 com .ci-run.json para app-shell/playwright e somente e2e/sucafina/wp03/native-ingress.spec.ts + e2e/sucafina/bi-installed/installed-planner-ingress.spec.ts.
3. Ler resultado e atualizar este documento com run e snapshot. Se passar, integrador revisa e mergeia os18arquivos; não transportar os103commits da composição ampla.

## Comandos e resultados

- bun typecheck (app-shell): não rodado separadamente neste branch; verificações somente por Actions.
- bun run check:guards --base origin/dev: não rodado neste branch; gate final coordenado pelo integrador.
- bun run test:ci (Playwright,2specs de ingresso): pendente neste subconjunto. Evidência anterior44601687942 acima pertence à composição ampla.
