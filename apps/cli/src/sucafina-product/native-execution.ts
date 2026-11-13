import { Effect, Option, Schema } from "effect"
import type { NativeRunExecutionPort, SfNativeExecutionTicket, SfReviewTarget } from "../../../../modules/sucafina/Sucafinav1/product/ai/analysis-port.ts"
import type { createSfRunStore } from "../../../../modules/sucafina/Sucafinav1/product/ai/run-store.ts"
import { digestSfContribution, digestSfValue } from "../../../../modules/sucafina/Sucafinav1/product/contracts/canonical.ts"
import { decodeSfContributionEnvelope, decodeSfContributionOutput } from "../../../../modules/sucafina/Sucafinav1/product/contracts/schema-admission.ts"
import type { BusinessPorts, PortResult } from "../../../../modules/sucafina/Sucafinav1/product/contracts/ports.ts"
import type { ContributionEnvelope } from "../../../../modules/sucafina/Sucafinav1/product/contracts/resident-ai.ts"
import type { SfNativeRunRecord } from "../../../../modules/sucafina/Sucafinav1/product/contracts/state.ts"
import type { TrustedDomainContext } from "../../../../modules/sucafina/Sucafinav1/product/contracts/sf-execution.ts"
import type { SfNativeHostApi, SfNativePrepareInput, SfNativeRun } from "./native-host.ts"

const ticketMark = Symbol("sf-native-execution-ticket")
type Admission = { record: SfNativeRunRecord; native: SfNativePrepareInput }
type WithContext = <T>(runRef: string, action: (context: TrustedDomainContext) => Promise<PortResult<T>>) => Promise<PortResult<T>>

