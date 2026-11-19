# Handoff — lastmile-wp1-20261119

SHA: 8375685071b5b2603fa0391e4c4b5ec862330d5c (correção de uma linha posterior aos gates, NOT-VERIFIED e não integrada; o código executado pelo gate era 60c72befab1648133123ac5240ab134001a31194)
Data: 2026-11-19T15:01:42.817Z
Estado: partial

## Feito

- Correção posterior ao gate em 8375685071b5b2603fa0391e4c4b5ec862330d5c: review-flow.ts:105 serializa removeOne por `options.removeOne ?? false`. Elimina a comparação impossível introduzida pelo guard anterior, sem remover o guard ou qualquer asserção. É mudança de uma linha no attachment diagnóstico; não houve novo teste, typecheck ou integração desse patch.

- WP1 — `packages/app-shell/e2e/sucafina/reports-support/review-flow.ts` — edição limitada ao arquivo autorizado, a partir de `f590e80e7b4b5d6ae17ca753b40583019b50a998`.
- Forecast OPEX agora dirige o editor nativo `section.sf-budget-editor[data-sf-action="save-entry"]`: mês 1, campo `forecast`, revisão atual/proposta, confirmação `Save`, corpo real `domain.command.CAP04.save-entry`, uma escrita, releitura CAS e valor persistido após reload. Asserções de 110 → 190 e versão +1 preservadas.
- Reunião abre o capítulo UI48, exerce o botão real `Present review` / `Apresentar revisão`, verifica `data-sf-presentation`, identidade/versão e reabre a mesma URL. Aguarda `dashboard-review`, que é a operação efetivamente chamada por UI48.
- Valores capturados conservam ID, valor, unidade e período; referências exibidas precisam ser não vazias, únicas e corresponder aos botões `Open source <ref>` exatos. A referência não é presumida pelo prefixo antigo `sf-source:`.
- Follow-source não reescreve a URL emitida pelo produtor. Uma origem diferente da origem nativa ou um destino legado falha antes do clique. O valor de forecast esperado continua obrigatório.
- `removeOne: true`, anteriormente ignorado, agora falha explicitamente como UNBOUND. O contrato de remoção de registro e as asserções de revisão nova foram mantidos.
- Revisão fria independente do commit `08761c275d6eb63e16b5938c013944cee1195ae6` identificou perda da interação de apresentação. Corrigida em `60c72befab1648133123ac5240ab134001a31194` antes do gate. Revisão de código não substitui execução.
- Gate real: [test-ci 44548593492](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44548593492), attempt 1, **failure — 4 failed / 0 passed**. Todos falharam na mesma entrada anterior aos helpers alterados. Não há aprovação de runtime desses helpers.

## Pendente

- review-flow.ts:105 — o único sf-ci automático44551871355, checkout sintéticoaece7640562fe9830c54ee4e73836e830cc48e0c, detectou TS2367 no código integrado: `options.removeOne === true` depois de estreitamento para false|undefined. Essa regressão foi introduzida neste WP e não é herdada. Patch8375685071b5b2603fa0391e4c4b5ec862330d5c está preparado, mas NOT-VERIFIED e não integrado. O candidato e pacote permanecem4372b98d8e4db09a56f8ad589fb298c8779c84bf com a versão anterior; não transferir resultados entre esses SHAs.

- Entrada nativa não pronta — `packages/app-shell/e2e/sucafina/reports-support/review-flow.ts:21` — os quatro cenários não encontraram o link `Reports and backup`. Esta é a falha observada; os logs não provam sozinhos a causa do binding.
- Fixture/host — `packages/app-shell/e2e/sucafina/reports-support/production-installation.ts:124`, `:134`, `:201`, `:229` — produtor em localhost:4110, cookie localhost; frontend do runner em 127.0.0.1:3000. A seleção autenticada da instalação no shell nativo não está demonstrada por esta fixture. Arquivo fora da posse WP1; nenhum CORS, grant ou sessão foi fabricado.
- Remoção individual — `packages/app-shell/e2e/sucafina/reports-support/review-flow.ts:27` e `:110` — UI47 só remove seção inteira em `packages/app-shell/src/orchestra/chapters/sucafina/reviews/agenda/index.tsx:308`; não há controle nativo equivalente para retirar um dos 25 projetos. RPT-03 não pode alegar 24/25.
- Revisão nova — `packages/app-shell/e2e/sucafina/reports-support/review-flow.ts:154` — `preserveNewRevision` conserva o contrato antigo ainda unbound. UI48 consulta a disponibilidade de sucessor em `packages/app-shell/src/orchestra/chapters/sucafina/reviews/preserved/index.tsx:129`; não cria/preserva uma nova revisão.
- Follow-source — `packages/app-shell/e2e/sucafina/reports-support/review-flow.ts:429`, `:430` — falta provar que o produtor emite URL autorizada no capítulo nativo. O teste recusa legado e outra origem sem transformar a autorização.
- Forecast por ano — `packages/app-shell/e2e/sucafina/reports-support/review-flow.ts:446` — `packages/app-shell/src/orchestra/chapters/sucafina/dashboard/budget/index.tsx:68` rende aviso unscoped quando há ano selecionado. Falta o fato financeiro com esse escopo no capítulo; não foi substituído por visibilidade ou cálculo no browser.
- Callers fora do WP — `packages/app-shell/e2e/sucafina/reports.spec.ts:49`, `:56`, `:86` — aguardam `review-read` e presumem tópico Projects após reload, enquanto UI48 usa `dashboard-review` e a pauta nativa preserva a ordem escolhida. Não alterados.
- `changeForecast` (:185), reunião (:340), linhas capturadas (:380) e follow-source (:404) **não foram alcançados pelo run** por causa da falha em :21.

