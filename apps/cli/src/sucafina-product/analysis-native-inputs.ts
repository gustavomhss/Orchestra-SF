import { digestSfValue } from "../../../../modules/sucafina/Sucafinav1/product/contracts/canonical.ts"
import { decodeSfOperationInput, decodeSfOperationOutput } from "../../../../modules/sucafina/Sucafinav1/product/contracts/schema-admission.ts"
import type { PortResult } from "../../../../modules/sucafina/Sucafinav1/product/contracts/ports.ts"
import type { TrustedDomainContext } from "../../../../modules/sucafina/Sucafinav1/product/contracts/sf-execution.ts"
import type { SfNativeRunRecord, SfProductStatePort } from "../../../../modules/sucafina/Sucafinav1/product/contracts/state.ts"
import type { createSfProductAuthority } from "../../../../modules/sucafina/Sucafinav1/product/integration/product-authority.ts"
import { alternativeProvenanceKey, verifyAlternativePublication } from "../../../../modules/sucafina/Sucafinav1/product/decisions/alternative-provenance.ts"
import type { AlternativeCapabilityProvenance } from "../../../../modules/sucafina/Sucafinav1/product/decisions/alternative-provenance.ts"
import type { SfAnalysisRequest } from "./analysis-verifier.ts"
import type { SfAdmittedAlternativeSelection } from "./decision-alternative-services.ts"

type CaseRef = { id: string; incarnation: string; version: number }
export type SfAdmittedAnalysisInput = { request: SfAnalysisRequest & { contextFingerprint: string }; input: unknown; alternativeSelection?: SfAdmittedAlternativeSelection }

