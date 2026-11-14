import { expect, test } from "bun:test"
import { object, rows } from "../../../runtime/contract.ts"
import type { PlannerVersionRequest } from "../../../product/planner/versions.ts"
import { plannerFixture, plannerSnapshot } from "./planner-fixture.ts"

test("Versions preserves preview and conflict drafts and applies the real copy, lock and official lifecycle", async () => {
  const fixture = await plannerFixture()
  try {
    const read = await fixture.admit("sf-human:planner.read", {}, "admin", true)
    const initial = await fixture.versions.read("v1", read)
    expect(initial).toMatchObject({ status: "ok", value: { selectedId: "v1", selectionState: "selected", create: { allowed: false }, versions: expect.arrayContaining([expect.objectContaining({ id: "v0", state: "official", actions: expect.objectContaining({ delete: false, unlock: false, changeYear: false }) })]) } })
    const apply = async (request: PlannerVersionRequest) => fixture.versions.apply(request, await fixture.admit("sf-human:planner.apply", request, "admin", true))
    const copy = { action: "copy" as const, id: "v1", revision: 0, name: "Candidate copy" }
    const before = await fixture.readSnapshot()
    const previewContext = await fixture.admit("sf-human:planner.preview", copy, "admin", true)
    const preview = await fixture.versions.preview(copy, previewContext)
    expect(preview).toMatchObject({ status: "ok", value: { request: copy, outcome: { ok: true }, preview: { versions: expect.arrayContaining([expect.objectContaining({ name: "Candidate copy", state: "draft" })]) } } })
    expect(await fixture.versions.apply(copy, previewContext)).toMatchObject({ status: "denied" })
    expect(await fixture.readSnapshot()).toEqual(before)
    const copied = await apply(copy)
    expect(copied).toMatchObject({ status: "ok", value: { outcome: { ok: true } } })
    if (copied.status !== "ok" || !copied.value.outcome.ok) throw new Error("copy failed")
    const copiedId = copied.value.outcome.versionId!
    expect(copiedId).not.toBe("v1")
    const afterCopy = rows((await fixture.readSnapshot()).data.versions)
    expect(afterCopy.find((version) => version.id === copiedId)?.lines).toEqual(afterCopy.find((version) => version.id === "v1")?.lines)
    expect(afterCopy.find((version) => version.id === copiedId)?.hc).toEqual(afterCopy.find((version) => version.id === "v1")?.hc)
    expect(afterCopy.find((version) => version.id === copiedId)?.locked).toBe(false)
    expect(await apply({ action: "save", id: "v1", revision: 0, name: "Reviewed" })).toMatchObject({ status: "ok", value: { outcome: { ok: true } } })
    const draft = { action: "save" as const, id: "v1", revision: 0, name: "My unsaved draft", year: 2028 }
    const conflict = await apply(draft)
    expect(conflict).toMatchObject({ status: "ok", value: { request: draft, outcome: { ok: false, status: 409, stored: { id: "v1", name: "Reviewed", revision: 1 } } } })
    expect(JSON.stringify(conflict)).not.toContain('"lines"')
    expect(JSON.stringify(conflict)).not.toContain('"rates"')
    expect(await apply({ action: "save", id: "v2", revision: 0, name: "Independent version" })).toMatchObject({ status: "ok", value: { outcome: { ok: true } } })
    expect(await apply({ action: "official", id: "v1", revision: 0 })).toMatchObject({ status: "ok", value: { outcome: { ok: true }, versions: { versions: expect.arrayContaining([expect.objectContaining({ id: "v1", state: "official", revision: 2, officialRevision: 1 })]) } } })
    expect(object((await fixture.readSnapshot()).data.officials)["2027"]).toBe("v1")
    for (const action of ["unlock", "delete"] as const) expect(await apply({ action, id: "v1", revision: 2 })).toMatchObject({ status: "ok", value: { outcome: { ok: false } } })
    expect(await apply({ action: "save", id: "v1", revision: 2, name: "Reviewed", year: 2028 })).toMatchObject({ status: "ok", value: { outcome: { ok: false } } })
    expect(await apply({ action: "official", id: "v2", revision: 0 })).toMatchObject({ status: "ok", value: { outcome: { ok: false, status: 409 } } })
    expect(await apply({ action: "lock", id: "v2", revision: 1 })).toMatchObject({ status: "ok", value: { outcome: { ok: true } } })
    expect(await apply({ action: "unlock", id: "v2", revision: 2 })).toMatchObject({ status: "ok", value: { outcome: { ok: true } } })
    expect(await apply({ action: "delete", id: "v2", revision: 3 })).toMatchObject({ status: "ok", value: { outcome: { ok: true }, versions: { selectedId: null, selectionState: "unavailable" } } })
    expect(await fixture.versions.read("missing-selection", read)).toMatchObject({ status: "ok", value: { selectedId: null, selectionState: "unavailable" } })
  } finally { await fixture.close() }
})

