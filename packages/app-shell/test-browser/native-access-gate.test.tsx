// External acceptance draft: copy to packages/app-shell/test-browser after the gate, catalog and shared locale fixture are promoted.
// Run only in the hosted browser-conditioned lane with the repository's Solid DOM loader.
import { afterEach, expect, test } from "bun:test"
import type { Sucafina } from "@orchestra/schema/sucafina"
import { createComponent, createRoot, onCleanup } from "solid-js"
import { render } from "solid-js/web"
import type { VerifiedAccess } from "../src/orchestra/chapters/sucafina/access"
import type { NativeSession } from "../src/orchestra/chapters/sucafina/native-access-gate"
import { solidDom } from "./solid-dom"

const { NativeAccessGate, useNativeSession }: typeof import("../src/orchestra/chapters/sucafina/native-access-gate") = await import(
  solidDom("../src/orchestra/chapters/sucafina/native-access-gate", import.meta.dir)
)
const { LanguageProvider, loadLocaleDict, useLanguage }: typeof import("../src/context/language") = await import(
  solidDom("../src/context/language", import.meta.dir)
)
const { PlatformProvider }: typeof import("../src/context/platform") = await import(solidDom("../src/context/platform", import.meta.dir))
const { createLocalePlatform }: typeof import("./native-locale-fixture") = await import(solidDom("./native-locale-fixture", import.meta.dir))
const { SF_NATIVE_ACCESS_COPY, SF_NATIVE_ACCESS_COPY_BR }:
  typeof import("../src/i18n/orchestra-chapters/sucafina-native-access") = await import(
    solidDom("../src/i18n/orchestra-chapters/sucafina-native-access", import.meta.dir)
  )

const origin = "http://localhost:4110"
const status = {
  configured: true,
  authenticated: true,
  authentication: "local-operator",
  enrollmentRequired: false,
  surfaces: ["dashboard", "planner"],
  principal: { id: "operator-1", name: "Operator One" },
  sessionScope: "a".repeat(64),
  hostAuthenticated: true,
} satisfies Sucafina.Status
const cleanups: (() => void)[] = []
afterEach(() => cleanups.splice(0).forEach((close) => close()))

async function until(assertion: () => boolean) {
  for (let attempt = 0; attempt < 100; attempt++) {
    if (assertion()) return
    await Promise.resolve()
  }
  throw new Error("Expected mounted gate transition did not settle")
}

function mount() {
  const calls: { url: string; init: RequestInit; response: ReturnType<typeof Promise.withResolvers<Response>> }[] = []
  // This seam is the HTTP boundary. It intentionally ignores abort so late responses can be tested.
  const controlled = Object.assign((input: string | URL | Request, init: RequestInit = {}) => {
    const response = Promise.withResolvers<Response>()
    calls.push({ url: String(input), init, response })
    return response.promise
  }, { preconnect: fetch.preconnect })
  const state: {
    mounted: number
    disposed: number
    access: VerifiedAccess[]
    sessions: (NativeSession | undefined)[]
    language?: ReturnType<typeof useLanguage>
  } = { mounted: 0, disposed: 0, access: [], sessions: [] }
  const host = document.createElement("div")
  document.body.append(host)
  const dispose = render(() => createComponent(PlatformProvider, {
    value: createLocalePlatform(),
    get children() { return createComponent(LanguageProvider, {
      locale: "en",
      get children() {
        state.language = useLanguage()
        return createComponent(NativeAccessGate, {
          origin,
          fetch: controlled,
          children: (access) => createComponent(() => {
            state.mounted++
            state.access.push(access)
            state.sessions.push(useNativeSession())
            onCleanup(() => { state.disposed++ })
            const input = document.createElement("input")
            input.dataset.testid = "native-child"
            return input
          }, {}),
        })
      },
    }) },
  }), host)
  let closed = false
  const close = () => {
    if (closed) return
    closed = true
    dispose()
    host.remove()
  }
  cleanups.push(close)
  return { host, calls, state, close }
}

function respond(view: ReturnType<typeof mount>, index: number, body: unknown = status) {
  view.calls[index]!.response.resolve(Response.json(body))
}

async function grant(view: ReturnType<typeof mount>) {
  await until(() => view.calls.length === 1)
  respond(view, 0)
  await until(() => view.state.mounted === 1)
  return view.state.sessions[0]!
}

function child(view: ReturnType<typeof mount>) {
  const input = view.host.querySelector<HTMLInputElement>('[data-testid="native-child"]')
  if (!input) throw new Error("Expected verified child")
  return input
}

