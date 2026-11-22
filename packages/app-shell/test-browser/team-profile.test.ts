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
  resolve: (response: Response) => void
  reject: (error: Error) => void
}

function mount() {
  const href = window.location.href
  window.location.href = installation.publicOrigin + "/"
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
      requests.push({ url, signal: init?.signal ?? undefined, resolve, reject })
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

      view.click("main > button")
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

    view.click("header button")
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
