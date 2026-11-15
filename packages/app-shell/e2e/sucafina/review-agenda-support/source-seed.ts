import type { openLocalStore } from "../../../../../modules/sucafina/Sucafinav1/runtime/local-store.ts"
import type { Snapshot } from "../../../../../modules/sucafina/Sucafinav1/runtime/contract.ts"
import { ProcurementModule } from "../../../../../modules/sucafina/Sucafinav1/runtime/procurement.ts"
import { firstAgendaCorpus, firstAgendaVersions } from "./source-corpus.ts"

function requireEmpty(snapshot: Snapshot) {
  if (Object.keys(snapshot.data).length || Object.keys(snapshot.versions).length || snapshot.audit.length || snapshot.sfSources)
    throw new Error("First-agenda sources refuse to overwrite an existing installation")
}

/** Called by Reports36's existing setup process before the real production CLI starts. */
export async function seedFirstAgendaSources(store: Pick<Awaited<ReturnType<typeof openLocalStore>>, "transaction">,
  principal: string, today: string, year: number) {
  await store.transaction("dashboard", async (snapshot) => {
    if (snapshot.sfSources || ["opsCats", "opsTickets", "risks"].some((key) => Object.hasOwn(snapshot.data, key)))
      throw new Error("First-agenda monthly sources refuse to overwrite existing data")
    snapshot.data.opsCats = ["Infrastructure"]
    snapshot.data.opsTickets = [{
      id: "reports-agenda-ops-01", year, month: 1,
      "Infrastructure|Incidents|Open": 3, "Infrastructure|Incidents|Closed": 2,
      "Infrastructure|Incidents|Initial Balance": 0,
      "Infrastructure|Service Requests|Open": 0, "Infrastructure|Service Requests|Closed": 0,
      "Infrastructure|Service Requests|Initial Balance": 0,
    }]
    snapshot.data.risks = []
    snapshot.versions["opsTickets:reports-agenda-ops-01"] = { version: 1, by: principal }
    return { commit: true, value: undefined }
  })
  await store.transaction("planner", async (snapshot) => {
    requireEmpty(snapshot)
    const versions = firstAgendaVersions(year)
    // Canonical Planner source shape already used by WP07's browser fixture.
    // The real installed source lifecycle issues all selectors after startup.
    snapshot.data = { versions, officials: { [String(year)]: firstAgendaCorpus.baselineId }, access: { [principal]: { assigned: [], domains: [] } } }
    snapshot.versions = Object.fromEntries(versions.map((version) => [`versions:${version.id}`, { version: 1, by: principal }]))
    snapshot.versions[`officials:${year}`] = { version: 1, by: principal }
    return { commit: true, value: undefined }
  })
  await store.transaction("procurement", async (snapshot) => {
    requireEmpty(snapshot)
    const actor = { id: principal, roles: ["admin", "buyer"], canWrite: true }
    const environment = { at: `${today}T12:00:00.000Z`, id: () => "reports-agenda-source", directory: [{ id: principal, name: "Reports operator" }] }
    // Reuse the actual domain transitions and their CAS/version bookkeeping.
    // No request projection or review evidence is fabricated by the fixture.
    for (const command of [
      { page: "Settings", action: "reset", version: 0, values: {} },
      { page: "Requests", action: "create", version: 0, values: { title: firstAgendaCorpus.requestTitle, estAmount: 75, expenseType: "opex" } },
    ]) {
      const result = ProcurementModule.domain.execute(snapshot, actor, command, environment)
      if (!result.ok) throw new Error(`First-agenda source setup rejected: ${result.status} ${(result.errors ?? []).join(", ")}`)
    }
    return { commit: true, value: undefined }
  })
}
