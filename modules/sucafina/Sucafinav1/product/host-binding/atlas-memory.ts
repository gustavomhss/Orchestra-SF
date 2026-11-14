import { createMemoryEmit, createMemoryRead, versioned } from "@orchestra/atlas-boundary/business-memory-ports"
import type { MemoryRecord, NamedScanner } from "@orchestra/atlas-boundary/business-memory-ports"
import { digestSfEvidenceRef, digestSfValue, sfEvidenceSourceMaps } from "../contracts/canonical.ts"
import type { AuthorizedCaseProjection, BusinessContextService, BusinessEvidenceRef, BusinessMemoryEnvelope, MemoryWriteReceipt, SfAtlasProjection } from "../contracts/business-context.ts"
import type { DecisionCasePort, DomainPortHost } from "../contracts/ports.ts"
import type { DecisionCase } from "../contracts/decisions.ts"
import type { SfProductStatePort } from "../contracts/state.ts"
import type { TrustedDomainContext } from "../contracts/sf-execution.ts"
import { encodeCaseRef } from "../decisions/case-port.ts"
import { deriveSfMemoryOwner, mapSfAtlasEntry } from "../decision-memory/atlas-projection.ts"
import { rankSfRecalledCasesAuthorized } from "../decision-memory/recall.ts"
import type { AuthorizedMemoryProjection, RecallFeatures, RecallScope } from "../decision-memory/recall.ts"
import { createSfAtlasDurableMemory } from "./atlas-store.ts"
import { sfRunSourceFence } from "../ai/run-store.ts"

