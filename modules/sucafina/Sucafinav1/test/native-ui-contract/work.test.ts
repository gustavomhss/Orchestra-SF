import { describe, expect, test } from "bun:test"
import { Schema } from "effect"
import {
  SfWork, SfProjectionWork, SfProjectionWorkItem, SfProjectionSearch, SfViewsList, SfViewsOpen, SfViewsSave, SfViewsRemove,
} from "../../../../../packages/schema/src/sucafina/work"
import { createSfWorkClient } from "../../../../../packages/client/src/sucafina/work"
import { SfOperationRegistry } from "../../../../../packages/schema/src/sucafina/operation-registry"
import { createSfWorkProjectionHandlers } from "../../../../../apps/cli/src/sucafina-product/native-ui/work"

const view = {
  id: "a12_saved_view",
  title: "My current view",
  surface: "dashboard" as const,
  page: "Executive Dashboard" as const,
  period: { start: "2026-01-01", end: "2026-12-31" },
  filters: { selections: { year: "2026", month: "12" } },
}
const versioned = { view, version: 3 }
const signal = new AbortController().signal

function recordingClient() {
  const calls: { operationId: string; input: unknown; options: unknown }[] = []
  const transport = {
    execute: async (operation: { operationId: string }, input: unknown, options: unknown) => {
      calls.push({ operationId: operation.operationId, input, options })
      return { kind: "transport-error", reason: "contract-unavailable" } as const
    },
  } as unknown as Parameters<typeof createSfWorkClient>[0]
  return { calls, client: createSfWorkClient(transport) }
}

