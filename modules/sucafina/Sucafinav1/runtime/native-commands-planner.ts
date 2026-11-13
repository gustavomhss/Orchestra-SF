import type { Actor, Environment, NativeAction, NativeChoice, NativeCommandContext, NativeField, NativeText, Snapshot } from "./contract.ts"
import { finite, object, rows, text } from "./contract.ts"
import { OPEX_ELEMENTS } from "../src/planner-accounts.ts"
import type { PlannerLine } from "../src/planner-role.ts"
import { ownerMayEdit, plannerField } from "../src/planner-role.ts"

// Descriptors only. Field values and CAS come from the authorized view.
// Snapshot is the official-year policy fallback. Creates omit ids and use version 0.
// Actual and forecast use a0..a11 / f0..f11. Budget months use the existing month/value wire, one month per action.
// Annual is its own save. Metadata saves omit it so an unchanged annual cannot spread b/bm.

type Row = Record<string, unknown>
type Plan = { id: string; year: number; locked: boolean }
type Gate = {
  page: string
  actor: Actor
  environment: Environment
  data: Row
  version: Row
  plan: Plan
  official: string | undefined
  revisions: Snapshot["versions"]
}

const PAGES = ["Overview", "OPEX", "CAPEX", "Headcount", "Entities & allocations", "FX rates", "Versions"] as const
const MONTHS: readonly NativeText[] = [
  { en: "January", br: "Janeiro" },
  { en: "February", br: "Fevereiro" },
  { en: "March", br: "Março" },
  { en: "April", br: "Abril" },
  { en: "May", br: "Maio" },
  { en: "June", br: "Junho" },
  { en: "July", br: "Julho" },
  { en: "August", br: "Agosto" },
  { en: "September", br: "Setembro" },
  { en: "October", br: "Outubro" },
  { en: "November", br: "Novembro" },
  { en: "December", br: "Dezembro" },
]
const ELEMENT_LABELS: Record<string, NativeText> = {
  licenses: { en: "Licenses", br: "Licenças" },
  services: { en: "Services", br: "Serviços" },
  hwo: { en: "Hardware", br: "Hardware" },
  depr: { en: "Depreciation", br: "Depreciação" },
  hr: { en: "HR Staff", br: "Pessoal de RH" },
  fac: { en: "Facilities", br: "Instalações" },
  te: { en: "Travel and expenses", br: "Viagens e despesas" },
  oth: { en: "Others", br: "Outros" },
}
const TYPES: readonly NativeChoice[] = [
  { value: "Employee", label: { en: "Employee", br: "Empregado" } },
  { value: "Contractor", label: { en: "Contractor", br: "Terceiro" } },
]
const CLASSES: readonly NativeChoice[] = [
  { value: "capex", label: { en: "CAPEX", br: "CAPEX" } },
  { value: "opex", label: { en: "OPEX", br: "OPEX" } },
]
const SPLITS: readonly NativeChoice[] = [
  { value: true, label: { en: "Breakdown", br: "Detalhado" } },
  { value: false, label: { en: "Total only", br: "Somente total" } },
]

export function plannerCommands(snapshot: Snapshot, actor: Actor, environment: Environment, context: NativeCommandContext): readonly NativeAction[] {
  if (!actor.canWrite || !actor.roles.some((role) => ["admin", "finance", "hr", "budget owner"].includes(role))) return []
  if (!PAGES.some((page) => page === context.page) || context.page === "Overview") return []
  const data = context.view.data
  if (context.page === "Versions") return versionCommands(snapshot, actor, data, context)
  if (context.page === "Entities & allocations") return listCommands(actor, data, context)
  const version = selectedVersion(data, context.query, context.year)
  if (!version) return []
  const plan = { id: idOf(version.id), year: finite(version.year), locked: version.locked === true }
  if (!plan.id) return []
  const gate: Gate = {
    page: context.page,
    actor,
    environment,
    data,
    version,
    plan,
    official: officialFor(snapshot, data, plan.year),
    revisions: context.view.versions,
  }
  if (context.page === "FX rates") return fxCommands(gate)
  if (context.page === "Headcount") return headcountCommands(gate)
  if (context.page === "OPEX" || context.page === "CAPEX") return moneyCommands(gate)
  return []
}

