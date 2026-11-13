import type { ReviewOutcomeComparison } from "./outcome.ts"
import { reviewOutcomeComparisonLines, validOutcomeComparison, reviewOutcomeLines, validReviewOutcome } from "./outcome.ts"
import type { ObservedResultProjection } from "../contracts/decisions.ts"
import type { DomainProjection, PreservedReview } from "../contracts/context.ts"
import type { PortResult } from "../contracts/ports.ts"
import type { TrustedDomainContext } from "../contracts/sf-execution.ts"
import type { createReviewPort } from "./port.ts"
import { compareReviews } from "./compare.ts"
import { reviewDecisionLines, validReviewDecision } from "./decision.ts"
import { renderCapturedMeetingChart } from "./meeting-chart.ts"
import type { ReviewChart } from "./port.ts"
import { matchesSelectedSources } from "./references.ts"

export function createMeetingView(input: {
  reviews: ReturnType<typeof createReviewPort>
  reviewRef: string
  context: TrustedDomainContext
  checkUpdate: (reviewRef: string, context: TrustedDomainContext) => Promise<PortResult<{ available: boolean }>>
  requestUpdate: (reviewRef: string) => void
}) {
  return createMeetingViewFromReads({ reviewRef: input.reviewRef, read: (ref) => input.reviews.read(ref, input.context), checkUpdate: (ref) => input.checkUpdate(ref, input.context), requestUpdate: input.requestUpdate })
}

