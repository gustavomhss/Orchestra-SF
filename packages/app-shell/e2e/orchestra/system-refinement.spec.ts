import { expect, test, type Page } from "@playwright/test"
import { installTeamsVisual, teamsVisualTeams } from "./team-profile-visual.fixture"

// Production components and the existing closed HTTP fixture; this does not
// qualify Microsoft login, administrative writes or a live chat provider.
test.use({ serviceWorkers: "block" })
test.describe.configure({ retries: 0 })

const viewports = [
  { width: 1440, height: 1000 },
  { width: 1280, height: 800 },
  { width: 390, height: 844 },
  { width: 320, height: 900 },
] as const

async function measure(page: Page) {
  return page.evaluate(() => {
    const main = document.querySelector<HTMLElement>(".sf-team-main-chat")!
    const administration = document.querySelector<HTMLElement>(".sf-team-administration")!
    const session = document.querySelector<HTMLElement>("[data-sf-session-workspace]")!
    const input = administration.querySelector<HTMLInputElement>("input.sf-team-input")!
    const canvas = document.createElement("canvas")
    canvas.width = canvas.height = 1
    const context = canvas.getContext("2d")!
    const rgba = (value: string) => {
      context.clearRect(0, 0, 1, 1)
      context.fillStyle = value
      context.fillRect(0, 0, 1, 1)
      return Array.from(context.getImageData(0, 0, 1, 1).data)
    }
    const over = (front: number[], back: number[]) =>
      [0, 1, 2].map((index) => front[index]! * front[3]! / 255 + back[index]! * (1 - front[3]! / 255)).concat(255)
    const luminance = (rgb: number[]) => rgb.slice(0, 3).reduce((sum, channel, index) => {
      const value = channel / 255
      return sum + (value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4) * [.2126, .7152, .0722][index]!
    }, 0)
    const ratio = (a: number[], b: number[]) =>
      (Math.max(luminance(a), luminance(b)) + .05) / (Math.min(luminance(a), luminance(b)) + .05)
    const ancestors: HTMLElement[] = []
    for (let current = input.parentElement; current; current = current.parentElement) ancestors.unshift(current)
    let exterior = [255, 255, 255, 255]
    let images = false
    for (const element of ancestors) {
      const style = getComputedStyle(element)
      exterior = over(rgba(style.backgroundColor), exterior)
      images ||= style.backgroundImage !== "none"
    }
    const style = getComputedStyle(input)
    const interior = over(rgba(style.backgroundColor), exterior)
    const border = over(rgba(style.borderTopColor), interior)
    const bounds = (element: HTMLElement) => {
      const box = element.getBoundingClientRect()
      return { top: box.top, right: box.right, bottom: box.bottom, left: box.left, width: box.width, height: box.height }
    }
    return {
      main: bounds(main), administration: bounds(administration), session: bounds(session),
      paddingBottom: Number.parseFloat(getComputedStyle(main).paddingBottom),
      border: { color: style.borderTopColor, width: style.borderTopWidth, composite: border },
      exterior, interior,
      contrastOutside: ratio(border, exterior), contrastInside: ratio(border, interior),
      imageLayers: images,
      contrastScope: "Computed solid layers; original PNGs retain glass, grain and image pixels for visual review.",
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    }
  })
}

for (const scheme of ["dark", "light"] as const) for (const viewport of viewports) {
  test("system refinement: Teams material and empty input · " + scheme + " · " + viewport.width, async ({ page, baseURL }, info) => {
    expect(info.config.metadata.bundle).toBe("production")
    if (!baseURL) throw new Error("Production baseURL is required")
    await page.setViewportSize(viewport)
    const fixture = await installTeamsVisual(page, { baseURL, scheme, signedIn: true })
    try {
      await page.goto(fixture.chatURL(teamsVisualTeams[0].id), { waitUntil: "domcontentloaded" })
      const shell = page.locator("[data-sf-teams-shell]")
      const workspace = shell.locator("[data-sf-session-workspace]")
      await expect(shell).toHaveAttribute("data-sf-team-selected", teamsVisualTeams[0].id)
      await expect(workspace).toHaveAttribute("data-sf-session-state", "ready")
      await expect(workspace).toHaveAttribute("data-sf-session-stream", "connecting")
      const editor = workspace.locator('[data-component="prompt-input-v2"] [data-component="prompt-input"]')
      await expect(editor).toBeEditable()
      await expect(editor).toBeInViewport({ ratio: 1 })
      await expect(workspace.locator('[data-action="prompt-submit"]')).toBeInViewport({ ratio: 1 })
      await expect(workspace.locator(".sf-team-session-heading")).toHaveCount(0)
      await page.screenshot({ path: info.outputPath("Teams-compact-" + scheme + "-" + viewport.width + ".png"), animations: "disabled" })

      await shell.getByRole("button", { name: "Team administration", exact: true }).click()
      const administration = shell.locator('[data-sf-team-administration="ready"]')
      await expect(administration.locator("[data-sf-admin-team]")).toHaveCount(8)
      const input = administration.getByRole("textbox", { name: "Microsoft Team ID", exact: true })
      await expect(input).toBeEditable()
      await expect(input).toHaveValue("")
      await page.evaluate(() => document.fonts.ready.then(() => undefined))
      const evidence = await measure(page)
      expect(evidence.main.bottom, "The material contains expanded administration and its padding")
        .toBeGreaterThanOrEqual(evidence.administration.bottom + evidence.paddingBottom - 1)
      expect(evidence.main.bottom, "The material also contains the session below administration")
        .toBeGreaterThanOrEqual(evidence.session.bottom + evidence.paddingBottom - 1)
      expect(evidence.contrastOutside, "An empty enabled input is identifiable against its surrounding material").toBeGreaterThanOrEqual(3)
      expect(evidence.contrastInside, "An empty enabled input is identifiable against its fill").toBeGreaterThanOrEqual(3)
      expect(evidence.overflow).toBeLessThanOrEqual(1)
      await info.attach("Teams-system-measurements", {
        contentType: "application/json",
        body: JSON.stringify({ classification: "COMPONENT VISUAL / not Microsoft live", scheme, viewport, ...evidence }, null, 2),
      })
      await input.scrollIntoViewIfNeeded()
      await page.screenshot({ path: info.outputPath("Teams-expanded-" + scheme + "-" + viewport.width + ".png"), animations: "disabled" })
      await editor.scrollIntoViewIfNeeded()
      await expect(editor).toBeInViewport({ ratio: 1 })
      await page.screenshot({ path: info.outputPath("Teams-material-tail-" + scheme + "-" + viewport.width + ".png"), animations: "disabled" })
      expect(fixture.unexpected).toEqual([])
    } finally {
      await fixture.dispose()
    }
  })
}
