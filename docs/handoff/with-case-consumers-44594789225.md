# Inventário de withCase e limite da hipótese de otimização

Estado: inspected; nenhuma alteração em business-services.ts ou na autorização foi aplicada.

Fonte: assembly4aebcb10b7380c8388a2541893a4eb474beb246b.
Execução somente de leitura: [44594789225](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44594789225), job135810040802, cleanup135811551831, SUCCESS.
Snapshot do script: d727a38b57812a8b38c30d3f27d31423fee6d49f.
O script executou rg nos arquivos TS/TSX de apps/cli/src e modules/sucafina/Sucafinav1. Não executou produtores nem testes de negócio; SUCCESS significa que o inventário foi obtido.

## Conclusão da inspeção

O caminho BI chama withCase para read, describe e revalidate (bi-services.ts149–159). O custo observado justifica investigar repetição, mas substituir globalmente cases.read por uma checagem de C08 bruto não tem equivalência demonstrada: case-port.ts97–98 também exige sourcesCovered, acessibilidade de todas as evidências e verifyScenarioOperations antes de produzir a projeção. Os consumidores incluem leituras e mutações de BI, sourcing, memória, colaboração, análise, rotinas e Procurement. Não retirar essa fronteira para satisfazer um deadline.

withCalculationCase é uma fronteira privada distinta, usada somente a partir de cálculos autenticados. procurement-scenario-services recebe essa função sob o nome withCase em business-services.ts423; essa injeção não prova equivalência de todos os callers do withCase público.

A investigação seguinte usa perfil CPU de um caso BI09 original em Actions, preservando deadline cooperativo105s e timeout120s. Sem cache de autoridade, sem root de snapshot sobre produtores que escrevem, sem redução do corpus ou das asserções.

## Ocorrências produtivas verificadas

São52 ocorrências de declaração, wiring, comentário ou chamada; não52 invocações independentes. A lista exata evita inferir os consumidores a partir da busca da branch default, que não retornou resultados.

