import { expect, spyOn, test } from "bun:test"
import { setImmediate } from "node:timers"
import { createComponent } from "solid-js"
import { render } from "solid-js/web"
import { Schema } from "effect"
import { TeamProfile } from "@orchestra/schema/sucafina/team-profile"
import { SfTeamContext, SfTeamInstallationDescriptor } from "@orchestra/schema/sucafina/context"
import { createSfTeamConfigurationClient } from "@orchestra/client/sucafina/team-configuration"
import type { TeamAdministrationNotice } from "../src/components/team-profile-administration"
import { solidDom } from "./solid-dom"

const { TeamProfileAdministration }: typeof import("../src/components/team-profile-administration") =
  await import(solidDom("../src/components/team-profile-administration", import.meta.dir))
const { LanguageProvider }: typeof import("../src/context/language") =
  await import(solidDom("../src/context/language", import.meta.dir))
const { PlatformProvider }: typeof import("../src/context/platform") =
  await import(solidDom("../src/context/platform", import.meta.dir))

const binding = Schema.decodeUnknownSync(SfTeamInstallationDescriptor)({
  installationId: "configuration-installation", tenantId: "11111111-2222-4333-8444-555555555555",
  projectId: "technical-project", hostId: "teams-host", publicOrigin: "https://teams.example.test",
  mount: "/sucafina", contractRevision: "sf-team-profile/1", authMode: "microsoft",
})
const profile = Schema.decodeUnknownSync(TeamProfile.Ref)({
  installationId: binding.installationId, tenantId: binding.tenantId,
  teamObjectId: "a1111111-2222-4333-8444-555555555555",
})
const context = (principalObjectId = "c1111111-2222-4333-8444-555555555555") => Schema.decodeUnknownSync(SfTeamContext)({
  contractRevision: binding.contractRevision, authMode: binding.authMode,
  stamp: { installationId: binding.installationId, projectId: binding.projectId, hostId: binding.hostId,
    principalRef: principalObjectId, policyVersion: "policy-one", accessRevision: "access-one" },
  profile: { contractRevision: binding.contractRevision, status: "authenticated", installationId: binding.installationId,
    principal: { tenantId: binding.tenantId, principalObjectId }, accessRevision: "access-one",
    administration: { status: "available" }, teams: { status: "no-teams" } },
  destinations: [], availability: [],
})
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { "content-type": "application/json", "cache-control": "no-store" },
})
const snapshot = (configRevision: string | number, document: unknown = {
  version: 1, settings: { model: "approved/model-one" },
}) => ({ status: "ok", configuration: { origin: "installation-team-store", profile, configRevision, document } })
const settle = () => new Promise<void>((resolve) => setImmediate(resolve))
type Pending = {
  url: URL
  init: RequestInit | undefined
  resolve(response: Response): void
  reject(error: Error): void
}

