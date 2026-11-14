import { expect, test } from "bun:test"
import { createCollaborationHttp } from "../../../product/collaboration/http.ts"
import { createCollaborationHumanAuthority } from "../../../product/collaboration/human.ts"
import { createSfUiAuthority } from "../../../product/integration/ui-authority.ts"
import type { TrustedUiContext } from "../../../product/contracts/sf-execution.ts"

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

test("private HTTP requires exact mount, one route key, bounded JSON and POST before admission", async () => {
  const admitted: string[] = []
  const http = createCollaborationHttp({ origin: "https://example.test", mount: "/product", host: {} as never, human: {} as never, admitRead: async () => { admitted.push("read"); return { status: "denied", reason: "not-admitted" } }, finishRead: () => undefined })
  const send = (suffix: string, body = "{}", method = "POST", contentType = "application/json") => http(new Request(`https://example.test${suffix}`, { method, headers: { origin: "https://example.test", "content-type": contentType }, ...(method === "POST" ? { body } : {}) }))
  expect((await send("/product/other?sf=collaboration-recipients"))?.status).toBe(403)
  expect((await send("/product?sf=collaboration-recipients&sf=collaboration-recipients"))?.status).toBe(400)
  expect((await send("/product?sf=collaboration-recipients&actor=other"))?.status).toBe(400)
  expect((await send("/product?sf=collaboration-recipients", "{}", "GET"))?.status).toBe(405)
  expect((await send("/product?sf=collaboration-recipients", "{}", "POST", "text/plain"))?.status).toBe(415)
  expect((await send("/product?sf=collaboration-recipients", "{"))?.status).toBe(400)
  expect((await send("/product?sf=collaboration-recipients", JSON.stringify({ padding: "x".repeat(131073) })))?.status).toBe(413)
  expect(admitted).toEqual([])
})

test("real private human grant binds the whole payload and is finished after a handler failure", async () => {
  const ui = createSfUiAuthority({ authorize: async () => ({ installationId: "install", projectId: "project", principalRef: "person", policyVersion: "policy", accessRevision: "access" }), commandIdentity: async () => "command", createId: () => "request", now: () => 1000, privateCommands: ["sf-human:collaboration.relation.confirm"] })
  const human = createCollaborationHumanAuthority({ origin: "https://example.test", ui })
  const selected = { operation: "create", pair: { fromRef: "a", toRef: "b" }, mutation: { expectedStorageVersion: 0, idempotencyKey: "one" } }
  const calls: { context: TrustedUiContext; authorized: boolean }[] = []
  const http = createCollaborationHttp({
    origin: "https://example.test", mount: "/product", human,
    host: { relations: { create: async (_pair: unknown, _mutation: unknown, context: TrustedUiContext) => { calls.push({ context, authorized: await human.authorize(context, "collaboration.relation.confirm", selected) }); throw new Error("private sentinel must never appear in response") } } } as never,
    admitRead: async () => ({ status: "denied", reason: "not-admitted" }), finishRead: () => undefined,
  })
  const response = await http(new Request("https://example.test/product?sf=collaboration-relation-create", { method: "POST", headers: { origin: "https://example.test", "content-type": "application/json" }, body: JSON.stringify(selected) }))
  expect(response?.status).toBe(503)
  expect(await response?.text()).not.toContain("sentinel")
  expect(calls).toHaveLength(1)
  expect(calls[0]?.authorized).toBe(true)
  expect(await human.authorize(calls[0]!.context, "collaboration.relation.confirm", selected)).toBe(false)
})

test("answer observation HTTP returns the display projection while keeping provider-only data private", async () => {
  const context = { kind: "ui", binding: { principalRef: "person" } } as unknown as TrustedUiContext
  const finished: TrustedUiContext[] = []
  const admitted: unknown[] = []
  const http = createCollaborationHttp({
    origin: "https://example.test", mount: "/product", human: {} as never,
    host: { answerReuse: { prepare: async () => ({ status: "ok", value: { observationRef: "opaque", observedSourceVersion: 7, expectedScopeFingerprint: "fingerprint", answerRef: "answer", answer: "March", authorRef: "author", scope: { period: "March" }, observation: { evidence: { refId: "source" }, projection: { values: ["March"] }, privateProviderToken: "never-public", physicalIncarnation: "host-only" } } }) } } as never,
    admitRead: async (_request, operation, payload) => { admitted.push({ operation, payload }); return { status: "ok", value: context } }, finishRead: (value) => { finished.push(value) },
  })
  const response = await http(new Request("https://example.test/product?sf=collaboration-answer-prepare", { method: "POST", headers: { origin: "https://example.test", "content-type": "application/json" }, body: JSON.stringify({ questionId: "question", answerRef: "answer" }) }))
  expect(response?.status).toBe(200)
  const body = await response!.text()
  expect(body).toContain("opaque")
  expect(body).toContain("projection")
  expect(body).not.toContain("never-public")
  expect(body).not.toContain("host-only")
  expect(finished).toEqual([context])
  expect(admitted).toEqual([{ operation: "collaboration.answer.prepare", payload: { questionId: "question", answerRef: "answer" } }])
})

