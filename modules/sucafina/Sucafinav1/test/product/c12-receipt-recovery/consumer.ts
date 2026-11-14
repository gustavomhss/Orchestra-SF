import { randomUUID } from "node:crypto"
import { htmlPolicy } from "../../../runtime/application.ts"
import { object } from "../../../runtime/contract.ts"
import { digestSfValue } from "../../../product/contracts/canonical.ts"
import { encodeCaseRef } from "../../../product/decisions/case-port.ts"
import { decisionApplyForms, decisionApplyScript } from "../../../product/ui/decision-apply.ts"
import { createC12Fixture, prepareC12Change } from "./fixture.ts"

/** H05's real services; only the time of the authorized competing edit is controlled. */
export async function createC12Consumer() {
  let fixture: Awaited<ReturnType<typeof createC12Fixture>> | undefined
  const traffic: { mode: string | null; body: string; key: string | null; status: number; result: Record<string, unknown> }[] = []
  const server = Bun.serve({ hostname: "127.0.0.1", port: 0, fetch: async (request) => {
    const current = fixture
    const url = new URL(request.url)
    if (!current) return new Response("Fixture unavailable", { status: 503 })
    if (url.pathname !== "/sf/procurement") return new Response("Not found", { status: 404 })
    if (request.method === "POST") {
      const body = await request.clone().text()
      const response = await current.application(request)
      if (!response) throw new Error("Real Procurement application did not handle its browser request")
      traffic.push({ mode: url.searchParams.get("sf"), body, key: request.headers.get("idempotency-key"), status: response.status, result: object(await response.clone().json()) })
      return response
    }
    if (request.method !== "GET" || url.search) return new Response("Not found", { status: 404 })
    const stored = await current.authority.state.read(request, "cases", (state) => state.cases[current.caseId])
    if (stored.status !== "ok" || !stored.value) return new Response("Case unavailable", { status: 403 })
    const input = { caseRef: encodeCaseRef(stored.value) }, inputDigest = digestSfValue(input)
    const admitted = await current.authority.ui.admit(request, "sf_case_read", inputDigest)
    if (admitted.status !== "ok") return new Response("Case unavailable", { status: 403 })
    try {
      if (!await current.authority.ui.validate(admitted.value, "sf_case_read", inputDigest)) return new Response("Case unavailable", { status: 403 })
      const projection = await current.business.cases.read(input, admitted.value)
      if (projection.status !== "ok" || !await current.authority.host.revalidate(admitted.value)) return new Response("Case unavailable", { status: 403 })
      const html = `<!doctype html><html lang="en"><head><title>C12 concurrent recovery</title></head><body><main><h1>Procurement</h1>${decisionApplyForms(projection.value)}</main><script>${decisionApplyScript}</script></body></html>`
      return new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8", "Content-Security-Policy": htmlPolicy(html), "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } })
    } finally { current.authority.ui.finish(admitted.value) }
  } })
  try {
    fixture = await createC12Fixture("I-OPS-02-H05", server.url.origin)
    const prepared = await prepareC12Change(fixture)
    return {
      url: `${server.url.origin}/sf/procurement`, prepared, traffic,
      current: () => { if (!fixture) throw new Error("Fixture closed"); return fixture },
      reopen: async () => {
        if (!fixture) throw new Error("Fixture closed")
        const retained = { directory: fixture.directory, caseId: fixture.caseId }
        await fixture.dispose(false)
        fixture = await createC12Fixture("I-OPS-02-reopen", server.url.origin, retained)
      },
      close: async () => { await server.stop(true); await fixture?.dispose(); fixture = undefined },
    }
  } catch (error) { await server.stop(true); await fixture?.dispose(); throw error }
}

export function interleaveC12CaseEdit(fixture: Awaited<ReturnType<typeof createC12Fixture>>) {
  fixture.afterReceiptCommit(() => editC12Case(fixture, "Concurrent authorized case edit"))
}

export async function editC12Case(fixture: Awaited<ReturnType<typeof createC12Fixture>>, objective: string) {
  const current = await fixture.storedCase()
  const changed = { ...current.value, version: current.value.version + 1, objective }
  const saved = await fixture.authority.state.transaction(fixture.request(), { namespace: "cases", expectedStorageVersion: current.storageVersion, targetRef: changed.id, targetIncarnation: changed.incarnation, idempotencyKey: randomUUID(), commandDigest: digestSfValue(changed) }, async (state) => {
    state.cases[changed.id] = changed
    return { commit: true, value: true }
  })
  if (saved.status !== "ok") throw new Error("Concurrent real case edit failed")
}

export async function observeC12(fixture: Awaited<ReturnType<typeof createC12Fixture>>) {
  const receipts = await fixture.authority.state.read(fixture.request(), "receipts", (state) => Object.values(state.receipts))
  if (receipts.status !== "ok") throw new Error("Authoritative receipt namespace unavailable")
  return { domain: await fixture.material(), decision: (await fixture.storedCase()).value, receipts: receipts.value }
}

