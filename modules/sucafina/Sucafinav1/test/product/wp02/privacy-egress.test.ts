import { expect, test } from "bun:test"
import { mkdtemp, realpath, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { randomUUID } from "node:crypto"
import { openLocalStore } from "../../../runtime/local-store.ts"
import { resolve } from "../../../src/identity.ts"
import { createSfSourcePersistence } from "../../../product/integration/source-lifecycle.ts"
import { enumerateSfSources } from "../../../product/integration/source-inventory.ts"
import { createSfSourceScopeProjector } from "../../../product/integration/source-projections.ts"
import { createDashboardSourceIssuer } from "../../../product/integration/dashboard-sources.ts"
import { createDashboardSourceHost } from "../../../product/dashboard/sources.ts"
import { createDashboardPort } from "../../../product/dashboard/port.ts"
import type { DomainPortHost } from "../../../product/contracts/ports.ts"
import type { TrustedDomainContext } from "../../../product/contracts/sf-execution.ts"

const period = { start: "2026-01-01", end: "2026-12-31" }
const binding = { kind: "ui", binding: { installationId: "i", projectId: "p", principalRef: "viewer", requestId: "r", policyVersion: "1", accessRevision: "1", expiresAt: "2099-01-01T00:00:00Z" }, lease: {} } as unknown as TrustedDomainContext

test("dashboard producer does not emit restricted content or its private dependency digest", async () => {
  const directory = await mkdtemp(path.join(await realpath(tmpdir()), "sf-dashboard-egress-"))
  const store = await openLocalStore(directory)
  try {
    const at = "2026-11-13T12:00:00Z"
    const persistence = createSfSourcePersistence({ persistence: store, createId: randomUUID, enumerate: enumerateSfSources, projectScope: createSfSourceScopeProjector(() => at) })
    await persistence.initializeSources("dashboard")
    await persistence.transaction("dashboard", async (snapshot) => { snapshot.data.roleMap = [{ surface: "dashboard", role: "viewer", entra: "viewers", version: 1, by: "admin" }]; snapshot.data.summaries = ["IT Operations"]; snapshot.data.secIncidents = [{ id: "restricted-incident-id", title: "confidential-incident-alpha" }]; return { commit: true, value: undefined } })
    const request = new Request("https://example.test", { headers: { authorization: "viewer" } })
    const host: DomainPortHost = { persistence, authenticate: async (incoming, context) => incoming.headers.get("authorization") === "viewer" ? resolve("viewer", [...context!.roleMap], (group) => group === "viewers") : null, environment: async () => ({ at, id: randomUUID, directory: [] }), requestFor: () => request, revalidate: async () => true }
    const selection = { page: "Executive Dashboard", fields: ["executiveMonths"], period }
    const issued = await createDashboardSourceIssuer({ host, scopedSources: persistence })(selection, binding)
    expect(issued.status).toBe("ok")
    if (issued.status !== "ok") return
    const port = createDashboardPort({ host, sources: createDashboardSourceHost({ host, scopedSources: persistence }) })
    const before = await port.read({ selectionRef: issued.value.selectionRef, fields: selection.fields, period }, binding)
    expect(before.status).toBe("ok")
    expect(JSON.stringify(before)).not.toContain("confidential-incident-alpha")
    expect(JSON.stringify(before)).not.toContain("restricted-incident-id")
    expect(JSON.stringify(before)).not.toContain("privateDependencyDigest")
    await persistence.transaction("dashboard", async (snapshot) => { snapshot.data.secIncidents = [{ id: "restricted-incident-id", title: "confidential-incident-beta" }]; return { commit: true, value: undefined } })
    const after = await port.read({ selectionRef: issued.value.selectionRef, fields: selection.fields, period }, binding)
    expect(after).toEqual(before)
    expect(JSON.stringify(after)).not.toContain("confidential-incident-beta")
  } finally { await store.dispose(); await rm(directory, { recursive: true, force: true }) }
})
