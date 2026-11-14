import type { ReviewOutcomeComparison } from "./outcome.ts"
import { reviewOutcomeComparisonLines, validOutcomeComparison, reviewOutcomeLines, validReviewOutcome } from "./outcome.ts"
import type { ObservedResultProjection } from "../contracts/decisions.ts"
import type { BusinessEvidenceRef } from "../contracts/business-context.ts"
import type { DomainProjection, PreservedReview } from "../contracts/context.ts"
import type { PortResult } from "../contracts/ports.ts"
import type { TrustedDomainContext } from "../contracts/sf-execution.ts"
import type { createReviewPort } from "./port.ts"
import { compareReviews } from "./compare.ts"
import { reviewDecisionEvidence, reviewDecisionLines, validReviewDecision } from "./decision.ts"
import { renderCapturedMeetingChart } from "./meeting-chart.ts"
import type { ReviewChart } from "./port.ts"
import { selectedReviewComments } from "./comment-selection.ts"
import type { ReviewComparisonRead, createReviewComparisonPort } from "./comparison-port.ts"
import { canonicalSfValue } from "../contracts/canonical.ts"
import type { ReviewCurrentThread, createReviewCurrentThread } from "./current-thread.ts"

export function createMeetingView(input: {
  reviews: ReturnType<typeof createReviewPort>
  reviewRef: string
  context: TrustedDomainContext
  checkUpdate: (reviewRef: string, context: TrustedDomainContext) => Promise<PortResult<{ available: boolean }>>
  requestUpdate: (reviewRef: string) => void
  comparisons?: Pick<ReturnType<typeof createReviewComparisonPort>, "read">
  currentThread?: ReturnType<typeof createReviewCurrentThread>
  openSource?: (reference: BusinessEvidenceRef) => void | Promise<void>
  openReviewSection?: (reviewRef: string, sectionId: string) => void | Promise<void>
}) {
  return createMeetingViewFromReads({ reviewRef: input.reviewRef, read: (ref) => input.reviews.read(ref, input.context), checkUpdate: (ref) => input.checkUpdate(ref, input.context), requestUpdate: input.requestUpdate, openSource: input.openSource, openReviewSection: input.openReviewSection, ...(input.comparisons ? { readComparison: (ref: string) => input.comparisons!.read(ref, input.context) } : {}), ...(input.currentThread ? { readCurrentThread: (ref: string, commentId: string) => input.currentThread!(ref, commentId, input.context) } : {}) })
}

