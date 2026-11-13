import { expect, test } from "bun:test"
import { createCollaborationHttp } from "../../../product/interface/collaboration-http.ts"

test("private collaboration HTTP binds the whole human command and rejects other origins", async () => {
  const admitted: unknown[] = []
  const applied: unknown[] = []
  const context = { kind: "ui", binding: { principalRef: "person" } }
  const http = createCollaborationHttp({
    origin: "https://example.test",
    mount: "/product",
    host: { relations: { create: async (pair: unknown, mutation: unknown) => { applied.push({ pair, mutation }); return { status: "ok", value: { id: "relation" } } } } } as never,
    human: { admit: async (_request, action, payload) => { admitted.push({ action, payload }); return { status: "ok", value: context as never } }, finish: () => undefined },
    admitRead: async () => ({ status: "denied", reason: "not-admitted" }),
    finishRead: () => undefined,
  })
  const payload = { operation: "create", pair: { fromRef: "a", toRef: "b" }, mutation: { expectedStorageVersion: 0, idempotencyKey: "one" } }
  const request = (origin: string) => new Request("https://example.test/product?sf=collaboration-relation-create", { method: "POST", headers: { origin, "content-type": "application/json" }, body: JSON.stringify(payload) })
  expect((await http(request("https://other.test")))?.status).toBe(403)
  expect(admitted).toEqual([])
  expect(applied).toEqual([])
  const altered = new Request("https://example.test/product?sf=collaboration-relation-create", { method: "POST", headers: { origin: "https://example.test", "content-type": "application/json" }, body: JSON.stringify({ ...payload, extra: true }) })
  expect((await http(altered))?.status).toBe(400)
  expect(admitted).toEqual([])
  const result = await http(request("https://example.test"))
  expect(result?.status).toBe(200)
  expect(result?.headers.get("cache-control")).toBe("no-store")
  expect(admitted).toEqual([{ action: "collaboration.relation.confirm", payload }])
  expect(applied).toEqual([{ pair: payload.pair, mutation: payload.mutation }])
})

test("private collaboration HTTP does not route prototype keys", async () => {
  const http = createCollaborationHttp({ origin: "https://example.test", mount: "/product", host: {} as never, human: {} as never, admitRead: async () => ({ status: "denied", reason: "not-admitted" }), finishRead: () => undefined })
  const result = await http(new Request("https://example.test/product?sf=collaboration-constructor", { method: "POST", headers: { origin: "https://example.test", "content-type": "application/json" }, body: "{}" }))
  expect(result?.status).toBe(404)
})
