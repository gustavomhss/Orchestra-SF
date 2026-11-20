import { expect, test } from "bun:test"
import { solidDom } from "../real-ui-solid"
import type { SfContext, SfHref, SfOwnerSelection, SfRef, SfResolvedRoute, SfServerKey } from "@orchestra/schema/sucafina/context"
import type { SfContextDependencies, SfContextHandle } from "../../src/orchestra/chapters/sucafina/context/contracts"
import { sfContextDestinationsFromPages } from "../../../../apps/cli/src/sucafina-product/native-ui/live-context"
import { createSfPortfolioViewState } from "../../src/orchestra/chapters/sucafina/portfolio/view-state"
import { sfProjectHref } from "../../src/orchestra/chapters/sucafina/portfolio/projects/paths"

// Real provider/registry lifecycle with injected discovery, not installed auth evidence.
const { batch, createComponent, createSignal, onCleanup, Show } = await import("solid-js")
const { render } = await import("solid-js/web")
const { withBrowserPlatform } = await import("./platform-fixture")
const { LanguageProvider }: typeof import("@/context/language") = await import(solidDom("@/context/language", import.meta.dir))
const { SfContextProvider, useSfContext }: typeof import("@/orchestra/chapters/sucafina/context") =
  await import(solidDom("@/orchestra/chapters/sucafina/context", import.meta.dir))
const { createSfDraft }: typeof import("@/orchestra/chapters/sucafina/shared/draft") =
  await import(solidDom("@/orchestra/chapters/sucafina/shared/draft", import.meta.dir))
const { parsePortfolioRouteQuery }: typeof import("@/orchestra/chapters/sucafina/host/portfolio-route") =
  await import(solidDom("@/orchestra/chapters/sucafina/host/portfolio-route", import.meta.dir))
const { matchSfNativeRoutePath } = await import("../../src/orchestra/chapters/sucafina/route-registry")

