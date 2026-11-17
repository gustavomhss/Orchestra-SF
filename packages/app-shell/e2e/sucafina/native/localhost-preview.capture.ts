import { chromium, expect } from "@playwright/test"
import { mkdir, readFile, writeFile } from "node:fs/promises"
import path from "node:path"

// Capture REAL native SF chapters against the locally running installed server.
// No route interception, HTML stubs, fake SSO or synthetic UI components.
// The installation is a dedicated local-operator scratch with no corporate data.
const base = "http://localhost:4110"
const out = process.env.SF_VISUAL_OUT
const privateRoot = process.env.SF_LOCAL_ROOT
const password = process.env.ORCHESTRA_SERVER_PASSWORD
if (!out || !privateRoot || !password) throw new Error("SF_VISUAL_PRIVATE_HOST_ENV_REQUIRED")
await mkdir(out, { recursive: true })

const html = await readFile(path.join(privateRoot, "open-local.html"), "utf8")
const match = /location\.replace\(("([^"\n]+)")\)/.exec(html)
if (!match) throw new Error("SF_VISUAL_PRIVATE_HANDOFF_MISSING")
const enrollment = JSON.parse(match[1])
const admitted = await fetch(enrollment, { redirect: "manual", signal: AbortSignal.timeout(10_000) })
if (admitted.status !== 303) throw new Error("SF_VISUAL_LOCAL_OPERATOR_AUTH_REJECTED")
const rawCookie = admitted.headers.get("set-cookie") ?? ""
const cookie = /^(sucafina_operator_[a-f0-9]{24})=([a-f0-9]{64})(?:;|$)/.exec(rawCookie)
if (!cookie || !/(?:^|;\s*)Path=\/sucafina(?:;|$)/.test(rawCookie) || !/(?:^|;\s*)HttpOnly(?:;|$)/.test(rawCookie))
  throw new Error("SF_VISUAL_HTTPONLY_SESSION_NOT_ISSUED")
