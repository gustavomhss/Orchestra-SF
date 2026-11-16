import type { SfOwnerKey, SfOwnerSelection } from "@orchestra/schema/sucafina/context"
import type { SfNativeNavigationState, SfNativeTransitionResult } from "../navigation-state"
import { isSfNativeChapter, type SfNativeChapterId } from "../route-registry"

const entries: Readonly<Record<SfNativeChapterId, string>> = {
  "sf-dashboard": "/orchestra/sf-dashboard/executive",
  "sf-people": "/orchestra/sf-people/overview",
  "sf-operations": "/orchestra/sf-operations/service",
  "sf-portfolio": "/orchestra/sf-portfolio/overview",
  "sf-procurement": "/orchestra/sf-procurement/overview",
  "sf-planner": "/orchestra/sf-planner/overview",
  "sf-home": "/orchestra/sf-home",
  "sf-work": "/orchestra/sf-work",
  "sf-decisions": "/orchestra/sf-decisions",
  "sf-bi": "/orchestra/sf-bi",
  "sf-reviews": "/orchestra/sf-reviews/agenda",
  "sf-imports": "/orchestra/sf-imports/new",
  "sf-documents": "/orchestra/sf-documents",
  "sf-memory": "/orchestra/sf-memory",
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

/** A failed live-owner transition never falls back to a raw route. */
export async function openSfNativeChapter(request: Request, deps: Readonly<{
  request: (request: Request) => Promise<SfNativeChapterNavigationResult>
  confirmExit: () => Promise<boolean>
  sameProfile: () => boolean
  selectProfile: () => void
  navigate: (href: string) => void
}>): Promise<void> {
  const href = sfNativeChapterEntry(request.chapter)
  if (!href) return
  const result = await deps.request(request)
  if (result !== "unmounted" && result !== "profile-mismatch") return
  if (result === "profile-mismatch" && !(await deps.confirmExit())) return
  if (!deps.sameProfile()) return
  deps.selectProfile()
  deps.navigate(href)
}
