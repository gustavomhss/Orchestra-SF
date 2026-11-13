import type { Actor, Command, Domain, Environment, NativeAction, NativeField, NativeScalar, NativeText, Result, Snapshot } from "./contract.ts"
import { changed, conflict, finite, object, rows, text } from "./contract.ts"
import type { Field, RenderContext } from "./ui.ts"
import { fields, form, metric, metricGrid, table } from "./ui.ts"
import { dashboardPages } from "../src/nav.ts"
import { WorkbookDate } from "../src/workbook-date.ts"
import { esc } from "../src/screen-shell.ts"
import { budgetVariance, contractVendor } from "../src/dashboard-role.ts"
import {
  completedQuarter,
  dashboardMoney,
  importProjects,
  itPerfColor,
  itPerfOwnerOver,
  itPerfScore,
  itPerfWeightWarn,
  onTargetCount,
  relevance,
  relevanceTier,
  riskFactorWrite,
  riskScore,
  riskTier,
  stakeholderCategory,
  stakeholderFactorWrite,
} from "../src/dashboard-accounts.ts"

export const pages = [
  "Portfolio Dashboard",
  "All Projects",
  "IT Risks",
  "Vendor Contracts",
  "Stakeholder Management",
  "IT Performance Contract",
] as const
const collections: Record<string, string> = {
  "Portfolio Dashboard": "projects",
  "All Projects": "projects",
  "IT Risks": "risks",
  "Vendor Contracts": "contracts",
  "Stakeholder Management": "stakeholders",
  "IT Performance Contract": "itperf",
}
const projectStatus = ["Planning", "In Progress", "On Hold", "Completed"]
const riskStatus = ["open", "mitigating", "monitoring", "closed"]
const milestoneStatus = ["done", "in-progress", "upcoming", "late"]
const perfStatus = ["", "ahead", "on", "behind", "complete", "rescheduled"]
const names: Record<string, string[]> = {
  projects: [
    "name",
    "desc",
    "status",
    "risk",
    "priority",
    "pm",
    "leaderId",
    "start",
    "end",
    "budget",
    "spent",
    "pct",
    "notes",
    "watch",
    "watchList",
    "milestones",
  ],
  risks: [
    "title",
    "action",
    "responsible",
    "name",
    "desc",
    "category",
    "impact",
    "probability",
    "status",
    "owner",
    "ownerId",
    "leaderId",
    "mitigation",
    "due",
    "notes",
  ],
  contracts: [
    "num",
    "renewal",
    "vendor",
    "name",
    "desc",
    "category",
    "owner",
    "ownerId",
    "start",
    "end",
    "amount",
    "amtType",
    "renewType",
    "notice",
    "eval",
    "notes",
    "currency",
  ],
  stakeholders: [
    "position",
    "name",
    "title",
    "company",
    "department",
    "role",
    "email",
    "biz",
    "iti",
    "perc",
    "priority",
    "owner",
    "action",
    "actions",
    "notes",
  ],
}

export const domain: Domain = {
  commands(snapshot, actor, environment, context) {
    const collection = Object.hasOwn(collections, context.page) ? collections[context.page] : undefined
    if (!collection || !writable(actor, collection) || !Object.hasOwn(context.view.data, collection)) return []
    if (collection === "itperf") return nativePerformanceCommands(context.page, context.view)
    const scoped = collection === "risks" && riskScoped(actor)
    const createValues = {
      ...(collection === "projects" ? { status: "Planning", risk: "Low", milestones: [] } : {}),
      ...(collection === "risks" ? { status: "open", impact: 1, probability: 1 } : {}),
      ...(collection === "contracts" ? { amtType: "total", renewType: "fixed", eval: "" } : {}),
      ...(collection === "stakeholders" ? { biz: 1, iti: 1, perc: 1 } : {}),
      ...(scoped ? { responsible: text(context.view.data.riskActorName) } : {}),
    }
    const create: Command = { page: context.page, action: "save", version: 0, values: createValues }
    const canCreate = !scoped || !deniedRisk(actor, environment, undefined, create)
    return [
      ...(canCreate ? [nativePortfolioSave(collection, create, scoped ? text(context.view.data.riskActorName) : undefined)] : []),
      ...rows(context.view.data[collection]).flatMap((row) => {
        const id = recordId(row.id)
        if (!id) return []
        const command: Command = {
          page: context.page,
          action: "save",
          id,
          version: context.view.versions[`${collection}:${id}`]?.version ?? 0,
          values: structuredClone(pick(row, names[collection])),
        }
        // The same stored-responsible predicate as execute decides row authority.
        const stored = scoped ? rows(snapshot.data.risks).find((risk) => recordId(risk.id) === id) : undefined
        if (scoped && (!stored || deniedRisk(actor, environment, stored, command))) return []
        return [
          nativePortfolioSave(collection, command, scoped ? text(context.view.data.riskActorName) : undefined),
          nativePortfolioDelete(collection, { ...command, action: "delete", values: {} }, nativePortfolioIdentity(row)),
          ...(collection === "projects" ? nativeMilestoneCommands(command, row) : []),
        ]
      }),
    ]
  },
  execute(snapshot, actor, command, environment) {
    if (!actor.canWrite) return { ok: false, status: 403 }
    const collection = Object.hasOwn(collections, command.page) ? collections[command.page] : undefined
    if (!collection) return { ok: false, status: 404 }
    if (!writable(actor, collection))
      return {
        ok: false,
        status: 403,
        errors: ["You do not have permission to edit these records."],
      }
    if (
      ![
        "save",
        "delete",
        "import",
        "save-milestone",
        "delete-milestone",
        "save-item",
        "delete-item",
        "save-sub",
        "delete-sub",
      ].includes(command.action)
    )
      return { ok: false, status: 400 }
    if (command.action === "import") return importProjectRows(snapshot, actor, command, environment, collection)
    if (collection === "itperf") return performance(snapshot, actor, command, environment)
    if (!["save", "delete", "save-milestone", "delete-milestone"].includes(command.action))
      return { ok: false, status: 400 }
    const stored = rows(snapshot.data[collection]).find((row) => recordId(row.id) === command.id)
    if (command.id && !stored) return { ok: false, status: 404 }
    if (
      collection === "risks" &&
      riskScoped(actor) &&
      (command.action === "save" || command.action === "delete") &&
      (stored || command.action === "save")
    ) {
      const denied = deniedRisk(actor, environment, stored, command)
      if (denied) return denied
    }
    const id = command.id || environment.id()
    const key = `${collection}:${id}`
    if (
      !command.id &&
      (rows(snapshot.data[collection]).some((row) => recordId(row.id) === id) || snapshot.versions[key])
    )
      return { ok: false, status: 409 }
    const stale = conflict(snapshot, key, command, stored ? publicRecord(collection, stored) : undefined)
    if (stale) return stale
    if (command.action === "delete") {
      if (!stored) return { ok: false, status: 404 }
      snapshot.data[collection] = rows(snapshot.data[collection]).filter((row) => recordId(row.id) !== id)
      changed(snapshot, key, actor, environment.at, stored, null)
      // Only trusted persisted metadata can request private-store cleanup; execution belongs to the file layer.
      return {
        ok: true,
        value: collection === "contracts" ? { deleteBlobKeys: documentKeys(stored, id) } : undefined,
      }
    }
    if (command.action.endsWith("milestone")) {
      if (collection !== "projects" || !stored) return { ok: false, status: 400 }
      const milestoneId = recordId(command.values.milestoneId)
      const milestones = rows(stored.milestones)
      const previous = milestones.find((row) => recordId(row.id) === milestoneId)
      if (milestoneId && !previous) return { ok: false, status: 404 }
      if (command.action === "delete-milestone" && !previous) return { ok: false, status: 404 }
      if (
        command.action === "save-milestone" &&
        (!text(command.values.name).trim() || !milestoneStatus.includes(text(command.values.status)))
      )
        return {
          ok: false,
          status: 422,
          errors: ["Milestone name and status are required."],
        }
      const milestone = {
        ...previous,
        ...pick(command.values, ["name", "date", "status", "notes"]),
        id: previous?.id ?? environment.id(),
      }
      const next = {
        ...stored,
        updatedAt: environment.at,
        milestones:
          command.action === "delete-milestone"
            ? milestones.filter((row) => recordId(row.id) !== milestoneId)
            : previous
              ? milestones.map((row) => (row === previous ? milestone : row))
              : [...milestones, milestone],
      }
      snapshot.data.projects = rows(snapshot.data.projects).map((row) => (row === stored ? next : row))
      changed(snapshot, key, actor, environment.at, stored, next)
      return { ok: true }
    }
    const next: Record<string, unknown> = {
      ...stored,
      ...pick(command.values, names[collection] ?? []),
      id: stored?.id ?? id,
      createdAt: stored?.createdAt ?? environment.at,
      updatedAt: environment.at,
    }
    const invalid = normalize(collection, next)
    if (invalid) return { ok: false, status: 422, errors: [invalid] }
    snapshot.data[collection] = stored
      ? rows(snapshot.data[collection]).map((row) => (row === stored ? next : row))
      : [...rows(snapshot.data[collection]), next]
    changed(snapshot, key, actor, environment.at, stored ?? null, next)
    return {
      ok: true,
      warnings:
        collection === "stakeholders" && effectivePriority(next) === "action" && !text(next.owner).trim()
          ? ["Action plan requires an owner."]
          : undefined,
    }
  },
  view(snapshot, actor, environment) {
    const summaries = Array.isArray(snapshot.data.summaries)
      ? snapshot.data.summaries.filter((entry): entry is string => typeof entry === "string")
      : []
    const allowed = new Set(
      dashboardPages(actor, summaries)
        .map((page) => collections[page])
        .filter(Boolean),
    )
    const data: Record<string, unknown> = Object.fromEntries(
      [...allowed].map((collection) => [
        collection,
        collection === "itperf"
          ? publicPerformance(object(snapshot.data.itperf))
          : rows(snapshot.data[collection]).map((row) => publicRecord(collection, row)),
      ]),
    )
    // Transient only: directory resolution is not a stored grant.
    if (allowed.has("risks") && riskScoped(actor)) {
      const riskActorName = uniqueDirectoryName(actor, environment.directory) ?? ""
      data.riskActorName = riskActorName
      data.canCreateRisk = riskActorName !== ""
      data.editableRisks = rows(snapshot.data.risks).flatMap((row) => {
        const id = recordId(row.id)
        return id !== "" && responsibleActorId(row.responsible, environment.directory) === actor.id ? [id] : []
      })
    }
    return {
      data,
      versions: Object.fromEntries(
        Object.entries(snapshot.versions).filter(([key]) =>
          key === "itperf"
            ? allowed.has("itperf")
            : key.includes(":") && key.split(":")[0] !== "itperf" && allowed.has(key.split(":")[0]),
        ),
      ),
    }
  },
}

