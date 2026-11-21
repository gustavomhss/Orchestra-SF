import type { Actor, Command, Environment, Snapshot } from "../../../../../modules/sucafina/Sucafinav1/runtime/contract"
import { rows } from "../../../../../modules/sucafina/Sucafinav1/runtime/contract"
import { PlannerModule } from "../../../../../modules/sucafina/Sucafinav1/runtime/planner"
import { waveFourPlannerData } from "./wave-four-planner-data"

/** Seed only through the producer; IDs, normalized values and revisions remain source-owned. */
export function seedWaveFourPlanner(snapshot: Snapshot, actor: Actor, environment: Environment, year: number): void {
  const execute = (command: Command) => {
    const result = PlannerModule.domain.execute(snapshot, actor, command, environment)
    if (!result.ok) throw new Error("Canonical wave-four Planner seed rejected: " + command.page + "/" + command.action +
      " (" + result.status + ") " + (result.errors ?? []).join("; "))
    return result.value
  }
  const create = (page: string, values: Record<string, unknown>) => {
    const id = execute({ page, action: "save", version: 0, values })
    if (typeof id !== "string" || !id) throw new Error("Canonical wave-four Planner seed omitted an ID")
    return id
  }
  const versions = rows(snapshot.data.versions).filter((version) => Number(version.year) === year)
  if (versions.length < 2) throw new Error("Wave-four Planner seed requires the two original wave-three versions")
  const entityRef = create("Entities & allocations", { collection: "entities", name: waveFourPlannerData.allocations.entity, code: "TEST-RS" })
  const secondEntityRef = create("Entities & allocations", { collection: "entities", name: waveFourPlannerData.allocations.secondEntity, code: "TEST-GO" })
  create("Entities & allocations", {
    collection: "allocations", name: waveFourPlannerData.allocations.allocation,
    desc: waveFourPlannerData.allocations.description,
    splits: [{ entityRef, percent: 65 }, { entityRef: secondEntityRef, percent: 35 }],
  })
  create("Entities & allocations", {
    collection: "allocations", name: waveFourPlannerData.allocations.classification, desc: "", splits: [],
  })
  const observedAt = new Date(Date.parse(environment.at) - 86_400_000).toISOString()
  for (const version of versions) {
    if (typeof version.id !== "string") throw new Error("Original Planner version omitted an ID")
    const versionId = version.id
    create("FX rates", {
      versionId, cur: waveFourPlannerData.fx.currency, rate: waveFourPlannerData.fx.rate,
      sourceRef: waveFourPlannerData.fx.sourceRef, provider: waveFourPlannerData.fx.provider, observedAt,
    })
    // Missing and recorded zero are separate source states. BRL has no rate; the zero card is a valid USD record.
    create("FX rates", { versionId, cur: waveFourPlannerData.fx.missingCurrency, rate: "", sourceRef: "", provider: "", observedAt: "" })
    const rateId = create("Headcount", {
      versionId, collection: "rates", name: waveFourPlannerData.headcount.rate,
      locs: "São Paulo", annual: waveFourPlannerData.headcount.rateAnnual, cur: "USD",
    })
    create("Headcount", {
      versionId, collection: "rates", name: waveFourPlannerData.headcount.zeroRate, locs: "Geneva", annual: 0, cur: "USD",
    })
    create("Headcount", {
      versionId, collection: "positions", name: waveFourPlannerData.headcount.position,
      title: "Regional infrastructure engineer", type: "Employee", location: "São Paulo",
      include: true, fte: 1, start: 1, end: 12, domain: "Infrastructure", rateId,
    })
    create("Headcount", {
      versionId, collection: "positions", name: waveFourPlannerData.headcount.partial,
      title: "Applications specialist", type: "Contractor", location: "Geneva",
      include: true, fte: 0.5, start: 4, end: 12, domain: "Applications", rateId,
    })
    create("Headcount", {
      versionId, collection: "positions", name: waveFourPlannerData.headcount.unpriced,
      title: "Service delivery analyst", type: "Employee", location: "",
      include: false, fte: 1, start: 7, end: 12, domain: "",
    })
    execute({
      page: "Headcount", action: "save", version: snapshot.versions[versionId + ":increase"]?.version ?? 0,
      values: { versionId, collection: "increase", inc: 3.5, incMonth: 7 },
    })
  }
}
