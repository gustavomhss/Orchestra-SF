/// <reference types="vite/client" />
import { expect, spyOn, test } from "bun:test"
import { setImmediate } from "node:timers"
import { createComponent } from "solid-js"
import { render } from "solid-js/web"
import { Schema } from "effect"
import { SfTeamContext, SfTeamInstallationDescriptor } from "@orchestra/schema/sucafina/context"
import { TeamProfile } from "@orchestra/schema/sucafina/team-profile"
import { solidDom } from "./real-ui-solid"

const { SfTeamWebApp }: typeof import("../src/pages/team-profile") =
  await import(solidDom("../src/pages/team-profile", import.meta.dir))
const navigation: typeof import("../src/context/team-profile-navigation") =
  await import(solidDom("../src/context/team-profile-navigation", import.meta.dir))
const routes: typeof import("../src/orchestra/chapters/sucafina/host/team-domain-route") =
  await import(solidDom("../src/orchestra/chapters/sucafina/host/team-domain-route", import.meta.dir))
const { encodeSfRouteRef }: typeof import("../src/orchestra/chapters/sucafina/navigation-state") =
  await import(solidDom("../src/orchestra/chapters/sucafina/navigation-state", import.meta.dir))
const { LanguageProvider }: typeof import("../src/context/language") =
  await import(solidDom("../src/context/language", import.meta.dir))
const { PlatformProvider }: typeof import("../src/context/platform") =
  await import(solidDom("../src/context/platform", import.meta.dir))
const { DialogProvider }: typeof import("@orchestra/ui/context/dialog") =
  await import(solidDom("@orchestra/ui/context/dialog", import.meta.dir))

const binding = Schema.decodeUnknownSync(SfTeamInstallationDescriptor)({
  installationId: "hooks-installation", tenantId: "11111111-2222-4333-8444-555555555555",
  projectId: "technical-project", hostId: "hooks-host", publicOrigin: "https://teams.example.test", mount: "/sucafina",
  contractRevision: "sf-team-profile/1", authMode: "microsoft",
})
const a = "a1111111-2222-4333-8444-555555555555", b = "b1111111-2222-4333-8444-555555555555"
const firstPrincipal = "c1111111-2222-4333-8444-555555555555", nextPrincipal = "d1111111-2222-4333-8444-555555555555"
const caps = ["CAP14", "CAP04", "CAP05"] as const
type Cap = typeof caps[number]
const pages = { CAP14: "Vendor Contracts", CAP04: "OPEX Detail", CAP05: "CAPEX Projects" } as const
const profile = (teamObjectId: string) => Schema.decodeUnknownSync(TeamProfile.Ref)({
  installationId: binding.installationId, tenantId: binding.tenantId, teamObjectId,
})
const json = (value: unknown, status = 200) => Response.json(value, { status, headers: { "cache-control": "no-store" } })
const tick = () => new Promise<void>((resolve) => setImmediate(resolve))
async function eventually(check: () => boolean) {
  const deadline = Date.now() + 6000
  while (!check()) { if (Date.now() > deadline) throw new Error("Expected original integrated Team UI to settle"); await tick() }
}

