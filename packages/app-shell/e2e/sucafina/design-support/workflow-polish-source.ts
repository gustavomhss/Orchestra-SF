import { expect, type Page } from "@playwright/test"
import { enter } from "./wave-four"
import { waveFourDecisionsData } from "./wave-four-decisions-data"

export type WorkflowOwner = Parameters<typeof enter>[1]
export function sourceObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Expected an original source object")
  return value as Record<string, unknown>
}
export function sourceText(value: unknown): string {
  if (typeof value !== "string" || !value.trim()) throw new Error("Expected an original source reference")
  return value
}
export function sourceArray(value: unknown): unknown[] {
  if (!Array.isArray(value)) throw new Error("Expected an original source list")
  return value
}

export async function workflowCase(page: Page, owner: WorkflowOwner) {
  const read = async (reference?: string) => {
    const response = await page.request.get(owner.publicOrigin + owner.mount + "/dashboard", {
      params: { sf: "decision-controls", format: "json", ...(reference ? { case: reference } : {}) },
      maxRetries: 0,
    })
    expect(response.status()).toBe(200)
    const body = sourceObject(await response.json())
    expect(body.status).toBe("ok")
    return sourceObject(body.value)
  }
  const list = await read()
  const matches = sourceArray(list.cases).map(sourceObject).filter((item) => item.title === waveFourDecisionsData.objective)
  expect(matches).toHaveLength(1)
  const ref = sourceText(matches[0]!.ref)
  const selected = sourceObject((await read(ref)).selected)
  const identity = sourceObject(selected.caseRef)
  expect(identity.version).toEqual(expect.any(Number))
  expect(Number(identity.version)).toBeGreaterThan(0)
  const title = sourceText(matches[0]!.title)
  const decision = sourceObject(selected.decision)
  expect(decision).toMatchObject({ id: identity.id, incarnation: identity.incarnation, version: identity.version, objective: title })
  return { ref, title, id: sourceText(identity.id), incarnation: sourceText(identity.incarnation),
    version: Number(identity.version), selected }
}

/** Original leaf state must settle. A blocked producer is recorded as blocked, never promoted to ready. */
export async function settledSurface(page: Page, surface: string) {
  const leaf = page.locator("[data-sf-surface=" + JSON.stringify(surface) + "]")
  await expect(leaf).toHaveCount(1)
  await expect(leaf).toBeVisible()
  await expect(leaf.locator('[data-sf-state="loading"], [aria-busy="true"]')).toHaveCount(0, { timeout: 40_000 })
  await expect(leaf).not.toHaveAttribute("data-state", "loading")
  await expect(leaf).not.toHaveAttribute("data-sf-read-state", "loading")
  return leaf
}
