import { afterEach, expect, test } from "bun:test"
import type { DomainProjection, PreservedReview } from "../../../modules/sucafina/Sucafinav1/product/contracts/context.ts"
import type { MeetingMaterialProposal } from "../../../modules/sucafina/Sucafinav1/product/contracts/outputs.ts"
import type { PortResult } from "../../../modules/sucafina/Sucafinav1/product/contracts/ports.ts"
import type { ReviewAgendaPreview } from "../../../modules/sucafina/Sucafinav1/product/reviews/selection.ts"
import { createReviewPreparationBrowser } from "../../../modules/sucafina/Sucafinav1/product/reviews/browser.ts"
import { createReviewPreparationView } from "../../../modules/sucafina/Sucafinav1/product/reviews/workspace.ts"

const preserved = "Review preserved. Source updates will not replace this meeting's captured values."
const views: ReturnType<typeof createReviewPreparationView>[] = []
afterEach(() => { views.splice(0).forEach((view) => view.dispose()); document.body.replaceChildren() })
const rendered = () => new Promise<void>((resolve) => setTimeout(resolve, 0))

function fixture() {
  // DOM rendering scope only. These explicit client results do not prove domain authority or export bytes.
  const period = { start: "2027-01-01", end: "2027-12-31" }
  const projection: DomainProjection = { context: { installationId: "render", projectId: "render", principalRef: "render",
    accessRevision: "render", policyVersion: "render", surface: "dashboard", period, currency: "USD", sourceRefs: [], capabilities: [] },
    version: 1, engineVersion: "render", components: [], values: [], missing: [] }
  const selection: ReviewAgendaPreview = { selectionRef: "render-selection", sectionRefs: ["budget"], sectionRecordRefs: [{ sectionRef: "budget", recordRefs: [] }],
    sections: [{ id: "budget", title: "Budget", period, recordCount: 0, projection }], agendaNotes: [], gaps: [] }
  const saved: PreservedReview = { id: "render-review", version: 1, createdAt: "2026-11-19T00:00:00Z", sourceRefs: [], comments: [],
    sections: [{ id: "budget", title: "Budget", period, count: 0, content: projection, sourceRefs: [] }] }
  const saving = Promise.withResolvers<PortResult<PreservedReview>>()
  const reporting = Promise.withResolvers<PortResult<MeetingMaterialProposal>>()
  const prepared: (string | undefined)[] = [], confirmed: string[] = []
  const view = createReviewPreparationView({ items: [{ id: "budget", kind: "dashboard", topic: "budget", period, selectionRef: "render-selection", recordRefs: [] }],
    client: { ...createReviewPreparationBrowser(), agenda: async () => ({ status: "ok", value: structuredClone(selection) }),
      preserve: () => saving.promise, report: () => reporting.promise },
    openReview: () => {}, onPrepared: (reference) => prepared.push(reference), onPreserved: (reference) => confirmed.push(reference) })
  views.push(view); document.body.append(view.element)
  const indicator = () => view.element.querySelector("[data-preserved-review-ref]")
  const status = () => view.element.querySelector('[role="status"]')
  const click = (label: string) => {
    const button = [...view.element.querySelectorAll("button")].find((entry) => entry.textContent === label)
    expect(button).toBeDefined(); expect(button!.disabled).toBe(false); button!.click()
  }
  return { view, saved, saving, reporting, prepared, confirmed, indicator, status, click }
}

test("preserved identity remains visible through report progress and success without replacing operation status", async () => {
  const state = fixture()
  expect(state.indicator()).toBeNull()
  await state.view.load()
  expect(state.prepared).toEqual([undefined])
  state.click("Preserve this review")
  expect(state.indicator()).toBeNull()
  expect(state.confirmed).toEqual([])
  state.saving.resolve({ status: "ok", value: structuredClone(state.saved) })
  await rendered()
  expect(state.confirmed).toEqual([state.saved.id])
  expect(state.indicator()).toBe(state.status())
  expect(state.indicator()?.getAttribute("data-preserved-review-ref")).toBe(state.saved.id)
  expect(state.indicator()?.textContent).toBe(preserved)
  state.click("Generate DOCX")
  expect(state.status()?.textContent).toBe("Generating DOCX from the preserved review…")
  expect(state.indicator()).not.toBe(state.status())
  expect(state.indicator()?.textContent).toBe(preserved)
  state.reporting.resolve({ status: "ok", value: { reviewSelectionRef: state.saved.id,
    orderedResultRefs: ["report:" + "a".repeat(64)], coverage: [{ sectionRef: "budget", includedCount: 0, totalCount: 0 }], gaps: [] } })
  await rendered()
  expect(state.status()?.textContent).toBe("Report generated. Download access is checked again when opening the file.")
  expect(state.view.element.querySelectorAll("[data-preserved-review-ref]")).toHaveLength(1)
  expect(state.indicator()?.getAttribute("data-preserved-review-ref")).toBe(state.saved.id)
  expect(state.indicator()?.textContent).toBe(preserved)
  expect([...state.view.element.querySelectorAll("p")].filter((node) => node.textContent === preserved)).toHaveLength(1)
  await state.view.load()
  expect(state.prepared).toEqual([undefined, state.saved.id])
  expect(state.indicator()).toBeNull()
})

test("a report failure hides the confirmation with the captured values, and revocation keeps it absent", async () => {
  const state = fixture()
  await state.view.load(); state.click("Preserve this review")
  state.saving.resolve({ status: "ok", value: structuredClone(state.saved) })
  await rendered()
  expect(state.indicator()?.getAttribute("data-preserved-review-ref")).toBe(state.saved.id)
  state.click("Generate DOCX")
  state.reporting.resolve({ status: "unavailable", reason: "render-test-unavailable" })
  await rendered()
  expect(state.status()?.textContent).toContain("Captured content is hidden")
  expect(state.indicator()).toBeNull()
  state.view.revoke()
  expect(state.indicator()).toBeNull()
  expect(state.status()?.textContent).toContain("Access is no longer available")
})

test("revocation fences a late preserve response and never publishes its confirmation or callback", async () => {
  const state = fixture()
  await state.view.load(); state.click("Preserve this review")
  state.view.revoke()
  state.saving.resolve({ status: "ok", value: structuredClone(state.saved) })
  await rendered()
  expect(state.indicator()).toBeNull()
  expect(state.confirmed).toEqual([])
  expect(state.status()?.textContent).toContain("Access is no longer available")
})

test("revocation removes an already confirmed review indicator", async () => {
  const state = fixture()
  await state.view.load(); state.click("Preserve this review")
  state.saving.resolve({ status: "ok", value: structuredClone(state.saved) })
  await rendered()
  expect(state.indicator()?.getAttribute("data-preserved-review-ref")).toBe(state.saved.id)
  state.view.revoke()
  expect(state.indicator()).toBeNull()
  expect(state.status()?.textContent).toContain("Access is no longer available")
})
