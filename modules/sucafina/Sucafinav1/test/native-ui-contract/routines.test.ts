import { describe, expect, test } from "bun:test"
import { Option, Schema } from "effect"
import {
  SfRoutines, SfRoutinesPrepareAdmission, SfRoutinesRun,
  SfSchedulesRead, SfSchedulesUpdate,
} from "@orchestra/schema/sucafina/routines"
import { createSfRoutinesHandlers } from "../../../../../apps/cli/src/sucafina-product/native-ui/routines.ts"
import type { SfNativeHostDependencies } from "../../../../../apps/cli/src/sucafina-product/native-ui/router.ts"
import type { SfHostServices } from "../../product/contracts/host-context.ts"

const ORIGIN = "https://sf.test"
const MOUNT = "/sucafina"
const caseRef = { id: "case-1", incarnation: "inc-1", version: 3 }

function deps(runtime?: SfHostServices): SfNativeHostDependencies {
  // Test-only host: deliberately has no producer, installation or grant by
  // default. A fake HTTP response is NOT Native41/Schedule qualification.
  return {
    origin: ORIGIN, mount: MOUNT,
    application: {} as SfNativeHostDependencies["application"],
    runtime: () => runtime,
    readContext: async () => ({ status: "unavailable", reason: "host-unavailable" }),
  }
}
function handler(operation: keyof typeof SfRoutines.operations, runtime?: SfHostServices) {
  const entry = createSfRoutinesHandlers(deps(runtime)).find((item) => item.operationId === operation)
  if (!entry) throw new Error("MISSING_A09_HANDLER")
  return entry.handle
}
function post(operation: string, input: unknown, headers: Record<string, string> = {}) {
  const group = operation.split(".")[0]!
  const route = operation.slice(group.length + 1)
  return new Request(`${ORIGIN}${MOUNT}/api/ui/${group}/${route}`, {
    method: "POST", body: JSON.stringify(input),
    headers: { Origin: ORIGIN, "Content-Type": "application/json",
      "Idempotency-Key": "a09-test-0001", ...headers },
  })
}
function authenticatedHost(outcome: "ok" | "denied" = "ok"): SfHostServices {
  const binding = { kind: "ui", binding: { installationId: "install", projectId: "project",
    principalRef: "principal", policyVersion: "policy", accessRevision: "access",
    requestId: "request", expiresAt: "2100-01-01T00:00:00Z" }, lease: {} }
  // The fake admission is scoped to tests of the negative 'missing port'
  // behavior only; no operational success or inventory is synthesized.
  return {
    human: {
      admit: async () => outcome === "denied"
        ? { status: "denied", reason: "explicit-grant-required" }
        : { status: "ok", value: binding },
      authorize: async () => outcome === "ok",
      finish: () => {},
    },
    ui: {
      admit: async () => outcome === "denied"
        ? { status: "denied", reason: "explicit-grant-required" }
        : { status: "ok", value: binding },
      validate: async () => outcome === "ok",
      revalidate: async () => outcome === "ok",
      finish: () => {},
    },
  } as unknown as SfHostServices
}

