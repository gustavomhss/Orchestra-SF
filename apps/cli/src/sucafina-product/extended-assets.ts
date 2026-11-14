import path from "node:path"

/** Build only the checked-in browser entry; no shell, remote source or user-selected entrypoint. */
export function createSfExtendedAssets() {
  const pending = new Map<"bi" | "reviews", Promise<string>>()
  const read = (kind: "bi" | "reviews") => {
    const existing = pending.get(kind)
    if (existing) return existing
    const result = (async () => {
      const built = await Bun.build({ entrypoints: [path.join(import.meta.dir, kind === "bi" ? "extended-bi-browser.ts" : "extended-browser.ts")],
        target: "browser", format: "iife", minify: true, write: false })
      if (!built.success || built.outputs.length !== 1) throw new Error("SF_EXTENDED_BROWSER_BUILD_UNAVAILABLE")
      return built.outputs[0]!.text()
    })()
    pending.set(kind, result)
    void result.catch(() => { if (pending.get(kind) === result) pending.delete(kind) })
    return result
  }
  return { bi: () => read("bi"), reviews: () => read("reviews"), dispose: () => pending.clear() }
}
