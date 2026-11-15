import { Option, Schema } from "effect"
import {
  SfRoutines, SfRoutinesCatalog, SfRoutinesPrepareAdmission, SfRoutinesReadAdmission,
  SfRoutinesReadRun, SfRoutinesRun, SfSchedulesCreate, SfSchedulesList,
  SfSchedulesPause, SfSchedulesRead, SfSchedulesReadRun, SfSchedulesUpdate,
} from "@orchestra/schema/sucafina/routines"
import type { SfRoutinesOperationId } from "@orchestra/schema/sucafina/routines"
import { digestSfValue } from "../../../../../modules/sucafina/Sucafinav1/product/contracts/canonical.ts"
import { decodeSfOperationInput, decodeSfOperationOutput } from "../../../../../modules/sucafina/Sucafinav1/product/contracts/schema-admission.ts"
import { readRequestBody, RequestBodyError } from "../../../../../modules/sucafina/Sucafinav1/runtime/request-body.ts"
import type { SfHostServices } from "../../../../../modules/sucafina/Sucafinav1/product/contracts/host-context.ts"
import type { BusinessPorts, PortResult } from "../../../../../modules/sucafina/Sucafinav1/product/contracts/ports.ts"
import type { TrustedDomainContext, TrustedUiContext } from "../../../../../modules/sucafina/Sucafinav1/product/contracts/sf-execution.ts"
import type { SfNativeHostDependencies, SfProjectionHandler } from "./router.ts"

type CaseRef = typeof SfRoutinesRun.input.Type["caseRef"]
type HostProducts = Readonly<{
  routines: BusinessPorts["routines"]
  schedules?: BusinessPorts["schedules"]
  // The private producer reader is I00-owned; A09 only consumes its frozen shape.
  scheduleDetails?: Readonly<{
    read(request: Readonly<{ scheduleRef: string }>, binding: TrustedDomainContext):
      Promise<typeof SfSchedulesRead.output.Type>
  }>
  withCase<T>(context: TrustedDomainContext, caseRef: CaseRef,
    options: Readonly<{ allowHistoricalRetry?: boolean }>,
    work: () => Promise<PortResult<T>>): Promise<PortResult<T>>
}>
type A09Runtime = SfHostServices & Readonly<{ nativeUiProducts?: HostProducts }>
type PostOperation = Exclude<SfRoutinesOperationId, "projection.routine">
type HumanAction = "routines.admit" | "routines.run" | "schedules.create" | "schedules.read" |
  "schedules.update" | "schedules.pause"
type Admission = Readonly<{ kind: "ui"; operation: "sf_routine_catalog" | "sf_routine_status" }> |
  Readonly<{ kind: "human"; action: HumanAction }>
type RoutineOrSchedule = PortResult<unknown> | typeof SfSchedulesRead.output.Type
const BODY_LIMIT = 65_536
const KEY = /^[A-Za-z0-9._:-]{8,128}$/
const HEADERS = { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } as const

const POSTS = [
  "routines.catalog", "routines.prepare-admission", "routines.read-admission",
  "routines.read-run", "routines.run", "schedules.create", "schedules.list",
  "schedules.pause", "schedules.read", "schedules.read-run", "schedules.update",
] as const satisfies readonly PostOperation[]

function reply(body: unknown, status: number): Response {
  return Response.json(body, { status, headers: HEADERS })
}
const invalid = () => reply({ status: "invalid" }, 400)
const denied = (reason = "routine-authority-unavailable") => ({ status: "denied" as const, reason })
const unavailable = (reason: string) => ({ status: "unavailable" as const, reason })
const statusCode = (status: string) => status === "ok" ? 200 : status === "not-found" ? 404 :
  status === "denied" ? 403 : status === "needs-input" ? 422 :
  status === "stale" || status === "conflict" || status === "provider-conflict" ? 409 :
  status === "failed" ? 500 : 503