const token = Buffer.from("orchestra:" + password).toString("base64")
const directory = process.env.GITHUB_WORKSPACE ?? process.cwd()
const cases = [
  { id: "dashboard", route: "/orchestra/sf-dashboard/executive", title: "Executive Dashboard" },
  { id: "planner", route: "/orchestra/sf-planner/overview", title: "Overview" },
  { id: "procurement", route: "/orchestra/sf-procurement/contracts", title: "Vendor Contracts" },
] as const
const captured: unknown[] = []
const browser = await chromium.launch({ headless: true })
try {
  for (const scheme of ["dark", "light"] as const) {
    const context = await browser.newContext({ viewport: { width: 1600, height: 940 }, deviceScaleFactor: 1, serviceWorkers: "block" })
    await context.addCookies([{ name: cookie[1]!, value: cookie[2]!, domain: "localhost", path: "/sucafina", httpOnly: true, secure: false, sameSite: "Lax" }])
    await context.addInitScript(({ server, directory, scheme }) => {
      const projects = [{ worktree: directory, expanded: true }]
      localStorage.setItem("orchestra.global.dat:server", JSON.stringify({
        list: [server], projects: { local: projects, [server]: projects },
        lastProject: { local: directory, [server]: directory },
      }))
      localStorage.setItem("orchestra.global.dat:layout", JSON.stringify({
        home: { selection: { server, directory } },
      }))
      localStorage.setItem("orchestra-color-scheme", scheme)
      localStorage.setItem("orchestra-palette", scheme)
      localStorage.setItem("orchestra.global.dat:language", JSON.stringify({ locale: "en" }))
    }, { server: base, directory, scheme })
    for (const visit of cases) {
      const page = await context.newPage()
      const diagnostics: string[] = []
      page.on("pageerror", (error) => diagnostics.push("pageerror " + error.name + ": " + error.message.slice(0, 180)))
      page.on("requestfailed", (request) => diagnostics.push("requestfailed " + new URL(request.url()).pathname + " " + String(request.failure()?.errorText ?? "")))
      page.on("response", (response) => {
        if (response.status() >= 400) diagnostics.push("HTTP " + response.status() + " " + new URL(response.url()).pathname)
      })
      page.on("console", (message) => {
        if (message.type() === "error") diagnostics.push("console-error " + message.text().slice(0, 160))
      })
      try {
        const url = base + visit.route + "?auth_token=" + encodeURIComponent(token)
        const response = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30_000 })
        if (response?.status() !== 200) throw new Error("SF_VISUAL_NATIVE_HTTP_NOT_200_" + String(response?.status()))
        await expect(page.locator("html")).toHaveAttribute("data-orchestra-brand", "sucafina")
        await expect(page.locator("html")).toHaveAttribute("data-color-scheme", scheme)
        const frame = page.locator('[data-sf-frame="page"]')
        await expect(frame, "Native SF frame is mandatory, generic Orchestra Home is rejected").toBeVisible({ timeout: 35_000 })
        await expect(frame.getByRole("heading", { level: 1, name: visit.title, exact: true })).toBeVisible()
        const sidebar = page.locator('[data-component="orchestra-sidebar"]')
        await expect(sidebar.locator(".sucafina-logo")).toBeVisible()
        await expect(sidebar).toHaveCSS("width", "230px")
        await expect(page.locator('[data-slot="titlebar-v2"]')).toHaveCSS("height", "45px")
        await page.evaluate(() => document.fonts.ready)
        const file = "sf-native-" + visit.id + "-" + scheme + ".png"
        await page.screenshot({ path: path.join(out, file), animations: "disabled" })
        captured.push({ file, chapter: visit.id, scheme, actualNativeFrame: true })
        console.log("SF_VISUAL_CAPTURE_OK " + visit.id + " " + scheme)
      } catch (failure) {
        const text = await page.locator("body").innerText().catch(() => "")
        const facts = await page.evaluate(() => ({
          readyState: document.readyState,
          appLoading: document.querySelectorAll("[data-app-loading]").length,
          rootChildCount: document.getElementById("root")?.childElementCount ?? null,
          scriptCount: document.scripts.length,
          nativeFrameCount: document.querySelectorAll('[data-sf-frame="page"]').length,
        })).catch(() => null)
        const clean = (value: string) => value
          .replace(/auth_token=[^&\\s]+/gi, "auth_token=[redacted]")
          .replace(/[a-f0-9]{32,}/gi, "[redacted]")
        const report = { status: "FAILED_NATIVE_FRAME_NOT_MOUNTED", sourceSHA: process.env.GITHUB_SHA,
          chapter: visit.id, scheme, facts, text: clean(text).slice(0, 350), diagnostics: diagnostics.map(clean).slice(-50) }
        console.error("SF_VISUAL_CAPTURE_DIAGNOSTIC " + JSON.stringify(report))
        await writeFile(path.join(out, "FAILED-" + visit.id + "-" + scheme + ".json"), JSON.stringify(report, null, 2) + "\\n")
        await page.screenshot({ path: path.join(out, "FAILED-" + visit.id + "-" + scheme + ".png"), animations: "disabled" }).catch(() => undefined)
        throw new Error("SF_VISUAL_NATIVE_FRAME_OR_IDENTITY_UNAVAILABLE_" + visit.id + "_" + scheme)
      } finally { await page.close() }
    }
    await context.close()
  }
} finally { await browser.close() }
await writeFile(path.join(out, "manifest.json"), JSON.stringify({
  schema: "sf-native-localhost-visual-v1",
  buildBrand: "sucafina",
  sourceSHA: process.env.GITHUB_SHA,
  proofClass: "REAL_LOCAL_OPERATOR_INSTALLED_NATIVE_UI",
  authentication: "private scratch local-operator, not Microsoft Entra",
  dataset: "empty synthetic scratch installation",
  screenshots: captured,
}, null, 2) + "\n")
if (captured.length !== 6) throw new Error("SF_VISUAL_INCOMPLETE")
