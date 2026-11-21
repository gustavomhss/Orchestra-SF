import { render } from "solid-js/web"
import { Route, Router } from "@solidjs/router"
import { PlatformProvider, type Platform } from "../../../../../packages/app-shell/src/context/platform"
import { LanguageProvider } from "../../../../../packages/app-shell/src/context/language"
import { SfOwnerRuntime231 } from "../../../../../packages/app-shell/src/orchestra/chapters/sucafina/host/owner-runtime231"
import { checkServerHealth } from "../../../../../packages/app-shell/src/utils/server-health"
import type { ServerConnection } from "../../../../../packages/app-shell/src/context/server"

// Only the installation directory crosses this test composition boundary.
// Discovery, owner stamps, destinations, drafts, routes and transport come from
// the same production F01 owner and native leaves mounted by the shell.
const root = document.getElementById("root")
const config = document.getElementById("sf-native-fixture")
if (!(root instanceof HTMLElement) || !config?.textContent)
  throw new Error("Native browser fixture root is unavailable")
const directory: unknown = JSON.parse(config.textContent).directory
if (typeof directory !== "string" || !directory.startsWith("/"))
  throw new Error("Native browser fixture directory is invalid")
const server: ServerConnection.Http = { type: "http", http: { url: location.origin } }
const health = await checkServerHealth(server.http, (input, init) => fetch(input, init), { timeoutMs: 4000, retryCount: 0 })
if (!health.healthy || !health.version) throw new Error("Native browser fixture host is not healthy")
const platform: Platform = {
  platform: "web",
  openExternal: (value) => {
    const url = new URL(value)
    if (["http:", "https:", "mailto:"].includes(url.protocol))
      window.open(url.href, "_blank", "noopener,noreferrer")
  },
  restart: async () => { location.reload() },
  notify: async (title, description, onClick) => {
    if (!("Notification" in window) || Notification.permission !== "granted") return
    const notification = new Notification(title, { body: description })
    notification.onclick = () => { window.focus(); onClick?.(); notification.close() }
  },
}
render(() =>
  <PlatformProvider value={platform}>
    <LanguageProvider locale="en">
      <Router>
        <Route path="/*" component={() => <SfOwnerRuntime231 server={server} directory={directory} />} />
      </Router>
    </LanguageProvider>
  </PlatformProvider>, root)
