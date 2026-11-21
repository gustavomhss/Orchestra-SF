import { expect, test } from "bun:test"
import { createModule } from "../index.ts"
import { empty, testPersistence } from "./fixture/persistence.ts"

test.each([
  { change: "none", status: 200 },
  { change: "access", status: 403 },
  { change: "source", status: 409 },
])("Files exports check current $change state before returning bytes", async ({ change, status }) => {
  const dashboard = empty()
  dashboard.data.hotTopics = [{ id: "topic", action: "Visible row", __sfProductV1: { token: "private state" } }]
  dashboard.data.__sfProductV1 = { marker: "private state" }
  const store = testPersistence({ dashboard })
  let reads = 0
  const business = createModule("/sf", {
    persistence: {
      async transaction(surface, work, options) {
        reads += 1
        if (change === "source" && reads === 2) {
          await store.persistence.transaction("dashboard", async (snapshot) => {
            snapshot.data.hotTopics = [{ id: "topic", action: "Changed after generation" }]
            return { commit: true, value: undefined }
          })
        }
        return store.persistence.transaction(surface, work, options)
      },
    },
    authenticate: async () => change === "access" && reads > 1
      ? null
      : { id: "export-user", canWrite: true, roles: [{ surface: "dashboard", role: "admin" }] },
    environment: async () => ({ at: "2026-11-21T00:00:00Z", id: () => "unused", directory: [] }),
    maxJsonBytes: 65_536,
  })

  const response = await business(new Request("https://sf.example/sf/dashboard?download=json"))
  expect(response?.status).toBe(status)
  const body = await response?.text()
  expect(body).not.toContain("private state")
  if (status === 200) expect(body).toContain("Visible row")
  if (status !== 200) expect(body).not.toContain("Visible row")
})
