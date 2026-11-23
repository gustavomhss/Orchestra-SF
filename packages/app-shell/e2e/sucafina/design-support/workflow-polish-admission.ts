import { expect, type Page, type TestInfo } from "@playwright/test"
import { Schema } from "effect"
import { SfContextResult } from "@orchestra/schema/sucafina/context"
import { ServerConnection } from "../../../src/context/server-connection"
import { capture, scheme } from "./wave-three"
import type { WorkflowOwner } from "./workflow-polish-source"

export type WorkflowRequirement = Readonly<{ operationId: string; family?: string; resource?: string }>

/** Read the original F01 result. Missing operational evidence never becomes a grant. */
export async function readWorkflowAdmission(
  page: Page, owner: WorkflowOwner, info: TestInfo, surface: string,
  required: readonly WorkflowRequirement[],
) {
  const query = new URLSearchParams({
    installationId: owner.installationId, projectId: owner.projectId, hostId: owner.hostId,
  })
  const response = await page.request.get(owner.publicOrigin + owner.mount + "/api/ui/context?" + query, { maxRetries: 0 })
  expect(response.status()).toBe(200)
  const result = Schema.decodeUnknownSync(SfContextResult)(await response.json())
  expect(result.status).toBe("ok")
  if (result.status !== "ok") throw new Error("The original installed context did not admit this owner")
  expect(result.value.stamp).toMatchObject({
    installationId: owner.installationId, projectId: owner.projectId, hostId: owner.hostId,
  })
  const requirements = required.map((requirement) => {
    const resources = result.value.availability.filter((resource) =>
      (!requirement.family || resource.family === requirement.family) &&
      (!requirement.resource || resource.resource === requirement.resource) &&
      resource.operations.some((operation) => operation.operationId === requirement.operationId))
    expect(resources.length, requirement.operationId + " must have an original catalog observation").toBeGreaterThan(0)
    const observations = resources.flatMap((resource) => resource.operations
      .filter((operation) => operation.operationId === requirement.operationId)
      .map((operation) => ({ family: resource.family, resource: resource.resource, resourceState: resource.state, ...operation })))
    return { ...requirement, resources, observations, ready: observations.some((operation) => operation.state === "ready" && operation.operational) }
  })
  const proof = { surface, stamp: result.value.stamp, requirements,
    ready: requirements.every((requirement) => requirement.ready) }
  await info.attach(surface + "-original-route-admission", {
    contentType: "application/json", body: JSON.stringify(proof, null, 2),
  })
  return proof
}

/** A host refusal is evidence of the native boundary, never of a rendered leaf or successful workflow. */
export async function captureWorkflowRefusal(
  page: Page, owner: WorkflowOwner, info: TestInfo, path: string, surface: string,
  proof: Awaited<ReturnType<typeof readWorkflowAdmission>>,
) {
  expect(proof.surface).toBe(surface)
  expect(proof.ready).toBe(false)
  expect(proof.requirements.some((requirement) => !requirement.ready)).toBe(true)
  const target = new URL(path, owner.publicOrigin)
  target.searchParams.set("server", ServerConnection.key({ type: "http", http: { url: target.origin } }))
  target.searchParams.set("project", owner.projectId)
  target.searchParams.set("installation", owner.installationId)
  expect((await page.goto(target.href))?.status()).toBe(200)
  const host = page.locator('[data-sf-host="owner-runtime231"]')
  const verify = async () => {
    await expect(host).toHaveCount(1)
    await expect(host).toHaveAttribute("data-sf-discovery-state", "ready")
    await expect(host).toHaveAttribute("data-sf-provider-state", "ready")
    await expect(host).toHaveAttribute("data-sf-view-state", "denied")
    const refusal = host.locator('[data-sf-f01="not-admitted"]')
    await expect(refusal).toHaveCount(1)
    if (surface === "UI64" || surface === "UI66") {
      await expect(refusal).toHaveAttribute("data-sf-route-unavailable", surface)
      await expect(refusal.getByRole("status")).toBeVisible()
    } else {
      await expect(refusal.getByRole("alert").locator(".sf-state-title")).toHaveText("This page is unavailable in the current context. Refresh access or return to Today.")
      await expect(refusal.getByRole("button", { name: "Try again", exact: true })).toBeVisible()
      await expect(refusal.getByRole("button", { name: "Return to Today", exact: true })).toBeVisible()
    }
    await expect(host.locator("[data-sf-surface]")).toHaveCount(0)
    await expect(host.locator('[data-sf-frame="page"]')).toHaveCount(1)
    await expect(host.locator('[aria-busy="true"]')).toHaveCount(0)
    await expect(page).toHaveURL(target.href)
  }
  await verify()
  await info.attach(surface + "-native-host-refusal-scope", {
    contentType: "application/json",
    body: JSON.stringify({ surface, path, source: "original isolated installed producer",
      state: "native-host-refusal", leafRendered: false, leafVisualApprovalClaimed: false,
      syntheticSuccess: false, liveMicrosoftClaimed: false, requirements: proof.requirements }, null, 2),
  })
  const viewport = page.viewportSize()
  const color = await page.locator("html").getAttribute("data-color-scheme")
  for (const variant of [
    { scheme: "dark", width: 1440, height: 1100, name: "dark-desktop" },
    { scheme: "light", width: 1440, height: 1100, name: "light-desktop" },
    { scheme: "dark", width: 320, height: 800, name: "dark-320" },
  ] as const) {
    if ((page.viewportSize()?.width ?? 1440) < 768) await page.setViewportSize({ width: 1440, height: 1100 })
    await scheme(page, variant.scheme)
    await page.setViewportSize({ width: variant.width, height: variant.height })
    await verify()
    await expect.poll(() => page.evaluate(() =>
      document.documentElement.scrollWidth - document.documentElement.clientWidth),
    { message: "the original native refusal does not overflow horizontally" }).toBeLessThanOrEqual(1)
    await capture(page, info, surface + "-native-host-refusal-" + variant.name)
  }
  if (color === "dark" || color === "light") {
    if ((page.viewportSize()?.width ?? 1440) < 768) await page.setViewportSize({ width: 1440, height: 1100 })
    await scheme(page, color)
  }
  if (viewport) await page.setViewportSize(viewport)
}
