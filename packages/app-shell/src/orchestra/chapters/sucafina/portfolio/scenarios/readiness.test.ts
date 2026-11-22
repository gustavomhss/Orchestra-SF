import { describe, expect, test } from "bun:test"
import type { SfContext } from "@orchestra/schema/sucafina/context"
import { sfPortfolioReady } from "./producer"

const read = { operationId: "decisions.controls.read", state: "ready", reason: null, operational: true } as const
const unavailable = { operationId: "decisions.decision-condition", state: "unavailable",
  reason: "operational-source-unavailable", operational: false } as const
type Availability = SfContext["availability"][number]

function context(state: Availability["state"], operations: Availability["operations"]): Pick<SfContext, "availability"> {
  return { availability: [{ family: "decisions", resource: "assumptions", state, operations }] }
}

describe("independently admitted portfolio operations", () => {
  test("accepts the exact ready operation in a fully ready resource", () => {
    expect(sfPortfolioReady(context("ready", [read]), read.operationId, "decisions")).toBe(true)
  })

  test("retains an admitted read when an unrelated sibling makes the resource partial", () => {
    expect(sfPortfolioReady(context("partial", [read, unavailable]), read.operationId, "decisions")).toBe(true)
  })

  test("does not turn a sibling readiness into permission for the unavailable operation", () => {
    expect(sfPortfolioReady(context("partial", [read, unavailable]), unavailable.operationId, "decisions")).toBe(false)
  })

  test("refuses explicit denial, unavailable sources, and missing operations", () => {
    const denied = { operationId: read.operationId, state: "denied", reason: "policy-denied", operational: false } as const
    expect(sfPortfolioReady(context("denied", [denied]), read.operationId, "decisions")).toBe(false)
    expect(sfPortfolioReady(context("unavailable", [unavailable]), unavailable.operationId, "decisions")).toBe(false)
    expect(sfPortfolioReady(context("partial", [read, unavailable]), "decisions.decision-criteria", "decisions")).toBe(false)
  })

  test("requires the requested family and an admitted aggregate state", () => {
    expect(sfPortfolioReady(context("ready", [read]), read.operationId, "portfolio")).toBe(false)
    expect(sfPortfolioReady(context("unavailable", [read]), read.operationId, "decisions")).toBe(false)
    expect(sfPortfolioReady({ availability: [] }, read.operationId, "decisions")).toBe(false)
  })

  test("also retains a ready portfolio read within a partial portfolio resource", () => {
    const value: Pick<SfContext, "availability"> = { availability: [{
      family: "portfolio", resource: "sensitivity", state: "partial",
      operations: [
        { operationId: "portfolio.decision-sensitivity-read", state: "ready", reason: null, operational: true },
        { operationId: "portfolio.decision-sensitivity-evaluate", state: "unavailable", reason: "source-unavailable", operational: false },
      ],
    }] }
    expect(sfPortfolioReady(value, "portfolio.decision-sensitivity-read", "portfolio")).toBe(true)
    expect(sfPortfolioReady(value, "portfolio.decision-sensitivity-evaluate", "portfolio")).toBe(false)
  })
})