/** Only the host can supply admitted inputs and bridge captures. No payload selects a fallback. */
export function createSfNativeAnalysisInputs(input: {
  authority: ReturnType<typeof createSfProductAuthority>
  selectedCase: (call: TrustedDomainContext) => Promise<PortResult<CaseRef>>
  requestForRun: (runRef: string) => Request | undefined
  /** The host's private withRunContext scope; ordinary UI admission never supplies this. */
  runForContext?: (call: TrustedDomainContext) => string | undefined
  admittedInput: (runRef: string) => SfAdmittedAnalysisInput | undefined
  captures: (runRef: string) => readonly AlternativeCapabilityProvenance[]
  revalidateCapture: (record: AlternativeCapabilityProvenance) => Promise<boolean>
}) {
  const host = input.authority.host
  const unavailable = (): PortResult<never> => ({ status: "unavailable", reason: "native-input-provenance-unavailable" })
  const readRun = async (runRef: string, call: TrustedDomainContext) => {
    const request = host.requestFor(call)
    const selected = await input.selectedCase(call)
    if (!request || request.signal.aborted || selected.status !== "ok" || !await host.revalidate(call) || call.kind === "native" && call.binding.runId !== runRef) return undefined
    const found = await input.authority.state.read(request, "contributions", (state, actor) => {
      const run = state.nativeRuns?.[runRef]
      const current = run && state.cases[run.caseRef.id]
      if (!run?.native || !["queued", "running", "ready"].includes(run.state) || !current || !same(run.caseRef, selected.value) ||
        current.incarnation !== run.caseRef.incarnation || current.version !== run.caseRef.version || !current.participants.includes(actor.principalRef) ||
        actor.principalRef !== call.binding.principalRef || actor.accessRevision !== call.binding.accessRevision || actor.policyVersion !== call.binding.policyVersion ||
        run.principalRef !== actor.principalRef || run.accessRevision !== actor.accessRevision || run.policyVersion !== actor.policyVersion) return undefined
      if (call.kind === "native" && (run.native.sessionID !== call.binding.nativeSessionId ||
        run.caseRef.id !== call.binding.caseId || run.caseRef.incarnation !== call.binding.caseIncarnation || run.caseRef.version !== call.binding.caseVersion ||
        run.selection.profile.id !== call.binding.profileId || run.selection.profile.version !== call.binding.profileVersion || run.selection.manifestDigest !== call.binding.manifestDigest ||
        call.binding.skillReceipts.length !== 1 || !same(run.native.skillReceipt, call.binding.skillReceipts[0]))) return undefined
      return { run, output: run.outputRef ? state.contributions[run.outputRef] : undefined }
    })
    return found.status === "ok" && found.value && await host.revalidate(call) ? found.value : undefined
  }
  const verifiedAdmissionFor = async (call: TrustedDomainContext): Promise<PortResult<SfAdmittedAnalysisInput>> => {
    const runRef = call.kind === "native" ? call.binding.runId : input.runForContext?.(call)
    if (!runRef) return unavailable()
    const admitted = input.admittedInput(runRef)
    const source = host.requestFor(call)
    const binding = digestSfValue([call.kind, call.binding])
    if (!admitted || !source || input.requestForRun(runRef) !== source) return unavailable()
    const captured = structuredClone(admitted)
    const found = await readRun(runRef, call)
    if (!found || !matchesInput(found.run, captured)) return unavailable()
    const again = await readRun(runRef, call)
    return again && same(again, found) && input.admittedInput(runRef) === admitted && same(admitted, captured) &&
      (call.kind === "native" || input.runForContext?.(call) === runRef) && input.requestForRun(runRef) === source && !source.signal.aborted && binding === digestSfValue([call.kind, call.binding]) && await host.revalidate(call)
      ? { status: "ok", value: structuredClone(captured) } : unavailable()
  }
  const verifiedInputFor = async (call: TrustedDomainContext): Promise<PortResult<unknown>> => {
    const admitted = await verifiedAdmissionFor(call)
    return admitted.status === "ok" ? { status: "ok", value: admitted.value.input } : admitted
  }
  const verifiedAlternativeSelectionFor = async (call: TrustedDomainContext): Promise<PortResult<SfAdmittedAlternativeSelection>> => {
    const admitted = await verifiedAdmissionFor(call)
    if (admitted.status !== "ok") return admitted
    const selection = admitted.value.alternativeSelection
    if (!selection) return { status: "needs-input", reason: "alternative-comparison-selection-required" }
    const request = admitted.value.request
    if (request.profileId !== "sf_finance" || request.skillId !== "sf-comparar-cenarios" || !request.requestedOperationScope.includes("sf_alternative_draft") ||
      selection.schema !== "sf-admitted-alternative-selection-v1" || selection.requestDigest !== digestSfValue(request) || selection.inputDigest !== digestSfValue(admitted.value.input) ||
      !same(selection.caseRef, request.caseRef) || !same(selection.selection.caseRef, request.caseRef) ||
      selection.authority.installationId !== call.binding.installationId || selection.authority.projectId !== call.binding.projectId ||
      selection.authority.principalRef !== call.binding.principalRef || selection.authority.accessRevision !== call.binding.accessRevision || selection.authority.policyVersion !== call.binding.policyVersion ||
      selection.selection.principalRef !== call.binding.principalRef || selection.selection.accessRevision !== call.binding.accessRevision || selection.selection.policyVersion !== call.binding.policyVersion)
      return unavailable()
    return { status: "ok", value: selection }
  }
  const matchingCapture = (record: AlternativeCapabilityProvenance, run: SfNativeRunRecord, call: TrustedDomainContext) => {
    const { recordDigest, ...material } = record
    return record.schema === "sf-alternative-provenance-v1" && recordDigest === digestSfValue(material) && !!record.operationIdentity &&
      record.installationId === call.binding.installationId && record.projectId === call.binding.projectId && record.policyVersion === call.binding.policyVersion &&
      record.receipt.kind === "native" && record.receipt.operation === "sf_alternative_draft" && record.receipt.handlerExport === "draftAlternative" &&
      record.receipt.runId === run.runRef && record.receipt.nativeSessionId === run.native?.sessionID && record.receipt.principalRef === run.principalRef &&
      record.receipt.accessRevision === run.accessRevision && same(record.caseRef, run.caseRef) && !!record.receipt.callId && Number.isFinite(Date.parse(record.receipt.at)) &&
      record.receipt.inputDigest === digestSfValue(record.request) && record.receipt.resultDigest === digestSfValue(record.output) &&
      decodeSfOperationInput("sf_alternative_draft", record.request).ok && decodeSfOperationOutput("sf_alternative_draft", record.output).ok && record.output.domainApplied === false
  }
  const readAlternativeCapture = async (runRef: string, resultDigest: string, call: TrustedDomainContext): Promise<PortResult<{ run: SfNativeRunRecord; record: AlternativeCapabilityProvenance }>> => {
    if (!/^[a-f0-9]{64}$/.test(resultDigest)) return unavailable()
    const request = host.requestFor(call)
    const binding = digestSfValue([call.kind, call.binding])
    const found = await readRun(runRef, call)
    if (!request || !found) return unavailable()
    const load = async (): Promise<AlternativeCapabilityProvenance | undefined> => {
      if (found.run.state === "ready") {
        if (!found.output || String(found.output.kind) !== "AlternativeDraft" || digestSfValue(found.output.payload) !== resultDigest) return undefined
        const stored = await input.authority.state.read(request, "preferences", (state, actor) => {
          if (actor.principalRef !== call.binding.principalRef || actor.accessRevision !== call.binding.accessRevision || actor.policyVersion !== call.binding.policyVersion) return []
          return Object.entries(state.preferences).filter(([key]) => key.startsWith("sf:proposal-coverage:alternative-provenance:"))
            .flatMap(([key, raw]) => {
              const record = raw as AlternativeCapabilityProvenance
              try { return matchingCapture(record, found.run, call) && key === alternativeProvenanceKey(record) && record.receipt.resultDigest === resultDigest &&
                verifyAlternativePublication(record, found.run, found.output!) ? [record] : [] } catch { return [] }
            })
        })
        return stored.status === "ok" && stored.value.length === 1 ? stored.value[0] : undefined
      }
      const admitted = input.admittedInput(runRef)
      if (!admitted || !matchesInput(found.run, admitted) || !input.requestForRun(runRef)) return undefined
      const candidates = input.captures(runRef).filter((record) => record.receipt.resultDigest === resultDigest && matchingCapture(record, found.run, call))
      if (candidates.length !== 1 || !await input.revalidateCapture(candidates[0]!)) return undefined
      return candidates[0]
    }
    const record = await load()
    if (!record) return unavailable()
    const again = await readRun(runRef, call)
    const recordAgain = await load()
    return again && same(again, found) && recordAgain && same(recordAgain, record) && !request.signal.aborted &&
      binding === digestSfValue([call.kind, call.binding]) && await host.revalidate(call)
      ? { status: "ok", value: structuredClone({ run: found.run, record }) } : unavailable()
  }
  const readCapturedAlternative = async (runRef: string, callId: string, call: TrustedDomainContext): Promise<PortResult<AlternativeCapabilityProvenance>> => {
    const records = input.captures(runRef).filter((record) => record.receipt.callId === callId)
    if (records.length !== 1) return unavailable()
    const resultDigest = records[0]!.receipt.resultDigest
    if (typeof resultDigest !== "string") return unavailable()
    const found = await readAlternativeCapture(runRef, resultDigest, call)
    return found.status === "ok" && found.value.run.state === "running" && same(found.value.record, records[0]) &&
      input.captures(runRef).filter((record) => same(record, records[0])).length === 1 && await input.revalidateCapture(found.value.record)
      ? { status: "ok", value: found.value.record } : unavailable()
  }
  return { verifiedInputFor, verifiedAlternativeSelectionFor, readAlternativeCapture, readCapturedAlternative,
    hasAdmittedInputContext: (call: TrustedDomainContext) => call.kind === "native" || !!input.runForContext?.(call) }
}

