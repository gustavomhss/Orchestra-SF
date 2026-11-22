import { expect, test, type Locator, type Page, type TestInfo } from "@playwright/test"
import { installTeamsVisual, teamsVisualBinding, teamsVisualOrigin, teamsVisualTeams } from "./team-profile-visual.fixture"

// COMPONENT VISUAL / not Microsoft live. Run against integration.config.ts's production
// build. The only document changes are the two flags added by the installed HTTPS host.
test.use({ serviceWorkers: "block" })
const modes = [
  { name: "desktop", viewport: { width: 1440, height: 1000 } },
  { name: "mobile", viewport: { width: 390, height: 844 } },
] as const

async function layoutEvidence(page: Page) {
  return page.evaluate(() => {
    const shell = document.querySelector<HTMLElement>("[data-sf-teams-shell]")
    if (!shell) throw new Error("The original Teams shell did not mount")
    const body = getComputedStyle(document.body)
    const canvas = document.createElement("canvas")
    canvas.width = canvas.height = 1
    const context = canvas.getContext("2d")
    if (!context) throw new Error("Canvas color measurement unavailable")
    const color = (value: string) => {
      context.clearRect(0, 0, 1, 1)
      context.fillStyle = value
      context.fillRect(0, 0, 1, 1)
      return Array.from(context.getImageData(0, 0, 1, 1).data)
    }
    const over = (front: number[], back: number[]) => {
      const alpha = front[3]! / 255
      return [0, 1, 2].map((index) => front[index]! * alpha + back[index]! * (1 - alpha)).concat(255)
    }
    const luminance = (rgb: number[]) => rgb.slice(0, 3).reduce((sum, channel, index) => {
      const value = channel / 255
      return sum + (value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4) * [0.2126, 0.7152, 0.0722][index]!
    }, 0)
    const samples = [...document.querySelectorAll<HTMLElement>(
      ".sf-team-heading h1, .sf-team-surface > p[role], .sf-team-configuration-form label, .sf-team-surface .mx-btn.primary",
    )].filter((element) => element.getBoundingClientRect().width > 0).map((element) => {
      const ancestors: HTMLElement[] = []
      for (let current: HTMLElement | null = element; current; current = current.parentElement) ancestors.unshift(current)
      let background = [255, 255, 255, 255]
      let backgroundImages = false
      for (const ancestor of ancestors) {
        const style = getComputedStyle(ancestor)
        background = over(color(style.backgroundColor), background)
        backgroundImages ||= style.backgroundImage !== "none"
      }
      const style = getComputedStyle(element)
      const foreground = over(color(style.color), background)
      const a = luminance(foreground), b = luminance(background)
      return {
        text: element.textContent?.trim().slice(0, 100),
        foreground: style.color, background, backgroundImages,
        ratio: (Math.max(a, b) + .05) / (Math.min(a, b) + .05),
      }
    })
    return {
      tokens: Object.fromEntries(["--mx-strong", "--mx-dim", "--mx-raised", "--mx-sans", "--orchestra-float-filter"]
        .map((name) => [name, body.getPropertyValue(name).trim()])),
      bodyBackground: body.backgroundColor,
      fontSize: getComputedStyle(shell).fontSize,
      pageOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      shellOverflow: shell.scrollWidth - shell.clientWidth,
      samples,
      contrastScope: "Computed solid-color layers; decorative image pixels, glass and blur also require screenshot review.",
    }
  })
}

async function namedControl(control: Locator, name: string) {
  await expect(control).toHaveAccessibleName(name)
  await expect(control).toBeEnabled()
  const box = await control.boundingBox()
  expect(box, "Accessible control has a rendered hit area").not.toBeNull()
  expect(box!.height, name + " hit area").toBeGreaterThanOrEqual(44)
}

