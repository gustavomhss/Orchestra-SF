import { describe, expect, test } from "bun:test"
import { applyBrandIdentityToHtml } from "../../brand-identity.js"

const shell = `<!doctype html><html lang="en"><head><title>HuGR Orchestra</title><link rel="icon" type="image/svg+xml" href="/orchestra/hugr-symbol-primary.svg" /><link rel="manifest" href="/site.webmanifest" /></head></html>`

describe("white-label corporate identity", () => {
  test("leaves the default Orchestra deployment untouched", () => {
    expect(applyBrandIdentityToHtml(shell, undefined)).toBe(shell)
  })

  test("brands Sucafina independently of all color schemes and palette names", () => {
    for (const palette of ["system", "dark", "light", "graphite", "gruvbox", "github", "nord", "amoled"]) {
      const html = shell.replace("<html", `<html data-orchestra-palette="${palette}"`)
      const branded = applyBrandIdentityToHtml(html, "sucafina")
      expect(branded).toContain('data-orchestra-brand="sucafina"')
      expect(branded).toContain(`data-orchestra-palette="${palette}"`)
      expect(branded).toContain("<title>Sucafina</title>")
      expect(branded).toContain('href="/brand/sucafina/site.webmanifest"')
      expect(branded).not.toContain("hugr-symbol")
    }
  })

  test("unknown identity values cannot switch the distribution", () => {
    expect(applyBrandIdentityToHtml(shell, "unknown")).toBe(shell)
  })
})
