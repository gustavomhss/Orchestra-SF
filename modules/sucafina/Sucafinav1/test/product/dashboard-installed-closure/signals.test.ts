import { expect, test } from "bun:test"
import { createDashboardProofFixture } from "./fixture.ts"
import { createDashboardSourceIssuer } from "../../../product/integration/dashboard-sources.ts"
import { dashboardSignals } from "../../../product/dashboard/signals.ts"
import { digestSfEvidenceRef } from "../../../product/contracts/canonical.ts"
import { object, rows } from "../../../runtime/contract.ts"

type Fixture = Awaited<ReturnType<typeof createDashboardProofFixture>>
const period = { start: "2026-01-01", end: "2026-12-31" }

async function signals(f: Fixture) {
  return f.read(async (context) => {
    const selection = await createDashboardSourceIssuer({ host: f.authority.host, scopedSources: f.persistence })({ page: "Executive Dashboard", fields: ["signals"], period }, context)
    expect(selection.status).toBe("ok")
    if (selection.status !== "ok") throw new Error("Real Executive Dashboard source issuance failed")
    const read = await f.dashboard.read({ selectionRef: selection.value.selectionRef, fields: ["signals"], period }, context)
    expect(read.status).toBe("ok")
    if (read.status !== "ok") throw new Error("Real Executive Dashboard signals could not be read")
    const facts = read.value.values.filter((value) => value.id.endsWith(".fact"))
    for (const value of facts) {
      const evidence = value.drilldown
      expect(evidence?.kind).toBe("record")
      if (evidence?.kind !== "record") throw new Error("Signal has no canonical record evidence")
      expect(evidence.refDigest).toBe(digestSfEvidenceRef(evidence))
      expect(value.sourceRefs).toEqual([evidence])
      const canonical = await f.records.read(evidence.refId, context)
      expect(canonical.status).toBe("ok")
      if (canonical.status !== "ok") throw new Error("Signal's authenticated canonical record could not be read")
      expect(canonical.value.context.principalRef).toBe(f.principal())
      expect(canonical.value.values.every((entry) => entry.sourceRefs.every((source) => source.refDigest === evidence.refDigest))).toBe(true)
    }
    return facts
  })
}

async function nativeData(f: Fixture, capability: "CAP01" | "CAP13") {
  const response = await f.nativePage(capability)
  expect(response.status).toBe(200)
  const body = object(await response.json())
  expect(body.status).toBe("ok")
  expect(object(body.context).principalRef).toBe(f.principal())
  expect(object(body.value).capabilityId).toBe(capability)
  return object(object(body.value).data)
}

async function business(f: Fixture) {
  return f.persistence.transaction("dashboard", async (snapshot) => ({ commit: false, value: structuredClone({ data: snapshot.data, versions: snapshot.versions, audit: snapshot.audit }) }))
}

test("WP02 Attention retains numeric risk and contract identities through canonical reads, deletion and SQLite reopen", async () => {
  const f = await createDashboardProofFixture()
  try {
    await f.persistence.transaction("dashboard", async (snapshot) => {
      snapshot.data.risks = [
        { id: 0, name: "Zero identity risk", title: "Zero identity risk", status: "open", impact: 4, probability: 4 },
        { id: 7, name: "Numeric identity risk", title: "Numeric identity risk", status: "mitigating", impact: 5, probability: 4 },
        { id: "closed", name: "Closed risk", status: "closed", impact: 5, probability: 5 },
      ]
      snapshot.data.contracts = [{ id: 8, vendor: "Numeric identity contract", renewal: "2026-12-01" }]
      return { commit: true, value: undefined }
    })
    const before = await business(f)
    const facts = await signals(f)
    expect(facts.map((value) => value.value).sort()).toEqual(["Numeric identity contract", "Numeric identity risk", "Zero identity risk"])
    expect(facts.map((value) => value.drilldown?.kind === "record" ? value.drilldown.target.recordId : "missing").sort()).toEqual(["0", "7", "8"])
    const executive = await nativeData(f, "CAP01")
    const priorities = rows(executive.signals)
    expect(priorities.map((signal) => signal.id).sort()).toEqual(["contracts:8", "risks:0", "risks:7"])
    expect(priorities.find((signal) => signal.id === "risks:7")).toMatchObject({ page: "IT Risks", recordId: "7", fact: "Numeric identity risk" })
    const risks = await nativeData(f, "CAP13")
    expect(rows(risks.risks).find((risk) => risk.id === 7)).toMatchObject({ name: "Numeric identity risk" })
    expect((await f.page("Executive Dashboard")).status).toBe(404)
    expect((await f.page("IT Risks")).status).toBe(404)
    expect(await business(f)).toEqual(before)
    await f.reopen()
    expect(await business(f)).toEqual(before)
    expect((await signals(f)).map((value) => value.value).sort()).toEqual(facts.map((value) => value.value).sort())
    const removed = await f.command({ page: "IT Risks", action: "delete", id: "7", version: 0, values: {} })
    expect(removed.status).toBe(200)
    const after = await business(f)
    expect(rows(after.data.risks).map((row) => row.id)).toEqual([0, "closed"])
    expect(after.data.contracts).toEqual(before.data.contracts)
    expect(after.data.hotTopics).toEqual(before.data.hotTopics)
    expect((await signals(f)).map((value) => value.value).sort()).toEqual(["Numeric identity contract", "Zero identity risk"])
    await f.reopen()
    expect(await business(f)).toEqual(after)
    const reopened = await nativeData(f, "CAP01")
    expect(rows(reopened.signals).map((signal) => signal.id).sort()).toEqual(["contracts:8", "risks:0"])
  } finally { await f.close() }
})

