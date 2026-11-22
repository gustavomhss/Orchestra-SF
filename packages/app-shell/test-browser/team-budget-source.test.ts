/// <reference types="vite/client" />
import { expect, spyOn, test } from "bun:test"
import { setImmediate } from "node:timers"
import { batch, createComponent } from "solid-js"
import { render } from "solid-js/web"
import { Schema } from "effect"
import { SfTeamContext, SfTeamInstallationDescriptor } from "@orchestra/schema/sucafina/context"
import { TeamProfile } from "@orchestra/schema/sucafina/team-profile"
import { solidDom } from "./real-ui-solid"

const { SfTeamWebApp }: typeof import("../src/pages/team-profile") =
  await import(solidDom("../src/pages/team-profile", import.meta.dir))
const routes: typeof import("../src/orchestra/chapters/sucafina/host/team-domain-route") =
  await import(solidDom("../src/orchestra/chapters/sucafina/host/team-domain-route", import.meta.dir))
const navigation: typeof import("../src/context/team-profile-navigation") =
  await import(solidDom("../src/context/team-profile-navigation", import.meta.dir))
const { encodeSfRouteRef }: typeof import("../src/orchestra/chapters/sucafina/navigation-state") =
  await import(solidDom("../src/orchestra/chapters/sucafina/navigation-state", import.meta.dir))
const { LanguageProvider }: typeof import("../src/context/language") =
  await import(solidDom("../src/context/language", import.meta.dir))
const { PlatformProvider }: typeof import("../src/context/platform") =
  await import(solidDom("../src/context/platform", import.meta.dir))
const { DialogProvider }: typeof import("@orchestra/ui/context/dialog") =
  await import(solidDom("@orchestra/ui/context/dialog", import.meta.dir))

const binding = Schema.decodeUnknownSync(SfTeamInstallationDescriptor)({
  installationId: "budget-installation", tenantId: "11111111-2222-4333-8444-555555555555",
  projectId: "budget-project", hostId: "budget-host", publicOrigin: "https://budget.example.test", mount: "/sucafina",
  contractRevision: "sf-team-profile/1", authMode: "microsoft",
})
const a = "a1111111-2222-4333-8444-555555555555", b = "b1111111-2222-4333-8444-555555555555"
const principalObjectId = "c1111111-2222-4333-8444-555555555555"
const caps = ["CAP03", "CAP04", "CAP05"] as const
type Cap = typeof caps[number]
type Period = Readonly<{ year?: number; month?: number }>
const pages = { CAP03: "Budget Overview", CAP04: "OPEX Detail", CAP05: "CAPEX Projects" } as const
const profile = (teamObjectId: string) => Schema.decodeUnknownSync(TeamProfile.Ref)({
  installationId: binding.installationId, tenantId: binding.tenantId, teamObjectId,
})
const json = (value: unknown, status = 200) => Response.json(value, { status, headers: { "cache-control": "no-store" } })
const tick = () => new Promise<void>((resolve) => setImmediate(resolve))
async function eventually(check: () => boolean) {
  const deadline = Date.now() + 6000
  while (!check()) { if (Date.now() > deadline) throw new Error("Expected original Team budget source to settle"); await tick() }
}

