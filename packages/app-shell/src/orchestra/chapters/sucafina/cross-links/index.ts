import { createSfDomainClient } from "@orchestra/client/sucafina/domain"
import { createSfPeopleClient } from "@orchestra/client/sucafina/people"
import type { SfTransport } from "@orchestra/client/sucafina/transport"
import type { SfContext, SfResolvedRoute } from "@orchestra/schema/sucafina/context"
import { encodeSfRouteRef } from "../navigation-state"
import { sfReadProjects } from "../portfolio/projects/producer"

/**
 * WS-8. References are original producer identities, never a title, owner
 * label, note body, or a client-created authority token. These are only
 * candidate URLs; F01 must resolve/admit the actual destination again.
 */
export type SfExecutiveRecord = Readonly<{
  kind: "project" | "risk" | "stakeholder" | "topic"
  ref: string
}>
export type SfExecutiveLink =
  | Readonly<{ kind: "agenda" | "projects" | "risks" | "stakeholders" | "topics" | "new-topic" }>
  | SfExecutiveRecord
  | Readonly<{ kind: "relations"; source: SfExecutiveRecord }>

const operationReady = (context: SfContext, operationId: string) =>
  context.availability.some((resource) => resource.operations.some((operation) =>
    operation.operationId === operationId && operation.state === "ready" && operation.operational))

const admitted = (context: SfContext, capability: "CAP02" | "CAP10" | "CAP13" | "CAP15") =>
  context.destinations.some((item) => item.capabilityId === capability && item.canRead) &&
  operationReady(context, "domain.page." + capability)

export function sfExecutiveLinkAllowed(context: SfContext, target: SfExecutiveLink): boolean {
  switch (target.kind) {
    case "agenda":
      return operationReady(context, "projection.review") &&
        operationReady(context, "dashboard.dashboard-agenda") &&
        operationReady(context, "dashboard.dashboard-review-preserve")
    case "projects": case "project": return admitted(context, "CAP10")
    case "risks": case "risk": return admitted(context, "CAP13")
    case "stakeholders": case "stakeholder": return admitted(context, "CAP15")
    case "topics": case "topic": return admitted(context, "CAP02")
    case "new-topic":
      return admitted(context, "CAP02") && operationReady(context, "domain.command.CAP02.save") &&
        context.destinations.some((item) => item.capabilityId === "CAP02" && item.allowedActionIds.includes("save"))
    case "relations":
      return sfExecutiveLinkAllowed(context, target.source) &&
        operationReady(context, "collaboration.relation-read") &&
        operationReady(context, "collaboration.relation-create")
  }
}

function isRecord(target: SfExecutiveLink): target is SfExecutiveRecord {
  return target.kind === "project" || target.kind === "risk" ||
    target.kind === "stakeholder" || target.kind === "topic"
}
const validRef = (ref: string) => ref.trim().length > 0 && ref.length <= 4096

/** An explicit three-part owner selection must be transported intact. */
export function sfExecutiveLinkRequest(from: SfResolvedRoute, target: SfExecutiveLink): string | undefined {
  const owner = from.ownerSelection
  if (!owner.serverKey || !owner.projectId || !owner.installationId) return
  if (isRecord(target) && !validRef(target.ref)) return
  if (target.kind === "relations" && !validRef(target.source.ref)) return

  const query = new URLSearchParams({
    server: owner.serverKey, project: owner.projectId, installation: owner.installationId,
  })
  let path = ""
  switch (target.kind) {
    case "agenda": path = "/orchestra/sf-reviews/agenda"; break
    case "projects": path = "/orchestra/sf-portfolio/projects"; break
    case "project":
      path = "/orchestra/sf-portfolio/projects/" + encodeSfRouteRef(target.ref)
      break
    case "risks": path = "/orchestra/sf-operations/risks"; break
    case "risk":
      path = "/orchestra/sf-operations/risks/" + encodeSfRouteRef(target.ref)
      break
    case "stakeholders": path = "/orchestra/sf-operations/stakeholders"; break
    case "stakeholder":
      path = "/orchestra/sf-operations/stakeholders/" + encodeSfRouteRef(target.ref)
      break
    case "topics": path = "/orchestra/sf-dashboard/hot-topics"; break
    case "topic":
      path = "/orchestra/sf-dashboard/hot-topics/" + encodeSfRouteRef(target.ref)
      break
    case "new-topic": path = "/orchestra/sf-dashboard/hot-topics/new"; break
    case "relations":
      path = "/orchestra/sf-work/relations/new"
      // The UI51 query contract accepts the producer's original ref, not an
      // encoded route segment, and rereads it before any real relation write.
      query.set("source", target.source.ref)
      break
  }
  if ((target.kind === "projects" || target.kind === "project") &&
      from.query.year !== undefined) query.set("year", String(from.query.year))
  return path + "?" + query.toString()
}

