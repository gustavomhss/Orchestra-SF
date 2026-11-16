import type { SfDesktopCapability } from "@orchestra/client/sucafina/transport"

/** An optional Platform capability; never override global fetch or persist a credential. */
export function createSfDesktopCapability(preload: SfDesktopCapability): SfDesktopCapability {
  return Object.freeze({
    registerConnection: (candidate) => preload.registerConnection(candidate),
    discoverLocation: (probe) => preload.discoverLocation
      ? preload.discoverLocation(probe)
      : Promise.resolve({ status: "unavailable" as const, reason: "contract-mismatch" as const }),
    bind: (selection, onInvalidated) => preload.bind(selection, onInvalidated),
    invoke: (request) => preload.invoke(request),
    abort: (request) => preload.abort(request),
    login: (request) => preload.login(request),
    logout: (request) => preload.logout(request),
    release: (request) => preload.release(request),
  })
}