/** Actual shell, CAP04/05 source buttons, CAP03 leaf and Team Client; only HTTP is controlled. */
function fixture(cap: Cap = "CAP03", options: Readonly<{ detail?: boolean; period?: Period; signedIn?: boolean }> = {}) {
  const originalHref = window.location.href, requests: Request[] = []
  let signedIn = options.signedIn !== false, revision = 0, budgetRevoked = false
  let hook: ((request: Request, original: Response) => Promise<Response | undefined>) | undefined
  const context = (team: string) => {
    const accessRevision = "budget-access-" + revision
    const owner = { profile: profile(team), principal: { tenantId: binding.tenantId, principalObjectId } }
    const choices = [{ profile: profile(a), displayName: "Team A" }, { profile: profile(b), displayName: "Team B" }]
    return Schema.decodeUnknownSync(SfTeamContext)({
      contractRevision: binding.contractRevision, authMode: binding.authMode,
      stamp: { installationId: binding.installationId, projectId: binding.projectId, hostId: binding.hostId,
        principalRef: principalObjectId, policyVersion: "policy-one", accessRevision,
        team: { owner, revisions: { configRevision: 0, accessRevision } } },
      profile: { contractRevision: binding.contractRevision, status: "authenticated", installationId: binding.installationId,
        principal: owner.principal, accessRevision, administration: { status: "denied" },
        teams: { status: "ready", selected: profile(team), configRevision: 0, choices } },
      destinations: caps.map((capabilityId) => ({ capabilityId, surface: "dashboard", page: pages[capabilityId],
        canRead: capabilityId !== "CAP03" || !budgetRevoked, allowedActionIds: [] })),
      availability: caps.filter((candidate) => candidate !== "CAP03" || !budgetRevoked).map((candidate) => ({
        family: "domain-read", resource: candidate, state: "ready", operations: [
          { operationId: "domain.page." + candidate, state: "ready", reason: null, operational: true },
        ],
      })),
    })
  }
  const href = (cap: Cap, team = a, period: Period = { year: 2026 }, detail = false) => {
    const url = new URL(routes.sfTeamDomainHref(binding, context(team), cap, period.year ?? 2026)!, binding.publicOrigin)
    if (cap === "CAP03") {
      url.searchParams.delete("year")
      if (period.year !== undefined) url.searchParams.set("year", String(period.year))
      if (period.month !== undefined) url.searchParams.set("month", String(period.month))
    }
    if (detail) url.pathname += "/" + encodeSfRouteRef("line-one")
    return url.href
  }
  window.location.href = href(cap, a, options.period ?? { year: 2026 }, options.detail)
  const page = (team: string, cap: Cap, selection: Period) => {
    const current = context(team), label = team === a ? "Private A" : "Private B"
    const owners = [{ id: "line-one", name: label + " source", budget: 1200 }]
    const year = selection.year ?? 2027, month = selection.month ?? 9
    const total = team === a ? 777001 : 888002, revenue = team === a ? 101001 : 202002
    return { status: "ok", context: current.stamp, value: {
      capabilityId: cap, selection: { year, month },
      data: cap === "CAP03" ? {
        totals: { opexBudget: 10, opexActual: 11, opexForecast: 12, capexBudget: 20, capexActual: 21, capexForecast: 22,
          totalBudget: total, totalActual: total + 1, totalForecast: total + 2 },
        budgetCurrentMonth: { "2024": 9, "2025": 9, "2026": 9, "2027": 9 },
        revenueByYear: { "2024": revenue, "2025": revenue, "2026": revenue, "2027": revenue },
      } : cap === "CAP04" ? { opexOwners: owners, opexEntries: [], deviations: {}, budgetYtd: { opex: {} }, budgetLineIds: ["line-one"] } :
        { capexProjects: owners, capexEntries: [], deviations: {}, budgetYtd: { capex: {} }, budgetLineIds: ["line-one"] },
      versions: cap === "CAP03" ? { budgetCurrentMonth: 3, revenueByYear: 4 } :
        cap === "CAP04" ? { "opexOwners:line-one": 1 } : { "capexProjects:line-one": 1 },
      allowedActionIds: [],
    } }
  }
  const fetch = spyOn(globalThis, "fetch").mockImplementation(async (raw, init) => {
    const request = new Request(new URL(raw instanceof Request ? raw.url : raw.toString(), window.location.href), init)
    requests.push(request.clone())
    const url = new URL(request.url), path = url.pathname
    if (request.method !== "GET") throw new Error("Read-only CAP03 unexpectedly dispatched a mutation")
    if (path === "/api/sucafina/installations") return json({ installations: [binding] })
    if (!signedIn) return json({ status: "unauthenticated" }, 401)
    if (path === binding.mount + "/api/ui/context")
      return json({ status: "ok", value: context(url.searchParams.get("teamObjectId")!) })
    const selector = Schema.decodeUnknownSync(TeamProfile.Selector)(JSON.parse(request.headers.get("x-sf-team-profile") ?? "null"))
    if (selector.kind !== "team") throw new Error("Expected original Team selector")
    const selectedCap = caps.find((candidate) => path === binding.mount + "/api/ui/pages/" + candidate)
    if (!selectedCap) throw new Error("Unexpected controlled budget route: " + path)
    const original = json(page(selector.profile.teamObjectId, selectedCap, {
      ...(url.searchParams.has("year") ? { year: Number(url.searchParams.get("year")) } : {}),
      ...(url.searchParams.has("month") ? { month: Number(url.searchParams.get("month")) } : {}),
    }))
    return await hook?.(request.clone(), original.clone()) ?? original
  })
  const host = document.createElement("div"); document.body.append(host)
  const dispose = render(() => createComponent(PlatformProvider, {
    value: { platform: "web", openExternal() {}, async restart() {}, async notify() {} },
    get children() { return createComponent(LanguageProvider, { locale: "en", get children() {
      return createComponent(DialogProvider, { get children() { return createComponent(SfTeamWebApp, {}) } })
    } }) },
  }), host)
  return { host, requests, context, href,
    state: () => host.querySelector("[data-sf-teams-shell]")?.getAttribute("data-sf-teams-state"),
    budget: () => host.querySelector('[data-sf-surface="CAP03"]'),
    reads: () => requests.filter((request) => new URL(request.url).pathname.endsWith("/api/ui/pages/CAP03")),
    choose(team: string) {
      const select = host.querySelector<HTMLSelectElement>("[data-sf-team-picker]")!
      select.value = team; select.dispatchEvent(new Event("change", { bubbles: true }))
    },
    focus() { window.dispatchEvent(new Event("focus")) },
    signedIn(value: boolean) { signedIn = value },
    revokeBudget() { budgetRevoked = true; revision++ },
    setHook(value: typeof hook) { hook = value },
    close() { dispose(); host.remove(); fetch.mockRestore(); window.location.href = originalHref },
  }
}
// Match English Intl presentation while preserving the exact producer numbers in every assertion.
const displayedAmount = (value: number) => new Intl.NumberFormat("en", { maximumFractionDigits: 2 }).format(value)
const revenue = (view: ReturnType<typeof fixture>) => view.budget()?.querySelector('[data-sf-metric="revenue"]')?.textContent ?? ""
async function budgetReady(view: ReturnType<typeof fixture>) {
  await eventually(() => !!view.budget()?.querySelector(".sf-budget-period select"))
}
function changeYear(view: ReturnType<typeof fixture>, year: string) {
  const select = view.budget()?.querySelector<HTMLSelectElement>(".sf-budget-period select")
  if (!select) throw new Error("Expected the original budget period selector")
  select.value = year; select.dispatchEvent(new Event("change", { bubbles: true }))
}

