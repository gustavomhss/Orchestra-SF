import { expect, test } from "bun:test"
import { memoryFixture, memoryCase, memoryPeriod } from "./memory-fixture.ts"
import { materialSelection, memoryOutcomeSelection, memorySignalSelection } from "../../../../../../../apps/cli/src/sucafina-product/memory-selection.ts"
import { digestSfValue } from "../../../../product/contracts/canonical.ts"
import { SF_SIGNAL_REGISTRY_PREFIX } from "../../../../product/decision-memory/signal-registry.ts"

test("registered condition IDs select exact material changes and retain the full original criterion set", async () => {
  const fixture = await memoryFixture()
  try {
    expect(await fixture.register()).toEqual({ status: "ok" })
    expect(await fixture.register({ ...fixture.signal, criterionId: "quality", label: "Quality remains satisfied" })).toEqual({ status: "ok" })
    const listed = await fixture.memory.conditions(memoryCase, fixture.context)
    if (listed.status !== "ok") throw new Error(listed.reason)
    expect(listed.value).toHaveLength(2)
    const condition = listed.value.find((entry) => entry.criterionId === "cost")!
    const request = { skillId: "sf-reavaliar-compromissos", caseRef: memoryCase }
    const selection = { choiceId: "choice", materialChangeIds: [condition.conditionId], confirmedDependencyRefIds: [] }
    const payload = { request, selection }
    const scope = materialSelection(request, selection)
    if (!scope) throw new Error("Explicit material selection missing")
    const call = await fixture.admit("analysis.prepare", payload)
    try {
      expect(await fixture.memory.selectedMaterialChanges(memoryCase, call)).toEqual({ status: "unavailable", reason: "materiality-selection-required" })
      const result = await fixture.memory.withMaterialSelection(call, { action: "analysis.prepare", payload, ...scope }, () => fixture.memory.selectedMaterialChanges(memoryCase, call))
      if (result.status !== "ok") throw new Error(result.reason)
      expect(result.value.map((entry) => entry.condition.id)).toEqual([condition.conditionId])
      expect(result.value[0]!.condition.choice).toEqual(fixture.choice)
      expect(result.value[0]!.change.before).toEqual([fixture.source])
      expect(result.value[0]!.change.after).toEqual([fixture.source])
      expect(result.value[0]!.change.comparison?.after.criterionResults.map((entry) => entry.criterionId)).toEqual(["cost", "quality"])
      expect(result.value[0]!.change.comparison?.after.criterionResults[0]!.state).toBe("failed")
      expect(await fixture.memory.selectedMaterialChanges(memoryCase, call)).toEqual({ status: "unavailable", reason: "materiality-selection-required" })
      expect(await fixture.memory.withMaterialSelection(call, { action: "analysis.prepare", payload, ...scope, conditionIds: ["fabricated"] },
        () => fixture.memory.selectedMaterialChanges(memoryCase, call))).toMatchObject({ status: "denied" })
      expect(await fixture.memory.withMaterialSelection(structuredClone(call), { action: "analysis.prepare", payload, ...scope },
        () => fixture.memory.selectedMaterialChanges(memoryCase, call))).toMatchObject({ status: "denied" })
      await expect(fixture.memory.withMaterialSelection(call, { action: "analysis.prepare", payload, ...scope }, async () => { throw new Error("consumer failed") })).rejects.toThrow("consumer failed")
      expect(await fixture.memory.selectedMaterialChanges(memoryCase, call)).toEqual({ status: "unavailable", reason: "materiality-selection-required" })
    } finally { fixture.human.finish(call) }
    const unchanged = await fixture.readState()
    if (unchanged.status !== "ok") throw new Error("State unavailable")
    expect(unchanged.value.cases[memoryCase.id]!.choices).toEqual([fixture.choice])
    expect(await fixture.memory.prepareWatch({ caseRef: memoryCase.id, conditionRef: condition.conditionId, recipientRef: "person",
      recurrence: { recipeRef: "unadmitted-recipe", schedule: "daily", timezone: "UTC" } }, fixture.context))
      .toEqual({ status: "unavailable", reason: "native-watch-admission-port-unavailable" })
  } finally { await fixture.dispose() }
}, 60_000)

