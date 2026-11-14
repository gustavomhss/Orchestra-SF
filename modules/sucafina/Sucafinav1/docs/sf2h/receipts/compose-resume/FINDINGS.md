# Findings por owner

Os 14 diagnósticos abaixo foram reproduzidos no mesmo candidato executado W `e1a1888bd2117616d53c5af5f5014e81c4b4e530`. São iguais, inclusive as mensagens, aos 14 da origem `9048e0e…`. [CHECK01](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43618711524) falhou; o verde da CLI e dos guards não altera essa conclusão.

As propostas em `proposals/` não foram aplicadas nem testadas. Elas preservam preimage, hash, contrato, owner e limitações. Nenhuma correção funcional foi aplicada silenciosamente em fonte de outro owner.

## F01 — analysisHistory importado, mas não exportado

**Owner:** WP01 / interface-resume; WP04 / astra-operations. **Estado:** `OPEN_REPRODUCED_ON_W`. **Contratos:** C09, C11, C15.

Owner avaliar o helper extraído do markup existente em proposals/F01-analysis-history-export.patch.txt; publicar a correção em sua fonte e provar Forecast/Sourcing/history sem afrouxar acesso.

```text
product/procurement/sourcing-analysis.ts(4,10): error TS2305: Module '"../ui/forecast-analysis.ts"' has no exported member 'analysisHistory'.
```

[Proposta para revisão](proposals/F01-analysis-history-export.patch.txt).

## F02 — Resolver passado como função quando o contrato exige objeto

**Owner:** WP04 / astra-operations. **Estado:** `OPEN_REPRODUCED_ON_W`. **Contratos:** C17.

Aplicar/revisar proposta que passa sources, preservando o método e seu receiver; retestar o cenário financeiro de Sourcing. Não substituir a autoridade.

```text
test/product/wp04/finance-sourcing-integration.test.ts(388,65): error TS2322: Type '(ref: string, binding: TrustedDomainContext) => Promise<PortResult<{ evidence: EvidenceIdentity & { kind: "record"; target: { surface: Surface; ... 6 more ...; projectionDigest: string; }; }; context: ProductContext; }>>' is not assignable to type 'Pick<{ issue: (kind: "procurement-request" | "procurement-supplier", id: string, binding: TrustedDomainContext) => Promise<PortResult<string>>; ... 4 more ...; isCurrent(snapshot: Snapshot, evidence: EvidenceIdentity & { ...; }): boolean; }, "resolve">'.
```

[Proposta para revisão](proposals/F02-sourcing-resolver-shape.patch.txt).

## F03 — promptContext não discriminado em três asserts de importPreview

**Owner:** WP06 / astra-operations; WP12 / astra-wp12. **Estado:** `OPEN_REPRODUCED_ON_W`. **Contratos:** C04, C11, C15.

Revisar proposta com checks positivos da variante importPreview e manter igualdade de manifesto/detail. O teste nativo ainda depende da rota F04.

```text
test/product/wp06/native/import-analysis.test.ts(130,47): error TS2339: Property 'importPreview' does not exist on type '{ importPreview: { importPreviewRef: string; manifest: ImportManifest; detail: ImportDetail; }; } | { decisionRecall: SfMemoryPrompt; }'.
test/product/wp06/native/import-analysis.test.ts(166,47): error TS2339: Property 'importPreview' does not exist on type '{ importPreview: { importPreviewRef: string; manifest: ImportManifest; detail: ImportDetail; }; } | { decisionRecall: SfMemoryPrompt; }'.
test/product/wp06/native/import-analysis.test.ts(205,45): error TS2339: Property 'importPreview' does not exist on type '{ importPreview: { importPreviewRef: string; manifest: ImportManifest; detail: ImportDetail; }; } | { decisionRecall: SfMemoryPrompt; }'.
```

[Proposta para revisão](proposals/F03-import-context-narrowing.patch.txt).

## F04 — Renderer da contribuição não implementa o contrato de link import-preview

**Owner:** WP01 / interface-resume; WP06 / astra-operations; WP10 / astra-wp10. **Estado:** `OPEN_REPRODUCED_ON_W`. **Contratos:** C04, C11, C15.

