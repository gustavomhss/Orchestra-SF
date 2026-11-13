import { randomUUID } from "node:crypto"
import { open, rename } from "node:fs/promises"
import { userInfo } from "node:os"
import path from "node:path"
import { createNativeGateway } from "./native.ts"
import { loadLocalConfiguration, requireLocalIsolation } from "../Sucafinav1/runtime/local-configuration.ts"
import { scanLocalFile } from "../Sucafinav1/runtime/local-scanner.ts"
import { openLocalStore } from "../Sucafinav1/runtime/local-store.ts"
import { createOperatorIdentity } from "../Sucafinav1/runtime/operator-identity.ts"

const mount = "/api/sucafina"
const landing = "/orchestra/sucafina/dashboard"

export type NativeInstallationOptions = {
  configuration?: string
  origin: string
  environment: Readonly<Record<string, string | undefined>>
}

export type NativeInstallation = {
  handle: (request: Request) => Promise<Response | undefined>
  enroll: () => Promise<{ artifact: string }>
  dispose: () => Promise<void>
}

/** Private native installation. No listener, host bridge, jobs, or Microsoft fallback. */
export async function createNativeInstallation(options: NativeInstallationOptions): Promise<NativeInstallation> {
  if (!options.configuration) return boundary({ origin: options.origin })
  const loaded = await loadLocalConfiguration(options.configuration)
  if (options.origin !== loaded.config.origin) throw new Error("Installation origin mismatch")
  await requireLocalIsolation(loaded.directory, options.environment)
  const profile = loaded.config.localOperator
  // Microsoft and any profile other than an explicit local operator stay unconfigured. Do not open a store or render a host fallback.
  if (loaded.config.authentication !== "local-operator" || !profile) return boundary({ origin: loaded.config.origin })
  const store = await openLocalStore(path.join(loaded.directory, "business-local"))
  const identity = createOperatorIdentity({
    origin: loaded.config.origin,
    mount,
    operator: { ...profile, name: userInfo().username },
    key: loaded.keys.session,
    secrets: store.secrets,
  })
  const gateway = createNativeGateway(mount, {
    persistence: store,
    authenticate: identity.authenticate,
    environment: async (request) => ({
      at: new Date().toISOString(),
      id: randomUUID,
      directory: await identity.directory(request),
      bankKey: loaded.keys.bank,
    }),
    maxJsonBytes: 2 * 1024 * 1024,
    assets: {
      persistence: store,
      services: {
        signingKey: loaded.keys.assets,
        scan: (bytes) => scanLocalFile(bytes, loaded.config.scanner),
      },
    },
  })
  return boundary({
    origin: loaded.config.origin,
    directory: loaded.directory,
    identity,
    gateway,
    close: () => store.dispose(),
  })
}

type Boundary = {
  origin: string
  directory?: string
  identity?: ReturnType<typeof createOperatorIdentity>
  gateway?: ReturnType<typeof createNativeGateway>
  close?: () => Promise<void>
}

function boundary(input: Boundary): NativeInstallation {
  let disposed = false
  return {
    handle: (request) => handle(input, () => disposed, request).catch(() => unavailable()),
    enroll: () => enroll(input, () => disposed),
    async dispose() {
      if (disposed) return
      disposed = true
      await input.close?.()
    },
  }
}

async function handle(input: Boundary, disposed: () => boolean, request: Request) {
  const url = new URL(request.url)
  if (url.pathname !== mount && !url.pathname.startsWith(`${mount}/`)) return undefined
  if (disposed()) return unavailable()
  if (url.origin !== input.origin) return denied()
  if (url.pathname === `${mount}/status`) return status(input, request)
  // Exact Origin is required before authentication or a business command. Status has already answered its method.
  if (request.method === "POST" && (request.headers.get("origin") !== input.origin || request.headers.get("sec-fetch-site") === "cross-site")) return denied()
  if (!input.identity || !input.gateway) return unavailable()
  if (url.pathname.startsWith(`${mount}/auth/`)) return redirectLanding(await input.identity.handle(request))
  return input.gateway(request)
}

async function status(input: Boundary, request: Request) {
  if (request.method !== "GET") return methodNotAllowed("GET")
  if (!input.identity) return json(unconfiguredStatus)
  const person = await input.identity.person(request)
  const sessionScope = person ? await input.identity.scope(request) : undefined
  if (!person || !sessionScope) return json(signedOutStatus)
  return json({
    configured: true,
    authentication: "local-operator",
    authenticated: true,
    enrollmentRequired: false,
    surfaces: ["dashboard", "planner", "procurement"],
    principal: { id: person.id, name: person.name },
    sessionScope,
  })
}

async function enroll(input: Boundary, disposed: () => boolean) {
  if (disposed() || !input.identity || !input.directory) throw new Error("Native enrollment is unavailable")
  const code = await input.identity.enroll()
  const destination = new URL(`${mount}/auth/local`, input.origin)
  destination.searchParams.set("code", code)
  const temporary = path.join(input.directory, `open-native-${randomUUID()}.html`)
  const file = await open(temporary, "wx", 0o600)
  await file.writeFile(handoff(destination.href)).finally(() => file.close())
  const artifact = path.join(input.directory, "open-native.html")
  await rename(temporary, artifact)
  return { artifact }
}

function handoff(href: string) {
  return `<!doctype html><meta charset="utf-8"><meta name="referrer" content="no-referrer"><title>Abrindo homologação local</title><p>Abrindo homologação local…</p><script>location.replace(${JSON.stringify(href)})</script>`
}

function redirectLanding(response: Response | undefined) {
  if (!response || response.status !== 303) return response
  const headers = new Headers(response.headers)
  const cookies = response.headers.getSetCookie()
  if (headers.getSetCookie().length === 0) {
    for (const cookie of cookies) headers.append("set-cookie", cookie)
  }
  headers.set("location", landing)
  // Identity's successful redemption body is empty. Location is the only field rewritten.
  return new Response(null, { status: 303, headers })
}

function json(body: unknown) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Cache-Control": "no-store", "Content-Type": "application/json" },
  })
}

function unavailable() {
  return new Response(null, { status: 503, headers: { "Cache-Control": "no-store" } })
}

function denied() {
  return new Response("Access denied", {
    status: 403,
    headers: {
      "Cache-Control": "no-store",
      "Referrer-Policy": "no-referrer",
      "X-Content-Type-Options": "nosniff",
    },
  })
}

function methodNotAllowed(allow: string) {
  return new Response(null, { status: 405, headers: { Allow: allow, "Cache-Control": "no-store" } })
}

const unconfiguredStatus = {
  configured: false,
  authentication: "unconfigured",
  authenticated: false,
  enrollmentRequired: false,
  surfaces: [],
}

const signedOutStatus = {
  configured: true,
  authentication: "local-operator",
  authenticated: false,
  enrollmentRequired: true,
  surfaces: [],
}