function recordId(value: unknown) {
  return typeof value === "string" || (typeof value === "number" && Number.isFinite(value)) ? String(value) : ""
}
function writable(actor: Actor, collection: string) {
  if (!actor.canWrite) return false
  if (actor.roles.includes("admin")) return true
  if (actor.roles.includes("domain leader") && (collection === "projects" || collection === "risks")) return true
  return (
    actor.roles.includes("contributor") &&
    ["projects", "risks", "contracts"].includes(collection) &&
    (actor.assigned ?? []).includes(collection)
  )
}
function riskScoped(actor: Actor) {
  if (!actor.canWrite || !actor.roles.includes("domain leader") || actor.roles.includes("admin")) return false
  if (actor.roles.includes("contributor") && (actor.assigned ?? []).includes("risks")) return false
  return true
}
function directoryName(value: unknown) {
  return text(value).trim()
}
function responsibleActorId(responsible: unknown, directory: Environment["directory"]) {
  const name = directoryName(responsible)
  if (!name) return undefined
  const matches = directory.filter((person) => directoryName(person.name) === name)
  const match = matches.length === 1 ? matches[0] : undefined
  if (!match?.id) return undefined
  return match.id
}
function uniqueDirectoryName(actor: Actor, directory: Environment["directory"]) {
  const ownNames = directory.flatMap((person) => {
    const name = person.id === actor.id ? directoryName(person.name) : ""
    return name ? [name] : []
  })
  const name = ownNames.length > 0 && ownNames.every((entry) => entry === ownNames[0]) ? ownNames[0] : undefined
  if (!name) return undefined
  const matches = directory.filter((person) => directoryName(person.name) === name)
  const match = matches.length === 1 ? matches[0] : undefined
  if (match?.id !== actor.id) return undefined
  return name
}
// Stored responsible decides. A posted ownerId or leaderId never grants the row.
function deniedRisk(
  actor: Actor,
  environment: Environment,
  stored: Record<string, unknown> | undefined,
  command: Command,
): Result | undefined {
  const allowed = uniqueDirectoryName(actor, environment.directory)
  if (!stored) {
    if (!allowed || directoryName(command.values.responsible) !== allowed)
      return { ok: false, status: 403, errors: ["You do not have permission to edit these records."] }
    return undefined
  }
  if (responsibleActorId(stored.responsible, environment.directory) !== actor.id)
    return { ok: false, status: 403, errors: ["You do not have permission to edit these records."] }
  if (command.action === "delete" || !Object.hasOwn(command.values, "responsible")) return undefined
  const posted = directoryName(command.values.responsible)
  const storedName = directoryName(stored.responsible)
  if (posted === allowed || (posted !== "" && posted === storedName)) return undefined
  return { ok: false, status: 403, errors: ["You do not have permission to edit these records."] }
}
function editableRiskIds(value: unknown) {
  return new Set(
    Array.isArray(value)
      ? value.flatMap((id) => {
          const record = recordId(id)
          return record ? [record] : []
        })
      : [],
  )
}
function pick(value: Record<string, unknown>, keys: string[]) {
  return Object.fromEntries(keys.filter((key) => Object.hasOwn(value, key)).map((key) => [key, value[key]]))
}
function number(value: unknown) {
  return value === "" || value == null ? 0 : Number(value)
}
function normalize(collection: string, next: Record<string, unknown>): string | undefined {
  if (!text(next[collection === "contracts" ? "vendor" : "name"]).trim())
    return collection === "contracts" ? "Vendor is required." : "Name is required."
  if (collection === "projects") {
    next.status ??= "Planning"
    next.risk ??= "Low"
    next.milestones ??= []
    if (!projectStatus.includes(text(next.status)) || !["Low", "Medium", "High"].includes(text(next.risk)))
      return "Choose a project status and risk."
    for (const key of ["budget", "spent", "pct"]) {
      next[key] = number(next[key])
      if (!Number.isFinite(next[key])) return "Project amounts must be numbers."
    }
    if (rows(next.milestones).some((row) => !text(row.name).trim() || !milestoneStatus.includes(text(row.status))))
      return "Milestone name and status are required."
    for (const key of ["watch", "watchList"])
      if (Object.hasOwn(next, key)) next[key] = next[key] === true || next[key] === "true"
  }
  if (collection === "risks") {
    next.impact = riskFactorWrite(textOrNumber(next.impact))
    next.probability = riskFactorWrite(textOrNumber(next.probability))
    next.status ||= "open"
    if (!Number.isFinite(next.impact) || !Number.isFinite(next.probability)) return "Risk factors must be numbers."
    if (!riskStatus.includes(text(next.status))) return "Choose a risk status."
    delete next.score
    delete next.tier
  }
  if (collection === "contracts") {
    next.amount = number(next.amount)
    next.amtType ||= "total"
    next.renewType ||= "fixed"
    next.eval ||= ""
    if (!Number.isFinite(next.amount)) return "Amount must be a number."
    if (
      !["total", "monthly", "annual"].includes(text(next.amtType)) ||
      !["fixed", "na", "auto"].includes(text(next.renewType)) ||
      !["", "A", "B", "C", "D"].includes(text(next.eval))
    )
      return "Choose valid contract terms."
    next.vendor = contractVendor(text(next.vendor)).vendor
  }
  if (collection === "stakeholders") {
    for (const key of ["biz", "iti", "perc"]) next[key] = stakeholderFactorWrite(textOrNumber(next[key]))
    delete next.relevance
    delete next.category
  }
}
function textOrNumber(value: unknown) {
  return typeof value === "number" || typeof value === "string" ? value : undefined
}
function effectivePriority(row: Record<string, unknown>) {
  return ["action", "monitor", "low"].includes(text(row.priority))
    ? text(row.priority)
    : relevanceTier(relevance(finite(row.biz), finite(row.iti)))
}
function documentKeys(contract: Record<string, unknown>, id: string) {
  return [
    ...new Set(
      [...rows(contract.docs), ...rows(contract.documents)].flatMap((document) => {
        const documentId = recordId(document.id)
        if (!documentId || /[/\\]/.test(documentId) || [".", ".."].includes(documentId)) return []
        const key = `contracts/${id}/${documentId}`
        return document.key === undefined || document.key === key ? [key] : []
      }),
    ),
  ]
}
function scalars(value: Record<string, unknown>, keys: string[]) {
  return Object.fromEntries(
    Object.entries(pick(value, keys)).filter(
      ([, entry]) => entry == null || ["string", "number", "boolean"].includes(typeof entry),
    ),
  )
}
function publicRecord(collection: string, row: Record<string, unknown>) {
  const output = scalars(row, ["id", "createdAt", "updatedAt", ...(names[collection] ?? [])])
  if (collection === "projects")
    output.milestones = rows(row.milestones).map((milestone) =>
      scalars(milestone, ["id", "name", "date", "status", "notes"]),
    )
  if (collection === "contracts")
    output.docs = [...rows(row.docs), ...rows(row.documents)].map((document) =>
      scalars(document, ["id", "name", "size", "type", "added", "status"]),
    )
  return output
}

