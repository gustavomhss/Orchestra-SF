import { expect, spyOn, test } from "bun:test"
import { setImmediate } from "node:timers"
import { createComponent } from "solid-js"
import { render } from "solid-js/web"
import { solidDom } from "./solid-dom"

const { SfTeamWebApp }: typeof import("../src/pages/team-profile") =
  await import(solidDom("../src/pages/team-profile", import.meta.dir))
const { LanguageProvider }: typeof import("../src/context/language") =
  await import(solidDom("../src/context/language", import.meta.dir))
const { PlatformProvider }: typeof import("../src/context/platform") =
  await import(solidDom("../src/context/platform", import.meta.dir))

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
  signal: AbortSignal | undefined
  init: RequestInit | undefined
  resolve: (response: Response) => void
  reject: (error: Error) => void
}

function mount(target = installation.publicOrigin + "/") {
  const href = window.location.href
  window.location.href = target
  const requests: PendingRequest[] = []
  let discoveries = 0
  // Only the network boundary is controlled; the component and its strict HTTP reader are real.
  const fetch = spyOn(globalThis, "fetch").mockImplementation((input, init) => {
    const url = new URL(input instanceof Request ? input.url : input.toString(), window.location.href)
    if (url.pathname === "/api/sucafina/installations") {
      discoveries++
      return Promise.resolve(json({ installations: [installation] }))
    }
    return new Promise<Response>((resolve, reject) => {
      requests.push({ url, signal: init?.signal ?? undefined, init, resolve, reject })
    })
  })
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
    state: () => host.querySelector("[data-sf-teams-shell]")?.getAttribute("data-sf-teams-state"),
    selected: () => host.querySelector("[data-sf-teams-shell]")?.getAttribute("data-sf-team-selected"),
    request(index: number) {
      const request = requests[index]
      if (!request) throw new Error("Expected pending Teams HTTP request " + index)
      return request
    },
    choose(teamObjectId: string) {
      const select = host.querySelector("select")
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

function expectIntent(request: PendingRequest, teamObjectId?: string) {
  expect(request.url.pathname).toBe(installation.mount + "/api/ui/context")
  expect(request.url.searchParams.get("kind")).toBe(teamObjectId ? "team" : "selection")
  expect(request.url.searchParams.get("teamObjectId")).toBe(teamObjectId ?? null)
}

function revalidate(event: string) {
  window.dispatchEvent(event === "pageshow"
    ? Object.assign(new Event("pageshow"), { persisted: true })
    : new Event("focus"))
}

async function showChoices(view: ReturnType<typeof mount>) {
  await settle()
  expectIntent(view.request(0))
  view.request(0).resolve(json(context()))
  await settle()
  expect(view.state()).toBe("authenticated")
  expect(view.selected()).toBeNull()
  expect(view.host.querySelectorAll("select option")).toHaveLength(3)
}

for (const event of ["focus", "pageshow"]) {
  test("Team B survives overlapping selection and refresh on " + event, async () => {
    const view = mount()
    try {
      await showChoices(view)
      view.choose(teamB)
      await settle()
      expectIntent(view.request(1), teamB)

      revalidate(event)
      await settle()
      expect(view.request(1).signal?.aborted).toBe(true)
      expectIntent(view.request(2), teamB)
      // An older response must not clear the newer request's intent.
      view.request(1).resolve(json(context(teamB)))
      await settle()
      expect(view.state()).toBe("loading")
      expect(view.selected()).toBeNull()
      revalidate(event)
      await settle()
      expect(view.request(2).signal?.aborted).toBe(true)
      expectIntent(view.request(3), teamB)
      view.request(2).resolve(json(context(teamB)))
      view.request(3).resolve(json(context(teamB)))
      await settle()
      expect(view.selected()).toBe(teamB)

      view.click("[data-sf-refresh-access]")
      await settle()
      expectIntent(view.request(4), teamB)
      revalidate(event)
      await settle()
      expect(view.request(4).signal?.aborted).toBe(true)
      expectIntent(view.request(5), teamB)
      expect(view.discoveries()).toBe(6)
      view.request(5).resolve(json(context(teamB)))
      await settle()
      view.request(4).resolve(json(context(teamA)))
      await settle()
      expect(view.state()).toBe("authenticated")
      expect(view.selected()).toBe(teamB)
      expect(view.host.querySelector("main a")?.getAttribute("href"))
        .toBe(installation.mount + "/teams/" + teamB + "/dashboard")
    } finally {
      view.close()
    }
  })
}

for (const failure of ["network", "denied", "unauthenticated"]) {
  test("a final " + failure + " response clears the pending Team intent", async () => {
    const view = mount()
    try {
      await showChoices(view)
      view.choose(teamB)
      await settle()
      revalidate("focus")
      await settle()
      expectIntent(view.request(2), teamB)
      view.request(1).resolve(json(context(teamB)))
      if (failure === "network") view.request(2).reject(new Error("Connection lost"))
      else view.request(2).resolve(json({ status: failure }, failure === "denied" ? 403 : 401))
      await settle()
      expect(view.state()).toBe(failure === "network" ? "unavailable" : failure)
      expect(view.selected()).toBeNull()
      expect(view.host.querySelector("select")).toBeNull()
      expect(view.host.querySelector('a[href$="/dashboard"]')).toBeNull()

      revalidate("pageshow")
      await settle()
      expectIntent(view.request(3))
      view.request(3).resolve(json(context()))
      await settle()
      expect(view.state()).toBe("authenticated")
      expect(view.selected()).toBeNull()
    } finally {
      view.close()
    }
  })
}

test("logout suppresses focus revalidation and the next account starts without the old Team", async () => {
  const view = mount()
  try {
    await showChoices(view)
    view.choose(teamB)
    await settle()
    view.request(1).resolve(json(context(teamB)))
    await settle()
    expect(view.selected()).toBe(teamB)
    expect(new URL(window.location.href).searchParams.get("teamObjectId")).toBe(teamB)

    view.click("[data-sf-sign-out]")
    await settle()
    expect(view.request(2).url.pathname).toBe(installation.mount + "/auth/logout")
    expect(view.state()).toBe("loading")
    expect(view.selected()).toBeNull()
    revalidate("focus")
    revalidate("pageshow")
    await settle()
    expect(view.requests).toHaveLength(3)
    expect(view.discoveries()).toBe(2)
    view.request(2).resolve(new Response(null, { status: 204 }))
    await settle()
    expect(view.state()).toBe("unauthenticated")
    expect(window.location.search).toBe("")

    revalidate("focus")
    await settle()
    expectIntent(view.request(3))
    view.request(3).resolve(json(context(undefined, {
      ...principal,
      principalObjectId: "d1111111-2222-4333-8444-555555555555",
    })))
    await settle()
    expect(view.selected()).toBeNull()
  } finally {
    view.close()
  }
})

function teamHref(teamObjectId: string) {
  return installation.publicOrigin + "/orchestra/sf-home?" + new URLSearchParams({
    contractRevision: installation.contractRevision, server: installation.publicOrigin,
    installationId: installation.installationId, tenantId: installation.tenantId, teamObjectId,
  })
}

async function admit(view: ReturnType<typeof mount>, index: number, teamObjectId: string) {
  await settle()
  expectIntent(view.request(index), teamObjectId)
  expect(view.selected()).toBeNull()
  view.request(index).resolve(json(context(teamObjectId)))
  await settle()
  expect(view.selected()).toBe(teamObjectId)
}

function historyEvent(href: string) {
  // The browser owns traversal. Exercise its location/event boundary without inventing a context response.
  window.history.replaceState(null, "", href)
  window.dispatchEvent(new PopStateEvent("popstate"))
}

test("an explicit Team deep link is revalidated before display and after a remount", async () => {
  const target = teamHref(teamB)
  const view = mount(target)
  try {
    await admit(view, 0, teamB)
    expect(window.location.href).toBe(target)
    expect(window.history.state).toBeNull()
  } finally {
    view.close()
  }
  const restored = mount(target)
  try {
    await settle()
    expectIntent(restored.request(0), teamB)
    expect(restored.selected()).toBeNull()
    restored.request(0).resolve(json({ status: "denied" }, 403))
    await settle()
    expect(restored.state()).toBe("denied")
    expect(window.location.href).toBe(target)
  } finally {
    restored.close()
  }
})

test("A B A records only confirmed choices and history traversal rereads each intended owner", async () => {
  const view = mount(teamHref(teamA))
  try {
    await admit(view, 0, teamA)
    const initialLength = window.history.length
    view.choose(teamB)
    await settle()
    expect(window.location.href).toBe(teamHref(teamA))
    await admit(view, 1, teamB)
    expect(window.location.href).toBe(teamHref(teamB))
    expect(window.history.length).toBe(initialLength + 1)
    view.choose(teamA)
    await admit(view, 2, teamA)
    expect(window.location.href).toBe(teamHref(teamA))
    expect(window.history.length).toBe(initialLength + 2)

    historyEvent(teamHref(teamB))
    await settle()
    expectIntent(view.request(3), teamB)
    historyEvent(teamHref(teamA))
    await settle()
    expect(view.request(3).signal?.aborted).toBe(true)
    expectIntent(view.request(4), teamA)
    view.request(3).resolve(json(context(teamB)))
    await settle()
    expect(view.selected()).toBeNull()
    expect(window.location.href).toBe(teamHref(teamA))
    view.request(4).resolve(json(context(teamA)))
    await settle()
    expect(view.selected()).toBe(teamA)
  } finally {
    view.close()
  }
})

test("history navigation cancels a pending picker intent instead of preserving it into the new entry", async () => {
  const view = mount(teamHref(teamA))
  try {
    await admit(view, 0, teamA)
    view.choose(teamB)
    await settle()
    expectIntent(view.request(1), teamB)
    historyEvent(teamHref(teamA))
    await settle()
    expect(view.request(1).signal?.aborted).toBe(true)
    expectIntent(view.request(2), teamA)
    view.request(1).resolve(json(context(teamB)))
    await settle()
    expect(view.selected()).toBeNull()
    view.request(2).resolve(json(context(teamA)))
    await settle()
    expect(view.selected()).toBe(teamA)
    expect(window.location.href).toBe(teamHref(teamA))
  } finally {
    view.close()
  }
})

for (const invalid of ["installation", "tenant", "duplicate"]) {
  test("an invalid " + invalid + " link remains refused across refresh without any Team context request", async () => {
    const url = new URL(teamHref(teamB))
    if (invalid === "installation") url.searchParams.set("installationId", "foreign")
    if (invalid === "tenant") url.searchParams.set("tenantId", "21111111-2222-4333-8444-555555555555")
    if (invalid === "duplicate") url.searchParams.append("teamObjectId", teamA)
    const view = mount(url.href)
    try {
      await settle()
      expect(view.state()).toBe("invalid")
      expect(view.selected()).toBeNull()
      expect(view.requests).toHaveLength(0)
      expect(view.host.querySelector("main [role=alert]")?.textContent).toBe("This link is invalid.")
      expect(view.host.querySelector("main a")?.getAttribute("href")).toBe("/")
      revalidate("focus")
      await settle()
      revalidate("pageshow")
      await settle()
      view.click("[data-sf-refresh-access]")
      await settle()
      expect(view.state()).toBe("invalid")
      expect(view.requests).toHaveLength(0)
      expect(window.location.href).toBe(url.href)
    } finally {
      view.close()
    }
  })
}

for (const failure of ["network", "denied", "unauthenticated"]) {
  test("an explicit URL intent survives a final " + failure + " response without default selection", async () => {
    const target = teamHref(teamB)
    const view = mount(target)
    try {
      await settle()
      expectIntent(view.request(0), teamB)
      if (failure === "network") view.request(0).reject(new Error("Connection lost"))
      else view.request(0).resolve(json({ status: failure }, failure === "denied" ? 403 : 401))
      await settle()
      expect(view.state()).toBe(failure === "network" ? "unavailable" : failure)
      expect(view.selected()).toBeNull()
      expect(window.location.href).toBe(target)
      if (failure === "unauthenticated") {
        const link = view.host.querySelector("main a")?.getAttribute("href")
        expect(link).toBeDefined()
        const login = new URL(link!, installation.publicOrigin)
        expect(login.origin).toBe(installation.publicOrigin)
        expect(login.pathname).toBe(installation.mount + "/auth/login")
        expect(login.searchParams.get("returnTo")).toBe(new URL(target).pathname + new URL(target).search)
      }
      revalidate("focus")
      await settle()
      expectIntent(view.request(1), teamB)
      view.request(1).resolve(json(context(teamB)))
      await settle()
      expect(view.selected()).toBe(teamB)
    } finally {
      view.close()
    }
  })
}

test("a foreign history entry fences an in-flight Team response even when no popstate was delivered", async () => {
  const view = mount(teamHref(teamA))
  try {
    await settle()
    expectIntent(view.request(0), teamA)
    const foreign = new URL(teamHref(teamB))
    foreign.searchParams.set("installationId", "foreign")
    window.history.replaceState(null, "", foreign.href)
    view.request(0).resolve(json(context(teamA)))
    await settle()
    await settle()
    expect(view.state()).toBe("invalid")
    expect(view.selected()).toBeNull()
    expect(view.requests).toHaveLength(1)
    expect(window.location.href).toBe(foreign.href)
  } finally {
    view.close()
  }
})

test("a valid URL cannot authorize a different Team returned by the context producer", async () => {
  const target = teamHref(teamB)
  const view = mount(target)
  try {
    await settle()
    expectIntent(view.request(0), teamB)
    view.request(0).resolve(json(context(teamA)))
    await settle()
    expect(view.state()).toBe("unavailable")
    expect(view.selected()).toBeNull()
    expect(window.location.href).toBe(target)
    revalidate("pageshow")
    await settle()
    expectIntent(view.request(1), teamB)
  } finally {
    view.close()
  }
})


const administrationContext = (status: "no-teams" | "revoked" | "denied" = "no-teams", identity = principal) => {
  const base = context(undefined, identity)
  return { ...base, value: { ...base.value, profile: {
    ...base.value.profile, administration: { status: "available" }, teams: { status },
  } } }
}
const catalog = (configRevision: string | number, profiles: { profile: ReturnType<typeof profile>; enabled: boolean }[] = []) =>
  json({ status: "ok", configRevision, profiles })

function expectAdminRequest(request: PendingRequest, method: "GET" | "POST") {
  expect(request.url.origin).toBe(installation.publicOrigin)
  expect(request.url.pathname).toBe(installation.mount + "/api/ui/team-profiles")
  expect(Object.fromEntries(request.url.searchParams)).toEqual({
    contractRevision: "sf-team-profile/1", installationId: installation.installationId, tenantId: installation.tenantId,
  })
  expect(request.init?.method).toBe(method)
  expect(request.init?.credentials).toBe("same-origin")
  expect(request.init?.redirect).toBe("error")
  expect(request.init?.cache).toBe("no-store")
}
function expectAdminCommand(request: PendingRequest, action: string, teamObjectId: string, expectedRevision: string | number) {
  expectAdminRequest(request, "POST")
  expect(new Headers(request.init?.headers).get("content-type")).toBe("application/json")
  if (typeof request.init?.body !== "string") throw new Error("Expected an administrative JSON command")
  expect(JSON.parse(request.init.body)).toEqual({ action, profile: profile(teamObjectId), expectedRevision })
}
function submitTeam(view: ReturnType<typeof mount>, teamObjectId: string) {
  const input = view.host.querySelector<HTMLInputElement>("[data-sf-team-id-input]")
  const form = view.host.querySelector<HTMLFormElement>("[data-sf-team-administration] form")
  if (!input || !form) throw new Error("Expected the real administrative Team form")
  input.value = teamObjectId
  input.dispatchEvent(new Event("input", { bubbles: true }))
  form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }))
}
async function openAdministration(view: ReturnType<typeof mount>) {
  await settle()
  view.request(0).resolve(json(administrationContext()))
  await settle()
  expect(view.selected()).toBeNull()
  expect(view.host.querySelector('a[href$="/dashboard"]')).toBeNull()
  view.click("[data-sf-admin-toggle]")
  await settle()
  expectAdminRequest(view.request(1), "GET")
}

