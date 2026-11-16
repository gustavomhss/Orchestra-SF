import { expect, test } from "bun:test"
import { createSfLiveContext } from "../../../../../apps/cli/src/sucafina-product/native-ui/live-context.ts"
import { createSfContextHandler } from "../../../../../apps/cli/src/sucafina-product/native-ui/context.ts"

const origin = "http://127.0.0.1:4096"
const mount = "/sucafina"
const binding = Object.freeze({ installationId: "installation-a", projectId: "project-a", hostId: "host-a" })
const stamp = Object.freeze({ ...binding, principalRef: "person", policyVersion: "policy", accessRevision: "revision" })
const contextUrl = origin + mount + "/api/ui/context?installationId=installation-a&projectId=project-a&hostId=host-a"

test("internal page admission keeps the exact Request and public context remains strict", async () => {
  const seen: Request[] = []
  const live = createSfLiveContext({
    origin, mount, currentBinding: () => binding,
    admit: async (request) => {
      seen.push(request)
      return { status: "ok", stamp, authMode: "local-operator", destinations: [] }
    },
  })
  const services = { nativeUiProducts: live }
  const handler = createSfContextHandler({ origin, mount, runtime: () => services as never, application: {} as never })
  const original = new Request(origin + mount + "/api/ui/pages/CAP01?year=2026")
  expect((await handler.readContext(original)).status).toBe("ok")
  expect(seen).toHaveLength(3)
  expect(seen.every((request) => request === original)).toBe(true)
  expect((await handler.handle(original)).status).toBe(400)
  expect((await handler.handle(new Request(contextUrl))).status).toBe(200)
})

test("internal admission rejects foreign origins, unregistered routes, wrong methods and duplicate selectors", async () => {
  let reads = 0
  const live = createSfLiveContext({
    origin, mount, currentBinding: () => binding,
    admit: async () => { reads++; return { status: "ok", stamp, authMode: "local-operator", destinations: [] } },
  })
  for (const request of [
    new Request("http://localhost:4096" + mount + "/api/ui/pages/CAP01"),
    new Request(origin + mount + "/api/ui/not-registered"),
    new Request(origin + mount + "/api/ui/pages/CAP01", { method: "POST" }),
    new Request(origin + mount + "/api/ui/pages/CAP01?year=2026&year=2027"),
    new Request(origin + mount + "/api/ui/pages/CAP01", { headers: { origin: "http://evil.example" } }),
    new Request(origin + mount + "/api/ui/pages/CAP01", { headers: { "sec-fetch-site": "cross-site" } }),
  ]) expect((await live.readRequestContext(request, binding)).status).toBe("unavailable")
  expect(reads).toBe(0)
})

test("internal admission fences revocation while retaining the original Request", async () => {
  let reads = 0
  const original = new Request(origin + mount + "/api/ui/pages/CAP01?year=2026")
  const live = createSfLiveContext({
    origin, mount, currentBinding: () => binding,
    admit: async (request) => {
      expect(request).toBe(original)
      return { status: "ok", stamp: { ...stamp, accessRevision: ++reads === 2 ? "revoked" : stamp.accessRevision },
        authMode: "local-operator", destinations: [] }
    },
  })
  expect(await live.readRequestContext(original, binding)).toEqual({ status: "unavailable", reason: "contract-mismatch" })
})
