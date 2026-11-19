import { SfOperationRegistry } from "@orchestra/schema/sucafina/operation-registry"
import type { SfContextStamp } from "@orchestra/schema/sucafina/context"
import type { SfOperationId } from "@orchestra/schema/sucafina/common"
import { digestSfValue } from "../../../../../modules/sucafina/Sucafinav1/product/contracts/canonical.ts"
import type { CreateSfHostRuntime, SfHostServices } from "../../../../../modules/sucafina/Sucafinav1/product/contracts/host-context.ts"
import { selectSfNamespaceHealth } from "../../../../../modules/sucafina/Sucafinav1/product/host-binding/state-provider.ts"
import type { createReviewApplication } from "../../../../../modules/sucafina/Sucafinav1/product/reviews/application.ts"
import { sfHasOperationalResource } from "./live-context.ts"

/** C14 infrastructure only: no report generation, artifact bytes or record authorization. */
export async function observeSfReportHealth(input: { ui: SfHostServices["ui"]; state: SfHostServices["state"];
  source: ReturnType<typeof createReviewApplication> | undefined }, request: Request, stamp: SfContextStamp) {
  if (!input.source || request.signal.aborted) return []
  const source = input.source
  const candidates = [
    { id: "reviews.report.prepare", operation: "sf_report_prepare", handler: "prepareReport", write: true },
    { id: "files.export.review", operation: "sf_artifact_get", handler: "readArtifact", write: false },
  ] as const
  const results = await Promise.allSettled(candidates.map(async (candidate) => {
    const id = Object.keys(SfOperationRegistry).find((key) => key === candidate.id)
    const descriptors = source.descriptors.filter((item) => item.id === candidate.operation)
    if (!id || !isOperation(id) || !sfHasOperationalResource(id) || descriptors.length !== 1 || descriptors[0]?.handlerExport !== candidate.handler ||
      typeof source.http !== "function" || typeof source.reviews.read !== "function" || typeof source.artifacts.download !== "function") return []
    if (candidate.write) {
      const dependencies = await Promise.all([import("docx"), import("pptxgenjs")]).catch(() => undefined)
      if (!dependencies) return []
    }
    const digest = digestSfValue({ purpose: "report-source-health", operation: candidate.operation })
    const admitted = await input.ui.admit(request, candidate.operation, digest)
    if (admitted.status !== "ok") return []
    try {
      const binding = admitted.value.binding
      if (binding.installationId !== stamp.installationId || binding.projectId !== stamp.projectId ||
        binding.principalRef !== stamp.principalRef || binding.policyVersion !== stamp.policyVersion ||
        binding.accessRevision !== stamp.accessRevision || !await input.ui.validate(admitted.value, candidate.operation, digest) ||
        input.ui.requestFor(admitted.value) !== request) return []
      let stateFence: { revision: number; incarnation: string } | undefined
      for (const namespace of ["reviews", "documents"] as const) {
        const health = await input.state.read(request, namespace, selectSfNamespaceHealth(namespace, stamp,
          candidate.write && namespace === "documents" ? "write" : "read"))
        if (health.status !== "ok" || !health.value || health.storageVersion !== health.value.storageVersion ||
          health.aggregateRevision !== health.value.aggregateRevision || health.incarnation !== health.value.incarnation) return []
        if (stateFence && (stateFence.revision !== health.aggregateRevision || stateFence.incarnation !== health.incarnation)) return []
        stateFence = { revision: health.aggregateRevision, incarnation: health.incarnation }
      }
      if (request.signal.aborted || !await input.ui.revalidate(admitted.value)) return []
      return [{ operationId: id, state: "ready" as const, reason: null, operational: true as const }]
    } finally { input.ui.finish(admitted.value) }
  }))
  return results.flatMap((item) => item.status === "fulfilled" ? item.value : [])
}

