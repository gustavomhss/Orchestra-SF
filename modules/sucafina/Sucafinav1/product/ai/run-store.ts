import { digestSfValue } from "../contracts/canonical.ts"
import type { PortResult } from "../contracts/ports.ts"
import type { ContributionEnvelope, SkillLoadReceipt } from "../contracts/resident-ai.ts"
import type { TrustedDomainContext } from "../contracts/sf-execution.ts"
import type { SfNativeRunRecord, SfProductStatePort, SfStateNamespace } from "../contracts/state.ts"
import type { Snapshot } from "../../runtime/contract.ts"
import { alternativeProvenanceKey, verifyAlternativePublication } from "../decisions/alternative-provenance.ts"
import type { AlternativeCapabilityProvenance } from "../decisions/alternative-provenance.ts"
import { hasSfRunSkillReceipt, matchesSfRunOutput } from "./run-provenance.ts"

/** Fence the host snapshot used for source validation, excluding the product state checked separately by CAS. */
export function sfRunSourceFence(snapshot: Snapshot) {
  return digestSfValue({ data: Object.fromEntries(Object.entries(snapshot.data).filter(([key]) => key !== "__sfProductV1")), versions: snapshot.versions, sequences: snapshot.sequences, sfSources: snapshot.sfSources, sfBlobGenerations: snapshot.sfBlobGenerations })
}

/** Host preflight must resolve current ACL, case, evidence and C10 semantics against this exact snapshot;
 * it must return unavailable if a dependency cannot be fenced. Requests are never persisted. */
