/// <reference types="vite/client" />
import { expect, test } from "bun:test"
import { setImmediate } from "node:timers"
import { createComponent, createSignal } from "solid-js"
import { render } from "solid-js/web"
import { Schema } from "effect"
import { SfTeamContext, SfTeamInstallationDescriptor } from "@orchestra/schema/sucafina/context"
import { TeamProfile } from "@orchestra/schema/sucafina/team-profile"
import type { SfTransportFetch } from "@orchestra/client/sucafina/transport"
import type { SfTeamDomainLifecycle, SfTeamDomainSession } from "../src/orchestra/chapters/sucafina/host/team-domain"
import { solidDom } from "./real-ui-solid"

const { SfTeamDomainHost }: typeof import("../src/orchestra/chapters/sucafina/host/team-domain") =
  await import(solidDom("../src/orchestra/chapters/sucafina/host/team-domain", import.meta.dir))
const routes: typeof import("../src/orchestra/chapters/sucafina/host/team-domain-route") =
  await import(solidDom("../src/orchestra/chapters/sucafina/host/team-domain-route", import.meta.dir))
const { encodeSfRouteRef }: typeof import("../src/orchestra/chapters/sucafina/navigation-state") =
  await import(solidDom("../src/orchestra/chapters/sucafina/navigation-state", import.meta.dir))
const { LanguageProvider }: typeof import("../src/context/language") =
  await import(solidDom("../src/context/language", import.meta.dir))
const { PlatformProvider }: typeof import("../src/context/platform") =
  await import(solidDom("../src/context/platform", import.meta.dir))

const binding = Schema.decodeUnknownSync(SfTeamInstallationDescriptor)({
  installationId: "domain-installation", tenantId: "11111111-2222-4333-8444-555555555555",
  projectId: "technical-project", hostId: "domain-host", publicOrigin: "https://teams.example.test", mount: "/sucafina",
  contractRevision: "sf-team-profile/1", authMode: "microsoft",
})
const a = "a1111111-2222-4333-8444-555555555555", b = "b1111111-2222-4333-8444-555555555555"
const principalObjectId = "c1111111-2222-4333-8444-555555555555"
const pages = { CAP14: "Vendor Contracts", CAP04: "OPEX Detail", CAP05: "CAPEX Projects" } as const
type Cap = keyof typeof pages
const caps: readonly Cap[] = ["CAP14", "CAP04", "CAP05"]
const profile = (team: string) => ({ installationId: binding.installationId, tenantId: binding.tenantId, teamObjectId: team })
const json = (value: unknown, status = 200) => Response.json(value, { status, headers: { "cache-control": "no-store" } })
const settle = () => new Promise<void>((resolve) => setImmediate(resolve))
async function eventually(check: () => boolean) {
  const until = Date.now() + 6000
  while (!check()) { if (Date.now() > until) throw new Error("Expected the original Team domain UI to settle"); await settle() }
}

