# Rastreabilidade Flamengo DEMO — estado inicial PENDING

A coluna **esperado** descreve critério de aceitação, não observação. Os suites A9 F04/AM não são exercidos por esta documentação. Todos os casos precisam do mesmo SHA congelado e de run IDs reais para avançar.

| Jornada / prova | Fixtures / ator | Produtor ou entrada real | Resultado esperado | Estado inicial / dependência |
| --- | --- | --- | --- | --- |
| U39 (CAP04) | `DASH-OPS`; `org.departments`, `opexOwners/opexEntries`; Daniel/Caio | `dashboard?page=OPEX Detail&year=2026` -> F04 native CAP04 | Fonte autorizada e revisão com CAS; perda de resposta recuperada; tentativa stale sem efeito | **PENDING** — A9: F04 manifesto e instalação C/identidade |
| U40 (CAP05) | `DASH-CAPEX`; `org.costCenters[*-02]`, `capexProjects/capexEntries`; Daniel | `dashboard?page=CAPEX Projects&year=2026` -> F04 native CAP05 | CAPEX com origem, valor, história e separação de ownership; stale/owner negado | **PENDING** — A9: F04/VM e execução real |
| Q01 Dashboard (negativa de grupo) | `ZICO-DENIED`, Zico | `GET /sucafina/dashboard` | **403** com Zico autenticado/sem grupo, sem registro privado; 401 não substitui | **PENDING** — sessão Entra real, A8 |
| Q01 Planner (negativa de grupo) | `ZICO-DENIED`, Zico | `GET /sucafina/planner` | **403** e sem dados de orçamento | **PENDING** — A8/tenant |
| Q01 Procurement (negativa de grupo) | `ZICO-DENIED`, Zico | `GET /sucafina/procurement` | **403** e sem cotações, pedidos ou fornecedores | **PENDING** — A8/tenant |
| Q01 release-only transport adicionais | Zico + wrong owner + stale-fence; refs F04 | `transport-integration.test.ts` original | Guest/invalid-owner/stale-fence independentes (não equivalentes à negativa de rota) | **PENDING** — A9 execução F04 em Linux C |
| AM01 | `PLN-BASE`, `DECISIONS`; Daniel/Sofie | Planner version/OPEX; domínio de decisões real | Receita AM01 **como definida em** `integrated-proofs/am01` com report próprio, sem substituição por seed | **PENDING** — AM01 pertence ao A9, ler recipe normativo |
| AM02 | `PLN-BASE`, `DECISIONS`; Daniel/Sofie | Planner forecast + decisões/horizon | Receita AM02 integral + recibo/contagem no C | **PENDING** — A9; não extrapolar sem runner |
| AM03 | `PLN-FX`, `DEC-TECH` | EUR ausência, versão e sensibilidade declarada | Dados faltantes permanecem unavailable; AM03 real executa sem supor taxa | **PENDING** — A9/host e prova de exceção |
| AM04 | `PROC-PENDING`, `PROC-APPROVED`, `DEC-STADIUM`; Gabriel/Pedro | Transições PR/source/PO e decisão | Requisito de aprovação humana/segregação, recibo normativo AM04 | **PENDING** — owner do PR + A9 |
| AM05 | `IMPORT-PLANNER`, `REPORT-DRILLDOWN` | Admit/preview/detail/Apply, report DOCX | Replay idempotente, proveniência e drilldown; recibo AM05 completo | **PENDING** — A9 |
| AM06 | `SCHEDULE-DIGEST` | `createRoutineSchedule` + native scheduler C07 | Admissão owner/recipe/condition, ocorrência, estado final distinto de started | **PENDING** — compositor de rotinas + A9 |
| UI-OPERATIONS (procurement) | `PROC-SOURCING`, `PR-FX-MISSING`, `PR-REVISION`; Caio/Pedro/Gabriel | `procurement?page=Requests` + Settings/Suppliers | Dois fornecedores, 422 em EUR missing, 409 em CAS stale, revisões preservadas | **PENDING** — A4 live test; produtor pode retornar 403 se auth incorreta |
| UI-OPERATIONS (imports) | `IMPORT-PLANNER`; Daniel | `sf=import-targets/admit/preview/detail/apply` | Preview não escreve, exatamente um Apply autorizado, receipt durável, sem efeito duplicado | **PENDING** — A4, sessão/target real |
| UI-DECISIONS | `DEC-STADIUM` + `DEC-TECH` alternativas A/B, sensibilidade; Daniel | `sf=workbench-command` draft e UI case/choice | Alts com fontes, análise, escolha humana preservada após alteração e histórico C10/C12 | **PENDING** — A4/C12; seed faz somente drafts |
| UI-REPORTS | `RPT-BOARD-2026` + departamentos/centros/PRs; Daniel/Sofie | `dashboard?download=docx&year=2026` + reports UI | Report não vazio + drilldown verificável até fonte, verso e recorte por papel | **PENDING** — A4, download não comprova drilldown |
| Dashboard geral | `DASH-OPS` + `DASH-CAPEX`; Daniel/Caio/Sofie | Dashboard Overview, OPEX Detail, CAPEX Projects | 6 departamentos + 12 centros no modelo; 12 fontes de custo visíveis no produto se admitidas | **PENDING** — fixture de hierarquia não cria por si um diretório de entidades no produto |
| Planner budget/forecast | `PLN-BASE`, `PLN-FX`, `planner.lines`; Daniel/Sofie | Planner Versions/OPEX + workbench import XLSX | Budget+forecast BRL; EUR sem FX não convertido artificialmente | **PENDING** — produtor no C e target real |
| Procurement estados | `PR-DRAFT`, `PR-PENDING`, `PR-SOURCING`, `PR-SRC-PENDING`, `PR-PO-DRAFT`, `PR-PO-PENDING`, `PR-APPROVED`, `PR-REJECTED`, `PR-FX-MISSING`, `PR-REVISION` | Máquina original `porta/act.ts`, fonte CSV, CAS HTML | Todos os estados **após transições reais**; ausência FX e stale sem mudança; nenhuma aprovação simulada | **PENDING** — cookies e Gabriel na matriz de aprovações |
| Procurement import (condicional) | `QUOTES-MKT`, `QUOTES-TECH` e PRs | Nenhum `sf=import-apply` procurement encontrado no código-base | **Não prometer import de procurement**; usar workflow autorizado quando publicado, sem DB bypass | **PENDING / BLOCKED_BY_SOURCE** — produto não expõe import nativo procurement |
| Schedules | `SCH-MON-FX`, `SCH-MON-PROC`; Daniel | Porta `createRoutineSchedule`, host nativo `occurrences` | Duas rotinas owner-bound criadas/recuperadas sem duplicação; cada receipt prova C07 separadamente | **PENDING / BLOCKED_BY_HOST** — conditionRef/recipeRef reais nulos no fixture |