/** Original shell, F02 reader, Team clients, native leaves and draft registries; only HTTP is controlled. */
function fixture(cap?: Cap, edit = false, signedIn = true) {
  const originalHref = window.location.href, requests: Request[] = []
  let principalObjectId = firstPrincipal, revision = 0, revoked = false, lostPost = false
  let hook: ((request: Request) => Promise<Response | undefined>) | undefined
  const records = new Map([a, b].map((team) => [team, { vendor: "Private " + (team === a ? "A" : "B") + " vendor", version: 1 }]))
  const owner = (team: string) => ({ profile: profile(team), principal: { tenantId: binding.tenantId, principalObjectId } })
  const namespace = (team: string) => Schema.decodeUnknownSync(TeamProfile.SessionNamespace)({ version: 1, owner: owner(team), authorityGeneration: 1 })
  const context = (team: string | null) => {
    const admitted = team !== null && !revoked, accessRevision = "hooks-access-" + revision
    const actions = (cap: Cap) => cap === "CAP14" ? ["save", "delete"] :
      ["save", "delete", "save-entry", "save-deviation", "annual-entry", "year-amount"]
    const choices = [{ profile: profile(a), displayName: "Team A" }, { profile: profile(b), displayName: "Team B" }]
    return Schema.decodeUnknownSync(SfTeamContext)({
      contractRevision: binding.contractRevision, authMode: binding.authMode,
      stamp: { installationId: binding.installationId, projectId: binding.projectId, hostId: binding.hostId,
        principalRef: principalObjectId, policyVersion: "policy-one", accessRevision,
        ...(admitted ? { team: { owner: owner(team), revisions: { configRevision: 0, accessRevision } } } : {}) },
      profile: { contractRevision: binding.contractRevision, status: "authenticated", installationId: binding.installationId,
        principal: owner(a).principal, accessRevision, administration: { status: "denied" },
        teams: revoked ? { status: "revoked" } : admitted ?
          { status: "ready", selected: profile(team), configRevision: 0, choices } : { status: "selection-required", choices } },
      destinations: admitted ? caps.map((capabilityId) => ({ capabilityId, surface: "dashboard", page: pages[capabilityId],
        canRead: true, allowedActionIds: actions(capabilityId) })) : [],
      availability: admitted ? caps.map((cap) => ({ family: "domain-read", resource: cap, state: "ready", operations: [
        { operationId: "domain.page." + cap, state: "ready", reason: null, operational: true },
        ...actions(cap).map((action) => ({ operationId: "domain.command." + cap + "." + action,
          state: "ready", reason: null, operational: true })),
      ] })) : [],
    })
  }
  const domainHref = (cap: Cap, team = a, edit = false) => {
    const url = new URL(routes.sfTeamDomainHref(binding, context(team), cap)!, binding.publicOrigin)
    if (edit) url.pathname += "/" + encodeSfRouteRef(cap === "CAP14" ? "contract-one" : "line-one") + "/edit"
    return url.href
  }
  const home = (team?: string) => binding.publicOrigin + "/" + (team ? "?" + new URLSearchParams({
    contractRevision: binding.contractRevision, server: binding.publicOrigin,
    installationId: binding.installationId, tenantId: binding.tenantId, teamObjectId: team,
  }) : "")
  window.location.href = cap ? domainHref(cap, a, edit) : home(a)
  const page = (team: string, cap: Cap, year = 2026) => {
    const current = context(team), row = records.get(team)!, label = team === a ? "Private A" : "Private B"
    const owners = [{ id: "line-one", name: label + " budget", budget: 1200 }]
    return { status: "ok", context: current.stamp, value: {
      capabilityId: cap, selection: cap === "CAP14" ? {} : { year, month: 11 },
      data: cap === "CAP14" ? { contracts: [{ id: "contract-one", vendor: row.vendor, name: label + " agreement" }] } :
        cap === "CAP04" ? { opexOwners: owners, opexEntries: [], deviations: {}, budgetYtd: { opex: {} }, budgetLineIds: ["line-one"] } :
          { capexProjects: owners, capexEntries: [], deviations: {}, budgetYtd: { capex: {} }, budgetLineIds: ["line-one"] },
      versions: cap === "CAP14" ? { "contracts:contract-one": row.version } :
        cap === "CAP04" ? { "opexOwners:line-one": 1 } : { "capexProjects:line-one": 1 },
      allowedActionIds: current.destinations.find((item) => item.capabilityId === cap)!.allowedActionIds,
    } }
  }
  const streams = new Set<ReadableStreamDefaultController<Uint8Array>>()
  const fetch = spyOn(globalThis, "fetch").mockImplementation(async (raw, init) => {
    const request = new Request(new URL(raw instanceof Request ? raw.url : raw.toString(), window.location.href), init)
    requests.push(request.clone())
    const overridden = await hook?.(request.clone())
    if (overridden) return overridden
    const url = new URL(request.url), path = url.pathname
    if (path === "/api/sucafina/installations") return json({ installations: [binding] })
    if (path === binding.mount + "/auth/logout") { signedIn = false; return new Response(null, { status: 204 }) }
    if (!signedIn) return json({ status: "unauthenticated" }, 401)
    if (path === binding.mount + "/api/ui/context") return json({ status: "ok", value: context(url.searchParams.get("teamObjectId")) })
    const selector = Schema.decodeUnknownSync(TeamProfile.Selector)(JSON.parse(request.headers.get("x-sf-team-profile") ?? "null"))
    if (selector.kind !== "team") throw new Error("Expected original complete Team request selector")
    const team = selector.profile.teamObjectId
    const cap = caps.find((candidate) => path === binding.mount + "/api/ui/pages/" + candidate)
    if (cap && request.method === "GET") return json(page(team, cap, Number(url.searchParams.get("year") ?? 2026)))
    if (path === binding.mount + "/teams/" + team + "/dashboard" && request.method === "POST") {
      const body = await request.json(), row = records.get(team)!
      if (body.page !== pages.CAP14 || body.action !== "save") throw new Error("Unexpected controlled command")
      if (lostPost) { lostPost = false; throw new Error("Response lost; effect unconfirmed") }
      if (body.version !== row.version) return json({ ok: false, status: 409, currentVersionCAS: row.version }, 409)
      records.set(team, { vendor: body.values.vendor, version: row.version + 1 })
      return json({ ok: true })
    }
    if (path === binding.mount + "/api/session" && request.method === "GET")
      return json({ namespace: namespace(team), cursor: {}, data: [] })
    if (path === binding.mount + "/api/session/active" && request.method === "GET")
      return json({ data: {}, namespace: namespace(team) })
    if (path === binding.mount + "/api/event" && request.method === "GET") {
      let active: ReadableStreamDefaultController<Uint8Array> | undefined
      return new Response(new ReadableStream<Uint8Array>({
        start(controller) {
          active = controller; streams.add(controller)
          controller.enqueue(new TextEncoder().encode("data: " + JSON.stringify({
            namespace: namespace(team), event: { id: "evt_hooks_connected", type: "server.connected", data: {} },
          }) + "\n\n"))
        }, cancel() { if (active) streams.delete(active) },
      }), { headers: { "content-type": "text/event-stream", "cache-control": "no-store" } })
    }
    throw new Error("Unexpected controlled HTTP: " + request.method + " " + path)
  })
  const host = document.createElement("div")
  document.body.append(host)
  const dispose = render(() => createComponent(PlatformProvider, {
    value: { platform: "web", openExternal() {}, async restart() {}, async notify() {} },
    get children() { return createComponent(LanguageProvider, { locale: "en", get children() {
      return createComponent(DialogProvider, { get children() { return createComponent(SfTeamWebApp, {}) } })
    } }) },
  }), host)
  const click = (selector: string) => {
    const element = host.querySelector<HTMLElement>(selector)
    if (!element) throw new Error("Expected original Team control: " + selector)
    element.click()
  }
  const field = () => {
    const input = host.querySelector<HTMLInputElement>('[data-field="vendor"] input')
    if (!input) throw new Error("Expected original CAP14 editor")
    return input
  }
  return { host, requests, records, context, page, domainHref, home, click, field,
    selected: () => host.querySelector("[data-sf-teams-shell]")?.getAttribute("data-sf-team-selected"),
    state: () => host.querySelector("[data-sf-teams-shell]")?.getAttribute("data-sf-teams-state"),
    writes: () => requests.filter((r) => r.method === "POST" && new URL(r.url).pathname.endsWith("/dashboard")),
    edit(value: string) { const input = field(); input.value = value; input.dispatchEvent(new Event("input", { bubbles: true })) },
    submit() {
      const form = host.querySelector<HTMLFormElement>("form.sf-u15-edit")
      if (!form) throw new Error("Expected original CAP14 form")
      form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }))
      click(".sf-u15-review .sf-s03-actions button.primary")
    },
    choose(team: string) {
      const select = host.querySelector<HTMLSelectElement>("[data-sf-team-picker]")!
      select.value = team; select.dispatchEvent(new Event("change", { bubbles: true }))
    },
    focus() { window.dispatchEvent(new Event("focus")) },
    navigate(href: string) { window.history.pushState(null, "", href); window.dispatchEvent(new Event("popstate")) },
    authenticated(value: boolean) { signedIn = value },
    revoke(value: boolean) { revoked = value; revision++ },
    principal(value: string) { principalObjectId = value; revision++ },
    losePost() { lostPost = true }, setHook(value: typeof hook) { hook = value },
    close() {
      dispose(); host.remove()
      for (const controller of streams) controller.close()
      streams.clear(); fetch.mockRestore(); window.location.href = originalHref
    },
  }
}

