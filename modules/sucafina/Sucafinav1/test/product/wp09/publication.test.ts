import { expect, test } from "bun:test"
import { listPublishedRoutineWorkflows } from "../../../product/routines/publication.ts"
import type { RoutinePublicationHost } from "../../../product/routines/publication.ts"
import type { TrustedDomainContext } from "../../../product/contracts/sf-execution.ts"

test("publication is not opened for a foreign project or revoked authority", async () => {
  const context = { binding: { projectId: "project" } } as TrustedDomainContext
  const host = { publication: { projectID: "other", use: () => { throw new Error("must not open") } }, authorize: async () => true } as unknown as RoutinePublicationHost
  expect(await listPublishedRoutineWorkflows(host, context)).toEqual({ status: "denied", reason: "publication-unavailable" })
  expect(await listPublishedRoutineWorkflows({ ...host, publication: { ...host.publication, projectID: "project" as typeof host.publication.projectID }, authorize: async () => false }, context)).toEqual({ status: "denied", reason: "publication-unavailable" })
})

import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { Effect } from "effect"
import { ProjectID } from "@orchestra/schema/project-id"
import { AuthoringGraph } from "@orchestra/relay/authoring/graph"
import { AuthoringStore } from "@orchestra/relay/authoring/store"
import { RelayWorkflowBinding } from "@orchestra/core/relay-workflow-binding"
import { acquireRoutineWorkflow, createRoutinePublicationCatalog } from "../../../product/routines/publication.ts"

test("real Relay publication supplies exact document and version; unpublished drafts cannot be acquired", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "sf-routine-publication-"))
  try {
    await Effect.runPromise(Effect.scoped(Effect.gen(function* () {
      const projectID = ProjectID.make("sf-test-project")
      const store = yield* AuthoringStore.open(dir, projectID)
      const graph = yield* AuthoringGraph.project("Review", { work_packages: [{ id: "prepare", instructions: "Prepare facts", checklist: [{ id: "check", cmd: "true" }] }] })
      const draft = yield* store.save({ body: graph })
      const port: RelayWorkflowBinding.PublicationPort = { projectID, use: (read) => read(store), skills: () => Effect.fail(new AuthoringGraph.Refusal({ status: 404, code: "skill-unavailable", message: "no skill" })), acceptance: [{ id: "package-verification", host_check: "package-verification" }, { id: "cold-review", host_check: "cold-review" }] }
      const context = { binding: { projectId: projectID } } as TrustedDomainContext
      const host = { publication: port, authorize: async () => true, authorSession: async () => undefined }
      const catalog = createRoutinePublicationCatalog({ host, resolvePlan: async (recipe) => recipe.documentId === draft.id && recipe.publishedVersion === draft.versionId ? { state: "ready", planRevisionId: "real-plan-ref", writeScope: ["scope"] } : { state: "excluded" } })
      expect((yield* Effect.promise(() => catalog("review", context)))).toEqual({ status: "ok", value: [] })
      const before = yield* Effect.promise(() => acquireRoutineWorkflow({ host, context, projectID, documentId: draft.id, parameters: {}, writePaths: ["scope"] }))
      expect(before.status).toBe("unavailable")
      yield* store.publish(draft.id, draft.versionId)
      const listed = yield* Effect.promise(() => catalog("review", context))
      expect(listed).toEqual({ status: "ok", value: [{ documentId: draft.id, publishedVersion: draft.versionId, title: "Review", planRevisionId: "real-plan-ref", writeScope: ["scope"] }] })
      const acquired = yield* Effect.promise(() => acquireRoutineWorkflow({ host, context, projectID, documentId: draft.id, parameters: {}, writePaths: ["scope"] }))
      expect(acquired.status).toBe("ok")
      if (acquired.status === "ok") expect(acquired.value.definition.publication).toMatchObject({ documentID: draft.id, activeVersionID: draft.versionId })
      yield* store.unpublish(draft.id)
      expect((yield* Effect.promise(() => acquireRoutineWorkflow({ host, context, projectID, documentId: draft.id, parameters: {}, writePaths: ["scope"] }))).status).toBe("unavailable")
    })))
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})
