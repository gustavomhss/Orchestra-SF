import { digestSfValue } from "../../../../modules/sucafina/Sucafinav1/product/contracts/canonical.ts"
import type { WorkListRequest } from "../../../../modules/sucafina/Sucafinav1/product/contracts/operations.ts"
import type { PortResult } from "../../../../modules/sucafina/Sucafinav1/product/contracts/ports.ts"
import type { TrustedDomainContext, TrustedUiContext } from "../../../../modules/sucafina/Sucafinav1/product/contracts/sf-execution.ts"
import type { WorkPresentationItem } from "../../../../modules/sucafina/Sucafinav1/product/collaboration/work-port.ts"
import { createWorkDestinationResolver } from "../../../../modules/sucafina/Sucafinav1/product/collaboration/destination.ts"
import { encodeCaseRef } from "../../../../modules/sucafina/Sucafinav1/product/decisions/case-port.ts"
import { isSfPeriod } from "../../../../modules/sucafina/Sucafinav1/product/contracts/validation.ts"
import type { createSfProductAuthority } from "../../../../modules/sucafina/Sucafinav1/product/integration/product-authority.ts"
import type { createSfBusinessServices } from "./business-services.ts"
import { sfExtendedSourceLinks } from "./extended-source-links.ts"
import { sfWorkCaseDestination } from "./work-signals.ts"

type Link = { label: string; url: string }
export type SfWorkItemView = { item: WorkPresentationItem; details: readonly { label: string; value: string }[]; links: readonly Link[] }
type Detail = Pick<SfWorkItemView, "details" | "links">