/** Browser clients obtain a fresh authenticated read for every navigation. */
export function createMeetingViewFromReads(input: {
  reviewRef: string
  read: (reviewRef: string) => Promise<PortResult<PreservedReview>>
  checkUpdate: (reviewRef: string) => Promise<PortResult<{ available: boolean }>>
  requestUpdate: (reviewRef: string) => void
  readComparison?: (reviewRef: string) => Promise<PortResult<ReviewComparisonRead>>
  readCurrentThread?: (reviewRef: string, commentId: string) => Promise<PortResult<ReviewCurrentThread>>
  /** The host opens evidence through its current authorized source resolver. */
  openSource?: (reference: BusinessEvidenceRef) => void | Promise<void>
  openReviewSection?: (reviewRef: string, sectionId: string) => void | Promise<void>
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
  const navigationUnavailable = (message: string) => {
    content.replaceChildren()
    status.textContent = message
  }
  const appendReviewNavigation = (parent: HTMLElement, reviewRef: string, sectionId: string, label: string) => {
    if (reviewRef !== input.reviewRef && !input.openReviewSection) {
      const unavailable = document.createElement("span")
      unavailable.textContent = ` ${label}: review navigation unavailable.`
      parent.append(unavailable)
      return
    }
    const button = document.createElement("button")
    button.type = "button"
    button.textContent = label
    button.addEventListener("click", () => {
      const turn = ++generation
      status.textContent = "Checking review access…"
      void (async () => {
        const result = await input.read(reviewRef)
        if (turn !== generation) return
        const position = result.status === "ok" ? result.value.sections.findIndex((section) => section.id === sectionId) : -1
        if (position < 0) {
          navigationUnavailable("Review item is unavailable or access has changed.")
          return
        }
        if (reviewRef === input.reviewRef) {
          await show(position)
          return
        }
        await input.openReviewSection!(reviewRef, sectionId)
        if (turn === generation) status.textContent = "Review navigation requested."
      })().catch(() => {
        if (turn === generation) navigationUnavailable("Review item navigation is unavailable.")
      })
    })
    parent.append(" ", button)
  }
  const appendSourceNavigation = (parent: HTMLElement, reviewRef: string, sectionId: string, references: readonly BusinessEvidenceRef[]) => {
    const unique = [...new Map(references.map((reference) => [canonicalSfValue(reference), reference])).values()]
    if (!unique.length) return
    const list = document.createElement("ul")
    list.setAttribute("aria-label", "Preserved source navigation")
    unique.forEach((reference) => {
      const item = document.createElement("li")
      if (!input.openSource) {
        item.textContent = `${reference.refId}: source navigation unavailable.`
        list.append(item)
        return
      }
      const button = document.createElement("button")
      button.type = "button"
      button.textContent = `Open source ${reference.refId}`
      button.addEventListener("click", () => {
        const turn = ++generation
        status.textContent = "Checking source access…"
        void (async () => {
          const result = await input.read(reviewRef)
          if (turn !== generation) return
          const section = result.status === "ok" ? result.value.sections.find((section) => section.id === sectionId) : undefined
          const preserved = section ? sectionEvidence(section).find((current) => canonicalSfValue(current) === canonicalSfValue(reference)) : undefined
          if (!preserved) {
            navigationUnavailable("Source is unavailable or review access has changed.")
            return
          }
          await input.openSource!(structuredClone(preserved))
          if (turn === generation) status.textContent = "Source navigation requested."
        })().catch(() => {
          if (turn === generation) navigationUnavailable("Source navigation is unavailable under current access.")
        })
      })
      item.append(button)
      list.append(item)
    })
    if (parent.tagName === "UL" || parent.tagName === "OL") {
      const group = document.createElement("li")
      group.append(list)
      parent.append(group)
      return
    }
    parent.append(list)
  }
  const appendCurrentThread = (parent: HTMLElement, reviewRef: string, comment: Pick<PreservedReview["comments"][number], "id" | "version" | "authorRef" | "createdAt" | "content">) => {
    if (!input.readCurrentThread || !comment.id.startsWith("thread-message:")) return
    const button = document.createElement("button")
    button.type = "button"
    button.textContent = "Open current conversation"
    const panel = document.createElement("section")
    panel.setAttribute("aria-label", "Current conversation")
    button.addEventListener("click", () => {
      const turn = ++generation
      panel.replaceChildren()
      status.textContent = "Checking current conversation access…"
      void (async () => {
        const reviewed = await input.read(reviewRef)
        if (turn !== generation) return
        const preserved = reviewed.status === "ok" ? reviewed.value.comments.find((value) => value.id === comment.id && value.version === comment.version) : undefined
        if (!preserved || preserved.content !== comment.content || preserved.authorRef !== comment.authorRef || preserved.createdAt !== comment.createdAt) {
          navigationUnavailable("Review or conversation access is unavailable.")
          return
        }
        const current = await input.readCurrentThread!(reviewRef, comment.id)
        if (turn !== generation) return
        if (current.status !== "ok" || current.value.view !== "current") {
          navigationUnavailable("Current conversation is unavailable under current access.")
          return
        }
        const heading = document.createElement("h4")
        heading.textContent = "Current conversation"
        const explanation = document.createElement("p")
        explanation.textContent = "This is the current C06 conversation. The preserved comment above retains its captured version."
        const messages = document.createElement("ul")
        current.value.messages.forEach((message) => {
          const item = document.createElement("li")
          item.textContent = `${message.authorRef} · ${message.createdAt} · v${message.version}: ${message.body}`
          messages.append(item)
        })
        panel.replaceChildren(heading, explanation, messages)
        status.textContent = "Current conversation opened; the preserved review is unchanged."
      })().catch(() => { if (turn === generation) navigationUnavailable("Current conversation is unavailable.") })
    })
    parent.append(" ", button, panel)
  }
  const show = async (target: number) => {
    const turn = ++generation
    content.replaceChildren()
    status.textContent = "Loading preserved review…"
    const result = await input.read(input.reviewRef).catch(() => ({ status: "unavailable" as const, reason: "review-unavailable" }))
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
    const comments = selectedReviewComments(review, [section.id])
    if (!comments) { navigationUnavailable("Comment association is unavailable."); return false }
    if (comments.length) {
      const heading = document.createElement("h3")
      heading.textContent = "Preserved comments"
      const list = document.createElement("ul")
      comments.forEach((comment) => {
        const item = document.createElement("li")
        const captured = document.createElement("span")
        captured.textContent = `${comment.authorRef} · ${comment.createdAt} · v${comment.version}: ${comment.content}`
        item.append(captured)
        appendCurrentThread(item, review.id, comment)
        list.append(item)
      })
      content.append(heading, list)
    }
    appendSourceNavigation(content, review.id, section.id, sectionEvidence(section))
    return true
  }
  previous.addEventListener("click", () => { void show(index - 1) })
  next.addEventListener("click", () => { void show(index + 1) })
  compare.addEventListener("click", () => {
    const turn = ++generation
    content.replaceChildren()
    status.textContent = "Loading comparison…"
    void (async () => {
      let authorizedComparison: PortResult<ReviewComparisonRead> | undefined
      let differences: ReturnType<typeof compareReviews>
      if (input.readComparison) {
        // The server port already rereads both reviews and revalidates the current host authority.
        authorizedComparison = await input.readComparison(input.reviewRef)
        if (turn !== generation) return
        if (authorizedComparison.status !== "ok") {
          content.replaceChildren()
          status.textContent = "Comparison is unavailable or access has changed."
          return
        }
        differences = authorizedComparison.value.comparison
      } else {
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
        // This detects a changed authorized payload locally; the reader supplies authority.
        if (latest.status !== "ok" || !latest.value || canonicalSfValue(latest.value) !== canonicalSfValue(current.value) || (prior && (!priorAgain || priorAgain.status !== "ok" || !priorAgain.value || prior.status !== "ok" || canonicalSfValue(priorAgain.value) !== canonicalSfValue(prior.value)))) {
          content.replaceChildren()
          status.textContent = "Comparison is unavailable or access has changed."
          return
        }
        differences = compareReviews(prior?.status === "ok" ? prior.value : null, current.value)
      }
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
        if ("before" in change) appendReviewNavigation(item, "previousReviewId" in change ? change.previousReviewId : change.reviewId, change.sectionId, "Open before item")
        if ("after" in change) appendReviewNavigation(item, change.reviewId, change.sectionId, "Open after item")
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
          appendSourceNavigation(block, entry.reviewId, entry.sectionId, [...entry.comparison.baselineRefs, ...entry.comparison.sourceRefs])
          content.append(block)
        })
        differences.outcomes.forEach((entry) => {
          const block = document.createElement("ul")
          reviewOutcomeLines(entry.projection).forEach((line) => {
            const item = document.createElement("li")
            item.textContent = `${entry.reviewId} · section ${entry.sectionId} · ${line}`
            block.append(item)
          })
          appendSourceNavigation(block, entry.reviewId, entry.sectionId, entry.projection.sourceRefs)
          content.append(block)
        })
        if (differences.comments.length) {
          const heading = document.createElement("h3")
          heading.textContent = "Preserved comments"
          const comments = document.createElement("ul")
          differences.comments.forEach((comment) => {
            const item = document.createElement("li")
            const captured = document.createElement("span")
            captured.textContent = `${comment.reviewId} · ${comment.authorRef} · ${comment.createdAt} · v${comment.version}: ${comment.content}`
            item.append(captured)
            appendCurrentThread(item, comment.reviewId, comment)
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
      if (authorizedComparison?.status === "ok" && differences.state !== "unavailable") {
        const heading = document.createElement("h3")
        heading.textContent = "Canonical follow-up actions"
        const coverage = document.createElement("p")
        coverage.textContent = `Forwarding coverage: ${authorizedComparison.value.forwardingCoverage}. Current action state is shown separately from the preserved review.`
        const actions = document.createElement("ul")
        authorizedComparison.value.forwardings.forEach((entry) => {
          const item = document.createElement("li")
          item.textContent = `${entry.reviewRef} · ${entry.closureRef} · relation ${entry.relationId} · source ${entry.sourceRef} · action ${entry.currentAction.id}: ${entry.currentAction.action}. At closure v${entry.preservedAction.version}: ${entry.preservedAction.status}, due ${entry.preservedAction.due || "not specified"}. Current v${entry.currentAction.version}: ${entry.currentAction.status}, due ${entry.currentAction.due || "not specified"}, owner ${entry.currentAction.owner || "not assigned"}.`
          actions.append(item)
        })
        content.append(heading, coverage, actions)
        authorizedComparison.value.limitations.forEach((limitation) => {
          const paragraph = document.createElement("p")
          paragraph.textContent = limitation
          content.append(paragraph)
        })
      } else if (!input.readComparison) {
        const paragraph = document.createElement("p")
        paragraph.textContent = "Canonical forwarding lookup is unavailable. No action state has been inferred from this review."
        content.append(paragraph)
      }
    })().catch(() => {
      if (turn !== generation) return
      content.replaceChildren()
      status.textContent = "Comparison is unavailable. Try again after refreshing access."
    })
  })
  const checkUpdates = async () => {
    const turn = ++generation
    const result = await input.checkUpdate(input.reviewRef).catch(() => ({ status: "unavailable" as const, reason: "update-unavailable" }))
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

function sectionEvidence(section: PreservedReview["sections"][number]): readonly BusinessEvidenceRef[] {
  const projection = section.content as DomainProjection & { reviewOutcome?: ObservedResultProjection; reviewOutcomeComparison?: ReviewOutcomeComparison }
  if (!projection || !Array.isArray(projection.values)) return []
  return [
    ...projection.values.flatMap((value) => Array.isArray(value.sourceRefs) ? value.sourceRefs : []),
    ...(projection.decision && validReviewDecision(projection.decision) ? reviewDecisionEvidence(projection.decision) : []),
    ...(projection.reviewOutcome && validReviewOutcome(projection.reviewOutcome) ? projection.reviewOutcome.sourceRefs : []),
    ...(projection.reviewOutcomeComparison && validOutcomeComparison(projection.reviewOutcomeComparison) ? [...projection.reviewOutcomeComparison.baselineRefs, ...projection.reviewOutcomeComparison.sourceRefs] : []),
  ]
}