async function editor(view: ReturnType<typeof fixture>) {
  await eventually(() => !!view.host.querySelector('[data-field="vendor"] input'))
}
const dialog = (view: ReturnType<typeof fixture>) => !!view.host.querySelector("dialog[data-sf-draft-guard][open]")

test("the public Team navigation seam preserves canonical domain deep links and drops record refs on owner change", () => {
  const query = new URLSearchParams({ contractRevision: binding.contractRevision, server: binding.publicOrigin,
    installationId: binding.installationId, tenantId: binding.tenantId, teamObjectId: a })
  for (const path of ["/orchestra/sf-procurement/contracts", "/orchestra/sf-dashboard/opex", "/orchestra/sf-dashboard/capex"]) {
    for (const suffix of ["", "/new", "/" + encodeSfRouteRef("café"), "/" + encodeSfRouteRef("café") + "/edit"]) {
      const url = new URL(path + suffix + "?" + query, binding.publicOrigin)
      if (!path.endsWith("contracts")) url.searchParams.set("year", "2026")
      expect(navigation.readTeamNavigationIntent(url, binding)).toEqual(routes.readSfTeamDomainIntent(url, binding)?.selector)
      expect(navigation.teamNavigationReturnTo(url, binding)).toBe(url.pathname + url.search)
      expect(navigation.teamNavigationURL(url, binding, profile(a))?.href).toBe(url.href)
      const changed = navigation.teamNavigationURL(url, binding, profile(b))!
      expect(changed.pathname).toBe(path)
      expect(changed.searchParams.get("teamObjectId")).toBe(b)
      expect(changed.searchParams.get("year")).toBe(path.endsWith("contracts") ? null : "2026")
      const partial = new URL(url); partial.searchParams.delete("tenantId")
      expect(navigation.readTeamNavigationIntent(partial, binding)).toBeUndefined()
      const authority = new URL(url); authority.searchParams.set("principalRef", firstPrincipal)
      expect(navigation.teamNavigationReturnTo(authority, binding)).toBeUndefined()
    }
  }
})

