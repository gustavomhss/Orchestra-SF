import { configure, controls, roleMap } from "./admin.ts"
import { createHash } from "node:crypto"
import type { ResolvedActor, RoleRow, Surface } from "../src/identity.ts"
import { dashboardPages, plannerKeys, procurementKeys } from "../src/nav.ts"
import { WorkbookDate } from "../src/workbook-date.ts"
import { documentHtml, links, pageMain } from "../src/screen-shell.ts"
import type { Actor, Command, Domain, Environment, Persistence, Result, Snapshot } from "./contract.ts"
import { changed, conflict, object, rows, text } from "./contract.ts"
import { download } from "./downloads.ts"
import type { WorkbookLimits } from "./workbooks.ts"
import { migrateDashboard } from "../src/dashboard-role.ts"
import { prepareDashboardImport } from "./dashboard-import.ts"
import { assetLink, captureRecordAssets, deleteRecordAssets, downloadAsset, uploadAsset } from "./assets.ts"
import type { AssetKind, AssetPersistence, AssetServices, BlobTransaction } from "./assets.ts"
import { esc } from "../src/screen-shell.ts"
import type { RenderContext } from "./ui.ts"

export type Contribution = {
  pages: readonly string[]
  domain: Domain
  render: (page: string, data: Record<string, unknown>, context: RenderContext) => string | undefined
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
  presentation?: "native"
}

