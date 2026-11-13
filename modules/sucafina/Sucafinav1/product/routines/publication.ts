import { Effect } from "effect"
import { RelayWorkflowBinding } from "@orchestra/core/relay-workflow-binding"
import type { ProjectID } from "@orchestra/schema/project-id"
import type { TrustedDomainContext } from "../contracts/sf-execution.ts"

/** The host binds this port to the authenticated project and revalidates the real Request. */
export type RoutinePublicationHost = {
  publication: RelayWorkflowBinding.PublicationPort
  authorize: (context: TrustedDomainContext) => Promise<boolean>
  authorSession: (context: TrustedDomainContext) => Promise<string | undefined>
}

/** Read runnable published versions through the native Relay publication port. */
export async function listPublishedRoutineWorkflows(host: RoutinePublicationHost, context: TrustedDomainContext) {
  if (host.publication.projectID !== context.binding.projectId || !await host.authorize(context)) return { status: "denied", reason: "publication-unavailable" } as const
  const listed = await Effect.runPromise(Effect.result(RelayWorkflowBinding.catalog(host.publication)))
  if (listed._tag === "Failure") return { status: "unavailable", reason: "publication-unavailable" } as const
  if (!await host.authorize(context)) return { status: "denied", reason: "publication-unavailable" } as const
  return { status: "ok", value: listed.success.flatMap((entry) => {
    if (entry.reason || !entry.publishedVersionID || !entry.sprint) return []
    const checks = entry.sprint.work_packages.at(-1)?.checklist ?? []
    if (!["package-verification", "cold-review"].every((name) => checks.some((check) => check.host_check === name))) return []
    return [{ documentId: entry.id, publishedVersion: entry.publishedVersionID, title: entry.name, description: entry.description }]
  }) } as const
}

/** Materialize immutable published bytes. This is preparation, never admission or execution. */
export async function acquireRoutineWorkflow(input: {
  host: RoutinePublicationHost
  context: TrustedDomainContext
  projectID: ProjectID
  documentId: string
  parameters: Readonly<Record<string, string>>
  writePaths: readonly string[]
}) {
  if (input.projectID !== input.context.binding.projectId || input.host.publication.projectID !== input.projectID || !await input.host.authorize(input.context)) return { status: "denied", reason: "publication-unavailable" } as const
  const acquired = await Effect.runPromise(Effect.result(RelayWorkflowBinding.acquire({ port: input.host.publication, projectID: input.projectID, documentID: input.documentId, parameters: input.parameters, writePaths: input.writePaths, authorSessionID: await input.host.authorSession(input.context) })))
  if (acquired._tag === "Failure") return { status: "unavailable", reason: "publication-unavailable" } as const
  if (!await input.host.authorize(input.context)) return { status: "denied", reason: "publication-unavailable" } as const
  const checks = acquired.success.sprint.work_packages.at(-1)?.checklist ?? []
  if (!["package-verification", "cold-review"].every((name) => checks.some((check) => check.host_check === name))) return { status: "unavailable", reason: "workflow-acceptance-missing" } as const
  return { status: "ok", value: acquired.success } as const
}

/** A catalog entry may name only an actual host plan bound to this exact published version. */
export function createRoutinePublicationCatalog(input: {
  host: RoutinePublicationHost
  resolvePlan: (recipe: { documentId: string; publishedVersion: string }, purpose: string, context: TrustedDomainContext) => Promise<{ state: "ready"; planRevisionId: string; writeScope: readonly string[] } | { state: "needs-plan" } | { state: "excluded" }>
}) {
  return async (purpose: string, context: TrustedDomainContext) => {
    const published = await listPublishedRoutineWorkflows(input.host, context)
    if (published.status !== "ok") return published
    const recipes = await Promise.all(published.value.map(async (entry) => {
      const plan = await input.resolvePlan({ documentId: entry.documentId, publishedVersion: entry.publishedVersion }, purpose, context)
      if (plan.state === "excluded") return { state: "excluded" } as const
      if (plan.state !== "ready" || !plan.planRevisionId.trim()) return { state: "needs-plan" } as const
      return { state: "ready", value: { documentId: entry.documentId, publishedVersion: entry.publishedVersion, title: entry.title, planRevisionId: plan.planRevisionId, writeScope: plan.writeScope } } as const
    }))
    if (!await input.host.authorize(context)) return { status: "denied", reason: "publication-unavailable" } as const
    if (recipes.some((entry) => entry.state === "needs-plan")) return { status: "needs-input", reason: "published-workflow-plan-required" } as const
    return { status: "ok", value: recipes.flatMap((entry) => entry.state === "ready" ? [entry.value] : []) } as const
  }
}
