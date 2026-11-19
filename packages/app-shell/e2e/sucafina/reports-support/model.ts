import { expect } from "@playwright/test"
import type { APIRequestContext, APIResponse, Request, Response } from "@playwright/test"
import type { DomainProjection, PreservedReview } from "../../../../../modules/sucafina/Sucafinav1/product/contracts/context.ts"
import type { ReviewAgendaPreview } from "../../../../../modules/sucafina/Sucafinav1/product/reviews/selection.ts"

const originalResponses = new WeakMap<Request, Readonly<{ status: number; body: string }>>()

/** Retain only the same producer response that the route delivers to this browser request. */
export async function retainReportResponse(request: Request, original: APIResponse) {
  originalResponses.set(request, { status: original.status(), body: await original.text() })
}

export function observedReportResponse(response: Response): unknown {
  const original = originalResponses.get(response.request())
  expect(original, "The exact browser request must have its original producer response").toBeDefined()
  if (!original) throw new Error("REPORTS_ORIGINAL_RESPONSE_NOT_OBSERVED")
  expect(response.status()).toBe(original.status)
  return JSON.parse(original.body) as unknown
}

export function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Expected a JSON object from the real product")
  return value as Record<string, unknown>
}

export function text(value: unknown): string {
  if (typeof value !== "string" || !value.trim()) throw new Error("Expected a nonempty product reference")
  return value
}

export function projection(value: unknown): DomainProjection {
  const result = object(value)
  expect(Array.isArray(result.values)).toBe(true)
  expect(Array.isArray(object(result.context).sourceRefs)).toBe(true)
  return result as DomainProjection
}

export function review(value: unknown): PreservedReview {
  const result = object(value)
  text(result.id)
  expect(Number.isSafeInteger(result.version)).toBe(true)
  expect(Array.isArray(result.sections)).toBe(true)
  expect(Array.isArray(result.comments)).toBe(true)
  return result as PreservedReview
}

export async function agendaResult(response: Response): Promise<ReviewAgendaPreview> {
  expect(response.status(), "Real review-agenda mount must succeed").toBe(200)
  const result = object(observedReportResponse(response))
  expect(result.status).toBe("ok")
  const value = object(result.value)
  text(value.selectionRef)
  expect(Array.isArray(value.sections)).toBe(true)
  expect(Array.isArray(value.sectionRefs)).toBe(true)
  expect(Array.isArray(value.sectionRecordRefs)).toBe(true)
  return value as ReviewAgendaPreview
}

export function productURL(mount: string, mode: string, parameters: Record<string, string> = {}) {
  const url = new URL(mount)
  url.search = ""
  url.hash = ""
  url.searchParams.set("sf", mode)
  Object.entries(parameters).forEach(([key, value]) => url.searchParams.set(key, value))
  return url
}

export async function readReview(request: APIRequestContext, mount: string, reference: string) {
  const response = await request.get(productURL(mount, "review-read", { reviewRef: reference }).href, { maxRedirects: 0 })
  expect(response.status()).toBe(200)
  expect(response.headers()["cache-control"]).toContain("no-store")
  const body = object(await response.json())
  expect(body.status).toBe("ok")
  const value = review(body.value)
  expect(value.id).toBe(reference)
  return value
}

export function responseFor(mount: string, mode: string, method: string) {
  const expected = productURL(mount, mode)
  return (response: Response) => {
    const actual = new URL(response.url())
    return actual.origin === expected.origin && actual.pathname === expected.pathname &&
      actual.searchParams.get("sf") === mode && response.request().method() === method
  }
}
