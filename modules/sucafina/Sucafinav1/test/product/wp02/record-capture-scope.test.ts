import { expect, test } from "bun:test"
import { randomUUID } from "node:crypto"
import { object, rows } from "../../../runtime/contract.ts"
import { createDashboardRecordEvidenceHost } from "../../../product/dashboard/sources.ts"
import { createDashboardRecordSourceIssuer } from "../../../product/integration/dashboard-sources.ts"
import { createRecoveryFixture } from "./workbench-recovery-fixture.ts"

// Actual operator identity, C08 authority, source lifecycle, Dashboard producer
// and HTTP capture/history routes. Only the initial business records are fixtures.
test("Dashboard captures the exact authorized page scope and rejects cross-page substitution, revocation and physical replacement", async () => {
  const f = await createRecoveryFixture()
  try {
    await f.persistence.transaction("dashboard", async (snapshot) => {
      snapshot.data.opexOwners = [{ id: "meeting-owner", name: "Meeting Operations", budget: 1200 }]
      snapshot.data.opexEntries = [{ id: "meeting-january", ownerId: "meeting-owner", year: 2026, month: 1, budget: 200, actual: 0, forecast: 200 }]
      snapshot.data.capexProjects = []
      snapshot.data.capexEntries = []
      return { commit: true, value: undefined }
    })
    const cookie = f.request().headers.get("cookie")
    if (!cookie) throw new Error("The real operator session is unavailable")
    const post = async (mode: string, value: unknown, key = randomUUID()) => {
      const response = await fetch(`${f.origin}/sucafina/dashboard?sf=${mode}`, {
        method: "POST", headers: { cookie, origin: f.origin, "content-type": "application/json", "idempotency-key": key }, body: JSON.stringify(value),
      })
      const body = object(await response.json())
      if (response.status !== 200) console.info("SF_DASHBOARD_CAPTURE_SCOPE", { mode, httpStatus: response.status, status: body.status, reason: body.reason })
      expect(response.status).toBe(200)
      expect(body.status).toBe("ok")
      return object(body.value)
    }
    const period = { start: "2026-01-01", end: "2026-12-31" }
    const options = await post("dashboard-workbench", { page: "Budget Overview", period })
    const selected = rows(options.records).find((record) => record.label === "Meeting Operations")
    expect(typeof selected?.sourceRef).toBe("string")
    const sourceRef = selected?.sourceRef
    if (typeof sourceRef !== "string") throw new Error("The authorized Budget Overview record was not offered")
    const records = createDashboardRecordEvidenceHost({ host: f.authority.host, scopedSources: f.persistence,
      issueRecord: createDashboardRecordSourceIssuer({ host: f.authority.host, scopedSources: f.persistence }) })
    const original = await f.read(async (context) => {
      const source = await records.resolve(sourceRef, context)
      expect(source.status).toBe("ok")
      if (source.status !== "ok") throw new Error("The offered source did not resolve")
      const detail = await records.issue({ page: "OPEX Detail", recordType: source.value.target.recordType, recordId: source.value.target.recordId,
        fields: source.value.target.fields, period }, context)
      expect(detail.status).toBe("ok")
      if (detail.status !== "ok") throw new Error("The independent OPEX Detail source did not resolve")
      expect(detail.value.target.recordId).toBe(source.value.target.recordId)
      expect(detail.value.target.fields).toEqual(source.value.target.fields)
      expect(detail.value.target.period).toEqual(source.value.target.period)
      expect(detail.value.target.incarnation).not.toBe(source.value.target.incarnation)
      expect(detail.value.refDigest).not.toBe(source.value.refDigest)
      const scopes = await f.persistence.transaction("dashboard", async (snapshot) => {
        const entries = Object.values(snapshot.sfSources?.scopes ?? {})
        const first = entries.find((entry) => entry.incarnation === source.value.target.incarnation)
        const second = entries.find((entry) => entry.incarnation === detail.value.target.incarnation)
        return { commit: false, value: { firstPage: object(first?.scope.selector).page, secondPage: object(second?.scope.selector).page,
          samePhysicalSource: !!first && !!second && first.sourceIncarnation === second.sourceIncarnation } }
      })
      expect(scopes).toEqual({ firstPage: "Budget Overview", secondPage: "OPEX Detail", samePhysicalSource: true })
      const exact = await f.dashboard.observer.prepareReissueScope(source.value, source.value, context)
      expect(exact.status).toBe("ok")
      if (exact.status !== "ok") throw new Error("The original authorized page scope was not preserved")
      expect(await exact.value.fence()).toBe(false)
      const transaction = f.persistence.transactionAll
      if (!transaction) throw new Error("The actual capture transaction is unavailable")
      expect(await transaction(async () => ({ commit: false, value: await exact.value.fence() }))).toBe(true)
      expect((await f.dashboard.observer.prepareReissueScope(source.value, detail.value, context)).status).toBe("unavailable")
      expect((await f.dashboard.observer.prepareReissueScope(source.value, { ...source.value, refDigest: "forged" }, context)).status).toBe("unavailable")
      return source.value
    })
    const key = randomUUID()
    const captured = await post("dashboard-capture", { sourceRef }, key)
    const captureId = captured.captureId
    expect(typeof captureId).toBe("string")
    if (typeof captureId !== "string") throw new Error("The actual capture did not return its durable identity")
    expect(await post("dashboard-capture", { sourceRef }, key)).toEqual(captured)
    const historyUrl = `${f.origin}/sucafina/dashboard?sf=dashboard-history&id=${encodeURIComponent(captureId)}`
    const firstRead = await fetch(historyUrl, { headers: { cookie } })
    expect(firstRead.status).toBe(200)
    const first = object(await firstRead.json())
    expect(first.status).toBe("ok")
    const historical = object(first.value), projection = object(historical.projection)
    expect(historical).toMatchObject({ state: "historical", captureId, capturedBy: f.principalRef, capturedAt: new Date(f.clock.at).toISOString() })
    expect(rows(projection.values)).toContainEqual(expect.objectContaining({ id: "opexOwners:meeting-owner:budget", value: 1200 }))
    for (const value of rows(projection.values)) expect(value.sourceRefs).toEqual([original])
    const persisted = await f.authority.state.read(f.request(), "preferences", (state) => Object.keys(state.preferences).filter((name) => name.startsWith("sf:dashboard-host:capture:")))
    expect(persisted.status).toBe("ok")
    if (persisted.status !== "ok") throw new Error("The captured receipt could not be read with its actual grant")
    expect(persisted.value).toEqual([`sf:dashboard-host:capture:${captureId}`])

    f.policy.readable = false
    const denied = await fetch(historyUrl, { headers: { cookie } })
    expect(denied.status).toBe(403)
    expect(object(object(await denied.json()).value).projection).toBeUndefined()
    f.policy.readable = true
    await f.persistence.transaction("dashboard", async (snapshot) => {
      snapshot.data.opexOwners = []
      return { commit: true, value: undefined }
    })
    await f.persistence.transaction("dashboard", async (snapshot) => {
      snapshot.data.opexOwners = [{ id: "meeting-owner", name: "Meeting Operations", budget: 1200 }]
      return { commit: true, value: undefined }
    })
    const replaced = await fetch(historyUrl, { headers: { cookie } })
    expect(replaced.status).not.toBe(200)
    const replacement = object(await replaced.json())
    expect(replacement.status).not.toBe("ok")
    expect(object(replacement.value).projection).toBeUndefined()
  } finally { await f.close() }
}, 60_000)
