import { expect, spyOn, test } from "bun:test"
import { Schema } from "effect"
import { solidDom } from "../real-ui-solid"
import type { SfContext, SfEditScopeKey, SfHref, SfOwnerSelection, SfRef, SfResolvedRoute, SfServerKey } from "@orchestra/schema/sucafina/context"
import type { SfTransport } from "@orchestra/client/sucafina/transport"
import type { SfContextDependencies, SfContextHandle } from "../../src/orchestra/chapters/sucafina/context/contracts"
import { SfProcurement } from "@orchestra/schema/sucafina/procurement"

// Render the actual CAP28/F01/draft/review/client graph. Only the typed producer
// boundary and clock delivery are controlled; this is not installed-host proof.
const { createComponent, createSignal } = await import("solid-js")
const { render } = await import("solid-js/web")
const { Router, Route } = await import("@solidjs/router")
const { withBrowserPlatform } = await import("./platform-fixture")
const { LanguageProvider }: typeof import("@/context/language") = await import(solidDom("@/context/language", import.meta.dir))
const { SfContextProvider, useSfContext }: typeof import("@/orchestra/chapters/sucafina/context") =
  await import(solidDom("@/orchestra/chapters/sucafina/context", import.meta.dir))
const { createSfDraft }: typeof import("@/orchestra/chapters/sucafina/shared/draft") =
  await import(solidDom("@/orchestra/chapters/sucafina/shared/draft", import.meta.dir))
const { SfProcurementSettingsView }: typeof import("@/orchestra/chapters/sucafina/procurement/settings") =
  await import(solidDom("@/orchestra/chapters/sucafina/procurement/settings", import.meta.dir))

const initialSelection: SfOwnerSelection = {
  serverKey: "server-one" as SfServerKey, projectId: "project" as SfRef, installationId: "install" as SfRef,
}
const binding = { installationId: "install", projectId: "project", hostId: "host",
  publicOrigin: "https://sf.test", mount: "/sf", contractRevision: "sf-native-ui/1" as const, authMode: "local-operator" as const }
const stamp = (actor = "actor-one") => ({ installationId: "install", projectId: "project", hostId: "host",
  principalRef: actor, policyVersion: "policy", accessRevision: "access" })