```text
apps/cli/src/sucafina-product/analysis-run-context.ts:15:  business: Pick<ReturnType<typeof createSfBusinessServices>, "withCase">
apps/cli/src/sucafina-product/analysis-run-context.ts:51:      const result = await input.business.withCase(call, selected, { allowHistoricalRetry: true }, () => action(call))
apps/cli/src/sucafina-product/sourcing-inputs.ts:11:  business: Pick<ReturnType<typeof createSfBusinessServices>, "sourcingEvidence" | "cases" | "context" | "withCase">
apps/cli/src/sucafina-product/sourcing-inputs.ts:19:    return input.business.withCase(call, request.caseRef, {}, async () => {
apps/cli/src/sucafina-product/procurement-scenario-services.ts:42:  withCase: CaseScope
apps/cli/src/sucafina-product/procurement-scenario-services.ts:59:  const read = (selected: CaseRef, call: TrustedDomainContext): Promise<PortResult<Controls>> => input.withCase<Controls>(call, selected, async () => {
apps/cli/src/sucafina-product/procurement-scenario-services.ts:81:    return input.withCase<SelectionPreview>(call, selection.caseRef, async () => {
apps/cli/src/sucafina-product/decision-controls.ts:59:    return await runtime.business.withCase<Controls>(call, caseRef, {}, async () => {
modules/sucafina/Sucafinav1/product/procurement/decision-http.ts:24:    withCase: <T>(context: TrustedUiContext, caseRef: CaseRef, options: { allowHistoricalRetry?: boolean }, action: () => Promise<PortResult<T>>) => Promise<PortResult<T>>
modules/sucafina/Sucafinav1/product/procurement/decision-http.ts:45:      return await runtime.withCase(admitted.value, parsed.caseRef, { allowHistoricalRetry: mode !== "decision-review" }, async (): Promise<PortResult<Response>> => {
apps/cli/src/sucafina-product/review-resident-readers.ts:28:      await business.withCase(call, wanted.caseRef, {}, read)
apps/cli/src/sucafina-product/extended-bi-navigation.ts:68:    return business.withCase(call, caseRef, {}, read)
apps/cli/src/sucafina-product/portfolio-http.ts:54:      const result = await input.business.withCase<unknown>(call, payload.caseRef, { allowHistoricalRetry }, async () => {
apps/cli/src/sucafina-product/routine-native-phase-bridge.ts:52:/** Passed only by the ORIGINAL authenticated host method after ingress decode/withCase. These are intent data,
apps/cli/src/sucafina-product/baseline-services.ts:105:      const result = await business.withCase(admitted.value, decoded.value.caseRef, {}, () => register(decoded.value, admitted.value))
apps/cli/src/sucafina-product/portfolio-reconciliation-http.ts:52:      const result = await input.business.withCase<Page>(call, caseRef, {}, async () => {
apps/cli/src/sucafina-product/native-routine-producer219.ts:23: * A09's withCase and C07's actual native owner checks remain independently mandatory.
apps/cli/src/sucafina-product/native-ui/routines.ts:26:  withCase<T>(context: TrustedDomainContext, caseRef: CaseRef,
apps/cli/src/sucafina-product/native-ui/routines.ts:104:    return products.withCase(binding, payload.caseRef, {}, async () =>
apps/cli/src/sucafina-product/native-ui/routines.ts:108:    return products.withCase(binding, payload.caseRef, {}, async () =>
apps/cli/src/sucafina-product/native-ui/routines.ts:112:    return products.withCase(binding, payload.caseRef, {}, async () =>
apps/cli/src/sucafina-product/native-ui/routines.ts:116:    return products.withCase(binding, payload.caseRef, {}, async () =>
apps/cli/src/sucafina-product/native-ui/routines.ts:122:    return products.withCase(binding, payload.caseRef, {}, async () =>
apps/cli/src/sucafina-product/native-ui/routines.ts:185:    // routines and withCase are both required. Native C07 stays producer-admitted.
apps/cli/src/sucafina-product/business-services.ts:280:  const withCase = async <T>(call: TrustedDomainContext, selected: CaseRef, options: { allowHistoricalRetry?: boolean }, action: () => Promise<PortResult<T>>): Promise<PortResult<T>> => {
apps/cli/src/sucafina-product/business-services.ts:423:  const procurementScenarios = createSfProcurementScenarioServices({ host, state: input.authority.state, sources: individual, port: procurement, withCase: withCalculationCase })
apps/cli/src/sucafina-product/business-services.ts:655:    return withCase(call, wanted.caseRef, {}, async () => {
apps/cli/src/sucafina-product/business-services.ts:726:  return { host, authorizeCase, dashboardSources, dashboardRecords, dashboard, dashboardServices, dashboardDecisions, procurement, procurementScenarios, procurementDecisions, procurementConfirmation, procurementDossier, procurementQueueView, collaboration, planner, plannerProduct: product, plannerSources, registry, individual, contracts, cases, context, evidence, caseRecall, results, calculations: { ...calculations, persist }, scenarioLookup, sourcingEvidence, operationIdentity, receipt, resolveCase, withCase, readSourceFences, lockedSourceFences, lockedDecisionStateDigest, descriptors, procurementSelections, forecastInputs, initializeAtlas,
apps/cli/src/sucafina-product/host-context.ts:321:  const memoryHttp = createSfMemoryHttp({ origin: input.origin, mount: input.mount, authority, memory, withCase: business.withCase, similarCases })
apps/cli/src/sucafina-product/host-context.ts:403:  const procurementDecisionHttp = createProcurementDecisionHttp({ origin: input.origin, mount: input.mount, runtime: () => identity() ? { human: authority.human, decisions: business.procurementDecisions, withCase: business.withCase } : undefined })
apps/cli/src/sucafina-product/host-context.ts:707:      const promise = Promise.resolve().then(() => business.withCase(context, captured.request.caseRef, {}, work)).catch(() => ({ status: "unavailable" as const, reason: "analysis-start-unavailable" }))
apps/cli/src/sucafina-product/host-context.ts:1011:                decisionDomain.management.edit, business.withCase, business.cases, input.persistence] }
apps/cli/src/sucafina-product/host-context.ts:1044:    withCase: business.withCase,
apps/cli/src/sucafina-product/extended-bi-options.ts:73:        const result = await business.withCase(call, entry.caseRef, {}, () => business.results.read({ kind: entry.result.kind, resultRef: entry.result.resultRef }, call))
apps/cli/src/sucafina-product/extended-bi-options.ts:86:          const current = await business.withCase(admitted.value, choice.caseRef!, {}, () => input.bi.source.read(selected, admitted.value))
apps/cli/src/sucafina-product/extended-http.ts:181:        const result = selectedCase ? await business.withCase(call, selectedCase, {}, read) : await read()
apps/cli/src/sucafina-product/analysis-choice-http.ts:68:        const value = await input.business.withCase(call, caseRef, {}, () => input.artifacts.save({ caseRef, selection: { viewId, version: 1, filters: [] }, dashboardSelection: dashboard.value, period: viewRequest.value.period }, mutation, call))
apps/cli/src/sucafina-product/analysis-choice-http.ts:86:        const value = await input.business.withCase(call, caseRef, {}, () => input.alternatives.select(selected, call))
apps/cli/src/sucafina-product/analysis-host-services.ts:271:    return business.withCase(call, captured.request.caseRef, {}, async () => {
apps/cli/src/sucafina-product/memory-http.ts:18:  withCase: ReturnType<typeof createSfBusinessServices>["withCase"]
apps/cli/src/sucafina-product/memory-http.ts:43:          const scoped = await input.withCase(admitted.value, selection.caseRef, {}, async () => ({ status: "ok" as const,
apps/cli/src/sucafina-product/memory-http.ts:75:          const scoped = await input.withCase(admitted.value, caseRef, {}, async () =>
apps/cli/src/sucafina-product/memory-http.ts:107:          : await input.withCase(admitted.value, selectedCase!, {}, read)
apps/cli/src/sucafina-product/decision-domain-http.ts:59:      const result = await runtime.business.withCase<unknown>(call, payload.caseRef,
apps/cli/src/sucafina-product/bi-services.ts:152:    return selected ? business.withCase(call, selected, {}, read) : { status: "denied", reason: "bi-case-selection-unavailable" }
apps/cli/src/sucafina-product/work-signals.ts:19:  business: Pick<ReturnType<typeof createSfBusinessServices>, "host" | "cases" | "context" | "collaboration" | "withCase">
apps/cli/src/sucafina-product/work-signals.ts:69:      const result = call.kind === "ui" ? await business.withCase(call, caseRef, {}, read) : await read()
apps/cli/src/sucafina-product/current-choice-services.ts:243:      return business.withCase(call, caseRef, {}, async () => {
apps/cli/src/sucafina-product/current-choice-services.ts:287:      return business.withCase(call, request.caseRef, {}, async () => {
apps/cli/src/sucafina-product/current-choice-services.ts:306:      return business.withCase(call, selected, {}, async () => {
modules/sucafina/Sucafinav1/product/decisions/http.ts:47:  withCase: <T>(context: TrustedUiContext, caseRef: CaseRef, options: { allowHistoricalRetry: boolean }, action: () => Promise<PortResult<T>>) => Promise<PortResult<T>>
modules/sucafina/Sucafinav1/product/decisions/http.ts:163:        const scoped = await input.withCase(context, payload.caseRef, { allowHistoricalRetry }, async () => ({ status: "ok", value: await dispatch() }))
```

