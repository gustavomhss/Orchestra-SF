import { expect, test } from "bun:test"
import { fileURLToPath } from "node:url"

test.each(["browser", "workspace", "collaboration-client", "collaboration-view"])("review %s entry bundles without server runtime dependencies", async (entry) => {
  const built = await Bun.build({
    entrypoints: [fileURLToPath(new URL(`../../../product/reviews/${entry}.ts`, import.meta.url))],
    target: "browser",
    format: "esm",
    minify: false,
    splitting: false,
    sourcemap: "none",
  })
  expect(built.success).toBe(true)
  expect(built.logs.filter((message) => message.level === "error")).toEqual([])
  expect(built.outputs.length).toBeGreaterThan(0)
  for (const output of built.outputs) {
    const javascript = await output.text()
    // A successful browser build alone does not reject an unresolved global such as Bun.CryptoHasher.
    expect(javascript).not.toMatch(/\b(?:Bun|process|Buffer)\s*(?:\.|\[)/)
    expect(javascript).not.toMatch(/(?:\bfrom\s*|\bimport\s*\(|\brequire\s*\()\s*["'](?:node:|bun(?:["':/]))/)
  }
}, 30000)