function importProjectRows(
  snapshot: Snapshot,
  actor: Actor,
  command: Command,
  environment: Environment,
  collection: string,
): Result {
  if (collection !== "projects" || !actor.roles.includes("admin")) return { ok: false, status: 403 }
  if (!["update", "replace"].includes(text(command.values.mode))) return { ok: false, status: 422 }
  const imported = rows(command.values.rows).filter(
    (row) =>
      text(row.name).trim() !== "" &&
      !text(row.name).trim().startsWith("—"),
  )
  if (imported.some((row) => row._status !== "error" &&
    (WorkbookDate.parse(row.start) === undefined || WorkbookDate.parse(row.end) === undefined)))
    return { ok: false, status: 422, errors: ["Invalid project date"] }
  const projects = rows(snapshot.data.projects).map((row) => ({
    ...row,
    id: recordId(row.id),
    name: text(row.name),
  }))
  const affected =
    text(command.values.mode) === "replace"
      ? projects
      : projects.filter(
          (project) =>
            imported.some(
              (row) =>
                row._status !== "error" && text(row.name).trim().toLowerCase() === project.name.trim().toLowerCase(),
            ) &&
            projects.find((row) => row.name.trim().toLowerCase() === project.name.trim().toLowerCase()) === project,
        )
  for (const project of affected) {
    const key = `projects:${project.id}`
    const version = object(command.values.versions)[key] ?? textOrNumber(command.values[`version:${key}`])
    const numericVersion = typeof version === "string" && /^\d+$/.test(version) ? Number(version) : version
    if (!Number.isSafeInteger(numericVersion))
      return {
        ok: false,
        status: 422,
        errors: ["Read the latest project versions before importing."],
      }
    const stale = conflict(snapshot, key, { ...command, version: Number(numericVersion) }, publicRecord("projects", project))
    if (stale) return stale
  }
  const result = importProjects(
    projects,
    [],
    imported.map((row) => {
      const pct = typeof row.pct === "string" ? row.pct.trim() : row.pct
      return {
        ...row,
        ...(Object.hasOwn(row, "start") ? { start: WorkbookDate.parse(row.start) } : {}),
        ...(Object.hasOwn(row, "end") ? { end: WorkbookDate.parse(row.end) } : {}),
        name: text(row.name),
        status: typeof row.status === "string" ? row.status.trim() || "Planning" : (row.status ?? "Planning"),
        risk: typeof row.risk === "string" ? row.risk.trim() || "Low" : (row.risk ?? "Low"),
        priority:
          typeof row.priority === "string" ? row.priority.trim() || "Medium" : (row.priority ?? "Medium"),
        pct:
          pct === "" || pct == null
            ? 0
            : typeof pct === "string" && pct.endsWith("%") && pct.slice(0, -1).trim() !== ""
              ? Number(pct.slice(0, -1).trim())
              : pct,
      }
    }),
    text(command.values.mode) === "replace" ? "replace" : "update",
    command.confirmed === true,
    environment.at,
    environment.id,
  )
  if (!result.ok)
    return {
      ok: false,
      status: 422,
      errors: ["Valid project rows and confirmation for replacement are required."],
    }
  if (new Set(result.projects.map((row) => row.id)).size !== result.projects.length)
    return {
      ok: false,
      status: 422,
      errors: ["Project identifiers must be unique."],
    }
  for (const project of result.projects.filter(
    (row) =>
      imported.some(
        (input) => input._status !== "error" && text(input.name).trim().toLowerCase() === row.name.trim().toLowerCase(),
      ) &&
      result.projects.find((project) => project.name.trim().toLowerCase() === row.name.trim().toLowerCase()) === row,
  )) {
    const invalid = normalize("projects", project)
    if (invalid) return { ok: false, status: 422, errors: [invalid] }
  }
  if (
    result.projects.some(
      (project) => !projects.some((row) => row.id === project.id) && snapshot.versions[`projects:${project.id}`],
    )
  )
    return { ok: false, status: 409 }
  const nextProjects = result.projects.map((project) => ({
    ...project,
    id: rows(snapshot.data.projects).find((row) => recordId(row.id) === project.id)?.id ?? project.id,
  }))
  const nextIds = new Set(nextProjects.map((row) => recordId(row.id)))
  for (const previous of affected.filter((row) => !nextIds.has(row.id)))
    changed(snapshot, `projects:${previous.id}`, actor, environment.at, previous, null)
  for (const project of nextProjects) {
    const previous = rows(snapshot.data.projects).find((row) => recordId(row.id) === recordId(project.id))
    if (!previous || JSON.stringify(previous) !== JSON.stringify(project)) {
      changed(snapshot, `projects:${project.id}`, actor, environment.at, previous ?? null, project)
    }
  }
  snapshot.data.projects = nextProjects
  return { ok: true, value: { added: result.added, updated: result.updated } }
}

