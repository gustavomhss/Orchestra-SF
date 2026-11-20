import { mountNativeBrowser, nativeBrowserConfig } from "../native-ui-browser/client"
import { ServerConnection } from "../../../../../../packages/app-shell/src/context/server-connection"
import { requestSfNativeChapterNavigation } from "../../../../../../packages/app-shell/src/orchestra/chapters/sucafina/host/native-chapter-entry"

const config = nativeBrowserConfig()
if (!config || typeof config !== "object" || !("directory" in config) || typeof config.directory !== "string")
  throw new Error("SF_HTTP_NATIVE_DIRECTORY_MISSING")
const directory = config.directory
const server = { type: "http", http: { url: window.location.origin } } satisfies ServerConnection.Http
Object.defineProperty(window, "sfHttpChapterNavigation", {
  value: (chapter: string) => requestSfNativeChapterNavigation({ chapter, server: ServerConnection.key(server), directory }),
  configurable: false, writable: false,
})
mountNativeBrowser()