function catalogValue(english: string, catalog: Record<string, string>) {
  const key = Object.entries(SF_NATIVE_ACCESS_COPY).find((entry) => entry[1] === english)?.[0]
  if (!key || !catalog[key]) throw new Error(`Missing access catalog entry for ${english}`)
  return catalog[key]
}

test("initial held status keeps children lazy and makes only the native status request", async () => {
  const view = mount()
  await until(() => view.calls.length === 1)
  expect(view.state.mounted).toBe(0)
  expect(view.host.querySelector('[data-testid="native-child"]')).toBeNull()
  expect(view.host.querySelector('[role="status"]')?.textContent).toContain("Checking access…")
  const call = view.calls[0]!
  expect(call.url).toBe(`${origin}/api/sucafina/status`)
  expect(call.init.method ?? "GET").toBe("GET")
  expect(call.init.credentials).toBe("same-origin")
  expect(call.init.redirect).toBe("error")
  expect(call.init.signal).toBeInstanceOf(AbortSignal)
  expect(new Headers(call.init.headers).get("authorization")).toBeNull()
  expect(view.calls).toHaveLength(1)
})

test("unconfigured, signed-out, Microsoft, absent bridge and malformed status never mount a child", async () => {
  for (const body of [
    { ...status, configured: false },
    { ...status, authenticated: false },
    { ...status, authentication: "microsoft" },
    { ...status, authentication: "unconfigured" },
    { ...status, hostAuthenticated: undefined },
    { ...status, sessionScope: "bad" },
  ]) {
    const view = mount()
    await until(() => view.calls.length === 1)
    await until(() => Boolean(view.host.textContent?.includes("Checking access…")))
    respond(view, 0, body)
    await until(() => !view.host.textContent?.includes("Checking access…"))
    expect(view.state.mounted).toBe(0)
    expect(view.state.sessions).toEqual([])
    expect(view.host.querySelector('[data-testid="native-child"]')).toBeNull()
    expect(view.calls).toHaveLength(1)
    view.close()
  }
})

test("verified child receives captured access and real NativeSession context", async () => {
  const outside = createRoot((dispose) => { const value = useNativeSession(); dispose(); return value })
  expect(outside).toBeUndefined()
  const view = mount()
  const session = await grant(view)
  expect(view.state.access[0]).toEqual({ origin, principal: status.principal, sessionScope: status.sessionScope, surfaces: status.surfaces })
  expect(session).toMatchObject({ origin, principal: status.principal, sessionScope: status.sessionScope, surfaces: status.surfaces })
  expect(typeof session.refresh).toBe("function")
  expect(typeof session.signOut).toBe("function")
  expect(typeof session.invalidate).toBe("function")
  expect(view.calls.map((call) => new URL(call.url).pathname)).toEqual(["/api/sucafina/status"])
})

test("focus refresh of the same verified scope keeps the child node and draft", async () => {
  const view = mount()
  await grant(view)
  const input = child(view)
  input.value = "unsaved draft"
  window.dispatchEvent(new Event("focus"))
  await until(() => view.calls.length === 2)
  expect(child(view)).toBe(input)
  respond(view, 1, structuredClone(status))
  // The unchanged ready subtree has no completion indicator, so drain the response's microtasks.
  for (let turn = 0; turn < 64; turn++) await Promise.resolve()
  expect(child(view)).toBe(input)
  expect(input.value).toBe("unsaved draft")
  expect(view.state.mounted).toBe(1)
  expect(view.state.disposed).toBe(0)
})

test("new scope replaces the child and disposes its old owner exactly once", async () => {
  const view = mount()
  await grant(view)
  const old = child(view)
  old.value = "old draft"
  window.dispatchEvent(new Event("focus"))
  await until(() => view.calls.length === 2)
  respond(view, 1, { ...status, sessionScope: "b".repeat(64) })
  await until(() => view.state.mounted === 2)
  expect(child(view)).not.toBe(old)
  expect(child(view).value).toBe("")
  expect(view.state.disposed).toBe(1)
  expect(view.state.sessions[1]?.sessionScope).toBe("b".repeat(64))
})

test("foreground focus expiry clears the verified child and stops automatic refresh", async () => {
  const view = mount()
  await grant(view)
  window.dispatchEvent(new Event("focus"))
  await until(() => view.calls.length === 2)
  respond(view, 1, { ...status, authenticated: false, hostAuthenticated: false })
  await until(() => view.state.disposed === 1)
  expect(view.host.querySelector('[data-testid="native-child"]')).toBeNull()
  expect(view.host.textContent).toContain("Sign in to Sucafina")
  window.dispatchEvent(new Event("focus"))
  document.dispatchEvent(new Event("visibilitychange"))
  await Promise.resolve()
  expect(view.calls).toHaveLength(2)
})