const itemFields = [
  "id",
  "name",
  "color",
  "totalWeight",
  "ownerWeight",
  "co1Weight",
  "co2Weight",
  "expanded",
  "description",
  "subs",
]
const subFields = [
  "id",
  "label",
  "objective",
  "target",
  "description",
  "totalWeight",
  "owner",
  "ownerWeight",
  "co1",
  "co1Weight",
  "co2",
  "co2Weight",
  "score",
  "status",
  "q1",
  "q2",
  "q3",
  "q4",
  "statusQ1",
  "statusQ2",
  "statusQ3",
  "statusQ4",
  "notes",
]
function publicPerformance(value: Record<string, unknown>) {
  return {
    ...scalars(value, ["name", "year"]),
    items: rows(value.items).map((item) => ({
      ...scalars(item, itemFields),
      subs: rows(item.subs).map((sub) => scalars(sub, subFields)),
    })),
  }
}
function performance(snapshot: Snapshot, actor: Actor, command: Command, environment: Environment): Result {
  if (!["save", "save-item", "delete-item", "save-sub", "delete-sub"].includes(command.action))
    return { ok: false, status: 400 }
  const stored = object(snapshot.data.itperf)
  const stale = conflict(snapshot, "itperf", command, stored)
  if (stale) return stale
  const next = structuredClone(stored)
  if (command.action === "save") {
    Object.assign(next, pick(command.values, ["name", "year"]))
    if (Object.hasOwn(command.values, "items")) {
      if (!Array.isArray(command.values.items)) return { ok: false, status: 422 }
      next.items = rows(command.values.items).map((item) => {
        const previous = rows(stored.items).find((row) => recordId(row.id) === recordId(item.id))
        return {
          ...previous,
          ...pick(item, itemFields),
          id: previous?.id ?? environment.id(),
          subs: Object.hasOwn(item, "subs")
            ? rows(item.subs).map((sub) => {
                const prior = rows(previous?.subs).find((row) => recordId(row.id) === recordId(sub.id))
                return {
                  ...prior,
                  ...pick(sub, subFields),
                  id: prior?.id ?? environment.id(),
                }
              })
            : structuredClone(previous?.subs ?? []),
        }
      })
    }
  } else {
    const items = rows(next.items)
    const item = items.find((row) => recordId(row.id) === recordId(command.values.itemId))
    if (command.action === "save-item") {
      if (command.values.itemId && !item) return { ok: false, status: 404 }
      const value = {
        ...item,
        ...pick(command.values, [
          "name",
          "description",
          "totalWeight",
          "ownerWeight",
          "co1Weight",
          "co2Weight",
          "color",
        ]),
        id: item?.id ?? environment.id(),
        subs: item?.subs ?? [],
      }
      next.items = item ? items.map((row) => (row === item ? value : row)) : [...items, value]
    } else {
      if (!item) return { ok: false, status: 404 }
      if (command.action === "delete-item") next.items = items.filter((row) => row !== item)
      else if (["save-sub", "delete-sub"].includes(command.action)) {
        const subs = rows(item.subs)
        const sub = subs.find((row) => recordId(row.id) === recordId(command.values.subId))
        if (command.values.subId && !sub) return { ok: false, status: 404 }
        if (command.action === "delete-sub" && !sub) return { ok: false, status: 404 }
        const value = {
          ...sub,
          ...pick(
            command.values,
            subFields.filter((key) => key !== "id"),
          ),
          id: sub?.id ?? environment.id(),
        }
        item.subs =
          command.action === "delete-sub"
            ? subs.filter((row) => row !== sub)
            : sub
              ? subs.map((row) => (row === sub ? value : row))
              : [...subs, value]
      } else return { ok: false, status: 400 }
    }
  }
  const items = rows(next.items)
  const subs = items.flatMap((item) => rows(item.subs))
  if (
    new Set(items.map((item) => recordId(item.id))).size !== items.length ||
    items.some((item) => new Set(rows(item.subs).map((sub) => recordId(sub.id))).size !== rows(item.subs).length)
  )
    return {
      ok: false,
      status: 422,
      errors: ["Item identifiers must be unique."],
    }
  if (
    items.some((item) => !text(item.name).trim() || !Number.isFinite(number(item.totalWeight))) ||
    subs.some(
      (sub) =>
        !text(sub.label).trim() ||
        !perfStatus.includes(text(sub.status)) ||
        ["totalWeight", "ownerWeight", "co1Weight", "co2Weight"].some((key) => !Number.isFinite(number(sub[key]))),
    )
  )
    return {
      ok: false,
      status: 422,
      errors: ["Names, numeric weights and valid scores and statuses are required."],
    }
  for (const item of items) {
    item.totalWeight = number(item.totalWeight)
    for (const sub of rows(item.subs))
      for (const key of ["totalWeight", "ownerWeight", "co1Weight", "co2Weight"]) sub[key] = number(sub[key])
  }
  if (
    [...items, ...subs].some((sub) =>
      itPerfOwnerOver(number(sub.totalWeight), number(sub.ownerWeight), number(sub.co1Weight), number(sub.co2Weight)),
    ) &&
    command.confirmed !== true
  )
    return {
      ok: false,
      status: 422,
      errors: ["Confirm owner and co-owner weights exceeding the total before saving."],
    }
  const warnings = [
    ...(itPerfWeightWarn(
      items.reduce((sum, item) => sum + number(item.totalWeight), 0),
      1,
    )
      ? ["Item weights do not total 100%."]
      : []),
    ...items
      .filter((item) =>
        itPerfWeightWarn(
          rows(item.subs).reduce((sum, sub) => sum + number(sub.totalWeight), 0),
          number(item.totalWeight),
        ),
      )
      .map((item) => `Sub-item weights differ from the weight of ${text(item.name)}.`),
  ]
  snapshot.data.itperf = next
  changed(snapshot, "itperf", actor, environment.at, stored, next)
  return { ok: true, warnings }
}

