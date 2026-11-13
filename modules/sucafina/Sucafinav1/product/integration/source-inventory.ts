import { object, rows } from "../../runtime/contract.ts"
import type { Snapshot } from "../../runtime/contract.ts"
import type { Surface } from "../../src/identity.ts"
import { digestSfValue } from "../contracts/canonical.ts"
import type { SfSourceIdentityInput } from "./source-lifecycle.ts"
import { DashboardBudget } from "../../runtime/dashboard-budget.ts"
import { DashboardPeople } from "../../runtime/dashboard-people.ts"
import { DashboardOperations } from "../../runtime/dashboard-operations.ts"
import { DashboardPortfolio } from "../../runtime/dashboard-portfolio.ts"
import { publicSfData } from "./public-state.ts"

/** Private lifecycle inventory, not an authorized business projection or a calculation engine. */
export function enumerateSfSources(surface: Surface, snapshot: Snapshot): readonly SfSourceIdentityInput[] {
  if (surface === "planner") {
    const versions = Array.isArray(snapshot.data.versions)
      ? rows(snapshot.data.versions).map((value) => ({ key: String(value.id ?? ""), value }))
      : Object.entries(object(snapshot.data.versions)).map(([key, value]) => ({ key: String(object(value).id ?? key), value }))
    return versions.map(({ key, value }) => ({ recordType: "planner-version", recordId: key, inputDigest: digestSfValue({ value,
      entities: snapshot.data.entities === undefined ? object(snapshot.data.app).entities : snapshot.data.entities,
      allocations: snapshot.data.allocations === undefined ? object(snapshot.data.app).allocations : snapshot.data.allocations,
      officials: snapshot.data.officials, officialId: snapshot.data.officialId, appOfficialId: object(snapshot.data.app).officialId,
      versionIdentities: versions.map((entry) => ({ key: entry.key, id: object(entry.value).id, year: object(entry.value).year })),
    }) }))
  }
  if (surface === "procurement") {
    const store = object(snapshot.data.store)
    return [
      ...Object.entries(object(store.requests)).map(([id, value]) => ({ recordType: "procurement-request", recordId: id, inputDigest: digestSfValue(value) })),
      ...rows(store.suppliers).map((value) => ({ recordType: "procurement-supplier", recordId: String(value.id ?? ""), inputDigest: digestSfValue(value) })),
    ]
  }
  const records = Object.entries(snapshot.data).filter(([key]) => key !== "__sfProductV1").flatMap(([collection, value]) => rows(value)
    .filter((record) => typeof record.id === "string" || typeof record.id === "number")
    .map((record) => ({ recordType: collection, recordId: String(record.id), inputDigest: digestSfValue(record) })))
  // A page selection is a real aggregate source. Conservative revisioning never grants visibility;
  // the producer's actor-filtered projection and scoped fingerprint still decide material equality.
  return [...records, ...[...DashboardBudget.pages, ...DashboardPeople.pages, ...DashboardOperations.pages, ...DashboardPortfolio.pages]
    .map((page) => ({ recordType: "dashboard-page", recordId: page, inputDigest: digestSfValue({ page, data: publicSfData(snapshot.data) }) }))]
}