test("an administrator without a Team can enable, disable and remove profiles with the exact opaque CAS revision", async () => {
  const view = mount()
  try {
    await openAdministration(view)
    view.request(1).resolve(catalog("sf-team-policy:initial"))
    await settle()
    const changes = [
      { action: "enable", previous: "sf-team-policy:initial", next: "0", profiles: [{ profile: profile(teamA), enabled: true }] },
      { action: "disable", previous: "0", next: 0, profiles: [{ profile: profile(teamA), enabled: false }] },
      { action: "remove", previous: 0, next: "sf-team-policy:removed", profiles: [] },
    ]
    for (const [index, change] of changes.entries()) {
      if (change.action === "enable") submitTeam(view, teamA)
      else view.click('[data-sf-admin-team="' + teamA + '"] [data-sf-admin-action="' + change.action + '"]')
      await settle()
      const request = 2 + index * 3
      expectAdminCommand(view.request(request), change.action, teamA, change.previous)
      expect(view.host.querySelector<HTMLInputElement>("[data-sf-team-id-input]")?.disabled).toBe(true)
      view.request(request).resolve(json({ status: "ok", configRevision: change.next, changed: true }))
      await settle()
      expectIntent(view.request(request + 1))
      expect(view.host.querySelector("[data-sf-team-administration]")).toBeNull()
      view.request(request + 1).resolve(json(administrationContext()))
      await settle()
      expectAdminRequest(view.request(request + 2), "GET")
      view.request(request + 2).resolve(catalog(change.next, change.profiles))
      await settle()
      expect(view.host.querySelectorAll("[data-sf-admin-team]")).toHaveLength(change.profiles.length)
      expect(view.selected()).toBeNull()
      expect(window.location.href).toBe(installation.publicOrigin + "/")
    }
    expect(view.requests.filter((request) => request.init?.method === "POST")).toHaveLength(3)
  } finally { view.close() }
})

