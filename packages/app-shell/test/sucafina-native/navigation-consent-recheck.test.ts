import { describe, expect, test } from "bun:test"
import type { SfHref, SfOwnerKey, SfOwnerSelection, SfRef, SfResolvedRoute, SfServerKey } from "@orchestra/schema/sucafina/context"
import { createSfNavigationState } from "../../src/orchestra/chapters/sucafina/navigation-state"

const oldSelection = { serverKey: "server" as SfServerKey, projectId: "old" as SfRef, installationId: "old-install" as SfRef } satisfies SfOwnerSelection
const target = "/orchestra/sf-home?server=server&project=new&installation=new-install"
const oldOwner = "old-owner" as SfOwnerKey
const newOwner = "new-owner" as SfOwnerKey

describe("target re-admission after discard consent", () => {
  test("a revoked target does not commit or retire the current owner", async () => {
    const events: string[] = []
    const nav = createSfNavigationState({
      selected: () => oldSelection, currentHref: () => "/orchestra/sf-home", currentOwnerKey: () => oldOwner,
      hasDirtyDrafts: () => true, confirmDiscard: async () => { events.push("consent"); return true },
      revalidateAfterConsent: async () => { events.push("source-recheck"); return false },
      invalidateOwner: () => events.push("invalidate"), validateRetained: () => undefined,
      finishPreflight: (_signal, commit) => { events.push(`finish:${commit}`); return true },
      resolveAuthorizedRoute: async (href, ownerSelection) => ({ status: "authorized", ownerKey: newOwner,
        route: { surfaceId: "UI29", kind: "entry", params: {}, ownerSelection, pathname: "/orchestra/sf-home", href: href as SfHref, query: {} } satisfies SfResolvedRoute<"UI29"> }),
      commit: () => { events.push("commit") },
    })
    try {
      expect((await nav.requestNativeTransition(target, "deep-link")).status).toBe("denied")
      expect(events).toEqual(["consent", "source-recheck", "finish:false"])
    } finally { nav.dispose() }
  })
  test("consent precedes the fresh source check, promotion and commit", async () => {
    const events: string[] = []
    const nav = createSfNavigationState({
      selected: () => oldSelection, currentHref: () => "/orchestra/sf-home", currentOwnerKey: () => oldOwner,
      hasDirtyDrafts: () => true, confirmDiscard: async () => { events.push("consent"); return true },
      revalidateAfterConsent: async () => { events.push("source-recheck"); return true },
      invalidateOwner: () => events.push("invalidate"), validateRetained: () => undefined,
      finishPreflight: (_signal, commit) => { events.push(`finish:${commit}`); return true },
      resolveAuthorizedRoute: async (href, ownerSelection) => ({ status: "authorized", ownerKey: newOwner,
        route: { surfaceId: "UI29", kind: "entry", params: {}, ownerSelection, pathname: "/orchestra/sf-home", href: href as SfHref, query: {} } satisfies SfResolvedRoute<"UI29"> }),
      commit: () => { events.push("commit") },
    })
    try {
      expect((await nav.requestNativeTransition(target, "deep-link")).status).toBe("committed")
      expect(events).toEqual(["consent", "source-recheck", "finish:true", "invalidate", "commit", "finish:false"])
    } finally { nav.dispose() }
  })
  test("an outgoing owner change during the fresh read cannot promote the stage", async () => {
    const events: string[] = []
    let currentOwner = oldOwner
    const nav = createSfNavigationState({
      selected: () => oldSelection, currentHref: () => "/orchestra/sf-home", currentOwnerKey: () => currentOwner,
      hasDirtyDrafts: () => true, confirmDiscard: async () => true,
      revalidateAfterConsent: async () => { currentOwner = "another-owner" as SfOwnerKey; return true },
      invalidateOwner: () => events.push("invalidate"), validateRetained: () => undefined,
      finishPreflight: (_signal, commit) => { events.push(`finish:${commit}`); return true },
      resolveAuthorizedRoute: async (href, ownerSelection) => ({ status: "authorized", ownerKey: newOwner,
        route: { surfaceId: "UI29", kind: "entry", params: {}, ownerSelection, pathname: "/orchestra/sf-home", href: href as SfHref, query: {} } satisfies SfResolvedRoute<"UI29"> }),
      commit: () => { events.push("commit") },
    })
    try {
      expect((await nav.requestNativeTransition(target, "deep-link")).status).toBe("aborted")
      expect(events).toEqual(["finish:false"])
    } finally { nav.dispose() }
  })
  test("abort during the fresh read cannot promote the stage", async () => {
    const events: string[] = []
    const abort = new AbortController()
    const nav = createSfNavigationState({
      selected: () => oldSelection, currentHref: () => "/orchestra/sf-home", currentOwnerKey: () => oldOwner,
      hasDirtyDrafts: () => true, confirmDiscard: async () => true,
      revalidateAfterConsent: async () => { abort.abort(); return true },
      invalidateOwner: () => events.push("invalidate"), validateRetained: () => undefined,
      finishPreflight: (_signal, commit) => { events.push(`finish:${commit}`); return true },
      resolveAuthorizedRoute: async (href, ownerSelection) => ({ status: "authorized", ownerKey: newOwner,
        route: { surfaceId: "UI29", kind: "entry", params: {}, ownerSelection, pathname: "/orchestra/sf-home", href: href as SfHref, query: {} } satisfies SfResolvedRoute<"UI29"> }),
      commit: () => { events.push("commit") },
    })
    try {
      expect((await nav.requestNativeTransition(target, "deep-link", { signal: abort.signal })).status).toBe("aborted")
      expect(events).toEqual(["finish:false"])
    } finally { nav.dispose() }
  })
})
