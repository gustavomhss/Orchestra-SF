# WP05 — implementação publicada e evidência de CI

**Estado de entrega: DRAFT / BLOCKED.** A implementação e os recibos estão na [PR #24 contra sf2-stack](https://github.com/gustavomhss/Orchestra-SF/pull/24). O CI foi executado e inspecionado. Os critérios integrados ainda não estão todos satisfeitos: há uma falha preservada no produtor Dashboard, um typecheck bloqueado por contratos/integração herdados e provas de host/nativo pendentes. Nenhum resultado parcial foi promovido a READY.

## Identidade e escopo

| Papel | Commit / tree |
| --- | --- |
| Seed real de WP05 | `b33541ede0fd715fc0990aebeb3fe484d0991cb7` |
| Produto final testado W2 | `fe75fd8b5daa25647bc4938025c82dbfc287a0a1` |
| Tree de W2 | `9e8847f921e3fdefdbd7b6cf92bc9536442f322b` |
| Snapshot de testes S2 | `988877105aff091ee9881a812282d677c63be5bb` |
| Tree de S2 | `dd702dc4f1fa58ba0a2ff0ef2500b542571c8566` |
| Descendente de recibos D1, examinado no último check | `a87c526d29106efc295dfeade1b1d754e2617783` |
| Tree de D1 | `116e6b994b9dec9c9280c088a14a6cfd636d8ff6` |

S2 é filho direto de W2 e acrescenta apenas `.ci-run.json`. A comparação remota e as 43 entradas originais da raiz têm hashes idênticos; [snapshot-equality.json](snapshot-equality.json) contém a prova. D1 remove três logs brutos rejeitados pelo guard e atualiza um recibo; produto, testes, fixtures e configuração permanecem iguais a W2. O fechamento posterior acrescenta apenas documentação de evidência; a PR identifica seu SHA e a comparação contra W2.

O handoff é `c4bd6592718b3862afbc7bb601c001365e593c20`; o plano imutável é `dbf9547211d9b0fade619790de7c19c0869b7c7d`; o pack lido tem blob `e58fa5f9ca42fefa0a9453114c6146d4e8942a5b`. A implementação respeita `product/analytics/`, `test/product/wp05/` e estes recibos. O workflow `.github/workflows/astra-wp05-check.yml` usa a exceção expressa do protocolo de CI. Publicação, PR e disparos de Actions foram feitos pelo GitHub MCP. Não houve merge, deploy ou alteração do plano, autenticação, infraestrutura ou produto de outro owner.

## O que mudou

- **Consumidor comum:** `dispatchBiPresentation` usa o dispatcher e a autoridade reais, valida a saída C16 e exige que a apresentação corresponda à projeção entregue. O factory fixa o produtor por contexto/request. Snapshots ficam separados dos objetos de callbacks antes de verificações assíncronas.
- **Destino C17:** `readBiDestination` relê a seleção, confere valueId, versão, motor, contexto e referência C17 inteira, resolve essa referência e verifica acesso novamente na saída. Estados revogado, histórico, substituído e ausente não retornam conteúdo como se fosse atual.
- **Brush:** o recorte `visualPeriod` mantém o período original de autorização e é validado como subconjunto. O teste novo liga a seleção realmente emitida pelo Chromium ao consumidor, com Dashboard C02, persistência, issuer e resolver C17 reais. É um harness BI01 em about:blank, com principal de fixture e destino C17 de página; não demonstra oito destinos granulares nem host nativo instalado.
- **Filtros e gráficos:** etapa/responsável/buyer solicitam nova seleção ao host. Ausência não cria marca nem influencia a escala; zero confirmado permanece. Waterfall mostra endpoints/totais fornecidos e sinais das contribuições. Marcos sem data fornecidos pelo produtor permanecem após o brush. Sensibilidade tem tabela equivalente, unidades declaradas e condição junto ao limiar.
- **Provas dos produtores:** a fixture própria substitui uma importação ausente de WP13 e chama Planner, solver, avaliação de critérios e store C08 reais. A variante EUR cadastra a moeda com `rate: null`, preservando câmbio ausente. Nenhuma asserção anterior de sensibilidade ou do marco sem data foi removida.
- **Discriminantes adicionais:** Top N sem agregado não vira total; o grupo “outros” conserva a referência fornecida; mudar apenas status atual não reescreve a série recebida; mudar apenas data não inventa economia nem elimina obrigação. Esses três casos têm escopo explícito de componente.

O [mapa de implementação](implementation-map.md) liga as onze perguntas aos arquivos e aos testes, distinguindo consumidores de teste da composição instalada.

## CI observado

| Execução | Resultado |
| --- | --- |
| [Testes S1 — 43518126352](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43518126352) | 98 PASS / 2 FAIL; 100 testes, 33 arquivos. A falha da fixture EUR foi corrigida em W2. |
| [Testes finais S2 — 43519544728](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43519544728) | **102 PASS / 1 FAIL; 103 testes, 34 arquivos, 480 asserções, 157,21 s.** |
| [Check W1 — 43518137324](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43518137324) | Guards PASS; typecheck FAIL com 186 diagnósticos. |
| [Check W2 — 43519560894](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43519560894) | Os dois erros novos da fixture desapareceram; typecheck 184. Guards rejeitaram três logs brutos incluídos nos recibos. |
| [Check final D1 — 43520127151](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43520127151) | **Guards PASS:** 78 regras, 605 paths, 0 gate, 11 warnings herdados, 0 errors. Typecheck FAIL com os mesmos 184 diagnósticos. |

O request final contém os **27 arquivos do handoff e sete novos**, sem exclusões, duplicatas ou filtro amplo. A ordem observada nos logs coincide com os 34 caminhos solicitados. `validateRequest`, `locateTestPackage`, `parseOptions`, `testPathsAt` e `omniControlScope` reais validaram os metadados; o workflow validou novamente o request. Os comandos foram `bun test` com essa lista explícita, `bun typecheck` em `modules/sucafina` e `bun run check:guards --base origin/dev`. Nenhum teste de produto foi executado localmente.

Request SHA256: `8ee2345d98c785d8bdee518c9625e6cf04e4f5926367aae30c5efe6e42748f4c`; forma compacta canônica do workflow: `5a3cb5e4ee782bb73db35adb975ea4b2d8f3f3b1b78ce8fe796b5559f6e55f8f`. A base real dos guards foi `a1d37698a7bb097c1578f827eba6a19b9917ef07`, com merge-base `9e4f3d35833f9b2cea6abdf58f42331f3973d9bf`.

Omni registrou **not applicable (focused: no declaring test ran)**; não há alegação de spawn/nativo. A lane bun não publica o artefato Playwright: a lista de artefatos dos testes é `[]`, confirmada pela API. Os três ZIPs de checks foram baixados, tiveram seus SHA256 conferidos e os membros product.json/typecheck.log/guards.log inspecionados. O [artefato final](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43520127151/artifacts/14081743852) tem 8304 bytes e SHA256 `4b89aef56a9df3b21aff85c529d374464eedc0036c88f9530bf3aeee9c9f34f5`.

A identidade W2/S2 prova os inputs Git. O workflow de testes existente usa bun install e registra “Saved lockfile”; não oferece uma comparação pós-instalação da árvore de dependências. O job específico de checks usa frozen-lockfile e confirmou que os arquivos rastreados ficaram intactos. Esta evidência não amplia o que cada workflow efetivamente mede.

## Resultados numéricos e seu limite

Os testes de motores passaram usando os resultados reais do Planner:

| Controle | Resultado observado |
| --- | --- |
| Renovação / transição | Subtotais conhecidos 240000 / 210000; diferença canônica −30000 |
| Vantagem com ordem explicitamente invertida no comparador | +30000 antes; −10000 após treinamento |
| Solver canônico isolado | Fronteira próxima de 55000; previews em 55000/55001 produzem diferenças −20000/−19999 |
| Treinamento integralmente omitido | Categoria pending/missing-category, sem zero inventado |
| Fonte independente com treinamento de 40000 | Subtotal conhecido 250000; solver próximo de 15000 |

A integração de sensibilidade conserva `conditioned`, `total: null` e intervalo amostrado; o BI não promove o solver isolado a limiar integrado exato. As variantes de treinamento usam stores distintos. Elas conservam o resultado anterior, mas não provam confirmação humana e ChoiceRecord na mesma instância de caso. [engine-boundary.md](engine-boundary.md) identifica os bloqueios de cobertura multicategoria e preview condicionado nos produtores.

## Bloqueios para READY

1. **WP02/S0 — marco sem data:** `dashboard-integration.test.ts:87` continua falhando porque `dashboard/scope.ts` e `dashboard/port.ts` do seed eliminam o marco antes do BI. O teste não foi enfraquecido. O owner pin `38d340a8857b96904f7246320091c14c051f1929` contém a correção dos produtores a integrar.
2. **WP00/S0 e composição do pacote — typecheck:** os 184 diagnósticos são 141 em arquivos herdados externos, quatro imports WP05 de contratos ausentes e 39 cascatas desse contrato (35 existentes e quatro callbacks novos). Não há diagnóstico na fixture corrigida ou no novo teste semântico. Os tipos/schema BI e SfBiArtifact estão identificados no pin WP00 `72342f0efbbe099231aa2e30a964769b14e4fbb2`; os demais sites externos estão enumerados na triagem.
3. **WP10 — consumidor instalado:** catálogo comum das onze perguntas, oito destinos exatos, ciclo de filtros autorizados, armazenamento/reabertura de artefatos e paridade UI/native/MCP permanecem sem prova integrada. [wp10-bi-http.patch](wp10-bi-http.patch) é um delta proposto, mecanicamente aplicável ao blob verificado; ele não foi aplicado ao produto de outro owner e não resolve sozinho o catálogo ou o drilldown.
4. **WP11/WP13 — decisão completa:** o preview publicado exige conditioned/total null enquanto o caminho integrado exato exige cobertura completa. A regra de classificação também rejeita a reutilização de um componente em múltiplas categorias permitida pelo pack. BI conserva os resultados e condições existentes; não contorna esses gates.

A [matriz dos 108 critérios](criteria.md) e [sua versão estruturada](criteria.json) atribuem implementação, consumidor, casos executados, run, escopo e lacuna a cada ID. A classificação final é **43 VERIFIED_SCOPED, 27 PARTIAL e 38 BLOCKED_EXTERNAL**, sem critérios sem avaliação. VERIFIED_SCOPED significa somente o comportamento observado naquele escopo; não é aceitação global. C/G7, D/G8, AM01–AM06, GNATIVE e as oito seleções finais não são declarados aprovados.

## Índice de evidências

- [ci-evidence.json](ci-evidence.json): identidades, runs, resultados, artefatos, hashes e limites.
- [test2-summary.json](test2-summary.json): os 103 casos da execução final, incluindo a falha preservada.
- [check3-triage.json](check3-triage.json) e [check3-triage.md](check3-triage.md): os 184 diagnósticos e os guards finais.
- [ci-request.json](ci-request.json) e [request-validation.json](request-validation.json): seleção normalizada e validação canônica.
- [dependency-ledger.md](dependency-ledger.md), [external-dependencies.json](external-dependencies.json) e [blocker-map.json](blocker-map.json): owners, pins e arquivos exatos.
- [cold-review-01.md](cold-review-01.md): finding do brush, correção e fechamento no harness, conservando o histórico.

Os logs completos permanecem no Actions, referenciados por run/job e hashes. Nenhum log bruto foi renomeado para contornar o guard.