async function capture(page: Page, info: TestInfo, state: string, scheme: "dark" | "light") {
  await expect(page.locator("html")).toHaveAttribute("data-color-scheme", scheme)
  await expect(page.locator("body")).toHaveAttribute("data-new-layout", /.*/)
  await page.evaluate(() => document.fonts.ready.then(() => undefined))
  const evidence = await layoutEvidence(page)
  expect(evidence.pageOverflow, state + " does not overflow the page horizontally").toBeLessThanOrEqual(1)
  expect(evidence.shellOverflow, state + " does not overflow its scroll container horizontally").toBeLessThanOrEqual(1)
  expect(evidence.fontSize, "Teams uses Orchestra's native body scale").toBe("13px")
  for (const [name, value] of Object.entries(evidence.tokens)) expect(value, "Body exposes " + name).not.toBe("")
  expect(evidence.samples.length).toBeGreaterThan(0)
  for (const sample of evidence.samples) expect(sample.ratio, "Solid-layer text contrast: " + sample.text).toBeGreaterThanOrEqual(4.5)
  const viewport = page.viewportSize()
  const name = "COMPONENT-VISUAL-Teams-" + state + "-" + scheme + "-" + viewport!.width
  await page.screenshot({ path: info.outputPath(name + ".png"), fullPage: true, animations: "disabled" })
  await info.attach(name, { path: info.outputPath(name + ".png"), contentType: "image/png" })
  await info.attach(name + "-evidence", {
    contentType: "application/json",
    body: JSON.stringify({
      classification: "COMPONENT VISUAL / not Microsoft live",
      bundle: info.config.metadata.bundle,
      sourceCommit: process.env.ORCHESTRA_E2E_SOURCE_SHA ?? process.env.GITHUB_SHA ?? "See CI run commit",
      viewport, scheme, state, ...evidence,
    }, null, 2),
  })
}

async function composerGeometry(page: Page) {
  return page.evaluate(() => {
    const workspace = document.querySelector<HTMLElement>("[data-sf-session-workspace]")
    if (!workspace) throw new Error("Native Team session workspace missing")
    const viewport = { width: innerWidth, height: innerHeight }
    const targets = [
      ["editor", '[data-component="prompt-input-v2"] [data-component="prompt-input"]'],
      ["submit", '[data-action="prompt-submit"]'],
    ] as const
    return {
      viewport,
      targets: targets.map(([name, selector]) => {
        const element = workspace.querySelector<HTMLElement>(selector)
        if (!element) throw new Error("Native composer " + name + " missing")
        const box = element.getBoundingClientRect()
        const rect = { left: box.left, right: box.right, top: box.top, bottom: box.bottom }
        const ancestors = []
        for (let current = element.parentElement; current; current = current.parentElement) {
          const style = getComputedStyle(current), bounds = current.getBoundingClientRect()
          ancestors.push({
            tag: current.tagName,
            className: current.className,
            component: current.getAttribute("data-component"),
            isShell: current.hasAttribute("data-sf-teams-shell"),
            overflowY: style.overflowY,
            scrollTop: current.scrollTop,
            scrollHeight: current.scrollHeight,
            clientHeight: current.clientHeight,
            rect: { left: bounds.left, right: bounds.right, top: bounds.top, bottom: bounds.bottom },
            userScrollable: /^(auto|scroll)$/.test(style.overflowY) && current.scrollHeight > current.clientHeight + 1,
            clipsTarget: /^(hidden|clip|auto|scroll)$/.test(style.overflowY) &&
              (rect.top < bounds.top - 1 || rect.bottom > bounds.bottom + 1),
          })
        }
        return {
          name, rect, ancestors,
          visible: rect.top >= 0 && rect.bottom <= viewport.height && rect.left >= 0 &&
            rect.right <= viewport.width && !ancestors.some((ancestor) => ancestor.clipsTarget),
        }
      }),
    }
  })
}

