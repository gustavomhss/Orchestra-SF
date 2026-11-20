import { createStore } from "solid-js/store"
import { Option, Schema } from "effect"
import { SfPlannerMonthlyApply } from "@orchestra/schema/sucafina/planner"
import { snapshotSfPlannerMonthlyDraft, type SfPlannerMonthlyDraftInput } from "@orchestra/client/sucafina/planner/monthly"
import { Route, Router } from "@solidjs/router"
import { render } from "solid-js/web"
import type { JSX } from "solid-js"
import type { ServerConnection } from "../../../../../../packages/app-shell/src/context/server-connection"
import { LanguageProvider } from "../../../../../../packages/app-shell/src/context/language"
import { PlatformProvider, type Platform } from "../../../../../../packages/app-shell/src/context/platform"
import { SfOwnerRuntime231 } from "../../../../../../packages/app-shell/src/orchestra/chapters/sucafina/host/owner-runtime231"

/** Browser capabilities only. Authentication and all business values come from
 * real same-origin producers through the original native owner and clients.
 */
const platform: Platform = {
  platform: "web",
  openExternal: (url) => { window.open(url, "_blank", "noopener,noreferrer") },
  restart: async () => { throw new Error("Unexpected fixture restart") },
  notify: async () => { throw new Error("Unexpected fixture notification") },
}

export function nativeBrowserConfig(): unknown {
  const element = document.getElementById("sf-native-fixture")
  if (!element?.textContent) throw new Error("SF_NATIVE_BROWSER_CONFIG_MISSING")
  return JSON.parse(element.textContent)
}

export function renderNativeBrowser(children: () => JSX.Element): () => void {
  const root = document.getElementById("sf-native-root")
  if (!root) throw new Error("SF_NATIVE_BROWSER_ROOT_MISSING")
  return render(() =>
    <PlatformProvider value={platform}>
      <LanguageProvider locale="en">
        <Router><Route path="/*all" component={children} /></Router>
      </LanguageProvider>
    </PlatformProvider>, root)
}

export function mountNativeBrowser(): () => void {
  const config = nativeBrowserConfig()
  if (!config || typeof config !== "object" || !("directory" in config) || typeof config.directory !== "string" || !config.directory)
    throw new Error("SF_NATIVE_BROWSER_DIRECTORY_MISSING")
  const directory = config.directory
  const server = { type: "http", http: { url: window.location.origin } } satisfies ServerConnection.Http
  return renderNativeBrowser(() => <SfOwnerRuntime231 server={server} directory={directory} />)
}

if (document.documentElement.dataset.sfFixtureMode === "owner") mountNativeBrowser()

/** Exercise the real browser store and the exact input decoded before HTTP. */
export function proveNativeMonthlyDraft(input: SfPlannerMonthlyDraftInput) {
  const strict = (input: unknown) => Schema.decodeUnknownOption(SfPlannerMonthlyApply.input, { onExcessProperty: "error" })({ action: "apply", input })
  const originalAccepted = Option.isSome(strict(input)), originalJson = JSON.stringify(input)
  const raw = snapshotSfPlannerMonthlyDraft(input)
  const [store] = createStore({ input })
  const candidate = { ...store.input, drafts: store.input.drafts.filter(() => true) }
  const snapshot = snapshotSfPlannerMonthlyDraft(candidate)
  const plain: SfPlannerMonthlyDraftInput = JSON.parse(originalJson)
  const extra = { ...plain, drafts: plain.drafts.map((row) => ({ ...row, unexpectedJsonField: true })) }
  const [extraStore] = createStore({ input: extra })
  return {
    browserProxy: store.input !== input && store.input.drafts[0] !== input.drafts[0],
    storeSymbols: Reflect.ownKeys(store.input.drafts[0]!).some((key) => typeof key === "symbol"),
    originalAccepted,
    strictProxyRejected: Option.isNone(strict(candidate)),
    snapshotAccepted: !!snapshot && Option.isSome(strict(snapshot)),
    sameJson: !!raw && !!snapshot && JSON.stringify(raw) === JSON.stringify(snapshot) && JSON.stringify(raw) === originalJson,
    extraJsonRejected: snapshotSfPlannerMonthlyDraft(extra) === undefined,
    extraProxyJsonRejected: snapshotSfPlannerMonthlyDraft(extraStore.input) === undefined,
  }
}