/** Only HTTP is controlled. Original DTOs, Team transport, owner, draft registry and leaves are real. */
function network() {
  const requests: Request[] = []
  let readOnly = false, revision = 0, lostPost = false
  let hook: ((request: Request) => Promise<Response | undefined>) | undefined
  const records = new Map([a, b].map((team) => [team, {
    vendor: team === a ? "Team A private vendor" : "Team B private vendor", version: 1,
  }]))
  const context = (team: string) => {
    const accessRevision = "domain-access-" + revision
    const actions = (cap: Cap) => readOnly ? [] : cap === "CAP14" ? ["save", "delete"] :
      ["save", "delete", "save-entry", "save-deviation", "annual-entry", "year-amount"]
    return Schema.decodeUnknownSync(SfTeamContext)({
      contractRevision: binding.contractRevision, authMode: "microsoft",
      stamp: { installationId: binding.installationId, projectId: binding.projectId, hostId: binding.hostId,
        principalRef: principalObjectId, policyVersion: "policy-one", accessRevision,
        team: { owner: { profile: profile(team), principal: { tenantId: binding.tenantId, principalObjectId } },
          revisions: { configRevision: 0, accessRevision } } },
      profile: { contractRevision: binding.contractRevision, status: "authenticated", installationId: binding.installationId,
        principal: { tenantId: binding.tenantId, principalObjectId }, accessRevision,
        administration: { status: "denied" }, teams: { status: "ready", selected: profile(team), configRevision: 0,
          choices: [{ profile: profile(a), displayName: "Team A" }, { profile: profile(b), displayName: "Team B" }] } },
      destinations: caps.map((capabilityId) => ({ capabilityId, surface: "dashboard", page: pages[capabilityId],
        canRead: true, allowedActionIds: actions(capabilityId) })),
      availability: caps.map((cap) => ({ family: "domain-read", resource: cap, state: "ready", operations: [
        { operationId: "domain.page." + cap, state: "ready", reason: null, operational: true },
        ...actions(cap).map((action) => ({ operationId: "domain.command." + cap + "." + action,
          state: "ready", reason: null, operational: true })),
      ] })),
    })
  }
  const page = (team: string, cap: Cap, year: number) => {
    const current = context(team), record = records.get(team)!
    const label = team === a ? "Team A private" : "Team B private"
    const owners = [{ id: "line-one", name: label + (cap === "CAP04" ? " OPEX" : " CAPEX"), budget: 1200 }]
    return { status: "ok", context: current.stamp, value: {
      capabilityId: cap, selection: cap === "CAP14" ? {} : { year, month: 11 },
      data: cap === "CAP14" ? { contracts: [{ id: "contract-one", vendor: record.vendor, name: label + " agreement" }] } :
        cap === "CAP04" ? { opexOwners: owners, opexEntries: [], deviations: {}, budgetYtd: { opex: {} }, budgetLineIds: ["line-one"] } :
          { capexProjects: owners, capexEntries: [], deviations: {}, budgetYtd: { capex: {} }, budgetLineIds: ["line-one"] },
      versions: cap === "CAP14" ? { "contracts:contract-one": record.version } :
        cap === "CAP04" ? { "opexOwners:line-one": 1 } : { "capexProjects:line-one": 1 },
      allowedActionIds: current.destinations.find((item) => item.capabilityId === cap)!.allowedActionIds,
    } }
  }
  const fetch: SfTransportFetch = async (raw, init) => {
    const request = new Request(new URL(raw instanceof Request ? raw.url : raw.toString(), binding.publicOrigin), init)
    requests.push(request.clone())
    const overridden = await hook?.(request.clone())
    if (overridden) return overridden
    const url = new URL(request.url)
    if (url.pathname === binding.mount + "/api/ui/context") {
      const team = url.searchParams.get("teamObjectId")
      if (team !== a && team !== b) throw new Error("Expected explicit original F02 Team query")
      return json({ status: "ok", value: context(team) })
    }
    const selector = Schema.decodeUnknownSync(TeamProfile.Selector)(JSON.parse(request.headers.get("x-sf-team-profile") ?? "null"))
    if (selector.kind !== "team") throw new Error("Expected original Team selector")
    const team = selector.profile.teamObjectId
    const cap = caps.find((candidate) => url.pathname === binding.mount + "/api/ui/pages/" + candidate)
    if (cap && request.method === "GET") return json(page(team, cap, Number(url.searchParams.get("year") ?? 2026)))
    if (url.pathname === binding.mount + "/teams/" + team + "/dashboard" && request.method === "POST") {
      const body = await request.json()
      if (body.page !== pages.CAP14 || body.action !== "save") throw new Error("Unexpected controlled command")
      if (lostPost) { lostPost = false; throw new Error("Wire response lost; effect cannot be established") }
      const record = records.get(team)!
      if (readOnly) return json({ ok: false, status: 403 }, 403)
      if (body.version !== record.version) return json({ ok: false, status: 409, currentVersionCAS: record.version }, 409)
      records.set(team, { vendor: body.values.vendor, version: record.version + 1 })
      return json({ ok: true })
    }
    throw new Error("Unexpected Team domain request: " + request.method + " " + url.pathname)
  }
  return { fetch, context, page, requests, records,
    writes: () => requests.filter((request) => request.method === "POST"),
    readOnly() { readOnly = true; revision++ }, losePost() { lostPost = true },
    setHook(value: typeof hook) { hook = value },
  }
}

