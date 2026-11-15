import { digestSfValue } from "../../../../../modules/sucafina/Sucafinav1/product/contracts/canonical.ts"
import type { SfHostServices } from "../../../../../modules/sucafina/Sucafinav1/product/contracts/host-context.ts"
import type { SfNativeHostDependencies, SfProjectionHandler } from "./router"

/** The only A15 server addition. Existing analysis JSON routes keep their original
 * Request, admission, execution, cancellation and output projection.
 *
 * The installed selected registry is private. A public resident entry is emitted
 * only when the current principal can separately admit its actual registered
 * operations; a manifest's declared allowlist is not an authorization grant.
 */
export function createSfAnalysesProjectionHandlers(deps: SfNativeHostDependencies): readonly SfProjectionHandler[] {
  return [{
    operationId: "projection.residents",
    handle: async (request: Request): Promise<Response> => {
      const url = new URL(request.url)
      if (request.method !== "GET" || url.origin !== deps.origin ||
        url.pathname !== `${deps.mount}/api/ui/projections/residents` ||
        url.search !== "" || request.body !== null ||
        (request.headers.has("origin") && request.headers.get("origin") !== deps.origin) ||
        request.headers.get("sec-fetch-site") === "cross-site") {
        return reply({ status: "invalid" }, 400)
      }
      if (request.signal.aborted) return reply({ status: "unavailable" }, 503)
      const runtime = deps.runtime()
      if (!runtime) return reply({ status: "unavailable" }, 503)

      const context = await deps.readContext(request)
      if (context.status !== "ok") return contextError(context.status)
      const stamp = context.value.stamp
      const readDigest = digestSfValue(undefined)
      // This is the original Request. Never synthesize an internal privileged
      // context/analysis request, and never inspect product state snapshots.
      const read = await runtime.ui.admit(request, "sf-human:analysis.read", readDigest)
      if (read.status !== "ok") return reply({ status: read.status === "unavailable" ? "unavailable" : "denied" }, read.status === "unavailable" ? 503 : 403)
      try {
        if (!await runtime.ui.validate(read.value, "sf-human:analysis.read", readDigest) ||
          !sameContext(read.value.binding, stamp)) return reply({ status: "denied" }, 403)

        const installed = runtime.selected
        const candidates = [...new Set(installed.flatMap((profile) =>
          profile.skills.flatMap((skill) => skill.allowedOperations.filter((operation) =>
            profile.operationIds.includes(operation)))))]

        // The installed registry alone is never an authority oracle. Check each
        // concrete operation through the host's current, source-backed admission.
        const granted = new Set<string>()
        for (const operation of candidates) {
          if (request.signal.aborted) return reply({ status: "unavailable" }, 503)
          const probe = await runtime.ui.admit(request, operation, readDigest)
          if (probe.status !== "ok") continue
          try {
            if (sameContext(probe.value.binding, stamp) &&
              await runtime.ui.validate(probe.value, operation, readDigest) &&
              await runtime.ui.revalidate(probe.value) &&
              sameContext(probe.value.binding, stamp)) granted.add(operation)
          } finally {
            runtime.ui.finish(probe.value)
          }
        }

        // No names, missions or schemaRefs from an ungranted skill escape.
        const profiles = installed.flatMap((entry) => {
          const skills = entry.skills.flatMap((skill) => {
            const allowedOperations = skill.allowedOperations.filter((operation) =>
              entry.operationIds.includes(operation) && granted.has(operation))
            return allowedOperations.length ? [{
              id: skill.id,
              version: skill.version,
              allowedOperations,
              outputSchemaRefs: [...skill.outputSchemaRefs],
            }] : []
          })
          return skills.length ? [{
            id: entry.profile.id,
            version: entry.profile.version,
            mission: entry.profile.mission,
            skills,
          }] : []
        })

        if (!await runtime.ui.revalidate(read.value) ||
          deps.runtime() !== runtime || runtime.selected !== installed ||
          !sameContext(read.value.binding, stamp)) return reply({ status: "denied" }, 403)
        const after = await deps.readContext(request)
        if (after.status !== "ok" || !sameStamp(after.value.stamp, stamp) ||
          !await runtime.ui.revalidate(read.value) || request.signal.aborted) return reply({ status: "denied" }, 403)
        return reply({ status: "ok", context: stamp, value: { profiles } }, 200, stamp.accessRevision)
      } finally {
        runtime.ui.finish(read.value)
      }
    },
  }]
}

type Stamp = {
  installationId: string
  projectId: string
  hostId: string
  principalRef: string
  policyVersion: string
  accessRevision: string
}
type Binding = NonNullable<Awaited<ReturnType<SfHostServices["ui"]["admit"]>> extends infer T
  ? T extends { status: "ok"; value: { binding: infer B } } ? B : never
  : never>

function sameContext(binding: Binding, stamp: Stamp) {
  return binding.installationId === stamp.installationId &&
    binding.projectId === stamp.projectId &&
    binding.principalRef === stamp.principalRef &&
    binding.policyVersion === stamp.policyVersion &&
    binding.accessRevision === stamp.accessRevision
}
function sameStamp(a: Stamp, b: Stamp) {
  return a.installationId === b.installationId && a.projectId === b.projectId &&
    a.hostId === b.hostId && a.principalRef === b.principalRef &&
    a.policyVersion === b.policyVersion && a.accessRevision === b.accessRevision
}
function contextError(status: "unauthenticated" | "denied" | "unavailable") {
  return reply({ status }, status === "unauthenticated" ? 401 : status === "denied" ? 403 : 503)
}
function reply(body: unknown, status: number, accessRevision?: string) {
  return Response.json(body, { status, headers: {
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
    "X-SF-Contract-Revision": "sf-native-ui/1",
    ...(accessRevision ? { "X-SF-Access-Revision": accessRevision } : {}),
  } })
}
