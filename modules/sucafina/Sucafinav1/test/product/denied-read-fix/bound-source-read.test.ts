import { expect, test } from "bun:test"
import { isSfCapturedSourceBoundToCurrentAccess } from "../../../product/host-binding/denied-read.ts"
import { createExportArtifactFixture } from "../export-artifact-closure/fixture.ts"

test("old source captures cannot be probed under viewer, foreign or revoked authority; pure probe survives retry and SQLite reopen", async () => {
  const f = await createExportArtifactFixture()
  try {
    const review = await f.preserve()
    const refs = [...review.sourceRefs]
    expect(refs.length).toBeGreaterThan(0)
    expect(new Set(refs.map((ref) => ref.surface))).toEqual(new Set(["dashboard", "planner"]))
    const payload = { reviewRef: review.id, sectionRefs: review.sections.map((section) => section.id), format: "docx" }
    const prove = (session = "owner") => f.withCall("sf_report_prepare", payload,
      (call) => Promise.all(refs.map((ref) => isSfCapturedSourceBoundToCurrentAccess(f.authority.host, ref, call))),
      { session, key: "sf97-source-read-proof" })
    const good = refs.map(() => true)
    const denied = refs.map(() => false)
    const original = await f.durable()
    expect(await prove()).toEqual(good)
    expect(await f.durable()).toEqual(original)

    // The same principal has a different accessRevision after the real role downgrade.
    f.sessions.owner!.memberships = ["viewers"]
    for (let repeat = 0; repeat < 2; repeat++) {
      expect(await prove()).toEqual(denied)
      expect(await f.durable()).toEqual(original)
    }
    await f.reopen()
    expect(await prove()).toEqual(denied)
    expect(await prove("viewer")).toEqual(denied)
    expect(await prove("foreign")).toEqual(denied)
    expect(await f.durable()).toEqual(original)

    // A different principal can make a new, explicit, authorized viewer capture.
    // Never suppress read-only users globally to fix a denied historical read.
    const viewerCatalog = await f.request("review-agenda", {
      session: "viewer", query: { start: f.period.start, end: f.period.end, domain: "dashboard" },
    })
    expect(viewerCatalog.status).toBe(200)
    expect((await viewerCatalog.json() as { status: string }).status).toBe("ok")
    const captured = await f.durable()
    expect(captured).not.toEqual(original)
    await f.reopen()
    expect(await f.durable()).toEqual(captured)

    f.sessions.owner!.memberships = ["admins"]
    expect(await prove()).toEqual(good)
    expect(await f.durable()).toEqual(captured)

    // A legitimate domain write advances source identity/version, not the probe.
    await f.changeCandidate(135)
    const versioned = await f.durable()
    expect(versioned).not.toEqual(captured)
    expect(await prove()).toEqual(good)
    expect(await f.durable()).toEqual(versioned)

    // Canonical removal tombstones the source. A read must not revive it.
    await f.persistence.transaction("planner", async (snapshot) => {
      snapshot.data.versions = []
      return { commit: true, value: undefined }
    })
    const tombstoned = await f.durable()
    expect(await prove()).toEqual(refs.map((ref) => ref.surface !== "planner"))
    expect(await f.durable()).toEqual(tombstoned)

    await f.withCall("sf_report_prepare", payload, async (call) => {
      f.sessions.owner!.active = false
      try {
        expect(await isSfCapturedSourceBoundToCurrentAccess(f.authority.host, refs[0]!, call)).toBe(false)
      } finally { f.sessions.owner!.active = true }
    }, { key: "sf97-revoked-source-read" })
    expect(await f.durable()).toEqual(tombstoned)
  } finally { await f.dispose() }
}, 120000)
