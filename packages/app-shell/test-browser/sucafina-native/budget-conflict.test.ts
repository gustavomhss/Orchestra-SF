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
const { budgetDeviationSourceMatches }: typeof import("@/orchestra/chapters/sucafina/dashboard/opex/model") =
  await import(solidDom("@/orchestra/chapters/sucafina/dashboard/opex/model", import.meta.dir))
const { SfDomain } = await import("@orchestra/schema/sucafina/domain")

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
    const input = Schema.decodeUnknownSync(Schema.toType(operation.input), { onExcessProperty: "error" })(value)
    // F02 sends JSON. values.versions can be a Solid store proxy, which the
    // structured-clone algorithm rejects before this fixture can return 409.
    const captured: unknown = JSON.parse(JSON.stringify(input))
    calls.push({ operationId: operation.operationId, input: captured })
    const read = operation.operationId === "domain.page.CAP04"
    if (!read && operation.operationId !== "domain.command.CAP04.save-entry")
      throw new Error("Unexpected native budget operation")
    if (!read) writes.push(captured)
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

function mountDeviation(initial: "absent" | "missing-cas" | "omitted" = "absent") {
  const writes: unknown[] = []
  let stored: { flag: "dev-amber"; text: string } | undefined = initial === "missing-cas"
    ? { flag: "dev-amber", text: "Existing deviation without CAS" } : undefined
  let release: (() => void) | undefined
  const transport: SfTransport = { async execute(operation, value) {
    const input = Schema.decodeUnknownSync(Schema.toType(operation.input), { onExcessProperty: "error" })(value)
    const read = operation.operationId === "domain.page.CAP04"
    if (!read && operation.operationId !== "domain.command.CAP04.save-deviation")
      throw new Error("Unexpected native deviation operation")
    if (!read) {
      const command = Schema.decodeUnknownSync(Schema.toType(SfDomain.operations["domain.command.CAP04.save-deviation"].input))(input)
      writes.push(JSON.parse(JSON.stringify(command)))
      if (command.id !== "owner" || command.values.flag !== "dev-amber" || typeof command.values.text !== "string")
        throw new Error("Native deviation fixture received an unexpected command")
      if (writes.length === 1) await new Promise<void>((resolve) => { release = resolve })
      stored = { flag: command.values.flag, text: command.values.text }
    }
    const body = read ? { status: "ok", context: stamp, value: {
      capabilityId: "CAP04", selection: { year: 2026 }, allowedActionIds: ["save-deviation"],
      data: { opexOwners: [{ id: "owner", name: "Operations", budget: 1200 }], opexEntries: [],
        ...(initial === "omitted" ? {} : { deviations: stored ? { "opex-owner-2026-1": stored } : {} }),
        budgetYtd: { opex: {} } },
      versions: { "opexOwners:owner": 1, ...(writes.length ? { "deviations:opex-owner-2026-1": writes.length } : {}) },
    } } : { ok: true }
    return { kind: "response", status: 200, headers: {},
      body: Schema.decodeUnknownSync(Schema.toType(operation.output))(body) }
  } }
  const deviationContext: SfContext = { ...context,
    destinations: [{ ...context.destinations[0]!, allowedActionIds: ["save-deviation"] }],
    availability: [{ family: "domain-read", resource: "CAP04", state: "ready",
      operations: [op("domain.page.CAP04"), op("domain.command.CAP04.save-deviation")] }],
  }
  const dependencies: SfContextDependencies = {
    listInstallations: async () => ({ installations: [binding] }),
    loadContext: async () => ({ status: "ok", value: deviationContext }),
    createTransport: () => transport, resolveTransportIdentity: () => "native-budget-deviation",
    createDraft: createSfDraft, revalidateDraft: async () => ({ status: "unavailable" }),
  }
  const node = document.createElement("div")
  document.body.append(node)
  const dispose = render(() => withBrowserPlatform(() => createComponent(LanguageProvider, { locale: "en",
    get children() { return createComponent(Router, {
      get children() { return createComponent(Route, { path: "*", component: () =>
        createComponent(SfContextProvider, { selection: () => selection, dependencies,
          get children() { return createComponent(SfBudgetSurface, { capability: "CAP04", route }) } }) }) },
    }) },
  })), node)
  return { node, writes, stored: () => stored, release: () => release?.(),
    close: () => { release?.(); dispose(); node.remove() } }
}