for (const status of ["revoked", "denied", "no-teams"] as const) {
  test("an explicit Team " + status + " projection preserves the URL and independent administration without business authority", async () => {
    const target = teamHref(teamB)
    const view = mount(target)
    try {
      await settle()
      expectIntent(view.request(0), teamB)
      view.request(0).resolve(json(administrationContext(status)))
      await settle()
      expect(view.state()).toBe("authenticated")
      expect(view.selected()).toBeNull()
      expect(view.host.querySelector('a[href$="/dashboard"]')).toBeNull()
      expect(window.location.href).toBe(target)
      view.click("[data-sf-admin-toggle]")
      await settle()
      expectAdminRequest(view.request(1), "GET")
      view.request(1).resolve(catalog("current", [{ profile: profile(teamA), enabled: true }]))
      await settle()
      expect(view.host.querySelector("[data-sf-admin-team]")?.getAttribute("data-sf-admin-team")).toBe(teamA)
      expect(view.selected()).toBeNull()
    } finally { view.close() }
  })
}

test("a ready Team projection cannot substitute the principal in its business stamp", async () => {
  const view = mount(teamHref(teamA))
  try {
    await settle()
    const body = context(teamA)
    body.value.stamp.team!.owner.principal = { ...principal, principalObjectId: "d1111111-2222-4333-8444-555555555555" }
    body.value.profile.administration.status = "available"
    view.request(0).resolve(json(body))
    await settle()
    expect(view.state()).toBe("unavailable")
    expect(view.selected()).toBeNull()
    expect(view.host.querySelector("[data-sf-admin-toggle]")).toBeNull()
  } finally { view.close() }
})

