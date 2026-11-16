import { expect, test } from "bun:test"
import { SessionSchema } from "@orchestra/core/session/schema"
import { SF_ROUTINE_PHASE_SCOPE, sfRoutinePhaseArsenalAllowed } from "../../../../../../apps/cli/src/sucafina-product/routine-native-phase-scope.ts"

test("phase root declares exact bounded module tools, not a generic host agent or unrestricted Arsenal", () => {
  expect(SF_ROUTINE_PHASE_SCOPE.skills.entry).toBe("maestro-run-governed")
  expect(SF_ROUTINE_PHASE_SCOPE.budgets).toEqual({ loads: 0, toolCalls: 128 })
  for (const name of ["bash", "read", "write", "edit", "webfetch", "dock_action", "maestro_arsenal_catalog"])
    expect(SF_ROUTINE_PHASE_SCOPE.tools.includes(name)).toBe(false)
  const root = SessionSchema.ID.create()
  const invocation = { tool: "maestro_arsenal_execute", sessionID: root, callID: "call", args: {
    name: "relay-arm", arguments: { action: "arm", contract: { sessionID: root, label: "Approved workflow" } },
  } }
  expect(sfRoutinePhaseArsenalAllowed(invocation, root)).toBe(true)
  expect(sfRoutinePhaseArsenalAllowed({ ...invocation, args: { ...invocation.args, name: "shell" } }, root)).toBe(false)
  expect(sfRoutinePhaseArsenalAllowed({ ...invocation, args: { name: "relay-arm", arguments: { action: "release" } } }, root)).toBe(false)
  expect(sfRoutinePhaseArsenalAllowed({ ...invocation, args: { name: "relay-arm", arguments: { action: "arm", contract: {
    sessionID: root, label: "Injected", chain: [{ command: "arbitrary" }],
  } } } }, root)).toBe(false)
})
