import type { Actor, Command, Domain, Environment, NativeAction, NativeCommandContext, NativeField, Result, Snapshot } from "./contract.ts"
import { changed, conflict, finite, object, rows, text } from "./contract.ts"
import type { RenderContext } from "./ui.ts"
import { fields, form, metric, metricGrid, table } from "./ui.ts"
import { esc } from "../src/screen-shell.ts"
import {
  annualEntryMonths,
  applyYearAmount,
  attritionTone,
  attritionYtd,
  budgetChartSeries,
  computeBudgetTotals,
  costPerUser,
  costPerUserTone,
  dashboardMoney,
  effectiveMonthlyBudget,
  isYearDeparture,
  itUsersForMonth,
  itUsersWrite,
  onTargetCount,
  parseYearAmount,
  riskScore,
  SECURITY_KPIS,
  securityKpiStatus,
  socClosureValue,
} from "../src/dashboard-accounts.ts"
import type { BudgetData } from "../src/dashboard-accounts.ts"
export const pages = ["Executive Dashboard", "Budget Overview", "OPEX Detail", "CAPEX Projects"] as const
const budgetKeys = [
  "opexOwners",
  "opexEntries",
  "capexProjects",
  "capexEntries",
  "budgetYtd",
  "budgetCurrentMonth",
  "revenueByYear",
  "itUsersMonthly",
  "costPerUserBenchmarks",
  "deviations",
]