Alinhar product/ui/components.ts:contribution e seu consumidor. Retirar só o segundo argumento não cria o link data-import-preview-link nem a rota autorizada. Publicar uma closure real que preserve origem, seleção, revogação e retomada; proposta funcional pertence ao owner, não foi inventada pelo integrador.

```text
test/product/wp06/native/import-analysis.test.ts(324,37): error TS2554: Expected 1 arguments, but got 2.
```

## F05 — Sete fixtures omitem verifyScenarioOperations obrigatório

**Owner:** WP04 / astra-operations; WP08–WP09 / collab-resume; WP14 / astra-wp14; WP11 / finance-resume (contrato do port). **Estado:** `OPEN_REPRODUCED_ON_W`. **Contratos:** C09, C10, C12.

Ligar o verificador real/compatível da fixture. Manter casos positivos e negativos, replay e prova do produtor. Não usar always-true, casts, exclusão dos testes ou defaults permissivos para obter verde.

```text
test/product/wp04/finance-sourcing-integration.test.ts(394,40): error TS2741: Property 'verifyScenarioOperations' is missing in type '{ state: SfProductStatePort; host: DomainPortHost; creationTarget: { ref: string; incarnation: string; }; operationIdentity: (call: TrustedDomainContext) => string | undefined; authorizeCase: (value: DecisionCase, call: TrustedDomainContext) => Promise<...>; evidence: BusinessContextService; createId: (options?: Ran...' but required in type '{ state: SfProductStatePort; host: Pick<DomainPortHost, "requestFor" | "revalidate">; creationTarget: { ref: string; incarnation: string; }; ... 5 more ...; now: () => string; }'.
test/product/wp08/collaboration-journey.test.ts(79,42): error TS2741: Property 'verifyScenarioOperations' is missing in type '{ host: DomainPortHost; state: SfProductStatePort; creationTarget: { ref: string; incarnation: string; }; operationIdentity: (context: TrustedDomainContext) => string | undefined; authorizeCase: (value: DecisionCase, context: TrustedDomainContext) => Promise<...>; evidence: BusinessContextService; createId: (options...' but required in type '{ state: SfProductStatePort; host: Pick<DomainPortHost, "requestFor" | "revalidate">; creationTarget: { ref: string; incarnation: string; }; ... 5 more ...; now: () => string; }'.
test/product/wp08/confirmation-work-integration.test.ts(82,42): error TS2741: Property 'verifyScenarioOperations' is missing in type '{ state: SfProductStatePort; host: DomainPortHost; creationTarget: { ref: string; incarnation: string; }; operationIdentity: (context: TrustedDomainContext) => string | undefined; authorizeCase: (value: DecisionCase, context: TrustedDomainContext) => Promise<...>; evidence: BusinessContextService; createId: (options...' but required in type '{ state: SfProductStatePort; host: Pick<DomainPortHost, "requestFor" | "revalidate">; creationTarget: { ref: string; incarnation: string; }; ... 5 more ...; now: () => string; }'.
test/product/wp08/host-answer-reuse.test.ts(78,42): error TS2741: Property 'verifyScenarioOperations' is missing in type '{ state: SfProductStatePort; host: DomainPortHost; creationTarget: { ref: string; incarnation: string; }; operationIdentity: (context: TrustedDomainContext) => string | undefined; authorizeCase: (value: DecisionCase, context: TrustedDomainContext) => Promise<...>; evidence: BusinessContextService; createId: (options...' but required in type '{ state: SfProductStatePort; host: Pick<DomainPortHost, "requestFor" | "revalidate">; creationTarget: { ref: string; incarnation: string; }; ... 5 more ...; now: () => string; }'.
test/product/wp08/question-consumer.test.ts(44,42): error TS2741: Property 'verifyScenarioOperations' is missing in type '{ host: DomainPortHost; state: SfProductStatePort; creationTarget: { ref: string; incarnation: string; }; operationIdentity: (context: TrustedDomainContext) => string | undefined; authorizeCase: (value: DecisionCase, context: TrustedDomainContext) => Promise<...>; evidence: BusinessContextService; createId: (options...' but required in type '{ state: SfProductStatePort; host: Pick<DomainPortHost, "requestFor" | "revalidate">; creationTarget: { ref: string; incarnation: string; }; ... 5 more ...; now: () => string; }'.
test/product/wp09/decision-answer-consumer.test.ts(76,42): error TS2741: Property 'verifyScenarioOperations' is missing in type '{ state: SfProductStatePort; host: DomainPortHost; evidence: BusinessContextService; creationTarget: { ref: string; incarnation: string; }; operationIdentity: (binding: TrustedDomainContext) => string | undefined; authorizeCase: (value: DecisionCase, binding: TrustedDomainContext) => Promise<...>; createId: (options...' but required in type '{ state: SfProductStatePort; host: Pick<DomainPortHost, "requestFor" | "revalidate">; creationTarget: { ref: string; incarnation: string; }; ... 5 more ...; now: () => string; }'.
test/product/wp14/atlas-restart-reader.ts(54,40): error TS2741: Property 'verifyScenarioOperations' is missing in type '{ state: SfProductStatePort; host: DomainPortHost; creationTarget: { ref: string; incarnation: string; }; operationIdentity: () => string; authorizeCase: (value: DecisionCase, context: TrustedDomainContext) => Promise<...>; evidence: BusinessContextService; createId: (options?: RandomUUIDOptions | undefined) => `${s...' but required in type '{ state: SfProductStatePort; host: Pick<DomainPortHost, "requestFor" | "revalidate">; creationTarget: { ref: string; incarnation: string; }; ... 5 more ...; now: () => string; }'.
```

## F06 — PlannerSourceHost sem projectForecastSource no teste de unidades

**Owner:** WP13 / finance-resume; WP03 / finance-resume; WP10 / astra-wp10. **Estado:** `OPEN_REPRODUCED_ON_W`. **Contratos:** C02, C10, C14.

Reconciliar a fixture com o projetor canônico de Planner, preservando unidades, fonte e ausência versus zero. Não criar um host fictício só para satisfazer o tipo.

```text
test/product/wp13/sensitivity-units-boundary.test.ts(158,127): error TS2322: Type 'PlannerSourceHost' is not assignable to type 'PlannerSourceHost & { projectForecastSource: SfPlannerSourceProjector; }'.
```

## F07 — C05: destinatário, contexto atual, confirmação e reuso precisam do mount do host

**Owner:** WP07–WP09 / collab-resume; WP01–WP02 / interface-resume; WP10 / astra-wp10. **Estado:** `HELD_CLOSURE_INCOMPLETE`. **Contratos:** C05, C06, C09, C16.

Reconciliar as mudanças de authority/host em 70af5b7 e 0d98209 com os consumidores de interface. Consumir deltas por arquivo; não inserir snapshots estrangeiros. Manter resposta antiga vinculada à revisão preservada e ACL atual.

## F08 — C12: edição concorrente após recibo e versões divergentes de Apply/proof

**Owner:** WP11 / finance-resume; WP10 / astra-wp10; WP04 / astra-operations. **Estado:** `SOURCE_FAILURE_AND_OVERLAP_NOT_REPRODUCED_ON_C`. **Contratos:** C12.

H25 recebeu HTTP200 onde exigia409 em host-integration.test.ts:262. A falha pertence à fonte, não foi reexecutada em C. Comparar current apply229e64c2, Operations4bdd12ac, Finance964a5331/f8404c18 e prepared-apply90c3e981 versus proposta a45436a6. A substituição integral por4bdd removeria application-attempt durável e está rejeitada. Proposta mínima adiciona apenas fence da identidade completa do caso após o recibo, conservando as reservas existentes; owner precisa reconciliar com latest Finance e provar conflito, replay positivo, lost-response e restart.

[Proposta para revisão](proposals/F08-operations-published-C12-comparison.patch.txt).

## F09 — WP14 individual e agrupado têm oito variantes runtime distintas

**Owner:** WP14 / astra-wp14; WP12–WP14 / astra-intelligence; WP06 / astra-operations; WP10 / astra-wp10. **Estado:** `HELD_SEMANTIC_OVERLAP`. **Contratos:** C13, C17.

Reconciliar autorização atual com captura privada readOriginal, replay idempotente de outcome assentado sem novo append, bloqueio após substituição dos bytes e recall atual. Preservar tanto o cenário Atlas original de source-access quanto Documents→BCS→Atlas; uma substituição de cenário não é preservação de prova. Ver R04-critical-overlaps.json.

## F10 — Threshold proof agrupado e read-snapshot financeiro não são intercambiáveis

**Owner:** WP13 / finance-resume; WP12–WP14 / astra-intelligence; WP10 / astra-wp10. **Estado:** `HELD_EXCLUSIVE_DELTAS`. **Contratos:** C10, C14.

Preservar threshold-proof89ba6085 de #36, ausente no pin financeiro que ainda contém056a8573, e o read-snapshot financeiro095a... ausente em #36. Reconciliar sensitivity-store e verification. O host #29 também contém cópias do delta agrupado; isso não transfere a autoria canônica WP13.

## F11 — Catálogo e fixtures não provam Session/skill/MCP/Relay/scanner

**Owner:** WP12 / astra-wp12; WP10 / astra-wp10; S0. **Estado:** `REQUIRED_NATIVE_PROOF_MISSING`. **Contratos:** C08, C11, C15, C16, C17.

O run fonte W26 terminou2pass/1fail: Question Work excedeu360000ms, com catálogo vazio, inferenceExecuted=false e gnativeAccepted=false. O owner publicou drivers/correções posteriores e run43619631569 estava descrito ativo no cutoff; não atribuir seu resultado sem ler logs e W/S. R03 prova o ciclo de vida determinístico, não GNATIVE nem AM01–AM06.

## F12 — Testes adicionais Operations exigem reader Planner ausente

**Owner:** WP06 / astra-operations; WP03 / finance-resume; WP10 / astra-wp10. **Estado:** `HELD_MISSING_CANONICAL_DEPENDENCY`. **Contratos:** C04, C08, C17.

source-fences.test.ts da #34 importa product/planner/evidence-reader.ts (blob9c11e2ad...), ausente em C e no pin42; há cópias em #34/#29. Obter publicação canônica WP03 com binding host. Conservar também deltas de procurementEvidenceWrites em scenario-consumer/native fixture e o guia de Documents.

## F13 — Guards:47 avisos, zero gates/erros; um aviso novo na seleção ACK

**Owner:** WP02 / interface-resume; WP10 / astra-wp10; S0. **Estado:** `WARN_REVIEW_OPEN`. **Contratos:** C08.

Novo aviso test-timeout-raised em workbench-ack.test.ts:19 corresponde a page.setDefaultTimeout(10000), dentro de fixture com host real e browser Node. CI04 fez30testes/513asserts em113.71s com seis encerramentos físicos. Não suprimi o aviso nem alterei timeouts do owner. Revisar SLA/causa com o owner. Os46 avisos herdados incluem dependências e timeouts; lista integral em R05, sem dispensa de revisão.

## F14 — Head de entrega não é evidência D e não herda guard global

**Owner:** S0. **Estado:** `G7_G8_NOT_MET`. **Contratos:** C08.

Guide é material normativo; namespace compose-resume não está no envelope antigo WP00/WP10 de D. Build inputs de receipts não foram provados irrelevantes. Congelar C final, obter três revisões independentes, oito seleções mínimas+adicionais e AM01–AM06; executar guard C/G7. Só então verificar envelope/input closure e guard D/G8 separados. Não relaxar o predicado.

## F15 — CI10 de BI na origem não qualifica automaticamente o driver novo

**Owner:** WP10 / astra-wp10; S0. **Estado:** `HISTORICAL_GREEN_NOT_TRANSFERRED`. **Contratos:** C02, C08, C15.

Run43605201442 é5pass/114asserts emW9048e0e; driver/browser fixture mudou emR02. CI04 valida os consumidores de UI selecionados, mas não reexecuta todo BI. Revalidar BI afetado no bundle final, preservando a prova física e revogação; não duplicar seleção equivalente sem delta.
