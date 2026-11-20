import { expect, test } from "bun:test"
import { solidDom } from "../real-ui-solid"
import type { SfContext, SfOwnerSelection, SfRef, SfServerKey } from "@orchestra/schema/sucafina/context"
import type { SfTransport } from "@orchestra/client/sucafina/transport"
import type { SfContextDependencies, SfContextHandle } from "../../src/orchestra/chapters/sucafina/context/contracts"

// Component lifecycle proof with injected discovery/context, not installed authentication evidence.
const { createComponent } = await import("solid-js")
const { render } = await import("solid-js/web")
const { withBrowserPlatform } = await import("./platform-fixture")
const { LanguageProvider }: typeof import("@/context/language") = await import(solidDom("@/context/language", import.meta.dir))
const { SfContextProvider, useSfContext }: typeof import("@/orchestra/chapters/sucafina/context") =
  await import(solidDom("@/orchestra/chapters/sucafina/context", import.meta.dir))
const { createSfDraft }: typeof import("@/orchestra/chapters/sucafina/shared/draft") =
  await import(solidDom("@/orchestra/chapters/sucafina/shared/draft", import.meta.dir))

const selection: SfOwnerSelection = {
  serverKey: "server" as SfServerKey, projectId: "project" as SfRef, installationId: "install" as SfRef,
}
const binding = {
  installationId: "install", projectId: "project", hostId: "host", publicOrigin: "https://sf.test",
  mount: "/sf", contractRevision: "sf-native-ui/1" as const, authMode: "microsoft" as const,
}
const context = (accessRevision: string): SfContext => ({
  stamp: { installationId: "install", projectId: "project", hostId: "host",
    principalRef: "actor", policyVersion: "policy", accessRevision },
  contractRevision: "sf-native-ui/1", authMode: "microsoft", destinations: [], availability: [],
})
type Reply = Awaited<ReturnType<SfContextDependencies["loadContext"]>>
async function waitFor(predicate: () => boolean) {
  for (let i = 0; i < 100; i++) {
    if (predicate()) return
    await new Promise((resolve) => setTimeout(resolve, 10))
  }
  throw new Error("owner access fixture did not reach the expected state")
}
async function fixture() {
  const pending: (() => Promise<Reply>)[] = []
  const transports: SfTransport[] = []
  const captured: { handle?: SfContextHandle } = {}
  const dependencies: SfContextDependencies = {
    listInstallations: async () => ({ installations: [binding] }),
    loadContext: async () => pending.shift()?.() ?? { status: "ok", value: context("access-1") },
    createTransport: () => {
      const transport: SfTransport = { async execute() { throw new Error("Unexpected domain invocation") } }
      transports.push(transport)
      return transport
    },
    resolveTransportIdentity: () => "original-connection",
    createDraft: createSfDraft,
    revalidateDraft: async () => ({ status: "unavailable" }),
  }
  const child = () => { captured.handle = useSfContext(); return null }
  const node = document.createElement("div")
  document.body.append(node)
  const dispose = render(() => withBrowserPlatform(() => createComponent(LanguageProvider, {
    locale: "en",
    get children() {
      return createComponent(SfContextProvider, { selection: () => selection, dependencies,
        get children() { return createComponent(child, {}) } })
    },
  })), node)
  await waitFor(() => captured.handle?.state().status === "ready")
  const handle = captured.handle!
  let closed = false
  return {
    handle, pending, transports,
    close: () => { if (!closed) { closed = true; dispose(); node.remove() } },
  }
}

test("the admitted ready access survives an await and keeps the original transport identity", async () => {
  const view = await fixture()
  try {
    const admitted = view.handle.ready()!
    expect(admitted).toBeDefined()
    expect(admitted.transport).toBe(view.transports[0]!)
    expect(Object.isFrozen(admitted)).toBe(true)
    await Promise.resolve()
    expect(view.handle.ready()).toBe(admitted)
    expect(view.handle.ready()!.drafts).toBe(admitted.drafts)
    expect(view.handle.ready()!.context.stamp).toEqual(context("access-1").stamp)

    const reply = Promise.withResolvers<void>()
    const delivered: string[] = []
    const oldRead = (async () => {
      await reply.promise
      if (view.handle.ready() === admitted) delivered.push("old-generation")
    })()
    const reload = view.handle.reload()
    expect(view.handle.ready()).toBeUndefined()
    reply.resolve()
    await oldRead
    await reload
    const renewed = view.handle.ready()!
    expect(delivered).toEqual([])
    expect(renewed).toBeDefined()
    expect(renewed).not.toBe(admitted)
    expect(renewed.transport).toBe(view.transports[1]!)
    expect(renewed.transport).not.toBe(admitted.transport)
    expect(view.handle.ready()).toBe(renewed)
  } finally { view.close() }
})

test("expiry, revocation, logout and unmount never expose the prior ready access", async () => {
  const view = await fixture()
  try {
    for (const reason of ["session-expired", "revoked", "logout"] as const) {
      const admitted = view.handle.ready()!
      expect(admitted).toBeDefined()
      view.handle.invalidate(reason)
      expect(view.handle.ready()).toBeUndefined()
      expect(view.handle.state().status).not.toBe("ready")
      await Promise.resolve()
      expect(view.handle.ready()).toBeUndefined()
      await view.handle.reload()
      expect(view.handle.ready()).toBeDefined()
      expect(view.handle.ready()).not.toBe(admitted)
    }
    view.pending.push(async () => ({ status: "denied" }))
    await view.handle.reload()
    expect(view.handle.state().status).toBe("denied")
    expect(view.handle.ready()).toBeUndefined()
    await view.handle.reload()
    expect(view.handle.ready()).toBeDefined()
    view.close()
    expect(view.handle.ready()).toBeUndefined()
  } finally { view.close() }
})

test("a delayed prior context cannot replace the successor access revision or wrapper", async () => {
  const view = await fixture()
  const late = Promise.withResolvers<Reply>()
  let entered = false
  try {
    const first = view.handle.ready()!
    view.pending.push(async () => { entered = true; return late.promise })
    const oldLoad = view.handle.reload()
    await waitFor(() => entered)
    expect(view.handle.ready()).toBeUndefined()
    view.pending.push(async () => ({ status: "ok", value: context("access-2") }))
    await view.handle.reload()
    const successor = view.handle.ready()!
    expect(successor).not.toBe(first)
    expect(successor.context.stamp.accessRevision).toBe("access-2")
    late.resolve({ status: "ok", value: context("obsolete-access") })
    await oldLoad
    expect(view.handle.ready()).toBe(successor)
    expect(view.handle.ready()!.context.stamp.accessRevision).toBe("access-2")
    expect(view.handle.ready()!.transport).toBe(view.transports.at(-1)!)
  } finally { late.resolve({ status: "denied" }); view.close() }
})