/** Installed read infrastructure only; individual review and source access remains with the producer. */
export async function observeSfReviewReadHealth(input: {
  ui: SfHostServices["ui"]
  state: SfHostServices["state"]
  binding?: Parameters<CreateSfHostRuntime>[0]["nativeReadBinding"]
  source: (id: "dashboard.dashboard-review" | "projection.review" | "reviews.review-source" | "reviews.review-update" | "reviews.review-read") => { producer: object; dependencies: readonly object[] } | undefined
}, request: Request, stamp: SfContextStamp) {
  if (!input.binding || request.signal.aborted) return []
  const bindingFor = input.binding
  const sourceFor = input.source
  const ui = input.ui
  const state = input.state
  const candidates = [
    { id: "dashboard.dashboard-review", operation: "sf_dashboard_read", path: "{mount}/dashboard" },
    { id: "projection.review", operation: "sf_review_prepare", path: "{mount}/api/ui/projections/review" },
    { id: "reviews.review-source", operation: "sf_review_prepare", path: "{mount}/dashboard" },
    { id: "reviews.review-update", operation: "sf_review_prepare", path: "{mount}/dashboard" },
    { id: "reviews.review-read", operation: "sf_review_prepare", path: "{mount}/dashboard" },
  ] as const
  const results = await Promise.allSettled(candidates.map(async (candidate) => {
    const metadata = SfOperationRegistry[candidate.id]
    if (!metadata || metadata.method !== "GET" || metadata.pathTemplate !== candidate.path || !sfHasOperationalResource(candidate.id)) return []
    if (candidate.id === "dashboard.dashboard-review" && SfOperationRegistry["dashboard.dashboard-review"].fixedQuery.sf !== "dashboard-review") return []
    if (candidate.id === "reviews.review-source" && SfOperationRegistry["reviews.review-source"].fixedQuery.sf !== "review-source" ||
      candidate.id === "reviews.review-update" && SfOperationRegistry["reviews.review-update"].fixedQuery.sf !== "review-update" ||
      candidate.id === "reviews.review-read" && SfOperationRegistry["reviews.review-read"].fixedQuery.sf !== "review-read") return []
    const source = sourceFor(candidate.id)
    if (!source || !source.dependencies.length) return []
    const binding = bindingFor(candidate.id, source.producer)
    if (!binding || typeof binding !== "object" && typeof binding !== "function") return []
    const current = () => {
      const next = sourceFor(candidate.id)
      return input.binding === bindingFor && input.source === sourceFor && input.ui === ui && input.state === state &&
        !!next && next.producer === source.producer && next.dependencies.length === source.dependencies.length &&
        next.dependencies.every((dependency, index) => dependency === source.dependencies[index]) &&
        bindingFor(candidate.id, source.producer) === binding && !request.signal.aborted
    }
    const digest = digestSfValue({ purpose: "review-read-source-health", operation: candidate.operation })
    const admitted = await ui.admit(request, candidate.operation, digest)
    if (admitted.status !== "ok") return []
    try {
      const authority = admitted.value.binding
      if (authority.installationId !== stamp.installationId || authority.projectId !== stamp.projectId ||
        authority.principalRef !== stamp.principalRef || authority.policyVersion !== stamp.policyVersion ||
        authority.accessRevision !== stamp.accessRevision || !await ui.validate(admitted.value, candidate.operation, digest) ||
        ui.requestFor(admitted.value) !== request || !current()) return []
      const read = () => state.read(request, "reviews", selectSfNamespaceHealth("reviews", stamp))
      const first = await read()
      if (first.status !== "ok" || !first.value || first.storageVersion !== first.value.storageVersion ||
        first.aggregateRevision !== first.value.aggregateRevision || first.incarnation !== first.value.incarnation) return []
      const second = await read()
      if (second.status !== "ok" || !second.value || second.storageVersion !== second.value.storageVersion ||
        second.aggregateRevision !== second.value.aggregateRevision || second.incarnation !== second.value.incarnation ||
        first.storageVersion !== second.storageVersion || first.aggregateRevision !== second.aggregateRevision || first.incarnation !== second.incarnation ||
        !await ui.revalidate(admitted.value) || ui.requestFor(admitted.value) !== request || !current()) return []
      return [{ operationId: candidate.id, state: "ready" as const, reason: null, operational: true as const }]
    } finally { ui.finish(admitted.value) }
  }))
  return results.flatMap((item) => item.status === "fulfilled" ? item.value : [])
}

