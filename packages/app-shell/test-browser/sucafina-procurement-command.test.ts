import { describe, expect, test } from "bun:test"
import { createRenderEffect, createRoot } from "solid-js"
import { createStore, unwrap } from "solid-js/store"
import { SfNativeOperationBindings } from "@orchestra/client/sucafina/bindings"
import { poFromRecord, prFromRecord, type SfRequest } from "../src/orchestra/chapters/sucafina/procurement/requests/model"
import { editableSourcing } from "../src/orchestra/chapters/sucafina/procurement/sourcing/model"

import { procurementCommandSnapshot } from "../src/orchestra/chapters/sucafina/procurement/command-snapshot"

const source: SfRequest = {
  number: "PR-2026-0001", status: "draft", createdBy: "test-operator",
  pr: { title: "Source-owned title", type: "service", description: "Recorded scope", estAmount: null, recurring: false },
}

describe("procurement drafts at the original JSON command boundary", () => {
  test("an incomplete PR omits absent fields and keeps null, false and the W19 title boundary", () => {
    const pr = prFromRecord(source)
    expect(Object.hasOwn(pr, "frequency")).toBe(false)
    expect(Object.hasOwn(pr, "estAnnual")).toBe(false)
    expect(Object.hasOwn(pr, "title")).toBe(false)
    expect(pr.estAmount).toBeNull()
    expect(pr.recurring).toBe(false)
    expect(SfNativeOperationBindings["domain.command.CAP25.save"]!.decodeInput({
      page: "Requests", action: "save", id: source.number, version: 1, values: { pr },
    }).status).toBe("ok")
  })

  test("the new-request draft accepts the real create codec with zero and empty text", () => {
    const pr = { ...prFromRecord(), title: "New request", estAmount: 0, description: "" }
    expect(SfNativeOperationBindings["domain.command.CAP25.create"]!.decodeInput({
      page: "Requests", action: "create", version: 0, values: { pr },
    }).status).toBe("ok")
    expect(pr.estAmount).toBe(0)
    expect(pr.description).toBe("")
  })

  test("PO fields and line metadata cross the real codec without manufacturing absent values", () => {
    const po = poFromRecord({ ...source, status: "po_draft", po: {
      currency: "USD", supplierId: null,
      lines: [{ id: "line-1", desc: "Recorded line", qty: 1, unitPrice: 0, notes: "Retained note" }],
    } })
    expect(Object.hasOwn(po, "warranty")).toBe(false)
    expect(po.supplierId).toBeNull()
    expect(po.lines?.[0]).toEqual({ id: "line-1", desc: "Recorded line", qty: 1, unitPrice: 0, notes: "Retained note" })
    expect(SfNativeOperationBindings["domain.command.CAP25.save"]!.decodeInput({
      page: "Requests", action: "save", id: source.number, version: 2, values: { po },
    }).status).toBe("ok")
  })

  test("sourcing preserves quote metadata and omits absent optional scalar and criteria fields", () => {
    const sourcing = editableSourcing({ ...source, status: "sourcing", sourcing: {
      selectedId: null,
      quotes: [{ id: "quote-1", total: null, description: "Retained description", notes: "Retained note", techPass: false }],
      weights: { tech: 0, criteria: [{ id: "criterion-1", name: "Recorded criterion", weight: 0 }] },
    } })
    expect(Object.hasOwn(sourcing, "evaluator")).toBe(false)
    expect(Object.hasOwn(sourcing.weights!, "commCriteria")).toBe(false)
    expect(sourcing.selectedId).toBeNull()
    expect(sourcing.quotes?.[0]).toEqual({
      id: "quote-1", total: null, description: "Retained description", notes: "Retained note", techPass: false,
    })
    expect(SfNativeOperationBindings["domain.command.CAP25.save"]!.decodeInput({
      page: "Requests", action: "save", id: source.number, version: 3, values: { sourcing },
    }).status).toBe("ok")
  })
  test("a tracked Solid review yields stable plain PR and nested PO values before hashing", () => {
    createRoot((dispose) => {
      try {
        const [state, setState] = createStore({ review: {
          pr: prFromRecord(source),
          po: poFromRecord({ ...source, status: "po_draft", po: {
            currency: "USD", lines: [{ id: "line-1", qty: 1, unitPrice: 0, notes: "Before review" }],
          } }),
        } })
        createRenderEffect(() => { Object.values(state.review.pr); Object.values(state.review.po.lines![0]!) })
        setState("review", "pr", "description", "Reviewed scope")
        setState("review", "po", "lines", 0, "notes", "Reviewed line")
        expect(unwrap(state.review.pr)).not.toBe(state.review.pr)
        const captured = procurementCommandSnapshot(state.review)
        const serialized = JSON.stringify(captured)
        setState("review", "pr", "description", "Later edit")
        setState("review", "po", "lines", 0, "notes", "Later line edit")
        expect(JSON.stringify(captured)).toBe(serialized)
        expect(captured.pr.description).toBe("Reviewed scope")
        expect(captured.po.lines?.[0]?.notes).toBe("Reviewed line")
        expect(Reflect.ownKeys(captured.pr).every((key) => typeof key === "string")).toBe(true)
        expect(Reflect.ownKeys(captured.po.lines![0]!).every((key) => typeof key === "string")).toBe(true)
        for (const values of [{ pr: captured.pr }, { po: captured.po }])
          expect(SfNativeOperationBindings["domain.command.CAP25.save"]!.decodeInput({
            page: "Requests", action: "save", id: source.number, version: 1, values,
          }).status).toBe("ok")
      } finally { dispose() }
    })
  })

  test("a tracked policy draft is copied without relaxing the original settings codec", () => {
    createRoot((dispose) => {
      try {
        const [state] = createStore({ settings: { currency: "USD", reminderDays: 0, categories: ["Services"] } })
        createRenderEffect(() => { Object.values(state.settings); Object.values(state.settings.categories) })
        expect(unwrap(state.settings)).not.toBe(state.settings)
        const settings = procurementCommandSnapshot(state.settings)
        expect(settings).toEqual({ currency: "USD", reminderDays: 0, categories: ["Services"] })
        expect(SfNativeOperationBindings["domain.command.CAP28.save"]!.decodeInput({
          page: "Settings", action: "save", version: 1, values: { settings },
        }).status).toBe("ok")
      } finally { dispose() }
    })
  })

  test("the DTO copy keeps excess fields and explicit undefined visible to the strict codec", () => {
    for (const extra of [{ unexpected: "not admitted" }, { frequency: undefined }]) {
      const pr = procurementCommandSnapshot({ ...prFromRecord(source), ...extra })
      expect(Object.hasOwn(pr, Object.keys(extra)[0]!)).toBe(true)
      expect(SfNativeOperationBindings["domain.command.CAP25.save"]!.decodeInput({
        page: "Requests", action: "save", id: source.number, version: 1, values: { pr },
      }).status).toBe("invalid")
    }
  })

})
