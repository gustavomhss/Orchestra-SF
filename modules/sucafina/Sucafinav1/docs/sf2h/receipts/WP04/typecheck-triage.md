# WP04 — triagem do typecheck W1

**Resultado observado: 150 diagnósticos em 49 paths; 13 próprios em quatro paths, 137 fora de WP04 em 45 paths.**

W1: `a04f9c2d09ae08319d0a5c284d954108a049f9bd`. Seed: `d183840f71eaa07244d984f314facfb76ef25799`.

O compare remoto confirma 26 paths alterados, nenhum dos 45 paths estrangeiros com erro. Os conteúdos exatos dos paths e dos contratos foram examinados; 18 fontes adicionais foram obtidas no SHA seed pelo GitHub MCP. A análise usa publication-w1.json, não os arquivos atuais que já recebem correções.

Não foi executado typecheck do seed. A atribuição abaixo é estática: causas e statements já estavam no seed, sem alteração relevante da superfície pública WP04. Não é um recibo histórico de CI do seed. Todos os erros continuam reais; um typecheck de package vermelho não vira verde porque os erros restantes pertencem a outros produtores.

## Erros próprios

| Path | Diagnósticos | Causa |
|---|---:|---|
| product/procurement/confirmation.ts | 9 | Owned seed already calls transactionAll without explicit proof union; unavailable/replaced/same branches conflict during generic inference. W1 only switches projector imports/calls and strengthens fenceManifest; the incompatible state branches are present in the seed. Owner must correct and rerun. |
| product/procurement/prepared.ts | 1 | Owned seed execute returns success/failure object union whose success gains optional reason:undefined, rejected by unchanged JsonValue contract. W1 changes projector and public-output clones but not these return shapes. Owner must correct and rerun. |
| test/product/wp04/confirmation-cross-actor.test.ts | 1 | Owned seed authenticate callback returns undefined while DomainPortHost requires ResolvedActor|null. W1 only swaps projector import/injection. Owner must correct and rerun. |
| test/product/wp04/prepared-production.test.ts | 2 | Owned seed host.environment is declared with zero arguments but called with one at two sites. W1 only swaps projector import/injection. Owner must correct and rerun. |

## Inventário estrangeiro