## Fronteira atual — business-services.ts270–335

```typescript
270:   }
271:   const boundCaseVersion = async (request: Request, call: TrustedDomainContext, captured: CaseRef) => {
272:     const read = await input.authority.state.read(request, "cases", (state, actor) => {
273:       const value = state.cases[captured.id]
274:       return value && value.incarnation === captured.incarnation && Number.isSafeInteger(value.version) && value.participants.includes(actor.principalRef) &&
275:         actor.principalRef === call.binding.principalRef && actor.accessRevision === call.binding.accessRevision && actor.policyVersion === call.binding.policyVersion
276:         ? value.version : undefined
277:     })
278:     return read.status === "ok" ? read.value : undefined
279:   }
280:   const withCase = async <T>(call: TrustedDomainContext, selected: CaseRef, options: { allowHistoricalRetry?: boolean }, action: () => Promise<PortResult<T>>): Promise<PortResult<T>> => {
281:     const request = host.requestFor(call)
282:     const binding = callBindingDigest(call)
283:     const captured = structuredClone(selected)
284:     if (call.kind !== "ui" || !request || caseBindings.has(call)) return { status: "denied", reason: "case-selection-unavailable" }
285:     const observed = options.allowHistoricalRetry ? await boundCaseVersion(request, call, captured) : undefined
286:     if (observed !== undefined && observed < captured.version) return { status: "denied", reason: "case-selection-unavailable" }
287:     const historical = observed !== undefined && observed > captured.version
288:     if (!historical) {
289:       const current = await cases.read({ caseRef: encodeCaseRef(captured) }, call)
290:       if (current.status !== "ok" || (options.allowHistoricalRetry ? current.value.case.version < captured.version : current.value.case.version !== captured.version))
291:         return { status: "denied", reason: "case-selection-unavailable" }
292:     }
293:     if (!await host.revalidate(call) || !currentCaseAuthority(call, request, binding) || caseBindings.has(call)) return { status: "denied", reason: "case-selection-unavailable" }
294:     const scope: CaseScope = { selected: captured, request, bindingDigest: binding, retainers: 1, ...(historical ? { historical: true } : {}) }
295:     caseBindings.set(call, scope)
296:     try {
297:       const result = await action()
298:       return await host.revalidate(call) && currentCaseAuthority(call, request, binding) && caseBindings.get(call) === scope &&
299:         digestSfValue(selected) === digestSfValue(captured) ? result : { status: "denied", reason: "case-selection-authority-changed" }
300:     } finally { releaseCaseScope(call, scope) }
301:   }
302:   // This private entry receives a case from authenticated calculation stores
303:   // or the recall's current C08 selection. Avoid cases.read: that projection
304:   // can itself cite the calculation currently being resolved by the BCS.
305:   const withCalculationCase = async <T>(call: TrustedDomainContext, selected: CaseRef, work: () => Promise<PortResult<T>>,
306:     egress?: (result: PortResult<T>) => Promise<PortResult<T>>): Promise<PortResult<T>> => {
307:     const source = host.requestFor(call)
308:     const binding = callBindingDigest(call)
309:     const captured = structuredClone(selected)
310:     const selectedDigest = digestSfValue(captured)
311:     if (!source || !await host.revalidate(call) || !currentCaseAuthority(call, source, binding)) return { status: "denied", reason: "calculation-case-authority-unavailable" }
312:     let scope: CaseScope | undefined
313:     if (call.kind === "native") {
314:       const held = { id: call.binding.caseId, incarnation: call.binding.caseIncarnation, version: call.binding.caseVersion }
315:       if (digestSfValue(held) !== selectedDigest) return { status: "denied", reason: "calculation-case-scope-mismatch" }
316:     } else {
317:       scope = caseBindings.get(call)
318:       if (!scope) {
319:         const current = await input.authority.state.read(source, "cases", (stored, actor) => {
320:           const value = stored.cases[captured.id]
321:           return !!value && value.incarnation === captured.incarnation && value.version === captured.version && value.participants.includes(actor.principalRef) &&
322:             actor.principalRef === call.binding.principalRef && actor.accessRevision === call.binding.accessRevision && actor.policyVersion === call.binding.policyVersion
323:         })
324:         if (current.status !== "ok" || current.value !== true || !await host.revalidate(call) || !currentCaseAuthority(call, source, binding))
325:           return { status: "denied", reason: "calculation-case-authority-unavailable" }
326:         // Another replay may have installed a scope while C08/authority awaited.
327:         // Join that exact owner synchronously; never replace an in-flight scope.
328:         scope = caseBindings.get(call)
329:       }
330:       if (scope) {
331:         if (scope.request !== source || scope.bindingDigest !== binding || digestSfValue(scope.selected) !== selectedDigest)
332:           return { status: "denied", reason: "calculation-case-scope-mismatch" }
333:         scope.retainers++
334:       } else {
335:         scope = { selected: captured, request: source, bindingDigest: binding, retainers: 1 }
```

