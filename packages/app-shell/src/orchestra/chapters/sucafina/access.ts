export * as NativeAccess from "./access"

import { createMemo, createSignal, getOwner, onCleanup } from "solid-js"
import type { Accessor } from "solid-js"
import { createStore } from "solid-js/store"
import { Sucafina } from "@orchestra/schema/sucafina"
import { Option, Schema } from "effect"

export type VerifiedAccess = {
  readonly origin: string
  readonly principal: Readonly<{ id: string; name: string }>
  readonly sessionScope: string
  readonly surfaces: ReadonlyArray<Sucafina.Surface>
}
export type AccessState = {
  phase: "checking" | "unconfigured" | "signed-out" | "ready" | "error"
  verified: VerifiedAccess | undefined
  checking: boolean
  error: number | undefined
}
export type AccessOptions = { origin: string; fetch?: typeof fetch }
export type AccessController = {
  state: Accessor<AccessState>
  refresh: () => Promise<void>
  signOut: () => Promise<void>
  invalidate: () => void
  dispose: () => void
}

export function createNativeAccess(options: AccessOptions): AccessController {
  const url = options.origin
  if (!/^https?:\/\/[^/?#]+\/?$/i.test(url) || url.trim() !== url) throw new Error("Invalid origin")
  const parsed = new URL(url)
  if (!["http:", "https:"].includes(parsed.protocol) || parsed.username || parsed.password || parsed.pathname !== "/" || parsed.search || parsed.hash)
    throw new Error("Invalid origin")
  const origin = parsed.origin
  const dispatch = options.fetch ?? fetch
  const [status, setStatus] = createStore<Omit<AccessState, "verified">>({
    phase: "checking", checking: false, error: undefined,
  })
  const [verified, setVerified] = createSignal<VerifiedAccess>()
  const state = createMemo<AccessState>(() => Object.freeze({ ...status, verified: verified() }))
  let generation = 0
  let active: AbortController | undefined
  let disposed = false
  let signingOut = false

  function invalidate() {
    if (disposed) return
    generation++
    active?.abort()
    active = undefined
    signingOut = false
    setVerified(undefined)
    setStatus({ phase: "signed-out", checking: false, error: undefined })
  }

  function dispose() {
    if (disposed) return
    invalidate()
    disposed = true
  }

  if (getOwner()) onCleanup(dispose)

  async function refresh() {
    if (disposed || signingOut) return
    generation++
    const current = generation
    active?.abort()
    const controller = new AbortController()
    active = controller
    setStatus({ phase: verified() ? "ready" : "checking", checking: true, error: undefined })
    try {
      const response = await dispatch(`${origin}/api/sucafina/status`, {
        method: "GET", credentials: "same-origin", redirect: "error", signal: controller.signal,
      })
      if (disposed || current !== generation) return
      if (response.status !== 200) {
        setVerified(undefined)
        setStatus({ phase: "error", checking: false, error: response.status >= 300 && response.status < 400 ? 502 : response.status })
        return
      }
      const contentType = response.headers.get("content-type")?.split(";")[0]?.trim().toLowerCase()
      const body = Schema.decodeUnknownOption(Schema.UnknownFromJsonString)(await response.text())
      if (disposed || current !== generation) return
      const decoded = Option.isSome(body) && contentType === "application/json"
        ? Schema.decodeUnknownOption(Sucafina.Status)(body.value)
        : Option.none()
      if (Option.isNone(decoded)) {
        setVerified(undefined)
        setStatus({ phase: "error", checking: false, error: 502 })
        return
      }
      const result = decoded.value
      if (!result.configured || !result.authenticated || result.authentication !== "local-operator" || result.hostAuthenticated !== true) {
        setVerified(undefined)
        setStatus({ phase: result.configured ? "signed-out" : "unconfigured", checking: false, error: undefined })
        return
      }
      if (!result.principal?.id.trim() || !result.principal.name.trim() || !result.sessionScope || result.surfaces.length === 0) {
        setVerified(undefined)
        setStatus({ phase: "error", checking: false, error: 502 })
        return
      }
      const prior = verified()
      if (!prior || prior.principal.id !== result.principal.id || prior.principal.name !== result.principal.name ||
        prior.sessionScope !== result.sessionScope || prior.surfaces.length !== result.surfaces.length ||
        prior.surfaces.some((surface, index) => surface !== result.surfaces[index])) {
        setVerified(Object.freeze({
          origin,
          principal: Object.freeze({ id: result.principal.id, name: result.principal.name }),
          sessionScope: result.sessionScope,
          surfaces: Object.freeze([...result.surfaces]),
        }))
      }
      setStatus({ phase: "ready", checking: false, error: undefined })
    } catch {
      if (disposed || current !== generation) return
      setVerified(undefined)
      setStatus({ phase: "error", checking: false, error: 503 })
    } finally {
      if (current === generation) active = undefined
    }
  }

  async function signOut() {
    if (disposed) return
    invalidate()
    signingOut = true
    const current = generation
    const controller = new AbortController()
    active = controller
    try {
      const response = await dispatch(`${origin}/api/sucafina/auth/logout`, {
        method: "POST", credentials: "same-origin", redirect: "error", headers: { Origin: origin }, signal: controller.signal,
      })
      if (disposed || current !== generation) return
      if (response.status !== 204)
        setStatus({ phase: "signed-out", checking: false, error: response.status >= 300 && response.status < 400 ? 502 : response.status })
    } catch {
      if (disposed || current !== generation) return
      setStatus({ phase: "signed-out", checking: false, error: 503 })
    } finally {
      if (current === generation) {
        active = undefined
        signingOut = false
      }
    }
  }

  return { state, refresh, signOut, invalidate, dispose }
}
