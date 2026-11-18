/**
 * D01 add-on for mission 199's EXISTING packaged-electron.spec.ts.
 * Runs only inside the original, hosted _electron.launch; the producer's
 * SHA-attested executable and live Microsoft host remain non-optional.
 * No web fixture, dev electron process or renderer-supplied principal counts.
 */
import type { ElectronApplication, Page } from "@playwright/test"

export async function requireSfPackagedBrokerReadiness(app: ElectronApplication, mainWindow: Page) {
  const main = await app.evaluate(({ app, ipcMain }) => ({
    packaged: app.isPackaged,
    channels: [
      "sf-native-register-connection", "sf-native-bind", "sf-native-invoke",
      "sf-native-abort", "sf-native-login", "sf-native-logout", "sf-native-release",
    ].filter((channel) => ipcMain.hasHandler(channel)),
  }))
  if (!main.packaged) throw new Error("D01_REAL_PACKAGED_ELECTRON_REQUIRED")
  if (main.channels.length !== 7) throw new Error("D01_MAIN_SF_BROKER_HANDLERS_MISSING")
  const exported = await mainWindow.evaluate(() => {
    const api = (window as unknown as {
      api?: { sucafina?: Record<string, unknown> }
    }).api?.sucafina
    return [
      "registerConnection", "bind", "invoke", "abort", "login", "logout", "release",
    ].filter((name) => typeof api?.[name] === "function")
  })
  if (exported.length !== 7) throw new Error("D01_PACKAGED_PRELOAD_BROKER_BRIDGE_MISSING")
  return { packaged: true as const, mainChannelCount: main.channels.length, preloadMethods: exported.length }
}