function mount(component = true) {
  const href = window.location.href
  window.location.href = binding.publicOrigin + "/"
  const requests: Pending[] = []
  const notices: (TeamAdministrationNotice | undefined)[] = []
  let generation = 1
  let current = context()
  let refreshes = 0
  // Only the network boundary is controlled; canonical codecs, the SDK and Solid components are real.
  const network = spyOn(globalThis, "fetch").mockImplementation((input, init) =>
    new Promise<Response>((resolve, reject) => {
      requests.push({ url: new URL(input instanceof Request ? input.url : input.toString()), init, resolve, reject })
    }))
  const host = document.createElement("div")
  document.body.append(host)
  const dispose = component ? render(() => createComponent(PlatformProvider, {
    value: { platform: "web", openExternal() {}, async restart() {}, async notify() {} },
    get children() { return createComponent(LanguageProvider, {
      locale: "en",
      get children() { return createComponent(TeamProfileAdministration, {
        binding, context: current, generation, currentGeneration: () => generation, currentContext: () => current,
        refresh: () => { refreshes++ }, notify: (notice) => notices.push(notice),
      }) },
    }) },
  }), host) : () => undefined
  return {
    host, requests, notices, refreshes: () => refreshes, generation: () => generation,
    expire() { generation++ },
    changePrincipal() { current = context("d1111111-2222-4333-8444-555555555555") },
    request(index: number) {
      const value = requests[index]
      if (!value) throw new Error("Expected configuration request " + index)
      return value
    },
    click(selector: string) {
      const button = host.querySelector<HTMLButtonElement>(selector)
      if (!button) throw new Error("Expected configuration button: " + selector)
      button.click()
    },
    fill(selector: string, value: string) {
      const input = host.querySelector<HTMLInputElement>(selector)
      if (!input) throw new Error("Expected configuration input: " + selector)
      input.value = value
      input.dispatchEvent(new Event("input", { bubbles: true }))
    },
    submit() {
      const form = host.querySelector<HTMLFormElement>("[data-sf-configuration-form]")
      if (!form) throw new Error("Expected configuration form")
      form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }))
    },
    dispose,
    close() {
      dispose()
      host.remove()
      for (const request of requests) request.resolve(new Response(null, { status: 503 }))
      network.mockRestore()
      window.location.href = href
    },
  }
}

async function open(view: ReturnType<typeof mount>, revision: string | number = "catalog-one") {
  await settle()
  view.request(0).resolve(json({ status: "ok", configRevision: revision, profiles: [{ profile, enabled: true }] }))
  await settle()
  view.click("[data-sf-admin-configuration]")
  await settle()
  expectRequest(view.request(1), "GET")
}
function expectRequest(request: Pending, method: "GET" | "POST") {
  expect(request.url.origin).toBe(binding.publicOrigin)
  expect(request.url.pathname).toBe(binding.mount + "/api/ui/team-profiles/configuration")
  expect(Object.fromEntries(request.url.searchParams)).toEqual({
    contractRevision: binding.contractRevision, installationId: binding.installationId, tenantId: binding.tenantId,
    ...(method === "GET" ? { teamObjectId: profile.teamObjectId } : {}),
  })
  expect([...request.url.searchParams]).toHaveLength(method === "GET" ? 4 : 3)
  expect(request.init?.method).toBe(method)
  expect(request.init?.credentials).toBe("same-origin")
  expect(request.init?.redirect).toBe("error")
  expect(request.init?.cache).toBe("no-store")
  expect(new Headers(request.init?.headers).has("authorization")).toBe(false)
  expect(new Headers(request.init?.headers).has("x-sf-team-profile")).toBe(false)
}
function body(request: Pending): unknown {
  expectRequest(request, "POST")
  expect(new Headers(request.init?.headers).get("content-type")).toBe("application/json")
  if (typeof request.init?.body !== "string") throw new Error("Expected configuration JSON")
  return JSON.parse(request.init.body)
}

test("an administrator without a Team edits shared preferences with exact read revision and preserves agent settings", async () => {
  const view = mount()
  const agents = { analyst: { description: "Prepared shared agent", system: "Keep existing instructions.", mode: "subagent", disabled: true } }
  try {
    await open(view)
    view.request(1).resolve(json(snapshot("configuration-read", {
      version: 1, settings: { model: "approved/model-one", default_agent: "maestro", agents },
    })))
    await settle()
    expect(view.host.querySelector<HTMLInputElement>("[data-sf-configuration-model]")?.value).toBe("approved/model-one")
    expect(view.host.querySelector<HTMLInputElement>("[data-sf-configuration-agent]")?.value).toBe("maestro")
    expect(view.host.querySelector<HTMLButtonElement>('[data-sf-admin-action="disable"]')?.disabled).toBe(true)
    view.fill("[data-sf-configuration-model]", "approved/model-two")
    view.fill("[data-sf-configuration-agent]", "")
    view.submit()
    await settle()
    expect(body(view.request(2))).toEqual({
      profile, expectedRevision: "configuration-read", document: { version: 1, settings: { model: "approved/model-two", agents } },
    })
    expect(view.host.querySelector<HTMLInputElement>("[data-sf-configuration-model]")?.disabled).toBe(true)
    view.request(2).resolve(json({ status: "ok", configRevision: "saved-revision", changed: true }))
    await settle()
    expect(view.notices.at(-1)).toBe("sf.teams.adminSaved")
    expect(view.refreshes()).toBe(1)
    expect(view.requests.filter((request) => request.init?.method === "POST")).toHaveLength(1)
    expect(view.host.querySelector('a[href$="/dashboard"]')).toBeNull()
  } finally { view.close() }
})

