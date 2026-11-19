import { expect, test } from "bun:test"
import { object } from "../../../runtime/contract.ts"
import { digestSfValue } from "../../../product/contracts/canonical.ts"
import { createProcurementContractFixture, sourceGrant } from "./procurement-fixture.ts"

// These qualify real source/grant continuity. They do not invent the C17 private
// historical capture whose canonical preparation still depends on M31 approval.
test("Procurement scope rotation preserves physical lineage and binds a real private source grant", async () => {
  const fixture = await createProcurementContractFixture()
  try {
    const original = fixture.original
    const before = await fixture.snapshot()
    const key = JSON.stringify([original.target.recordType, fixture.requestId])
    const physical = before.sfSources?.records[key]
    expect(physical?.alive).toBe(true)
    const originalGrant = await sourceGrant(fixture)
    const originalAccepted = await originalGrant()
    expect(originalAccepted).toBe(true)

    fixture.authorization.roles = ["admin"]
    const reissued = await fixture.sources.issueForActor(original.target, fixture.context)
    expect(reissued.status).toBe("ok")
    if (reissued.status !== "ok") throw new Error("Authorized physical source reissue unavailable")
    const current = reissued.value
    expect(current.target.incarnation).not.toBe(original.target.incarnation)
    expect(current.target).toMatchObject({ recordId: original.target.recordId, version: original.target.version,
      fields: original.target.fields, period: original.target.period, projectionDigest: original.target.projectionDigest })
    const rotated = await fixture.snapshot()
    expect(rotated.sfSources?.records[key]).toEqual(physical)
    expect(rotated.data).toEqual(before.data)
    expect(rotated.audit).toEqual(before.audit)
    const grant = await sourceGrant(fixture, original, current)
    const currentAccepted = await grant(), oldAcceptedAfterRotation = await originalGrant()
    expect(currentAccepted).toBe(true)
    expect(oldAcceptedAfterRotation).toBe(false)
    const settled = await fixture.snapshots(), writes = fixture.writes.length
    expect(await fixture.sources.resolveForPreparation(current.refId, fixture.context)).toMatchObject({ status: "ok", value: { evidence: current } })
    expect(await grant()).toBe(true)
    expect(await fixture.snapshots()).toEqual(settled)
    expect(fixture.writes).toHaveLength(writes)
    console.info("SF_MIXED_PROCUREMENT_PROOF", JSON.stringify({ scenario: "scope-rotation", originalAccepted,
      originalPhysical: physical?.incarnation, currentPhysical: rotated.sfSources?.records[key]?.incarnation,
      originalScope: original.target.incarnation, currentScope: current.target.incarnation, currentAccepted, oldAcceptedAfterRotation,
      financialDigest: digestSfValue(rotated.data), historicalCaptureQualified: false }))
  } finally { await fixture.dispose() }
})