async function reachComposerNormally(page: Page, info: TestInfo, scheme: "dark" | "light") {
  const workspace = page.locator("[data-sf-session-workspace]")
  const editor = workspace.locator('[data-component="prompt-input-v2"] [data-component="prompt-input"]')
  const submit = workspace.locator('[data-action="prompt-submit"]')
  await expect(editor).toHaveCount(1)
  await expect(submit).toHaveCount(1)
  await expect(submit).toHaveAccessibleName(/\S/)
  const initial = await composerGeometry(page)
  const needsScroll = initial.targets.some((target) => !target.visible)
  if (needsScroll) {
    const candidates = initial.targets.flatMap((target) => target.ancestors).filter((ancestor) =>
      ancestor.userScrollable && ancestor.rect.bottom > 0 && ancestor.rect.top < initial.viewport.height)
    const scroller = candidates.find((ancestor) => ancestor.isShell) ?? candidates[0]
    expect(scroller, "A clipped composer must have a native vertical scroll path before focus or fill").toBeDefined()
    if (!scroller) throw new Error("Composer is clipped behind non-scrollable ancestors")
    // Wheel over the scroller's visible padding, not over the editor. Neither focus,
    // fill nor scrollIntoView may supply the missing scroll path under test.
    const x = Math.max(4, Math.min(initial.viewport.width - 4, scroller.rect.left + 4))
    const y = Math.max(4, Math.min(initial.viewport.height - 4,
      Math.max(scroller.rect.top + 8, Math.min(scroller.rect.bottom - 8, initial.viewport.height / 2))))
    await page.mouse.move(x, y)
    await page.mouse.wheel(0, Math.max(initial.viewport.height,
      ...initial.targets.map((target) => target.rect.bottom - initial.viewport.height + 64)))
  }
  await expect(editor).toBeInViewport({ ratio: 1 })
  await expect(submit).toBeInViewport({ ratio: 1 })
  const reached = await composerGeometry(page)
  expect(reached.targets.map((target) => target.visible), "Editor and submit are visible before focus").toEqual([true, true])
  await editor.focus()
  await expect(editor).toBeFocused()
  await expect(editor).toBeEditable()
  const focused = await composerGeometry(page)
  for (let index = 0; index < reached.targets.length; index++)
    expect(Math.abs(focused.targets[index]!.rect.top - reached.targets[index]!.rect.top),
      "Focus must not rescue an offscreen composer").toBeLessThanOrEqual(1)
  await info.attach("COMPONENT-VISUAL-Teams-composer-native-scroll", {
    contentType: "application/json",
    body: JSON.stringify({
      classification: "COMPONENT VISUAL / not Microsoft live",
      input: needsScroll ? "mouse.wheel before editor focus" : "already fully visible",
      initial, reached, focused,
    }, null, 2),
  })
  await capture(page, info, "chat-composer-reachable", scheme)
}

async function attachFixtureEvidence(info: TestInfo, fixture: Awaited<ReturnType<typeof installTeamsVisual>>) {
  expect(fixture.unexpected, "No unmodeled HTTP traffic, auth navigation or writes").toEqual([])
  expect([...fixture.assets].some((path) => path.endsWith(".js")), "Original production JavaScript was served").toBe(true)
  await info.attach("COMPONENT-VISUAL-Teams-provenance", {
    contentType: "application/json",
    body: JSON.stringify({
      classification: "COMPONENT VISUAL / not Microsoft live",
      binding: teamsVisualBinding,
      originalBuildAssets: [...fixture.assets].sort(),
      requests: fixture.requests,
      limitations: [
        "Microsoft sign-in and authority are not validated by synthetic HTTP responses.",
        "No administrative change or chat prompt is submitted.",
        "Chat READY / CONNECTING is captured with the genuine event HTTP request pending; an open live stream is not claimed.",
      ],
    }, null, 2),
  })
}

