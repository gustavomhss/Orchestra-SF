import { describe, expect, test } from "bun:test"
import { Actions } from "@orchestra/core/actions"
import { Location } from "@orchestra/core/location"
import { AbsolutePath } from "@orchestra/core/schema"
import { InvalidRequestError } from "@orchestra/protocol/errors"
import { ActionsApiError } from "@orchestra/protocol/groups/actions-common"
import { ActionsTransferGroup } from "@orchestra/protocol/groups/actions-transfer"
import { Authorization } from "@orchestra/protocol/middleware/authorization"
import { SchemaErrorMiddleware } from "@orchestra/protocol/middleware/schema-error"
import { BindingID, BindingRef, TransferInput } from "@orchestra/schema/actions"
import { Context, Effect, Layer, Schema, Stream } from "effect"
import { HttpRouter, HttpServer } from "effect/unstable/http"
import { HttpApi, HttpApiBuilder } from "effect/unstable/httpapi"
import { location } from "../../core/test/fixture/location"
import { ActionsTransferHandler } from "../src/handlers/actions-transfer"
import { LocationMiddleware, type LocationServices } from "../src/location"
import { schemaErrorLayer } from "../src/middleware/schema-error"

const api = HttpApi.make("server")
  .add(ActionsTransferGroup.middleware(LocationMiddleware))
  .middleware(Authorization)
  .middleware(SchemaErrorMiddleware)
const binding = BindingRef.make({ id: BindingID.make("ab_transfer_headers"), revision: 7 })
const target = TransferInput.make({
  kind: "artifact", id: "artifact /42", runID: "run /24", attempt: 3, path: 'reports/résumé "draft".html',
})
const query = new URLSearchParams({
  revision: "7", kind: target.kind, id: target.id, runID: target.runID!, attempt: "3", path: target.path!,
})

// Actions I/O and harness-only auth/location middleware are stand-ins. The Protocol group, handler,
// schema-error middleware and HTTP conversion are real. Auth enforcement, Location boot and provider
// permissions/lifecycle are not covered.
function serve(metadata: ReturnType<Actions.Interface["transferInfo"]>, chunks: Uint8Array[]) {
  return Effect.gen(function* () {
    const infoCalls: Parameters<Actions.Interface["transferInfo"]>[] = []
    const transferCalls: Parameters<Actions.Interface["transfer"]>[] = []
    const actions = {
      transferInfo: (binding, target) => Effect.suspend(() => {
        infoCalls.push([binding, target])
        return metadata
      }),
      transfer: (binding, target) => {
        transferCalls.push([binding, target])
        return Stream.fromIterable(chunks)
      },
    } satisfies Pick<Actions.Interface, "transferInfo" | "transfer">
    const context = yield* Layer.build(Layer.mergeAll(
      Layer.mock(Actions.Service, actions),
      // The group also declares the info route, whose response needs a Location.
      Layer.succeed(Location.Service, location(Location.Ref.make({
        directory: AbsolutePath.make("/transfer-headers-fixture"),
      }))),
    ))
    const routes = HttpApiBuilder.layer(api).pipe(
      Layer.provide(ActionsTransferHandler),
      Layer.provide(Layer.succeedContext(context)),
      // Fixture-only: supply exactly this handler's services, not the full production Location boot graph.
      Layer.provide(Layer.succeed(LocationMiddleware, LocationMiddleware.of((effect) =>
        effect.pipe(Effect.provide(context as unknown as Context.Context<LocationServices>)),
      ))),
      Layer.provide(Layer.succeed(Authorization, Authorization.of((effect) => effect))),
      Layer.provide(schemaErrorLayer),
      Layer.provide(HttpServer.layerServices),
    )
    const web = yield* Effect.acquireRelease(
      Effect.sync(() => HttpRouter.toWebHandler(routes, { disableLogger: true })),
      (web) => Effect.promise(() => web.dispose()),
    )
    return {
      infoCalls,
      transferCalls,
      request: (input?: { rawBindingID?: string; query?: URLSearchParams }) => Effect.promise(() => web.handler(new Request(
        `http://orchestra.test/api/actions/transfer/${input?.rawBindingID ?? binding.id}?${input?.query ?? query}`,
      ))),
    }
  })
}

