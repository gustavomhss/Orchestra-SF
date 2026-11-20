import { expect, test } from "bun:test"
import { Schema } from "effect"
import { solidDom } from "../real-ui-solid"
import type { SfContext, SfHref, SfOwnerSelection, SfRef, SfServerKey } from "@orchestra/schema/sucafina/context"
import type { SfOperationId } from "@orchestra/schema/sucafina/common"
import type { SfTransport } from "@orchestra/client/sucafina/transport"
import type { SfContextDependencies, SfContextHandle, SfSurfaceProps } from "../../src/orchestra/chapters/sucafina/context/contracts"
import { decodeSfRouteRef, encodeSfRouteRef, resolveSfUrlSelection } from "../../src/orchestra/chapters/sucafina/navigation-state"
import { matchSfNativeRoutePath } from "../../src/orchestra/chapters/sucafina/route-registry"

// Actual Imports/provider/Router/client components, with an explicitly controlled
// typed read boundary. This proves owner-bound links, not installed-host admission.
const { createComponent } = await import("solid-js")
const { createStore } = await import("solid-js/store")
const { render } = await import("solid-js/web")
const { Router, Route } = await import("@solidjs/router")
const { withBrowserPlatform } = await import("./platform-fixture")
const { LanguageProvider }: typeof import("@/context/language") =
  await import(solidDom("@/context/language", import.meta.dir))
const { SfContextProvider, useSfContext }: typeof import("@/orchestra/chapters/sucafina/context") =
  await import(solidDom("@/orchestra/chapters/sucafina/context", import.meta.dir))
const { SfImportsView }: typeof import("@/orchestra/chapters/sucafina/imports") =
  await import(solidDom("@/orchestra/chapters/sucafina/imports", import.meta.dir))
const { createSfDraft }: typeof import("@/orchestra/chapters/sucafina/shared/draft") =
  await import(solidDom("@/orchestra/chapters/sucafina/shared/draft", import.meta.dir))

type Continuation = "review" | "receipt" | "list"
const selections: readonly SfOwnerSelection[] = [
  { serverKey: "server-one" as SfServerKey, projectId: "project / one" as SfRef, installationId: "install+one?x=1#part" as SfRef },
  { serverKey: "server-two" as SfServerKey, projectId: "project / two" as SfRef, installationId: "install+two?x=2#part" as SfRef },
]
const stamp = (selected: SfOwnerSelection) => ({
  installationId: selected.installationId, projectId: selected.projectId, hostId: "host-" + selected.serverKey,
  principalRef: "actor-" + selected.serverKey, policyVersion: "policy", accessRevision: "access",
})
const binding = (selected: SfOwnerSelection) => ({
  installationId: selected.installationId, projectId: selected.projectId, hostId: stamp(selected).hostId,
  publicOrigin: "https://sf.test", mount: "/sf", contractRevision: "sf-native-ui/1" as const,
  authMode: "local-operator" as const,
})
const operation = (operationId: SfOperationId) =>
  ({ operationId, state: "ready" as const, operational: true, reason: null })
