import { randomUUID } from "node:crypto"
import type { BrowserWindow, Session, net } from "electron"
import type { SfContext, SfInstallationDescriptor, SfResolvedRoute } from "@orchestra/schema/sucafina/context"
import type { SfOperationBindings } from "@orchestra/schema/sucafina/common"
import type { SfDesktopLoginResult } from "@orchestra/client/sucafina/transport"
import { requireSfEnrollmentUrl, requireSfManagedEnrollment, readSfUnmanagedEnrollment, type SfNativeEnrollmentReply } from "./enrollment"
import { decodeSfWireBody, planSfOperation } from "./protocol"
import { requestSfHttp } from "./network"

type Shared = Readonly<{
  net: Pick<typeof net, "request">
  session: Session
  descriptor: SfInstallationDescriptor
  operations: SfOperationBindings
  signal?: AbortSignal
}>
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value)
const nonempty = (value: unknown) => typeof value === "string" && value.length > 0 && value.length < 2049 && !/[\x00-\x1f\x7f]/.test(value)

export async function loadSfDesktopContext(options: Shared): Promise<
  | Readonly<{ status: "ok"; context: SfContext }>
  | Readonly<{ status: "denied" | "unauthenticated" | "unavailable" }>
> {
  const request = {
    kind: "request" as const, bindingHandle: "", generation: 0, requestId: randomUUID(),
    operationId: "ctx.context" as const,
    input: { installationId: options.descriptor.installationId, projectId: options.descriptor.projectId, hostId: options.descriptor.hostId },
  }
  const planned = planSfOperation({ request, descriptor: options.descriptor, operations: options.operations })
  if (planned.status !== "ok") return { status: "unavailable" }
  try {
    const response = await requestSfHttp({ net: options.net, session: options.session,
      origin: options.descriptor.publicOrigin, url: planned.value.url,
      method: "GET", mode: "json", signal: options.signal, maxResponseBytes: 4 * 1024 * 1024 })
    if (response.kind !== "buffer") return { status: "unavailable" }
    if (response.status === 401) return { status: "unauthenticated" }
    if (response.status === 403) return { status: "denied" }
    if (response.status !== 200) return { status: "unavailable" }
    const decoded = decodeSfWireBody(planned.value, response.bytes, response.headers["content-type"])
    if (decoded.status !== "ok" || !isRecord(decoded.value)) return { status: "unavailable" }
    if (decoded.value.status === "unauthenticated") return { status: "unauthenticated" }
    if (decoded.value.status === "denied") return { status: "denied" }
    if (decoded.value.status !== "ok" || !isRecord(decoded.value.value)) return { status: "unavailable" }
    const context = decoded.value.value
    if (!isRecord(context.stamp) || context.contractRevision !== "sf-native-ui/1"
      || context.authMode !== options.descriptor.authMode
      || context.stamp.installationId !== options.descriptor.installationId
      || context.stamp.projectId !== options.descriptor.projectId
      || context.stamp.hostId !== options.descriptor.hostId
      || !nonempty(context.stamp.principalRef) || !nonempty(context.stamp.accessRevision)
      || !nonempty(context.stamp.policyVersion)) return { status: "unavailable" }
    return { status: "ok", context: context as SfContext }
  } catch {
    return { status: "unavailable" }
  }
}

function sfMarker(value: string, descriptor: SfInstallationDescriptor): boolean {
  if (!URL.canParse(value)) return false
  const url = new URL(value)
  return url.origin === descriptor.publicOrigin && url.pathname === descriptor.mount + "/dashboard"
    && !url.hash && url.searchParams.size === 2
    && url.searchParams.getAll("sf").length === 1 && url.searchParams.get("sf") === "native-return"
    && url.searchParams.getAll("resume").length === 1
    && /^[A-Za-z0-9_-]{16,256}$/.test(url.searchParams.get("resume") ?? "")
}

/** No render frame, remote website, or arbitrary OAuth origin receives this BrowserWindow. */
export function allowSfAuthNavigation(value: string, descriptor: SfInstallationDescriptor) {
  if (!URL.canParse(value)) return false
  const url = new URL(value)
  if (url.username || url.password || url.hash) return false
  if (url.origin === descriptor.publicOrigin) {
    if (url.pathname.startsWith(descriptor.mount + "/auth/")) return true
    return sfMarker(value, descriptor)
  }
  return url.protocol === "https:" && [
    "https://login.microsoftonline.com", "https://login.live.com",
    "https://login.microsoft.com", "https://account.live.com",
  ].includes(url.origin)
}

