/// <reference types="vite/client" />
import { expect, test } from "bun:test"
import { setImmediate } from "node:timers"
import { createComponent, createSignal } from "solid-js"
import { render } from "solid-js/web"
import { Schema } from "effect"
import { SfTeamContext, SfTeamInstallationDescriptor, type SfEditScopeKey, type SfReadableContext, type SfRef } from "@orchestra/schema/sucafina/context"
import { TeamProfile } from "@orchestra/schema/sucafina/team-profile"
import type { SfTransportFetch } from "@orchestra/client/sucafina/transport"
import type { SfTeamDomainLifecycle, SfTeamDomainSession } from "../src/orchestra/chapters/sucafina/host/team-domain"
import type { SfContextHandle } from "../src/orchestra/chapters/sucafina/context/contracts"
import { solidDom } from "./real-ui-solid"

const { SfTeamDomainHost, createSfTeamDomainOwner }: typeof import("../src/orchestra/chapters/sucafina/host/team-domain") =
  await import(solidDom("../src/orchestra/chapters/sucafina/host/team-domain", import.meta.dir))
const { SfContextHandleProvider, useSfContext, useSfReadableContext }: typeof import("../src/orchestra/chapters/sucafina/context") =
  await import(solidDom("../src/orchestra/chapters/sucafina/context", import.meta.dir))
const routes: typeof import("../src/orchestra/chapters/sucafina/host/team-domain-route") =
  await import(solidDom("../src/orchestra/chapters/sucafina/host/team-domain-route", import.meta.dir))
const { encodeSfRouteRef }: typeof import("../src/orchestra/chapters/sucafina/navigation-state") =
  await import(solidDom("../src/orchestra/chapters/sucafina/navigation-state", import.meta.dir))
const { createSfDomainClient }: typeof import("@orchestra/client/sucafina/domain") =
  await import(solidDom("@orchestra/client/sucafina/domain", import.meta.dir))
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

