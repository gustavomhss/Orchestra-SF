import { roleMap } from "../../../../modules/sucafina/Sucafinav1/runtime/admin.ts"
import { object } from "../../../../modules/sucafina/Sucafinav1/runtime/contract.ts"
import { assetLink } from "../../../../modules/sucafina/Sucafinav1/runtime/assets.ts"
import { sfScopedSourceIdentity, sfSourceIdentity } from "../../../../modules/sucafina/Sucafinav1/product/integration/source-lifecycle.ts"
import { sfPlannerProjectionSelector } from "../../../../modules/sucafina/Sucafinav1/product/integration/source-projections.ts"
import { digestSfValue } from "../../../../modules/sucafina/Sucafinav1/product/contracts/canonical.ts"
import type { CreateSfHostRuntime } from "../../../../modules/sucafina/Sucafinav1/product/contracts/host-context.ts"
import type { createSfProductAuthority } from "../../../../modules/sucafina/Sucafinav1/product/integration/product-authority.ts"

export function createSfDocumentTargetAuthority(input: Pick<Parameters<CreateSfHostRuntime>[0], "persistence" | "authenticate" | "environment" | "assets">): Parameters<typeof createSfProductAuthority>[0]["authorizeDocument"] {
  return async (request, dashboard, targetRef, principalRef, authority) => {
      const snapshots = input.persistence.currentSnapshots?.()
      if (!snapshots || request.signal.aborted || principalRef !== authority.principalRef) return undefined
      const environment = await input.environment(request)
      const candidates = await Promise.all((["dashboard", "planner", "procurement"] as const).map(async (surface) => {
        const snapshot = surface === "dashboard" ? dashboard : snapshots[surface]
        const principal = await input.authenticate(request, { surface, roleMap: roleMap(snapshot, surface) })
        if (!principal || principal.id !== principalRef || principal.id.startsWith("local:")) return []
        const access = object(object(snapshot.data.access)[principal.id])
        const roles = principal.roles.filter((role) => role.surface === surface).map((role) => role.role)
        const actor = { id: principal.id, canWrite: principal.canWrite && roles.some((role) => role !== "viewer"), roles,
          assigned: Array.isArray(access.assigned) ? access.assigned.filter((entry): entry is string => typeof entry === "string") : [],
          domains: Array.isArray(access.domains) ? access.domains.filter((entry): entry is string => typeof entry === "string") : [] }
        const asset = surface !== "planner" && input.assets && snapshot.sfSources ? sfSourceIdentity(snapshot, "document-asset", targetRef) : undefined
        const link = asset && input.assets ? assetLink(snapshot, actor, environment, input.assets.services, targetRef) : undefined
        const assets = asset && link?.ok ? [{ incarnation: asset.incarnation }] : []
        if (!actor.canWrite) return assets
        const scoped = Object.values(snapshot.sfSources?.scopes ?? {}).flatMap((entry) => {
          const scope = entry.scope
          if (!entry.alive || scope.principalRef !== principalRef || scope.accessRevision !== authority.accessRevision || scope.policyVersion !== authority.policyVersion || (surface === "planner" && scope.recordType !== "planner-version") ||
            (surface === "dashboard" && !["dashboard-page", "dashboard-dataset"].includes(scope.recordType)) || surface === "procurement") return []
          const selector = object(scope.selector)
          const expected = surface === "planner" ? `planner-version:${encodeURIComponent(scope.recordId)}:${encodeURIComponent(entry.incarnation)}:${entry.version}` :
            scope.recordType === "dashboard-dataset" ? `sf-dataset:${encodeURIComponent(entry.incarnation)}:${entry.version}` : `sf-source:${encodeURIComponent(entry.incarnation)}:${entry.version}`
          if (targetRef !== expected) return []
          if (surface === "planner" ? digestSfValue(scope.selector) !== digestSfValue(sfPlannerProjectionSelector(snapshot, actor)) :
            digestSfValue(selector.actor) !== digestSfValue(actor) || selector.roleMapDigest !== digestSfValue(roleMap(snapshot, surface))) return []
          const identity = sfScopedSourceIdentity(snapshot, scope)
          return identity && identity.incarnation === entry.incarnation && identity.version === entry.version
            ? [{ incarnation: identity.incarnation }] : []
        })
        return [...assets, ...scoped]
      }))
      const matches = candidates.flat()
      return matches.length === 1 && !request.signal.aborted ? matches[0] : undefined
    }
}
