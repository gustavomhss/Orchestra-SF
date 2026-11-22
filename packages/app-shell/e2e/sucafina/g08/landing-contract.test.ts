// Component DOM contract only: real SfTeamWebApp/HTTP reader, controlled network boundary; never installed QA.
import { expect, spyOn, test } from "bun:test"
import { setImmediate } from "node:timers"
import { createComponent } from "solid-js"
import { render } from "solid-js/web"
import { solidDom } from "../../../test-browser/solid-dom"
import { landing } from "./landing-contract"

const { SfTeamWebApp }: typeof import("../../../src/pages/team-profile") =
  await import(solidDom("../../../src/pages/team-profile", import.meta.dir))
const { LanguageProvider }: typeof import("../../../src/context/language") =
  await import(solidDom("../../../src/context/language", import.meta.dir))
const { PlatformProvider }: typeof import("../../../src/context/platform") =
  await import(solidDom("../../../src/context/platform", import.meta.dir))

const installation = {
  installationId: "installation-one",
  tenantId: "11111111-2222-4333-8444-555555555555",
  projectId: "technical-project",
  hostId: "teams-host",
  publicOrigin: "https://teams.example.test",
  mount: "/sucafina",
  contractRevision: "sf-team-profile/1",
  authMode: "microsoft",
}
const teamA = "a1111111-2222-4333-8444-555555555555"
const teamB = "b1111111-2222-4333-8444-555555555555"
const principal = {
  tenantId: installation.tenantId,
  principalObjectId: "c1111111-2222-4333-8444-555555555555",
}
const revisions = { configRevision: 0, accessRevision: "authority-one" }
const profile = (teamObjectId: string) => ({
  installationId: installation.installationId,
  tenantId: installation.tenantId,
  teamObjectId,
})
const choices = [
  { profile: profile(teamA), displayName: "Team A" },
  { profile: profile(teamB), displayName: "Team B" },
]
const context = (teamObjectId?: string, identity = principal) => ({
  status: "ok",
  value: {
    contractRevision: installation.contractRevision,
    authMode: installation.authMode,
    stamp: {
      installationId: installation.installationId,
      projectId: installation.projectId,
      hostId: installation.hostId,
      principalRef: identity.principalObjectId,
      policyVersion: "policy-one",
      accessRevision: revisions.accessRevision,
      ...(teamObjectId ? { team: { owner: { profile: profile(teamObjectId), principal: identity }, revisions } } : {}),
    },
    profile: {
      contractRevision: installation.contractRevision,
      status: "authenticated",
      installationId: installation.installationId,
      principal: identity,
      accessRevision: revisions.accessRevision,
      administration: { status: "denied" },
      teams: teamObjectId
        ? { status: "ready", choices, selected: profile(teamObjectId), configRevision: revisions.configRevision }
        : { status: "selection-required", choices },
    },
    destinations: [],
    availability: [],
  },
})
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { "content-type": "application/json", "cache-control": "no-store" },
})
const settle = () => new Promise<void>((resolve) => setImmediate(resolve))

type PendingRequest = {
  url: URL
  method: string
  signal: AbortSignal | undefined
  resolve: (response: Response) => void
  reject: (error: Error) => void
}

