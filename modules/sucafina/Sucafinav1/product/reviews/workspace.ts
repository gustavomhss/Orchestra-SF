import type { PreservedReview } from "../contracts/context.ts"
import type { MeetingMaterialProposal } from "../contracts/outputs.ts"
import { createReviewPreparationBrowser } from "./browser.ts"
import type { ReviewAgendaItem, ReviewAgendaPreview } from "./selection.ts"
import type { ReviewContribution, ReviewContributionRequest } from "./contribution.ts"

/** Mount from the host's existing Prepare review / Generate Report entry with authorized source selectors. */
export function createReviewPreparationView(input: {
  items: readonly ReviewAgendaItem[]
  previousReviewRef?: string
  client?: ReturnType<typeof createReviewPreparationBrowser>
  openReview: (reviewRef: string) => void
}) {
  const client = input.client ?? createReviewPreparationBrowser()
  const root = document.createElement("section")
  root.setAttribute("aria-label", "Prepare review")
  let disposed = false
  const state: { busy: boolean; message: string; selection?: ReviewAgendaPreview; order: string[]; items: ReviewAgendaItem[]; review?: PreservedReview; material?: MeetingMaterialProposal; previousReviewRef?: string } = { busy: false, message: "Load the authorized selection to prepare a review.", order: [], items: structuredClone([...input.items]), previousReviewRef: input.previousReviewRef }
  const node = <K extends keyof HTMLElementTagNameMap>(tag: K, text: string) => {
    const element = document.createElement(tag)
    element.textContent = text
    return element
  }
  const action = (label: string, run: () => void | Promise<void>, disabled = false) => {
    const button = node("button", label)
    button.type = "button"
    button.disabled = state.busy || disabled
    button.addEventListener("click", () => { void run() })
    return button
  }
  const render = () => {
    if (disposed) return
    root.replaceChildren(node("h2", state.review ? "Preserved review" : "Prepare review"))
    const status = node("p", state.message)
    status.setAttribute("role", "status")
    status.setAttribute("aria-live", "polite")
    root.append(status)
    if (!state.selection) {
      root.append(action("Load selection", load))
      return
    }
    if (state.review) {
      root.append(node("p", `Reference: ${state.review.id} · Preserved: ${state.review.createdAt}`))
      root.append(action("Open meeting", () => input.openReview(state.review!.id)))
      root.append(action("Generate PPTX", () => report("pptx")), action("Generate DOCX", () => report("docx")))
      root.append(action("Prepare current data as a new revision", load))
    } else root.append(action("Refresh selection from current data", load))
    const list = document.createElement("ol")
    state.order.forEach((id, index) => {
      const section = state.selection!.sections.find((entry) => entry.id === id)
      if (!section) return
      const captured = state.review?.sections.find((entry) => entry.id === id)
      const title = captured?.title ?? section.title
      const period = captured?.period ?? section.period
      const count = captured?.count ?? section.recordCount
      const projection = captured?.content as (typeof section.projection & { reviewAgendaNote?: string }) | undefined
      const agendaNote = captured ? projection?.reviewAgendaNote : section.agendaNote
      const row = document.createElement("li")
      row.append(node("h3", title), node("p", `${period.start} – ${period.end} · ${count} selected records`))
      if (count === 0) row.append(node("p", "No selected records in this section."))
      if (agendaNote) row.append(node("p", `Agenda note: ${agendaNote}`))
      if (!state.review) {
        row.append(action(`Move ${section.title} up`, () => move(index, -1), index === 0), action(`Move ${section.title} down`, () => move(index, 1), index === state.order.length - 1))
        row.append(action(`Remove ${section.title}`, () => { state.order = state.order.filter((ref) => ref !== id); render() }))
        const records = state.selection!.sectionRecordRefs.find((entry) => entry.sectionRef === id)?.recordRefs ?? []
        records.forEach((ref) => row.append(action(`Remove record ${ref}`, () => removeRecord(id, ref))))
      }
      const table = document.createElement("table")
      table.append(node("caption", `${title} · selected source values`))
      const headings = document.createElement("tr")
      ;["Field", "Captured value", "Period"].forEach((label) => {
        const heading = node("th", label)
        heading.scope = "col"
        headings.append(heading)
      })
      const head = document.createElement("thead")
      head.append(headings)
      table.append(head)
      const body = document.createElement("tbody")
      ;(projection ?? section.projection).values.forEach((value) => {
        const line = document.createElement("tr")
        line.append(node("td", value.id), node("td", `${value.value === null ? "Unavailable" : String(value.value)} ${value.currency ?? value.unit ?? ""}`.trim()), node("td", `${value.period.start} – ${value.period.end}`))
        body.append(line)
      })
      table.append(body)
      row.append(table)
      if (!state.review && section.comments?.length) {
        row.append(node("h4", "Captured comments — separate from current conversation"))
        section.comments.forEach((comment) => row.append(node("p", `${comment.authorRef} · ${comment.createdAt} · version ${comment.version}: ${comment.content}`)))
      }
      list.append(row)
    })
    root.append(list)
    if (state.review?.comments.length) {
      root.append(node("h3", "Captured comments — separate from current conversation"))
      state.review.comments.forEach((comment) => root.append(node("p", `${comment.authorRef} · ${comment.createdAt} · version ${comment.version}: ${comment.content}`)))
    }
    if (!state.review) root.append(action("Preserve this review", preserve, state.order.length === 0))
    if (state.order.length === 0) root.append(node("p", "No sections selected. Load a selection before preserving."))
    state.material?.orderedResultRefs.forEach((ref) => {
      const url = client.downloadUrl(ref)
      if (!url) return
      const link = node("a", "Download generated report")
      link.href = url
      root.append(link)
    })
    state.material?.gaps.forEach((gap) => root.append(node("p", `Report limitation: ${gap.reason}`)))
  }
  const run = async (message: string, work: () => Promise<void>) => {
    if (state.busy || disposed) return
    state.busy = true
    state.message = message
    render()
    try { await work() } catch { state.message = "The request failed. Your selection is retained; retry when the service is available." }
    state.busy = false
    render()
  }
  const clearRestricted = () => { state.selection = undefined; state.review = undefined; state.material = undefined; state.order = [] }
  const remainingItems = () => state.selection && state.order.length ? state.items.flatMap((item) => {
    const selected = state.selection!.sectionRecordRefs.filter((section) => state.order.includes(section.sectionRef) && (section.sectionRef === item.id || (item.kind === "forecast-comparison" && item.sides.some((side) => section.sectionRef === `${item.id}:${side}`))))
    return selected.length ? [{ ...item, recordRefs: selected.flatMap((section) => section.recordRefs) }] : []
  }) : state.items
  const load = () => run("Loading authorized sources…", async () => {
    const items = remainingItems()
    const oldOrder = [...state.order]
    const selection = await client.agenda(items)
    if (selection.status !== "ok") { if (selection.status === "denied") clearRestricted(); state.message = `Selection unavailable: ${selection.reason}`; return }
    if (state.review) state.previousReviewRef = state.review.id
    state.review = undefined
    state.material = undefined
    state.items = items
    state.selection = selection.value
    state.order = oldOrder.length ? oldOrder.filter((ref) => selection.value.sectionRefs.includes(ref)) : [...selection.value.sectionRefs]
    state.message = "Review the selection, order and periods, then explicitly preserve it."
  })
  const removeRecord = (sectionId: string, recordRef: string) => run("Updating the authorized record selection…", async () => {
    if (!state.selection || state.review) return
    const items = state.items.flatMap((item) => {
      const selected = state.selection!.sectionRecordRefs.filter((section) => state.order.includes(section.sectionRef) && (section.sectionRef === item.id || (item.kind === "forecast-comparison" && item.sides.some((side) => section.sectionRef === `${item.id}:${side}`))))
      if (!selected.length) return []
      const recordRefs = selected.flatMap((section) => section.recordRefs.filter((ref) => section.sectionRef !== sectionId || ref !== recordRef))
      return [{ ...item, recordRefs }]
    })
    const result = await client.agenda(items)
    if (result.status !== "ok") { if (result.status === "denied") clearRestricted(); state.message = `Selection unavailable: ${result.reason}`; return }
    state.items = items
    state.selection = result.value
    state.order = state.order.filter((ref) => result.value.sectionRefs.includes(ref))
    state.message = "Selection refreshed from the authorized sources. Check the new counts and values before preserving."
  })
  const preserve = () => run("Preserving the selected review…", async () => {
    if (!state.selection || !state.order.length) return
    const result = await client.preserve({ selectionRef: state.selection.selectionRef, sectionRefs: state.order, ...(state.previousReviewRef ? { previousReviewRef: state.previousReviewRef } : {}) })
    if (result.status !== "ok") { if (result.status === "denied") clearRestricted(); state.message = result.status === "denied" ? "Access is no longer available. Reload your selection after access is restored." : `Review was not saved: ${result.reason}. Refresh or retry the selection.`; return }
    state.review = result.value
    state.order = result.value.sections.map((section) => section.id)
    state.message = "Review preserved. Source updates will not replace this meeting's captured values."
  })
  const report = (format: "pptx" | "docx") => run(`Generating ${format.toUpperCase()} from the preserved review…`, async () => {
    if (!state.review) return
    const result = await client.report({ reviewRef: state.review.id, sectionRefs: state.order, format })
    if (result.status !== "ok") { if (result.status === "denied") clearRestricted(); state.message = `Report unavailable: ${result.reason}. The preserved review was not modified.`; return }
    state.material = result.value
    state.message = "Report generated. Download access is checked again when opening the file."
  })
  const move = (index: number, offset: number) => {
    const other = index + offset
    if (other < 0 || other >= state.order.length) return
    const order = [...state.order]
    ;[order[index], order[other]] = [order[other]!, order[index]!]
    state.order = order
    render()
  }
  render()
  return { element: root, load, dispose: () => { disposed = true; clearRestricted(); root.replaceChildren() } }
}