function versionCommands(snapshot: Snapshot, actor: Actor, data: Row, context: NativeCommandContext): NativeAction[] {
  if (!actor.roles.includes("admin")) return []
  const versions = rows(data.versions)
  if (!versions.length) {
    return [make(context.page, ["save", "versions", null, "first"], {
      label: { en: "Create first version (versions:first)", br: "Criar a primeira versão (versions:first)" },
      action: "save",
      version: cas(context.view.versions, "versions:first"),
      values: {},
      fields: [],
    })]
  }
  return versions.flatMap((version) => {
    const id = idOf(version.id)
    if (!id) return []
    const plan = { id, year: finite(version.year), locked: version.locked === true }
    const identity = recordIdentity(version.name, id)
    const official = officialFor(snapshot, data, plan.year) === id
    const group = { en: identity, br: identity }
    const values: Record<string, unknown> = { name: text(version.name) }
    const fields: NativeField[] = [{ kind: "text", path: ["name"], label: { en: "Name", br: "Nome" }, blank: "empty" }]
    if (!plan.locked) {
      values.year = plan.year
      fields.push({ kind: "number", path: ["year"], label: { en: "Year", br: "Ano" }, required: true, min: 2001, max: 2099, step: 1 })
    }
    const revision = cas(context.view.versions, `versions:${id}`)
    const target = { collection: "versions", id }
    return [
      make(context.page, ["save", "versions", id, "details"], {
        label: { en: `Save version: ${identity}`, br: `Salvar versão: ${identity}` },
        group, action: "save", id, version: revision, values, fields, target,
      }),
      make(context.page, ["copy", "versions", id, null], {
        label: { en: `Copy version: ${identity}`, br: `Copiar versão: ${identity}` },
        group, action: "copy", id, version: revision, target,
        values: { name: `${text(version.name)} — Copy` },
        fields: [{ kind: "text", path: ["name"], label: { en: "Copy name", br: "Nome da cópia" }, blank: "empty" }],
      }),
      ...(plan.locked ? [] : [make(context.page, ["lock", "versions", id, null], {
        label: { en: `Lock version: ${identity}`, br: `Bloquear versão: ${identity}` },
        group, action: "lock", id, version: revision, values: {}, fields: [], target,
      })]),
      ...(plan.locked && !official ? [make(context.page, ["unlock", "versions", id, null], {
        label: { en: `Unlock version: ${identity}`, br: `Desbloquear versão: ${identity}` },
        group, action: "unlock", id, version: revision, values: {}, fields: [], target,
      })] : []),
      make(context.page, ["official", "versions", id, String(plan.year)], {
        label: { en: `Make official: ${identity}`, br: `Tornar oficial: ${identity}` },
        group, action: "official", id, version: cas(context.view.versions, `officials:${plan.year}`), values: {}, fields: [], target,
      }),
      ...(official ? [] : [remove(context.page, ["delete", "versions", id, null], {
        label: { en: `Delete version: ${identity}`, br: `Excluir versão: ${identity}` },
        group, action: "delete", id, version: revision, values: {}, fields: [], target,
        en: `Delete version ${identity}? This cannot be undone.`,
        br: `Excluir a versão ${identity}? Esta ação não pode ser desfeita.`,
      })]),
    ]
  })
}

function listCommands(actor: Actor, data: Row, context: NativeCommandContext): NativeAction[] {
  if (!actor.roles.includes("admin")) return []
  return ["entities", "allocations"].flatMap((collection) => {
    const noun = collection === "entities"
      ? { en: "entity", br: "entidade" }
      : { en: "allocation", br: "alocação" }
    const detail = collection === "entities" ? "code" : "desc"
    const detailLabel = collection === "entities"
      ? { en: "Code", br: "Código" }
      : { en: "Description", br: "Descrição" }
    const records = rows(data[collection])
    const existing = records.flatMap((row) => {
      const id = idOf(row.id)
      if (!id) return []
      const identity = recordIdentity(row.name, id)
      const group = { en: identity, br: identity }
      const target = { collection, id }
      const version = cas(context.view.versions, `${collection}:${id}`)
      return [
        make(context.page, ["save", collection, id, "details"], {
          label: { en: `Save ${noun.en}: ${identity}`, br: `Salvar ${noun.br}: ${identity}` },
          group, action: "save", id, version, target,
          values: { collection, name: text(row.name), [detail]: text(row[detail]) },
          fields: [
            locked("collection", { en: "Collection", br: "Coleção" }),
            { kind: "text", path: ["name"], label: { en: "Name", br: "Nome" }, blank: "empty" },
            { kind: "text", path: [detail], label: detailLabel, blank: "empty" },
          ],
        }),
        remove(context.page, ["delete", collection, id, null], {
          label: { en: `Delete ${noun.en}: ${identity}`, br: `Excluir ${noun.br}: ${identity}` },
          group, action: "delete", id, version, target,
          values: { collection },
          fields: [locked("collection", { en: "Collection", br: "Coleção" })],
          en: `Delete ${noun.en} ${identity}? This cannot be undone.`,
          br: `Excluir ${noun.br} ${identity}? Esta ação não pode ser desfeita.`,
        }),
      ]
    })
    const create = make(context.page, ["save", collection, null, "create"], {
      label: collection === "entities"
        ? { en: "Add entity", br: "Adicionar entidade" }
        : { en: "Add allocation", br: "Adicionar alocação" },
      action: "save",
      version: 0,
      values: { collection, name: "", [detail]: "" },
      fields: [
        locked("collection", { en: "Collection", br: "Coleção" }),
        { kind: "text", path: ["name"], label: { en: "Name", br: "Nome" }, required: true, blank: "empty" },
        { kind: "text", path: [detail], label: detailLabel, blank: "empty" },
      ],
    })
    if (collection !== "allocations") return [...existing, create]
    return [
      ...existing,
      create,
      make(context.page, ["common", "allocations", null, "common"], {
        label: { en: "Add common allocation keys (allocations:common)", br: "Adicionar chaves de alocação comuns (allocations:common)" },
        action: "common",
        version: cas(context.view.versions, "allocations:common"),
        values: { collection: "allocations" },
        fields: [locked("collection", { en: "Collection", br: "Coleção" })],
      }),
    ]
  })
}

