import { rows } from "./contract.ts"
import type { NativeAction, NativeChoice, NativeField, NativeText, View } from "./contract.ts"

type Row = Record<string, unknown>
type OperationInput = {
  page: string
  year: number
  month: number
  versions: View["versions"]
  categories: readonly string[]
  items: readonly string[]
  tickets: readonly Row[]
  sla: readonly Row[]
  heatmap: readonly Row[]
}
type SecurityInput = {
  page: string
  year: number
  month: number
  versions: View["versions"]
  kpis: readonly Row[]
  actions: readonly Row[]
  incidents: readonly Row[]
  campaigns: readonly Row[]
}

export function operationActions(input: OperationInput): readonly NativeAction[] {
  const period = `${input.year}-${input.month}`
  const version = revision(input.versions, `ops:${period}`)
  const ticketRow = forMonth(input.tickets, input.year, input.month)
  const slaRow = forMonth(input.sla, input.year, input.month)
  return [
    descriptor({
      key: ["save-tickets", input.year, input.month],
      label: withIdentity({ en: "Save ticket register", br: "Salvar registro de chamados" }, period),
      group: { en: "Ticket register", br: "Registro de chamados" },
      page: input.page,
      name: "save-tickets",
      version,
      target: { collection: "opsTickets", id: period },
      values: ticketValues(ticketRow, input.categories, input.year, input.month),
      fields: [...periodFields(input.year, input.month), ...ticketGroups(input.categories)],
    }),
    descriptor({
      key: ["save-sla", input.year, input.month],
      label: withIdentity({ en: "Save service levels", br: "Salvar níveis de serviço" }, period),
      group: { en: "SLA and availability", br: "SLA e disponibilidade" },
      page: input.page,
      name: "save-sla",
      version,
      target: { collection: "opsSLA", id: period },
      values: slaValues(slaRow, input.year, input.month),
      fields: [
        ...periodFields(input.year, input.month),
        numberField("incSLA", { en: "Incident SLA", br: "SLA de incidentes" }, "null"),
        numberField("svcSLA", { en: "Service SLA", br: "SLA de serviços" }, "null"),
        numberField("avail", { en: "Availability", br: "Disponibilidade" }, "null"),
      ],
    }),
    ...input.items.map((item, index) => heatmapAction(input, version, item, index)),
    listAction(input, "save-categories", "opsCats", { en: "Save categories", br: "Salvar categorias" }, {
      en: "Categories",
      br: "Categorias",
    }),
    listAction(input, "save-items", "opsHmItems", { en: "Save heat-map items", br: "Salvar itens do mapa de calor" }, {
      en: "Heat-map items",
      br: "Itens do mapa de calor",
    }),
  ]
}

export function securityActions(input: SecurityInput): readonly NativeAction[] {
  return [
    ...kpiActions(input),
    ...recordActions(input, {
      collection: "secActions",
      save: "save-action",
      remove: "delete-action",
      group: { en: "Management actions", br: "Ações de gestão" },
      createLabel: { en: "New management action", br: "Nova ação de gestão" },
      editLabel: { en: "Save management action", br: "Salvar ação de gestão" },
      deleteLabel: { en: "Delete management action", br: "Excluir ação de gestão" },
      confirm: (identity) => ({
        en: `Delete management action ${identity}?`,
        br: `Excluir a ação de gestão ${identity}?`,
      }),
      valuesFor: actionValues,
      fieldsFor: actionFields,
      nameFor: (row) => textValue(row.text),
    }),
    ...recordActions(input, {
      collection: "secIncidents",
      save: "save-incident",
      remove: "delete-incident",
      group: { en: "Security incidents", br: "Incidentes de segurança" },
      createLabel: { en: "New security incident", br: "Novo incidente de segurança" },
      editLabel: { en: "Save security incident", br: "Salvar incidente de segurança" },
      deleteLabel: { en: "Delete security incident", br: "Excluir incidente de segurança" },
      confirm: (identity) => ({
        en: `Delete security incident ${identity}?`,
        br: `Excluir o incidente de segurança ${identity}?`,
      }),
      include: (row) => textValue(row.date).startsWith(String(input.year)),
      valuesFor: incidentValues,
      fieldsFor: incidentFields,
      nameFor: (row) => textValue(row.title),
    }),
    ...recordActions(input, {
      collection: "secPhishing",
      save: "save-campaign",
      remove: "delete-campaign",
      group: { en: "Phishing simulation", br: "Simulação de phishing" },
      createLabel: { en: "New phishing campaign", br: "Nova campanha de phishing" },
      editLabel: { en: "Save phishing campaign", br: "Salvar campanha de phishing" },
      deleteLabel: { en: "Delete phishing campaign", br: "Excluir campanha de phishing" },
      confirm: (identity) => ({
        en: `Delete phishing campaign ${identity}?`,
        br: `Excluir a campanha de phishing ${identity}?`,
      }),
      valuesFor: campaignValues,
      fieldsFor: campaignFieldsFor,
      nameFor: (row) => textValue(row.name),
    }),
  ]
}

