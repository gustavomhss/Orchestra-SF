import { expect, test } from "bun:test"
import { createModule } from "../index.ts"
import type { AssetPersistence, BlobTransaction } from "../runtime/assets.ts"
import type { Persistence, Snapshot } from "../runtime/contract.ts"
import type { ResolvedActor, Surface } from "../src/identity.ts"
import { empty } from "./fixture/persistence.ts"

function fixture() {
  const state: Record<Surface, Snapshot> = {
    dashboard: empty(),
    planner: empty(),
    procurement: empty(),
  }
  state.dashboard.data.contracts = [{ id: "c1", vendor: "Original vendor" }]
  state.dashboard.versions["contracts:c1"] = { version: 3, by: "previous-editor" }
  state.dashboard.versions.dataset = { version: 7, by: "previous-editor" }
  const files: Record<Surface, Map<string, Uint8Array>> = {
    dashboard: new Map(),
    planner: new Map(),
    procurement: new Map(),
  }
  const identity: { principal: ResolvedActor } = {
    principal: {
      id: "directory-owner",
      canWrite: true,
      roles: [{ surface: "dashboard", role: "admin" }],
    },
  }
  const events: string[] = []
  const blobCalls: string[] = []
  const scanner = {
    accept: async (_bytes: Uint8Array, _type: string) => true,
  }
  const transactions = { active: 0 }
  const tails: Partial<Record<Surface, Promise<void>>> = {}
  // One authoritative adapter stages both kinds of state and serializes each surface.
  // A refusal or exception commits neither metadata nor private bytes.
  const persistence: AssetPersistence & Persistence = {
    transaction<T>(
      surface: Surface,
      work: (snapshot: Snapshot, blobs: BlobTransaction) => Promise<{ commit: boolean; value: T }>,
    ) {
      const pending = (tails[surface] ?? Promise.resolve()).then(async () => {
        const snapshot = structuredClone(state[surface])
        const staged = structuredClone(files[surface])
        const blobs: BlobTransaction = {
          put: async (key, bytes) => {
            blobCalls.push(`put:${key}`)
            staged.set(key, new Uint8Array(bytes))
          },
          get: async (key) => {
            blobCalls.push(`get:${key}`)
            return staged.get(key)
          },
          remove: async (key) => {
            blobCalls.push(`remove:${key}`)
            staged.delete(key)
          },
        }
        transactions.active++
        try {
          const result = await work(snapshot, blobs)
          if (result.commit) {
            state[surface] = snapshot
            files[surface] = staged
          }
          return result.value
        } finally {
          transactions.active--
        }
      })
      tails[surface] = pending.then(
        () => undefined,
        () => undefined,
      )
      return pending
    },
  }
  const handler = createModule("/sucafina", {
    authenticate: async () => {
      events.push(`authenticate:${identity.principal.roles.map((row) => row.role).join(",") || "none"}`)
      return structuredClone(identity.principal)
    },
    environment: async () => ({
      at: "2026-11-11T12:00:00Z",
      id: () => "document-1",
      directory: [{ id: "directory-owner", name: "Owner from directory" }],
    }),
    persistence,
    assets: {
      persistence,
      services: {
        signingKey: new Uint8Array(32).fill(7),
        scan: async (bytes, type) => {
          events.push("scan")
          return scanner.accept(bytes, type)
        },
      },
    },
    maxJsonBytes: 100000,
  })
  const server = Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    fetch: async (request) => (await handler(request)) ?? new Response("Not found", { status: 404 }),
  })
  const origin = `http://127.0.0.1:${server.port}`
  const upload = () =>
    fetch(
      `${origin}/sucafina/dashboard?${new URLSearchParams({
        page: "Vendor Contracts",
        upload: "contract",
        record: "c1",
        recordVersion: "3",
        name: "terms.txt",
      })}`,
      {
        method: "POST",
        headers: { "Content-Type": "text/plain", Origin: origin },
        body: "Agreed terms",
      },
    )
  const backupImport = (version: number) =>
    fetch(`${origin}/sucafina/dashboard`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: origin },
      body: JSON.stringify({
        page: "Vendor Contracts",
        action: "backup-import",
        version,
        confirmed: true,
        values: { data: { contracts: [{ id: "c1", vendor: "Stale replacement" }] } },
      }),
    })
  return { state, files, identity, events, blobCalls, scanner, transactions, server, upload, backupImport }
}

