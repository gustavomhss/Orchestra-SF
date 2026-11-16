import { expect, spyOn, test } from "bun:test"
import { Schema } from "effect"
import { solidDom } from "../real-ui-solid"
import type { SfEditScopeKey, SfHref, SfOwnerSelection, SfRef, SfServerKey } from "@orchestra/schema/sucafina/context"
import type { SfTransport } from "@orchestra/client/sucafina/transport"
import type { SfContextDependencies, SfContextHandle, SfSurfaceProps } from "../../src/orchestra/chapters/sucafina/context/contracts"

// Real component, typed client, provider and draft controller with injected source responses;
// these fixtures do not prove an installed identity or runtime.
const { createComponent } = await import("solid-js")
const { createStore } = await import("solid-js/store")
const { render } = await import("solid-js/web")
const { withBrowserPlatform } = await import("./platform-fixture")
const { LanguageProvider }: typeof import("@/context/language") = await import(solidDom("@/context/language", import.meta.dir))
const { SfContextProvider, useSfContext }: typeof import("@/orchestra/chapters/sucafina/context") =
  await import(solidDom("@/orchestra/chapters/sucafina/context", import.meta.dir))
const { createSfDraft }: typeof import("@/orchestra/chapters/sucafina/shared/draft") =
  await import(solidDom("@/orchestra/chapters/sucafina/shared/draft", import.meta.dir))
const { SfRequestTitleEdit }: typeof import("@/orchestra/chapters/sucafina/procurement/requests/title") =
  await import(solidDom("@/orchestra/chapters/sucafina/procurement/requests/title", import.meta.dir))
const { revalidateRequestTitleDraft }: typeof import("@/orchestra/chapters/sucafina/procurement/requests/title-revalidation") =
  await import(solidDom("@/orchestra/chapters/sucafina/procurement/requests/title-revalidation", import.meta.dir))

const stamp = { installationId: "install", projectId: "project", hostId: "host", principalRef: "actor", policyVersion: "p1", accessRevision: "a1" }
const selection: SfOwnerSelection = { serverKey: "server" as SfServerKey, projectId: "project" as SfRef, installationId: "install" as SfRef }
const binding = { installationId: "install", projectId: "project", hostId: "host", publicOrigin: "https://sf.test",
  mount: "/sf", contractRevision: "sf-native-ui/1" as const, authMode: "microsoft" as const }
const context = { stamp, contractRevision: "sf-native-ui/1" as const, authMode: "microsoft" as const,
  destinations: [{ capabilityId: "CAP25" as const, surface: "procurement" as const, page: "Requests", canRead: true, allowedActionIds: ["save"] }],
  availability: [{ family: "procurement" as const, resource: "CAP25" as const, state: "ready" as const, operations: [
    { operationId: "domain.page.CAP25" as const, state: "ready" as const, operational: true, reason: null },
    { operationId: "domain.command.CAP25.save" as const, state: "ready" as const, operational: true, reason: null },
  ] }] }
type Outcome = "network" | "invalid-response" | Readonly<{ status: number; body: { ok: true } | { ok: false; status: 409 | 422 | 503 } }>

async function waitFor(predicate: () => boolean) {
  for (let index = 0; index < 100; index++) {
    if (predicate()) return
    await new Promise((resolve) => setTimeout(resolve, 10))
  }
  throw new Error("title fixture did not reach expected state")
}