function heatmapAction(input: OperationInput, version: number, item: string, index: number) {
  const identity = `${input.year}-${input.month}:${item}`
  const row = input.heatmap.find(
    (candidate) => candidate.year === input.year && candidate.month === input.month && candidate.item === item,
  )
  return descriptor({
    key: ["save-heatmap", input.year, input.month, index, item],
    label: withIdentity({ en: "Save heat-map cell", br: "Salvar célula do mapa de calor" }, identity),
    group: { en: "Heat map", br: "Mapa de calor" },
    page: input.page,
    name: "save-heatmap",
    version,
    target: { collection: "opsHeatmap", id: identity },
    values: {
      year: input.year,
      month: input.month,
      item,
      p1: finiteOrNull(row?.p1),
      p2: finiteOrNull(row?.p2),
      tickets: finiteOrNull(row?.tickets),
      comments: textValue(row?.comments),
    },
    fields: [
      ...periodFields(input.year, input.month),
      itemField(input.items),
      numberField("p1", { en: "P1", br: "P1" }, "null"),
      numberField("p2", { en: "P2", br: "P2" }, "null"),
      numberField("tickets", { en: "Tickets", br: "Chamados" }, "null"),
      textField("comments", { en: "Comments", br: "Comentários" }, "textarea"),
    ],
  })
}

// Newline string is the ordinary names wire. Execute trims each line; a string array is the other accepted form.
function listAction(
  input: OperationInput,
  name: "save-categories" | "save-items",
  collection: "opsCats" | "opsHmItems",
  label: NativeText,
  field: NativeText,
) {
  const names = collection === "opsCats" ? input.categories : input.items
  return descriptor({
    key: [name, collection],
    label: withIdentity(label, collection),
    group: { en: "Categories and items", br: "Categorias e itens" },
    page: input.page,
    name,
    version: revision(input.versions, `ops-list:${collection}`),
    target: { collection, id: collection },
    values: { names: names.join("\n") },
    fields: [textField("names", field, "textarea")],
  })
}

function kpiActions(input: SecurityInput): NativeAction[] {
  const row = forMonth(input.kpis, input.year, input.month)
  const id = row ? rowId(row) : undefined
  const identity = kpiIdentity(input.year, input.month, id)
  const version = revision(input.versions, `security:${input.year}-${input.month}`)
  const target = { collection: "secKpi", id: id ?? `${input.year}-${input.month}` }
  const save = descriptor({
    key: ["save-kpi", input.year, input.month, id ?? ""],
    label: withIdentity({ en: "Save monthly KPI", br: "Salvar KPI mensal" }, identity),
    group: { en: "Monthly KPIs", br: "KPIs mensais" },
    page: input.page,
    name: "save-kpi",
    version,
    id,
    target,
    values: kpiValues(row, input.year, input.month),
    fields: [...periodFields(input.year, input.month), ...kpiGroups()],
  })
  if (!row) return [save]
  return [
    save,
    descriptor({
      key: ["delete-kpi", input.year, input.month, id ?? ""],
      label: withIdentity({ en: "Delete monthly KPI", br: "Excluir KPI mensal" }, identity),
      group: { en: "Monthly KPIs", br: "KPIs mensais" },
      page: input.page,
      name: "delete-kpi",
      version,
      id,
      target,
      values: { year: input.year, month: input.month },
      fields: periodFields(input.year, input.month, true),
      confirm: { en: `Delete monthly KPI ${identity}?`, br: `Excluir o KPI mensal ${identity}?` },
    }),
  ]
}