/** Product root supplies actual preflight, semantic output verification and fresh request-bound authority. */
export function createSfNativeExecution(input: {
  host: SfNativeHostApi
  store: ReturnType<typeof createSfRunStore>
  withRunContext: WithContext
  preflight: (request: Parameters<BusinessPorts["analysis"]["create"]>[0], skillInput: unknown, target?: SfReviewTarget) => Promise<PortResult<Admission>>
  verifyOutput: (output: ContributionEnvelope, run: SfNativeRunRecord, context: TrustedDomainContext) => Promise<PortResult<true>>
}): NativeRunExecutionPort {
  const admittedRuns = new Set<string>()
  const tickets = new WeakMap<SfNativeExecutionTicket, { run: SfNativeRun; request: Request; record: SfNativeRunRecord; phase: "prepared" | "running" | "completed" | "failed" }>()
  return {
    admit: async (request, skillInput, target) => {
      const requested = freezeFacts(structuredClone(request))
      const decodedInput = freezeFacts(structuredClone(skillInput))
      const review = freezeFacts(structuredClone(target))
      const prepared = await input.preflight(requested, decodedInput, review)
      if (prepared.status !== "ok") return prepared
      const record = freezeFacts(structuredClone(prepared.value.record))
      const native = Object.freeze({ ...freezeFacts(structuredClone({ ...prepared.value.native, request: undefined })), request: prepared.value.native.request })
      if (record.state !== "preparing" || record.version !== 1 || !record.runRef || native.request.signal.aborted ||
        record.requestDigest !== digestSfValue(requested) || record.skillInputDigest !== digestSfValue(decodedInput) ||
        digestSfValue(record.caseRef) !== digestSfValue(requested.caseRef) || digestSfValue(record.caseRef) !== digestSfValue(native.caseRef) ||
        digestSfValue(record.selection) !== digestSfValue(native.selected) || digestSfValue(record.model) !== digestSfValue(native.model) ||
        digestSfValue(record.reviewTarget) !== digestSfValue(review) || record.contextFingerprint !== requested.contextFingerprint ||
        record.objective !== requested.objective || record.skillId !== requested.skillId || native.skillId !== requested.skillId ||
        record.selection.profile.id !== requested.profileId || record.selection.profile.version !== requested.profileVersion ||
        record.selection.manifestDigest !== requested.manifestDigest || record.runRef !== native.runId || !native.prompt.trim() ||
        !record.selection.skills.some((skill) => skill.id === requested.skillId && skill.version === requested.skillVersion) ||
        digestSfValue([...record.selection.operationIds].toSorted()) !== digestSfValue([...requested.requestedOperationScope].toSorted()))
        return { status: "denied", reason: "native-preflight-mismatch" }
      if (admittedRuns.has(record.runRef)) return { status: "conflict", reason: "native-run-already-admitted" }
      admittedRuns.add(record.runRef)
      const created = await input.withRunContext(record.runRef, (context) => input.store.create(record, context))
      if (created.status !== "ok") return created
      const preparedRun = await Effect.runPromise(input.host.prepare(native), { signal: native.request.signal }).catch(() => undefined)
      if (!preparedRun) {
        const settled = await input.withRunContext(record.runRef, (context) => input.store.transition(record.runRef, created.value.version,
          "unavailable", "native-preparation-outcome-unknown", context))
        if (settled.status !== "ok") return settled
        return { status: "unavailable", reason: "native-preparation-outcome-unknown" }
      }
      if (preparedRun.status !== "ok") {
        const settled = await input.withRunContext(record.runRef, (context) => input.store.transition(record.runRef, created.value.version,
          preparedRun.status === "needs-input" ? "needs-input" : "unavailable", preparedRun.reason, context))
        if (settled.status !== "ok") return settled
        return preparedRun
      }
      const run = preparedRun.value
      const attached = await input.withRunContext(record.runRef, (context) => sameAuthority(context, run.binding)
        ? input.store.attach(record.runRef, created.value.version, run.sessionID, run.skillReceipt, context)
        : Promise.resolve({ status: "denied", reason: "native-authority-mismatch" } as const))
      if (attached.status !== "ok") {
        await Effect.runPromise(input.host.interrupt(run.binding)).catch(() => undefined)
        return attached
      }
      const ticket = Object.freeze({ [ticketMark]: true as const })
      assertTicket(ticket)
      tickets.set(ticket, { run, request: native.request, record: attached.value, phase: "prepared" })
      return { status: "ok", value: { runRef: record.runRef, sessionID: run.sessionID, skillReceipt: run.skillReceipt, executionTicket: ticket } }
    },
    execute: async (ticket) => {
      const entry = tickets.get(ticket)
      if (!entry || entry.request.signal.aborted || entry.phase !== "prepared") return { status: "denied", reason: "native-ticket-unavailable" }
      entry.phase = "running"
      try {
        const started = await input.withRunContext(entry.record.runRef, async (context) => {
          if (!sameAuthority(context, entry.run.binding)) return { status: "denied", reason: "native-authority-mismatch" }
          const current = await input.store.read(entry.record.runRef, context)
          if (current.status !== "ok") return current
          if (current.value.version !== entry.record.version || current.value.state !== "queued" || current.value.native?.sessionID !== entry.run.sessionID)
            return { status: "denied", reason: "native-ticket-changed" }
          return input.store.transition(entry.record.runRef, current.value.version, "running", undefined, context)
        })
        if (started.status !== "ok") return started
        entry.record = started.value
        const result = await Effect.runPromise(input.host.execute(entry.run.binding), { signal: entry.request.signal })
        if (result.status === "ok") entry.phase = "completed"
        return result
      } finally {
        if (entry.phase === "running") entry.phase = "failed"
      }
    },
    collect: async (ticket, context) => {
      const entry = tickets.get(ticket)
      if (!entry || entry.phase !== "completed" || entry.request.signal.aborted) return { status: "denied", reason: "native-ticket-unavailable" }
      if (!sameAuthority(context, entry.run.binding)) return { status: "denied", reason: "native-authority-mismatch" }
      const before = await input.store.read(entry.record.runRef, context)
      if (before.status !== "ok") return before
      if (before.value.version !== entry.record.version || before.value.state !== "running" || before.value.native?.sessionID !== entry.run.sessionID ||
        digestSfValue(before.value.native.skillReceipt) !== digestSfValue(entry.run.skillReceipt)) return { status: "denied", reason: "native-ticket-changed" }
      const messages = await Effect.runPromise(input.host.collect(entry.run.binding), { signal: entry.request.signal })
      if (messages.status !== "ok") return messages
      const candidates = messages.value.flatMap(({ message }) => message.type !== "assistant" || !message.time.completed || message.error ? [] : message.content.flatMap((part) => {
        if (part.type === "text") {
          const parsed = Schema.decodeUnknownOption(Schema.UnknownFromJsonString)(part.text)
          return Option.isSome(parsed) ? [parsed.value] : []
        }
        if (part.type !== "tool" || part.state.status !== "completed") return []
        return [part.state.structured.result, part.state.result]
      })).filter((candidate) => candidate !== null && typeof candidate === "object" && !Array.isArray(candidate) &&
        "schemaVersion" in candidate && candidate.schemaVersion === "sf-contribution-v1")
      const unique = new Map(candidates.map((candidate) => [digestSfValue(candidate), candidate]))
      if (unique.size !== 1) return { status: "unavailable", reason: "native-output-unavailable" }
      const decoded = decodeSfContributionEnvelope([...unique.values()][0])
      if (!decoded.ok) return { status: "denied", reason: "native-output-invalid" }
      const output = decoded.value
      const receipt = Object.fromEntries(Object.keys(entry.run.skillReceipt).map((key) => [key, output.runProvenance[key as keyof typeof entry.run.skillReceipt]]))
      const allowed = ["id", "caseRef", "kind", "schemaVersion", "state", "payload", "evidenceRefs", "runProvenance", "accessRevision", "createdAt", "outputDigest"]
      if (Reflect.ownKeys(output).some((key) => typeof key !== "string" || !allowed.includes(key)) ||
        output.schemaVersion !== "sf-contribution-v1" || !output.id || !Number.isFinite(Date.parse(output.createdAt)) ||
        digestSfValue(receipt) !== digestSfValue(entry.run.skillReceipt) || !output.runProvenance.actualModel ||
        output.state !== "ready" || !before.value.selection.profile.outputTypes.includes(output.kind) ||
        !decodeSfContributionOutput(output.kind, output.payload).ok || digestSfContribution(output) !== output.outputDigest ||
        digestSfValue(output.caseRef) !== digestSfValue(before.value.caseRef) || output.runProvenance.runId !== entry.record.runRef ||
        output.runProvenance.nativeSessionId !== entry.run.sessionID || output.runProvenance.manifestDigest !== entry.record.selection.manifestDigest ||
        output.runProvenance.contextFingerprint !== entry.record.contextFingerprint || output.accessRevision !== entry.record.accessRevision)
        return { status: "denied", reason: "native-output-mismatch" }
      const verified = await input.verifyOutput(output, before.value, context)
      if (verified.status !== "ok") return verified
      if (verified.value !== true) return { status: "denied", reason: "native-output-unverified" }
      const after = await input.store.read(entry.record.runRef, context)
      if (after.status !== "ok") return after
      if (after.value.version !== before.value.version || after.value.state !== "running") return { status: "stale", reason: "native-run-changed" }
      return { status: "ok", value: output }
    },
    interrupt: async (ticket, context) => {
      const entry = tickets.get(ticket)
      if (!entry) return { status: "denied", reason: "native-ticket-unavailable" }
      if (!sameAuthority(context, entry.run.binding)) return { status: "denied", reason: "native-authority-mismatch" }
      const current = await input.store.read(entry.record.runRef, context)
      if (current.status !== "ok") return current
      if (current.value.native?.sessionID !== entry.run.sessionID) return { status: "denied", reason: "native-ticket-changed" }
      const interrupted = await Effect.runPromise(input.host.interrupt(entry.run.binding))
      if (interrupted.status === "ok") tickets.delete(ticket)
      return interrupted
    },
  }
}

function assertTicket<T extends { readonly [ticketMark]: true }>(ticket: T): asserts ticket is T & SfNativeExecutionTicket {
  if (ticket[ticketMark] !== true) throw new Error("invalid-native-execution-ticket")
}

function freezeFacts<T>(value: T): T {
  if (!value || typeof value !== "object") return value
  Object.values(value).forEach(freezeFacts)
  return Object.freeze(value)
}

function sameAuthority(context: TrustedDomainContext, binding: SfNativeRun["binding"]) {
  return context.binding.installationId === binding.installationId && context.binding.projectId === binding.projectId &&
    context.binding.principalRef === binding.principalRef && context.binding.policyVersion === binding.policyVersion &&
    context.binding.accessRevision === binding.accessRevision && (context.kind !== "native" || context.binding === binding)
}