type AtlasPartition = { events: Parameters<typeof createSfAtlasDurableMemory>[0]["events"]; envelopes: Record<string, BusinessMemoryEnvelope>; originals: Record<string, { ref: BusinessEvidenceRef; projection: NonNullable<Awaited<ReturnType<BusinessContextService["resolve"]>>["authorizedProjection"]> }>; captureDigests: Record<string, Record<string, string>> }

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
  now: () => string
}) {
  return {
    async emitFromLedger(ref: BusinessEvidenceRef, call: TrustedDomainContext): Promise<MemoryWriteReceipt> {
      const unavailable = (reason: string): MemoryWriteReceipt => ({ status: "unavailable", sourceEventId: ref.kind === "case-event" ? ref.target.eventId : "", scanner: { name: input.scanner.name, version: input.scannerVersion, status: "unavailable" }, reason })
      const request = input.host.requestFor(call)
      if (ref.kind !== "case-event" || ref.installationId !== call.binding.installationId || ref.projectId !== call.binding.projectId || !request || request.signal.aborted || !await input.host.revalidate(call)) return unavailable("authority-unavailable")
      try { sfEvidenceSourceMaps([ref]) } catch { return unavailable("invalid-evidence") }
      const access = await input.state.read(request, "cases", (state, actor) => {
        const value = state.cases[ref.target.caseId]
        return value && value.incarnation === ref.target.caseIncarnation && value.participants.includes(actor.principalRef) &&
          actor.principalRef === call.binding.principalRef && actor.accessRevision === call.binding.accessRevision && actor.policyVersion === call.binding.policyVersion &&
          (call.kind !== "native" || call.binding.caseId === value.id && call.binding.caseIncarnation === value.incarnation && call.binding.caseVersion === value.version) ? value : undefined
      }).catch(() => undefined)
      if (!access || access.status !== "ok" || !access.value) return unavailable("authority-unavailable")
      const permitted = input.authorizeCase ? await input.authorizeCase(access.value, call) :
        (await input.cases.read({ caseRef: encodeCaseRef({ id: ref.target.caseId, incarnation: ref.target.caseIncarnation }) }, call)).status === "ok"
      if (!permitted || !await input.host.revalidate(call)) return unavailable("authority-unavailable")
      const key = JSON.stringify([ref.target.caseId, ref.target.caseIncarnation, ref.target.eventId])
      const captured = await input.state.read(request, "atlas", (state) => ({ versions: state.versions, item: state.outbox[key] })).catch(() => undefined)
      const confirmed = await input.state.read(request, "cases", (state) => state.cases[ref.target.caseId]).catch(() => undefined)
      if (!confirmed || confirmed.status !== "ok" || !confirmed.value || digestSfValue(confirmed.value) !== digestSfValue(access.value) ||
        (input.authorizeCase && !await input.authorizeCase(confirmed.value, call)) || !await input.host.revalidate(call)) return unavailable("authority-unavailable")
      if (!captured || captured.status !== "ok" || !captured.value.item) return unavailable("outbox-unavailable")
      if (digestSfValue(captured.value.item.eventRef) !== digestSfValue(ref)) return { ...unavailable("idempotency-content-changed"), status: "conflict" }
      // A durable receipt is a recovery result, not a second append. Reauthorize it without rerunning the scanner.
      if (captured.value.item.state === "settled") {
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
        const authorized = input.authorizeCase ? await input.authorizeCase(replay.value.value, call) :
          (await input.cases.read({ caseRef: encodeCaseRef({ id: ref.target.caseId, incarnation: ref.target.caseIncarnation }) }, call)).status === "ok"
        if (!authorized || !await input.host.revalidate(call)) return unavailable("case-unavailable")
        const current = await input.state.read(request, "cases", (state) => ({ value: state.cases[ref.target.caseId], item: state.outbox[key] })).catch(() => undefined)
        if (!current || current.status !== "ok" || digestSfValue(current.value) !== digestSfValue(replay.value) ||
          (input.authorizeCase && !await input.authorizeCase(current.value.value!, call)) || !await input.host.revalidate(call)) return unavailable("case-unavailable")
        return captured.value.item.receipt.status === "committed" ? { ...captured.value.item.receipt, status: "already-committed" } : captured.value.item.receipt
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
      const resolutions = await Promise.all(dependencies.map((dependency) => input.evidence.resolve(dependency, call)))
      if (!dependencies.length || resolutions.some((resolution) => resolution.state !== "fresh" || !resolution.authorizedProjection || resolution.accessRevision !== call.binding.accessRevision) || !await input.host.revalidate(call)) return unavailable("source-unavailable")
      const maps = sfEvidenceSourceMaps(mapped.projection.evidenceRefs)
      const digest = digestSfValue({ ref, projection: mapped.projection, maps })
      if (!await input.host.revalidate(call)) return unavailable("authority-unavailable")
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
        if (!envelope || !boundCase || envelope.eventId !== id || envelope.owner !== owner || record.owner !== owner || envelope.kind !== "task" || record.kind !== "task" || boundCase.id !== caseRef.id || boundCase.incarnation !== caseRef.incarnation || boundCase.version > found.value.case.version) return { status: "unavailable" as const }
        if (envelope.projectionDigest !== digestSfValue({ kind: "task", owner, entry: record.entry, sourceEventId: envelope.sourceEventId, evidenceRefs: envelope.evidenceRefs })) return { status: "unavailable" as const }
        const originals = [...envelope.evidenceRefs, ...envelope.dependencies]
        try {
          const maps = sfEvidenceSourceMaps(originals)
          if (digestSfValue(maps.sourceVersions) !== digestSfValue(envelope.sourceVersions) || digestSfValue(maps.sourceIncarnations) !== digestSfValue(envelope.sourceIncarnations)) return { status: "unavailable" as const }
        } catch { return { status: "unavailable" as const } }
        const refs = [...new Map(originals.flatMap(expandEvidence).map((ref) => [ref.refDigest, ref])).values()]
        const resolutions = await Promise.all(refs.map((ref) => input.evidence.resolve(ref, call)))
        for (const [index, resolution] of resolutions.entries()) {
          const ref = refs[index]!
          const capture = partition.originals[ref.refDigest]
          if ((resolution.state !== "fresh" && resolution.state !== "historical") || !resolution.currentRef || !resolution.authorizedProjection || !capture || digestSfValue(capture.ref) !== digestSfValue(ref) || partition.captureDigests[id]?.[ref.refDigest] !== digestSfValue(capture) || (resolution.state === "historical" && (resolution.differences === undefined || digestSfValue(resolution.authorizedProjection) !== digestSfValue(capture.projection))) || !await input.proveContinuity(ref, resolution.currentRef, call)) return { status: "unavailable" as const }
        }
        approved.push({ id, event, envelope, resolutions })
      }
      if (!await input.host.revalidate(call)) return { status: "unavailable" as const }
      const filtered = createSfAtlasDurableMemory({ events: approved.map((item) => [item.id, item.event]) })
      const recalled = createMemoryRead({ store: filtered, actor: owner }).recall({ kind: "task", owner })
      const records = approved.flatMap((item) => recalled.some((record) => digestSfValue(record) === digestSfValue(item.event.payload)) ? [{ envelope: item.envelope, entry: (item.event.payload as MemoryRecord).entry, resolutions: item.resolutions, case: found.value, recordDigest: digestSfValue(item.event.payload) }] : [])
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
      // A continuity proof must not recursively resolve the same sources through cases.read.
      const readCase = async () => {
        const found = await input.state.read(request, "cases", (state, actor) => {
          const value = state.cases[caseRef.id]
          return value && value.incarnation === caseRef.incarnation && value.participants.includes(actor.principalRef) &&
            actor.principalRef === call.binding.principalRef && actor.accessRevision === call.binding.accessRevision && actor.policyVersion === call.binding.policyVersion &&
            (call.kind !== "native" || call.binding.caseId === value.id && call.binding.caseIncarnation === value.incarnation && call.binding.caseVersion === value.version) ? value : undefined
        }).catch(() => undefined)
        if (!found || found.status !== "ok" || !found.value) return undefined
        const allowed = input.authorizeCase ? await input.authorizeCase(found.value, call) :
          (await input.cases.read({ caseRef: encodeCaseRef(caseRef) }, call)).status === "ok"
        return allowed && await input.host.revalidate(call) ? found.value : undefined
      }
      const current = await readCase()
      if (!current) return undefined
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
          if (!record || !boundCase || record.owner !== owner || record.kind !== envelope.kind || envelope.owner !== owner || boundCase.id !== caseRef.id || boundCase.incarnation !== caseRef.incarnation || partition.captureDigests[envelope.eventId]?.[digest] !== digestSfValue(capture)) return false
          if (![...envelope.evidenceRefs, ...envelope.dependencies].some((ref) => ref.refDigest === digest)) return false
          return envelope.projectionDigest === digestSfValue({ kind: envelope.kind, owner, entry: record.entry, sourceEventId: envelope.sourceEventId, evidenceRefs: envelope.evidenceRefs })
        })
        return linked ? capture.ref : undefined
      }).catch(() => undefined)
      if (!result || result.status !== "ok" || !await input.host.revalidate(call)) return undefined
      const again = await readCase()
      if (!again || digestSfValue(again) !== digestSfValue(current) || !await input.host.revalidate(call)) return undefined
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
