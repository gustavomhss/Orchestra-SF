import type { Period } from "../contracts/context.ts"
import type { Surface } from "../../src/identity.ts"
import { isSfPeriod } from "../contracts/validation.ts"
import type { DashboardPort, DomainPortHost, PortResult } from "../contracts/ports.ts"
import type { BusinessEvidenceRef } from "../contracts/business-context.ts"
import type { TrustedDomainContext } from "../contracts/sf-execution.ts"
import type { SfScopedSourcePort } from "../integration/source-lifecycle.ts"
import { createDashboardRecordSourceIssuer, createDashboardSourceIssuer } from "../integration/dashboard-sources.ts"
import { createDashboardRecordEvidenceHost } from "./sources.ts"

type RecordEvidence = Extract<BusinessEvidenceRef, { kind: "record" }>

/** Reissue from the current actor's Request; the target identifies data, never grants it. */
export function createDashboardConfirmationIssuer(input: { host: DomainPortHost; scopedSources: SfScopedSourcePort }) {
  const page = createDashboardSourceIssuer(input)
  const record = createDashboardRecordEvidenceHost({ ...input, issueRecord: createDashboardRecordSourceIssuer(input) })
  return async (target: { surface?: Surface; recordType: string; recordId: string; fields: readonly string[]; period?: Period }, context: TrustedDomainContext): Promise<PortResult<RecordEvidence>> => {
    if (!target || (target.surface !== undefined && target.surface !== "dashboard") || typeof target.recordType !== "string" || !target.recordType || typeof target.recordId !== "string" || !target.recordId || !Array.isArray(target.fields) || !target.fields.length || !isSfPeriod(target.period)) return { status: "needs-input", reason: "invalid-dashboard-target" }
    const period = target.period
    if (target.recordType === "dashboard-page") {
      const result = await page({ page: target.recordId, fields: target.fields, period }, context)
      return result.status === "ok" ? { status: "ok", value: result.value.evidence } : result
    }
    const pages: Record<string, string> = { hotTopics: "Hot Topics & Actions", opexOwners: "OPEX Detail", opexEntries: "OPEX Detail", capexProjects: "CAPEX Projects", capexEntries: "CAPEX Projects", members: target.fields.some((field) => ["cls", "outlook", "notes"].includes(field)) ? "Talent Review" : "Headcount Overview", leaders: "Headcount Overview", itUsersMonthly: "Headcount Overview", projects: "Portfolio Dashboard", risks: "IT Risks", contracts: "Vendor Contracts", stakeholders: "Stakeholder Management", itperf: "IT Performance Contract", opsTickets: "IT Operations", opsSLA: "IT Operations", opsHeatmap: "IT Operations", secKpi: "IT Security KPIs", secActions: "IT Security KPIs", secIncidents: "IT Security KPIs", secPhishing: "IT Security KPIs", budgetCurrentMonth: "Budget Overview", revenueByYear: "Budget Overview" }
    if (target.recordType === "budgetYtd") {
      const kind = (() => { try { const value: unknown = JSON.parse(target.recordId); return Array.isArray(value) ? value[0] : undefined } catch { return undefined } })()
      if (kind === "opex") pages.budgetYtd = "OPEX Detail"
      if (kind === "capex") pages.budgetYtd = "CAPEX Projects"
    }
    if (target.recordType === "deviations") {
      if (target.recordId.startsWith("opex-")) pages.deviations = "OPEX Detail"
      if (target.recordId.startsWith("capex-")) pages.deviations = "CAPEX Projects"
    }
    if (!Object.hasOwn(pages, target.recordType)) return { status: "unavailable", reason: "dashboard-target-unmapped" }
    return record.issue({ page: pages[target.recordType]!, recordType: target.recordType, recordId: target.recordId, fields: target.fields, period }, context)
  }
}

/** Routes back to the real authorized producer for the same scoped selector. */
export function createDashboardConfirmationProjectionReader(input: {
  dashboard: DashboardPort
  records: Pick<ReturnType<typeof createDashboardRecordEvidenceHost>, "read">
}) {
  return (selection: { reference: string; recordType: string; fields: readonly string[]; period: Period }, context: TrustedDomainContext) => selection.recordType === "dashboard-page"
    ? input.dashboard.read({ selectionRef: selection.reference, fields: selection.fields, period: selection.period }, context)
    : input.records.read(selection.reference, context)
}
