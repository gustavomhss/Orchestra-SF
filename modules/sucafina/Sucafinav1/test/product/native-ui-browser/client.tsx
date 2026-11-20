import { Route, Router } from "@solidjs/router"
import { render } from "solid-js/web"
import type { JSX } from "solid-js"
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
  const server = { type: "http" as const, http: { url: window.location.origin } }
  return renderNativeBrowser(() => <SfOwnerRuntime231 server={server} directory={directory} />)
}

if (document.documentElement.dataset.sfFixtureMode === "owner") mountNativeBrowser()
