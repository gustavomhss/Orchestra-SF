import { digestSfEvidenceRef, digestSfValue } from "../contracts/canonical.ts"
import type { SfDocumentReadPort, DomainPortHost, PortResult } from "../contracts/ports.ts"
import type { SfProductStatePort } from "../contracts/state.ts"
import type { TrustedDomainContext } from "../contracts/sf-execution.ts"
import { readDocumentEvidence } from "./store.ts"
import { documentAsset, documentSourceCurrent } from "./source-fence.ts"
import { parseSfDocumentScenarioRequest } from "./scenario-inputs.ts"
import type { SfDocumentScenarioRequest, SfDocumentScenarioTarget, createSfDocumentScenarios } from "./scenario-inputs.ts"

/**
 * Project-scoped evidence-to-scenario LINK, not a Planner amount mutation.
 * The confirmed source, authorized destination, all-surface source fence and
 * authenticated human intent must agree before the link is committed.
 */
export type SfDocumentScenarioLinkReceipt = {
  kind: "scenario-link"
  id: string
  at: string
  documentRef: SfDocumentScenarioRequest["documentRef"]
  baseRef: string
  targetRef: string
  period: SfDocumentScenarioRequest["period"]
  evidenceVersion: number
  domainApplied: false
}
type StoredLink = {
  schema: "sf-document-scenario-link-v1"
  installationId: string
  projectId: string
  policyVersion: string
  sourceFence: string
  receipt: SfDocumentScenarioLinkReceipt
}
const linkKey = (request: SfDocumentScenarioRequest, context: TrustedDomainContext) =>
  "scenario-link:" + digestSfValue([
    context.binding.installationId, context.binding.projectId, request.documentRef,
    request.baseRef, request.targetRef, request.period,
  ])
const storedLink = (value: unknown): value is StoredLink => {
  if (!value || typeof value !== "object" || Array.isArray(value) ||
      !("schema" in value) || value.schema !== "sf-document-scenario-link-v1" ||
      !("installationId" in value) || typeof value.installationId !== "string" ||
      !("projectId" in value) || typeof value.projectId !== "string" ||
      !("policyVersion" in value) || typeof value.policyVersion !== "string" ||
      !("sourceFence" in value) || typeof value.sourceFence !== "string" ||
      !("receipt" in value) || !value.receipt || typeof value.receipt !== "object" ||
      !("kind" in value.receipt) || value.receipt.kind !== "scenario-link" ||
      !("id" in value.receipt) || typeof value.receipt.id !== "string" || !/^scenario-link:[a-f0-9]{64}$/.test(value.receipt.id) ||
      !("at" in value.receipt) || typeof value.receipt.at !== "string" ||
      !Number.isFinite(Date.parse(value.receipt.at)) ||
      !("baseRef" in value.receipt) || typeof value.receipt.baseRef !== "string" ||
      !("targetRef" in value.receipt) || typeof value.receipt.targetRef !== "string" ||
      !("evidenceVersion" in value.receipt) || !Number.isSafeInteger(value.receipt.evidenceVersion) ||
      typeof value.receipt.evidenceVersion !== "number" || value.receipt.evidenceVersion < 1 ||
      !("domainApplied" in value.receipt) || value.receipt.domainApplied !== false ||
      !("documentRef" in value.receipt) || !value.receipt.documentRef ||
      typeof value.receipt.documentRef !== "object" ||
      !("refDigest" in value.receipt.documentRef) ||
      typeof value.receipt.documentRef.refDigest !== "string") return false
  return true
}