export function render(page: string, data: Record<string, unknown>, context: RenderContext): string | undefined {
  const collection = Object.hasOwn(collections, page) ? collections[page] : undefined
  if (!collection) return undefined
  const disabled = !writable(context.actor, collection)
  if (collection === "itperf") return renderPerformance(page, object(data.itperf), context, disabled)
  const query = text(data.q).trim().toLowerCase()
  const status = text(data.status)
  const filter = text(data.filter)
  const owner = text(data.owner)
  const records = rows(data[collection]).filter(
    (row) =>
      (!query ||
        [row.name, row.vendor, row.title, row.desc].some((value) => text(value).toLowerCase().includes(query))) &&
      (!status || row.status === status) &&
      (!owner || [row.owner, row.responsible, row.pm].includes(owner)) &&
      (filter !== "watch" || row.watchList === true) &&
      (filter !== "at-risk" || ["Medium", "High"].includes(text(row.risk))) &&
      (collection !== "risks" ||
        !["Critical", "Very High", "High", "Medium", "Low"].includes(filter) ||
        riskTier(riskScore(finite(row.impact), finite(row.probability))) === filter),
  )
  const filters = `<form method="get">${hidden("page", page)}${fields([{ name: "q", label: "Search", value: query }, ...(collection === "projects" || collection === "risks" ? [{ name: "status", label: "Status", type: "select" as const, value: status, options: ["", ...(collection === "projects" ? projectStatus : riskStatus)] }] : []), { name: "filter", label: collection === "risks" ? "Risk tier" : "Show", type: "select", value: filter, options: collection === "projects" ? ["", "watch", "at-risk"] : collection === "risks" ? ["", "Critical", "Very High", "High", "Medium", "Low"] : [""] }])}<button type="submit">Apply filters</button></form>`
  const definitions = recordFields(collection)
  const scopedRisks = collection === "risks" && riskScoped(context.actor)
  const editableRisks = editableRiskIds(data.editableRisks)
  const actorRiskName = text(data.riskActorName).trim()
  const editor = (row: Record<string, unknown>) => {
    const id = recordId(row.id)
    const version = context.versions[`${collection}:${id}`]?.version ?? 0
    const formDisabled = scopedRisks
      ? id
        ? !editableRisks.has(id)
        : data.canCreateRisk !== true || actorRiskName === ""
      : disabled
    const keptName = directoryName(row.responsible)
    const choiceName = actorRiskName || keptName
    return (
      form(
        page,
        "save",
        id,
        version,
        fields(
          definitions.map((field) => {
            const responsibleChoice =
              scopedRisks && field.name === "responsible" && !formDisabled && choiceName
                ? { type: "select" as const, options: [choiceName], value: choiceName }
                : undefined
            return {
              ...field,
              ...(responsibleChoice ?? {}),
              value:
                responsibleChoice?.value ??
                row[field.name] ??
                (field.name === "status" ? (collection === "projects" ? "Planning" : "open") : undefined),
              readonly: formDisabled,
            }
          }),
        )
          .replace(/(value="action"[^>]*>)action<\/option>/g, "$1Action Plan Required</option>")
          .replace(/(value="monitor"[^>]*>)monitor<\/option>/g, "$1Monitored</option>")
          .replace(/(value="low"[^>]*>)low<\/option>/g, "$1Low</option>"),
        id ? "Save changes" : "Add record",
        formDisabled,
      ) + (id ? form(page, "delete", id, version, "", "Delete record", formDisabled) : "")
    )
  }
  const header =
    collection === "projects"
      ? metricGrid([metric("Projects", String(records.length)),
        metric("At risk", String(records.filter((row) => ["Medium", "High"].includes(text(row.risk))).length)),
        metric("Budget", dashboardMoney(records.reduce((sum, row) => sum + finite(row.budget), 0)))], 3)
      : collection === "risks"
        ? metricGrid([metric("Active risks", String(records.filter((row) => row.status !== "closed").length)),
          metric(
            "Top active risks",
            String(
              records.filter(
                (row) => row.status !== "closed" && riskScore(finite(row.impact), finite(row.probability)) >= 16,
              ).length,
            ),
          )], 2)
        : collection === "contracts"
          ? metric("Contracts", String(records.length))
          : metric("Stakeholders", String(records.length))
  const content = table(
    collection === "projects"
      ? ["Project", "Status", "Risk", "Budget", "Spent", "Variance", "Progress", "Watch list"]
      : collection === "risks"
        ? ["Risk", "Owner", "Status", "Impact", "Probability", "Score", "Tier"]
        : collection === "contracts"
          ? ["Vendor", "Amount", "Amount type", "Renewal", "Evaluation", "Renewal date"]
          : ["Stakeholder", "Relevance", "Priority", "Category", "Owner"],
    records.map((row) => {
      if (collection === "projects") {
        const variance = budgetVariance(finite(row.spent), finite(row.budget))
        return [
          esc(text(row.name)),
          esc(text(row.status)),
          esc(text(row.risk)),
          esc(dashboardMoney(finite(row.budget))),
          esc(dashboardMoney(finite(row.spent))),
          variance === null ? "—" : `${variance.toFixed(1)}%`,
          `${finite(row.pct)}%`,
          row.watchList === true ? "Yes" : "No",
        ]
      }
      if (collection === "risks") {
        const score = riskScore(finite(row.impact), finite(row.probability))
        return [
          esc(text(row.name)),
          esc(text(row.responsible)),
          esc(text(row.status)),
          String(finite(row.impact)),
          String(finite(row.probability)),
          String(score),
          riskTier(score),
        ]
      }
      if (collection === "contracts")
        return [
          esc(text(row.vendor)),
          esc(dashboardMoney(finite(row.amount))),
          esc(text(row.amtType)),
          esc(text(row.renewType)),
          esc(text(row.eval)),
          esc(text(row.renewal)),
        ]
      const score = relevance(finite(row.biz), finite(row.iti))
      return [
        esc(text(row.name)),
        String(score),
        priorityLabel(effectivePriority(row)),
        esc(stakeholderCategory(score, finite(row.perc))),
        esc(text(row.owner)),
      ]
    }),
  )
  const details = records
    .map(
      (row) =>
        `<details><summary>${esc(text(row.name) || text(row.vendor))}</summary>${editor(row)}${collection === "projects" ? renderMilestones(page, row, context, disabled) : ""}${collection === "stakeholders" && effectivePriority(row) === "action" && !text(row.owner).trim() ? '<p role="status">Action plan requires an owner.</p>' : ""}${
          collection === "contracts"
            ? table(
                ["Document", "Availability"],
                rows(row.docs).map((document) => [
                  esc(text(document.name)),
                  esc(text(document.status) || "Pending scan"),
                ]),
              )
            : ""
        }</details>`,
    )
    .join("")
  const importer =
    collection === "projects"
      ? `<details><summary>Import projects</summary><p>Choose an Excel workbook to preview. Replacement requires confirmation.</p>${form(
          page,
          "import",
          "",
          0,
          rows(data.projects)
            .map((row) =>
              hidden(
                `version:projects:${recordId(row.id)}`,
                String(context.versions[`projects:${recordId(row.id)}`]?.version ?? 0),
              ),
            )
            .join("") +
            '<label>Project workbook<input type="file" name="workbook" accept=".xlsx" data-workbook="projects"></label><input type="hidden" name="rows" data-workbook-rows data-json="true"><p data-import-notice></p>' +
            fields([
              {
                name: "mode",
                label: "Import mode",
                type: "select",
                options: ["update", "replace"],
              },
              {
                name: "confirmed",
                label: "Confirm replacement",
                type: "checkbox",
              },
            ]),
          "Import projects",
          disabled || !context.actor.roles.includes("admin"),
        )}</details>`
      : ""
  return `<section>${filters}${header}${content}${details}<details open><summary>Add ${collection === "contracts" ? "contract" : collection === "stakeholders" ? "stakeholder" : collection === "risks" ? "risk" : "project"}</summary>${editor({})}</details>${importer}</section>`
}
function priorityLabel(priority: string) {
  return priority === "action" ? "Action Plan Required" : priority === "monitor" ? "Monitored" : "Low"
}
function recordFields(collection: string): Field[] {
  if (collection === "projects")
    return [
      { name: "name", label: "Project name", required: true },
      { name: "desc", label: "Description", type: "textarea" },
      {
        name: "status",
        label: "Status",
        type: "select",
        options: projectStatus,
      },
      {
        name: "risk",
        label: "Risk",
        type: "select",
        options: ["Low", "Medium", "High"],
      },
      { name: "priority", label: "Priority" },
      { name: "pm", label: "Project manager" },
      { name: "start", label: "Start", type: "date" },
      { name: "end", label: "End", type: "date" },
      { name: "budget", label: "Budget", type: "number", step: "any" },
      { name: "spent", label: "Spent", type: "number", step: "any" },
      { name: "pct", label: "Progress (%)", type: "number" },
      { name: "watchList", label: "Watch list", type: "checkbox" },
      { name: "notes", label: "Notes", type: "textarea" },
    ]
  if (collection === "risks")
    return [
      { name: "title", label: "Risk title" },
      { name: "name", label: "Risk description", required: true },
      { name: "action", label: "Action", type: "textarea" },
      { name: "responsible", label: "Responsible person" },
      { name: "desc", label: "Description", type: "textarea" },
      { name: "category", label: "Category" },
      {
        name: "impact",
        label: "Impact",
        type: "select",
        options: ["1", "2", "3", "4", "5"],
      },
      {
        name: "probability",
        label: "Probability",
        type: "select",
        options: ["1", "2", "3", "4", "5"],
      },
      { name: "status", label: "Status", type: "select", options: riskStatus },
      { name: "owner", label: "Owner" },
      { name: "mitigation", label: "Mitigation", type: "textarea" },
      { name: "due", label: "Due date", type: "date" },
      { name: "notes", label: "Notes", type: "textarea" },
    ]
  if (collection === "contracts")
    return [
      { name: "vendor", label: "Vendor", required: true },
      { name: "num", label: "Contract number" },
      { name: "renewal", label: "Renewal date", type: "date" },
      { name: "name", label: "Contract name" },
      { name: "desc", label: "Description", type: "textarea" },
      { name: "category", label: "Category" },
      { name: "owner", label: "Owner" },
      { name: "start", label: "Start", type: "date" },
      { name: "end", label: "End", type: "date" },
      { name: "amount", label: "Amount", type: "number", step: "any" },
      {
        name: "amtType",
        label: "Amount type",
        type: "select",
        options: ["total", "monthly", "annual"],
      },
      {
        name: "renewType",
        label: "Renewal",
        type: "select",
        options: ["fixed", "na", "auto"],
      },
      { name: "notice", label: "Notice period" },
      {
        name: "eval",
        label: "Evaluation",
        type: "select",
        options: ["", "A", "B", "C", "D"],
      },
      { name: "notes", label: "Notes", type: "textarea" },
    ]
  return [
    { name: "name", label: "Name", required: true },
    { name: "position", label: "Position" },
    { name: "title", label: "Title" },
    { name: "company", label: "Company" },
    { name: "department", label: "Department" },
    { name: "email", label: "Email", type: "email" },
    ...["biz", "iti", "perc"].map(
      (name): Field => ({
        name,
        label: name === "biz" ? "Business influence" : name === "iti" ? "IT influence" : "Perception",
        type: "select",
        options: ["1", "2", "3", "4", "5"],
      }),
    ),
    {
      name: "priority",
      label: "Priority",
      type: "select",
      options: ["", "action", "monitor", "low"],
    },
    { name: "owner", label: "Owner" },
    { name: "action", label: "Action plan", type: "textarea" },
    { name: "notes", label: "Notes", type: "textarea" },
  ]
}
function hidden(name: string, value: unknown) {
  return `<input type="hidden" name="${esc(name)}" value="${esc(recordId(value))}">`
}
function renderMilestones(page: string, project: Record<string, unknown>, context: RenderContext, disabled: boolean) {
  const version = context.versions[`projects:${recordId(project.id)}`]?.version ?? 0
  const editor = (milestone: Record<string, unknown>) =>
    form(
      page,
      "save-milestone",
      recordId(project.id),
      version,
      hidden("milestoneId", milestone.id) +
        fields(
          (
            [
              {
                name: "name",
                label: "Milestone name",
                value: milestone.name,
                required: true,
              },
              {
                name: "date",
                label: "Date",
                type: "date",
                value: milestone.date,
              },
              {
                name: "status",
                label: "Milestone status",
                type: "select",
                options: milestoneStatus,
                value: milestone.status ?? "upcoming",
              },
              {
                name: "notes",
                label: "Notes",
                type: "textarea",
                value: milestone.notes,
              },
            ] satisfies Field[]
          ).map((field) => ({ ...field, readonly: disabled })),
        ),
      milestone.id ? "Save milestone" : "Add milestone",
      disabled,
    )
  return `<h3>Milestones</h3>${table(
    ["Milestone", "Date", "Status"],
    rows(project.milestones).map((row) => [esc(text(row.name)), esc(text(row.date)), esc(text(row.status))]),
  )}${rows(project.milestones)
    .map(
      (row) =>
        editor(row) +
        form(
          page,
          "delete-milestone",
          recordId(project.id),
          version,
          hidden("milestoneId", row.id),
          "Delete milestone",
          disabled,
        ),
    )
    .join("")}${editor({})}`
}
function perfSubs(items: Record<string, unknown>[]) {
  return items
    .flatMap((item) => rows(item.subs))
    .map((sub) => ({
      score: textOrNumber(sub.score),
      totalWeight: number(sub.totalWeight),
      status: text(sub.status),
    }))
}
function renderPerformance(page: string, data: Record<string, unknown>, context: RenderContext, disabled: boolean) {
  const items = rows(data.items)
  const subs = perfSubs(items)
  const score = itPerfScore(subs)
  const version = context.versions.itperf?.version ?? 0
  const confirm = fields([
    {
      name: "confirmed",
      label: "Confirm weights exceeding total allocation",
      type: "checkbox",
      readonly: disabled,
    },
  ])
  const itemEditor = (item: Record<string, unknown>) =>
    form(
      page,
      "save-item",
      "",
      version,
      hidden("itemId", item.id) +
        fields(
          (
            [
              {
                name: "name",
                label: "Item name",
                value: item.name,
                required: true,
              },
              {
                name: "description",
                label: "Description",
                type: "textarea",
                value: item.description,
              },
              {
                name: "totalWeight",
                label: "Item weight (1 = 100%)",
                type: "number",
                step: "any",
                value: item.totalWeight,
              },
              ...["ownerWeight", "co1Weight", "co2Weight"].map(
                (name): Field => ({
                  name,
                  label:
                    name === "ownerWeight"
                      ? "Owner weight"
                      : name === "co1Weight"
                        ? "First co-owner weight"
                        : "Second co-owner weight",
                  type: "number",
                  step: "any",
                  value: item[name],
                }),
              ),
            ] satisfies Field[]
          ).map((field) => ({ ...field, readonly: disabled })),
        ) +
        confirm,
      item.id ? "Save item" : "Add item",
      disabled,
    )
  const subEditor = (item: Record<string, unknown>, sub: Record<string, unknown>) =>
    form(
      page,
      "save-sub",
      "",
      version,
      hidden("itemId", item.id) +
        hidden("subId", sub.id) +
        fields(
          (
            [
              {
                name: "label",
                label: "Sub-item name",
                value: sub.label,
                required: true,
              },
              {
                name: "objective",
                label: "Objective",
                type: "textarea",
                value: sub.objective,
              },
              { name: "target", label: "Target", value: sub.target },
              ...["totalWeight", "ownerWeight", "co1Weight", "co2Weight"].map(
                (name): Field => ({
                  name,
                  label:
                    name === "totalWeight"
                      ? "Total weight (1 = 100%)"
                      : name === "ownerWeight"
                        ? "Owner weight"
                        : name === "co1Weight"
                          ? "First co-owner weight"
                          : "Second co-owner weight",
                  type: "number",
                  step: "any",
                  value: sub[name],
                }),
              ),
              { name: "owner", label: "Owner", value: sub.owner },
              { name: "co1", label: "First co-owner", value: sub.co1 },
              { name: "co2", label: "Second co-owner", value: sub.co2 },
              {
                name: "score",
                label: "Score",
                type: "number",
                min: 1,
                step: "any",
                value: sub.score,
              },
              {
                name: "status",
                label: "Status",
                type: "select",
                options: perfStatus,
                value: sub.status,
              },
              ...["q1", "q2", "q3", "q4"].map(
                (name): Field => ({
                  name,
                  label: name.toUpperCase(),
                  value: sub[name],
                }),
              ),
              {
                name: "notes",
                label: "Notes",
                type: "textarea",
                value: sub.notes,
              },
            ] satisfies Field[]
          ).map((field) => ({ ...field, readonly: disabled })),
        ) +
        confirm,
      sub.id ? "Save sub-item" : "Add sub-item",
      disabled,
    )
  const warning = itPerfWeightWarn(
    items.reduce((sum, item) => sum + number(item.totalWeight), 0),
    1,
  )
    ? '<p role="status">Item weights do not total 100%.</p>'
    : ""
  const owners = [
    ...new Set(
      items
        .flatMap((item) => rows(item.subs))
        .flatMap((sub) => [text(sub.owner), text(sub.co1), text(sub.co2)])
        .filter(Boolean),
    ),
  ]
  return `<nav class="section-tabs" aria-label="Performance views"><a href="#performance-contract">Contract</a><a href="#owner-dashboard">Owner Dashboard</a></nav>${metricGrid([metric("Global score", score === null ? "—" : score.toFixed(2)), metric("On target", String(onTargetCount(subs))), metric("Most recent complete quarter", completedQuarter(context.month).toUpperCase())], 3)}<section id="performance-contract"><h2>Contract</h2>${warning}${items
    .map((item) => {
      const itemScore = itPerfScore(perfSubs([item]))
      const weightWarning = itPerfWeightWarn(
        rows(item.subs).reduce((sum, sub) => sum + number(sub.totalWeight), 0),
        number(item.totalWeight),
      )
      return `<article><h3>${esc(text(item.name))}</h3><span data-tone="${itPerfColor(itemScore)}">${itemScore === null ? "—" : itemScore.toFixed(2)}</span>${weightWarning ? '<p role="status">Sub-item weights differ from item weight.</p>' : ""}${itemEditor(item)}${form(page, "delete-item", "", version, hidden("itemId", item.id) + confirm, "Delete item", disabled)}${table(
        ["Sub-item", "Weight", "Score", "Status"],
        rows(item.subs).map((sub) => [
          esc(text(sub.label)),
          `${number(sub.totalWeight) * 100}%`,
          sub.score === "" || sub.score == null || Number.isNaN(Number(sub.score)) ? "—" : esc(String(sub.score)),
          esc(text(sub.status)),
        ]),
      )}${rows(item.subs)
        .map(
          (sub) =>
            subEditor(item, sub) +
            form(
              page,
              "delete-sub",
              "",
              version,
              hidden("itemId", item.id) + hidden("subId", sub.id) + confirm,
              "Delete sub-item",
              disabled,
            ),
        )
        .join("")}${subEditor(item, {})}</article>`
    })
    .join("")}${itemEditor({})}</section><section id="owner-dashboard"><h2>Owner Dashboard</h2>${table(
    ["Owner", "Allocated weight", "Score"],
    owners.map((owner) => {
      const assigned = items
        .flatMap((item) => rows(item.subs))
        .filter((sub) => [sub.owner, sub.co1, sub.co2].includes(owner))
      const entries = assigned.map((sub) => ({
        score: textOrNumber(sub.score),
        totalWeight:
          (sub.owner === owner ? number(sub.ownerWeight) : 0) +
          (sub.co1 === owner ? number(sub.co1Weight) : 0) +
          (sub.co2 === owner ? number(sub.co2Weight) : 0),
      }))
      const ownerScore = itPerfScore(entries)
      return [
        esc(owner),
        `${entries.reduce((sum, entry) => sum + entry.totalWeight, 0) * 100}%`,
        ownerScore === null ? "—" : ownerScore.toFixed(2),
      ]
    }),
  )}</section>`
}

