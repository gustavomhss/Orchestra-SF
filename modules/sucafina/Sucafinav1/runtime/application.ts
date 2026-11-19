import { configure, roleMap } from "./admin.ts"
import { createHash } from "node:crypto"
import type { ResolvedActor, RoleRow, Surface } from "../src/identity.ts"
import { dashboardPages, plannerKeys, procurementKeys } from "../src/nav.ts"
import { visibleRequests } from "../src/requests.ts"
import type { Actor, Command, Domain, Environment, Persistence, Result, Snapshot } from "./contract.ts"
import { object, rows, text } from "./contract.ts"
import { download } from "./downloads.ts"
import type { WorkbookLimits } from "./workbooks.ts"
import { executeDashboardBackupImport } from "./dashboard-backup.ts"
import { assetLink, captureRecordAssets, deleteRecordAssets, downloadAsset, uploadAsset } from "./assets.ts"
import type { AssetKind, AssetPersistence, AssetServices, BlobTransaction } from "./assets.ts"
import type { RenderContext } from "./ui.ts"
import { handleDashboardPreview } from "../product/integration/dashboard-preview.ts"
import { publicSfData } from "../product/integration/public-state.ts"
import { readProcurementQueueView } from "../product/procurement/queue-view.ts"
import { renderInstalledConsole } from "./installed-console.ts"


// Snapshot-only diagnostics: fixed modes and numeric metadata; never credentials or payloads.
const auditModes = new Set(["workbench", "workbench-case", "workbench-analysis", "bi-options", "decision-criteria", "decision-list", "decision-controls", "decision-create", "decision-read", "decision-source", "decision-promote", "decision-compare", "decision-portfolio-catalog", "review", "review-read", "review-agenda", "review-preserve", "review-report", "review-download", "review-update", "review-source", "review-thread-context", "collaboration-recipients", "collaboration-thread-create", "collaboration-thread-read", "collaboration-thread-reply", "collaboration-thread-edit", "collaboration-answer-prepare", "collaboration-answer-prepare-message", "collaboration-answer-confirm", "collaboration-answer-read", "collaboration-storage-version"])
const auditInFlight = new Map<number, string>()
let auditSequence = 0
const auditCounts = () => {
  const counts = new Map<string, number>()
  for (const mode of auditInFlight.values()) counts.set(mode, (counts.get(mode) ?? 0) + 1)
  return [...counts].sort(([a], [b]) => a.localeCompare(b)).map(([mode, count]) => mode + "_" + count).join("_") || "NONE"
}
if (process.env.SF_REPORTS_TRACE === "1") {
  let previousTime = performance.now(), previousCpu = process.cpuUsage()
  const timer = setInterval(() => {
    const now = performance.now(), cpu = process.cpuUsage(), gap = Math.round(now - previousTime)
    if (auditInFlight.size || gap > 2000) console.info("SF_REPORTS_TRACE_LOOP_AT_" + Date.now() + "_GAP_MS_" + gap + "_CPU_USER_MS_" + Math.round((cpu.user - previousCpu.user) / 1000) + "_CPU_SYSTEM_MS_" + Math.round((cpu.system - previousCpu.system) / 1000) + "_INFLIGHT_" + auditInFlight.size + "_" + auditCounts())
    previousTime = now
    previousCpu = cpu
  }, 1000)
  timer.unref()
}
function auditRequest(request: Request) {
  if (process.env.SF_REPORTS_TRACE !== "1") return (_response?: Response) => {}
  const url = new URL(request.url), selected = url.searchParams.get("sf")
  const pageMode = !url.searchParams.has("page") ? "other"
    : url.searchParams.has("download") ? "reports-entry"
    : url.searchParams.get("asset") === "page" ? "page-fragment"
    : url.searchParams.get("asset") === "admission" ? "page-admission" : "page-shell"
  const mode = (selected && auditModes.has(selected) ? selected : pageMode).toUpperCase().replaceAll("-", "_")
  const method = ["GET", "HEAD", "POST"].includes(request.method) ? request.method : "OTHER"
  const id = ++auditSequence, started = performance.now(), label = method + "_" + mode, cpuStarted = process.cpuUsage()
  auditInFlight.set(id, label)
  console.info("SF_REPORTS_TRACE_REQUEST_BEGIN_AT_" + Date.now() + "_ID_" + id + "_" + label + "_INFLIGHT_" + auditInFlight.size)
  return (response?: Response) => {
    auditInFlight.delete(id)
    const cpu = process.cpuUsage(cpuStarted)
    console.info("SF_REPORTS_TRACE_REQUEST_END_AT_" + Date.now() + "_ID_" + id + "_" + label + "_MS_" + Math.round(performance.now() - started) + "_CPU_USER_MS_" + Math.round(cpu.user / 1000) + "_CPU_SYSTEM_MS_" + Math.round(cpu.system / 1000) + "_STATUS_" + (response?.status ?? 0) + "_ABORTED_" + Number(request.signal.aborted) + "_INFLIGHT_" + auditInFlight.size)
  }
}

