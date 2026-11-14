import { expect, test } from "bun:test"
import { randomUUID } from "node:crypto"
import { digestSfValue } from "../../../../product/contracts/canonical.ts"
import { readSfImportAnalysisChoices } from "../../../../product/imports/analysis-options.ts"
import { withNativeWp06 } from "../native/fixture.ts"

test("import analysis choices read actual authorized cases and installed skills without needing a provider or changing the import", async () => {
  await withNativeWp06(async (fixture) => {
    const { app } = fixture
    // Model discovery is deliberately empty. This proves the optional no-model path,
    // while case authority, installed manifests and C08 reads are the real services.
    const runtime = { ...fixture.authority, dispatch: fixture.dispatch, selected: fixture.selected, models: async () => [] }
    const before = await app.store.transaction("dashboard", async (snapshot) => ({ commit: false, value: digestSfValue(snapshot) }))
    const result = await readSfImportAnalysisChoices(app.request("planner"), runtime)
    expect(result.status).toBe("ok")
    if (result.status !== "ok") throw new Error(result.reason)
    expect(result.value.cases).toEqual([{ caseRef: fixture.caseRef, label: "WP06 native mechanism" }])
    expect(result.value.models).toEqual([])
    expect(result.value.analyses.map((entry) => entry.skillId)).toEqual(["sf-enquadrar-decisao", "sf-explicar-forecast"])
    for (const choice of result.value.analyses) {
      const installed = fixture.selected.find((entry) => entry.profile.id === choice.profileId)
      const skill = installed?.skills.find((entry) => entry.id === choice.skillId)
      if (!installed || !skill) throw new Error("Choice did not come from installed source")
      expect(choice).toMatchObject({ profileVersion: installed.profile.version, skillVersion: skill.version, manifestDigest: installed.manifestDigest,
        outputSchemaVersion: "sf-contribution-v1", requestedOperationScope: skill.allowedOperations })
    }
    const other = await readSfImportAnalysisChoices(new Request(`${app.origin}/sucafina/planner`, { method: "POST", headers: {
      cookie: app.otherCookie, origin: app.origin, "Idempotency-Key": randomUUID(),
    } }), runtime)
    expect(other.status).toBe("ok")
    if (other.status !== "ok") throw new Error(other.reason)
    expect(other.value.cases).toEqual([])
    expect(JSON.stringify(other)).not.toContain(fixture.caseRef.id)
    const unauthenticated = await readSfImportAnalysisChoices(new Request(`${app.origin}/sucafina/planner`, { method: "POST", headers: { origin: app.origin, "Idempotency-Key": randomUUID() } }), runtime)
    expect(unauthenticated.status).toBe("denied")
    expect(await app.store.transaction("dashboard", async (snapshot) => ({ commit: false, value: digestSfValue(snapshot) }))).toBe(before)

    const changedDuringDiscovery = await readSfImportAnalysisChoices(app.request("planner"), { ...runtime, models: async () => {
      const current = await fixture.authority.state.read(app.request(), "cases", () => null)
      if (current.status !== "ok") throw new Error("Case state unavailable")
      const changed = await fixture.authority.state.transaction(app.request(), { namespace: "cases", expectedStorageVersion: current.storageVersion,
        idempotencyKey: randomUUID(), commandDigest: digestSfValue({ change: "case-version" }), targetRef: `case:${fixture.caseRef.id}:${fixture.caseRef.incarnation}`,
        targetIncarnation: fixture.caseRef.incarnation }, async (state) => {
        state.cases[fixture.caseRef.id]!.version++
        return { commit: true, value: true }
      })
      if (changed.status !== "ok") throw new Error("Case revision did not change")
      return []
    } })
    expect(changedDuringDiscovery).toEqual({ status: "stale", reason: "analysis-choices-changed" })
    expect(JSON.stringify(changedDuringDiscovery)).not.toContain(fixture.caseRef.id)
    const logout = await app.identity.handle(new Request(`${app.origin}/sucafina/auth/logout`, { method: "POST", headers: { cookie: app.cookie, origin: app.origin } }))
    expect(logout?.status).toBe(204)
    expect((await readSfImportAnalysisChoices(app.request("planner"), runtime)).status).toBe("denied")
  })
}, 120_000)