function mount(cap: Cap = "CAP14", kind: "entry" | "edit" = "entry") {
  const source = network(), originalHref = window.location.href
  let generation = 1, pending = new AbortController(), lifecycle: SfTeamDomainLifecycle | undefined, consent = true
  const first = { binding, context: source.context(a), generation, signal: pending.signal }
  const [current, setCurrent] = createSignal<SfTeamDomainSession | undefined>(first)
  const initial = new URL(routes.sfTeamDomainHref(binding, first.context, cap)!, binding.publicOrigin)
  if (kind === "edit") initial.pathname += "/" + encodeSfRouteRef(cap === "CAP14" ? "contract-one" : "line-one") + "/edit"
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

test("Team domain URL intent reuses canonical refs and rejects partial, foreign, duplicate and invalid year selectors", () => {
  const source = network(), context = source.context(a)
  for (const cap of caps) {
    const href = routes.sfTeamDomainHref(binding, context, cap)!
    const url = new URL(href, binding.publicOrigin)
    expect(routes.resolveSfTeamDomainRoute(url, binding, context)?.surfaceId).toBe(cap)
    expect(url.searchParams.has("year")).toBe(cap !== "CAP14")
    for (const suffix of ["/new", "/" + encodeSfRouteRef("original/ref"), "/" + encodeSfRouteRef("original/ref") + "/edit"]) {
      const deep = new URL(url); deep.pathname += suffix
      expect(routes.readSfTeamDomainIntent(deep, binding)?.candidate.surfaceId).toBe(cap)
    }
    for (const suffix of ["/r_", "/r_YQ=", "/r_YR", "/r__w", "/anything", "/new/extra", "/"]) {
      const deep = new URL(url); deep.pathname += suffix
      expect(routes.readSfTeamDomainIntent(deep, binding)).toBeUndefined()
    }
    for (const name of ["teamObjectId", "tenantId", "installationId", "contractRevision", "server"]) {
      const missing = new URL(url); missing.searchParams.delete(name)
      expect(routes.readSfTeamDomainIntent(missing, binding)).toBeUndefined()
      const duplicate = new URL(url); duplicate.searchParams.append(name, url.searchParams.get(name)!)
      expect(routes.readSfTeamDomainIntent(duplicate, binding)).toBeUndefined()
    }
    for (const [name, value] of [["principalRef", principalObjectId], ["project", binding.projectId], ["hostId", binding.hostId],
      ["accessRevision", context.stamp.accessRevision], ["server", "https://foreign.example.test"], ["year", "2023"], ["year", "2028"], ["year", "02026"]]) {
      const invalid = new URL(url); invalid.searchParams.set(name!, value!)
      expect(routes.readSfTeamDomainIntent(invalid, binding)).toBeUndefined()
    }
    const foreign = new URL(url); foreign.searchParams.set("teamObjectId", b)
    expect(routes.readSfTeamDomainIntent(foreign, binding)).toBeDefined()
    expect(routes.resolveSfTeamDomainRoute(foreign, binding, context)).toBeUndefined()
  }
  const internal = "/orchestra/sf-dashboard/opex/new?" + new URLSearchParams({ server: binding.publicOrigin,
    project: binding.projectId, installation: binding.installationId, year: "2026" })
  expect(routes.readSfTeamDomainIntent(new URL(internal, binding.publicOrigin), binding)).toBeUndefined()
  const normalized = routes.normalizeSfTeamDomainNavigation(internal, binding, context)!
  expect(new URL(normalized, binding.publicOrigin).searchParams.get("teamObjectId")).toBe(a)
  expect(new URL(normalized, binding.publicOrigin).searchParams.has("project")).toBe(false)
})

for (const cap of caps) test("original " + cap + " leaf renders Team data and product-resolved F01 links with no mutation", async () => {
  const view = mount(cap)
  try {
    await eventually(() => view.host.textContent!.includes("Team A private"))
    expect(view.host.querySelector('[data-sf-team-domain-page="' + cap + '"]')).not.toBeNull()
    const links = [...view.host.querySelectorAll<HTMLAnchorElement>("[data-sf-capability-id]")]
    expect(links).toHaveLength(3)
    for (const anchor of links) {
      const url = new URL(anchor.href)
      expect(routes.resolveSfTeamDomainRoute(url, binding, view.current()!.context)?.surfaceId).toBe(anchor.dataset.sfCapabilityId)
      expect(url.searchParams.get("teamObjectId")).toBe(a)
    }
    const reads = view.requests.filter((request) => new URL(request.url).pathname.endsWith("/api/ui/pages/" + cap))
    expect(reads.length).toBeGreaterThan(0)
    expect(reads.every((request) => JSON.parse(request.headers.get("x-sf-team-profile")!).profile.teamObjectId === a)).toBe(true)
    expect(view.writes()).toHaveLength(0)
  } finally { view.close() }
}, 15000)

test("CAP14 original review dispatches exact CAS/idempotency and rereads the confirmed Team projection", async () => {
  const view = mount("CAP14", "edit")
  try {
    await eventually(() => !!view.host.querySelector('[data-field="vendor"] input'))
    view.edit("Edited only Team A")
    view.review(); view.confirm()
    await eventually(() => view.records.get(a)?.version === 2 && !view.lifecycle().hasDirtyDrafts())
    expect(view.writes()).toHaveLength(1)
    const request = view.writes()[0]!, body = await request.json()
    expect(body).toMatchObject({ page: "Vendor Contracts", action: "save", id: "contract-one", version: 1,
      values: { vendor: "Edited only Team A" } })
    expect(request.headers.get("idempotency-key")).toMatch(/^[A-Za-z0-9._:-]{8,128}$/)
    expect(request.headers.get("x-sf-access-revision")).toBe(view.current()!.context.stamp.accessRevision)
    expect(view.records.get(b)).toEqual({ vendor: "Team B private vendor", version: 1 })
    view.refresh(); await eventually(() => view.host.textContent!.includes("Edited only Team A"))
    expect(view.writes()).toHaveLength(1)
  } finally { view.close() }
}, 15000)

test("same-owner refresh revalidates and restores an unsent CAP14 draft without dispatching it", async () => {
  const view = mount("CAP14", "edit")
  try {
    await eventually(() => !!view.host.querySelector('[data-field="vendor"] input'))
    view.edit("Unsent private draft")
    expect(view.lifecycle().hasDirtyDrafts()).toBe(true)
    const before = view.requests.length
    view.refresh()
    await eventually(() => view.host.querySelector<HTMLInputElement>('[data-field="vendor"] input')?.value === "Unsent private draft")
    expect(view.requests.slice(before).filter((request) => new URL(request.url).pathname.endsWith("/pages/CAP14")).length).toBeGreaterThanOrEqual(2)
    expect(view.writes()).toHaveLength(0)
    view.consent(false); expect(await view.lifecycle().leave()).toBe(false)
    expect(view.field().value).toBe("Unsent private draft")
    view.consent(true); expect(await view.lifecycle().leave()).toBe(true)
    expect(view.lifecycle().hasDirtyDrafts()).toBe(false)
  } finally { view.close() }
}, 15000)

test("Team switch removes the old private draft and late old reads never populate the new leaf", async () => {
  const view = mount("CAP14", "edit")
  let resolve: ((response: Response) => void) | undefined
  try {
    await eventually(() => !!view.host.querySelector('[data-field="vendor"] input'))
    view.edit("A draft must not cross")
    let delayed = false
    view.setHook(async (request) => {
      if (new URL(request.url).pathname.endsWith("/pages/CAP14") && !delayed) {
        delayed = true
        return new Promise<Response>((finish) => { resolve = finish })
      }
    })
    view.refresh(); await eventually(() => !!resolve)
    expect(view.host.textContent).not.toContain("A draft must not cross")
    view.switchTeam(b)
    await eventually(() => view.host.textContent!.includes("Team B private"))
    resolve!(json(view.page(a, "CAP14", 2026))); await settle(); await settle()
    expect(view.field().value).toBe("Team B private vendor")
    expect(view.host.textContent).not.toContain("Team A private")
    expect(view.lifecycle().hasDirtyDrafts()).toBe(false)
    expect(view.writes()).toHaveLength(0)
  } finally { resolve?.(json({ status: "unavailable", reason: "cleanup" }, 503)); view.close() }
}, 15000)

test("loss of the original write grant purges the retained private draft before remount", async () => {
  const view = mount("CAP14", "edit")
  try {
    await eventually(() => !!view.host.querySelector('[data-field="vendor"] input'))
    view.edit("Revoked private edit")
    view.readOnly(); view.refresh()
    await eventually(() => !view.lifecycle().hasDirtyDrafts())
    expect(view.host.querySelector('[data-field="vendor"] input')).toBeNull()
    expect(view.host.textContent).not.toContain("Revoked private edit")
    view.refresh()
    await eventually(() => view.host.textContent!.includes("Team A private vendor"))
    expect(view.host.querySelector('[data-field="vendor"] input')).toBeNull()
    expect(view.writes()).toHaveLength(0)
  } finally { view.close() }
}, 15000)

test("a lost POST response survives refresh as unresolved and cannot dispatch a second command with a new key", async () => {
  const view = mount("CAP14", "edit")
  try {
    await eventually(() => !!view.host.querySelector('[data-field="vendor"] input'))
    view.edit("Uncertain effect")
    view.losePost(); view.review(); view.confirm()
    await eventually(() => !!view.host.querySelector(".sf-u15-notice[role=alert]"))
    expect(view.writes()).toHaveLength(1)
    expect(await view.lifecycle().leave()).toBe(false)
    view.refresh()
    await eventually(() => view.host.querySelector<HTMLInputElement>('[data-field="vendor"] input')?.value === "Uncertain effect")
    view.review(); view.confirm()
    await eventually(() => !!view.host.querySelector(".sf-u15-notice[role=alert]"))
    expect(view.writes()).toHaveLength(1)
    expect(view.records.get(a)?.version).toBe(1)
    expect(await view.lifecycle().leave()).toBe(false)
  } finally { view.close() }
}, 15000)

test("source version drift becomes a retained conflict, and old owner handles cannot mutate after Team replacement", async () => {
  const source = network(), originalHref = window.location.href
  window.location.href = binding.publicOrigin
  let controller = new AbortController(), generation = 1
  let current: SfTeamDomainSession = { binding, context: source.context(a), generation, signal: controller.signal }
  const owner = createSfTeamDomainOwner({ initial: current, current: () => current, fetch: source.fetch, async reload() {} })
  try {
    await owner.activate(current)
    const old = owner.handle.ready()!
    const draft = old.drafts.acquire({ surfaceId: "CAP14", identity: { kind: "record", recordRef: "contract-one" as SfRef },
      editScopeKey: "vendor-contract-fields" as SfEditScopeKey, baseVersion: 1,
      base: { vendor: "Team A private vendor" }, value: { vendor: "Team A private vendor" },
      revalidation: { operationId: "domain.page.CAP14", input: {}, fieldPaths: ["vendor"], actionIds: ["save"] } })
    draft.edit({ vendor: "Retained edit" })
    source.records.set(a, { vendor: "Second writer changed source", version: 2 })
    controller.abort(); controller = new AbortController()
    current = { binding, context: source.context(a), generation: ++generation, signal: controller.signal }
    await owner.activate(current)
    expect(draft.snapshot()).toMatchObject({ availability: "active", phase: "conflict", value: { vendor: "Retained edit" }, baseVersion: 1 })
    controller.abort(); controller = new AbortController()
    current = { binding, context: source.context(b), generation: ++generation, signal: controller.signal }
    await owner.activate(current)
    expect(draft.snapshot()).toEqual({ availability: "revoked", reason: "owner-changed" })
    const count = source.requests.length
    const stale = await createSfDomainClient(old.transport)["domain.page.CAP14"]({}, { signal: new AbortController().signal })
    expect(stale.kind).toBe("transport-error")
    expect(source.requests).toHaveLength(count)
    const fresh = await createSfDomainClient(owner.handle.ready()!.transport)["domain.page.CAP14"]({}, { signal: controller.signal })
    expect(fresh.kind).toBe("response")
    if (fresh.kind === "response" && fresh.body.status === "ok") expect(fresh.body.value.data.contracts?.[0]?.vendor).toBe("Team B private vendor")
    else throw new Error("Expected actual Team B page through original transport")
    expect(source.writes()).toHaveLength(0)
  } finally { owner.dispose(); controller.abort(); window.location.href = originalHref }
}, 15000)

test("unadapted legacy consumers fail closed while the explicit readable hook preserves the real Team DTO", async () => {
  const source = network(), controller = new AbortController()
  const current = { binding, context: source.context(a), generation: 1, signal: controller.signal }
  const owner = createSfTeamDomainOwner({ initial: current, current: () => current, fetch: source.fetch, async reload() {} })
  const observed: { legacy?: SfContextHandle; readable?: SfContextHandle<SfReadableContext> } = {}
  const host = document.createElement("div")
  let dispose: (() => void) | undefined
  try {
    await owner.activate(current)
    expect(owner.handle.ready()?.context).toBe(current.context)
    dispose = render(() => createComponent(SfContextHandleProvider, { value: owner.handle, get children() {
      return createComponent(() => {
        observed.legacy = useSfContext()
        observed.readable = useSfReadableContext()
        return null
      }, {})
    } }), host)
    expect(observed.legacy?.state()).toMatchObject({ status: "unavailable", reason: "contract-mismatch" })
    expect(observed.legacy?.ready()).toBeUndefined()
    expect(Schema.is(SfTeamContext)(current.context)).toBe(true)
    expect(Schema.is(SfTeamInstallationDescriptor)(current.binding)).toBe(true)
    const state = observed.readable?.state()
    expect(state?.status).toBe("ready")
    if (state?.status !== "ready") throw new Error("Expected unchanged admitted Team state")
    expect(state.context).toBe(current.context)
    expect(state.binding).toBe(current.binding)
    expect(observed.readable?.ready()?.context).toBe(current.context)
    expect(observed.readable?.ready()?.context.contractRevision).toBe("sf-team-profile/1")
    expect(observed.legacy?.generation()).toBe(observed.readable?.generation())
    expect(source.requests).toHaveLength(0)
  } finally { dispose?.(); owner.dispose(); controller.abort(); host.remove() }
})
