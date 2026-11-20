import { describe, expect, test } from "bun:test"
import type {
  SfHref, SfOwnerKey, SfOwnerSelection, SfRef, SfResolvedRoute, SfServerKey,
} from "@orchestra/schema/sucafina/context"
import {
  createSfNavigationState, decodeSfRouteRef, encodeSfRouteRef, resolveSfUrlSelection,
  sfEntryDestinationRequest,
} from "../../src/orchestra/chapters/sucafina/navigation-state"
import {
  parseSfInstallationSelector, readSfInstallations,
  type SfTrustedInstallationSource,
} from "../../../server/src/sucafina-installations"

const page = "https://orchestra.example/orchestra/sf-home/context"
const selected = (serverKey: string, projectId = "project", installationId = "installation"): SfOwnerSelection => ({
  serverKey: serverKey as SfServerKey,
  projectId: projectId as SfRef,
  installationId: installationId as SfRef,
})
const href = (serverKey: string) => `${page}?server=${serverKey}&project=project&installation=installation`
const route = (ownerSelection: SfOwnerSelection): SfResolvedRoute => ({
  surfaceId: "UI67",
  kind: "entry",
  params: {},
  ownerSelection,
  href: href(ownerSelection.serverKey) as SfHref,
  pathname: "/orchestra/sf-home/context",
  query: {},
})
const original = (id: string, projectId = "project") => ({
  publicOrigin: "http://127.0.0.1:4096",
  mount: "/sucafina",
  authMode: "local-operator" as const,
  identity: () => ({ installationId: id, projectId, hostId: "loaded-host" }),
})

describe("F01 local-operator legacy installation discovery", () => {
  test("IDs never call selected Location, cwd or directory fallback", async () => {
    let locationCalls = 0
    const source: SfTrustedInstallationSource = {
      current: async () => original("installation"),
      forAdmittedLocation: async () => { locationCalls++; return [original("wrong")] },
    }
    const match = await readSfInstallations(source, { select: "ids", installationId: "installation", projectId: "project" }, new AbortController().signal)
    expect(match.installations).toHaveLength(1)
    const wrong = await readSfInstallations(source, { select: "ids", installationId: "wrong", projectId: "project" }, new AbortController().signal)
    expect(wrong.installations).toEqual([])
    expect(locationCalls).toBe(0)
  })
  test("location mode is separate, explicit and dispatched only via admitted Location", async () => {
    let inspected = ""
    const source: SfTrustedInstallationSource = {
      current: async () => { throw new Error("should not use IDs") },
      forAdmittedLocation: async (loc) => { inspected = loc.directory; return [original("one")] },
    }
    expect(parseSfInstallationSelector("https://orchestra.example/api/sucafina/installations?select=location&location%5Bdirectory%5D=%2Frepo")).toEqual({
      select: "location", location: { directory: "/repo" },
    })
    const response = await readSfInstallations(source, { select: "location", location: { directory: "/repo" } }, new AbortController().signal)
    expect(inspected).toBe("/repo")
    expect(response.installations).toHaveLength(1)
  })
  test("unknown, mixed, duplicate, partial and empty query selectors fail closed", () => {
    const invalid = [
      "select=ids&installationId=A&projectId=P&location%5Bdirectory%5D=%2Fwrong",
      "select=ids&installationId=A&projectId=P&projectId=Q",
      "select=ids&installationId=A",
      "select=ids&installationId=A&projectId=P&extra=1",
      "select=location&location%5Bworkspace%5D=w",
      "select=ids&installationId=&projectId=P",
    ]
    for (const query of invalid) expect(() =>
      parseSfInstallationSelector(`https://orchestra.example/api/sucafina/installations?${query}`),
    ).toThrow()
  })
})

