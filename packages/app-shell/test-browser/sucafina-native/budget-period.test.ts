import { expect, test } from "bun:test"
import { solidDom } from "../real-ui-solid"
import type {
  SfContext, SfEditScopeKey, SfHref, SfOwnerKey, SfOwnerSelection, SfRef, SfResolvedRoute, SfServerKey,
} from "@orchestra/schema/sucafina/context"
import type { SfContextDependencies, SfContextHandle } from "../../src/orchestra/chapters/sucafina/context/contracts"
import { createSfNavigationState } from "../../src/orchestra/chapters/sucafina/navigation-state"
import {
  createSfBudgetPeriodPort, sfBudgetPeriodRequest, type SfCurrentBudgetOwner,
} from "../../src/orchestra/chapters/sucafina/navigation-state/budget-period"
import { parseDashboardRouteQuery, dashboardRouteAvailable } from "../../src/orchestra/chapters/sucafina/host/dashboard-route"
import { matchSfNativeRoutePath } from "../../src/orchestra/chapters/sucafina/route-registry"
import { sfContextDestinationsFromPages } from "../../../../apps/cli/src/sucafina-product/native-ui/live-context"

// Real F01 navigation/provider/registry + reader lifecycle with injected source replies.
// Installed browser/auth/SQLite proof remains in the native runtime acceptance test.
const { createComponent, createSignal } = await import("solid-js")
const { render } = await import("solid-js/web")
const { withBrowserPlatform } = await import("./platform-fixture")
const { LanguageProvider }: typeof import("@/context/language") = await import(solidDom("@/context/language", import.meta.dir))
const { SfContextProvider, useSfContext }: typeof import("@/orchestra/chapters/sucafina/context") =
  await import(solidDom("@/orchestra/chapters/sucafina/context", import.meta.dir))
const { createSfDraft }: typeof import("@/orchestra/chapters/sucafina/shared/draft") =
  await import(solidDom("@/orchestra/chapters/sucafina/shared/draft", import.meta.dir))
const { useU02Projection }: typeof import("@/orchestra/chapters/sucafina/dashboard/executive/reader") =
  await import(solidDom("@/orchestra/chapters/sucafina/dashboard/executive/reader", import.meta.dir))

