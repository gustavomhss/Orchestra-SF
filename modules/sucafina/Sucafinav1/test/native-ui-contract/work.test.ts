import { describe, expect, test } from "bun:test"
import { Schema } from "effect"
import {
  SfWork, SfProjectionWork, SfViewsList, SfViewsOpen, SfViewsSave, SfViewsRemove,
} from "../../../../../packages/schema/src/sucafina/work"
import { createSfWorkClient } from "../../../../../packages/client/src/sucafina/work"
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
      expect(SfWork.operations[id as keyof typeof SfWork.operations].operationId).toBe(id)
    }
    expect("execute" in createSfWorkClient({ execute: async () => ({
      kind: "transport-error", reason: "contract-unavailable",
    }) } as never)).toBe(false)
  })

  test("preserves the V1 wire, per-view CAS, null creation and redacted unavailable entries", () => {
    const saveCreate = { action: "save", input: { view, expectedVersion: null } }
    const saveChange = { action: "save", input: { view, expectedVersion: 3 } }
    expect(Schema.decodeUnknownSync(SfViewsSave.Input)(saveCreate)).toEqual(saveCreate)
    expect(Schema.decodeUnknownSync(SfViewsSave.Input)(saveChange)).toEqual(saveChange)
    expect(Schema.decodeUnknownSync(SfViewsSave.Output)({ status: "ok", value: versioned }))
      .toEqual({ status: "ok", value: versioned })
    expect(Schema.decodeUnknownSync(SfViewsList.Output)({
      status: "ok", value: [{ id: view.id, version: 3, availability: "unavailable" }],
    })).toEqual({
      status: "ok", value: [{ id: view.id, version: 3, availability: "unavailable" }],
    })
    expect(Schema.decodeUnknownSync(SfViewsOpen.Input)({ action: "open", input: { id: view.id } }))
      .toEqual({ action: "open", input: { id: view.id } })
    expect(Schema.decodeUnknownSync(SfViewsRemove.Input)({
      action: "remove", input: { id: view.id, expectedVersion: 3 },
    })).toEqual({ action: "remove", input: { id: view.id, expectedVersion: 3 } })
  })

  test("rejects unknown actions/fields, invalid CAS and V2 envelopes in the legacy schema", () => {
    for (const invalid of [
      { action: "approve", input: { view, expectedVersion: 3 } },
      { action: "save", input: { view, expectedVersion: 0 } },
      { action: "save", input: { view, expectedVersion: -1 } },
      { action: "save", input: { view, expectedVersion: 3, accessToken: "secret" } },
      { action: "save", input: { view: { ...view, externalUrl: "https://example.org" }, expectedVersion: 3 } },
      { action: "save", input: { ...view, schemaVersion: 2, expectedVersion: 3 } },
      { action: "save", input: { view: { ...view, schemaVersion: 2 }, expectedVersion: 3 } },
      { action: "save", input: { view: { ...view, filters: { selections: { bogus: "x" } } }, expectedVersion: 3 } },
      { action: "save", input: { view: { ...view, filters: { selections: { year: "2030" } } }, expectedVersion: 3 } },
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
    expect(Schema.decodeUnknownSync(SfProjectionWork.Output)(work)).toEqual(work)
    expect(() => Schema.decodeUnknownSync(SfProjectionWork.Output)({
      status: "ok", value: { items: [{ ...work.value.items[0], secretRoleMap: {} }] },
    })).toThrow()
  })

  test("routes typed calls through the injected transport without changing IDs, values or options", async () => {
    const { client, calls } = recordingClient()
    const options = { signal, idempotencyKey: "intent-once-a12" }
    await client["projection.search"]({ q: "documents" }, options)
    await client["projection.work"]({
      selectionRef: "selection-1", start: "2026-01-01", end: "2026-12-31",
    }, options)
    await client["views.save"]({ action: "save", input: {
      view, expectedVersion: 3,
    } }, options)
    expect(calls).toEqual([
      { operationId: "projection.search", input: { q: "documents" }, options },
      { operationId: "projection.work", input: {
        selectionRef: "selection-1", start: "2026-01-01", end: "2026-12-31",
      }, options },
      { operationId: "views.save", input: { action: "save", input: {
        view, expectedVersion: 3,
      } }, options },
    ])
  })

  test("V2 requests are unavailable before transport without touching the V1 path", async () => {
    const { client, calls } = recordingClient()
    const unavailable = { kind: "transport-error", reason: "contract-unavailable" }
    expect(await client["views.list"]({ action: "list", input: {
      schemaVersion: 2,
    } } as never, { signal })).toEqual(unavailable)
    expect(await client["views.open"]({ action: "open", input: {
      id: view.id, schemaVersion: 2,
    } } as never, { signal })).toEqual(unavailable)
    expect(await client["views.save"]({ action: "save", input: {
      view: { ...view, schemaVersion: 2 }, expectedVersion: 3,
    } } as never, { signal })).toEqual(unavailable)
    expect(await client["views.remove"]({ action: "remove", input: {
      id: view.id, expectedVersion: 3, schemaVersion: 2,
    } } as never, { signal })).toEqual(unavailable)
    expect(calls).toHaveLength(0)
  })

  test("new GETs reject unexpected, repeated, malformed and cross-origin queries before accessing a host", async () => {
    const handlers = createSfWorkProjectionHandlers({
      mount: "/sf",
      origin: "https://sf.example",
      runtime: () => { throw new Error("host must not be accessed") },
    } as never)
    const byId = Object.fromEntries(handlers.map((handler) => [handler.operationId, handler]))
    expect(Object.keys(byId)).toEqual([
      "projection.home", "projection.search", "projection.work", "projection.work-selection",
    ])
    // work-item requires the original private destinations.read + verify port:
    // no weaker substitute is admitted by A12 before I00 releases that seam.
    expect(byId["projection.work-item"]).toBeUndefined()
    for (const [operationId, url, expected] of [
      ["projection.home", "https://sf.example/sf/api/ui/projections/home?owner=other", 400],
      ["projection.search", "https://sf.example/sf/api/ui/projections/search?q=a&q=b", 400],
      ["projection.search", "https://sf.example/sf/api/ui/projections/search?q=", 400],
      ["projection.work", "https://sf.example/sf/api/ui/projections/work?selectionRef=a&start=2026-02-30&end=2026-12-31", 400],
      ["projection.work-selection", "https://other.example/sf/api/ui/projections/work-selection?start=2026-01-01&end=2026-12-31", 403],
    ] as const) {
      const response = await byId[operationId]!.handle(new Request(url))
      expect(response.status).toBe(expected)
      expect(response.headers.get("cache-control")).toBe("no-store")
    }
  })
})
