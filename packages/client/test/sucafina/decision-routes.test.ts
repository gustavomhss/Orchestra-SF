import { expect, test } from "bun:test"
import { SfDecisions } from "@orchestra/schema/sucafina/decisions"
import { SfOperationRegistry } from "@orchestra/schema/sucafina/operation-registry"
import { createSfContextClient } from "../../src/sucafina/context"
import { createSfDecisionsClient } from "../../src/sucafina/decisions"
import { SfNativeOperationBindings } from "../../src/sucafina/bindings"
import { createSfTransport, type SfCallOptions, type SfTransport, type SfTransportResult } from "../../src/sucafina/transport"

// Codec/HTTP boundary only: the refused probe response is not an installed
// authority, case, review or receipt. Product tests own those effects.
const dashboard = [
  "decisions.decision-promote",
  "decisions.decision-choose",
  "decisions.decision-edit",
  "decisions.choice.read",
  "decisions.command.sf_case_draft",
  "decisions.command.sf_change_prepare",
  "decisions.command.sf_question_prepare",
  "decisions.controls.read",
  "decisions.current-choice-prepare",
  "decisions.current-choice-promote",
  "decisions.decision-add-question",
  "decisions.decision-answer-question",
  "decisions.decision-condition",
  "decisions.decision-coverage",
  "decisions.decision-criteria",
  "decisions.decision-select-portfolio"
] as const
const procurement = [
  "decisions.decision-prepare-changes",
  "decisions.decision-review",
  "decisions.decision-apply",
  "decisions.decision-recover"
] as const
test("published Decisions envelopes retain their explicit original adapter", () => {
  const ids = [...dashboard, ...procurement]
  expect(ids).toHaveLength(20)
  expect(new Set(ids).size).toBe(20)
  expect(Object.keys(SfDecisions.operations).filter((id) => id.startsWith("decisions.")).sort()).toEqual([...ids].sort())
  for (const id of dashboard) expect(SfOperationRegistry[id].pathTemplate).toBe("{mount}/dashboard")
  for (const id of procurement) expect(SfOperationRegistry[id].pathTemplate).toBe("{mount}/procurement")
  expect(SfOperationRegistry["decisions.command.sf_case_draft"]).toMatchObject({
    method: "POST", effect: "prepare", maxRequestBytes: 65536,
    fixedQuery: { sf: "workbench-command" }, fixedBodyDiscriminator: { operation: "sf_case_draft" },
  })
  expect(SfOperationRegistry["decisions.decision-edit"]).toMatchObject({ method: "POST", effect: "mutation", maxRequestBytes: 262144 })
})

const caseRef = { id: "case", incarnation: "incarnation", version: 2 }
const reference = "case:case:incarnation"
const period = { start: "2027-01-01", end: "2027-12-31" }
const draft = { operation: "sf_case_draft" as const,
  input: { objective: "Reviewed decision", horizon: period, currency: "USD", criteria: ["Original criterion"], sourceRefs: [] } }
const question = { operation: "sf_question_prepare" as const,
  input: { caseRef: reference, question: { text: "Original question" }, sourceRefs: [] } }
const change = { operation: "sf_change_prepare" as const, input: { caseRef: reference, choiceRef: "choice", operations: [] } }
const edit = { caseRef, objective: "Reviewed revision", criteria: [{ id: "criterion", description: "Original criterion", required: true }],
  sourceRefs: [], horizon: period, currency: "USD" }
const selected = { caseRef, choiceId: "choice", changeId: "change" }
const reviewed = { ...selected, reviewDigest: "a".repeat(64) }
const prepare = { caseRef, choiceId: "choice", operations: [] }
const recover = { ...selected, purpose: "recover" as const }
const choice = { caseRef, choiceId: "choice", alternativeRef: { id: "alternative", version: 1 }, coverageRef: "coverage" }

