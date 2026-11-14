import { describe, expect, test } from "bun:test"
import { readFile } from "node:fs/promises"
import { preparePlan } from "../../../../../../script/sf2h/native-acceptance/plan.ts"
import { inspectCapture, requireNativeCaptureSource } from "../../../../../../script/sf2h/native-acceptance/capture.ts"
import { captureTemplate, requireExecutionGate } from "../../../../../../script/sf2h/native-acceptance/execution.ts"
import { buildWorkbenchAnalysisRequest, createInstalledSfProofAdapter } from "../../../../../../script/sf2h/native-acceptance/installed-host.ts"
import { object, rows } from "../../../../../../script/sf2h/native-acceptance/schema.ts"

// Deterministic harness checks only. No principal, grants, provider, native
// Session, database, scanner, model, host constructor or AM outcome is fabricated.
const directory = new URL("../../../../../../script/sf2h/native-acceptance/", import.meta.url)
const coverage = object(JSON.parse(await readFile(new URL("coverage.json", directory), "utf8")))
const pinned = JSON.parse(await readFile(new URL("pinned-am-proofs.json", directory), "utf8"))
const observedWp00 = "0a5ce33012d008af1f56d11596a1f1f4eaba5b9d"
const observedTree = "a627a2deff7f5d74e35a8b9afef06fa0f67362bd"

describe("native acceptance preparation preserves mandatory scope", () => {
  test("both AM definition layers and 5/18/8/39 remain in the finite plan", () => {
    const plan = preparePlan(coverage, pinned)
    expect(plan.counts).toMatchObject({ profiles: 5, skills: 18, packs: 8, operations: 39, proofDefinitions: 12 })
    expect(plan.nativeAccepted).toBe(false)
    expect(plan.candidateC).toBeNull()
    expect(plan.checks.some((row) => row.sourcePointer.endsWith("negative_discriminator"))).toBe(true)
    expect(plan.checks.filter((row) => row.operationId && row.kind === "positive")).toHaveLength(39)
  })

  test("merging duplicate AM ids into a single definition cannot hide negative checks", () => {
    const changed = structuredClone(coverage)
    changed.proof_definitions = rows(changed.proof_definitions, "proofs").slice(0, 6)
    expect(() => preparePlan(changed, pinned)).toThrow("Pinned proof definitions")
  })

  test("changing a pinned expected outcome cannot turn a failure green", () => {
    const changed = structuredClone(coverage)
    rows(changed.proof_definitions, "proofs")[2]!.checks = ["accept anything"]
    expect(() => preparePlan(changed, pinned)).toThrow("Pinned proof definitions")
  })

  test("catalogue without a positive operation route does not satisfy AM02", () => {
    const changed = structuredClone(coverage)
    changed.operation_call_routes = rows(changed.operation_call_routes, "routes").slice(1)
    expect(() => preparePlan(changed, pinned)).toThrow("39 positive routes")
  })

  test("C16 route cannot substitute missing SkillLoadReceipt with discovery", () => {
    const changed = structuredClone(coverage)
    rows(changed.operation_call_routes, "routes")[0]!.requires_loaded_skill_receipt = false
    expect(() => preparePlan(changed, pinned)).toThrow("Route cannot pass C16")
  })

  test("removing the last skill grant leaves the operation unreachable", () => {
    const changed = structuredClone(coverage)
    const route = rows(changed.operation_call_routes, "routes")[0]!
    const skill = rows(changed.skills, "skills").find((row) => row.id === route.skill_id)!
    skill.allowed_operations = (skill.allowed_operations as string[]).filter((operation) => operation !== route.operation_id)
    expect(() => preparePlan(changed, pinned)).toThrow("Route cannot pass C16")
  })

  test("unresolved input template and empty execution are incomplete captures", () => {
    const plan = preparePlan(coverage, pinned, observedWp00)
    const result = inspectCapture(plan, coverage, captureTemplate(plan))
    expect(result.status).toBe("INCOMPLETE")
    expect(result.nativeAccepted).toBe(false)
    expect(result.problems.some((reason) => reason.startsWith("18 skills:"))).toBe(true)
    expect(result.problems.some((reason) => reason.startsWith("39 routes:"))).toBe(true)
    expect(result.problems.some((reason) => reason.startsWith("reviewer independence:"))).toBe(true)
  })

  test("fixture metadata cannot qualify native receipts", () => {
    expect(() => requireNativeCaptureSource({ execution: "fixture" })).toThrow("Fixture/provider/principal/grants are not native proof")
  })
})

describe("finite execution and installed host boundary", () => {
  test("missing S0 acceptance verifier blocks final execution before an adapter call", async () => {
    const plan = preparePlan(coverage, pinned, observedWp00)
    await expect(requireExecutionGate({ plan, installedCommit: observedWp00, installedTree: observedTree, mode: "final" })).rejects.toThrow("NEEDS_HOST")
  })

  test("an explicit refusal by S0 does not become final acceptance", async () => {
    const plan = preparePlan(coverage, pinned, observedWp00)
    await expect(requireExecutionGate({ plan, installedCommit: observedWp00, installedTree: observedTree, mode: "final",
      verifyAcceptedCandidate: async () => undefined })).rejects.toThrow("no accepted C")
  })

  test("a preparation plan with no candidate cannot execute even a preproof", async () => {
    await expect(requireExecutionGate({ plan: preparePlan(coverage, pinned), installedCommit: observedWp00,
      installedTree: observedTree, mode: "preproof" })).rejects.toThrow("candidate C")
  })

  test("no installed services means NEEDS_HOST without a fixture constructor", async () => {
    await expect(createInstalledSfProofAdapter({ services: () => undefined }).discover()).rejects.toThrow("NEEDS_HOST")
  })

  test("a request description without an authenticated owner transport cannot send", async () => {
    const request = buildWorkbenchAnalysisRequest({ origin: "https://preparation.example.invalid", mount: "/sucafina", surface: "planner",
      idempotencyKey: "descriptor-only-001", body: { action: "choices" } })
    await expect(createInstalledSfProofAdapter({ services: () => undefined }).callWorkbenchAnalysis(request)).rejects.toThrow("NEEDS_HOST")
    expect(request.url).toBe("https://preparation.example.invalid/sucafina/planner?sf=workbench-analysis")
  })

  test("credential-bearing URL and traversal cannot select another authority surface", () => {
    const request = { origin: "https://preparation.example.invalid", mount: "/sucafina", surface: "planner" as const,
      idempotencyKey: "descriptor-only-002", body: { action: "choices" as const } }
    expect(() => buildWorkbenchAnalysisRequest({ ...request, origin: "https://user@preparation.example.invalid" })).toThrow("ORIGIN_INVALID")
    expect(() => buildWorkbenchAnalysisRequest({ ...request, mount: "/sucafina/../other" })).toThrow("MOUNT_INVALID")
  })
})
