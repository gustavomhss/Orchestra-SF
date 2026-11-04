import { createMemo, createResource, type Accessor } from "solid-js"
import { useGlobal } from "@/context/global"
import { useLanguage } from "@/context/language"
import { useLayout } from "@/context/layout"
import { usePermission } from "@/context/permission"
import { ServerConnection } from "@/context/server"
import { useServerSDK } from "@/context/server-sdk"
import { useServerSync } from "@/context/server-sync"
import {
  monoDefault,
  monoFontFamily,
  monoInput,
  sansDefault,
  sansFontFamily,
  sansInput,
  terminalDefault,
  terminalFontFamily,
  terminalInput,
  useSettings,
} from "@/context/settings"
import { playSoundById, SOUND_OPTIONS } from "@/utils/sound"
import { showToast } from "@/utils/toast"
import { createSoundPreviewController, readShells, type ShellOption } from "./general-controller-behavior"

export { createShellOptions, createSoundPreviewController } from "./general-controller-behavior"
export type { ShellOption, ShellSelectOption } from "./general-controller-behavior"

export function createPermissionScopeController(sessionID: Accessor<string | undefined>) {
  const permission = usePermission()
  const serverSync = useServerSync()
  const layout = useLayout()
  const global = useGlobal()
  // Settings opened from the shell sit on the selected server. A session route names its own server, and that
  // is the store the page already resolved.
  const scope = () => {
    const id = sessionID()
    const route = layout.route()
    if (!id || route.type !== "session" || route.sessionId !== id || !route.server) return
    const connection = global.servers.list().find((item) => ServerConnection.key(item) === route.server)
    if (!connection) return
    return { session: global.ensureServerCtx(connection).sync.session, permission: permission.ensureServerState(route.server) }
  }
  const directory = createMemo(() => {
    const id = sessionID()
    if (!id) return undefined
    return (scope()?.session ?? serverSync().session).lineage.peek(id)?.session.directory
  })

  return {
    accepting: createMemo(() => {
      const id = sessionID()
      const dir = directory()
      if (!id || !dir) return false
      const found = scope()
      if (found) return found.permission.isAutoAccepting(id, dir)
      return permission.isAutoAccepting(id, dir)
    }),
    enabled: createMemo(() => !!directory()),
    set: (checked: boolean) => {
      const id = sessionID()
      const dir = directory()
      if (!id || !dir) return
      const found = scope()
      if (found) {
        if (checked) return found.permission.enableAutoAccept(id, dir)
        found.permission.disableAutoAccept(id, dir)
        return
      }
      if (checked) return permission.enableAutoAccept(id, dir)
      permission.disableAutoAccept(id, dir)
    },
  }
}

export function createShellSettingsController() {
  const language = useLanguage()
  const serverSdk = useServerSDK()
  const serverSync = useServerSync()
  const [shells, { refetch }] = createResource(
    async () => {
      const sdk = serverSdk()
      return readShells(await sdk.orchestra.config.shells())
    },
    { initialValue: [] as readonly ShellOption[] },
  )
  const current = createMemo(() => serverSync().data.config.shell ?? "")
  // Reading an errored resource throws into the app-wide boundary, so a failed read stays this row's state.
  const failed = () => shells.state === "errored"

  return {
    shells: () => (failed() ? [] : shells.latest),
    failed,
    retry: () => void refetch(),
    current,
    select: (value: string) => {
      if (value === current()) return
      const before = serverSync().data.config.shell
      serverSync().set("config", "shell", value)
      serverSync()
        .updateConfig({ shell: value })
        .catch((err: unknown) => {
          serverSync().set("config", "shell", before)
          showToast({
            title: language.t("common.requestFailed"),
            description: err instanceof Error ? err.message : String(err),
          })
        })
    },
  }
}

export function createAppearanceSettingsController() {
  const settings = useSettings()

  return {
    fonts: {
      ui: createMemo(() => ({
        value: sansInput(settings.appearance.uiFont()),
        family: sansFontFamily(settings.appearance.uiFont()),
        placeholder: sansDefault,
      })),
      code: createMemo(() => ({
        value: monoInput(settings.appearance.font()),
        family: monoFontFamily(settings.appearance.font()),
        placeholder: monoDefault,
      })),
      terminal: createMemo(() => ({
        value: terminalInput(settings.appearance.terminalFont()),
        family: terminalFontFamily(settings.appearance.terminalFont()),
        placeholder: terminalDefault,
      })),
      setUI: (value: string) => settings.appearance.setUIFont(value),
      setCode: (value: string) => settings.appearance.setFont(value),
      setTerminal: (value: string) => settings.appearance.setTerminalFont(value),
    },
  }
}

const noneSound = { id: "none", label: "sound.option.none" } as const
export const soundOptions = [noneSound, ...SOUND_OPTIONS]
export type SoundSelectOption = (typeof soundOptions)[number]

export function createSoundSettingsController() {
  const settings = useSettings()
  const preview = createSoundPreviewController(playSoundById)
  const channel = (
    enabled: Accessor<boolean>,
    current: Accessor<string>,
    setEnabled: (value: boolean) => void,
    set: (id: string) => void,
  ) => ({
    current: createMemo(() =>
      enabled() ? (soundOptions.find((option) => option.id === current()) ?? noneSound) : noneSound,
    ),
    highlight: (option: SoundSelectOption | undefined) => {
      if (!option) return
      preview.play(option.id === "none" ? undefined : option.id)
    },
    select: (option: SoundSelectOption | null) => {
      if (!option) return
      if (option.id === "none") {
        setEnabled(false)
        preview.stop()
        return
      }
      setEnabled(true)
      set(option.id)
      preview.play(option.id)
    },
  })

  return {
    agent: channel(
      settings.sounds.agentEnabled,
      settings.sounds.agent,
      (value) => settings.sounds.setAgentEnabled(value),
      (id) => settings.sounds.setAgent(id),
    ),
    permissions: channel(
      settings.sounds.permissionsEnabled,
      settings.sounds.permissions,
      (value) => settings.sounds.setPermissionsEnabled(value),
      (id) => settings.sounds.setPermissions(id),
    ),
    errors: channel(
      settings.sounds.errorsEnabled,
      settings.sounds.errors,
      (value) => settings.sounds.setErrorsEnabled(value),
      (id) => settings.sounds.setErrors(id),
    ),
  }
}

export type PermissionScopeController = ReturnType<typeof createPermissionScopeController>
export type ShellSettingsController = ReturnType<typeof createShellSettingsController>
export type AppearanceSettingsController = ReturnType<typeof createAppearanceSettingsController>
export type SoundSettingsController = ReturnType<typeof createSoundSettingsController>