function mount() {
  const href = window.location.href
  window.location.href = installation.publicOrigin + "/"
  const requests: PendingRequest[] = []
  let discoveries = 0
  // Only the network boundary is controlled; the component and its strict HTTP reader are real.
  const transport: typeof globalThis.fetch = Object.assign((
    input: Parameters<typeof globalThis.fetch>[0], init?: Parameters<typeof globalThis.fetch>[1],
  ): Promise<Response> => {
    const url = new URL(input instanceof Request ? input.url : input.toString(), window.location.href)
    if (url.pathname === "/api/sucafina/installations") {
      discoveries++
      return Promise.resolve(json({ installations: [installation] }))
    }
    return new Promise<Response>((resolve, reject) => {
      requests.push({ url, method: init?.method ?? (input instanceof Request ? input.method : "GET"),
        signal: init?.signal ?? undefined, resolve, reject })
    })
  }, { preconnect: globalThis.fetch.preconnect })
  const fetch = spyOn(globalThis, "fetch").mockImplementation(transport)
  const host = document.createElement("div")
  document.body.append(host)
  const dispose = render(() => createComponent(PlatformProvider, {
    value: { platform: "web", openExternal() {}, async restart() {}, async notify() {} },
    get children() {
      return createComponent(LanguageProvider, {
        locale: "en",
        get children() { return createComponent(SfTeamWebApp, {}) },
      })
    },
  }), host)
  return {
    host,
    requests,
    discoveries: () => discoveries,
    state: () => host.querySelector(landing.shell)?.getAttribute("data-sf-teams-state"),
    selected: () => host.querySelector("[data-sf-teams-shell]")?.getAttribute("data-sf-team-selected"),
    request(index: number) {
      const request = requests[index]
      if (!request) throw new Error("Expected pending Teams HTTP request " + index)
      return request
    },
    choose(teamObjectId: string) {
      const select = host.querySelector<HTMLSelectElement>(landing.picker)
      if (!select) throw new Error("Expected Team selector")
      select.value = teamObjectId
      select.dispatchEvent(new Event("change", { bubbles: true }))
    },
    click(selector: string) {
      const button = host.querySelector<HTMLButtonElement>(selector)
      if (!button) throw new Error("Expected Teams button: " + selector)
      button.click()
    },
    close() {
      dispose()
      host.remove()
      for (const request of requests) request.resolve(new Response(null, { status: 503 }))
      fetch.mockRestore()
      window.location.href = href
    },
  }
}

function expectRequest(view: ReturnType<typeof mount>, index: number, teamObjectId?: string) {
  const request = view.request(index)
  expect(request.url.pathname).toBe(installation.mount + "/api/ui/context")
  expect(request.url.searchParams.get("kind")).toBe(teamObjectId ? "team" : "selection")
  expect(request.url.searchParams.get("teamObjectId")).toBe(teamObjectId ?? null)
  expect(request.url.searchParams.get("installationId")).toBe(installation.installationId)
  expect(request.url.searchParams.get("tenantId")).toBe(installation.tenantId)
  expect(request.url.searchParams.get("hostId")).toBe(installation.hostId)
  return request
}
async function begin(view: ReturnType<typeof mount>) {
  await settle()
  expectRequest(view, 0).resolve(json(context()))
  await settle()
  expect(view.state()).toBe("authenticated")
  expect(view.host.querySelectorAll(landing.picker)).toHaveLength(1)
  expect(view.host.querySelector(landing.dashboard)).toBeNull()
}
async function select(view: ReturnType<typeof mount>, index: number, id: string) {
  view.choose(id)
  await settle()
  expectRequest(view, index, id).resolve(json(context(id)))
  await settle()
  expect(view.selected()).toBe(id)
  expect(view.host.querySelector<HTMLSelectElement>(landing.picker)?.value).toBe(id)
  expect(view.host.querySelector(landing.dashboard)?.getAttribute("href"))
    .toBe(installation.mount + "/teams/" + id + "/dashboard")
}

test("G08 DOM selectors drive the real native selection and its original A B A requests", async () => {
  const view = mount()
  try {
    await begin(view)
    await select(view, 1, teamA)
    await select(view, 2, teamB)
    await select(view, 3, teamA)
    expect(view.host.querySelectorAll(landing.refresh)).toHaveLength(1)
    expect(view.host.querySelectorAll(landing.logout)).toHaveLength(1)
    expect(view.host.querySelectorAll(landing.newChat)).toHaveLength(1)
    expect(view.host.querySelector(landing.workspace)).toBeNull()
    // The current F02 payload has no business destinations: this pass is not a different-grants proof.
    expect(context(teamA).value.destinations).toEqual([])
  } finally { view.close() }
})

test("G08 DOM refresh waits for the original F02 and preserves the selected owner", async () => {
  const view = mount()
  try {
    await begin(view)
    await select(view, 1, teamB)
    view.click(landing.refresh)
    await settle()
    const refresh = expectRequest(view, 2, teamB)
    expect(view.state()).toBe("loading")
    expect(view.host.querySelector(landing.dashboard)).toBeNull()
    refresh.resolve(json(context(teamB)))
    await settle()
    expect(view.selected()).toBe(teamB)
    window.dispatchEvent(new Event("focus"))
    await settle()
    expectRequest(view, 3, teamB).resolve(json(context(teamB)))
    await settle()
    expect(view.selected()).toBe(teamB)
  } finally { view.close() }
})