function fxCommands(gate: Gate): NativeAction[] {
  if (!plannerField("fx", gate.plan, gate.official, gate.actor)) return []
  const existing = rows(gate.version.fx).flatMap((rate) => {
    const id = idOf(rate.id) || text(rate.cur)
    if (!id) return []
    const identity = recordIdentity(rate.cur, id)
    const saved = saveRecord(gate, "fx", id, "details", identity, {
      en: `Save currency: ${identity}`, br: `Salvar moeda: ${identity}`,
    }, cas(gate.revisions, `${gate.plan.id}:fx:${id}`), { cur: text(rate.cur), rate: numberOrNull(rate.rate) }, [
      { kind: "text", path: ["cur"], label: { en: "Code", br: "Código" }, required: true },
      { kind: "number", path: ["rate"], label: { en: "Rate", br: "Taxa" }, blank: "null" },
    ])
    return [
      saved,
      remove(gate.page, ["delete", "fx", id, null], {
        label: { en: `Delete currency: ${identity}`, br: `Excluir moeda: ${identity}` },
        group: { en: identity, br: identity },
        action: "delete", id, version: saved.command.version,
        target: { collection: "fx", id },
        ...contextOf(gate.plan.id, "fx", {}, []),
        en: `Delete currency ${identity}? This cannot be undone.`,
        br: `Excluir a moeda ${identity}? Esta ação não pode ser desfeita.`,
      }),
    ]
  })
  return [
    ...existing,
    saveRecord(gate, "fx", undefined, "create", planIdentity(gate.version), {
      en: `Add currency: ${planIdentity(gate.version)}`, br: `Adicionar moeda: ${planIdentity(gate.version)}`,
    }, 0, { cur: "", rate: null }, [
      { kind: "text", path: ["cur"], label: { en: "Currency", br: "Moeda" }, required: true },
      { kind: "number", path: ["rate"], label: { en: "Rate", br: "Taxa" }, blank: "null" },
    ]),
  ]
}

function headcountCommands(gate: Gate): NativeAction[] {
  const actions: NativeAction[] = []
  const hc = object(gate.version.hc)
  const planLabel = planIdentity(gate.version)
  if (plannerField("headcount", gate.plan, gate.official, gate.actor)) {
    const leaders = [...new Set(rows(gate.data.roster).map((row) => text(row.leader)).filter(Boolean))]
    actions.push(
      ...leaders.map((leader) => make(gate.page, ["save", "leaderDomains", null, leader], {
        label: { en: `Save leader domain: ${leader}`, br: `Salvar domínio do líder: ${leader}` },
        group: { en: leader, br: leader },
        action: "save",
        version: cas(gate.revisions, `${gate.plan.id}:leaderDomains`),
        target: { collection: "leaderDomains", id: leader },
        ...contextOf(gate.plan.id, "leaderDomains", { leader, domain: text(object(hc.leaderDomains)[leader]) }, [
          { kind: "text", path: ["leader"], label: { en: "Leader", br: "Líder" }, readOnly: true, required: true },
          { kind: "text", path: ["domain"], label: { en: "Domain", br: "Domínio" }, blank: "empty" },
        ]),
      })),
      ...rows(hc.positions).flatMap((position) => positionActions(gate, position)),
      saveRecord(gate, "positions", undefined, "create", planLabel, {
        en: `Add new hire: ${planLabel}`, br: `Adicionar nova contratação: ${planLabel}`,
      }, 0, { name: "", domain: "", fte: 1, start: 1, end: 12 }, [
        { kind: "text", path: ["name"], label: { en: "New hire", br: "Nova contratação" }, required: true, blank: "empty" },
        { kind: "text", path: ["domain"], label: { en: "Domain", br: "Domínio" }, blank: "empty" },
        { kind: "number", path: ["fte"], label: { en: "FTE", br: "FTE" }, min: 0, max: 2 },
        { kind: "number", path: ["start"], label: { en: "Start month", br: "Mês inicial" }, min: 1, max: 12, step: 1 },
        { kind: "number", path: ["end"], label: { en: "End month", br: "Mês final" }, min: 1, max: 12, step: 1 },
      ]),
      make(gate.page, ["sync", "positions", gate.plan.id, null], {
        label: { en: `Sync roster: ${planLabel}`, br: `Sincronizar quadro: ${planLabel}` },
        action: "sync",
        version: cas(gate.revisions, `${gate.plan.id}:positions:sync`),
        ...contextOf(gate.plan.id, "positions", {}, []),
      }),
    )
  }
  if (plannerField("rate", gate.plan, gate.official, gate.actor)) {
    actions.push(
      ...rows(hc.rates).flatMap((rate) => rateActions(gate, rate)),
      saveRecord(gate, "rates", undefined, "create", planLabel, {
        en: `Add rate card: ${planLabel}`, br: `Adicionar cartão de taxa: ${planLabel}`,
      }, 0, { name: "", locs: "", cur: "USD", annual: 0 }, rateFields(gate, { cur: "USD" })),
    )
  }
  if (plannerField("increase", gate.plan, gate.official, gate.actor)) {
    actions.push(make(gate.page, ["save", "increase", gate.plan.id, null], {
      label: { en: `Save increase: ${planLabel}`, br: `Salvar aumento: ${planLabel}` },
      action: "save",
      version: cas(gate.revisions, `${gate.plan.id}:increase`),
      target: { collection: "increase", id: gate.plan.id },
      ...contextOf(gate.plan.id, "increase", { inc: finite(hc.inc), incMonth: finite(hc.incMonth, 1) }, [
        { kind: "number", path: ["inc"], label: { en: "Increase %", br: "Aumento %" }, required: true, blank: "null" },
        { kind: "number", path: ["incMonth"], label: { en: "Effective month", br: "Mês de vigência" }, required: true, min: 1, max: 12, step: 1 },
      ]),
    }))
  }
  return actions
}

