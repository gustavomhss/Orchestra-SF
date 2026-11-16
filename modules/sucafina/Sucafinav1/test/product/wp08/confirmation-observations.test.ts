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
  clock.now = Date.parse("2026-11-13T00:00:00Z")
  // The real UI authority discards an admission checked with an invalid clock.
  expect(await receipts.verifyObserved(command, a.value)).toBeUndefined()
  expect((await receipts.prepare(scope, read.value)).status).toBe("ok")
  const fresh = await human.admit(request("A"), "collaboration.confirmation.confirm", command)
  if (fresh.status !== "ok") throw new Error("fresh admission failed")
  clock.now = Date.parse("2026-11-12T23:59:59Z")
  expect(await receipts.verifyObserved(command, fresh.value)).toBeUndefined()
  clock.now = Date.parse("2026-11-13T00:00:00Z")
  expect(await receipts.verifyObserved(command, fresh.value)).toEqual({ physicalIncarnation: "physical-A", sourceFingerprint: "source-v1", dependencyFingerprint: "dependencies-v1" })
  clock.now += 5 * 60 * 1000
  const renewed = await human.admit(request("A"), "collaboration.confirmation.confirm", command)
  if (renewed.status !== "ok") throw new Error("renewed admission failed")
  expect(await receipts.verifyObserved(command, renewed.value)).toBeUndefined()
})

test("prepared selection references reobserve original scope, reject foreign and stale reads, and never renew", async () => {
  const clock = { now: Date.parse("2026-11-13T00:00:00Z") }
  const source = { version: 3, fingerprint: "source-v1" }
  const ui = createSfUiAuthority({ authorize: async (request) => ({ installationId: "install", projectId: "project", principalRef: request.headers.get("actor") || "", policyVersion: "policy", accessRevision: "access" }), commandIdentity: async () => "command", createId: () => crypto.randomUUID(), now: () => clock.now, privateCommands: [] })
  const read = async (actor: string) => {
    const admitted = await ui.admit(new Request("https://example.test/action", { headers: { actor } }), "sf_work_list", digestSfValue({}))
    if (admitted.status !== "ok" || !await ui.validate(admitted.value, "sf_work_list", digestSfValue({}))) throw new Error("read admission failed")
    return admitted.value
  }
  const scope = { sourceRef: { surface: "dashboard", type: "projects", id: "A", incarnation: "inc" }, fields: ["amount"], period: { start: "2027-01-01", end: "2027-01-31" }, materialDependencies: [], scopeDefinitionVersion: "1" } as const
  const receipts = createConfirmationObservationReceipts({ host: { requestFor: (context) => context.kind === "ui" ? ui.requestFor(context) : undefined, revalidate: async (context) => context.kind === "ui" && await ui.revalidate(context) },
    observe: async () => ({ state: "available" as const, sourceVersion: source.version, incarnation: "inc", physicalIncarnation: "physical", scopeFingerprint: "scope", sourceFingerprint: source.fingerprint, dependencyFingerprint: "dependencies" }),
    fence: async (_scope, observation) => observation.sourceFingerprint === source.fingerprint,
    now: () => clock.now })
  const a = await read("A")
  const prepared = await receipts.prepare(scope, a)
  if (prepared.status !== "ok") throw new Error("observation unavailable")
  const ref = prepared.value.selectionRef
  expect(ref).toMatch(/^confirmation-selection:[a-f0-9]{64}$/)
  expect(await receipts.readSelection(ref, a)).toMatchObject({ status: "ok", value: { selectionRef: ref, scope } })
  expect((await receipts.readSelection(ref, await read("B"))).status).toBe("unavailable")
  expect((await receipts.readSelection(ref + "x", a)).status).toBe("needs-input")
  source.fingerprint = "changed"
  expect((await receipts.readSelection(ref, a)).status).toBe("stale")
  source.fingerprint = "source-v1"
  clock.now += 5 * 60 * 1000
  expect((await receipts.readSelection(ref, await read("A"))).status).toBe("unavailable")
})
