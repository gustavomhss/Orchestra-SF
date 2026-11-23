import { Option, Schema } from "effect"
import { SfResidentCatalog } from "@orchestra/schema/sucafina/analyses"
import { SfOperationRegistry } from "@orchestra/schema/sucafina/operation-registry"
import type { SfContextStamp, SfOperationAvailability } from "@orchestra/schema/sucafina/context"
import { digestSfValue } from "../../../../../modules/sucafina/Sucafinav1/product/contracts/canonical.ts"
import type { SfHostServices } from "../../../../../modules/sucafina/Sucafinav1/product/contracts/host-context.ts"
import type { TrustedUiContext } from "../../../../../modules/sucafina/Sucafinav1/product/contracts/sf-execution.ts"
import type { SfNativeHostDependencies, SfProjectionHandler } from "./router.ts"
import { sfHasOperationalResource } from "./live-context.ts"

type Runtime = Pick<SfHostServices, "ui" | "selected">
type Dependencies = Pick<SfNativeHostDependencies, "origin" | "mount" | "readContext"> & {
  runtime: () => Runtime | undefined
}
type Inventory = { status: "ok"; value: typeof SfResidentCatalog.Type } | { status: "denied" | "unavailable" }
type Installed = Readonly<{ runtime: Runtime; handlers: readonly SfProjectionHandler[]; projectionBinding: object }>
const readers = new WeakMap<SfProjectionHandler, Dependencies>()

/** Original A15 installed-inventory reader, recovered from PR137. A resident
 * manifest never grants access: each emitted operation retains its own current
 * original UI lease until the final context and source checks have finished.
 */
export function createSfResidentProjectionHandlers(deps: Dependencies): readonly SfProjectionHandler[] {
  const handler: SfProjectionHandler = {
    operationId: "projection.residents",
    handle: async (request) => {
      const url = new URL(request.url)
      if (request.method !== "GET" || url.origin !== deps.origin ||
        url.pathname !== deps.mount + "/api/ui/projections/residents" || url.search || request.body !== null ||
        url.username || url.password || url.hash ||
        request.headers.has("origin") && request.headers.get("origin") !== deps.origin ||
        request.headers.get("sec-fetch-site") === "cross-site") return reply({ status: "invalid" }, 400)
      const runtime = deps.runtime(), reader = deps.readContext
      if (!runtime || request.signal.aborted) return reply({ status: "unavailable" }, 503)
      const context = await reader(request)
      if (context.status !== "ok") return reply({ status: context.status }, context.status === "unauthenticated" ? 401 : context.status === "denied" ? 403 : 503)
      const stamp = Object.freeze({ ...context.value.stamp })
      const current = () => !request.signal.aborted && deps.runtime() === runtime && deps.readContext === reader
      const inventory = await readInventory(runtime, request, stamp, current, async () => {
        const after = await reader(request)
        return current() && after.status === "ok" && sameStamp(after.value.stamp, stamp)
      }).catch((): Inventory => ({ status: "unavailable" }))
      if (!current()) return reply({ status: "unavailable" }, 503)
      if (inventory.status !== "ok") return reply(inventory, inventory.status === "denied" ? 403 : 503)
      return reply({ status: "ok", context: stamp, value: inventory.value }, 200, stamp.accessRevision)
    },
  }
  readers.set(handler, deps)
  return Object.freeze([handler])
}

/** Read-only proof of the actual mounted A15 reader and current per-operation
 * authority. No analysis, case, model, output, receipt or native run is created.
 */
export async function observeSfResidentHealth(input: {
  source: () => Installed | undefined
}, request: Request, stamp: SfContextStamp): Promise<readonly SfOperationAvailability[]> {
  const sourceFor = input.source, source = sourceFor()
  const metadata = SfOperationRegistry["projection.residents"]
  if (!source || request.signal.aborted || typeof source.projectionBinding !== "function" ||
    !sfHasOperationalResource("projection.residents") || metadata.method !== "GET" || metadata.effect !== "read" ||
    metadata.pathTemplate !== "{mount}/api/ui/projections/residents" || metadata.responseMode !== "json") return []
  const candidates = source.handlers.filter((entry) => entry.operationId === "projection.residents")
  const handler = candidates[0], deps = handler && readers.get(handler)
  if (candidates.length !== 1 || !handler || !deps || deps.runtime() !== source.runtime) return []
  const handle = handler.handle, runtimeFor = deps.runtime
  const current = () => {
    const next = sourceFor()
    return !request.signal.aborted && input.source === sourceFor && next?.runtime === source.runtime &&
      next.handlers === source.handlers && next.projectionBinding === source.projectionBinding &&
      source.handlers.filter((entry) => entry.operationId === "projection.residents").length === 1 &&
      source.handlers.includes(handler) && handler.handle === handle && readers.get(handler) === deps &&
      deps.runtime === runtimeFor && runtimeFor() === source.runtime
  }
  const inventory = await readInventory(source.runtime, request, stamp, current).catch((): Inventory => ({ status: "unavailable" }))
  return inventory.status === "ok" && current()
    ? [{ operationId: "projection.residents", state: "ready", reason: null, operational: true }]
    : []
}