test("canonical delete and same-ID row replay create a new physical source and reject the old source and private grant", async () => {
  const fixture = await createProcurementContractFixture()
  try {
    const original = fixture.original
    const before = await fixture.snapshot()
    const key = JSON.stringify([original.target.recordType, fixture.requestId])
    const row = structuredClone(object(object(before.data.store).requests)[fixture.requestId])
    expect(row).toBeDefined()
    const granted = await sourceGrant(fixture)
    expect(await granted()).toBe(true)
    expect(await fixture.sources.resolveForPreparation(original.refId, fixture.context)).toMatchObject({ status: "ok", value: { evidence: original } })
    const deleted = await fixture.execute(fixture.requester, { page: "Requests", action: "delete", id: fixture.requestId,
      version: before.versions[`requests:${fixture.requestId}`]!.version, values: {} })
    expect(deleted.ok).toBe(true)
    const tombstone = await fixture.snapshot()
    expect(object(object(tombstone.data.store).requests)[fixture.requestId]).toBeUndefined()
    expect(tombstone.sfSources?.records[key]).toMatchObject({ alive: false, incarnation: before.sfSources!.records[key]!.incarnation })
    expect(await granted()).toBe(false)

    // Explicit synthetic same-visible-ID replay changes only the domain row.
    // Production lifecycle generates the new identities; no archive or grant is seeded.
    await fixture.persistence.transaction("procurement", async (snapshot) => {
      const requests = object(object(snapshot.data.store).requests)
      if (requests[fixture.requestId] !== undefined) throw new Error("Deleted synthetic record unexpectedly remains")
      requests[fixture.requestId] = structuredClone(row)
      return { commit: true, value: undefined }
    })
    const recreated = await fixture.snapshot()
    expect(object(object(recreated.data.store).requests)[fixture.requestId]).toEqual(row)
    expect(recreated.sfSources?.records[key]?.alive).toBe(true)
    expect(recreated.sfSources?.records[key]?.incarnation).not.toBe(before.sfSources?.records[key]?.incarnation)
    const current = await fixture.issue()
    expect(current.target.recordId).toBe(original.target.recordId)
    expect(current.target.incarnation).not.toBe(original.target.incarnation)
    expect(current.target.projectionDigest).toBe(original.target.projectionDigest)
    const replacementGrant = await sourceGrant(fixture, current)
    expect(await replacementGrant()).toBe(true)
    const settled = await fixture.snapshots(), writes = fixture.writes.length
    const oldRead = await fixture.sources.resolveForPreparation(original.refId, fixture.context)
    const oldReissue = await fixture.sources.issueForActor(original.target, fixture.context)
    const oldGrant = await granted()
    expect(oldRead.status).not.toBe("ok")
    expect(oldReissue.status).not.toBe("ok")
    expect(oldGrant).toBe(false)
    expect(await fixture.sources.resolveForPreparation(current.refId, fixture.context)).toMatchObject({ status: "ok", value: { evidence: current } })
    const newGrant = await replacementGrant()
    expect(newGrant).toBe(true)
    expect(await fixture.snapshots()).toEqual(settled)
    expect(fixture.writes).toHaveLength(writes)
    console.info("SF_MIXED_PROCUREMENT_PROOF", JSON.stringify({ scenario: "tombstone-recreate", deletion: deleted.ok,
      tombstoned: tombstone.sfSources?.records[key]?.alive === false, originalPhysical: before.sfSources?.records[key]?.incarnation,
      currentPhysical: recreated.sfSources?.records[key]?.incarnation, originalScope: original.target.incarnation,
      currentScope: current.target.incarnation, oldRead: oldRead.status, oldReissue: oldReissue.status, oldGrant, newGrant,
      financialDigest: digestSfValue(settled[2]?.data), historicalCaptureQualified: false }))
  } finally { await fixture.dispose() }
})

test("removing a genuine original scope breaks its private grant while a current replacement source remains available", async () => {
  const fixture = await createProcurementContractFixture()
  try {
    const original = fixture.original
    const granted = await sourceGrant(fixture)
    expect(await granted()).toBe(true)
    const removed = await fixture.store.transaction("procurement", async (snapshot) => {
      const entries = Object.entries(snapshot.sfSources?.scopes ?? {}).filter(([, entry]) => entry.incarnation === original.target.incarnation)
      expect(entries).toHaveLength(1)
      if (!snapshot.sfSources?.scopes || !entries[0]) throw new Error("Genuine original scope missing before corruption probe")
      delete snapshot.sfSources.scopes[entries[0][0]]
      return { commit: true, value: entries[0][1].sourceIncarnation }
    })
    expect(typeof removed).toBe("string")
    expect(await granted()).toBe(false)
    const replacement = await fixture.issue()
    expect(replacement.target.incarnation).not.toBe(original.target.incarnation)
    const current = await fixture.snapshot()
    expect(current.sfSources?.records[JSON.stringify([original.target.recordType, fixture.requestId])]?.incarnation).toBe(removed)
    const settled = await fixture.snapshots(), writes = fixture.writes.length
    const refused = await fixture.sources.issueForActor(original.target, fixture.context)
    expect(refused.status).not.toBe("ok")
    expect(Object.hasOwn(refused, "value")).toBe(false)
    const oldGrant = await granted(), replacementRead = await fixture.sources.resolveForPreparation(replacement.refId, fixture.context)
    expect(oldGrant).toBe(false)
    expect(replacementRead).toMatchObject({ status: "ok", value: { evidence: replacement } })
    expect(await fixture.snapshots()).toEqual(settled)
    expect(fixture.writes).toHaveLength(writes)
    console.info("SF_MIXED_PROCUREMENT_PROOF", JSON.stringify({ scenario: "broken-scope-lineage", removedPhysical: removed,
      currentPhysical: current.sfSources?.records[JSON.stringify([original.target.recordType, fixture.requestId])]?.incarnation,
      originalScope: original.target.incarnation, currentScope: replacement.target.incarnation, oldReissue: refused.status, oldGrant, replacementRead: replacementRead.status,
      financialDigest: digestSfValue(settled[2]?.data), historicalCaptureQualified: false }))
  } finally { await fixture.dispose() }
})