export const domain: Domain = {
  commands: nativeCommands,
  execute(snapshot, actor, command, environment) {
    if (!actor.canWrite) return { ok: false, status: 403 }
    if (!pages.some((page) => page === command.page)) return { ok: false, status: 400 }
    if (!budgetRole(actor)) return { ok: false, status: 403 }
    // Prepare and validate the complete business action before publishing any changes.
    const next = structuredClone(snapshot)
    const result = execute(next, actor, command, environment)
    if (result.ok) {
      snapshot.data = next.data
      snapshot.versions = next.versions
      snapshot.audit = next.audit
    }
    return result
  },
  view(snapshot, actor, environment) {
    if (!actor.roles.some((role) => ["admin", "domain leader", "viewer"].includes(role)))
      return { data: {}, versions: {} }
    const data = Object.fromEntries(
      budgetKeys
        .filter((key) => Object.hasOwn(snapshot.data, key))
        .map((key) => [key, structuredClone(snapshot.data[key])]),
    )
    const budget = budgetData(data)
    const hasOpex = Array.isArray(data.opexOwners) && Array.isArray(data.opexEntries)
    const hasCapex = Array.isArray(data.capexProjects) && Array.isArray(data.capexEntries)
    data.nativeBudgetSummaryByYear = Object.fromEntries(
      [2024, 2025, 2026, 2027].map((year) => {
        const totals = computeBudgetTotals(budget, year)
        return [year, {
          currentMonth: currentBudgetMonth(data, year, environment.at),
          ...(hasOpex ? { opex: budgetSummaryCategory(totals.opexBudget, totals.opexActual, totals.opexForecast) } : {}),
          ...(hasCapex ? { capex: budgetSummaryCategory(totals.capexBudget, totals.capexActual, totals.capexForecast) } : {}),
          ...(hasOpex && hasCapex ? {
            total: budgetSummaryCategory(totals.totalBudget, totals.totalActual, totals.totalForecast),
            monthlyBudget: budgetChartSeries(totals.totalBudget),
          } : {}),
        }]
      }),
    )
    // Executive metrics are derived here; private member notes/classification never leave this boundary.
    const members = rows(snapshot.data.members)
    // Aggregate reads still identify every member read, without logging talent or changing record versions.
    members.forEach((member) =>
      snapshot.audit.push({
        who: actor.id,
        at: environment.at,
        record: `members:${String(member.id ?? "")}`,
        was: null,
        became: null,
      }),
    )
    data.executive = {
      active: members.filter((row) => row.status === "Active").length,
      departures: members.filter((row) => isYearDeparture(text(row.status), text(row.end), environment.at.slice(0, 4)))
        .length,
      monthlyDepartures: members.filter(
        (row) => row.status === "Terminated" && text(row.end).startsWith(environment.at.slice(0, 7)),
      ).length,
      pmoActive: rows(snapshot.data.projects).filter((row) => row.status !== "Completed").length,
      pmoAtRisk: rows(snapshot.data.projects).filter(
        (row) => row.status !== "Completed" && ["High", "Medium"].includes(text(row.risk)),
      ).length,
      activeRisks: rows(snapshot.data.risks).filter((row) => row.status !== "closed").length,
    }
    data.executiveByYear = Object.fromEntries(
      [2024, 2025, 2026, 2027].map((year) => [
        year,
        {
          active: members.filter((row) => row.status === "Active").length,
          departures: members.filter((row) => isYearDeparture(text(row.status), text(row.end), String(year))).length,
          monthlyDepartures: Array.from(
            { length: 12 },
            (_, index) =>
              members.filter(
                (row) =>
                  row.status === "Terminated" &&
                  text(row.end).startsWith(`${year}-${String(index + 1).padStart(2, "0")}`),
              ).length,
          ),
        },
      ]),
    )
    data.executive = {
      ...object(data.executive),
      topRisks: rows(snapshot.data.risks).filter(
        (row) => row.status !== "closed" && riskScore(finite(row.impact), finite(row.probability)) >= 16,
      ).length,
      onTarget: onTargetCount(
        rows(object(snapshot.data.itperf).items)
          .flatMap((item) => rows(item.subs))
          .map((sub) => ({
            status: text(sub.status),
            score: typeof sub.score === "number" ? sub.score : null,
            totalWeight: finite(sub.totalWeight),
          })),
      ),
    }
    data.opsDefaultMonth = Object.fromEntries(
      [2024, 2025, 2026, 2027].flatMap((year) => {
        const months = [...rows(snapshot.data.opsTickets), ...rows(snapshot.data.opsSLA)]
          .filter((row) => row.year === year && typeof row.month === "number" &&
            Number.isInteger(row.month) && row.month >= 1 && row.month <= 12)
          .map((row) => Number(row.month))
        return months.length ? [[year, Math.max(...months)]] : []
      }),
    )
    data.executiveMonths = Object.fromEntries(
      [2024, 2025, 2026, 2027].flatMap((year) =>
        Array.from({ length: 12 }, (_, index) => {
          const month = index + 1
          const tickets = rows(snapshot.data.opsTickets)
            .filter((row) => row.year === year && finite(row.month) <= month)
            .sort((a, b) => finite(a.month) - finite(b.month))
          const slas = rows(snapshot.data.opsSLA)
            .filter((row) => row.year === year && finite(row.month) <= month)
            .sort((a, b) => finite(a.month) - finite(b.month))
          const ticket = tickets.find((row) => row.month === month)
          const sla = slas.find((row) => row.month === month)
          const average = (key: string) => {
            const present = slas.filter((row) => typeof row[key] === "number" && Number.isFinite(row[key]))
            return present.length ? present.reduce((sum, row) => sum + finite(row[key]), 0) / present.length : null
          }
          const categories =
            Array.isArray(snapshot.data.opsCats) && snapshot.data.opsCats.length
              ? snapshot.data.opsCats.filter((category): category is string => typeof category === "string")
              : ["IT Security", "Infrastructure", "Application", "IT Operations", "Others (Beyers OT)"]
          const total = (row: Record<string, unknown> | undefined, metric: string) =>
            categories
              .flatMap((category) =>
                ["Incidents", "Service Requests"].map((type) => finite(row?.[`${category}|${type}|${metric}`])),
              )
              .reduce((sum, value) => sum + value, 0)
          const opened = total(ticket, "Open")
          const closed = total(ticket, "Closed")
          const latest = tickets.at(-1)
          const security = rows(snapshot.data.secKpi)
            .filter((row) => row.year === year && finite(row.month) <= month)
            .sort((a, b) => finite(b.month) - finite(a.month))
          const kpis = SECURITY_KPIS.map((def) => {
            const latest = security
              .map((entry) => (def.key === "socClosure" ? socClosureValue(entry) : entry[def.key]))
              .find((value) => value !== undefined && value !== null && value !== "")
            const value = latest === undefined ? null : Number(latest)
            return {
              key: def.key,
              value,
              status: securityKpiStatus(def.better, def.target, def.moderate, value),
            }
          })
          return [
            `${year}:${month}`,
            {
              opened,
              closed,
              backlog: Math.max(opened - closed, 0),
              p1: rows(snapshot.data.opsHeatmap)
                .filter((row) => row.year === year && row.month === month)
                .reduce((sum, row) => sum + finite(row.p1), 0),
              incSLA: sla?.incSLA ?? null,
              svcSLA: sla?.svcSLA ?? null,
              incYtd: average("incSLA"),
              svcYtd: average("svcSLA"),
              backlogYtd: Math.max(total(latest, "Open") - total(latest, "Closed"), 0),
              kpis,
              openIncidents: rows(snapshot.data.secIncidents).filter(
                (row) => !row.contained || !row.remediated || !row.rootCause,
              ).length,
            },
          ]
        }),
      ),
    )
    data.budgetLineIds = structuredClone(object(snapshot.data.budgetLineIds)[actor.id] ?? [])
    return {
      data,
      versions: Object.fromEntries(
        Object.entries(snapshot.versions).filter(([key]) =>
          budgetKeys.some((collection) => key === collection || key.startsWith(`${collection}:`)),
        ),
      ),
    }
  },
}
function nativeCommands(snapshot: Snapshot, actor: Actor, environment: Environment, context: NativeCommandContext): NativeAction[] {
  if (!actor.canWrite || !budgetRole(actor) || !pages.some((page) => page === context.page)) return []
  const data = context.view.data
  const admin = actor.roles.includes("admin")
  const versions = Object.fromEntries(Object.entries(context.view.versions).map(([key, value]) => [key, value.version]))
  const year: NativeField = {
    kind: "number", path: ["year"], label: { en: "Year", br: "Ano" },
    readOnly: true, min: 2024, max: 2027,
  }
  const make = (
    action: string,
    label: NativeAction["label"],
    versionKey: string | undefined,
    values: Record<string, unknown>,
    fields: readonly NativeField[],
    id?: string,
    target?: NativeAction["target"],
  ): NativeAction => ({
    key: `budget:${context.page}:${action}:${target?.collection ?? "page"}:${target?.id ?? id ?? "new"}:${values.month ?? "year"}`,
    label,
    ...(target ? { target } : {}),
    command: {
      page: context.page,
      action,
      ...(id !== undefined ? { id } : {}),
      version: versionKey ? context.view.versions[versionKey]?.version ?? 0 : 0,
      values: { year: context.year, versions: { ...versions }, ...values },
    },
    fields: [year, ...fields],
  })
  if (context.page === "Executive Dashboard") {
    if (!admin) return []
    return ["save-users", "save-benchmark"].map((action) => {
      const users = action === "save-users"
      const collection = users ? "itUsersMonthly" : "costPerUserBenchmarks"
      const existing = rows(data[collection]).find((row) => row.year === context.year && (!users || row.month === context.month))
      const id = existing ? String(existing.id ?? "") : undefined
      return make(
        action,
        users ? { en: "Save IT users", br: "Salvar usuários de TI" } : { en: "Save cost per user benchmark", br: "Salvar referência de custo por usuário" },
        id !== undefined ? `${collection}:${id}` : undefined,
        {
          month: context.month,
          value: users
            ? itUsersForMonth(rows(data.itUsersMonthly).map((row) => ({ year: finite(row.year), month: finite(row.month), users: finite(row.users) })), context.month, context.year)
            : existing?.value ?? null,
        },
        [
          { kind: "number", path: ["month"], label: { en: "Month", br: "Mês" }, readOnly: true, min: 1, max: 12 },
          { kind: "number", path: ["value"], label: users ? { en: "Total IT users", br: "Total de usuários de TI" } : { en: "Cost per user benchmark", br: "Referência de custo por usuário" }, blank: "null" },
        ],
        id,
        id !== undefined ? { collection, id } : undefined,
      )
    })
  }
  if (context.page === "Budget Overview") {
    if (!admin) return []
    return [
      make("save-month", { en: "Save current month", br: "Salvar mês atual" }, "budgetCurrentMonth", {
        month: currentBudgetMonth(data, context.year, environment.at),
      }, [{ kind: "number", path: ["month"], label: { en: "Current month", br: "Mês atual" }, min: 1, max: 12, required: true }]),
      make("save-revenue", { en: "Save revenue", br: "Salvar receita" }, "revenueByYear", {
        revenue: object(data.revenueByYear)[context.year] ?? null,
      }, [{ kind: "number", path: ["revenue"], label: { en: "Revenue", br: "Receita" }, blank: "null" }]),
    ]
  }
  const capex = context.page === "CAPEX Projects"
  const collection = capex ? "capexProjects" : "opexOwners"
  const entries = capex ? "capexEntries" : "opexEntries"
  const ref = capex ? "projId" : "ownerId"
  const ownerFields: NativeField[] = [
    { kind: "text", path: ["name"], label: capex ? { en: "Project name", br: "Nome do projeto" } : { en: "Owner name", br: "Nome do responsável" }, required: true, blank: "empty" },
    { kind: "number", path: ["budget"], label: { en: "Annual budget", br: "Orçamento anual" }, blank: "null" },
  ]
  return [
    ...rows(data[collection]).filter((owner) => budgetLine(snapshot, actor, collection, owner.id)).flatMap((owner) => {
      const id = String(owner.id ?? "")
      const target = { collection, id }
      const group = { en: text(owner.name) || "Budget row", br: text(owner.name) || "Linha de orçamento" }
      return [
        make("save", capex ? { en: "Save project", br: "Salvar projeto" } : { en: "Save owner", br: "Salvar responsável" }, `${collection}:${id}`, {
          name: text(owner.name), budget: owner.budget ?? null,
        }, ownerFields, id, target),
        ...Array.from({ length: 12 }, (_, index) => {
          const month = index + 1
          const entry = rows(data[entries]).find((row) => String(row[ref] ?? row.projectId ?? "") === id && row.year === context.year && row.month === month)
          // Do not offer an update the existing command rejects for contradictory legacy CAPEX parents.
          const consistent = !entry || !capex || entry.projId === undefined || entry.projectId === undefined || String(entry.projId) === String(entry.projectId)
          const entryID = entry ? String(entry.id ?? "") : undefined
          const deviationID = `${capex ? "capex" : "opex"}-${id}-${context.year}-${month}`
          const deviation = object(object(data.deviations)[deviationID])
          const monthField: NativeField = { kind: "number", path: ["month"], label: { en: "Month", br: "Mês" }, readOnly: true, min: 1, max: 12 }
          return [
            ...(consistent ? [make("save-entry", { en: `Save month ${month}`, br: `Salvar mês ${month}` }, entryID !== undefined ? `${entries}:${entryID}` : undefined, {
              [ref]: owner.id, month,
              budget: entry?.budget ?? null, actual: entry?.actual ?? null, forecast: entry?.forecast ?? null,
            }, [
              monthField,
              { kind: "number", path: ["budget"], label: { en: "Budget", br: "Orçamento" }, blank: "null", step: 0.01 },
              { kind: "number", path: ["actual"], label: { en: "Actual", br: "Realizado" }, blank: "null", step: 0.01 },
              { kind: "number", path: ["forecast"], label: { en: "Forecast", br: "Previsão" }, blank: "null", step: 0.01 },
            ], entryID, entryID !== undefined ? { collection: entries, id: entryID } : target)] : []),
            make("save-deviation", { en: `Save deviation for month ${month}`, br: `Salvar desvio do mês ${month}` }, `deviations:${deviationID}`, {
              month, flag: text(deviation.flag), text: text(deviation.text),
            }, [
              monthField,
              { kind: "select", path: ["flag"], label: { en: "Flag", br: "Sinalização" }, blank: "empty", options: [
                { value: "", label: { en: "Automatic", br: "Automática" } },
                { value: "dev-green", label: { en: "Green", br: "Verde" } },
                { value: "dev-amber", label: { en: "Amber", br: "Amarela" } },
                { value: "dev-red", label: { en: "Red", br: "Vermelha" } },
              ] },
              { kind: "text", path: ["text"], label: { en: "Deviation notes", br: "Notas do desvio" }, blank: "empty" },
            ], id, target),
          ]
        }).flat(),
        make("annual-entry", { en: "Apply annual entry", br: "Aplicar valor anual" }, `${collection}:${id}`, {
          annual: null, field: "budget",
        }, [
          { kind: "number", path: ["annual"], label: { en: "Annual entry ÷12", br: "Valor anual ÷12" }, blank: "null", step: 0.01 },
          { kind: "select", path: ["field"], label: { en: "Field", br: "Campo" }, options: [
            { value: "budget", label: { en: "Budget", br: "Orçamento" } },
            { value: "actual", label: { en: "Actual", br: "Realizado" } },
            { value: "forecast", label: { en: "Forecast", br: "Previsão" } },
          ] },
        ], id, target),
        make("year-amount", { en: "Apply year amount", br: "Aplicar valor acumulado do ano" }, "budgetYtd", {
          amount: object(object(object(data.budgetYtd)[capex ? "capex" : "opex"])[`${context.year}:${id}`]).amount ?? null,
        }, [{ kind: "number", path: ["amount"], label: { en: "Year amount", br: "Valor acumulado do ano" }, min: 0, step: 0.01, blank: "null" }], id, target),
        {
          ...make("delete", { en: capex ? "Delete project" : "Delete owner", br: capex ? "Excluir projeto" : "Excluir responsável" }, `${collection}:${id}`, {}, [], id, target),
          danger: true,
          confirm: { en: "Delete this budget row and its monthly entries in every year?", br: "Excluir esta linha de orçamento e seus lançamentos mensais de todos os anos?" },
        },
      ].map((action) => ({
        ...action,
        group,
        label: {
          en: `${action.label.en} — ${group.en} (${id})`,
          br: `${action.label.br} — ${group.br} (${id})`,
        },
      }))
    }),
    ...(admin ? [make("save", capex ? { en: "Add project", br: "Adicionar projeto" } : { en: "Add owner", br: "Adicionar responsável" }, undefined, { name: "", budget: 0 }, ownerFields)] : []),
  ]
}