export const DashboardPortfolio = { pages, domain, render }

const nativePortfolioLabels: Record<string, NativeText> = {
  projects: { en: "Projects", br: "Projetos" },
  risks: { en: "Risks", br: "Riscos" },
  contracts: { en: "Contracts", br: "Contratos" },
  stakeholders: { en: "Stakeholders", br: "Partes interessadas" },
  name: { en: "Name", br: "Nome" },
  desc: { en: "Description", br: "Descrição" },
  description: { en: "Description", br: "Descrição" },
  status: { en: "Status", br: "Situação" },
  risk: { en: "Risk", br: "Risco" },
  priority: { en: "Priority", br: "Prioridade" },
  pm: { en: "Project manager", br: "Gerente do projeto" },
  leaderId: { en: "Leader ID", br: "ID do líder" },
  ownerId: { en: "Owner ID", br: "ID do responsável" },
  start: { en: "Start", br: "Início" },
  end: { en: "End", br: "Fim" },
  budget: { en: "Budget", br: "Orçamento" },
  spent: { en: "Spent", br: "Gasto" },
  pct: { en: "Progress (%)", br: "Progresso (%)" },
  notes: { en: "Notes", br: "Observações" },
  watch: { en: "Watch", br: "Acompanhar" },
  watchList: { en: "Watch list", br: "Lista de acompanhamento" },
  milestones: { en: "Milestones", br: "Marcos" },
  id: { en: "ID", br: "ID" },
  title: { en: "Title", br: "Título" },
  action: { en: "Action plan", br: "Plano de ação" },
  actions: { en: "Actions", br: "Ações" },
  responsible: { en: "Responsible person", br: "Pessoa responsável" },
  category: { en: "Category", br: "Categoria" },
  impact: { en: "Impact", br: "Impacto" },
  probability: { en: "Probability", br: "Probabilidade" },
  owner: { en: "Owner", br: "Responsável" },
  mitigation: { en: "Mitigation", br: "Mitigação" },
  due: { en: "Due date", br: "Prazo" },
  vendor: { en: "Vendor", br: "Fornecedor" },
  num: { en: "Contract number", br: "Número do contrato" },
  renewal: { en: "Renewal date", br: "Data de renovação" },
  amount: { en: "Amount", br: "Valor" },
  amtType: { en: "Amount type", br: "Tipo de valor" },
  renewType: { en: "Renewal", br: "Renovação" },
  notice: { en: "Notice period", br: "Prazo de aviso" },
  eval: { en: "Evaluation", br: "Avaliação" },
  currency: { en: "Currency", br: "Moeda" },
  position: { en: "Position", br: "Cargo" },
  company: { en: "Company", br: "Empresa" },
  department: { en: "Department", br: "Departamento" },
  role: { en: "Role", br: "Função" },
  email: { en: "Email", br: "E-mail" },
  biz: { en: "Business influence", br: "Influência no negócio" },
  iti: { en: "IT influence", br: "Influência em TI" },
  perc: { en: "Perception", br: "Percepção" },
  date: { en: "Date", br: "Data" },
  label: { en: "Sub-item name", br: "Nome do subitem" },
  objective: { en: "Objective", br: "Objetivo" },
  target: { en: "Target", br: "Meta" },
  totalWeight: { en: "Total weight (1 = 100%)", br: "Peso total (1 = 100%)" },
  ownerWeight: { en: "Owner weight", br: "Peso do responsável" },
  co1Weight: { en: "First co-owner weight", br: "Peso do primeiro corresponsável" },
  co2Weight: { en: "Second co-owner weight", br: "Peso do segundo corresponsável" },
  co1: { en: "First co-owner", br: "Primeiro corresponsável" },
  co2: { en: "Second co-owner", br: "Segundo corresponsável" },
  score: { en: "Score", br: "Pontuação" },
  color: { en: "Color", br: "Cor" },
  expanded: { en: "Expanded", br: "Expandido" },
  year: { en: "Year", br: "Ano" },
  items: { en: "Items", br: "Itens" },
  subs: { en: "Sub-items", br: "Subitens" },
  q1: { en: "Q1", br: "1º trimestre" },
  q2: { en: "Q2", br: "2º trimestre" },
  q3: { en: "Q3", br: "3º trimestre" },
  q4: { en: "Q4", br: "4º trimestre" },
  statusQ1: { en: "Q1 status", br: "Situação do 1º trimestre" },
  statusQ2: { en: "Q2 status", br: "Situação do 2º trimestre" },
  statusQ3: { en: "Q3 status", br: "Situação do 3º trimestre" },
  statusQ4: { en: "Q4 status", br: "Situação do 4º trimestre" },
}
const nativePortfolioOptions: Record<string, NativeText> = {
  "": { en: "Not set", br: "Não definido" },
  Planning: { en: "Planning", br: "Planejamento" },
  "In Progress": { en: "In progress", br: "Em andamento" },
  "On Hold": { en: "On hold", br: "Em espera" },
  Completed: { en: "Completed", br: "Concluído" },
  Low: { en: "Low", br: "Baixo" },
  Medium: { en: "Medium", br: "Médio" },
  High: { en: "High", br: "Alto" },
  open: { en: "Open", br: "Aberto" },
  mitigating: { en: "Mitigating", br: "Em mitigação" },
  monitoring: { en: "Monitoring", br: "Em monitoramento" },
  closed: { en: "Closed", br: "Fechado" },
  total: { en: "Total", br: "Total" },
  monthly: { en: "Monthly", br: "Mensal" },
  annual: { en: "Annual", br: "Anual" },
  fixed: { en: "Fixed", br: "Fixa" },
  na: { en: "Not applicable", br: "Não aplicável" },
  auto: { en: "Automatic", br: "Automática" },
  action: { en: "Action Plan Required", br: "Plano de ação necessário" },
  monitor: { en: "Monitored", br: "Monitorado" },
  low: { en: "Low", br: "Baixa" },
  done: { en: "Done", br: "Concluído" },
  "in-progress": { en: "In progress", br: "Em andamento" },
  upcoming: { en: "Upcoming", br: "Previsto" },
  late: { en: "Late", br: "Atrasado" },
  ahead: { en: "Ahead", br: "Adiantado" },
  on: { en: "On target", br: "Na meta" },
  behind: { en: "Behind", br: "Atrasado" },
  complete: { en: "Complete", br: "Concluído" },
  rescheduled: { en: "Rescheduled", br: "Reprogramado" },
}