for (const mutation of ["revoke", "actor", "policy", "access", "request-header", "lease", "abort", "role", "source"] as const) {
  test(`real Procurement observation refuses ${mutation} between independent source reads without a private result`, async () => {
    const fixture = await createProcurementContractFixture()
    try {
      const original = fixture.original
      expect(await fixture.sources.resolveForPreparation(original.refId, fixture.context)).toMatchObject({ status: "ok", value: { evidence: original } })
      const granted = await sourceGrant(fixture)
      expect(await granted()).toBe(true)
      const before = await fixture.snapshots()
      const event = { happened: false, after: before, writes: fixture.writes.length }
      const firstRead = fixture.observation.reads
      fixture.observation.afterRead = async () => {
        fixture.observation.afterRead = undefined
        expect(fixture.observation.reads).toBe(firstRead + 1)
        expect(await fixture.host.revalidate(fixture.context)).toBe(true)
        if (mutation === "revoke") fixture.authorization.allowed = false
        if (mutation === "actor") fixture.authorization.principal = "bob"
        if (mutation === "policy") fixture.authorization.policyVersion = "policy-2"
        if (mutation === "access") fixture.authorization.accessRevision = "access-2"
        if (mutation === "request-header") fixture.request.headers.set("authorization", "Bearer bob")
        if (mutation === "lease") fixture.ui.finish(fixture.context)
        if (mutation === "abort") fixture.controller.abort()
        if (mutation === "role") fixture.authorization.roles = ["admin"]
        if (mutation === "source") {
          const snapshot = await fixture.snapshot()
          expect((await fixture.execute(fixture.requester, { page: "Requests", action: "save", id: fixture.requestId,
            version: snapshot.versions[`requests:${fixture.requestId}`]!.version, values: { pr: { estAmount: 120 } } })).ok).toBe(true)
        }
        event.happened = true
        event.after = await fixture.snapshots()
        event.writes = fixture.writes.length
      }
      const result = await fixture.sources.resolveForPreparation(original.refId, fixture.context).catch((error: unknown) => {
        if (mutation !== "abort") throw error
        return undefined
      })
      expect(event.happened).toBe(true)
      expect(fixture.observation.reads).toBeGreaterThanOrEqual(firstRead + 1)
      expect(result?.status).not.toBe("ok")
      if (result) expect(Object.hasOwn(result, "value")).toBe(false)
      expect(await granted()).toBe(false)
      expect(await fixture.snapshots()).toEqual(event.after)
      expect(fixture.writes).toHaveLength(event.writes)
      if (mutation !== "source") expect(event.after).toEqual(before)
      if (mutation === "source") expect(event.after).not.toEqual(before)
      console.info("SF_MIXED_PROCUREMENT_PROOF", JSON.stringify({ scenario: "between-source-reads", mutation, event: event.happened,
        observedReads: fixture.observation.reads - firstRead, outcome: result?.status ?? "aborted", returnedPrivateValue: !!result && Object.hasOwn(result, "value"),
        writesBeforeOperation: event.writes, writesAfterOperation: fixture.writes.length,
        originalScope: original.target.incarnation, financialDigest: digestSfValue(event.after[2]?.data),
        productStateDigest: digestSfValue(event.after[0]?.data.__sfProductV1), historicalCaptureQualified: false }))
    } finally { await fixture.dispose() }
  })
}
