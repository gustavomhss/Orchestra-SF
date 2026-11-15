# Current fixture revision after Unit01

The current proposed test is blob `6dc37ec8d08fb4c0c0274ffa7d25ad951a7cd388`. Unit01 observed 32 PASS / 3 FAIL because optional-call argument short-circuiting skipped counter increments when no hook was installed. The counter now increments unconditionally before the optional callback. The same 35 cases, all 49 expect-containing lines, data and budgets are preserved. Unit02 passed all 35 cases with 145 expects in run43670461431; the historical design and planned matrix follow.

# P7 — matriz dos testes adicionais do produtor de métrica

Estado: **proposta para overlay W, não executada**. Arquivo previsto: `modules/sucafina/Sucafinav1/test/product/decisions-installed-journeys/known-subtotal-metric.test.ts`.

O arquivo mantém os cinco testes E2E e seus budgets intactos. Usa uma lease UI criada e consumida por `createSfUiAuthority`; `assessCostCoverage`, `plannerCoverageComplete`, `comparePlannerScenarios`, `plannerKnownSubtotal` e digests são as implementações canônicas. As respostas de histórico, caso, projeção, fonte e cobertura são fixtures explícitos de portas, inclusive adversariais quando o teste pede recusa. Não há criação de dados em instalação, navegador, dispatch de HTTP, seed da jornada ou teste local executado.

## Matriz de 35 casos planejados

| Grupo | Casos | Resultado exigido e risco coberto |
|---|---:|---|
| Diferença nominal condicionada | 1 | Baseline1200, candidato2400, métrica1200USD; coverage pending e totals null preservados; dois ciclos de produtores, dois históricos ordenados e dois full-case reads |
| Prova completa | 1 | O comparador canônico confirma a fixture antes de exigir métrica confirmed; completeDifference1200 |
| Zero e ausência | 1 | Zero explícito produz0 condicionado; dados totalmente ausentes escolhem legado e produzem null; subtotal0 forjado sobre componentes ausentes é recusado |
| Ordem aritmética | 1 | Valores de ponto flutuante distinguem ordem de soma; diferença1 conforme Planner, sem reordenação |
| Reuso de objetos nas portas | 1 | A mesma instância de resposta pode ser reaproveitada pelo provider sem confundir baseline/candidato; mutar o retorno não modifica dados ou próxima chamada |
| Drift entre fases | 3 | Fonte, assessment de cobertura e engine da projeção alterados depois da primeira fase produzem stale |
| Fences finais | 1 | Histórico muda em metadata mesmo mantendo o digest monetário; caso muda em conteúdo mesmo mantendo a versão declarada; ambos recusados |
| Troca de métodos | 10 | Histórico, leitor geral, caso, projector, fonte, cobertura, requestFor, revalidation, authentication e environment são trocados por funções que delegam os mesmos valores; identidade diferente continua recusada |
| Request/autoridade/payload | 5 | Troca do Request, headers, accessRevision real do emissor, abort e payload alterado impedem publicação |
| Lease forjada | 1 | Cópia serializável de binding/contexto não recupera a lease; nenhuma leitura histórica ocorre |
| Argumento mutado pelo callback | 1 | Mutação do source argument é recusada; fonte original do caso permanece intacta |
| Ordem e escopo de histórico | 1 | Resultados baseline/candidato invertidos e incarnation de outro caso são recusados |
| Prova monetária | 3 | Subtotal persistido incorreto com hashes atualizados, valor de componente diferente e IDs duplicados reconciliados numericamente continuam recusados |
| Shapes não suportados | 2 | Operação e assumption selecionam sentinel e entram no wiring real do legado; dois batches originais, sem scalar fallback e sem operação alheia |
| Falha elegível | 1 | Projeção elegível sem engine não chama o legado embora ele pudesse retornar valor |
| Sucesso elegível no wiring | 1 | O factory real usa produtor estreito e não chama o comparador legado |
| Denial de cobertura elegível | 1 | O denial do port é preservado exatamente; não existe retry pelo legado |
| **Total** | **35** | **Nenhum caso executado pelo autor desta matriz** |

Os asserts de contagem verificam as fases frescas expressamente exigidas pelo contrato. Não tentam fixar todos os awaits internos ou a sequência de revalidações.

## Limites do fixture

A persistência é omitida intencionalmente para usar o fallback de portas independentes já definido em `readPortfolioSnapshot`. Este arquivo não se apresenta como conformance SQLite, readSnapshotRoot, SourcePersistence ou CurrentChoice; esses contratos mantêm suas suítes próprias.

O produtor chama o helper canônico `readHistoricalScenarios`. As portas explícitas deste arquivo são facades opacas e, portanto, exercitam a delegação scalar ordenada, a preservação de observações por fase, reuso de objetos e rejeição de respostas trocadas. O registro privado de batch C08 continua coberto pelas suites canônicas existentes; não foi inventado um token de batch para o teste.

O teste do wiring instancia `createSfPortfolioAuthority` real. As dependências fora de `readMetric` lançam erro caso sejam alcançadas; não são uma instalação fake capaz de substituir a qualificação UI.

## Artefatos

- Texto completo: `m52-work/p7-tests/known-subtotal-metric.test.ts.txt`.
- Material: `m52-work/p7-metric-tests-material.json`, SHA256 `b59652de9b525b214dfa1c2160e37fc6d1089c4187eb3d711b5ca66fed7b468a`.
- Patch: `m52-work/p7-metric-tests-complete.patch`, SHA256 `8dd622a7460145bb826acb48578587b39593f2d8d55120404106016687df9a2d`.
- Blob do teste: `0c9b769dbe97bfb13a16b5781f417f1215b63190`; SHA256 `12c6691353c83e372d3eab18f74eddc05f69d48db10ad9f0fcbde0d0ec372da9`.
- Dependência P7 revisada: `p7-metric-material-v2.json`, SHA256 `6302975fc3bf0446f38dc9bdd7e9158197da3875288fc572e95b334c6ba3558f`; produtor `0fbe3adf8280621b93972385e3af36dfa833c831`.

Foram feitas apenas leitura das assinaturas, revisão de código e hashes/diffs de texto. Não foi executado parser TypeScript, compilador, produto ou teste. Nenhum timeout foi acrescentado ou alterado. O root decidirá a incorporação no W isolado e fará a seleção cirúrgica no Actions.


A revisão cruzada estática identificou que o produtor v1 convertia o denial de lease sem Request em stale no guard final. O produtor v2 faz early denial antes dos leitores. A assertion denied e os bytes do teste permaneceram inalterados; isto não é resultado de teste executado.