const op = (operationId: string) => ({ operationId, state: "ready" as const, operational: true, reason: null })
const context = (actor: string): SfContext => ({
  stamp: stamp(actor), contractRevision: "sf-native-ui/1", authMode: "local-operator",
  destinations: [{ capabilityId: "CAP28", surface: "procurement", page: "Settings", canRead: true, allowedActionIds: ["save", "reset"] }],
  availability: [{ family: "procurement", resource: "CAP28", state: "ready", operations: [
    op("domain.page.CAP28"), op("domain.command.CAP28.save"), op("domain.command.CAP28.reset"),
  ] }],
})
const deferred = () => {
  let release: (() => void) | undefined
  const promise = new Promise<void>((resolve) => { release = resolve })
  return { promise, release: () => { if (!release) throw new Error("Missing deferred resolver"); release() } }
}
async function waitFor(condition: () => unknown) {
  for (let index = 0; index < 100; index++) {
    if (condition()) return
    await new Promise((resolve) => setTimeout(resolve, 10))
  }
  throw new Error("Native settings fixture did not reach the expected state")
}
function button(node: ParentNode, label: string) {
  const found = [...node.querySelectorAll<HTMLButtonElement>("button")].find((item) => item.textContent?.trim() === label)
  if (!found) throw new Error("Native settings button is unavailable: " + label)
  return found
}
function currency(node: ParentNode) {
  const found = node.querySelector<HTMLInputElement>("#sf-u36-field-currency")
  if (!found) throw new Error("Native settings currency field is unavailable")
  return found
}
function edit(node: ParentNode, value: string) {
  const field = currency(node)
  field.value = value
  field.dispatchEvent(new Event("input", { bubbles: true }))
  field.blur()
}
function clock() {
  const intervals = new Map<Parameters<typeof clearInterval>[0], () => void>()
  const schedule = globalThis.setInterval.bind(globalThis)
  const cancel = globalThis.clearInterval.bind(globalThis)
  const start = spyOn(globalThis, "setInterval").mockImplementation((handler, delay, ...args) => {
    const id = schedule(handler, delay, ...args)
    if (delay === 30000 && typeof handler === "function") intervals.set(id, () => handler(...args))
    return id
  })
  const stop = spyOn(globalThis, "clearInterval").mockImplementation((id) => {
    if (id !== undefined) intervals.delete(id)
    cancel(id)
  })
  return { intervals, tick: () => { for (const fire of [...intervals.values()]) fire() },
    close: () => { for (const id of intervals.keys()) cancel(id); intervals.clear(); stop.mockRestore(); start.mockRestore() } }
}
function fixture() {
  const timer = clock()
  const [selected, select] = createSignal(initialSelection)
  const ownerActor = () => selected().serverKey === initialSelection.serverKey ? "actor-one" : "actor-two"
  const source = new Map([["actor-one", { currency: "USD", version: 1 }], ["actor-two", { currency: "JPY", version: 1 }]])
  const reads: { actor: string; signal?: AbortSignal; version: number }[] = []
  const writes: { action: string; version: number; values: unknown }[] = []
  let held: ReturnType<typeof deferred> | undefined
  let rejectNext = false
  const captured: { handle?: SfContextHandle } = {}
  const dependencies: SfContextDependencies = {
    listInstallations: async () => ({ installations: [binding] }),
    loadContext: async () => ({ status: "ok", value: context(ownerActor()) }),
    resolveTransportIdentity: (selection) => String(selection.serverKey),
    createDraft: createSfDraft, revalidateDraft: async () => ({ status: "unavailable" }),
    createTransport: () => {
      const actor = ownerActor()
      const transport: SfTransport = { async execute(operation, value, options) {
        const input = Schema.decodeUnknownSync(Schema.toType(operation.input), { onExcessProperty: "error" })(value)
        const json: unknown = JSON.parse(JSON.stringify(input))
        const persisted = source.get(actor)
        if (!persisted) throw new Error("Missing fixture source")
        let body: unknown
        let status = 200
        if (operation.operationId === "domain.page.CAP28") {
          reads.push({ actor, signal: options.signal, version: persisted.version })
          body = { status: "ok", context: stamp(actor), value: {
            capabilityId: "CAP28", selection: {}, allowedActionIds: ["save", "reset"],
            data: { settings: { currency: persisted.currency }, directory: [], resetSettings: { currency: "USD" } },
            versions: { settings: { version: persisted.version, by: actor } },
          } }
          const gate = held
          held = undefined
          // Capture a genuine typed source before waiting. Ignoring cancellation
          // here deliberately tests a late response, never a fabricated success.
          if (gate) await gate.promise
        } else if (operation.operationId === "domain.command.CAP28.save" || operation.operationId === "domain.command.CAP28.reset") {
          const command = operation.operationId === "domain.command.CAP28.save"
            ? Schema.decodeUnknownSync(Schema.toType(SfProcurement.operations["domain.command.CAP28.save"].input))(json)
            : Schema.decodeUnknownSync(Schema.toType(SfProcurement.operations["domain.command.CAP28.reset"].input))(json)
          writes.push({ action: command.action, version: command.version, values: json })
          expect(options.idempotencyKey).toMatch(/^[0-9a-f-]{36}$/)
          if (rejectNext || command.version !== persisted.version) {
            rejectNext = false
            status = 409
            body = { ok: false, status: 409, errors: ["Settings changed before this command."] }
          } else {
            const next = command.action === "reset" ? "USD" : command.values.settings.currency
            if (typeof next !== "string") throw new Error("Missing submitted currency")
            source.set(actor, { currency: next, version: persisted.version + 1 })
            body = { ok: true }
          }
        } else throw new Error("Unexpected native settings operation: " + operation.operationId)
        return { kind: "response", status, headers: {},
          body: Schema.decodeUnknownSync(Schema.toType(operation.output), { onExcessProperty: "error" })(body) }
      } }
      return transport
    },
  }
  const route: SfResolvedRoute<"CAP28"> = { surfaceId: "CAP28", kind: "entry", params: {},
    get ownerSelection() { return selected() },
    href: "/orchestra/sf-procurement/settings" as SfHref, pathname: "/orchestra/sf-procurement/settings", query: {} }
  const child = () => {
    captured.handle = useSfContext()
    return createComponent(SfProcurementSettingsView, { surfaceId: "CAP28", route })
  }
  const node = document.createElement("div")
  document.body.append(node)
  const dispose = render(() => withBrowserPlatform(() => createComponent(LanguageProvider, { locale: "en",
    get children() { return createComponent(Router, {
      get children() { return createComponent(Route, { path: "*", component: () =>
        createComponent(SfContextProvider, { selection: selected, dependencies,
          get children() { return createComponent(child, {}) } }) }) },
    }) },
  })), node)
  const handle = () => { if (!captured.handle) throw new Error("Native owner missing"); return captured.handle }
  const draft = () => handle().ready()?.drafts.peek<{ currency: string }>({
    surfaceId: "CAP28", identity: { kind: "record", recordRef: "settings" as SfRef },
    editScopeKey: JSON.stringify(["CAP28", null, null]) as SfEditScopeKey,
  })
  return { node, timer, reads, writes, source, handle, draft,
    hold: () => { const gate = deferred(); held = gate; return gate },
    conflict: () => { rejectNext = true },
    switchOwner: () => select({ ...initialSelection, serverKey: "server-two" as SfServerKey }),
    close: () => { dispose(); node.remove(); const remaining = timer.intervals.size; timer.close(); expect(remaining).toBe(0) },
  }
}