| Path | Diagnósticos | Alterado W1? | Causa presente no seed |
|---|---:|---|---|
| apps/cli/src/sucafina-product/business-services.ts | 3 | Não | Seed procurementHost has no contextual type for snapshot/evidence. Atlas receives a callable resolver, while the seed WP14 consumer input is wrongly typed as the resolver object. WP04 already returned that object in the seed; W1 did not change the public shape. |
| apps/cli/src/sucafina-product/host-context.ts | 7 | Não | Seed omits imports/selectedPreviewRef in analysis composition, returns SfStateResult with ok/preview where PortResult is expected, and passes a UI-only function to a domain-context callback. Relevant contracts and the file are unchanged in W1. |
| apps/cli/src/sucafina-product/import-services.ts | 2 | Não | Seed references Period and isSfPeriod without importing them; W1 does not touch the file or those exports. |
| product/collaboration/confirmation.ts | 2 | Não | Seed returns SfStateResult branches directly as PortResult; its grouped ok/preview success discriminant prevents the intended narrowing. State/port contracts are unchanged in W1. |
| product/collaboration/hot-topic-host.ts | 1 | Não | Seed generic transaction mixes caller-owned T with concrete denied/unavailable result shapes. HotTopicHost and state types are unchanged; no Procurement producer import. |
| product/collaboration/recipient-actions.ts | 1 | Não | Seed returns SfStateResult<boolean> as PortResult<RecipientThread>; grouped ok/preview branch is not narrowed away. Relevant contracts unchanged. |
| product/collaboration/relations.ts | 3 | Não | Seed returns SfStateResult payloads as different PortResult payloads; grouped ok/preview branch remains. Relevant contracts unchanged. |
| product/collaboration/threads.ts | 4 | Não | Seed returns SfStateResult payloads as PortResult<CollaborationThread>; grouped ok/preview branch remains. Relevant contracts unchanged. |
| product/contracts/host-context.ts | 1 | Não | Seed imports ../routines/factory.ts, absent from the complete seed Sucafina tree. W1 adds no routines implementation and does not remove files. |
| product/dashboard/confirmation.ts | 9 | Não | Seed has implicit any after Array.isArray and transactionAll inference anchored to replaced/unavailable, rejecting same. Downstream proof properties become unknown/{}. No Procurement import; persistence contract unchanged. |
| product/decision-memory/source-access.ts | 2 | Não | Seed createSfProcurementSourceAccess input.resolve is ReturnType<typeof createProcurementSourceResolver> (object) but invokes input.resolve as a function twice. Seed resolver already exports an object; W1 preserves the shape. Additional integration seam INT-06. |
| product/decisions/prepared-apply.ts | 8 | Não | Seed generic state transaction infers a narrow first failure branch; receipt/existing/result branches are incompatible, producing downstream {} failures. No changed Procurement type participates. |
| product/decisions/proposals.ts | 1 | Não | Seed find predicate already narrows to failures; repeating status !== ok produces TS2367 under the unchanged compiler/type configuration. |
| product/documents/capabilities.ts | 1 | Não | Seed accesses reason on a SfStateResult branch still containing ok/preview success. Relevant state contract unchanged. |
| product/host-binding/business-context.ts | 4 | Não | Seed passes obsolete state/authorizeCase/authorizeEvidence arguments to createSfCaseEventSourceAccess and returns a broader Atlas MemoryEntry union than the capability contract. The error sites do not depend on changed WP04 outputs. |
| product/imports/dashboard-preview.ts | 17 | Não | Seed transaction generic infers only the early invalid/conflict preview shape; success impactDigest/before/after branches fail and generate 16 cascading property/type diagnostics. Runtime persistence and import contracts unchanged. |
| product/interface/analysis-http.ts | 4 | Não | Seed reads runRef/version/outputRef from the broad ContributionEnvelope union without valid narrowing. Resident contract and handler unchanged. |
| product/interface/http.ts | 2 | Não | Seed run/index callback loses contextual type through missing routine host contract. This file, contract host-context and missing factory import are unchanged. |
| product/interface/import-http.ts | 1 | Não | Seed object widens surface to string before passing to dashboard/planner input. Handler and input contract unchanged. |
| product/planner/headcount.ts | 2 | Não | Seed spread from object records infers positions as {state}; domain property access fails. No Procurement dependency and unchanged helper/type surface. |
| product/planner/monthly-host.ts | 1 | Não | Seed Array.isArray narrowing loses the callback cell parameter type. No Procurement dependency; unchanged source. |
| product/planner/persistence.ts | 2 | Não | Seed find predicates narrow failure status; repeated status !== ok comparisons are statically impossible. Relevant contracts unchanged. |
| product/planner/prepared.ts | 1 | Não | Seed execute success branch acquires optional reason:undefined in inferred union, incompatible with JsonValue. Same pattern as owned prepared.ts; contract unchanged. |
| product/planner/scenario-comparison-port.ts | 1 | Não | Seed failure find predicate followed by impossible repeated status comparison. Relevant contracts unchanged. |
| product/portfolio/catalog.ts | 1 | Não | Seed failure find predicate followed by impossible repeated status comparison. Relevant contracts unchanged. |
| product/portfolio/handoff.ts | 2 | Não | Seed failure find predicates followed by impossible repeated status comparisons. Relevant contracts unchanged. |
| product/portfolio/planner-sensitivity.ts | 2 | Não | Seed result union includes PortfolioResult/SensitivityResult without costCoverage; accesses without narrowing. Result contracts unchanged. |
| product/portfolio/port.ts | 1 | Não | Seed failure find predicate followed by impossible repeated status comparison. Relevant contracts unchanged. |
| product/portfolio/sensitivity-store.ts | 1 | Não | Seed failure find predicate followed by impossible repeated status comparison. Relevant contracts unchanged. |
| product/portfolio/verification.ts | 2 | Não | Seed result union includes PortfolioResult/SensitivityResult without costCoverage; accesses without narrowing. Result contracts unchanged. |
| test/product/wp01/personal-views.test.ts | 1 | Não | Seed passes UI-only commandIdentity to domain-context callback. Test and relevant contracts unchanged. |
| test/product/wp01/workbench-analysis.test.ts | 1 | Não | Seed imports @orchestra/server/routes unresolved in W1. W1 does not change this test, package exports, dependency manifests or lockfile. |
| test/product/wp03/parity-matrix.test.ts | 1 | Não | Seed accesses recordId on broad BusinessEvidenceRef.target union without narrowing. Test and evidence contract unchanged. |
| test/product/wp06/documents/runtime-e2e.test.ts | 9 | Não | Seed imports product/routines/dossier.ts absent from complete seed tree; dependent callback parameters lose context. Test and referenced imports unchanged. |
| test/product/wp06/imports/end-to-end.test.ts | 2 | Não | Seed generic transaction infers failure payload, rejects success payload and leaks Promise<unknown> to resolvePlannerVersion. Test and persistence/import contracts unchanged. |
| test/product/wp06/imports/sqlite-planner.test.ts | 4 | Não | Seed generic transaction infers failure shape and rejects applied result; downstream applied/stale become unknown. Test and persistence/import contracts unchanged. |
| test/product/wp07/review-port.test.ts | 3 | Não | Seed test inferred Map value overload is narrower than its heterogenous entries. Test and producer contract unchanged; no Procurement import. |
| test/product/wp08/confirmation-integration.test.ts | 1 | Não | Seed generic confirmation observation lacks evidence/projection required by Dashboard observer fence. This is Dashboard/C06 seam and does not import WP04. |
| test/product/wp10/integration/blob-generations.test.ts | 10 | Não | Seed generic/contextual callback parameters snapshot/blobs are implicit any across the fixture. Test and persistence implementation signatures unchanged in W1. |
| test/product/wp10/integration/product-authority.test.ts | 2 | Não | Seed fixture transaction callback parameters snapshot/blobs are implicit any. Test and authority/persistence signatures unchanged in W1. |
| test/product/wp11/analysis-acceptance-adversarial.test.ts | 1 | Não | Seed passes TrustedDomainContext to a UI-only function. Test and context contracts unchanged. |
| test/product/wp11/coverage-access.test.ts | 3 | Não | Seed fixture source.surface and comparison.comparisonStatus widen to string, incompatible with unchanged source/result unions. |
| test/product/wp12/author-reader.test.ts | 1 | Não | Seed directly casts a sparse case object to DecisionCase. Test and case contract unchanged. |
| test/product/wp13/sensitivity-units-boundary.test.ts | 3 | Não | Seed invokes optional store.transactionAll without narrowing at two sites. Test and persistence interface unchanged. |
| test/product/wp14/source-access-procurement.test.ts | 6 | Não | Seed fixture expects removed callable resolver API and exports procurementSourceSelector/isCurrentProcurementSource absent even from seed. It also omits scopedSources/projectScope. Real migration must use issue(), resolver.resolve and resolver.isCurrent; do not recreate selector authority. |