const context = (selected: SfOwnerSelection): SfContext => ({
  stamp: stamp(selected), contractRevision: "sf-native-ui/1", authMode: "local-operator",
  destinations: [], availability: [{ family: "files", resource: "import-preview", state: "ready",
    operations: [operation("files.import-reference"), operation("files.import-detail")] }],
})
const manifestId = (selected: SfOwnerSelection) => "preview / 2027?#-" + selected.serverKey
const reference = (selected: SfOwnerSelection, committed: boolean) => {
  const owner = stamp(selected)
  const id = manifestId(selected)
  const receipt = { receiptId: "receipt-" + selected.serverKey, manifestId: id,
    idempotencyKey: "original-key", commandDigest: "original-command", outcome: "applied" as const, changedFields: 1 }
  const manifest = {
    id, version: 1, sourceDigest: "original-source", format: "xlsx",
    context: { installationId: owner.installationId, projectId: owner.projectId, principalRef: owner.principalRef,
      accessRevision: owner.accessRevision, policyVersion: owner.policyVersion, surface: "planner" as const,
      period: { start: "2027-01-01", end: "2027-12-31" }, currency: "USD", sourceRefs: [], capabilities: [] },
    baseIdentity: [], commands: [], issues: [], state: committed ? "applied" as const : "preview" as const,
    domainApplied: committed,
    receipts: committed ? [{ id: receipt.receiptId, idempotencyKey: receipt.idempotencyKey,
      commandDigest: receipt.commandDigest, targetIncarnation: "original-target", principalRef: owner.principalRef,
      surface: "planner" as const, version: 1, at: "2026-11-20T00:00:00Z", status: "applied" as const, errors: [] }] : [],
  }
  const detail = { manifestId: id, version: 1, sourceDigest: manifest.sourceDigest, changes: [] }
  return { manifest, detail, digest: "original-reference", ...(committed ? { receipt } : {}) }
}
async function waitFor(condition: () => unknown) {
  for (let index = 0; index < 100; index++) {
    if (condition()) return
    await new Promise((resolve) => setTimeout(resolve, 10))
  }
  throw new Error("Imports owner fixture did not reach its expected state")
}
function reconcile(node: HTMLElement) {
  const found = [...node.querySelectorAll<HTMLButtonElement>("button")].find((button) =>
    button.textContent?.trim() === "Refresh receipt")
  if (!found) throw new Error("Imports reconcile control is unavailable")
  return found
}
const links = (node: HTMLElement) => [...node.querySelectorAll<HTMLAnchorElement>(".sf-files-actions a")]

