import { expect, test } from "bun:test"
import { EventEmitter } from "node:events"
import { mockElectron } from "../electron-mock.fixture"
import type { WslServersController } from "./servers"

type Handler = (event: unknown, ...args: unknown[]) => unknown

const handlers = new Map<string, Handler>()
const app = Object.assign(new EventEmitter(), { isPackaged: true })
const windows: { webContents: ReturnType<typeof renderer>; isDestroyed: () => boolean }[] = []

function renderer(id: number, url: string) {
  const sent: { channel: string; payload: unknown }[] = []
  return Object.assign(new EventEmitter(), {
    id,
    isDestroyed: () => false,
    mainFrame: { url },
    sent,
    send: (channel: string, payload: unknown) => sent.push({ channel, payload }),
  })
}

mockElectron({
  app,
  ipcMain: { handle: (channel: string, handler: Handler) => handlers.set(channel, handler) },
  BrowserWindow: { fromWebContents: (sender: unknown) => windows.find((win) => win.webContents === sender) },
})
const { registerWslIpcHandlers } = await import("./ipc")

function setup() {
  handlers.clear()
  app.removeAllListeners()
  const main = renderer(1, "oc://renderer/index.html")
  const navigated = renderer(2, "https://outside.example/")
  const foreign = renderer(3, "oc://renderer/live/index.html")
  const registered = { webContents: main, isDestroyed: () => false }
  const otherMain = { webContents: navigated, isDestroyed: () => false }
  windows.splice(0, windows.length, registered, otherMain, { webContents: foreign, isDestroyed: () => false })

  const calls: string[] = []
  const state = { installed: ["Ubuntu"] }
  const listeners = new Set<Parameters<WslServersController["subscribe"]>[0]>()
  const controller = {
    getState: () => {
      calls.push("state")
      return state
    },
    installWsl: () => calls.push("install"),
    subscribe: (listener: Parameters<WslServersController["subscribe"]>[0]) => {
      calls.push("subscribe")
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
  } as unknown as WslServersController
  registerWslIpcHandlers(controller, (win: unknown) => win === registered || win === otherMain)
  return { main, navigated, foreign, calls, listeners, state }
}

const event = (sender: ReturnType<typeof renderer>) => ({ sender, senderFrame: sender.mainFrame })

test("WSL refuses unauthorized senders on every channel before controller calls or events", () => {
  const { main, navigated, foreign, calls } = setup()
  const denied = [
    event(navigated),
    { ...event(main), senderFrame: { ...main.mainFrame } },
    { ...event(main), senderFrame: null },
    event(foreign),
  ]
  expect(handlers.size).toBe(13)
  for (const input of denied) {
    for (const [channel, handle] of handlers) {
      expect(() => handle(input)).toThrow(`Untrusted IPC sender: ${channel}`)
    }
  }
  expect(calls).toEqual([])
  expect([...main.sent, ...navigated.sent, ...foreign.sent]).toEqual([])
})

test("WSL preserves the registered main renderer path", () => {
  const { main, calls, state } = setup()
  const read = handlers.get("wsl-servers-get-state")!
  const install = handlers.get("wsl-servers-install-wsl")!
  if (process.platform === "win32") {
    expect(read(event(main))).toBe(state)
    install(event(main))
    expect(calls).toEqual(["state", "install"])
    return
  }
  expect(read(event(main))).toMatchObject({ runtime: { available: false } })
  expect(() => install(event(main))).toThrow()
  handlers.get("wsl-servers-subscribe")!(event(main))
  expect(main.sent).toMatchObject([{
    channel: "wsl-servers-event",
    payload: { type: "state", state: { runtime: { available: false } } },
  }])
  expect(calls).toEqual([])
})

test.skipIf(process.platform !== "win32")("WSL rechecks active subscriptions before sending state", () => {
  const { main, calls, listeners } = setup()
  const subscribe = handlers.get("wsl-servers-subscribe")!
  const payload = { type: "state", state: { installed: ["Ubuntu"] } } as Parameters<
    Parameters<WslServersController["subscribe"]>[0]
  >[0]
  const emit = () => listeners.forEach((listener) => listener(payload))
  subscribe(event(main))
  subscribe(event(main))
  expect(calls).toEqual(["subscribe"])
  emit()
  expect(main.sent).toEqual([{ channel: "wsl-servers-event", payload }])

  main.mainFrame.url = "https://outside.example/"
  emit()
  expect(main.sent).toHaveLength(1)
  expect(listeners.size).toBe(0)

  main.mainFrame = { url: "oc://renderer/index.html" }
  subscribe(event(main))
  main.mainFrame = { url: "oc://renderer/index.html" }
  subscribe(event(main))
  emit()
  expect(listeners.size).toBe(1)
  expect(main.sent).toHaveLength(2)

  main.emit("destroyed")
  expect(listeners.size).toBe(0)
})