export function createSfDocumentScenarioLinks(input: {
  host: Pick<DomainPortHost, "requestFor" | "revalidate">
  state: SfProductStatePort
  documents: SfDocumentReadPort
  scenarios: ReturnType<typeof createSfDocumentScenarios>
  sourceFence: (context: TrustedDomainContext) => Promise<string | undefined>
  authorize: (request: SfDocumentScenarioRequest, context: TrustedDomainContext) => Promise<boolean>
  operationIdentity: (context: TrustedDomainContext) => string | undefined
  now: () => string
}) {
  const link = async (incoming: SfDocumentScenarioRequest, context: TrustedDomainContext):
    Promise<PortResult<SfDocumentScenarioLinkReceipt>> => {
    const request = parseSfDocumentScenarioRequest(incoming)
    if (!request) return { status: "needs-input", reason: "invalid-document-scenario" }
    const hostRequest = input.host.requestFor(context)
    const operationId = input.operationIdentity(context)
    if (context.kind !== "ui" || !hostRequest || !operationId ||
        !await input.authorize(request, context) || !await input.host.revalidate(context))
      return { status: "denied", reason: "human-link-required" }
    const candidateId = request.documentRef.target.fieldCandidateId
    if (!candidateId || !request.documentRef.target.confirmationVersion)
      return { status: "needs-input", reason: "confirmed-document-required" }
    const candidate = await readDocumentEvidence(candidateId, context, {
      state: input.state, documents: input.documents,
      requestFor: input.host.requestFor, revalidate: input.host.revalidate,
    })
    if (candidate.status !== "ok") return candidate
    const document = candidate.value.evidence
    const canonical = { ...document.ref, target: {
      ...document.ref.target, confirmationVersion: candidate.value.confirmationVersion,
    }, refDigest: "" }
    const canonicalRef = { ...canonical, refDigest: digestSfEvidenceRef(canonical) }
    if (document.status !== "confirmed" || document.id !== candidateId ||
        candidate.value.confirmationVersion !== request.documentRef.target.confirmationVersion ||
        digestSfValue(canonicalRef) !== digestSfValue(request.documentRef) ||
        typeof document.value !== "number" || !Number.isFinite(document.value) ||
        !document.unit || !/^[A-Z]{3}$/.test(document.unit))
      return { status: "stale", reason: "document-confirmation-changed" }
    const targets = await input.scenarios.targets(request.documentRef, context)
    if (targets.status !== "ok") return targets
    const selected = targets.value.find((item) =>
      item.baseRef === request.baseRef && item.targetRef === request.targetRef &&
      digestSfValue(item.period) === digestSfValue(request.period) && item.currency === document.unit)
    if (!selected) return { status: "stale", reason: "scenario-destination-changed" }
    const fence = await input.sourceFence(context)
    if (!fence) return { status: "unavailable", reason: "scenario-source-fence-unavailable" }
    const key = linkKey(request, context)
    const loaded = await input.state.read(hostRequest, "documents", (state, authority) =>
      authority.principalRef === context.binding.principalRef &&
      authority.policyVersion === context.binding.policyVersion &&
      authority.accessRevision === context.binding.accessRevision
        ? { current: state.documents[candidateId], prior: state.documents[key],
            asset: documentAsset(state, request.documentRef.target.documentId) } : undefined)
    if (loaded.status !== "ok" || !loaded.value || !loaded.value.asset)
      return { status: "unavailable", reason: "document-state-unavailable" }
    if (digestSfValue(loaded.value.current) !== digestSfValue(candidate.value) ||
        loaded.value.prior !== undefined)
      return { status: "conflict", reason: "document-link-changed" }
    const asset = loaded.value.asset
    const identity = { incarnation: request.documentRef.target.incarnation,
      revision: request.documentRef.target.revision,
      blobDigest: request.documentRef.target.blobDigest.value }
    const receipt: SfDocumentScenarioLinkReceipt = {
      kind: "scenario-link", id: key, at: input.now(), documentRef: request.documentRef,
      baseRef: selected.baseRef, targetRef: selected.targetRef, period: selected.period,
      evidenceVersion: document.version, domainApplied: false,
    }
    const record: StoredLink = {
      schema: "sf-document-scenario-link-v1",
      installationId: context.binding.installationId,
      projectId: context.binding.projectId, policyVersion: context.binding.policyVersion,
      sourceFence: fence, receipt,
    }
    if (!await input.authorize(request, context) || !await input.documents.revalidate(document.fileRef, identity, context) ||
        await input.sourceFence(context) !== fence || !await input.host.revalidate(context))
      return { status: "stale", reason: "document-link-source-changed" }
    const saved = await input.state.transaction(hostRequest, {
      namespace: "documents", domainSurface: asset.surface, sourceFence: "all",
      expectedStorageVersion: loaded.storageVersion, idempotencyKey: operationId,
      commandDigest: digestSfValue({ action: "link", request, sourceFence: fence }),
      targetRef: document.fileRef, targetIncarnation: identity.incarnation,
    }, async (state, authority, snapshot) => {
      if (authority.principalRef !== context.binding.principalRef ||
          authority.policyVersion !== context.binding.policyVersion ||
          authority.accessRevision !== context.binding.accessRevision ||
          !documentSourceCurrent(state, snapshot, document.fileRef, identity, asset.surface) ||
          state.documents[key] !== undefined ||
          digestSfValue(state.documents[candidateId]) !== digestSfValue(candidate.value) ||
          !await input.documents.revalidate(document.fileRef, identity, context).catch(() => false) ||
          !await input.authorize(request, context))
        return { commit: false, value: null }
      state.documents[key] = record
      return { commit: true, value: receipt }
    })
    if (saved.status !== "ok" || !saved.value)
      return { status: "conflict", reason: "document-link-changed" }
    const verified = await input.state.read(hostRequest, "documents", (state, authority) =>
      authority.principalRef === context.binding.principalRef &&
      authority.policyVersion === context.binding.policyVersion &&
      authority.accessRevision === context.binding.accessRevision
        ? state.documents[key] : undefined)
    if (verified.status !== "ok" || !storedLink(verified.value) ||
        digestSfValue(verified.value) !== digestSfValue(record) ||
        await input.sourceFence(context) !== fence ||
        !await input.documents.revalidate(document.fileRef, identity, context) ||
        !await input.host.revalidate(context))
      return { status: "stale", reason: "document-link-not-verified" }
    return { status: "ok", value: receipt }
  }

  const decorateTargets = async (
    ref: SfDocumentScenarioRequest["documentRef"], targets: readonly SfDocumentScenarioTarget[],
    context: TrustedDomainContext,
  ): Promise<PortResult<readonly SfDocumentScenarioTarget[]>> => {
    const hostRequest = input.host.requestFor(context)
    const fence = await input.sourceFence(context)
    if (!hostRequest || !fence || !await input.host.revalidate(context))
      return { status: "unavailable", reason: "document-link-unavailable" }
    const keys = targets.map((target) => linkKey({
      documentRef: ref, baseRef: target.baseRef, targetRef: target.targetRef, period: target.period,
    }, context))
    const loaded = await input.state.read(hostRequest, "documents", (state, authority) =>
      authority.principalRef === context.binding.principalRef &&
      authority.policyVersion === context.binding.policyVersion &&
      authority.accessRevision === context.binding.accessRevision
        ? keys.map((key) => state.documents[key]) : undefined)
    if (loaded.status !== "ok" || !loaded.value || await input.sourceFence(context) !== fence ||
        !await input.host.revalidate(context))
      return { status: "unavailable", reason: "document-link-read-unavailable" }
    const persisted = loaded.value
    return { status: "ok", value: targets.map((target, index) => {
      const value = persisted[index]
      return storedLink(value) && value.installationId === context.binding.installationId &&
        value.projectId === context.binding.projectId && value.policyVersion === context.binding.policyVersion &&
        value.sourceFence === fence && value.receipt.id === keys[index] &&
        digestSfValue(value.receipt.documentRef) === digestSfValue(ref)
        ? { ...target, linkRef: value.receipt.id, linkedAt: value.receipt.at } : target
    }) }
  }
  return { link, decorateTargets }
}