function fixture(continuation: Continuation, holdContext = false) {
  const [owners, setOwners] = createStore({ selected: 0, route: 0 })
  const selected = () => selections[owners.selected]!
  const contextGate = Promise.withResolvers<void>()
  if (!holdContext) contextGate.resolve()
  let heldRead: ReturnType<typeof Promise.withResolvers<void>> | undefined
  const reads: { operationId: string; owner: SfOwnerSelection; signal?: AbortSignal; returned: boolean }[] = []
  const captured: { handle?: SfContextHandle } = {}
  const route = (): SfSurfaceProps<"UI56" | "UI57"> => {
    const owner = selected()
    const params = new URLSearchParams({ installation: owner.installationId, server: owner.serverKey, project: owner.projectId })
    const path = continuation === "receipt" ? "/orchestra/sf-imports" :
      "/orchestra/sf-imports/" + encodeSfRouteRef(manifestId(owner)) + (continuation === "review" ? "/preview" : "/receipt")
    const common = { ownerSelection: selections[owners.route]!, href: (path + "?" + params) as SfHref, pathname: path, query: {} }
    if (continuation === "review") return { surfaceId: "UI56",
      route: { ...common, surfaceId: "UI56", kind: "entry", params: { manifestId: manifestId(owner) as SfRef } } }
    if (continuation === "receipt") return { surfaceId: "UI57",
      route: { ...common, surfaceId: "UI57", kind: "history", params: {} } }
    return { surfaceId: "UI57",
      route: { ...common, surfaceId: "UI57", kind: "entry", params: { manifestId: manifestId(owner) as SfRef } } }
  }
  const dependencies: SfContextDependencies = {
    listInstallations: async (owner) => ({ installations: [binding(owner)] }),
    loadContext: async (installation) => {
      const owner = selections.find((item) => item.installationId === installation.installationId)
      if (!owner) throw new Error("Unexpected fixture installation")
      await contextGate.promise
      return { status: "ok", value: context(owner) }
    },
    resolveTransportIdentity: (owner) => "transport-" + owner.serverKey,
    createDraft: createSfDraft, revalidateDraft: async () => ({ status: "unavailable" }),
    createTransport: (installation) => {
      const owner = selections.find((item) => item.installationId === installation.installationId)
      if (!owner) throw new Error("Unexpected transport owner")
      const transport: SfTransport = { async execute(operation, input, options) {
        Schema.decodeUnknownSync(operation.input, { onExcessProperty: "error" })(input)
        // Capture authority at read start, before a later owner can be installed.
        const read = { operationId: operation.operationId, owner: { ...owner }, signal: options.signal, returned: false }
        reads.push(read)
        const value = reference(owner, continuation !== "review")
        let body: unknown
        if (operation.operationId === "files.import-reference") {
          expect(JSON.stringify(input)).toContain(manifestId(owner))
          body = { status: "ok", value }
        } else if (operation.operationId === "files.import-detail") {
          expect(JSON.stringify(input)).toContain(manifestId(owner))
          body = { status: "ok", value: { detail: value.detail, digest: value.digest, receipt: value.receipt } }
        } else throw new Error("Unexpected Imports operation: " + operation.operationId)
        const gate = heldRead
        heldRead = undefined
        // Capture the previous owner's response before waiting. Deliberately
        // deliver it after cancellation to exercise the actual consumer fence.
        if (gate) await gate.promise
        const decoded = Schema.decodeUnknownSync(operation.output, { onExcessProperty: "error" })(body)
        read.returned = true
        return { kind: "response", status: 200, headers: {}, body: decoded }
      } }
      return transport
    },
  }
  const child = () => {
    captured.handle = useSfContext()
    if (continuation === "review") return createComponent(SfImportsView, {
      surfaceId: "UI56", get route() { return route().route as SfSurfaceProps<"UI56">["route"] },
    })
    return createComponent(SfImportsView, {
      surfaceId: "UI57", get route() { return route().route as SfSurfaceProps<"UI57">["route"] },
    })
  }
  const node = document.createElement("div")
  document.body.append(node)
  // F01 reconciles its store: give it a detached selection, not the fixture oracle.
  const dispose = render(() => withBrowserPlatform(() => createComponent(LanguageProvider, {
    locale: "en", get children() { return createComponent(Router, {
      get children() { return createComponent(Route, { path: "*", component: () =>
        createComponent(SfContextProvider, { selection: () => ({ ...selected() }), dependencies,
          get children() { return createComponent(child, {}) } }) }) },
    }) },
  })), node)
  const handle = () => {
    if (!captured.handle) throw new Error("Imports owner is unavailable")
    return captured.handle
  }
  return {
    node, reads, selected, handle, route, releaseContext: () => contextGate.resolve(),
    holdRead: () => { const gate = Promise.withResolvers<void>(); heldRead = gate; return gate },
    selectOwner: (index: number) => setOwners({ selected: index, route: index }),
    selectRouteOwner: (index: number) => setOwners("route", index),
    load: async () => {
      await waitFor(() => handle().state().status === "ready" && node.querySelector('[data-sf-read-state="ready"]'))
      if (continuation === "receipt") {
        const input = node.querySelector<HTMLInputElement>('[data-sf-history="authorized-reference"] input')
        if (!input) throw new Error("Import history input is unavailable")
        input.value = manifestId(selected())
        input.dispatchEvent(new Event("input", { bubbles: true }))
      }
      reconcile(node).click()
      await waitFor(() => node.querySelector('[data-sf-phase="preview"], [data-sf-phase="receipt"]'))
    },
    close: () => { contextGate.resolve(); heldRead?.resolve(); dispose(); node.remove() },
  }
}
function assertOwnerLink(view: ReturnType<typeof fixture>, continuation: Continuation) {
  const shown = links(view.node)
  expect(shown).toHaveLength(1)
  const href = shown[0]!.getAttribute("href")!
  const url = new URL(href, "https://orchestra.test")
  const owner = view.selected()
  expect([...url.searchParams.keys()].sort()).toEqual(["installation", "project", "server"])
  expect(url.searchParams.getAll("server")).toEqual([owner.serverKey])
  expect(url.searchParams.getAll("project")).toEqual([owner.projectId])
  expect(url.searchParams.getAll("installation")).toEqual([owner.installationId])
  expect(url.hash).toBe("")
  if (continuation === "list") expect(url.pathname).toBe("/orchestra/sf-imports")
  else {
    expect(url.pathname.endsWith("/" + continuation)).toBe(true)
    expect(decodeSfRouteRef(url.pathname.split("/").at(-2)!)).toBe(manifestId(owner))
  }
  expect(matchSfNativeRoutePath(url.pathname)).toMatchObject({
    surfaceId: "UI57", kind: continuation === "list" ? "history" : continuation === "review" ? "review" : "entry",
  })
  expect(resolveSfUrlSelection(href, String(view.route().route.href), owner)).toEqual({
    status: "selected", selection: owner, explicit: true,
  })
}