export type Contribution = {
  pages: readonly string[]
  domain: Domain
  render: (page: string, data: Record<string, unknown>, context: RenderContext) => string | undefined
}
export type ApplicationPageView = {
  data: Record<string, unknown>
  current: (snapshot: Snapshot, actor: Actor) => boolean | Promise<boolean>
  finish: () => void
}
export type Application = {
  authenticate: (
    request: Request,
    context?: { surface: Surface; roleMap: readonly RoleRow[] },
  ) => Promise<ResolvedActor | null>
  persistence: Persistence
  environment: (request: Request) => Promise<Environment>
  domains: Record<Surface, readonly Contribution[]>
  maxJsonBytes: number
  workbookLimits?: Partial<WorkbookLimits>
  assets?: { persistence: AssetPersistence; services: AssetServices }
  product?: (request: Request, surface: Surface) => Promise<Response | undefined>
  // Prepare outside the page lock; fence the retained projection against the authenticated snapshot inside it.
  productView?: (request: Request, surface: Surface, page: string | undefined) => Promise<ApplicationPageView | Response | undefined>
}

/** Mount this in the installation's existing fetch composition. It starts no listener and selects no database. */
export function createApplication(mount: string, application: Application) {
  if (!/^\/(?:[A-Za-z0-9_-]+\/)*[A-Za-z0-9_-]+$/.test(mount)) throw new Error("Invalid module mount")
  if (application.assets && !Object.is(application.assets.persistence, application.persistence))
    throw new Error("HTTP and jobs must use the same authoritative persistence adapter")
  if (!Number.isSafeInteger(application.maxJsonBytes) || application.maxJsonBytes <= 0)
    throw new Error("JSON request limit required")
  const handle = async (request: Request): Promise<Response | undefined> => {
    const url = new URL(request.url)
    if (url.pathname !== mount && !url.pathname.startsWith(`${mount}/`)) return undefined
    const surface = url.pathname.slice(mount.length + 1)
    if (surface !== "dashboard" && surface !== "planner" && surface !== "procurement") return reply("Not found", 404)
    if (!["GET", "HEAD", "POST"].includes(request.method))
      return reply("Method not allowed", 405, { Allow: "GET, HEAD, POST" })
    // A bare or empty-query console GET stays decommissioned. One page query, and no download, asset, or projection, is the installed screen.
    const decommissioned = () => reply(request.method === "HEAD" ? null : "legacy console decommissioned — use /", 404, {
      "Content-Type": "text/plain; charset=utf-8",
    })
    const origin = request.headers.get("origin")
    if (
      request.method === "POST" &&
      ((origin && origin !== url.origin) || request.headers.get("sec-fetch-site") === "cross-site")
    )
      return reply("Access denied", 403)
    const uploading = request.method === "POST" && url.searchParams.has("upload")
    // The authorized C02 JSON projection is a data contract, not a second HTML
    // console. It retains the same source selection, snapshot and revocation fence.
    const queueProjection = surface === "procurement" && ["GET", "HEAD"].includes(request.method) &&
      url.searchParams.get("projection") === "c02" &&
      ["Requests", "My approvals"].includes(url.searchParams.get("page") ?? "")
    if (queueProjection && (url.searchParams.getAll("projection").length !== 1 || url.searchParams.getAll("page").length !== 1))
      return reply("Invalid projection selection", 400)
    // Product operations own fresh authentication and transactions; never nest them in the page lock.
    const retiredPage = request.method !== "POST" && !queueProjection && !url.searchParams.has("download") && !url.searchParams.has("asset") && !url.searchParams.has("asset-link")
    const productModes = url.searchParams.getAll("sf")
    if (productModes.length && (productModes.length !== 1 || !productModes[0]))
      return reply("Invalid product operation", 400)
    const product = await application.product?.(request, surface)
    if (product) {
      // Only the installed dispatcher may recognize an explicit product view.
      // Bare console HTML remains retired; Reports owns its validated Office entry.
      if (request.method !== "POST" && product.headers.get("content-type")?.toLowerCase().includes("text/html")) {
        const denied = await admitRetiredPage(request, surface, application)
        if (denied) return denied
        const reportsEntry = surface === "dashboard" && !productModes.length &&
          url.searchParams.getAll("page").length === 1 && !!url.searchParams.get("page") &&
          url.searchParams.getAll("download").length === 1 && ["docx", "pptx"].includes(url.searchParams.get("download") ?? "")
        if (!productModes.length && !reportsEntry) return decommissioned()
      }
      return product
    }
    if (productModes.length) {
      const denied = await admitRetiredPage(request, surface, application)
      return denied ?? decommissioned()
    }
    const parsed =
      request.method === "POST" && !uploading ? await readCommand(request, application.maxJsonBytes) : undefined
    if (parsed instanceof Response) return parsed
    const environment = await application.environment(request)
    const transaction: TransactionRunner = (work) =>
      application.assets
        ? application.assets.persistence.transaction(surface, work, { signal: request.signal })
        : application.persistence.transaction(surface, work, { signal: request.signal })
    if (request.method !== "POST" && url.searchParams.has("download"))
      return serveDownload(request, surface, application, transaction, environment)
    // Native projections were dispatched by the installation; retain authorized asset GETs.
    if (retiredPage) {
      const denied = await admitRetiredPage(request, surface, application)
      if (denied) return denied
      if (singlePageShell(request, url)) {
        const rendered = await renderInstalledConsole(request, surface, application)
        if (rendered?.ok) return rendered
        const plain = await renderInstalledConsole(request, surface, { ...application, productView: undefined })
        if (plain) return plain
        if (rendered) return rendered
      }
      return decommissioned()
    }
    const preparedUpload = uploading ? await prepareUpload(request, surface, application, transaction) : undefined
    if (preparedUpload instanceof Response) return preparedUpload
    const productView = request.method === "POST" ? undefined : await application.productView?.(request, surface, url.searchParams.get("page") ?? undefined)
    if (productView instanceof Response) return productView
    const response = await transaction(async (snapshot, blobs) => {
      // Resolve current roles INSIDE the same transaction that rereads records and locks.
      const principal = await application.authenticate(request, { surface, roleMap: roleMap(snapshot, surface) })
      if (!principal || !principal.id || principal.id.startsWith("local:"))
        return { commit: false, value: reply("Authentication required", 401) }
      const access = object(object(snapshot.data.access)[principal.id])
      const roles = principal.roles.filter((row) => row.surface === surface).map((row) => row.role)
      const actor: Actor = {
        id: principal.id,
        canWrite: principal.canWrite && roles.some((role) => role !== "viewer"),
        roles,
        assigned: Array.isArray(access.assigned)
          ? access.assigned.filter((entry): entry is string => typeof entry === "string")
          : [],
        domains: Array.isArray(access.domains)
          ? access.domains.filter((entry): entry is string => typeof entry === "string")
          : [],
      }
      const summaries = Array.isArray(snapshot.data.summaries)
        ? snapshot.data.summaries.filter((entry): entry is string => typeof entry === "string")
        : []
      const allowed =
        surface === "dashboard"
          ? dashboardPages(actor, summaries)
          : surface === "planner"
            ? plannerKeys(actor)
            : procurementKeys(actor)
      if (!allowed.length) return { commit: false, value: reply("Access denied", 403) }
      const page = parsed?.page ?? url.searchParams.get("page") ?? allowed[0]
      if (!allowed.includes(page)) return { commit: false, value: reply("Access denied", 403) }
      const contribution = application.domains[surface].find((item) => item.pages.includes(page))
      if (!contribution)
        return {
          commit: false,
          value: reply("Page implementation unavailable", 503),
        }
      if (request.method === "POST" && !actor.canWrite)
        return { commit: false, value: json({ ok: false, status: 403 }, 403) }
      if (
        request.method === "POST" &&
        !environment.directory.some((person) => person.id === actor.id && person.name.trim())
      )
        return {
          commit: false,
          value: reply("Directory display name is unavailable", 503),
        }
      if (uploading) {
        const kind = url.searchParams.get("upload")
        if (!blobs || !application.assets)
          return {
            commit: false,
            value: reply("Private storage is not configured", 503),
          }
        if (
          !["contract", "quote", "signed-po", "supplier"].includes(kind ?? "") ||
          (surface === "dashboard" ? kind !== "contract" : surface !== "procurement" || kind === "contract")
        )
          return { commit: false, value: reply("Invalid attachment", 400) }
        if (
          surface === "procurement" && (kind === "quote" || kind === "signed-po") &&
          !canViewProcurementRequest(snapshot, actor, url.searchParams.get("record") ?? "")
        )
          return { commit: false, value: json({ ok: false, status: 404 }, 404) }
        const cap =
          kind === "contract"
            ? 25 * 1024 * 1024
            : (object(object(snapshot.data.store).settings).uploadCap ??
              object(snapshot.data.attachmentCap).value ??
              snapshot.data.attachmentCap)
        if (typeof cap !== "number" || cap <= 0 || !Number.isFinite(cap))
          return {
            commit: false,
            value: json({ ok: false, errors: ["Attachment limit is not configured."] }, 422),
          }
        const bytes = preparedUpload?.bytes
        if (!bytes || !preparedUpload) return { commit: false, value: reply("File required", 400) }
        if (bytes.byteLength > cap)
          return {
            commit: false,
            value: reply("File exceeds current configured limit", 413),
          }
        const version = Number(url.searchParams.get("recordVersion"))
        if (!url.searchParams.has("recordVersion") || !Number.isSafeInteger(version) || version < 0)
          return { commit: false, value: reply("Invalid version", 400) }
        const auditStart = snapshot.audit.length
        const result = await uploadAsset(
          snapshot,
          blobs,
          actor,
          {
            page,
            action: "upload",
            id: url.searchParams.get("record") ?? "",
            version,
            values: {},
          },
          environment,
          preparedUpload.services,
          kind as AssetKind,
          {
            name: url.searchParams.get("name") ?? "",
            type: request.headers.get("content-type") ?? "application/octet-stream",
            bytes,
          },
        )
        if (result.ok) {
          for (const audit of snapshot.audit.slice(auditStart))
            audit.name = environment.directory.find((person) => person.id === actor.id)?.name
          snapshot.versions.dataset = {
            version: (snapshot.versions.dataset?.version ?? 0) + 1,
            by: actor.id,
          }
        }
        return {
          commit: result.ok,
          value: json(
            result.ok ? { ok: true } : safeFailure(result, surface, page, actor),
            result.ok ? 200 : result.status,
          ),
        }
      }
      if (request.method !== "POST" && url.searchParams.get("asset") === "page") {
        const body = contribution.render(page, snapshot.data, {
          actor,
          year: Number(environment.at.slice(0, 4)),
          month: Number(environment.at.slice(5, 7)),
          at: environment.at,
          versions: snapshot.versions,
        })
        if (!body) return { commit: false, value: reply("Page implementation unavailable", 503) }
        return { commit: false, value: reply(body, 200, { "Content-Type": "text/html; charset=utf-8" }) }
      }
      if (request.method !== "POST" && url.searchParams.get("asset") === "admission")
        return { commit: false, value: new Response(null, { status: 204, headers: { "Cache-Control": "no-store" } }) }
      if (request.method !== "POST" && (url.searchParams.has("asset") || url.searchParams.has("asset-link"))) {
        if (!blobs || !application.assets)
          return {
            commit: false,
            value: reply("Private storage is not configured", 503),
          }
        if (url.searchParams.has("asset"))
          return {
            commit: false,
            value: await downloadAsset(
              snapshot,
              blobs,
              actor,
              environment,
              application.assets.services,
              url.searchParams,
            ),
          }
        const link = assetLink(
          snapshot,
          actor,
          environment,
          application.assets.services,
          url.searchParams.get("asset-link") ?? "",
        )
        return {
          commit: false,
          value: json(link, link.ok ? 200 : link.status),
        }
      }
      if (parsed) {
        if (surface === "dashboard") {
          const preview = handleDashboardPreview(snapshot, actor, parsed, environment, decodeCommand)
          if (preview) return { commit: preview.commit, value: json(preview.value, preview.value.ok ? 200 : preview.value.status) }
        }
        if (!actor.canWrite)
          return {
            commit: false,
            value: json({ ok: false, status: 403 }, 403),
          }
        if (parsed.action === "preview-workbook") {
          const raw = parsed.values.bytes
          if (!Array.isArray(raw) || raw.some((value) => !Number.isInteger(value) || value < 0 || value > 255))
            return { commit: false, value: reply("Invalid workbook", 400) }
          const { parseWorkbook, parseOperationsWorkbook } = await import("./workbooks.ts")
          const preview =
            parsed.values.kind === "operations"
              ? await parseOperationsWorkbook(new Uint8Array(raw), application.workbookLimits)
              : await parseWorkbook(new Uint8Array(raw), application.workbookLimits)
          if (preview.ok && "sheets" in preview && parsed.values.kind === "projects") {
            const input = preview.sheets["Projects Import"] ?? preview.sheets["All Projects"] ?? []
            const columns: Record<string, string> = {
              Name: "name",
              "Project Name": "name",
              Description: "desc",
              Status: "status",
              Risk: "risk",
              Priority: "priority",
              "Project Manager": "pm",
              "Start Date": "start",
              "End Date": "end",
              "Budget (USD)": "budget",
              "Spent (USD)": "spent",
              "% Complete": "pct",
              Notes: "notes",
            }
            const projects = input.map((row) => {
              const mapped = Object.fromEntries(
                Object.entries(columns)
                  .filter(([key]) => row[key] !== undefined)
                  .map(([key, field]) => [field, row[key]]),
              )
              const leader = rows(snapshot.data.leaders).find(
                (item) => text(item.name).trim().toLowerCase() === text(row["IT Leader"]).trim().toLowerCase(),
              )
              if (leader) mapped.leaderId = leader.id
              return {
                ...mapped,
                _status: text(mapped.name).trim() ? "valid" : "error",
              }
            })
            return {
              commit: false,
              value: json({ ok: true, sheets: { "Projects Import": projects } }, 200),
            }
          }
          return {
            commit: false,
            value: json(preview, preview.ok ? 200 : 422),
          }
        }
        if (parsed.action === "backup-import" && surface === "dashboard") {
          const result = executeDashboardBackupImport(snapshot, actor, parsed, environment)
          return { commit: result.commit, value: json(result.value, result.status) }
        }
        const deletionKind =
          parsed.action === "delete" && page === "Vendor Contracts"
            ? "contract"
            : parsed.action === "delete" && surface === "procurement" && page === "Suppliers"
              ? "supplier"
              : undefined
        const auditStart = snapshot.audit.length
        // Authorize and validate deletion in a staged draft before examining private metadata.
        const target = deletionKind ? structuredClone(snapshot) : snapshot
        const result = parsed.action.startsWith("configure-")
          ? configure(target, surface, actor, parsed, environment)
          : contribution.domain.execute(target, actor, parsed, environment)
        if (result.ok && deletionKind) {
          const id = parsed.id ?? ""
          const parent =
            deletionKind === "contract"
              ? rows(snapshot.data.contracts).find((row) => String(row.id) === id)
              : rows(object(snapshot.data.store).suppliers).find((row) => String(row.id) === id)
          const hasFiles =
            rows(snapshot.data.assets).some((asset) => asset.kind === deletionKind && String(asset.record) === id) ||
            [...rows(object(parent).docs), ...rows(object(parent).documents), ...rows(object(parent).attachments)]
              .length > 0
          if (hasFiles && !blobs)
            return {
              commit: false,
              value: reply("Private storage is not configured", 503),
            }
          const captured = hasFiles ? captureRecordAssets(snapshot, deletionKind, id) : undefined
          Object.assign(snapshot, target)
          if (captured && blobs) await deleteRecordAssets(snapshot, blobs, deletionKind, id, captured)
        }
        if (result.ok) {
          const name = environment.directory.find((person) => person.id === actor.id)?.name
          for (const audit of snapshot.audit.slice(auditStart)) audit.name = name
          if (surface === "procurement" && page !== "Suppliers" && page !== "Settings") {
            const records = object(object(snapshot.data.store).requests)
            for (const row of Object.values(records)) {
              const record = object(object(row).request)
              if (rows(record.history).some((line) => line.at === environment.at && line.by === actor.id))
                record.historyNames = {
                  ...object(record.historyNames),
                  [`${environment.at}|${actor.id}`]: name,
                }
            }
          }
        }
        if (result.ok)
          snapshot.versions.dataset = {
            version: (snapshot.versions.dataset?.version ?? 0) + 1,
            by: actor.id,
          }
        // Business values stay behind the authorized view boundary; the browser refreshes after a commit.
        const response = result.ok ? { ok: true, warnings: result.warnings } : safeFailure(result, surface, page, actor)
        return {
          commit: result.ok,
          value: json(response, result.ok ? 200 : result.status),
        }
      }
      if (queueProjection) {
        // Never serialize a prepared projection until the very same authorized
        // producer selection has been rechecked under the current data lock.
        const queue = readProcurementQueueView(productView?.data.procurementQueueView)
        if (!queue || !productView || !await productView.current(snapshot, actor))
          return { commit: false, value: json({ status: "unavailable", reason: "procurement-queue-unavailable" }, 503) }
        return { commit: false, value: json({ status: "ok", value: queue }, 200) }
      }
      return { commit: false, value: decommissioned() }
    }).finally(() => productView?.finish())
    return request.method === "HEAD"
      ? new Response(null, {
          status: response.status,
          headers: response.headers,
        })
      : response
  }
  return async (request: Request): Promise<Response | undefined> => {
    const finish = auditRequest(request)
    let response: Response | undefined
    try { response = await handle(request); return response }
    finally { finish(response) }
  }
}