function recordActions(
  input: SecurityInput,
  spec: {
    collection: "secActions" | "secIncidents" | "secPhishing"
    save: string
    remove: string
    group: NativeText
    createLabel: NativeText
    editLabel: NativeText
    deleteLabel: NativeText
    confirm: (identity: string) => NativeText
    include?: (row: Row) => boolean
    valuesFor: (row: Row | undefined) => Record<string, unknown>
    fieldsFor: (row: Row | undefined) => readonly NativeField[]
    nameFor: (row: Row) => string
  },
) {
  const existing = input[spec.collection === "secActions" ? "actions" : spec.collection === "secIncidents" ? "incidents" : "campaigns"].flatMap(
    (row) => {
      if (spec.include && !spec.include(row)) return []
      const id = rowId(row)
      if (!id) return []
      const identity = namedIdentity(spec.nameFor(row), id)
      const version = revision(input.versions, `${spec.collection}:${id}`)
      const target = { collection: spec.collection, id }
      return [
        descriptor({
          key: [spec.collection, spec.save, "edit", id],
          label: withIdentity(spec.editLabel, identity),
          group: spec.group,
          page: input.page,
          name: spec.save,
          version,
          id,
          target,
          values: spec.valuesFor(row),
          fields: spec.fieldsFor(row),
        }),
        descriptor({
          key: [spec.collection, spec.remove, "edit", id],
          label: withIdentity(spec.deleteLabel, identity),
          group: spec.group,
          page: input.page,
          name: spec.remove,
          version,
          id,
          target,
          values: {},
          fields: [],
          confirm: spec.confirm(identity),
        }),
      ]
    },
  )
  return [
    ...existing,
    descriptor({
      key: [spec.save, "create"],
      label: spec.createLabel,
      group: spec.group,
      page: input.page,
      name: spec.save,
      version: 0,
      values: spec.valuesFor(undefined),
      fields: spec.fieldsFor(undefined),
    }),
  ]
}

function descriptor(spec: {
  key: readonly (string | number)[]
  label: NativeText
  group: NativeText
  page: string
  name: string
  version: number
  id?: string
  target?: { collection: string; id: string }
  values: Record<string, unknown>
  fields: readonly NativeField[]
  confirm?: NativeText
}): NativeAction {
  return {
    key: JSON.stringify(spec.key),
    label: spec.label,
    group: spec.group,
    ...(spec.target ? { target: spec.target } : {}),
    command: {
      page: spec.page,
      action: spec.name,
      ...(spec.id ? { id: spec.id } : {}),
      version: spec.version,
      values: spec.values,
    },
    fields: spec.fields,
    ...(spec.confirm ? { confirm: spec.confirm, danger: true } : {}),
  }
}

function ticketValues(row: Row | undefined, categories: readonly string[], year: number, month: number) {
  return Object.fromEntries([
    ["year", year],
    ["month", month],
    ...unique(categories).flatMap((category) =>
      ticketTypes.flatMap((type) =>
        ticketMeasures.map((measure) => {
          const key = `${category}|${type.wire}|${measure.wire}`
          return [key, finiteOrNull(row?.[key])] as const
        }),
      ),
    ),
  ])
}

function slaValues(row: Row | undefined, year: number, month: number) {
  return {
    year,
    month,
    incSLA: finiteOrNull(row?.incSLA),
    svcSLA: finiteOrNull(row?.svcSLA),
    // Null or blank availability stores 100. An explicit number, including 0, is kept.
    avail: finiteOrNull(row?.avail),
  }
}

