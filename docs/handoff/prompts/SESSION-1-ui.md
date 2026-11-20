# Sessão 1 — correções de UI que abrem as três jornadas

Branch a criar: `sf-ui-c02`
Base: `f7dd58e32bc834f1485df20b91adbf759b4c4ad0` (sf-join-four)
Acesso: apenas GitHub (`gustavomhss/Orchestra-SF`). Sem shell. Verificação por Actions.

## Escopo (arquivos que você possui)
- `packages/app-shell/src/orchestra/chapters/sucafina/procurement/requests/page.tsx`
- `packages/app-shell/e2e/sucafina/wp04/procurement.spec.ts`
- `packages/app-shell/src/orchestra/chapters/sucafina/dashboard/budget/index.tsx`
- `packages/schema/src/sucafina/procurement.ts` (só se precisar de campo opcional)

Nenhuma outra sessão toca esses arquivos.

## Tarefa 1 — anchors de proveniência C02 na tabela de Requests

Onde: coluna `number` da SfDataTable em `requests/page.tsx` (região da linha 593).
O quê: a célula passa a ser um link no mesmo formato de
`packages/app-shell/src/orchestra/chapters/sucafina/procurement/queues/panel.tsx:146-153`:

```tsx
<a href={"?request=" + encodeURIComponent(row.number) + "#" + encodeURIComponent(row.number)}
   data-source-ref={row.sourceRef ?? undefined}
   data-source-digest={row.sourceDigest ?? undefined}
   data-source-version={row.sourceVersion === null ? undefined : String(row.sourceVersion)}>
  {row.number}
</a>
```

Dados já existem: `apps/cli/src/sucafina-product/native-ui/procurement.ts:265` espalha
`publishedRequestBasis` em cada request (sourceRef/sourceDigest/sourceVersion).
Schema: se o request não declarar os três como `Schema.optional(...)`, adicione opcionais. Nunca obrigatórios.
Proibido: calcular digest no componente, inventar href, trocar anchor por texto.

Aceite: `a[data-source-ref]` presente, `data-source-digest` com 64 hex, `data-source-version` numérico.

## Tarefa 2 — transporte do wp04

Arquivo: `packages/app-shell/e2e/sucafina/wp04/procurement.spec.ts`, linhas 24-27.
Hoje: clona `selected.baseURL` e força `port = "3000"`. O host do wp04 serve a shell na própria origem
(`manifest.origin`, 4174); por isso o GET volta 200 e o heading `Requests` nunca aparece.

Mudança: navegar na origem que o host serve —
`new URL("/orchestra/sf-procurement/requests", selected.baseURL)` — e remover a linha que força 3000.
Referência: `e2e/sucafina/native/fixture.ts` (`shellOrigin`) e `native/journeys/reports-issuer.spec.ts` (`chapterUrl`).

Se `packages/server/src/web-ui.ts` + `wp04/host.ts` mostrarem que o host não serve a SPA na própria origem,
a correção é servir a shell nessa origem. Nunca `:4110`.

Aceite: o spec alcança `getByRole("heading", { name: "Requests" })` sem timeout.

## Tarefa 3 — link "Reports and backup"

`reports-support/review-flow.ts:20-22` exige, em `/orchestra/sf-dashboard/budget?year=<ano>`:
link "Reports and backup" visível, `href = /orchestra/sf-reviews/agenda`.

Verifique `dashboard/budget/index.tsx`: o link provavelmente está dentro de um `Show` que depende de dados.
Mova para fora de qualquer condicional de dados, de modo que renderize ao montar a rota.
Confirme `/orchestra/sf-dashboard/budget` em `route-registry.ts`.

Proibido: renomear capítulo, criar heading `Decisions`, recriar `#content`.
Aceite: a primeira asserção de `prepareReview` encontra o link.

## Gate (uma vez por tarefa, no seu SHA)

Crie branch `ci-run-ui-<n>` no SHA do commit e commite `.ci-run.json` na raiz:

```json
{ "package": "app-shell", "runner": "playwright", "args": ["e2e/sucafina/wp04/procurement.spec.ts"] }
```

Para a Tarefa 3 use `"args": ["e2e/sucafina/reports.spec.ts"]`.
O workflow `test-ci` roda e apaga a branch. Cite o run id e a conclusão.

## Economia de CI (obrigatório)
- Um gate por causa corrigida; nunca repita gate idêntico sem mudança de código.
- Gate só depois de um fix concreto; não use gate para "ver como está".
- No máximo 2 gates simultâneos.
- Mesmo gate falhando 2x no mesmo ponto sem mudança: pare e registre `unbound` com `file:line`.
- Não rode `sf-ci`.

## Regras
- Não recrie console morto: `#content`, `data-surface`, heading `Decisions`, `sidebar`, `Homologação local`, `details/summary`, `section[id]-pr` com `form[data-command]`.
- Não edite `modules/sucafina/Sucafinav1/runtime/application.ts`.
- Não enfraqueça asserção (apagar, pular, timeout maior, check vazio).
- Não rode `sf-ci`. Não faça push em `close-final-candidate`, `sf-red-clusters`, `go-live-close`, `sf-frontend-bundle`.
- Se um passo não existir no capítulo, pare e registre `unbound` com `file:line`.

## Handoff (obrigatório, mesmo parcial)
Commit `docs/handoff/HANDOFF-sf-ui-c02.md` seguindo `docs/handoff/HANDOFF-TEMPLATE.md`:
SHA, estado, feito por tarefa, pendente com `file:line`, justificativas, runs com id/conclusão, como retomar.

## Retorno
Por tarefa: `SHA | arquivos | run id + conclusão | unbound(file:line)`.