for (const invalid of ["foreign-profile", "status-mismatch"]) {
  test("administrative reads refuse a " + invalid + " response without displaying a usable catalog", async () => {
    const view = mount()
    try {
      await openAdministration(view)
      view.request(1).resolve(invalid === "foreign-profile"
        ? catalog("foreign", [{ profile: { ...profile(teamA), installationId: "foreign-installation" }, enabled: true }])
        : json({ status: "ok", configRevision: "current", profiles: [] }, 403))
      await settle()
      expect(view.host.querySelector("[data-sf-team-administration]")?.getAttribute("data-sf-team-administration")).toBe("unavailable")
      expect(view.host.querySelector("[data-sf-team-id-input]")).toBeNull()
      expect(view.host.querySelector("[data-sf-admin-team]")).toBeNull()
      expect(view.requests).toHaveLength(2)
    } finally { view.close() }
  })
}

test("an administrative conflict requires an explicit new read and never reuses the revision from the conflict", async () => {
  const view = mount()
  try {
    await openAdministration(view)
    view.request(1).resolve(catalog("read-one"))
    await settle()
    submitTeam(view, teamB)
    await settle()
    expectAdminCommand(view.request(2), "enable", teamB, "read-one")
    view.request(2).resolve(json({ status: "conflict", configRevision: "conflict-is-not-a-read" }, 409))
    await settle()
    expect(view.host.querySelector("[data-sf-admin-notice]")?.textContent).toContain("configuration changed")
    expect(view.host.querySelector("[data-sf-team-id-input]")).toBeNull()
    expect(view.requests).toHaveLength(3)
    revalidate("focus")
    await settle()
    view.request(3).resolve(json(administrationContext()))
    await settle()
    expect(view.requests).toHaveLength(4)
    view.click("[data-sf-admin-read]")
    await settle()
    expectAdminRequest(view.request(4), "GET")
    view.request(4).resolve(catalog("fresh-read"))
    await settle()
    submitTeam(view, teamB)
    await settle()
    expectAdminCommand(view.request(5), "enable", teamB, "fresh-read")
    view.request(5).resolve(json({ status: "denied" }, 403))
    await settle()
    const denied = administrationContext()
    denied.value.profile.administration.status = "denied"
    view.request(6).resolve(json(denied))
    await settle()
    expect(view.host.querySelector("[data-sf-team-administration]")).toBeNull()
    expect(view.host.querySelector("[data-sf-admin-notice]")?.textContent).toContain("could not be confirmed")
  } finally { view.close() }
})