test("a missing document has no invented model and cannot save an empty configuration", async () => {
  const view = mount()
  try {
    await open(view, 0)
    view.request(1).resolve(json({ status: "not-found" }, 404))
    await settle()
    expect(view.host.querySelector<HTMLInputElement>("[data-sf-configuration-model]")?.value).toBe("")
    view.submit()
    await settle()
    expect(view.requests).toHaveLength(2)
    expect(view.host.querySelector<HTMLInputElement>("[data-sf-configuration-model]")?.getAttribute("aria-invalid")).toBe("true")
    view.fill("[data-sf-configuration-model]", "approved/model-one")
    view.submit()
    await settle()
    expect(body(view.request(2))).toEqual({
      profile, expectedRevision: 0, document: { version: 1, settings: { model: "approved/model-one" } },
    })
    view.request(2).resolve(json({ status: "ok", configRevision: "first-document", changed: true }))
    await settle()
    expect(view.refreshes()).toBe(1)
  } finally { view.close() }
})

for (const failure of ["foreign-team", "unknown-setting", "status-mismatch"] as const) {
  test("configuration read rejects " + failure + " before exposing editable settings", async () => {
    const view = mount()
    try {
      await open(view)
      const response = snapshot("current")
      if (failure === "foreign-team") response.configuration.profile = Schema.decodeUnknownSync(TeamProfile.Ref)({
        ...profile, teamObjectId: "b1111111-2222-4333-8444-555555555555",
      })
      if (failure === "unknown-setting") response.configuration.document = {
        version: 1, settings: { model: "approved/model-one", apiKey: "never-shared" },
      }
      view.request(1).resolve(json(response, failure === "status-mismatch" ? 403 : 200))
      await settle()
      expect(view.host.querySelector("[data-sf-team-configuration]")?.getAttribute("data-sf-team-configuration")).toBe("unavailable")
      expect(view.host.querySelector("[data-sf-configuration-form]")).toBeNull()
      expect(view.requests).toHaveLength(2)
    } finally { view.close() }
  })
}

test("configuration conflict invalidates the catalog and requires an explicit read without using the conflict revision", async () => {
  const view = mount()
  try {
    await open(view)
    view.request(1).resolve(json(snapshot("read-before-conflict")))
    await settle()
    view.submit()
    await settle()
    view.request(2).resolve(json({ status: "conflict", configRevision: "conflict-is-not-a-read" }, 409))
    await settle()
    expect(view.notices.at(-1)).toBe("sf.teams.adminConflict")
    expect(view.host.querySelector("[data-sf-configuration-form]")).toBeNull()
    expect(view.host.querySelector("[data-sf-admin-team]")).toBeNull()
    expect(view.requests).toHaveLength(3)
    view.click("[data-sf-admin-read]")
    await settle()
    view.request(3).resolve(json({ status: "ok", configRevision: "new-catalog", profiles: [{ profile, enabled: true }] }))
    await settle()
    view.click("[data-sf-admin-configuration]")
    await settle()
    view.request(4).resolve(json(snapshot("new-configuration-read")))
    await settle()
    view.submit()
    await settle()
    expect(body(view.request(5))).toEqual({
      profile, expectedRevision: "new-configuration-read",
      document: { version: 1, settings: { model: "approved/model-one" } },
    })
    view.request(5).resolve(json({ status: "ok", configRevision: "confirmed", changed: false }))
    await settle()
    expect(view.refreshes()).toBe(1)
  } finally { view.close() }
})