async function readInventory(runtime: Runtime, request: Request, stamp: SfContextStamp,
  installed: () => boolean, verify: () => Promise<boolean> = async () => true): Promise<Inventory> {
  const ui = runtime.ui, selected = runtime.selected, finish = ui.finish
  const selectedDigest = digestSfValue(selected), stampDigest = digestSfValue(stamp)
  const dependencies = [ui.admit, ui.validate, ui.revalidate, ui.requestFor, ui.finish]
  const current = () => installed() && !request.signal.aborted && runtime.ui === ui && runtime.selected === selected &&
    digestSfValue(selected) === selectedDigest && digestSfValue(stamp) === stampDigest &&
    dependencies.every((entry, index) => entry === [ui.admit, ui.validate, ui.revalidate, ui.requestFor, ui.finish][index])
  const digest = digestSfValue(undefined)
  const read = await ui.admit(request, "sf-human:analysis.read", digest)
  if (read.status !== "ok") return { status: read.status === "unavailable" ? "unavailable" : "denied" }
  const leases: { operation: string; context: TrustedUiContext }[] = [{ operation: "sf-human:analysis.read", context: read.value }]
  const collect = async (): Promise<Inventory> => {
    if (!current() || !matches(read.value, stamp) || ui.requestFor(read.value) !== request ||
      !await ui.validate(read.value, "sf-human:analysis.read", digest) || !current()) return { status: "denied" }
    const operations = [...new Set(selected.flatMap((entry) => entry.skills.flatMap((skill) =>
      skill.allowedOperations.filter((operation) => entry.operationIds.includes(operation) &&
        entry.profile.allowedOperations.includes(operation) && entry.profile.allowedSkills.includes(skill.id) &&
        skill.allowedProfiles.includes(entry.profile.id)))))]
    const granted = new Set<string>()
    for (const operation of operations) {
      if (!current()) return { status: "unavailable" }
      const admission = await ui.admit(request, operation, digest)
      if (admission.status === "unavailable") return { status: "unavailable" }
      if (admission.status !== "ok") continue
      leases.push({ operation, context: admission.value })
      if (!matches(admission.value, stamp) || ui.requestFor(admission.value) !== request ||
        !await ui.validate(admission.value, operation, digest) || !current()) return { status: "denied" }
      granted.add(operation)
    }
    const profiles = selected.flatMap((entry) => {
      const skills = entry.skills.flatMap((skill) => {
        if (!entry.profile.allowedSkills.includes(skill.id) || !skill.allowedProfiles.includes(entry.profile.id)) return []
        const allowedOperations = skill.allowedOperations.filter((operation) => entry.operationIds.includes(operation) &&
          entry.profile.allowedOperations.includes(operation) && granted.has(operation))
        return allowedOperations.length ? [{ id: skill.id, version: skill.version, allowedOperations,
          outputSchemaRefs: [...skill.outputSchemaRefs] }] : []
      })
      return skills.length ? [{ id: entry.profile.id, version: entry.profile.version, mission: entry.profile.mission, skills }] : []
    })
    const decoded = Schema.decodeUnknownOption(SfResidentCatalog, { onExcessProperty: "error" })({ profiles })
    if (Option.isNone(decoded) || !await verify() || !current()) return { status: "unavailable" }
    for (const lease of leases) {
      if (!matches(lease.context, stamp) || ui.requestFor(lease.context) !== request ||
        !await ui.validate(lease.context, lease.operation, digest) || !await ui.revalidate(lease.context) ||
        !current()) return { status: "denied" }
    }
    return current() ? { status: "ok", value: decoded.value } : { status: "unavailable" }
  }
  const result = await collect().finally(() => { for (const lease of leases) finish(lease.context) })
  return current() ? result : { status: "unavailable" }
}

function matches(context: TrustedUiContext, stamp: SfContextStamp) {
  const binding = context.binding
  return binding.installationId === stamp.installationId && binding.projectId === stamp.projectId &&
    binding.principalRef === stamp.principalRef && binding.policyVersion === stamp.policyVersion &&
    binding.accessRevision === stamp.accessRevision
}
function sameStamp(left: SfContextStamp, right: SfContextStamp) {
  return left.installationId === right.installationId && left.projectId === right.projectId &&
    left.hostId === right.hostId && left.principalRef === right.principalRef &&
    left.policyVersion === right.policyVersion && left.accessRevision === right.accessRevision
}
function reply(body: unknown, status: number, accessRevision?: string) {
  return Response.json(body, { status, headers: {
    "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff", "X-SF-Contract-Revision": "sf-native-ui/1",
    ...(accessRevision ? { "X-SF-Access-Revision": accessRevision } : {}),
  } })
}
