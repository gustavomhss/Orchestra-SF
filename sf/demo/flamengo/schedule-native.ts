/**
 * IN-PROCESS ONLY. Invoked by the real installed host after authenticating Daniel
 * and acquiring a trusted UI context. NOT an HTTP route, seed impersonation,
 * background daemon, substitute scheduler or completed-C07 assertion.
 */
import { createRoutineSchedule, type ScheduleHost } from "../../../modules/sucafina/Sucafinav1/product/routines/schedule.ts"
import type { BusinessPorts } from "../../../modules/sucafina/Sucafinav1/product/contracts/ports.ts"
import type { TrustedDomainContext } from "../../../modules/sucafina/Sucafinav1/product/contracts/sf-execution.ts"

type Binding = { id: string; conditionRef: string; recipeRef: string; recurrence: string; timezone: string }
type Gate = { fixtureId: string; state: "PENDING" | "CREATED_PENDING_C07"; scheduleRef?: string; reason: string }

/** Never fabricate recipe/condition refs. The host must own them and their admission. */
export async function seedFlamengoNativeSchedules(input: {
  host: ScheduleHost
  ports: BusinessPorts["schedules"]
  context: TrustedDomainContext
  fixtures: readonly Binding[]
}): Promise<readonly Gate[]> {
  if (input.context.kind !== "ui" || !input.host.occurrences)
    return input.fixtures.map(item => ({ fixtureId: item.id, state: "PENDING", reason: "trusted UI or occurrence port unavailable" }))
  const schedule = createRoutineSchedule(input.host, input.ports)
  const listed = await schedule.list(input.context)
  if (listed.status !== "ok")
    return input.fixtures.map(item => ({ fixtureId: item.id, state: "PENDING", reason: "schedules.list: " + listed.status }))
  const bindings = []
  for (const record of listed.value) {
    const read = await input.host.occurrences.read(record.scheduleRef, input.context)
    if (read.status !== "ok") return input.fixtures.map(item => ({ fixtureId: item.id, state: "PENDING", reason: "readback unavailable: " + read.status }))
    bindings.push(read.value)
  }
  const observations: Gate[] = []
  for (const fixture of input.fixtures) {
    if (!fixture.conditionRef?.trim() || !fixture.recipeRef?.trim() || !fixture.recurrence?.trim() || !fixture.timezone?.trim()) {
      observations.push({ fixtureId: fixture.id, state: "PENDING", reason: "missing host-qualified condition/recipe/cadence" })
      continue
    }
    const matching = bindings.filter(existing =>
      existing.conditionRef === fixture.conditionRef && existing.recipeRef === fixture.recipeRef &&
      existing.principalRef === input.context.binding.principalRef &&
      existing.projectId === input.context.binding.projectId)
    if (matching.length !== 0) {
      observations.push({fixtureId: fixture.id, state: "PENDING", reason: matching.length > 1
        ? "duplicate schedule binding: owner must reconcile" : "schedule binding exists; recurrence + native occurrence still require independent check",
        ...(matching.length === 1 ? {scheduleRef: matching[0]!.scheduleRef} : {})})
      continue
    }
    const created = await schedule.create({conditionRef: fixture.conditionRef, recipeRef: fixture.recipeRef,
      recurrence: fixture.recurrence, timezone: fixture.timezone}, input.context)
    if (created.status !== "ok") observations.push({fixtureId: fixture.id,state:"PENDING",reason:"native schedule admission: "+created.status})
    else observations.push({fixtureId: fixture.id,state:"CREATED_PENDING_C07",scheduleRef:created.value.scheduleRef,
      reason:"host-owned created receipt; terminal occurrence, admission, recurrence and output still unproved"})
  }
  return observations
}
