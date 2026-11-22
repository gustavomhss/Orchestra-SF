import { AsyncLocalStorage } from "node:async_hooks"
import { createMemoryEmit, createMemoryRead, versioned } from "@orchestra/atlas-boundary/business-memory-ports"
import type { MemoryRecord, NamedScanner } from "@orchestra/atlas-boundary/business-memory-ports"
import { digestSfEvidenceRef, digestSfValue, sfEvidenceSourceMaps } from "../contracts/canonical.ts"
import type { AuthorizedCaseProjection, BusinessContextService, BusinessEvidenceRef, BusinessEvidenceResolution, BusinessMemoryEnvelope, MemoryWriteReceipt, SfAtlasProjection } from "../contracts/business-context.ts"
import type { SourceRef } from "../contracts/context.ts"
import type { DecisionCasePort, DomainPortHost } from "../contracts/ports.ts"
import type { DecisionCase } from "../contracts/decisions.ts"
import type { SfAtlasOutboxEntry, SfProductStatePort } from "../contracts/state.ts"
import type { TrustedDomainContext } from "../contracts/sf-execution.ts"
import { encodeCaseRef } from "../decisions/case-port.ts"
import { deriveSfMemoryOwner, mapSfAtlasEntry } from "../decision-memory/atlas-projection.ts"
import { rankSfRecalledCasesAuthorized } from "../decision-memory/recall.ts"
import type { AuthorizedMemoryProjection, RecallFeatures, RecallScope } from "../decision-memory/recall.ts"
import { createSfAtlasDurableMemory } from "./atlas-store.ts"
import { sfRunSourceFence } from "../ai/run-store.ts"
import { mapSfEvidenceInOrder } from "./evidence-order.ts"
import type { SfAtlasReadObservation } from "./atlas-recall-scope.ts"

type AtlasPartition = { events: Parameters<typeof createSfAtlasDurableMemory>[0]["events"]; envelopes: Record<string, BusinessMemoryEnvelope>; originals: Record<string, { ref: BusinessEvidenceRef; projection: NonNullable<Awaited<ReturnType<BusinessContextService["resolve"]>>["authorizedProjection"]> }>; captureDigests: Record<string, Record<string, string>> }

type RecallOwner = { call: TrustedDomainContext; current: () => boolean; records: Set<readonly unknown[]> }

type RecallObservation = {
  owner?: RecallOwner
  call: TrustedDomainContext; stable: () => boolean; recordsDigest: string; sourceState: string; sourceFence: string
  complete: (observations: readonly { records: readonly unknown[]; observed?: RecallObservation }[], call: TrustedDomainContext) => Promise<boolean>
}
const recallObservations = new WeakMap<readonly unknown[], RecallObservation>()
const recallOwner = new AsyncLocalStorage<RecallOwner>()
const activeRecallOwners = new WeakMap<TrustedDomainContext, RecallOwner>()

function recallOwnerCurrent(call: TrustedDomainContext, owner: RecallOwner | undefined) {
  if (recallOwner.getStore() !== owner || activeRecallOwners.get(call) !== owner) return false
  try { return !owner || (owner.call === call && owner.current()) }
  catch { return false }
}

/** Keep rank witnesses private to the live case observation that requested them. */
export async function withSfAtlasRecallObservation<Value>(call: TrustedDomainContext, current: () => boolean,
  work: () => Promise<Value | undefined>): Promise<Value | undefined> {
  if (recallOwner.getStore() || activeRecallOwners.has(call) || !current()) return undefined
  const owner: RecallOwner = { call, current, records: new Set() }
  activeRecallOwners.set(call, owner)
  try {
    return await recallOwner.run(owner, async () => {
      const result = await work()
      return recallOwnerCurrent(call, owner) ? result : undefined
    })
  } finally {
    activeRecallOwners.delete(call)
    for (const records of owner.records) recallObservations.delete(records)
    owner.records.clear()
  }
}

function rememberRecallObservation(records: readonly unknown[], observation: RecallObservation) {
  observation.owner?.records.add(records)
  recallObservations.set(records, observation)
}

/** Consume private canonical observations and reopen one C08 scope for the
 * complete result. Fabricated arrays, mixed readers and reused observations deny. */
export async function revalidateSfAtlasRecall(groups: readonly (readonly unknown[])[], call: TrustedDomainContext) {
  const selected = [...groups]
  const stable = () => groups.length === selected.length && selected.every((records, index) => groups[index] === records)
  const observations = selected.map((records) => ({ records, observed: recallObservations.get(records) }))
  const owner = recallOwner.getStore()
  // A caller outside an observation cannot claim or consume its witnesses.
  if (!recallOwnerCurrent(call, owner) || observations.some(({ observed }) => observed && observed.owner !== owner)) return false
  selected.forEach((records) => recallObservations.delete(records))
  const first = observations[0]?.observed
  if (!first || !stable() || new Set(selected).size !== selected.length || observations.some(({ observed }) => observed?.complete !== first.complete || observed.call !== call)) return false
  try { return await first.complete(observations, call) && stable() } catch { return false }
}

/** Canonical readers copy results so callers cannot mutate a protected root.
 * Rank revalidates the records array it received. An external structuredClone
 * still has no observation and must deny; only this copy keeps the tagged array. */
export function cloneSfAtlasRecallResult<T>(value: T): T {
  const clone = structuredClone(value)
  const records = recallRecords(value)
  if (!records || !recallObservations.has(records) || !clone || typeof clone !== "object") return clone
  return Object.assign(clone, { records })
}

/** Keep canonical bytes private while renewing only their consumed observation.
 * Every renewal reopens the original reader's protected C08/authority boundary;
 * it issues a new records array and never resurrects the consumed array's tag. */
export function retainSfAtlasRecallResult<T>(value: T, call: TrustedDomainContext) {
  const records = recallRecords(value), observed = records && recallObservations.get(records)
  if (!records || !observed || observed.call !== call || !observed.stable() ||
    observed.recordsDigest !== digestSfValue(records)) return undefined
  const retained = structuredClone(value), fingerprint = digestSfValue(value)
  let current = { value, records, observed }
  let busy = false
  return async (): Promise<T | undefined> => {
    if (busy) return undefined
    const previous = current
    const stable = () => previous.observed.call === call && previous.observed.stable() &&
      recallRecords(previous.value) === previous.records && digestSfValue(previous.value) === fingerprint &&
      previous.observed.recordsDigest === digestSfValue(previous.records)
    if (!stable()) return undefined
    if (recallObservations.get(previous.records) === previous.observed) return cloneSfAtlasRecallResult(previous.value)
    // Claim before awaiting so two cache readers cannot share a renewal.
    busy = true
    try {
      if (!await previous.observed.complete([{ records: previous.records, observed: previous.observed }], call) || !stable()) return undefined
      const renewed = structuredClone(retained), next = recallRecords(renewed)
      if (!next || digestSfValue(renewed) !== fingerprint) return undefined
      const observation: RecallObservation = { ...previous.observed, stable, recordsDigest: digestSfValue(next) }
      rememberRecallObservation(next, observation)
      current = { value: renewed, records: next, observed: observation }
      return cloneSfAtlasRecallResult(renewed)
    } catch { return undefined }
    finally { busy = false }
  }
}