## Responsabilidade adicional — case-port.ts79–114

```typescript
79:     read: async (request, context) => {
80:       try {
81:         const parsed = decodeSfOperationInput("sf_case_read", request)
82:         if (!parsed.ok) return { status: "needs-input", reason: "invalid-case-reference" }
83:         const ref = parseCaseRef(parsed.value.caseRef)
84:         const source = input.host.requestFor(context)
85:         if (!ref) return { status: "needs-input", reason: "invalid-case-reference" }
86:         if (!source || !await input.host.revalidate(context)) return { status: "denied", reason: "invalid-authority" }
87:         if (context.kind === "native" && (context.binding.caseId !== ref.id || context.binding.caseIncarnation !== ref.incarnation)) return { status: "denied", reason: "case-access-unavailable" }
88:         const read = await input.state.read(source, "cases", selectSfCase(ref.id, context)).catch(() => ({ status: "unavailable" as const, reason: "product-state-unavailable" }))
89:         if (read.status === "preview") return { status: "unavailable", reason: "unexpected-state-preview" }
90:         if (read.status !== "ok") return failure(read)
91:         const value = read.value
92:         if (!value || value.incarnation !== ref.incarnation || (context.kind === "native" && context.binding.caseVersion !== value.version) || !value.participants.includes(context.binding.principalRef)) return { status: "denied", reason: "case-access-unavailable" }
93:         const caseDigest = digestSfValue(value)
94:         if (!await input.authorizeCase(value, context)) return { status: "denied", reason: "case-access-unavailable" }
95:         const refs = evidenceReferences(value)
96:         const refsDigest = digestSfValue(refs)
97:         if (!sourcesCovered(value, refs) || !await accessible(input.evidence, refs, context) || !await input.verifyScenarioOperations(value, context)) return { status: "unavailable", reason: "case-evidence-unavailable" }
98:         if (!await input.authorizeCase(value, context) || !await accessible(input.evidence, refs, context) || !await input.verifyScenarioOperations(value, context) || !await input.host.revalidate(context)) return { status: "denied", reason: "case-access-unavailable" }
99:         const checkedAt = input.now()
100:         // All external checks may await while C08 changes. Keep the second
101:         // observation after them and release only the same complete case.
102:         const again = await input.state.read(source, "cases", selectSfCase(ref.id, context)).catch(() => ({ status: "unavailable" as const, reason: "product-state-unavailable" }))
103:         if (again.status === "preview") return { status: "unavailable", reason: "unexpected-state-preview" }
104:         if (again.status !== "ok") return failure(again)
105:         // Namespace authorization may await after the state callback. Check
106:         // the live lease synchronously with the complete final snapshot.
107:         if (!again.value || digestSfValue(again.value) !== caseDigest || digestSfValue(value) !== caseDigest || digestSfValue(refs) !== refsDigest || source.signal.aborted || input.host.requestFor(context) !== source) return { status: "stale", reason: "case-changed" }
108:         const final = again.value
109:         const projection: AuthorizedCaseProjection = {
110:           context: { installationId: context.binding.installationId, projectId: context.binding.projectId, principalRef: context.binding.principalRef, policyVersion: context.binding.policyVersion, accessRevision: context.binding.accessRevision, ...(context.kind === "native" ? { kind: "native" as const, profileId: context.binding.profileId } : { kind: "ui" as const }) },
111:           case: { ...final, preparedChanges: final.preparedChanges.map(changeView), receipts: final.receipts.map((receipt) => receiptView(receipt, final.preparedChanges)) },
112:           events: final.ledger, evidenceRefs: refs, checkedAt,
113:         }
114:         return { status: "ok", value: projection }
```