test("G08 DOM reflects the actual denied response without inventing a revoked profile or administrator", async () => {
  const view = mount()
  try {
    await begin(view)
    await select(view, 1, teamA)
    view.click(landing.refresh)
    await settle()
    expectRequest(view, 2, teamA).resolve(json({ status: "denied" }, 403))
    await settle()
    expect(view.state()).toBe("denied")
    expect(view.selected()).toBeNull()
    expect(view.host.querySelector(landing.picker)).toBeNull()
    expect(view.host.querySelector(landing.dashboard)).toBeNull()
    expect(view.host.querySelector(landing.administration)).toBeNull()
    expect(view.host.querySelector(landing.newChat)).toBeNull()
    expect(view.host.querySelector(landing.workspace)).toBeNull()
    // A controlled 403 demonstrates the rendering contract, not a real named denied Microsoft actor.
  } finally { view.close() }
})

test("G08 DOM logout selector reaches the real logout handler and clears selection after 204", async () => {
  const view = mount()
  try {
    await begin(view)
    await select(view, 1, teamA)
    view.click(landing.logout)
    await settle()
    expect(view.request(2).url.pathname).toBe(installation.mount + "/auth/logout")
    expect(view.state()).toBe("loading")
    expect(view.host.querySelector(landing.dashboard)).toBeNull()
    view.request(2).resolve(new Response(null, { status: 204 }))
    await settle()
    expect(view.state()).toBe("unauthenticated")
    expect(view.selected()).toBeNull()
    expect(view.host.querySelector(landing.logout)).toBeNull()
    expect(view.host.querySelector('a[href*="/auth/login"]')).not.toBeNull()
  } finally { view.close() }
})

test("G08 DOM opens the actual administration catalog without Team and keeps refresh unambiguous", async () => {
  const view = mount()
  try {
    const current = context()
    const administrator = { ...current, value: { ...current.value, profile: { ...current.value.profile,
      administration: { status: "available" }, teams: { status: "no-teams" },
    } } }
    await settle()
    expectRequest(view, 0).resolve(json(administrator))
    await settle()
    expect(view.state()).toBe("authenticated")
    expect(view.host.querySelector(landing.picker)).toBeNull()
    expect(view.host.querySelector(landing.dashboard)).toBeNull()
    expect(view.host.querySelector(landing.newChat)).toBeNull()
    expect(view.host.querySelector(landing.workspace)).toBeNull()
    expect(view.host.querySelectorAll(landing.adminToggle)).toHaveLength(1)
    expect(view.host.querySelectorAll(landing.refresh)).toHaveLength(1)
    view.click(landing.adminToggle)
    await settle()
    const catalog = view.request(1)
    expect(catalog.method).toBe("GET")
    expect(catalog.url.pathname).toBe(installation.mount + "/api/ui/team-profiles")
    expect(Object.fromEntries(catalog.url.searchParams)).toEqual({
      contractRevision: installation.contractRevision, installationId: installation.installationId, tenantId: installation.tenantId,
    })
    expect([...catalog.url.searchParams]).toHaveLength(3)
    catalog.resolve(json({ status: "ok", configRevision: "opaque-catalog", profiles: [
      { profile: profile(teamA), enabled: true },
    ] }))
    await settle()
    expect(view.host.querySelector(landing.administration)?.getAttribute("data-sf-team-administration")).toBe("ready")
    expect(view.host.querySelector(landing.adminToggle)?.getAttribute("aria-expanded")).toBe("true")
    expect(view.host.querySelector<HTMLButtonElement>(landing.adminRead)?.disabled).toBe(false)
    expect(view.host.querySelectorAll(landing.refresh)).toHaveLength(1)
    expect(view.host.querySelector(landing.dashboard)).toBeNull()
    expect(view.host.querySelector(landing.newChat)).toBeNull()
    expect(view.requests.filter((request) => request.method === "POST")).toHaveLength(0)
  } finally { view.close() }
})