/** Browser clients obtain a fresh authenticated read for every navigation. */
export function createMeetingViewFromReads(input: {
  reviewRef: string
  read: (reviewRef: string) => Promise<PortResult<PreservedReview>>
  checkUpdate: (reviewRef: string) => Promise<PortResult<{ available: boolean }>>
  requestUpdate: (reviewRef: string) => void
}) {
  const root = document.createElement("section")
  const status = document.createElement("p")
  status.setAttribute("role", "status")
  const content = document.createElement("div")
  const navigation = document.createElement("nav")
  const previous = document.createElement("button")
  const next = document.createElement("button")
  const refresh = document.createElement("button")
  const compare = document.createElement("button")
  previous.type = next.type = refresh.type = compare.type = "button"
  previous.textContent = "Previous topic"
  next.textContent = "Next topic"
  refresh.textContent = "Check for updates"
  compare.textContent = "Compare reviews"
  navigation.append(previous, next, compare, refresh)
  root.append(status, content, navigation)
  let index = 0
  let generation = 0
  const show = async (target: number) => {
    const turn = ++generation
    const result = await input.read(input.reviewRef)
    if (turn !== generation) return false
    content.replaceChildren()
    if (result.status !== "ok" || !result.value) {
      status.textContent = "Review is unavailable or access has changed."
      previous.disabled = next.disabled = true
      return false
    }
    const review = result.value
    index = Math.max(0, Math.min(target, review.sections.length - 1))
    previous.disabled = index === 0
    next.disabled = index >= review.sections.length - 1
    status.textContent = `Preserved review ${review.id} v${review.version} · ${review.createdAt}`
    const section = review.sections[index]
    if (!section) {
      content.textContent = "No sections selected."
      return true
    }
    const heading = document.createElement("h2")
    heading.textContent = section.title
    const period = document.createElement("p")
    period.textContent = `${section.period.start} – ${section.period.end} · ${section.count} records`
    content.append(heading, period)
    const projection = section.content as DomainProjection
    if (!projection || !Array.isArray(projection.values)) {
      content.append("Section content unavailable.")
      return false
    }
    const capturedChart = (projection as DomainProjection & { reviewChart?: ReviewChart }).reviewChart
    const chart = renderCapturedMeetingChart(projection, capturedChart, review.id)
    if (chart) content.append(chart)
    const note = (projection as DomainProjection & { reviewAgendaNote?: unknown }).reviewAgendaNote
    if (typeof note === "string") {
      const paragraph = document.createElement("p")
      paragraph.textContent = `Agenda note: ${note}`
      content.append(paragraph)
    }
    const comparison = (projection as DomainProjection & { reviewOutcomeComparison?: ReviewOutcomeComparison }).reviewOutcomeComparison
    if (comparison && validOutcomeComparison(comparison)) {
      const list = document.createElement("ul")
      reviewOutcomeComparisonLines(comparison).forEach((line) => {
        const item = document.createElement("li")
        item.textContent = line
        list.append(item)
      })
      content.append(list)
    }
    const outcome = (projection as DomainProjection & { reviewOutcome?: ObservedResultProjection }).reviewOutcome
    if (outcome && validReviewOutcome(outcome)) {
      const list = document.createElement("ul")
      reviewOutcomeLines(outcome).forEach((line) => {
        const item = document.createElement("li")
        item.textContent = line
        list.append(item)
      })
      content.append(list)
    }
    if (projection.decision && validReviewDecision(projection.decision)) {
      const decision = document.createElement("ul")
      reviewDecisionLines(projection.decision).forEach((line) => {
        const item = document.createElement("li")
        item.textContent = line
        decision.append(item)
      })
      content.append(decision)
    }
    const list = document.createElement("ul")
    projection.values.forEach((value: DomainProjection["values"][number]) => {
      const item = document.createElement("li")
      item.textContent = `${value.id}: ${value.value ?? "unavailable"}${value.unit ? ` ${value.unit}` : ""}${value.currency ? ` ${value.currency}` : ""} · ${value.period.start} – ${value.period.end} · ${value.sourceRefs.map((ref) => ref.refId).join(", ") || "source unavailable"}`
      list.append(item)
    })
    if (!projection.values.length) {
      const item = document.createElement("li")
      item.textContent = section.count ? "No values available for the selected records." : "No records."
      list.append(item)
    }
    content.append(list)
    const comments = review.comments.filter((comment) => matchesSelectedSources(comment.sourceRefs, section.sourceRefs))
    if (comments.length) {
      const heading = document.createElement("h3")
      heading.textContent = "Preserved comments"
      const list = document.createElement("ul")
      comments.forEach((comment) => {
        const item = document.createElement("li")
        item.textContent = `${comment.authorRef} · ${comment.createdAt} · v${comment.version}: ${comment.content}`
        list.append(item)
      })
      content.append(heading, list)
    }
    return true
  }
  previous.addEventListener("click", () => { void show(index - 1) })
  next.addEventListener("click", () => { void show(index + 1) })
  compare.addEventListener("click", () => {
    const turn = ++generation
    void (async () => {
      const current = await input.read(input.reviewRef)
      if (turn !== generation) return
      if (current.status !== "ok" || !current.value) {
        content.replaceChildren()
        status.textContent = "Review is unavailable or access has changed."
        return
      }
      const prior = current.value.previousReviewRef ? await input.read(current.value.previousReviewRef) : undefined
      if (turn !== generation) return
      if (prior && (prior.status !== "ok" || !prior.value)) {
        content.replaceChildren()
        status.textContent = "Previous review is unavailable or access has changed."
        return
      }
      const latest = await input.read(input.reviewRef)
      const priorAgain = current.value.previousReviewRef ? await input.read(current.value.previousReviewRef) : undefined
      if (turn !== generation) return
      if (latest.status !== "ok" || !latest.value || JSON.stringify(latest.value) !== JSON.stringify(current.value) || (prior && (!priorAgain || priorAgain.status !== "ok" || !priorAgain.value || prior.status !== "ok" || JSON.stringify(priorAgain.value) !== JSON.stringify(prior.value)))) {
        content.replaceChildren()
        status.textContent = "Comparison is unavailable or access has changed."
        return
      }
      const differences = compareReviews(prior?.status === "ok" ? prior.value : null, current.value)
      content.replaceChildren()
      status.textContent = differences.state === "first-review" ? "First review; no previous comparison." : differences.state === "unavailable" ? "Comparison is unavailable." : "Changes between preserved reviews."
      const list = document.createElement("ul")
      differences.changes.forEach((change) => {
        const item = document.createElement("li")
        const before = "before" in change ? String(change.before.value ?? "unavailable") : "not present"
        const after = "after" in change ? String(change.after.value ?? "unavailable") : "not present"
        const source = "after" in change ? change.after : change.before
        const reviewRef = "previousReviewId" in change ? `${change.previousReviewId} → ${change.reviewId}` : change.reviewId
        const delta = "delta" in change && change.delta !== undefined ? ` (Δ ${change.delta})` : ""
        item.textContent = `section ${change.sectionId} · ${reviewRef} · ${source.id} · ${change.kind}: ${before} → ${after}${delta} · ${change.basis}`
        list.append(item)
      })
      if (differences.state !== "unavailable") differences.omissions.forEach((omission) => {
        const item = document.createElement("li")
        item.textContent = `Omitted: section ${omission.sectionId} · ${omission.valueId} · ${omission.reason}`
        list.append(item)
      })
      content.append(list)
      if (differences.state !== "unavailable") {
        differences.outcomeComparisons.forEach((entry) => {
          const block = document.createElement("ul")
          reviewOutcomeComparisonLines(entry.comparison).forEach((line) => {
            const item = document.createElement("li")
            item.textContent = `${entry.reviewId} · section ${entry.sectionId} · ${line}`
            block.append(item)
          })
          content.append(block)
        })
        differences.outcomes.forEach((entry) => {
          const block = document.createElement("ul")
          reviewOutcomeLines(entry.projection).forEach((line) => {
            const item = document.createElement("li")
            item.textContent = `${entry.reviewId} · section ${entry.sectionId} · ${line}`
            block.append(item)
          })
          content.append(block)
        })
        if (differences.comments.length) {
          const heading = document.createElement("h3")
          heading.textContent = "Preserved comments"
          const comments = document.createElement("ul")
          differences.comments.forEach((comment) => {
            const item = document.createElement("li")
            item.textContent = `${comment.reviewId} · ${comment.authorRef} · ${comment.createdAt} · v${comment.version}: ${comment.content}`
            comments.append(item)
          })
          content.append(heading, comments)
        }
      }
      if ("limitations" in differences) differences.limitations.forEach((limitation) => {
        const paragraph = document.createElement("p")
        paragraph.textContent = limitation
        content.append(paragraph)
      })
    })()
  })
  const checkUpdates = async () => {
    const turn = ++generation
    const result = await input.checkUpdate(input.reviewRef)
    if (turn !== generation) return
    if (result.status === "denied") {
      content.replaceChildren()
      status.textContent = "Review is unavailable or access has changed."
      return
    }
    const shown = await show(index)
    if (!shown) return
    if (result.status !== "ok") {
      status.textContent += " · Update status unavailable."
      return
    }
    if (!result.value.available) return
    const update = document.createElement("button")
    update.type = "button"
    update.textContent = "Create an updated review"
    update.addEventListener("click", () => input.requestUpdate(input.reviewRef))
    content.append(update)
  }
  refresh.addEventListener("click", () => { void checkUpdates() })
  void show(0)
  return { element: root, refresh: () => checkUpdates(), dispose: () => { generation++; content.replaceChildren(); root.remove() } }
}