function moneyCommands(gate: Gate): NativeAction[] {
  const capex = gate.page === "CAPEX"
  const actions: NativeAction[] = []
  if (!capex && plannerField("closedThrough", gate.plan, gate.official, gate.actor) && gate.actor.roles.some((role) => role === "admin" || role === "finance")) {
    const identity = planIdentity(gate.version)
    actions.push(make(gate.page, ["save", "closed", gate.plan.id, null], {
      label: { en: `Save closed month: ${identity}`, br: `Salvar mês fechado: ${identity}` },
      action: "save",
      version: cas(gate.revisions, `${gate.plan.id}:closed`),
      ...contextOf(gate.plan.id, undefined, { closed: finite(gate.version.closed) }, [
        { kind: "number", path: ["closed"], label: { en: "Actuals closed through (0 = none)", br: "Realizado fechado até (0 = nenhum)" }, required: true, min: 0, max: 12, step: 1 },
      ]),
    }))
  }
  if (!capex && plannerField("structure", gate.plan, gate.official, gate.actor)) {
    actions.push(...OPEX_ELEMENTS.filter((element) => element !== "hr").map((element) => {
      const label = elementLabel(element)
      const identity = `${label.en} · ${planIdentity(gate.version)}`
      return make(gate.page, ["save", "lists", gate.plan.id, element], {
        label: { en: `Set breakdown: ${identity}`, br: `Definir detalhamento: ${label.br} · ${planIdentity(gate.version)}` },
        action: "save",
        version: cas(gate.revisions, `${gate.plan.id}:lists:${element}`),
        ...contextOf(gate.plan.id, undefined, { el: element, split: splitValue(gate.version.lists, element) }, [
          { kind: "select", path: ["el"], label: { en: "Element", br: "Elemento" }, readOnly: true, required: true, options: [{ value: element, label }] },
          { kind: "select", path: ["split"], label: { en: "Mode", br: "Modo" }, required: true, options: SPLITS },
        ]),
      })
    }))
  }
  const sec = capex ? "capex" : "opex"
  actions.push(
    ...rows(gate.version.lines).filter((line) => text(line.sec) === sec && !text(line.id).startsWith("HR:")).flatMap((line) => lineActions(gate, line, false)),
    ...(capex ? [] : rows(gate.version.hr).flatMap((line) => lineActions(gate, line, true))),
    ...lineCreate(gate),
    ...(capex ? projectActions(gate) : []),
  )
  return actions
}

function lineActions(gate: Gate, line: Row, synthetic: boolean): NativeAction[] {
  const id = text(line.id)
  if (!id || (synthetic && !id.startsWith("HR:"))) return []
  const scope = lineScope(line, synthetic)
  const identity = recordIdentity(synthetic ? line.domain || line.name : line.name, id)
  const group = { en: identity, br: identity }
  const revision = cas(gate.revisions, `${gate.plan.id}:${synthetic ? "hrAF" : "lines"}:${id}`)
  const actions: NativeAction[] = []
  const details = synthetic
    ? picked(gate, scope, [
      ["owner", "owner"],
      ["entity", "entity"],
      ["allocation", "alloc"],
    ])
    : picked(gate, scope, [
      ["name", "name"],
      ["desc", "desc"],
      ["owner", "owner"],
      ["entity", "entity"],
      ["allocation", "alloc"],
      ["budget", "el"],
      ["currency", "cur"],
      ...(gate.page === "CAPEX" ? [["budget", "proj"], ["classification", "cls"]] as const : []),
    ])
  if (details.length) {
    const values: Record<string, unknown> = {}
    const fields = details.flatMap((wire) => lineField(gate, line, wire, values))
    actions.push(saveRecord(gate, "lines", id, synthetic ? "hr-details" : "details", identity, {
      en: `Save line: ${identity}`, br: `Salvar linha: ${identity}`,
    }, revision, values, fields))
  }
  if (!synthetic && allows(gate, "budget", scope)) {
    actions.push(annualAdjustment(gate, id, identity, group, revision, line.annual))
    actions.push(...budgetMonths(gate, id, identity, group, revision, line.b))
  }
  if (allows(gate, "actual", scope)) actions.push(monthAction(gate, id, identity, group, revision, "a", "actual", line.a, true, {
    en: `Save actual: ${identity}`, br: `Salvar realizado: ${identity}`,
  }))
  if (allows(gate, "forecast", scope)) actions.push(monthAction(gate, id, identity, group, revision, "f", "forecast", line.f, true, {
    en: `Save forecast: ${identity}`, br: `Salvar previsão: ${identity}`,
  }))
  if (!synthetic && allows(gate, "budget", scope)) {
    actions.push(
      plainLine(gate, "spread", id, identity, group, revision, { en: `Spread: ${identity}`, br: `Distribuir: ${identity}` }),
      plainLine(gate, "reset", id, identity, group, revision, { en: `Reset spread: ${identity}`, br: `Redefinir distribuição: ${identity}` }),
    )
  }
  if (!synthetic && allows(gate, "structure", scope)) {
    actions.push(remove(gate.page, ["delete", "lines", id, null], {
      label: { en: `Delete line: ${identity}`, br: `Excluir linha: ${identity}` },
      group, action: "delete", id, version: revision, target: { collection: "lines", id },
      ...contextOf(gate.plan.id, "lines", {}, []),
      en: `Delete line ${identity}? This cannot be undone.`,
      br: `Excluir a linha ${identity}? Esta ação não pode ser desfeita.`,
    }))
  }
  return actions
}