/** The F01-resolved route, not our candidate URL, decides what can open. */
export function sfExecutiveLinkMatches(route: SfResolvedRoute, target: SfExecutiveLink): boolean {
  switch (target.kind) {
    case "agenda": return route.surfaceId === "UI47" && route.kind === "entry"
    case "projects": return route.surfaceId === "CAP10" && route.kind === "entry"
    case "project": return route.surfaceId === "CAP10" && route.kind === "detail" &&
      route.params.projectRef === target.ref
    case "risks": return route.surfaceId === "CAP13" && route.kind === "entry"
    case "risk": return route.surfaceId === "CAP13" && route.kind === "detail" &&
      route.params.riskRef === target.ref
    case "stakeholders": return route.surfaceId === "CAP15" && route.kind === "entry"
    case "stakeholder": return route.surfaceId === "CAP15" && route.kind === "detail" &&
      route.params.stakeholderRef === target.ref
    case "topics": return route.surfaceId === "CAP02" && route.kind === "entry"
    case "topic": return route.surfaceId === "CAP02" && route.kind === "detail" &&
      route.params.topicRef === target.ref
    case "new-topic": return route.surfaceId === "CAP02" && route.kind === "new"
    case "relations": return route.surfaceId === "UI51" && route.kind === "new" &&
      route.query.source === target.source.ref
  }
}

/**
 * A deep link must not use a stale cached row as its proof. Read the
 * destination's actual producer with the same owner-bound transport and
 * require the exact current ID before F01 commits. A missing source is DENIED,
 * never treated as an empty record or a successful handoff.
 */
export async function sfExecutiveRevalidateRef(
  transport: SfTransport, from: SfResolvedRoute, target: SfExecutiveLink, signal: AbortSignal,
): Promise<boolean> {
  if (signal.aborted) return false
  const record = target.kind === "relations" ? target.source : isRecord(target) ? target : undefined
  if (!record) return true
  try {
    if (record.kind === "project") {
      const result = await sfReadProjects(transport, "CAP10", {
        ...(from.query.year === undefined ? {} : { year: from.query.year }),
      }, signal)
      return !signal.aborted && result.status === "ok" &&
        result.page.records.some((item) => item.id === record.ref)
    }
    if (record.kind === "topic") {
      const result = await createSfPeopleClient(transport)["domain.page.CAP02"](
        { topicStatus: "" }, { signal })
      return !signal.aborted && result.kind === "response" && result.status === 200 &&
        result.body.status === "ok" && result.body.value.capabilityId === "CAP02" &&
        result.body.value.data.hotTopics.some((item) => item.id === record.ref)
    }
    if (record.kind === "risk") {
      const result = await createSfDomainClient(transport)["domain.page.CAP13"]({}, { signal })
      return !signal.aborted && result.kind === "response" && result.status === 200 &&
        result.body.status === "ok" && result.body.value.capabilityId === "CAP13" &&
        result.body.value.data.risks?.some((item) => String(item.id) === record.ref) === true
    }
    const result = await createSfDomainClient(transport)["domain.page.CAP15"]({}, { signal })
    return !signal.aborted && result.kind === "response" && result.status === 200 &&
      result.body.status === "ok" && result.body.value.capabilityId === "CAP15" &&
      result.body.value.data.stakeholders?.some((item) => String(item.id) === record.ref) === true
  } catch {
    return false
  }
}
