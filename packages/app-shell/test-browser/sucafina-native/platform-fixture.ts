import { createComponent, type JSX } from "solid-js"
import type { Platform } from "@/context/platform"
import { solidDom } from "../solid-dom"

// Reuse the real Platform context exported by Orchestra. This fixture supplies
// browser capabilities only; it cannot manufacture SF authentication or grants.
const { PlatformProvider }: typeof import("@/context/platform") = await import(
  solidDom("@/context/platform", import.meta.dir)
)

const unexpected = (operation: string): never => {
  throw new Error(`Unexpected browser Platform side effect in F03/S05 fixture: ${operation}`)
}

const browserPlatform: Platform = {
  platform: "web",
  openExternal: () => unexpected("openExternal"),
  restart: async () => unexpected("restart"),
  notify: async () => unexpected("notify"),
}

// Match apps/web/src/entry.tsx: PlatformProvider is the outer provider,
// while LanguageProvider and the actual native components stay inside it.
export function withBrowserPlatform(children: () => JSX.Element): JSX.Element {
  return createComponent(PlatformProvider, {
    value: browserPlatform,
    get children() { return children() },
  })
}
