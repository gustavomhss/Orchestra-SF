import type { PreservedReview } from "../contracts/context.ts"
import type { MeetingMaterialProposal } from "../contracts/outputs.ts"
import { createReviewPreparationBrowser } from "./browser.ts"
import type { ReviewAgendaItem, ReviewAgendaPreview } from "./selection.ts"
import type { ReviewContributionRequest } from "./contribution.ts"

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
      const row = document.createElement("li")
      row.append(node("h3", section.title), node("p", `${section.period.start} – ${section.period.end} · ${section.recordCount} selected records`))
      if (section.recordCount === 0) row.append(node("p", "No selected records in this section."))
      if (section.agendaNote) row.append(node("p", `Agenda note: ${section.agendaNote}`))
      if (!state.review) {
        row.append(action(`Move ${section.title} up`, () => move(index, -1), index === 0), action(`Move ${section.title} down`, () => move(index, 1), index === state.order.length - 1))
        row.append(action(`Remove ${section.title}`, () => { state.order = state.order.filter((ref) => ref !== id); render() }))
        const records = state.selection!.sectionRecordRefs.find((entry) => entry.sectionRef === id)?.recordRefs ?? []
        records.forEach((ref) => row.append(action(`Remove record ${ref}`, () => removeRecord(id, ref))))
      }
      const table = document.createElement("table")
      table.append(node("caption", `${section.title} · selected source values`))
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
      const projection = state.review?.sections.find((entry) => entry.id === id)?.content as typeof section.projection | undefined
      ;(projection ?? section.projection).values.forEach((value) => {
        const line = document.createElement("tr")
        line.append(node("td", value.id), node("td", `${value.value === null ? "Unavailable" : String(value.value)} ${value.currency ?? value.unit ?? ""}`.trim()), node("td", `${value.period.start} – ${value.period.end}`))
        body.append(line)
      })
      table.append(body)
      row.append(table)
      if (section.comments?.length) {
        row.append(node("h4", "Captured comments — separate from current conversation"))
        section.comments.forEach((comment) => row.append(node("p", `${comment.authorRef} · ${comment.createdAt} · version ${comment.version}: ${comment.content}`)))
      }
      list.append(row)
    })
    root.append(list)
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
  const load = () => run("Loading authorized sources…", async () => {
    const selection = await client.agenda(state.items)
    if (selection.status !== "ok") { if (selection.status === "denied") clearRestricted(); state.message = `Selection unavailable: ${selection.reason}`; return }
    if (state.review) state.previousReviewRef = state.review.id
    state.review = undefined
    state.material = undefined
    state.selection = selection.value
    state.order = [...selection.value.sectionRefs]
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
  openReview: (reviewRef: string) => void
  openContribution: (outputRef: string) => void
  openDecisionResult: (resultRef: string) => void
}) {
  const client = input.client ?? createReviewPreparationBrowser()
  const root = document.createElement("section")
  root.setAttribute("aria-label", "Review contribution")
  let generation = 0
  let disposed = false
  const text = (tag: "h2" | "h3" | "p" | "li", value: string) => {
    const element = document.createElement(tag)
    element.textContent = value
    return element
  }
  const refresh = async () => {
    const attempt = ++generation
    root.replaceChildren(text("p", "Checking access to the preserved contribution…"))
    const result = await client.contribution(input.request).catch(() => undefined)
    if (disposed || attempt !== generation) return
    if (!result || result.status !== "ok") {
      root.replaceChildren(text("p", `Contribution unavailable: ${result?.reason ?? "request-failed"}`))
      return
    }
    const value = result.value
    const open = (label: string, run: () => void) => {
      const button = document.createElement("button")
      button.type = "button"
      button.textContent = label
      button.addEventListener("click", run)
      return button
    }
    root.replaceChildren(text("h2", value.kind === "DecisionBrief" ? "Decision brief" : "Meeting material"), text("p", `Reference: ${value.output.id}`))
    if (value.kind === "DecisionBrief") {
      root.append(text("h3", value.output.payload.objective))
      value.output.payload.conditions.forEach((condition) => root.append(text("p", `Condition: ${condition.reason}`)))
      if (value.output.payload.choiceRef) root.append(text("p", `Recorded human choice: ${value.output.payload.choiceRef}`))
      const list = document.createElement("ol")
      value.links.forEach((link) => {
        const row = text("li", "")
        row.append(link.kind === "contribution" ? open(`Open result ${link.outputRef}`, () => input.openContribution(link.outputRef)) : open(`Open decision result ${link.resultRef}`, () => input.openDecisionResult(link.resultRef)))
        list.append(row)
      })
      root.append(list)
    } else {
      root.append(open("Open preserved meeting", () => input.openReview(value.review.id)))
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
    root.append(open("Refresh access", () => { void refresh() }))
  }
  root.append(text("p", "Open the contribution to check current access."))
  return { element: root, refresh, dispose: () => { disposed = true; generation++; root.replaceChildren() } }
}