test("CAP03 public intent preserves the original optional period and refuses authority, aliases and unsupported paths", async () => {
  const view = fixture()
  try {
    await budgetReady(view)
    for (const period of [{}, { year: 2024 }, { year: 2027, month: 12 }, { month: 1 }, { year: 2026, month: 11 }]) {
      const url = new URL(view.href("CAP03", a, period))
      const parsed = routes.readSfTeamDomainIntent(url, binding)
      expect(parsed?.query).toEqual(period)
      expect(navigation.teamNavigationReturnTo(url, binding)).toBe(url.pathname + url.search)
      expect(navigation.teamNavigationURL(url, binding, profile(a))?.href).toBe(url.href)
      const changed = navigation.teamNavigationURL(url, binding, profile(b))!
      expect(changed.searchParams.get("month")).toBe(url.searchParams.get("month"))
      expect(changed.searchParams.get("year")).toBe(url.searchParams.get("year"))
      expect(routes.resolveSfTeamDomainRoute(changed, binding, view.context(a))).toBeUndefined()
    }
    for (const [key, value] of [["month", "01"], ["month", "0"], ["month", "13"], ["year", "2028"], ["year", "26"],
      ["execYear", "2026"], ["principalRef", principalObjectId], ["hostId", binding.hostId], ["project", binding.projectId]]) {
      const url = new URL(view.href("CAP03")); url.searchParams.set(key, value)
      expect(navigation.readTeamNavigationIntent(url, binding)).toBeUndefined()
    }
    for (const key of ["contractRevision", "server", "installationId", "tenantId", "teamObjectId"]) {
      const url = new URL(view.href("CAP03")); url.searchParams.delete(key)
      expect(navigation.readTeamNavigationIntent(url, binding)).toBeUndefined()
    }
    for (const suffix of ["/", "/new", "/" + encodeSfRouteRef("line-one"), "/" + encodeSfRouteRef("line-one") + "/edit"]) {
      const url = new URL(view.href("CAP03")); url.pathname += suffix
      expect(routes.readSfTeamDomainIntent(url, binding)).toBeUndefined()
    }
  } finally { view.close() }
}, 15000)