function kpiValues(row: Row | undefined, year: number, month: number) {
  return {
    year,
    month,
    ...Object.fromEntries(kpiFields.map((field) => [field.name, measure(row?.[field.name])])),
    notes: textValue(row?.notes),
  }
}

function actionValues(row: Row | undefined) {
  return { text: textValue(row?.text), done: flag(row?.done) }
}

function actionFields(_row: Row | undefined): NativeField[] {
  return [
    textField("text", { en: "Action", br: "Ação" }, "textarea", true),
    checkbox("done", { en: "Done", br: "Concluída" }),
  ]
}

function incidentValues(row: Row | undefined) {
  return {
    title: textValue(row?.title),
    date: textValue(row?.date),
    impact: textValue(row?.impact),
    notes: textValue(row?.notes),
    contained: flag(row?.contained),
    remediated: flag(row?.remediated),
    rootCause: flag(row?.rootCause),
    consequences: consequenceValues(row?.consequences),
  }
}

function incidentFields(row: Row | undefined): NativeField[] {
  return [
    textField("title", { en: "Title", br: "Título" }, "text", true),
    textField("date", { en: "Date", br: "Data" }, "date", true),
    textField("impact", { en: "Impact", br: "Impacto" }, "textarea"),
    textField("notes", { en: "Notes", br: "Observações" }, "textarea"),
    checkbox("contained", { en: "Contained", br: "Contido" }),
    checkbox("remediated", { en: "Remediated", br: "Remediado" }),
    checkbox("rootCause", { en: "Root cause", br: "Causa raiz" }),
    consequenceFields(),
  ]
}

function campaignValues(row: Row | undefined) {
  return {
    name: textValue(row?.name),
    start: textValue(row?.start),
    end: textValue(row?.end),
    ...Object.fromEntries(campaignFields.map((field) => [field.name, measure(row?.[field.name])])),
    notes: textValue(row?.notes),
    departments: departmentValues(row?.departments),
  }
}

function campaignFieldsFor(_row: Row | undefined): NativeField[] {
  return [
    textField("name", { en: "Campaign name", br: "Nome da campanha" }, "text", true),
    textField("start", { en: "Start", br: "Início" }, "date"),
    textField("end", { en: "End", br: "Fim" }, "date"),
    ...campaignFields.map((field) => numberField(field.name, field.label, "empty")),
    textField("notes", { en: "Notes", br: "Observações" }, "textarea"),
    departmentList(),
  ]
}

function kpiGroups(): NativeField[] {
  return [
    {
      kind: "group",
      label: { en: "Awareness", br: "Conscientização" },
      fields: pick(["training", "assessment"]),
    },
    {
      kind: "group",
      label: { en: "Vulnerability and patch", br: "Vulnerabilidade e patch" },
      fields: pick(["scan", "patch", "patchEndpoint", "patchServer"]),
    },
    {
      kind: "group",
      label: { en: "SOC", br: "SOC" },
      fields: pick([
        "socCritical",
        "socHigh",
        "socMedium",
        "socLow",
        "socPending",
        "socTP",
        "socFP",
        "socEPS",
        "socIPs",
        "socClosure",
      ]),
    },
    textField("notes", { en: "Notes", br: "Observações" }, "textarea"),
  ]
}

function pick(names: readonly string[]): NativeField[] {
  return names.flatMap((name) => {
    const field = kpiFields.find((item) => item.name === name)
    if (!field) return []
    return [numberField(field.name, field.label, "empty")]
  })
}

function ticketGroups(categories: readonly string[]): NativeField[] {
  return unique(categories).map(
    (category): NativeField => ({
      kind: "group",
      label: { en: category, br: category },
      fields: ticketTypes.map(
        (type): NativeField => ({
          kind: "group",
          label: { en: type.en, br: type.br },
          fields: ticketMeasures.map((measure) =>
            numberField(`${category}|${type.wire}|${measure.wire}`, { en: measure.en, br: measure.br }, "null"),
          ),
        }),
      ),
    }),
  )
}

