import { describe, expect, test } from "bun:test"
import type { SfHref, SfOwnerKey, SfOwnerSelection, SfRef, SfResolvedRoute, SfServerKey } from "@orchestra/schema/sucafina/context"
import type { SfContextState } from "../../src/orchestra/chapters/sucafina/context/contracts"
import { advancedNavigation } from "../../src/orchestra/navigation"
import { matchSfNativeRoutePath, sfNativeRouteSpecs } from "../../src/orchestra/chapters/sucafina/route-registry"
import { bindSfNativeChapterNavigation, openSfNativeChapter, rejectInvalidSfOwnerQuery, requestSfNativeChapterNavigation,
  sfNativeChapterEntry, sfNativeOwnerChapterRequest, sfCaptureReadyOwner, sfReadyOwnerSelection, sfSameReadyOwnerSnapshot,
  transitionSfNativeChapter } from "../../src/orchestra/chapters/sucafina/host/native-chapter-entry"
import { createSfNavigationState } from "../../src/orchestra/chapters/sucafina/navigation-state"

describe("native chapter entry", () => {
  test("each manifest chapter has one canonical sidebar entry and recognized default route", () => {
    const chapters = new Set(sfNativeRouteSpecs.map((spec) => spec.chapterId))
    for (const chapter of chapters) {
      expect(advancedNavigation.some((item) => item.id === chapter)).toBe(true)
      const href = sfNativeChapterEntry(chapter)!
      expect(matchSfNativeRoutePath(href)?.chapterId).toBe(chapter)
    }
    expect(sfNativeChapterEntry("sf-untrusted")).toBeUndefined()
    expect(sfNativeChapterEntry("sf-imports")).toBe("/orchestra/sf-imports/new")
  })
  test("candidate URLs preserve the verified owner triplet", () => {
    const selection = { serverKey: "https://server.example" as SfServerKey,
      projectId: "project" as SfRef, installationId: "install" as SfRef } satisfies SfOwnerSelection
    const href = sfNativeOwnerChapterRequest("sf-planner", selection)!
    const parsed = new URL(href, "https://shell.example")
    expect(parsed.pathname).toBe("/orchestra/sf-planner/overview")
    expect(Object.fromEntries(parsed.searchParams)).toEqual({ server: selection.serverKey, project: selection.projectId, installation: selection.installationId })
    expect(sfNativeOwnerChapterRequest("sf-planner", { ...selection, installationId: undefined })).toBeUndefined()
  })
  test("ready owner tuple comes from one coherent verified snapshot, not discovery", () => {
    const ready = {
      status: "ready", ownerKey: "owner" as SfOwnerKey,
      owner: { serverKey: "server-a", transportIdentity: "transport", publicOrigin: "https://sf.example",
        projectId: "project-a", installationId: "install-a", principalRef: "principal", authEpoch: 1 },
      binding: { projectId: "project-a", installationId: "install-a", hostId: "host", publicOrigin: "https://sf.example",
        mount: "/sucafina", authMode: "microsoft", contractRevision: "sf-native-ui/1" },
      context: { stamp: { projectId: "project-a", installationId: "install-a", hostId: "host", principalRef: "principal",
        policyVersion: "policy", accessRevision: "revision" }, contractRevision: "sf-native-ui/1", authMode: "microsoft",
        destinations: [], availability: [] },
    } satisfies Extract<SfContextState, { status: "ready" }>
    const selected = sfReadyOwnerSelection(ready)
    expect(selected).toEqual({ serverKey: "server-a", projectId: "project-a", installationId: "install-a" })
    const withStaleSelection = { ...ready, selection: { serverKey: "server-b", projectId: "project-b", installationId: "install-b" } }
    expect(sfReadyOwnerSelection(withStaleSelection)).toEqual(selected)
    expect(sfReadyOwnerSelection({ ...ready, owner: { ...ready.owner, projectId: "different" } })).toBeUndefined()
    expect(sfReadyOwnerSelection({ ...ready, context: { ...ready.context, stamp: { ...ready.context.stamp, hostId: "different" } } })).toBeUndefined()
    const snapshot = sfCaptureReadyOwner(ready)
    if (!snapshot) throw new Error("verified snapshot missing")
    let current: SfContextState = ready
    let generation = 7
    const handle = { state: () => current, generation: () => generation }
    expect(sfSameReadyOwnerSnapshot(handle, snapshot, 7)).toBe(true)
    generation = 8
    expect(sfSameReadyOwnerSnapshot(handle, snapshot, 7)).toBe(false)
    generation = 7
    current = { ...ready, owner: { ...ready.owner, serverKey: "server-b" } }
    expect(sfSameReadyOwnerSnapshot(handle, snapshot, 7)).toBe(false)
    current = { ...ready, context: { ...ready.context, stamp: { ...ready.context.stamp, accessRevision: "revoked" } } }
    expect(sfSameReadyOwnerSnapshot(handle, snapshot, 7)).toBe(false)
    if (!selected) throw new Error("verified selection missing")
    current = { status: "denied", selection: selected }
    expect(sfSameReadyOwnerSnapshot(handle, snapshot, 7)).toBe(false)
    const mutableStamp = { ...ready.context.stamp }
    const mutableReady = { ...ready, context: { ...ready.context, stamp: mutableStamp } }
    const captured = sfCaptureReadyOwner(mutableReady)
    if (!captured) throw new Error("mutable snapshot missing")
    current = mutableReady
    mutableStamp.accessRevision = "changed-in-place"
    expect(sfSameReadyOwnerSnapshot(handle, captured, 7)).toBe(false)
  })
  test("live denial never falls back, and initial entry and profile switch are distinct", async () => {
    const calls: string[] = []
    const request = { chapter: "sf-people", server: "server", directory: "/repo" }
    const deps = { request: async () => "blocked" as const, confirmExit: async () => { calls.push("exit"); return true },
      sameProfile: () => true, selectProfile: () => calls.push("profile"), navigate: (href: string) => calls.push(href) }
    await openSfNativeChapter(request, deps)
    expect(calls).toEqual([])
    await openSfNativeChapter(request, { ...deps, request: async () => "committed" })
    expect(calls).toEqual([])
    await openSfNativeChapter(request, { ...deps, request: async () => "unmounted" })
    expect(calls).toEqual(["profile", "/orchestra/sf-people/overview"])
    calls.length = 0
    await openSfNativeChapter(request, { ...deps, request: async () => "profile-mismatch", confirmExit: async () => false })
    expect(calls).toEqual([])
    await openSfNativeChapter(request, { ...deps, request: async () => "profile-mismatch" })
    expect(calls).toEqual(["exit", "profile", "/orchestra/sf-people/overview"])
    calls.length = 0
    await openSfNativeChapter(request, { ...deps, request: async () => "unmounted", sameProfile: () => false })
    expect(calls).toEqual([])
  })
  test("the live owner callback is explicitly bound and retired", async () => {
    const request = { chapter: "sf-home", server: "server", directory: "/repo" }
    const release = bindSfNativeChapterNavigation(async (received) => received === request ? "blocked" : "committed")
    try { expect(await requestSfNativeChapterNavigation(request)).toBe("blocked") }
    finally { release() }
    expect(await requestSfNativeChapterNavigation(request)).toBe("unmounted")
  })
  test("invalid owner syntax preserves the live owner and prior editor", () => {
    const events: string[] = []
    const deps = { restore: (href: string) => events.push(`restore:${href}`), notify: () => events.push("invalid"),
      initialInvalid: () => events.push("unmount") }
    rejectInvalidSfOwnerQuery({ ownerMounted: true, selectionPresent: true, previousHref: "/orchestra/sf-home" }, deps)
    expect(events).toEqual(["restore:/orchestra/sf-home", "invalid"])
    events.length = 0
    rejectInvalidSfOwnerQuery({ ownerMounted: true, selectionPresent: false }, deps)
    expect(events).toEqual(["invalid"])
    events.length = 0
    rejectInvalidSfOwnerQuery({ ownerMounted: false, selectionPresent: false }, deps)
    expect(events).toEqual(["unmount"])
  })
  test("sidebar enters through the real F01 transition and cannot commit a changed owner", async () => {
    const selection = { serverKey: "server" as SfServerKey, projectId: "project" as SfRef, installationId: "install" as SfRef } satisfies SfOwnerSelection
    const ownerKey = "owner-a" as SfOwnerKey
    let resolvedOwner = ownerKey
    const committed: string[] = []
    const navigation = createSfNavigationState({
      selected: () => selection, currentHref: () => "/orchestra/sf-home", currentOwnerKey: () => ownerKey,
      hasDirtyDrafts: () => false, confirmDiscard: async () => false, invalidateOwner: () => { throw new Error("unexpected owner change") },
      validateRetained: () => undefined,
      resolveAuthorizedRoute: async (href, selected) => {
        const url = new URL(href, "https://orchestra.invalid")
        const candidate = matchSfNativeRoutePath(url.pathname)!
        return { status: "authorized", ownerKey: resolvedOwner, route: {
          surfaceId: candidate.surfaceId, kind: candidate.kind, params: candidate.parameters,
          ownerSelection: selected, pathname: url.pathname, href: href as SfHref, query: {},
        } as SfResolvedRoute }
      },
      commit: ({ route, cause }) => committed.push(`${cause}:${route.href}`),
    })
    try {
      expect((await transitionSfNativeChapter("sf-people", selection, ownerKey, navigation)).status).toBe("committed")
      expect(committed).toEqual(["sidebar:/orchestra/sf-people/overview?server=server&project=project&installation=install"])
      resolvedOwner = "owner-b" as SfOwnerKey
      expect((await transitionSfNativeChapter("sf-planner", selection, ownerKey, navigation)).status).toBe("denied")
      expect(committed).toHaveLength(1)
    } finally { navigation.dispose() }
  })
})
