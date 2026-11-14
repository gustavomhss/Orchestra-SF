import { digestSfContribution, digestSfValue } from "../../../../modules/sucafina/Sucafinav1/product/contracts/canonical.ts"
import { decodeSfContributionEnvelope, decodeSfOperationInput } from "../../../../modules/sucafina/Sucafinav1/product/contracts/schema-admission.ts"
import type { SourceRef } from "../../../../modules/sucafina/Sucafinav1/product/contracts/context.ts"
import type { ContributionEnvelope } from "../../../../modules/sucafina/Sucafinav1/product/contracts/resident-ai.ts"
import type { PortResult } from "../../../../modules/sucafina/Sucafinav1/product/contracts/ports.ts"
import type { SfConfirmedClaimField, SfNativeRunRecord } from "../../../../modules/sucafina/Sucafinav1/product/contracts/state.ts"
import type { TrustedDomainContext } from "../../../../modules/sucafina/Sucafinav1/product/contracts/sf-execution.ts"
import type { DecisionRecallInput } from "../../../../modules/sucafina/Sucafinav1/product/contracts/skill-inputs.ts"
import type { createSfProductAuthority } from "../../../../modules/sucafina/Sucafinav1/product/integration/product-authority.ts"
import { encodeCaseRef } from "../../../../modules/sucafina/Sucafinav1/product/decisions/case-port.ts"
import type { createSfBusinessServices } from "./business-services.ts"
import type { createSfImportServices } from "./import-services.ts"
import type { SfAnalysisRequest } from "./analysis-verifier.ts"
import type { SfIntentSelectionContext } from "./input-producer-intent.ts"
import { withoutObservationTimes } from "./analysis-verifier.ts"

type CaseRef = SfAnalysisRequest["caseRef"]
type Author = { run: SfNativeRunRecord; output: ContributionEnvelope }
type Input = { business: ReturnType<typeof createSfBusinessServices>; authority: ReturnType<typeof createSfProductAuthority>; imports?: ReturnType<typeof createSfImportServices> }
const unavailable = { status: "unavailable", reason: "analysis-selection-unavailable" } as const
const same = (left: unknown, right: unknown) => digestSfValue(left) === digestSfValue(right)
const record = (value: unknown): Record<string, unknown> => value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {}

/** Public review selection never accepts a native session, ticket, grant, or private binding. */
export function readSfReviewAuthorSelection(value: unknown): { runRef: string; outputDigest: string } | undefined {
  const fields = record(value)
  return Object.keys(fields).length === 2 && Object.keys(fields).every((key) => key === "runRef" || key === "outputDigest") &&
    typeof fields.runRef === "string" && !!fields.runRef.trim() && typeof fields.outputDigest === "string" && /^[a-f0-9]{64}$/.test(fields.outputDigest)
    ? { runRef: fields.runRef, outputDigest: fields.outputDigest } : undefined
}