for (const failure of ["network", "focus"]) {
  test("an administrative POST interrupted by " + failure + " keeps an unknown outcome until an explicit read without resending", async () => {
    const view = mount()
    try {
      await openAdministration(view)
      view.request(1).resolve(catalog("before-write"))
      await settle()
      submitTeam(view, teamB)
      await settle()
      expectAdminCommand(view.request(2), "enable", teamB, "before-write")
      if (failure === "network") {
        view.request(2).reject(new Error("Connection lost after dispatch"))
        await settle()
        expect(view.host.querySelector("[data-sf-admin-notice]")?.textContent).toContain("unknown")
      }
      revalidate("focus")
      await settle()
      expect(view.request(2).signal?.aborted).toBe(true)
      view.request(3).resolve(json(administrationContext()))
      await settle()
      expect(view.host.querySelector("[data-sf-admin-notice]")?.textContent).toContain("unknown")
      expect(view.host.querySelector("[data-sf-team-id-input]")).toBeNull()
      expect(view.requests).toHaveLength(4)
      if (failure === "focus") {
        view.request(2).resolve(json({ status: "ok", configRevision: "late-success", changed: true }))
        await settle()
        expect(view.host.querySelector("[data-sf-admin-notice]")?.textContent).toContain("unknown")
        expect(view.requests).toHaveLength(4)
      }
      view.click("[data-sf-admin-read]")
      await settle()
      expectAdminRequest(view.request(4), "GET")
      view.request(4).resolve(catalog("observed-current", [{ profile: profile(teamB), enabled: true }]))
      await settle()
      expect(view.host.querySelector("[data-sf-admin-notice]")).toBeNull()
      expect(view.host.querySelector("[data-sf-admin-team]")?.getAttribute("data-sf-admin-team")).toBe(teamB)
      expect(view.requests.filter((request) => request.init?.method === "POST")).toHaveLength(1)
    } finally { view.close() }
  })
}