async function readCommand(request: Request, maximum: number): Promise<Command | Response> {
  if (request.headers.get("content-type")?.split(";", 1)[0].trim() !== "application/json")
    return reply("JSON required", 415)
  const reader = request.body?.getReader()
  if (!reader) return reply("Command required", 400)
  const chunks: Uint8Array[] = []
  const size = { bytes: 0 }
  while (true) {
    const chunk = await reader.read()
    if (chunk.done) break
    size.bytes += chunk.value.byteLength
    if (size.bytes > maximum) {
      await reader.cancel()
      return reply("Request too large", 413)
    }
    chunks.push(chunk.value)
  }
  const bytes = new Uint8Array(size.bytes)
  chunks.reduce((offset, chunk) => {
    bytes.set(chunk, offset)
    return offset + chunk.byteLength
  }, 0)
  const decoded: unknown = await new Response(bytes).json().catch(() => undefined)
  return decodeCommand(decoded) ?? reply("Invalid command", 400)
}

function decodeCommand(decoded: unknown): Command | undefined {
  const input = object(decoded)
  const allowed = ["page", "action", "id", "version", "values", "confirmed"]
  if (
    !safeObject(input.values) ||
    ["__proto__", "constructor", "prototype", ".", ".."].includes(String(input.id)) ||
    Object.keys(input).some((key) => !allowed.includes(key)) ||
    !text(input.page) ||
    !text(input.action) ||
    !Number.isSafeInteger(input.version) ||
    Number(input.version) < 0 ||
    !input.values ||
    Array.isArray(input.values) ||
    typeof input.values !== "object" ||
    (input.id !== undefined && typeof input.id !== "string") ||
    (input.confirmed !== undefined && typeof input.confirmed !== "boolean")
  )
    return undefined
  return {
    page: text(input.page),
    action: text(input.action),
    id: typeof input.id === "string" ? input.id : undefined,
    version: Number(input.version),
    values: object(input.values),
    confirmed: input.confirmed === true,
  }
}

