import { describe, expect, test } from "bun:test"
import { mockElectron } from "./electron-mock.fixture"

type Handler = (event: unknown, ...args: unknown[]) => unknown
type Loop = Parameters<typeof import("./live-ipc").registerLiveIpc>[0]

const handlers = new Map<string, Handler>()
const sent: { channel: string; payload: unknown }[] = []
const renderer = (url: string) => ({
  isDestroyed: () => false,
  webContents: {
    isDestroyed: () => false,
    mainFrame: { url },
    getURL: () => url,
    send: (channel: string, payload: unknown) => sent.push({ channel, payload }),
  },
})
const main = renderer("oc://renderer/index.html")
const navigatedMain = renderer("https://outside.example/")
const foreign = renderer("oc://renderer/live/index.html")
const trusted = { sender: main.webContents, senderFrame: main.webContents.mainFrame }
const windows = [main, navigatedMain, foreign]
const isMainWindow = (window: unknown) => window === main || window === navigatedMain
mockElectron({
  app: { isPackaged: true },
  ipcMain: { handle: (channel: string, handler: Handler) => handlers.set(channel, handler) },
  BrowserWindow: {
    getAllWindows: () => windows,
    fromWebContents: (contents: unknown) => windows.find((window) => window.webContents === contents),
  },
})
const { registerLiveIpc } = await import("./live-ipc")

function fakeLoop() {
  const runListeners: ((state: unknown) => void)[] = []
  const levelListeners: ((levels: unknown) => void)[] = []
  const bound = new Map<string, unknown>()
  let contentProtection = true
  const loop = {
    settings: {
      bind: (action: string, handler: unknown) => bound.set(action, handler),
      get: () => ({ answerModel: undefined }),
    },
    getOverlayContentProtection: () => contentProtection,
    setOverlayContentProtection: (enabled: boolean) => { contentProtection = enabled },
    running: () => false,
    runState: () => ({ running: false }),
    start: async (title?: string) => ({ ok: true, meetingID: title ?? "untitled" }),
    stop: async () => {},
    toggleCaptions: () => {},
    onRunState: (listener: (state: unknown) => void) => void runListeners.push(listener),
    onLevels: (listener: (levels: unknown) => void) => void levelListeners.push(listener),
  } as unknown as Loop
  return { loop, runListeners, levelListeners, bound }
}

describe("live IPC", () => {
  test("broadcasts run state and levels only to trusted main renderers", () => {
    const { loop, runListeners, levelListeners } = fakeLoop()
    registerLiveIpc(loop, isMainWindow)
    sent.length = 0
    runListeners.forEach((listener) => listener({ running: true, meetingID: "m1", startedAt: 1 }))
    levelListeners.forEach((listener) => listener({ microphone: 0.2, "system-audio": 0 }))
    expect(sent).toEqual([
      { channel: "live-run-state-changed", payload: { running: true, meetingID: "m1", startedAt: 1 } },
      { channel: "live-levels", payload: { microphone: 0.2, "system-audio": 0 } },
    ])
  })

  test("holds the captions hotkey only while a meeting runs", () => {
    const { loop, runListeners, bound } = fakeLoop()
    registerLiveIpc(loop, isMainWindow)
    runListeners.forEach((listener) => listener({ running: true }))
    expect(bound.get("toggle-captions")).toBe(loop.toggleCaptions)
    runListeners.forEach((listener) => listener({ running: false }))
    expect(bound.get("toggle-captions")).toBeUndefined()
    expect(typeof bound.get("start-stop")).toBe("function")
  })

  test("refuses external origins, same-origin subframes and unregistered windows on every channel", () => {
    const { loop } = fakeLoop()
    registerLiveIpc(loop, isMainWindow)
    const denied = [
      { sender: navigatedMain.webContents, senderFrame: navigatedMain.webContents.mainFrame },
      { ...trusted, senderFrame: { url: trusted.senderFrame.url } },
      { ...trusted, senderFrame: null },
      { sender: foreign.webContents, senderFrame: foreign.webContents.mainFrame },
    ]

    for (const event of denied) {
      for (const [channel, handle] of handlers) {
        expect(() => handle(event, false)).toThrow(`Untrusted IPC sender: ${channel}`)
      }
    }
    expect(loop.getOverlayContentProtection()).toBe(true)
  })

  test("keeps the overlay protection setting available to the main renderer", () => {
    registerLiveIpc(fakeLoop().loop, isMainWindow)
    const getProtection = handlers.get("get-live-overlay-content-protection")!
    const setProtection = handlers.get("set-live-overlay-content-protection")!
    expect(getProtection(trusted)).toBe(true)
    setProtection(trusted, "false")
    expect(getProtection(trusted)).toBe(true)
    setProtection(trusted, false)
    expect(getProtection(trusted)).toBe(false)
  })

  test("validates what a renderer sends", async () => {
    registerLiveIpc(fakeLoop().loop, isMainWindow)
    expect(() => handlers.get("request-live-permission")!(trusted, "camera")).toThrow()
    expect(handlers.get("set-live-hotkey")!(trusted, "nope", "Alt+M")).toEqual({ ok: false, reason: "invalid" })
    expect(() => handlers.get("rename-live-meeting")!(trusted, 1, "x")).toThrow()
    expect(await handlers.get("start-live-meeting")!(trusted, 5)).toEqual({ ok: true, meetingID: "untitled" })
  })
})