/** Installed C05 pin producer only. Does not issue a digest or authorize a section. */
export async function observeSfReviewThreadContextHealth(input: {
  ui: SfHostServices["ui"]
  state: SfHostServices["state"]
  source: { readonly http?: unknown; readonly threadContext?: { readonly prepare?: unknown; readonly authorize?: unknown }; readonly reviews?: { readonly read?: unknown } } | undefined
}, request: Request, stamp: SfContextStamp) {
  const source = input.source
  const producer = source?.threadContext
  if (!source || typeof source.http !== "function" || !producer || typeof producer.prepare !== "function" ||
    typeof producer.authorize !== "function" || typeof source.reviews?.read !== "function" || request.signal.aborted ||
    !sfHasOperationalResource("reviews.review-thread-context")) return []
  const metadata = SfOperationRegistry["reviews.review-thread-context"]
  if (metadata.method !== "POST" || metadata.pathTemplate !== "{mount}/dashboard" || metadata.effect !== "read" ||
    metadata.responseMode !== "json" || metadata.fixedQuery.sf !== "review-thread-context" || metadata.maxRequestBytes !== 65536) return []
  const digest = digestSfValue({ purpose: "review-thread-context-health", operation: "sf_review_prepare" })
  const admitted = await input.ui.admit(request, "sf_review_prepare", digest)
  if (admitted.status !== "ok") return []
  try {
    const authority = admitted.value.binding
    if (authority.installationId !== stamp.installationId || authority.projectId !== stamp.projectId ||
      authority.principalRef !== stamp.principalRef || authority.policyVersion !== stamp.policyVersion ||
      authority.accessRevision !== stamp.accessRevision || !await input.ui.validate(admitted.value, "sf_review_prepare", digest) ||
      input.ui.requestFor(admitted.value) !== request || input.source !== source || source.threadContext !== producer) return []
    const read = () => input.state.read(request, "reviews", selectSfNamespaceHealth("reviews", stamp))
    const first = await read()
    if (first.status !== "ok" || !first.value || first.storageVersion !== first.value.storageVersion ||
      first.aggregateRevision !== first.value.aggregateRevision || first.incarnation !== first.value.incarnation) return []
    const second = await read()
    if (second.status !== "ok" || !second.value || second.storageVersion !== second.value.storageVersion ||
      second.aggregateRevision !== second.value.aggregateRevision || second.incarnation !== second.value.incarnation ||
      first.storageVersion !== second.storageVersion || first.aggregateRevision !== second.aggregateRevision ||
      first.incarnation !== second.incarnation || !await input.ui.revalidate(admitted.value) ||
      input.ui.requestFor(admitted.value) !== request || input.source !== source || source.threadContext !== producer) return []
    return [{ operationId: "reviews.review-thread-context" as const, state: "ready" as const, reason: null, operational: true as const }]
  } finally { input.ui.finish(admitted.value) }
}


type AgendaOperation = "dashboard.dashboard-agenda" | "dashboard.dashboard-review-preserve" |
  "reviews.review-agenda-options" | "reviews.review-agenda" | "reviews.review-preserve"

