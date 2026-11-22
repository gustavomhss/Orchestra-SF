import { expect, test } from "bun:test"
import { SfCollaboration } from "@orchestra/schema/sucafina/collaboration"
import type { ConfirmationCommand } from "../../../../product/contracts/context.ts"
import { confirmationSelectionFixture } from "./confirmation-selection-fixture.ts"

type Fixture = Awaited<ReturnType<typeof confirmationSelectionFixture>>
const project = (value: Fixture) => value.transport.execute(
  SfCollaboration.operations["collaboration.confirmation-project"],
  { selectionRef: value.observation.selectionRef! }, { signal: new AbortController().signal },
)
function mutation(value: Fixture, idempotencyKey: string): ConfirmationCommand {
  return { scope: value.scope, observedSourceVersion: value.observation.sourceVersion,
    expectedScopeFingerprint: value.observation.scopeFingerprint, expectedStorageVersion: 0, idempotencyKey }
}

test("native C06 HTTP reopens an unchanged SQLite selection without changing source or confirmation state", async () => {
  const value = await confirmationSelectionFixture()
  try {
    const source = await value.sourceSnapshot()
    const result = await project(value)
    expect(result.kind).toBe("response")
    if (result.kind !== "response") throw new Error("HTTP selection transport failed")
    expect(result.status).toBe(200)
    expect(result.body.status).toBe("ok")
    if (result.body.status !== "ok" || !("kind" in result.body.value)) throw new Error(JSON.stringify(result.body))
    expect(result.body.value.kind).toBe("prepared-selection")
    expect(result.body.value.scope).toEqual(value.scope)
    expect(result.body.value.observation.scopeFingerprint).toBe(value.observation.scopeFingerprint)
    expect(result.body.value.observation.sourceVersion).toBe(value.observation.sourceVersion)
    expect(result.body.value.scope.materialDependencies).toHaveLength(1)
    expect(await value.sourceSnapshot()).toEqual(source)
    expect(await value.storage()).toBe(0)
  } finally { await value.close() }
}, 120_000)

test("native C06 HTTP refuses a source or dependency changed after preparing the selection", async () => {
  for (const record of ["project", "dependency"] as const) {
    const value = await confirmationSelectionFixture()
    try {
      await value.save(record, 350, 1)
      const current = await value.sourceSnapshot()
      const result = await project(value)
      expect(result.kind).toBe("response")
      if (result.kind !== "response") throw new Error("HTTP selection transport failed")
      expect(result.status).toBe(409)
      expect(result.body).toMatchObject({ status: "stale", reason: "confirmation-selection-changed" })
      expect("value" in result.body).toBe(false)
      expect(await value.sourceSnapshot()).toEqual(current)
      expect(await value.storage()).toBe(0)
    } finally { await value.close() }
  }
}, 120_000)

test("native C06 HTTP selection read keeps the original C08 CAS and idempotent receipt", async () => {
  const value = await confirmationSelectionFixture(false)
  try {
    const selected = await project(value)
    expect(selected.kind === "response" && selected.body.status === "ok").toBe(true)
    const operation = SfCollaboration.operations["collaboration.confirmation-confirm"]
    const command = mutation(value, "original-confirmation")
    const options = { signal: new AbortController().signal, idempotencyKey: command.idempotencyKey }
    const first = await value.transport.execute(operation, command, options)
    expect(first.kind).toBe("response")
    if (first.kind !== "response") throw new Error("HTTP confirmation transport failed")
    expect(first.status).toBe(200)
    expect(first.body.status).toBe("ok")
    expect(await value.storage()).toBe(1)
    const replay = await value.transport.execute(operation, command, { ...options, retry: "same-intent" })
    expect(replay).toEqual(first)
    expect(await value.storage()).toBe(1)
    const conflict = await value.transport.execute(operation, mutation(value, "different-confirmation"), {
      signal: new AbortController().signal, idempotencyKey: "different-confirmation",
    })
    expect(conflict.kind).toBe("response")
    if (conflict.kind !== "response") throw new Error("HTTP conflict transport failed")
    expect(conflict.status).toBe(409)
    expect(conflict.body.status).toBe("conflict")
    expect(await value.storage()).toBe(1)
  } finally { await value.close() }
}, 120_000)

test("native C06 HTTP rechecks read authority and hides the selection after revocation", async () => {
  const value = await confirmationSelectionFixture()
  try {
    value.control.active = false
    const denied = await project(value)
    expect(denied.kind).toBe("response")
    if (denied.kind !== "response") throw new Error("HTTP selection transport failed")
    expect(denied.status).toBe(403)
    expect(denied.body.status).toBe("denied")
    expect("value" in denied.body).toBe(false)
    value.control.active = true
    expect(await value.storage()).toBe(0)
  } finally { await value.close() }
}, 120_000)