test("a late administrative catalog cannot survive a principal change or open administration for the next account", async () => {
  const view = mount()
  try {
    await openAdministration(view)
    revalidate("focus")
    await settle()
    expect(view.request(1).signal?.aborted).toBe(true)
    view.request(2).resolve(json(administrationContext("no-teams", {
      ...principal, principalObjectId: "d1111111-2222-4333-8444-555555555555",
    })))
    await settle()
    expect(view.host.querySelector("[data-sf-team-administration]")).toBeNull()
    view.request(1).resolve(catalog("previous-account", [{ profile: profile(teamA), enabled: true }]))
    await settle()
    expect(view.host.querySelector("[data-sf-admin-team]")).toBeNull()
    expect(view.requests).toHaveLength(3)
    view.click("[data-sf-admin-toggle]")
    await settle()
    expectAdminRequest(view.request(3), "GET")
    view.request(3).resolve(catalog("next-account", [{ profile: profile(teamB), enabled: false }]))
    await settle()
    expect(view.host.querySelectorAll("[data-sf-admin-team]")).toHaveLength(1)
    expect(view.host.querySelector("[data-sf-admin-team]")?.getAttribute("data-sf-admin-team")).toBe(teamB)
  } finally { view.close() }
})

test("logout aborts an administrative write and discards its late response before another account", async () => {
  const view = mount()
  try {
    await openAdministration(view)
    view.request(1).resolve(catalog("before-logout"))
    await settle()
    submitTeam(view, teamA)
    await settle()
    view.click("[data-sf-sign-out]")
    await settle()
    expect(view.request(2).signal?.aborted).toBe(true)
    expect(view.request(3).url.pathname).toBe(installation.mount + "/auth/logout")
    view.request(3).resolve(new Response(null, { status: 204 }))
    await settle()
    expect(view.state()).toBe("unauthenticated")
    view.request(2).resolve(json({ status: "ok", configRevision: "late-after-logout", changed: true }))
    await settle()
    expect(view.host.querySelector("[data-sf-admin-notice]")).toBeNull()
    expect(view.host.querySelector("[data-sf-team-administration]")).toBeNull()
    revalidate("focus")
    await settle()
    view.request(4).resolve(json(administrationContext("no-teams", {
      ...principal, principalObjectId: "d1111111-2222-4333-8444-555555555555",
    })))
    await settle()
    expect(view.host.querySelector("[data-sf-admin-notice]")).toBeNull()
    expect(view.host.querySelector("[data-sf-team-administration]")).toBeNull()
    expect(view.requests).toHaveLength(5)
  } finally { view.close() }
})
