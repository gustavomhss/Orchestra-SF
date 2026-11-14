# W30 — prova de browser delimitada após C29

W29 `813806af6c2ce74b2a087139c544e90dd1adcbe4` permanece com produto idêntico a W28. Esta alteração afeta somente o novo `forecast-submit.test.ts` e recibos anexados; nenhum renderer, script, produtor, fixture compartilhada ou infraestrutura muda.

## Resultados preservados

- C09→C17: dois casos completos PASS em C28, com C09, BCS, Atlas, C08 e scanner reais. Os cinco casos de autoridade também PASS. O run C28 permanece FAIL pelo oracle inicialmente incorreto do teste de fonte.
- C29: run `43628006308`, S `d33cc53660250bde7bfb19a26401f4c722fe4875`, **3 pass / 3 fail, 36 expects, seis testes / quatro arquivos, 42,39s**. Os dois testes de cálculo PASS, incluindo ausência do Request após revogação e estado durável estável; startup PASS. O primeiro teste UI chegou a timeout30s; segundo e finalizador falharam pelas invariantes de lease. O processo físico terminou; cleanup success.
- CHECK29: run `43628024706`, S `92319dad2957a023cf1a7c9cfe0e03e77e2242af`, **FAIL apenas pelos 13 diagnósticos estrangeiros; zero próprios**. WP10 tests, CLI, Atlas/typegen, spawn e guards PASS.
- F29: run `43628418430`, S `e71d4beacdc1309c1affa571454809dce172b8c1`, **PASS 10/0, 132 expects, três arquivos completos, 1044,00ms**. Cleanup success, artefatos vazios, Omni not applicable.

O gate estrutural 2/2 e F29 foram observados no mesmo W29. O failure da seleção mista C29 de UI não é convertido em PASS nem atribuído ao mecanismo de fonte.

## Correção do teste UI e hipótese discriminante

A prova C29 teve 36 expects: cinco de startup, 27 do cálculo e quatro no primeiro caso UI. Isso delimita por inferência que goto200, tipo implícito do botão e recusa local de fontes iguais foram alcançados; o log original não nomeia a espera seguinte. A contagem não identifica uma causa runtime.

O markup real contém label aninhado com select e textos de options. O locator exato `getByLabel("Comparison", { exact: true })` pode incluir esse texto descendente. A leitura estática do Playwright disponível localmente (1.62.1; não demonstrado como o driver exato de C29) fundamenta o novo locator `select[name="candidateRef"]`, que usa o campo efetivamente consumido pelo script. Continua sendo um selectOption real sobre o formulário; nenhum valor é injetado no script ou handler.

As mesmas assertions de botão, bloqueio local, payload completo, preparo/start/read/output, DOM, Enter/rejeição e preservação da entrada permanecem. Agora cada await tem fase registrada; respostas HTTP, eventos do cliente e pageerrors ficam nos logs. Timeouts nativos de ação/navegação são de até5s, ajustados ao limite cooperativo de trabalho18s. O timeout Bun continua30s; o finally usa a limpeza existente de até10s. Não há aumento de budget nem Promise.race que abandone trabalho. A fase e o erro original são propagados. A prova continua UI com HTTP/caso explicitamente sintéticos, sem crédito financeiro/nativo/AM05.

U30 ainda não foi disparado nesta preparação: precisa aguardar terminal e cleanup de X29. A seleção literal é startup → forecast-submit → lifecycle; não inclui cálculo/C09 já aprovados e inalterados.

## X29 existente, não duplicar

X29 run `43628663680`, job observado `132550149012`, S `d356d543298835b09b0452777fbd76cdaea77c85`, tree `d6e9e7e25fa52d292fb4d09b444e2440c4c3b728`, produto W29, está em voo nesta preparação. O teste `portfolio-exact-threshold.test.ts` mantém blob `fa4bdf61e69af2498b5668a5dfceb9286613d0bd`, 40expects e budgets285000/300000ms. Reanexar esse run; não lançar outro enquanto não houver resultado e hipótese nova.

O discriminante é a redução observada de quatro para dois envelopes de fonte, mantendo seis autenticações e quatro revalidações. A rota X efetivamente passa por esse mecanismo. Os três arquivos financeiros sugeridos no diagnóstico contornam essa fronteira por fontes de fixture; sua execução não testaria a hipótese4→2. Permanecem pendências financeiras globais, com relatório de alcance anexado. B26 falhou em `wp11/calculation-persistence.test.ts`, não em `composite-coverage.test.ts`; não se atribui causalidade comum por conveniência.

Todos os terminais, requests, jobs, artefatos e logs C29/CHECK29/F29 estão anexados. O resultado de X29 e o próximo UI pertencem aos recibos posteriores; nenhum resultado futuro é antecipado. Critérios171/tasks7/obrigações80 e os demais holds permanecem.