test("native Settings polls clean data, preserves blurred edits and queues one post-save read", async () => {
  const view = fixture()
  let held: ReturnType<typeof deferred> | undefined
  try {
    await waitFor(() => view.node.querySelector("#sf-u36-field-currency"))
    expect(view.reads).toHaveLength(1)
    expect(view.timer.intervals.size).toBe(1)
    view.source.set("actor-one", { currency: "EUR", version: 2 })
    view.timer.tick()
    await waitFor(() => currency(view.node).value === "EUR")
    expect(view.reads).toHaveLength(2)
    edit(view.node, "CHF")
    view.timer.tick()
    await waitFor(() => view.reads.length === 3)
    expect(currency(view.node).value).toBe("CHF")
    expect(view.draft()?.snapshot()).toMatchObject({ availability: "active", baseVersion: 2, dirty: true, value: { currency: "CHF" } })
    button(view.node, "Review changes").click()
    button(view.node, "Cancel review").click()
    expect(view.writes).toHaveLength(0)
    expect(currency(view.node).value).toBe("CHF")
    held = view.hold()
    view.timer.tick()
    await waitFor(() => view.reads.length === 4)
    button(view.node, "Refresh settings").click()
    button(view.node, "Refresh settings").click()
    expect(view.reads).toHaveLength(4)
    button(view.node, "Review changes").click()
    button(view.node, "Save").click()
    await waitFor(() => view.writes.length === 1)
    expect(view.reads).toHaveLength(4)
    expect(view.draft()?.snapshot()).toMatchObject({ phase: "submitting", baseVersion: 2, value: { currency: "CHF" } })
    held.release()
    await waitFor(() => view.reads.length === 5 && view.node.querySelector('.sf-n21-settings-form[data-version="3"]'))
    expect(view.writes[0]).toMatchObject({ action: "save", version: 2,
      values: { page: "Settings", action: "save", version: 2, values: { settings: { currency: "CHF" } } } })
    expect(view.reads.map((read) => read.version)).toEqual([1, 2, 2, 2, 3])
    expect(currency(view.node).value).toBe("CHF")
    expect(view.draft()?.snapshot()).toMatchObject({ phase: "clean", baseVersion: 3, dirty: false, pendingOperation: null })
    expect(view.writes).toHaveLength(1)
  } finally { held?.release(); view.close() }
})

