import { expect, test } from "bun:test"
import { digestSfValue } from "../../product/contracts/canonical.ts"
import { selectSfNamespaceHealth } from "../../product/host-binding/state-provider.ts"
import { financialCompositionFixture } from "../product/wp10/integration/financial-composition-fixture.ts"

test("private proposal and receipt health exposes only current C08 metadata and keeps original authority", async () => {
  const f = await financialCompositionFixture()
  try {
    const request = new Request("https://example.test/sucafina/api/ui/context?installationId=installation&projectId=project&hostId=host")
    const initialized = await f.authority.state.transaction(request, {
      namespace: "preferences", expectedStorageVersion: 0,
      targetRef: f.authority.creationTarget.ref, targetIncarnation: f.authority.creationTarget.incarnation,
      idempotencyKey: "namespace-health-fixture", commandDigest: digestSfValue({ fixture: "namespace-health" }),
    }, async (state) => { state.preferences["namespace-health-fixture"] = "private"; return { commit: true, value: true } })
    expect(initialized.status).toBe("ok")
    const admitted = await f.authority.readContextAdmission(request)
    if (admitted.status !== "ok") throw new Error("Original namespace admission unavailable")
    for (const namespace of ["preferences", "receipts"] as const) {
      const original = await f.authority.state.read(request, namespace, (state) => ({
        storageVersion: state.versions[namespace], aggregateRevision: state.revision, incarnation: state.incarnation,
      }))
      expect(original.status).toBe("ok")
      if (original.status !== "ok") throw new Error("Original namespace state unavailable")
      for (const mode of ["read", "write"] as const) {
        const selected = await f.authority.state.read(request, namespace, selectSfNamespaceHealth(namespace, admitted.stamp, mode))
        expect(selected).toEqual(original)
        if (selected.status !== "ok" || !selected.value) throw new Error("Namespace health unavailable")
        expect(Object.keys(selected.value).sort()).toEqual(["aggregateRevision", "incarnation", "storageVersion"])
        expect(JSON.stringify(selected.value)).not.toContain("private")
      }
      const changed = await f.authority.state.read(request, namespace, selectSfNamespaceHealth(namespace, {
        ...admitted.stamp, accessRevision: "changed-authority",
      }))
      expect(changed.status).toBe("ok")
      if (changed.status !== "ok") throw new Error("Original namespace read unexpectedly denied")
      expect(changed.value).toBeUndefined()
    }
    f.active.value = false
    for (const namespace of ["preferences", "receipts"] as const) {
      const denied = await f.authority.state.read(request, namespace, selectSfNamespaceHealth(namespace, admitted.stamp))
      expect(denied.status).toBe("denied")
      expect(JSON.stringify(denied)).not.toContain("private")
    }
  } finally { await f.dispose() }
})
