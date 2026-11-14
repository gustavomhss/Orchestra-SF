import { expect, test } from "bun:test"
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { Effect } from "effect"
import { AuthoringGraph } from "@orchestra/relay/authoring/graph"
import { AuthoringStore } from "@orchestra/relay/authoring/store"
import { ProjectID } from "@orchestra/schema/project-id"
import { AppNodeBuilder } from "@orchestra/core/effect/app-node-builder"
import { LayerNode } from "@orchestra/core/effect/layer-node"
import { Location } from "@orchestra/core/location"
import { LocationServiceMap } from "@orchestra/core/location-service-map"
import { RelayWorkflowBinding } from "@orchestra/core/relay-workflow-binding"
import { AbsolutePath } from "@orchestra/core/schema"
import { createSfRoutineServices } from "../../../../../../../apps/cli/src/sucafina-product/routine-services.ts"
import { createSfRoutinePublicationContribution } from "../../../../../../../apps/cli/src/sucafina-product/routine-publication.ts"
import type { SfRoutineNativePort, SfRoutineNativeRecord, SfRoutinePlan, SfRoutineServicesInput } from "../../../../../../../apps/cli/src/sucafina-product/routine-services.ts"
import { acquireRoutineWorkflow } from "../../../../product/routines/publication.ts"
import type { RoutinePublicationHost } from "../../../../product/routines/publication.ts"
import { routineArtifactDigest, routineInputDigest } from "../../../../product/routines/result-access.ts"
import type { RoutineAdmittedInput, RoutineArtifact, RoutineExecutionSnapshot } from "../../../../product/routines/result-access.ts"
import { createRoutineUiFixture } from "../../wp09/ui-authority-fixture.ts"

const caseRef = { id: "case", incarnation: "incarnation", version: 1 }

test("routine host registers every producer descriptor and refuses absent native admission explicitly", async () => {
  const ui = await createRoutineUiFixture("project", "person")
  const service = createSfRoutineServices({
    authority: {
      revalidateDomainContext: (call) => call.kind === "ui" ? ui.authority.revalidate(call) : Promise.resolve(false),
      receiptFor: (call, operation, digest, resultDigest) => call.kind === "ui" ? ui.authority.receiptFor(call, operation, digest, resultDigest) : undefined,
    },
    resolveCase: async () => ({ status: "ok", value: caseRef }), resolveInputs: async () => ({ status: "ok", value: [] }), revalidateSources: async () => true,
  })
  expect(service.descriptors.map((descriptor) => descriptor.id)).toEqual([
    "sf_routine_catalog", "sf_routine_prepare", "sf_routine_run", "sf_routine_status", "sf_routine_result", "sf_watch_prepare",
  ])
  expect(await service.routines.catalog("review", ui.context)).toEqual({ status: "unavailable", reason: "routine-publication-port-unavailable" })
  expect(await service.routines.prepareAdmission({ publishedRecipeRef: "recipe", planRevisionId: "plan", writeScope: [], inputRefs: [], parameters: {} }, ui.context))
    .toEqual({ status: "unavailable", reason: "native-routine-admission-port-unavailable" })
  expect(await service.routines.run({ admissionRef: "invented", expectedAdmissionVersion: 1, caseRef }, ui.context))
    .toEqual({ status: "unavailable", reason: "native-routine-execution-port-unavailable" })
  ui.authority.finish(ui.context)
  expect((await service.routines.readRun("invented", ui.context)).status).toBe("denied")
})

