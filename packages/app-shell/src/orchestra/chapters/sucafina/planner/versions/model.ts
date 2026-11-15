import { createEffect, onCleanup } from "solid-js"
import { createStore } from "solid-js/store"
import type { Schema } from "effect"
import { SfDomainPageCap23 } from "@orchestra/schema/sucafina/planner"
import { createSfPlannerClient } from "@orchestra/client/sucafina/planner"
import type { SfRef, SfResolvedRoute } from "@orchestra/schema/sucafina/context"
import type { SfUiState } from "../../shared/frame"
import { useSfContext } from "../../context"
import type { SfSurfaceProps } from "../../context/contracts"
import { encodeSfRouteRef } from "../../navigation-state"

export type VersionPage = Extract<Schema.Schema.Type<typeof SfDomainPageCap23.output>, { status: "ok" }>["value"]
export type PlannerVersion = VersionPage["data"]["versions"][number]

/** A closed route destination only. The F01 shell resolver still validates the
 * resulting deep link against the current owner and route grammar. */
export function plannerHref(
  route: SfResolvedRoute<"CAP17" | "CAP23">,
  destination: "overview" | "versions" | "new" | "compare" | "detail" | "import",
  selection?: Readonly<{ year?: number; version?: string; filter?: string; versionRef?: string }>,
) {
  const base = {
    overview: "/orchestra/sf-planner/overview",
    versions: "/orchestra/sf-planner/versions",
    new: "/orchestra/sf-planner/versions/new",
    compare: "/orchestra/sf-planner/versions/compare",
    detail: "/orchestra/sf-planner/versions/",
    import: "/orchestra/sf-imports/new",
  } as const
  const path = destination === "detail" && selection?.versionRef
    ? base.detail + encodeSfRouteRef(selection.versionRef)
    : base[destination]
  const params = new URLSearchParams()
  // Explicit owner tuple is all-or-none. It is a destination hint, not an ACL.
  if (route.ownerSelection.installationId) {
    params.set("server", route.ownerSelection.serverKey)
    params.set("project", route.ownerSelection.projectId)
    params.set("installation", route.ownerSelection.installationId)
  }
  if (selection?.year !== undefined && destination !== "import") params.set("year", String(selection.year))
  if (destination === "overview" && selection?.version) params.set("version", selection.version)
  if (destination === "overview" && selection?.filter) params.set("filter", selection.filter)
  return path + (params.size ? "?" + params.toString() : "")
}

function contextState(value: ReturnType<ReturnType<typeof useSfContext>["state"]>["status"]): SfUiState {
  switch (value) {
    case "ready": return "ready"
    case "resolving": case "choose-installation": return "loading"
    case "unauthenticated": return "session-expired"
    case "denied": return "denied"
    case "context-mismatch": return "invalid"
    default: return "unavailable"
  }
}

export function useSfPlannerVersions(props: SfSurfaceProps<"CAP23">) {
  const owner = useSfContext()
  const [view, setView] = createStore<{
    state: SfUiState
    page: VersionPage | undefined
    request: number
    reason: string | undefined
  }>({ state: "loading", page: undefined, request: 0, reason: undefined })
  let pending: AbortController | undefined

  createEffect(() => {
    const request = view.request
    const ownerState = owner.state()
    const ready = owner.ready()
    const generation = owner.generation()
    const year = props.route.query.year
    pending?.abort()
    if (!ready || ownerState.status !== "ready") {
      setView({ state: contextState(ownerState.status), page: undefined, reason: undefined, request })
      return
    }
    const destination = ready.context.destinations.find((item) => item.capabilityId === "CAP23")
    const resource = ready.context.availability.find((item) => item.family === "planner" && item.resource === "CAP23")
    const read = resource?.operations.find((item) => item.operationId === "domain.page.CAP23")
    if (!destination?.canRead || read?.state === "denied") {
      setView({ state: "denied", page: undefined, reason: undefined, request })
      return
    }
    if (!read || read.state !== "ready") {
      setView({ state: "unavailable", page: undefined, reason: read?.reason ?? undefined, request })
      return
    }
    const abort = new AbortController()
    pending = abort
    setView({ state: "loading", page: undefined, reason: undefined, request })
    void createSfPlannerClient(ready.transport)["domain.page.CAP23"](
      year === undefined ? {} : { year }, { signal: abort.signal },
    ).then((result) => {
      if (abort.signal.aborted || generation !== owner.generation()) return
      if (result.kind !== "response") {
        setView({ state: result.reason === "outcome-unknown" ? "outcome-unknown" : "unavailable", page: undefined, reason: result.reason, request })
        return
      }
      const body = result.body
      if (body.status === "ok") {
        setView({ state: body.value.data.versions.length ? "ready" : "empty", page: body.value, reason: undefined, request })
        return
      }
      setView({
        state: body.status === "unauthenticated" ? "session-expired"
          : body.status === "denied" ? "denied"
          : body.status === "stale" ? "stale"
          : body.status === "invalid" || body.status === "needs-input" ? "invalid" : "unavailable",
        page: undefined, reason: "reason" in body ? body.reason : undefined, request,
      })
    }).catch((error: unknown) => {
      if (abort.signal.aborted || generation !== owner.generation()) return
      console.error("Sucafina Planner versions read failed", error instanceof Error ? error.name : "unknown")
      setView({ state: "unavailable", page: undefined, reason: "network", request })
    })
  })
  onCleanup(() => pending?.abort())

  const can = (action: string) => {
    const ready = owner.ready()
    if (!ready || !view.page || !["ready", "empty"].includes(view.state)) return false
    const destination = ready.context.destinations.find((item) => item.capabilityId === "CAP23")
    const resource = ready.context.availability.find((item) => item.family === "planner" && item.resource === "CAP23")
    const operation = resource?.operations.find((item) => item.operationId === "domain.command.CAP23." + action)
    return !!destination?.canRead && destination.allowedActionIds.includes(action) &&
      view.page.allowedActionIds.includes(action) && operation?.state === "ready"
  }
  return { owner, view, can, refresh: () => setView("request", (value) => value + 1) }
}
