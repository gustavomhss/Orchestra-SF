# Handoff — golive-continuation-20261119

SHA: 66511265924b0005b0a82aa3e6cdd118923758b3 (último commit de implementação; o commit deste documento é separado)
Data: 2026-11-19
Estado: partial

Base imutável: `f7dd58e32bc834f1485df20b91adbf759b4c4ad0` (`sf-join-four`). O GitHub compare confirma quatro commits à frente e nenhum atrás; oito arquivos de código/fixture alterados. Nenhuma declaração de GO é feita.

## Feito

- **T1 — C02 em Requests.** Commit `81bbf1fc975bd3812cc04d72ef478ecf8d18bb4d`. `packages/app-shell/src/orchestra/chapters/sucafina/procurement/requests/page.tsx:596` renderiza o anchor de número com href e source-ref/digest/version publicados pelo produtor. O guard de número ausente preserva o schema opcional sem inventar href. `packages/schema/src/sucafina/procurement.ts:170` já declara os três campos opcionais; não foi alterado. `packages/app-shell/e2e/sucafina/wp04/procurement.spec.ts:26` exige exatamente um anchor na request semeada e mantém digest de 64 hex, versão numérica, referência e visibilidade.
- **T2 — origem wp04.** Commit `0d2ccfdecc720ba234b648f4dc33c802fcfe9a44`. `packages/app-shell/e2e/sucafina/wp04/host.ts:73` usa `server.url.origin`; em :115 resolve o build real e compõe `WebUi.layer` na mesma origem 4174. As três navegações do spec usam a origem do manifest. Origem, autenticação, cookies e guard de POST permanecem efetivos.
- **T3 — ingresso Reports.** Commits `3594024d978c7169e682d039b5c94e6bf7987895` e `66511265924b0005b0a82aa3e6cdd118923758b3`. `packages/app-shell/src/orchestra/chapters/sucafina/dashboard/budget/index.tsx:133` mantém o link fora do `SfStatePanel`. Rota CAP03 confirmada em `packages/app-shell/src/orchestra/chapters/sucafina/route-registry.ts:32`; sem renomear capítulo. Os fixtures `reports-support/production-installation.ts` e `reports-support/fixture.ts` usam o CLI real em 127.0.0.1:4175, com preparo/enrollment originais e baseURL coincidente. `e2e/playwright.production.config.ts` desativa o proxy de preview somente na seleção Reports. `reports-support/review-flow.ts:21` preserva as duas asserções e, em falha, registra apenas estado renderizado limitado e relança o mesmo erro.
- **Revisão independente:** revisão de fonte dos três arquivos T1/T2 e dos cinco arquivos T3. O achado de estados omitidos no diagnóstico foi corrigido em `66511265924b0005b0a82aa3e6cdd118923758b3`. Revisão de fonte não foi contabilizada como aceite de runtime.
- **Actions:** exatamente um snapshot de teste por tarefa; nenhum rerun. T1/T2 executam o spec wp04 no código `0d2ccfdecc720ba234b648f4dc33c802fcfe9a44`; T3 executa Reports no código `66511265924b0005b0a82aa3e6cdd118923758b3`. Cada snapshot adiciona somente `.ci-run.json` ao código indicado.

| Tarefa | SHA do snapshot Actions | Run | Estado nesta captura |
| --- | --- | --- | --- |
| T1 | `6bf7372fb1817839869f961be9b7902eed55c266` | [44639609743](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44639609743) | in_progress; conclusão pendente |
| T2 | `d2252635f8b86b208274ace7cc34d956bc999d0b` | [44639618933](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44639618933) | in_progress; conclusão pendente |
| T3 | `6c8faebe749844233d4d5695f7017dbbe84f85e0` | [44639932900](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44639932900) | in_progress; conclusão pendente |

## Pendente