for (const cap of ["CAP04", "CAP05"] as const) {
  test(cap + " original View source opens the real read-only CAP03 leaf with a full current Team and year", async () => {
    const view = fixture(cap, { detail: true })
    try {
      const collection = cap === "CAP04" ? "opexOwners" : "capexProjects"
      const detailSelector = cap === "CAP04" ? "[data-sf-opex-detail]" : "[data-sf-capex-detail]"
      const reference = () => view.host.querySelector(detailSelector + " details.sf-opex-reference code")
      await eventually(() => reference()?.textContent?.trim() === collection + ":line-one")
      expect(reference()?.textContent?.trim()).toBe(collection + ":line-one")
      const detail = view.host.querySelector(detailSelector)!
      const source = Array.from(detail.querySelectorAll<HTMLButtonElement>("button")).find((button) => button.textContent?.trim() === "View source")
      expect(source).toBeDefined(); expect(source!.disabled).toBe(false)
      source!.click(); await budgetReady(view)
      const url = new URL(window.location.href)
      expect(url.pathname).toBe("/orchestra/sf-dashboard/budget")
      expect(Object.fromEntries(url.searchParams)).toEqual({
        contractRevision: binding.contractRevision, server: binding.publicOrigin,
        installationId: binding.installationId, tenantId: binding.tenantId, teamObjectId: a, year: "2026",
      })
      expect(revenue(view)).toContain(displayedAmount(101001))
      expect(view.budget()?.querySelector(".sf-budget-edit")).toBeNull()
      expect(view.reads()).toHaveLength(1)
      const index = view.requests.indexOf(view.reads()[0]!)
      expect(new URL(view.requests[index - 1]!.url).pathname).toBe(binding.mount + "/api/ui/context")
      expect(new URL(view.requests[index + 1]!.url).pathname).toBe(binding.mount + "/api/ui/context")
      expect(view.requests.every((request) => request.method === "GET")).toBe(true)
    } finally { view.close() }
  }, 15000)
}

test("CAP03 login return, focus and Team change preserve the canonical month without creating a grant", async () => {
  const view = fixture("CAP03", { period: { year: 2026, month: 11 }, signedIn: false }), original = window.location.href
  try {
    await eventually(() => view.state() === "unauthenticated")
    const login = view.host.querySelector<HTMLAnchorElement>('a[href*="/auth/login?"]')!
    expect(new URL(login.href).searchParams.get("returnTo")).toBe(new URL(original).pathname + new URL(original).search)
    expect(view.budget()).toBeNull()
    view.signedIn(true); view.focus(); await budgetReady(view)
    expect(window.location.href).toBe(original)
    view.focus(); await budgetReady(view)
    expect(new URL(window.location.href).searchParams.get("month")).toBe("11")
    view.choose(b)
    await eventually(() => revenue(view).includes(displayedAmount(202002)))
    expect(new URL(window.location.href).searchParams.get("teamObjectId")).toBe(b)
    expect(new URL(window.location.href).searchParams.get("month")).toBe("11")
    expect(revenue(view)).not.toContain(displayedAmount(101001))
  } finally { view.close() }
}, 15000)