test("a connection lost after configuration POST keeps an unknown outcome and never resends", async () => {
  const view = mount()
  try {
    await open(view)
    view.request(1).resolve(json(snapshot("observed")))
    await settle()
    view.submit()
    await settle()
    view.request(2).reject(new Error("Network lost after dispatch"))
    await settle()
    expect(view.notices.at(-1)).toBe("sf.teams.adminUnknown")
    expect(view.host.querySelector("[data-sf-configuration-form]")).toBeNull()
    expect(view.host.querySelector("[data-sf-admin-team]")).toBeNull()
    expect(view.requests.filter((request) => request.init?.method === "POST")).toHaveLength(1)
  } finally { view.close() }
})

test("revoked administration on configuration read revalidates the page and exposes no form", async () => {
  const view = mount()
  try {
    await open(view)
    view.request(1).resolve(json({ status: "denied" }, 403))
    await settle()
    expect(view.notices.at(-1)).toBe("sf.teams.adminFailed")
    expect(view.refreshes()).toBe(1)
    expect(view.host.querySelector("[data-sf-configuration-form]")).toBeNull()
  } finally { view.close() }
})

for (const change of ["generation", "principal"] as const) {
  test("a changed " + change + " cannot submit the previously read configuration", async () => {
    const view = mount()
    try {
      await open(view)
      view.request(1).resolve(json(snapshot("read")))
      await settle()
      if (change === "generation") view.expire()
      else view.changePrincipal()
      view.submit()
      await settle()
      expect(view.requests).toHaveLength(2)
    } finally { view.close() }
  })
}

test("navigation aborts a dispatched configuration write and rejects a late success", async () => {
  const view = mount()
  try {
    await open(view)
    view.request(1).resolve(json(snapshot("read")))
    await settle()
    view.submit()
    await settle()
    view.expire()
    view.dispose()
    expect(view.request(2).init?.signal?.aborted).toBe(true)
    expect(view.notices.at(-1)).toBe("sf.teams.adminUnknown")
    view.request(2).resolve(json({ status: "ok", configRevision: "late-success", changed: true }))
    await settle()
    expect(view.notices.at(-1)).toBe("sf.teams.adminUnknown")
    expect(view.refreshes()).toBe(0)
    expect(view.host.querySelector("[data-sf-configuration-form]")).toBeNull()
    expect(view.requests.filter((request) => request.init?.method === "POST")).toHaveLength(1)
  } finally { view.close() }
})

test("the configuration SDK refuses foreign profiles, retries and oversized writes before network dispatch", async () => {
  const view = mount(false)
  try {
    const client = createSfTeamConfigurationClient({
      binding, generation: 1, currentGeneration: view.generation, fetch: (input, init) => fetch(input, init),
    })
    const signal = new AbortController().signal
    const foreign = Schema.decodeUnknownSync(TeamProfile.Ref)({ ...profile, installationId: "another-installation" })
    expect(await client.readConfiguration(foreign, { signal })).toEqual({ kind: "transport-error", reason: "contract-mismatch" })
    expect(await client.readConfiguration(profile, { signal, retry: "same-intent" }))
      .toEqual({ kind: "transport-error", reason: "contract-mismatch" })
    const oversized = Schema.decodeUnknownSync(TeamProfile.ConfigurationCommand)({
      profile, expectedRevision: "revision", document: { version: 1, settings: {
        model: "approved/model-one",
        agents: Object.fromEntries(Array.from({ length: 5 }, (_, index) => ["agent" + index, { system: "a".repeat(16000) }])),
      } },
    })
    expect(await client.configureDocument(oversized, { signal })).toEqual({ kind: "transport-error", reason: "contract-mismatch" })
    expect(view.requests).toHaveLength(0)
  } finally { view.close() }
})
