# A1 — CI-01 / CI-10: run completo e triagem RED sem mascaramento
**Coleta GitHub MCP:** 2026-11-16, `sf-ci` run **[43958796792](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43958796792)**, `attempt=1`, `event=pull_request`, `head_branch=sf-ci-lean`, head SHA `2f94d74d50dceee8a3c0562feac27a7335171ae8`, checkout de PR merge ref **`31955bc313fa3f5ca1e52689c0007560810f0e72`** (pais `1cb77b8deb...` e `2f94d74d...`). Run `completed/failure`; início 21:18:50 UTC, atualização final 21:31:57 UTC. Este run histórico **não** é freeze C nem qualifica o SHA de um futuro PR A1.

## CI-01: todos os 12 jobs, resultados EXATOS (nenhum IN_PROGRESS)
| Nome GitHub | Job ID | `conclusion` exata | Diagnóstico / owner |
|---|---:|---|---|
| `sf/preflight` | 133620721302 | **success** | A2; negativos/seleção não bastam para atestar full |
| `sf/static-and-contracts` | 133620720909 | **failure** | A3+A6; TypeScript `TS2322` Planner `overview/index.tsx:331:91` |
| `sf/linux-native-omni` | 133620721191 | **success** | Omni Linux X64 comprovado somente neste run |
| `sf/test-CI-SF` | 133621219704 | **failure** | A3; 5 falhas, bail=5, detalhes abaixo |
| `sf/test-CI-CLI` | 133621219629 | **success** | A2/A6: escopo/exclusões B3 continuam não qualificados |
| `sf/test-CI-APP-SRC` | 133621219527 | **success** | App unit selecionada nesta tentativa |
| `sf/test-CI-APP-BROWSER` | 133621219558 | **failure** | A4; draft/sourcing + request-title races |
| `sf/test-CI-ATLAS-BUSINESS` | 133621219584 | **success** | A2/A6: equivalência B3 não demonstrada |
| `sf/test-CI-UI-OPERATIONS` | 133621219356 | **failure** | A4; HTTP 403/422 em 2 jornadas |
| `sf/test-CI-UI-DECISIONS` | 133621219458 | **failure** | A4; timeout e form inexistente, 3 testes não rodaram |
| `sf/test-CI-UI-REPORTS` | 133621219522 | **failure** | A4; input Forecast oculto em 2 casos, 2 não rodaram |
| `sf/verify` | 133627854960 | **failure** | A2: *fail-closed esperado*: upstream `static=failure, unit=failure, ui=failure` |

**Correção de snapshot obsoleto:** run anterior **[43956369500](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43956369500)** concluiu **`cancelled`** (Reports `cancelled`), portanto não satisfaz CI-01. No run 43958796792 Reports concluiu inequivocamente `failure`, não IN_PROGRESS. Novo run/checkout C será obrigatório depois de qualquer patch.

## CI-10: cada RED → categoria + caso/arquivo + owner e ação
A categoria é **hipótese de triagem pelo log**, não sentença sobre código sem reprodução; preservam-se asserts, auth, CAS e fail-closed. `TEST_FIXTURE` significa investigar expectativa/fixture/DOM contra produtor original, **não** corrigir teste para fingir PASS.