/** Observe the mounted producer, live caller and C08 namespace; no selection or review is created. */
export async function observeSfReviewAgendaHealth(input: {
  ui: SfHostServices["ui"]
  state: SfHostServices["state"]
  binding?: Parameters<CreateSfHostRuntime>[0]["nativeReadBinding"]
  humanActions: (request: Request) => Promise<readonly string[]>
  source: (id: AgendaOperation) => { producer: object; dependencies: readonly object[] } | undefined
}, request: Request, stamp: SfContextStamp) {
  if (!input.binding || request.signal.aborted) return []
  const bindingFor = input.binding, sourceFor = input.source, ui = input.ui, state = input.state
  const candidates = [
    { id: "dashboard.dashboard-agenda", operation: "sf_dashboard_read", method: "POST", query: "dashboard-agenda", write: false },
    { id: "dashboard.dashboard-review-preserve", operation: "sf_dashboard_read", method: "POST", query: "dashboard-review-preserve", write: true },
    { id: "reviews.review-agenda-options", operation: "sf_review_prepare", method: "GET", query: "review-agenda", write: false },
    { id: "reviews.review-agenda", operation: "sf_review_prepare", method: "POST", query: "review-agenda", write: false },
    { id: "reviews.review-preserve", operation: "sf_review_prepare", method: "POST", query: "review-preserve", write: true },
  ] as const
  const results = await Promise.allSettled(candidates.map(async (candidate) => {
    const metadata = SfOperationRegistry[candidate.id]
    if (!sfHasOperationalResource(candidate.id) || metadata.method !== candidate.method ||
      metadata.pathTemplate !== "{mount}/dashboard" || metadata.fixedQuery.sf !== candidate.query ||
      metadata.responseMode !== "json") return []
    const source = sourceFor(candidate.id)
    if (!source || !source.dependencies.length) return []
    const installed = bindingFor(candidate.id, source.producer)
    if (!installed || typeof installed !== "object" && typeof installed !== "function") return []
    const current = () => {
      const next = sourceFor(candidate.id)
      return input.binding === bindingFor && input.source === sourceFor && input.ui === ui && input.state === state &&
        !!next && next.producer === source.producer && next.dependencies.length === source.dependencies.length &&
        next.dependencies.every((dependency, index) => dependency === source.dependencies[index]) &&
        bindingFor(candidate.id, source.producer) === installed && !request.signal.aborted
    }
    const digest = digestSfValue({ purpose: "review-agenda-source-health", operation: candidate.operation, id: candidate.id })
    const admitted = await ui.admit(request, candidate.operation, digest)
    if (admitted.status !== "ok") return []
    try {
      const actor = admitted.value.binding
      if (actor.installationId !== stamp.installationId || actor.projectId !== stamp.projectId ||
        actor.principalRef !== stamp.principalRef || actor.policyVersion !== stamp.policyVersion ||
        actor.accessRevision !== stamp.accessRevision || !await ui.validate(admitted.value, candidate.operation, digest) ||
        ui.requestFor(admitted.value) !== request || !current()) return []
      if (candidate.write && !(await input.humanActions(request)).includes("reviews.preserve")) return []
      const read = () => state.read(request, "reviews", selectSfNamespaceHealth("reviews", stamp, candidate.write ? "write" : "read"))
      const first = await read(), second = await read()
      if (first.status !== "ok" || second.status !== "ok" || !first.value || !second.value ||
        first.storageVersion !== first.value.storageVersion || first.aggregateRevision !== first.value.aggregateRevision ||
        first.incarnation !== first.value.incarnation || second.storageVersion !== second.value.storageVersion ||
        second.aggregateRevision !== second.value.aggregateRevision || second.incarnation !== second.value.incarnation ||
        first.storageVersion !== second.storageVersion || first.aggregateRevision !== second.aggregateRevision ||
        first.incarnation !== second.incarnation || !await ui.revalidate(admitted.value) ||
        ui.requestFor(admitted.value) !== request || !current()) return []
      if (candidate.write && !(await input.humanActions(request)).includes("reviews.preserve")) return []
      if (!await ui.revalidate(admitted.value) || !current()) return []
      return [{ operationId: candidate.id, state: "ready" as const, reason: null, operational: true as const }]
    } finally { ui.finish(admitted.value) }
  }))
  return results.flatMap((result) => result.status === "fulfilled" ? result.value : [])
}

function isOperation(value: string): value is SfOperationId {
  return Object.hasOwn(SfOperationRegistry, value)
}