test("material signals reconcile durably once and do not resolve without an actual resolution proof", async () => {
  const fixture = await memoryFixture()
  try {
    expect(await fixture.register()).toEqual({ status: "ok" })
    const first = await fixture.memory.signals(memoryCase, fixture.context)
    expect(first).toMatchObject({ status: "ok", signals: [{ action: "open", impact: { state: "material" } }] })
    const stored = await fixture.readState()
    if (stored.status !== "ok") throw new Error("State unavailable")
    expect(Object.entries(stored.value.preferences).filter(([key]) => key.startsWith(SF_SIGNAL_REGISTRY_PREFIX))).toHaveLength(1)
    const second = await fixture.memory.signals(memoryCase, fixture.context)
    expect(second).toMatchObject({ status: "ok", signals: [{ action: "none", impact: { state: "material" } }] })
    const repeated = await fixture.readState()
    if (repeated.status !== "ok") throw new Error("State unavailable")
    expect(repeated.storageVersion).toBe(stored.storageVersion)
    expect(repeated.value.cases[memoryCase.id]!.choices).toEqual([fixture.choice])
    await fixture.replaceActual()
    expect(await fixture.memory.signals(memoryCase, fixture.context)).toEqual({ status: "unavailable" })
    const stale = await fixture.readState()
    if (stale.status !== "ok") throw new Error("State unavailable")
    expect(stale.value.preferences).toEqual(repeated.value.preferences)
  } finally { await fixture.dispose() }
}, 60_000)

test("a real source write between selection and C08 commit prevents condition persistence", async () => {
  const fixture = await memoryFixture()
  try {
    const before = await fixture.readState()
    if (before.status !== "ok") throw new Error("State unavailable")
    fixture.controls.beforeTransaction = fixture.editSource
    expect(await fixture.register()).toEqual({ status: "unavailable" })
    const after = await fixture.readState()
    if (after.status !== "ok") throw new Error("State unavailable")
    expect(after.storageVersion).toBe(before.storageVersion)
    expect(after.value.preferences).toEqual(before.value.preferences)
    expect(await fixture.memory.registry.register({ ...fixture.signal, label: "A different intent" }, fixture.context)).toEqual({ status: "unavailable" })
  } finally { await fixture.dispose() }
}, 60_000)

test("outcomes use an explicitly selected closed-month actual and never substitute the latest source", async () => {
  const fixture = await memoryFixture()
  try {
    const actual = fixture.projection.values.find((entry) => entry.id.endsWith(":1:actual-usd") && entry.value === 100)
    if (!actual) throw new Error("Confirmed Planner observation unavailable")
    const selection = { caseRef: memoryCase, choiceId: "choice", criterionRef: "cost", valueId: actual.id, period: memoryPeriod, evidenceRefs: [fixture.source] }
    expect(memoryOutcomeSelection(selection)).toEqual(selection)
    const call = await fixture.admit("decisions.outcome.select", selection)
    try { expect(await fixture.memory.outcomeSelections.register(selection, call)).toEqual({ status: "ok" }) } finally { fixture.human.finish(call) }
    expect(await fixture.memory.outcomes({ caseRef: memoryCase, choiceId: "choice" }, fixture.context)).toMatchObject({
      status: "comparable", expected: 120, observed: 100, delta: -20, cutoff: "2027-01-31T23:59:59.999Z", summary: { causality: "not-attributed" },
    })
    const reviewed = await fixture.memory.reviewOutcome.read({ caseRef: memoryCase, choiceId: "choice", cutoff: "2027-01-31T23:59:59.999Z" }, fixture.context)
    expect(reviewed).toMatchObject({ status: "ready", observation: { expected: 120, observed: 100 } })
    if (reviewed.status !== "ready") throw new Error("Review observation unavailable")
    expect(await fixture.memory.reviewOutcome.authorize(fixture.context, [reviewed.observation])).toBe(true)
    expect(await fixture.memory.reviewOutcome.read({ caseRef: memoryCase, choiceId: "choice", cutoff: "2027-02-01T00:00:00Z" }, fixture.context)).toEqual({ status: "unavailable" })
    expect(await fixture.memory.reviewOutcome.authorize(fixture.context, [{ ...reviewed.observation, observed: 0 }])).toBe(false)
    await fixture.replaceActual()
    expect(await fixture.memory.outcomes({ caseRef: memoryCase, choiceId: "choice" }, fixture.context)).toEqual({ status: "unavailable" })
    expect(await fixture.memory.reviewOutcome.read({ caseRef: memoryCase, choiceId: "choice", cutoff: "2027-01-31T23:59:59.999Z" }, fixture.context)).toEqual({ status: "unavailable" })
  } finally { await fixture.dispose() }
}, 60_000)