function nativePortfolioField(field: Field, value?: unknown): NativeScalar {
  const options = field.options
    ? [...new Set([...field.options, ...(typeof value === "string" || typeof value === "number" ? [String(value)] : [])])]
    : undefined
  return {
    kind: field.type === "email" ? "text" : field.type ?? "text",
    path: [field.name],
    label: nativePortfolioLabels[field.name],
    required: field.required,
    blank: "empty",
    ...(options ? { options: options.map((value) => ({ value, label: nativePortfolioOptions[value] ?? { en: value, br: value } })) } : {}),
  }
}

function nativePortfolioSave(collection: string, command: Command, responsible?: string): NativeAction {
  const definitions = recordFields(collection)
  const extra = names[collection].filter((name) => name !== "milestones" && !definitions.some((field) => field.name === name))
  const fields: NativeField[] = [...definitions, ...extra.map((name): Field => ({ name, label: name, ...(name === "watch" ? { type: "checkbox" } : {}) }))]
    .map((field) => nativePortfolioField(
      field.name === "responsible" && responsible !== undefined
        ? { ...field, type: "select", options: [responsible || text(command.values.responsible)] }
        : field,
      command.values[field.name],
    ))
  if (collection === "projects") fields.push({
    kind: "list", path: ["milestones"], label: nativePortfolioLabels.milestones,
    fields: [
      { ...nativePortfolioField({ name: "id", label: "ID" }), readOnly: true, blank: "omit" },
      ...nativeMilestoneFields(),
    ],
    add: { name: "", status: "upcoming", date: "", notes: "" }, remove: true,
  })
  return {
    key: JSON.stringify([collection, "save", command.id === undefined ? "create" : "edit", command.id ?? null]),
    label: command.id ? {
      en: `Save ${nativePortfolioLabels[collection].en}: ${nativePortfolioIdentity({ ...command.values, id: command.id })}`,
      br: `Salvar ${nativePortfolioLabels[collection].br}: ${nativePortfolioIdentity({ ...command.values, id: command.id })}`,
    } : { en: `Add ${nativePortfolioLabels[collection].en}`, br: `Adicionar ${nativePortfolioLabels[collection].br}` },
    group: nativePortfolioLabels[collection],
    ...(command.id ? { target: { collection, id: command.id } } : {}),
    command, fields,
  }
}

function nativePortfolioDelete(collection: string, command: Command, identity: string): NativeAction {
  return {
    key: JSON.stringify([collection, command.action, "edit", command.id, recordId(command.values.milestoneId)]),
    label: {
      en: `Delete ${command.action === "delete-milestone" ? "milestone" : nativePortfolioLabels[collection].en}: ${identity}`,
      br: `Excluir ${command.action === "delete-milestone" ? "marco" : nativePortfolioLabels[collection].br}: ${identity}`,
    },
    target: { collection, id: command.id ?? "" }, command, fields: [], danger: true,
    confirm: { en: "Permanently delete this record?", br: "Excluir este registro permanentemente?" },
  }
}

