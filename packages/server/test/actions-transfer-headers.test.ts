import { describe, expect, test } from "bun:test"
import { Actions } from "@orchestra/core/actions"
import { Location } from "@orchestra/core/location"
import { AbsolutePath } from "@orchestra/core/schema"
import { ActionsApiError } from "@orchestra/protocol/groups/actions-common"
import { ActionsTransferGroup } from "@orchestra/protocol/groups/actions-transfer"
import { SchemaErrorMiddleware } from "@orchestra/protocol/middleware/schema-error"
import { BindingID, BindingRef, TransferInput } from "@orchestra/schema/actions"
import { Effect, Layer, Schema, Stream } from "effect"
import { HttpRouter, HttpServer } from "effect/unstable/http"
import { HttpApi, HttpApiBuilder } from "effect/unstable/httpapi"
import { location } from "../../core/test/fixture/location"
import { ActionsTransferHandler } from "../src/handlers/actions-transfer"
import { schemaErrorLayer } from "../src/middleware/schema-error"

const api = HttpApi.make("server").add(ActionsTransferGroup).middleware(SchemaErrorMiddleware)
const binding = BindingRef.make({ id: BindingID.make("ab_transfer_headers"), revision: 7 })
const target = TransferInput.make({
  kind: "artifact", id: "artifact /42", runID: "run /24", attempt: 3, path: 'reports/résumé "draft".html',
})
const query = new URLSearchParams({
  revision: "7", kind: target.kind, id: target.id, runID: target.runID!, attempt: "3", path: target.path!,
})

// Only the Actions I/O boundary is a stand-in. These tests exercise the real Protocol group, handler,
// schema-error middleware and HTTP response conversion, not provider permissions, auth or lifecycle.
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
    const routes = HttpApiBuilder.layer(api).pipe(
      Layer.provide(ActionsTransferHandler),
      Layer.provide(Layer.mock(Actions.Service, actions)),
      // The group also declares the info route, whose response needs a Location.
      Layer.provide(Layer.succeed(Location.Service, location(Location.Ref.make({
        directory: AbsolutePath.make("/transfer-headers-fixture"),
      })))),
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
      request: () => Effect.promise(() => web.handler(new Request(
        `http://orchestra.test/api/actions/transfer/${binding.id}?${query}`,
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
})