test("the original CAP03 period selector and reset commit only public selection and render producer totals", async () => {
  const view = fixture("CAP03", { period: { year: 2026, month: 11 } })
  try {
    await budgetReady(view); changeYear(view, "2025")
    await eventually(() => new URL(window.location.href).searchParams.get("year") === "2025" && revenue(view).includes(displayedAmount(101001)))
    expect(new URL(window.location.href).searchParams.get("month")).toBe("11")
    changeYear(view, "")
    await eventually(() => !!view.budget()?.querySelector(".sf-budget-ledger"))
    const url = new URL(window.location.href)
    expect(url.searchParams.has("year")).toBe(false)
    expect(url.searchParams.has("month")).toBe(false)
    expect(url.searchParams.get("teamObjectId")).toBe(a)
    expect(new URL(view.reads().at(-1)!.url).search).toBe("")
    expect(view.budget()?.querySelector('[data-sf-metric="budget"]')?.textContent).toContain(displayedAmount(777001))
    expect(view.budget()?.querySelector(".sf-budget-edit")).toBeNull()
    expect(view.requests.every((request) => request.method === "GET")).toBe(true)
  } finally { view.close() }
}, 15000)

test("a superseded CAP03 period signal cannot commit its URL after the navigation guard yields", async () => {
  const view = fixture()
  const push = spyOn(window.history, "pushState")
  try {
    await budgetReady(view)
    batch(() => { changeYear(view, "2025"); changeYear(view, "2027") })
    await eventually(() => new URL(window.location.href).searchParams.get("year") === "2027" && revenue(view).includes(displayedAmount(101001)))
    const committed = push.mock.calls.map((call) => String(call[2]))
    expect(committed.some((href) => new URL(href, binding.publicOrigin).searchParams.get("year") === "2025")).toBe(false)
    expect(committed.some((href) => new URL(href, binding.publicOrigin).searchParams.get("year") === "2027")).toBe(true)
    expect(view.requests.every((request) => request.method === "GET")).toBe(true)
  } finally { push.mockRestore(); view.close() }
}, 15000)

test("fresh CAP03 read revocation removes its private values without borrowing another domain destination", async () => {
  const view = fixture()
  try {
    await budgetReady(view); expect(revenue(view)).toContain(displayedAmount(101001))
    view.revokeBudget(); view.focus()
    await eventually(() => view.state() === "authenticated" && view.host.querySelector('[data-sf-team-domain-page="CAP03"]') === null)
    expect(view.host.textContent).not.toContain(displayedAmount(101001))
    expect(new URL(window.location.href).searchParams.get("teamObjectId")).toBe(a)
    expect(view.requests.every((request) => request.method === "GET")).toBe(true)
  } finally { view.close() }
}, 15000)

test("late Team A CAP03 bytes cannot populate the original budget leaf after Team B is confirmed", async () => {
  const view = fixture(), started = Promise.withResolvers<void>(), release = Promise.withResolvers<void>()
  view.setHook(async (request, original) => {
    if (!new URL(request.url).pathname.endsWith("/CAP03")) return
    const selector = Schema.decodeUnknownSync(TeamProfile.Selector)(JSON.parse(request.headers.get("x-sf-team-profile")!))
    if (selector.kind !== "team" || selector.profile.teamObjectId !== a) return
    started.resolve(); await release.promise; return original
  })
  try {
    await started.promise
    view.choose(b)
    await eventually(() => revenue(view).includes(displayedAmount(202002)))
    release.resolve(); await tick(); await tick()
    expect(new URL(window.location.href).searchParams.get("teamObjectId")).toBe(b)
    expect(revenue(view)).toContain(displayedAmount(202002))
    expect(view.host.textContent).not.toContain(displayedAmount(101001))
    expect(view.requests.every((request) => request.method === "GET")).toBe(true)
  } finally { release.resolve(); view.close() }
}, 15000)
