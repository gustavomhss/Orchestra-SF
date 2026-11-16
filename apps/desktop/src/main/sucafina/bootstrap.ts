import { SfNativeOperationBindings } from "@orchestra/client/sucafina/bindings"
import { isRendererOrigin, rendererDevUrl } from "../renderer-origin"
import { createSfDesktopBroker, type SfDesktopBrokerDependencies } from "./index"
import type { SfNativeEnrollmentReply } from "./enrollment"

type EnrollmentRequest = Parameters<SfDesktopBrokerDependencies["requestLocalEnrollment"]>[0]
type DockReply = (message: unknown) => void
type Ready = Readonly<{ launchId: string; send: DockReply }>
type Pending = {
  key: string
  launchId: string
  serverKey: string
  resolve: (reply: SfNativeEnrollmentReply) => void
  reject: (reason: Error) => void
  timer: ReturnType<typeof setTimeout>
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const text = (value: unknown, max = 2048): value is string =>
  typeof value === "string" && value.length > 0 && value.length <= max && !/[\x00-\x1f\x7f]/.test(value)
const record = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value)
const exact = (value: Record<string, unknown>, keys: readonly string[]) =>
  Object.keys(value).length === keys.length && keys.every((key) => Object.hasOwn(value, key))
const scopeKey = (projectId: string, installationId: string) => JSON.stringify([projectId, installationId])

/**
 * The only local-enrollment channel is the existing, per-launch, authenticated
 * desktop-owned Dock socket. This bridge never publishes enrollment codes to
 * IPC, renderer, logs, disk, a generic HTTP endpoint, or an agent.
 *
 * A CLI producer must explicitly attachSfNativeEnrollment and announce its
 * real launch/installation; silence is unavailable, never a synthetic grant.
 */
export function createSfDesktopEnrollmentBridge(
  ownedConnection: SfDesktopBrokerDependencies["ownedConnection"],
) {
  const ready = new Map<string, Ready>()
  const pending = new Map<string, Pending>()
  let disposed = false

  const stopPending = (reason: string, key?: string) => {
    for (const [requestId, item] of pending) {
      if (key !== undefined && item.key !== key) continue
      pending.delete(requestId)
      clearTimeout(item.timer)
      item.reject(new Error(reason))
    }
  }

  const handleMessage = (message: unknown, send: DockReply): boolean => {
    if (!record(message)) return false
    if (message.kind === "sf-native-local-ready") {
      if (disposed || !exact(message, ["kind", "launchId", "installationId", "projectId"])
        || typeof message.launchId !== "string" || !UUID.test(message.launchId)
        || !text(message.projectId) || !text(message.installationId)) return true
      const key = scopeKey(message.projectId, message.installationId)
      const previous = ready.get(key)
      if (previous && previous.launchId !== message.launchId)
        stopPending("SF_NATIVE_ENROLLMENT_LAUNCH_CHANGED", key)
      ready.set(key, { launchId: message.launchId, send })
      return true
    }
    if (message.kind !== "sf-native-local-enrollment") return false
    if (disposed || !exact(message, [
      "kind", "launchId", "requestId", "installationId", "projectId",
      "publicOrigin", "mount", "url", "expiresAt",
    ]) || typeof message.requestId !== "string") return true
    const item = pending.get(message.requestId)
    if (!item) return true
    const active = ready.get(item.key)
    if (!active || active.launchId !== item.launchId || message.launchId !== item.launchId
      || !text(message.projectId) || !text(message.installationId)
      || scopeKey(message.projectId, message.installationId) !== item.key) return true

    pending.delete(message.requestId)
    clearTimeout(item.timer)
    const owned = ownedConnection()
    if (!owned || owned.serverKey !== item.serverKey
      || !text(message.publicOrigin) || message.publicOrigin !== owned.baseUrl
      || !text(message.mount, 128) || !text(message.url) || !Number.isSafeInteger(message.expiresAt)
      || (message.expiresAt as number) <= Date.now() || (message.expiresAt as number) > Date.now() + 600_000) {
      item.reject(new Error("SF_NATIVE_ENROLLMENT_PRODUCER_MISMATCH"))
      return true
    }
    // The broker's requireSfManagedEnrollment then verifies the actual
    // descriptor, loopback origin, mount, exact code URL and expiry.
    item.resolve(message as SfNativeEnrollmentReply)
    return true
  }

  const requestLocalEnrollment = (request: EnrollmentRequest): Promise<SfNativeEnrollmentReply> => {
    const owned = ownedConnection()
    if (disposed || !owned || request.serverKey !== owned.serverKey
      || !URL.canParse(owned.baseUrl) || !["127.0.0.1", "[::1]", "localhost"].includes(new URL(owned.baseUrl).hostname)
      || new URL(owned.baseUrl).protocol !== "http:"
      || !text(request.projectId) || !text(request.installationId)
      || !UUID.test(request.requestId))
      return Promise.reject(new Error("SF_NATIVE_ENROLLMENT_OWNER_UNAVAILABLE"))
    const key = scopeKey(request.projectId, request.installationId)
    const connected = ready.get(key)
    if (!connected || [...pending.values()].some((item) => item.key === key)
      || pending.has(request.requestId))
      return Promise.reject(new Error("SF_NATIVE_ENROLLMENT_PRODUCER_UNAVAILABLE"))
    return new Promise<SfNativeEnrollmentReply>((resolve, reject) => {
      const timer = setTimeout(() => {
        pending.delete(request.requestId)
        reject(new Error("SF_NATIVE_ENROLLMENT_TIMEOUT"))
      }, 30_000)
      pending.set(request.requestId, { key, launchId: connected.launchId,
        serverKey: request.serverKey, resolve, reject, timer })
      try {
        connected.send({
          kind: "sf-native-local-enrollment-request",
          launchId: connected.launchId,
          installationId: request.installationId,
          requestId: request.requestId,
        })
      } catch {
        stopPending("SF_NATIVE_ENROLLMENT_TRANSPORT_UNAVAILABLE", key)
      }
    })
  }

  const disconnect = () => {
    ready.clear()
    stopPending("SF_NATIVE_ENROLLMENT_TRANSPORT_CLOSED")
  }
  return Object.freeze({
    handleMessage, requestLocalEnrollment, disconnect,
    dispose: () => { disposed = true; disconnect() },
  })
}

/** Attach the original D01 broker once, in Electron main, after app.whenReady. */
export function registerSfDesktopBootstrap(
  deps: Omit<SfDesktopBrokerDependencies, "operations" | "isRendererUrl">,
) {
  const devUrl = rendererDevUrl(deps.electron.app.isPackaged, process.env.ELECTRON_RENDERER_URL)
  return createSfDesktopBroker({
    ...deps,
    operations: SfNativeOperationBindings,
    isRendererUrl: (url) => isRendererOrigin(url, devUrl),
  })
}
