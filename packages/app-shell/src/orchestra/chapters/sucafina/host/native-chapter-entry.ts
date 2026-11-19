import type { SfContext, SfOwnerKey, SfOwnerSelection, SfRef, SfServerKey } from "@orchestra/schema/sucafina/context"
import type { SfContextHandle, SfContextState } from "../context/contracts"
import type { SfNativeNavigationState, SfNativeTransitionResult } from "../navigation-state"
import { isSfNativeChapter, type SfNativeChapterId } from "../route-registry"

const entries: Readonly<Record<SfNativeChapterId, string>> = {
  "sf-dashboard": "/orchestra/sf-dashboard/executive",
  "sf-people": "/orchestra/sf-people/overview",
  "sf-operations": "/orchestra/sf-operations/service",
  "sf-portfolio": "/orchestra/sf-portfolio/overview",
  "sf-procurement": "/orchestra/sf-procurement/requests",
  "sf-planner": "/orchestra/sf-planner/overview",
  "sf-home": "/orchestra/sf-home",
  "sf-work": "/orchestra/sf-work",
  "sf-decisions": "/orchestra/sf-decisions",
  "sf-bi": "/orchestra/sf-bi",
  "sf-reviews": "/orchestra/sf-reviews/agenda",
  "sf-imports": "/orchestra/sf-imports/new",
  "sf-documents": "/orchestra/sf-documents",
  "sf-memory": "/orchestra/sf-memory/signals",
  "sf-routines": "/orchestra/sf-routines",
}

/** Recognition and URL construction never grant access. */
export function sfNativeChapterEntry(chapter: string): string | undefined {
  return isSfNativeChapter(chapter) ? entries[chapter as SfNativeChapterId] : undefined
}
export function sfNativeOwnerChapterRequest(chapter: string, selection: SfOwnerSelection): string | undefined {
  const path = sfNativeChapterEntry(chapter)
  if (!path || !selection.serverKey || !selection.projectId || !selection.installationId) return
  return path + "?" + new URLSearchParams({ server: selection.serverKey, project: selection.projectId,
    installation: selection.installationId }).toString()
}

/** Invalid owner syntax is not permission to retire an already-mounted owner. */
export function rejectInvalidSfOwnerQuery(input: Readonly<{ ownerMounted: boolean; selectionPresent: boolean; previousHref?: string }>,
  deps: Readonly<{ restore: (href: string) => void; notify: () => void; initialInvalid: () => void }>): void {
  if (input.ownerMounted || input.selectionPresent) {
    if (input.previousHref) deps.restore(input.previousHref)
    deps.notify()
    return
  }
  deps.initialInvalid()
}

/** Read only the verified ready snapshot; never join discovery from another owner epoch. */
export function sfReadyOwnerSelection(state: Extract<SfContextState, { status: "ready" }>): SfOwnerSelection | undefined {
  if (!state.ownerKey || !state.owner.serverKey || !state.owner.transportIdentity || !state.binding.projectId || !state.binding.installationId ||
    !state.binding.hostId || !state.owner.principalRef || !state.owner.publicOrigin ||
    state.owner.projectId !== state.binding.projectId || state.owner.installationId !== state.binding.installationId ||
    state.owner.publicOrigin !== state.binding.publicOrigin ||
    state.context.stamp.projectId !== state.binding.projectId || state.context.stamp.installationId !== state.binding.installationId ||
    state.context.stamp.hostId !== state.binding.hostId || state.context.stamp.principalRef !== state.owner.principalRef ||
    !state.context.stamp.policyVersion || !state.context.stamp.accessRevision) return
  return { serverKey: state.owner.serverKey as SfServerKey, projectId: state.binding.projectId as SfRef,
    installationId: state.binding.installationId as SfRef }
}

export type SfReadyOwnerSnapshot = Readonly<{ selection: SfOwnerSelection; ownerKey: SfOwnerKey; stamp: SfContext["stamp"] }>
export function sfCaptureReadyOwner(state: Extract<SfContextState, { status: "ready" }>): SfReadyOwnerSnapshot | undefined {
  const selection = sfReadyOwnerSelection(state)
  if (!selection) return
  const stamp = state.context.stamp
  return { selection, ownerKey: state.ownerKey, stamp: {
    installationId: stamp.installationId, projectId: stamp.projectId, hostId: stamp.hostId,
    principalRef: stamp.principalRef, policyVersion: stamp.policyVersion, accessRevision: stamp.accessRevision,
  } }
}