test("native Settings suspends hidden reads and keeps the late response out of the visible editor", async () => {
  const original = Object.getOwnPropertyDescriptor(document, "visibilityState")
  let visibility: DocumentVisibilityState = "visible"
  Object.defineProperty(document, "visibilityState", { configurable: true, get: () => visibility })
  const view = fixture()
  const held = view.hold()
  try {
    await waitFor(() => view.reads.length === 1)
    visibility = "hidden"
    document.dispatchEvent(new Event("visibilitychange"))
    expect(view.reads[0]?.signal?.aborted).toBe(true)
    expect(view.timer.intervals.size).toBe(0)
    view.source.set("actor-one", { currency: "EUR", version: 2 })
    window.dispatchEvent(new Event("focus"))
    expect(view.reads).toHaveLength(1)
    held.release()
    await Promise.resolve()
    expect(view.node.querySelector("#sf-u36-field-currency")).toBeNull()
    visibility = "visible"
    document.dispatchEvent(new Event("visibilitychange"))
    await waitFor(() => view.node.querySelector<HTMLInputElement>("#sf-u36-field-currency")?.value === "EUR")
    expect(view.reads).toHaveLength(2)
    expect(view.timer.intervals.size).toBe(1)
    expect(view.writes).toHaveLength(0)
  } finally {
    held.release(); view.close()
    if (original) Object.defineProperty(document, "visibilityState", original)
    else Reflect.deleteProperty(document, "visibilityState")
  }
})

test("native Settings drops queued reads and private drafts after revocation or owner change", async () => {
  for (const mode of ["revoked", "owner-change"] as const) {
    const view = fixture()
    let held: ReturnType<typeof deferred> | undefined
    try {
      await waitFor(() => view.node.querySelector("#sf-u36-field-currency"))
      edit(view.node, "PRIVATE-DRAFT")
      const previous = view.draft()
      held = view.hold()
      view.timer.tick()
      await waitFor(() => view.reads.length === 2)
      const oldRead = view.reads[1]
      button(view.node, "Refresh settings").click()
      if (mode === "revoked") view.handle().invalidate("revoked")
      else view.switchOwner()
      await waitFor(() => oldRead?.signal?.aborted)
      expect(previous?.snapshot()).toMatchObject({ availability: "revoked" })
      held.release()
      if (mode === "owner-change") {
        await waitFor(() => view.node.querySelector<HTMLInputElement>("#sf-u36-field-currency")?.value === "JPY")
        expect(view.reads.map((read) => read.actor)).toEqual(["actor-one", "actor-one", "actor-two"])
        expect(view.draft()?.snapshot()).toMatchObject({ phase: "clean", baseVersion: 1, value: { currency: "JPY" } })
      } else {
        expect(view.timer.intervals.size).toBe(0)
        window.dispatchEvent(new Event("focus"))
        document.dispatchEvent(new Event("visibilitychange"))
        await Promise.resolve()
        expect(view.reads).toHaveLength(2)
        expect(view.node.querySelector("#sf-u36-field-currency")).toBeNull()
      }
      expect(view.node.textContent).not.toContain("PRIVATE-DRAFT")
      expect(view.writes).toHaveLength(0)
    } finally { held?.release(); view.close() }
  }
})

test("native Settings leaves a rejected command visible without automatic refresh or replay", async () => {
  const view = fixture()
  try {
    await waitFor(() => view.node.querySelector("#sf-u36-field-currency"))
    edit(view.node, "CHF")
    view.conflict()
    button(view.node, "Review changes").click()
    button(view.node, "Save").click()
    await waitFor(() => view.node.textContent?.includes("Settings changed before this command."))
    view.timer.tick()
    window.dispatchEvent(new Event("focus"))
    expect(view.reads).toHaveLength(1)
    expect(view.writes).toHaveLength(1)
    expect(view.node.textContent).toContain("Settings changed before this command.")
    expect(view.source.get("actor-one")).toEqual({ currency: "USD", version: 1 })
    expect(view.draft()?.snapshot()).toMatchObject({ availability: "active", baseVersion: 1,
      value: { currency: "CHF" }, dirty: true })
  } finally { view.close() }
})