function periodFields(year: number, month: number, readOnly = true): NativeField[] {
  const years = [2024, 2025, 2026, 2027]
  const yearChoices = years.includes(year) || !Number.isSafeInteger(year) ? years : [...years, year]
  const baseMonths = Array.from({ length: 12 }, (_, index) => index + 1)
  const monthChoices =
    baseMonths.includes(month) || !Number.isSafeInteger(month) ? baseMonths : [...baseMonths, month]
  return [
    {
      kind: "select",
      path: ["year"],
      label: { en: "Year", br: "Ano" },
      required: true,
      ...(readOnly ? { readOnly: true } : {}),
      options: yearChoices.map((value) => ({ value, label: { en: String(value), br: String(value) } })),
    },
    {
      kind: "select",
      path: ["month"],
      label: { en: "Month", br: "Mês" },
      required: true,
      ...(readOnly ? { readOnly: true } : {}),
      options: monthChoices.map((value) => ({
        value,
        label: monthLabels[value - 1] ?? { en: String(value), br: String(value) },
      })),
    },
  ]
}

function itemField(items: readonly string[]): NativeField {
  return {
    kind: "select",
    path: ["item"],
    label: { en: "Item", br: "Item" },
    required: true,
    readOnly: true,
    options: unique(items).map((value) => ({ value, label: { en: value, br: value } })),
  }
}

function consequenceFields(): NativeField {
  return {
    kind: "multiselect",
    path: ["consequences"],
    label: { en: "Consequences", br: "Consequências" },
    options: consequenceChoices,
  }
}

function departmentList(): NativeField {
  return {
    kind: "list",
    path: ["departments"],
    label: { en: "Departments", br: "Departamentos" },
    add: { name: "", users: "", failed: "", entered: "", reported: "" },
    remove: true,
    minimum: 0,
    fields: [
      textField("name", { en: "Department", br: "Departamento" }),
      numberField("users", { en: "Users", br: "Usuários" }, "empty"),
      numberField("failed", { en: "Failed", br: "Falhas" }, "empty"),
      numberField("entered", { en: "Entered", br: "Inseridas" }, "empty"),
      numberField("reported", { en: "Reported", br: "Reportados" }, "empty"),
    ],
  }
}

function numberField(name: string, label: NativeText, blank: "null" | "empty"): NativeField {
  return { kind: "number", path: [name], label, min: 0, blank }
}

function textField(
  name: string,
  label: NativeText,
  kind: "text" | "textarea" | "date" = "text",
  required = false,
): NativeField {
  return { kind, path: [name], label, blank: "empty", ...(required ? { required: true } : {}) }
}

function checkbox(name: string, label: NativeText): NativeField {
  return { kind: "checkbox", path: [name], label }
}

function revision(versions: View["versions"], key: string) {
  const version = versions[key]?.version
  return typeof version === "number" && Number.isSafeInteger(version) && version >= 0 ? version : 0
}

function forMonth(records: readonly Row[], year: number, month: number) {
  return records.find((row) => row.year === year && row.month === month)
}

function rowId(row: Row) {
  if (typeof row.id === "string" && row.id) return row.id
  if (typeof row.id === "number" && Number.isSafeInteger(row.id)) return String(row.id)
  return undefined
}

function unique(values: readonly string[]) {
  const seen = new Set<string>()
  return values.filter((value) => {
    if (seen.has(value)) return false
    seen.add(value)
    return true
  })
}

function finiteOrNull(value: unknown): number | string | null {
  if (typeof value === "number" && Number.isFinite(value)) return value
  if (typeof value === "string" && value.trim()) return value
  return null
}

function measure(value: unknown): number | string {
  if (typeof value === "number" && Number.isFinite(value)) return value
  if (typeof value === "string") return value
  return ""
}

function textValue(value: unknown) {
  return typeof value === "string" ? value : ""
}

function flag(value: unknown) {
  return value === true || value === "true" || value === "yes"
}

function consequenceValues(value: unknown) {
  if (!Array.isArray(value)) return []
  return value.filter((item): item is string => typeof item === "string")
}