const probes: ReadonlyArray<{
  url: string; method: "GET" | "POST"; mutating: boolean; payload?: Record<string, unknown>
  invoke: (t: SfTransport, options: SfCallOptions) => Promise<SfTransportResult<unknown>>
}> = [
  { url: "/sucafina/dashboard?sf=workbench-command", method: "POST", mutating: true, payload: draft,
    invoke: (t, o) => createSfDecisionsClient(t)["decisions.command.sf_case_draft"](draft, o) },
  { url: "/sucafina/dashboard?sf=workbench-command", method: "POST", mutating: true, payload: question,
    invoke: (t, o) => createSfDecisionsClient(t)["decisions.command.sf_question_prepare"](question, o) },
  { url: "/sucafina/dashboard?sf=workbench-command", method: "POST", mutating: true, payload: change,
    invoke: (t, o) => createSfDecisionsClient(t)["decisions.command.sf_change_prepare"](change, o) },
  { url: "/sucafina/dashboard?sf=decision-edit", method: "POST", mutating: true, payload: edit,
    invoke: (t, o) => createSfDecisionsClient(t)["decisions.decision-edit"](edit, o) },
  { url: "/sucafina/dashboard?sf=decision-controls&format=json&case=case%3Acase%3Aincarnation", method: "GET", mutating: false,
    invoke: (t, o) => createSfDecisionsClient(t)["decisions.controls.read"]({ case: reference }, o) },
  { url: "/sucafina/dashboard?sf=current-choice&format=json&case=case%3Acase%3Aincarnation", method: "GET", mutating: false,
    invoke: (t, o) => createSfDecisionsClient(t)["decisions.choice.read"]({ case: reference }, o) },
  { url: "/sucafina/dashboard?sf=current-choice-prepare", method: "POST", mutating: true, payload: choice,
    invoke: (t, o) => createSfDecisionsClient(t)["decisions.current-choice-prepare"](choice, o) },
  { url: "/sucafina/procurement?sf=decision-prepare-changes", method: "POST", mutating: true, payload: prepare,
    invoke: (t, o) => createSfDecisionsClient(t)["decisions.decision-prepare-changes"](prepare, o) },
  { url: "/sucafina/procurement?sf=decision-review", method: "POST", mutating: false, payload: selected,
    invoke: (t, o) => createSfDecisionsClient(t)["decisions.decision-review"](selected, o) },
  { url: "/sucafina/procurement?sf=decision-apply", method: "POST", mutating: true, payload: reviewed,
    invoke: (t, o) => createSfDecisionsClient(t)["decisions.decision-apply"](reviewed, o) },
  { url: "/sucafina/procurement?sf=decision-recover", method: "POST", mutating: true, payload: reviewed,
    invoke: (t, o) => createSfDecisionsClient(t)["decisions.decision-recover"](reviewed, o) },
  { url: "/sucafina/procurement?sf=decision-recover", method: "POST", mutating: true, payload: recover,
    invoke: (t, o) => createSfDecisionsClient(t)["decisions.decision-recover"](recover, o) },
]

test("case authoring, original reads and C12 send their unchanged closed request", async () => {
  const binding = { installationId: "installation", projectId: "project", hostId: "host",
    publicOrigin: "https://installation.example", mount: "/sucafina",
    authMode: "microsoft" as const, contractRevision: "sf-native-ui/1" as const }
  const stamp = { installationId: binding.installationId, projectId: binding.projectId, hostId: binding.hostId,
    principalRef: "person", policyVersion: "policy", accessRevision: "revision" }
  const previous = Object.getOwnPropertyDescriptor(globalThis, "window")
  Object.defineProperty(globalThis, "window", { configurable: true, value: { location: { origin: binding.publicOrigin } } })
  try {
    for (const probe of probes) {
      const calls: Array<{ url: string; init: RequestInit | undefined }> = []
      const transport = createSfTransport({
        binding, generation: 1, currentGeneration: () => 1, operations: SfNativeOperationBindings,
        fetch: async (url, init) => {
          if (new URL(String(url)).pathname === "/sucafina/api/ui/context")
            return Response.json({ status: "ok", value: {
              stamp, contractRevision: "sf-native-ui/1", authMode: "microsoft", destinations: [], availability: [],
            } })
          calls.push({ url: String(url), init })
          return Response.json({ status: "needs-input", reason: "source-probe" },
            { status: 400, headers: { "content-type": "application/json" } })
        },
      })
      const options = { signal: new AbortController().signal }
      expect((await createSfContextClient(transport)["ctx.context"]({
        installationId: binding.installationId, projectId: binding.projectId, hostId: binding.hostId,
      }, options)).kind).toBe("response")
      expect(await probe.invoke(transport, { ...options, ...(probe.mutating ? { idempotencyKey: "original-human-intent" } : {}) })).toEqual({
        kind: "response", status: 400, headers: { "content-type": "application/json" },
        body: { status: "needs-input", reason: "source-probe" },
      })
      expect(calls).toHaveLength(1)
      const request = calls[0]
      if (!request) throw new Error("Original HTTP request required")
      expect(request.url).toBe(binding.publicOrigin + probe.url)
      expect(request.init?.method).toBe(probe.method)
      expect(request.init?.credentials).toBe("same-origin")
      expect(request.init?.redirect).toBe("error")
      if (probe.payload) {
        if (typeof request.init?.body !== "string") throw new Error("Original JSON request required")
        expect(JSON.parse(request.init.body)).toEqual(probe.payload)
        expect(Object.hasOwn(JSON.parse(request.init.body), "surface")).toBe(false)
        if (probe.mutating) {
          const headers = new Headers(request.init.headers)
          expect(headers.get("Idempotency-Key")).toBe("original-human-intent")
          expect(headers.get("X-SF-Native-Owner")).toMatch(/^[A-Za-z0-9_-]+$/)
        }
      } else expect(request.init?.body).toBeUndefined()
    }
  } finally {
    if (previous) Object.defineProperty(globalThis, "window", previous)
    else Reflect.deleteProperty(globalThis, "window")
  }
})
