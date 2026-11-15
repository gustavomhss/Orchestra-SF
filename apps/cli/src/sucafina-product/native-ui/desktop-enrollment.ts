import type { SfInstallationDescriptor } from "@orchestra/schema/sucafina/context"

/** Private single-use enrollment data. This is never a public Schema or renderer DTO. */
export type SfLocalEnrollment = Readonly<{
  installationId: string; projectId: string; publicOrigin: string; mount: string
  url: string; expiresAt: number
}>
export type SfNativeEnrollmentReply = SfLocalEnrollment & Readonly<{
  kind: "sf-native-local-enrollment"; launchId: string; requestId: string
}>
type Transport = NonNullable<ReturnType<typeof import("@orchestra/app-dock/socket-transport").fromEnv>>
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

/** Reuse the authenticated child-to-main Dock transport. Dispose gates its permanent listener. */
export function attachSfNativeEnrollment(options: Readonly<{
  transport: Transport
  launchId: string
  descriptor: SfInstallationDescriptor
  enrollNativeLocal: () => Promise<SfLocalEnrollment>
}>): Readonly<{ dispose(): void }> {
  if (!UUID.test(options.launchId) || options.descriptor.authMode !== "local-operator")
    throw new Error("Local enrollment requires a trusted local-operator launch")
  const state = { disposed: false, pending: false }
  options.transport.on("message", (event) => {
    if (state.disposed || state.pending || !event.data || typeof event.data !== "object") return
    const request = event.data as Record<string, unknown>
    if (
      request.kind !== "sf-native-local-enrollment-request"
      || request.launchId !== options.launchId
      || request.installationId !== options.descriptor.installationId
      || typeof request.requestId !== "string" || !UUID.test(request.requestId)
    ) return
    const requestId = request.requestId
    state.pending = true
    void Promise.resolve().then(() => options.enrollNativeLocal()).then((payload) => {
      if (state.disposed) return
      if (
        payload.installationId !== options.descriptor.installationId
        || payload.projectId !== options.descriptor.projectId
        || payload.publicOrigin !== options.descriptor.publicOrigin
        || payload.mount !== options.descriptor.mount
        || typeof payload.url !== "string"
        || !Number.isSafeInteger(payload.expiresAt)
        || payload.expiresAt <= Date.now()
        || payload.expiresAt > Date.now() + 600_000
      ) return
      options.transport.postMessage({
        kind: "sf-native-local-enrollment", launchId: options.launchId, requestId,
        installationId: payload.installationId, projectId: payload.projectId,
        publicOrigin: payload.publicOrigin, mount: payload.mount, url: payload.url, expiresAt: payload.expiresAt,
      } satisfies SfNativeEnrollmentReply)
    }).catch(() => {
      // Credential is never put into logs or a failure message.
    }).finally(() => { state.pending = false })
  })
  options.transport.postMessage({
    kind: "sf-native-local-ready", launchId: options.launchId,
    installationId: options.descriptor.installationId, projectId: options.descriptor.projectId,
  })
  return Object.freeze({ dispose() { state.disposed = true } })
}