for (const scheme of ["dark", "light"] as const) for (const mode of modes) {
  test.describe("Teams component visual · " + scheme + " · " + mode.name, () => {
    test.use({ viewport: mode.viewport })

    test("access, selection, administration and configuration", { tag: "@component-visual" }, async ({ page, baseURL }, info) => {
      test.skip(info.config.metadata.bundle !== "production", "Requires the original production integration build")
      if (!baseURL) throw new Error("Production baseURL is required")
      const fixture = await installTeamsVisual(page, { baseURL, scheme })
      try {
        await page.goto(teamsVisualOrigin, { waitUntil: "domcontentloaded" })
        const shell = page.locator("[data-sf-teams-shell]")
        await expect(shell).toHaveAttribute("data-sf-teams-state", "unauthenticated")
        const signIn = shell.getByRole("link", { name: "Sign in with Microsoft", exact: true })
        await expect(signIn).toHaveAttribute("href", /^\/sucafina\/auth\/login\?returnTo=/)
        await expect(signIn).toBeVisible()
        await expect(shell.locator("[data-sf-team-picker]")).toHaveCount(0)
        await capture(page, info, "signed-out", scheme)

        // The response changes at the HTTP boundary, not by inventing a Microsoft login.
        fixture.state.signedIn = true
        await page.reload({ waitUntil: "domcontentloaded" })
        await expect(shell).toHaveAttribute("data-sf-teams-state", "authenticated")
        const picker = shell.getByRole("combobox", { name: "Team", exact: true })
        await expect(picker).toHaveValue("")
        await expect(picker.locator("option")).toHaveCount(8)
        await namedControl(picker, "Team")
        await namedControl(shell.locator("[data-sf-refresh-access]"), "Refresh access")
        await namedControl(shell.locator("[data-sf-sign-out]"), "Sign out")
        await capture(page, info, "selection-required", scheme)

        await picker.selectOption(teamsVisualTeams[0].id)
        await expect(shell).toHaveAttribute("data-sf-team-selected", teamsVisualTeams[0].id)
        await expect(shell.getByRole("heading", { level: 1, name: teamsVisualTeams[0].name, exact: true })).toBeVisible()
        await expect(shell.getByRole("link", { name: "Open Team dashboard", exact: true })).toHaveAttribute("href", /\/dashboard$/)
        await namedControl(shell.locator("[data-sf-new-chat]"), "New chat")
        await capture(page, info, "team-selected", scheme)

        const toggle = shell.getByRole("button", { name: "Team administration", exact: true })
        await namedControl(toggle, "Team administration")
        await toggle.click()
        await expect(toggle).toHaveAttribute("aria-expanded", "true")
        const administration = shell.locator('[data-sf-team-administration="ready"]')
        await expect(administration.locator("[data-sf-admin-team]")).toHaveCount(8)
        await expect(administration.locator('[data-sf-admin-team="' + teamsVisualTeams[0].id + '"]')).toContainText(teamsVisualTeams[0].name)
        await capture(page, info, "administration-expanded", scheme)
        const tail = administration.locator('[data-sf-admin-team="' + teamsVisualTeams[7].id + '"]')
        await expect(tail).toContainText(teamsVisualTeams[7].id)
        const tailRemove = tail.getByRole("button", { name: "Remove", exact: true })
        await tailRemove.scrollIntoViewIfNeeded()
        await expect(tailRemove).toBeInViewport()
        await namedControl(tailRemove, "Remove")
        await capture(page, info, "administration-tail", scheme)

        const firstTeam = administration.locator('[data-sf-admin-team="' + teamsVisualTeams[0].id + '"]')
        await firstTeam.getByRole("button", { name: "Configure chat", exact: true }).click()
        const configuration = administration.locator('[data-sf-team-configuration="ready"]')
        await expect(configuration.getByRole("textbox", { name: "Model (provider/model)", exact: true })).toHaveValue("approved/model-one")
        await expect(configuration.getByRole("textbox", { name: "Default agent (optional)", exact: true })).toHaveValue("maestro")
        await expect(configuration).toContainText("Other shared agent settings will be preserved.")
        await configuration.getByRole("heading", { name: "Shared chat configuration", exact: true }).scrollIntoViewIfNeeded()
        await capture(page, info, "shared-configuration", scheme)
        const save = configuration.getByRole("button", { name: "Save chat configuration", exact: true })
        await save.scrollIntoViewIfNeeded()
        await expect(save).toBeInViewport()
        await namedControl(save, "Save chat configuration")
        await capture(page, info, "shared-configuration-actions", scheme)
        await configuration.getByRole("button", { name: "Close configuration", exact: true }).click()
        await expect(administration.locator("[data-sf-team-configuration]")).toHaveCount(0)
        await expect(firstTeam.getByRole("button", { name: "Configure chat", exact: true })).toBeEnabled()
        await attachFixtureEvidence(info, fixture)
      } finally { await fixture.dispose() }
    })

    test("empty chat, native draft guard, expanded administration and stopped updates", { tag: "@component-visual" }, async ({ page, baseURL }, info) => {
      test.skip(info.config.metadata.bundle !== "production", "Requires the original production integration build")
      if (!baseURL) throw new Error("Production baseURL is required")
      const fixture = await installTeamsVisual(page, { baseURL, scheme, signedIn: true })
      try {
        await page.goto(fixture.chatURL(teamsVisualTeams[0].id), { waitUntil: "domcontentloaded" })
        const shell = page.locator("[data-sf-teams-shell]")
        const workspace = shell.locator("[data-sf-session-workspace]")
        await expect(shell).toHaveAttribute("data-sf-team-selected", teamsVisualTeams[0].id)
        await expect(workspace).toHaveAttribute("data-sf-session-state", "ready")
        await expect(workspace).toHaveAttribute("data-sf-session-stream", "connecting")
        await expect(workspace.getByRole("complementary", { name: "Recent chats", exact: true })).toContainText("No chats were found.")
        const editor = workspace.locator('[data-component="prompt-input-v2"] [data-component="prompt-input"]')
        await expect(editor).toBeEditable()
        await expect(editor).toHaveText("")
        await capture(page, info, "chat-empty-stream-connecting", scheme)
        await reachComposerNormally(page, info, scheme)

        await editor.fill("Component visual: keep this unsent Team draft.")
        await expect(workspace.locator('[data-action="prompt-submit"]')).toBeEnabled()
        const picker = shell.getByRole("combobox", { name: "Team", exact: true })
        const requestsBefore = fixture.requests.length
        await picker.selectOption(teamsVisualTeams[1].id)
        const dialog = page.locator("dialog[data-sf-draft-guard][open]")
        await expect(dialog).toBeVisible()
        const keep = dialog.locator("[data-sf-keep-editing]")
        await expect(keep).toBeFocused()
        await namedControl(keep, "Cancel")
        await namedControl(dialog.locator("[data-sf-confirm-discard]"), "Discard draft and continue")
        await expect(dialog).toHaveAccessibleName(/\S/)
        await expect(picker).toHaveValue(teamsVisualTeams[0].id)
        expect(fixture.requests.slice(requestsBefore).some((request) => request.team === teamsVisualTeams[1].id)).toBe(false)
        const box = await dialog.boundingBox()
        expect(box).not.toBeNull()
        expect(box!.x).toBeGreaterThanOrEqual(0)
        expect(box!.y).toBeGreaterThanOrEqual(0)
        expect(box!.x + box!.width).toBeLessThanOrEqual(mode.viewport.width + 1)
        expect(box!.y + box!.height).toBeLessThanOrEqual(mode.viewport.height + 1)
        await capture(page, info, "draft-discard-dialog", scheme)
        await page.keyboard.press("Escape")
        await expect(dialog).toHaveCount(0)
        await expect(editor).toHaveText("Component visual: keep this unsent Team draft.")
        await expect(shell).toHaveAttribute("data-sf-team-selected", teamsVisualTeams[0].id)
        // Clear the draft through the real composer; no prompt is submitted.
        await editor.fill("")

        const toggle = shell.getByRole("button", { name: "Team administration", exact: true })
        await toggle.click()
        const administration = shell.locator('[data-sf-team-administration="ready"]')
        await expect(administration.locator("[data-sf-admin-team]")).toHaveCount(8)
        await capture(page, info, "chat-administration-expanded", scheme)
        const tail = administration.locator('[data-sf-admin-team="' + teamsVisualTeams[7].id + '"]')
        await tail.getByRole("button", { name: "Remove", exact: true }).scrollIntoViewIfNeeded()
        await expect(tail.getByRole("button", { name: "Remove", exact: true })).toBeInViewport()
        await capture(page, info, "chat-administration-tail", scheme)
        await toggle.click()
        await expect(shell.locator("[data-sf-team-administration]")).toHaveCount(0)
        await expect(editor).toBeEditable()

        await fixture.finishEventStreams()
        await expect(workspace).toHaveAttribute("data-sf-session-state", "unavailable")
        await expect(workspace.getByRole("alert")).toContainText("Chat updates stopped. Refresh access before continuing.")
        await expect(workspace.locator('[data-component="prompt-input-v2"]')).toHaveCount(0)
        await namedControl(workspace.getByRole("button", { name: "Try again", exact: true }), "Try again")
        await capture(page, info, "chat-updates-stopped", scheme)
        await attachFixtureEvidence(info, fixture)
      } finally { await fixture.dispose() }
    })
  })
}
