import { digestSfContribution, digestSfValue } from "../contracts/canonical.ts"
import { decodeSfContributionOutput } from "../contracts/schema-admission.ts"
import type { PortResult } from "../contracts/ports.ts"
import type { ContributionEnvelope, SkillLoadReceipt } from "../contracts/resident-ai.ts"
import type { TrustedDomainContext } from "../contracts/sf-execution.ts"
import type { SfNativeRunRecord, SfProductStatePort } from "../contracts/state.ts"
import type { Snapshot } from "../../runtime/contract.ts"

/** Fence the host snapshot used for source validation, excluding the product state checked separately by CAS. */
export function sfRunSourceFence(snapshot: Snapshot) {
  return digestSfValue({ data: Object.fromEntries(Object.entries(snapshot.data).filter(([key]) => key !== "__sfProductV1")), versions: snapshot.versions, sequences: snapshot.sequences, sfSources: snapshot.sfSources })
}

/** Host preflight must resolve current ACL, case, evidence and C10 semantics against this exact snapshot;
 * it must return unavailable if a dependency cannot be fenced. Requests are never persisted. */
export function createSfRunStore(input: {
  state: SfProductStatePort
  requestFor: (context: TrustedDomainContext) => Request | undefined
  revalidate: (context: TrustedDomainContext) => Promise<boolean>
  preflight: (record: SfNativeRunRecord, context: TrustedDomainContext, output?: ContributionEnvelope) => Promise<PortResult<{ sourceFence: string }>>
  /** Read-only source and authority revalidation under the shared SQLite transaction lock. */
  revalidateForCommit: (record: SfNativeRunRecord, context: TrustedDomainContext, snapshot: Readonly<Snapshot>, output?: ContributionEnvelope) => Promise<PortResult<true>>
  now: () => string
}) {
  async function readRecord(runRef: string, context: TrustedDomainContext): Promise<PortResult<SfNativeRunRecord>> {
    const request = input.requestFor(context)
    if (!request || !await input.revalidate(context)) return { status: "denied", reason: "invalid-authority" }
    const found = await input.state.read(request, "contributions", (state, authority) => {
      const record = state.nativeRuns?.[runRef]
      if (!record || record.principalRef !== authority.principalRef || record.policyVersion !== authority.policyVersion || record.accessRevision !== authority.accessRevision) return undefined
      return record
    })
    if (found.status !== "ok") return "reason" in found ? { status: found.status, reason: found.reason } : { status: "unavailable", reason: "unexpected-state-preview" }
    if (!found.value || (context.kind === "native" && (context.binding.runId !== found.value.runRef || context.binding.caseId !== found.value.caseRef.id || context.binding.caseIncarnation !== found.value.caseRef.incarnation || (found.value.native && context.binding.nativeSessionId !== found.value.native.sessionID)))) return { status: "denied", reason: "run-access-unavailable" }
    return { status: "ok", value: found.value }
  }

  async function read(runRef: string, context: TrustedDomainContext): Promise<PortResult<SfNativeRunRecord>> {
    const found = await readRecord(runRef, context)
    if (found.status !== "ok") return found
    const checked = await input.preflight(found.value, context)
    if (checked.status !== "ok") return checked
    if (!await input.revalidate(context)) return { status: "denied", reason: "invalid-authority" }
    return { status: "ok", value: found.value }
  }

  async function mutate(record: SfNativeRunRecord, expectedVersion: number | null, context: TrustedDomainContext, output?: ContributionEnvelope): Promise<PortResult<SfNativeRunRecord>> {
    const request = input.requestFor(context)
    if (!request || !await input.revalidate(context)) return { status: "denied", reason: "invalid-authority" }
    if (!record.runRef || !record.principalRef || !Number.isSafeInteger(record.version) || record.version !== (expectedVersion === null ? 1 : expectedVersion + 1) || record.principalRef !== context.binding.principalRef || record.policyVersion !== context.binding.policyVersion || record.accessRevision !== context.binding.accessRevision || (context.kind === "native" && (context.binding.runId !== record.runRef || context.binding.caseId !== record.caseRef.id || context.binding.caseIncarnation !== record.caseRef.incarnation || (record.native && context.binding.nativeSessionId !== record.native.sessionID)))) return { status: "denied", reason: "invalid-run-identity" }
    const contributions = await input.state.read(request, "contributions", () => null)
    const cases = await input.state.read(request, "cases", () => null)
    if (contributions.status !== "ok") return "reason" in contributions ? { status: contributions.status, reason: contributions.reason } : { status: "unavailable", reason: "unexpected-state-preview" }
    if (cases.status !== "ok") return "reason" in cases ? { status: cases.status, reason: cases.reason } : { status: "unavailable", reason: "unexpected-state-preview" }
    // Pin the C08 versions before the preflight reads other runs and their outputs.
    const checked = await input.preflight(record, context, output)
    if (checked.status !== "ok") return checked
    if (!/^[a-f0-9]{64}$/.test(checked.value.sourceFence)) return { status: "unavailable", reason: "source-fence-unavailable" }
    if (!await input.revalidate(context)) return { status: "denied", reason: "invalid-authority" }
    const saved = await input.state.transaction<PortResult<SfNativeRunRecord> | undefined>(request, {
      namespace: "contributions", expectedStorageVersion: contributions.storageVersion,
      additionalNamespaces: [{ namespace: "cases", expectedStorageVersion: cases.storageVersion }],
      idempotencyKey: `run:${record.runRef}:${record.version}`, commandDigest: digestSfValue({ record, output }),
      targetRef: `case:${encodeURIComponent(record.caseRef.id)}:${encodeURIComponent(record.caseRef.incarnation)}`, targetIncarnation: record.caseRef.incarnation,
    }, async (state, authority, snapshot) => {
      const previous = state.nativeRuns?.[record.runRef]
      const currentCase = state.cases[record.caseRef.id]
      if (authority.principalRef !== record.principalRef || authority.policyVersion !== record.policyVersion || authority.accessRevision !== record.accessRevision ||
          !currentCase || currentCase.incarnation !== record.caseRef.incarnation || ((record.state === "stale" || record.state === "cancelled") ? currentCase.version < record.caseRef.version : currentCase.version !== record.caseRef.version) || !currentCase.participants.includes(record.principalRef) ||
          sfRunSourceFence(snapshot) !== checked.value.sourceFence || (output && !!state.contributions[output.id]) || (expectedVersion === null ? !!previous : previous?.version !== expectedVersion)) return { commit: false, value: undefined }
      const before = structuredClone(snapshot)
      const current = await Promise.resolve().then(() => input.revalidateForCommit(record, context, snapshot, output)).catch(() => ({ status: "unavailable", reason: "commit-revalidation-unavailable" } as const))
      if (!Bun.deepEquals(snapshot, before)) return { commit: false, value: { status: "denied", reason: "commit-revalidation-mutated-snapshot" } as const }
      if (current.status !== "ok") return { commit: false, value: { status: current.status, reason: current.reason } as const }
      state.nativeRuns ??= {}
      state.nativeRuns[record.runRef] = record
      if (output) state.contributions[output.id] = output
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
    const checkedAgain = await input.preflight(current.value, context, output)
    if (checkedAgain.status !== "ok") return checkedAgain
    if (!await input.revalidate(context)) return { status: "denied", reason: "invalid-authority" }
    return { status: "ok", value: current.value }
  }

  return {
    read,
    create: (record: SfNativeRunRecord, context: TrustedDomainContext) => {
      if (record.state !== "preparing" || record.native || record.outputRef || !record.intentDigest || !/^[a-f0-9]{64}$/.test(record.intentDigest) || !/^[a-f0-9]{64}$/.test(record.requestDigest) || !/^[a-f0-9]{64}$/.test(record.skillInputDigest)) return Promise.resolve({ status: "failed", reason: "invalid-run-admission" } as const)
      return mutate(record, null, context)
    },
    markStale: async (runRef: string, reason: string, context: TrustedDomainContext) => {
      const prior = await readRecord(runRef, context)
      if (prior.status !== "ok") return prior
      if (!prior.value.native || !["queued", "running"].includes(prior.value.state)) return { status: "conflict", reason: "invalid-run-transition" } as const
      return mutate({ ...prior.value, version: prior.value.version + 1, updatedAt: input.now(), state: "stale", reason, native: prior.value.native }, prior.value.version, context)
    },
    attach: async (runRef: string, expectedVersion: number, sessionID: string, receipt: SkillLoadReceipt, context: TrustedDomainContext) => {
      const prior = await read(runRef, context)
      if (prior.status !== "ok") return prior
      if (prior.value.version !== expectedVersion || prior.value.state !== "preparing" || receipt.nativeSessionId !== sessionID || receipt.runId !== runRef || receipt.skillId !== prior.value.skillId || receipt.manifestDigest !== prior.value.selection.manifestDigest || receipt.profileId !== prior.value.selection.profile.id || receipt.profileVersion !== prior.value.selection.profile.version || receipt.profileDigest !== prior.value.selection.profile.sourceDigest || !prior.value.selection.skills.some((skill) => skill.id === receipt.skillId && skill.version === receipt.skillVersion && skill.sourceDigest === receipt.sourceDigest && skill.instructionsDigest === receipt.instructionsDigest) || !receipt.loadedMessageId || !receipt.loadedAt) return { status: "conflict", reason: "invalid-native-receipt" } as const
      return mutate({ ...prior.value, version: expectedVersion + 1, updatedAt: input.now(), state: "queued", native: { sessionID, skillReceipt: receipt } }, expectedVersion, context)
    },
    transition: async (runRef: string, expectedVersion: number, state: "running" | "failed" | "cancelled" | "stale" | "unavailable" | "needs-input", reason: string | undefined, context: TrustedDomainContext) => {
      const prior = (state === "stale" || state === "cancelled") ? await readRecord(runRef, context) : await read(runRef, context)
      if (prior.status !== "ok") return prior
      if (prior.value.version !== expectedVersion || !["preparing", "queued", "running"].includes(prior.value.state) || (state === "running" && prior.value.state !== "queued") || (state === "stale" && !prior.value.native)) return { status: "conflict", reason: "invalid-run-transition" } as const
      return mutate({ ...prior.value, version: expectedVersion + 1, updatedAt: input.now(), state, reason } as SfNativeRunRecord, expectedVersion, context)
    },
    publish: async (runRef: string, expectedVersion: number, output: ContributionEnvelope, context: TrustedDomainContext) => {
      const prior = await read(runRef, context)
      if (prior.status !== "ok") return prior
      const record = prior.value
      if (record.version !== expectedVersion || record.state !== "running" || !record.native || output.state !== "ready" || !record.selection.profile.outputTypes.includes(output.kind) || !decodeSfContributionOutput(output.kind, output.payload).ok || !output.runProvenance.actualModel || !output.id || output.runProvenance.runId !== runRef || digestSfValue(record.native.skillReceipt) !== digestSfValue(Object.fromEntries(Object.keys(record.native.skillReceipt).map((key) => [key, output.runProvenance[key as keyof SkillLoadReceipt]]))) || output.runProvenance.contextFingerprint !== record.contextFingerprint || output.caseRef.id !== record.caseRef.id || output.caseRef.incarnation !== record.caseRef.incarnation || output.caseRef.version !== record.caseRef.version || output.accessRevision !== record.accessRevision || digestSfContribution(output) !== output.outputDigest) return { status: "conflict", reason: "invalid-run-output" } as const
      return mutate({ ...record, version: expectedVersion + 1, updatedAt: input.now(), state: "ready", outputRef: output.id }, expectedVersion, context, output)
    },
  }
}
