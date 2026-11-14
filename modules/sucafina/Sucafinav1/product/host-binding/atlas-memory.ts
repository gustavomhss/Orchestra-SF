import { createMemoryEmit, createMemoryRead, versioned } from "@orchestra/atlas-boundary/business-memory-ports"
import type { MemoryRecord, NamedScanner } from "@orchestra/atlas-boundary/business-memory-ports"
import { digestSfEvidenceRef, digestSfValue, sfEvidenceSourceMaps } from "../contracts/canonical.ts"
import type { AuthorizedCaseProjection, BusinessContextService, BusinessEvidenceRef, BusinessMemoryEnvelope, MemoryWriteReceipt, SfAtlasProjection } from "../contracts/business-context.ts"
import type { DecisionCasePort, DomainPortHost } from "../contracts/ports.ts"
import type { SfProductStatePort } from "../contracts/state.ts"
import type { TrustedDomainContext } from "../contracts/sf-execution.ts"
import { encodeCaseRef } from "../decisions/case-port.ts"
import { deriveSfMemoryOwner, mapSfAtlasEntry } from "../decision-memory/atlas-projection.ts"
import { rankSfRecalledCasesAuthorized } from "../decision-memory/recall.ts"
import type { AuthorizedMemoryProjection, RecallFeatures, RecallScope } from "../decision-memory/recall.ts"
import { createSfAtlasDurableMemory } from "./atlas-store.ts"

type AtlasPartition = { events: Parameters<typeof createSfAtlasDurableMemory>[0]["events"]; envelopes: Record<string, BusinessMemoryEnvelope>; originals: Record<string, { ref: BusinessEvidenceRef; projection: NonNullable<Awaited<ReturnType<BusinessContextService["resolve"]>>["authorizedProjection"]> }>; captureDigests: Record<string, Record<string, string>> }