describe("A09 schema equivalence and authority boundary", () => {
  test("publishes exactly twelve frozen operation IDs", () => {
    expect(Object.keys(SfRoutines.operations).sort()).toEqual([
      "projection.routine", "routines.catalog", "routines.prepare-admission",
      "routines.read-admission", "routines.read-run", "routines.run",
      "schedules.create", "schedules.list", "schedules.pause",
      "schedules.read", "schedules.read-run", "schedules.update",
    ].sort())
  })

  test("retains zero, null and absent independently without allowing private fields", () => {
    const original = { caseRef, input: { publishedRecipeRef: "r1", planRevisionId: "p1",
      writeScope: [], inputRefs: [],
      parameters: { observedZero: 0, observedNull: null, observedFalse: false } } }
    const decoded = Schema.decodeUnknownOption(SfRoutinesPrepareAdmission.input, {
      onExcessProperty: "error",
    })(original)
    expect(Option.isSome(decoded)).toBe(true)
    if (Option.isSome(decoded)) expect(decoded.value).toEqual(original)
    const secret = Schema.decodeUnknownOption(SfRoutinesPrepareAdmission.input, {
      onExcessProperty: "error",
    })({ ...original, privilegedSnapshot: { secret: true } })
    expect(Option.isNone(secret)).toBe(true)
    const missing = Schema.decodeUnknownOption(SfSchedulesRead.input, {
      onExcessProperty: "error",
    })({})
    expect(Option.isNone(missing)).toBe(true)
  })

  test("rejects unknown operation input, duplicate authority fields and extra Schedule keys", async () => {
    const send = handler("schedules.create")
    expect((await send(post("schedules.create", {
      conditionRef: "c", recipeRef: "r", recurrence: "daily", timezone: "UTC",
      credentials: "not allowed",
    }))).status).toBe(400)
    expect((await send(post("schedules.create", {
      conditionRef: "c", recipeRef: "r", recurrence: "daily", timezone: "UTC",
    }, { "Idempotency-Key": "bad" }))).status).toBe(400)
    expect((await send(post("schedules.create", {
      conditionRef: "c", recipeRef: "r", recurrence: "daily", timezone: "UTC",
    }, { Origin: "https://foreign.test" }))).status).toBe(403)
  })

  test("refuses run when inner caseRef and current envelope differ, before authorization", async () => {
    const mismatched = { caseRef, input: { admissionRef: "admission-1", expectedAdmissionVersion: 0,
      caseRef: { ...caseRef, incarnation: "wrong" } } }
    expect(Option.isSome(Schema.decodeUnknownOption(SfRoutinesRun.input)(mismatched))).toBe(true)
    const response = await handler("routines.run")(post("routines.run", mismatched))
    expect(response.status).toBe(400)
  })

  test("Schedule read requires a real optional details port after human admission", async () => {
    const response = await handler("schedules.read", authenticatedHost())(
      post("schedules.read", { scheduleRef: "schedule-1" }))
    expect(response.status).toBe(503)
    expect(await response.json()).toEqual({
      status: "unavailable", reason: "schedule-detail-port-unavailable",
    })
  })

  test("Schedule mutation has no execution or inventory without a native port", async () => {
    const response = await handler("schedules.create", authenticatedHost())(
      post("schedules.create", {
        conditionRef: "condition-1", recipeRef: "recipe-1", recurrence: "daily", timezone: "UTC",
      }))
    expect(response.status).toBe(503)
    expect(await response.json()).toEqual({
      status: "unavailable", reason: "native-schedule-port-unavailable",
    })
  })

  test("ungranted Schedule read fails before any inventory can be consulted", async () => {
    const response = await handler("schedules.list", authenticatedHost("denied"))(
      post("schedules.list", {}))
    expect(response.status).toBe(403)
    expect(await response.json()).toEqual({
      status: "denied", reason: "explicit-grant-required",
    })
  })

  test("no silent update without fresh authorized read port, even with version 0", async () => {
    const input = { scheduleRef: "schedule-1", expectedVersion: 0,
      recurrence: "daily", timezone: "UTC" }
    expect(Option.isSome(Schema.decodeUnknownOption(SfSchedulesUpdate.input)(input))).toBe(true)
    const response = await handler("schedules.update", authenticatedHost())(
      post("schedules.update", input))
    expect(response.status).toBe(503)
    expect(await response.json()).toEqual({
      status: "unavailable", reason: "schedule-detail-port-unavailable",
    })
  })

  test("routine projection rejects extra query fields before producer access", async () => {
    const response = await handler("projection.routine")(new Request(
      `${ORIGIN}${MOUNT}/api/ui/projections/routine?runRef=r&snapshot=true`, {
        headers: { Origin: ORIGIN },
      }))
    expect(response.status).toBe(400)
  })
})
