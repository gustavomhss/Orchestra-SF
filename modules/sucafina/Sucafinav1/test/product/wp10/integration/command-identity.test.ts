import { expect, test } from "bun:test"
import { randomUUID } from "node:crypto"
import { sfUiCommandIdentity } from "../../../../../../../apps/cli/src/sucafina-product/command-identity.ts"
import { digestSfValue } from "../../../../product/contracts/canonical.ts"
import { createCollaborationHttp } from "../../../../product/collaboration/http.ts"
import { createCollaborationHttpRoutes } from "../../../../product/collaboration/http-routes.ts"
import { sfHumanReadActions } from "../../../../product/integration/human-authority.ts"
import type { SfHumanAction } from "../../../../product/integration/human-authority.ts"
import { financialCompositionFixture } from "./financial-composition-fixture.ts"

const origin = "https://example.test"
const mount = "/sucafina"

test("installed read command identities preserve real admission, storage and revocation fences", async () => {
  const readOperations = new Map<string, string>()
  const identity = (request: Request, operation: string) => sfUiCommandIdentity(request, operation, { origin, mount, readOperations, createId: randomUUID })
  const f = await financialCompositionFixture({ humanActions: [...sfHumanReadActions, "collaboration.thread.create"],
    commandIdentity: async (request, operation) => identity(request, operation) })
  try {
    for (const [mode, route] of createCollaborationHttpRoutes(f.business.collaboration)) {
      if (!route.action && route.read && sfHumanReadActions.some((action) => action === route.read))
        readOperations.set(`collaboration-${mode}`, `sf-human:${route.read}`)
    }
    const request = (mode: string, payload: unknown = {}, surface = "dashboard", headers: Record<string, string> = {}) =>
      new Request(`${origin}${mount}/${surface}?sf=${mode}`, { method: "POST",
        headers: { origin, "content-type": "application/json", ...headers }, body: JSON.stringify(payload) })
    const http = createCollaborationHttp({ origin, mount: mount + "/dashboard", host: f.business.collaboration, human: f.authority.human,
      admitRead: async (request, operation, payload) => sfHumanReadActions.some((action) => action === operation)
        ? f.authority.human.admit(request, operation as SfHumanAction, payload)
        : { status: "denied", reason: "unregistered-read" }, finishRead: f.authority.human.finish })
    const stateRequest = new Request(origin + mount + "/dashboard")
    const before = await f.authority.state.read(stateRequest, "threads", () => null)
    const response = await http(request("collaboration-recipients"))
    expect(response?.status).toBe(200)
    expect(await response!.json()).toEqual({ status: "ok", value: [{ id: "person", name: "Person" }] })
    expect(await f.authority.state.read(stateRequest, "threads", () => null)).toEqual(before)

    // Every alias comes from the real route table and its closed human-read registry.
    for (const [mode, operation] of readOperations) {
      for (const surface of ["dashboard", "planner", "procurement"]) {
        const first = identity(request(mode, {}, surface), operation)
        expect(first).toBeString()
        expect(identity(request(mode, {}, surface), operation)).not.toBe(first)
      }
      expect(identity(request(mode), "sf-human:collaboration.thread.create")).toBeUndefined()
    }
    expect(readOperations.get("collaboration-answer-prepare-message")).toBe("sf-human:collaboration.answer.prepare")
    expect(readOperations.has("collaboration-thread-create")).toBe(false)

    const selected = { reviewRef: "review", sectionId: "project", basis: { sourceRef: "selected-source" } }
    const source = request("review-thread-context", selected)
    const digest = digestSfValue(selected)
    const admitted = await f.authority.ui.admit(source, "sf_review_prepare", digest)
    expect(admitted.status).toBe("ok")
    if (admitted.status !== "ok") throw new Error(admitted.reason)
    expect(await f.authority.ui.validate(admitted.value, "sf_review_prepare", digestSfValue({ changed: true }))).toBe(false)
    expect(await f.authority.ui.validate(admitted.value, "sf_review_prepare", digest)).toBe(true)
    expect(f.authority.ui.requestFor(admitted.value)).toBe(source)
    expect(f.authority.ui.matchesIntent(admitted.value, "sf_review_prepare", digest)).toBe(true)
    expect(f.authority.ui.matchesIntent(admitted.value, "sf_report_prepare", digest)).toBe(false)

    const write = await http(request("collaboration-thread-create", { draft: {}, mutation: {} }))
    expect(write?.status).toBe(503)
    expect(await write!.json()).toEqual({ status: "unavailable", reason: "ui-identity-unavailable" })
    expect(await f.authority.state.read(stateRequest, "threads", () => null)).toEqual(before)

    const mode = "collaboration-recipients"
    const operation = readOperations.get(mode)!
    const invalid = [
      request(mode + "&sf=" + mode), request(mode + "&extra=1"), request(""), request("collaboration-invented"),
      request(mode, {}, "other"), request(mode, {}, "dashboard/child"),
      request(mode, {}, "dashboard", { origin: "https://other.test" }),
      request(mode, {}, "dashboard", { "sec-fetch-site": "cross-site" }),
      request(mode, {}, "dashboard", { "content-type": "text/plain" }),
      new Request(origin + mount + "/dashboard?sf=" + mode, { method: "POST", headers: { "content-type": "application/json" }, body: "{}" }),
      new Request("https://other.test" + mount + "/dashboard?sf=" + mode, { method: "POST", headers: { origin, "content-type": "application/json" }, body: "{}" }),
      new Request(origin + mount + "/dashboard?sf=" + mode, { method: "PUT", headers: { origin, "content-type": "application/json" }, body: "{}" }),
    ]
    const cancelled = new AbortController()
    cancelled.abort()
    invalid.push(new Request(origin + mount + "/dashboard?sf=" + mode, { method: "POST", signal: cancelled.signal, headers: { origin, "content-type": "application/json" }, body: "{}" }))
    for (const item of invalid) expect(identity(item, operation)).toBeUndefined()
    expect(identity(request("review-thread-context", {}, "planner"), "sf_review_prepare")).toBeUndefined()
    expect(identity(request("review-preview"), "sf_review_prepare")).toBeUndefined()
    expect(identity(request("review-thread-context"), "sf_report_prepare")).toBeUndefined()
    expect(identity(request(mode), "sf-read:collaboration.recipients")).toBeUndefined()

    const key = "same-human-mutation"
    const writeOperation = "sf-human:collaboration.thread.create"
    const keyed = () => request("collaboration-thread-create", {}, "dashboard", { "Idempotency-Key": key })
    expect(identity(keyed(), writeOperation)).toBe(digestSfValue({ operation: writeOperation, key }))
    expect(identity(keyed(), writeOperation)).toBe(identity(keyed(), writeOperation))
    expect(identity(keyed(), operation)).not.toBe(identity(keyed(), writeOperation))
    for (const key of ["", "short", "invalid key", "x".repeat(129)])
      expect(identity(request(mode, {}, "dashboard", { "Idempotency-Key": key }), operation)).toBeUndefined()
    for (const method of ["GET", "HEAD"]) {
      const read = () => new Request(origin + mount + "/dashboard", { method })
      const first = identity(read(), "sf_review_prepare")
      expect(first).toBeString()
      expect(identity(read(), "sf_review_prepare")).not.toBe(first)
    }

    f.active.value = false
    expect(await f.authority.ui.revalidate(admitted.value)).toBe(false)
    expect(f.authority.ui.requestFor(admitted.value)).toBeUndefined()
    expect((await http(request(mode)))?.status).toBe(403)
    f.authority.ui.finish(admitted.value)
  } finally { await f.dispose() }
}, 30_000)