/** C09 remains authoritative. This writer only projects an authenticated outbox event. */
export function createSfAtlasMemory(input: {
  state: SfProductStatePort
  cases: DecisionCasePort
  host: Pick<DomainPortHost, "requestFor" | "revalidate">
  evidence: Pick<BusinessContextService, "resolve">
  proveContinuity: (original: BusinessEvidenceRef, current: BusinessEvidenceRef, call: TrustedDomainContext) => Promise<boolean>
  scanner: NamedScanner
  scannerVersion: string
  now: () => string
}) {
  return {
    async emitFromLedger(ref: BusinessEvidenceRef, call: TrustedDomainContext): Promise<MemoryWriteReceipt> {
      const unavailable = (reason: string): MemoryWriteReceipt => ({ status: "unavailable", sourceEventId: ref.kind === "case-event" ? ref.target.eventId : "", scanner: { name: input.scanner.name, version: input.scannerVersion, status: "unavailable" }, reason })
      const request = input.host.requestFor(call)
      if (ref.kind !== "case-event" || !request || request.signal.aborted || !input.scannerVersion.trim() || !await input.host.revalidate(call)) return unavailable("authority-unavailable")
      try { sfEvidenceSourceMaps([ref]) } catch { return unavailable("invalid-evidence") }
      if (ref.target.evidenceRefs.flatMap(expandEvidence).some((dependency) => dependency.kind === "case-event")) return unavailable("nested-case-event-unavailable")
      const found = await input.cases.read({ caseRef: encodeCaseRef({ id: ref.target.caseId, incarnation: ref.target.caseIncarnation }) }, call)
      if (found.status !== "ok") return unavailable("case-unavailable")
      const mapped = mapSfAtlasEntry({ kind: "task", projection: found.value, eventId: ref.target.eventId, bundleRef: ref })
      if (mapped.status !== "mapped") return unavailable("projection-unavailable")
      const dependencies = ref.target.evidenceRefs.flatMap(expandEvidence)
      const resolutions = await Promise.all(dependencies.map((dependency) => input.evidence.resolve(dependency, call)))
      if (!dependencies.length || resolutions.some((resolution) => resolution.state !== "fresh" || !resolution.authorizedProjection || resolution.accessRevision !== call.binding.accessRevision) || !await input.host.revalidate(call)) return unavailable("source-unavailable")
      const maps = sfEvidenceSourceMaps(mapped.projection.evidenceRefs)
      const key = JSON.stringify([ref.target.caseId, ref.target.caseIncarnation, ref.target.eventId])
      const atlas = await input.state.read(request, "atlas", (state) => state.versions.atlas).catch(() => undefined)
      const outbox = await input.state.read(request, "outbox", (state) => ({ version: state.versions.outbox, item: state.outbox[key] })).catch(() => undefined)
      if (!atlas || !outbox || atlas.status !== "ok" || outbox.status !== "ok" || !outbox.value.item || digestSfValue(outbox.value.item.eventRef) !== digestSfValue(ref)) return unavailable("outbox-unavailable")
      if (outbox.value.item.state === "settled") return outbox.value.item.receipt.status === "committed" ? { ...outbox.value.item.receipt, status: "already-committed" } : outbox.value.item.receipt
      const digest = digestSfValue({ ref, projection: mapped.projection, maps })
      if (!await input.host.revalidate(call)) return unavailable("authority-unavailable")
      const saved = await input.state.transaction(request, { namespace: "atlas", expectedStorageVersion: atlas.value, additionalNamespaces: [{ namespace: "outbox", expectedStorageVersion: outbox.value.version }], idempotencyKey: `atlas:${key}`, commandDigest: digest, targetRef: encodeCaseRef({ id: ref.target.caseId, incarnation: ref.target.caseIncarnation }), targetIncarnation: ref.target.caseIncarnation }, async (state, authority) => {
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
      if (saved.status === "preview") return unavailable("unexpected-state-preview")
      if ("reason" in saved) return unavailable(saved.reason)
      if (!await input.host.revalidate(call)) return unavailable("authority-unavailable")
      return saved.value
    },
    /** A scoped Atlas read: authenticate and resolve every dependency before constructing the recall store. */
    async recall(caseRef: { id: string; incarnation: string }, call: TrustedDomainContext) {
      try {
      const request = input.host.requestFor(call)
      if (!request || !await input.host.revalidate(call)) return { status: "unavailable" as const }
      const found = await input.cases.read({ caseRef: encodeCaseRef(caseRef) }, call)
      if (found.status !== "ok") return { status: "unavailable" as const }
      const owner = deriveSfMemoryOwner(found.value.context, found.value.case)
      if (!owner) return { status: "unavailable" as const }
      const outbox = await input.state.read(request, "outbox", (state) => ({ version: state.versions.outbox, pending: Object.values(state.outbox).some((item) => item.state === "pending" && item.eventRef.target.caseId === caseRef.id && item.eventRef.target.caseIncarnation === caseRef.incarnation) })).catch(() => undefined)
      if (!outbox || outbox.status !== "ok" || outbox.value.pending) return { status: "unavailable" as const }
      const snapshot = await input.state.read(request, "atlas", (state) => state.atlas[owner]).catch(() => undefined)
      if (!snapshot || snapshot.status !== "ok") return { status: "unavailable" as const }
      if (snapshot.value === undefined) {
        const latest = await input.state.read(request, "atlas", (state) => state.atlas[owner]).catch(() => undefined)
        const latestOutbox = await input.state.read(request, "outbox", (state) => state.versions.outbox).catch(() => undefined)
        const current = await input.cases.read({ caseRef: encodeCaseRef(caseRef) }, call)
        if (!latest || latest.status !== "ok" || latest.value !== undefined || !latestOutbox || latestOutbox.status !== "ok" || latestOutbox.value !== outbox.value.version || current.status !== "ok" || current.value.case.version !== found.value.case.version || !await input.host.revalidate(call)) return { status: "unavailable" as const }
        return { status: "ok" as const, records: [] }
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
        if (!envelope || !boundCase || envelope.eventId !== id || envelope.owner !== owner || record.owner !== owner || envelope.kind !== "task" || record.kind !== "task" || !("taskId" in record.entry) || typeof record.entry.ref !== "string" || !record.entry.ref.trim() || boundCase.id !== caseRef.id || boundCase.incarnation !== caseRef.incarnation || boundCase.version > found.value.case.version) return { status: "unavailable" as const }
        if (envelope.projectionDigest !== digestSfValue({ kind: "task", owner, entry: record.entry, sourceEventId: envelope.sourceEventId, evidenceRefs: envelope.evidenceRefs })) return { status: "unavailable" as const }
        const originals = [...envelope.evidenceRefs, ...envelope.dependencies]
        try {
          const maps = sfEvidenceSourceMaps(originals)
          if (digestSfValue(maps.sourceVersions) !== digestSfValue(envelope.sourceVersions) || digestSfValue(maps.sourceIncarnations) !== digestSfValue(envelope.sourceIncarnations)) return { status: "unavailable" as const }
        } catch { return { status: "unavailable" as const } }
        if (envelope.dependencies.flatMap(expandEvidence).some((ref) => ref.kind === "case-event") || envelope.evidenceRefs.some((ref) =>
          ref.kind === "case-event" && ref.target.evidenceRefs.flatMap(expandEvidence).some((dependency) => dependency.kind === "case-event")))
          return { status: "unavailable" as const }
        const refs = [...new Map(originals.flatMap(expandEvidence).map((ref) => [ref.refDigest, ref])).values()]
        const resolutions = await Promise.all(refs.map((ref) => input.evidence.resolve(ref, call)))
        for (const [index, resolution] of resolutions.entries()) {
          const ref = refs[index]!
          const capture = partition.originals[ref.refDigest]
          if ((resolution.state !== "fresh" && resolution.state !== "historical") || !resolution.currentRef || !resolution.authorizedProjection || !capture || digestSfValue(capture.ref) !== digestSfValue(ref) || partition.captureDigests[id]?.[ref.refDigest] !== digestSfValue(capture) || (resolution.state === "historical" && (resolution.differences === undefined || digestSfValue(resolution.authorizedProjection) !== digestSfValue(capture.projection))) || !await input.proveContinuity(ref, resolution.currentRef, call)) return { status: "unavailable" as const }
        }
        approved.push({ id, event, envelope, resolutions, entry: { ...record.entry, ref: record.entry.ref } })
      }
      if (!await input.host.revalidate(call)) return { status: "unavailable" as const }
      const filtered = createSfAtlasDurableMemory({ events: approved.map((item) => [item.id, item.event]) })
      const recalled = createMemoryRead({ store: filtered, actor: owner }).recall({ kind: "task", owner })
      const records = approved.flatMap((item) => recalled.some((record) => digestSfValue(record) === digestSfValue(item.event.payload)) ? [{ envelope: item.envelope, entry: item.entry, resolutions: item.resolutions, case: found.value, recordDigest: digestSfValue(item.event.payload) }] : [])
      const current = await input.cases.read({ caseRef: encodeCaseRef(caseRef) }, call)
      if (current.status !== "ok" || current.value.case.version !== found.value.case.version || !await input.host.revalidate(call)) return { status: "unavailable" as const }
      for (const record of records) {
        for (const resolution of record.resolutions) {
          const again = await input.evidence.resolve(resolution.ref, call)
          if (again.state !== resolution.state || !again.currentRef || !again.authorizedProjection || digestSfValue(again.currentRef) !== digestSfValue(resolution.currentRef) || digestSfValue(again.authorizedProjection) !== digestSfValue(resolution.authorizedProjection) || (again.state === "historical" && (again.differences === undefined || digestSfValue(again.differences) !== digestSfValue(resolution.differences))) || !await input.proveContinuity(resolution.ref, again.currentRef, call)) return { status: "unavailable" as const }
        }
      }
      const latest = await input.state.read(request, "atlas", (state) => state.atlas[owner]).catch(() => undefined)
      const latestOutbox = await input.state.read(request, "outbox", (state) => state.versions.outbox).catch(() => undefined)
      if (!latest || latest.status !== "ok" || !latestOutbox || latestOutbox.status !== "ok" || latestOutbox.value !== outbox.value.version || digestSfValue(latest.value) !== digestSfValue(snapshot.value) || !await input.host.revalidate(call)) return { status: "unavailable" as const }
      return { status: "ok" as const, records }
      } catch { return { status: "unavailable" as const } }
    },
    /** Private callback for a continuity proof, scoped to an already-authorized case. */
    async readOriginal(caseRef: { id: string; incarnation: string }, digest: string, call: TrustedDomainContext): Promise<BusinessEvidenceRef | undefined> {
      const request = input.host.requestFor(call)
      if (!request || !/^[a-f0-9]{64}$/.test(digest) || !await input.host.revalidate(call)) return undefined
      const current = await input.cases.read({ caseRef: encodeCaseRef(caseRef) }, call)
      if (current.status !== "ok") return undefined
      const owner = deriveSfMemoryOwner(current.value.context, current.value.case)
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
          if (!record || !boundCase || record.owner !== owner || record.kind !== envelope.kind || envelope.owner !== owner || boundCase.id !== caseRef.id || boundCase.incarnation !== caseRef.incarnation || partition.captureDigests[envelope.eventId]?.[digest] !== digestSfValue(capture)) return false
          if (![...envelope.evidenceRefs, ...envelope.dependencies].some((ref) => ref.refDigest === digest)) return false
          return envelope.projectionDigest === digestSfValue({ kind: envelope.kind, owner, entry: record.entry, sourceEventId: envelope.sourceEventId, evidenceRefs: envelope.evidenceRefs })
        })
        return linked ? capture.ref : undefined
      }).catch(() => undefined)
      if (!result || result.status !== "ok" || !await input.host.revalidate(call)) return undefined
      const again = await input.cases.read({ caseRef: encodeCaseRef(caseRef) }, call)
      if (again.status !== "ok" || again.value.case.incarnation !== caseRef.incarnation || !await input.host.revalidate(call)) return undefined
      return result.value
    },
  }
}

