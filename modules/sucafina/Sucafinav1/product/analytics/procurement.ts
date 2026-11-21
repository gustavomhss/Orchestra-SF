import type { DomainProjection } from "../contracts/context.ts"
import type { PortResult } from "../contracts/ports.ts"
import type { TrustedDomainContext } from "../contracts/sf-execution.ts"
import type { BiPresentationPort } from "./capabilities.ts"

export type ProcurementBiHost = {
  list: (selectionRef: string, context: TrustedDomainContext) => Promise<PortResult<{ stock: DomainProjection; aging: readonly DomainProjection[] }>>
  revalidate: BiPresentationPort["revalidate"]
}

/** The injected collection port owns authentication, row scope, age and counts. */
export function createProcurementBiSource(host: ProcurementBiHost): BiPresentationPort {
  return {
    revalidate: host.revalidate,
    async read(request, context) {
      if (request.viewId !== "BI05" && request.viewId !== "BI06") return { status: "unavailable", reason: "unsupported-view" }
      const result = await host.list(request.selectionRef, context)
      if (result.status !== "ok") return result
      const stock = result.value.stock
      if (stock.context.period.start !== request.period.start || stock.context.period.end !== request.period.end) return { status: "stale", reason: "period-mismatch" }
      if (request.viewId === "BI05") return { status: "ok", value: stock }
      const rows = result.value.aging
      if (rows.some((row) => row.context.installationId !== stock.context.installationId || row.context.projectId !== stock.context.projectId || row.context.principalRef !== stock.context.principalRef || row.context.accessRevision !== stock.context.accessRevision || row.context.policyVersion !== stock.context.policyVersion || row.context.currency !== stock.context.currency || row.context.period.start !== stock.context.period.start || row.context.period.end !== stock.context.period.end)) return { status: "unavailable", reason: "inconsistent-collection-context" }
      const identified = rows.map((row) => {
        const requests = row.values.flatMap((value) => value.sourceRefs.flatMap((ref) => ref.kind === "record" && ref.target.recordType === "procurement-request" ? [ref] : []))
        const drilldowns = row.values.flatMap((value) => {
          const reference = value.drilldown
          return reference?.kind === "record" && reference.target.recordType === "procurement-request" ? [reference] : []
        })
        return { row, requests, drilldowns }
      })
      if (identified.some((entry) => !entry.requests.length)) return { status: "unavailable", reason: "missing-request-reference" }
      if (identified.some((entry) => [...entry.requests, ...entry.drilldowns].some((ref) => ref.installationId !== stock.context.installationId || ref.projectId !== stock.context.projectId || ref.target.surface !== "procurement") || new Set([...entry.requests, ...entry.drilldowns].map((ref) => JSON.stringify([ref.target.recordId, ref.target.incarnation, ref.target.version]))).size !== 1)) return { status: "unavailable", reason: "inconsistent-request-reference" }
      const entries = identified.flatMap((entry) => {
        const ref = entry.requests[0]
        return ref ? [{ prefix: `${ref.target.recordId}:${ref.target.incarnation}`, row: entry.row }] : []
      })
      if (new Set(entries.map((entry) => entry.prefix)).size !== entries.length) return { status: "unavailable", reason: "duplicate-request-reference" }
      return { status: "ok", value: { ...stock, values: entries.flatMap((entry) => entry.row.values.map((value) => ({ ...value, id: `${entry.prefix}:${value.id}` }))), missing: entries.flatMap((entry) => entry.row.missing.map((missing) => ({ ...missing, field: `${entry.prefix}:${missing.field}` }))) } }
    },
    async describe(request, _context, projection) {
      if (request.viewId === "BI05") return { status: "ok", value: { viewId: "BI05", series: [{ id: "stock", label: "Estoque atual por etapa", unit: "requests", role: "stock", valueIds: projection.values.map((value) => value.id) }], limitations: ["Contagem de estoque atual; não representa coorte ou conversão.", ...(projection.values.some((value) => value.id === "stock:unknown") ? ["Pedidos com status desconhecido não são confirmados como abertos e permanecem em grupo próprio."] : [])] } }
      if (request.viewId === "BI06") return { status: "ok", value: { viewId: "BI06", series: [{ id: "aging", label: "Idade comprovada na etapa", unit: "days", role: "aging", valueIds: projection.values.filter((value) => value.id.endsWith(":ageDays")).map((value) => value.id) }], limitations: ["Pedidos sem idade comprovada permanecem na tabela como indisponíveis."] } }
      return { status: "unavailable", reason: "unsupported-view" }
    },
  }
}
