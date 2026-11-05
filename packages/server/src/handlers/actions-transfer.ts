import { Actions } from "@orchestra/core/actions"
import { Effect } from "effect"
import { HttpServerResponse } from "effect/unstable/http"
import { HttpApiBuilder } from "effect/unstable/httpapi"
import { Api } from "../api"
import { apiError, bindingRef, result } from "./actions-common"

export const ActionsTransferHandler = HttpApiBuilder.group(Api, "server.actionsTransfer", (handlers) => Effect.succeed(
  handlers
    .handle("actions.transfer.info", (ctx) => result(Effect.gen(function* () {
      const actions = yield* Actions.Service
      return yield* actions.transferInfo(bindingRef(ctx), {
        kind: ctx.query.kind, id: ctx.query.id, runID: ctx.query.runID, attempt: ctx.query.attempt, path: ctx.query.path,
      })
    })))
    .handleRaw("actions.transfer.read", (ctx) => Effect.gen(function* () {
      const actions = yield* Actions.Service
      const binding = bindingRef(ctx)
      const target = { kind: ctx.query.kind, id: ctx.query.id, runID: ctx.query.runID, attempt: ctx.query.attempt, path: ctx.query.path }
      const info = yield* actions.transferInfo(binding, target).pipe(Effect.mapError(apiError))
      return HttpServerResponse.stream(actions.transfer(binding, target), {
        contentType: info.contentType,
        headers: { "content-disposition": `attachment; filename*=UTF-8''${encodeURIComponent(info.filename)}`,
          "x-content-type-options": "nosniff",
          "content-security-policy": "sandbox",
          ...(info.size === undefined ? {} : { "content-length": String(info.size) }) },
      })
    })),
))
