import { expect, mock, test } from "bun:test"
import path from "node:path"
import type { Config } from "@/v2-wire"
import type { DirectorySDK } from "@/context/sdk"
import type { Locale } from "@/context/language"


async function child(args: string[], env = process.env) {
  const proc = Bun.spawn([Bun.which("bun")!, ...args], {
    cwd: path.resolve(import.meta.dir, ".."), env, stdout: "pipe", stderr: "pipe", timeout: 180000, killSignal: "SIGKILL",
  })
  const [out, err, code] = await Promise.all([new Response(proc.stdout).text(), new Response(proc.stderr).text(), proc.exited])
  if (code !== 0) throw new Error(`${args.join(" ")} exited ${code}\n${out}\n${err}`)
  console.log(out + err)
}

// The fixtures below replace shared modules for the rest of a `bun test` process, so they run in a child process of
// their own, like the other Lean DOM lanes.
if (process.env.LEAN_SETTINGS_DOM !== "1") {
  test("Settings surfaces stay free of Lean controls in an isolated browser lane", async () => {
    await child(["--conditions=browser", "test", "--preload", "./happydom.ts", import.meta.path], {
      ...process.env, LEAN_SETTINGS_DOM: "1",
    })
  }, 240000)
} else {
  const { createComponent, createStore, render } = await import("./lean-dom.test-helper")
  const { Suspense } = await import("solid-js")
  const { solidDom } = await import("./solid-dom")
  type SavedApi = DirectorySDK["api"]["permission"]["saved"]
  type SavedRows = Awaited<ReturnType<SavedApi["list"]>>
  const unavailableList = (): ReturnType<SavedApi["list"]> => Promise.reject(new Error("Unexpected saved permission read"))
  const savedIO = {
    list: mock(unavailableList),
    remove: mock(async (_input: Parameters<SavedApi["remove"]>[0]) => undefined),
  } satisfies SavedApi
  const [state, setState] = createStore<{ ready: boolean; error: unknown; config: Config }>({
    ready: false, error: undefined,
    config: { tool_output: { max_lines: 42, max_bytes: 900, lean: { enabled: false } } },
  })
  const calls: Config[] = []
  const sync = {
    data: state,
    get ready() { return state.ready },
    get error() { return state.error },
    session: { lineage: { peek: () => undefined } },
    async updateConfig(config: Config) {
      calls.push(config)
    },
  }
  // External context fixtures only, spread over the real module where it loads under Bun; render the real Settings
  // sections and provider. Fixtures replace the solidDom() copies (./solid-dom) those modules import.
  const sdk: typeof import("@/context/server-sdk") = await import(solidDom("@/context/server-sdk", import.meta.dir))
  const directorySDK: typeof import("@/context/sdk") = await import(solidDom("@/context/sdk", import.meta.dir))
  const serverSync: typeof import("@/context/server-sync") = await import(solidDom("@/context/server-sync", import.meta.dir))
  const permission: typeof import("@/context/permission") = await import(solidDom("@/context/permission", import.meta.dir))
  const theme: typeof import("@orchestra/ui/theme/context") = await import(
    solidDom("@orchestra/ui/theme/context", import.meta.dir)
  )
  mock.module(solidDom("@/context/server-sync", import.meta.dir), () => ({ ...serverSync, useServerSync: () => () => sync }))
  mock.module(solidDom("@/context/sdk", import.meta.dir), () => ({ ...directorySDK,
    useSDK: () => () => ({ api: { permission: { saved: savedIO } } }),
  }))
  mock.module(solidDom("@/context/server-sdk", import.meta.dir), () => ({ ...sdk,
    useServerReady: () => () => state.ready,
    useServerSDK: () => () => ({ ready: Promise.resolve(), client: { pty: { shells: async () => ({ data: [] }) } } }),
  }))
  mock.module(solidDom("@/context/permission", import.meta.dir), () => ({ ...permission,
    usePermission: () => ({ isAutoAcceptingDirectory: () => false, isAutoAccepting: () => false }),
  }))
  // The real palette context cannot load here: it reads its stylesheets through Vite's import.meta.glob. This lane's own
  // process confines the partial fixture.
  mock.module(solidDom("@/orchestra/palette/context", import.meta.dir), () => ({
    useOrchestraPalette: () => ({ palettes: [], id: () => "dark" }),
  }))
  mock.module(solidDom("@orchestra/ui/theme/context", import.meta.dir), () => ({ ...theme,
    useTheme: () => ({ colorScheme: () => "system", setColorScheme() {} }),
  }))
  const { SettingsGeneralV2 }: typeof import("@/components/settings-v2/general") = await import(
    solidDom("@/components/settings-v2/general", import.meta.dir)
  )
  const { SavedPermissionsSection }: typeof import("@/components/settings-v2/view/saved-permissions-section") = await import(
    solidDom("@/components/settings-v2/view/saved-permissions-section", import.meta.dir)
  )
  const { PlatformProvider }: typeof import("@/context/platform") = await import(solidDom("@/context/platform", import.meta.dir))
  const { LanguageProvider, useLanguage, loadLocaleDict }: typeof import("@/context/language") = await import(
    solidDom("@/context/language", import.meta.dir)
  )
  const { SettingsProvider }: typeof import("@/context/settings") = await import(solidDom("@/context/settings", import.meta.dir))
  const { DialogProvider }: typeof import("@orchestra/ui/context/dialog") = await import(
    solidDom("@orchestra/ui/context/dialog", import.meta.dir)
  )
  const { dict }: typeof import("@/i18n/en") = await import(solidDom("@/i18n/en", import.meta.dir))
  const { SETTINGS_COPY, SETTINGS_COPY_BR }: typeof import("@/i18n/orchestra-chapters/settings") = await import(
    solidDom("@/i18n/orchestra-chapters/settings", import.meta.dir)
  )

  // The first Lean UI, a global toggle in Settings, was rejected (2026-10-10) and its code removed: Lean lives on its
  // profile screen, with per-profile KPIs, covered items, bytes and tokens saved and per-item switches. That screen's live
  // controls are covered by lean-profile-view (pending, failure, unsupported and paused states), lean-controller
  // (unsupported blocks writes, failures keep data, pending lanes confirm only HTTP snapshots), lean-chapter-route and
  // lean-native-product (persisted disable through the real backend). An accidental mount in the Settings General section
  // must fail here. The rejected row's English copy
  // is spelled out because its locale keys were deleted with it.
  const lean = [
    "Lean tool output", "Reduce supported tool output using the server's Lean setting.",
    "Lean setting unavailable · read-only until a supported v1 server is ready.", "Saving Lean setting…",
    "Could not save the Lean setting",
  ]
  const mount = (section: () => ReturnType<typeof createComponent>, locale: Locale = "en") => {
    const host = document.createElement("div")
    document.body.appendChild(host)
    const dispose = render(() => createComponent(PlatformProvider, {
      value: { platform: "web", openExternal() {}, async restart() {}, async notify() {} },
      get children() { return createComponent(LanguageProvider, {
        locale,
        get children() {
          useLanguage().setLocale(locale)
          return createComponent(SettingsProvider, { get children() {
            return createComponent(DialogProvider, { get children() { return section() } })
          } })
        },
      }) },
    }), host)
    return { host, close: () => { dispose(); host.remove() } }
  }
  const expectNoLean = async (host: HTMLElement) => {
    for (const capability of [
      { ready: false, error: undefined }, { ready: true, error: undefined },
      { ready: true, error: new Error("offline") },
    ]) {
      setState(capability)
      await Bun.sleep(20)
      // Positive control: the real General section rendered its rows, so the absence below is not an empty mount.
      const actions = [...host.querySelectorAll("*")].flatMap((node) => node.getAttribute("data-action") ?? [])
      expect(actions).toContain("settings-language")
      expect(actions.filter((action) => action.startsWith("settings-lean"))).toEqual([])
      const text = host.textContent ?? ""
      expect(text).toContain(dict["settings.general.row.language.title"])
      expect(lean.filter((value) => text.includes(value))).toEqual([])
    }
    expect(calls).toHaveLength(0)
  }

  test("active SettingsGeneralV2 renders no Lean controls, whether the Lean capability is unavailable, editable or failed", async () => {
    const screen = mount(() => createComponent(SettingsGeneralV2, {}))
    try { await expectNoLean(screen.host) } finally { screen.close() }
  })

  // Flush promise continuations through the next task, not an elapsed-time wait for correctness.
  const settle = () => new Promise<void>((resolve) => setImmediate(resolve))
  const savedSection = () => createComponent(Suspense, {
    fallback: "Page suspended",
    get children() {
      const sentinel = document.createElement("p")
      sentinel.setAttribute("data-settings-sentinel", "")
      sentinel.textContent = "Surrounding settings"
      return [sentinel, createComponent(SavedPermissionsSection, {})]
    },
  })
  const locales: { locale: Locale; copy: typeof SETTINGS_COPY; retry: string; labels: string[] }[] = [
    {
      locale: "en", copy: SETTINGS_COPY, retry: "Retry",
      labels: ["Remove saved permission: Read — /repo/one", "Remove saved permission: Read — /repo/two"],
    },
    {
      locale: "br", copy: SETTINGS_COPY_BR, retry: "Tentar de novo",
      labels: ["Remover permissão salva: Ler — /repo/one", "Remover permissão salva: Ler — /repo/two"],
    },
  ]
  for (const fixture of locales) {
    test(`saved permissions in ${fixture.locale} announce reads, retry failures and identify the removed rule`, async () => {
      await loadLocaleDict(fixture.locale)
      const initial = Promise.withResolvers<SavedRows>()
      const retry = Promise.withResolvers<SavedRows>()
      const refresh = Promise.withResolvers<SavedRows>()
      const rows: SavedRows = [
        { id: "saved-one", projectID: "project", action: "read", resource: "/repo/one" },
        { id: "saved-two", projectID: "project", action: "read", resource: "/repo/two" },
      ]
      savedIO.list.mockReset()
      savedIO.list.mockImplementation(unavailableList)
      savedIO.list.mockImplementationOnce(() => initial.promise)
        .mockImplementationOnce(() => retry.promise)
        .mockImplementationOnce(() => refresh.promise)
      savedIO.remove.mockClear()
      const screen = mount(savedSection, fixture.locale)
      try {
        await settle()
        expect(savedIO.list).toHaveBeenCalledTimes(1)
        expect(screen.host.querySelector('[role="status"]')?.textContent)
          .toBe(fixture.copy["orchestra.settings.savedPermissions.loading"])
        expect(screen.host.querySelector("[data-settings-sentinel]")?.textContent).toBe("Surrounding settings")
        expect(screen.host.textContent).not.toContain("Page suspended")

        initial.reject(new Error("offline"))
        await settle()
        const alert = screen.host.querySelector('[role="alert"]')
        expect(alert?.querySelector("p")?.textContent).toBe(fixture.copy["orchestra.settings.savedPermissions.loadFailed"])
        const retryButton = alert?.querySelector("button")
        expect(retryButton?.textContent).toBe(fixture.retry)
        expect(retryButton?.type).toBe("button")
        retryButton!.click()
        await settle()
        expect(savedIO.list).toHaveBeenCalledTimes(2)
        expect(savedIO.remove).not.toHaveBeenCalled()
        expect(screen.host.querySelector('[role="alert"] p')?.textContent)
          .toBe(fixture.copy["orchestra.settings.savedPermissions.loadFailed"])
        expect(screen.host.querySelector("[data-settings-sentinel]")?.textContent).toBe("Surrounding settings")
        expect(screen.host.textContent).not.toContain("Page suspended")

        retry.resolve(rows)
        await settle()
        const buttons = [...screen.host.querySelectorAll<HTMLButtonElement>("[data-saved-permission] button")]
        expect(buttons.map((button) => button.getAttribute("aria-label"))).toEqual(fixture.labels)
        expect(buttons.map((button) => button.textContent)).toEqual([
          fixture.copy["orchestra.settings.savedPermissions.remove"], fixture.copy["orchestra.settings.savedPermissions.remove"],
        ])
        expect(screen.host.querySelector('[role="alert"]')).toBeNull()
        buttons[0]!.click()
        await settle()
        expect(savedIO.remove).toHaveBeenCalledTimes(1)
        expect(savedIO.remove).toHaveBeenCalledWith({ id: "saved-one" })
        expect(savedIO.list).toHaveBeenCalledTimes(3)
        // A pending refetch keeps the settled rows, rather than suspending the settings page.
        expect(screen.host.querySelectorAll("[data-saved-permission]")).toHaveLength(2)
        refresh.resolve([rows[1]!])
        await settle()
        expect(screen.host.querySelectorAll("[data-saved-permission]")).toHaveLength(1)
        expect(screen.host.querySelector('[data-saved-permission="saved-one"]')).toBeNull()
        expect(screen.host.querySelector('[data-saved-permission="saved-two"] button')?.getAttribute("aria-label"))
          .toBe(fixture.labels[1])
      } finally { screen.close() }
    })

    test(`saved permissions in ${fixture.locale} announce an empty list`, async () => {
      await loadLocaleDict(fixture.locale)
      savedIO.list.mockReset()
      savedIO.list.mockImplementation(unavailableList)
      savedIO.list.mockImplementationOnce(async () => [])
      savedIO.remove.mockClear()
      const screen = mount(savedSection, fixture.locale)
      try {
        await settle()
        expect(savedIO.list).toHaveBeenCalledTimes(1)
        expect(screen.host.querySelector('[role="status"]')?.textContent)
          .toBe(fixture.copy["orchestra.settings.savedPermissions.empty"])
        expect(screen.host.querySelectorAll("[data-saved-permission]")).toHaveLength(0)
        expect(savedIO.remove).not.toHaveBeenCalled()
      } finally { screen.close() }
    })
  }
}
