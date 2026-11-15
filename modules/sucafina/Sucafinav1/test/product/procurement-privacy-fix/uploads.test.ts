import { Database } from "bun:sqlite"
import { expect, test } from "bun:test"
import { join } from "node:path"
import { createPrivacyFixture, requestVersion } from "./fixture.ts"

test.each(["quote", "signed-po"] as const)("M73 %s upload hides missing and foreign requests before consuming scanner capacity", async (kind) => {
  const app = await createPrivacyFixture()
  const scan = { calls: 0 }
  // A tripwire, not a clean-scanner substitute: no invisible upload may invoke it.
  const handler = app.handlerFor({
    signingKey: new Uint8Array(32).fill(73),
    scan: async () => {
      scan.calls += 1
      throw new Error("Unadmitted request reached the scanner")
    },
  })
  const database = new Database(join(app.directory, "installation.sqlite"), { readonly: true })
  try {
    const hidden = await app.create("bob", "Private upload target73")
    const before = await app.snapshot()
    const version = requestVersion(before, hidden)
    const storedBefore = database.query("SELECT surface, payload FROM snapshots ORDER BY surface").all()
    const blobsBefore = database.query("SELECT surface, key, type, payload FROM blobs ORDER BY surface, key").all()
    const responses: { status: number; body: string; headers: [string, string][] }[] = []
    for (const record of ["PR-2099-9999", hidden, "toString"]) {
      for (const recordVersion of [0, version, version + 1]) {
        const query = new URLSearchParams({ page: "Requests", upload: kind, record, recordVersion: String(recordVersion), name: "private73.txt" })
        const response = await handler(new Request(`https://privacy.invalid/sf/procurement?${query}`, {
          method: "POST",
          headers: { authorization: "Bearer alice", origin: "https://privacy.invalid", "content-type": "text/plain" },
          body: "Synthetic attachment which must not be scanned or stored",
        }))
        if (!response) throw new Error("Canonical upload route unavailable")
        responses.push({ status: response.status, body: await response.text(), headers: [...response.headers.entries()] })
      }
    }
    expect(responses).toHaveLength(9)
    for (const response of responses) {
      expect(response).toEqual(responses[0]!)
      expect(response.status).toBe(404)
      expect(response.body).toBe('{"ok":false,"status":404}')
      expect(response.body).not.toContain(hidden)
    }
    expect(scan.calls).toBe(0)
    expect(await app.snapshot()).toEqual(before)
    expect(database.query("SELECT surface, payload FROM snapshots ORDER BY surface").all()).toEqual(storedBefore)
    expect(database.query("SELECT surface, key, type, payload FROM blobs ORDER BY surface, key").all()).toEqual(blobsBefore)
  } finally {
    database.close()
    await app.dispose()
  }
})

test.each(["", "local:synthetic73"])("M73 invalid principal %s cannot probe request uploads", async (principal) => {
  const app = await createPrivacyFixture()
  const scan = { calls: 0 }
  app.roles[principal] = ["buyer"]
  const handler = app.handlerFor({
    signingKey: new Uint8Array(32).fill(73),
    scan: async () => {
      scan.calls += 1
      throw new Error("Invalid principal reached scanner")
    },
  })
  try {
    const hidden = await app.create("bob")
    const before = await app.snapshot()
    const responses: { status: number; body: string }[] = []
    for (const kind of ["quote", "signed-po"]) {
      for (const record of ["PR-2099-9999", hidden]) {
        const query = new URLSearchParams({ page: "Requests", upload: kind, record, recordVersion: "0", name: "probe.txt" })
        const response = await handler(new Request(`https://privacy.invalid/sf/procurement?${query}`, {
          method: "POST", body: "Synthetic unadmitted bytes",
          headers: { ...(principal ? { authorization: `Bearer ${principal}` } : {}), origin: "https://privacy.invalid", "content-type": "text/plain" },
        }))
        if (!response) throw new Error("Canonical upload route unavailable")
        responses.push({ status: response.status, body: await response.text() })
      }
    }
    for (const response of responses) expect(response).toEqual({ status: 403, body: "Access denied" })
    expect(scan.calls).toBe(0)
    expect(await app.snapshot()).toEqual(before)
  } finally {
    await app.dispose()
  }
})
