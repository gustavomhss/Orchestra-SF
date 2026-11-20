import { expect, test } from "bun:test"
import { randomUUID } from "node:crypto"
import { digestSfValue } from "../../../product/contracts/canonical.ts"
import { createSfHumanAuthority } from "../../../product/integration/human-authority.ts"
import { createSfUiAuthority } from "../../../product/integration/ui-authority.ts"
import { handleSfAnalysis } from "../../../product/interface/analysis-http.ts"
import type { TrustedUiContext } from "../../../product/contracts/sf-execution.ts"

// Boundary fixture: real UI/human lease registries, explicit test policy and a
// counted history port. The empty list does not claim any native run or receipt.
test("Workbench history rejects malformed case identity before human admission", async () => {
  const origin = "http://localhost"
  const identity = { installationId: "case-boundary-installation", projectId: "case-boundary-project",
    principalRef: "case-boundary-person", policyVersion: "case-boundary-policy", accessRevision: "case-boundary-access" }
  const ui = createSfUiAuthority({ privateCommands: ["sf-human:analysis.read"], createId: randomUUID, now: Date.now,
    commandIdentity: async (request, operation) => request.headers.get("idempotency-key")
      ? digestSfValue({ operation, key: request.headers.get("idempotency-key") }) : undefined,
    authorize: async (request, operation) => new URL(request.url).origin === origin && request.headers.get("origin") === origin &&
      operation === "sf-human:analysis.read" ? identity : undefined,
  })
  const human = createSfHumanAuthority({ origin, ui })
  const counts = { admissions: 0, lists: 0, finishes: 0 }
  const calls: TrustedUiContext[] = []
  const wanted = { id: "selected-case", incarnation: "selected-incarnation", version: 1 }
  const runtime: Parameters<typeof handleSfAnalysis>[2] = {
    ui, models: async () => [],
    human: { ...human,
      admit: async (...args) => { counts.admissions++; return human.admit(...args) },
      finish: (call) => { counts.finishes++; human.finish(call) },
    },
    analyses: {
      start: async () => { throw new Error("History boundary must not start a run") },
      read: async () => { throw new Error("History boundary must not read a run") },
      cancel: async () => { throw new Error("History boundary must not cancel a run") },
      output: async () => { throw new Error("History boundary must not read output") },
      list: async (call, selected) => {
        counts.lists++
        calls.push(call)
        expect(selected).toEqual(wanted)
        expect(await human.authorize(call, "analysis.read", { caseRef: wanted })).toBe(true)
        return { status: "ok", value: [] }
      },
    },
  }
  const post = (caseRef: unknown) => handleSfAnalysis(new Request(`${origin}/sucafina/dashboard?sf=workbench-analysis`, {
    method: "POST", headers: { origin, "content-type": "application/json", "idempotency-key": randomUUID() },
    body: JSON.stringify({ action: "list", caseRef }),
  }), origin, runtime)
  for (const caseRef of [
    { ...wanted, id: "" }, { ...wanted, id: " " }, { ...wanted, incarnation: "" }, { ...wanted, incarnation: " " },
    { ...wanted, version: -1 }, { ...wanted, version: 0 }, { ...wanted, version: 1.5 },
    { ...wanted, version: Number.MAX_SAFE_INTEGER + 1 }, { ...wanted, extra: true },
  ]) {
    const response = await post(caseRef)
    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({ status: "invalid" })
  }
  expect(counts).toEqual({ admissions: 0, lists: 0, finishes: 0 })
  const valid = await post(wanted)
  expect(valid.status).toBe(200)
  expect(await valid.json()).toEqual({ status: "ok", value: [] })
  expect(counts).toEqual({ admissions: 1, lists: 1, finishes: 1 })
  expect(calls).toHaveLength(1)
  expect(await ui.revalidate(calls[0]!)).toBe(false)
})