async function mount(outcome: Outcome = "network") {
  const writes: { body: unknown; key: string | undefined }[] = []
  const commandEntered = Promise.withResolvers<void>(), commandRelease = Promise.withResolvers<void>()
  let version = 7
  let hold: { entered: ReturnType<typeof Promise.withResolvers<void>>; release: ReturnType<typeof Promise.withResolvers<void>>;
    finished: ReturnType<typeof Promise.withResolvers<void>> } | undefined
  let heldRead: typeof hold
  const transport: SfTransport = { async execute(operation, input, options) {
    if (operation.operationId === "domain.command.CAP25.save") {
      writes.push({ body: input, key: options.idempotencyKey })
      commandEntered.resolve()
      await commandRelease.promise
      if (typeof outcome === "string") return { kind: "transport-error", reason: outcome }
      return { kind: "response", status: outcome.status, headers: {},
        body: Schema.decodeUnknownSync(Schema.toType(operation.output))(outcome.body) }
    }
    const request = (input as { request: string }).request
    const projection = { status: "ok", context: stamp, value: { capabilityId: "CAP25", selection: { request },
      data: { requests: [{ number: request, status: "draft", createdBy: "actor", allowedDraftActions: ["save-pr"],
        pr: { title: "before", description: "do not send" }, sourcing: { evaluator: "private" }, po: { notes: "private" } }],
        suppliers: [], directory: [], formSettings: {}, bankVerificationAvailable: false },
      versions: { ["requests:" + request]: { version, by: "actor" } }, allowedActionIds: ["save"] } }
    const held = hold
    if (held) {
      hold = undefined
      heldRead = held
      held.entered.resolve()
      // Deliberately return after abort to exercise the component's own fences.
      await held.release.promise
      held.finished.resolve()
      heldRead = undefined
    }
    return { kind: "response", status: 200, headers: {}, body: Schema.decodeUnknownSync(Schema.toType(operation.output))(projection) }
  } }
  const deps: SfContextDependencies = { listInstallations: async () => ({ installations: [binding] }),
    loadContext: async () => ({ status: "ok", value: context }), createTransport: () => transport,
    resolveTransportIdentity: () => "transport", createDraft: createSfDraft, revalidateDraft: revalidateRequestTitleDraft }
  const route: SfSurfaceProps<"CAP25">["route"] = { surfaceId: "CAP25", kind: "entry", params: {}, ownerSelection: selection,
    href: "/orchestra/sf-procurement/requests" as SfHref, pathname: "/orchestra/sf-procurement/requests", query: {} }
  const [props, setProps] = createStore({ ref: "PR-1" as SfRef })
  const node = document.createElement("div")
  document.body.append(node)
  const captured: { handle?: SfContextHandle } = {}
  const child = () => { captured.handle = useSfContext(); return createComponent(SfRequestTitleEdit,
    { surfaceId: "CAP25", route, get requestRef() { return props.ref } }) }
  const dispose = render(() => withBrowserPlatform(() => createComponent(LanguageProvider, { locale: "en", get children() {
    return createComponent(SfContextProvider, { selection: () => selection, dependencies: deps,
      get children() { return createComponent(child, {}) } })
  } })), node)
  await waitFor(() => !!captured.handle)
  await captured.handle!.reload()
  await waitFor(() => !!node.querySelector('[data-component="sf-request-title-save"] input'))
  const handle = captured.handle!
  const button = (text: string) => [...node.querySelectorAll<HTMLButtonElement>("button")]
    .find((item) => item.textContent?.trim() === text)
  const draft = () => handle.ready()?.drafts.peek<{ title: string }>({ surfaceId: "CAP25",
    identity: { kind: "record", recordRef: "PR-1" as SfRef }, editScopeKey: "pr.title" as SfEditScopeKey })
  return { node, handle, writes, button, draft, commandEntered, commandRelease,
    setRef: (ref: string) => setProps("ref", ref as SfRef), setVersion: (next: number) => { version = next },
    holdNextRead: () => {
      const control = { entered: Promise.withResolvers<void>(), release: Promise.withResolvers<void>(), finished: Promise.withResolvers<void>() }
      hold = control
      return control
    },
    close: () => { commandRelease.resolve(); hold?.release.resolve(); heldRead?.release.resolve(); dispose(); node.remove() },
  }
}

async function review(view: Awaited<ReturnType<typeof mount>>) {
  const input = view.node.querySelector<HTMLInputElement>("input")!
  input.value = "private proposed title"
  input.dispatchEvent(new Event("input", { bubbles: true }))
  const reviewButton = view.button("Review save")
  expect(reviewButton, `Rendered title actions: ${[...view.node.querySelectorAll("button")].map((item) => item.textContent?.trim()).join(" | ")}; text: ${view.node.textContent?.trim().slice(0, 500)}`).toBeDefined()
  reviewButton!.click()
  await waitFor(() => !!view.node.querySelector('[data-component="sf-change-review"]'))
  expect(view.writes).toEqual([]) // Positive control: the review really precedes the POST.
  return view.button("Confirm action")!
}