export async function requestSfReturnIntent(options: Shared & Readonly<{ route: SfResolvedRoute; serverKey: string }>) {
  const route = options.route
  if (
    !isRecord(route.ownerSelection)
    || route.ownerSelection.serverKey !== options.serverKey
    || route.ownerSelection.projectId !== options.descriptor.projectId
    || route.ownerSelection.installationId !== undefined
       && route.ownerSelection.installationId !== options.descriptor.installationId
    || typeof route.pathname !== "string" || !/^\/orchestra\/sf-[a-z0-9-]+(?:\/[A-Za-z0-9_%.-]+)*$/.test(route.pathname)
    || typeof route.href !== "string" || !route.href.startsWith(route.pathname)
    || !/^(CAP(?:0[1-9]|1[0-9]|2[0-8])|UI(?:[2-6][0-9]|70))$/.test(route.surfaceId)
  ) return
  const query = route.query ?? {}
  if (!isRecord(query) || Object.entries(query).some(([key, value]) =>
    !/^[A-Za-z][A-Za-z0-9]{0,30}$/.test(key) || (typeof value !== "string" && typeof value !== "number")
    || String(value).length > 2048 || /[\x00-\x1f\x7f]/.test(String(value)))) return
  const body = Buffer.from(JSON.stringify({
    chapterId: route.pathname.split("/")[2],
    routeId: route.surfaceId,
    ...(Object.values(route.params ?? {}).length === 1 && typeof Object.values(route.params)[0] === "string"
      ? { encodedRef: route.pathname.split("/").find((segment) => segment.startsWith("r_")) }
      : {}),
    query,
  }), "utf8")
  if (body.byteLength > 4096) return
  const result = await requestSfHttp({
    net: options.net, session: options.session, origin: options.descriptor.publicOrigin,
    url: options.descriptor.publicOrigin + options.descriptor.mount + "/api/ui/return-intents",
    method: "POST", mode: "json", body, signal: options.signal,
    headers: { Origin: options.descriptor.publicOrigin, "Content-Type": "application/json", Accept: "application/json", "Idempotency-Key": randomUUID() },
    maxResponseBytes: 4096,
  })
  if (result.kind !== "buffer" || result.status !== 200 && result.status !== 201) return
  let reply: unknown
  try { reply = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(result.bytes)) } catch { return }
  // I00's private return-intent reply must publish a one-use opaque resume; no caller URL is honored.
  if (!isRecord(reply) || !nonempty(reply.resume) || !/^[A-Za-z0-9_-]{16,256}$/.test(reply.resume as string)) return
  const marker = options.descriptor.mount + "/dashboard?sf=native-return&resume=" + encodeURIComponent(reply.resume as string)
  return options.descriptor.publicOrigin + options.descriptor.mount + "/auth/login?returnTo=" + encodeURIComponent(marker)
}