// Real publication store and real UI registry; native C07 I/O is an explicit boundary fixture, not GNATIVE acceptance.
test("routine host consumes pinned publication and native receipts without promoting a reference to completion", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "sf-wp10-routines-"))
  try {
    await Effect.runPromise(Effect.scoped(Effect.gen(function* () {
      const projectID = ProjectID.make("wp10-routine-project")
      const store = yield* AuthoringStore.open(directory, projectID)
      const graph = yield* AuthoringGraph.project("Factual review", { work_packages: [{ id: "facts", instructions: "Prepare authorized facts", checklist: [{ id: "check", cmd: "true" }] }] })
      const draft = yield* store.save({ body: graph })
      yield* store.publish(draft.id, draft.versionId)
      yield* Effect.promise(async () => {
        const ui = await createRoutineUiFixture(projectID, "person")
        const port: RelayWorkflowBinding.PublicationPort = { projectID, use: (read) => read(store),
          skills: () => Effect.fail(new AuthoringGraph.Refusal({ status: 404, code: "unused-skill", message: "Fixture has no authoring skills" })),
          acceptance: [{ id: "package-verification", host_check: "package-verification" }, { id: "cold-review", host_check: "cold-review" }] }
        const publication: RoutinePublicationHost = { publication: port, authorize: (call) => call.kind === "ui" ? ui.authority.revalidate(call) : Promise.resolve(false), authorSession: async () => undefined }
        const admitted: RoutineAdmittedInput = { publishedRecipeRef: draft.id, publishedVersion: draft.versionId, planRevisionId: "native-plan",
          writeScope: [], inputRefs: [], parameters: {}, principalRef: "person", projectId: projectID, caseRef }
        const plan: SfRoutinePlan = { documentId: draft.id, publishedVersion: draft.versionId, planRevisionId: admitted.planRevisionId,
          writeScope: [], workflowParameters: {}, inputDigest: routineInputDigest(admitted) }
        const acquired = await acquireRoutineWorkflow({ host: publication, context: ui.context, projectID, documentId: draft.id,
          expectedPublishedVersion: draft.versionId, parameters: {}, writePaths: [] })
        if (acquired.status !== "ok") throw new Error(acquired.reason)
        const state: { native?: SfRoutineNativePort; record: SfRoutineNativeRecord; starts: number; execution: RoutineExecutionSnapshot; artifact?: RoutineArtifact } = {
          record: { input: admitted, inputDigest: plan.inputDigest, workflow: acquired.value.definition,
            result: { documentId: draft.id, publishedVersion: draft.versionId, principalRef: "person", projectId: projectID,
              admission: "admitted", admissionRef: "native-admission", admissionVersion: 1, correlationId: "native-correlation", sourceRefs: [], pending: [], authorizationId: "native-authorization", armRef: "native-arm" } },
          starts: 0, execution: { runRef: "native-run", state: "preparing", revision: "native-revision-1" },
        }
        const native: SfRoutineNativePort = {
          resolvePlan: async () => ({ status: "ok", value: plan }), resolveRecipe: async () => ({ status: "ok", value: plan }),
          prepare: async () => ({ status: "ok", value: state.record }), readAdmission: async () => ({ status: "ok", value: state.record }),
          readRun: async () => ({ status: "ok", value: state.record }), listRunRefs: async () => ({ status: "ok", value: ["native-run"] }),
          start: async () => { state.starts++; state.record = { ...state.record, result: { ...state.record.result, runRef: "native-run", childSessionId: "native-child" } }; return { status: "ok", value: state.record } },
          readExecution: async () => ({ status: "ok", value: state.execution }),
          readArtifact: async () => state.artifact ? { status: "ok", value: state.artifact } : { status: "unavailable", reason: "native-artifact-absent" },
        }
        const dependencies: SfRoutineServicesInput = {
          publication: () => publication, native: () => state.native,
          authority: { revalidateDomainContext: publication.authorize,
            receiptFor: (call, operation, digest, resultDigest) => call.kind === "ui" ? ui.authority.receiptFor(call, operation, digest, resultDigest) : undefined },
          resolveCase: async () => ({ status: "ok", value: caseRef }), resolveInputs: async () => ({ status: "ok", value: [] }), revalidateSources: async () => true,
        }
        const service = createSfRoutineServices(dependencies)
        expect(await service.routines.catalog("review", ui.context)).toEqual({ status: "needs-input", reason: "published-workflow-plan-required" })
        state.native = native
        expect(await service.routines.catalog("review", ui.context)).toMatchObject({ status: "ok", value: [{ documentId: draft.id, publishedVersion: draft.versionId, planRevisionId: "native-plan" }] })
        const request = { publishedRecipeRef: admitted.publishedRecipeRef, planRevisionId: admitted.planRevisionId, writeScope: admitted.writeScope, inputRefs: admitted.inputRefs, parameters: admitted.parameters }
        expect((await service.routines.prepareAdmission(request, ui.context)).status).toBe("ok")
        expect(await service.routines.prepareAdmission({ ...request, parameters: { changed: true } }, ui.context))
          .toEqual({ status: "needs-input", reason: "native-routine-plan-input-mismatch" })
        expect((await service.routines.run({ admissionRef: "native-admission", expectedAdmissionVersion: 2, caseRef }, ui.context)).status).toBe("stale")
        expect(state.starts).toBe(0)
        expect((await service.routines.run({ admissionRef: "native-admission", expectedAdmissionVersion: 1, caseRef }, ui.context)).status).toBe("ok")
        expect(state.starts).toBe(1)
        state.record = { ...state.record, result: { ...state.record.result, resultRef: "native-result" } }
        expect(await service.resultAccess.readResult("native-run", ui.context)).toEqual({ status: "needs-input", reason: "result-not-ready" })
        const body: Omit<RoutineArtifact, "outputDigest"> = { schema: "sf-routine-artifact-v1", runRef: "native-run", resultRef: "native-result",
          correlationId: "native-correlation", documentId: draft.id, publishedVersion: draft.versionId, principalRef: "person", projectId: projectID,
          inputDigest: plan.inputDigest, sourceRefs: [], content: { facts: [{ count: 3 }], narrative: null }, createdAt: "2026-11-14T12:00:00Z" }
        state.artifact = { ...body, outputDigest: routineArtifactDigest(body) }
        state.execution = { runRef: "native-run", state: "completed", resultRef: "native-result", revision: "native-terminal", outputDigest: state.artifact.outputDigest }
        expect(await service.readArtifact("native-result", ui.context)).toMatchObject({ status: "ok", value: { content: body.content } })
        state.execution = { ...state.execution, outputDigest: "f".repeat(64) }
        expect(await service.readArtifact("native-result", ui.context)).toEqual({ status: "unavailable", reason: "routine-artifact-unverified" })
        state.record = { ...state.record, inputDigest: "a".repeat(64) }
        expect(await service.routines.readRun("native-run", ui.context)).toEqual({ status: "unavailable", reason: "native-routine-input-unverified" })
        ui.authority.finish(ui.context)
        expect((await service.routines.readRun("native-run", ui.context)).status).toBe("denied")
      })
    })))
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
})