function safeFailure(result: Exclude<Result, { ok: true }>, surface: Surface, page: string, actor: Actor) {
  const privateKeys =
    surface === "planner" && !actor.roles.some((role) => ["admin", "hr", "finance"].includes(role))
      ? ["rates", "rateOverride", "cost", "inc", "salary", "fyCost", "annualCost"]
      : surface === "dashboard" &&
          ["Talent Review", "Team Structure", "Headcount Overview"].includes(page) &&
          !actor.roles.includes("admin")
        ? ["cls", "outlook", "notes"]
        : surface === "procurement" && !actor.roles.some((role) => ["admin", "supplier admin"].includes(role))
          ? ["iban", "account", "swift"]
          : []
  return { ...result, stored: redact(result.stored, privateKeys) }
}
function redact(value: unknown, privateKeys: string[]): unknown {
  if (Array.isArray(value)) return value.map((entry) => redact(entry, privateKeys))
  if (!value || typeof value !== "object") return value
  return Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => !privateKeys.includes(key))
      .map(([key, entry]) => [key, redact(entry, privateKeys)]),
  )
}
function json(value: unknown, status: number) {
  return reply(JSON.stringify(value), status, {
    "Content-Type": "application/json; charset=utf-8",
  })
}
function singlePageShell(request: Request, url: URL) {
  if (request.method !== "GET" && request.method !== "HEAD") return false
  const pages = url.searchParams.getAll("page")
  return pages.length === 1 && pages[0] !== "" && !url.searchParams.has("download") && !url.searchParams.has("asset") && !url.searchParams.has("asset-link") && !url.searchParams.has("projection")
}
async function admitRetiredPage(request: Request, surface: Surface, application: Application) {
  const principal = await application.persistence.transaction(surface, async (snapshot) => ({
    commit: false,
    value: await application.authenticate(request, { surface, roleMap: roleMap(snapshot, surface) }),
  }))
  if (!principal || !principal.id || principal.id.startsWith("local:")) return reply("Authentication required", 401)
  return undefined
}
function reply(body: string | null, status: number, headers: Record<string, string> = {}) {
  return new Response(body, {
    status,
    headers: {
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "same-origin",
      ...headers,
    },
  })
}