## INT-06 — seam adicional real de Procurement para memória

`createSfProcurementSourceAccess` declara resolve como o objeto completo retornado por `createProcurementSourceResolver`, mas chama-o como função em duas linhas. O host já passa a função `resolveProcurement`. O seed de WP04 já retornava um objeto, portanto essa incompatibilidade não foi introduzida por W1.

Delta S0/WP14 proposto: `resolve: ReturnType<typeof createProcurementSourceResolver>["resolve"]`. O tipo derivado em `product/host-binding/business-context.ts` acompanha automaticamente. No host, anotar `procurementHost: ProcurementSourceHost` dá contexto aos parâmetros snapshot/evidence e remove os dois implicit-any sem mudar a autorização.

A fixture WP14 permanece desatualizada: importa procurementSourceSelector/isCurrentProcurementSource inexistentes no seed, omite projectScope/scopedSources e trata o resolver como callable. Migrar para o lifecycle real, issue(), resolver.resolve e resolver.isCurrent. Não reintroduzir seletores físicos como autoridade.

## Outros bloqueios dominantes

- `SfStateResult` agrupa status `ok` e `preview` no mesmo membro; diversos consumers tentam retornar esse membro como `PortResult`. Os dois contratos e os consumers estão inalterados.
- Inferência de transações genéricas parte de um ramo estreito e rejeita os demais; erros posteriores de `{}`/unknown são cascatas, não dezenas de mudanças independentes.
- `product/routines/factory.ts` e `product/routines/dossier.ts` estão ausentes do tree seed completo (`truncated:false`) enquanto contracts/tests os importam. W1 não removeu nenhum arquivo.
- Testes antigos contêm acessos a unions sem narrowing, callbacks sem contexto e literais widened. Nenhum desses paths foi alterado por WP04.

## Próximo gate

Corrigir os 13 diagnósticos próprios e repetir o gate hospedado sobre o SHA final. Reportar separadamente sucesso cirúrgico dos testes, guards e estado real do typecheck de package. Sem editar paths alheios, não há base para prometer typecheck global verde nesta entrega.

Este revisor não executou testes locais, não disparou CI e não modificou produto. Inventário completo e mensagens em `review/typecheck-triage.json`.