/** Read private C08 state only after the same currently authorized case has been resolved. */
export function createSfAnalysisSelectionReaders(input: Input) {
  const { business, authority } = input
  const host = authority.host
  const current = async (caseRef: CaseRef, call: TrustedDomainContext) => {
    if (!await host.revalidate(call)) return undefined
    const read = await business.cases.read({ caseRef: encodeCaseRef(caseRef) }, call)
    return read.status === "ok" && read.value.case.id === caseRef.id && read.value.case.incarnation === caseRef.incarnation &&
      read.value.case.version === caseRef.version && read.value.case.participants.includes(call.binding.principalRef) &&
      (call.kind !== "native" || call.binding.caseId === caseRef.id && call.binding.caseIncarnation === caseRef.incarnation && call.binding.caseVersion === caseRef.version)
      ? read.value : undefined
  }
  const sameAuthority = (value: { principalRef: string; accessRevision: string; policyVersion: string }, call: TrustedDomainContext) =>
    value.principalRef === call.binding.principalRef && value.accessRevision === call.binding.accessRevision && value.policyVersion === call.binding.policyVersion

  const readAuthorForCase = async (runRef: string, outputDigest: string, caseRef: CaseRef, call: TrustedDomainContext,
    history?: { responseRef: string }): Promise<PortResult<Author>> => {
    const request = host.requestFor(call)
    const selected = await current(caseRef, call)
    if (!request || !selected || !runRef.trim() || !/^[a-f0-9]{64}$/.test(outputDigest)) return unavailable
    const load = () => authority.state.read(request, "contributions", (state, actor) => {
      if (!sameAuthority(actor, call)) return undefined
      const run = state.nativeRuns?.[runRef]
      const output = run?.outputRef && state.contributions[run.outputRef]
      const value = run && state.cases[run.caseRef.id]
      return run?.state === "ready" && run.native && output && value && sameAuthority(run, call) && value.participants.includes(actor.principalRef) &&
        value.id === caseRef.id && value.incarnation === caseRef.incarnation && value.version === caseRef.version &&
        run.caseRef.id === caseRef.id && run.caseRef.incarnation === caseRef.incarnation &&
        (history ? run.caseRef.version < caseRef.version : run.caseRef.version === caseRef.version) ? { run, output } : undefined
    })
    const found = await load()
    if (found.status !== "ok" || !found.value || !found.value.run.native) return unavailable
    const { run } = found.value
    const native = run.native
    if (!native) return unavailable
    const decoded = decodeSfContributionEnvelope(found.value.output)
    if (!decoded.ok || decoded.value.state !== "ready" || decoded.value.id !== run.outputRef || decoded.value.outputDigest !== outputDigest ||
      digestSfContribution(decoded.value) !== outputDigest || !same(decoded.value.caseRef, run.caseRef) || decoded.value.accessRevision !== run.accessRevision ||
      decoded.value.runProvenance.runId !== run.runRef || decoded.value.runProvenance.nativeSessionId !== native.sessionID ||
      decoded.value.runProvenance.contextFingerprint !== run.contextFingerprint || decoded.value.runProvenance.actualModel !== `${run.model.providerID}/${run.model.id}` ||
      !same(Object.fromEntries(Object.keys(native.skillReceipt).map((key) => [key, decoded.value.runProvenance[key as keyof typeof native.skillReceipt]])), native.skillReceipt)) return unavailable
    const output = decoded.value
    const answer = history ? await business.collaboration.answerEvidence.resolve(history.responseRef, call) : undefined
    if (history) {
      const questions = selected.case.questions.filter((question) => question.state === "answered" && question.answerRef === history.responseRef)
      const comparison = output.kind === "ScenarioComparison" ? output.payload : output.kind === "FinancialAnalysis" ? output.payload.comparison : undefined
      if (!comparison || questions.length !== 1 || !answer || answer.status !== "ok" ||
        !await business.collaboration.answerEvidence.belongsToQuestion(questions[0]!.id, history.responseRef, call) ||
        !selected.case.sourceRefs.some((ref) => same(ref, answer.value)) || !selected.case.choices.some((choice) => same(choice.comparison, comparison))) return unavailable
    }
    const sources = await business.context.context({ refs: output.evidenceRefs }, call)
    if (sources.length !== output.evidenceRefs.length || sources.some((source, index) => !same(source.ref, output.evidenceRefs[index]) ||
      source.accessRevision !== call.binding.accessRevision || !source.authorizedProjection || !source.currentRef ||
      (history ? !["fresh", "historical", "stale"].includes(source.state) : source.state !== "fresh" || !same(source.currentRef, source.ref)))) return unavailable
    const again = await load()
    const sourceAgain = await business.context.context({ refs: output.evidenceRefs }, call)
    const latest = await current(caseRef, call)
    const answerAgain = history ? await business.collaboration.answerEvidence.resolve(history.responseRef, call) : undefined
    if (again.status !== "ok" || !same(again.value, found.value) || !latest || !same(latest.case, selected.case) ||
      !same(withoutObservationTimes(sources), withoutObservationTimes(sourceAgain)) || !same(answer, answerAgain) || request.signal.aborted || !await host.revalidate(call))
      return { status: "stale", reason: "author-analysis-changed" }
    return { status: "ok", value: { run, output } }
  }
  const readAuthorAnalysis = async (runRef: string, outputDigest: string, call: TrustedDomainContext): Promise<PortResult<Author>> => {
    const selected = await business.resolveCase(call)
    return selected.status === "ok" ? readAuthorForCase(runRef, outputDigest, selected.value, call) : unavailable
  }
  const readHistoricalAuthor = (runRef: string, outputDigest: string, selection: { caseRef: CaseRef; responseRef: string }, call: TrustedDomainContext) =>
    readAuthorForCase(runRef, outputDigest, selection.caseRef, call, { responseRef: selection.responseRef })

  const readSelectionContext = async (caseRef: CaseRef, selection: { readonly evidenceRefIds: readonly string[] }, call: TrustedDomainContext): Promise<PortResult<SfIntentSelectionContext>> => {
    const selected = await current(caseRef, call)
    if (!selected || new Set(selection.evidenceRefIds).size !== selection.evidenceRefIds.length) return unavailable
    const refs = selection.evidenceRefIds.flatMap((id) => selected.evidenceRefs.filter((ref) => ref.refId === id))
    if (refs.length !== selection.evidenceRefIds.length) return unavailable
    const records = refs.filter((ref) => ref.kind === "record")
    const surface = records[0]?.target.surface
    if (!surface || records.some((ref) => ref.target.surface !== surface || !same(ref.target.period, selected.case.horizon)))
      return { status: "needs-input", reason: "intent-single-surface-period-selection-required" }
    const resolved = await business.context.context({ refs: records }, call)
    if (resolved.length !== records.length) return unavailable
    const sourceRefs: SourceRef[] = []
    for (const [index, resolution] of resolved.entries()) {
      const ref = records[index]!
      const projection = resolution.authorizedProjection
      if (resolution.state !== "fresh" || !resolution.currentRef || !same(resolution.currentRef, ref) || !projection || !("values" in projection) ||
        projection.context.currency !== selected.case.currency || !same(projection.context.period, selected.case.horizon)) return unavailable
      const found = projection.context.sourceRefs.filter((source) => source.surface === ref.target.surface && source.type === ref.target.recordType &&
        source.id === ref.target.recordId && source.incarnation === ref.target.incarnation && source.version === ref.target.version &&
        same(source.period, ref.target.period) && source.fields.every((field) => ref.target.fields.includes(field)))
      if (found.length !== 1) return unavailable
      sourceRefs.push(found[0]!)
    }
    const again = await current(caseRef, call)
    if (!again || !same(again.case, selected.case) || !await host.revalidate(call)) return unavailable
    return { status: "ok", value: { surface, period: selected.case.horizon, currency: selected.case.currency, sourceRefs } }
  }

  /** A preview is located by the exact admitted-file request and then read through the C04 port. */
  const previewSelection = (importRequest: unknown) => async (caseRef: CaseRef, call: TrustedDomainContext): Promise<PortResult<{ previewRef: string }>> => {
    const parsed = decodeSfOperationInput("sf_import_preview", importRequest)
    const request = host.requestFor(call)
    const selected = await current(caseRef, call)
    if (!input.imports || !parsed.ok || !request || !selected) return unavailable
    const load = () => authority.state.read(request, "documents", (state, actor) => sameAuthority(actor, call) ?
      Object.entries(state.documents).flatMap(([key, raw]) => {
        const value = record(raw), manifest = record(value.manifest), target = record(value.target), options = record(target.options)
        return key.startsWith("import-preview:") && value.schema === "sf-import-preview-v1" && value.fileRef === parsed.value.admittedFileRef &&
          manifest.format === parsed.value.format && same(options.preview, parsed.value.options) && typeof manifest.id === "string" ? [manifest.id] : []
      }) : undefined)
    const hints = await load()
    if (hints.status !== "ok" || !hints.value || hints.value.length > 100) return unavailable
    const previews = await Promise.all(hints.value.map((previewRef) => input.imports!.imports.readPreviewForAnalysis({ previewRef, request: parsed.value }, call)))
    const valid = previews.flatMap((result, index) => result.status === "ok" && result.value.manifest.state === "preview" && !result.value.manifest.domainApplied &&
      result.value.manifest.issues.length === 0 && result.value.manifest.receipts.length === 0 &&
      result.value.manifest.context.currency === selected.case.currency && same(result.value.manifest.context.period, selected.case.horizon) &&
      result.value.manifest.baseIdentity.every((source) => selected.evidenceRefs.some((ref) => ref.kind === "record" && source.surface === ref.target.surface &&
        source.type === ref.target.recordType && source.id === ref.target.recordId && source.incarnation === ref.target.incarnation && source.version === ref.target.version)) ? [hints.value![index]!] : [])
    const again = await load()
    if (valid.length !== 1 || again.status !== "ok" || !same(hints.value, again.value) || !await host.revalidate(call))
      return { status: "needs-input", reason: "exact-import-preview-selection-required" }
    return { status: "ok", value: { previewRef: valid[0]! } }
  }

  const readCurrentClaimBindings = async (caseRef: CaseRef, call: TrustedDomainContext): Promise<PortResult<readonly SfConfirmedClaimField[]>> => {
    const request = host.requestFor(call)
    const selected = await current(caseRef, call)
    if (!request || !selected) return unavailable
    const load = () => authority.state.read(request, "cases", (state, actor) => sameAuthority(actor, call) ? Object.values(state.claimBindings ?? {}).filter((item) =>
      same(item.caseRef, caseRef) && item.accessRevision === actor.accessRevision && item.policyVersion === actor.policyVersion &&
      selected.case.assumptions.some((claim) => claim.id === item.claimRef && claim.evidenceRefs.some((ref) => same(ref, item.sourceRef))) &&
      selected.evidenceRefs.some((ref) => same(ref, item.sourceRef))) : undefined)
    const first = await load()
    const again = await load()
    const latest = await current(caseRef, call)
    if (first.status !== "ok" || !first.value || again.status !== "ok" || !same(first.value, again.value) || !latest || !same(latest.case, selected.case) ||
      first.storageVersion !== again.storageVersion || !await host.revalidate(call)) return unavailable
    return { status: "ok", value: first.value }
  }

  const recallSelection = (selection: DecisionRecallInput) => async (caseRef: CaseRef, call: TrustedDomainContext): Promise<PortResult<DecisionRecallInput>> => {
    const wanted = structuredClone(selection)
    const selected = await current(caseRef, call)
    if (!selected || !same(wanted.currentCase, caseRef) || wanted.recallScope.includeHistorical || !wanted.query.trim() ||
      !same(wanted.recallScope.period, selected.case.horizon) || new Set(wanted.recallScope.cases.map((ref) => digestSfValue(ref))).size !== wanted.recallScope.cases.length) return unavailable
    const candidates = await Promise.all(wanted.recallScope.cases.map((ref) => current(ref, call)))
    if (candidates.some((value) => !value || !same(value.case.horizon, wanted.recallScope.period))) return unavailable
    const checked = await Promise.all(wanted.recallScope.cases.map((ref) => current(ref, call)))
    if (checked.some((value, index) => !value || !same(value.case, candidates[index]?.case)) || !await host.revalidate(call)) return unavailable
    return { status: "ok", value: wanted }
  }
  return { current, readAuthorAnalysis, readAuthorForCase, readHistoricalAuthor, readSelectionContext, previewSelection, readCurrentClaimBindings, recallSelection }
}