function gateDigest() {
  // Keep the real WebCrypto digest but hold its result at the precise await boundary.
  const original = crypto.subtle.digest.bind(crypto.subtle)
  const started = Promise.withResolvers<void>(), release = Promise.withResolvers<void>(), finished = Promise.withResolvers<void>()
  const spy = spyOn(crypto.subtle, "digest").mockImplementation(async (algorithm, data) => {
    started.resolve()
    const hash = await original(algorithm, data)
    await release.promise
    finished.resolve()
    return hash
  })
  return { started, release, finished, spy }
}

test("same-CAS request navigation before digest continuation cannot post the reviewed title", async () => {
  const view = await mount()
  const gate = gateDigest()
  try {
    const confirm = await review(view)
    confirm.click(); await gate.started.promise
    expect(view.node.querySelector("input:disabled")).not.toBeNull()
    view.setRef("PR-2")
    await waitFor(() => view.node.querySelector<HTMLInputElement>("input")?.value === "before")
    gate.release.resolve(); await gate.finished.promise
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(view.writes).toEqual([])
    expect(view.node.querySelector<HTMLInputElement>("input")?.value).toBe("before")
    expect(view.node.textContent).not.toContain("private proposed title")
  } finally { gate.release.resolve(); gate.spy.mockRestore(); view.close() }
})

test("owner invalidation before digest continuation cannot post the reviewed title", async () => {
  const view = await mount()
  const gate = gateDigest()
  try {
    const confirm = await review(view)
    confirm.click(); await gate.started.promise
    expect(view.node.querySelector("input:disabled")).not.toBeNull()
    view.handle.invalidate("owner-changed")
    gate.release.resolve(); await gate.finished.promise
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(view.writes).toEqual([])
    expect(view.node.querySelector("input")).toBeNull()
    expect(view.node.textContent).not.toContain("private proposed title")
  } finally { gate.release.resolve(); gate.spy.mockRestore(); view.close() }
})

test("source reload before digest continuation cannot post the reviewed title", async () => {
  const view = await mount()
  const gate = gateDigest()
  try {
    const confirm = await review(view)
    confirm.click(); await gate.started.promise
    expect(view.node.querySelector("input:disabled")).not.toBeNull()
    view.setVersion(8)
    await view.handle.reload()
    await waitFor(() => {
      const state = view.draft()?.snapshot()
      return state?.availability === "active" && state.phase === "conflict"
    })
    gate.release.resolve(); await gate.finished.promise
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(view.writes).toEqual([])
    expect(view.node.querySelector("input")).toBeNull()
    expect(view.node.textContent).not.toContain("private proposed title")
  } finally { gate.release.resolve(); gate.spy.mockRestore(); view.close() }
})

test("same-CAS request navigation during post-digest preflight never posts the old intent", async () => {
  const view = await mount()
  try {
    const confirm = await review(view), held = view.holdNextRead()
    confirm.click()
    await held.entered.promise // This read begins only after the digest resolved.
    view.setRef("PR-2")
    await waitFor(() => view.node.querySelector<HTMLInputElement>("input")?.value === "before")
    held.release.resolve(); await held.finished.promise
    await new Promise((resolve) => setTimeout(resolve, 0)) // Drain the completed read's microtasks.
    confirm.click()
    expect(view.writes).toEqual([])
    expect(view.node.textContent).not.toContain("private proposed title")
  } finally { view.close() }
})

test("owner invalidation during post-digest preflight hides the review and never posts", async () => {
  const view = await mount()
  try {
    const confirm = await review(view), held = view.holdNextRead()
    confirm.click(); await held.entered.promise
    view.handle.invalidate("owner-changed")
    expect(view.node.querySelector("input")).toBeNull()
    expect(view.node.textContent).not.toContain("private proposed title")
    held.release.resolve(); await held.finished.promise
    await new Promise((resolve) => setTimeout(resolve, 0))
    confirm.click()
    expect(view.writes).toEqual([])
  } finally { view.close() }
})

