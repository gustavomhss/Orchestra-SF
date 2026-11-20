import type { SfContextStamp, SfOperationAvailability } from "@orchestra/schema/sucafina/context"
import { parseSfInstallationSelector, readSfInstallations, SfInvalidInstallationSelector } from "../../../../../../packages/server/src/sucafina-installations.ts"
import type { Application } from "../../../runtime/application.ts"
import type { SfHostServices } from "../../../product/contracts/host-context.ts"
import type { createSfProductAuthority } from "../../../product/integration/product-authority.ts"
import { createSfContextHandler } from "../../../../../../apps/cli/src/sucafina-product/native-ui/context.ts"
import { createSfLiveContext, sfContextDestinationsFromPages } from "../../../../../../apps/cli/src/sucafina-product/native-ui/live-context.ts"
import { createSfActionSource } from "../../../../../../apps/cli/src/sucafina-product/native-ui/action-source.ts"
import { createSfDomainProjectionHandlers } from "../../../../../../apps/cli/src/sucafina-product/native-ui/domain.ts"
import { createSfPeopleProjectionHandlers } from "../../../../../../apps/cli/src/sucafina-product/native-ui/people.ts"
import { createSfPlannerProjectionHandlers, observeSfPlannerPages } from "../../../../../../apps/cli/src/sucafina-product/native-ui/planner.ts"
import { createSfWorkProjectionHandlers, observeSfHome } from "../../../../../../apps/cli/src/sucafina-product/native-ui/work.ts"
import { createSfDecisionsProjectionHandlers, observeSfCases } from "../../../../../../apps/cli/src/sucafina-product/native-ui/decisions.ts"
import { observeSfDashboardPages } from "../../../../../../apps/cli/src/sucafina-product/native-ui/dashboard-operational.ts"
import { observeSfDomainHealth } from "../../../../../../apps/cli/src/sucafina-product/native-ui/domain-health.ts"
import { mountSfNativeProjections, type SfNativeHostDependencies, type SfProjectionHandler } from "../../../../../../apps/cli/src/sucafina-product/native-ui/router.ts"

type Binding = Readonly<{ installationId: string; projectId: string; hostId: string }>
type Authority = Pick<ReturnType<typeof createSfProductAuthority>, "readContextAdmission">
export type NativeBrowserHostInput = Readonly<{
  origin: string
  mount: string
  /** Exact admitted fixture Location; no cwd, workspace or alternate-directory fallback. */
  directory: string
  /** The fixture's actual, stable installation identity, never browser input. */
  identity: () => Binding | undefined
  application: Application
  authority: Authority
  services: () => SfHostServices | undefined
  additionalHandlers?: (dependencies: SfNativeHostDependencies) => readonly SfProjectionHandler[]
  /** Only genuine production health producers may be supplied here. */
  observe?: (request: Request, stamp: SfContextStamp) => Promise<readonly SfOperationAvailability[]>
}>

/** Isolated browser composition of the same F01 and native projection factories
 * used by local/entry.ts and host-context.ts. Authentication, stamps, page actions,
 * snapshots, commands and operation observations stay in their real producers.
 * This helper starts no listener and never issues a grant or operator session.
 */
export function createNativeBrowserHost(input: NativeBrowserHostInput) {
  let original: SfHostServices | undefined
  let installed: (SfHostServices & { nativeUiProducts: ReturnType<typeof createSfLiveContext> }) | undefined
  const runtime = () => {
    const current = input.services()
    if (!current) return undefined
    if (current !== original) {
      original = current
      installed = { ...current, nativeUiProducts: live }
    }
    return installed
  }
  const live = createSfLiveContext({
    origin: input.origin, mount: input.mount, currentBinding: input.identity,
    admit: async (request) => {
      const admitted = await input.authority.readContextAdmission(request)
      if (admitted.status !== "ok") return admitted
      const observed = await actions.actions(request, admitted.stamp, admitted.pages)
      const destinations = sfContextDestinationsFromPages(admitted.pages, observed)
      return destinations
        ? { status: "ok", stamp: admitted.stamp, authMode: "local-operator", destinations }
        : { status: "unavailable", reason: "contract-mismatch" }
    },
    operational: async (request, stamp) => {
      const observations = await Promise.allSettled([
        observeSfPlannerPages(input.application, request, stamp),
        observeSfDashboardPages(input.application, request, stamp),
        observeSfDomainHealth(dependencies, handlers, request, stamp),
        observeSfHome(runtime(), request, stamp),
        observeSfCases(dependencies, handlers, request, stamp),
        actions.operational(request, stamp),
        input.observe?.(request, stamp) ?? Promise.resolve([]),
      ])
      return observations.flatMap((item): readonly SfOperationAvailability[] =>
        item.status === "fulfilled" ? item.value : [])
    },
  })
  const base = { origin: input.origin, mount: input.mount, application: input.application, runtime }
  const context = createSfContextHandler(base)
  const dependencies: SfNativeHostDependencies = { ...base, readContext: context.readContext }
  const handlers = [
    ...createSfDomainProjectionHandlers(dependencies),
    ...createSfPeopleProjectionHandlers(dependencies),
    ...createSfPlannerProjectionHandlers(dependencies),
    ...createSfWorkProjectionHandlers(dependencies),
    ...createSfDecisionsProjectionHandlers(dependencies),
    ...(input.additionalHandlers?.(dependencies) ?? []),
  ]
  const actions = createSfActionSource(dependencies, handlers)
  const projections = mountSfNativeProjections({ mount: input.mount, context, handlers })
  const descriptor = () => {
    const current = input.identity()
    return current ? { ...current, publicOrigin: input.origin, mount: input.mount,
      contractRevision: "sf-native-ui/1" as const, authMode: "local-operator" as const } : undefined
  }
  const installationRuntime = {
    publicOrigin: input.origin, mount: input.mount, authMode: "local-operator" as const,
    identity: input.identity,
  }
  const handle = async (request: Request): Promise<Response | undefined> => {
    const url = new URL(request.url)
    if (url.pathname !== "/api/sucafina/installations") return projections(request)
    const headers = { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" }
    if (url.origin !== input.origin || request.method !== "GET" ||
        request.headers.get("sec-fetch-site") === "cross-site")
      return Response.json({ status: "denied" }, { status: 403, headers })
    const admitted = await input.authority.readContextAdmission(request)
    const current = descriptor()
    if (admitted.status !== "ok" || !current)
      return Response.json({ status: admitted.status }, { status: admitted.status === "unauthenticated" ? 401 :
        admitted.status === "denied" ? 403 : 503, headers })
    if (admitted.stamp.installationId !== current.installationId ||
        admitted.stamp.projectId !== current.projectId || admitted.stamp.hostId !== current.hostId)
      return Response.json({ status: "unavailable" }, { status: 503, headers })
    try {
      const selector = parseSfInstallationSelector(request.url)
      const installations = await readSfInstallations({
        current: async (signal) => signal.aborted ? undefined : installationRuntime,
        forAdmittedLocation: async (location, signal) =>
          !signal.aborted && location.directory === input.directory && location.workspace === undefined
            ? [installationRuntime] : [],
      }, selector, request.signal)
      return Response.json(installations, { headers })
    } catch (error) {
      if (error instanceof SfInvalidInstallationSelector)
        return Response.json({ status: "invalid-selector" }, { status: 400, headers })
      throw error
    }
  }
  return { handle, descriptor, readContext: context.readContext, dependencies, handlers }
}
