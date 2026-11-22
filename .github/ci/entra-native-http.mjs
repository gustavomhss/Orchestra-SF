import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { resolve, sep } from "node:path"
import { createRequire } from "node:module"
import { exerciseTeamC17 } from "./entra-team-c17.mjs"

const { SF_PROOF_PORT: port, SF_PROOF_KEY: ingressProof, SF_PROOF_WEB: webRoot } = process.env
assert(port && ingressProof && webRoot)
const origin = "https://sf.example.test"
const local = "http://127.0.0.1:" + port
const mount = "/sucafina"
const team = "44444444-4444-4444-8444-444444444444"
const dashboard = mount + "/dashboard"
const expectedTeamRoute = mount + "/teams/" + team + "/dashboard"
const host = "sf-ingress.example.test:" + port
function request(path, { cookie, withProof = true, accept = "text/html", method = "GET", json, idempotencyKey, originHeader, timeout = 20_000 } = {}) {
  return fetch(local + path, {
    redirect: "manual",
    method,
    body: json === undefined ? undefined : JSON.stringify(json),
    signal: AbortSignal.timeout(timeout),
    headers: {
      accept,
      host,
      ...(json === undefined ? {} : { "content-type": "application/json" }),
      ...(json === undefined && !originHeader ? {} : { origin }),
      ...(idempotencyKey ? { "idempotency-key": idempotencyKey } : {}),
      ...(withProof ? { "x-sf-ingress-proof": ingressProof } : {}),
      ...(cookie ? { cookie } : {}),
    },
  })
}

async function signIn(identity) {
  const start = await request(mount + "/auth/login?returnTo=%2F")
  assert.equal(start.status, 303, "login start")
  const authority = new URL(start.headers.get("location"))
  assert.equal(authority.origin, "https://login.microsoftonline.com")
  assert.equal(authority.searchParams.get("redirect_uri"), origin + mount + "/auth/callback")
  const nonce = authority.searchParams.get("nonce")
  const challenge = authority.searchParams.get("code_challenge")
  const state = authority.searchParams.get("state")
  assert(nonce && challenge && state)
  const login = start.headers.getSetCookie().find((value) => value.includes("_login="))
  assert(login?.includes("; Secure"))
  const params = new URLSearchParams({ code: [identity, nonce, challenge].join("."), state })
  const finish = await request(mount + "/auth/callback?" + params, { cookie: login.split(";")[0] })
  assert.equal(finish.status, 303, "signed callback")
  assert.equal(new URL(finish.headers.get("location"), origin).href, origin + "/", "callback returns to native Web root")
  const session = finish.headers.getSetCookie().find((value) => value.includes("_session="))
  assert(session?.includes("; Secure") && session.includes("; HttpOnly"))
  return session.split(";")[0]
}

assert.equal((await request(dashboard, { withProof: false })).status, 403, "untrusted ingress")
const anonymous = await request(dashboard)
assert.equal(anonymous.status, 303, "anonymous dashboard")
assert.equal(anonymous.headers.get("location"), mount + "/auth/login")

const offered = await request("/api/sucafina/installations?select=current&contractRevision=sf-team-profile%2F1", {
  accept: "application/json",
})
assert.equal(offered.status, 200, "native Web discovery")
assert.equal(offered.headers.get("cache-control"), "no-store")
const { installations } = await offered.json()
assert.equal(installations.length, 1)
const [binding] = installations
assert.equal(binding.publicOrigin, origin)
assert.equal(binding.contractRevision, "sf-team-profile/1")
assert.equal(binding.mount, mount)
assert.equal(binding.tenantId, "11111111-1111-4111-8111-111111111111")
assert(binding.installationId && binding.hostId)