/** Mount this in the installation's existing fetch composition. It starts no listener and selects no database. */
export function createApplication(mount: string, application: Application) {
  if (!/^\/(?:[A-Za-z0-9_-]+\/)*[A-Za-z0-9_-]+$/.test(mount)) throw new Error("Invalid module mount")
  if (application.assets && !Object.is(application.assets.persistence, application.persistence))
    throw new Error("HTTP and jobs must use the same authoritative persistence adapter")
  if (!Number.isSafeInteger(application.maxJsonBytes) || application.maxJsonBytes <= 0)
    throw new Error("JSON request limit required")
  return async (request: Request): Promise<Response | undefined> => {
    const url = new URL(request.url)
    if (url.pathname !== mount && !url.pathname.startsWith(`${mount}/`)) return undefined
    const surface = url.pathname.slice(mount.length + 1)
    if (surface !== "dashboard" && surface !== "planner" && surface !== "procurement") return reply("Not found", 404)
    if (!["GET", "HEAD", "POST"].includes(request.method))
      return reply("Method not allowed", 405, { Allow: "GET, HEAD, POST" })
    const origin = request.headers.get("origin")
    if (
      request.method === "POST" &&
      ((origin && origin !== url.origin) || request.headers.get("sec-fetch-site") === "cross-site")
    )
      return reply("Access denied", 403)
    // Native PageState and Command have no file or blob transports. Direct callers cannot bypass the gateway.
    if (
      application.presentation === "native" &&
      ["download", "upload", "asset", "asset-link"].some((key) => url.searchParams.has(key))
    )
      return reply("Not found", 404)
    const uploading = request.method === "POST" && url.searchParams.has("upload")
    const parsed =
      request.method === "POST" && !uploading ? await readCommand(request, application.maxJsonBytes) : undefined
    if (parsed instanceof Response) return parsed
    if (application.presentation === "native" && parsed?.action === "preview-workbook")
      return reply("Not found", 404)
    const resolvedEnvironment = await application.environment(request)
    const environment =
      application.presentation === "native"
        ? {
            ...resolvedEnvironment,
            directory: resolvedEnvironment.directory.flatMap((person) =>
              typeof person?.id === "string" && typeof person?.name === "string"
                ? [{ id: person.id, name: person.name }]
                : [],
            ),
          }
        : resolvedEnvironment
    const transaction: TransactionRunner = (work) =>
      application.assets
        ? application.assets.persistence.transaction(surface, work, { signal: request.signal })
        : application.persistence.transaction(surface, work, { signal: request.signal })
    if (request.method !== "POST" && url.searchParams.has("download"))
      return serveDownload(request, surface, application, transaction, environment)
    const preparedUpload = uploading ? await prepareUpload(request, surface, application, transaction) : undefined
    if (preparedUpload instanceof Response) return preparedUpload
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
              const mapped: Record<string, unknown> = Object.fromEntries(
                Object.entries(columns)
                  .filter(([key]) => row[key] !== undefined)
                  .map(([key, field]) => [field, row[key]]),
              )
              const leaderHeader = Object.hasOwn(row, "IT Leader / Sponsor")
                ? "IT Leader / Sponsor"
                : Object.hasOwn(row, "IT Leader")
                  ? "IT Leader"
                  : undefined
              if (leaderHeader) {
                const leaderName = text(row[leaderHeader]).trim()
                const leader = leaderName
                  ? rows(snapshot.data.leaders).find(
                      (item) => text(item.name).trim().toLowerCase() === leaderName.toLowerCase(),
                    )
                  : undefined
                mapped.leaderId = leader?.id ?? ""
              }
              const start = WorkbookDate.parse(mapped.start)
              const end = WorkbookDate.parse(mapped.end)
              return {
                ...mapped,
                ...(start !== undefined && Object.hasOwn(mapped, "start") ? { start } : {}),
                ...(end !== undefined && Object.hasOwn(mapped, "end") ? { end } : {}),
                _status: text(mapped.name).trim() && start !== undefined && end !== undefined ? "valid" : "error",
              }
            }).filter(
              (project) =>
                text(object(project).name).trim() !== "" &&
                !text(object(project).name).trim().startsWith("—"),
            )
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
          if (!actor.roles.includes("admin"))
            return {
              commit: false,
              value: json({ ok: false, status: 403 }, 403),
            }
          const stale = conflict(snapshot, "dataset", parsed, snapshot.data)
          if (stale) return { commit: false, value: json(stale, 409) }
          const imported = migrateDashboard(
            object(parsed.values.data),
            actor,
            parsed.confirmed === true,
            new Date(environment.at).getFullYear(),
          )
          if (!imported.ok)
            return {
              commit: false,
              value: json({ ok: false, errors: ["Confirm dataset replacement."] }, 422),
            }
          const prepared = prepareDashboardImport(snapshot.data, imported.data)
          if (!prepared.ok) return { commit: false, value: json({ ok: false, errors: prepared.errors }, 422) }
          const before = structuredClone(snapshot.data)
          snapshot.data = prepared.data
          for (const [key, version] of Object.entries(snapshot.versions))
            if (key !== "dataset")
              snapshot.versions[key] = {
                version: version.version + 1,
                by: actor.id,
              }
          for (const collection of [
            "opexOwners",
            "opexEntries",
            "capexProjects",
            "capexEntries",
            "members",
            "leaders",
            "hotTopics",
            "projects",
            "risks",
            "contracts",
            "stakeholders",
            "opsTickets",
            "opsSLA",
            "opsHeatmap",
            "secKpi",
            "secActions",
            "secIncidents",
            "secPhishing",
          ])
            for (const record of rows(snapshot.data[collection])) {
              const key = `${collection}:${String(record.id ?? "")}`
              if (!snapshot.versions[key]) snapshot.versions[key] = { version: 1, by: actor.id }
            }
          for (const key of ["itperf", "cio", "budgetCurrentMonth", "revenueByYear"])
            if (snapshot.data[key] !== undefined && !snapshot.versions[key])
              snapshot.versions[key] = { version: 1, by: actor.id }
          changed(snapshot, "dataset", actor, environment.at, before, snapshot.data)
          snapshot.audit[snapshot.audit.length - 1].name = environment.directory.find(
            (person) => person.id === actor.id,
          )?.name
          return { commit: true, value: json({ ok: true }, 200) }
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
      const year = yearParam(url.searchParams.get("year"))
      const own = yearParam(
        url.searchParams.get(
          page === "Executive Dashboard" ? "execYear" : page === "IT Operations" ? "opsYear" : "secYear",
        ) ?? url.searchParams.get("own"),
      )
      if (year === null || own === null) return { commit: false, value: reply("Invalid year", 400) }
      const now = new Date(environment.at)
      const sidebar = year ?? 2026
      const monthParam =
        url.searchParams.get(
          page === "IT Operations"
            ? "operationsMonth"
            : page === "IT Security KPIs"
              ? "securityMonth"
              : "executiveMonth",
        ) ?? url.searchParams.get("month")
      if (monthParam && !/^([1-9]|1[0-2])$/.test(monthParam))
        return { commit: false, value: reply("Invalid month", 400) }
      const selected =
        surface === "dashboard" && ["Executive Dashboard", "IT Operations", "IT Security KPIs"].includes(page)
          ? (own ?? Math.min(2027, Math.max(2024, now.getFullYear())))
          : sidebar
      const auditBefore = snapshot.audit.length
      const view = contribution.domain.view(snapshot, actor, environment)
      const month = monthParam
        ? Number(monthParam)
        : surface === "dashboard" && page === "Executive Dashboard" && selected !== now.getFullYear()
          ? 12
          : surface === "dashboard" && page === "IT Security KPIs"
            ? Math.max(0, ...rows(view.data.secKpi)
                .filter((row) => row.year === selected && typeof row.month === "number" &&
                  Number.isInteger(row.month) && row.month >= 1 && row.month <= 12)
                .map((row) => Number(row.month))) || 12
            : now.getMonth() + 1
      if (application.presentation === "native") {
        const name = environment.directory.find((person) => person.id === actor.id && person.name.trim())?.name
        if (!name)
          return {
            commit: false,
            value: reply("Directory display name is unavailable", 503),
          }
        // view may append member-read audit. Commit those exact rows with the JSON page.
        return {
          commit: snapshot.audit.length !== auditBefore,
          value: json(
            {
              surface,
              page,
              pages: allowed,
              actor: { ...actor, name },
              year: selected,
              month,
              data: view.data,
              versions: view.versions,
              directory: environment.directory,
            },
            200,
          ),
        }
      }
      const filters = Object.fromEntries(
        [
          "version",
          "owner",
          "class",
          "q",
          "mode",
          "filter",
          "status",
          "risk",
          "priority",
          "topicStatus",
          "memberStatus",
          "projectStatus",
          "projectRisk",
          "stakeholderPriority",
          "opsMonth",
          "tab",
          "request",
          "supplier",
        ]
          .filter((key) => url.searchParams.has(key))
          .map((key) => [key, url.searchParams.get(key)]),
      )
      const content = contribution.render(
        page,
        { ...view.data, ...filters, sidebarYear: sidebar },
        {
          actor,
          year: selected,
          month,
          at: environment.at,
          versions: view.versions,
        },
      )
      if (content === undefined)
        return {
          commit: false,
          value: reply("Page implementation unavailable", 503),
        }
      const nav = allowed.map((key, index) => ({ key, index }))
      const html = documentHtml(
        surface === "dashboard" ? "CIO Dashboard" : surface === "planner" ? "IT Budget Planner" : "IT Procurement",
        surface,
        links(nav),
        pageMain(
          { drawn: true, key: page, index: allowed.indexOf(page) },
          content +
            controls(snapshot, surface, page, actor, environment) +
            privateFileControls(surface, page, actor, snapshot, environment, application.assets?.services) +
            auditControls(actor, snapshot, url.searchParams),
        ),
        fileControls(surface, page, actor, snapshot.versions.dataset?.version ?? 0, allowed, sidebar),
        surface === "dashboard"
          ? `<label>FY<select data-year="sidebar" data-query="year">${[2024, 2025, 2026, 2027].map((year) => `<option value="${year}"${year === sidebar ? " selected" : ""}>${year}</option>`).join("")}</select></label>`
          : "",
      )
      return {
        commit: snapshot.audit.length !== auditBefore,
        value: reply(request.method === "HEAD" ? null : html, 200, {
          "Content-Type": "text/html; charset=utf-8",
          "Content-Security-Policy": htmlPolicy(html),
        }),
      }
    })
    return request.method === "HEAD"
      ? new Response(null, {
          status: response.status,
          headers: response.headers,
        })
      : response
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
    return reply("Invalid command", 400)
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
function yearParam(value: string | null): number | null | undefined {
  if (!value) return undefined
  return /^202[4-7]$/.test(value) ? Number(value) : null
}
function json(value: unknown, status: number) {
  return reply(JSON.stringify(value), status, {
    "Content-Type": "application/json; charset=utf-8",
  })
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
  const script = html.match(/<script>([\s\S]*?)<\/script>/)?.[1] ?? ""
  return `default-src 'self'; script-src 'sha256-${createHash("sha256").update(script).digest("base64")}'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; object-src 'none'; base-uri 'none'; frame-ancestors 'self'; form-action 'self'`
}
function fileControls(
  surface: Surface,
  page: string,
  actor: Actor,
  version: number,
  allowed: string[],
  sidebarYear: number,
) {
  if (surface === "planner")
    return '<aside data-slot="excel"><h2>Excel</h2><a href="?download=xlsx">Export Excel</a></aside>'
  if (surface === "procurement")
    return page === "Suppliers"
      ? '<a href="?download=suppliers">Export suppliers CSV</a>'
      : '<a href="?download=register">Export register CSV</a>'
  return `<aside data-slot="footer"><details class="editor-panel"><summary>Reports and backup</summary><form method="get" class="report-form"><input type="hidden" name="page" value="${esc(page)}"><label>Format<select name="download"><option value="pptx">PowerPoint</option><option value="docx">Word</option></select></label><label>Year<select name="year">${[2024, 2025, 2026, 2027].map((year) => `<option${year === sidebarYear ? " selected" : ""}>${year}</option>`).join("")}</select></label><label>Title<input name="title"></label><fieldset><legend>Topics</legend>${allowed
    .filter((key) => key !== "Talent Review" || actor.roles.includes("admin"))
    .map(
      (key) =>
        `<label><input type="checkbox" name="topic" value="${esc(key)}"${key === "Executive Dashboard" ? " checked" : ""}>${esc(key)}</label>`,
    )
    .join(
      "",
    )}</fieldset><button>Generate Report</button></form>${actor.roles.includes("admin") ? `<a href="?download=json">Export JSON</a><form data-command="backup-import" data-page="${esc(page)}" data-record="" data-version="${version}"><label>Import JSON<input type="file" name="data" accept="application/json,.json" required></label><button${actor.canWrite ? "" : " disabled"}>Import JSON</button></form>` : ""}</details></aside>`
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

function privateFileControls(
  surface: Surface,
  page: string,
  actor: Actor,
  snapshot: import("./contract.ts").Snapshot,
  environment: Environment,
  services?: AssetServices,
) {
  if (!services) return ""
  const visible: string[] = []
  for (const asset of rows(snapshot.data.assets)) {
    const link = assetLink(snapshot, actor, environment, services, text(asset.id))
    if (link.ok && "query" in link)
      visible.push(
        `<li><a href="${esc(`?${link.query}&page=${encodeURIComponent(page)}`)}">${esc(text(asset.name))}</a></li>`,
      )
  }
  const store = object(snapshot.data.store)
  const requestRecords = Object.values(object(store.requests)).map((row) => object(object(row).request))
  const uploads =
    surface === "dashboard" && page === "Vendor Contracts"
      ? rows(snapshot.data.contracts).map((record) => ({
          id: String(record.id),
          name: text(record.vendor),
          kind: "contract",
          versionKey: `contracts:${String(record.id)}`,
          allowed:
            actor.roles.includes("admin") ||
            (actor.roles.includes("contributor") && actor.assigned?.includes("contracts") === true),
        }))
      : surface === "procurement" && page === "Suppliers"
        ? rows(store.suppliers).map((record) => ({
            id: String(record.id),
            name: text(record.legalName),
            kind: "supplier",
            versionKey: `suppliers:${String(record.id)}`,
            allowed: actor.roles.some((role) => ["admin", "supplier admin"].includes(role)),
          }))
        : surface === "procurement" && page === "Requests"
          ? requestRecords
              .filter(
                (record) =>
                  ["sourcing", "src_rejected", "po_approved", "po_issued"].includes(text(record.status)) &&
                  actor.roles.includes("buyer"),
              )
              .map((record) => ({
                id: text(record.number),
                name: text(object(record.pr).title) || text(record.number),
                kind: ["sourcing", "src_rejected"].includes(text(record.status)) ? "quote" : "signed-po",
                versionKey: `requests:${text(record.number)}`,
                allowed: true,
              }))
          : []
  if (!visible.length && !uploads.some((upload) => upload.allowed && actor.canWrite)) return ""
  return `<section><h2>Documents</h2><ul>${visible.join("")}</ul>${uploads
    .filter((upload) => upload.allowed && actor.canWrite)
    .map(
      (upload) =>
        `<form data-private-upload="${esc(upload.kind)}" data-page="${esc(page)}" data-record="${esc(upload.id)}" data-version="${snapshot.versions[upload.versionKey]?.version ?? 0}"><label>${esc(upload.name)}<input type="file" name="file" required></label><button type="submit">Upload document</button></form>`,
    )
    .join("")}</section>`
}
function auditControls(actor: Actor, snapshot: import("./contract.ts").Snapshot, query: URLSearchParams) {
  if (!actor.roles.includes("admin") || !snapshot.audit.length) return ""
  const offset = Math.max(0, Number(query.get("auditOffset")) || 0)
  const entries = snapshot.audit.toReversed().slice(offset, offset + 50)
  const next = new URLSearchParams(query)
  next.set("auditOffset", String(offset + 50))
  return `<details><summary>Audit history</summary><table><thead><tr><th>When</th><th>Who</th><th>Record</th><th>Before</th><th>After</th></tr></thead><tbody>${entries.map((entry) => `<tr><td>${esc(entry.at)}</td><td>${esc(entry.name || entry.who)}</td><td>${esc(entry.record)}</td><td>${auditValue(entry.was)}</td><td>${auditValue(entry.became)}</td></tr>`).join("")}</tbody></table>${offset + 50 < snapshot.audit.length ? `<a href="?${esc(next.toString())}">Older entries</a>` : ""}</details>`
}
function auditValue(value: unknown): string {
  if (value === null || value === undefined) return "—"
  if (Array.isArray(value))
    return `<details><summary>${value.length} records</summary>${value.map(auditValue).join("")}</details>`
  if (typeof value === "object")
    return `<dl>${Object.entries(value)
      .map(
        ([key, entry]) =>
          `<dt>${esc(key)}</dt><dd>${["iban", "account", "swift"].includes(key.toLowerCase()) ? "Protected" : auditValue(entry)}</dd>`,
      )
      .join("")}</dl>`
  return esc(String(value))
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
  const prepared = await transaction<Response | { snapshot: Snapshot; actor: Actor }>(async (snapshot) => {
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
      value: { snapshot: structuredClone(snapshot), actor },
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
      !principal.canWrite ||
      !principal.roles.some((row) => row.surface === surface && row.role !== "viewer")
    )
      return { commit: false, value: reply("Access denied", 403) }
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