test("native budget creates an absent deviation with CAS zero and retains typing after the submitted command", async () => {
  const view = mountDeviation()
  try {
    await waitFor(() => view.node.querySelector('.sf-budget-detail tr[data-sf-month="1"] button[data-sf-action="save-deviation"]'))
    view.node.querySelector<HTMLButtonElement>('.sf-budget-detail tr[data-sf-month="1"] button[data-sf-action="save-deviation"]')!.click()
    let editor = view.node.querySelector<HTMLElement>(".sf-budget-editor")!
    const notes = () => editor.querySelector<HTMLTextAreaElement>('textarea[id$="-notes"]')!
    const changeNotes = (value: string) => { notes().value = value; notes().dispatchEvent(new Event("input", { bubbles: true })) }
    changeNotes("First submitted note")
    const flag = editor.querySelector<HTMLSelectElement>('select[id$="-flag"]')!
    flag.value = "dev-amber"
    flag.dispatchEvent(new Event("change", { bubbles: true }))
    expect(editor.dataset.sfVersion).toBe("0")
    button(editor, "Review changes").click()
    expect(editor.querySelector('[data-component="sf-change-review"]')).not.toBeNull()
    button(editor, "Save").click()
    await waitFor(() => view.writes.length === 1 && editor.dataset.sfDraftPhase === "submitting")
    expect(view.writes[0]).toMatchObject({ id: "owner", version: 0,
      values: { year: 2026, month: 1, flag: "dev-amber", text: "First submitted note" } })
    changeNotes("Later unsent note")
    view.release()
    await waitFor(() => view.node.querySelector<HTMLElement>(".sf-budget-editor")?.dataset.sfVersion === "1")
    editor = view.node.querySelector<HTMLElement>(".sf-budget-editor")!
    expect(editor.dataset.sfDraftDirty).toBe("true")
    expect(view.stored()).toEqual({ flag: "dev-amber", text: "First submitted note" })
    expect(notes().value).toBe("Later unsent note")
    expect(view.node.textContent).toContain("Submitted changes saved. Later edits are still unsaved.")
    expect(view.writes).toHaveLength(1)
    button(editor, "Review changes").click()
    button(editor, "Save").click()
    await waitFor(() => !view.node.querySelector(".sf-budget-editor"))
    expect(view.writes).toHaveLength(2)
    expect(view.writes[1]).toMatchObject({ id: "owner", version: 1,
      values: { year: 2026, month: 1, flag: "dev-amber", text: "Later unsent note" } })
    expect(view.stored()).toEqual({ flag: "dev-amber", text: "Later unsent note" })
  } finally { view.close() }
})

test("native budget does not treat omitted deviations or an existing deviation without CAS as a new record", async () => {
  for (const initial of ["missing-cas", "omitted"] as const) {
    const view = mountDeviation(initial)
    try {
      await waitFor(() => view.node.querySelector('.sf-budget-detail tr[data-sf-month="1"] button[data-sf-action="save-deviation"]'))
      view.node.querySelector<HTMLButtonElement>('.sf-budget-detail tr[data-sf-month="1"] button[data-sf-action="save-deviation"]')!.click()
      const editor = view.node.querySelector<HTMLElement>(".sf-budget-editor")
      if (initial === "missing-cas") expect(editor).toBeNull()
      else {
        expect(editor).not.toBeNull()
        button(editor!, "Review changes").click()
        expect(editor!.querySelector('[data-component="sf-change-review"]')).toBeNull()
      }
      expect(view.node.textContent).toContain("Review the current source before continuing.")
      expect(view.writes).toHaveLength(0)
    } finally { view.close() }
  }
})

test("native deviation version binding rejects changed source and divergent owner, period or CAS identities", () => {
  const current: import("../../src/orchestra/chapters/sucafina/dashboard/opex/model").BudgetPage = {
    capabilityId: "CAP04", context: stamp, selection: { year: 2026 },
    owners: [{ id: "owner", name: "Operations", budget: 1200 }], entries: [], deviations: {},
    ytd: {}, budgetLineIds: [], versions: { "opexOwners:owner": 1 }, allowedActionIds: ["save-deviation"],
  }
  const proposed = { parentId: "owner", recordId: "owner", month: 1,
    versionKey: "deviations:opex-owner-2026-1", version: 0, sourcePresent: false }
  expect(budgetDeviationSourceMatches(current, "CAP04", 2026, proposed)).toBe(true)
  const changed = { ...current, deviations: { "opex-owner-2026-1": { flag: "dev-amber" as const, text: "Another writer" } },
    versions: { ...current.versions, [proposed.versionKey]: 1 } }
  expect(budgetDeviationSourceMatches(changed, "CAP04", 2026, proposed)).toBe(false)
  expect(budgetDeviationSourceMatches({ ...changed, versions: current.versions }, "CAP04", 2026,
    { ...proposed, sourcePresent: true })).toBe(false)
  expect(budgetDeviationSourceMatches({ ...current, deviations: undefined }, "CAP04", 2026, proposed)).toBe(false)
  expect(budgetDeviationSourceMatches({ ...current, versions: { [proposed.versionKey]: 0 } }, "CAP04", 2026, proposed)).toBe(false)
  for (const mutation of [{ recordId: "another-owner" }, { parentId: "another-owner" }, { recordId: undefined },
    { versionKey: "deviations:capex-owner-2026-1" }, { month: 2 }, { version: 1 }, { sourcePresent: true }])
    expect(budgetDeviationSourceMatches(current, "CAP04", 2026, { ...proposed, ...mutation })).toBe(false)
  expect(budgetDeviationSourceMatches(current, "CAP05", 2026, proposed)).toBe(false)
  expect(budgetDeviationSourceMatches(current, "CAP04", 2027, proposed)).toBe(false)
  expect(budgetDeviationSourceMatches({ ...current, owners: [] }, "CAP04", 2026, proposed)).toBe(false)
  expect(budgetDeviationSourceMatches({ ...current, owners: [...current.owners!, ...current.owners!] }, "CAP04", 2026, proposed)).toBe(false)
  const existing = { ...proposed, version: 1, sourcePresent: true }
  expect(budgetDeviationSourceMatches(changed, "CAP04", 2026, existing)).toBe(true)
  expect(budgetDeviationSourceMatches({ ...changed, versions: { [proposed.versionKey]: 2 } }, "CAP04", 2026, existing)).toBe(false)
  expect(budgetDeviationSourceMatches({ ...changed, deviations: {} }, "CAP04", 2026, existing)).toBe(false)
})