const selection: SfOwnerSelection = {
  serverKey: "server" as SfServerKey, projectId: "project" as SfRef, installationId: "install" as SfRef,
}
const binding = {
  installationId: "install", projectId: "project", hostId: "host", publicOrigin: "https://sf.test",
  mount: "/sf", contractRevision: "sf-native-ui/1" as const, authMode: "microsoft" as const,
}
const context = (accessRevision = "access-1", principalRef = "actor", policyVersion = "policy-1"): SfContext => ({
  stamp: { installationId: "install", projectId: "project", hostId: "host", principalRef, policyVersion, accessRevision },
  contractRevision: "sf-native-ui/1", authMode: "microsoft",
  destinations: sfContextDestinationsFromPages([
    { surface: "dashboard", page: "Portfolio Dashboard" }, { surface: "dashboard", page: "All Projects" },
  ])!,
  availability: [
    { family: "domain-read", resource: "CAP09", state: "ready",
      operations: [{ operationId: "domain.page.CAP09", state: "ready", operational: true, reason: null }] },
    { family: "domain-read", resource: "CAP10", state: "ready",
      operations: [{ operationId: "domain.page.CAP10", state: "ready", operational: true, reason: null }] },
  ],
})
const overview = (year = 2026): SfResolvedRoute<"CAP09"> => ({
  surfaceId: "CAP09", kind: "entry", params: {}, ownerSelection: selection,
  href: ("/orchestra/sf-portfolio/overview?year=" + year + "&filter=watch") as SfHref,
  pathname: "/orchestra/sf-portfolio/overview", query: { year, filter: "watch" },
})
const projects = (year = 2026): SfResolvedRoute<"CAP10"> => ({
  surfaceId: "CAP10", kind: "entry", params: {}, ownerSelection: selection,
  href: ("/orchestra/sf-portfolio/projects?year=" + year) as SfHref,
  pathname: "/orchestra/sf-portfolio/projects", query: { year },
})
type Reply = Awaited<ReturnType<SfContextDependencies["loadContext"]>>
async function waitFor(predicate: () => boolean, diagnostic: () => object) {
  for (let i = 0; i < 100; i++) {
    if (predicate()) return
    await new Promise((resolve) => setTimeout(resolve, 10))
  }
  throw new Error("Portfolio view-state fixture did not reach the expected state: " + JSON.stringify(diagnostic()))
}
async function fixture() {
  const pending: (() => Promise<Reply>)[] = []
  const captured: { handle?: SfContextHandle; controller?: ReturnType<typeof createSfPortfolioViewState>; mounts: number; disposals: number } = { mounts: 0, disposals: 0 }
  const [route, setRoute] = createSignal<SfResolvedRoute<"CAP09" | "CAP10">>(overview())
  const [instance, setInstance] = createSignal(1)
  const dependencies: SfContextDependencies = {
    listInstallations: async () => ({ installations: [binding] }),
    loadContext: async () => pending.shift()?.() ?? { status: "ok", value: context() },
    createTransport: () => ({ async execute() { throw new Error("Presentation state must not invoke a domain operation") } }),
    resolveTransportIdentity: () => "original-connection", createDraft: createSfDraft,
    revalidateDraft: async () => ({ status: "unavailable" }),
  }
  const probe = () => {
    captured.mounts += 1
    onCleanup(() => { captured.disposals += 1 })
    captured.controller = createSfPortfolioViewState(useSfContext(), route)
    return null
  }
  const child = () => {
    captured.handle = useSfContext()
    return createComponent(Show, { get when() { return instance() }, keyed: true,
      // A keyed render prop must accept the key. A zero-argument child is an
      // accessor with stable function identity and does not remount the probe.
      children: (_instance: number) => createComponent(probe, {}) })
  }
  const node = document.createElement("div")
  document.body.append(node)
  const dispose = render(() => withBrowserPlatform(() => createComponent(LanguageProvider, {
    locale: "en", get children() {
      return createComponent(SfContextProvider, { selection: () => selection, dependencies,
        get children() { return createComponent(child, {}) } })
    },
  })), node)
  const diagnostic = () => ({ status: captured.handle?.state().status,
    filter: captured.controller?.value.filter, mounts: captured.mounts, disposals: captured.disposals })
  try {
    await waitFor(() => captured.handle?.state().status === "ready" && captured.controller?.value.filter === "watch", diagnostic)
    expect(captured.mounts).toBe(1)
    expect(captured.disposals).toBe(0)
  } catch (error) { dispose(); node.remove(); throw error }
  return {
    get handle() { return captured.handle! },
    get controller() { return captured.controller! },
    pending,
    async remount(next: SfResolvedRoute<"CAP09" | "CAP10">) {
      const old = captured.controller
      const mounts = captured.mounts
      const disposals = captured.disposals
      batch(() => { setRoute(next); setInstance((value) => value + 1) })
      await waitFor(() => captured.controller !== old, diagnostic)
      expect(captured.mounts).toBe(mounts + 1)
      expect(captured.disposals).toBe(disposals + 1)
    },
    close() { dispose(); node.remove() },
  }
}