describe("F01 URL and owner fences", () => {
  test("explicit URL A never inherits a prior shell selection B", () => {
    expect(resolveSfUrlSelection(href("A"), page, selected("B"))).toEqual({
      status: "selected", explicit: true, selection: selected("A"),
    })
    expect(resolveSfUrlSelection(page, page, selected("B"))).toEqual({
      status: "selected", explicit: false, selection: selected("B"),
    })
    expect(resolveSfUrlSelection(page + "?server=A&project=project", page, selected("B"))).toEqual({ status: "invalid-link" })
    expect(resolveSfUrlSelection("https://attacker.example/orchestra/sf-home/context?server=A&project=project&installation=installation", page, selected("B"))).toEqual({ status: "invalid-link" })
  })
  test("opaque refs remain exact including reserved static tokens and Unicode", () => {
    for (const value of ["new", "review", "compare", "A/B?C#D", "cafè 🧭", "r_fake", "  original  "]) {
      const encoded = encodeSfRouteRef(value)
      expect(encoded.startsWith("r_")).toBe(true)
      expect(decodeSfRouteRef(encoded)).toBe(value)
    }
    for (const value of ["plain", "r_", "r_abc=", "r_A", "r_____"]) expect(decodeSfRouteRef(value)).toBeUndefined()
  })
  test("an explicit unauthorized link is not silently redirected to previous server", async () => {
    const passed: SfOwnerSelection[] = []
    const committed: string[] = []
    const nav = createSfNavigationState({
      selected: () => selected("B"),
      currentHref: () => page,
      currentOwnerKey: () => "old" as SfOwnerKey,
      hasDirtyDrafts: () => false,
      confirmDiscard: async () => true,
      invalidateOwner: () => undefined,
      validateRetained: (_route, value) => value,
      resolveAuthorizedRoute: async (_url, selection) => { passed.push(selection); return { status: "denied" } },
      commit: ({ ownerKey }) => committed.push(ownerKey),
    })
    expect(await nav.requestNativeTransition(href("A"), "deep-link")).toEqual({ status: "denied" })
    expect(passed).toEqual([selected("A")])
    expect(committed).toEqual([])
    nav.dispose()
  })
  test("dirty voluntary owner change waits for discard, then purges before one atomic commit", async () => {
    let decision = false
    const events: string[] = []
    const nav = createSfNavigationState({
      selected: () => selected("B"),
      currentHref: () => page,
      currentOwnerKey: () => "owner-B" as SfOwnerKey,
      hasDirtyDrafts: () => true,
      confirmDiscard: async () => { events.push("confirm"); return decision },
      invalidateOwner: () => { events.push("purge") },
      validateRetained: (_route, value) => value,
      resolveAuthorizedRoute: async (_url, selection) => ({ status: "authorized", route: route(selection), ownerKey: "owner-A" as SfOwnerKey }),
      commit: () => { events.push("commit") },
    })
    expect(await nav.requestNativeTransition(href("A"), "sidebar")).toEqual({ status: "kept-editing" })
    expect(events).toEqual(["confirm"])
    decision = true
    expect(await nav.requestNativeTransition(href("A"), "keyboard")).toMatchObject({ status: "committed" })
    expect(events).toEqual(["confirm", "confirm", "purge", "commit"])
    nav.dispose()
  })
  test("late A cannot commit over a newer B", async () => {
    const gate = Promise.withResolvers<void>()
    const committed: string[] = []
    const nav = createSfNavigationState({
      selected: () => selected("B"),
      currentHref: () => page,
      currentOwnerKey: () => undefined,
      hasDirtyDrafts: () => false,
      confirmDiscard: async () => true,
      invalidateOwner: () => undefined,
      validateRetained: (_route, value) => value,
      resolveAuthorizedRoute: async (_url, selection) => {
        if (selection.serverKey === "A") await gate.promise
        return { status: "authorized", route: route(selection), ownerKey: selection.serverKey as unknown as SfOwnerKey }
      },
      commit: ({ selection }) => committed.push(selection.serverKey),
    })
    const first = nav.requestNativeTransition(href("A"), "deep-link")
    const second = nav.requestNativeTransition(href("B"), "sidebar")
    await second
    gate.resolve()
    expect(await first).toEqual({ status: "aborted" })
    expect(committed).toEqual(["B"])
    nav.dispose()
  })
  test("owner-scoped list focus/scroll cannot cross an access revision", () => {
    const nav = createSfNavigationState({
      selected: () => selected("A"), currentHref: () => page, currentOwnerKey: () => undefined,
      hasDirtyDrafts: () => false, confirmDiscard: async () => true,
      invalidateOwner: () => undefined, validateRetained: (_route, value) => value,
      resolveAuthorizedRoute: async (_url, selection) => ({ status: "authorized", route: route(selection), ownerKey: "owner-A" as SfOwnerKey }),
      commit: () => undefined,
    })
    nav.remember("owner-A" as SfOwnerKey, route(selected("A")), "v1", "list", { cursor: "cursor" as SfRef, scrollY: 22 })
    expect(nav.restore("owner-A" as SfOwnerKey, "UI67", "v1", "list")).toMatchObject({ scrollY: 22 })
    expect(nav.restore("owner-B" as SfOwnerKey, "UI67", "v1", "list")).toBeUndefined()
    expect(nav.restore("owner-A" as SfOwnerKey, "UI67", "v2", "list")).toBeUndefined()
    nav.dispose()
  })
})

