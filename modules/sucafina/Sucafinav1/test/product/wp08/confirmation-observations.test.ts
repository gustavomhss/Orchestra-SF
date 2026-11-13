import { expect, test } from "bun:test"
import { createCollaborationHumanAuthority } from "../../../product/collaboration/human.ts"
import { createSfUiAuthority } from "../../../product/integration/ui-authority.ts"
import { createConfirmationObservationReceipts } from "../../../product/collaboration/confirmation-observations.ts"
import { digestSfValue } from "../../../product/contracts/canonical.ts"

test("observation receipts bind actor, scope, version and fingerprint and expire", async () => {
  const clock = { now: Date.parse("2026-11-13T00:00:00Z") }
  const current = { active: true }
  const ui = createSfUiAuthority({ authorize: async (request) => current.active ? { installationId: "install", projectId: "project", principalRef: request.headers.get("actor") || "", policyVersion: "policy", accessRevision: "access" } : undefined, commandIdentity: async () => "command", createId: () => "request", now: () => clock.now, privateCommands: ["sf-human:collaboration.confirmation.confirm"] })
  const human = createCollaborationHumanAuthority({ origin: "https://example.test", ui })
  const scope = { sourceRef: { surface: "dashboard", type: "projects", id: "A", incarnation: "inc" }, fields: ["amount", "currency"], period: { start: "2027-01-01", end: "2027-01-31" }, materialDependencies: [], scopeDefinitionVersion: "1" } as const
  const command = { scope, observedSourceVersion: 3, expectedScopeFingerprint: "scope-v1", expectedStorageVersion: 0, idempotencyKey: "confirm" }
  const request = (actor: string) => new Request("https://example.test/action", { method: "POST", headers: { origin: "https://example.test", actor } })
  const read = await ui.admit(request("A"), "sf_work_list", digestSfValue({}))
  if (read.status !== "ok" || !await ui.validate(read.value, "sf_work_list", digestSfValue({}))) throw new Error("read admission failed")
  const receipts = createConfirmationObservationReceipts({ host: { requestFor: (context) => context.kind === "ui" ? ui.requestFor(context) : undefined, revalidate: async (context) => context.kind === "ui" && await ui.revalidate(context) }, observe: async () => ({ state: "available" as const, sourceVersion: 3, incarnation: "inc", physicalIncarnation: "physical-A", scopeFingerprint: "scope-v1", sourceFingerprint: "source-v1", dependencyFingerprint: "dependencies-v1" }), now: () => clock.now })
  expect((await receipts.prepare(scope, read.value)).status).toBe("ok")
  const a = await human.admit(request("A"), "collaboration.confirmation.confirm", command)
  const b = await human.admit(request("B"), "collaboration.confirmation.confirm", command)
  if (a.status !== "ok" || b.status !== "ok") throw new Error("human admission failed")
  expect(await receipts.verifyObserved(command, a.value)).toEqual({ physicalIncarnation: "physical-A", sourceFingerprint: "source-v1", dependencyFingerprint: "dependencies-v1" })
  expect(await receipts.verifyObserved({ ...command, scope: { ...scope, fields: ["currency", "amount"] } }, a.value)).toEqual({ physicalIncarnation: "physical-A", sourceFingerprint: "source-v1", dependencyFingerprint: "dependencies-v1" })
  expect(await receipts.verifyObserved(command, b.value)).toBeUndefined()
  expect(await receipts.verifyObserved({ ...command, observedSourceVersion: 4 }, a.value)).toBeUndefined()
  expect(await receipts.verifyObserved({ ...command, expectedScopeFingerprint: "scope-v2" }, a.value)).toBeUndefined()
  clock.now = Number.NaN
  expect(await receipts.verifyObserved(command, a.value)).toBeUndefined()
  clock.now = Date.parse("2026-11-12T23:59:59Z")
  expect(await receipts.verifyObserved(command, a.value)).toBeUndefined()
  clock.now = Date.parse("2026-11-13T00:00:00Z")
  expect(await receipts.verifyObserved(command, a.value)).toBeDefined()
  clock.now += 5 * 60 * 1000
  const renewed = await human.admit(request("A"), "collaboration.confirmation.confirm", command)
  if (renewed.status !== "ok") throw new Error("renewed admission failed")
  expect(await receipts.verifyObserved(command, renewed.value)).toBeUndefined()
})