export async function loginSfMicrosoft(options: Shared & Readonly<{
  BrowserWindow: typeof BrowserWindow
  parent: BrowserWindow
  loginUrl: string
  onWindow: (window: BrowserWindow | undefined) => void
}>): Promise<SfDesktopLoginResult> {
  if (!options.loginUrl.startsWith(options.descriptor.publicOrigin + options.descriptor.mount + "/auth/login?"))
    return { status: "unavailable", reason: "contract-mismatch" }
  const window = new options.BrowserWindow({
    parent: options.parent, width: 680, height: 760, show: true, modal: false, autoHideMenuBar: true,
    webPreferences: {
      session: options.session, sandbox: true, contextIsolation: true,
      nodeIntegration: false, webSecurity: true, webviewTag: false,
    },
  })
  options.onWindow(window)
  window.webContents.setWindowOpenHandler(() => ({ action: "deny" }))
  return new Promise((resolve) => {
    let finished = false
    let probing = false
    const timer = setTimeout(() => finish({ status: "unavailable", reason: "auth-unavailable" }), 5 * 60_000)
    const finish = (result: SfDesktopLoginResult) => {
      if (finished) return
      finished = true
      clearTimeout(timer)
      options.signal?.removeEventListener("abort", abort)
      options.onWindow(undefined)
      if (!window.isDestroyed()) window.close()
      resolve(result)
    }
    const abort = () => finish({ status: "unavailable", reason: "auth-unavailable" })
    options.signal?.addEventListener("abort", abort, { once: true })
    window.once("closed", () => finish({ status: "cancelled" }))
    let markerEntered = false
    const check = () => {
      // Never report successful login until I00 has consumed the one-use native-return
      // marker and has redirected to the internal Orchestra href, not merely seen a URL.
      if (!markerEntered || probing || finished) return
      probing = true
      void loadSfDesktopContext(options).then((state) => {
        if (state.status === "ok") return finish({ status: "authenticated", context: state.context })
        if (state.status === "denied") return finish({ status: "denied" })
        probing = false
      })
    }
    const navigation = (event: { preventDefault(): void }, raw: unknown) => {
      const url = typeof raw === "string" ? raw : isRecord(raw) && typeof raw.url === "string" ? raw.url : ""
      if (sfMarker(url, options.descriptor)) { markerEntered = true; return }
      if (markerEntered && URL.canParse(url)) {
        const destination = new URL(url)
        if (destination.origin === options.descriptor.publicOrigin
          && destination.pathname.startsWith("/orchestra/sf-")) {
          // This redirect proves the server consumed native-return. Keep the auth
          // BrowserWindow away from the privileged app renderer's internal routes.
          event.preventDefault()
          check()
          return
        }
      }
      if (!allowSfAuthNavigation(url, options.descriptor)) event.preventDefault()
    }
    window.webContents.on("will-navigate", navigation)
    window.webContents.on("will-redirect", navigation)
    void window.loadURL(options.loginUrl).catch(() => finish({ status: "unavailable", reason: "auth-unavailable" }))
  })
}

export async function loginSfLocal(options: Shared & Readonly<{
  descriptor: SfInstallationDescriptor
  serverKey: string
  owned: boolean
  requestLocalEnrollment: (request: Readonly<{ serverKey: string; projectId: string; installationId: string; requestId: string }>) => Promise<SfNativeEnrollmentReply>
  dialog: Pick<typeof import("electron").dialog, "showOpenDialog">
  parent: BrowserWindow
}>): Promise<SfDesktopLoginResult> {
  if (options.descriptor.authMode !== "local-operator") return { status: "unavailable", reason: "identity-unavailable" }
  try {
    const enrollment = options.owned ? await (async () => {
      const requestId = randomUUID()
      const reply = await options.requestLocalEnrollment({
        serverKey: options.serverKey, projectId: options.descriptor.projectId,
        installationId: options.descriptor.installationId, requestId,
      })
      if (!UUID.test(reply.launchId)) throw new Error("Invalid managed enrollment launch")
      // The injected per-child Dock correlator owns the current launch ID and pending request.
      return requireSfManagedEnrollment(reply, options.descriptor, requestId, reply.launchId)
    })() : await (async () => {
      const picked = await options.dialog.showOpenDialog(options.parent, {
        title: "Local operator enrollment", properties: ["openFile"],
        filters: [{ name: "Local enrollment", extensions: ["html"] }],
      })
      if (picked.canceled || picked.filePaths.length !== 1) return
      return readSfUnmanagedEnrollment(picked.filePaths[0]!, options.descriptor)
    })()
    if (!enrollment) return { status: "cancelled" }
    const url = requireSfEnrollmentUrl(enrollment, options.descriptor)
    // 303 is deliberately never followed as a data request. The original producer creates
    // the single-use HttpOnly cookie in this same isolated Session before the redirect.
    await requestSfHttp({ net: options.net, session: options.session, origin: options.descriptor.publicOrigin,
      url, method: "GET", mode: "empty", signal: options.signal, maxResponseBytes: 1024 }).catch(() => undefined)
    const context = await loadSfDesktopContext(options)
    if (context.status === "ok") return { status: "authenticated", context: context.context }
    return context.status === "denied" ? { status: "denied" } : { status: "unavailable", reason: "enrollment-unavailable" }
  } catch {
    return { status: "unavailable", reason: "enrollment-unavailable" }
  }
}
