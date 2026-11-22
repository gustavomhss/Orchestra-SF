/** @jsxImportSource @opentui/solid */
import { expect, test } from "bun:test"
import { createSlot, createSolidSlotRegistry, testRender, useRenderer } from "@opentui/solid"
import { onCleanup, onMount } from "solid-js"
import { createPluginRuntime } from "../../src/plugin/runtime"
import { createTuiPluginApi } from "../fixture/tui-plugin"

type Slots = {
  prompt: {}
}

test("replace slot mounts plugin content once", async () => {
  let mounts = 0

  const Probe = () => {
    onMount(() => {
      mounts += 1
    })
    return <box />
  }

  const App = () => {
    const registry = createSolidSlotRegistry<Slots>(useRenderer(), {})
    const Slot = createSlot(registry)
    registry.register({ id: "plugin", slots: { prompt: () => <Probe /> } })

    return (
      <Slot name="prompt" mode="replace">
        <box />
      </Slot>
    )
  }

  const app = await testRender(() => <App />)
  try {
    expect(mounts).toBe(1)
  } finally {
    app.renderer.destroy()
  }
})

test("runtime without a plugin host renders and mounts slot fallbacks", async () => {
  const runtime = createPluginRuntime()
  let mounts = 0

  function Fallback() {
    onMount(() => {
      mounts += 1
    })
    return <text>Default session prompt</text>
  }

  const app = await testRender(
    () => (
      <box flexDirection="column">
        <runtime.Slot name="session_prompt" mode="replace" session_id="ses_test">
          <Fallback />
        </runtime.Slot>
        <runtime.Slot name="sidebar_title" mode="single_winner" session_id="ses_test" title="Session title">
          <text>Session title</text>
        </runtime.Slot>
        <runtime.Slot name="app_bottom" />
      </box>
    ),
    { width: 40, height: 4 },
  )

  try {
    await app.renderOnce()
    expect(app.captureCharFrame()).toContain("Default session prompt")
    expect(app.captureCharFrame()).toContain("Session title")
    expect(mounts).toBe(1)
  } finally {
    app.renderer.destroy()
  }
})

test("configured runtime preserves replacement and restores fallback on unregister", async () => {
  const runtime = createPluginRuntime()
  let unregister!: () => void
  let dispose!: () => void
  let mounts = 0
  let cleanups = 0

  function Fallback() {
    onMount(() => {
      mounts += 1
    })
    onCleanup(() => {
      cleanups += 1
    })
    return <text>Default session prompt</text>
  }

  function App() {
    const host = runtime.setupSlots({ ...createTuiPluginApi(), renderer: useRenderer() })
    dispose = host.dispose
    unregister = host.register({
      id: "replacement",
      slots: { session_prompt: () => <text>Plugin session prompt</text> },
    })
    onCleanup(host.dispose)

    return (
      <runtime.Slot name="session_prompt" mode="replace" session_id="ses_test">
        <Fallback />
      </runtime.Slot>
    )
  }

  const app = await testRender(() => <App />, { width: 40, height: 4 })
  try {
    await app.renderOnce()
    expect(app.captureCharFrame()).toContain("Plugin session prompt")
    expect(app.captureCharFrame()).not.toContain("Default session prompt")

    unregister()
    await app.renderOnce()
    expect(app.captureCharFrame()).toContain("Default session prompt")
    expect(app.captureCharFrame()).not.toContain("Plugin session prompt")

    const mounted = mounts
    expect(mounted).toBeGreaterThan(0)
    app.renderer.destroy()
    dispose()
    runtime.clear()
    await Promise.resolve()
    expect(mounts).toBe(mounted)
    expect(cleanups).toBe(mounted)
  } finally {
    if (!app.renderer.isDestroyed) app.renderer.destroy()
  }
})

test.each(["dispose", "clear"] as const)("runtime renders fallback when mounted after %s", async (action) => {
  const runtime = createPluginRuntime()

  function App() {
    const host = runtime.setupSlots({ ...createTuiPluginApi(), renderer: useRenderer() })
    const unregister = host.register({
      id: "replacement",
      slots: { session_prompt: () => <text>Removed plugin prompt</text> },
    })
    onCleanup(unregister)
    onCleanup(host.dispose)
    if (action === "dispose") host.dispose()
    if (action === "clear") runtime.clear()

    return (
      <runtime.Slot name="session_prompt" mode="replace" session_id="ses_test">
        <text>Default session prompt</text>
      </runtime.Slot>
    )
  }

  const app = await testRender(() => <App />, { width: 40, height: 4 })
  try {
    await app.renderOnce()
    expect(app.captureCharFrame()).toContain("Default session prompt")
    expect(app.captureCharFrame()).not.toContain("Removed plugin prompt")
  } finally {
    app.renderer.destroy()
  }
})
