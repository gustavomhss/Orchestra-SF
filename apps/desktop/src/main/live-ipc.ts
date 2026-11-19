import { app, BrowserWindow, ipcMain } from "electron"
import type { IpcMainInvokeEvent } from "electron"
import type { LiveHotkeyAction, LiveSource } from "@orchestra/app/live"

import { hasTranscriptionKey, saveTranscriptionKey } from "./live-key"
import type { LiveLoop } from "./live-loop"
import { readiness, requestPermission } from "./live-readiness"
import { isRendererOrigin, rendererDevUrl } from "./renderer-origin"

// Every IPC handler of the live seat. Run state and input levels are broadcast to all windows, so each renderer
// window shows the same meeting. Arguments come from a renderer, so each handler checks its own.

const SOURCES: LiveSource[] = ["microphone", "system-audio"]
const ACTIONS: LiveHotkeyAction[] = ["start-stop", "ask", "toggle-overlay", "toggle-captions"]

const trusted = (event: IpcMainInvokeEvent) =>
  isRendererOrigin(event.senderFrame?.url, rendererDevUrl(app.isPackaged, process.env.ELECTRON_RENDERER_URL))

const handle = (channel: string, listener: Parameters<typeof ipcMain.handle>[1]) =>
  ipcMain.handle(channel, (event, ...args) => {
    if (!trusted(event)) throw new Error(`Untrusted IPC sender: ${channel}`)
    return listener(event, ...args)
  })

export function registerLiveIpc(loop: LiveLoop) {
  const broadcast = (channel: string, payload: unknown) =>
    BrowserWindow.getAllWindows().forEach((win) => {
      if (!win.isDestroyed()) win.webContents.send(channel, payload)
    })

  loop.onRunState((state) => {
    broadcast("live-run-state-changed", state)
    // The captions key is global, so it is held only while a meeting runs.
    loop.settings.bind("toggle-captions", state.running ? loop.toggleCaptions : undefined)
  })
  loop.onLevels((levels) => broadcast("live-levels", levels))
  loop.settings.bind("start-stop", () => void (loop.running() ? loop.stop() : loop.start()))

  handle("start-live-meeting", (_event: IpcMainInvokeEvent, title: unknown) =>
    loop.start(typeof title === "string" ? title : undefined),
  )
  handle("stop-live-meeting", () => loop.stop())
  handle("get-live-meeting-running", () => loop.running())
  // The key itself never goes back to a renderer; it can only be replaced or cleared.
  handle("has-live-transcription-key", () => hasTranscriptionKey())
  handle("set-live-transcription-key", (_event: IpcMainInvokeEvent, key: unknown) => {
    if (typeof key === "string") saveTranscriptionKey(key)
  })
  handle("get-live-readiness", () => readiness(loop.settings.get().answerModel))
  handle("request-live-permission", (_event: IpcMainInvokeEvent, source: unknown) => {
    if (!SOURCES.includes(source as LiveSource)) throw new Error("Unknown live source")
    return requestPermission(source as LiveSource)
  })
  handle("get-live-run-state", () => loop.runState())
  handle("rename-live-meeting", (_event: IpcMainInvokeEvent, meetingID: unknown, title: unknown) => {
    if (typeof meetingID !== "string" || typeof title !== "string") throw new Error("Invalid rename")
    return loop.rename(meetingID, title)
  })
  handle("get-live-settings", () => loop.settings.get())
  handle("set-live-settings", (_event: IpcMainInvokeEvent, patch: unknown) => loop.settings.set(patch))
  handle("get-live-hotkeys", () => loop.settings.hotkeys())
  handle("set-live-hotkey", (_event: IpcMainInvokeEvent, action: unknown, accelerator: unknown) => {
    if (!ACTIONS.includes(action as LiveHotkeyAction) || typeof accelerator !== "string")
      return { ok: false, reason: "invalid" }
    return loop.settings.setHotkey(action as LiveHotkeyAction, accelerator)
  })
  handle("reset-live-hotkeys", () => loop.settings.resetHotkeys())
}