describe("Q01 original-owner entry navigation candidates", () => {
  test("CAP06→CAP07 and CAP24→CAP25 use only approved frozen entry templates", () => {
    expect(sfEntryDestinationRequest(route(selected("source-a")), "CAP07"))
      .toBe("/orchestra/sf-people/structure?server=source-a&project=project&installation=installation")
    expect(sfEntryDestinationRequest(route(selected("source-a")), "CAP25"))
      .toBe("/orchestra/sf-procurement/requests?server=source-a&project=project&installation=installation")
  })
  test("refuses an incomplete installed owner and never fills another selection", () => {
    const incomplete: SfOwnerSelection = {
      serverKey: "source-a" as SfServerKey, projectId: "project" as SfRef,
    }
    expect(sfEntryDestinationRequest(route(incomplete), "CAP07")).toBeUndefined()
    expect(sfEntryDestinationRequest(route(selected("source-b", "another-project", "another-install")), "CAP25"))
      .toBe("/orchestra/sf-procurement/requests?server=source-b&project=another-project&installation=another-install")
  })
})


describe("F01 Microsoft metadata replaces legacy discovery without admitting an actor", () => {
  const tenantId = "11111111-2222-4333-8444-555555555555"
  const corporate = { publicOrigin: "https://sucafina.example", mount: "/sucafina", authMode: "microsoft" as const,
    tenantId, identity: () => ({ installationId: "installation", projectId: "physical-placement", hostId: "loaded-host" }) }
  test("current and exact installed tenant selectors never consult selected Location or cwd", async () => {
    let current = 0, locations = 0
    const source: SfTrustedInstallationSource = { current: async () => { current++; return corporate },
      forAdmittedLocation: async () => { locations++; return [corporate] } }
    for (const query of ["select=current&contractRevision=sf-team-profile%2F1",
      "select=installation&contractRevision=sf-team-profile%2F1&installationId=installation&tenantId=" + tenantId]) {
      const selector = parseSfInstallationSelector("https://sucafina.example/api/sucafina/installations?" + query)
      const result = await readSfInstallations(source, selector, new AbortController().signal)
      expect(result.installations).toEqual([{ ...corporate.identity(), publicOrigin: corporate.publicOrigin,
        mount: corporate.mount, authMode: "microsoft", contractRevision: "sf-team-profile/1", tenantId }])
    }
    expect(current).toBe(2)
    expect(locations).toBe(0)
  })
  test("Microsoft cannot be discovered by legacy IDs/Location or borrow another tenant/installation", async () => {
    let locations = 0
    const source: SfTrustedInstallationSource = { current: async () => corporate,
      forAdmittedLocation: async () => { locations++; return [corporate] } }
    for (const query of ["select=ids&installationId=installation&projectId=physical-placement",
      "select=location&location%5Bdirectory%5D=%2Frepo",
      "select=installation&contractRevision=sf-team-profile%2F1&installationId=foreign&tenantId=" + tenantId,
      "select=installation&contractRevision=sf-team-profile%2F1&installationId=installation&tenantId=22222222-2222-4333-8444-555555555555"]) {
      expect(await readSfInstallations(source, parseSfInstallationSelector("/api/sucafina/installations?" + query),
        new AbortController().signal)).toEqual({ installations: [] })
    }
    expect(locations).toBe(1) // Only the explicitly local legacy Location selector visits that port; it still yields no Microsoft descriptor.
  })
  test("versioned bootstrap rejects duplicate, partial, mixed and caller-authority queries", () => {
    for (const query of ["select=current", "select=current&contractRevision=sf-native-ui%2F1",
      "select=current&contractRevision=sf-team-profile%2F1&tenantId=" + tenantId,
      "select=current&contractRevision=sf-team-profile%2F1&select=current",
      "select=current&contractRevision=sf-team-profile%2F1&location%5Bdirectory%5D=%2Frepo",
      "select=current&contractRevision=sf-team-profile%2F1&principalRef=caller"]) {
      expect(() => parseSfInstallationSelector("/api/sucafina/installations?" + query)).toThrow()
    }
  })
})
