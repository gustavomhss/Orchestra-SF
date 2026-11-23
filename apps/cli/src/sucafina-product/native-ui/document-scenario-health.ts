import { SfOperationRegistry } from "@orchestra/schema/sucafina/operation-registry"
import type { SfContextStamp, SfOperationAvailability } from "@orchestra/schema/sucafina/context"
import type { CreateSfHostRuntime } from "../../../../../modules/sucafina/Sucafinav1/product/contracts/host-context.ts"
import { digestSfValue } from "../../../../../modules/sucafina/Sucafinav1/product/contracts/canonical.ts"
import type { createSfDocumentScenarios } from "../../../../../modules/sucafina/Sucafinav1/product/documents/scenario-inputs.ts"
import type { createSfProductAuthority } from "../../../../../modules/sucafina/Sucafinav1/product/integration/product-authority.ts"
import { publicSfData } from "../../../../../modules/sucafina/Sucafinav1/product/integration/public-state.ts"
import { selectSfNamespaceHealth } from "../../../../../modules/sucafina/Sucafinav1/product/host-binding/state-provider.ts"
import { roleMap } from "../../../../../modules/sucafina/Sucafinav1/runtime/admin.ts"
import { object } from "../../../../../modules/sucafina/Sucafinav1/runtime/contract.ts"
import { plannerKeys } from "../../../../../modules/sucafina/Sucafinav1/src/nav.ts"
import { sfHasOperationalResource } from "./live-context.ts"

type Source = Readonly<{
  producer: object
  handler: object
  service: ReturnType<typeof createSfDocumentScenarios>
  dependencies: readonly object[]
}>

/** Observe installed C06/Planner infrastructure with the original session.
 * No document is opened, target issued or scenario simulated during discovery.
 * Each original endpoint still checks its selected document, Planner source and human intent.
 */
export async function observeSfDocumentScenarioHealth(input: {
  authority: ReturnType<typeof createSfProductAuthority>
  binding?: Parameters<CreateSfHostRuntime>[0]["nativeReadBinding"]
  source: () => Source | undefined
}, request: Request, stamp: SfContextStamp): Promise<readonly SfOperationAvailability[]> {
  const authority = input.authority, binding = input.binding, sourceFor = input.source, source = sourceFor()
  if (!binding || !source || request.signal.aborted || typeof source.producer !== "function" ||
      typeof source.handler !== "function" || typeof source.service.targets !== "function" ||
      typeof source.service.preview !== "function" || !source.dependencies.length ||
      source.dependencies.some((entry) => !entry || typeof entry !== "object" && typeof entry !== "function")) return []
  const candidates = [
    { id: "files.document-scenario-targets", method: "GET", effect: "read", human: false },
    { id: "files.document-scenario-preview", method: "POST", effect: "preview", human: true },
  ] as const
  const installed = candidates.map((candidate) => binding(candidate.id, source.producer))
  if (!installed[0]) return []
  const expected = digestSfValue(stamp), dependencies = [...source.dependencies]
  const ui = authority.ui, state = authority.state, host = authority.host
  const methods = [ui.admit, ui.validate, ui.requestFor, ui.revalidate, ui.finish, state.read,
    host.persistence, host.persistence.transaction, host.authenticate, host.environment,
    authority.humanActions, authority.readContextAdmission, authority.readDocumentGrants]
  const current = () => {
    const next = sourceFor()
    const live = [ui.admit, ui.validate, ui.requestFor, ui.revalidate, ui.finish, state.read,
      host.persistence, host.persistence.transaction, host.authenticate, host.environment,
      authority.humanActions, authority.readContextAdmission, authority.readDocumentGrants]
    return !request.signal.aborted && digestSfValue(stamp) === expected && input.authority === authority &&
      input.binding === binding && input.source === sourceFor && authority.ui === ui && authority.state === state &&
      authority.host === host && next?.producer === source.producer && next.handler === source.handler &&
      next.service === source.service && next.dependencies.length === dependencies.length &&
      next.dependencies.every((entry, index) => entry === dependencies[index]) &&
      live.every((entry, index) => entry === methods[index]) &&
      candidates.every((candidate, index) => binding(candidate.id, source.producer) === installed[index])
  }
  const admittedContext = async () => {
    const result = await authority.readContextAdmission(request)
    return result.status === "ok" && digestSfValue(result.stamp) === expected && current()
  }
  const digest = digestSfValue({ purpose: "document-scenario-source-health", operation: "sf_scenario_simulate" })
  const admitted = await ui.admit(request, "sf_scenario_simulate", digest)
  if (admitted.status !== "ok") return []
  try {
    const actor = admitted.value.binding
    if (actor.installationId !== stamp.installationId || actor.projectId !== stamp.projectId ||
        actor.principalRef !== stamp.principalRef || actor.policyVersion !== stamp.policyVersion ||
        actor.accessRevision !== stamp.accessRevision || !await ui.validate(admitted.value, "sf_scenario_simulate", digest) ||
        ui.requestFor(admitted.value) !== request || !current() || !await admittedContext()) return []
    const grants = await authority.readDocumentGrants(request, stamp)
    if (!grants?.open || !current()) return []
    const canPreview = (await authority.humanActions(request)).includes("planner.preview")
    const read = async () => {
      const document = await state.read(request, "documents", selectSfNamespaceHealth("documents", stamp))
      if (document.status !== "ok" || !document.value || document.storageVersion !== document.value.storageVersion ||
          document.aggregateRevision !== document.value.aggregateRevision || document.incarnation !== document.value.incarnation ||
          !current()) return undefined
      const planner = await host.persistence.transaction("planner", async (snapshot) => {
        const policy = roleMap(snapshot, "planner")
        const principal = await host.authenticate(request, { surface: "planner", roleMap: policy })
        if (!principal || principal.id !== stamp.principalRef || principal.id.startsWith("local:") || !current())
          return { commit: false, value: undefined }
        const roles = principal.roles.filter((entry) => entry.surface === "planner").map((entry) => entry.role)
        const actor = { id: principal.id, roles, canWrite: principal.canWrite && roles.some((role) => role !== "viewer") }
        const pages = plannerKeys(actor)
        if (!pages.length) return { commit: false, value: undefined }
        return { commit: false, value: digestSfValue({ actor, policy, pages,
          access: object(object(snapshot.data.access)[principal.id]), data: publicSfData(snapshot.data), versions: snapshot.versions }) }
      }, { signal: request.signal })
      return planner && current() ? { document: document.value, planner } : undefined
    }
    const first = await read(), second = await read()
    if (!first || !second || digestSfValue(first) !== digestSfValue(second) || !current()) return []
    const latestGrants = await authority.readDocumentGrants(request, stamp)
    if (!latestGrants?.open || digestSfValue(grants) !== digestSfValue(latestGrants) ||
        canPreview !== (await authority.humanActions(request)).includes("planner.preview") ||
        !await ui.revalidate(admitted.value) || ui.requestFor(admitted.value) !== request || !await admittedContext()) return []
    return candidates.flatMap((candidate, index) => {
      const metadata = SfOperationRegistry[candidate.id]
      return installed[index] && (!candidate.human || canPreview) && sfHasOperationalResource(candidate.id) &&
        metadata.method === candidate.method && metadata.effect === candidate.effect &&
        metadata.pathTemplate === "{mount}/{surface}" && metadata.responseMode === "json" &&
        metadata.fixedQuery.sf === candidate.id.slice("files.".length)
        ? [{ operationId: candidate.id, state: "ready" as const, reason: null, operational: true as const }] : []
    })
  } finally { ui.finish(admitted.value) }
}