/** Consumer of persisted resident outputs; every opening uses the current host authority. */
export function createReviewContributionView(input: {
  request: ReviewContributionRequest
  client?: ReturnType<typeof createReviewPreparationBrowser>
  openReview: (reviewRef: string) => void | Promise<void>
  openContribution: (outputRef: string) => void | Promise<void>
  openDecisionResult: (resultRef: string) => void | Promise<void>
}) {
  const client = input.client ?? createReviewPreparationBrowser()
  const request = structuredClone(input.request)
  const root = document.createElement("section")
  root.setAttribute("aria-label", "Review contribution")
  let generation = 0
  let disposed = false
  const text = (tag: "h2" | "h3" | "p" | "li", value: string) => {
    const element = document.createElement(tag)
    element.textContent = value
    return element
  }
  const unavailable = (reason: string) => {
    const rejectedAt = generation
    root.replaceChildren(text("p", `Contribution unavailable: ${reason}`), open("Retry access", () => { if (rejectedAt === generation) return refresh() }))
  }
  const open = (label: string, run: () => void | Promise<void>) => {
    const button = document.createElement("button")
    button.type = "button"
    button.textContent = label
    button.addEventListener("click", () => { void run() })
    return button
  }
  type Navigation = Extract<ReviewContribution["links"][number], { kind: "contribution" | "decision-result" | "review" }>
  const contains = (value: ReviewContribution, target: Navigation) => value.links.some((link) => {
    if (target.kind === "contribution") return link.kind === target.kind && link.outputRef === target.outputRef
    if (target.kind === "decision-result") return link.kind === target.kind && link.resultRef === target.resultRef
    return link.kind === target.kind && link.reviewRef === target.reviewRef && value.kind === "MeetingMaterialProposal" && value.review.id === target.reviewRef
  })
  const navigate = async (shown: ReviewContribution, target: Navigation, shownAt: number) => {
    if (disposed || shownAt !== generation) return
    const attempt = ++generation
    root.replaceChildren(text("p", "Checking access before opening the result…"))
    const result = await client.contribution({ ...request, expectedOutputDigest: shown.output.outputDigest }).catch(() => undefined)
    if (disposed || attempt !== generation) return
    if (!result || result.status !== "ok") { unavailable(result?.reason ?? "request-failed"); return }
    const current = result.value
    if (current.output.id !== request.outputRef || current.output.outputDigest !== shown.output.outputDigest || current.kind !== shown.kind || !contains(current, target)) { unavailable("contribution-changed"); return }
    render(current)
    try {
      if (target.kind === "contribution") await input.openContribution(target.outputRef)
      else if (target.kind === "decision-result") await input.openDecisionResult(target.resultRef)
      else await input.openReview(target.reviewRef)
    } catch {
      if (!disposed && attempt === generation) unavailable("destination-unavailable")
    }
  }
  const render = (value: ReviewContribution) => {
    const shownAt = generation
    root.replaceChildren(text("h2", value.kind === "DecisionBrief" ? "Decision brief" : "Meeting material"), text("p", `Reference: ${value.output.id}`))
    const provenance = document.createElement("details")
    provenance.setAttribute("aria-label", "Contribution provenance")
    const summary = document.createElement("summary")
    summary.textContent = "Contribution provenance"
    provenance.append(summary)
    const run = value.output.runProvenance
    ;[
      `Profile: ${run.profileId} · version ${run.profileVersion}`,
      `Skill: ${run.skillId} · version ${run.skillVersion}`,
      `Run: ${run.runId}`,
      `Session: ${run.nativeSessionId}`,
      `Model: ${run.actualModel}`,
      `State: ${value.output.state}`,
      `Created: ${value.output.createdAt}`,
      `Access revision: ${value.output.accessRevision}`,
      `Profile digest: ${run.profileDigest}`,
      `Skill source digest: ${run.sourceDigest}`,
      `Instructions digest: ${run.instructionsDigest}`,
      `Manifest digest: ${run.manifestDigest}`,
      `Output digest: ${value.output.outputDigest}`,
    ].forEach((line) => provenance.append(text("p", line)))
    provenance.append(text("h3", "Source evidence"))
    const sources = document.createElement("ul")
    value.output.evidenceRefs.forEach((ref) => sources.append(text("li", `${ref.kind} · ${ref.refId} · ${ref.evidenceLevel} · ${ref.refDigest}`)))
    provenance.append(value.output.evidenceRefs.length ? sources : text("p", "No source references supplied."))
    root.append(provenance)
    if (value.kind === "DecisionBrief") {
      root.append(text("h3", value.output.payload.objective))
      value.output.payload.conditions.forEach((condition) => root.append(text("p", `Condition: ${condition.reason}`)))
      if (value.output.payload.choiceRef) root.append(text("p", `Recorded human choice: ${value.output.payload.choiceRef}`))
      const list = document.createElement("ol")
      value.links.forEach((link) => {
        const row = text("li", "")
        row.append(open(link.kind === "contribution" ? `Open result ${link.outputRef}` : `Open decision result ${link.resultRef}`, () => navigate(value, link, shownAt)))
        list.append(row)
      })
      root.append(value.links.length ? list : text("p", "Proposed brief · No linked results."))
    } else {
      root.append(open("Open preserved meeting", () => navigate(value, { kind: "review", reviewRef: value.review.id }, shownAt)))
      value.output.payload.coverage.forEach((section) => root.append(text("p", `${section.sectionRef}: ${section.includedCount} of ${section.totalCount} selected records`)))
      value.output.payload.gaps.forEach((gap) => root.append(text("p", `Limitation: ${gap.reason}`)))
      value.artifacts.forEach((artifact) => {
        const href = client.downloadUrl(artifact.artifactRef)
        if (!href) { root.append(text("p", "Artifact download unavailable")); return }
        const link = document.createElement("a")
        link.href = href
        link.textContent = `Download ${artifact.format.toUpperCase()} · ${artifact.recordCount} records`
        root.append(link)
      })
    }
    root.append(open("Refresh access", () => { if (shownAt === generation) return refresh() }))
  }
  const refresh = async () => {
    if (disposed) return
    const attempt = ++generation
    root.replaceChildren(text("p", "Checking access to the preserved contribution…"))
    const result = await client.contribution(structuredClone(request)).catch(() => undefined)
    if (disposed || attempt !== generation) return
    if (!result || result.status !== "ok") { unavailable(result?.reason ?? "request-failed"); return }
    if (result.value.output.id !== request.outputRef || typeof result.value.output.outputDigest !== "string" || !result.value.output.outputDigest || (request.expectedOutputDigest && result.value.output.outputDigest !== request.expectedOutputDigest)) { unavailable("contribution-changed"); return }
    render(result.value)
  }
  root.append(text("p", "Open the contribution to check current access."))
  return { element: root, refresh, dispose: () => { disposed = true; generation++; root.replaceChildren() } }
}
