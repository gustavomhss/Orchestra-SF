# Handoff — golive-continuation-20261119

SHA: 66511265924b0005b0a82aa3e6cdd118923758b3 (último commit de implementação; o commit deste documento é separado)
Data: 2026-11-19
Estado: partial

PR de entrega: [#394](https://github.com/gustavomhss/Orchestra-SF/pull/394), draft, base `sf-join-four`.
Base imutável de criação: `f7dd58e32bc834f1485df20b91adbf759b4c4ad0`.
Até o commit de implementação `66511265924b0005b0a82aa3e6cdd118923758b3`, o compare do GitHub confirma quatro commits à frente, nenhum atrás e oito arquivos alterados. O documento acrescenta somente histórico documental.

**Conclusão:** as três correções foram implementadas e revisadas, mas os três runs nominais terminaram em failure. Todos passaram o typecheck SF E2E. Nenhum aceite de navegador ou GO foi declarado.

## Feito

- **T1 — C02 em Requests.** Commit `81bbf1fc975bd3812cc04d72ef478ecf8d18bb4d`. `packages/app-shell/src/orchestra/chapters/sucafina/procurement/requests/page.tsx:596` renderiza o anchor com o href solicitado e source-ref/digest/version do produtor. O guard de número ausente preserva o contrato opcional sem inventar href. `packages/schema/src/sucafina/procurement.ts:170` já declara os três campos como opcionais; schema e produtor não foram alterados. `packages/app-shell/e2e/sucafina/wp04/procurement.spec.ts:26` identifica a request semeada, exige um anchor e conserva as asserções de visibilidade, referência, digest de 64 hex e versão numérica. Evidência nominal: run **44639609743 — failure**, oito cenários falharam.
- **T2 — origem wp04.** Commit `0d2ccfdecc720ba234b648f4dc33c802fcfe9a44`. `packages/app-shell/e2e/sucafina/wp04/host.ts:73` usa `server.url.origin`; :115 resolve o build e compõe o `WebUi.layer` real na origem 4174. As três navegações do spec usam o manifest sem forçar porta 3000. Os controles de origem, autenticação, cookies e POST foram preservados no código. Evidência nominal: run **44639618933 — failure**, oito cenários falharam; heading Requests ainda não comprovado.
- **T3 — ingresso Reports.** Commits `3594024d978c7169e682d039b5c94e6bf7987895` e `66511265924b0005b0a82aa3e6cdd118923758b3`. `packages/app-shell/src/orchestra/chapters/sucafina/dashboard/budget/index.tsx:133` mantém o link fora do `SfStatePanel`; seu literal em :140 continua `Reports and backup` com href `/orchestra/sf-reviews/agenda`. A rota CAP03 está registrada em `packages/app-shell/src/orchestra/chapters/sucafina/route-registry.ts:36`; nenhum capítulo foi renomeado. Os fixtures `reports-support/production-installation.ts` e `reports-support/fixture.ts` usam o CLI real em 127.0.0.1:4175, preparo/enrollment originais e baseURL coincidente. `e2e/playwright.production.config.ts` desativa o proxy de preview somente para Reports. `reports-support/review-flow.ts:22–23` preserva as duas asserções; em falha registra observação limitada e relança o mesmo erro. Evidência nominal: run **44639932900 — failure**, quatro cenários falharam na primeira asserção.
- **Revisão independente:** os três arquivos T1/T2 e os cinco arquivos T3 receberam revisão de fonte. O achado de estados omitidos no diagnóstico foi corrigido em `66511265924b0005b0a82aa3e6cdd118923758b3`. Uma segunda revisão confirmou a correspondência entre SHAs, requests e handoff. Revisões não foram contabilizadas como testes.
- **Actions:** exatamente um run por tarefa, todos em attempt 1, sem rerun. T1/T2 executaram o código `0d2ccfdecc720ba234b648f4dc33c802fcfe9a44`; T3 executou `66511265924b0005b0a82aa3e6cdd118923758b3`. Cada snapshot acrescenta somente `.ci-run.json`.

| Tarefa | SHA do snapshot | Run e conclusão | Job nominal |
| --- | --- | --- | --- |
| T1 | `6bf7372fb1817839869f961be9b7902eed55c266` | [44639609743](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44639609743) — **failure**, 8 failed | [135966951081](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44639609743/job/135966951081) |
| T2 | `d2252635f8b86b208274ace7cc34d956bc999d0b` | [44639618933](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44639618933) — **failure**, 8 failed | [135966978619](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44639618933/job/135966978619) |
| T3 | `6c8faebe749844233d4d5695f7017dbbe84f85e0` | [44639932900](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44639932900) — **failure**, 4 failed | [135968076203](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44639932900/job/135968076203) |

Nos três jobs `test (ubuntu-24.04)`: `Typecheck the installed SF E2E sources=success`, `Run tests=failure`, `Upload Playwright evidence=success`. Os três jobs `cleanup=success`.

## Pendente

- **T1 — unbound(`packages/app-shell/e2e/sucafina/wp04/procurement.spec.ts:26`).** O aceite dos anchors não ficou comprovado. Run 44639609743: oito `Test timeout of 60000ms exceeded`, acompanhados de `Object with guid response@… was not bound in the connection`. O log identifica as declarações dos casos nas linhas 137, 173, 241, 288, 324, 440, 508 e 574; não identifica a última chamada do helper. A linha :26 indica o aceite pendente, não uma asserção que o log demonstrou ter falhado.
- **T2 — unbound(`packages/app-shell/e2e/sucafina/wp04/procurement.spec.ts:25`).** O heading Requests não ficou comprovado. Run 44639618933 tem os mesmos oito timeouts de 60000ms e erro de conexão Playwright. Os dois runs registram também `[Bun.serve]: request timed out after 10 seconds`, sem identificar o endpoint. Distinguir pela trace os limites :21 (enrollment), :23 (navegação), :25 (heading) e :26–32 (C02). Não atribuir esse aviso a uma rota específica sem evidência; não aumentar timeout.
- **T3 — unbound(`packages/app-shell/e2e/sucafina/reports-support/review-flow.ts:22`).** Os quatro casos falharam exatamente em `expect(reportsEntry).toBeVisible()`, após o prazo original de 10000ms; a asserção de href em :23 não foi alcançada. O job publicou quatro observações idênticas:

```json
{"pathname":"/orchestra/sf-dashboard/budget","visibleHeadingCount":0,"headings":[],"surfaces":[],"states":[],"reportsEntryCount":0}
```

  Isso mede ausência dos elementos coletados, não um DOM necessariamente vazio. A causa de inicialização/montagem anterior ao capítulo ainda não foi isolada. `apps/web/src/entry.tsx:148–163` condiciona a conexão canônica ao health check; `packages/app-shell/src/app.tsx:516–532` condiciona a montagem dos filhos à saúde do servidor. Na retomada, medir resposta principal, status de `/api/health`, erro JS/CSP sanitizado e estados do owner antes de alterar qualquer guard ou inventar identidade. O run atual não mediu um HTTP 401; autenticação/boot é hipótese, não causa confirmada.
- **Contratos posteriores wp04, observados em fonte e não comprovados neste run:** `packages/app-shell/e2e/sucafina/wp04/procurement.spec.ts:140` cobra seção/form legado de PR; :202 cobra reconciliação preservando entradas; :328 cobra details/summary de sourcing; :473 cobra filtro por formulário/query. Não reconstruir o console para satisfazê-los. As rotas, revisões e controles nativos devem orientar a próxima tarefa.
- **Contrato posterior Reports, não alcançado:** `packages/app-shell/e2e/sucafina/reports-support/review-flow.ts:58` preserva UNBOUND explícito para remoção de um registro autorizado. Não apagar esse requisito ou simular cobertura.
- **PR #393:** head `d8938c31cd818648cfc78828eb32bcb68c04165e`, open. Consulta final: **0 check-runs, 0 statuses, combined=pending**. Nenhum check nominal falhou; não existe evidência de todos os checks success. Deixado aberto, sem merge.
- **PR #392:** head `9f1d4d8643ef7858d365008587c544f556178d62`, open/draft. Não recebeu merge, ready ou qualquer mutação desta continuação.
- **PR #394:** permanece draft. A implementação está publicada, mas os aceites de navegador continuam pendentes.

### Evidências retidas

Os logs nominais foram lidos. Os artifacts contêm relatórios, error-context e, no wp04, traces; a identificação da última chamada do wp04 não foi obtida dos logs e permanece pendente de leitura da trace.

- T1: [artifact 14586402182](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44639609743/artifacts/14586402182).
- T2: [artifact 14585854618](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44639618933/artifacts/14585854618).
- T3: [artifact 14585829051](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44639932900/artifacts/14585829051).
- Nome nominal dos três artifacts: `playwright-ubuntu-24.04-1`.
- Primeiro error-context Reports: `packages/app-shell/e2e/test-results/sucafina-reports-CI-UI-REP-13ecb-ollowing-the-current-source-chromium/error-context.md`.
- Primeiro error-context wp04: `packages/app-shell/e2e/test-results/sucafina-wp04-procurement--9e351--without-clearing-the-draft-chromium/error-context.md`.

## Decisões e justificativas

- **Asserções removidas:** nenhuma asserção de negócio foi eliminada. A antiga expectativa `row.getByRole("link").toHaveCount(0)` foi substituída pela exigência explícita de um anchor com número, href e proveniência exatos, porque zero links contradiz a mudança de produto solicitada. O `.first()` do ingresso foi substituído pela identidade semeada e count 1. Digest, versão e referência continuam exigidos. Nenhum skip, timeout maior ou check vazio.
- **Controles que não existem:** os contratos legados e a remoção de registro acima permanecem pendentes; nenhum controle foi fabricado.
- **Contrato do runner:** `package:"app-shell"` sem config seria rejeitado nesta base. Foram usados o alias registrado `app`, `runner:"playwright"`, `config:"e2e/playwright.production.config.ts"` e exatamente o spec solicitado. `script/test-ci-request.ts:110` exige esses campos; `.github/workflows/test-ci.yml:34` exige prefixo `ci-run-linux-`. Seleção integral, um worker e zero retries.
- **Escopo:** somente GitHub MCP, sem shell ou verificação local. Nenhum push nas quatro branches proibidas e nenhum `sf-ci`. `modules/sucafina/Sucafinav1/runtime/application.ts` não foi alterado. A seleção Reports passa origem explícita 4175 e não usa o fallback de porta proibido. Schema.Never de exportação, digest, coverage e GET de bytes permanecem intactos.
- **Limite de execução:** os três runs autorizados foram consumidos e concluídos; não houve execução adicional para tentar obter verde.
- **Template:** o arquivo `docs/handoff/HANDOFF-TEMPLATE.md` não existe no SHA-base. Foi lido em `sf-handoff-brief`, commit `eb9af5681bd68c404bc1cda56844fb0757f18eb3`, blob `725697cdae3a42133df81a42637ff70214a78cb3`; os cabeçalhos foram preservados.

## Como retomar

1. Partir da branch `golive-continuation-20261119`, código `66511265924b0005b0a82aa3e6cdd118923758b3`, PR #394. Confirmar o head vigente pela API e criar uma branch isolada; não alterar as branches proibidas.
2. Ler os logs dos jobs acima e os artifacts já existentes, começando pelo primeiro error-context e a trace wp04 para localizar o último evento entre enrollment, navegação, heading e C02. Não repetir os runs desta tarefa.
3. Para Reports, investigar o boot antes de `review-flow.ts:22`: em `review-flow.ts:19`, observar o status real de navegação e health, presença do root/chapter e estados de descoberta/provider/view do owner. Confirmar a causa antes de mudar o transporte ou autenticação; não relaxar guards nem fornecer grant simulado.
4. Corrigir o próximo unbound medido mantendo os capítulos nativos, as revisões de comando e os contratos de negócio. Uma nova prova deve identificar seu novo código/SHA e não reutilizar estes runs falhos como aceite.
5. Reconsultar os checks de #393 no head vigente e fazer merge comum somente se houver checks publicados, todos concluídos com success. #392 permanece draft, sem ready.

## Comandos e resultados

- `bun typecheck` (app-shell completo): **não executado**. Actions executou `bun run typecheck:sf-e2e --pretty false`: **success nos três jobs**; não equivale a typecheck integral do produto.
- `bun run check:guards --base origin/dev`: **não executado**; nenhuma cobertura atribuída.
- Equivalente remoto de `bun run test:ci app --runner playwright --config e2e/playwright.production.config.ts e2e/sucafina/wp04/procurement.spec.ts --os linux`: runs **44639609743 failure** e **44639618933 failure**, um por tarefa, 8 failed em cada.
- Equivalente remoto de `bun run test:ci app --runner playwright --config e2e/playwright.production.config.ts e2e/sucafina/reports.spec.ts --os linux`: run **44639932900 failure**, 4 failed.
- `gh pr checks 393`: sem uso de shell; check-runs e commit statuses lidos por API no head vigente. **Nenhuma checagem publicada**, status agregado pending; merge não realizado.
