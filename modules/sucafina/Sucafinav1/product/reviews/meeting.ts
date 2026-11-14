import { digestSfValue } from "../contracts/canonical.ts"
import type { DomainProjection } from "../contracts/context.ts"
import type { PortResult } from "../contracts/ports.ts"
import type { TrustedDomainContext } from "../contracts/sf-execution.ts"
import type { createReviewPort } from "./port.ts"
import { compareReviews } from "./compare.ts"
import { matchesSelectedSources } from "./references.ts"

export function createMeetingView(input: {
  reviews: ReturnType<typeof createReviewPort>
  reviewRef: string
  context: TrustedDomainContext
  checkUpdate: (reviewRef: string, context: TrustedDomainContext) => Promise<PortResult<{ available: boolean }>>
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
    const result = await input.reviews.read(input.reviewRef, input.context)
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
      const current = await input.reviews.read(input.reviewRef, input.context)
      if (turn !== generation) return
      if (current.status !== "ok" || !current.value) {
        content.replaceChildren()
        status.textContent = "Review is unavailable or access has changed."
        return
      }
      const prior = current.value.previousReviewRef ? await input.reviews.read(current.value.previousReviewRef, input.context) : undefined
      if (turn !== generation) return
      if (prior && (prior.status !== "ok" || !prior.value)) {
        content.replaceChildren()
        status.textContent = "Previous review is unavailable or access has changed."
        return
      }
      const latest = await input.reviews.read(input.reviewRef, input.context)
      const priorAgain = current.value.previousReviewRef ? await input.reviews.read(current.value.previousReviewRef, input.context) : undefined
      if (turn !== generation) return
      if (latest.status !== "ok" || !latest.value || digestSfValue(latest.value) !== digestSfValue(current.value) || (prior && (!priorAgain || priorAgain.status !== "ok" || !priorAgain.value || prior.status !== "ok" || digestSfValue(priorAgain.value) !== digestSfValue(prior.value)))) {
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
        const basis = ("before" in change && "after" in change && change.kind === "incompatible")
          ? `${change.before.period.start}–${change.before.period.end} ${change.before.currency ?? change.before.unit ?? ""} → ${change.after.period.start}–${change.after.period.end} ${change.after.currency ?? change.after.unit ?? ""}`
          : `${source.period.start}–${source.period.end} ${source.currency ?? source.unit ?? ""}`
        item.textContent = `${source.id} · ${change.kind}: ${before} → ${after}${"delta" in change && change.delta !== undefined ? ` (Δ ${change.delta})` : ""} · ${basis}`
        list.append(item)
      })
      content.append(list)
      if ("limitations" in differences) differences.limitations.forEach((limitation) => {
        const paragraph = document.createElement("p")
        paragraph.textContent = limitation
        content.append(paragraph)
      })
    })()
  })
  const checkUpdates = async () => {
    const turn = ++generation
    const result = await input.checkUpdate(input.reviewRef, input.context)
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
