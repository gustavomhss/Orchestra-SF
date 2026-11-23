import { expect, type Page } from "@playwright/test"
import type { SfInstallationDescriptor } from "@orchestra/schema/sucafina/context"
import { forwardOnce } from "../operations-support/runtime"

type Owner = Pick<SfInstallationDescriptor, "publicOrigin" | "mount" | "installationId" | "projectId" | "hostId">
export type OriginalRead = Readonly<{
  /** Exact producer path below the installed mount, such as /api/ui/pages/CAP20. */
  path: string
  /** Every specified selector must occur exactly once with this original value. */
  query?: Readonly<Record<string, string>>
  status?: number
  bodyStatus?: string
}>

/** Arm before the user action (or before delivering its real POST acknowledgement).
 * forwardOnce relays the existing producer unchanged, with its existing no-retry policy. */
export async function armOriginalRead(page: Page, owner: Owner, selection: OriginalRead) {
  if (!selection.path.startsWith("/") || /[?#]/.test(selection.path))
    throw new Error("An original read requires an exact mounted producer path")
  const started = performance.now()
  const read = await forwardOnce(page, (url) =>
    url.origin === owner.publicOrigin && url.pathname === owner.mount + selection.path &&
    Object.entries(selection.query ?? {}).every(([key, value]) =>
      url.searchParams.getAll(key).length === 1 && url.searchParams.get(key) === value), "GET")
  const completed = read.completed.then(async ({ response, request }) => {
    const body: unknown = await response.json()
    const object = body && typeof body === "object" && !Array.isArray(body)
      ? body as Record<string, unknown> : undefined
    console.info("SF_ORIGINAL_READ " + JSON.stringify({
      path: selection.path, selectors: Object.keys(selection.query ?? {}),
      mode: selection.query?.sf, status: response.status(), bodyStatus: object?.status,
      elapsedFromArmMs: performance.now() - started,
    }))
    expect(response.status(), "the exact original read HTTP status").toBe(selection.status ?? 200)
    expect(object?.status, "the exact original read body status").toBe(selection.bodyStatus ?? "ok")
    if ((selection.bodyStatus ?? "ok") === "ok" && selection.path.startsWith("/api/ui/pages/"))
      expect(object?.context, "the original page belongs to this installed owner").toMatchObject({
        installationId: owner.installationId, projectId: owner.projectId, hostId: owner.hostId,
      })
    return { response, request, body }
  })
  void completed.catch(() => undefined)
  return { completed, close: read.close }
}

/** Observe actual deliveries; the DOM assertions still follow every receipt. */
export async function originalReads<T>(
  page: Page, owner: Owner, selections: readonly OriginalRead[], action: () => Promise<T>,
) {
  if (!selections.length) throw new Error("At least one original read must be selected")
  const armed: Awaited<ReturnType<typeof armOriginalRead>>[] = []
  try {
    for (const selection of selections) armed.push(await armOriginalRead(page, owner, selection))
    const [receipts, result] = await Promise.all([
      Promise.all(armed.map((read) => read.completed)), action(),
    ])
    return { receipts, result }
  } finally {
    await Promise.all(armed.map((read) => read.close()))
  }
}

export async function originalRead<T>(
  page: Page, owner: Owner, selection: OriginalRead, action: () => Promise<T>,
) {
  const observed = await originalReads(page, owner, [selection], action)
  return { ...observed.receipts[0]!, result: observed.result }
}