function expandEvidence(ref: BusinessEvidenceRef): BusinessEvidenceRef[] {
  if (ref.kind === "calculation") return [ref, ...ref.target.sourceRefs.flatMap(expandEvidence)]
  if (ref.kind === "case-event") return [ref, ...ref.target.evidenceRefs.flatMap(expandEvidence)]
  return [ref]
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
    const candidates: AuthorizedMemoryProjection[] = []
    const sourceVersions: Record<string, number> = {}
    const sourceIncarnations: Record<string, string> = {}
    for (const caseRef of input.caseRefs) {
      const read = await input.memory.recall(caseRef, input.call)
      if (read.status !== "ok") return { status: "unavailable" as const }
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
    return rankSfRecalledCasesAuthorized({
      scope, features: input.features, candidates, call: input.call, proveContinuity: input.proveContinuity, revalidate: input.revalidate,
      authorizeAtlas: async (candidate, call) => {
        const caseRef = candidate.envelope.caseRef
        if (!caseRef) return false
        const reread = await input.memory.recall(caseRef, call)
        return reread.status === "ok" && reread.records.some((record) => digestSfValue(record.envelope) === digestSfValue(candidate.envelope) && record.recordDigest === candidate.atlasTrace.recordDigest)
      },
    })
  } catch { return { status: "unavailable" as const } }
}
