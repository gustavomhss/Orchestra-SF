import type {
  SfConnectionCandidate, SfDesktopCapability, SfDesktopInvalidation, SfDesktopInvocation,
  SfDesktopOwnerRequest,
} from "@orchestra/client/sucafina/transport"
import type { SfResolvedRoute } from "@orchestra/schema/sucafina/context"
import type { ipcRenderer } from "electron"

/** No callbacks, AbortSignal or credentials are transported as an event payload. */
export function createSfDesktopPreloadCapability(
  ipc: Pick<typeof ipcRenderer, "invoke" | "on" | "removeListener">,
): SfDesktopCapability {
  const listeners = new Map<string, { generation: number; callback: (event: SfDesktopInvalidation) => void }>()
  const invalidated = (_event: unknown, message: unknown) => {
    if (!message || typeof message !== "object") return
    if (!("bindingHandle" in message) || typeof message.bindingHandle !== "string") return
    const registered = listeners.get(message.bindingHandle)
    if (!registered || !("generation" in message) || message.generation !== registered.generation) return
    if (!("reason" in message) || !["logout", "owner-changed", "server-removed", "host-changed", "session-expired", "access-revoked"].includes(String(message.reason))) return
    listeners.delete(message.bindingHandle)
    registered.callback(message as SfDesktopInvalidation)
    if (!listeners.size) ipc.removeListener("sf-native-invalidated", invalidated)
  }
  const listen = (handle: string, generation: number, callback: (event: SfDesktopInvalidation) => void) => {
    if (!listeners.size) ipc.on("sf-native-invalidated", invalidated)
    listeners.set(handle, { generation, callback })
  }
  const forget = (handle: string) => {
    listeners.delete(handle)
    if (!listeners.size) ipc.removeListener("sf-native-invalidated", invalidated)
  }
  return Object.freeze({
    registerConnection: (candidate: SfConnectionCandidate) => ipc.invoke("sf-native-register-connection", candidate),
    discoverLocation: (probe) => ipc.invoke("sf-native-discover-location", probe),
    async bind(selection: { serverKey: string; projectId: string; installationId: string }, onInvalidated: (event: SfDesktopInvalidation) => void) {
      const result = await ipc.invoke("sf-native-bind", selection)
      if (result?.status === "ok" && typeof result.bindingHandle === "string" && Number.isSafeInteger(result.generation))
        listen(result.bindingHandle, result.generation, onInvalidated)
      return result
    },
    invoke: (request: SfDesktopInvocation) => ipc.invoke("sf-native-invoke", request),
    abort: (request: SfDesktopOwnerRequest & { requestId: string }) => ipc.invoke("sf-native-abort", request),
    login: (request: SfDesktopOwnerRequest & { returnRoute: SfResolvedRoute }) => ipc.invoke("sf-native-login", request),
    logout: (request: SfDesktopOwnerRequest) => ipc.invoke("sf-native-logout", request),
    async release(request: (SfDesktopOwnerRequest & { kind: "binding" }) | { kind: "connection"; serverKey: string; projectId: string; generation: number; reason: "server-removed" }) {
      if (request.kind === "binding") forget(request.bindingHandle)
      return ipc.invoke("sf-native-release", request)
    },
  })
}
