import { ClientError, Orchestra } from "@orchestra/client"
import { Sucafina } from "@orchestra/schema/sucafina"
import { Option, Schema } from "effect"
import { SucafinaRequestError } from "./contract"
import type { Transport } from "./contract"

export type NativeTransportOptions = {
  server: Readonly<{ url: string }>
  principal: string
  fetch?: typeof fetch
}

export function createNativeTransport(options: NativeTransportOptions): Transport {
  const url = options.server.url
  if (!/^https?:\/\/[^/?#]+\/?$/i.test(url) || url.trim() !== url) throw new Error("Invalid server origin")
  const parsed = new URL(url)
  if (!["http:", "https:"].includes(parsed.protocol) || parsed.username || parsed.password || parsed.pathname !== "/" || parsed.search || parsed.hash)
    throw new Error("Invalid server origin")
  const origin = parsed.origin
  const principal = options.principal
  if (!principal.trim()) throw new Error("Invalid principal")
  const dispatch = options.fetch ?? fetch
  const guardedFetch = Object.assign(async (input: string | URL | Request, init?: RequestInit) => {
    const target = new URL(input instanceof Request ? input.url : input, origin)
    // Check before calling the supplied fetch, even if a future SDK endpoint changes its URL.
    if (target.origin !== origin) throw new SucafinaRequestError(502, "Invalid transport destination")
    if (init?.signal?.aborted) throw init.signal.reason
    const response = await dispatch(input, { ...init, credentials: "same-origin", redirect: "error" })
    if (response.status === 200) return response
    if (response.status >= 300 && response.status < 400) throw new SucafinaRequestError(502, "Unexpected redirect")
    if (response.status !== 409 && response.status !== 422) throw new SucafinaRequestError(response.status, "Request failed")
    const text = await response.text().catch((error: unknown) => {
      if (init?.signal?.aborted) throw init.signal.reason
      if (error instanceof Error && error.name === "AbortError") throw error
      return ""
    })
    const content = Schema.decodeUnknownOption(Schema.UnknownFromJsonString)(text)
    const body = Option.isSome(content) && content.value !== null && typeof content.value === "object" && !Array.isArray(content.value)
      ? content.value as Record<string, unknown>
      : undefined
    if (response.status === 409) {
      if (body?.ok !== false || body.status !== 409) throw new SucafinaRequestError(409, "Changes conflict with a newer version")
      throw new SucafinaRequestError(409, "Changes conflict with a newer version", {
        ...(Object.hasOwn(body, "stored") ? { stored: body.stored } : {}),
        ...(typeof body?.by === "string" ? { by: body.by } : {}),
      })
    }
    throw new SucafinaRequestError(422, "Validation failed", {
      ...(Array.isArray(body?.errors) ? { errors: body.errors.filter((value): value is string => typeof value === "string") } : {}),
    })
  }, { preconnect: dispatch.preconnect })
  const client = Orchestra.make({ baseUrl: origin, fetch: guardedFetch })

  return {
    async read(selection, signal) {
      const result = await client.sucafina.state({ ...selection.query, surface: selection.surface }, { signal }).catch(rethrow)
      const page = Schema.decodeUnknownOption(Sucafina.PageState)(result)
      if (Option.isNone(page)) throw new SucafinaRequestError(502, "Invalid page response")
      if (page.value.actor.id !== principal) throw new SucafinaRequestError(401, "Identity changed")
      if (!page.value.actor.name.trim() || page.value.surface !== selection.surface ||
        (selection.query.page !== undefined && page.value.page !== selection.query.page) || !page.value.pages.includes(page.value.page))
        throw new SucafinaRequestError(502, "Invalid page response")
      return page.value
    },
    async command(surface, command, signal) {
      const result = await client.sucafina.command({ ...command, surface }, { signal }).catch(rethrow)
      if (Option.isNone(Schema.decodeUnknownOption(Sucafina.CommandResult)(result)))
        throw new SucafinaRequestError(502, "Invalid command response")
      return result
    },
  }
}

function rethrow(error: unknown): never {
  const cause = error instanceof ClientError && error.reason === "Transport" ? error.cause : error
  if (cause instanceof SucafinaRequestError) throw cause
  if (cause instanceof Error && cause.name === "AbortError") throw cause
  if (error instanceof ClientError && error.reason === "Transport") throw new SucafinaRequestError(503, "Network unavailable")
  throw new SucafinaRequestError(502, "Invalid server response")
}