function lineCreate(gate: Gate): NativeAction[] {
  const ownerId = gate.actor.id
  if (!createAllowed(gate, "structure", ownerId)) return []
  const capex = gate.page === "CAPEX"
  const projects = rows(gate.version.projects).filter((project) => idOf(project.id))
  if (capex && (!projects.length || !createAllowed(gate, "budget", ownerId))) return []
  const preset = plannerField("structure", gate.plan, gate.official, gate.actor) ? "" : ownerId
  const values: Record<string, unknown> = {}
  const fields: NativeField[] = []
  const add = (permissionName: string, wire: string, field: NativeField, value: unknown) => {
    if (!createAllowed(gate, permissionName, ownerId)) return
    values[wire] = value
    fields.push(field)
  }
  add("name", "name", { kind: "text", path: ["name"], label: { en: "Name", br: "Nome" }, required: true, blank: "empty" }, "")
  add("desc", "desc", { kind: "textarea", path: ["desc"], label: { en: "Description", br: "Descrição" }, blank: "empty" }, "")
  add("owner", "owner", { kind: "select", path: ["owner"], label: { en: "Owner", br: "Responsável" }, blank: "empty", options: directoryChoices(gate, preset) }, preset)
  add("entity", "entity", { kind: "select", path: ["entity"], label: { en: "Entity", br: "Entidade" }, blank: "empty", options: namedChoices(rows(gate.data.entities), "", { en: "None", br: "Nenhum" }) }, "")
  add("allocation", "alloc", { kind: "select", path: ["alloc"], label: { en: "Allocation", br: "Alocação" }, blank: "empty", options: namedChoices(rows(gate.data.allocations), "", { en: "None", br: "Nenhum" }) }, "")
  add("budget", "el", { kind: "select", path: ["el"], label: { en: "Element", br: "Elemento" }, required: true, options: elementChoices(gate.page, "licenses") }, "licenses")
  add("currency", "cur", { kind: "select", path: ["cur"], label: { en: "Currency", br: "Moeda" }, required: true, options: currencyChoices(gate.version, "USD") }, "USD")
  add("budget", "annual", { kind: "number", path: ["annual"], label: { en: "Annual budget", br: "Orçamento anual" }, blank: "null" }, 0)
  if (capex) {
    const projectId = idOf(projects[0].id)
    add("budget", "proj", { kind: "select", path: ["proj"], label: { en: "Project", br: "Projeto" }, required: true, options: projectChoices(projects, projectId) }, projectId)
    add("classification", "cls", { kind: "select", path: ["cls"], label: { en: "Classification", br: "Classificação" }, required: true, options: CLASSES }, "capex")
  }
  const identity = planIdentity(gate.version)
  return [saveRecord(gate, "lines", undefined, "create", identity, {
    en: `Add budget line: ${identity}`, br: `Adicionar linha de orçamento: ${identity}`,
  }, 0, values, fields)]
}

function projectActions(gate: Gate): NativeAction[] {
  const projects = rows(gate.version.projects)
  const existing = projects.flatMap((project) => {
    const id = idOf(project.id)
    if (!id) return []
    const identity = recordIdentity(project.name, id)
    const values: Record<string, unknown> = {}
    const fields = ["name", "desc", "owner", "code"].flatMap((wire) => {
      if (!allows(gate, wire, undefined)) return []
      return lineField(gate, project, wire, values)
    })
    const revision = cas(gate.revisions, `${gate.plan.id}:projects:${id}`)
    return [
      ...(fields.length ? [saveRecord(gate, "projects", id, "details", identity, {
        en: `Save project: ${identity}`, br: `Salvar projeto: ${identity}`,
      }, revision, values, fields)] : []),
      ...(allows(gate, "structure") ? [remove(gate.page, ["delete", "projects", id, null], {
        label: { en: `Delete project: ${identity}`, br: `Excluir projeto: ${identity}` },
        group: { en: identity, br: identity },
        action: "delete", id, version: revision, target: { collection: "projects", id },
        ...contextOf(gate.plan.id, "projects", {}, []),
        en: `Delete project ${identity}? This cannot be undone.`,
        br: `Excluir o projeto ${identity}? Esta ação não pode ser desfeita.`,
      })] : []),
    ]
  })
  if (!allows(gate, "structure")) return existing
  const values: Record<string, unknown> = {}
  const fields = ["name", "desc", "owner", "code"].flatMap((wire) => {
    if (!allows(gate, wire)) return []
    return lineField(gate, { owner: "" }, wire, values)
  })
  const identity = planIdentity(gate.version)
  return [
    ...existing,
    saveRecord(gate, "projects", undefined, "create", identity, {
      en: `Add project: ${identity}`, br: `Adicionar projeto: ${identity}`,
    }, 0, values, fields.map((field) => field.kind === "text" && field.path[0] === "name" ? { ...field, required: true } : field)),
  ]
}