function recallRecords(value: unknown): readonly unknown[] | undefined {
  if (!value || typeof value !== "object" || !("records" in value)) return undefined
  return Array.isArray(value.records) ? value.records : undefined
}

/** Bind the record and scanner identity to the durable publication receipt,
 * without substituting the currently installed scanner for its historical one. */
export function sfAtlasPublicationMatches(envelope: BusinessMemoryEnvelope, record: MemoryRecord, outbox: Readonly<Record<string, SfAtlasOutboxEntry>>) {
  const ref = envelope.caseRef
  const item = ref && outbox[JSON.stringify([ref.id, ref.incarnation, envelope.sourceEventId])]
  if (!item || item.state !== "settled") return false
  const receipt = item.receipt
  const scanner = envelope.scannerReceipt
  return (receipt.status === "committed" || receipt.status === "already-committed") &&
    receipt.sourceEventId === envelope.sourceEventId && receipt.eventId === envelope.eventId &&
    receipt.recordDigest === digestSfValue(record) && !!scanner && scanner.status === "clean" &&
    !!scanner.name?.trim() && !!scanner.version?.trim() && scanner.digest === receipt.recordDigest &&
    receipt.scanner.status === "clean" && receipt.scanner.name === scanner.name && receipt.scanner.version === scanner.version
}