test("Imports review, receipt and history links retain the current exact owner selectors", async () => {
  for (const continuation of ["review", "receipt", "list"] as const) {
    const view = fixture(continuation)
    try {
      await view.load()
      assertOwnerLink(view, continuation)
      expect(view.reads.map((read) => read.operationId)).toEqual(continuation === "receipt"
        ? ["files.import-reference", "files.import-detail"] : ["files.import-reference"])
    } finally { view.close() }
  }
})

test("Imports exposes no continuation while resolving or revoked and requires a fresh source after reload", async () => {
  for (const continuation of ["review", "receipt", "list"] as const) {
    const view = fixture(continuation, true)
    try {
      expect(links(view.node)).toHaveLength(0)
      expect(view.reads).toHaveLength(0)
      view.releaseContext()
      await view.load()
      assertOwnerLink(view, continuation)
      expect(view.node.textContent).toContain("2027-01-01")
      view.handle().invalidate("revoked")
      await waitFor(() => view.handle().state().status === "denied")
      expect(links(view.node)).toHaveLength(0)
      expect(view.node.textContent).not.toContain("2027-01-01")
      await view.handle().reload()
      await waitFor(() => view.handle().state().status === "ready")
      expect(links(view.node)).toHaveLength(0)
      await view.load()
      assertOwnerLink(view, continuation)
    } finally { view.close() }
  }
})

test("Imports never binds a ready source to a mismatched route owner", async () => {
  for (const continuation of ["review", "receipt", "list"] as const) {
    const view = fixture(continuation)
    try {
      await view.load()
      assertOwnerLink(view, continuation)
      const count = view.reads.length
      view.selectRouteOwner(1)
      expect(links(view.node)).toHaveLength(0)
      expect(view.handle().state().status).toBe("ready")
      expect(view.reads).toHaveLength(count)
      view.selectRouteOwner(0)
      assertOwnerLink(view, continuation)
      expect(view.reads).toHaveLength(count)
    } finally { view.close() }
  }
})

test("Imports ignores a late read from the previous owner before producing new continuation links", async () => {
  const view = fixture("review")
  let held: ReturnType<typeof Promise.withResolvers<void>> | undefined
  try {
    await view.load()
    assertOwnerLink(view, "review")
    held = view.holdRead()
    reconcile(view.node).click()
    await waitFor(() => view.reads.length === 2)
    const previous = view.reads[1]!
    view.selectOwner(1)
    await waitFor(() => view.handle().state().status === "ready" && previous.signal?.aborted)
    expect(links(view.node)).toHaveLength(0)
    held.resolve()
    await waitFor(() => previous.returned)
    expect(links(view.node)).toHaveLength(0)
    await view.load()
    assertOwnerLink(view, "review")
    expect(view.reads.map((read) => read.owner.serverKey)).toEqual(["server-one", "server-one", "server-two"])
  } finally { held?.resolve(); view.close() }
})