const selection: SfOwnerSelection = {
  serverKey: "server" as SfServerKey, projectId: "project" as SfRef, installationId: "install" as SfRef,
}
const binding = {
  installationId: "install", projectId: "project", hostId: "host", publicOrigin: "https://sf.test",
  mount: "/sf", contractRevision: "sf-native-ui/1" as const, authMode: "microsoft" as const,
}
const context = (accessRevision = "access-1", principalRef = "actor"): SfContext => ({
  stamp: { installationId: "install", projectId: "project", hostId: "host",
    principalRef, policyVersion: "policy-1", accessRevision },
  contractRevision: "sf-native-ui/1", authMode: "microsoft",
  destinations: sfContextDestinationsFromPages([{ surface: "dashboard", page: "Budget Overview" }])!,
  availability: [{ family: "domain-read", resource: "CAP03", state: "ready", operations: [
    { operationId: "domain.page.CAP03", state: "ready", operational: true, reason: null },
  ] }],
})
const budget = (year = 2026, month = 6, named = false): SfResolvedRoute<"CAP03"> => ({
  surfaceId: "CAP03", kind: "entry", params: {}, ownerSelection: selection,
  pathname: "/orchestra/sf-dashboard/budget",
  href: ("/orchestra/sf-dashboard/budget?" + (named ? "server=server&project=project&installation=install&" : "") +
    "year=" + year + "&month=" + month) as SfHref,
  query: { year, month },
})
const parse = (href: string, ownerSelection = selection): SfResolvedRoute<"CAP03"> | undefined => {
  const url = new URL(href, "https://orchestra.test")
  const candidate = matchSfNativeRoutePath(url.pathname)
  if (!candidate || candidate.surfaceId !== "CAP03" || candidate.kind !== "entry") return
  const query = parseDashboardRouteQuery(url.searchParams, candidate)
  return query ? { surfaceId: "CAP03", kind: "entry", params: {}, ownerSelection,
    pathname: url.pathname, href: (url.pathname + url.search) as SfHref, query } : undefined
}
async function waitFor(predicate: () => boolean, diagnostic: () => object) {
  for (let index = 0; index < 100; index++) {
    if (predicate()) return
    await new Promise((resolve) => setTimeout(resolve, 10))
  }
  throw new Error("Budget period fixture did not settle: " + JSON.stringify(diagnostic()))
}
type Reader = ReturnType<typeof useU02Projection<{ budgetYear: number }>>
type ContextReply = Awaited<ReturnType<SfContextDependencies["loadContext"]>>
async function fixture(named = false, installNavigation = true) {
  const [route, setRoute] = createSignal(budget(2026, 6, named))
  const captured: { handle?: SfContextHandle; reader?: Reader } = {}
  const pending: (() => Promise<void>)[] = []
  const contextReplies: (() => Promise<ContextReply>)[] = []
  const reads: { year?: number; month?: number; transport: unknown }[] = []
  const commits: SfResolvedRoute[] = []
  let confirmations = 0, invalidations = 0, deny = false
  const navigation = createSfNavigationState({
    selected: () => selection, currentHref: () => String(route().href),
    currentOwnerKey: () => {
      const state = captured.handle?.state()
      return state?.status === "ready" ? state.ownerKey : undefined
    },
    hasDirtyDrafts: () => captured.handle?.hasDirtyDrafts() ?? false,
    confirmDiscard: async () => { confirmations += 1; return false },
    discardDrafts: () => captured.handle?.discardDrafts() ?? false,
    invalidateOwner: () => { invalidations += 1; captured.handle?.invalidate("owner-changed") },
    validateRetained: (_route, values) => values,
    resolveAuthorizedRoute: async (href, selected) => {
      await pending.shift()?.()
      const state = captured.handle?.state()
      const resolved = parse(href, selected)
      const candidate = resolved && matchSfNativeRoutePath(resolved.pathname)
      if (!resolved || !candidate) return { status: "invalid-link" }
      if (deny || state?.status !== "ready" || !dashboardRouteAvailable(state.context, candidate)) return { status: "denied" }
      return { status: "authorized", route: resolved, ownerKey: state.ownerKey }
    },
    commit: ({ route: admitted }) => {
      if (admitted.surfaceId !== "CAP03") throw new Error("Unexpected non-Budget commit")
      commits.push(admitted)
      setRoute({ ...admitted, surfaceId: "CAP03" })
    },
  })
  const dependencies: SfContextDependencies = {
    listInstallations: async () => ({ installations: [binding] }),
    loadContext: async () => contextReplies.shift()?.() ?? { status: "ok", value: context() },
    createTransport: () => ({ async execute() { throw new Error("Unexpected hidden domain dispatch") } }),
    resolveTransportIdentity: () => "original-connection", createDraft: createSfDraft,
    revalidateDraft: async (_input, fresh) => ({
      status: "authorized", stamp: fresh.stamp, authority: "unchanged", sourceVersion: 1,
    }),
    ...(installNavigation ? { navigation } : {}),
  }
  const child = () => {
    captured.handle = useSfContext()
    captured.reader = useU02Projection<{ budgetYear: number }>("CAP03", route, "domain.page.CAP03",
      async (transport, selected) => {
        reads.push({ year: selected.year, month: selected.month, transport })
        return { kind: "response", status: 200, body: { status: "ok", value: {
          capabilityId: "CAP03", selection: selected, data: { budgetYear: selected.year ?? 0 },
          versions: {}, allowedActionIds: [],
        } } }
      })
    return null
  }
  const node = document.createElement("div")
  document.body.append(node)
  const dispose = render(() => withBrowserPlatform(() => createComponent(LanguageProvider, {
    locale: "en", get children() {
      return createComponent(SfContextProvider, { selection: () => selection, dependencies,
        get children() { return createComponent(child, {}) } })
    },
  })), node)
  const diagnostic = () => ({
    owner: captured.handle?.state().status, read: captured.reader?.state(),
    selected: captured.reader?.selection(), href: route().href, reads: reads.length, commits: commits.length,
  })
  try { await waitFor(() => captured.reader?.state() === "ready", diagnostic) }
  catch (error) { dispose(); node.remove(); navigation.dispose(); throw error }
  return {
    get handle() { return captured.handle! }, get reader() { return captured.reader! },
    route, reads, commits, pending, contextReplies, navigation, diagnostic,
    deny: (value: boolean) => { deny = value },
    get confirmations() { return confirmations }, get invalidations() { return invalidations },
    close() { dispose(); node.remove(); navigation.dispose() },
  }
}