function positionActions(gate: Gate, position: Row): NativeAction[] {
  const id = idOf(position.id)
  if (!id) return []
  const identity = recordIdentity(position.name, id)
  const revision = cas(gate.revisions, `${gate.plan.id}:positions:${id}`)
  const type = text(position.type) || "Employee"
  const rateId = text(position.rateId)
  return [
    saveRecord(gate, "positions", id, "details", identity, {
      en: `Save position: ${identity}`, br: `Salvar posição: ${identity}`,
    }, revision, {
      name: text(position.name),
      title: text(position.title),
      include: position.include === true,
      fte: finite(position.fte, 1),
      start: finite(position.start, 1),
      end: finite(position.end, 12),
      domain: text(position.domain),
      type,
      location: text(position.location),
      rateId,
      rateOverride: numberOrNull(position.rateOverride),
    }, [
      { kind: "text", path: ["name"], label: { en: "Name", br: "Nome" }, required: true, blank: "empty" },
      { kind: "text", path: ["title"], label: { en: "Title", br: "Cargo" }, blank: "empty" },
      { kind: "checkbox", path: ["include"], label: { en: "Include", br: "Incluir" } },
      { kind: "number", path: ["fte"], label: { en: "FTE", br: "FTE" }, min: 0, max: 2 },
      { kind: "number", path: ["start"], label: { en: "Start month", br: "Mês inicial" }, min: 1, max: 12, step: 1 },
      { kind: "number", path: ["end"], label: { en: "End month", br: "Mês final" }, min: 1, max: 12, step: 1 },
      { kind: "text", path: ["domain"], label: { en: "Domain", br: "Domínio" }, blank: "empty" },
      { kind: "select", path: ["type"], label: { en: "Type", br: "Tipo" }, options: withCurrent(TYPES, type) },
      { kind: "text", path: ["location"], label: { en: "Location", br: "Localidade" }, blank: "empty" },
      { kind: "select", path: ["rateId"], label: { en: "Rate card", br: "Cartão de taxa" }, blank: "empty", options: namedChoices(rows(object(gate.version.hc).rates), rateId, { en: "None", br: "Nenhum" }) },
      { kind: "number", path: ["rateOverride"], label: { en: "Rate override", br: "Taxa substituta" }, blank: "null", min: 0 },
    ]),
    remove(gate.page, ["delete", "positions", id, null], {
      label: { en: `Delete position: ${identity}`, br: `Excluir posição: ${identity}` },
      group: { en: identity, br: identity },
      action: "delete", id, version: revision, target: { collection: "positions", id },
      ...contextOf(gate.plan.id, "positions", {}, []),
      en: `Delete position ${identity}? This cannot be undone.`,
      br: `Excluir a posição ${identity}? Esta ação não pode ser desfeita.`,
    }),
  ]
}

function rateActions(gate: Gate, rate: Row): NativeAction[] {
  const id = idOf(rate.id)
  if (!id) return []
  const identity = recordIdentity(rate.name, id)
  const revision = cas(gate.revisions, `${gate.plan.id}:rates:${id}`)
  return [
    saveRecord(gate, "rates", id, "details", identity, {
      en: `Save rate card: ${identity}`, br: `Salvar cartão de taxa: ${identity}`,
    }, revision, { name: text(rate.name), locs: text(rate.locs), cur: text(rate.cur) || "USD", annual: finite(rate.annual) }, rateFields(gate, rate)),
    remove(gate.page, ["delete", "rates", id, null], {
      label: { en: `Delete rate card: ${identity}`, br: `Excluir cartão de taxa: ${identity}` },
      group: { en: identity, br: identity },
      action: "delete", id, version: revision, target: { collection: "rates", id },
      ...contextOf(gate.plan.id, "rates", {}, []),
      en: `Delete rate card ${identity}? This cannot be undone.`,
      br: `Excluir o cartão de taxa ${identity}? Esta ação não pode ser desfeita.`,
    }),
  ]
}

function rateFields(gate: Gate, rate: Row): NativeField[] {
  const cur = text(rate.cur) || "USD"
  return [
    { kind: "text", path: ["name"], label: { en: "Name", br: "Nome" }, required: true, blank: "empty" },
    { kind: "text", path: ["locs"], label: { en: "Locations", br: "Localidades" }, blank: "empty" },
    { kind: "select", path: ["cur"], label: { en: "Currency", br: "Moeda" }, required: true, options: currencyChoices(gate.version, cur) },
    { kind: "number", path: ["annual"], label: { en: "Annual cost", br: "Custo anual" }, required: true, min: 0, blank: "null" },
  ]
}

function annualAdjustment(gate: Gate, id: string, identity: string, group: NativeText, version: number, annual: unknown): NativeAction {
  return saveRecord(gate, "lines", id, "annual", identity, {
    en: `Adjust annual budget: ${identity}`, br: `Ajustar orçamento anual: ${identity}`,
  }, version, { annual: finite(annual) }, [
    { kind: "number", path: ["annual"], label: { en: "Annual budget", br: "Orçamento anual" }, blank: "null" },
  ], group)
}

function budgetMonths(gate: Gate, id: string, identity: string, group: NativeText, version: number, source: unknown): NativeAction[] {
  const amounts = monthsOf(source, false)
  return MONTHS.map((month, index) => saveRecord(gate, "lines", id, `month-${index}`, identity, {
    en: `Save ${month.en} budget: ${identity}`, br: `Salvar orçamento de ${month.br}: ${identity}`,
  }, version, { month: index, value: amounts[index] }, [
    { kind: "number", path: ["value"], label: { en: `${month.en} budget`, br: `Orçamento de ${month.br}` }, blank: "null" },
  ], group))
}