test("Versions grants follow current role, exact human intent, private lease and closed input", async () => {
  const fixture = await plannerFixture()
  try {
    const request = { action: "save" as const, id: "v1", revision: 0, name: "Disallowed" }
    const before = await fixture.readSnapshot()
    for (const principal of ["finance", "hr", "viewer"]) {
      const context = await fixture.admit("sf-human:planner.apply", request, principal, true)
      const read = await fixture.versions.read("v1", context)
      expect(read).toMatchObject({ status: "ok", value: { versions: expect.arrayContaining([expect.objectContaining({ id: "v1", actions: expect.objectContaining({ save: false, copy: false, lock: false, official: false, delete: false }) })]) } })
      expect(await fixture.versions.apply(request, context)).toMatchObject({ status: "ok", value: { outcome: { ok: false, status: 403 } } })
    }
    const context = await fixture.admit("sf-human:planner.apply", request, "admin", true)
    expect(await fixture.versions.apply({ ...request, name: "Unbound intent" }, context)).toMatchObject({ status: "denied" })
    expect(await fixture.versions.apply({ ...request, actor: "admin" } as unknown as PlannerVersionRequest, context)).toMatchObject({ status: "needs-input" })
    expect(await fixture.versions.apply({ ...request, action: { toString: "lock" } } as unknown as PlannerVersionRequest, context)).toMatchObject({ status: "needs-input" })
    expect(await fixture.versions.apply({ ...request, revision: NaN }, context)).toMatchObject({ status: "needs-input" })
    expect(await fixture.versions.read("v1", structuredClone(context))).toMatchObject({ status: "denied" })
    fixture.access.revision = "2"
    expect(await fixture.versions.apply(request, context)).toMatchObject({ status: "denied" })
    expect(await fixture.readSnapshot()).toEqual(before)
    const abort = new AbortController()
    const cancelled = await fixture.admit("sf-human:planner.apply", request, "admin", true, abort.signal)
    abort.abort()
    expect(await fixture.versions.apply(request, cancelled)).toMatchObject({ status: "denied" })
    const expired = await fixture.admit("sf-human:planner.read", {}, "admin", true)
    fixture.access.now += 300_001
    expect(await fixture.versions.read("v1", expired)).toMatchObject({ status: "denied" })
  } finally { await fixture.close() }
})

test("the first version uses the injected environment and creation is one-time", async () => {
  const snapshot = plannerSnapshot()
  snapshot.data.versions = []
  snapshot.data.officials = {}
  const fixture = await plannerFixture(snapshot)
  try {
    const request = { action: "create" as const, revision: 0 }
    const invoke = async () => fixture.versions.apply(request, await fixture.admit("sf-human:planner.apply", request, "admin", true))
    expect(await invoke()).toMatchObject({ status: "ok", value: { outcome: { ok: true }, versions: { create: { allowed: false }, versions: [expect.objectContaining({ year: 2027, state: "draft" })] } } })
    expect(await invoke()).toMatchObject({ status: "ok", value: { outcome: { ok: false } } })
    expect(rows((await fixture.readSnapshot()).data.versions)).toHaveLength(1)
  } finally { await fixture.close() }
})

