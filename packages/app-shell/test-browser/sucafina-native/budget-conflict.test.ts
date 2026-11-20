import { expect, test } from "bun:test"
import { Schema } from "effect"
import { solidDom } from "../real-ui-solid"
import type { SfContext, SfEditScopeKey, SfHref, SfOwnerSelection, SfRef, SfResolvedRoute, SfServerKey } from "@orchestra/schema/sucafina/context"
import type { SfTransport } from "@orchestra/client/sucafina/transport"
import type { SfContextDependencies, SfContextHandle } from "../../src/orchestra/chapters/sucafina/context/contracts"

// Injected A01 envelopes exercise the production F01 registry, draft controller,
// native editor, review and typed command client. This is not installed-host proof.
const { createComponent } = await import("solid-js")
const { render } = await import("solid-js/web")
const { Router, Route } = await import("@solidjs/router")
const { withBrowserPlatform } = await import("./platform-fixture")
const { LanguageProvider }: typeof import("@/context/language") = await import(solidDom("@/context/language", import.meta.dir))
const { SfContextProvider, useSfContext }: typeof import("@/orchestra/chapters/sucafina/context") =
  await import(solidDom("@/orchestra/chapters/sucafina/context", import.meta.dir))
const { createSfDraft }: typeof import("@/orchestra/chapters/sucafina/shared/draft") =
  await import(solidDom("@/orchestra/chapters/sucafina/shared/draft", import.meta.dir))
const { SfBudgetSurface }: typeof import("@/orchestra/chapters/sucafina/dashboard/opex/surface") =
  await import(solidDom("@/orchestra/chapters/sucafina/dashboard/opex/surface", import.meta.dir))

const stamp = { installationId: "install", projectId: "project", hostId: "host",
  principalRef: "actor", policyVersion: "policy", accessRevision: "access" }
const selection: SfOwnerSelection = { serverKey: "server" as SfServerKey, projectId: "project" as SfRef, installationId: "install" as SfRef }
const binding = { installationId: "install", projectId: "project", hostId: "host",
  publicOrigin: "https://sf.test", mount: "/sf", contractRevision: "sf-native-ui/1" as const, authMode: "microsoft" as const }
const op = (operationId: string) => ({ operationId, state: "ready" as const, operational: true, reason: null })
const context: SfContext = { stamp, contractRevision: "sf-native-ui/1", authMode: "microsoft",
  destinations: [{ capabilityId: "CAP04", surface: "dashboard", page: "OPEX Detail", canRead: true, allowedActionIds: ["save-entry"] }],
  availability: [{ family: "domain-read", resource: "CAP04", state: "ready",
    operations: [op("domain.page.CAP04"), op("domain.command.CAP04.save-entry")] }] }
const route: SfResolvedRoute<"CAP04"> = { surfaceId: "CAP04", ownerSelection: selection,
  href: "/orchestra/sf-dashboard/opex/r_b3duZXI?year=2026" as SfHref,
  pathname: "/orchestra/sf-dashboard/opex/r_b3duZXI", query: { year: 2026 }, kind: "detail", params: { lineRef: "owner" as SfRef } }
const source = (id: string, version: number, budget: number, actual = 30, forecast = 115) => ({ status: "ok", context: stamp, value: {
  capabilityId: "CAP04", selection: { year: 2026 }, allowedActionIds: ["save-entry"],
  data: { opexOwners: [{ id: "owner", name: "Operations", budget: 1200 }],
    opexEntries: [{ id, ownerId: "owner", year: 2026, month: 1, budget, actual, forecast }],
    deviations: {}, budgetYtd: { opex: {} } },
  versions: { "opexOwners:owner": 1, ["opexEntries:" + id]: version },
} })