/** Only exact source-compatible envelopes may reach the UI. */
function wireResult(operation: SfRoutinesOperationId, result: unknown): Response {
  const decoded = Schema.decodeUnknownOption(SfRoutines.operations[operation].output, {
    onExcessProperty: "error",
  })(result)
  if (Option.isNone(decoded)) return reply(unavailable("routine-source-contract-mismatch"), 503)
  return reply(decoded.value, statusCode(decoded.value.status))
}
function validPath(request: Request, deps: SfNativeHostDependencies, operation: SfRoutinesOperationId) {
  const path = operation === "projection.routine"
    ? "/api/ui/projections/routine" : "/api/ui/" + operation.replace(".", "/")
  const url = new URL(request.url)
  return url.origin === deps.origin && url.pathname === deps.mount + path &&
    !url.username && !url.password && !url.hash &&
    request.headers.get("sec-fetch-site") !== "cross-site" &&
    (!request.headers.has("origin") || request.headers.get("origin") === deps.origin)
}
function postAdmission(operation: PostOperation): Admission {
  if (operation === "routines.catalog") return { kind: "ui", operation: "sf_routine_catalog" }
  if (operation === "routines.read-admission" || operation === "routines.read-run")
    return { kind: "ui", operation: "sf_routine_status" }
  if (operation === "routines.prepare-admission") return { kind: "human", action: "routines.admit" }
  if (operation === "routines.run") return { kind: "human", action: "routines.run" }
  if (operation === "schedules.list" || operation === "schedules.read" || operation === "schedules.read-run")
    return { kind: "human", action: "schedules.read" }
  if (operation === "schedules.create") return { kind: "human", action: "schedules.create" }
  if (operation === "schedules.pause") return { kind: "human", action: "schedules.pause" }
  return { kind: "human", action: "schedules.update" }
}

function sameCaseRef(left: CaseRef, right: CaseRef) {
  return left.id === right.id && left.incarnation === right.incarnation && left.version === right.version
}
function routineCall(
  operation: PostOperation,
  payload: unknown,
  products: HostProducts,
  binding: TrustedUiContext,
): Promise<RoutineOrSchedule> {
  if (operation === "routines.catalog" && Schema.is(SfRoutinesCatalog.input)(payload)) {
    return products.withCase(binding, payload.caseRef, {}, async () =>
      products.routines.catalog(payload.input.purpose, binding))
  }
  if (operation === "routines.prepare-admission" && Schema.is(SfRoutinesPrepareAdmission.input)(payload)) {
    return products.withCase(binding, payload.caseRef, {}, async () =>
      products.routines.prepareAdmission(payload.input, binding))
  }
  if (operation === "routines.read-admission" && Schema.is(SfRoutinesReadAdmission.input)(payload)) {
    return products.withCase(binding, payload.caseRef, {}, async () =>
      products.routines.readAdmission(payload.input.admissionRef, binding))
  }
  if (operation === "routines.read-run" && Schema.is(SfRoutinesReadRun.input)(payload)) {
    return products.withCase(binding, payload.caseRef, {}, async () =>
      products.routines.readRun(payload.input.runRef, binding))
  }
  if (operation === "routines.run" && Schema.is(SfRoutinesRun.input)(payload)) {
    if (!sameCaseRef(payload.caseRef, payload.input.caseRef))
      return Promise.resolve({ status: "needs-input", reason: "routine-case-reference-mismatch" })
    return products.withCase(binding, payload.caseRef, {}, async () =>
      products.routines.run(payload.input, binding))
  }
  return Promise.resolve(unavailable("routine-operation-contract-mismatch"))
}
async function scheduleCall(
  operation: PostOperation,
  payload: unknown,
  products: HostProducts | undefined,
  binding: TrustedUiContext,
): Promise<RoutineOrSchedule> {
  if (operation === "schedules.read" && Schema.is(SfSchedulesRead.input)(payload)) {
    if (!products?.scheduleDetails) return unavailable("schedule-detail-port-unavailable")
    // This is an actual installed authorized reader, not Core ScheduledTask access.
    return products.scheduleDetails.read(payload, binding)
  }
  if (operation === "schedules.update" && Schema.is(SfSchedulesUpdate.input)(payload)) {
    if (!products?.scheduleDetails) return unavailable("schedule-detail-port-unavailable")
    const detail = await products.scheduleDetails.read({ scheduleRef: payload.scheduleRef }, binding)
    // The legacy update PortResult has no not-found arm; never fake an update
    // outcome or convert a missing authorized detail into an editable record.
    if (detail.status === "not-found") return unavailable("schedule-detail-not-found")
    if (detail.status !== "ok") return detail
    if (detail.value.scheduleRef !== payload.scheduleRef || detail.value.version !== payload.expectedVersion)
      return { status: "stale", reason: "schedule-detail-changed" }
    if (!detail.value.conditionRef || !detail.value.recipeRef || !detail.value.recurrence || !detail.value.timezone)
      return unavailable("schedule-detail-incomplete")
    if (!products.schedules) return unavailable("native-schedule-port-unavailable")
    // Producer still performs the authoritative version CAS on mutation.
    return products.schedules.update(payload, binding)
  }
  if (!products?.schedules) return unavailable("native-schedule-port-unavailable")
  if (operation === "schedules.list" && Schema.is(SfSchedulesList.input)(payload))
    return products.schedules.list(binding)
  if (operation === "schedules.create" && Schema.is(SfSchedulesCreate.input)(payload))
    return products.schedules.create(payload, binding)
  if (operation === "schedules.pause" && Schema.is(SfSchedulesPause.input)(payload))
    return products.schedules.pause(payload, binding)
  if (operation === "schedules.read-run" && Schema.is(SfSchedulesReadRun.input)(payload))
    return products.schedules.readRun(payload.runRef, binding)
  return unavailable("schedule-operation-contract-mismatch")
}