test("routine publication uses the existing Location graph and revokes retained ports on disposal", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "sf-wp10-publication-"))
  try {
    const location = Location.Ref.make({ directory: AbsolutePath.make(directory) })
    const state: { placement?: { projectId: string; location: Location.Ref } } = {}
    const publication = createSfRoutinePublicationContribution({ identity: () => state.placement, authorize: async () => true })
    expect(publication.publication()).toBeUndefined()
    const layer = AppNodeBuilder.build(LayerNode.group([publication.node, LocationServiceMap.node]))
    const retained = await Effect.runPromise(Effect.gen(function* () {
      const locations = yield* LocationServiceMap.Service
      const placed = yield* Location.Service.pipe(Effect.provide(locations.get(location)))
      state.placement = { projectId: placed.project.id, location }
      const host = publication.publication()
      if (!host) throw new Error("Expected graph-scoped publication")
      expect(host.publication.projectID).toBe(placed.project.id)
      expect(publication.publication()).toBe(host)
      expect(Array.isArray(yield* RelayWorkflowBinding.catalog(host.publication))).toBe(true)
      return host
    }).pipe(Effect.provide(layer), Effect.scoped))
    expect(publication.publication()).toBeUndefined()
    const read = await Effect.runPromise(Effect.result(retained.publication.use(() => Effect.succeed("must-not-read"))))
    expect(read._tag).toBe("Failure")
    if (read._tag === "Failure") expect(read.failure).toMatchObject({ reason: "SF_ROUTINE_PUBLICATION_DISPOSED" })
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
})