test("Portfolio selectors survive native detail/list remounts and a fresh admission for the same owner", async () => {
  const view = await fixture()
  try {
    const input = { search: "Cloud", status: "Planning" }
    expect(view.controller.change(input)).toBe(true)
    input.search = "mutated after handoff"
    expect(view.controller.value).toEqual({ search: "Cloud", status: "Planning", filter: "watch" })
    const first = view.handle.ready()!
    const detail: SfResolvedRoute<"CAP10"> = {
      ...projects(), kind: "detail", params: { projectRef: "project-1" as SfRef },
      href: sfProjectHref(overview(), "detail", "project-1") as SfHref,
      pathname: "/orchestra/sf-portfolio/projects/project-1",
    }
    await view.remount(detail)
    expect(view.controller.value).toEqual({ search: "Cloud", status: "Planning", filter: "watch" })
    const reload = view.handle.reload()
    expect(view.handle.ready()).toBeUndefined()
    expect(view.controller.value).toEqual({ search: "", status: "", filter: "" })
    expect(view.controller.change({ search: "during resolving" })).toBe(false)
    await reload
    expect(view.handle.ready()!.transport).not.toBe(first.transport)
    expect(view.handle.ready()!.drafts).toBe(first.drafts)
    expect(view.controller.value).toEqual({ search: "Cloud", status: "Planning", filter: "watch" })
    await view.remount(projects())
    expect(view.controller.value).toEqual({ search: "Cloud", status: "Planning", filter: "watch" })
    expect(view.controller.change({ filter: "private" })).toBe(false)
    expect(view.controller.value.filter).toBe("watch")
  } finally { view.close() }
})

test("Portfolio selector memory resets for another period, access revision, policy or principal", async () => {
  const view = await fixture()
  try {
    view.controller.change({ search: "Cloud" })
    await view.remount(projects(2027))
    expect(view.controller.value).toEqual({ search: "", status: "", filter: "" })
    await view.remount(projects())
    expect(view.controller.value.search).toBe("")
    for (const fresh of [context("access-2"), context("access-2", "actor", "policy-2"), context("access-2", "another-actor", "policy-2")]) {
      expect(view.controller.change({ search: "private project", status: "Planning", filter: "watch" })).toBe(true)
      view.pending.push(async () => ({ status: "ok", value: fresh }))
      await view.handle.reload()
      expect(view.controller.value).toEqual({ search: "", status: "", filter: "" })
    }
  } finally { view.close() }
})

test("Portfolio selectors remain hidden during unavailable admission and are purged after denial or logout", async () => {
  const view = await fixture()
  try {
    view.controller.change({ search: "Cloud" })
    await view.remount(projects())
    view.pending.push(async () => ({ status: "unavailable", reason: "host-unavailable" }))
    await view.handle.reload()
    expect(view.controller.value).toEqual({ search: "", status: "", filter: "" })
    expect(view.controller.change({ search: "unavailable" })).toBe(false)
    await view.handle.reload()
    expect(view.controller.value.search).toBe("")
    view.controller.change({ search: "private project" })
    view.pending.push(async () => ({ status: "denied" }))
    await view.handle.reload()
    expect(view.controller.value).toEqual({ search: "", status: "", filter: "" })
    expect(view.controller.change({ search: "denied" })).toBe(false)
    await view.handle.reload()
    expect(view.controller.value.search).toBe("")
    view.controller.change({ search: "another private project" })
    view.handle.invalidate("logout")
    expect(view.controller.value).toEqual({ search: "", status: "", filter: "" })
    await view.handle.reload()
    expect(view.controller.value.search).toBe("")
  } finally { view.close() }
})

test("Portfolio cross-links keep the canonical period without sending private selectors or CAP09-only filters to CAP10", () => {
  const source = { ...overview(), query: { year: 2026, status: "Planning", filter: "watch" } }
  for (const kind of ["projects", "detail", "edit", "milestones", "new"] as const) {
    const href = sfProjectHref(source, kind, "project-1")!
    const url = new URL(href, "https://sf.test")
    expect([...url.searchParams.keys()]).toEqual(["year"])
    expect(url.searchParams.get("year")).toBe("2026")
    const candidate = matchSfNativeRoutePath(url.pathname)!
    expect(parsePortfolioRouteQuery(url.searchParams, candidate)).toEqual({ year: 2026 })
  }
  const href = sfProjectHref(source, "overview")!
  const url = new URL(href, "https://sf.test")
  expect(parsePortfolioRouteQuery(url.searchParams, matchSfNativeRoutePath(url.pathname)!)).toEqual({
    year: 2026, status: "Planning", filter: "watch",
  })
})