/** C09 remains authoritative. This writer only projects an authenticated outbox event. */
export function createSfAtlasMemory(input: {
  state: SfProductStatePort
  cases: DecisionCasePort
  authorizeCase?: (value: DecisionCase, call: TrustedDomainContext) => Promise<boolean>
  host: Pick<DomainPortHost, "requestFor" | "revalidate" | "persistence">
  evidence: Pick<BusinessContextService, "resolve">
  proveContinuity: (original: BusinessEvidenceRef, current: BusinessEvidenceRef, call: TrustedDomainContext) => Promise<boolean>
  scanner: NamedScanner
  scannerVersion: string
  /** Applied only after a durable settled receipt was selected; never around an append. */
  observeRecovery?: SfAtlasReadObservation
  now: () => string
}) {
  const lockedSourceFence = () => {
    const snapshots = input.host.persistence.currentSnapshots?.()
    return snapshots ? digestSfValue({ dashboard: sfRunSourceFence(snapshots.dashboard),
      planner: sfRunSourceFence(snapshots.planner), procurement: sfRunSourceFence(snapshots.procurement) }) : undefined
  }

  // The callback identity binds all observations to this exact reader/store.
  const completeRecall: RecallObservation["complete"] = async (observations, call) => {
    const request = input.host.requestFor(call)
    const binding = digestSfValue([call.kind, call.binding])
    const lease = call.lease
    const headers = request && digestSfValue([...request.headers.entries()])
    const stable = () => !!request && !request.signal.aborted && input.host.requestFor(call) === request && call.lease === lease &&
      binding === digestSfValue([call.kind, call.binding]) && headers === digestSfValue([...request.headers.entries()]) &&
      observations.every(({ records, observed }) => observed?.call === call && observed.complete === completeRecall &&
        observed.stable() && observed.recordsDigest === digestSfValue(records))
    if (!request || !stable()) return false
    const final = await input.state.read(request, "atlas", async (state) => {
      if (!stable() || !await input.host.revalidate(call) || !stable()) return undefined
      return { sourceState: digestSfValue(state), sourceFence: lockedSourceFence() }
    }).catch(() => undefined)
    return !!final && final.status === "ok" && !!final.value?.sourceFence && stable() && observations.every(({ observed }) =>
      observed?.sourceState === final.value!.sourceState && observed?.sourceFence === final.value!.sourceFence)
  }

  async function readOriginalCapture(caseRef: { id: string; incarnation: string }, digest: string, call: TrustedDomainContext): Promise<AtlasPartition["originals"][string] | undefined> {
    const selected = structuredClone(caseRef)
    const lease = call.lease
    const binding = digestSfValue([call.kind, call.binding])
    const request = input.host.requestFor(call)
    const headers = request && digestSfValue([...request.headers.entries()])
    const stable = () => !!request && !request.signal.aborted && input.host.requestFor(call) === request && call.lease === lease &&
      binding === digestSfValue([call.kind, call.binding]) && headers === digestSfValue([...request.headers.entries()]) &&
      digestSfValue(caseRef) === digestSfValue(selected)
    if (!request || !stable() || !/^[a-f0-9]{64}$/.test(digest) || !await input.host.revalidate(call) || !stable()) return undefined
    // A continuity proof must not recursively resolve the same sources through cases.read.
    const readCase = async () => {
      const found = await input.state.read(request, "cases", (state, actor) => {
        const value = state.cases[selected.id]
        return value && value.incarnation === selected.incarnation && value.participants.includes(actor.principalRef) &&
          actor.principalRef === call.binding.principalRef && actor.accessRevision === call.binding.accessRevision && actor.policyVersion === call.binding.policyVersion &&
          (call.kind !== "native" || call.binding.caseId === value.id && call.binding.caseIncarnation === value.incarnation && call.binding.caseVersion === value.version) ? value : undefined
      }).catch(() => undefined)
      if (!found || found.status !== "ok" || !found.value || !stable()) return undefined
      const identity = digestSfValue(found.value)
      const allowed = input.authorizeCase ? await input.authorizeCase(found.value, call) :
        (await input.cases.read({ caseRef: encodeCaseRef(selected) }, call)).status === "ok"
      return allowed && stable() && identity === digestSfValue(found.value) && await input.host.revalidate(call) &&
        stable() && identity === digestSfValue(found.value) ? found.value : undefined
    }
    const current = await readCase()
    if (!current || !stable()) return undefined
    const currentIdentity = digestSfValue(current)
    const context: AuthorizedCaseProjection["context"] = call.kind === "ui" ? { ...call.binding, kind: "ui" } : { ...call.binding, kind: "native" }
    const owner = deriveSfMemoryOwner(context, current)
    if (!owner) return undefined
    const result = await input.state.read(request, "atlas", (state) => {
      const partition = state.atlas[owner] as AtlasPartition | undefined
      if (!partition || !Array.isArray(partition.events) || !partition.envelopes || !partition.originals || !partition.captureDigests || createSfAtlasDurableMemory(partition).read().rejected) return undefined
      const capture = partition.originals[digest]
      if (!capture || capture.ref.refDigest !== digest || digestSfEvidenceRef(capture.ref) !== digest) return undefined
      const log = createSfAtlasDurableMemory(partition).read().log
      const linked = Object.values(partition.envelopes).some((envelope) => {
        const event = log.get(envelope.eventId as Parameters<typeof log.get>[0])
        const record = event?.payload as MemoryRecord | undefined
        const boundCase = envelope.caseRef
        if (!record || !boundCase || record.owner !== owner || record.kind !== envelope.kind || envelope.owner !== owner || boundCase.id !== selected.id || boundCase.incarnation !== selected.incarnation || partition.captureDigests[envelope.eventId]?.[digest] !== digestSfValue(capture) ||
          !sfAtlasPublicationMatches(envelope, record, state.outbox)) return false
        if (![...envelope.evidenceRefs, ...envelope.dependencies].some((ref) => ref.refDigest === digest)) return false
        return envelope.projectionDigest === digestSfValue({ kind: envelope.kind, owner, entry: record.entry, sourceEventId: envelope.sourceEventId, evidenceRefs: envelope.evidenceRefs })
      })
      return linked ? structuredClone(capture) : undefined
    }).catch(() => undefined)
    if (!result || result.status !== "ok" || !stable()) return undefined
    const identity = digestSfValue(result.value)
    if (!await input.host.revalidate(call) || !stable()) return undefined
    const again = await readCase()
    if (!again || digestSfValue(again) !== currentIdentity || !await input.host.revalidate(call) || request.signal.aborted || input.host.requestFor(call) !== request ||
      !stable() || digestSfValue(current) !== currentIdentity || digestSfValue(again) !== currentIdentity || identity !== digestSfValue(result.value)) return undefined
    return result.value
  }

  /** Shared canonical reader; the selection only narrows to already captured
   * records, never skips case/source authorization or capture integrity. */
  async function readRecords(incomingCaseRef: { id: string; incarnation: string }, call: TrustedDomainContext,
    selection?: { digest?: string; eventId?: string }) {
      try {
      const caseRef = structuredClone(incomingCaseRef)
      const request = input.host.requestFor(call)
      const lease = call.lease
      const binding = digestSfValue([call.kind, call.binding])
      const headers = request && digestSfValue([...request.headers.entries()])
      const ownerScope = recallOwner.getStore()
      const observations: { value: unknown; identity: string }[] = []
      const pin = (value: unknown) => { observations.push({ value, identity: digestSfValue(value) }) }
      const stable = () => recallOwnerCurrent(call, ownerScope) && !!request && !request.signal.aborted && input.host.requestFor(call) === request && call.lease === lease &&
        binding === digestSfValue([call.kind, call.binding]) && headers === digestSfValue([...request.headers.entries()]) &&
        digestSfValue(incomingCaseRef) === digestSfValue(caseRef) && observations.every((item) => digestSfValue(item.value) === item.identity)
      const authorized = async () => stable() && await input.host.revalidate(call) && stable()
      if (!request || !await authorized()) return { status: "unavailable" as const }
      const caseBefore = await input.state.read(request, "cases", (state) => state.cases[caseRef.id]).catch(() => undefined)
      if (!caseBefore || caseBefore.status !== "ok" || !caseBefore.value || !stable()) return { status: "unavailable" as const }
      pin(caseBefore.value)
      const found = await input.cases.read({ caseRef: encodeCaseRef(caseRef) }, call)
      if (found.status !== "ok" || !stable()) return { status: "unavailable" as const }
      pin(found.value)
      const owner = deriveSfMemoryOwner(found.value.context, found.value.case)
      if (!owner) return { status: "unavailable" as const }
      const outbox = await input.state.read(request, "outbox", (state) => ({ items: state.outbox, version: state.versions.outbox, pending: !selection && Object.values(state.outbox).some((item) => item.state === "pending" && item.eventRef.target.caseId === caseRef.id && item.eventRef.target.caseIncarnation === caseRef.incarnation) })).catch(() => undefined)
      if (!outbox || outbox.status !== "ok" || outbox.value.pending || !stable()) return { status: "unavailable" as const }
      pin(outbox.value)
      const snapshot = await input.state.read(request, "atlas", (state) => state.atlas[owner]).catch(() => undefined)
      if (!snapshot || snapshot.status !== "ok" || !stable()) return { status: "unavailable" as const }
      pin(snapshot.value)
      if (snapshot.value === undefined) {
        if (selection) return { status: "unavailable" as const }
        const current = await input.cases.read({ caseRef: encodeCaseRef(caseRef) }, call)
        if (current.status !== "ok" || digestSfValue(current.value.case) !== digestSfValue(found.value.case) || !stable()) return { status: "unavailable" as const }
        const latest = await input.state.read(request, "atlas", async (state) => {
          if (!await authorized()) return undefined
          return { partition: state.atlas[owner], outboxVersion: state.versions.outbox, case: state.cases[caseRef.id],
            sourceState: digestSfValue(state), sourceFence: lockedSourceFence() }
        }).catch(() => undefined)
        if (!latest || latest.status !== "ok" || !latest.value?.sourceFence || latest.value.partition !== undefined ||
          latest.value.outboxVersion !== outbox.value.version || digestSfValue(latest.value.case) !== digestSfValue(caseBefore.value) || !stable())
          return { status: "unavailable" as const }
        const records: never[] = []
        rememberRecallObservation(records, { owner: ownerScope, call, stable, complete: completeRecall, recordsDigest: digestSfValue(records),
          sourceState: latest.value.sourceState, sourceFence: latest.value.sourceFence })
        return { status: "ok" as const, records }
      }
      const partition = snapshot.value as AtlasPartition
      if (!partition || !Array.isArray(partition.events) || !partition.envelopes || !partition.originals || !partition.captureDigests) return { status: "unavailable" as const }
      const loaded = createSfAtlasDurableMemory(partition).read()
      if (loaded.rejected) return { status: "unavailable" as const }
      const approved = []
      for (const [id, event] of loaded.log) {
        const record = event.payload as MemoryRecord
        const envelope = partition.envelopes[id]
        const boundCase = envelope?.caseRef
        if (!envelope || !boundCase || envelope.eventId !== id || envelope.owner !== owner || record.owner !== owner || envelope.kind !== "task" || record.kind !== "task" || boundCase.id !== caseRef.id || boundCase.incarnation !== caseRef.incarnation || boundCase.version > found.value.case.version) return { status: "unavailable" as const }
        if (envelope.projectionDigest !== digestSfValue({ kind: "task", owner, entry: record.entry, sourceEventId: envelope.sourceEventId, evidenceRefs: envelope.evidenceRefs }) ||
          !sfAtlasPublicationMatches(envelope, record, outbox.value.items)) return { status: "unavailable" as const }
        const bundleRef = envelope.evidenceRefs.find((ref) => ref.kind === "case-event" && ref.target.eventId === envelope.sourceEventId)
        const mapped = bundleRef && mapSfAtlasEntry({ kind: "task", projection: found.value, eventId: envelope.sourceEventId, bundleRef })
        if (!mapped || mapped.status !== "mapped" || mapped.projection.kind !== "task" ||
          mapped.projection.owner !== owner || mapped.projection.projectionDigest !== envelope.projectionDigest ||
          digestSfValue(mapped.projection.entry) !== digestSfValue(record.entry)) return { status: "unavailable" as const }
        // A settled event/original remains readable while a later projection is
        // pending. Public recall keeps its existing whole-outbox readiness gate.
        if (selection && (selection.eventId ? id !== selection.eventId :
          ![...envelope.evidenceRefs, ...envelope.dependencies].some((ref) => ref.refDigest === selection.digest))) continue
        const originals = [...envelope.evidenceRefs, ...envelope.dependencies]
        try {
          const maps = sfEvidenceSourceMaps(originals)
          if (digestSfValue(maps.sourceVersions) !== digestSfValue(envelope.sourceVersions) || digestSfValue(maps.sourceIncarnations) !== digestSfValue(envelope.sourceIncarnations)) return { status: "unavailable" as const }
        } catch { return { status: "unavailable" as const } }
        const refs = [...new Map(originals.flatMap(expandEvidence).map((ref) => [ref.refDigest, ref])).values()]
        const resolutions = await mapSfEvidenceInOrder(refs, (ref) => input.evidence.resolve(ref, call))
        if (!stable()) return { status: "unavailable" as const }
        pin(resolutions)
        for (const [index, resolution] of resolutions.entries()) {
          const ref = refs[index]!
          const capture = partition.originals[ref.refDigest]
          if ((resolution.state !== "fresh" && resolution.state !== "historical") || resolution.accessRevision !== call.binding.accessRevision || digestSfValue(resolution.ref) !== digestSfValue(ref) || !resolution.currentRef || !resolution.authorizedProjection || !capture || digestSfValue(capture.ref) !== digestSfValue(ref) || partition.captureDigests[id]?.[ref.refDigest] !== digestSfValue(capture) || (resolution.state === "historical" && (resolution.differences === undefined || digestSfValue(resolution.authorizedProjection) !== digestSfValue(capture.projection))) || !await input.proveContinuity(ref, resolution.currentRef, call) || !stable()) return { status: "unavailable" as const }
        }
        if (!("taskId" in record.entry) || typeof record.entry.ref !== "string" || !record.entry.ref.trim()) return { status: "unavailable" as const }
        approved.push({ id, event, envelope, resolutions, entry: { ...record.entry, ref: record.entry.ref } })
      }
      if (selection && !approved.length || !await authorized()) return { status: "unavailable" as const }
      // Persisted physical journal has already passed strict owner verification.
      // Renumber only this ephemeral authorized read subset; C08 stays untouched.
      const filtered = createSfAtlasDurableMemory({ events: approved.map((item, index) => [item.id, { ...item.event, seq: index + 1 }]) })
      const recalled = createMemoryRead({ store: filtered, actor: owner }).recall({ kind: "task", owner })
      const records = approved.flatMap((item) => recalled.some((record) => digestSfValue(record) === digestSfValue(item.event.payload)) ? [{ envelope: item.envelope, entry: item.entry, resolutions: item.resolutions, case: found.value, recordDigest: digestSfValue(item.event.payload) }] : [])
      const current = await input.cases.read({ caseRef: encodeCaseRef(caseRef) }, call)
      if (current.status !== "ok" || digestSfValue(current.value.case) !== digestSfValue(found.value.case) || !await authorized()) return { status: "unavailable" as const }
      pin(records)
      // Source readers may issue metadata. Fence their completed observations,
      // then check the final source round and case against the same C08 state.
      const before = await input.state.read(request, "atlas", (state) => ({
        partition: state.atlas[owner], outboxVersion: state.versions.outbox, case: state.cases[caseRef.id],
        sourceState: digestSfValue(state), sourceFence: lockedSourceFence(),
      })).catch(() => undefined)
      if (!before || before.status !== "ok" || !before.value.sourceFence || !stable() ||
        before.value.outboxVersion !== outbox.value.version || digestSfValue(before.value.partition) !== digestSfValue(snapshot.value) ||
        digestSfValue(before.value.case) !== digestSfValue(caseBefore.value)) return { status: "unavailable" as const }
      pin(before.value)
      for (const record of records) {
        for (const resolution of record.resolutions) {
          const again = await input.evidence.resolve(resolution.ref, call)
          pin(again)
          if (!stable() || again.accessRevision !== resolution.accessRevision || digestSfValue(again.ref) !== digestSfValue(resolution.ref) || again.state !== resolution.state || !again.currentRef || !again.authorizedProjection || digestSfValue(again.currentRef) !== digestSfValue(resolution.currentRef) || digestSfValue(projectionForComparison(again)) !== digestSfValue(projectionForComparison(resolution)) || (again.state === "historical" && (again.differences === undefined || digestSfValue(again.differences) !== digestSfValue(resolution.differences))) || !await input.proveContinuity(resolution.ref, again.currentRef, call) || !stable()) return { status: "unavailable" as const }
        }
      }
      const latest = await input.state.read(request, "atlas", async (state) => {
        // No authority await may reopen a race after this protected read.
        if (!await authorized()) return undefined
        return { partition: state.atlas[owner], outboxVersion: state.versions.outbox, case: state.cases[caseRef.id],
          sourceState: digestSfValue(state), sourceFence: lockedSourceFence() }
      }).catch(() => undefined)
      if (!latest || latest.status !== "ok" || !latest.value || !stable() ||
        digestSfValue(latest.value) !== digestSfValue(before.value)) return { status: "unavailable" as const }
      rememberRecallObservation(records, { owner: ownerScope, call, stable, complete: completeRecall, recordsDigest: digestSfValue(records),
        sourceState: before.value.sourceState, sourceFence: before.value.sourceFence })
      return { status: "ok" as const, records }
      } catch { return { status: "unavailable" as const } }
  }

  return {
    async emitFromLedger(incoming: BusinessEvidenceRef, call: TrustedDomainContext): Promise<MemoryWriteReceipt> {
      const ref = structuredClone(incoming)
      const lease = call.lease
      const binding = digestSfValue([call.kind, call.binding])
      const request = input.host.requestFor(call)
      const headers = request && digestSfValue([...request.headers.entries()])
      const observations: { value: unknown; identity: string }[] = []
      const pin = (value: unknown) => { observations.push({ value, identity: digestSfValue(value) }) }
      const stable = () => !!request && !request.signal.aborted && input.host.requestFor(call) === request && call.lease === lease &&
        binding === digestSfValue([call.kind, call.binding]) && headers === digestSfValue([...request.headers.entries()]) &&
        digestSfValue(incoming) === digestSfValue(ref) && observations.every((item) => digestSfValue(item.value) === item.identity)
      const authorized = async () => stable() && await input.host.revalidate(call) && stable()
      const unavailable = (reason: string): MemoryWriteReceipt => ({ status: "unavailable", sourceEventId: ref.kind === "case-event" ? ref.target.eventId : "", scanner: { name: input.scanner.name, version: input.scannerVersion, status: "unavailable" }, reason })
      if (ref.kind !== "case-event" || ref.installationId !== call.binding.installationId || ref.projectId !== call.binding.projectId || !request || request.signal.aborted || !await authorized()) return unavailable("authority-unavailable")
      try { sfEvidenceSourceMaps([ref]) } catch { return unavailable("invalid-evidence") }
      const access = await input.state.read(request, "cases", (state, actor) => {
        const value = state.cases[ref.target.caseId]
        return value && value.incarnation === ref.target.caseIncarnation && value.participants.includes(actor.principalRef) &&
          actor.principalRef === call.binding.principalRef && actor.accessRevision === call.binding.accessRevision && actor.policyVersion === call.binding.policyVersion &&
          (call.kind !== "native" || call.binding.caseId === value.id && call.binding.caseIncarnation === value.incarnation && call.binding.caseVersion === value.version) ? value : undefined
      }).catch(() => undefined)
      if (!access || access.status !== "ok" || !access.value || !stable()) return unavailable("authority-unavailable")
      pin(access.value)
      const permitted = input.authorizeCase ? await input.authorizeCase(access.value, call) :
        (await input.cases.read({ caseRef: encodeCaseRef({ id: ref.target.caseId, incarnation: ref.target.caseIncarnation }) }, call)).status === "ok"
      if (!permitted || !await authorized()) return unavailable("authority-unavailable")
      const key = JSON.stringify([ref.target.caseId, ref.target.caseIncarnation, ref.target.eventId])
      const captured = await input.state.read(request, "atlas", (state) => ({ versions: state.versions, item: state.outbox[key] })).catch(() => undefined)
      const confirmed = await input.state.read(request, "cases", (state) => state.cases[ref.target.caseId]).catch(() => undefined)
      if (!confirmed || confirmed.status !== "ok" || !confirmed.value || digestSfValue(confirmed.value) !== digestSfValue(access.value) ||
        (input.authorizeCase && !await input.authorizeCase(confirmed.value, call)) || !await authorized()) return unavailable("authority-unavailable")
      if (!captured || captured.status !== "ok" || !captured.value.item || !stable()) return unavailable("outbox-unavailable")
      pin(captured.value)
      pin(confirmed.value)
      if (digestSfValue(captured.value.item.eventRef) !== digestSfValue(ref)) return { ...unavailable("idempotency-content-changed"), status: "conflict" }
      // A durable receipt is a recovery result, not a second append. Reauthorize it without rerunning the scanner.
      if (captured.value.item.state === "settled") {
        const receipt = captured.value.item.receipt
        const recover = async (): Promise<MemoryWriteReceipt> => {
          const replay = await input.state.read(request, "outbox", (state, actor) => {
            const value = state.cases[ref.target.caseId]
            const events = value?.ledger.filter((item) => item.id === ref.target.eventId)
            const event = events?.length === 1 ? events[0] : undefined
            return value && value.incarnation === ref.target.caseIncarnation && value.participants.includes(actor.principalRef) &&
              (call.kind !== "native" || call.binding.caseId === value.id && call.binding.caseIncarnation === value.incarnation && call.binding.caseVersion === value.version) &&
              actor.principalRef === call.binding.principalRef && actor.accessRevision === call.binding.accessRevision && actor.policyVersion === call.binding.policyVersion &&
              event && event.caseRef.id === ref.target.caseId && event.caseRef.incarnation === ref.target.caseIncarnation && event.caseRef.version === ref.target.caseVersion &&
              event.outputDigest === ref.target.outputDigest && digestSfValue(event.evidenceRefs) === digestSfValue(ref.target.evidenceRefs)
              ? { item: state.outbox[key], value } : undefined
          }).catch(() => undefined)
          if (!replay || replay.status !== "ok" || !replay.value || digestSfValue(replay.value.item) !== digestSfValue(captured.value.item)) return unavailable("outbox-unavailable")
          if (!stable()) return unavailable("authority-unavailable")
          pin(replay.value)
          const selected = { id: ref.target.caseId, incarnation: ref.target.caseIncarnation }
          // A lightweight membership ACL cannot authorize an old receipt's sources.
          // Reopen the complete case even when authorizeCase was supplied.
          const readable = await input.cases.read({ caseRef: encodeCaseRef(selected) }, call)
          if (readable.status !== "ok" || !stable()) return unavailable("case-unavailable")
          pin(readable.value)
          const committed = receipt.status === "committed" || receipt.status === "already-committed"
          const owner = committed ? deriveSfMemoryOwner(readable.value.context, readable.value.case) : undefined
          if (committed && !owner) return unavailable("capture-unavailable")
          const atlas = owner ? await input.state.read(request, "atlas", (state) => ({
            partition: state.atlas[owner], outboxVersion: state.versions.outbox,
          })).catch(() => undefined) : undefined
          if (!stable() || committed && (!atlas || atlas.status !== "ok" || !atlas.value.partition)) return unavailable("capture-unavailable")
          if (atlas?.status === "ok") pin(atlas.value)
          const records = committed ? await readRecords(selected, call, { eventId: receipt.eventId }) : undefined
          if (!stable() || committed && (!receipt.eventId || records?.status !== "ok" ||
            records.records.length !== 1 || records.records[0]?.recordDigest !== receipt.recordDigest ||
            records.records[0]?.envelope.sourceEventId !== ref.target.eventId ||
            !records.records[0]?.envelope.evidenceRefs.some((source) => digestSfValue(source) === digestSfValue(ref))))
            return unavailable("capture-unavailable")
          if (records?.status === "ok") pin(records.records)
          const sources = records?.status === "ok" ? records.records.flatMap((record) => record.resolutions) :
            await mapSfEvidenceInOrder(expandEvidence(ref), (source) => input.evidence.resolve(source, call))
          if (!stable() || sources.some((source) => (source.state !== "fresh" && source.state !== "historical") ||
            !source.currentRef || !source.authorizedProjection || source.accessRevision !== call.binding.accessRevision ||
            source.state === "historical" && source.differences === undefined)) return unavailable("source-unavailable")
          pin(sources)
          const current = await input.state.read(request, "cases", (state) => ({
            replay: { value: state.cases[ref.target.caseId], item: state.outbox[key] },
            sourceFence: lockedSourceFence(), sourceState: digestSfValue(state),
          })).catch(() => undefined)
          if (!current || current.status !== "ok" || !stable() || !current.value.sourceFence || digestSfValue(current.value.replay) !== digestSfValue(replay.value))
            return unavailable("case-unavailable")
          pin(current.value)
          if ((input.authorizeCase && !await input.authorizeCase(current.value.replay.value!, call)) || !await authorized()) return unavailable("case-unavailable")
          const rechecked = await input.cases.read({ caseRef: encodeCaseRef(selected) }, call)
          if (rechecked.status !== "ok" || !stable() || digestSfValue(rechecked.value.case) !== digestSfValue(readable.value.case))
            return unavailable("case-unavailable")
          const sourceIdentity = (source: BusinessEvidenceResolution) => digestSfValue({ state: source.state, ref: source.ref, currentRef: source.currentRef,
            accessRevision: source.accessRevision, projection: projectionForComparison(source), differences: source.differences })
          for (const source of sources) {
            const again = await input.evidence.resolve(structuredClone(source.ref), call)
            if (!stable() || sourceIdentity(again) !== sourceIdentity(source)) return unavailable("source-unavailable")
            pin(again)
          }
          // Read-only recovery: no transaction, scanner, append or replacement
          // receipt. Keep the durable audit's bytes and final authorization fence.
          const latest = await input.state.read(request, committed ? "atlas" : "outbox", async (state) => {
            // Keep the last authority await inside C08's protected read. An await
            // after it would reopen a corruption window before receipt egress.
            if (!await authorized()) return undefined
            return { replay: { value: state.cases[ref.target.caseId], item: state.outbox[key] },
              sourceFence: lockedSourceFence(), sourceState: digestSfValue(state),
              atlas: owner ? { partition: state.atlas[owner], outboxVersion: state.versions.outbox } : undefined }
          }).catch(() => undefined)
          if (!latest || latest.status !== "ok" || !latest.value || !stable() || latest.value.sourceFence !== current.value.sourceFence ||
            latest.value.sourceState !== current.value.sourceState || digestSfValue(latest.value.replay) !== digestSfValue(replay.value) ||
            committed && (atlas?.status !== "ok" || digestSfValue(latest.value.atlas) !== digestSfValue(atlas.value))) return unavailable("case-unavailable")
          return structuredClone(receipt.status === "committed" ? { ...receipt, status: "already-committed" as const } : receipt)
        }
        if (!input.observeRecovery) return recover()
        // The settled branch retains every canonical case, record, capture and
        // source check. Only its completed calculation may be reused by this
        // lexical read; the first append and scanner are outside the observation.
        const observed = await input.observeRecovery({ id: ref.target.caseId, incarnation: ref.target.caseIncarnation }, call,
          async () => ({ status: "ok", value: await recover() }))
        return observed.status === "ok" && stable() ? observed.value : unavailable("recovery-observation-changed")
      }
      const found = await input.cases.read({ caseRef: encodeCaseRef({ id: ref.target.caseId, incarnation: ref.target.caseIncarnation }) }, call)
      if (found.status !== "ok") return unavailable("case-unavailable")
      if (!input.scannerVersion.trim() || !input.host.persistence.transactionAll || !input.host.persistence.currentSnapshots) return unavailable("scanner-or-source-fence-unavailable")
      const sourceFences = (snapshots: Record<"dashboard" | "planner" | "procurement", Parameters<typeof sfRunSourceFence>[0]>) => ({
        dashboard: sfRunSourceFence(snapshots.dashboard), planner: sfRunSourceFence(snapshots.planner), procurement: sfRunSourceFence(snapshots.procurement),
      })
      const before = await input.host.persistence.transactionAll(async (snapshots) => ({ commit: false, value: sourceFences(snapshots) }), { signal: request.signal }).catch(() => undefined)
      if (!before) return unavailable("source-fence-unavailable")
      const mapped = mapSfAtlasEntry({ kind: "task", projection: found.value, eventId: ref.target.eventId, bundleRef: ref })
      if (mapped.status !== "mapped") return unavailable("projection-unavailable")
      const dependencies = ref.target.evidenceRefs.flatMap(expandEvidence)
      const resolutions = await mapSfEvidenceInOrder(dependencies, (dependency) => input.evidence.resolve(dependency, call))
      if (!dependencies.length || resolutions.some((resolution) => resolution.state !== "fresh" || !resolution.authorizedProjection || resolution.accessRevision !== call.binding.accessRevision) || !await authorized()) return unavailable("source-unavailable")
      const maps = sfEvidenceSourceMaps(mapped.projection.evidenceRefs)
      const digest = digestSfValue({ ref, projection: mapped.projection, maps })
      if (!await authorized()) return unavailable("authority-unavailable")
      const checks = (["cases", "documents", "receipts"] as const).filter((namespace) => namespace === "cases" ||
        dependencies.some((dependency) => namespace === "documents" ? dependency.kind === "document" : dependency.kind === "receipt"))
      const saved = await input.state.transaction(request, { namespace: "atlas", expectedStorageVersion: captured.value.versions.atlas, additionalNamespaces: [{ namespace: "outbox", expectedStorageVersion: captured.value.versions.outbox }],
        checkNamespaces: checks.map((namespace) => ({ namespace, expectedStorageVersion: captured.value.versions[namespace] })), sourceFence: "all",
        idempotencyKey: `atlas:${key}`, commandDigest: digest, targetRef: encodeCaseRef({ id: ref.target.caseId, incarnation: ref.target.caseIncarnation }), targetIncarnation: ref.target.caseIncarnation }, async (state, authority) => {
        const locked = input.host.persistence.currentSnapshots?.()
        if (!locked || digestSfValue(sourceFences(locked)) !== digestSfValue(before)) return { commit: false, value: unavailable("source-changed-before-commit") }
        const item = state.outbox[key]
        const current = state.cases[ref.target.caseId]
        if (!item || item.state !== "pending" || digestSfValue(item.eventRef) !== digestSfValue(ref) || !current || current.incarnation !== ref.target.caseIncarnation || !current.ledger.some((event) => event.id === ref.target.eventId && digestSfValue(event) === digestSfValue(found.value.events.find((candidate) => candidate.id === event.id))) || authority.principalRef !== call.binding.principalRef || authority.accessRevision !== call.binding.accessRevision || authority.policyVersion !== call.binding.policyVersion) return { commit: false, value: unavailable("stale-authority-or-ledger") }
        const existing = state.atlas[mapped.projection.owner]
        const partition: AtlasPartition = existing === undefined ? { events: [], envelopes: {}, originals: {}, captureDigests: {} } : existing as AtlasPartition
        if (!partition || !Array.isArray(partition.events) || !partition.envelopes || !partition.originals || !partition.captureDigests) return { commit: false, value: unavailable("atlas-partition-invalid") }
        const durable = createSfAtlasDurableMemory(partition)
        if (durable.read().rejected) return { commit: false, value: unavailable("atlas-partition-invalid") }
        const verdict = createMemoryEmit({ store: durable, actor: mapped.projection.owner, scanner: input.scanner }).emit(mapped.projection.entry)
        if (!verdict.ok) {
          if (verdict.refusal === "scanner-blocked") {
            const receipt: MemoryWriteReceipt = { status: "refused", sourceEventId: ref.target.eventId, scanner: { name: input.scanner.name, version: input.scannerVersion, status: "hit" }, reason: "scanner-blocked" }
            state.outbox[key] = { ...item, state: "settled", receipt }
            return { commit: true, value: receipt }
          }
          return { commit: false, value: unavailable(verdict.refusal) }
        }
        const record: MemoryRecord = verdict.record
        const [event] = versioned([record]).values()
        if (!event) return { commit: false, value: unavailable("atlas-event-unavailable") }
        const envelope: BusinessMemoryEnvelope = { schemaVersion: 1, eventId: event.id, owner: mapped.projection.owner, kind: "task", caseRef: { id: ref.target.caseId, incarnation: ref.target.caseIncarnation, version: found.value.case.version }, sourceEventId: ref.target.eventId, evidenceRefs: mapped.projection.evidenceRefs, dependencies, ...maps, projectionDigest: mapped.projection.projectionDigest, writerPrincipalRef: authority.principalRef, accessRevision: authority.accessRevision, scannerReceipt: { name: input.scanner.name, version: input.scannerVersion, status: "clean", digest: digestSfValue(record) }, createdAt: input.now() }
        partition.envelopes[event.id] = envelope
        const originalEvent = found.value.events.find((candidate) => candidate.id === ref.target.eventId)
        if (!originalEvent) return { commit: false, value: unavailable("source-event-unavailable") }
        const captures = [{ ref, projection: originalEvent }, ...resolutions.flatMap((resolution) => resolution.authorizedProjection ? [{ ref: resolution.ref, projection: resolution.authorizedProjection }] : [])]
        if (captures.some((capture) => partition.originals[capture.ref.refDigest] && digestSfValue(partition.originals[capture.ref.refDigest]) !== digestSfValue(capture))) return { commit: false, value: unavailable("historical-snapshot-conflict") }
        const captureDigests = Object.fromEntries(captures.map((capture) => [capture.ref.refDigest, digestSfValue(capture)]))
        if (partition.captureDigests[event.id] && digestSfValue(partition.captureDigests[event.id]) !== digestSfValue(captureDigests)) return { commit: false, value: unavailable("historical-snapshot-conflict") }
        captures.forEach((capture) => { partition.originals[capture.ref.refDigest] = capture })
        partition.captureDigests[event.id] = captureDigests
        const receipt: MemoryWriteReceipt = { status: "committed", sourceEventId: ref.target.eventId, eventId: event.id, recordDigest: digestSfValue(record), committedRevision: state.revision + 1, scanner: { name: input.scanner.name, version: input.scannerVersion, status: "clean" } }
        state.atlas[mapped.projection.owner] = partition
        state.outbox[key] = { ...item, state: "settled", receipt }
        return { commit: true, value: receipt }
      }).catch(() => undefined)
      if (!saved) return unavailable("commit-unavailable")
      if (saved.status === "preview") return saved.value
      if ("reason" in saved) return unavailable(saved.reason)
      if (!await authorized()) return unavailable("authority-unavailable")
      return saved.value
    },
    /** A scoped Atlas read: authenticate and resolve every dependency before constructing the recall store. */
    recall: (caseRef: { id: string; incarnation: string }, call: TrustedDomainContext) => readRecords(caseRef, call),
    /** Host-only original egress verifies every source of its linked records. */
    readOriginalRecords: (caseRef: { id: string; incarnation: string }, digest: string, call: TrustedDomainContext) =>
      /^[a-f0-9]{64}$/.test(digest) ? readRecords(caseRef, call, { digest }) : Promise.resolve({ status: "unavailable" as const }),
    /** Private callback for a continuity proof, scoped to an already-authorized case. */
    async readOriginal(caseRef: { id: string; incarnation: string }, digest: string, call: TrustedDomainContext): Promise<BusinessEvidenceRef | undefined> {
      return (await readOriginalCapture(caseRef, digest, call))?.ref
    },
    /** The immutable projection stays paired with the verified Atlas capture. Current ACL is checked independently. */
    readOriginalCapture,
  }
}