## Procedimento de prova e tripla checagem

**(1) Entrada/contrato:** manifest F04 emitido pelo instalador com SHA C exato, sessão real, papel real, conexão à origem e target retornado pela aplicação (não hardcoded).

**(2) Produtor/mutação:** registrar o estado anterior, executar ação real com `Idempotency-Key` quando aplicável, constatar resposta+versão+recibo e responder negativamente a owner inválido, FX ausente ou versão antiga.

**(3) Consumidor/replay:** reinstalar/reabrir quando a receita requerer, reler origem, verificar CAS e hash/proveniência, ausência de duplicidade, logs sem segredo e atribuição exata ao teste/AM/PR/SHA.

**A preencher pelo executor A9/A4, nunca pelo seed:** C=____; installationId=____; job/runId=____; manifestDigest=____; fixtureId=____; principal binding=____; result=____; receiptDigest=____; replay=____; reason if BLOCKED=____.

Os casos AM01–AM06 acima são **associações candidatas de datasets**, não interpretação definitiva dos seis suites: os testes normativos completos devem ser lidos por A9 em `modules/sucafina/Sucafinav1/test/product/integrated-proofs/am01/**` a `am06/**`, executados individualmente no C. Um fixture ou um script que imprime READY **não** equivale ao suite PASS.