async function authorizedPost(
  operation: PostOperation, request: Request, deps: SfNativeHostDependencies,
  payload: unknown,
): Promise<Response> {
  const runtime = deps.runtime() as A09Runtime | undefined
  if (!runtime) return reply(unavailable("routine-host-unavailable"), 503)
  const intent = postAdmission(operation)
  const digest = digestSfValue(payload)
  const grant = intent.kind === "ui"
    ? await runtime.ui.admit(request, intent.operation, digest)
    : await runtime.human.admit(request, intent.action as Parameters<typeof runtime.human.admit>[1], payload)
  if (grant.status !== "ok") return reply(grant, statusCode(grant.status))
  try {
    const binding = grant.value
    const permitted = intent.kind === "ui"
      ? await runtime.ui.validate(binding, intent.operation, digest)
      : await runtime.human.authorize(binding, intent.action as Parameters<typeof runtime.human.authorize>[1], payload)
    if (!permitted) return reply(denied(), 403)
    const products = runtime.nativeUiProducts
    const result: RoutineOrSchedule = operation.startsWith("routines.")
      ? products?.routines && products.withCase
        ? await routineCall(operation, payload, products, binding).catch(() => unavailable("routine-producer-unavailable"))
        : unavailable("native-routine-port-unavailable")
      : await scheduleCall(operation, payload, products, binding).catch(() =>
        unavailable("native-schedule-operation-unavailable"))
    const stillAllowed = deps.runtime() === runtime &&
      (intent.kind === "ui"
        ? await runtime.ui.revalidate(binding)
        : await runtime.human.authorize(binding, intent.action as Parameters<typeof runtime.human.authorize>[1], payload))
    if (!stillAllowed) return reply(denied("routine-authority-changed"), 403)
    return wireResult(operation, result)
  } finally {
    if (intent.kind === "ui") runtime.ui.finish(grant.value)
    else runtime.human.finish(grant.value)
  }
}
async function post(
  operation: PostOperation, request: Request, deps: SfNativeHostDependencies,
): Promise<Response> {
  if (!validPath(request, deps, operation)) return reply(denied(), 403)
  if (request.method !== "POST") return new Response(null, { status: 405, headers: {
    Allow: "POST", ...HEADERS,
  } })
  if (request.headers.get("origin") !== deps.origin ||
      request.headers.get("content-type")?.split(";")[0]?.trim().toLowerCase() !== "application/json" ||
      !KEY.test(request.headers.get("idempotency-key") ?? "") ||
      new URL(request.url).search || request.signal.aborted) return invalid()

  const body = await readRequestBody(request, BODY_LIMIT).catch((error: unknown) =>
    error instanceof RequestBodyError ? error : new RequestBodyError(400))
  if (body instanceof RequestBodyError) return reply({ status: "invalid" }, body.status)
  const parsed: unknown = await Promise.resolve().then(() =>
    JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(body))).catch(() => undefined)
  const decoded = Schema.decodeUnknownOption(SfRoutines.operations[operation].input, {
    onExcessProperty: "error",
  })(parsed)
  if (Option.isNone(decoded)) return invalid()
  if (operation === "routines.run" && Schema.is(SfRoutinesRun.input)(decoded.value) &&
      !sameCaseRef(decoded.value.caseRef, decoded.value.input.caseRef)) return invalid()
  return authorizedPost(operation, request, deps, decoded.value)
}