async function waitFor(condition: () => unknown) {
  for (let i = 0; i < 100; i++) {
    if (condition()) return
    await new Promise((resolve) => setTimeout(resolve, 10))
  }
  throw new Error("Native budget fixture did not reach the expected state")
}
function button(node: ParentNode, label: string) {
  const found = [...node.querySelectorAll<HTMLButtonElement>("button")].find((item) => item.textContent?.trim() === label)
  if (!found) throw new Error("Native budget button is unavailable: " + label)
  return found
}
function input(node: ParentNode, field: string) {
  const found = node.querySelector<HTMLInputElement>('input[id$="-' + field + '"]')
  if (!found) throw new Error("Native budget input is unavailable: " + field)
  return found
}
function edit(field: HTMLInputElement, value: string) {
  field.value = value
  field.dispatchEvent(new Event("input", { bubbles: true }))
}
function mount(replacementId: string) {
  const calls: { operationId: string; input: unknown }[] = []
  const writes: unknown[] = []
  const transport: SfTransport = { async execute(operation, value) {
    calls.push({ operationId: operation.operationId, input: structuredClone(value) })
    const read = operation.operationId === "domain.page.CAP04"
    if (!read && operation.operationId !== "domain.command.CAP04.save-entry")
      throw new Error("Unexpected native budget operation")
    if (!read) writes.push(structuredClone(value))
    const body = read ? source(writes.length ? replacementId : "entry-original",
      writes.length > 1 ? 3 : writes.length ? 2 : 1, writes.length > 1 ? 123 : writes.length ? 110 : 100,
      writes.length > 1 ? 34 : 30, writes.length > 1 ? 140 : 115)
      : writes.length === 1 ? { ok: false, status: 409 } : { ok: true }
    return { kind: "response", status: !read && writes.length === 1 ? 409 : 200, headers: {},
      body: Schema.decodeUnknownSync(Schema.toType(operation.output))(body) }
  } }
  const dependencies: SfContextDependencies = {
    listInstallations: async () => ({ installations: [binding] }),
    loadContext: async () => ({ status: "ok", value: context }),
    createTransport: () => transport, resolveTransportIdentity: () => "native-budget",
    createDraft: createSfDraft, revalidateDraft: async () => ({ status: "unavailable" }),
  }
  const captured: { handle?: SfContextHandle } = {}
  const child = () => {
    captured.handle = useSfContext()
    return createComponent(SfBudgetSurface, { capability: "CAP04", route })
  }
  const node = document.createElement("div")
  document.body.append(node)
  const dispose = render(() => withBrowserPlatform(() => createComponent(LanguageProvider, { locale: "en",
    get children() { return createComponent(Router, {
      get children() { return createComponent(Route, { path: "*", component: () =>
        createComponent(SfContextProvider, { selection: () => selection, dependencies,
          get children() { return createComponent(child, {}) } }) }) },
    }) },
  })), node)
  const originalDraft = () => captured.handle?.ready()?.drafts.peek({
    surfaceId: "CAP04", identity: { kind: "record", recordRef: "entry-original" as SfRef },
    editScopeKey: "2026:save-entry:owner:1" as SfEditScopeKey,
  })?.snapshot()
  return { node, calls, writes, originalDraft, close: () => { dispose(); node.remove() } }
}
async function reachConflict(view: ReturnType<typeof mount>) {
  await waitFor(() => view.node.querySelector('.sf-budget-detail tr[data-sf-month="1"] button[data-sf-action="save-entry"]'))
  view.node.querySelector<HTMLButtonElement>('.sf-budget-detail tr[data-sf-month="1"] button[data-sf-action="save-entry"]')!.click()
  const editor = view.node.querySelector<HTMLElement>(".sf-budget-editor")!
  edit(input(editor, "budget"), "123")
  edit(input(editor, "actual"), "34")
  edit(input(editor, "forecast"), "140")
  button(editor, "Review changes").click()
  button(editor, "Save").click()
  await waitFor(() => editor.dataset.sfDraftPhase === "conflict")
  expect(view.writes).toHaveLength(1)
  expect(view.writes[0]).toMatchObject({ id: "entry-original", version: 1,
    values: { ownerId: "owner", year: 2026, month: 1, budget: 123, actual: 34, forecast: 140 } })
  expect(view.originalDraft()).toMatchObject({ availability: "active", phase: "conflict", baseVersion: 1,
    value: { budget: "123", actual: "34", forecast: "140" }, pendingOperation: null })
  return editor
}

test("native budget conflict keeps the original record when its monthly row is replaced", async () => {
  const view = mount("entry-replacement")
  try {
    const editor = await reachConflict(view)
    button(editor, "Load current version and keep my edits").click()
    await waitFor(() => view.calls.filter((call) => call.operationId === "domain.page.CAP04").length === 2 &&
      button(editor, "Load current version and keep my edits").disabled === false)
    expect(view.calls.filter((call) => call.operationId === "domain.page.CAP04").map((call) => call.input)).toEqual([{ year: 2026 }, { year: 2026 }])
    expect(editor.dataset.sfVersion).toBe("1")
    expect(editor.querySelector(".sf-budget-current")).toBeNull()
    expect(editor.querySelector('[role="alert"]')).not.toBeNull()
    expect([input(editor, "budget").value, input(editor, "actual").value, input(editor, "forecast").value]).toEqual(["123", "34", "140"])
    expect(view.originalDraft()).toMatchObject({ availability: "active", phase: "conflict", baseVersion: 1, pendingOperation: null })
    expect(view.writes).toHaveLength(1)
  } finally { view.close() }
})

test("native budget conflict adopts a current version only for the same record and requires a new review", async () => {
  const view = mount("entry-original")
  try {
    const prior = await reachConflict(view)
    button(prior, "Load current version and keep my edits").click()
    await waitFor(() => view.node.querySelector('.sf-budget-current[data-sf-current-version="2"]'))
    const editor = view.node.querySelector<HTMLElement>(".sf-budget-editor")!
    expect(editor.dataset.sfVersion).toBe("2")
    expect(editor.querySelector('[data-component="sf-change-review"]')).toBeNull()
    expect([input(editor, "budget").value, input(editor, "actual").value, input(editor, "forecast").value]).toEqual(["123", "34", "140"])
    expect(view.originalDraft()).toMatchObject({ availability: "active", phase: "dirty", baseVersion: 2,
      base: { budget: "110", actual: "30", forecast: "115" }, value: { budget: "123", actual: "34", forecast: "140" }, pendingOperation: null })
    expect(view.writes).toHaveLength(1)
    button(editor, "Review changes").click()
    button(editor, "Save").click()
    await waitFor(() => !view.node.querySelector(".sf-budget-editor"))
    expect(view.writes).toHaveLength(2)
    expect(view.writes[1]).toMatchObject({ id: "entry-original", version: 2,
      values: { ownerId: "owner", year: 2026, month: 1, budget: 123, actual: 34, forecast: 140 } })
    expect(view.originalDraft()).toMatchObject({ availability: "active", phase: "clean", baseVersion: 3,
      value: { budget: "123", actual: "34", forecast: "140" }, pendingOperation: null })
  } finally { view.close() }
})
