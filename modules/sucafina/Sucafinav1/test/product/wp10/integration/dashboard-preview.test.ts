import { expect, test } from "bun:test"
import { chmod, mkdtemp, realpath, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { randomBytes, randomUUID } from "node:crypto"
import { createModule } from "../../../../index.ts"
import { openLocalStore } from "../../../../runtime/local-store.ts"
import { createOperatorIdentity } from "../../../../runtime/operator-identity.ts"
import { createSfSourcePersistence } from "../../../../product/integration/source-lifecycle.ts"
import { enumerateSfSources } from "../../../../product/integration/source-inventory.ts"

// Real SQLite, encrypted operator enrollment/session and module HTTP path; no replacement auth service.
test("HTTP preview persists across reload and applies once with the domain receipt in the same commit", async () => {
  const directory = await mkdtemp(path.join(await realpath(tmpdir()), "sf-preview-http-"))
  await chmod(directory, 0o700)
  const key = randomBytes(32)
  const operator = { installationId: randomUUID(), uid: 1000, name: "Test operator" }
  const open = async () => {
    const driver = await openLocalStore(directory)
    const persistence = createSfSourcePersistence({ persistence: driver, enumerate: enumerateSfSources, createId: randomUUID })
    await persistence.initializeSources("dashboard")
    const identity = createOperatorIdentity({ origin: "http://localhost:4110", mount: "/sucafina", operator, secrets: driver.secrets, key })
    const handler = createModule("/sucafina", { persistence, authenticate: identity.authenticate,
      environment: async (request) => ({ at: "2026-11-13T08:00:00Z", id: randomUUID, directory: await identity.directory(request) }), maxJsonBytes: 100000 })
    return { driver, persistence, identity, handler }
  }
  const first = await open()
  try {
    await first.persistence.transaction("dashboard", async (snapshot) => {
      snapshot.data.opexOwners = [{ id: "owner-1", name: "Owner", budget: 1200 }]
      return { commit: true, value: undefined }
    })
    const enrollment = await first.identity.enroll()
    const admitted = await first.identity.handle(new Request(`http://localhost:4110/sucafina/auth/local?code=${enrollment}`))
    expect(admitted?.status).toBe(303)
    const cookie = admitted!.headers.get("set-cookie")!.split(";")[0]!
    const post = (app: Awaited<ReturnType<typeof open>>, action: string, values: Record<string, unknown>, origin = "http://localhost:4110") => app.handler(new Request("http://localhost:4110/sucafina/dashboard", {
      method: "POST", headers: { "Content-Type": "application/json", origin, cookie },
      body: JSON.stringify({ page: "OPEX Detail", action, version: 0, values }),
    }))
    const preview = await post(first, "preview-change", { command: { page: "OPEX Detail", action: "annual-entry", id: "owner-1", version: 0, values: { year: 2026, annual: 2400 } } })
    expect(preview?.status).toBe(200)
    const body = await preview!.json()
    expect(body.value.status).toBe("preview")
    expect(body.value.changes.length).toBeGreaterThan(0)
    const previewRef = body.value.previewRef
    expect(await first.persistence.transaction("dashboard", async (snapshot) => ({ commit: false, value: snapshot.data.opexOwners }))).toMatchObject([{ budget: 1200 }])
    await first.driver.dispose()
    const second = await open()
    try {
      expect((await post(second, "read-preview", { previewRef }))?.status).toBe(200)
      expect((await post(second, "apply-preview", { previewRef }, "https://other.example"))?.status).toBe(403)
      const applied = await post(second, "apply-preview", { previewRef })
      expect(applied?.status).toBe(200)
      const receipt = await applied!.json()
      expect(receipt.value).toMatchObject({ previewRef, applied: true })
      const committed = await second.persistence.transaction("dashboard", async (snapshot) => ({ commit: false, value: structuredClone(snapshot) }))
      expect(committed.data.opexOwners).toMatchObject([{ budget: 2400 }])
      expect(committed.audit.length).toBeGreaterThan(0)
      expect(committed.audit.at(-1)?.name).toBe(operator.name)
      expect(await (await post(second, "apply-preview", { previewRef }))!.json()).toEqual(receipt)
      expect(await second.persistence.transaction("dashboard", async (snapshot) => ({ commit: false, value: snapshot.audit.length }))).toBe(committed.audit.length)
      const exported = await second.handler(new Request("http://localhost:4110/sucafina/dashboard?download=json", { headers: { cookie } }))
      expect(await exported!.text()).not.toContain(previewRef)
      await second.identity.handle(new Request("http://localhost:4110/sucafina/auth/logout", { method: "POST", headers: { cookie, origin: "http://localhost:4110" } }))
      expect((await post(second, "apply-preview", { previewRef }))?.status).toBe(401)
    } finally { await second.driver.dispose() }
  } finally { await first.driver.dispose(); await rm(directory, { recursive: true, force: true }) }
})