const allowed = await signIn("allowed")
assert.equal((await request("/", { cookie: allowed, withProof: false })).status, 403, "shell first checks trusted ingress")
const page = await request("/", { cookie: allowed })
assert.equal(page.status, 200, "native Web root")
const html = await page.text()
assert.match(html, /<html\b[^>]*data-orchestra-brand=["']sucafina["']/i)
assert.match(html, /<html\b[^>]*data-sucafina-artwork=["']ready["']/i)
const script = [...html.matchAll(/<script\b[^>]*\bsrc=["']([^"']+\.js)["']/gi)][0]?.[1]
assert(script, "native HTML references an actual JS build")
const asset = new URL(script, origin + "/")
assert.equal(asset.origin, origin)
const real = resolve(webRoot, asset.pathname.slice(1))
assert(real.startsWith(resolve(webRoot) + sep))
assert.equal((await request(asset.pathname, { cookie: allowed, withProof: false })).status, 403, "asset first checks trusted ingress")
const payload = await request(asset.pathname, { cookie: allowed })
assert.equal(payload.status, 200, "Web JavaScript asset")
assert.match(payload.headers.get("content-type") ?? "", /javascript/i)
assert(Buffer.from(await payload.arrayBuffer()).equals(await readFile(real)), "served bundle matches installed bytes")

const query = new URLSearchParams({
  contractRevision: binding.contractRevision,
  installationId: binding.installationId,
  tenantId: binding.tenantId,
  hostId: binding.hostId,
  kind: "team",
  teamObjectId: team,
})
const context = mount + "/api/ui/context?" + query
assert.equal((await request(context, { accept: "application/json" })).status, 401, "native Team context requires login")
const admitted = await request(context, { cookie: allowed, accept: "application/json" })
assert.equal(admitted.status, 200, "eligible account reads the Team context")
const admittedContext = await admitted.json()
assert.equal(admittedContext.status, "ok")
assert.equal(admittedContext.value.profile.teams.selected.teamObjectId, team)

const denied = await signIn("denied")
assert(denied !== allowed, "isolated session cookies")
assert.equal((await request(dashboard, { cookie: denied })).status, 403, "authenticated account with no Team")
assert.equal((await request(expectedTeamRoute, { cookie: denied })).status, 403, "direct Team URL cannot bypass admission")
const deniedContext = await request(context, { cookie: denied, accept: "application/json" })
assert.equal(deniedContext.status, 403, "native Team context denies account")
const deniedResult = await deniedContext.json()
assert(deniedResult?.status === "denied" && Object.keys(deniedResult).length === 1, "no Team payload is returned")
console.log("ENTRA_NATIVE_TEAM_DENIAL_OK: authenticated account received 403 on dashboard and direct Team URL")
// Load Playwright from the candidate's locked workspace, not a global install.
const { chromium } = createRequire(resolve(process.env.GITHUB_WORKSPACE, "packages/app-shell/package.json"))("@playwright/test")
const browser = await chromium.launch()
try {
  for (const [session, eligible] of [[allowed, true], [denied, false]]) {
    const browserContext = await browser.newContext({ serviceWorkers: "block" })
    try {
      const separator = session.indexOf("=")
      await browserContext.addCookies([{
        name: session.slice(0, separator), value: session.slice(separator + 1),
        domain: new URL(origin).hostname, path: mount, secure: true, httpOnly: true, sameSite: "Lax",
      }])
      // Preserve the browser's HTTPS origin. Forward only this host through the real
      // installed loopback listener using the same ingress proof as the proxy.
      await browserContext.route("**/*", async (route) => {
        const incoming = route.request()
        const url = new URL(incoming.url())
        if (url.origin !== origin) return route.abort()
        const headers = await incoming.allHeaders()
        delete headers["content-length"]
        const upstream = await fetch(local + url.pathname + url.search, {
          method: incoming.method(),
          redirect: "manual",
          signal: AbortSignal.timeout(url.searchParams.get("sf") === "current-choice-prepare" ? 320_000 : url.searchParams.has("sf") ? 120_000 : 15_000),
          headers: { ...headers, host, "x-sf-ingress-proof": ingressProof },
          body: incoming.postDataBuffer() ?? undefined,
        })
        const forwarded = Object.fromEntries(upstream.headers)
        delete forwarded["content-encoding"]
        delete forwarded["content-length"]
        await route.fulfill({ status: upstream.status, headers: forwarded, body: Buffer.from(await upstream.arrayBuffer()) })
      })
      const tab = await browserContext.newPage()
      const shell = tab.locator("[data-sf-teams-shell]")
      await tab.goto(origin + "/", { waitUntil: "domcontentloaded", timeout: 30_000 })
      await shell.waitFor({ timeout: 25_000 })
      if (eligible) {
        await tab.locator(`[data-sf-team-selected="${team}"]`).waitFor({ timeout: 25_000 })
        await exerciseTeamC17({ tab, request, origin, binding, team, allowed, denied, signIn })
      } else {
        await tab.waitForFunction(() => {
          const node = document.querySelector("[data-sf-teams-shell]")
          const status = node?.getAttribute("data-sf-teams-state")
          return status === "denied" || (status === "authenticated" && !node.hasAttribute("data-sf-team-selected"))
        }, undefined, { timeout: 25_000 })
        assert.equal(await tab.locator("[data-sf-team-selected]").count(), 0, "no Team is rendered for the ineligible account")
      }
    } finally {
      await browserContext.close()
    }
  }
} finally {
  await browser.close()
}
console.log("ENTRA_NATIVE_PACKAGE_OK: installed Web rendered by Chromium, exact JS bytes, separate signed sessions, no-Team and direct-Team 403")