async function projection(request: Request, deps: SfNativeHostDependencies): Promise<Response> {
  if (!validPath(request, deps, "projection.routine")) return reply(denied(), 403)
  if (request.method !== "GET") return new Response(null, { status: 405, headers: {
    Allow: "GET", ...HEADERS,
  } })
  const url = new URL(request.url)
  if (url.search.length > 4096 || [...url.searchParams.keys()].length !== 1 ||
      url.searchParams.getAll("runRef").length !== 1 ||
      request.body || request.headers.has("transfer-encoding") ||
      (request.headers.has("content-length") && request.headers.get("content-length") !== "0"))
    return invalid()
  const payload: unknown = { runRef: url.searchParams.get("runRef") }
  const input = Schema.decodeUnknownOption(SfRoutines.operations["projection.routine"].input, {
    onExcessProperty: "error",
  })(payload)
  if (Option.isNone(input)) return invalid()
  const sourceInput = decodeSfOperationInput("sf_routine_status", input.value)
  if (!sourceInput.ok) return invalid()
  const runtime = deps.runtime()
  if (!runtime) return reply(unavailable("routine-host-unavailable"), 503)
  const digest = digestSfValue(sourceInput.value)
  const grant = await runtime.ui.admit(request, "sf_routine_status", digest)
  if (grant.status !== "ok") return reply(grant, statusCode(grant.status))
  try {
    if (!await runtime.ui.validate(grant.value, "sf_routine_status", digest))
      return reply(denied(), 403)
    const source = await runtime.dispatch("sf_routine_status", sourceInput.value, grant.value)
      .catch(() => unavailable("routine-status-producer-unavailable"))
    if (source.status !== "ok") {
      if (deps.runtime() !== runtime || !await runtime.ui.revalidate(grant.value))
        return reply(denied("routine-authority-changed"), 403)
      return wireResult("projection.routine", {
        status: source.status,
        reason: source.reason,
      })
    }
    const result = decodeSfOperationOutput("sf_routine_status", source.result)
    if (!result.ok) return reply(unavailable("routine-source-contract-mismatch"), 503)
    if (deps.runtime() !== runtime || !await runtime.ui.revalidate(grant.value))
      return reply(denied("routine-authority-changed"), 403)
    return wireResult("projection.routine", { status: "ok", value: result.value })
  } finally {
    runtime.ui.finish(grant.value)
  }
}

/** The sole A09 HTTP leaf. I00 mounts these records through the frozen F02 router. */
export function createSfRoutinesHandlers(deps: SfNativeHostDependencies): readonly SfProjectionHandler[] {
  return Object.freeze([
    { operationId: "projection.routine" as const, handle: (request: Request) => projection(request, deps) },
    ...POSTS.map((operationId) => ({
      operationId,
      handle: (request: Request) => post(operationId, request, deps),
    })),
  ])
}