export function sfSameReadyOwnerSnapshot(handle: Readonly<{ state: () => SfContextState; generation: () => number }>,
  prior: SfReadyOwnerSnapshot, generation: number): boolean {
  const current = handle.state()
  if (handle.generation() !== generation || current.status !== "ready" || current.ownerKey !== prior.ownerKey) return false
  const after = sfReadyOwnerSelection(current)
  if (!after || prior.selection.serverKey !== after.serverKey || prior.selection.projectId !== after.projectId ||
    prior.selection.installationId !== after.installationId) return false
  const left = prior.stamp
  const right = current.context.stamp
  return left.installationId === right.installationId && left.projectId === right.projectId &&
    left.hostId === right.hostId && left.principalRef === right.principalRef &&
    left.policyVersion === right.policyVersion && left.accessRevision === right.accessRevision
}

/** Discard only after consent while the exact owner epoch and handle are unchanged. */
export async function confirmSfOwnerExit(deps: Readonly<{
  handle: () => Pick<SfContextHandle, "state" | "generation" | "hasDirtyDrafts" | "discardDrafts"> | undefined
  disposed: () => boolean
  valid?: () => boolean
  confirmDiscard: () => Promise<boolean>
  restoreFocus: () => void
  onDiscarded: () => void
  onBlocked: () => void
}>): Promise<boolean> {
  const handle = deps.handle()
  if (!handle || !handle.hasDirtyDrafts()) return true
  if (deps.valid && !deps.valid()) return false
  const before = handle.state()
  const generation = handle.generation()
  const status = before.status
  const ready = before.status === "ready" ? sfCaptureReadyOwner(before) : undefined
  const selected = before.status !== "ready" ? { ...before.selection } : undefined
  const binding = before.status === "unauthenticated" ? { ...before.binding } : undefined
  if (status === "ready" && !ready) return false
  if (!(await deps.confirmDiscard())) {
    deps.restoreFocus()
    return false
  }
  if (deps.disposed() || deps.valid && !deps.valid() || deps.handle() !== handle || handle.generation() !== generation) return false
  const now = handle.state()
  if (status === "ready") {
    if (!ready || !sfSameReadyOwnerSnapshot(handle, ready, generation)) return false
  } else {
    if (!selected || now.status === "ready" || now.status !== status ||
      now.selection.serverKey !== selected.serverKey || now.selection.projectId !== selected.projectId ||
      now.selection.installationId !== selected.installationId) return false
    if (status === "unauthenticated" && (!binding || now.status !== "unauthenticated" ||
      now.binding.projectId !== binding.projectId || now.binding.installationId !== binding.installationId ||
      now.binding.hostId !== binding.hostId || now.binding.publicOrigin !== binding.publicOrigin ||
      now.binding.mount !== binding.mount || now.binding.authMode !== binding.authMode)) return false
  }
  if (handle.discardDrafts()) {
    deps.onDiscarded()
    return true
  }
  deps.restoreFocus()
  deps.onBlocked()
  return false
}

/** Uses the live F01 transition and fences the owner across its async preflight. */
export function transitionSfNativeChapter(chapter: string, selection: SfOwnerSelection, ownerKey: SfOwnerKey,
  navigation: SfNativeNavigationState): Promise<SfNativeTransitionResult> {
  const href = sfNativeOwnerChapterRequest(chapter, selection)
  if (!href) return Promise.resolve({ status: "invalid-link" })
  return navigation.requestNativeTransition(href, "sidebar", { expectedOwnerKey: ownerKey })
}

export type SfNativeChapterNavigationResult = "committed" | "blocked" | "profile-mismatch" | "unmounted"
type Request = Readonly<{ chapter: string; server: string; directory?: string }>
let live: ((request: Request) => Promise<Exclude<SfNativeChapterNavigationResult, "unmounted">>) | undefined
export function bindSfNativeChapterNavigation(handler: NonNullable<typeof live>): () => void {
  if (live && live !== handler) throw new Error("SF_F01_MULTIPLE_CHAPTER_OWNERS")
  live = handler
  return () => { if (live === handler) live = undefined }
}
export function requestSfNativeChapterNavigation(request: Request): Promise<SfNativeChapterNavigationResult> {
  return live ? live(request) : Promise.resolve("unmounted")
}

/** A failed or unmounted live-owner transition never falls back to a raw route. */
export async function openSfNativeChapter(request: Request, deps: Readonly<{
  request: (request: Request) => Promise<SfNativeChapterNavigationResult>
  confirmExit: () => Promise<boolean>
  sameProfile: () => boolean
  selectProfile: () => void
  navigate: (href: string) => void
}>): Promise<void> {
  if (!sfNativeChapterEntry(request.chapter)) return
  const result = await deps.request(request)
  if (result === "committed" || result === "blocked") return
  if (!(await deps.confirmExit())) return
  if (!deps.sameProfile()) return
}