function matchesInput(run: SfNativeRunRecord, admitted: SfAdmittedAnalysisInput) {
  const request = admitted.request
  return run.requestDigest === digestSfValue(request) && run.skillInputDigest === digestSfValue(admitted.input) && same(run.caseRef, request.caseRef) &&
    run.skillId === request.skillId && run.selection.profile.id === request.profileId && run.selection.profile.version === request.profileVersion &&
    run.selection.manifestDigest === request.manifestDigest && run.objective === request.objective && run.contextFingerprint === request.contextFingerprint &&
    run.native?.skillReceipt.skillId === request.skillId && run.native.skillReceipt.skillVersion === request.skillVersion
}
function same(left: unknown, right: unknown) { return digestSfValue(left) === digestSfValue(right) }

/** Grant the private run-store callback only its exact atomic provenance addition. */
export function createSfAlternativeRunState(input: {
  state: SfProductStatePort
  proposalCoverageWrites: WeakSet<object>
  nativePublicationGuards: WeakMap<object, () => boolean>
  captureCurrent: (record: AlternativeCapabilityProvenance) => boolean
  runRef: string
  captures: () => readonly AlternativeCapabilityProvenance[]
}): SfProductStatePort {
  return { ...input.state, transaction: async (request, command, work) => {
    if (!command.additionalNamespaces?.some((entry) => entry.namespace === "preferences")) return input.state.transaction(request, command, work)
    if (command.namespace !== "contributions" || command.additionalNamespaces.length !== 1 || command.sourceFence !== "all")
      return { status: "denied", reason: "alternative-publication-scope-invalid" }
    let publication: AlternativeCapabilityProvenance | undefined
    let vetoed = false
    const guarded: typeof work = async (state, actor, snapshot) => {
      const before = structuredClone(state.preferences)
      const result = await work(state, actor, snapshot)
      if (!result.commit) return result
      const run = state.nativeRuns?.[input.runRef]
      const output = run?.outputRef ? state.contributions[run.outputRef] : undefined
      const added = Object.entries(state.preferences).filter(([key, value]) => !same(value, before[key]))
      if (!run || !output || run.state !== "ready" || added.length !== 1 || Object.keys(before).some((key) => !Object.hasOwn(state.preferences, key))) {
        vetoed = true
        return { ...result, commit: false }
      }
      const [key, raw] = added[0]!
      const record = raw as AlternativeCapabilityProvenance
      try {
        if (key !== alternativeProvenanceKey(record) || Object.hasOwn(before, key) || !verifyAlternativePublication(record, run, output) ||
          record.receipt.runId !== input.runRef || input.captures().filter((capture) => same(capture, record)).length !== 1 ||
          command.idempotencyKey !== `run:${run.runRef}:${run.version}` || command.commandDigest !== digestSfValue({ record: run, output, alternative: record }) || !input.captureCurrent(record)) {
          vetoed = true
          return { ...result, commit: false }
        }
      } catch { vetoed = true; return { ...result, commit: false } }
      publication = record
      return result
    }
    input.proposalCoverageWrites.add(guarded)
    input.nativePublicationGuards.set(guarded, () => {
      const current = !!publication && input.captureCurrent(publication)
      if (!current) vetoed = true
      return current
    })
    try {
      const result = await input.state.transaction(request, command, guarded)
      // C08 preserves a preview callback's value; an inner ready value cannot escape a host veto.
      return vetoed ? { status: "denied", reason: "alternative-publication-vetoed" } : result
    } finally { input.proposalCoverageWrites.delete(guarded); input.nativePublicationGuards.delete(guarded) }
  } }
}
