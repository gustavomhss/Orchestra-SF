import { hotTopicView } from "../../runtime/dashboard-people.ts"
import { DashboardPortfolio } from "../../runtime/dashboard-portfolio.ts"
import { rows, text, finite } from "../../runtime/contract.ts"
import type { Actor, Environment, Snapshot } from "../../runtime/contract.ts"
import { dashboardPages } from "../../src/nav.ts"
import { riskScore } from "../../src/dashboard-accounts.ts"

export function dashboardSignals(snapshot: Snapshot, actor: Actor, environment: Environment) {
  if (!Number.isFinite(Date.parse(environment.at))) return []
  const summaries = Array.isArray(snapshot.data.summaries) ? snapshot.data.summaries.filter((x): x is string => typeof x === "string") : []
  const allowed = dashboardPages(actor, summaries)
  const topics = allowed.includes("Hot Topics & Actions") ? hotTopicView(snapshot, actor) : []
  const portfolio = DashboardPortfolio.domain.view(snapshot, actor, environment).data
  // Persisted numeric IDs use the same identity as their source inventory and canonical routes.
  const recordId = (value: unknown) => typeof value === "string" && value.trim() ? value : typeof value === "number" && Number.isFinite(value) ? String(value) : ""
  const uniqueIds = (value: unknown) => {
    const counts = rows(value).reduce((result, row) => {
      const id = recordId(row.id)
      if (id) result.set(id, (result.get(id) ?? 0) + 1)
      return result
    }, new Map<string, number>())
    return new Set([...counts].filter(([, count]) => count === 1).map(([id]) => id))
  }
  const topicIds = uniqueIds(topics)
  const riskIds = allowed.includes("IT Risks") ? uniqueIds(portfolio.risks) : new Set<string>()
  const contractIds = allowed.includes("Vendor Contracts") ? uniqueIds(portfolio.contracts) : new Set<string>()
  const today = new Date(environment.at).toISOString().slice(0, 10)
  const validDate = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value
  const actionSignals = topics.flatMap((row) => {
    const due = text(row.due)
    if (!topicIds.has(recordId(row.id)) || !["open", "progress", "blocked"].includes(text(row.status)) || !validDate(due) || due >= today) return []
    return [{ id: `hotTopics:${recordId(row.id)}`, page: "Hot Topics & Actions", recordId: recordId(row.id), fact: text(row.action), rule: "Open action past due date", date: due }]
  })
  const riskSignals = allowed.includes("IT Risks") ? rows(portfolio.risks).flatMap((row) => {
    if (!riskIds.has(recordId(row.id)) || !["open", "mitigating", "monitoring"].includes(text(row.status)) || riskScore(finite(row.impact), finite(row.probability)) < 16) return []
    return [{ id: `risks:${recordId(row.id)}`, page: "IT Risks", recordId: recordId(row.id), fact: text(row.title) || text(row.name), rule: "Open risk with impact × probability at least 16", date: text(row.due) }]
  }) : []
  const renewalLimit = new Date(`${today}T00:00:00Z`)
  renewalLimit.setUTCDate(renewalLimit.getUTCDate() + 90)
  const limit = Number.isFinite(renewalLimit.getTime()) ? renewalLimit.toISOString().slice(0, 10) : ""
  const contractSignals = allowed.includes("Vendor Contracts") && limit ? rows(portfolio.contracts).flatMap((row) => {
    const renewal = text(row.renewal)
    if (!contractIds.has(recordId(row.id)) || !validDate(renewal) || renewal < today || renewal > limit) return []
    return [{ id: `contracts:${recordId(row.id)}`, page: "Vendor Contracts", recordId: recordId(row.id), fact: text(row.vendor) || text(row.name), rule: "Renewal within 90 days", date: renewal }]
  }) : []
  return [...actionSignals, ...riskSignals, ...contractSignals].sort((a, b) => (a.date || "9999").localeCompare(b.date || "9999") || a.id.localeCompare(b.id))
}