test("Budget period candidates preserve implicit and named owners and reject unsupported input", () => {
  expect(sfBudgetPeriodRequest(budget(), { year: 2025, month: 6 }))
    .toBe("/orchestra/sf-dashboard/budget?year=2025&month=6")
  expect(sfBudgetPeriodRequest(budget(2026, 6, true), { year: 2025, month: 1 }))
    .toBe("/orchestra/sf-dashboard/budget?server=server&project=project&installation=install&year=2025&month=1")
  for (const period of [{ year: 2023 }, { year: 2028 }, { year: 2025.5 }, { year: NaN },
    { month: 0 }, { month: 13 }, { month: 1.5 }, { year: 2025, opsYear: 2024 }, { year: 2025, execYear: 2027 }])
    expect(sfBudgetPeriodRequest(budget(), period)).toBeUndefined()
  for (const tail of ["&opsYear=2024", "&execYear=2027", "&status=open", "&filter=watch", "&year=2027",
    "&server=server", "&server=server&project=project&installation=", "#private"]) {
    const source = { ...budget(), href: (String(budget().href) + tail) as SfHref }
    expect(sfBudgetPeriodRequest(source, { year: 2025 })).toBeUndefined()
  }
  expect(sfBudgetPeriodRequest({ ...budget(), query: { year: 2026, month: 6, status: "open" } }, { year: 2025 })).toBeUndefined()
  expect(sfBudgetPeriodRequest({ ...budget(), query: { year: 2025, month: 6 } }, { year: 2025 })).toBeUndefined()
  expect(sfBudgetPeriodRequest({ ...budget(2026, 6, true), ownerSelection: { ...selection, projectId: "other" as SfRef } }, { year: 2025 })).toBeUndefined()
})

test("CAP03 waits for F01 commit, preserves drafts, and follows history/reload in each owner mode", async () => {
  for (const named of [false, true]) {
    const view = await fixture(named)
    const gate = Promise.withResolvers<void>()
    let entered = false
    try {
      const originalHref = String(view.route().href)
      const active = view.handle.ready()!
      const draftKey = { surfaceId: "CAP03" as const, identity: { kind: "record" as const, recordRef: "budget-row" as SfRef },
        editScopeKey: "CAP03:2026:6" as SfEditScopeKey }
      const draft = active.drafts.acquire({
        ...draftKey, baseVersion: 1, base: { amount: 10 }, value: { amount: 10 },
        revalidation: { operationId: "domain.page.CAP03", input: { year: 2026, month: 6 }, fieldPaths: ["amount"], actionIds: [] },
      })
      draft.edit({ amount: 11 })
      view.pending.push(async () => { entered = true; await gate.promise })
      view.reader.setYear(2025)
      await waitFor(() => entered && view.reader.state() === "loading", view.diagnostic)
      expect(view.reader.selection()).toEqual({ year: 2026, month: 6, opsMonth: undefined })
      expect(String(view.route().href)).toBe(originalHref)
      expect(view.reads.map((item) => item.year)).toEqual([2026])
      expect(view.commits).toHaveLength(0)
      gate.resolve()
      await waitFor(() => view.reader.state() === "ready" && view.reader.snapshot()?.data.budgetYear === 2025, view.diagnostic)
      expect(view.route().query).toEqual({ year: 2025, month: 6 })
      expect(new URL(String(view.route().href), "https://orchestra.test").searchParams.has("server")).toBe(named)
      expect(view.reads.map((item) => item.year)).toEqual([2026, 2025])
      expect(view.handle.ready()!.drafts).toBe(active.drafts)
      expect(active.drafts.peek(draftKey)).toBe(draft)
      expect(draft.snapshot()).toMatchObject({ availability: "active", dirty: true, value: { amount: 11 } })
      expect(view.confirmations).toBe(0)
      expect(view.invalidations).toBe(0)

      expect((await view.navigation.requestNativeTransition(originalHref, "history")).status).toBe("committed")
      await waitFor(() => view.reader.state() === "ready" && view.reader.selection().year === 2026, view.diagnostic)
      expect(view.reader.snapshot()?.data.budgetYear).toBe(2026)
      const beforeReload = view.handle.ready()!.transport
      await view.handle.reload()
      expect((await view.navigation.requestNativeTransition(originalHref, "reload")).status).toBe("committed")
      await waitFor(() => view.reader.state() === "ready", view.diagnostic)
      expect(view.handle.ready()!.transport).not.toBe(beforeReload)
      expect(view.handle.ready()!.drafts).toBe(active.drafts)
      expect(view.reader.selection()).toEqual({ year: 2026, month: 6, opsMonth: undefined })
      expect(draft.snapshot()).toMatchObject({ dirty: true, value: { amount: 11 } })
      view.reader.setMonth(7)
      await waitFor(() => view.reader.state() === "ready" && view.route().query.month === 7, view.diagnostic)
      expect(view.route().query).toEqual({ year: 2026, month: 7 })
      expect(view.confirmations).toBe(0)
    } finally { gate.resolve(); view.close() }
  }
})

