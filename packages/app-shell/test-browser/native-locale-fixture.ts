import type { Platform } from "../src/context/platform"

// Each mounted language provider gets its own supported platform storage, including legacy names.
export function createLocalePlatform(): Platform {
  const files = new Map<string, Map<string, string>>()
  return {
    platform: "desktop",
    os: "macos",
    openExternal() {},
    async restart() {},
    async notify() {},
    async openDirectoryPickerDialog() { return null },
    storage(name = "default") {
      const values = files.get(name) ?? new Map<string, string>()
      files.set(name, values)
      return {
        getItem(key: string) { return values.get(key) ?? null },
        setItem(key: string, value: string) { values.set(key, value) },
        removeItem(key: string) { values.delete(key) },
      }
    },
  }
}
