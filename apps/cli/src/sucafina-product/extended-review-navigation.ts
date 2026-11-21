type ReviewDestination = { reviewRef: string; sectionId?: string; previousReviewRef?: never } |
  { previousReviewRef: string; reviewRef?: never; sectionId?: never }

/** A preserved review has its own route; Reports form parameters do not belong to that route. */
export function sfReviewNavigationUrl(current: string, destination: ReviewDestination): URL {
  const url = new URL(current)
  url.search = ""
  url.hash = ""
  url.searchParams.set("sf", "review")
  if (destination.reviewRef !== undefined) {
    url.searchParams.set("reviewRef", destination.reviewRef)
    if (destination.sectionId !== undefined) url.searchParams.set("sectionId", destination.sectionId)
  } else {
    url.searchParams.set("previousReviewRef", destination.previousReviewRef)
  }
  return url
}