test("context sign-out unmounts synchronously before a held logout and failure never restores access", async () => {
  const view = mount()
  const session = await grant(view)
  const pending = session.signOut()
  expect(view.state.disposed).toBe(1)
  expect(view.host.querySelector('[data-testid="native-child"]')).toBeNull()
  await until(() => view.calls.length === 2)
  const request = view.calls[1]!
  expect(request.url).toBe(`${origin}/api/sucafina/auth/logout`)
  expect(request.init.method).toBe("POST")
  expect(request.init.credentials).toBe("same-origin")
  expect(request.init.redirect).toBe("error")
  expect(new Headers(request.init.headers).get("origin")).toBe(origin)
  expect(new Headers(request.init.headers).get("authorization")).toBeNull()
  request.response.resolve(new Response("PRIVATE-LOGOUT-BODY", { status: 500 }))
  await pending
  await until(() => Boolean(view.host.querySelector('[role="alert"]')))
  expect(view.state.mounted).toBe(1)
  expect(view.state.disposed).toBe(1)
  expect(view.host.textContent).not.toContain("PRIVATE-LOGOUT-BODY")
  window.dispatchEvent(new Event("focus"))
  await Promise.resolve()
  expect(view.calls).toHaveLength(2)
})

test("cleanup aborts a pending refresh and removes focus and visibility listeners", async () => {
  const view = mount()
  await grant(view)
  window.dispatchEvent(new Event("focus"))
  await until(() => view.calls.length === 2)
  view.close()
  expect(view.calls[1]!.init.signal?.aborted).toBe(true)
  expect(view.state.disposed).toBe(1)
  respond(view, 1)
  await Promise.resolve()
  await Promise.resolve()
  window.dispatchEvent(new Event("focus"))
  document.dispatchEvent(new Event("visibilitychange"))
  await Promise.resolve()
  expect(view.calls).toHaveLength(2)
  expect(view.state.mounted).toBe(1)
  expect(view.state.disposed).toBe(1)
})

test("English and Brazilian Portuguese fallback copy updates reactively without exposing errors", async () => {
  await loadLocaleDict("en")
  await loadLocaleDict("br")
  const view = mount()
  await until(() => view.calls.length === 1)
  view.calls[0]!.response.resolve(new Response("PRIVATE-STATUS-BODY", { status: 503 }))
  await until(() => Boolean(view.host.querySelector('[role="alert"]')))
  expect(view.host.textContent).toContain("Access could not be verified.")
  expect(view.host.textContent).toContain("Check your connection and try again.")
  expect(view.host.textContent).toContain("Check again")
  expect(view.host.textContent).not.toContain("PRIVATE-STATUS-BODY")
  view.state.language!.setLocale("br")
  const translated = catalogValue("Access could not be verified.", SF_NATIVE_ACCESS_COPY_BR)
  expect(translated).not.toBe("Access could not be verified.")
  await until(() => Boolean(view.host.textContent?.includes(translated)))
  expect(view.host.textContent).toContain(catalogValue("Check your connection and try again.", SF_NATIVE_ACCESS_COPY_BR))
  expect(view.host.textContent).toContain(catalogValue("Check again", SF_NATIVE_ACCESS_COPY_BR))
  expect(view.host.textContent).not.toContain("PRIVATE-STATUS-BODY")
  view.state.language!.setLocale("en")
  await until(() => Boolean(view.host.textContent?.includes("Access could not be verified.")))
  const button = [...view.host.querySelectorAll("button")].find((item) => item.textContent?.includes("Check again"))
  expect(button).toBeDefined()
  button!.click()
  await until(() => view.calls.length === 2)
  const pendingRetry = [...view.host.querySelectorAll("button")].find((item) => item.textContent?.includes("Check again"))
  expect(pendingRetry).toBeDefined()
  expect(pendingRetry!.disabled).toBe(true)
  expect(view.state.mounted).toBe(0)
  respond(view, 1)
  await until(() => view.state.mounted === 1)
  const input = child(view)
  input.value = "language draft"
  view.state.language!.setLocale("br")
  await Promise.resolve()
  expect(child(view)).toBe(input)
  expect(input.value).toBe("language draft")
  expect(view.state.mounted).toBe(1)
  expect(view.state.disposed).toBe(0)
})
