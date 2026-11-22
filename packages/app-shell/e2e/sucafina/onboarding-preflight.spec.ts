import { expect, test, type Locator } from "@playwright/test"
import { stat } from "node:fs/promises"
import { withDesignInstallation } from "./design-support/installation"
import { authenticateRecordingInstallation } from "./design-support/recording-installation"

// Recording-only artifact. Publish on an isolated ci-run branch, never product dev.
// The original fixture owns the real installation, seed, enrollment and teardown.
// No request interception, synthetic responses, model output or production data.
const sourceRevision = "55d332a2451d2146e825d494b87878875d63b1c7"
test.use({ trace: "off", video: "off", screenshot: "off" })
test.describe.configure({ retries: 0 })

test("record current native Sucafina availability without simulated responses", async ({ browser }, info) => {
  test.setTimeout(900_000)
  expect(info.project.metadata.bundle).toBe("production")
  const observations: Record<string, unknown>[] = []
  const timeline: Record<string, unknown>[] = []
  const network: { atMs: number; method: string; path: string; status: number }[] = []
  const errors: { atMs: number; kind: string; message: string }[] = []

  await withDesignInstallation(async (installation) => {
    const context = await browser.newContext({
      locale: "en-US",
      viewport: { width: 1920, height: 1080 },
      deviceScaleFactor: 1,
      colorScheme: "dark",
      reducedMotion: "no-preference",
      httpCredentials: { username: "orchestra", password: installation.serverPassword },
      recordVideo: { dir: info.outputPath("continuous-video"), size: { width: 1920, height: 1080 } },
    })
    // Redeem enrollment through the existing non-logged original handler before
    // opening a page. No trace, headers, cookies or authentication URL are attached.
    const owner = await authenticateRecordingInstallation(context, installation, async (diagnostic) => {
      await info.attach("discovery-" + diagnostic.selector, {
        body: JSON.stringify(diagnostic, null, 2), contentType: "application/json",
      })
    }).catch(async (error: unknown) => {
      await context.close()
      throw error
    })
    const started = performance.now()
    const page = await context.newPage()
    const video = page.video()
    page.setDefaultTimeout(20_000)
    const elapsed = () => Math.round(performance.now() - started)
    const safe = (value: string) => redact(value, [installation.root, installation.serverPassword])
    const route = () => safePath(page.url())
    const headings = async () => (await page.getByRole("heading", { level: 1 }).allTextContents()).map(safe)
    const addError = (kind: string, message: string) => {
      if (errors.length < 20) errors.push({ atMs: elapsed(), kind, message: safe(message).slice(0, 1200) })
    }
    page.on("pageerror", (error) => addError("pageerror", error.message))
    page.on("console", (entry) => { if (entry.type() === "error") addError("console", entry.text()) })
    page.on("response", (response) => {
      const url = new URL(response.url())
      if (url.origin !== installation.origin || url.pathname.includes("/auth/") || network.length >= 400) return
      if (!url.pathname.includes("/api/") && response.status() < 400) return
      network.push({ atMs: elapsed(), method: response.request().method(), path: safe(url.pathname), status: response.status() })
    })

    const navigate = async (pathname: string, native: boolean) => {
      const target = new URL(pathname, installation.origin)
      target.searchParams.set("server", installation.origin)
      if (native) {
        target.searchParams.set("project", owner.projectId)
        target.searchParams.set("installation", owner.installationId)
      }
      timeline.push({ atMs: elapsed(), kind: "navigate", destinationPath: pathname, fromPath: route(), headings: await headings() })
      const response = await page.goto(target.href, { waitUntil: "domcontentloaded", timeout: 45_000 })
      return response?.status() ?? null
    }
    const click = async (locator: Locator, label: string) => {
      await expect(locator).toBeVisible()
      await expect(locator).toBeEnabled()
      const box = await locator.boundingBox()
      timeline.push({ atMs: elapsed(), kind: "click", label, box, path: route(), headings: await headings() })
      await locator.click()
      timeline.push({ atMs: elapsed(), kind: "click-complete", label, path: route(), headings: await headings() })
    }
    const snapshot = async (name: string, details: Record<string, unknown>) => {
      await page.evaluate(() => document.fonts.ready.then(() => undefined))
      const screenshot = info.outputPath(name + ".png")
      await page.screenshot({ path: screenshot, fullPage: false, animations: "allow" })
      await info.attach(name + "-full-interface", { path: screenshot, contentType: "image/png" })
      const visible = await page.locator("body").innerText({ timeout: 10_000 })
      const dom = await page.evaluate(() => {
        const shown = (element: Element) => element instanceof HTMLElement &&
          element.getClientRects().length > 0 && getComputedStyle(element).visibility !== "hidden"
        const text = (element: Element) => (element.textContent ?? "").replace(/\s+/g, " ").trim().slice(0, 180)
        const box = (element: Element) => {
          const value = element.getBoundingClientRect()
          return { x: value.x, y: value.y, width: value.width, height: value.height }
        }
        return {
          title: document.title,
          headings: [...document.querySelectorAll("h1,h2,h3")].filter(shown).map((element) => ({ level: element.tagName, text: text(element), box: box(element) })).slice(0, 80),
          controls: [...document.querySelectorAll("button,a,[role=button],[role=tab],select")].filter(shown).map((element) => ({
            tag: element.tagName, role: element.getAttribute("role"),
            name: element.getAttribute("aria-label") ?? text(element),
            disabled: element.hasAttribute("disabled") || element.getAttribute("aria-disabled") === "true",
            box: box(element),
          })).slice(0, 160),
          labels: [...document.querySelectorAll("label,[role=status],dt")].filter(shown).map((element) => ({
            tag: element.tagName, text: text(element), box: box(element),
          })).slice(0, 100),
          nativeStates: [...document.querySelectorAll("[data-sf-host]")].map((element) => ({
            discovery: element.getAttribute("data-sf-discovery-state"),
            provider: element.getAttribute("data-sf-provider-state"),
            view: element.getAttribute("data-sf-view-state"),
          })),
        }
      })
      const observed = { name, atMs: elapsed(), path: route(), ...details, dom,
        visibleText: safe(visible).slice(0, 28_000) }
      observations.push(observed)
      // DOM description includes visible text/roles only, never raw HTML,
      // input values, href queries, localStorage, cookies or request bodies.
      await info.attach(name + "-visible-dom", {
        body: safe(JSON.stringify(observed, null, 2)), contentType: "application/json",
      })
      console.info("SF_ONBOARDING_OBSERVATION " + JSON.stringify({
        name, path: route(), status: details.status, headings: dom.headings.filter((item) => item.level === "H1").map((item) => safe(item.text)),
      }))
    }
    const observe = async (name: string, action: () => Promise<unknown>, ready: () => Promise<void>) => {
      const start = elapsed()
      const result = await action().then(async (documentStatus) => {
        await ready()
        return { status: "observed", documentStatus, startMs: start }
      }).catch((error: unknown) => ({
        status: "unavailable-or-not-ready", startMs: start,
        error: safe(error instanceof Error ? error.message : String(error)).slice(0, 1600),
      }))
      await snapshot(name, result)
    }
    const nativeReady = async (title: string) => {
      const host = page.locator('[data-sf-host="owner-runtime231"]')
      await expect(host).toHaveCount(1)
      await expect(host.getByRole("heading", { name: title, level: 1, exact: true })).toBeVisible()
      for (const attribute of ["data-sf-discovery-state", "data-sf-provider-state", "data-sf-view-state"])
        await expect(host).toHaveAttribute(attribute, "ready")
      await expect(host.locator('[aria-busy="true"]')).toHaveCount(0)
    }
    const sharedReady = async (name: "Agents" | "Skills") => {
      await expect(page.locator('[data-component="orchestra-sidebar"]')).toBeVisible()
      await expect.poll(async () => {
        const visible = await page.locator("body").innerText()
        if (/select a project|choose a project|open a project/i.test(visible) &&
            !await page.getByRole("heading", { name, exact: true, level: 1 }).isVisible()) return "project-required"
        if (name === "Agents" && await page.getByRole("list", { name: "Configured agents" }).isVisible()) return "catalog"
        if (name === "Skills" && await page.locator('[data-chapter="skills"] .skills-card').count() > 0) return "catalog"
        if (await page.getByRole("heading", { name, exact: true, level: 1 }).isVisible() &&
            /no agents|no skills|not available|could not load|no project|select a project|choose a project/i.test(visible)) return "explicit-state"
        return "loading"
      }, { timeout: 30_000, message: "observe the real shared catalog or its explicit project/availability gate" }).not.toBe("loading")
    }

    try {
      await observe("01-native-today", () => navigate("/orchestra/sf-home", true), () => nativeReady("Today"))
      await observe("02-native-contributions", () => navigate("/orchestra/sf-routines/residents", true), () => nativeReady("Contributions"))
      await observe("03-shared-agents", () => navigate("/orchestra/agents", false), () => sharedReady("Agents"))
      await observe("04-shared-skills", () => navigate("/orchestra/skills", false), () => sharedReady("Skills"))
      await observe("05-chat-entry", async () => {
        const sidebar = page.locator('[data-component="orchestra-sidebar"]')
        const button = sidebar.getByRole("button", { name: "Chat", exact: true })
        const link = sidebar.getByRole("link", { name: "Chat", exact: true })
        if (await button.count() === 1 && await button.isVisible()) return click(button, "Sidebar / Chat")
        if (await link.count() === 1 && await link.isVisible()) return click(link, "Sidebar / Chat")
        throw new Error("The actual sidebar did not expose a unique visible Chat entry")
      }, async () => {
        await expect.poll(async () => {
          const text = await page.locator("body").innerText()
          const composer = await page.locator('[contenteditable="true"]').count() > 0 ||
            await page.getByPlaceholder(/Message Maestro|Ask anything/i).count() > 0
          return composer || /connect a provider|chat needs a connected provider|choose a project|select a project/i.test(text)
        }, { timeout: 30_000, message: "observe actual Chat composer or its real provider/project gate" }).toBe(true)
      })
      await observe("06-return-native-context", () => navigate("/orchestra/sf-home/context", true), () => nativeReady("Context and access"))
    } finally {
      const report = {
        schema: "sf-onboarding-availability-v1", sourceRevision,
        executionRevision: process.env.GITHUB_SHA ?? "not-provided",
        probeOnly: true, qualification: "availability-observation-not-feature-pass",
        viewport: { width: 1920, height: 1080 },
        recording: "continuous real browser viewport; no simulated actions or responses",
        timelineClock: "milliseconds since page creation; align first navigation frame to video before highlighting",
        noModelExecutionRequested: true, observations, timeline, network, errors,
      }
      await info.attach("native-preflight-report", { body: safe(JSON.stringify(report, null, 2)), contentType: "application/json" })
      await info.attach("native-action-timeline", { body: safe(JSON.stringify(timeline, null, 2)), contentType: "application/json" })
      await context.close()
      if (!video) throw new Error("Native browser did not supply the requested continuous video")
      const videoPath = await video.path()
      const recorded = await stat(videoPath)
      if (recorded.size === 0) throw new Error("Native continuous video is empty")
      await info.attach("native-preflight-continuous-video", { path: videoPath, contentType: "video/webm" })
    }
  }, "four-decisions")
  // A green availability probe means its observations were captured, not that
  // an unavailable provider/project or every observed capability is qualified.
  expect(observations).toHaveLength(6)
})

function safePath(input: string) {
  try { return new URL(input).pathname } catch { return "not-navigated" }
}

function redact(value: string, privateValues: readonly string[]) {
  const withoutPrivate = privateValues.filter(Boolean).reduce((text, secret) => text.replaceAll(secret, "[private]"), value)
  return withoutPrivate
    .replace(/[a-f0-9]{64}/gi, "[digest-or-secret]")
    .replace(/\b(?:Bearer|Basic)\s+[A-Za-z0-9._~+/-]+=*/gi, "[credential]")
    .replace(/([?&](?:code|token|key|password|secret|authorization)=)[^&\s"'<>]+/gi, "$1[redacted]")
    .replace(/\b(code|token|password|secret|authorization)\s*[:=]\s*("[^"]*"|'[^']*'|[^\s&,]+)/gi, "$1=[redacted]")
}