function monthAction(gate: Gate, id: string, identity: string, group: NativeText, version: number, prefix: "a" | "f", suffix: string, source: unknown, nullable: boolean, label: NativeText): NativeAction {
  const values: Record<string, unknown> = {}
  const amounts = monthsOf(source, nullable)
  const fields: NativeField[] = [{
    kind: "group",
    label: prefix === "a" ? { en: "Actual", br: "Realizado" } : { en: "Forecast", br: "Previsão" },
    fields: MONTHS.map((month, index) => {
      values[`${prefix}${index}`] = amounts[index]
      return { kind: "number" as const, path: [`${prefix}${index}`], label: month, blank: "null" as const }
    }),
  }]
  return saveRecord(gate, "lines", id, suffix, identity, label, version, values, fields, group)
}

function plainLine(gate: Gate, action: string, id: string, identity: string, group: NativeText, version: number, label: NativeText): NativeAction {
  return make(gate.page, [action, "lines", id, null], {
    label, group, action, id, version, target: { collection: "lines", id },
    ...contextOf(gate.plan.id, "lines", {}, []),
  })
}

function lineField(gate: Gate, line: Row, wire: string, values: Record<string, unknown>): NativeField[] {
  if (wire === "name") {
    values.name = text(line.name)
    return [{ kind: "text", path: ["name"], label: { en: "Name", br: "Nome" }, blank: "empty" }]
  }
  if (wire === "desc") {
    values.desc = text(line.desc)
    return [{ kind: "textarea", path: ["desc"], label: { en: "Description", br: "Descrição" }, blank: "empty" }]
  }
  if (wire === "code") {
    values.code = text(line.code)
    return [{ kind: "text", path: ["code"], label: { en: "Code", br: "Código" }, blank: "empty" }]
  }
  if (wire === "owner") {
    const current = ownerId(line)
    values.owner = current
    return [{ kind: "select", path: ["owner"], label: { en: "Owner", br: "Responsável" }, blank: "empty", options: directoryChoices(gate, current) }]
  }
  if (wire === "entity") {
    const current = idOf(line.entity)
    values.entity = current
    return [{ kind: "select", path: ["entity"], label: { en: "Entity", br: "Entidade" }, blank: "empty", options: namedChoices(rows(gate.data.entities), current, { en: "None", br: "Nenhum" }) }]
  }
  if (wire === "alloc") {
    const current = idOf(line.alloc)
    values.alloc = current
    return [{ kind: "select", path: ["alloc"], label: { en: "Allocation", br: "Alocação" }, blank: "empty", options: namedChoices(rows(gate.data.allocations), current, { en: "None", br: "Nenhum" }) }]
  }
  if (wire === "el") {
    const current = text(line.el) || "licenses"
    values.el = current
    return [{ kind: "select", path: ["el"], label: { en: "Element", br: "Elemento" }, required: true, options: elementChoices(gate.page, current) }]
  }
  if (wire === "cur") {
    const current = text(line.cur) || "USD"
    values.cur = current
    return [{ kind: "select", path: ["cur"], label: { en: "Currency", br: "Moeda" }, required: true, options: currencyChoices(gate.version, current) }]
  }
  if (wire === "proj") {
    const current = idOf(line.proj)
    values.proj = current
    return [{ kind: "select", path: ["proj"], label: { en: "Project", br: "Projeto" }, required: true, options: projectChoices(rows(gate.version.projects), current) }]
  }
  if (wire === "cls") {
    const current = text(line.cls) || "capex"
    values.cls = current
    return [{ kind: "select", path: ["cls"], label: { en: "Classification", br: "Classificação" }, required: true, options: withCurrent(CLASSES, current) }]
  }
  return []
}

function picked(gate: Gate, scope: PlannerLine, pairs: readonly (readonly [string, string])[]): string[] {
  return pairs.flatMap(([permissionName, wire]) => allows(gate, permissionName, scope) ? [wire] : [])
}

function saveRecord(gate: Gate, collection: string, id: string | undefined, suffix: string, identity: string, label: NativeText, version: number, values: Record<string, unknown>, fields: readonly NativeField[], group?: NativeText): NativeAction {
  return make(gate.page, [id ? "save" : "save", collection, id ?? null, suffix], {
    label, group: group ?? { en: identity, br: identity }, action: "save", ...(id !== undefined ? { id } : {}), version,
    ...(id !== undefined ? { target: { collection, id } } : {}),
    ...contextOf(gate.plan.id, collection, values, fields),
  })
}

function contextOf(versionId: string, collection: string | undefined, values: Record<string, unknown>, fields: readonly NativeField[]): { values: Record<string, unknown>; fields: NativeField[] } {
  return {
    values: { versionId, ...(collection !== undefined ? { collection } : {}), ...values },
    fields: [
      locked("versionId", { en: "Plan", br: "Plano" }),
      ...(collection !== undefined ? [locked("collection", { en: "Collection", br: "Coleção" })] : []),
      ...fields,
    ],
  }
}

function remove(page: string, parts: readonly [string, string, string | null, string | null], spec: {
  label: NativeText
  group?: NativeText
  action: string
  id?: string
  version: number
  values: Record<string, unknown>
  fields: readonly NativeField[]
  target?: { collection: string; id: string }
  en: string
  br: string
}): NativeAction {
  return { ...make(page, parts, spec), danger: true, confirm: { en: spec.en, br: spec.br } }
}

function make(page: string, parts: readonly [string, string, string | null, string | null], spec: {
  label: NativeText
  group?: NativeText
  action: string
  id?: string
  version: number
  values: Record<string, unknown>
  fields: readonly NativeField[]
  target?: { collection: string; id: string }
}): NativeAction {
  return {
    key: JSON.stringify(["planner", page, ...parts]),
    label: spec.label,
    ...(spec.group ? { group: spec.group } : {}),
    ...(spec.target ? { target: spec.target } : {}),
    command: {
      page,
      action: spec.action,
      ...(spec.id !== undefined ? { id: spec.id } : {}),
      version: spec.version,
      values: spec.values,
    },
    fields: spec.fields,
  }
}