test("CAP03 refuses foreign routes, invalid periods and unavailable navigation without publishing a new selection", async () => {
  const view = await fixture()
  try {
    const before = String(view.route().href)
    const signal = new AbortController().signal
    expect(await view.handle.changeBudgetPeriod!({
      ...view.route(), ownerSelection: { ...selection, serverKey: "foreign" as SfServerKey },
    }, { year: 2025 }, signal)).toBe("denied")
    expect(await view.handle.changeBudgetPeriod!(view.route(), { year: 2028 }, signal)).toBe("invalid-link")
    expect(await view.handle.changeBudgetPeriod!({
      ...view.route(), href: (before + "&opsYear=2024") as SfHref,
    }, { year: 2025 }, signal)).toBe("invalid-link")
    expect(view.commits).toHaveLength(0)
    expect(String(view.route().href)).toBe(before)
    view.deny(true)
    view.reader.setYear(2025)
    await waitFor(() => view.reader.state() === "denied", view.diagnostic)
    expect(view.reader.selection().year).toBe(2026)
    expect(String(view.route().href)).toBe(before)
    view.deny(false)
    view.reader.refresh()
    await waitFor(() => view.reader.state() === "ready", view.diagnostic)
    expect(view.reader.snapshot()?.data.budgetYear).toBe(2026)
  } finally { view.close() }
  const unmounted = await fixture(false, false)
  try {
    expect(unmounted.handle.changeBudgetPeriod).toBeUndefined()
    unmounted.reader.setYear(2025)
    await waitFor(() => unmounted.reader.state() === "unavailable", unmounted.diagnostic)
    expect(unmounted.reader.selection().year).toBe(2026)
    expect(unmounted.commits).toHaveLength(0)
  } finally { unmounted.close() }
})

test("revocation or a refreshed owner generation aborts a delayed Budget admission", async () => {
  for (const change of ["revoked", "access", "principal"] as const) {
    const view = await fixture()
    const gate = Promise.withResolvers<void>()
    let entered = false
    try {
      view.pending.push(async () => { entered = true; await gate.promise })
      const transition = view.handle.changeBudgetPeriod!(view.route(), { year: 2025, month: 6 }, new AbortController().signal)
      await waitFor(() => entered, view.diagnostic)
      if (change === "revoked") view.handle.invalidate("revoked")
      else {
        view.contextReplies.push(async () => ({ status: "ok", value: context("access-2", change === "principal" ? "another-actor" : "actor") }))
        await view.handle.reload()
      }
      gate.resolve()
      expect(await transition).toBe("aborted")
      expect(view.commits).toHaveLength(0)
      expect(view.route().query.year).toBe(2026)
      if (change === "revoked") expect(view.handle.ready()).toBeUndefined()
    } finally { gate.resolve(); view.close() }
  }
})

test("the period port rechecks every owner fence after F01 resolves the destination", async () => {
  const transport = { async execute() { throw new Error("No source operation expected") } }
  const original: SfCurrentBudgetOwner = {
    ownerKey: "owner-1" as SfOwnerKey, generation: 1, selection, stamp: context().stamp, transport, budgetReadReady: true,
  }
  const changes: readonly Partial<SfCurrentBudgetOwner>[] = [
    { ownerKey: "owner-2" as SfOwnerKey }, { generation: 2 },
    { selection: { ...selection, installationId: "other" as SfRef } },
    { stamp: { ...original.stamp, projectId: "other" } }, { stamp: { ...original.stamp, installationId: "other" } },
    { stamp: { ...original.stamp, hostId: "other" } }, { stamp: { ...original.stamp, principalRef: "other" } },
    { stamp: { ...original.stamp, accessRevision: "access-2" } }, { stamp: { ...original.stamp, policyVersion: "policy-2" } },
    { transport: { async execute() { throw new Error("Replacement transport must not be used") } } },
    { budgetReadReady: false },
  ]
  for (const change of changes) {
    let live = original, commits = 0
    const gate = Promise.withResolvers<void>()
    let enteredAtResolution = false
    const navigation = createSfNavigationState({
      selected: () => selection, currentHref: () => String(budget().href), currentOwnerKey: () => original.ownerKey,
      hasDirtyDrafts: () => false, confirmDiscard: async () => false, invalidateOwner: () => undefined,
      validateRetained: (_route, values) => values,
      resolveAuthorizedRoute: async (href) => {
        enteredAtResolution = true; await gate.promise
        return { status: "authorized", route: parse(href)!, ownerKey: original.ownerKey }
      },
      commit: () => { commits += 1 },
    })
    try {
      const port = createSfBudgetPeriodPort(navigation, () => live)
      const result = port(budget(), { year: 2025, month: 6 }, new AbortController().signal)
      await waitFor(() => enteredAtResolution, () => ({ change, commits }))
      live = { ...original, ...change }
      gate.resolve()
      expect(await result).toBe("denied")
      expect(commits).toBe(0)
    } finally { gate.resolve(); navigation.dispose() }
  }
})
