import type { Application } from "../../runtime/application.ts"
import { roleMap } from "../../runtime/admin.ts"
import { object, rows } from "../../runtime/contract.ts"
import { domain } from "../../runtime/procurement.ts"
import { digestSfValue } from "../contracts/canonical.ts"
import type { Period } from "../contracts/context.ts"
import type { DomainPortHost } from "../contracts/ports.ts"
import type { TrustedUiContext } from "../contracts/sf-execution.ts"
import type { createSfUiAuthority } from "../integration/ui-authority.ts"
import type { createProcurementPort } from "./port.ts"
import { createProcurementQueueView } from "./queue-view.ts"
import { digestProcurementSource } from "./sources.ts"
import type { createProcurementCollectionRegistry } from "./sources.ts"

export const procurementQueueIntent = (period: Period) => ({ requestRef: `sf-procurement-queue-view:${period.start}:${period.end}` })

/** Prepare outside the page lock; recheck the very same C02 selection inside its authorized transaction. */
export function createProcurementQueuePageView(input: {
  host: DomainPortHost
  ui: ReturnType<typeof createSfUiAuthority>
  collection: ReturnType<typeof createProcurementCollectionRegistry>
  port: Pick<ReturnType<typeof createProcurementPort>, "list">
  selectPeriod: (context: TrustedUiContext, period: Period) => Promise<(() => void) | undefined>
}): NonNullable<Application["productView"]> {
  return async (request, surface, page) => {
    // The unchanged default Procurement page is Dashboard, which needs no queue admission.
    if (surface !== "procurement" || !["GET", "HEAD"].includes(request.method) || page !== "Requests" && page !== "My approvals") return undefined
    const failure = (status: string) => Response.json({ status, reason: "procurement-queue-unavailable" }, { status: status === "denied" ? 403 : status === "stale" ? 409 : 503, headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } })
    const environment = await input.host.environment(request)
    const year = new Date(environment.at).getUTCFullYear()
    if (!Number.isSafeInteger(year) || year < 1 || year > 9999) return failure("unavailable")
    const period = { start: `${String(year).padStart(4, "0")}-01-01`, end: `${String(year).padStart(4, "0")}-12-31` }
    const digest = digestSfValue(procurementQueueIntent(period))
    const admission = await input.ui.admit(request, "sf_request_read", digest)
    if (admission.status !== "ok") return failure(admission.status)
    const context = admission.value
    let retained = false
    let selectionRef: string | undefined
    let releasePeriod: (() => void) | undefined
    const finish = () => {
      if (selectionRef) input.collection.releaseSelection(selectionRef)
      releasePeriod?.()
      input.ui.finish(context)
    }
    try {
      if (!await input.ui.validate(context, "sf_request_read", digest)) return failure("denied")
      releasePeriod = await input.selectPeriod(context, period)
      if (!releasePeriod) return failure("denied")
      const selected = await input.collection.createSelection(context)
      if (selected.status !== "ok") return failure(selected.status)
      selectionRef = selected.value
      const selection = await input.collection.resolveRequestCollection(selected.value, context)
      if (selection.status !== "ok") return failure(selection.status)
      const projected = await input.port.list(selected.value, context)
      if (projected.status !== "ok") return failure(projected.status)
      const presentation = createProcurementQueueView(projected.value)
      if (!presentation || !await input.ui.revalidate(context)) return failure("unavailable")
      const selectedScope = selection.value
      retained = true
      return {
        data: { procurementQueueView: presentation },
        current: async (snapshot, actor) => {
          if (actor.id !== context.binding.principalRef || !await input.ui.revalidate(context) ||
            !input.collection.isCurrentRequestCollection(snapshot, selectedScope.selection, selectedScope.requests, selectedScope.statusSelections)) return false
          const scopes = Object.values(snapshot.sfSources?.scopes ?? {}).filter((entry) => entry.alive && entry.incarnation === selectedScope.selection.target.incarnation && entry.version === selectedScope.selection.target.version && entry.scope.recordType === "procurement-request-selection")
          if (scopes.length !== 1) return false
          const selector = object(scopes[0]!.scope.selector)
          if (!Array.isArray(selector.roles) || digestSfValue([...selector.roles].sort()) !== digestSfValue([...actor.roles].sort()) || selector.canWrite !== actor.canWrite || selector.roleMapDigest !== digestSfValue(roleMap(snapshot, "procurement"))) return false
          const current = domain.view(snapshot, actor, environment)
          const records = rows(current.data.requests)
          if (object(current.data.formSettings).currency !== selectedScope.context.currency || records.length !== presentation.rows.length ||
            selectedScope.requests.some((evidence) => !input.collection.isCurrentRequestSource(snapshot, evidence) ||
              records.filter((record) => record.number === evidence.target.recordId).length !== 1 ||
              digestProcurementSource(records.find((record) => record.number === evidence.target.recordId), current.data.formSettings) !== evidence.target.projectionDigest)) return false
          return !request.signal.aborted && await input.ui.revalidate(context)
        },
        finish,
      }
    } finally {
      if (!retained) finish()
    }
  }
}