function departmentValues(value: unknown) {
  return rows(value).map((row) => ({
    name: textValue(row.name),
    users: measure(row.users),
    failed: measure(row.failed),
    entered: measure(row.entered),
    reported: measure(row.reported),
  }))
}

function namedIdentity(name: string, id: string) {
  const clean = name.trim().replace(/\s+/g, " ")
  if (!clean) return id
  const suffix = ` (${id})`
  const room = 96 - suffix.length
  const short = room < 2 ? "…" : clean.length > room ? `${clean.slice(0, room - 1)}…` : clean
  return `${short}${suffix}`
}

function kpiIdentity(year: number, month: number, id: string | undefined) {
  const period = `${year}-${month}`
  if (!id || id === period) return period
  return `${period} (${id})`
}

function withIdentity(label: NativeText, identity: string): NativeText {
  return { en: `${label.en} — ${identity}`, br: `${label.br} — ${identity}` }
}

const monthLabels: NativeText[] = [
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

const ticketTypes = [
  { wire: "Incidents", en: "Incidents", br: "Incidentes" },
  { wire: "Service Requests", en: "Service requests", br: "Solicitações de serviço" },
] as const

const ticketMeasures = [
  { wire: "Initial Balance", en: "Initial balance", br: "Saldo inicial" },
  { wire: "Open", en: "Open", br: "Abertos" },
  { wire: "Closed", en: "Closed", br: "Fechados" },
] as const

const kpiFields: { name: string; label: NativeText }[] = [
  { name: "training", label: { en: "Training", br: "Treinamento" } },
  { name: "assessment", label: { en: "Assessment", br: "Avaliação" } },
  { name: "scan", label: { en: "Vulnerability scan", br: "Varredura de vulnerabilidades" } },
  { name: "patch", label: { en: "Patch compliance", br: "Conformidade de patches" } },
  { name: "patchEndpoint", label: { en: "Endpoint patch", br: "Patch de endpoints" } },
  { name: "patchServer", label: { en: "Server patch", br: "Patch de servidores" } },
  { name: "socCritical", label: { en: "SOC critical", br: "SOC crítico" } },
  { name: "socHigh", label: { en: "SOC high", br: "SOC alto" } },
  { name: "socMedium", label: { en: "SOC medium", br: "SOC médio" } },
  { name: "socLow", label: { en: "SOC low", br: "SOC baixo" } },
  { name: "socPending", label: { en: "SOC pending", br: "SOC pendente" } },
  { name: "socTP", label: { en: "SOC true positives", br: "SOC verdadeiros positivos" } },
  { name: "socFP", label: { en: "SOC false positives", br: "SOC falsos positivos" } },
  { name: "socEPS", label: { en: "SOC EPS", br: "EPS do SOC" } },
  { name: "socIPs", label: { en: "SOC IPs", br: "IPs do SOC" } },
  { name: "socClosure", label: { en: "SOC closure", br: "Fechamento do SOC" } },
]

const campaignFields: { name: string; label: NativeText }[] = [
  { name: "targeted", label: { en: "Targeted", br: "Alvos" } },
  { name: "noInteraction", label: { en: "No interaction", br: "Sem interação" } },
  { name: "openedOnly", label: { en: "Opened only", br: "Somente abertos" } },
  { name: "clicked", label: { en: "Clicked", br: "Cliques" } },
  { name: "entered", label: { en: "Credentials entered", br: "Credenciais inseridas" } },
  { name: "reported", label: { en: "Reported", br: "Reportados" } },
  { name: "trainingCompletion", label: { en: "Training completion", br: "Conclusão do treinamento" } },
  { name: "avgMinutes", label: { en: "Average minutes", br: "Minutos médios" } },
]

const consequenceChoices: readonly NativeChoice[] = [
  { value: "Data exfiltration", label: { en: "Data exfiltration", br: "Exfiltração de dados" } },
  { value: "Data loss", label: { en: "Data loss", br: "Perda de dados" } },
  {
    value: "Service unavailability",
    label: { en: "Service unavailability", br: "Indisponibilidade do serviço" },
  },
]