function expandEvidence(ref: BusinessEvidenceRef): BusinessEvidenceRef[] {
  if (ref.kind === "calculation") return [ref, ...ref.target.sourceRefs.flatMap(expandEvidence)]
  if (ref.kind === "case-event") return [ref, ...ref.target.evidenceRefs.flatMap(expandEvidence)]
  return [ref]
}

type AtlasRecallRecord = Extract<Awaited<ReturnType<ReturnType<typeof createSfAtlasMemory>["recall"]>>, { status: "ok" }>["records"][number]

/** Only fresh DomainProjection observation metadata is volatile; captures and historical projections stay exact. */
function projectionForComparison(resolution: BusinessEvidenceResolution) {
  const projection = resolution.authorizedProjection
  if (resolution.state !== "fresh" || !projection || !("values" in projection)) return projection
  const sourceIdentity = (reference: SourceRef) => ({ ...reference, observedAt: "" })
  return { ...projection,
    context: { ...projection.context, sourceRefs: projection.context.sourceRefs.map(sourceIdentity) },
    components: projection.components.map((component) => ({ ...component, sourceRefs: component.sourceRefs.map(sourceIdentity) })),
  }
}

/** Observation timestamps may advance; every field that determines authority, meaning or output must agree. */
function recallRecordFingerprint(record: { envelope: BusinessMemoryEnvelope; entry: SfAtlasProjection["entry"]; case: AuthorizedCaseProjection; resolutions: readonly BusinessEvidenceResolution[]; recordDigest: string }) {
  return digestSfValue({ envelope: record.envelope, entry: record.entry, recordDigest: record.recordDigest,
    case: Object.fromEntries(Object.entries(record.case).filter(([key]) => key !== "checkedAt")),
    resolutions: record.resolutions.map((resolution) => Object.fromEntries(Object.entries(resolution.authorizedProjection
      ? { ...resolution, authorizedProjection: projectionForComparison(resolution) } : resolution).filter(([key]) => key !== "checkedAt"))) })
}