function budgetRole(actor: Actor): boolean {
  return actor.roles.includes("admin") || actor.roles.includes("domain leader")
}

function budgetLine(snapshot: Snapshot, actor: Actor, collection: string, id: unknown): boolean {
  const allowed = object(snapshot.data.budgetLineIds)[actor.id]
  // Raw legacy IDs remain inert until explicitly replaced with collection-qualified grants.
  return actor.roles.includes("admin") || (Array.isArray(allowed) && allowed.includes(`${collection}:${String(id ?? "")}`))
}

function execute(snapshot: Snapshot, actor: Actor, command: Command, environment: Environment): Result {
  const admin = actor.roles.includes("admin")
  const canLine = (collection: string, id: unknown) => budgetLine(snapshot, actor, collection, id)
  const value: Record<string, unknown> = {
    ...command.values,
    versions:
      typeof command.values.versions === "string" ? parseObject(command.values.versions) : command.values.versions,
  }
  if (typeof value.rows === "string") value.rows = parseRows(value.rows)
  const year = Number(value.year)
  const month = Number(value.month)
  const yearValid = Number.isInteger(year) && year >= 2024 && year <= 2027
  const write = (collection: string, id: string | undefined, became: unknown): Result => {
    const key = id === undefined ? collection : `${collection}:${id}`
    const was =
      id === undefined
        ? snapshot.data[collection]
        : collection === "deviations"
          ? object(snapshot.data.deviations)[id]
          : rows(snapshot.data[collection]).find((row) => String(row.id ?? "") === id)
    const version = object(value.versions)[key]
    const primary =
      command.action === "save-month"
        ? "budgetCurrentMonth"
        : command.action === "save-revenue"
          ? "revenueByYear"
          : command.action === "year-amount"
            ? "budgetYtd"
            : command.action === "save-deviation"
              ? `deviations:${command.page === "CAPEX Projects" ? "capex" : "opex"}-${command.id}-${year}-${month}`
              : undefined
    const stale = conflict(
      snapshot,
      key,
      {
        ...command,
        version:
          key === primary || (id !== undefined && id === command.id)
            ? command.version
            : typeof version === "number"
              ? version
              : was === undefined && ["year-amount", "annual-entry", "import", "delete"].includes(command.action)
                ? 0
                : command.version,
      },
      was,
    )
    if (stale) return stale
    const saved =
      collection === "capexEntries" && became !== undefined
        ? Object.fromEntries(Object.entries(object(became)).filter(([key]) => key !== "projectId"))
        : became
    if (id === undefined) snapshot.data[collection] = saved
    if (id !== undefined && collection === "deviations")
      snapshot.data.deviations = {
        ...object(snapshot.data.deviations),
        [id]: saved,
      }
    if (id !== undefined && collection !== "deviations")
      snapshot.data[collection] =
        saved === undefined
          ? rows(snapshot.data[collection]).filter((row) => String(row.id ?? "") !== id)
          : rows(snapshot.data[collection]).some((row) => String(row.id ?? "") === id)
            ? rows(snapshot.data[collection]).map((row) => (String(row.id ?? "") === id ? saved : row))
            : [...rows(snapshot.data[collection]), saved]
    changed(snapshot, key, actor, environment.at, was, saved)
    return { ok: true, value: saved }
  }
  if (command.page === "Executive Dashboard") {
    if (!["save-users", "save-benchmark"].includes(command.action)) return { ok: false, status: 400 }
    if (!admin) return { ok: false, status: 403 }
    if (!yearValid || !Number.isInteger(month) || month < 1 || month > 12) return { ok: false, status: 422 }
    const collection = command.action === "save-users" ? "itUsersMonthly" : "costPerUserBenchmarks"
    const existing = rows(snapshot.data[collection]).find(
      (row) => row.year === year && (collection === "costPerUserBenchmarks" || row.month === month),
    )
    const id = existing ? String(existing.id ?? "") : environment.id()
    const amount = itUsersWrite(typeof value.value === "number" ? value.value : text(value.value))
    return write(collection, id, {
      ...existing,
      id,
      year,
      ...(collection === "itUsersMonthly" ? { month, users: amount } : { value: amount }),
    })
  }
  if (command.page === "Budget Overview") {
    if (!["save-month", "save-revenue"].includes(command.action)) return { ok: false, status: 400 }
    if (!admin) return { ok: false, status: 403 }
    if (!yearValid) return { ok: false, status: 422 }
    if (command.action === "save-month") {
      if (!Number.isInteger(month) || month < 1 || month > 12) return { ok: false, status: 422 }
      return write("budgetCurrentMonth", undefined, {
        ...object(snapshot.data.budgetCurrentMonth),
        [year]: month,
      })
    }
    const revenue = Number(value.revenue)
    if (!Number.isFinite(revenue)) return { ok: false, status: 422 }
    const next = { ...object(snapshot.data.revenueByYear) }
    if (revenue > 0) next[year] = revenue
    if (revenue <= 0) delete next[year]
    return write("revenueByYear", undefined, next)
  }
  const capex = command.page === "CAPEX Projects"
  const collection = capex ? "capexProjects" : "opexOwners"
  const entries = capex ? "capexEntries" : "opexEntries"
  const ref = capex ? "projId" : "ownerId"
  const owners = rows(snapshot.data[collection])
  const owner = owners.find((row) => String(row.id ?? "") === command.id)
  if (
    ![
      "save",
      "delete",
      "save-entry",
      "save-deviation",
      "annual-entry",
      "year-amount",
      ...(!capex ? ["import"] : []),
    ].includes(command.action)
  )
    return { ok: false, status: 400 }
  if (command.action === "import") {
    if (!admin) return { ok: false, status: 403 }
    if (!yearValid || !rows(value.rows).length) return { ok: false, status: 422 }
    for (const row of rows(value.rows)) {
      const name = text(row.name ?? row.Owner ?? row.Name ?? row.Leader).trim()
      if (!name) return { ok: false, status: 422 }
      const months = Array.from({ length: 12 }, (_, index) =>
        Number(
          object(row.months)[index + 1] ??
            (Array.isArray(row.months) ? row.months[index] : undefined) ??
            row[["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][index]!] ??
            0,
        ),
      )
      if (months.some((amount) => !Number.isFinite(amount))) return { ok: false, status: 422 }
      const fallback = finite(row.Annual, finite(row.Total))
      const sum = months.reduce((total, amount) => total + amount, 0)
      const ownerBudget = sum === 0 ? fallback : sum
      const imported =
        sum === 0 ? (Array(12).fill(Math.round(fallback / 12)) as number[]) : months
      const found = rows(snapshot.data.opexOwners).find(
        (owner) => text(owner.name).toLowerCase() === name.toLowerCase(),
      )
      const id = found ? String(found.id ?? "") : environment.id()
      const ownerResult = write(
        collection,
        id,
        found ? { ...found, budget: ownerBudget } : { id, name, budget: ownerBudget },
      )
      if (!ownerResult.ok) return ownerResult
      for (const [index, budget] of imported.entries()) {
        const existing = rows(snapshot.data[entries]).find(
          (entry) => String(entry.ownerId) === id && entry.year === year && entry.month === index + 1,
        )
        const entryId = existing ? String(existing.id ?? "") : environment.id()
        const result = write(entries, entryId, {
          ...existing,
          id: entryId,
          ownerId: found?.id ?? id,
          year,
          month: index + 1,
          budget,
        })
        if (!result.ok) return result
      }
    }
    return { ok: true }
  }
  if (command.action === "save") {
    if (!canLine(collection, owner?.id ?? command.id) || (!owner && !admin)) return { ok: false, status: 403 }
    if (command.id && !owner) return { ok: false, status: 404 }
    const name = text(value.name).trim()
    const budget = Number(value.budget)
    if (!name || !Number.isFinite(budget)) return { ok: false, status: 422 }
    const id = owner ? String(owner.id ?? "") : environment.id()
    return write(collection, id, {
      ...owner,
      id: owner?.id ?? id,
      name,
      budget,
      ...(capex ? { status: owner ? owner.status || "Planning" : "In Progress" } : {}),
    })
  }
  const entry = rows(snapshot.data[entries]).find((row) => String(row.id ?? "") === command.id)
  if (command.action === "save-entry" && command.id && !entry) return { ok: false, status: 404 }
  const target =
    command.action === "save-entry"
      ? entry
        ? (entry[ref] ?? (capex ? entry.projectId : undefined))
        : (value[ref] ?? (capex ? value.projectId : undefined))
      : owner?.id
  if (!canLine(collection, target)) return { ok: false, status: 403 }
  const line = owners.find((row) => String(row.id ?? "") === String(target))
  if (!line) return { ok: false, status: 404 }
  if (command.action === "save-deviation") {
    if (!yearValid || !Number.isInteger(month) || month < 1 || month > 12) return { ok: false, status: 422 }
    const flag = text(value.flag)
    if (!["", "dev-green", "dev-amber", "dev-red"].includes(flag)) return { ok: false, status: 422 }
    return write("deviations", `${capex ? "capex" : "opex"}-${line.id}-${year}-${month}`, {
      flag,
      text: text(value.text),
    })
  }
  if (command.action === "delete") {
    const result = write(collection, String(line.id ?? ""), undefined)
    if (!result.ok) return result
    for (const entry of rows(snapshot.data[entries]).filter(
      (row) => String(row[ref] ?? row.projectId ?? "") === String(line.id ?? ""),
    )) {
      const result = write(entries, String(entry.id ?? ""), undefined)
      if (!result.ok) return result
    }
    return { ok: true }
  }
  if (!yearValid) return { ok: false, status: 422 }
  if (command.action === "save-entry") {
    if (!Number.isInteger(month) || month < 1 || month > 12) return { ok: false, status: 422 }
    const existing =
      entry ??
      rows(snapshot.data[entries]).find(
        (row) =>
          String(row[ref] ?? row.projectId ?? "") === String(line.id ?? "") && row.year === year && row.month === month,
      )
    // A submitted parent never grants permission over an already stored entry.
    if (
      [value[ref], ...(capex ? [value.projectId] : [])].some(
        (parent) => parent !== undefined && String(parent) !== String(line.id),
      )
    )
      return { ok: false, status: 422 }
    if (
      existing &&
      (existing.year !== year ||
        existing.month !== month ||
        (capex &&
          existing.projId !== undefined &&
          existing.projectId !== undefined &&
          String(existing.projId) !== String(existing.projectId)))
    )
      return { ok: false, status: 422 }
    const amounts = Object.fromEntries(
      ["budget", "actual", "forecast"].map((key) => [key, Number(value[key] === undefined ? existing?.[key] ?? 0 : value[key])]),
    )
    if (Object.values(amounts).some((amount) => !Number.isFinite(amount))) return { ok: false, status: 422 }
    const id = existing ? String(existing.id ?? "") : environment.id()
    return write(entries, id, {
      ...existing,
      id: existing?.id ?? id,
      [ref]: line.id,
      year,
      month,
      ...amounts,
    })
  }
  const current = currentBudgetMonth(snapshot.data, year, environment.at)
  const kind = capex ? "capex" : "opex"
  const ytdKey = `${year}:${line.id}`
  const parsedYear = command.action === "year-amount" ? parseYearAmount(value.amount) : undefined
  if (parsedYear?.kind === "invalid") return { ok: false, status: 422 }
  const applied =
    parsedYear === undefined
      ? undefined
      : applyYearAmount(parsedYear.kind === "value" ? parsedYear.amount : null, current)
  if (command.action === "year-amount" && applied) {
    const amount = parsedYear?.kind === "value" ? parsedYear.amount : undefined
    const group = { ...object(object(snapshot.data.budgetYtd)[kind]) }
    if (applied.cleared || amount === undefined) delete group[ytdKey]
    if (amount !== undefined && !applied.cleared)
      group[ytdKey] = {
        amount,
        months: current,
        perMonth: applied.per,
        at: environment.at,
      }
    const next = { ...object(snapshot.data.budgetYtd), [kind]: group }
    const result = write("budgetYtd", undefined, next)
    if (!result.ok) return result
    if (applied.cleared) return { ok: true }
  }
  const annual = Number(value.annual)
  const field = text(value.field) || "budget"
  if (command.action === "annual-entry" && !["budget", "actual", "forecast"].includes(field))
    return { ok: false, status: 422 }
  if (command.action === "annual-entry" && !Number.isFinite(annual)) return { ok: false, status: 422 }
  if (command.action === "annual-entry" && field === "budget") {
    const result = write(collection, String(line.id ?? ""), {
      ...line,
      budget: annual,
    })
    if (!result.ok) return result
  }
  for (const index of Array.from({ length: 12 }, (_, index) => index)) {
    const existing = rows(snapshot.data[entries]).find(
      (row) =>
        String(row[ref] ?? row.projectId ?? "") === String(line.id ?? "") &&
        row.year === year &&
        row.month === index + 1,
    )
    const id = existing ? String(existing.id ?? "") : environment.id()
    const result = write(entries, id, {
      ...existing,
      id,
      [ref]: line.id,
      year,
      month: index + 1,
      ...(command.action === "annual-entry"
        ? { [field]: annualEntryMonths(annual)[index] }
        : applied && !applied.cleared
          ? { actual: applied.actual[index], forecast: applied.forecast[index] }
          : {}),
    })
    if (!result.ok) return result
  }
  return { ok: true }
}

function currentBudgetMonth(data: Record<string, unknown>, year: number, at: string): number {
  const stored = object(data.budgetCurrentMonth)[year]
  const month = typeof stored === "number" || typeof stored === "string" ? Number(stored) : NaN
  if (Number.isInteger(month) && month >= 1 && month <= 12) return month
  const now = new Date(at)
  return year === now.getFullYear() ? now.getMonth() + 1 : year < now.getFullYear() ? 12 : 1
}
function parseObject(value: string): Record<string, unknown> {
  try {
    return object(JSON.parse(value))
  } catch {
    return {}
  }
}
function parseRows(value: string): unknown {
  try {
    return JSON.parse(value) as unknown
  } catch {
    return undefined
  }
}
function budgetSummaryCategory(budget: number, actual: number, forecast: number) {
  return { budget, actual, forecast, variance: budget - forecast, actualBudgetPercent: budget !== 0 ? actual / budget * 100 : null }
}
function budgetData(data: Record<string, unknown>): BudgetData {
  return {
    opexOwners: rows(data.opexOwners).map((row) => ({
      id: String(row.id ?? ""),
      budget: finite(row.budget),
    })),
    capexProjects: rows(data.capexProjects).map((row) => ({
      id: String(row.id ?? ""),
      budget: finite(row.budget),
    })),
    opexEntries: rows(data.opexEntries).map((row) => ({
      ...row,
      year: finite(row.year),
      month: finite(row.month),
      ownerId: String(row.ownerId ?? ""),
      budget: finite(row.budget),
      actual: finite(row.actual),
      forecast: finite(row.forecast),
    })),
    capexEntries: rows(data.capexEntries).map((row) => ({
      ...row,
      year: finite(row.year),
      month: finite(row.month),
      projId: String(row.projId ?? row.projectId ?? ""),
      budget: finite(row.budget),
      actual: finite(row.actual),
      forecast: finite(row.forecast),
    })),
  }
}
export function render(page: string, data: Record<string, unknown>, context: RenderContext): string | undefined {
  if (!pages.some((owned) => owned === page)) return undefined
  const totals = computeBudgetTotals(budgetData(data), context.year)
  const current = currentBudgetMonth(data, context.year, context.at)
  const admin = context.actor.canWrite && context.actor.roles.includes("admin")
  const control = (action: string, id: string, key: string, body: string, label = "Save", allowed = admin) =>
    form(
      page,
      action,
      id,
      context.versions[key]?.version ?? 0,
      fields([{ name: "year", label: "Year", type: "number", value: context.year }]) +
        `<input type="hidden" name="versions" value="${esc(JSON.stringify(Object.fromEntries(Object.entries(context.versions).map(([key, value]) => [key, value.version]))))}">` +
        body,
      label,
      !allowed,
    )
  const money = dashboardMoney
  const summary =
    metricGrid([
      metric("Budget — 12 months", money(totals.totalBudget)),
      metric("Actuals — 12 months", money(totals.totalActual)),
      metric("Forecast — 12 months", money(totals.totalForecast)),
    ], 3) +
    table(
      ["12 months", "Budget", "Actuals", "Forecast", "Variance (under if positive)", "Actuals / budget"],
      [
        ["OPEX", totals.opexBudget, totals.opexActual, totals.opexForecast],
        ["CAPEX", totals.capexBudget, totals.capexActual, totals.capexForecast],
      ].map(([label, budget, actual, forecast]) => [
        String(label),
        money(Number(budget)),
        money(Number(actual)),
        money(Number(forecast)),
        money(Number(budget) - Number(forecast)),
        Number(budget) ? `${(Number(actual) / Number(budget)) * 100}%` : "—",
      ]),
    )
  if (page === "Executive Dashboard") {
    const users = itUsersForMonth(
      rows(data.itUsersMonthly).map((row) => ({
        year: finite(row.year),
        month: finite(row.month),
        users: finite(row.users),
      })),
      context.month,
      context.year,
    )
    const benchmark = rows(data.costPerUserBenchmarks).find((row) => row.year === context.year)
    const executive = {
      ...object(data.executive),
      ...object(object(data.executiveByYear)[context.year]),
    }
    const monthly = object(object(data.executiveMonths)[`${context.year}:${context.month}`])
    const opsMonth = Number(data.opsMonth ?? object(data.opsDefaultMonth)[context.year] ?? context.month)
    const ops = object(object(data.executiveMonths)[`${context.year}:${opsMonth}`])
    const slaMetric = (label: string, value: unknown, target: number) =>
      `<section class="metric-tone" data-tone="${typeof value !== "number" ? "none" : value >= target ? "green" : value >= target - 3 ? "amber" : "red"}">${metric(label, typeof value === "number" ? `${value}%` : "—")}</section>`
    return (
      `<form method="get" class="filter-bar"><input type="hidden" name="page" value="Executive Dashboard"><input type="hidden" name="year" value="${finite(data.sidebarYear, 2026)}">${fields(
        [
          {
            name: "execYear",
            label: "Year",
            type: "select",
            value: context.year,
            options: ["2024", "2025", "2026", "2027"],
          },
          {
            name: "executiveMonth",
            label: "Month",
            type: "select",
            value: context.month,
            options: Array.from({ length: 12 }, (_, index) => String(index + 1)),
          },
        ],
      )}<button>Show snapshot</button></form>` +
      summary +
      `<h2>People &amp; efficiency</h2>` +
      metricGrid([
        metric("Total IT Users", String(users)),
        ...[
          ["OPEX", totals.opexBudget, finite(benchmark?.value)],
          ["OPEX + CAPEX", totals.totalBudget, finite(benchmark?.value)],
        ].map(
          ([label, total, target]) =>
            `<section class="metric-tone" data-tone="${costPerUserTone(costPerUser(Number(total), users), Number(target))}">${metric(`Cost per User (${label})`, money(costPerUser(Number(total), users)))}</section>`,
        ),
        `<section class="metric-tone" data-tone="${attritionTone(attritionYtd(finite(executive.departures), finite(executive.active)) || 0)}">${metric("Attrition YTD", `${attritionYtd(finite(executive.departures), finite(executive.active)) || 0}%`)}</section>`,
      ], 4) +
      `<h2>Delivery &amp; risk</h2>` +
      metricGrid([
        metric("Active PMO projects", String(finite(executive.pmoActive))),
        metric("PMO at risk", String(finite(executive.pmoAtRisk))),
        metric("Active risks", String(finite(executive.activeRisks))),
        metric("Top risks", String(finite(executive.topRisks))),
        metric("IT Performance on target", String(finite(executive.onTarget))),
        metric(
          "Departures this month",
          String(Array.isArray(executive.monthlyDepartures) ? (executive.monthlyDepartures[context.month - 1] ?? 0) : 0),
        ),
      ], 3) +
      `<h2>Service operations</h2>` +
      `<form method="get" class="filter-bar"><input type="hidden" name="page" value="Executive Dashboard"><input type="hidden" name="year" value="${finite(data.sidebarYear, 2026)}"><input type="hidden" name="execYear" value="${context.year}"><input type="hidden" name="executiveMonth" value="${context.month}">${fields([{ name: "opsMonth", label: "Operations month", type: "select", value: opsMonth, options: Array.from({ length: 12 }, (_, index) => String(index + 1)) }])}<button>Show operations</button></form>` +
      metricGrid([
        metric("Tickets opened", String(finite(ops.opened))),
        metric("Tickets closed", String(finite(ops.closed))),
        `<section class="metric-tone" data-tone="${finite(ops.backlog) > 20 ? "amber" : "green"}">${metric("Final backlog", String(finite(ops.backlog)))}</section>`,
        metric("Backlog YTD — latest month", String(finite(ops.backlogYtd))),
      ], 4) +
      `<h2>Service levels</h2>` +
      metricGrid([
        slaMetric("Incidents SLA", ops.incSLA, 95),
        slaMetric("Service Requests SLA", ops.svcSLA, 90),
        slaMetric("Incidents SLA YTD", ops.incYtd, 95),
        slaMetric("Service Requests SLA YTD", ops.svcYtd, 90),
      ], 4) +
      `<h2>Security overview</h2>` +
      metricGrid([
        `<section class="metric-tone" data-tone="${finite(ops.p1) > 0 ? "red" : "green"}">${metric("P1", String(finite(ops.p1)))}</section>`,
        metric("Open security incidents", String(finite(monthly.openIncidents))),
      ], 2) +
      table(
        ["Security KPI", "Latest value", "Status"],
        rows(monthly.kpis).map((row) => [
          esc(text(row.key)),
          row.value == null ? "—" : esc(String(row.value)),
          esc(text(row.status)),
        ]),
      ) +
      `<section><h2>Dashboard inputs</h2>` +
      control(
        "save-users",
        String(
          rows(data.itUsersMonthly).find((row) => row.year === context.year && row.month === context.month)?.id ?? "",
        ),
        `itUsersMonthly:${rows(data.itUsersMonthly).find((row) => row.year === context.year && row.month === context.month)?.id ?? ""}`,
        fields([
          {
            name: "month",
            label: "Month",
            type: "number",
            value: context.month,
            min: 1,
            max: 12,
          },
          {
            name: "value",
            label: "Total IT Users",
            type: "number",
            value: users,
          },
        ]),
      ) +
      control(
        "save-benchmark",
        String(benchmark?.id ?? ""),
        `costPerUserBenchmarks:${benchmark?.id ?? ""}`,
        fields([
          {
            name: "month",
            label: "Month",
            type: "number",
            value: context.month,
          },
          {
            name: "value",
            label: "Cost per User Benchmark",
            type: "number",
            value: benchmark?.value,
          },
        ]),
      ) +
      `</section>`
    )
  }
  if (page === "Budget Overview") {
    const revenue = finite(object(data.revenueByYear)[context.year])
    const series = budgetChartSeries(totals.totalBudget)
    const minimum = Math.min(0, ...series)
    const maximum = Math.max(0, ...series)
    const graphY = (amount: number) =>
      160 - (maximum === minimum ? 0 : ((amount - minimum) / (maximum - minimum)) * 110)
    return (
      summary +
      metricGrid([
        metric("Variance — budget minus forecast", money(totals.totalBudget - totals.totalForecast)),
        metric("Actuals / budget", totals.totalBudget ? `${(totals.totalActual / totals.totalBudget) * 100}%` : "—"),
      ], 2) +
      metricGrid([
        ["OPEX", totals.opexBudget, totals.opexForecast],
        ["CAPEX", totals.capexBudget, totals.capexForecast],
        ["Total", totals.totalBudget, totals.totalForecast],
      ]
        .map(([label, budget, forecast]) =>
          metric(
            `${label} / revenue`,
            revenue
              ? `${((Number(budget) / revenue) * 100).toFixed(2)}% (forecast ${((Number(forecast) / revenue) * 100).toFixed(2)}%)`
              : "—",
          ),
        ), 3) +
      `<label>Actuals / budget<progress aria-label="Actuals / budget" max="100" value="${totals.totalBudget ? Math.max(0, (totals.totalActual / totals.totalBudget) * 100) : 0}" style="display:block;width:100%"></progress></label>` +
      `<figure><svg role="img" aria-label="Monthly budget — flat total divided by twelve" viewBox="0 0 700 200" style="display:block;width:100%;height:auto"><title>Monthly budget — flat total divided by twelve</title><line x1="45" y1="${graphY(0)}" x2="665" y2="${graphY(0)}" stroke="currentColor"/><text x="45" y="30" fill="currentColor">${esc(money(totals.totalBudget / 12))} per month</text><polyline data-budget-series="flat" points="${series.map((amount, index) => `${45 + index * 55},${graphY(amount)}`).join(" ")}" fill="none" stroke="#0f766e" stroke-width="3"/>${series.map((amount, index) => `<circle cx="${45 + index * 55}" cy="${graphY(amount)}" r="4" fill="#0f766e"><title>Month ${index + 1}: ${esc(money(amount))}</title></circle><text x="${45 + index * 55}" y="185" text-anchor="middle" fill="currentColor">${index + 1}</text>`).join("")}</svg><figcaption>Budget — twelve equal monthly values</figcaption></figure>` +
      table(
        ["Month", "Budget chart — flat /12"],
        budgetChartSeries(totals.totalBudget).map((amount, index) => [String(index + 1), money(amount)]),
      ) +
      control(
        "save-month",
        "",
        "budgetCurrentMonth",
        fields([
          {
            name: "month",
            label: "Current month",
            type: "number",
            min: 1,
            max: 12,
            value: current,
          },
        ]),
      ) +
      control(
        "save-revenue",
        "",
        "revenueByYear",
        fields([
          {
            name: "revenue",
            label: "Revenue",
            type: "number",
            value: revenue || "",
          },
        ]),
      )
    )
  }
  const capex = page === "CAPEX Projects"
  const collection = capex ? "capexProjects" : "opexOwners"
  const entries = capex ? "capexEntries" : "opexEntries"
  const owners = rows(data[collection])
  return (
    summary +
    owners
      .map((owner) => {
        const id = String(owner.id ?? "")
        const allowed =
          context.actor.canWrite &&
          (admin ||
            (context.actor.roles.includes("domain leader") &&
              Array.isArray(data.budgetLineIds) &&
              data.budgetLineIds.includes(`${collection}:${id}`)))
        const monthEntries = rows(data[entries]).filter(
          (row) => String(row.ownerId ?? row.projId ?? row.projectId ?? "") === id && row.year === context.year,
        )
        const total = Array.from({ length: 12 }, (_, index) =>
          effectiveMonthlyBudget(
            finite(monthEntries.find((row) => row.month === index + 1)?.budget),
            finite(owner.budget),
          ),
        ).reduce((sum, amount) => sum + amount, 0)
        return (
          `<section><h2>${esc(text(owner.name))}</h2>` +
          metricGrid([
            metric("Total 12mo", money(total)),
            metric("Overridden", String(Math.round(total) !== Math.round(finite(owner.budget)))),
          ], 2) +
          control(
            "save",
            id,
            `${collection}:${id}`,
            fields([
              { name: "name", label: "Name", value: owner.name },
              {
                name: "budget",
                label: "Annual budget",
                type: "number",
                value: owner.budget,
              },
            ]),
            "Save",
            allowed,
          ) +
          table(
            ["Month", "Effective budget", "Actual", "Forecast", "Deviation", "Flag", "Utilization", "Edit all months"],
            Array.from({ length: 12 }, (_, index) => {
              const entry = monthEntries.find((row) => row.month === index + 1)
              const budget = effectiveMonthlyBudget(finite(entry?.budget), finite(owner.budget))
              const deviation = finite(entry?.forecast) - budget
              const pct = budget ? (deviation / budget) * 100 : 0
              const utilization = Math.min((finite(entry?.actual) / budget) * 100, 100) || 0
              const utilizationTone = utilization > 110 ? "red" : utilization > 90 ? "amber" : "teal"
              const deviationId = `${capex ? "capex" : "opex"}-${id}-${context.year}-${index + 1}`
              const saved = object(object(data.deviations)[deviationId])
              const flag =
                text(
                  object(object(data.deviations)[`${capex ? "capex" : "opex"}-${id}-${context.year}-${index + 1}`])
                    .flag,
                ) ||
                text(entry?.flag) ||
                (Math.abs(pct) < 10 ? "green" : Math.abs(pct) < 25 ? "amber" : "red")
              return [
                String(index + 1),
                money(budget),
                money(finite(entry?.actual)),
                money(finite(entry?.forecast)),
                `<span data-tone="${deviation > 0 ? "red" : "green"}">${money(deviation)}</span>`,
                esc(flag) +
                  control(
                    "save-deviation",
                    id,
                    `deviations:${deviationId}`,
                    fields([
                      {
                        name: "month",
                        label: "Month",
                        type: "number",
                        value: index + 1,
                      },
                      {
                        name: "flag",
                        label: "Flag",
                        type: "select",
                        value: saved.flag,
                        options: ["", "dev-green", "dev-amber", "dev-red"],
                      },
                      {
                        name: "text",
                        label: "Deviation notes",
                        value: saved.text,
                      },
                    ]),
                    "Save deviation",
                    allowed,
                  ),
                `<span data-utilization="${utilization}" data-tone="${utilizationTone}" style="color:${utilizationTone === "red" ? "#dc2626" : utilizationTone === "amber" ? "#b45309" : "#0f766e"}">${utilization}%</span>`,
                control(
                  "save-entry",
                  String(entry?.id ?? ""),
                  `${entries}:${entry?.id ?? ""}`,
                  `<input type="hidden" name="${capex ? "projId" : "ownerId"}" value="${esc(String(owner.id ?? ""))}">` +
                    fields([
                      {
                        name: "month",
                        label: "Month",
                        type: "number",
                        value: index + 1,
                      },
                      ...(["budget", "actual", "forecast"] as const).map((name) => ({
                        name,
                        label: name,
                        type: "number" as const,
                        value: entry?.[name],
                        step: "0.01",
                      })),
                    ]),
                  "Save month",
                  allowed,
                ),
              ]
            }),
          ) +
          control(
            "annual-entry",
            id,
            `${collection}:${id}`,
            fields([
              {
                name: "annual",
                label: "Annual Entry ÷12",
                type: "number",
                step: "0.01",
              },
              {
                name: "field",
                label: "Field",
                type: "select",
                options: ["budget", "actual", "forecast"],
              },
            ]),
            "Apply annual entry",
            allowed,
          ) +
          control(
            "year-amount",
            id,
            "budgetYtd",
            fields([
              {
                name: "amount",
                label: "Year amount",
                type: "number",
                step: "0.01",
                value: object(object(object(data.budgetYtd)[capex ? "capex" : "opex"])[`${context.year}:${id}`]).amount,
              },
            ]),
            "Apply year amount",
            allowed,
          ) +
          (object(object(object(data.budgetYtd)[capex ? "capex" : "opex"])[`${context.year}:${id}`]).months !==
            undefined &&
          object(object(object(data.budgetYtd)[capex ? "capex" : "opex"])[`${context.year}:${id}`]).months !== current
            ? "<p>Year amount hint is stale; months have not been recalculated.</p>"
            : "") +
          control("delete", id, `${collection}:${id}`, "", "Delete", allowed) +
          "</section>"
        )
      })
      .join("") +
    control(
      "save",
      "",
      `${collection}:`,
      fields([
        {
          name: "name",
          label: capex ? "Project name" : "Owner name",
          required: true,
        },
        { name: "budget", label: "Annual budget", type: "number", value: 0 },
      ]),
      "Add",
    ) +
    (!capex
      ? control(
          "import",
          "",
          "opexEntries:",
          `<label>Import Excel budget<input type="file" data-workbook="opex" accept=".xlsx"></label><input type="hidden" name="rows" data-workbook-rows><p data-import-notice></p>`,
          "Import Excel",
        ) + `<a download="opex-template.xlsx" href="?download=opex-template">Download Excel template</a>`
      : "")
  )
}

export const DashboardBudget = { pages, domain, render }