test("private memory routes bind writes to the human intent and reread authority at egress", async () => {
  const fixture = await memoryFixture()
  try {
    const endpoint = "https://example.test/dashboard?sf=memory-condition"
    const wrongOriginRequest = new Request(endpoint, { method: "POST", headers: { authorization: "person", origin: "https://foreign.test", "content-type": "application/json" }, body: JSON.stringify(fixture.signal) })
    const wrongOrigin = await fixture.http(wrongOriginRequest, "dashboard")
    expect(wrongOrigin?.status).toBe(403)
    expect(wrongOriginRequest.bodyUsed).toBe(false)
    const wrongTypeRequest = new Request(endpoint, { method: "POST", headers: { authorization: "person", origin: "https://example.test", "content-type": "text/plain" }, body: JSON.stringify(fixture.signal) })
    expect((await fixture.http(wrongTypeRequest, "dashboard"))?.status).toBe(422)
    expect(wrongTypeRequest.bodyUsed).toBe(false)
    const cancellation = { called: false }
    const oversized = new ReadableStream<Uint8Array>({ start: (stream) => stream.enqueue(new Uint8Array(65_537)),
      cancel: () => { cancellation.called = true; return new Promise<void>(() => undefined) } })
    expect((await fixture.http(new Request(endpoint, { method: "POST", headers: { authorization: "person", origin: "https://example.test", "content-type": "application/json" }, body: oversized }), "dashboard"))?.status).toBe(422)
    expect(cancellation.called).toBe(true)
    const recorded = await fixture.http(new Request(endpoint, { method: "POST", headers: { authorization: "person", origin: "https://example.test", "content-type": "application/json", intention: "record" }, body: JSON.stringify(fixture.signal) }), "dashboard")
    expect(recorded?.status).toBe(200)
    const read = `https://example.test/dashboard?sf=memory-conditions&caseId=${memoryCase.id}&incarnation=${memoryCase.incarnation}&version=${memoryCase.version}`
    const response = await fixture.http(new Request(read, { headers: { authorization: "person" } }), "dashboard")
    expect(response?.status).toBe(200)
    expect(response?.headers.get("cache-control")).toBe("no-store")
    expect((await fixture.http(new Request(`${read}&choiceId=unrelated`, { headers: { authorization: "person" } }), "dashboard"))?.status).toBe(422)
    expect((await fixture.http(new Request(read.replace("version=1", "version=2"), { headers: { authorization: "person" } }), "dashboard"))?.status).toBe(403)
    expect(await fixture.http(new Request("https://example.test/other?sf=memory-catalog", { headers: { authorization: "person" } }), "dashboard")).toBeUndefined()
    fixture.access.allowed = false
    expect((await fixture.http(new Request(read, { headers: { authorization: "person" } }), "dashboard"))?.status).toBe(403)
    expect(await fixture.memory.conditions(memoryCase, fixture.context)).toMatchObject({ status: "unavailable" })
    expect(await fixture.memory.materiality(memoryCase, "invented", fixture.context)).toEqual({ status: "unavailable" })
  } finally { await fixture.dispose() }
}, 60_000)

test("material selection parsing rejects invented scope and duplicated identities", () => {
  const request = { skillId: "sf-reavaliar-compromissos", caseRef: memoryCase }
  const selection = { choiceId: "choice", materialChangeIds: ["condition"], confirmedDependencyRefIds: [] }
  expect(materialSelection(request, selection)).toEqual({ caseRef: memoryCase, choiceId: "choice", conditionIds: ["condition"] })
  expect(materialSelection(request, { ...selection, materialChangeIds: ["condition", "condition"] })).toBeUndefined()
  expect(materialSelection(request, { ...selection, changes: [] })).toBeUndefined()
  expect(materialSelection({ ...request, skillId: "sf-explicar-forecast" }, selection)).toBeUndefined()
  expect(materialSelection({ ...request, caseRef: { ...memoryCase, principalRef: "forged" } }, selection)).toBeUndefined()
  expect(memorySignalSelection({ source: "latest", refDigest: digestSfValue("forged") })).toBeUndefined()
  expect(memoryOutcomeSelection({ ...selection, observed: 0 })).toBeUndefined()
})
