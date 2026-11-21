import { realpath } from "node:fs/promises"
import { IncomingMessage } from "node:http"
import { isIP } from "node:net"
import path from "node:path"
import { pathToFileURL } from "node:url"
import { NodeHttpServerRequest, NodeStream } from "@effect/platform-node"
import { SfFileRoutes } from "@orchestra/schema/sucafina/files/routes"
import { SfReviewRoutes } from "@orchestra/schema/sucafina/reviews/routes"
import type { Host } from "@orchestra/core/host"
import { parseSfInstallationSelector, readSfInstallations } from "@orchestra/server/sucafina-installations"
import { WebUi } from "@orchestra/server/web-ui"
import type { Options } from "@orchestra/server/routes"
import { Effect, Option, Stream } from "effect"
import { HttpRouter, HttpServerRequest, HttpServerResponse } from "effect/unstable/http"

type TrustedIngress = {
  origin: string
  authorize: (proof: string | undefined) => boolean
}

const ingressProofHeader = "x-sf-ingress-proof"

type Installation = {
  mount: `/${string}`
  handler: (request: Request) => Promise<Response | undefined>
  dispose: () => void | Promise<void>
  host?: readonly Host.Contribution[]
  discovery?: Options["sucafinaInstallations"]
}

/** The operator selects trusted code at startup. HTTP requests cannot select the factory or its origin. */
export async function loadSfInstallation(
  file: string,
  hostname: string,
  port: number | undefined,
  resolveWebRoot?: () => Promise<string | undefined>,
) {
  if (!path.isAbsolute(file)) throw new Error("--installation requires an absolute factory path")
  if (!port || !Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error("--installation requires an explicit port from 1 to 65535")
  }
  const host = isIP(hostname) === 6 ? `[${hostname}]` : hostname
  if (host === hostname && !/^[a-z0-9.-]+$/i.test(host)) throw new Error("Invalid installation hostname")
  const origin = new URL(`http://${host}:${port}`)
  const entry = await realpath(file)
  const module = await import(pathToFileURL(entry).href)
  const factory: unknown = module.default
  if (typeof factory !== "function") throw new Error("Installation factory must be the default export")
  const runtime = module.nativeSfLocalInstallation === true ? await import("./host-context") : undefined
  const teamCurrentChoice = module.nativeSfTeamInstallation === true && process.env.SUCAFINA_NATIVE_TEAM_DECISIONS === "1"
    ? (await import("./team-current-choice")).createSfTeamCurrentChoice() : undefined
  const value: unknown = await factory({
    origin: origin.origin,
    ...(teamCurrentChoice ? { teamCurrentChoice } : {}),
    ...(module.nativeSfTeamInstallation === true ? {
      loadTeamPurchaseMcp: async () => {
        const { createSfTeamPurchaseMcp } = await import("./team-purchase-mcp")
        return createSfTeamPurchaseMcp
      },
      loadTeamSupplierMcp: async () => {
        const { createSfTeamSupplierMcp } = await import("./team-purchase-mcp")
        return createSfTeamSupplierMcp
      },
    } : {}),
    ...(runtime ? {
      createHostRuntime: runtime.createSfHostRuntime,
      createCurrentChoiceFence: runtime.createCurrentChoiceFence,
      currentChoiceOwnsSnapshotTransactions: runtime.currentChoiceOwnsSnapshotTransactions,
      createSfSourcePersistence: runtime.createSfSourcePersistence,
      sourceRoot: path.resolve(path.dirname(entry), "../product/ai"),
    } : {}),
  })
  if (!value || typeof value !== "object" || !("dispose" in value) || typeof value.dispose !== "function") {
    throw new Error("Installation factory must provide a disposer")
  }
  if (
    !("mount" in value) || typeof value.mount !== "string" ||
    !/^\/(?:[a-z0-9_-]+\/)*[a-z0-9_-]+$/i.test(value.mount) || /^\/api(?:\/|$)/i.test(value.mount) ||
    !("handler" in value) || typeof value.handler !== "function"
  ) {
    await value.dispose()
    throw new Error("Installation factory must provide a valid, non-API mount and handler")
  }
  const installation = value as Installation
  const ingress = "trustedIngress" in value ? parseTrustedIngress(value.trustedIngress, hostname) : undefined
  if ("trustedIngress" in value && !ingress) {
    await installation.dispose()
    throw new Error("Trusted installation ingress requires a loopback listener, canonical HTTP origin and authorizer")
  }
  const nativeWeb = "nativeWeb" in value && value.nativeWeb === true
  const webRoot = nativeWeb && ingress ? await resolveWebRoot?.().catch(() => undefined) : undefined
  const webDiscovery = webRoot ? installation.discovery : undefined
  if (nativeWeb && (!webRoot || !webDiscovery)) {
    await installation.dispose()
    throw new Error("Native installation Web requires trusted ingress, installed discovery and a built Web bundle")
  }
  if (nativeWeb && ["/orchestra", "/assets", "/brand/sucafina"].some((prefix) =>
    installation.mount === prefix || installation.mount.startsWith(prefix + "/") || prefix.startsWith(installation.mount + "/"))) {
    await installation.dispose()
    throw new Error("Installation mount overlaps the native Web bundle")
  }
  const hostContributions = runtime && !ingress ? installation.host : undefined
  if (hostContributions !== undefined && (!Array.isArray(hostContributions) ||
    hostContributions.some((contribution) => !contribution || typeof contribution.id !== "string" || !contribution.id.trim()))) {
    await installation.dispose()
    throw new Error("Native installation host contributions require stable IDs")
  }
  const report = SfReviewRoutes["reviews.report.prepare"]
  const dashboard = report.pathTemplate.replace("{mount}", installation.mount)
  const isDashboard = (pathname: string) => pathname === dashboard ||
    (!!ingress && /^\/teams\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\/dashboard$/.test(pathname.slice(installation.mount.length)) &&
      pathname.startsWith(installation.mount + "/"))
  const contractLimit = (method: string, url: URL) => {
    if (method === "POST" && isDashboard(url.pathname) &&
      url.searchParams.getAll("upload").length === 1 && url.searchParams.get("upload") === "contract") return 25 * 1024 * 1024
  }
  const importAdmit = SfFileRoutes["files.import-admit"]
  const localImportLimit = (url: URL) => runtime && url.searchParams.size === 1 &&
    url.searchParams.get("sf") === importAdmit.fixedQuery.sf &&
    (url.pathname === dashboard || url.pathname === installation.mount + "/planner")
      ? importAdmit.maxRequestBytes
      : undefined
  const bodyLimit = (incoming: HttpServerRequest.HttpServerRequest) => {
    if (ingress || incoming.method !== "POST") return undefined
    const url = Option.getOrUndefined(HttpServerRequest.toURL(incoming))
    if (url?.origin === origin.origin) return localImportLimit(url) ?? contractLimit(incoming.method, url)
  }
  const route = Effect.gen(function* () {
    const incoming = yield* HttpServerRequest.HttpServerRequest
    if (!ingress) {
      const authority = incoming.headers.host?.toLowerCase()
      if (authority !== origin.host && !(port === 80 && authority === `${origin.host}:80`)) {
        return HttpServerResponse.empty({ status: 403 })
      }
    }
    const source = incoming.source instanceof Request ? incoming.source : undefined
    const url = ingress
      ? incoming.source instanceof IncomingMessage ? trustedIngressUrl(incoming.source, ingress) : undefined
      : source ? new URL(source.url) : Option.getOrUndefined(HttpServerRequest.toURL(incoming))
    if (!url || (!ingress && url.origin !== origin.origin)) {
      return HttpServerResponse.empty({ status: 403, headers: ingress ? { connection: "close" } : undefined })
    }
    const mounted = url.pathname === installation.mount || url.pathname.startsWith(`${installation.mount}/`)
    if (webDiscovery && url.pathname === "/api/sucafina/installations") {
      const headers = { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" }
      if (incoming.method !== "GET")
        return HttpServerResponse.empty({ status: 405, headers: { ...headers, Allow: "GET" } })
      if (incoming.headers["transfer-encoding"] || Number(incoming.headers["content-length"]) > 0)
        return HttpServerResponse.empty({ status: 400, headers: { ...headers, connection: "close" } })
      const selector = yield* Effect.try({
        try: () => parseSfInstallationSelector(url.href),
        catch: () => "invalid-selector" as const,
      }).pipe(Effect.option)
      if (Option.isNone(selector) || (selector.value.select !== "current" && selector.value.select !== "installation"))
        return HttpServerResponse.empty({ status: 400, headers })
      // This identifies the configured installation. Team admission is still checked by its mounted context endpoint.
      return yield* Effect.tryPromise((signal) => readSfInstallations(webDiscovery, selector.value, signal)).pipe(
        Effect.map((result) => HttpServerResponse.jsonUnsafe(result, { headers })),
      )
    }
    if (!mounted) {
      if (webRoot && (incoming.method === "GET" || incoming.method === "HEAD")) {
        if (incoming.headers["transfer-encoding"] || Number(incoming.headers["content-length"]) > 0)
          return HttpServerResponse.empty({ status: 400, headers: { connection: "close" } })
        const decoded = yield* Effect.try({
          try: () => decodeURIComponent(url.pathname),
          catch: () => "malformed-path" as const,
        }).pipe(Effect.option)
        if (Option.isNone(decoded) || decoded.value.includes("\\") || decoded.value.includes("\0") ||
          decoded.value.split("/").some((part) => part === "." || part === ".."))
          return HttpServerResponse.empty({ status: 400 })
        const orchestra = decoded.value.startsWith("/orchestra/")
        const index = decoded.value === "/" || (orchestra && !path.posix.extname(decoded.value))
        const asset = orchestra || decoded.value.startsWith("/assets/") || decoded.value.startsWith("/brand/sucafina/") ||
          decoded.value === "/oc-theme-preload.js" || decoded.value === "/site.webmanifest"
        if (index || asset) return yield* Effect.promise(async () => {
          const response = await WebUi.read(webRoot, decoded.value, {
            index, head: incoming.method === "HEAD",
            // The same branded build can also be served by the local Orchestra runtime.
            transformHtml: index ? (html) => html.replace(/<html\b/i, '<html data-sf-team-web="1"') : undefined,
          })
          response.headers.set("Cache-Control", "no-store")
          response.headers.set("X-Content-Type-Options", "nosniff")
          const policy = response.headers.get("Content-Security-Policy")
          if (policy) {
            response.headers.set("Content-Security-Policy", policy + "; frame-ancestors 'self'")
            response.headers.set("Referrer-Policy", "no-referrer")
          }
          return HttpServerResponse.fromWeb(response)
        })
      }
      return HttpServerResponse.empty({ status: 404 })
    }
    const configured = yield* HttpServerRequest.MaxBodySize
    const routeLimit = ingress ? contractLimit(incoming.method, url)
      : incoming.method === importAdmit.method ? localImportLimit(url) : undefined
    const max = Number(configured ?? routeLimit ?? 16 * 1024 * 1024)
    const reportLimit = incoming.method === report.method && isDashboard(url.pathname) &&
      url.searchParams.size === 1 && url.searchParams.get("sf") === report.fixedQuery.sf ? Math.min(max, report.maxRequestBytes) : undefined
    const oversized = () => reportLimit === undefined
      ? HttpServerResponse.empty({ status: 413, headers: { connection: "close" } })
      : HttpServerResponse.jsonUnsafe({ status: "needs-input", reason: "request-too-large" }, {
        status: 413, headers: { connection: "close", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" },
      })
    if ((ingress || reportLimit !== undefined) && Number(incoming.headers["content-length"]) > (reportLimit ?? max))
      return oversized()
    return yield* Effect.tryPromise(async (signal) => {
      let bytes = 0
      let exceeded = false
      const withinLimit = (chunk: Uint8Array) => {
        bytes += chunk.byteLength
        if (bytes <= (reportLimit ?? max)) return true
        exceeded = true
        return false
      }
      if (source) {
        const requestSignal = AbortSignal.any([source.signal, signal])
        if (!source.body || reportLimit === undefined) {
          const response = await installation.handler(new Request(source, { signal: requestSignal }))
          return response ? HttpServerResponse.fromWeb(response) : HttpServerResponse.empty({ status: 404 })
        }
        const body = source.body.pipeThrough(new TransformStream<Uint8Array, Uint8Array>({
          transform(chunk, controller) {
            if (withinLimit(chunk)) controller.enqueue(chunk)
            else controller.error(new Error("Installation request body exceeds the limit"))
          },
        }))
        const init = { body, signal: requestSignal, duplex: "half" as const }
        const response = await installation.handler(new Request(source, init)).catch(() => new Response(null, { status: 503 }))
        if (!body.locked) void body.cancel().catch(() => undefined)
        if (exceeded) return oversized()
        return response ? HttpServerResponse.fromWeb(response) : HttpServerResponse.empty({ status: 404 })
      }
      const node = NodeHttpServerRequest.toIncomingMessage(incoming)
      const carriesBody = Boolean(incoming.headers["transfer-encoding"] || Number(incoming.headers["content-length"]) > 0)
      if (carriesBody && (incoming.method === "GET" || incoming.method === "HEAD")) {
        return HttpServerResponse.empty({ status: 400, headers: { connection: "close" } })
      }
      // Cancellation after an early rejection must leave the socket open long enough to write the response.
      const body = carriesBody ? Stream.toReadableStream(
        NodeStream.fromReadable<Uint8Array>({ evaluate: () => node, closeOnDone: false }).pipe(
          Stream.mapEffect((chunk) => {
            if (withinLimit(chunk)) return Effect.succeed(chunk)
            return Effect.fail(new Error("Installation request body exceeds the limit"))
          }),
        ),
        { strategy: { highWaterMark: 0 } },
      ) : null
      if (body && !node.closed) {
        // A disconnect can emit a Node error after the stream adapter releases its listeners.
        const ignoreDisconnect = () => {}
        node.on("error", ignoreDisconnect)
        node.once("close", () => node.off("error", ignoreDisconnect))
      }
      const headers = ingress ? corporateHeaders(incoming.headers, url.host) : incoming.headers
      const disconnect = new AbortController()
      const disconnected = () => disconnect.abort()
      // A GET has already consumed its request body while the producer is
      // running. Its socket can still close when the browser aborts a poll.
      node.once("aborted", disconnected)
      node.socket.once("close", disconnected)
      if (node.aborted || node.socket.destroyed) disconnected()
      const response = await Promise.resolve().then(() => installation.handler(new Request(url, {
        method: incoming.method, headers, signal: AbortSignal.any([signal, disconnect.signal]),
        ...(body ? { body, duplex: "half" } : {}),
      }))).catch(() => new Response(null, { status: 503 })).finally(() => {
        node.off("aborted", disconnected)
        node.socket.off("close", disconnected)
      })
      if (body && !body.locked) void body.cancel().catch(() => undefined)
      if (exceeded) return oversized()
      const result = response ? HttpServerResponse.fromWeb(response) : HttpServerResponse.empty({ status: 404 })
      return body && !node.readableEnded ? HttpServerResponse.setHeader(result, "connection", "close") : result
    })
  }).pipe(Effect.catch(() => Effect.succeed(HttpServerResponse.empty({ status: 503, headers: { connection: "close" } }))))
  return {
    dispose: () => installation.dispose(),
    bodyLimit,
    dedicated: ingress !== undefined,
    host: hostContributions,
    discovery: runtime && !ingress ? installation.discovery : undefined,
    // An opted-in Web shell needs paths outside the mount. They still cross the same trusted-ingress gate.
    layer: HttpRouter.add("*", webRoot ? "/*" : `${installation.mount}/*`, route),
  }
}

function parseTrustedIngress(value: unknown, hostname: string) {
  if (hostname !== "127.0.0.1" && hostname !== "::1") return undefined
  if (!value || typeof value !== "object" ||
      !("origin" in value) || typeof value.origin !== "string" || !URL.canParse(value.origin) ||
      !("authorize" in value) || typeof value.authorize !== "function") return undefined
  const origin = new URL(value.origin)
  if (origin.protocol !== "http:" || origin.origin !== value.origin) return undefined
  return { origin, authorize: value.authorize as TrustedIngress["authorize"] }
}

function trustedIngressUrl(node: IncomingMessage, ingress: { origin: URL; authorize: TrustedIngress["authorize"] }) {
  const peer = node.socket.remoteAddress
  if (peer !== "127.0.0.1" && peer !== "::1" && peer !== "::ffff:127.0.0.1") return undefined
  const target = node.url
  if (!target?.startsWith("/") || target.startsWith("//") || target.includes("\\") || target.includes("#")) return undefined
  const headers = node.rawHeaders
  const values: { host?: string; proof?: string } = {}
  for (let offset = 0; offset < headers.length; offset += 2) {
    const name = headers[offset]?.toLowerCase()
    const field = name === "host" ? "host" : name === ingressProofHeader ? "proof" : undefined
    if (!field) continue
    if (values[field] !== undefined) return undefined
    values[field] = headers[offset + 1]
  }
  if (values.host?.toLowerCase() !== ingress.origin.host || !values.proof) return undefined
  try {
    if (ingress.authorize(values.proof) !== true) return undefined
    const url = new URL(target, ingress.origin)
    return url.origin === ingress.origin.origin ? url : undefined
  } catch {
    return undefined
  }
}

function corporateHeaders(incoming: HeadersInit, host: string) {
  const headers = new Headers(incoming)
  for (const name of [...headers.keys()]) {
    if (name === ingressProofHeader || name === "forwarded" || name.startsWith("x-forwarded-")) headers.delete(name)
  }
  headers.set("host", host)
  return headers
}