| Job / caso | Categoria CI-10 | Evidência de log (job/arquivo/caso) | DRI, próximo experimento |
|---|---|---|---|
| static / TypeScript Planner | **PRODUCT_BUG** | job 133620720909 `overview/index.tsx:331:91 TS2322` SVG `focusable` | A3 revisar árvore compilada após F0 A6 e executar typecheck fresco; não assumir fix ancestral = verde |
| SF / Microsoft composition | **TEST_FIXTURE** provisória + **BLOCKED_BY_SOURCE** | job 133621219704 `test/microsoft-composition.test.ts:23`, `microsoft-login/integration-fixture.ts:26`; “installed source drift requires owner reconciliation” | A3 (A8 fornece fonte se identidade); reconciliar hashes da fonte original, não alterar expected digest arbitrariamente |
| SF / Microsoft node | **TEST_FIXTURE** provisória + **BLOCKED_BY_SOURCE** | job 133621219704 `test/microsoft-node.test.ts:30`, mesma `integration-fixture.ts:26` | A3+A8; mesma causa-fonte, registrar sem duplicar correção |
| SF / chart | **TEST_FIXTURE** provisória | job 133621219704 `test/presentation.test.ts:30,99`; legenda Actual `#b54a22`, falta `fill` deste valor no SVG desenhado | A3 comparar contrato de série vazia/valores reais do produtor antes de decidir bug UI vs assert |
| SF / Planner OPEX XLSX | **TEST_FIXTURE** provisória | job 133621219704 `test/io-browser.test.ts:72`; linha visível mas `[name="b0"]` não encontrado, esperava `125` | A3 confrontar markup/contrato OPEX importado, preservar valor/anual no produtor |
| SF / gateway browser | **TEST_FIXTURE** provisória | job 133621219704 `test/operator-browser.test.ts:38`; esperado 16, obtido 17 | A3 inventariar superfície real de enrollment, distinguir nova rota legítima de abertura indevida; não atualizar contagem sem auditoria |
| APP-BROWSER / sourcing refresh 2 testes | **PRODUCT_BUG** provável | job 133621219558 `procurement-draft-leaves.test.ts` “refresh in flight...” e “refresh completing during digest...” `RangeError Maximum call stack size exceeded` em `procurement/sourcing/index.tsx:153` | A4 reproduzir loop reativo, validar isolamento/lease, nunca suprimir refresh |
| APP-BROWSER / requisition/409/422 | **TEST_FIXTURE** provisória | job 133621219558 `procurement-draft-leaves.test.ts:159,184,214` `Save requisition draft` / `Create request` indefinidos e resposta conflitante | A4 comparar DOM, permissões, rotas vs produtor; preservar 409/422, CAS e quarantine |
| APP-BROWSER / request title races (4 casos) | **PRODUCT_BUG** provável, validar fonte | job 133621219558 `request-title-races.test.ts:116`, casos same-CAS navigation, owner invalidation, reload e preflight pós-digest | A4 revisar sequence/fence/side effects sem aceitar postagem de intenção expirada |
| UI-OPERATIONS / OP-IMPORT-01 | **TEST_FIXTURE** provisória; denial **não** é bug automaticamente | job 133621219356 `operations.spec.ts:28` esperado HTTP 200, obtido **403** | A4 reproduzir auth/origem/identidade em jornada instalada, descobrir por que servidor negou, sem remover autorização |
| UI-OPERATIONS / OP-DOC-01 | **TEST_FIXTURE** provisória | job 133621219356 `operations.spec.ts:33`, `operations-support/documents.ts:73`, esperado 200 obtido **422** | A4 inspecionar payload/validação real e versão/CAS, sem mudar servidor para aceitar inválido |
| UI-DECISIONS / planner versions | **TEST_FIXTURE** provisória | job 133621219458 `decisions.spec.ts:12`; timeout `180000ms` criando duas versões por controles humanos | A4 rastrear passos/visibilidade e produtores Planner, sem subir timeout/retry |
| UI-DECISIONS / procurement proposal | **TEST_FIXTURE** provisória | job 133621219458 `decisions.spec.ts:21`, `decisions-support/procurement-source.ts:7`; form `Requests` 0 contra 1 | A4 confirmar route/authorization/DOM, não forjar aprovação ou fallback |
| UI-REPORTS / RPT-01 e RPT-02 | **TEST_FIXTURE** provisória | job 133621219522 `reports.spec.ts:22,36` e `reports-support/review-flow.ts:180`; `Forecast` existe porém **não visível**, `locator.fill` timeout 180s duas vezes | A4 abrir painel correto e provar fluxo; sem `force`, retry ou aumentar timeout para esconder |
| `sf/verify` agregador | **CI_HARNESS** / `EXPECTED_FAIL_CLOSED`, **não defeito** | job 133627854960 `SF_CI_FAIL_CLOSED: upstream jobs not successful: static=failure, unit=failure, ui=failure` | A2/A6 manter diagnóstico antes de artifacts, validar negativo em SHA fresco; upstream reais RED |

**MISSING_REAL_ENV (não é RED de unit/PR):** Azure VM app/deploy/backups (A7), Microsoft/Entra sessões e atores (A8/dono), F04/U39/U40/AM01–06 no mesmo C com manifesto real (A9) **não foram exercitados pelo PR**; permanecem `BLOCKED_BY_ENV/OWNER`, nunca `NOT_APPLICABLE` nem PASS por mock. **CI_HARNESS deficits não exercitados:** B1 typecheck-inclusion, B2 drift YAML↔manifest, B3 cobertura CLI/Atlas, M2 generate+diff, M3 guarda base, M4 caso/identidade; A2/A6 com controles negativos.

**Sinais de aceite:** nenhuma correção fora do lease A1; A3/A4/A2/A6 trazem logs novos com casos exatos, test graph, run/attempt/checkout SHA e recibos. CI-01 final exige **run novo não cancelado no C congelado**, nunca reciclar este run histórico.
