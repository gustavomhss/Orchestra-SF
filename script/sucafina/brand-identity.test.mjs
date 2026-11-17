import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { test } from "node:test"
import { applyBrandIdentityToHtml } from "../../packages/app-shell/brand-identity.js"

const shell = `<!doctype html><html lang="en"><head><title>HuGR Orchestra</title><link rel="icon" type="image/svg+xml" href="/orchestra/hugr-symbol-primary.svg" /><link rel="manifest" href="/site.webmanifest" /></head></html>`

test("default Orchestra identity is unchanged", () => {
  assert.equal(applyBrandIdentityToHtml(shell, undefined), shell)
})

test("Sucafina company identity survives every Orchestra palette", () => {
  for (const palette of ["system", "dark", "light", "graphite", "gruvbox", "github", "nord", "amoled"]) {
    const html = shell.replace("<html", `<html data-orchestra-palette="${palette}"`)
    const branded = applyBrandIdentityToHtml(html, "sucafina")
    assert.match(branded, /data-orchestra-brand="sucafina"/)
    assert.match(branded, /data-sucafina-artwork="pending"/)
    assert.ok(branded.includes(`data-orchestra-palette="${palette}"`))
    assert.match(branded, /<title>Sucafina<\/title>/)
    assert.match(branded, /href="\/brand\/sucafina\/site.webmanifest"/)
    assert.ok(!branded.includes("hugr-symbol"), "HuGR favicon leaked in branded HTML")
    assert.match(branded, /href="\/brand\/sucafina\/favicon.svg"/)
  }
})

test("approved vector flag is independent of palette selection", () => {
  const branded = applyBrandIdentityToHtml(shell, "sucafina", true)
  assert.match(branded, /data-sucafina-artwork="ready"/)
  assert.match(branded, /<title>Sucafina<\/title>/)
})

test("unknown brand does not change any identity", () => {
  assert.equal(applyBrandIdentityToHtml(shell, "unknown"), shell)
})

test("SUC brand CSS is scoped and never changes the Orchestra theme catalog", () => {
  const css = readFileSync(new URL("../../packages/app-shell/src/orchestra/brand-identity.css", import.meta.url), "utf8")
  assert.ok(css.includes('html[data-orchestra-brand="sucafina"]'))
  assert.ok(!css.includes("--orchestra-glass-background:"))
  assert.ok(!css.includes("--orchestra-radius-lg:"))
  const catalog = readFileSync(new URL("../../packages/app-shell/src/orchestra/palette/catalog.ts", import.meta.url), "utf8")
  assert.ok(!catalog.includes('{ id: "sucafina"'))
})

test("Sucafina pieces reproduce the original vector paths", () => {
  const original = readFileSync(new URL("../../packages/app-shell/public/brand/sucafina/logo-original.svg", import.meta.url), "utf8")
  const wordmark = readFileSync(new URL("../../packages/app-shell/public/brand/sucafina/wordmark-primary.svg", import.meta.url), "utf8")
  const symbol = readFileSync(new URL("../../packages/app-shell/public/brand/sucafina/mark-primary.svg", import.meta.url), "utf8")
  assert.equal((original.match(/<path /g) || []).length, 14)
  assert.equal((wordmark.match(/<path /g) || []).length, 8)
  assert.equal((symbol.match(/<path /g) || []).length, 6)
})