function nativeMilestoneFields(): NativeField[] {
  return [
    nativePortfolioField({ name: "name", label: "Name", required: true }),
    nativePortfolioField({ name: "date", label: "Date", type: "date" }),
    nativePortfolioField({ name: "status", label: "Status", type: "select", options: milestoneStatus, required: true }),
    nativePortfolioField({ name: "notes", label: "Notes", type: "textarea" }),
  ]
}

function nativeMilestoneCommands(parent: Command, project: Record<string, unknown>): NativeAction[] {
  // ID-less stored milestones are editable only through the complete parent form.
  return rows([{}, ...rows(project.milestones).filter((row) => recordId(row.id) !== "")]).flatMap((row) => {
    const id = recordId(row.id)
    const command: Command = {
      ...parent, action: "save-milestone",
      values: { status: "upcoming", ...structuredClone(pick(row, ["name", "date", "status", "notes"])), ...(id ? { milestoneId: id } : {}) },
    }
    return [
      {
        key: JSON.stringify(["projects", parent.id, "save-milestone", id ? "edit" : "create", id || null]),
        label: id ? {
          en: `Save milestone: ${nativePortfolioIdentity(project)} / ${nativePortfolioIdentity(row)}`,
          br: `Salvar marco: ${nativePortfolioIdentity(project)} / ${nativePortfolioIdentity(row)}`,
        } : { en: `Add milestone: ${nativePortfolioIdentity(project)}`, br: `Adicionar marco: ${nativePortfolioIdentity(project)}` },
        target: { collection: "projects", id: parent.id ?? "" }, command, fields: nativeMilestoneFields(),
      },
      ...(id ? [nativePortfolioDelete("projects", { ...command, action: "delete-milestone", values: { milestoneId: id } }, `${nativePortfolioIdentity(project)} / ${nativePortfolioIdentity(row)}`)] : []),
    ]
  })
}

function nativePerformanceFields(keys: readonly string[]): NativeField[] {
  return keys.map((name): NativeField => {
    if (name === "subs") return {
      kind: "list", path: [name], label: nativePortfolioLabels.subs,
      fields: nativePerformanceFields(subFields),
      add: { label: "", status: "", totalWeight: 0, ownerWeight: 0, co1Weight: 0, co2Weight: 0 }, remove: true,
    }
    return {
      kind: name === "status" ? "select" : name === "expanded" ? "checkbox"
        : ["totalWeight", "ownerWeight", "co1Weight", "co2Weight", "score", "year"].includes(name) ? "number"
        : ["description", "objective", "notes"].includes(name) ? "textarea" : "text",
      path: [name], label: nativePortfolioLabels[name],
      required: name === "name" || name === "label",
      blank: name === "id" ? "omit" : "empty",
      ...(name === "id" ? { readOnly: true } : {}),
      ...(name === "status" ? { options: perfStatus.map((value) => ({ value, label: nativePortfolioOptions[value] })) } : {}),
    }
  })
}

function nativePerformanceSave(action: NativeAction): NativeAction[] {
  // The existing wire confirmation is top-level; do not invent a values.confirmed field.
  return [action, {
    ...action, key: JSON.stringify(["confirmed-allocation", action.key]),
    label: { en: `${action.label.en} (confirm excess allocation)`, br: `${action.label.br} (confirmar alocação excedente)` },
    command: { ...action.command, confirmed: true },
    confirm: { en: "Confirm owner and co-owner weights exceeding total allocation?", br: "Confirmar pesos dos responsáveis e corresponsáveis acima da alocação total?" },
  }]
}

function nativePerformanceCommands(page: string, view: { data: Record<string, unknown>; versions: Snapshot["versions"] }): NativeAction[] {
  const data = object(view.data.itperf)
  const version = view.versions.itperf?.version ?? 0
  const action = (key: string, label: NativeText, command: Command, fields: readonly NativeField[], id = "itperf"): NativeAction => ({
    key, label, target: { collection: "itperf", id }, command, fields,
  })
  const remove = (key: string, command: Command, id: string, identity: string): NativeAction => ({
    ...action(key, {
      en: `Delete ${command.action === "delete-sub" ? "sub-item" : "item"}: ${identity}`,
      br: `Excluir ${command.action === "delete-sub" ? "subitem" : "item"}: ${identity}`,
    }, { ...command, confirmed: true }, [], id),
    danger: true, confirm: { en: "Permanently delete this item?", br: "Excluir este item permanentemente?" },
  })
  return [
    ...nativePerformanceSave(action(JSON.stringify(["itperf", "save"]), { en: `Save performance contract: ${nativePortfolioIdentity(data)}`, br: `Salvar contrato de desempenho: ${nativePortfolioIdentity(data)}` }, {
      page, action: "save", version, values: structuredClone(pick(data, ["name", "year", "items"])),
    }, [
      nativePortfolioField({ name: "name", label: "Name" }),
      nativePortfolioField({ name: "year", label: "Year", type: "number" }),
      { kind: "list", path: ["items"], label: nativePortfolioLabels.items, fields: nativePerformanceFields(itemFields), add: { name: "", totalWeight: 0, subs: [] }, remove: true },
    ])),
    ...rows([{}, ...rows(data.items)]).flatMap((item) => {
      const id = recordId(item.id)
      const command: Command = {
        page, action: "save-item", version,
        values: { ...structuredClone(pick(item, ["name", "description", "totalWeight", "ownerWeight", "co1Weight", "co2Weight", "color"])), ...(id ? { itemId: id } : {}) },
      }
      return [
        ...nativePerformanceSave(action(JSON.stringify(["itperf", "save-item", id ? "edit" : "create", id || null]), id ? {
          en: `Save item: ${nativePortfolioIdentity(data)} / ${nativePortfolioIdentity(item)}`,
          br: `Salvar item: ${nativePortfolioIdentity(data)} / ${nativePortfolioIdentity(item)}`,
        } : { en: `Add item: ${nativePortfolioIdentity(data)}`, br: `Adicionar item: ${nativePortfolioIdentity(data)}` }, command,
          nativePerformanceFields(["name", "description", "totalWeight", "ownerWeight", "co1Weight", "co2Weight", "color"]), id || "itperf")),
        ...(id ? [
          remove(JSON.stringify(["itperf", "delete-item", id]), { ...command, action: "delete-item", values: { itemId: id } }, id, `${nativePortfolioIdentity(data)} / ${nativePortfolioIdentity(item)}`),
          ...rows([{}, ...rows(item.subs)]).flatMap((sub) => {
            const subId = recordId(sub.id)
            const save: Command = {
              page, action: "save-sub", version,
              values: { ...structuredClone(pick(sub, subFields.filter((name) => name !== "id"))), itemId: id, ...(subId ? { subId } : {}) },
            }
            return [
              ...nativePerformanceSave(action(JSON.stringify(["itperf", "save-sub", id, subId ? "edit" : "create", subId || null]), subId ? {
                en: `Save sub-item: ${nativePortfolioIdentity(data)} / ${nativePortfolioIdentity(item)} / ${nativePortfolioIdentity(sub)}`,
                br: `Salvar subitem: ${nativePortfolioIdentity(data)} / ${nativePortfolioIdentity(item)} / ${nativePortfolioIdentity(sub)}`,
              } : {
                en: `Add sub-item: ${nativePortfolioIdentity(data)} / ${nativePortfolioIdentity(item)}`,
                br: `Adicionar subitem: ${nativePortfolioIdentity(data)} / ${nativePortfolioIdentity(item)}`,
              }, save, nativePerformanceFields(subFields.filter((name) => name !== "id")), id)),
              ...(subId ? [remove(JSON.stringify(["itperf", "delete-sub", id, subId]), { ...save, action: "delete-sub", values: { itemId: id, subId } }, id, `${nativePortfolioIdentity(data)} / ${nativePortfolioIdentity(item)} / ${nativePortfolioIdentity(sub)}`)] : []),
            ]
          }),
        ] : []),
      ]
    }),
  ]
}

function nativePortfolioIdentity(row: Record<string, unknown>) {
  const name = text(row.name) || text(row.title) || text(row.vendor) || text(row.label)
  const id = recordId(row.id)
  return name && id ? `${name} [${id}]` : name || id
}
