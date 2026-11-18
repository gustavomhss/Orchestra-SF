import { describe, expect, test } from "bun:test"
import { requestValue } from "../src/procurement-screen.ts"

const rates = { currency: "USD", fxRates: [{ code: "EUR", rate: 1.08 }] }

describe("procurement estimate fallback before PO approval", () => {
  test.each(["draft", "pr_pending", "pr_rejected", "sourcing", "src_pending", "src_rejected", "po_draft", "po_pending", "po_rejected"])(
    "%s does not use unapproved PO lines when there is no selected quote",
    (status) => {
      expect(requestValue({
        status,
        createdBy: "requester",
        pr: { estAmount: 131 },
        sourcing: { quotes: [], selectedId: null },
        po: { lines: [{ qty: 3, unitPrice: 333 }] },
      }, rates)).toBe(131)
    },
  )

  test("missing quote and missing estimate remains no value despite unapproved lines", () => {
    expect(requestValue({
      status: "po_draft",
      createdBy: "requester",
      pr: { estAmount: null },
      sourcing: { quotes: [], selectedId: null },
      po: { lines: [{ qty: 3, unitPrice: 333 }] },
    }, rates)).toBeNull()
  })
})