test("WP02 signal UTC boundaries match canonical evidence for offset clocks and preserve the ninety-day rule", async () => {
  const f = await createDashboardProofFixture()
  try {
    f.clock.at = "2026-11-13T23:30:00-03:00"
    await f.persistence.transaction("dashboard", async (snapshot) => {
      snapshot.data.hotTopics = rows(snapshot.data.hotTopics).map((row) => row.id === "topic" ? { ...row, action: "Due before today's UTC day", due: "2026-11-13" } : row)
      snapshot.data.contracts = [
        { id: "expired", vendor: "Expired in UTC", renewal: "2026-11-13" },
        { id: "today", vendor: "Renews on UTC day", renewal: "2026-11-14" },
        { id: "boundary", vendor: "Renews on day ninety", renewal: "2027-02-12" },
        { id: "outside", vendor: "Renews after day ninety", renewal: "2027-02-13" },
      ]
      return { commit: true, value: undefined }
    })
    const before = await business(f)
    const facts = await signals(f)
    expect(facts.map((value) => value.value).sort()).toEqual(["Due before today's UTC day", "Renews on UTC day", "Renews on day ninety"])
    const topic = facts.find((value) => value.drilldown?.kind === "record" && value.drilldown.target.recordType === "hotTopics")
    expect(topic?.drilldown?.kind === "record" && topic.drilldown.target.period).toEqual({ start: "2026-11-14", end: "2026-11-14" })
    const executive = await nativeData(f, "CAP01")
    expect(rows(executive.signals).map((signal) => signal.id).sort()).toEqual(["contracts:boundary", "contracts:today", "hotTopics:topic"])
    expect(await business(f)).toEqual(before)
    f.policies.owner.readable = false
    const denied = await f.exportJson()
    expect(denied.status).toBe(401)
    expect(await denied.text()).not.toContain("Renews on day ninety")
    const nativeDenied = await f.nativePage("CAP01")
    expect(nativeDenied.status).toBe(403)
    expect(await nativeDenied.text()).not.toContain("Renews on day ninety")
  } finally { await f.close() }
})

test("WP02 ambiguous normalized signal identities are suppressed and cannot commit as durable C17 identities", async () => {
  const f = await createDashboardProofFixture()
  try {
    await f.persistence.transaction("dashboard", async (snapshot) => {
      snapshot.data.risks = [{ id: 7, name: "Numeric risk", status: "open", impact: 4, probability: 4 }, { id: "unrelated-risk", name: "Unrelated risk", status: "open", impact: 4, probability: 4 }]
      snapshot.data.contracts = [{ id: 8, vendor: "Numeric contract", renewal: "2026-12-01" }]
      return { commit: true, value: undefined }
    })
    const before = await business(f)
    await f.persistence.transaction("dashboard", async (snapshot) => {
      // A rejected incoming representation is inspected in an isolated transaction, never installed.
      snapshot.data.risks = [...rows(snapshot.data.risks), { id: "7", name: "Ambiguous textual risk", status: "open", impact: 4, probability: 4 }]
      snapshot.data.contracts = [...rows(snapshot.data.contracts), { id: "8", vendor: "Ambiguous textual contract", renewal: "2026-12-01" }]
      const current = dashboardSignals(snapshot, { id: f.principal(), roles: ["admin"], canWrite: true }, { at: f.clock.at, id: () => "unused", directory: [] })
      expect(current.map((signal) => signal.id)).toEqual(["risks:unrelated-risk"])
      return { commit: false, value: undefined }
    })
    await expect(f.persistence.transaction("dashboard", async (snapshot) => {
      snapshot.data.risks = [...rows(snapshot.data.risks), { id: "7", name: "Ambiguous textual risk", status: "open", impact: 4, probability: 4 }]
      return { commit: true, value: undefined }
    })).rejects.toThrow()
    expect(await business(f)).toEqual(before)
    expect((await signals(f)).map((value) => value.value).sort()).toEqual(["Numeric contract", "Numeric risk", "Unrelated risk"])
  } finally { await f.close() }
})
