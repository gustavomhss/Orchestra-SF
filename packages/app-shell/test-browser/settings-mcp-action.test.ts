import { expect, test } from "bun:test"
import { createComponent, createSignal } from "solid-js"
import { render } from "solid-js/web"
import { toggleMcp } from "../src/context/global-sync/mcp"
import type { McpStatus } from "../src/orchestra/chapters/mcp-model"
import { solidDom } from "./solid-dom"

const { SettingsMcpAction }: typeof import("../src/components/settings-v2/view/settings-mcp-action") =
  await import(solidDom("../src/components/settings-v2/view/settings-mcp-action", import.meta.dir))

test("Settings MCP renders and dispatches the action for the live connection state", async () => {
  const [status, setStatus] = createSignal<McpStatus["status"]>("needs_auth")
  const [busy, setBusy] = createSignal(false)
  const calls: string[] = []
  let pending = Promise.resolve()
  const mount = document.createElement("div")
  document.body.append(mount)
  const dispose = render(() => createComponent(SettingsMcpAction, {
    get status() { return status() },
    get busy() { return busy() },
    authenticateLabel: "Authenticate",
    retryLabel: "Try again",
    toggleLabel: "Enable fixture server",
    onAction: () => {
      pending = toggleMcp({
        status: status(),
        connect: async () => { calls.push("connect") },
        disconnect: async () => { calls.push("disconnect") },
        authenticate: async () => { calls.push("authenticate") },
        refresh: async () => { calls.push("refresh") },
      })
    },
  }), mount)
  const button = () => mount.querySelector("button")!
  try {
    expect(button().getAttribute("role")).toBeNull()
    expect(button().textContent).toBe("Authenticate")
    button().click()
    await pending

    setStatus("failed")
    expect(button().getAttribute("role")).toBeNull()
    expect(button().textContent).toBe("Try again")
    setBusy(true)
    expect(button().disabled).toBe(true)
    button().click()
    expect(calls).toEqual(["authenticate", "refresh"])
    setBusy(false)
    button().click()
    await pending

    setStatus("disabled")
    expect(button().getAttribute("role")).toBe("switch")
    expect(button().getAttribute("aria-checked")).toBe("false")
    button().click()
    await pending

    setStatus("connected")
    expect(button().getAttribute("aria-checked")).toBe("true")
    button().click()
    await pending

    setStatus("pending")
    expect(button().disabled).toBe(true)
    button().click()
    setStatus("needs_client_registration")
    expect(mount.querySelector("button")).toBeNull()
    expect(calls).toEqual(["authenticate", "refresh", "connect", "refresh", "connect", "refresh", "disconnect", "refresh"])
  } finally {
    dispose()
    mount.remove()
  }
})