test("the real Team shell preserves a closed CAP05 login return and admits its original leaf after F02", async () => {
  const view = fixture("CAP05", true, false), target = window.location.href
  try {
    await eventually(() => view.state() === "unauthenticated")
    const login = view.host.querySelector<HTMLAnchorElement>('a[href*="/auth/login?"]')!
    expect(new URL(login.href).searchParams.get("returnTo")).toBe(new URL(target).pathname + new URL(target).search)
    expect(view.host.querySelector("[data-sf-team-domain-page]")).toBeNull()
    view.authenticated(true); view.focus()
    await eventually(() => !!view.host.querySelector('[data-sf-team-domain-page="CAP05"]')?.textContent?.includes("Private A"))
    expect(window.location.href).toBe(target)
    expect(view.requests.filter((r) => r.method !== "GET")).toHaveLength(0)
  } finally { view.close() }
}, 15000)

test("product links mount all three original Team leaves through the shell with fresh complete F02 reads", async () => {
  const view = fixture()
  try {
    await eventually(() => view.selected() === a)
    for (const cap of ["CAP04", "CAP05", "CAP14"] as const) {
      const before = view.requests.length
      view.click('[data-sf-team-domain-navigation] a[data-sf-capability-id="' + cap + '"]')
      await eventually(() => !!view.host.querySelector('[data-sf-team-domain-page="' + cap + '"]')?.textContent?.includes("Private A"))
      const url = new URL(window.location.href)
      expect(routes.readSfTeamDomainIntent(url, binding)?.candidate.surfaceId).toBe(cap)
      expect(url.searchParams.get("teamObjectId")).toBe(a)
      const reads = view.requests.slice(before).filter((r) => new URL(r.url).pathname.endsWith("/api/ui/context"))
      expect(reads.length).toBeGreaterThan(0)
      expect(reads.every((r) => new URL(r.url).searchParams.get("teamObjectId") === a)).toBe(true)
    }
    expect(view.writes()).toHaveLength(0)
  } finally { view.close() }
}, 15000)