async function withModule(run: (app: ReturnType<typeof fixture>) => Promise<void>) {
  const app = fixture()
  try {
    await run(app)
  } finally {
    app.server.stop(true)
  }
}

test("HTTP upload commits canonical metadata, record and dataset versions, bytes and directory-named audit", async () => {
  await withModule(async (app) => {
    const otherSurfaces = structuredClone({ planner: app.state.planner, procurement: app.state.procurement })
    const response = await app.upload()
    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({ ok: true })
    expect(app.state.dashboard.versions["contracts:c1"]).toEqual({ version: 4, by: "directory-owner" })
    expect(app.state.dashboard.versions.dataset).toEqual({ version: 8, by: "directory-owner" })
    expect(app.state.dashboard.data.contracts).toMatchObject([
      {
        id: "c1",
        vendor: "Original vendor",
        docs: [
          {
            id: "document-1",
            name: "terms.txt",
            key: "contracts/c1/document-1",
            type: "text/plain",
            bytes: 12,
            size: 12,
          },
        ],
      },
    ])
    expect(app.files.dashboard.get("contracts/c1/document-1")).toEqual(new TextEncoder().encode("Agreed terms"))
    expect(app.blobCalls).toEqual(["put:contracts/c1/document-1"])
    expect(app.state.dashboard.audit).toHaveLength(1)
    expect(app.state.dashboard.audit[0]).toMatchObject({
      who: "directory-owner",
      name: "Owner from directory",
      at: "2026-11-11T12:00:00Z",
      record: "contracts:c1",
      was: { id: "c1", vendor: "Original vendor" },
      became: { id: "c1", docs: [{ id: "document-1" }] },
    })
    expect(app.events).toEqual(["authenticate:admin", "scan", "authenticate:admin"])
    expect({ planner: app.state.planner, procurement: app.state.procurement }).toEqual(otherSurfaces)
    expect(app.files.planner.size + app.files.procurement.size).toBe(0)
  })
})

test("HTTP stale dataset backup import cannot overwrite an upload or its audit and private bytes", async () => {
  await withModule(async (app) => {
    const readVersion = app.state.dashboard.versions.dataset!.version
    const uploaded = await app.upload()
    expect(uploaded.status).toBe(200)
    await uploaded.arrayBuffer()
    const before = structuredClone({ state: app.state, files: app.files })
    const calls = [...app.blobCalls]
    const response = await app.backupImport(readVersion)
    expect(response.status).toBe(409)
    expect(await response.json()).toMatchObject({ ok: false, status: 409, by: "directory-owner" })
    expect({ state: app.state, files: app.files }).toEqual(before)
    expect(app.blobCalls).toEqual(calls)
  })
})

test("HTTP upload rechecks current role after preflight scanning and refuses revocation without blob calls", async () => {
  await withModule(async (app) => {
    const before = structuredClone({ state: app.state, files: app.files })
    app.scanner.accept = async (bytes, type) => {
      expect(app.events).toEqual(["authenticate:admin", "scan"])
      expect(app.transactions.active).toBe(0)
      expect(new TextDecoder().decode(bytes)).toBe("Agreed terms")
      expect(type).toBe("text/plain")
      app.identity.principal = { ...app.identity.principal, roles: [] }
      return true
    }
    const response = await app.upload()
    expect(response.status).toBe(403)
    await response.arrayBuffer()
    expect(app.events).toEqual(["authenticate:admin", "scan", "authenticate:none"])
    expect(app.blobCalls).toEqual([])
    expect({ state: app.state, files: app.files }).toEqual(before)
    expect(app.state.dashboard.audit).toEqual([])
    expect(app.state.dashboard.versions.dataset?.version).toBe(7)
    expect(app.state.dashboard.versions["contracts:c1"]?.version).toBe(3)
  })
})