## Decisões e justificativas

- Asserções de negócio removidas: nenhuma. Não houve skip, xfail, timeout aumentado, baseline alterado ou resultado inventado.
- Asserções de implementação substituídas: `details/summary`, dialog `Edit record`, `data-version` e HTTP `preview-change/apply-preview` do console foram trocados pela revisão nativa atual/proposta, ausência de escrita antes da confirmação, corpo CAS exato, escrita única e releitura da versão persistida. A revisão nativa é local; não se inventou previewRef.
- O botão legado `Open meeting` foi substituído pelo controle existente `Present review`, com estado observável. Não foi recriado markup legado.
- O prefixo literal `sf-source:` foi substituído por refs reais da linha ligados a botões exatos. Isto comprova consistência da interface; a evidência independente de revisão preservada continua nas comparações `dashboard-review.value === saved`. Não se afirma que DOM contra DOM prova a origem independentemente.
- A evidência de guarda do briefing (0 errors, 183 warns, 2 protected-paths) pertence ao SHA base e não foi reexecutada neste WP.
- O JSON abreviado do briefing não é aceito pelo runner deste SHA. O request real usa `package: "app"`, `config: "e2e/playwright.production.config.ts"` e branch `ci-run-linux-*`.
- O commit com `.ci-run.json` foi criado antes da ref CI; houve apenas um run para WP1 e a configuração não entrou na branch de trabalho.

## Como retomar

1. Partir de `lastmile-wp1-20261119`, código `8375685071b5b2603fa0391e4c4b5ec862330d5c`, e ler este handoff. Qualificar a correção pós-gate de uma linha em nova rodada antes de integrá-la; o run anterior não testa este patch.
2. Corrigir primeiro o ingresso/autorização reais entre o shell :3000 e a instalação da fixture, em posse própria para o arquivo de fixture; verificar no artefato de erro o motivo da ausência do link. O spec nativo F04 existente depende de browser CDP autenticado, não fornece automaticamente esse ingresso local.
3. Executar novamente o mesmo spec somente após autorizar uma nova rodada da campanha; não usar um run antigo para qualificar código novo.
4. Implementar os controles ausentes no capítulo com o produtor correto em trabalho próprio; manter RPT-03 e follow-source falhando enquanto o contrato não existe.
5. A versão anterior do WP já foi integrada pela PR351; sf-join-four e pacote estão em4372b98d8e4db09a56f8ad589fb298c8779c84bf. O patch pós-gate fica separado, sem mover o candidato congelado ou disparar outro sf-ci. Consultar também docs/handoff/HANDOFF-lastmile-final-20261119.md na branch lastmile-final-20261119.

## Comandos e resultados

- Pós-gate: sf-ci44551871355/static job135657462411 comprovou TS2367 em review-flow.ts:105:126 na versão anterior. Patch8375685071b5b2603fa0391e4c4b5ec862330d5c não foi executado. Nenhum rerun/segundo sf-ci disparado para esse patch.

- `bun typecheck` (app-shell): **não rodado** — sem shell; o test-ci selecionado não tem etapa separada de typecheck.
- `bun run check:guards --base origin/dev`: **não rodado neste WP** — fechamento WP7.
- `bun run test:ci ...`: equivalente remoto por GitHub Actions, request abaixo.
- Branch CI: `ci-run-linux-wp1-20261119` (removida pelo cleanup).
- Commit CI: `733ce5b52448c0ff02a79a43aab1e53c87aa5125`; parent de código: `60c72befab1648133123ac5240ab134001a31194`.
- Run [44548593492](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44548593492): **failure**, quatro cenários executados e quatro falhos.
- Job de testes [135645828539](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44548593492/job/135645828539): `Run tests` failure. Request, Chromium, dependências Linux e Omni concluíram.
- Cleanup 135648446016: success.
- Artefato [14543550018](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44548593492/artifacts/14543550018): `playwright-ubuntu-24.04-1`, 238800 bytes; digest GitHub `sha256:c35b7008b8f287ec8d51741e73291a393ae004db07e28a1dd026289ad8457e1e`. É evidência E2E, não digest de pacote de release.
- `sf-ci`: **não rodado**; reservado ao SHA integrado final.
- Pacote: **não rodado**; não há candidato final integrado validado.
- Sem merge, sem push nas branches proibidas e sem alteração do PR #237.

```json
{"package":"app","runner":"playwright","config":"e2e/playwright.production.config.ts","args":["e2e/sucafina/reports.spec.ts"]}
```
