import { expect, test } from "bun:test"
import { Schema } from "effect"
import { SfRoutinesRun } from "@orchestra/schema/sucafina/routines"
import { createSfHumanAuthority } from "../../../product/integration/human-authority.ts"
import { createSfUiAuthority } from "../../../product/integration/ui-authority.ts"
import { digestSfValue } from "../../../product/contracts/canonical.ts"
import { createSfRoutineHumanRun219, sfRoutineHumanRunCommand219 } from "../../../../../../apps/cli/src/sucafina-product/native-routine-producer219.ts"
import type { BusinessPorts } from "../../../product/contracts/ports.ts"

type RunInput = Parameters<BusinessPorts["routines"]["run"]>[0]
const command: RunInput = {
  admissionRef: "authorization-native-reference-only",
  expectedAdmissionVersion: 3,
  caseRef: { id: "case-negative-unit", incarnation: "case-inc-negative-unit", version: 2 },
}
const issued = { caseRef: command.caseRef, input: command }

function humanFixture() {
  // This identity exists only within this human-envelope unit test. It never issues
  // a native Task frame, C15 owner, provider credential or AM06 success witness.
  let ids = 0
  const identity = {
    installationId: "installation-unit", projectId: "project-unit",
    principalRef: "principal-unit", policyVersion: "policy-unit", accessRevision: "access-unit",
  }
  const ui = createSfUiAuthority({
    authorize: async () => identity, commandIdentity: async () => "command-unit",
    createId: () => "request-unit-" + ++ids, now: Date.now,
    privateCommands: ["sf-human:routines.run"],
  })
  const human = createSfHumanAuthority({ origin: "https://sf.example", ui })
  const cancellation = new AbortController()
  const request = new Request("https://sf.example/api/ui/routines/run", {
    method: "POST", signal: cancellation.signal,
    headers: { origin: "https://sf.example", "content-type": "application/json", "idempotency-key": "req-219-run" },
    body: JSON.stringify(issued),
  })
  return { ui, human, request, cancellation }
}

test("219 exact A09 {caseRef,input} command is distinct from native C15 intent", async () => {
  const original = sfRoutineHumanRunCommand219(command)
  expect(Schema.is(SfRoutinesRun.input)(original)).toBe(true)
  expect(digestSfValue(original)).toBe(digestSfValue(issued))
  const { human, request } = humanFixture()
  const result = await human.admit(request, "routines.run", issued)
  expect(result.status).toBe("ok")
  if (result.status !== "ok") return
  try {
    expect(await human.authorize(result.value, "routines.run", original)).toBe(true)
    expect(await human.authorize(result.value, "routines.run", {
      planRevisionId: "native-plan-selector", authorizationId: "native-auth-selector",
      inputDigest: "a".repeat(64), caseRef: command.caseRef,
    })).toBe(false)
  } finally {
    human.finish(result.value)
  }
})

test("219 forwards to the actual injected C07 run only with the same original live human Request", async () => {
  const { human, ui, request } = humanFixture()
  const result = await human.admit(request, "routines.run", issued)
  expect(result.status).toBe("ok")
  if (result.status !== "ok") return
  let called = 0
  const run = createSfRoutineHumanRun219({
    run: async () => {
      called++
      // A legitimate producer is still absent in this unit test; never fake an admitted Task/result.
      return { status: "needs-input", reason: "native-task-witness-not-part-of-unit-test" }
    },
    requestFor: (context) => context.kind === "ui" ? ui.requestFor(context) : undefined,
    authorize: (context, payload) => human.authorize(context, "routines.run", payload),
    current: () => true,
  })
  try {
    expect(await run(command, result.value)).toEqual({
      status: "needs-input", reason: "native-task-witness-not-part-of-unit-test",
    })
    expect(called).toBe(1)
    const altered = { ...command, expectedAdmissionVersion: 4 }
    expect(await run(altered, result.value)).toEqual({
      status: "denied", reason: "routine-human-origin-unavailable",
    })
    expect(called).toBe(1)
  } finally {
    human.finish(result.value)
  }
  expect(await run(command, result.value)).toEqual({
    status: "denied", reason: "routine-human-origin-unavailable",
  })
  expect(called).toBe(1)
})

test("219 aborting the original POST during the producer await denies the late outcome", async () => {
  const { human, ui, request, cancellation } = humanFixture()
  const result = await human.admit(request, "routines.run", issued)
  expect(result.status).toBe("ok")
  if (result.status !== "ok") return
  let called = 0
  const run = createSfRoutineHumanRun219({
    run: async () => {
      called++
      cancellation.abort()
      return { status: "needs-input", reason: "must-not-escape-after-revocation" }
    },
    requestFor: (context) => context.kind === "ui" ? ui.requestFor(context) : undefined,
    authorize: (context, payload) => human.authorize(context, "routines.run", payload),
    current: () => true,
  })
  try {
    expect(await run(command, result.value)).toEqual({
      status: "denied", reason: "routine-human-origin-unavailable",
    })
    expect(called).toBe(1)
  } finally {
    human.finish(result.value)
  }
})