test("an editable version can change fiscal year without moving the year's official or redistributing its months", async () => {
  const fixture = await plannerFixture()
  try {
    const before = await fixture.readSnapshot()
    const source = rows(before.data.versions).find((version) => version.id === "v1")!
    const request = { action: "save" as const, id: "v1", revision: 0, name: "Next fiscal year", year: 2028 }
    const context = await fixture.admit("sf-human:planner.apply", request, "admin", true)
    expect(await fixture.versions.apply(request, context)).toMatchObject({ status: "ok", value: { outcome: { ok: true }, versions: { selectedId: "v1", versions: expect.arrayContaining([expect.objectContaining({ id: "v1", name: "Next fiscal year", year: 2028, revision: 1, state: "draft" })]) } } })
    const after = await fixture.readSnapshot()
    const moved = rows(after.data.versions).find((version) => version.id === "v1")!
    expect(moved.lines).toEqual(source.lines)
    expect(after.data.officials).toEqual(before.data.officials)
    expect(rows(after.data.versions).find((version) => version.id === "v0")?.year).toBe(2027)
    const invalid = { ...request, revision: 1, year: 2000 }
    expect(await fixture.versions.apply(invalid, await fixture.admit("sf-human:planner.apply", invalid, "admin", true))).toMatchObject({ status: "ok", value: { request: invalid, outcome: { ok: false, status: 422 } } })
    expect(await fixture.readSnapshot()).toEqual(after)
  } finally { await fixture.close() }
})

test("a legacy official without its lock flag rejects year changes in preview and apply while retaining rename and copy", async () => {
  const fixture = await plannerFixture()
  try {
    const before = await fixture.readSnapshot()
    expect(object(before.data.officials)["2027"]).toBe("v0")
    expect(rows(before.data.versions).find((version) => version.id === "v0")?.locked).not.toBe(true)
    const request = { action: "save" as const, id: "v0", revision: 0, name: "Forged next-year official", year: 2028 }
    for (const action of ["preview", "apply"] as const) {
      const context = await fixture.admit(`sf-human:planner.${action}`, request, "admin", true)
      expect(await fixture.versions[action](request, context)).toMatchObject({ status: "ok", value: { request, outcome: { ok: false, status: 403 } } })
      expect(await fixture.readSnapshot()).toEqual(before)
    }
    const rename = { action: "save" as const, id: "v0", revision: 0, name: "Renamed official" }
    expect(await fixture.versions.apply(rename, await fixture.admit("sf-human:planner.apply", rename, "admin", true))).toMatchObject({ status: "ok", value: { outcome: { ok: true } } })
    const copy = { action: "copy" as const, id: "v0", revision: 1, name: "Working copy" }
    const copied = await fixture.versions.apply(copy, await fixture.admit("sf-human:planner.apply", copy, "admin", true))
    expect(copied.status).toBe("ok")
    if (copied.status !== "ok" || !copied.value.outcome.ok || !copied.value.outcome.versionId) throw new Error("official copy unavailable")
    const copiedId = copied.value.outcome.versionId
    const after = await fixture.readSnapshot()
    const original = rows(after.data.versions).find((version) => version.id === "v0")!
    const working = rows(after.data.versions).find((version) => version.id === copiedId)!
    expect(original.name).toBe("Renamed official")
    expect(original.year).toBe(2027)
    expect(after.data.officials).toEqual(before.data.officials)
    expect(working.locked).toBe(false)
    expect(working.lines).toEqual(original.lines)
    const draft = { action: "save" as const, id: "v1", revision: 0, name: "Next year draft", year: 2028 }
    expect(await fixture.versions.apply(draft, await fixture.admit("sf-human:planner.apply", draft, "admin", true))).toMatchObject({ status: "ok", value: { outcome: { ok: true } } })
  } finally { await fixture.close() }
})