/** The incoming action is only a selector in the current producer's complete work list. */
export function createSfWorkDestinations(input: {
  authority: ReturnType<typeof createSfProductAuthority>
  business: ReturnType<typeof createSfBusinessServices>
  origin: string
  mount: string
}) {
  const { authority, business } = input
  const host = business.host
  const unavailable = (): PortResult<never> => ({ status: "unavailable", reason: "work-destination-unavailable" })
  const denied = (): PortResult<never> => ({ status: "denied", reason: "work-destination-authority-changed" })
  const read = async (selection: WorkListRequest, actionRef: string, call: TrustedDomainContext): Promise<PortResult<{ view: SfWorkItemView; verify: () => Promise<boolean> }>> => {
    if (call.kind !== "ui" || !selection || typeof selection.selectionRef !== "string" || !selection.selectionRef.trim() ||
      !isSfPeriod(selection.period) || typeof actionRef !== "string" || !actionRef.trim() || actionRef.length > 16_384) return unavailable()
    const payload = structuredClone({ selection, actionRef }), payloadDigest = digestSfValue(payload)
    const request = host.requestFor(call), binding = digestSfValue([call.kind, call.binding])
    const requestDigest = request && requestIdentity(request)
    const current = () => !!request && !request.signal.aborted && host.requestFor(call) === request && requestIdentity(request) === requestDigest &&
      digestSfValue([call.kind, call.binding]) === binding && digestSfValue({ selection, actionRef }) === payloadDigest
    const authorized = async () => current() && await authority.human.authorize(call, "collaboration.work.destination", payload) && current()
    // Each secondary reader gets its own real, exact UI admission on the same
    // Request. A work-list capability is not a wildcard for source content.
    const admitted = async <T>(operation: string, value: unknown, work: (context: TrustedUiContext) => Promise<PortResult<T>>): Promise<PortResult<T>> => {
      if (!request || !await authorized()) return denied()
      const digest = digestSfValue(value)
      const admission = await authority.ui.admit(request, operation, digest)
      if (admission.status !== "ok") return admission
      const context = admission.value
      try {
        if (authorityIdentity(context) !== authorityIdentity(call) || !await authority.ui.validate(context, operation, digest) || !await authorized()) return denied()
        const result = await work(context)
        return await authority.ui.revalidate(context) && await authorized() && current() ? result : denied()
      } finally { authority.ui.finish(context) }
    }
    const sourceLinks = async (item: WorkPresentationItem, context: TrustedDomainContext) => {
      const links = (await Promise.all(item.sourceRefs.map((reference) => sfExtendedSourceLinks({ business, reference, call: context,
        url: new URL(`${input.mount}/dashboard`, input.origin) })))).flat()
      return [...new Map(links.map((link) => [link.url, link])).values()]
    }
    const detail = async (item: WorkPresentationItem): Promise<PortResult<Detail>> => {
      const destination = item.destination
      if (!destination || item.ownerRef !== call.binding.principalRef || !item.sourceRefs.length) return unavailable()
      if (destination.kind === "thread") return admitted("sf-human:collaboration.thread.read", { id: destination.threadId }, async (context) => {
        const found = await business.collaboration.threadReads.read(destination.threadId, context)
        if (found.status !== "ok") return found
        if (found.value.id !== destination.threadId || found.value.recipientRef !== call.binding.principalRef ||
          item.period && digestSfValue(found.value.period) !== digestSfValue(item.period)) return unavailable()
        const links = await sourceLinks(item, context)
        return { status: "ok", value: { details: found.value.messages.map((message) => ({ label: `${message.authorRef} · ${message.createdAt}`, value: message.body })), links } }
      })
      if (destination.kind === "confirmation") return admitted("sf-human:collaboration.confirmation.project", { id: destination.confirmationId }, async (context) => {
        const found = await business.collaboration.confirmation?.inspect(destination.confirmationId, context)
        const work = await business.collaboration.confirmation?.work(destination.confirmationId, context)
        if (!found || found.status !== "ok" || !work || work.status !== "ok" || found.value.confirmationId !== destination.confirmationId ||
          found.value.authorId !== context.binding.principalRef || work.value.state !== "stale" ||
          digestSfValue(work.value.sourceRefs) !== digestSfValue(item.sourceRefs) || work.value.observedVersion !== item.observedVersion ||
          work.value.sourceVersion !== item.sourceVersion || digestSfValue(work.value.period) !== digestSfValue(item.period)) return unavailable()
        return { status: "ok", value: { details: [{ label: "Confirmed by", value: found.value.authorId }, { label: "Confirmed at", value: found.value.confirmedAt },
          { label: "Current validity", value: `${work.value.state}${work.value.reason ? ` · ${work.value.reason}` : ""}` }], links: await sourceLinks(item, context) } }
      })
      if (destination.kind === "hot-topic") return admitted("sf_dashboard_read", { page: "Hot Topics & Actions", period: item.period }, async (context) => {
        const found = await business.collaboration.hotTopics.read(destination.topicId, item.sourceRefs, context)
        if (found.status !== "ok") return found
        const recipient = await business.collaboration.authority.recipient(context.binding.principalRef, context)
        if (found.value.id !== destination.topicId || !recipient || found.value.owner !== recipient.name) return unavailable()
        const sources = item.sourceRefs.filter((ref) => ref.kind === "record" && ref.target.surface === "dashboard" &&
          ref.target.recordType === "hotTopics" && ref.target.recordId === found.value.id && ref.target.version === item.sourceVersion)
        if (sources.length !== 1) return unavailable()
        const links = await sourceLinks({ ...item, sourceRefs: sources }, context)
        return links.length ? { status: "ok", value: { details: [{ label: "Action", value: found.value.action },
          { label: "Status", value: found.value.status }], links } } : unavailable()
      })
      if (destination.kind === "procurement-request") {
        if (!Number.isSafeInteger(item.sourceVersion) || !item.sourceVersion || !item.period ||
          digestSfValue(item.period) !== digestSfValue(payload.selection.period)) return unavailable()
        const period = item.period
        const requestRef = `sf-procurement:${encodeURIComponent(destination.incarnation)}:${item.sourceVersion}`
        const query = { requestRef }
        return admitted("sf_request_read", query, async (context) => business.withProcurementWorkPeriod(context, payload, async () => {
          const source = await business.individual.resolve(requestRef, context)
          if (source.status !== "ok") return source
          const target = source.value.evidence.target
          if (target.recordId !== destination.recordId || target.incarnation !== destination.incarnation || target.version !== item.sourceVersion ||
            digestSfValue(target.period) !== digestSfValue(item.period)) return unavailable()
          const found = await business.procurement.read(query, context)
          if (found.status !== "ok") return found
          const links = await sourceLinks({ ...item, sourceRefs: [source.value.evidence] }, context)
          return links.length ? { status: "ok", value: { details: found.value.values.map((value) => ({ label: value.id, value: String(value.value ?? "Unavailable") })), links } } : unavailable()
        }, { parent: call, requestRef, period }))
      }
      if (destination.kind === "signal") {
        const selected = await business.collaboration.caseSelection?.resolveCase(payload.selection.selectionRef, payload.selection.period, call)
        if (selected?.status !== "ok") return unavailable()
        const href = sfWorkCaseDestination(destination.ref, selected.caseRef, input)
        if (!href) return unavailable()
        return admitted("sf_case_read", { caseRef: encodeCaseRef(selected.caseRef) }, async (context) => {
          const found = await business.cases.read({ caseRef: encodeCaseRef(selected.caseRef) }, context)
          if (found.status !== "ok") return found
          if (found.value.case.id !== selected.caseRef.id || found.value.case.incarnation !== selected.caseRef.incarnation || found.value.case.version !== selected.caseRef.version) return unavailable()
          return { status: "ok", value: { details: [{ label: "Decision", value: found.value.case.objective }], links: [{ label: "Open decision", url: href }] } }
        })
      }
      return unavailable()
    }
    const collect = async (): Promise<PortResult<SfWorkItemView>> => business.withProcurementWorkPeriod(call, payload, async () => {
      if (!await authorized()) return denied()
      const listed = await business.collaboration.work.listPresentation(payload.selection, call)
      if (listed.status !== "ok") return listed
      const matches = listed.value.items.filter((item) => item.actionRef === payload.actionRef)
      const item = matches[0]
      if (matches.length !== 1 || !item?.destination || !current()) return unavailable()
      const resolved = await detail(item)
      if (resolved.status !== "ok") return resolved
      if (!await authorized()) return denied()
      return { status: "ok", value: { item: structuredClone(item), ...structuredClone(resolved.value) } }
    })
    // Canonical readers can materialize captures or reconcile signals. Complete
    // that work before the C08 witness; no producer runs under the read lock.
    const witness = async () => {
      if (!request || !await authorized()) return undefined
      const checked = await authority.state.read(request, "threads", async (state, actor) => {
        if (!current() || actor.principalRef !== call.binding.principalRef || actor.accessRevision !== call.binding.accessRevision || actor.policyVersion !== call.binding.policyVersion) return undefined
        const snapshots = host.persistence.currentSnapshots?.()
        const sources = business.lockedSourceFences()
        if (!snapshots || !sources) return undefined
        const snapshotDigest = digestSfValue(snapshots)
        const environment = await host.environment(request)
        const at = Date.parse(environment.at)
        if (!Number.isFinite(at)) return undefined
        const scope = { day: new Date(at).toISOString().slice(0, 10), directory: environment.directory,
          bankKey: environment.bankKey ? Array.from(environment.bankKey) : undefined }
        const again = await host.environment(request)
        const nextAt = Date.parse(again.at)
        if (!Number.isFinite(nextAt) || digestSfValue(scope) !== digestSfValue({ day: new Date(nextAt).toISOString().slice(0, 10), directory: again.directory,
          bankKey: again.bankKey ? Array.from(again.bankKey) : undefined }) || !await authorized() || !current() ||
          snapshotDigest !== digestSfValue(host.persistence.currentSnapshots?.()) || digestSfValue(sources) !== digestSfValue(business.lockedSourceFences())) return undefined
        return digestSfValue({ snapshotDigest, state, sources, actor, scope, requestDigest, binding, payloadDigest })
      })
      return checked.status === "ok" && current() ? checked.value : undefined
    }
    try {
      const first = await collect()
      if (first.status !== "ok") return first
      const before = await witness()
      if (!before) return denied()
      const again = await collect()
      if (again.status !== "ok") return again
      if (digestSfValue(first.value) !== digestSfValue(again.value)) return unavailable()
      const after = await witness()
      if (!after || before !== after || !current()) return denied()
      const view = structuredClone(again.value), digest = digestSfValue(view)
      return { status: "ok", value: { view, verify: async () => digestSfValue(view) === digest && await witness() === after && current() } }
    } catch { return unavailable() }
  }
  const resolve = async (selection: WorkListRequest, actionRef: string, call: TrustedDomainContext): Promise<PortResult<{ href: string }>> => {
    const opened = await read(selection, actionRef, call)
    if (opened.status !== "ok") return opened
    const resolver = createWorkDestinationResolver({ host, work: business.collaboration.work, origin: input.origin, mount: input.mount,
      resolveDestination: async (destination, context) => {
        if (context !== call || digestSfValue(destination) !== digestSfValue(opened.value.view.item.destination)) return unavailable()
        const url = new URL(`${input.mount}/dashboard`, input.origin)
        url.searchParams.set("sf", "work-item"); url.searchParams.set("selectionRef", selection.selectionRef)
        url.searchParams.set("start", selection.period.start); url.searchParams.set("end", selection.period.end); url.searchParams.set("actionRef", actionRef)
        return { status: "ok", value: { href: `${url.pathname}${url.search}` } }
      },
    })
    const result = await business.withProcurementWorkPeriod(call, { selection, actionRef }, () => resolver(selection, actionRef, call))
    return result.status === "ok" && await opened.value.verify() ? result : denied()
  }
  return { read, resolve }
}

function requestIdentity(request: Request) { return digestSfValue({ method: request.method, url: request.url, headers: [...request.headers] }) }
function authorityIdentity(call: TrustedDomainContext) { return digestSfValue({ installationId: call.binding.installationId, projectId: call.binding.projectId,
  principalRef: call.binding.principalRef, accessRevision: call.binding.accessRevision, policyVersion: call.binding.policyVersion }) }
