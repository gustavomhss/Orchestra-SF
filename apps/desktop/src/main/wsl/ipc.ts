import { app, BrowserWindow, ipcMain } from "electron"
import type { IpcMainInvokeEvent } from "electron"
import type { WslServersController } from "./servers"
import { requireWslIpcString, requireWslIpcStrings } from "./policy"
import type { WslServersState } from "../../preload/types"
import { nativeT } from "../native-translations"
import { isRendererOrigin, rendererDevUrl } from "../renderer-origin"

export function registerWslIpcHandlers(
  controller: WslServersController,
  isMainWindow: (window: BrowserWindow) => boolean,
) {
  const trusted = (sender: IpcMainInvokeEvent["sender"], frame: IpcMainInvokeEvent["senderFrame"]) => {
    if (!frame || sender.isDestroyed() || frame !== sender.mainFrame) return false
    if (!isRendererOrigin(frame.url, rendererDevUrl(app.isPackaged, process.env.ELECTRON_RENDERER_URL))) return false
    const win = BrowserWindow.fromWebContents(sender)
    return !!win && !win.isDestroyed() && win.webContents === sender && isMainWindow(win)
  }
  const handle: typeof ipcMain.handle = (channel, listener) =>
    ipcMain.handle(channel, (event, ...args) => {
      if (!trusted(event.sender, event.senderFrame)) throw new Error(`Untrusted IPC sender: ${channel}`)
      return listener(event, ...args)
    })

  if (process.platform !== "win32") {
    registerUnavailableWslIpcHandlers(handle)
    return
  }

  const subscriptions = new Map<number, { frame: IpcMainInvokeEvent["senderFrame"]; dispose(): void }>()
  const unsubscribe = (id: number) => {
    const subscription = subscriptions.get(id)
    if (!subscription) return
    subscriptions.delete(id)
    subscription.dispose()
  }

  app.once("will-quit", () => {
    subscriptions.forEach((_, id) => unsubscribe(id))
  })

  handle("wsl-servers-subscribe", (event) => {
    const sender = event.sender
    const frame = event.senderFrame
    const id = sender.id
    if (subscriptions.get(id)?.frame === frame) return
    unsubscribe(id)
    const destroyed = () => unsubscribe(id)
    const off = controller.subscribe((payload) => {
      if (!trusted(sender, frame)) {
        unsubscribe(id)
        return
      }
      sender.send("wsl-servers-event", payload)
    })
    subscriptions.set(id, {
      frame,
      dispose() {
        off()
        sender.removeListener("destroyed", destroyed)
      },
    })
    sender.once("destroyed", destroyed)
  })
  handle("wsl-servers-unsubscribe", (event) => unsubscribe(event.sender.id))
  handle("wsl-servers-get-state", () => controller.getState())
  handle("wsl-servers-probe-runtime", () => controller.probeRuntime())
  handle("wsl-servers-refresh-distros", () => controller.refreshDistros())
  handle("wsl-servers-install-wsl", () => controller.installWsl())
  handle("wsl-servers-install-distro", (_event: IpcMainInvokeEvent, name: string) =>
    controller.installDistro(requireWslIpcString("distro", name)),
  )
  handle("wsl-servers-probe-addable", (_event: IpcMainInvokeEvent, distros: string[]) =>
    controller.probeAddable(requireWslIpcStrings("distro", distros)),
  )
  handle("wsl-servers-install-server", (_event: IpcMainInvokeEvent, name: string) =>
    controller.installServer(requireWslIpcString("distro", name)),
  )
  handle("wsl-servers-open-terminal", (_event: IpcMainInvokeEvent, name: string) =>
    controller.openTerminal(requireWslIpcString("distro", name)),
  )
  handle("wsl-servers-add", (_event: IpcMainInvokeEvent, distro: string) =>
    controller.addServer(requireWslIpcString("distro", distro)),
  )
  handle("wsl-servers-remove", (_event: IpcMainInvokeEvent, id: string) =>
    controller.removeServer(requireWslIpcString("server id", id)),
  )
  handle("wsl-servers-start", (_event: IpcMainInvokeEvent, id: string) =>
    controller.startServer(requireWslIpcString("server id", id)),
  )
}

function registerUnavailableWslIpcHandlers(handle: typeof ipcMain.handle) {
  const unavailable = () => {
    throw new Error(nativeT("desktop.wsl.error.windowsOnly"))
  }
  const state = (): WslServersState => ({
    runtime: {
      available: false,
      version: null,
      error: nativeT("desktop.wsl.error.windowsOnly"),
    },
    installed: [],
    online: [],
    distroProbes: {},
    orchestraChecks: {},
    pendingRestart: false,
    servers: [],
    job: null,
  })

  handle("wsl-servers-subscribe", (event) => {
    event.sender.send("wsl-servers-event", { type: "state", state: state() })
  })
  handle("wsl-servers-unsubscribe", () => undefined)
  handle("wsl-servers-get-state", () => state())
  handle("wsl-servers-probe-runtime", unavailable)
  handle("wsl-servers-refresh-distros", unavailable)
  handle("wsl-servers-install-wsl", unavailable)
  handle("wsl-servers-install-distro", unavailable)
  handle("wsl-servers-probe-addable", unavailable)
  handle("wsl-servers-install-server", unavailable)
  handle("wsl-servers-open-terminal", unavailable)
  handle("wsl-servers-add", unavailable)
  handle("wsl-servers-remove", unavailable)
  handle("wsl-servers-start", unavailable)
}
