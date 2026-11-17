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
const directory = privateRoot
// Resolve the exact installed owner from the REAL authenticated host. No guessed
// installation/project IDs and no implicit location fallback.
const discoveredURL = new URL("/api/sucafina/installations", base)
discoveredURL.search = new URLSearchParams({ select: "location", "location[directory]": directory }).toString()
const selectedResponse = await fetch(discoveredURL, {
  method: "GET", headers: { Accept: "application/json", Authorization: "Basic " + token },
  cache: "no-store", redirect: "manual", signal: AbortSignal.timeout(10_000),
})
const selectedBody: unknown = await selectedResponse.json().catch(() => undefined)
const candidates = selectedBody && typeof selectedBody === "object" &&
  "installations" in selectedBody && Array.isArray(selectedBody.installations)
  ? selectedBody.installations : []
if (selectedResponse.status !== 200 || candidates.length !== 1)
  throw new Error("SF_VISUAL_EXACT_INSTALLED_OWNER_REQUIRED_HTTP_" + selectedResponse.status +
    "_COUNT_" + candidates.length)
const installed = candidates[0] as Record<string, unknown>
if (installed.publicOrigin !== base || installed.mount !== "/sucafina" ||
    typeof installed.projectId !== "string" || !installed.projectId ||
    typeof installed.installationId !== "string" || !installed.installationId ||
    typeof installed.hostId !== "string" || !installed.hostId ||
    installed.contractRevision !== "sf-native-ui/1")
  throw new Error("SF_VISUAL_SELECTED_OWNER_PROVENANCE_INVALID")
console.log("SF_VISUAL_REAL_INSTALLED_SELECTION_OK")
const owner = { server: base, project: installed.projectId, installation: installed.installationId }
// Diagnostic ONLY: original producer admission, without exposing user/context contents.
const nativeContextURL = new URL("/sucafina/api/ui/context", base)
nativeContextURL.search = new URLSearchParams({
  installationId: installed.installationId, projectId: installed.projectId, hostId: installed.hostId,
}).toString()
const contextResponse = await fetch(nativeContextURL, {
  method: "GET", cache: "no-store", redirect: "manual", signal: AbortSignal.timeout(15_000),
  headers: { Cookie: cookie[1] + "=" + cookie[2],
    Authorization: "Basic " + token, Accept: "application/json" },
})
const contextBody: unknown = await contextResponse.json().catch(() => undefined)
const ctx = contextBody && typeof contextBody === "object" ? contextBody as Record<string, unknown> : {}
const value = ctx.value && typeof ctx.value === "object" ? ctx.value as Record<string, unknown> : {}
const availability = Array.isArray(value.availability) ? value.availability : []
const cap01 = availability.find((item: unknown) => item && typeof item === "object" &&
  "resource" in item && item.resource === "CAP01") as
  { operations?: { operationId: string; state: string; operational: boolean }[] } | undefined
const op = cap01?.operations?.find((row) => row.operationId === "domain.page.CAP01")
console.log("SF_VISUAL_DIRECT_CONTEXT_HTTP_" + contextResponse.status + "_STATUS_" +
  String(ctx.status ?? "unparsed") + "_CAP01_" + String(op?.state ?? "absent") +
  "_OPERATIONAL_" + String(op?.operational ?? false))
const cases = [
  { id: "today", route: "/orchestra/sf-home", title: "Today" },
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
        const url = new URL(response.url())
        if (url.pathname === "/api/sucafina/installations") {
          // Never log IDs, Location.Ref or bearer credentials; status plus count only.
          void response.json().then((body: unknown) => {
            const count = body && typeof body === "object" && "installations" in body &&
              Array.isArray(body.installations) ? body.installations.length : "invalid-body"
            diagnostics.push("discovery " + response.status() + " count=" + count)
          }).catch(() => diagnostics.push("discovery " + response.status() + " unreadable"))
        } else if (url.pathname === "/sucafina/api/ui/context") {
          void response.json().then((body: unknown) => {
            const ctx = body && typeof body === "object" ? body as Record<string, unknown> : {}
            const value = ctx.value && typeof ctx.value === "object" ? ctx.value as Record<string, unknown> : {}
            const availability = Array.isArray(value.availability) ? value.availability : []
            const cap01 = availability.find((item: unknown) =>
              item && typeof item === "object" && "resource" in item && item.resource === "CAP01") as
              { operations?: { operationId: string; state: string; operational: boolean }[] } | undefined
            const op = cap01?.operations?.find((value) => value.operationId === "domain.page.CAP01")
            diagnostics.push("ctx.context HTTP " + response.status() + " status=" + String(ctx.status) +
              " CAP01=" + String(op?.state ?? "absent") + " operational=" + String(op?.operational ?? false))
          }).catch(() => diagnostics.push("ctx.context HTTP " + response.status() + " unreadable"))
        } else if (response.status() >= 400) diagnostics.push("HTTP " + response.status() + " " + url.pathname)
      })
      page.on("console", (message) => {
        if (message.type() === "error") diagnostics.push("console-error " + message.text().slice(0, 160))
      })
      try {
        // F01's source-defined triplet is retained after the auth token is removed
        // by the web entry, and gets rechecked by original ctx.context on each route.
        const url = base + visit.route + "?" + new URLSearchParams({
          ...owner, auth_token: token,
        }).toString()
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
          ownerProviderStatus: document.querySelector('[data-sf-host="owner-runtime231"]')?.getAttribute("data-sf-provider-status") ?? null,
          ownerViewStatus: document.querySelector('[data-sf-host="owner-runtime231"]')?.getAttribute("data-sf-view-status") ?? null,
          ownerDiscoveryStatus: document.querySelector('[data-sf-host="owner-runtime231"]')?.getAttribute("data-sf-discovery-status") ?? null,
          discoveryState: document.querySelector("[data-sf-f01]")?.getAttribute("data-sf-f01") ?? null,
          selectedServerOriginMatches: Object.keys(localStorage).filter((name) => name.endsWith(":server")).length > 0,
          rootOrigin: location.origin,
        })).catch(() => null)
        const clean = (value: string) => value
          .replace(/auth_token=[^&\s]+/gi, "auth_token=[redacted]")
          .replace(/[a-f0-9]{32,}/gi, "[redacted]")
        const report = { status: "FAILED_NATIVE_FRAME_NOT_MOUNTED", sourceSHA: process.env.GITHUB_SHA,
          chapter: visit.id, scheme, facts, text: clean(text).slice(0, 350), diagnostics: diagnostics.map(clean).slice(-50) }
        console.error("SF_VISUAL_CAPTURE_DIAGNOSTIC " + JSON.stringify(report))
        await writeFile(path.join(out, "FAILED-" + visit.id + "-" + scheme + ".json"), JSON.stringify(report, null, 2))
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
