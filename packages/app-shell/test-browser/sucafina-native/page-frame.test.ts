import type { JSX } from "solid-js"
import { expect, test } from "bun:test"
import path from "node:path"

// The only authorized execution lane is 120 / GitHub Actions. This file is
// source-only until 114 admits F03 and wires the frozen F01 route contracts.
if (process.env.SF_F03_DOM !== "1") {
  test("F03 frame and state DOM suite (hosted by mission120)", async () => {
    const proc = Bun.spawn(
      [Bun.which("bun")!, "--conditions=browser", "test", "--preload", "./happydom.ts", import.meta.path],
      {
        cwd: path.resolve(import.meta.dir, "../.."),
        env: { ...process.env, SF_F03_DOM: "1" },
        stdout: "pipe",
        stderr: "pipe",
        timeout: 180000,
        killSignal: "SIGKILL",
      },
    )
    const [stdout, stderr, exit] = await Promise.all([
      new Response(proc.stdout).text(),
      new Response(proc.stderr).text(),
      proc.exited,
    ])
    expect(exit, `${stdout}\n${stderr}`).toBe(0)
  }, 240000)
} else {
  const { createComponent, render } = await import("../lean-dom.test-helper")
  const { solidDom } = await import("../solid-dom")
  const { withBrowserPlatform } = await import("./platform-fixture")
  const { usePlatform }: typeof import("@/context/platform") = await import(
    solidDom("@/context/platform", import.meta.dir)
  )
  const { loadLocaleDict, LanguageProvider }: typeof import("@/context/language") = await import(
    solidDom("@/context/language", import.meta.dir)
  )
  const frame: typeof import("@/orchestra/chapters/sucafina/shared/frame") = await import(
    solidDom("@/orchestra/chapters/sucafina/shared/frame", import.meta.dir)
  )
  const states: typeof import("@/orchestra/chapters/sucafina/shared/states") = await import(
    solidDom("@/orchestra/chapters/sucafina/shared/states", import.meta.dir)
  )
  type Key = import("@/orchestra/chapters/sucafina/shared/frame").SfCopyKey
  const key = (value: string) => value as Key
  const message = (value: string) => ({ key: key(value) })
  const emptyCoverage = {
    state: "partial" as const,
    summary: message("sf.common.partial"),
    reasons: [message("sf.common.stale")],
    knownCount: 0,
    expectedCount: null,
  }

  function mount(component: () => JSX.Element, locale: "en" | "br" = "en") {
    const host = document.createElement("div")
    document.body.append(host)
    const dispose = render(
      () => withBrowserPlatform(() => createComponent(LanguageProvider, {
        locale,
        get children() { return component() },
      })),
      host,
    )
    return { host, close: () => { dispose(); host.remove() } }
  }

  test("F03 fixture supplies the actual Orchestra Platform context before LanguageProvider", () => {
    const screen = mount(() => document.createTextNode(usePlatform().platform))
    try {
      expect(screen.host.textContent).toBe("web")
    } finally { screen.close() }
  })

  test("five viewport classes map to content width, never window or guessed device", () => {
    for (const w of [320, 767, 768, 800, 1024, 1280, 1440]) {
      expect(frame.resolveSfLayoutMode(w, "reading")).toBe("single")
      expect(frame.resolveSfLayoutMode(w, "work")).toBe("single")
    }
    expect(frame.resolveSfLayoutMode(800, "split")).toBe("single")
    expect(frame.resolveSfLayoutMode(801, "split")).toBe("split")
    expect(frame.resolveSfLayoutMode(1121, "comparison")).toBe("split")
    expect(frame.resolveSfLayoutMode(1122, "comparison")).toBe("split-context")
    expect(frame.resolveSfLayoutMode(320, "comparison")).toBe("single")
    expect(frame.resolveSfLayoutMode(NaN, "comparison")).toBe("single")
  })

  test("denied and session-expired never expose stale private children or partial counts", () => {
    for (const state of ["denied", "session-expired"] as const) {
      const events: string[] = []
      const screen = mount(() => createComponent(states.SfStatePanel, {
        state,
        messageKey: key(state === "denied" ? "sf.common.noAccess" : "sf.common.loginAgain"),
        coverage: emptyCoverage,
        onRetryRead: () => events.push("retry"),
        onLogin: () => events.push("login"),
        onBack: () => events.push("back"),
        children: document.createTextNode("CONFIDENTIAL_PREVIOUS_OWNER"),
      }))
      try {
        expect(screen.host.textContent).not.toContain("CONFIDENTIAL_PREVIOUS_OWNER")
        expect(screen.host.textContent).not.toContain("Partial coverage")
        expect(screen.host.querySelector("[role=alert]")).not.toBeNull()
        expect(screen.host.querySelectorAll("button").length).toBe(1)
        screen.host.querySelector("button")!.click()
        expect(events).toEqual([state === "denied" ? "back" : "login"])
      } finally { screen.close() }
    }
  })

  test("loading, filtered empty, partial and outcome unknown remain distinct without fake zero", () => {
    for (const entry of [
      { state: "loading", key: "sf.common.loading", canShow: false },
      { state: "filtered-empty", key: "sf.common.filterEmpty", canShow: true },
      { state: "partial", key: "sf.common.partial", canShow: true },
      { state: "outcome-unknown", key: "sf.common.operationUnknown", canShow: false },
    ] as const) {
      let reads = 0
      const screen = mount(() => createComponent(states.SfStatePanel, {
        state: entry.state,
        messageKey: key(entry.key),
        coverage: entry.state === "partial" ? emptyCoverage : undefined,
        onRetryRead: () => { reads += 1 },
        children: document.createTextNode("AUTHORIZED_PRESENTATION"),
      }))
      try {
        expect(screen.host.getAttribute("data-sf-state")).toBeNull()
        expect(screen.host.querySelector("[data-sf-state]")?.getAttribute("data-sf-state")).toBe(entry.state)
        expect(screen.host.textContent?.includes("AUTHORIZED_PRESENTATION")).toBe(entry.canShow)
        if (entry.state === "outcome-unknown") {
          expect(screen.host.textContent).toContain("response was lost")
          screen.host.querySelector("button")!.click()
          expect(reads).toBe(1)
        }
      } finally { screen.close() }
    }
  })

  test("context requests only available unlocked option; no implicit change", () => {
    const changes: string[] = []
    const screen = mount(() => createComponent(frame.SfContextBar, {
      selection: [{ control: "year", optionId: "this" }],
      catalog: [
        { id: "this", control: "year", value: 2026, label: { kind: "data", text: "2026" }, available: true },
        { id: "last", control: "year", value: 2025, label: { kind: "data", text: "2025" }, available: true },
        { id: "secret", control: "year", value: 2024, label: { kind: "data", text: "2024" }, available: false },
      ],
      lockedReasons: [],
      state: "ready",
      onRequestChange: ({ optionId }) => changes.push(optionId),
    }))
    try {
      expect(changes).toEqual([])
      const select = screen.host.querySelector("select")!
      expect(select.value).toBe("this")
      expect(select.querySelector<HTMLOptionElement>('option[value="secret"]')?.disabled).toBe(true)
      select.value = "last"
      select.dispatchEvent(new Event("change", { bubbles: true }))
      expect(changes).toEqual(["last"])
      // A selection change is a request; without owner acceptance the current
      // control must keep displaying the authorized option.
      expect(select.value).toBe("this")
    } finally { screen.close() }
  })

  test("denied and session-expired charts never expose previous owner context, SVG or table", () => {
    for (const state of ["denied", "session-expired"] as const) {
      const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg")
      const svgTitle = document.createElementNS("http://www.w3.org/2000/svg", "title")
      svgTitle.textContent = "PRIVATE_CHART"
      svg.append(svgTitle)
      const screen = mount(() => createComponent(frame.SfChartFrame, {
        titleKey: key("sf.common.currentSource"),
        questionKey: key("sf.common.partial"),
        context: [{ label: message("sf.common.source"), value: { kind: "data", text: "PRIVATE_CONTEXT" } }],
        coverage: emptyCoverage,
        series: [],
        table: { caption: message("sf.common.currentSource"), columns: [], rows: [] },
        selection: null,
        state,
        onSelect: () => { throw new Error("unauthorized select") },
        onOpenSource: () => { throw new Error("unauthorized source") },
        children: svg,
      }))
      try {
        expect(screen.host.textContent).not.toContain("PRIVATE_CONTEXT")
        expect(screen.host.textContent).not.toContain("PRIVATE_CHART")
        expect(screen.host.textContent).not.toContain("Partial coverage")
        expect(screen.host.querySelector(".sf-chart-header")).toBeNull()
        expect(screen.host.querySelector(".sf-chart-context")).toBeNull()
        expect(screen.host.querySelector("svg")).toBeNull()
        expect(screen.host.querySelector(".sf-chart-table")).toBeNull()
        expect(screen.host.querySelector(`[data-sf-state="${state}"]`)).not.toBeNull()
      } finally { screen.close() }
    }
  })

  test("run unadmitted is not forged as queued/executed and offers only admitted actions", () => {
    const screen = mount(() => createComponent(states.SfRunState, {
      identity: { kind: "unadmitted" },
      state: "ready",
      actions: [],
      onOpen: () => { throw new Error("not admitted") },
    }))
    try {
      expect(screen.host.querySelector('[data-sf-run-identity="unadmitted"]')).not.toBeNull()
      expect(screen.host.querySelector("progress")).toBeNull()
      expect(screen.host.querySelector("button")).toBeNull()
    } finally { screen.close() }
  })

  test("chart preserves known zero, labels unknown as unavailable, and keeps a real table", () => {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg")
    svg.setAttribute("viewBox", "0 0 300 100")
    const screen = mount(() => createComponent(frame.SfChartFrame, {
      titleKey: key("sf.common.currentSource"),
      questionKey: key("sf.common.currentSource"),
      context: [],
      coverage: {
        state: "complete",
        summary: message("sf.common.currentSource"),
        reasons: [],
        knownCount: 1,
        expectedCount: null,
      },
      series: [],
      table: {
        caption: message("sf.common.currentSource"),
        columns: [{ id: "value", label: message("sf.common.currentSource") }],
        rows: [
          { id: "zero", cells: { value: { kind: "number", value: 0, unit: { kind: "percent" }, fractionDigits: 0 } } },
          { id: "unknown", cells: { value: { kind: "unavailable", reason: message("sf.common.unavailable") } } },
        ],
      },
      selection: null,
      state: "ready",
      onSelect: () => {},
      onOpenSource: () => {},
      children: svg,
    }))
    try {
      expect(screen.host.querySelector(".sf-chart-visual svg")).not.toBeNull()
      expect(screen.host.querySelectorAll(".sf-chart-table tbody tr")).toHaveLength(2)
      expect(screen.host.querySelector('[data-sf-row="zero"] .sf-numeric')?.textContent).toContain("0")
      expect(screen.host.querySelector('[data-sf-row="unknown"] .sf-missing')?.textContent)
        .toContain("Currently unavailable")
      expect(screen.host.querySelector('[data-sf-row="unknown"] .sf-numeric')).toBeNull()
    } finally { screen.close() }
  })

  test("pt-BR common messages derive from the frozen dictionary, not new local copy", async () => {
    await loadLocaleDict("br")
    const screen = mount(() => createComponent(states.SfStatePanel, {
      state: "filtered-empty",
      messageKey: key("sf.common.filterEmpty"),
    }), "br")
    try {
      expect(screen.host.textContent).toContain("Nenhum resultado para estes filtros.")
    } finally { screen.close() }
  })
}