export function createSfRunStore(input: {
  state: SfProductStatePort
  /** Host-selected C08 namespaces that source validation depends on; never supplied by model input. */
  requiredNamespaces?: readonly Exclude<SfStateNamespace, "cases" | "contributions">[]
  requestFor: (context: TrustedDomainContext) => Request | undefined
  revalidate: (context: TrustedDomainContext) => Promise<boolean>
  preflight: (record: SfNativeRunRecord, context: TrustedDomainContext, output?: ContributionEnvelope) => Promise<PortResult<{ sourceFence: string }>>
  /** Reads the bridge's private capture; model output is never a capture. */
  readCapturedAlternative?: (runRef: string, callId: string, context: TrustedDomainContext) => Promise<PortResult<AlternativeCapabilityProvenance>>
  /** Read-only source and authority revalidation under the shared SQLite transaction lock. When alternative is present, also verify its private bridge capture and active lease. */
  revalidateForCommit: (record: SfNativeRunRecord, context: TrustedDomainContext, snapshot: Readonly<Snapshot>, output?: ContributionEnvelope, alternative?: AlternativeCapabilityProvenance) => Promise<PortResult<true>>
  now: () => string
}) {
  const requiredNamespaces = [...(input.requiredNamespaces ?? [])]
  const invalidRequiredNamespaces = new Set(requiredNamespaces).size !== requiredNamespaces.length || requiredNamespaces.some((namespace) => !["preferences", "reviews", "relations", "threads", "confirmations", "documents", "receipts", "atlas", "outbox", "bi-artifacts"].includes(namespace))
  const hasCurrentAuthority = async (context: TrustedDomainContext) => input.revalidate(context).catch(() => false)
  async function readRecord(runRef: string, context: TrustedDomainContext): Promise<PortResult<SfNativeRunRecord>> {
    const request = input.requestFor(context)
    if (!request || !await hasCurrentAuthority(context)) return { status: "denied", reason: "invalid-authority" }
    const found = await input.state.read(request, "contributions", (state, authority) => {
      const record = state.nativeRuns?.[runRef]
      if (!record || record.runRef !== runRef || record.principalRef !== authority.principalRef || record.policyVersion !== authority.policyVersion || record.accessRevision !== authority.accessRevision) return undefined
      return record
    })
    if (found.status !== "ok") return "reason" in found ? { status: found.status, reason: found.reason } : { status: "unavailable", reason: "unexpected-state-preview" }
    if (!found.value || (context.kind === "native" && (context.binding.runId !== found.value.runRef || context.binding.caseId !== found.value.caseRef.id || context.binding.caseIncarnation !== found.value.caseRef.incarnation || (found.value.native && context.binding.nativeSessionId !== found.value.native.sessionID)))) return { status: "denied", reason: "run-access-unavailable" }
    return { status: "ok", value: found.value }
  }

  async function read(runRef: string, context: TrustedDomainContext): Promise<PortResult<SfNativeRunRecord>> {
    const found = await readRecord(runRef, context)
    if (found.status !== "ok") return found
    const recordDigest = digestSfValue(found.value)
    const checked = await input.preflight(found.value, context).catch(() => ({ status: "unavailable", reason: "run-preflight-unavailable" } as const))
    if (checked.status !== "ok") return checked
    if (digestSfValue(found.value) !== recordDigest) return { status: "denied", reason: "run-input-changed-during-preflight" }
    if (!await hasCurrentAuthority(context)) return { status: "denied", reason: "invalid-authority" }
    if (digestSfValue(found.value) !== recordDigest) return { status: "denied", reason: "run-input-changed-during-authorization" }
    return { status: "ok", value: found.value }
  }

  async function mutate(record: SfNativeRunRecord, expectedVersion: number | null, context: TrustedDomainContext, output?: ContributionEnvelope, alternative?: AlternativeCapabilityProvenance): Promise<PortResult<SfNativeRunRecord>> {
    const mutation = alternative ? { record, output, alternative } : { record, output }
    const commandDigest = digestSfValue(mutation)
    const request = input.requestFor(context)
    if (!request || !await hasCurrentAuthority(context)) return { status: "denied", reason: "invalid-authority" }
    if (digestSfValue(mutation) !== commandDigest) return { status: "denied", reason: "run-input-changed-during-authorization" }
    if (!record.runRef || !record.principalRef || !Number.isSafeInteger(record.version) || record.version !== (expectedVersion === null ? 1 : expectedVersion + 1) || record.principalRef !== context.binding.principalRef || record.policyVersion !== context.binding.policyVersion || record.accessRevision !== context.binding.accessRevision || (context.kind === "native" && (context.binding.runId !== record.runRef || context.binding.caseId !== record.caseRef.id || context.binding.caseIncarnation !== record.caseRef.incarnation || (record.native && context.binding.nativeSessionId !== record.native.sessionID)))) return { status: "denied", reason: "invalid-run-identity" }
    const terminal = record.state === "stale" || record.state === "cancelled"
    if (terminal && alternative) return { status: "unavailable", reason: "alternative-capture-unavailable" }
    if (!terminal && invalidRequiredNamespaces) return { status: "unavailable", reason: "invalid-run-source-namespaces" }
    const guardedNamespaces = terminal ? [] : alternative ? requiredNamespaces.filter((namespace) => namespace !== "preferences") : requiredNamespaces
    const [contributions, cases, ...required] = await Promise.all([
      input.state.read(request, "contributions", () => null),
      input.state.read(request, "cases", () => null),
      ...guardedNamespaces.map((namespace) => input.state.read(request, namespace, () => null)),
      ...(alternative ? [input.state.read(request, "preferences", () => null)] : []),
    ])
    if (contributions.status !== "ok") return "reason" in contributions ? { status: contributions.status, reason: contributions.reason } : { status: "unavailable", reason: "unexpected-state-preview" }
    if (cases.status !== "ok") return "reason" in cases ? { status: cases.status, reason: cases.reason } : { status: "unavailable", reason: "unexpected-state-preview" }
    if (required.some((result) => result.status !== "ok")) return { status: "unavailable", reason: "run-source-namespace-unavailable" }
    const preferences = alternative ? required[guardedNamespaces.length] : undefined
    if (alternative && (!preferences || preferences.status !== "ok")) return { status: "unavailable", reason: "run-source-namespace-unavailable" }
    if (alternative) {
      if (!input.readCapturedAlternative) return { status: "unavailable", reason: "alternative-capture-unavailable" }
      const captured = await input.readCapturedAlternative(record.runRef, alternative.receipt.callId, context).catch(() => ({ status: "unavailable", reason: "alternative-capture-unavailable" } as const))
      if (captured.status !== "ok" || digestSfValue(captured.value) !== digestSfValue(alternative)) return { status: "unavailable", reason: "alternative-capture-unavailable" }
    }
    // Pin the C08 versions before the preflight reads other runs and their outputs.
    const checked = terminal ? undefined : await input.preflight(record, context, output).catch(() => ({ status: "unavailable", reason: "run-preflight-unavailable" } as const))
    if (checked && checked.status !== "ok") return checked
    if (digestSfValue(mutation) !== commandDigest) return { status: "denied", reason: "run-input-changed-during-preflight" }
    if (checked?.status === "ok" && !/^[a-f0-9]{64}$/.test(checked.value.sourceFence)) return { status: "unavailable", reason: "source-fence-unavailable" }
    if (!await hasCurrentAuthority(context)) return { status: "denied", reason: "invalid-authority" }
    const saved = await input.state.transaction<PortResult<SfNativeRunRecord> | undefined>(request, {
      namespace: "contributions", expectedStorageVersion: contributions.storageVersion,
      sourceFence: "all",
      checkNamespaces: [{ namespace: "cases", expectedStorageVersion: cases.storageVersion }, ...required.slice(0, guardedNamespaces.length).flatMap((result, index) => result.status === "ok" ? [{ namespace: guardedNamespaces[index]!, expectedStorageVersion: result.storageVersion }] : [])],
      ...(preferences?.status === "ok" ? { additionalNamespaces: [{ namespace: "preferences" as const, expectedStorageVersion: preferences.storageVersion }] } : {}),
      idempotencyKey: `run:${record.runRef}:${record.version}`, commandDigest,
      targetRef: `case:${encodeURIComponent(record.caseRef.id)}:${encodeURIComponent(record.caseRef.incarnation)}`, targetIncarnation: record.caseRef.incarnation,
    }, async (state, authority, snapshot) => {
      if (digestSfValue(mutation) !== commandDigest) return { commit: false, value: { status: "denied", reason: "run-input-changed-before-commit" } as const }
      const previous = state.nativeRuns?.[record.runRef]
      const currentCase = state.cases[record.caseRef.id]
      if (authority.principalRef !== record.principalRef || authority.policyVersion !== record.policyVersion || authority.accessRevision !== record.accessRevision ||
          !currentCase || currentCase.incarnation !== record.caseRef.incarnation || ((record.state === "stale" || record.state === "cancelled") ? currentCase.version < record.caseRef.version : currentCase.version !== record.caseRef.version) || !currentCase.participants.includes(record.principalRef) ||
          (checked?.status === "ok" && sfRunSourceFence(snapshot) !== checked.value.sourceFence) || (output && !!state.contributions[output.id]) || (alternative && !!state.preferences[alternativeProvenanceKey(alternative)]) || (expectedVersion === null ? !!previous : previous?.version !== expectedVersion)) return { commit: false, value: undefined }
      const before = structuredClone(snapshot)
      const current = await Promise.resolve().then(() => input.revalidateForCommit(record, context, snapshot, output, alternative)).catch(() => ({ status: "unavailable", reason: "commit-revalidation-unavailable" } as const))
      if (!Bun.deepEquals(snapshot, before)) return { commit: false, value: { status: "denied", reason: "commit-revalidation-mutated-snapshot" } as const }
      if (digestSfValue(mutation) !== commandDigest) return { commit: false, value: { status: "denied", reason: "commit-revalidation-mutated-input" } as const }
      if (current.status !== "ok") return { commit: false, value: { status: current.status, reason: current.reason } as const }
      state.nativeRuns ??= {}
      state.nativeRuns[record.runRef] = record
      if (output) state.contributions[output.id] = output
      if (alternative) state.preferences[alternativeProvenanceKey(alternative)] = alternative
      return { commit: true, value: { status: "ok", value: record } as const }
    })
    if (saved.status === "preview") return saved.value ?? { status: "stale", reason: "run-case-or-source-changed" }
    if (saved.status !== "ok") return "reason" in saved ? { status: saved.status, reason: saved.reason } : { status: "unavailable", reason: "unexpected-state-preview" }
    if (!saved.value) return { status: "stale", reason: "run-case-or-source-changed" }
    if (saved.value.status !== "ok") return saved.value
    const current = await input.state.read(request, "contributions", (state, authority) => {
      if (authority.principalRef !== record.principalRef || authority.policyVersion !== record.policyVersion || authority.accessRevision !== record.accessRevision) return undefined
      const actual = state.nativeRuns?.[record.runRef]
      if (!actual || digestSfValue(actual) !== digestSfValue(record) || (output && (!state.contributions[output.id] || digestSfValue(state.contributions[output.id]) !== digestSfValue(output)))) return undefined
      return actual
    })
    if (current.status !== "ok") return "reason" in current ? { status: current.status, reason: current.reason } : { status: "unavailable", reason: "unexpected-state-preview" }
    if (!current.value) return { status: "stale", reason: "run-or-output-changed" }
    if (alternative) {
      const stored = await input.state.read(request, "preferences", (state) => state.preferences[alternativeProvenanceKey(alternative)])
      if (stored.status !== "ok" || digestSfValue(stored.value) !== digestSfValue(alternative)) return { status: "stale", reason: "alternative-provenance-changed" }
    }
    const checkedAgain = terminal ? undefined : await input.preflight(current.value, context, output).catch(() => ({ status: "unavailable", reason: "run-preflight-unavailable" } as const))
    if (checkedAgain && checkedAgain.status !== "ok") return checkedAgain
    if (digestSfValue(mutation) !== commandDigest || digestSfValue(current.value) !== digestSfValue(record)) return { status: "denied", reason: "run-input-changed-during-preflight" }
    if (!await hasCurrentAuthority(context)) return { status: "denied", reason: "invalid-authority" }
    if (digestSfValue(mutation) !== commandDigest || digestSfValue(current.value) !== digestSfValue(record)) return { status: "denied", reason: "run-input-changed-during-authorization" }
    return { status: "ok", value: current.value }
  }

  return {
    read,
    create: (record: SfNativeRunRecord, context: TrustedDomainContext) => {
      const intentDigest = "intentDigest" in record ? record.intentDigest : undefined
      if (record.state !== "preparing" || record.native || record.outputRef || typeof intentDigest !== "string" || !/^[a-f0-9]{64}$/.test(intentDigest) || !/^[a-f0-9]{64}$/.test(record.requestDigest) || !/^[a-f0-9]{64}$/.test(record.skillInputDigest)) return Promise.resolve({ status: "failed", reason: "invalid-run-admission" } as const)
      return mutate(record, null, context)
    },
    markStale: async (runRef: string, reason: string, context: TrustedDomainContext) => {
      const prior = await readRecord(runRef, context)
      if (prior.status !== "ok") return prior
      if (!prior.value.native || !["queued", "running"].includes(prior.value.state)) return { status: "conflict", reason: "invalid-run-transition" } as const
      return mutate({ ...prior.value, version: prior.value.version + 1, updatedAt: input.now(), state: "stale", reason, native: prior.value.native }, prior.value.version, context)
    },
    preserveStale: async (runRef: string, reason: string, output: ContributionEnvelope, context: TrustedDomainContext) => {
      const prior = await readRecord(runRef, context)
      if (prior.status !== "ok") return prior
      if (!prior.value.native || !["queued", "running"].includes(prior.value.state) || output.kind === "AlternativeDraft" || !matchesSfRunOutput(prior.value, output)) return { status: "conflict", reason: "invalid-stale-run-output" } as const
      return mutate({ ...prior.value, version: prior.value.version + 1, updatedAt: input.now(), state: "stale", reason, outputRef: output.id, native: prior.value.native }, prior.value.version, context, output)
    },
    attach: async (runRef: string, expectedVersion: number, sessionID: string, receipt: SkillLoadReceipt, context: TrustedDomainContext) => {
      const prior = await read(runRef, context)
      if (prior.status !== "ok") return prior
      const next = { ...prior.value, version: expectedVersion + 1, updatedAt: input.now(), state: "queued" as const, native: { sessionID, skillReceipt: receipt } }
      if (prior.value.version !== expectedVersion || prior.value.state !== "preparing" || !sessionID.trim() || !hasSfRunSkillReceipt(next)) return { status: "conflict", reason: "invalid-native-receipt" } as const
      return mutate(next, expectedVersion, context)
    },
    transition: async (runRef: string, expectedVersion: number, state: "running" | "failed" | "cancelled" | "stale" | "unavailable" | "needs-input", reason: string | undefined, context: TrustedDomainContext) => {
      const prior = (state === "stale" || state === "cancelled") ? await readRecord(runRef, context) : await read(runRef, context)
      if (prior.status !== "ok") return prior
      if (prior.value.version !== expectedVersion || !["preparing", "queued", "running"].includes(prior.value.state) || (state === "running" && prior.value.state !== "queued") || (state === "stale" && !prior.value.native)) return { status: "conflict", reason: "invalid-run-transition" } as const
      return mutate({ ...prior.value, version: expectedVersion + 1, updatedAt: input.now(), state, reason } as SfNativeRunRecord, expectedVersion, context)
    },
    publish: async (runRef: string, expectedVersion: number, output: ContributionEnvelope, context: TrustedDomainContext, alternative?: AlternativeCapabilityProvenance) => {
      const prior = await read(runRef, context)
      if (prior.status !== "ok") return prior
      const record = prior.value
      if (record.version !== expectedVersion || record.state !== "running" || !matchesSfRunOutput(record, output)) return { status: "conflict", reason: "invalid-run-output" } as const
      const next = { ...record, version: expectedVersion + 1, updatedAt: input.now(), state: "ready" as const, outputRef: output.id }
      if ((String(output.kind) === "AlternativeDraft") !== !!alternative || (alternative && !verifyAlternativePublication(alternative, next, output))) return { status: "conflict", reason: "alternative-provenance-unverified" } as const
      return mutate(next, expectedVersion, context, output, alternative)
    },
  }
}