- **T1** — `packages/app-shell/e2e/sucafina/wp04/procurement.spec.ts:26` — aguardar conclusão e ler o job nominal; ainda não há conclusão do aceite C02. O passo `Typecheck the installed SF E2E sources` passou no run 44639609743; o passo `Run tests` está em execução.
- **T2** — `packages/app-shell/e2e/sucafina/wp04/procurement.spec.ts:25` — aguardar conclusão e conferir que o heading Requests foi efetivamente alcançado. Não inferir montagem por HTTP 200.
- **T3** — `packages/app-shell/e2e/sucafina/reports-support/review-flow.ts:22` — aguardar conclusão. Se o ingresso falhar, usar `REPORTS_ENTRY_UNBOUND` do job: pathname, headings conhecidos, superfícies/estados visíveis e contagem do link, sem corpo de página ou credenciais.
- **WP04 posterior ao ingresso, observado em fonte e ainda não medido no run:** `packages/app-shell/e2e/sucafina/wp04/procurement.spec.ts:140` cobra seção/form de PR legado; :202 cobra reconciliação que preserve entradas; :328 cobra details/summary de sourcing; :473 cobra filtro por formulário/query. Não recriar esses elementos. A revisão nativa de comandos e as rotas próprias devem orientar a próxima tarefa; registrar a primeira falha realmente medida.
- **Reports posterior ao ingresso, observado em fonte e ainda não medido no run:** `packages/app-shell/e2e/sucafina/reports-support/review-flow.ts:57` preserva UNBOUND explícito para remoção de um registro autorizado. Não apagar o requisito nem simular cobertura.
- **PR #393** — head `d8938c31cd818648cfc78828eb32bcb68c04165e`: API retornou zero check-runs e zero commit statuses. Nenhum check nominal falhou, mas não existe evidência de todos os checks success no head. Deixado aberto, sem merge.
- **PR #392** — head `9f1d4d8643ef7858d365008587c544f556178d62`: open/draft; sem merge e sem ready.

## Decisões e justificativas

- **Asserções removidas:** nenhuma asserção de negócio foi eliminada. A expectativa antiga `row.getByRole("link").toHaveCount(0)` foi substituída pela expectativa explícita pedida de um anchor com número, href e proveniência exatos; não seria coerente manter zero links ao implementar C02. O locator ambíguo `.first()` do ingresso foi substituído pela identidade da request semeada e count 1. Não houve skip, timeout maior, sucesso vazio ou relaxamento de digest/versão.
- **Controles que não existem:** os contratos legados e a remoção de registro acima permanecem pendentes; não foram fabricados para satisfazer teste.
- **Contrato real do runner:** o exemplo `package:"app-shell"` sem config é rejeitado pelo validador desta base. Foram usados o alias registrado `app`, `runner:"playwright"`, `config:"e2e/playwright.production.config.ts"` e exatamente o spec solicitado. `script/test-ci-request.ts:110` exige esses campos; `test-ci.yml:34` exige prefixo `ci-run-linux-`.
- **Escopo:** somente GitHub MCP; sem shell ou verificação local. Nenhum push nas quatro branches proibidas; nenhum `sf-ci`; nenhum código em `modules/sucafina/Sucafinav1/runtime/application.ts` alterado. A seleção Reports não usa a porta proibida. Nenhuma mudança em Schema.Never de exportação, digest, coverage ou byte download.
- **Template:** `docs/handoff/HANDOFF-TEMPLATE.md` não existe no SHA-base. Foi lido em `sf-handoff-brief`, commit `eb9af5681bd68c404bc1cda56844fb0757f18eb3`, blob `725697cdae3a42133df81a42637ff70214a78cb3`; os cabeçalhos foram preservados.

## Como retomar

1. Partir da branch `golive-continuation-20261119`, código `66511265924b0005b0a82aa3e6cdd118923758b3`. Confirmar o head atual pela API antes de qualquer atualização; não escrever nas branches proibidas.
2. Consultar os três runs acima e seus jobs `test (ubuntu-24.04)`; ler logs e registrar conclusão nominal e file:line. Não repetir as execuções desta tarefa.
3. Atualizar este handoff com os resultados finais. Corrigir somente o próximo unbound medido em uma nova tarefa autorizada, preservando os controles nativos e todos os contratos de negócio.
4. Reconsultar os checks de #393 no head vigente; merge comum somente se houver checks publicados, todos concluídos com success. #392 permanece draft e intocado.

## Comandos e resultados

- `bun typecheck` (app-shell): não executado localmente. Actions executa `bun run typecheck:sf-e2e --pretty false`; T1 passou esse passo, T2/T3 pendentes nesta captura.
- `bun run check:guards --base origin/dev`: não executado; nenhuma cobertura atribuída.
- Equivalente remoto de `bun run test:ci app --runner playwright --config e2e/playwright.production.config.ts e2e/sucafina/wp04/procurement.spec.ts --os linux`: runs 44639609743 e 44639618933, um por tarefa, conclusão pendente.
- Equivalente remoto de `bun run test:ci app --runner playwright --config e2e/playwright.production.config.ts e2e/sucafina/reports.spec.ts --os linux`: run 44639932900, conclusão pendente.
- `gh pr checks 393`: não usado shell; check-runs e commit statuses lidos pela API do GitHub no head observado. Resultado: nenhuma checagem publicada; merge não realizado.