test("changed source CAS during post-digest preflight invalidates the old review without a POST", async () => {
  const view = await mount()
  try {
    const confirm = await review(view), held = view.holdNextRead()
    confirm.click(); await held.entered.promise
    view.setVersion(8)
    await view.handle.reload()
    await waitFor(() => {
      const state = view.draft()?.snapshot()
      return state?.availability === "active" && state.phase === "conflict"
    })
    held.release.resolve(); await held.finished.promise
    await new Promise((resolve) => setTimeout(resolve, 0))
    confirm.click()
    expect(view.writes).toEqual([])
    expect(view.node.querySelector('[data-component="sf-change-review"]')).toBeNull()
    expect(view.node.querySelector("input")).toBeNull()
    expect(view.node.textContent).not.toContain("private proposed title")
  } finally { view.close() }
})

test("source reload at a changed CAS hides the old proposal until explicit discard", async () => {
  const view = await mount()
  try {
    const confirm = await review(view)
    view.setVersion(8)
    await view.handle.reload()
    await waitFor(() => {
      const state = view.draft()?.snapshot()
      return state?.availability === "active" && state.phase === "conflict"
    })
    expect(view.node.querySelector('[data-component="sf-change-review"]')).toBeNull()
    expect(view.node.querySelector("input")).toBeNull()
    expect(view.node.textContent).not.toContain("private proposed title")
    confirm.click()
    expect(view.writes).toEqual([])
    view.button("Discard local draft changes")!.click()
    await waitFor(() => view.node.querySelector<HTMLInputElement>("input")?.value === "before")
    expect(view.draft()?.snapshot()).toMatchObject({ availability: "active", baseVersion: 8, phase: "clean" })
  } finally { view.close() }
})

for (const status of [409, 422] as const) {
  test(`matching HTTP/body ${status} clears only the exact submitting correlation`, async () => {
    const view = await mount({ status, body: { ok: false, status } })
    try {
      const confirm = await review(view)
      confirm.click(); await view.commandEntered.promise
      const controller = view.draft()!, snapshot = controller.snapshot()
      if (snapshot.availability !== "active" || !snapshot.pendingOperation) throw new Error("expected pending operation")
      const pending = snapshot.pendingOperation
      expect(snapshot.phase).toBe("submitting")
      expect(view.writes).toEqual([{ body: { page: "Requests", action: "save", id: "PR-1", version: 7,
        values: { pr: { title: "private proposed title" } } }, key: pending.idempotencyKey }])
      // Negative control against the real controller: the component itself never submits a forged correlation.
      controller.rejectSave({ status, operation: { ...pending, payloadDigest: "wrong" } })
      expect(controller.snapshot()).toMatchObject({ availability: "active", phase: "submitting", pendingOperation: pending })
      view.commandRelease.resolve()
      await waitFor(() => {
        const state = controller.snapshot()
        return state.availability === "active" && state.pendingOperation === null
      })
      expect(controller.snapshot()).toMatchObject({ availability: "active", pendingOperation: null,
        phase: status === 409 ? "conflict" : "validation-error" })
      expect(view.writes).toHaveLength(1)
    } finally { view.close() }
  })
}

for (const item of [
  { name: "network", outcome: "network" as const },
  { name: "untyped response", outcome: "invalid-response" as const },
  { name: "503", outcome: { status: 503, body: { ok: false, status: 503 } } as const },
  { name: "409 with success body", outcome: { status: 409, body: { ok: true } } as const },
  { name: "409 with 422 body", outcome: { status: 409, body: { ok: false, status: 422 } } as const },
]) {
  test(`${item.name} remains unknown and cannot be discarded or retried`, async () => {
    const view = await mount(item.outcome)
    try {
      const confirm = await review(view)
      confirm.click(); await view.commandEntered.promise
      const controller = view.draft()!, submitted = controller.snapshot()
      if (submitted.availability !== "active" || !submitted.pendingOperation) throw new Error("expected pending operation")
      view.commandRelease.resolve()
      await waitFor(() => {
        const state = controller.snapshot()
        return state.availability === "active" && state.phase === "outcome-unknown"
      })
      expect(controller.snapshot()).toMatchObject({ availability: "active", phase: "outcome-unknown", pendingOperation: submitted.pendingOperation })
      expect(view.node.querySelector("input")).toBeNull()
      expect(view.button("Discard local draft changes")).toBeUndefined()
      expect(view.handle.discardDrafts()).toBe(false)
      confirm.click()
      expect(view.writes).toHaveLength(1)
    } finally { view.close() }
  })
}