test("focus keeps the owner registry while Team picker cancellation retains drafts and confirmation drops old record intent", async () => {
  const view = fixture("CAP14", true), original = window.location.href
  try {
    await editor(view); view.edit("Unsent A detail")
    view.focus(); await eventually(() => view.host.querySelector<HTMLInputElement>('[data-field="vendor"] input')?.value === "Unsent A detail")
    const unload = new Event("beforeunload", { cancelable: true }); window.dispatchEvent(unload)
    expect(unload.defaultPrevented).toBe(true)
    const before = view.requests.length
    view.choose(b); await eventually(() => dialog(view))
    expect(view.requests.slice(before).some((r) => new URL(r.url).searchParams.get("teamObjectId") === b)).toBe(false)
    view.click("[data-sf-keep-editing]"); await tick()
    expect(view.field().value).toBe("Unsent A detail"); expect(window.location.href).toBe(original)
    view.choose(b); await eventually(() => dialog(view)); view.click("[data-sf-confirm-discard]")
    await eventually(() => view.selected() === b && !!view.host.textContent?.includes("Private B vendor"))
    expect(new URL(window.location.href).pathname).toBe("/orchestra/sf-procurement/contracts")
    expect(view.host.textContent).not.toContain("Unsent A detail")
    view.navigate(original); await editor(view)
    expect(view.field().value).toBe("Private A vendor")
    expect(view.writes()).toHaveLength(0)
  } finally { view.close() }
}, 15000)

test("history hides a private leaf before consent and a cancelled traversal restores the same unsent draft", async () => {
  const view = fixture("CAP14", true), original = window.location.href
  try {
    await editor(view); view.edit("History private draft")
    view.navigate(view.domainHref("CAP04")); await eventually(() => dialog(view))
    expect(view.host.querySelector('[data-field="vendor"] input')).toBeNull()
    view.click("[data-sf-keep-editing]")
    await eventually(() => window.location.href === original && view.host.querySelector<HTMLInputElement>('[data-field="vendor"] input')?.value === "History private draft")
    view.navigate(view.domainHref("CAP04")); await eventually(() => dialog(view)); view.click("[data-sf-confirm-discard]")
    await eventually(() => !!view.host.querySelector('[data-sf-team-domain-page="CAP04"]')?.textContent?.includes("Private A"))
    expect(view.writes()).toHaveLength(0)
  } finally { view.close() }
}, 15000)