function allows(gate: Gate, permissionName: string, line?: PlannerLine): boolean {
  if (plannerField(permissionName, gate.plan, gate.official, gate.actor, line)) return true
  if (!line) return false
  return ownerMayEdit(permissionName, gate.plan, gate.official, gate.actor, line)
}

function createAllowed(gate: Gate, permissionName: string, ownerId: string): boolean {
  if (plannerField(permissionName, gate.plan, gate.official, gate.actor)) return true
  return ownerMayEdit(permissionName, gate.plan, gate.official, gate.actor, { ownerId })
}

function lineScope(line: Row, hr: boolean): PlannerLine {
  return { ownerId: ownerId(line), domain: text(line.domain), hr: hr || line.synthetic === true }
}

function selectedVersion(data: Row, query: Readonly<Record<string, string>>, year: number): Row | undefined {
  const versions = rows(data.versions)
  const requested = text(query.version) || idOf(data.version) || idOf(data.versionId)
  const chosen = requested ? versions.find((version) => idOf(version.id) === requested) : undefined
  return chosen || versions.find((version) => finite(version.year) === year) || versions[0]
}

function officialFor(snapshot: Snapshot, data: Row, year: number): string | undefined {
  return idOf(object(data.officials)[String(year)]) || idOf(object(snapshot.data.officials)[String(year)]) || undefined
}

function splitValue(lists: unknown, element: string): boolean {
  const stored = object(lists)[element]
  const value = object(stored).split
  if (value === true || value === "true") return true
  if (value === false || value === "false") return false
  return element === "licenses" || element === "services" || element === "hwo" || element === "te"
}

function directoryChoices(gate: Gate, current: string): NativeChoice[] {
  const fromView = rows(gate.data.directory)
  const people = fromView.length
    ? fromView
    : gate.environment.directory.map((person): Row => ({ id: person.id, name: person.name }))
  return namedChoices(people, current, { en: "None", br: "Nenhum" })
}

function currencyChoices(version: Row, current: string): NativeChoice[] {
  const codes = [...new Set(["USD", ...rows(version.fx).map((rate) => text(rate.cur)).filter((code) => code && code !== "USD")])]
  return withCurrent(codes.map((code) => ({ value: code, label: { en: code, br: code } })), current)
}

function elementChoices(page: string, current: string): NativeChoice[] {
  const values: string[] = OPEX_ELEMENTS.filter((element) => page === "CAPEX" ? element !== "depr" : element !== "hr").map((element) => element)
  if (current && !values.includes(current)) values.push(current)
  return values.map((element) => ({ value: element, label: elementLabel(element) }))
}

function elementLabel(element: string): NativeText {
  return ELEMENT_LABELS[element] ?? { en: element, br: element }
}

function projectChoices(projects: readonly Row[], current: string): NativeChoice[] {
  const options = projects.flatMap((project) => {
    const id = idOf(project.id)
    if (!id) return []
    const name = text(project.name) || id
    const code = text(project.code)
    const label = code ? `${name} (${code})` : name
    return [{ value: id, label: { en: label, br: label } }]
  })
  if (!current) return [{ value: "", label: { en: "Choose a project", br: "Escolha um projeto" } }, ...options]
  return withCurrent(options, current)
}

function namedChoices(records: readonly Row[], current: string, blank: NativeText): NativeChoice[] {
  return withCurrent([
    { value: "", label: blank },
    ...records.flatMap((row) => {
      const id = idOf(row.id)
      if (!id) return []
      const name = text(row.name) || id
      return [{ value: id, label: { en: name, br: name } }]
    }),
  ], current)
}

function withCurrent(options: readonly NativeChoice[], current: string): NativeChoice[] {
  if (!current || options.some((option) => option.value === current)) return [...options]
  return [...options, { value: current, label: { en: current, br: current } }]
}

function monthsOf(value: unknown, nullable: boolean): (number | null)[] {
  const source = Array.isArray(value) ? value : []
  return Array.from({ length: 12 }, (_, index) => {
    const parsed = numberOrNull(source[index])
    if (parsed === null) return nullable ? null : 0
    return parsed
  })
}

function numberOrNull(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value
  if (typeof value !== "string" || !value.trim()) return null
  const parsed = Number(/^\d+,\d+$/.test(value.trim()) ? value.trim().replace(",", ".") : value.trim())
  return Number.isFinite(parsed) ? parsed : null
}

function cas(revisions: Snapshot["versions"], key: string): number {
  return revisions[key]?.version ?? 0
}

function locked(path: string, label: NativeText): NativeField {
  return { kind: "text", path: [path], label, readOnly: true, required: true }
}

function planIdentity(version: Row): string {
  return recordIdentity(version.name, idOf(version.id))
}

function recordIdentity(name: unknown, id: string): string {
  const label = text(name).trim()
  return label ? `${label} (${id})` : id
}

function ownerId(line: Row): string {
  return text(line.ownerId) || idOf(object(line.owner).id) || text(line.owner)
}

function idOf(value: unknown): string {
  return typeof value === "string" || (typeof value === "number" && Number.isFinite(value)) ? String(value) : ""
}