export function htmlPolicy(html: string) {
  const scripts = [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi)].filter((match) => !/(?:^|\s)src\s*=/i.test(match[1]!)).map((match) => `'sha256-${createHash("sha256").update(match[2]!).digest("base64")}'`)
  return `default-src 'self'; script-src ${scripts.length ? [...new Set(scripts)].join(" ") : "'none'"}; style-src 'self' 'unsafe-inline'; img-src 'self' data:; object-src 'none'; base-uri 'none'; frame-ancestors 'self'; form-action 'self'`
}
async function readBytes(request: Request, maximum: number): Promise<Uint8Array | Response> {
  const reader = request.body?.getReader()
  if (!reader) return reply("File required", 400)
  const chunks: Uint8Array[] = []
  const size = { bytes: 0 }
  while (true) {
    const next = await reader.read()
    if (next.done) break
    size.bytes += next.value.byteLength
    if (size.bytes > maximum) {
      await reader.cancel()
      return reply("File exceeds configured limit", 413)
    }
    chunks.push(next.value)
  }
  const bytes = new Uint8Array(size.bytes)
  chunks.reduce((offset, chunk) => {
    bytes.set(chunk, offset)
    return offset + chunk.byteLength
  }, 0)
  return bytes
}

function safeObject(value: unknown): boolean {
  if (Array.isArray(value)) return value.every(safeObject)
  if (!value || typeof value !== "object") return true
  return Object.entries(value).every(
    ([key, entry]) => !["__proto__", "prototype", "constructor"].includes(key) && safeObject(entry),
  )
}

