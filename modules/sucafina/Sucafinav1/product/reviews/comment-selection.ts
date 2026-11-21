import type { PreservedReview } from "../contracts/context.ts"
import { matchesSelectedSources } from "./references.ts"

export type ReviewCommentRef = { id: string; version: number; digest: string }
type Comment = PreservedReview["comments"][number]

/** C05 validates each digest before returning a review. The browser then uses only
 * this explicit membership; it does not infer continuity or confer source access.
 * Server renderers supply the digest function as an additional integrity check.
 */
export function selectedReviewComments(review: PreservedReview, sectionRefs: readonly string[], digest?: (comment: Comment) => string): readonly Comment[] | undefined {
  if (new Set(sectionRefs).size !== sectionRefs.length) return undefined
  const selected = sectionRefs.map((id) => review.sections.find((section) => section.id === id))
  if (selected.some((section) => !section)) return undefined
  const admitted = new Set<string>()
  for (const section of selected) {
    const references = readCommentRefs(section!.content)
    if (references === false) return undefined
    if (references === undefined) {
      review.comments.filter((comment) => matchesSelectedSources(comment.sourceRefs, section!.sourceRefs)).forEach((comment) => admitted.add(key(comment)))
      continue
    }
    if (!validCommentRefs(section!.content, review.comments, digest)) return undefined
    references.forEach((reference) => admitted.add(key(reference)))
  }
  return review.comments.filter((comment) => admitted.has(key(comment)))
}

export function validCommentRefs(projection: unknown, comments: readonly Comment[], digest?: (comment: Comment) => string) {
  const references = readCommentRefs(projection)
  if (references === false || !Array.isArray(comments)) return false
  if (references === undefined) return true
  const indexed = new Map<string, Comment>()
  for (const comment of comments) {
    if (!comment || typeof comment !== "object" || typeof comment.id !== "string" || !Number.isSafeInteger(comment.version) || indexed.has(key(comment))) return false
    indexed.set(key(comment), comment)
  }
  return references.every((reference) => {
    const match = indexed.get(key(reference))
    if (!match) return false
    try { return !digest || digest(match) === reference.digest } catch { return false }
  })
}

export function readCommentRefs(projection: unknown): readonly ReviewCommentRef[] | undefined | false {
  if (!projection || typeof projection !== "object" || Array.isArray(projection)) return false
  const references = (projection as { reviewCommentRefs?: unknown }).reviewCommentRefs
  if (references === undefined) return undefined
  if (!Array.isArray(references) || references.some((ref) => !ref || typeof ref !== "object" || Array.isArray(ref) || Reflect.ownKeys(ref).some((name) => typeof name !== "string" || !["id", "version", "digest"].includes(name)) || typeof ref.id !== "string" || !ref.id.trim() || !Number.isSafeInteger(ref.version) || ref.version < 1 || typeof ref.digest !== "string" || !/^[a-f0-9]{64}$/.test(ref.digest)) || new Set(references.map(key)).size !== references.length) return false
  return references as readonly ReviewCommentRef[]
}

function key(value: Pick<Comment, "id" | "version">) {
  return JSON.stringify([value.id, value.version])
}