function mount(cap: Cap = "CAP14", kind: "entry" | "edit" = "entry", observedHref?: string) {
  const source = network(), originalHref = window.location.href
  let generation = 1, pending = new AbortController(), lifecycle: SfTeamDomainLifecycle | undefined, consent = true
  const first = { binding, context: source.context(a), generation, signal: pending.signal }
  const [current, setCurrent] = createSignal<SfTeamDomainSession | undefined>(first)
  const initial = new URL(observedHref ?? routes.sfTeamDomainHref(binding, first.context, cap)!, binding.publicOrigin)
  if (kind === "edit" && !observedHref) initial.pathname += "/" + encodeSfRouteRef(cap === "CAP14" ? "contract-one" : "line-one") + "/edit"
  const [href, setHref] = createSignal(initial.href)
  window.location.href = initial.href
  const update = (team: string, target = href()) => {
    pending.abort(); setCurrent(undefined)
    generation++; pending = new AbortController()
    window.location.href = target; setHref(target)
    setCurrent({ binding, context: source.context(team), generation, signal: pending.signal })
  }
  const host = document.createElement("div")
  document.body.append(host)
  const dispose = render(() => createComponent(PlatformProvider, {
    value: { platform: "web", openExternal() {}, async restart() {}, async notify() {} },
    get children() { return createComponent(LanguageProvider, { locale: "en", get children() {
      return createComponent(SfTeamDomainHost, { current, href, fetch: source.fetch,
        async reload() { update(current()?.context.stamp.team?.owner.profile.teamObjectId ?? a) },
        async navigate(target) { const next = new URL(target, binding.publicOrigin); update(next.searchParams.get("teamObjectId")!, next.href); return true },
        async confirmDiscard() { return consent }, onLifecycle(value) { lifecycle = value },
      })
    } }) },
  }), host)
  return { ...source, host, current, href, lifecycle: () => lifecycle!,
    refresh() { update(current()!.context.stamp.team!.owner.profile.teamObjectId) },
    switchTeam(team: string) {
      const url = new URL(href()); url.searchParams.set("teamObjectId", team); update(team, url.href)
    },
    consent(value: boolean) { consent = value },
    field() {
      const input = host.querySelector<HTMLInputElement>('[data-field="vendor"] input')
      if (!input) throw new Error("Expected original CAP14 editor")
      return input
    },
    edit(value: string) {
      const input = this.field(); input.value = value; input.dispatchEvent(new Event("input", { bubbles: true }))
    },
    review() {
      const form = host.querySelector<HTMLFormElement>("form.sf-u15-edit")
      if (!form) throw new Error("Expected original CAP14 form")
      form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }))
    },
    confirm() {
      const button = host.querySelector<HTMLButtonElement>(".sf-u15-review .sf-s03-actions button.primary")
      if (!button || button.disabled) throw new Error("Expected original admitted confirmation")
      button.click()
    },
    close() { dispose(); pending.abort(); host.remove(); window.location.href = originalHref },
  }
}


test("original CAP14 Edit publishes a complete Team F01 URL and reopens that exact observed editor", async () => {
  const view = mount()
  let observedHref: string | undefined
  try {
    await eventually(() => !!view.host.querySelector('tbody tr[data-sf-row="contract-one"] button[data-sf-action="select"]'))
    view.host.querySelector<HTMLButtonElement>('tbody tr[data-sf-row="contract-one"] button[data-sf-action="select"]')!.click()
    await eventually(() => !!view.host.querySelector(".sf-u15-detail .sf-u15-source code"))
    expect(view.host.querySelector(".sf-u15-detail .sf-u15-source code")!.textContent).toBe("contract-one")
    view.host.querySelector<HTMLAnchorElement>(".sf-u15-source a[href]")!.click()
    await eventually(() => routes.resolveSfTeamDomainRoute(new URL(view.href()), binding, view.context(a))?.kind === "detail")
    const edit = view.host.querySelector<HTMLButtonElement>(".sf-u15-detail-nav button.primary")!
    expect(edit).toBeDefined(); expect(edit.disabled).toBe(false)
    edit.click()
    await eventually(() => routes.resolveSfTeamDomainRoute(new URL(view.href()), binding, view.context(a))?.kind === "edit" &&
      view.host.querySelector<HTMLFormElement>("form.sf-u15-edit")?.hidden === false)
    observedHref = view.href()
    const url = new URL(observedHref), route = routes.resolveSfTeamDomainRoute(url, binding, view.context(a))
    expect(Object.fromEntries(url.searchParams)).toEqual({ contractRevision: binding.contractRevision,
      server: binding.publicOrigin, installationId: binding.installationId, tenantId: binding.tenantId, teamObjectId: a })
    expect(route).toMatchObject({ surfaceId: "CAP14", kind: "edit", params: { contractRef: "contract-one" } })
    expect(view.field().value).toBe("Team A private vendor")
    expect(view.writes()).toHaveLength(0)
  } finally { view.close() }
  expect(observedHref).toBeDefined()
  const resumed = mount("CAP14", "entry", observedHref!)
  try {
    await eventually(() => resumed.host.querySelector<HTMLFormElement>("form.sf-u15-edit")?.hidden === false)
    expect(resumed.href()).toBe(observedHref)
    expect(resumed.field().value).toBe("Team A private vendor")
    expect(resumed.writes()).toHaveLength(0)
  } finally { resumed.close() }
}, 15000)

test("the navigation change does not expose Edit after the original current write grant is removed", async () => {
  const view = mount()
  try {
    await eventually(() => !!view.host.querySelector('tbody tr[data-sf-row="contract-one"] button[data-sf-action="select"]'))
    view.readOnly(); view.refresh()
    await eventually(() => !!view.host.querySelector('tbody tr[data-sf-row="contract-one"] button[data-sf-action="select"]'))
    view.host.querySelector<HTMLButtonElement>('tbody tr[data-sf-row="contract-one"] button[data-sf-action="select"]')!.click()
    await eventually(() => !!view.host.querySelector(".sf-u15-detail .sf-u15-source code"))
    expect(view.host.querySelector(".sf-u15-detail-nav button.primary")).toBeNull()
    expect(view.writes()).toHaveLength(0)
  } finally { view.close() }
}, 15000)