describe("A12 — frozen work/search/personal-view bindings", () => {
  test("declares exactly nine immutable catalog operations, with no arbitrary dispatch method", () => {
    const ids = [
      "projection.home", "projection.search", "projection.work",
      "projection.work-item", "projection.work-selection",
      "views.list", "views.open", "views.remove", "views.save",
    ]
    expect(Object.keys(SfWork.operations)).toEqual(ids)
    for (const id of ids) {
      expect<string>(SfWork.operations[id as keyof typeof SfWork.operations].operationId).toBe(id)
    }
    expect("execute" in createSfWorkClient({ execute: async () => ({
      kind: "transport-error", reason: "contract-unavailable",
    }) } as never)).toBe(false)
  })

  test("preserves the V1 wire, per-view CAS, null creation and redacted unavailable entries", () => {
    const saveCreate = { surface: "dashboard", action: "save", input: { view, expectedVersion: null } }
    const saveChange = { surface: "dashboard", action: "save", input: { view, expectedVersion: 3 } }
    expect<object>(Schema.decodeUnknownSync(SfViewsSave.Input)(saveCreate)).toEqual(saveCreate)
    expect<object>(Schema.decodeUnknownSync(SfViewsSave.Input)(saveChange)).toEqual(saveChange)
    expect(Schema.decodeUnknownSync(SfViewsSave.Output)({ status: "ok", value: versioned }))
      .toEqual({ status: "ok", value: versioned })
    expect(Schema.decodeUnknownSync(SfViewsList.Output)({
      status: "ok", value: [{ id: view.id, version: 3, availability: "unavailable" }],
    })).toEqual({
      status: "ok", value: [{ id: view.id, version: 3, availability: "unavailable" }],
    })
    expect(Schema.decodeUnknownSync(SfViewsOpen.Input)({ surface: "dashboard", action: "open", input: { id: view.id } }))
      .toEqual({ surface: "dashboard", action: "open", input: { id: view.id } })
    expect(Schema.decodeUnknownSync(SfViewsRemove.Input)({
      action: "remove", input: { id: view.id, expectedVersion: 3 },
    })).toEqual({ surface: "dashboard", action: "remove", input: { id: view.id, expectedVersion: 3 } })
  })

  test("rejects unknown actions/fields, invalid CAS and V2 envelopes in the legacy schema", () => {
    for (const invalid of [
      { surface: "dashboard", action: "approve", input: { view, expectedVersion: 3 } },
      { surface: "dashboard", action: "save", input: { view, expectedVersion: 0 } },
      { surface: "dashboard", action: "save", input: { view, expectedVersion: -1 } },
      { surface: "dashboard", action: "save", input: { view, expectedVersion: 3, accessToken: "secret" } },
      { surface: "dashboard", action: "save", input: { view: { ...view, externalUrl: "https://example.org" }, expectedVersion: 3 } },
      { surface: "dashboard", action: "save", input: { ...view, schemaVersion: 2, expectedVersion: 3 } },
      { surface: "dashboard", action: "save", input: { view: { ...view, schemaVersion: 2 }, expectedVersion: 3 } },
      { surface: "dashboard", action: "save", input: { view: { ...view, filters: { selections: { bogus: "x" } } }, expectedVersion: 3 } },
      { surface: "dashboard", action: "save", input: { view: { ...view, filters: { selections: { year: "2030" } } }, expectedVersion: 3 } },
    ]) {
      expect(() => Schema.decodeUnknownSync(SfViewsSave.Input)(invalid)).toThrow()
    }
    expect(() => Schema.decodeUnknownSync(SfViewsRemove.Input)({
      action: "remove", input: { id: view.id, expectedVersion: 0 },
    })).toThrow()
    expect(() => Schema.decodeUnknownSync(SfViewsOpen.Input)({
      action: "open", input: { id: view.id, install: "another-owner" },
    })).toThrow()
    expect(() => Schema.decodeUnknownSync(SfViewsList.Output)({
      status: "ok", value: [{ id: view.id, version: 3, availability: "unavailable", title: "leaked" }],
    })).toThrow()
  })

  test("does not collapse title null, sourceVersion 0 or observedVersion 0 to absent", () => {
    const work = { status: "ok", value: { items: [{
      kind: "signal",
      actionRef: "sf-signal:one",
      title: null,
      ownerRef: "original-owner",
      state: "stale",
      sourceVersion: 0,
      observedVersion: 0,
    }] } }
    expect<object>(Schema.decodeUnknownSync(SfProjectionWork.Output)(work)).toEqual(work)
    expect(() => Schema.decodeUnknownSync(SfProjectionWork.Output)({
      status: "ok", value: { items: [{ ...work.value.items[0], secretRoleMap: {} }] },
    })).toThrow()
  })


  test("defaults an omitted V1 route selector without injecting a producer body field", () => {
    expect(Schema.decodeUnknownSync(SfViewsList.Input)({ action: "list", input: {} }))
      .toEqual({ surface: "dashboard", action: "list", input: {} })
    expect(Schema.decodeUnknownSync(SfViewsOpen.Input)({ action: "open", input: { id: view.id } }))
      .toEqual({ surface: "dashboard", action: "open", input: { id: view.id } })
    expect(Schema.decodeUnknownSync(SfViewsSave.Input)({
      action: "save", input: { view, expectedVersion: null },
    })).toEqual({
      surface: "dashboard", action: "save", input: { view, expectedVersion: null },
    })
    expect(Schema.decodeUnknownSync(SfViewsRemove.Input)({
      surface: "procurement", action: "remove", input: { id: view.id, expectedVersion: 3 },
    })).toEqual({
      surface: "procurement", action: "remove", input: { id: view.id, expectedVersion: 3 },
    })
  })

  test("rejects excess V1 fields at every nesting level, not merely at the transport", () => {
    const save = { surface: "dashboard", action: "save", input: { view, expectedVersion: 3 } }
    for (const extra of [
      { ...save, admin: true },
      { ...save, input: { ...save.input, role: "owner" } },
      { ...save, input: { view: { ...view, granted: true }, expectedVersion: 3 } },
      { ...save, input: { view: { ...view, period: { ...view.period, authority: "admin" } }, expectedVersion: 3 } },
      { ...save, input: { view: { ...view, filters: { ...view.filters, accessToken: "private" } }, expectedVersion: 3 } },
      { ...save, input: { view: { ...view, filters: { selections: { ...view.filters.selections, secretRoleMap: "x" } } }, expectedVersion: 3 } },
    ]) {
      expect(() => Schema.decodeUnknownSync(SfViewsSave.Input)(extra)).toThrow()
    }
    expect(() => Schema.decodeUnknownSync(SfViewsList.Output)({
      status: "ok", value: [{ id: view.id, version: 3, availability: "unavailable", view }],
    })).toThrow()
    expect(() => Schema.decodeUnknownSync(SfViewsSave.Output)({
      status: "ok", value: { view, version: 3, extra: "leak" },
    })).toThrow()
  })

  test("rejects nested private work and evidence fields while preserving zero/null", () => {
    const item = {
      kind: "signal" as const,
      actionRef: "sf-signal:one",
      title: null,
      ownerRef: "original-owner",
      state: "stale",
      sourceVersion: 0,
      observedVersion: 0,
      destination: { kind: "signal" as const, ref: "sf-signal:one" },
    }
    expect(Schema.decodeUnknownSync(SfProjectionWork.Output)({
      status: "ok", value: { items: [item] },
    })).toEqual({ status: "ok", value: { items: [item] } })
    for (const itemWithExtras of [
      { ...item, secretRoleMap: {} },
      { ...item, destination: { ...item.destination, accessToken: "secret" } },
    ]) {
      expect(() => Schema.decodeUnknownSync(SfProjectionWork.Output)({
        status: "ok", value: { items: [itemWithExtras] },
      })).toThrow()
    }
    expect(() => Schema.decodeUnknownSync(SfProjectionWork.Output)({
      status: "ok", value: { items: [item], privileged: true },
    })).toThrow()
    expect(() => Schema.decodeUnknownSync(SfProjectionWork.Output)({
      status: "ok", value: { items: [item] }, privileged: true,
    })).toThrow()
  })

  test("routes typed calls through the injected transport without changing IDs, values or options", async () => {
    const { client, calls } = recordingClient()
    const options = { signal, idempotencyKey: "intent-once-a12" }
    const searchOptions = { signal }
    const searchResult = await client["projection.search"]({ q: "documents" }, searchOptions)
    const postReadInstalled = (SfOperationRegistry["projection.search"] as { readonly method: string }).method === "POST"
    if (!postReadInstalled) {
      expect(searchResult).toEqual({ kind: "transport-error", reason: "contract-unavailable" })
      expect(calls).toHaveLength(0)
    }
    await client["projection.work"]({
      selectionRef: "selection-1", start: "2026-01-01", end: "2026-12-31",
    }, options)
    await client["views.save"]({ surface: "dashboard", action: "save", input: {
      view, expectedVersion: 3,
    } }, options)
    expect(calls).toEqual([
      ...(postReadInstalled ? [{ operationId: "projection.search", input: { q: "documents" }, options: searchOptions }] : []),
      { operationId: "projection.work", input: {
        selectionRef: "selection-1", start: "2026-01-01", end: "2026-12-31",
      }, options },
      { operationId: "views.save", input: { surface: "dashboard", action: "save", input: {
        view, expectedVersion: 3,
      } }, options },
    ])
  })

  test("V2 requests are unavailable before transport without touching the V1 path", async () => {
    const { client, calls } = recordingClient()
    const unavailable = { kind: "transport-error", reason: "contract-unavailable" } satisfies
      Awaited<ReturnType<typeof client["views.remove"]>>
    expect(await client["views.list"]({ surface: "dashboard", action: "list", input: {
      schemaVersion: 2,
    } } as never, { signal })).toEqual(unavailable)
    expect(await client["views.open"]({ surface: "dashboard", action: "open", input: {
      id: view.id, schemaVersion: 2,
    } } as never, { signal })).toEqual(unavailable)
    expect(await client["views.save"]({ surface: "dashboard", action: "save", input: {
      view: { ...view, schemaVersion: 2 }, expectedVersion: 3,
    } } as never, { signal })).toEqual(unavailable)
    expect(await client["views.remove"]({ surface: "dashboard", action: "remove", input: {
      id: view.id, expectedVersion: 3, schemaVersion: 2,
    } } as never, { signal })).toEqual(unavailable)
    expect(calls).toHaveLength(0)
  })

  test("work-item uses a closed redacted source shape without losing null/zero/version", () => {
    const item = {
      kind: "signal" as const, actionRef: "sf-signal:one",
      title: null, ownerRef: "owner-a", state: "stale",
      sourceVersion: 0, observedVersion: 0,
      destination: { kind: "signal" as const, ref: "sf-signal:one" },
    }
    const output = { status: "ok", value: {
      item, details: [{ label: "Current validity", value: "stale" }],
      links: [{ label: "Open decision", url: "/sf/dashboard?sf=case" }],
    } } satisfies Schema.Schema.Type<typeof SfProjectionWorkItem.Output>
    const input = { selectionRef: "selection-1", actionRef: "sf-signal:one", start: "2026-01-01", end: "2026-12-31" }
    expect(Schema.decodeUnknownSync(SfProjectionWorkItem.Input)(input)).toEqual(input)
    expect(Schema.decodeUnknownSync(SfProjectionWorkItem.Output)(output)).toEqual(output)
    for (const invalid of [
      { ...output, value: { ...output.value, item: { ...item, sourceRefs: ["private"] } } },
      { ...output, value: { ...output.value, item: { ...item, destination: { ...item.destination, grant: "false" } } } },
      { ...output, value: { ...output.value, details: [{ label: "X", value: "Y", privateSnapshot: true }] } },
      { ...output, value: { ...output.value, links: [{ label: "X", url: "/sf", authorization: "secret" }] } },
      { ...output, value: { ...output.value, authority: {} } },
    ]) {
      expect(() => Schema.decodeUnknownSync(SfProjectionWorkItem.Output)(invalid)).toThrow()
    }
    expect(() => Schema.decodeUnknownSync(SfProjectionWorkItem.Input)({
      ...input, principalRef: "admin",
    })).toThrow()
  })

  test("private search input is closed and bounded independently of the legacy V1 codec", () => {
    expect(Schema.decodeUnknownSync(SfProjectionSearch.Input)({ q: "an internal document" }))
      .toEqual({ q: "an internal document" })
    expect(() => Schema.decodeUnknownSync(SfProjectionSearch.Input)({
      q: "an internal document", grant: "admin",
    })).toThrow()
    expect(() => Schema.decodeUnknownSync(SfProjectionSearch.Input)({ q: "a".repeat(3801) })).toThrow()
    expect(Schema.decodeUnknownSync(SfViewsSave.Input)({
      action: "save", input: { view, expectedVersion: null },
    })).toEqual({ surface: "dashboard", action: "save", input: { view, expectedVersion: null } })
  })

  test("NAV-01 integration requires an exact bounded POST-read registry route without query", () => {
    const route = SfOperationRegistry["projection.search"]
    expect(route.method).toBe("POST")
    expect(route.pathTemplate).toBe("{mount}/api/ui/projections/search")
    expect(route.effect).toBe("read")
    expect(route.responseMode).toBe("json")
    expect("maxRequestBytes" in route ? route.maxRequestBytes : undefined).toBe(4096)
    expect("fixedQuery" in route).toBe(false)
  })

  test("new projections reject unsafe methods, query strings, extra selectors and invalid periods before host access", async () => {
    const handlers = createSfWorkProjectionHandlers({
      mount: "/sf", origin: "https://sf.example",
      runtime: () => { throw new Error("host must not be accessed") },
    } as never)
    const byId = Object.fromEntries(handlers.map((handler) => [handler.operationId, handler]))
    expect(Object.keys(byId)).toEqual([
      "projection.home", "projection.search", "projection.work", "projection.work-item", "projection.work-selection",
    ])
    const workItem = "https://sf.example/sf/api/ui/projections/work-item"
    const search = "https://sf.example/sf/api/ui/projections/search"
    for (const [operationId, url, expected] of [
      ["projection.home", "https://sf.example/sf/api/ui/projections/home?owner=other", 400],
      ["projection.search", search + "?q=private", 400],
      ["projection.search", search, 400], // GET fallback is never allowed
      ["projection.work", "https://sf.example/sf/api/ui/projections/work?selectionRef=a&start=2026-02-30&end=2026-12-31", 400],
      ["projection.work-item", workItem + "?selectionRef=a&actionRef=b&start=2026-02-30&end=2026-12-31", 400],
      ["projection.work-item", workItem + "?selectionRef=a&actionRef=b&actionRef=c&start=2026-01-01&end=2026-12-31", 400],
      ["projection.work-item", workItem + "?selectionRef=a&actionRef=b&start=2026-01-01&end=2026-12-31&principalRef=other", 400],
      ["projection.work-selection", "https://other.example/sf/api/ui/projections/work-selection?start=2026-01-01&end=2026-12-31", 403],
    ] as const) {
      const response = await byId[operationId]!.handle(new Request(url))
      expect(response.status).toBe(expected)
      expect(response.headers.get("cache-control")).toBe("no-store")
    }
  })

  test("private POST search rejects q in URI, wrong content-type, extras, oversized chunks and malformed JSON before host access", async () => {
    const handlers = createSfWorkProjectionHandlers({
      mount: "/sf", origin: "https://sf.example",
      runtime: () => { throw new Error("host must not be accessed") },
    } as never)
    const search = handlers.find((entry) => entry.operationId === "projection.search")!
    const url = "https://sf.example/sf/api/ui/projections/search"
    const headers = { "Content-Type": "application/json", "Idempotency-Key": "private-search-01" }
    const requests = [
      new Request(url + "?q=leak", { method: "POST", headers, body: JSON.stringify({ q: "private" }) }),
      new Request(url, { method: "POST", headers: { ...headers, "Content-Type": "text/plain" }, body: JSON.stringify({ q: "private" }) }),
      new Request(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ q: "private" }) }),
      new Request(url, { method: "POST", headers, body: JSON.stringify({ q: "private", owner: "admin" }) }),
      new Request(url, { method: "POST", headers, body: '{"q":"first","q":"second"}' }),
      new Request(url, { method: "POST", headers, body: JSON.stringify({ q: " " }) }),
      new Request(url, { method: "POST", headers, body: "{" }),
      new Request(url, { method: "POST", headers, body: JSON.stringify({ q: "a".repeat(5000) }) }),
    ]
    for (const request of requests) {
      const output = await search.handle(request)
      expect(output.status).toBe(400)
      expect(output.headers.get("cache-control")).toBe("no-store")
    }
  })

  test("work-item is fail-closed without I00's real installed read+verify host port", async () => {
    const handlers = createSfWorkProjectionHandlers({
      mount: "/sf", origin: "https://sf.example", runtime: () => ({}) as never,
    } as never)
    const item = handlers.find((entry) => entry.operationId === "projection.work-item")!
    const result = await item.handle(new Request(
      "https://sf.example/sf/api/ui/projections/work-item?selectionRef=selection-1&actionRef=sf-signal%3Aone&start=2026-01-01&end=2026-12-31",
    ))
    expect(result.status).toBe(503)
    expect(await result.json()).toEqual({ status: "unavailable" })
    // This negative is structural. It is not a runtime authorization/verify proof.
  })
})
