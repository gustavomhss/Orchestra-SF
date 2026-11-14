import { expect, test } from "bun:test"
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { Effect } from "effect"
import { ProjectID } from "@orchestra/schema/project-id"
import { AuthoringStore } from "@orchestra/relay/authoring/store"
import { AuthoringGraph } from "@orchestra/relay/authoring/graph"
import { RelayWorkflowBinding } from "@orchestra/core/relay-workflow-binding"
import { listRoutineRecipes, publishRoutineRecipe } from "../../../product/routines/recipes.ts"
import type { RoutineRecipePublisher } from "../../../product/routines/recipes.ts"
import { acquireRoutineWorkflow } from "../../../product/routines/publication.ts"
import type { TrustedDomainContext } from "../../../product/contracts/sf-execution.ts"

test("five linear product recipes publish and materialize exact versions in the real Relay store", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "sf-wp09-recipes-"))
  try {
    await Effect.runPromise(Effect.scoped(Effect.gen(function* () {
      const projectID = ProjectID.make("wp09-recipe-project")
      const store = yield* AuthoringStore.open(directory, projectID)
      const context = { kind: "ui", binding: { projectId: projectID, principalRef: "publisher" } } as TrustedDomainContext
      const publisher: RoutineRecipePublisher = { projectID, use: (work) => work(store), authorize: async () => true }
      const publication: RelayWorkflowBinding.PublicationPort = { projectID, use: (work) => work(store), skills: () => Effect.fail(new AuthoringGraph.Refusal({ status: 404, code: "unused-skill", message: "Recipes contain no authoring skill indirection" })), acceptance: [{ id: "package-verification", host_check: "package-verification" }, { id: "cold-review", host_check: "cold-review" }] }
      const recipes = listRoutineRecipes()
      expect(recipes).toHaveLength(5)
      expect((yield* store.documents())).toHaveLength(0)
      for (const recipe of recipes) {
        const published = yield* Effect.promise(() => publishRoutineRecipe({ recipeId: recipe.id, context, host: publisher }))
        if (published.status !== "ok") throw new Error(published.reason)
        const retry = yield* Effect.promise(() => publishRoutineRecipe({ recipeId: recipe.id, context, host: publisher }))
        expect(retry).toEqual(published)
        const acquired = yield* Effect.promise(() => acquireRoutineWorkflow({
          host: { publication, authorize: async () => true, authorSession: async () => undefined }, context, projectID,
          documentId: published.value.documentId, expectedPublishedVersion: published.value.publishedVersion, parameters: { sourceRef: "authorized-input-ref" }, writePaths: [],
        }))
        if (acquired.status !== "ok") throw new Error(acquired.reason)
        expect(acquired.value.definition.publication).toMatchObject({ documentID: published.value.documentId, activeVersionID: published.value.publishedVersion })
        expect(acquired.value.sprint.work_packages.map((entry) => entry.id)).toEqual(recipe.sprint.work_packages.map((entry) => entry.id))
        expect(acquired.value.sprint.work_packages.every((entry) => entry.kind === "execute" && !entry.checklist?.some((check) => check.cmd || check.judge))).toBe(true)
        expect(acquired.value.sprint.work_packages.flatMap((entry) => entry.checklist ?? []).every((check) => check.host_check === "package-verification" || check.host_check === "cold-review")).toBe(true)
      }
      expect((yield* store.documents())).toHaveLength(5)
      const selected = recipes[0]!
      const original = yield* store.get(`sf-routine-${selected.id}-1-0-0`)
      const changed = yield* AuthoringGraph.project("Changed recipe", { ...selected.sprint, brief: "Different immutable content" })
      yield* store.save({ id: original.id, body: changed, expectedVersion: original.versionId })
      expect(yield* Effect.promise(() => publishRoutineRecipe({ recipeId: selected.id, context, host: publisher }))).toEqual({ status: "conflict", reason: "recipe-version-content-conflict" })
      expect((yield* store.get(original.id)).activeVersionId).toBe(original.activeVersionId)
    })))
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
})

test("recipe publication needs explicit current UI authority and never runs during discovery", async () => {
  const projectID = ProjectID.make("wp09-recipe-project")
  const context = { kind: "native", binding: { projectId: projectID, principalRef: "publisher" } } as TrustedDomainContext
  const host: RoutineRecipePublisher = { projectID, use: () => { throw new Error("Must not open publication store") }, authorize: async () => true }
  expect(await publishRoutineRecipe({ recipeId: "prepare-review", context, host })).toEqual({ status: "denied", reason: "recipe-publication-denied" })
  const ui = { kind: "ui", binding: { projectId: projectID, principalRef: "publisher" } } as TrustedDomainContext
  expect(await publishRoutineRecipe({ recipeId: "prepare-review", context: ui, host: { ...host, authorize: async () => false } })).toEqual({ status: "denied", reason: "recipe-publication-denied" })
  const first = listRoutineRecipes()
  first[0]!.title = "Changed by caller"
  expect(listRoutineRecipes()[0]!.title).toBe("Preparar revisão")
})