/** Rank only records obtained from the protected reader, with S4's before/egress proofs. */
export async function rankSfAtlasRecall(input: {
  memory: ReturnType<typeof createSfAtlasMemory>
  caseRefs: readonly { id: string; incarnation: string }[]
  features: RecallFeatures
  featuresForCase: (value: AuthorizedCaseProjection, call: TrustedDomainContext) => Promise<RecallFeatures | undefined>
  runtimeVersions: Pick<RecallScope, "boundaryVersion" | "schemaVersion" | "manifestVersion" | "skillVersion">
  call: TrustedDomainContext
  proveContinuity: (original: BusinessEvidenceRef, current: BusinessEvidenceRef, call: TrustedDomainContext) => Promise<boolean>
  revalidate: (call: TrustedDomainContext) => Promise<boolean>
}) {
  try {
    const call = input.call, lease = call.lease
    const selection = () => digestSfValue({ caseRefs: input.caseRefs, features: input.features,
      runtimeVersions: input.runtimeVersions, kind: call.kind, binding: call.binding })
    const selectionDigest = selection()
    const stable = () => input.call === call && call.lease === lease && selection() === selectionDigest
    const candidates: AuthorizedMemoryProjection[] = []
    const observations = new Map<string, { records: readonly AtlasRecallRecord[]; fingerprint: string }>()
    const completionGroups = new Map<string, readonly AtlasRecallRecord[]>()
    const egress = new Set<AuthorizedMemoryProjection>()
    const sourceVersions: Record<string, number> = {}
    const sourceIncarnations: Record<string, string> = {}
    for (const caseRef of input.caseRefs) {
      const read = await input.memory.recall(caseRef, input.call)
      if (read.status !== "ok") return { status: "unavailable" as const }
      const key = JSON.stringify([caseRef.id, caseRef.incarnation])
      if (observations.has(key)) return { status: "unavailable" as const }
      observations.set(key, { records: read.records, fingerprint: digestSfValue(read.records.map(recallRecordFingerprint)) })
      completionGroups.set(key, read.records)
      for (const record of read.records) {
        const features = await input.featuresForCase(record.case, input.call)
        if (!features) return { status: "unavailable" as const }
        for (const resolution of record.resolutions) {
          if (!resolution.currentRef) return { status: "unavailable" as const }
          const current = sfEvidenceSourceMaps([resolution.currentRef])
          const version = current.sourceVersions[resolution.currentRef.refDigest]
          const incarnation = current.sourceIncarnations[resolution.currentRef.refDigest]
          if (version !== undefined && incarnation !== undefined) {
            const priorVersion = sourceVersions[resolution.ref.refDigest]
            const priorIncarnation = sourceIncarnations[resolution.ref.refDigest]
            if ((priorVersion !== undefined && priorVersion !== version) || (priorIncarnation !== undefined && priorIncarnation !== incarnation)) return { status: "unavailable" as const }
            sourceVersions[resolution.ref.refDigest] = version
            sourceIncarnations[resolution.ref.refDigest] = incarnation
          }
        }
        candidates.push({ envelope: record.envelope, entry: record.entry as SfAtlasProjection["entry"], case: record.case, features, resolutions: record.resolutions, atlasTrace: { module: "@orchestra/atlas-boundary/business-memory-ports", operation: "createMemoryRead.recall", recordDigest: record.recordDigest }, accessRevision: input.call.binding.accessRevision })
      }
    }
    const scope: RecallScope = { installationId: input.call.binding.installationId, projectId: input.call.binding.projectId, principalRef: input.call.binding.principalRef, accessRevision: input.call.binding.accessRevision, policyVersion: input.call.binding.policyVersion, ...input.runtimeVersions, sourceVersions, sourceIncarnations }
    const ranked = await rankSfRecalledCasesAuthorized({
      scope, features: input.features, candidates, call: input.call, proveContinuity: input.proveContinuity, revalidate: input.revalidate,
      authorizeAtlas: async (candidate, call, phase) => {
        const caseRef = candidate.envelope.caseRef
        if (!caseRef) return false
        const observed = observations.get(JSON.stringify([caseRef.id, caseRef.incarnation]))
        if (!observed || digestSfValue(observed.records.map(recallRecordFingerprint)) !== observed.fingerprint) return false
        const fingerprint = recallRecordFingerprint({ ...candidate, recordDigest: candidate.atlasTrace.recordDigest })
        if (phase === "before") return observed.records.filter((record) => recallRecordFingerprint(record) === fingerprint).length === 1
        // Keep a fresh protected read for every candidate after its intervening awaits. A later
        // candidate must detect corruption or removal of an earlier record in the same partition.
        const reread = await input.memory.recall(caseRef, call)
        if (reread.status !== "ok" || digestSfValue(reread.records.map(recallRecordFingerprint)) !== observed.fingerprint) return false
        const records = reread.records.filter((record) => recallRecordFingerprint(record) === fingerprint)
        if (records.length !== 1) return false
        egress.add(candidate)
        completionGroups.set(JSON.stringify([caseRef.id, caseRef.incarnation]), reread.records)
        return true
      },
    })
    if (ranked.status !== "ok" || candidates.some((candidate) => !egress.has(candidate)) || !stable()) return { status: "unavailable" as const }
    const records: AtlasRecallRecord[] = []
    for (const candidate of candidates) {
      const ref = candidate.envelope.caseRef
      const group = ref && completionGroups.get(JSON.stringify([ref.id, ref.incarnation]))
      const fingerprint = recallRecordFingerprint({ ...candidate, recordDigest: candidate.atlasTrace.recordDigest })
      const matches = group?.filter((record) => recallRecordFingerprint(record) === fingerprint)
      if (matches?.length !== 1) return { status: "unavailable" as const }
      records.push(matches[0]!)
    }
    const result = { status: "ok" as const, cases: ranked.cases, records }
    const resultDigest = digestSfValue(result)
    // Ranking performs continuity/authority awaits after its last per-candidate
    // read. Reopen the complete private observations once, after all of them.
    if (completionGroups.size ? !await revalidateSfAtlasRecall([...completionGroups.values()], input.call) :
      input.caseRefs.length !== 0 || !await input.revalidate(input.call)) return { status: "unavailable" as const }
    if (!stable() || resultDigest !== digestSfValue(result)) return { status: "unavailable" as const }
    return result
  } catch { return { status: "unavailable" as const } }
}