type TransactionRunner = <T>(
  work: (snapshot: Snapshot, blobs?: BlobTransaction) => Promise<{ commit: boolean; value: T }>,
) => Promise<T>
async function serveDownload(
  request: Request,
  surface: Surface,
  application: Application,
  transaction: TransactionRunner,
  environment: Environment,
): Promise<Response> {
  const query = new URL(request.url).searchParams
  const kind = query.get("download") ?? ""
  const prepared = await transaction<Response | { snapshot: Snapshot; actor: Actor; sourceDigest: string }>(async (snapshot) => {
    const principal = await application.authenticate(request, { surface, roleMap: roleMap(snapshot, surface) })
    if (!principal || !principal.id || principal.id.startsWith("local:"))
      return { commit: false, value: reply("Authentication required", 401) }
    const roles = principal.roles.filter((row) => row.surface === surface).map((row) => row.role)
    const actor: Actor = {
      id: principal.id,
      canWrite: principal.canWrite && roles.some((role) => role !== "viewer"),
      roles,
    }
    const summaries = Array.isArray(snapshot.data.summaries)
      ? snapshot.data.summaries.filter((entry): entry is string => typeof entry === "string")
      : []
    const pages =
      surface === "dashboard"
        ? dashboardPages(actor, summaries)
        : surface === "planner"
          ? plannerKeys(actor)
          : procurementKeys(actor)
    if (!pages.length) return { commit: false, value: reply("Access denied", 403) }
    const kinds =
      surface === "dashboard"
        ? ["json", "pptx", "docx", "members", "opex-template"]
        : surface === "planner"
          ? ["xlsx"]
          : ["po", "register", "suppliers"]
    if (!kinds.includes(kind)) return { commit: false, value: reply("Not found", 404) }
    if (["json", "members", "opex-template"].includes(kind) && !actor.roles.includes("admin"))
      return { commit: false, value: reply("Access denied", 403) }
    const topics = query.getAll("topic")
    if (
      ["pptx", "docx"].includes(kind) &&
      topics.some(
        (topic) =>
          !(topic === "Executive Summary" ? pages.includes("Executive Dashboard") : pages.includes(topic)) ||
          (topic === "Talent Review" && !actor.roles.includes("admin")),
      )
    )
      return { commit: false, value: reply("Access denied", 403) }
    const readsMembers =
      kind === "json" ||
      kind === "members" ||
      (["pptx", "docx"].includes(kind) &&
        topics.some((topic) => ["Headcount Overview", "Talent Review"].includes(topic)))
    if (readsMembers)
      for (const member of rows(snapshot.data.members))
        snapshot.audit.push({
          who: actor.id,
          name: environment.directory.find((person) => person.id === actor.id)?.name,
          at: environment.at,
          record: `members:${String(member.id ?? "")}`,
          was: null,
          became: { read: true, member: String(member.id ?? "") },
        })
    return {
      commit: readsMembers && rows(snapshot.data.members).length > 0,
      value: { snapshot: structuredClone({ ...snapshot, data: publicSfData(snapshot.data) }), actor, sourceDigest: downloadSnapshotDigest(snapshot) },
    }
  })
  if (prepared instanceof Response)
    return request.method === "HEAD"
      ? new Response(null, {
          status: prepared.status,
          headers: prepared.headers,
        })
      : prepared
  // Office compression and file generation happen AFTER the authorized read/audit transaction commits.
  request.signal.throwIfAborted()
  const file = await download(kind, prepared.snapshot, prepared.actor, environment, query)
  request.signal.throwIfAborted()
  // Re-authorize AFTER generation. Neither a captured actor nor a completed export authorizes egress.
  const current = await transaction(async (snapshot) => {
    const principal = await application.authenticate(request, { surface, roleMap: roleMap(snapshot, surface) })
    if (!principal || !principal.id || principal.id.startsWith("local:")) return { commit: false, value: 403 }
    const roles = principal.roles.filter((row) => row.surface === surface).map((row) => row.role)
    const actor: Actor = { id: principal.id, canWrite: principal.canWrite && roles.some((role) => role !== "viewer"), roles }
    if (JSON.stringify(actor) !== JSON.stringify(prepared.actor)) return { commit: false, value: 403 }
    return { commit: false, value: downloadSnapshotDigest(snapshot) === prepared.sourceDigest ? 200 : 409 }
  })
  request.signal.throwIfAborted()
  if (current !== 200)
    return new Response(request.method === "HEAD" ? null : current === 403 ? "Access denied" : "Export source changed; download again.", {
      status: current,
      headers: { "Cache-Control": "no-store" },
    })
  if (!file.ok)
    return request.method === "HEAD"
      ? new Response(null, {
          status: file.status,
          headers: { "Cache-Control": "no-store" },
        })
      : json(file, file.status)
  return new Response(request.method === "HEAD" ? null : new Uint8Array(file.bytes), {
    headers: {
      "Content-Type": file.type,
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(file.name)}`,
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  })
}
/** The captured public surface and its versions, not private product state or read audits, define legacy export provenance. */
function downloadSnapshotDigest(snapshot: Snapshot) {
  return createHash("sha256").update(JSON.stringify({ data: publicSfData(snapshot.data), versions: snapshot.versions })).digest("hex")
}
function canViewProcurementRequest(snapshot: Snapshot, actor: { id: string; roles: string[] }, id: string) {
  const records = object(object(snapshot.data.store).requests)
  if (!Object.hasOwn(records, id)) return false
  const request = object(object(records[id]).request)
  return visibleRequests([{ createdBy: text(request.createdBy) }], actor).length > 0
}

async function prepareUpload(
  request: Request,
  surface: Surface,
  application: Application,
  transaction: TransactionRunner,
): Promise<Response | { bytes: Uint8Array; services: AssetServices }> {
  if (!application.assets) return reply("Private storage is not configured", 503)
  const query = new URL(request.url).searchParams
  const kind = query.get("upload")
  if (
    !["contract", "quote", "signed-po", "supplier"].includes(kind ?? "") ||
    (surface === "dashboard" ? kind !== "contract" : surface !== "procurement" || kind === "contract")
  )
    return reply("Invalid attachment", 400)
  const cap = await transaction<number | Response>(async (snapshot) => {
    const principal = await application.authenticate(request, { surface, roleMap: roleMap(snapshot, surface) })
    if (
      !principal ||
      !principal.id ||
      principal.id.startsWith("local:") ||
      !principal.canWrite ||
      !principal.roles.some((row) => row.surface === surface && row.role !== "viewer")
    )
      return { commit: false, value: reply("Access denied", 403) }
    if (
      surface === "procurement" && (kind === "quote" || kind === "signed-po") &&
      !canViewProcurementRequest(snapshot, {
        id: principal.id,
        roles: principal.roles.filter((row) => row.surface === surface).map((row) => row.role),
      }, query.get("record") ?? "")
    )
      return { commit: false, value: json({ ok: false, status: 404 }, 404) }
    const cap =
      kind === "contract"
        ? 25 * 1024 * 1024
        : (object(object(snapshot.data.store).settings).uploadCap ??
          object(snapshot.data.attachmentCap).value ??
          snapshot.data.attachmentCap)
    return {
      commit: false,
      value:
        typeof cap === "number" && Number.isFinite(cap) && cap > 0
          ? cap
          : reply("Attachment limit is not configured", 422),
    }
  })
  if (cap instanceof Response) return cap
  // Read and scan private bytes outside any write transaction. The final transaction rechecks all current policy/CAS.
  const bytes = await readBytes(request, cap)
  if (bytes instanceof Response) return bytes
  request.signal.throwIfAborted()
  if (
    !(await application.assets.services.scan(bytes, request.headers.get("content-type") ?? "application/octet-stream"))
  )
    return json({ ok: false, errors: ["The scanner did not accept this file."] }, 422)
  request.signal.throwIfAborted()
  const digest = createHash("sha256").update(bytes).digest("hex")
  return {
    bytes,
    services: {
      ...application.assets.services,
      scan: async (candidate) => createHash("sha256").update(candidate).digest("hex") === digest,
    },
  }
}
