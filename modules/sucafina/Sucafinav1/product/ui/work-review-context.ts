import { esc } from "../../src/screen-shell.ts"

type ReviewContextText = { reviewRef: string; reviewVersion: number; reference: string; kind: "closure" | "section" }
const unavailable = '<p data-work-review-context-unavailable>Review context is unavailable.</p>'

/** Presentation of producer-authorized metadata only. A pin is not a read grant
 * or a command; this renderer never prepares a review or opens a destination. */
export function workReviewContext(item: unknown): string {
  if (!item || typeof item !== "object" || Array.isArray(item)) return ""
  try {
    const supplied = "reviewContexts" in item ? item.reviewContexts : undefined
    const discussion = "reviewContext" in item ? item.reviewContext : undefined
    if (supplied === undefined && discussion === undefined) return ""
    const selected = supplied === undefined ? [] : Array.isArray(supplied) ? supplied.map((entry) => readContext(entry, "closure")) : undefined
    const section = discussion === undefined ? undefined : readContext(discussion, "section")
    if (!selected || selected.some((entry) => entry === undefined) || discussion !== undefined && !section) return unavailable
    const actions = selected.filter((entry): entry is ReviewContextText => entry !== undefined)
    if (new Set(actions.map((entry) => entry.reference)).size !== actions.length) return unavailable
    const contexts = section ? [...actions, section] : actions
    if (!contexts.length) return ""
    return `<div data-work-review-context><p>Preserved review context</p><ul>${contexts.map((entry) => `<li><dl><dt>Review reference</dt><dd>${esc(entry.reviewRef)}</dd><dt>Version</dt><dd>${entry.reviewVersion}</dd><dt>${entry.kind === "section" ? "Section" : "Follow-up reference"}</dt><dd>${esc(entry.reference)}</dd></dl></li>`).join("")}</ul></div>`
  } catch {
    // Malformed optional metadata must not expose provider details or prevent
    // the already authorized work item from being presented.
    return unavailable
  }
}

function readContext(value: unknown, kind: ReviewContextText["kind"]): ReviewContextText | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined
  const keys = ["reviewRef", "reviewVersion", "reviewDigest", kind === "section" ? "sectionId" : "closureRef"]
  const own = Reflect.ownKeys(value)
  if (own.length !== keys.length || own.some((key) => typeof key !== "string" || !keys.includes(key))) return undefined
  const reviewRef = "reviewRef" in value ? value.reviewRef : undefined
  const reviewVersion = "reviewVersion" in value ? value.reviewVersion : undefined
  const digest = "reviewDigest" in value ? value.reviewDigest : undefined
  const reference = kind === "section" ? "sectionId" in value ? value.sectionId : undefined : "closureRef" in value ? value.closureRef : undefined
  if (typeof reviewRef !== "string" || !reviewRef.trim() || typeof reviewVersion !== "number" || !Number.isSafeInteger(reviewVersion) || reviewVersion < 1 ||
    typeof digest !== "string" || !/^[a-f0-9]{64}$/.test(digest) || typeof reference !== "string" || !reference.trim()) return undefined
  return { reviewRef, reviewVersion, reference, kind }
}
