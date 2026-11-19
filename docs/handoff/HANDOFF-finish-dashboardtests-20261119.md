# Handoff — finish-dashboardtests-20261119

SHA: eccff83bf952dbad3da2de41b6fcd961d496a6dc (código qualificado; o commit deste handoff acrescenta apenas documentação)
Data: 2026-11-19
Estado: complete

## Feito
- WP02, unidades de continuidade, confirmação e sinais: `modules/sucafina/Sucafinav1/test/product/dashboard-installed-closure/{fixture.ts,source-continuity.test.ts,confirmation.test.ts,signals.test.ts}`.
- A fixture usa as sessões cifradas, o Request original, a autoridade instalada e os handlers reais de projeção CAP01/CAP13. A admissão nativa consulta `identity.person(request)`; uma sessão existente sem acesso ao domínio continua distinguida de uma sessão inexistente.
- Leituras de continuidade usam o export JSON original, e os fatos de Attention são verificados no DTO nativo. As rotas HTML descomissionadas são afirmadas como 404.
- Preservados os IDs numéricos 0/7/8, identidade e conteúdo dos sinais, limites UTC e de 90 dias, SQLite reaberto, ausência de escrita incidental, revogação, logout, mutação tardia e integridade dos registros não relacionados.
- Gate: run [44597742439](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44597742439), SUCCESS, 11 testes, 0 falhas, 298 asserções, 4.96 s; snapshot `270ae458b64900b64e46b2d520154a128294e3a9`, cujo pai é o SHA de código acima.

## Pendente
- Nenhum item unbound neste recorte de unidades. O gate de navegador dos WPs instalados e o sf-ci final são trabalho separado; este run não declara qualificação do navegador nem GO.

## Decisões e justificativas
- Asserções removidas: nenhum fato de negócio ou negativo de autorização foi descartado. As expectativas de HTML 200, `data-signal-priority` e âncora `#record-7` do console aposentado foram substituídas por conjuntos exatos de IDs, ligação page/recordId/fact e dados de registro dos DTOs CAP01/CAP13, produzidos pelo handler original. Acrescentada a verificação 404 das páginas HTML antigas.
- As leituras após retirada da escrita, após logout de outro ator e do ator independente mantêm o teste de acesso/conteúdo pelo export JSON real; os status 200/401 e a ausência de conteúdo privado continuam afirmados.
- A negação CAP01 é 403 para sessão autenticada cujo acesso foi revogado. O primeiro gate expôs uma fixture que chamava autenticação sem contexto; a correção usa o leitor original de sessão, preservando a asserção 403.
- Não foram acrescentados timeouts, skips, grants, recibos, digests ou produtores artificiais. Nenhuma alteração de produção.

## Como retomar
1. Partir de `finish-dashboardtests-20261119` no SHA de código acima (mais o commit documental deste handoff).
2. Integrar o PR em `sf-join-four` preservando os quatro arquivos e este handoff.
3. No fechamento global, executar o único sf-ci final conforme o briefing. Para reproduzir apenas este gate, criar snapshot `ci-run-<nome>` com o pedido abaixo, sem modificar seus três arquivos alvo.

## Comandos e resultados
- `bun run typecheck` (app-shell): não rodado neste recorte, que altera somente unidades/fixture do módulo.
- `bun run check:guards --base origin/dev`: não rodado neste recorte; reservado ao fechamento global.
- Pedido test-ci:
  ```json
  {"package":"sucafina","runner":"bun","args":["Sucafinav1/test/product/dashboard-installed-closure/source-continuity.test.ts","Sucafinav1/test/product/dashboard-installed-closure/confirmation.test.ts","Sucafinav1/test/product/dashboard-installed-closure/signals.test.ts"]}
  ```
- Run [44596917728](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44596917728): FAILURE, 10 pass / 1 fail / 297 expect; fixture retornava 401 onde o negativo autenticado exigia 403.
- Run [44597742439](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44597742439): SUCCESS, 11 pass / 0 fail / 298 expect. Job `135820499768`; cleanup `135821559165` SUCCESS e branch temporária removida.
