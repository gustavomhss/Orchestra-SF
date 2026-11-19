import type { Period, PreservedReview } from "../contracts/context.ts"
import type { PortResult } from "../contracts/ports.ts"
import type { MeetingMaterialProposal } from "../contracts/outputs.ts"
import { createReviewPreparationBrowser } from "./browser.ts"
import type { ReviewAgendaItem, ReviewAgendaPreview } from "./selection.ts"
import type { ReviewContribution, ReviewContributionRequest } from "./contribution.ts"
import type { RoutineReviewSelectionRequest } from "./routine-selection.ts"
import { createReviewAgendaPicker, reviewAgendaItemLabel, sameReviewAgendaItem } from "./agenda-picker.ts"
import type { ReviewAgendaDiscovery, ReviewAgendaOption } from "./agenda-picker.ts"

/** Mount from the host's existing Prepare review / Generate Report entry with authorized source selectors. */
export function createReviewPreparationView(input: {
  items: readonly ReviewAgendaItem[]
  previousReviewRef?: string
  routineResult?: RoutineReviewSelectionRequest
  discover?: ReviewAgendaDiscovery
  discoveryPeriod?: Period
  refreshItems?: (items: readonly ReviewAgendaItem[]) => Promise<PortResult<ReviewAgendaItem[]>>
  client?: ReturnType<typeof createReviewPreparationBrowser>
  openReview: (reviewRef: string) => void
  /** Notify the host only after an authorized result survives the current read generation. */
  onPrepared?: (previousReviewRef: string | undefined) => void
  onPreserved?: (reviewRef: string) => void
}) {
  const client = input.client ?? createReviewPreparationBrowser()
  const root = document.createElement("section")
  root.setAttribute("aria-label", "Prepare review")
  let disposed = false
  let revoked = false, generation = 0
  let pendingPreserve: Parameters<ReturnType<typeof createReviewPreparationBrowser>["preserve"]>[0] | undefined
  const state: { busy: boolean; message: string; selection?: ReviewAgendaPreview; selectionRef?: string; sectionRecordRefs?: ReviewAgendaPreview["sectionRecordRefs"]; order: string[]; items: ReviewAgendaItem[]; review?: PreservedReview; reviewRef?: string; material?: MeetingMaterialProposal; previousReviewRef?: string; routine?: RoutineReviewSelectionRequest } = { busy: false, message: "Load the authorized selection to prepare a review.", order: [], items: structuredClone([...input.items]), previousReviewRef: input.previousReviewRef, routine: input.routineResult ? structuredClone(input.routineResult) : undefined }
  const node = <K extends keyof HTMLElementTagNameMap>(tag: K, text: string) => {
    const element = document.createElement(tag)
    element.textContent = text
    return element
  }
  const action = (label: string, run: () => void | Promise<void>, disabled = false) => {
    const button = node("button", label)
    button.type = "button"
    button.disabled = state.busy || revoked || disabled
    button.addEventListener("click", () => { void run() })
    return button
  }
  const render = () => {
    if (disposed) return
    root.replaceChildren(node("h2", state.reviewRef ? "Preserved review" : "Prepare review"))
    const status = node("p", state.message)
    status.setAttribute("role", "status")
    status.setAttribute("aria-live", "polite")
    root.append(status)
    if (revoked) return
    if (!state.reviewRef && !state.routine && picker) {
      picker.update(); root.append(picker.element)
      const chosen = document.createElement("ol")
      chosen.setAttribute("aria-label", "Selected agenda")
      state.items.forEach((item, index) => {
        const title = reviewAgendaItemLabel(item), row = document.createElement("li")
        row.append(node("p", `${title} · ${item.kind} · ${item.period.start} – ${item.period.end}`))
        if (item.agendaNote) row.append(node("p", `Agenda note: ${item.agendaNote}`))
        row.append(action(`Move selected ${title} up`, () => moveItem(index, -1), index === 0 || !!pendingPreserve),
          action(`Move selected ${title} down`, () => moveItem(index, 1), index === state.items.length - 1 || !!pendingPreserve),
          action(`Remove selected ${title}`, () => editItems(remainingItems().filter((entry) => entry.id !== item.id)), !!pendingPreserve))
        chosen.append(row)
      })
      root.append(node("p", `${state.items.length} selected topics. Preview all sources before preserving.`), chosen)
    }
    if (!state.selection && !state.review && !state.reviewRef) {
      root.append(action(state.routine ? "Open routine result" : state.sectionRecordRefs ? "Refresh selection from current data" : "Load selection", state.routine ? () => openRoutineResult(state.routine!) : load, !!pendingPreserve || !state.routine && state.items.length === 0))
      if (pendingPreserve) root.append(action("Retry preserving this review", preserve))
      return
    }
    if (state.routine && (state.selection || state.review)) {
      root.append(node("p", "Captured routine result. Preserving this selection keeps its recorded values and rechecks access."))
      const provenance = document.createElement("details")
      provenance.append(node("summary", "Routine provenance"), node("p", `Run: ${state.routine.runRef}`), node("p", `Result: ${state.routine.resultRef}`), node("p", `Digest: ${state.routine.outputDigest}`))
      root.append(provenance)
    }
    if (state.reviewRef) {
      root.append(node("p", state.review ? `Reference: ${state.review.id} · Preserved: ${state.review.createdAt}` : `Reference: ${state.reviewRef} · Captured content is hidden until access is checked again.`))
      root.append(action("Open meeting", () => input.openReview(state.reviewRef!)))
      root.append(action("Generate PPTX", () => report("pptx")), action("Generate DOCX", () => report("docx")))
      if (state.items.length) root.append(action("Prepare current data as a new revision", load))
    } else {
      if (state.routine) root.append(action("Reopen the same routine result", () => openRoutineResult(state.routine!)))
      if (state.items.length) root.append(action("Refresh selection from current data", load, !!pendingPreserve))
    }
    const list = document.createElement("ol")
    state.order.forEach((id, index) => {
      const section = state.selection?.sections.find((entry) => entry.id === id)
      const captured = state.review?.sections.find((entry) => entry.id === id)
      if (!captured && !section) return
      const title = captured?.title ?? section!.title
      const period = captured?.period ?? section!.period
      const count = captured?.count ?? section!.recordCount
      const projection = captured?.content as (ReviewAgendaPreview["sections"][number]["projection"] & { reviewAgendaNote?: string }) | undefined
      const agendaNote = captured ? projection?.reviewAgendaNote : section!.agendaNote
      const row = document.createElement("li")
      row.append(node("h3", title), node("p", `${period.start} – ${period.end} · ${count} selected records`))
      row.append(node("p", `Section reference: ${id}`))
      const sources = (projection ?? section!.projection).context.sourceRefs
      sources.forEach((source) => row.append(node("p", `Source: ${source.surface} · ${source.type} · ${source.id} · version ${source.version} · incarnation ${source.incarnation}`)))
      if (count === 0) row.append(node("p", "No selected records in this section."))
      if (agendaNote) row.append(node("p", `Agenda note: ${agendaNote}`))
      if (!state.review && section) {
        row.append(action(`Move ${section.title} up`, () => move(index, -1), index === 0), action(`Move ${section.title} down`, () => move(index, 1), index === state.order.length - 1))
        row.append(action(`Remove ${section.title}`, () => { state.order = state.order.filter((ref) => ref !== id); state.items = remainingItems(); picker?.update(); render() }))
        const records = state.selection!.sectionRecordRefs.find((entry) => entry.sectionRef === id)?.recordRefs ?? []
        if (!state.routine) records.forEach((ref) => row.append(action(`Remove record ${ref}`, () => removeRecord(id, ref))))
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
      ;(projection ?? section!.projection).values.forEach((value) => {
        const line = document.createElement("tr")
        line.append(node("td", value.id), node("td", `${value.value === null ? "Unavailable" : String(value.value)} ${value.currency ?? value.unit ?? ""}`.trim()), node("td", `${value.period.start} – ${value.period.end}`))
        body.append(line)
      })
      table.append(body)
      row.append(table)
      const details = document.createElement("details")
      details.append(node("summary", "Components, evidence and limitations"))
      const selectedProjection = projection ?? section!.projection
      selectedProjection.components.forEach((component) => details.append(node("p", `${component.id}: ${component.amount === null ? "Unavailable" : component.amount} ${component.currency} · ${component.period.start} – ${component.period.end} · ${component.evidenceState}`)))
      selectedProjection.values.forEach((value) => details.append(node("p", `${value.id} · ${value.evidenceState} · Sources: ${value.sourceRefs.map((reference) => reference.refId).join(", ") || "No source reference"}`)))
      selectedProjection.missing.forEach((entry) => details.append(node("p", `${entry.field}: ${entry.reason}`)))
      row.append(details)
      if (!state.review && section?.comments?.length) {
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
    if (!state.reviewRef && state.selection) root.append(action("Preserve this review", preserve, state.order.length === 0))
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
  const run = async (message: string, work: (current: () => boolean) => Promise<void>) => {
    if (state.busy || disposed || revoked) return
    const turn = ++generation
    const current = () => !disposed && !revoked && turn === generation
    state.busy = true
    state.message = message
    render()
    try { await work(current) } catch { if (current()) { clearRestricted(); state.message = "The request failed. Your selected topics and order are retained; retry access when the service is available." } }
    if (!current()) return
    state.busy = false
    render()
  }
  // Recoverable failures retain human intent but hide captured values. Denial
  // additionally erases all selectors and notes, and fences pending responses.
  const clearRestricted = () => { state.selection = undefined; state.review = undefined; state.material = undefined }
  const itemPosition = (item: ReviewAgendaItem) => Math.min(...state.order.flatMap((ref, index) => ref === item.id || item.kind === "forecast-comparison" && item.sides.some((side) => ref === `${item.id}:${side}`) ? [index] : []))
  const remainingItems = () => state.sectionRecordRefs ? [...state.items].sort((a, b) => itemPosition(a) - itemPosition(b)).flatMap((item) => {
    const selected = state.sectionRecordRefs!.filter((section) => state.order.includes(section.sectionRef) && (section.sectionRef === item.id || (item.kind === "forecast-comparison" && item.sides.some((side) => section.sectionRef === `${item.id}:${side}`))))
    return selected.length ? [{ ...item, recordRefs: selected.flatMap((section) => section.recordRefs) }] : []
  }) : state.items
  const load = () => run("Loading authorized sources…", async (current) => {
    if (pendingPreserve) return
    let items = remainingItems()
    const oldOrder = [...state.order]
    if (state.reviewRef && input.refreshItems) {
      const refreshed = await input.refreshItems(items)
      if (!current()) return
      if (refreshed.status !== "ok") { reject(refreshed.status, refreshed.reason); return }
      items = refreshed.value
    }
    const selection = await client.agenda(items)
    if (!current()) return
    if (selection.status !== "ok") { reject(selection.status, selection.reason); return }
    if (state.reviewRef) state.previousReviewRef = state.reviewRef
    state.review = undefined
    state.reviewRef = undefined
    state.material = undefined
    state.items = items
    state.routine = undefined
    state.selection = selection.value
    state.selectionRef = selection.value.selectionRef
    state.sectionRecordRefs = structuredClone(selection.value.sectionRecordRefs)
    state.order = [...oldOrder.filter((ref) => selection.value.sectionRefs.includes(ref)), ...selection.value.sectionRefs.filter((ref) => !oldOrder.includes(ref))]
    state.message = "Review the selection, order and periods, then explicitly preserve it."
    input.onPrepared?.(state.previousReviewRef)
  })
  const openRoutineResult = (request: RoutineReviewSelectionRequest) => run("Opening the authorized routine result…", async (current) => {
    if (pendingPreserve) return
    const pin = structuredClone(request)
    const selection = await client.routine(pin)
    if (!current()) return
    if (selection.status === "denied") { revoke(); return }
    if (selection.status !== "ok") { clearRestricted(); state.selectionRef = undefined; state.sectionRecordRefs = undefined; state.reviewRef = undefined; state.order = []; state.routine = pin; state.message = `Routine result unavailable: ${selection.reason}. Retry access to the same result.`; return }
    state.selection = selection.value
    state.selectionRef = selection.value.selectionRef
    state.sectionRecordRefs = structuredClone(selection.value.sectionRecordRefs)
    state.routine = pin
    state.review = undefined
    state.reviewRef = undefined
    state.material = undefined
    state.previousReviewRef = selection.value.previousReviewRef
    state.order = [...selection.value.sectionRefs]
    state.message = "Review the captured result and choose the sections to preserve. The source values remain those recorded by this run."
    input.onPrepared?.(state.previousReviewRef)
  })
  const removeRecord = (sectionId: string, recordRef: string) => run("Updating the authorized record selection…", async (current) => {
    if (!state.selection || state.review) return
    const items = state.items.flatMap((item) => {
      const selected = state.selection!.sectionRecordRefs.filter((section) => state.order.includes(section.sectionRef) && (section.sectionRef === item.id || (item.kind === "forecast-comparison" && item.sides.some((side) => section.sectionRef === `${item.id}:${side}`))))
      if (!selected.length) return []
      const recordRefs = selected.flatMap((section) => section.recordRefs.filter((ref) => section.sectionRef !== sectionId || ref !== recordRef))
      return [{ ...item, recordRefs }]
    })
    state.items = items
    state.sectionRecordRefs = state.sectionRecordRefs?.map((section) => section.sectionRef === sectionId ? { ...section, recordRefs: section.recordRefs.filter((ref) => ref !== recordRef) } : section)
    const result = await client.agenda(items)
    if (!current()) return
    if (result.status !== "ok") { reject(result.status, result.reason); return }
    state.selection = result.value
    state.selectionRef = result.value.selectionRef
    state.sectionRecordRefs = structuredClone(result.value.sectionRecordRefs)
    state.order = state.order.filter((ref) => result.value.sectionRefs.includes(ref))
    state.items = remainingItems()
    state.message = "Selection refreshed from the authorized sources. Check the new counts and values before preserving."
  })
  const preserve = () => run("Preserving the selected review…", async (current) => {
    if (!state.selectionRef || !state.order.length) return
    pendingPreserve ??= { selectionRef: state.selectionRef, sectionRefs: [...state.order], ...(state.previousReviewRef ? { previousReviewRef: state.previousReviewRef } : {}) }
    const result = await client.preserve(structuredClone(pendingPreserve))
    if (!current()) return
    if (result.status !== "ok") { if (result.status !== "unavailable") pendingPreserve = undefined; reject(result.status, result.reason); return }
    pendingPreserve = undefined
    state.review = result.value
    state.reviewRef = result.value.id
    state.order = result.value.sections.map((section) => section.id)
    state.message = "Review preserved. Source updates will not replace this meeting's captured values."
    input.onPreserved?.(state.reviewRef)
  })
  const report = (format: "pptx" | "docx") => run(`Generating ${format.toUpperCase()} from the preserved review…`, async (current) => {
    if (!state.reviewRef) return
    const result = await client.report({ reviewRef: state.reviewRef, sectionRefs: state.order, format })
    if (!current()) return
    if (result.status === "denied") { revoke(); return }
    if (result.status !== "ok") { clearRestricted(); state.message = `Report unavailable: ${result.reason}. Captured content is hidden; the preserved review was not modified.`; return }
    state.material = result.value
    state.message = "Report generated. Download access is checked again when opening the file."
  })
  const move = (index: number, offset: number) => {
    const other = index + offset
    if (other < 0 || other >= state.order.length) return
    const order = [...state.order]
    ;[order[index], order[other]] = [order[other]!, order[index]!]
    state.order = order
    if (state.sectionRecordRefs) state.items = remainingItems()
    render()
  }
  const reject = (status: string, reason: string) => {
    if (status === "denied") { revoke(); return }
    clearRestricted()
    if (status === "stale" || status === "conflict" || status === "needs-input") { state.selectionRef = undefined; pendingPreserve = undefined }
    state.message = pendingPreserve ? `The save was not confirmed: ${reason}. Your selection is retained. Explicitly retry the same save to reconcile its result.` :
      `Selection unavailable: ${reason}. Your topics, records and order are retained. Discover and refresh changed sources, then preview and confirm again.`
  }
  const editItems = (items: ReviewAgendaItem[]) => {
    if (state.busy || revoked || disposed || pendingPreserve) return
    state.items = items; state.selectionRef = undefined; state.sectionRecordRefs = undefined; clearRestricted()
    state.order = state.order.filter((ref) => items.some((item) => ref === item.id || item.kind === "forecast-comparison" && item.sides.some((side) => ref === `${item.id}:${side}`)))
    state.message = "Your selection changed. Load the complete preview and check its references and periods before preserving."
    render()
  }
  const refreshItem = (option: ReviewAgendaOption) => {
    const items = remainingItems().map((item): ReviewAgendaItem => sameReviewAgendaItem(item, option.item) ? {
      ...structuredClone(option.item), id: item.id, ...(item.agendaNote ? { agendaNote: item.agendaNote } : {}),
      ...(item.threadIds ? { threadIds: item.threadIds } : {}), ...(item.biView ? { biView: item.biView } : {}), ...(item.outcome ? { outcome: item.outcome } : {}),
      ...(item.recordRefs !== undefined && (item.kind === "dashboard" || item.kind === "forecast-comparison") ? { recordRefs: item.recordRefs } : {}),
    } : item)
    editItems(items)
  }
  const moveItem = (index: number, offset: number) => {
    const items = remainingItems(), other = index + offset
    if (other < 0 || other >= items.length) return
    ;[items[index], items[other]] = [items[other]!, items[index]!]
    state.order = items.flatMap((item) => item.kind === "forecast-comparison" ? item.sides.map((side) => `${item.id}:${side}`) : [item.id])
    editItems(items)
  }
  const revoke = () => {
    revoked = true; generation++; pendingPreserve = undefined; state.busy = false
    clearRestricted(); state.items = []; state.order = []; state.sectionRecordRefs = undefined; state.selectionRef = undefined
    state.reviewRef = undefined; state.previousReviewRef = undefined; state.routine = undefined
    picker?.revoke(); state.message = "Access is no longer available. Private content and the selection were cleared. Reopen an authorized preparation."; render()
  }
  const picker = input.discover ? createReviewAgendaPicker({ discover: input.discover, period: input.discoveryPeriod ?? input.items[0]?.period,
    selected: () => state.items, busy: () => state.busy || !!pendingPreserve,
    add: (option) => editItems([...remainingItems(), structuredClone(option.item)]), refresh: refreshItem, denied: revoke }) : undefined
  window.addEventListener("sf-access-revoked", revoke)
  window.addEventListener("pagehide", revoke)
  render()
  return { element: root, load, openRoutineResult, revoke, dispose: () => { disposed = true; revoke(); picker?.dispose(); window.removeEventListener("sf-access-revoked", revoke); window.removeEventListener("pagehide", revoke); root.replaceChildren() } }
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