describe("Actions transfer response headers", () => {
  test("sandboxes an HTML attachment without changing its metadata, bytes or target", () =>
    Effect.runPromise(Effect.scoped(Effect.gen(function* () {
      const bytes = new TextEncoder().encode('<!doctype html><title>résumé</title><script>alert("fixture")</script>')
      const server = yield* serve(Effect.succeed({
        filename: 'résumé "draft" <v1>.html', contentType: "text/html", size: bytes.byteLength,
      }), [bytes.subarray(0, 17), bytes.subarray(17)])

      const response = yield* server.request()

      expect(response.status).toBe(200)
      expect(response.headers.get("x-content-type-options")).toBe("nosniff")
      expect(response.headers.get("content-security-policy")).toBe("sandbox")
      expect(response.headers.get("content-disposition")).toBe(
        "attachment; filename*=UTF-8''r%C3%A9sum%C3%A9%20%22draft%22%20%3Cv1%3E.html",
      )
      expect(response.headers.get("content-type")).toBe("text/html")
      expect(response.headers.get("content-length")).toBe(String(bytes.byteLength))
      expect(new Uint8Array(yield* Effect.promise(() => response.arrayBuffer()))).toEqual(bytes)
      expect(server.infoCalls).toEqual([[binding, target]])
      expect(server.transferCalls).toEqual([[binding, target]])
    }))))

  test("keeps unknown-size binary chunks intact without declaring a content length", () =>
    Effect.runPromise(Effect.scoped(Effect.gen(function* () {
      const server = yield* serve(Effect.succeed({
        filename: 'résumé "archive".bin', contentType: "application/octet-stream",
      }), [new Uint8Array([0, 255, 128]), new Uint8Array([13, 10]), new Uint8Array([254, 1, 0])])

      const response = yield* server.request()

      expect(response.status).toBe(200)
      expect(response.headers.get("x-content-type-options")).toBe("nosniff")
      expect(response.headers.get("content-security-policy")).toBe("sandbox")
      expect(response.headers.get("content-disposition")).toBe(
        "attachment; filename*=UTF-8''r%C3%A9sum%C3%A9%20%22archive%22.bin",
      )
      expect(response.headers.get("content-type")).toBe("application/octet-stream")
      expect(response.headers.has("content-length")).toBe(false)
      expect(new Uint8Array(yield* Effect.promise(() => response.arrayBuffer()))).toEqual(
        new Uint8Array([0, 255, 128, 13, 10, 254, 1, 0]),
      )
      expect(server.infoCalls).toEqual([[binding, target]])
      expect(server.transferCalls).toEqual([[binding, target]])
    }))))

  test("preserves a declared metadata error without starting a transfer", () =>
    Effect.runPromise(Effect.scoped(Effect.gen(function* () {
      const server = yield* serve(Effect.fail(new Actions.ActionsError({
        kind: "invalid_input", message: "Transfer metadata rejected", bindingID: binding.id,
      })), [new Uint8Array([0, 255])])

      const response = yield* server.request()

      expect(response.status).toBe(400)
      const error = Schema.decodeUnknownSync(ActionsApiError)(yield* Effect.promise(() => response.json()))
      expect(error._tag).toBe("ActionsError")
      expect(error.kind).toBe("invalid_input")
      expect(error.message).toBe("Transfer metadata rejected")
      expect(error.bindingID).toBe(binding.id)
      expect(server.infoCalls).toEqual([[binding, target]])
      expect(server.transferCalls).toEqual([])
    }))))

  test.each([
    ["ab_transfer%25literal", "ab_transfer%literal"],
    ["ab_transfer%2525literal", "ab_transfer%25literal"],
  ])("decodes binding %s exactly once", (rawBindingID, decoded) =>
    Effect.runPromise(Effect.scoped(Effect.gen(function* () {
      const bytes = new TextEncoder().encode("<title>percent</title>")
      const server = yield* serve(Effect.succeed({
        filename: "percent.html", contentType: "text/html", size: bytes.byteLength,
      }), [bytes.subarray(0, 7), bytes.subarray(7)])

      const response = yield* server.request({ rawBindingID })

      expect(response.status).toBe(200)
      expect(response.headers.get("x-content-type-options")).toBe("nosniff")
      expect(response.headers.get("content-security-policy")).toBe("sandbox")
      expect(response.headers.get("content-disposition")).toBe("attachment; filename*=UTF-8''percent.html")
      expect(response.headers.get("content-type")).toBe("text/html")
      expect(response.headers.get("content-length")).toBe(String(bytes.byteLength))
      expect(new Uint8Array(yield* Effect.promise(() => response.arrayBuffer()))).toEqual(bytes)
      const expectedBinding = { id: BindingID.make(decoded), revision: 7 }
      expect(server.infoCalls).toEqual([[expectedBinding, target]])
      expect(server.transferCalls).toEqual([[expectedBinding, target]])
    }))))

  // The pinned router rejects malformed URL escapes before route schema decoding or Actions I/O.
  test.each(["ab_%", "ab_%ZZ", "ab_%E0%A4%A"])("rejects malformed raw binding %s at the router", (rawBindingID) =>
    Effect.runPromise(Effect.scoped(Effect.gen(function* () {
      const server = yield* serve(Effect.succeed({
        filename: "unused.bin", contentType: "application/octet-stream",
      }), [new Uint8Array([0, 255])])

      const response = yield* server.request({ rawBindingID })

      expect(response.status).toBe(404)
      expect(yield* Effect.promise(() => response.text())).toBe("")
      expect(server.infoCalls).toEqual([])
      expect(server.transferCalls).toEqual([])
    }))))

  test("rejects a schema-invalid binding before Actions I/O", () =>
    Effect.runPromise(Effect.scoped(Effect.gen(function* () {
      const server = yield* serve(Effect.succeed({
        filename: "unused.bin", contentType: "application/octet-stream",
      }), [new Uint8Array([0, 255])])

      const response = yield* server.request({ rawBindingID: "not-a-binding" })

      expect(response.status).toBe(400)
      const error = Schema.decodeUnknownSync(InvalidRequestError)(yield* Effect.promise(() => response.json()))
      expect(error._tag).toBe("InvalidRequestError")
      expect(error.kind).toBe("Params")
      expect(server.infoCalls).toEqual([])
      expect(server.transferCalls).toEqual([])
    }))))

  test("rejects a schema-invalid query before Actions I/O", () =>
    Effect.runPromise(Effect.scoped(Effect.gen(function* () {
      const server = yield* serve(Effect.succeed({
        filename: "unused.bin", contentType: "application/octet-stream",
      }), [new Uint8Array([0, 255])])
      const invalidQuery = new URLSearchParams(query)
      invalidQuery.set("revision", "not-a-number")

      const response = yield* server.request({ query: invalidQuery })

      expect(response.status).toBe(400)
      const error = Schema.decodeUnknownSync(InvalidRequestError)(yield* Effect.promise(() => response.json()))
      expect(error._tag).toBe("InvalidRequestError")
      expect(error.kind).toBe("Query")
      expect(server.infoCalls).toEqual([])
      expect(server.transferCalls).toEqual([])
    }))))
})