test("domain and real Chat navigation both honor the existing discard dialog without sending either draft", async () => {
  const view = fixture("CAP14", true)
  try {
    await editor(view); view.edit("Keep domain draft")
    view.click("[data-sf-new-chat]"); await eventually(() => dialog(view)); view.click("[data-sf-keep-editing]")
    await tick(); expect(view.field().value).toBe("Keep domain draft")
    view.click("[data-sf-new-chat]"); await eventually(() => dialog(view)); view.click("[data-sf-confirm-discard]")
    const selector = '[data-component="prompt-input-v2"] [data-component="prompt-input"]'
    await eventually(() => !!view.host.querySelector(selector))
    const chat = view.host.querySelector<HTMLDivElement>(selector)!
    chat.focus(); chat.replaceChildren(document.createTextNode("Keep Chat draft"))
    const range = document.createRange(); range.selectNodeContents(chat); range.collapse(false)
    window.getSelection()?.removeAllRanges(); window.getSelection()?.addRange(range)
    chat.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText", data: "Keep Chat draft" }))
    view.click('a[data-sf-capability-id="CAP14"]'); await eventually(() => dialog(view)); view.click("[data-sf-keep-editing]")
    await tick(); expect(view.host.querySelector(selector)?.textContent).toBe("Keep Chat draft")
    view.click('a[data-sf-capability-id="CAP14"]'); await eventually(() => dialog(view)); view.click("[data-sf-confirm-discard]")
    await eventually(() => !!view.host.querySelector('[data-sf-team-domain-page="CAP14"]')?.textContent?.includes("Private A vendor"))
    expect(view.requests.filter((r) => r.method === "POST")).toHaveLength(0)
  } finally { view.close() }
}, 15000)

test("an uncertain domain POST survives focus without replay and logout retires the private owner", async () => {
  const view = fixture("CAP14", true)
  try {
    await editor(view); view.edit("Uncertain private edit"); view.losePost(); view.submit()
    await eventually(() => !!view.host.querySelector(".sf-u15-notice[role=alert]"))
    expect(view.writes()).toHaveLength(1)
    view.focus(); await eventually(() => view.host.querySelector<HTMLInputElement>('[data-field="vendor"] input')?.value === "Uncertain private edit")
    view.submit(); await eventually(() => !!view.host.querySelector(".sf-u15-notice[role=alert]"))
    expect(view.writes()).toHaveLength(1)
    const target = window.location.href
    view.click('a[data-sf-capability-id="CAP04"]'); await eventually(() => dialog(view)); view.click("[data-sf-confirm-discard]")
    await tick(); expect(window.location.href).toBe(target)
    view.click("[data-sf-sign-out]")
    await eventually(() => view.state() === "unauthenticated")
    expect(new URL(window.location.href).pathname).toBe("/")
    expect(new URL(window.location.href).search).toBe("")
    expect(view.host.textContent).not.toContain("Uncertain private edit")
    view.principal(nextPrincipal); view.authenticated(true); view.focus()
    await eventually(() => view.state() === "authenticated")
    expect(view.selected()).toBeNull()
    expect(view.host.querySelector("[data-sf-team-domain-page]")).toBeNull()
    expect(view.writes()).toHaveLength(1)
  } finally { view.close() }
}, 15000)

test("fresh revocation purges a domain draft and late old-Team page responses cannot publish in a replacement owner", async () => {
  const view = fixture("CAP14", true)
  let resolve: ((value: Response) => void) | undefined
  try {
    await editor(view); view.edit("Revoked private data")
    view.revoke(true); view.focus()
    await eventually(() => view.selected() === null && view.state() === "authenticated")
    expect(view.host.querySelector('[data-field="vendor"] input')).toBeNull()
    expect(view.host.textContent).not.toContain("Revoked private data")
    view.revoke(false); view.principal(nextPrincipal); view.focus(); await editor(view)
    expect(view.field().value).toBe("Private A vendor")
    const oldPage = view.page(a, "CAP14")
    view.setHook(async (request) => {
      if (new URL(request.url).pathname.endsWith("/pages/CAP14") && !resolve)
        return new Promise<Response>((done) => { resolve = done })
    })
    view.focus(); await eventually(() => !!resolve)
    view.choose(b)
    await eventually(() => view.selected() === b && !!view.host.textContent?.includes("Private B vendor"))
    resolve!(json(oldPage)); await tick(); await tick()
    expect(view.host.textContent).not.toContain("Private A vendor")
    expect(view.host.textContent).not.toContain("Revoked private data")
    expect(view.writes()).toHaveLength(0)
  } finally { resolve?.(json({ status: "unavailable", reason: "cleanup" }, 503)); view.close() }
}, 15000)
