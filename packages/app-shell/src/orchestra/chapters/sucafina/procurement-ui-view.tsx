import { For, Show } from "solid-js"
import { useLanguage } from "@/context/language"
import { SF_NATIVE_PROCUREMENT_UI_COPY } from "@/i18n/orchestra-chapters/sucafina-native-procurement-ui"
import type { NativeViewProps } from "./view-contract"

type RecordValue = Record<string, unknown>
type CopyKey = keyof typeof SF_NATIVE_PROCUREMENT_UI_COPY
type Column = { label: CopyKey; value: (row: RecordValue) => unknown }
type Field = [CopyKey, string]

const pages = ["Dashboard", "Requests", "My approvals", "Suppliers", "Settings"]
const object = (value: unknown): RecordValue => value !== null && typeof value === "object" && !Array.isArray(value) ? value as RecordValue : {}
const rows = (value: unknown): RecordValue[] => Array.isArray(value) ? value.filter((item): item is RecordValue => item !== null && typeof item === "object" && !Array.isArray(item)) : []
const display = (value: unknown, t: (key: CopyKey) => string): string => {
  if (typeof value === "string") return value.trim() ? value : "—"
  if (typeof value === "number" && Number.isFinite(value)) return String(value)
  if (typeof value === "boolean") return value ? t("sucafina.native.procurement-ui.yes") : t("sucafina.native.procurement-ui.no")
  if (Array.isArray(value)) return value.map((item) => display(item, t)).join(", ") || "—"
  return "—"
}
const id = (value: unknown): string | undefined => {
  if (typeof value === "string") return value.trim() || undefined
  if (typeof value === "number" && Number.isFinite(value)) return String(value)
  return undefined
}
const sameId = (left: unknown, right: unknown) => {
  const normalized = id(left)
  return normalized !== undefined && normalized === id(right)
}
const columns = (fields: [CopyKey, string][]): Column[] => fields.map(([label, key]) => ({ label, value: (row) => row[key] }))

function ReadTable(props: { name: CopyKey; data: unknown; columns: Column[]; empty?: CopyKey }) {
  const language = useLanguage()
  return (
    <section class="mx-card" aria-label={language.t(props.name)}>
      <h3>{language.t(props.name)}</h3>
      <Show when={Array.isArray(props.data)} fallback={<p class="mx-note">{language.t("sucafina.native.procurement-ui.unavailable")}</p>}>
        <Show when={rows(props.data).length > 0} fallback={<p class="mx-empty">{language.t(props.empty ?? "sucafina.native.procurement-ui.noRecords")}</p>}>
          <div style={{ "overflow-x": "auto", "max-width": "100%" }}>
            <table>
              <thead><tr><For each={props.columns}>{(column) => <th scope="col">{language.t(column.label)}</th>}</For></tr></thead>
              <tbody><For each={rows(props.data)}>{(row) => <tr><For each={props.columns}>{(column) => <td><bdi dir="auto">{display(column.value(row), language.t)}</bdi></td>}</For></tr>}</For></tbody>
            </table>
          </div>
        </Show>
      </Show>
    </section>
  )
}

function Fields(props: { name: CopyKey; value: unknown; fields: Field[] }) {
  const language = useLanguage()
  return (
    <section class="mx-card" aria-label={language.t(props.name)}>
      <h3>{language.t(props.name)}</h3>
      <dl class="mx-fields">
        <For each={props.fields}>{(field) => <div class="mx-field"><dt>{language.t(field[0])}</dt><dd><bdi dir="auto">{display(object(props.value)[field[1]], language.t)}</bdi></dd></div>}</For>
      </dl>
    </section>
  )
}

const requestColumns: Column[] = [
  { label: "sucafina.native.procurement-ui.column.number", value: (row) => row.number },
  { label: "sucafina.native.procurement-ui.column.title", value: (row) => object(row.pr).title },
  { label: "sucafina.native.procurement-ui.column.requester", value: (row) => row.requesterName },
  { label: "sucafina.native.procurement-ui.column.status", value: (row) => row.status },
  { label: "sucafina.native.procurement-ui.column.amount", value: (row) => row.value },
  { label: "sucafina.native.procurement-ui.column.updated", value: (row) => row.updatedAt },
  { label: "sucafina.native.procurement-ui.column.poNumber", value: (row) => object(row.po).number },
  { label: "sucafina.native.procurement-ui.column.expenseType", value: (row) => object(row.po).expenseType },
  { label: "sucafina.native.procurement-ui.column.recurring", value: (row) => object(row.pr).recurring },
]
const prFields: Field[] = [
  ["sucafina.native.procurement-ui.field.title", "title"],
  ["sucafina.native.procurement-ui.field.type", "type"],
  ["sucafina.native.procurement-ui.field.description", "description"],
  ["sucafina.native.procurement-ui.field.category", "category"],
  ["sucafina.native.procurement-ui.field.estimatedAmount", "estAmount"],
  ["sucafina.native.procurement-ui.field.costCentre", "costCenter"],
  ["sucafina.native.procurement-ui.field.neededBy", "needBy"],
  ["sucafina.native.procurement-ui.field.businessJustification", "justification"],
  ["sucafina.native.procurement-ui.field.recurring", "recurring"],
  ["sucafina.native.procurement-ui.field.frequency", "frequency"],
  ["sucafina.native.procurement-ui.field.estimatedAnnualValue", "estAnnual"],
  ["sucafina.native.procurement-ui.field.expenseType", "expenseType"],
]
const poFields: Field[] = [
  ["sucafina.native.procurement-ui.field.number", "number"],
  ["sucafina.native.procurement-ui.field.supplier", "supplier"],
  ["sucafina.native.procurement-ui.field.currency", "currency"],
  ["sucafina.native.procurement-ui.field.fxRate", "fxRate"],
  ["sucafina.native.procurement-ui.field.expenseType", "expenseType"],
  ["sucafina.native.procurement-ui.field.description", "description"],
  ["sucafina.native.procurement-ui.field.paymentTerms", "paymentTerms"],
  ["sucafina.native.procurement-ui.field.deliveryDate", "deliveryDate"],
  ["sucafina.native.procurement-ui.field.deliveryConditions", "deliveryConditions"],
  ["sucafina.native.procurement-ui.field.contractReference", "contractRef"],
  ["sucafina.native.procurement-ui.field.incoterm", "incoterm"],
  ["sucafina.native.procurement-ui.field.incoterms", "incoterms"],
  ["sucafina.native.procurement-ui.field.assetReference", "assetRef"],
  ["sucafina.native.procurement-ui.field.supplierContact", "supplierContact"],
  ["sucafina.native.procurement-ui.field.quoteReference", "quoteRef"],
  ["sucafina.native.procurement-ui.field.billingAddress", "billingAddress"],
  ["sucafina.native.procurement-ui.field.deliveryAddress", "deliveryAddress"],
  ["sucafina.native.procurement-ui.field.acceptance", "acceptance"],
  ["sucafina.native.procurement-ui.field.warranty", "warranty"],
  ["sucafina.native.procurement-ui.field.notes", "notes"],
  ["sucafina.native.procurement-ui.field.issuedAt", "issuedAt"],
]
const supplierFields: Field[] = [
  ["sucafina.native.procurement-ui.column.number", "number"],
  ["sucafina.native.procurement-ui.field.legalName", "legalName"],
  ["sucafina.native.procurement-ui.field.tradingName", "tradingName"],
  ["sucafina.native.procurement-ui.field.type", "type"],
  ["sucafina.native.procurement-ui.field.country", "country"],
  ["sucafina.native.procurement-ui.field.address", "address"],
  ["sucafina.native.procurement-ui.field.taxId", "taxId"],
  ["sucafina.native.procurement-ui.field.registrationNumber", "regNo"],
  ["sucafina.native.procurement-ui.column.status", "status"],
]

function ApprovalDetails(props: { name: CopyKey; stepsName: CopyKey; value: unknown; directory: readonly { id: string; name: string }[] }) {
  const language = useLanguage()
  return (
    <Show when={props.value != null}>
      <Fields name={props.name} value={props.value} fields={[
        ["sucafina.native.procurement-ui.field.amount", "amount"],
        ["sucafina.native.procurement-ui.field.submitted", "submittedAt"],
      ]} />
      <ReadTable name={props.stepsName} data={object(props.value).steps} columns={[
        { label: "sucafina.native.procurement-ui.field.level", value: (row) => row.levelName },
        { label: "sucafina.native.procurement-ui.field.approver", value: (row) => row.holderId ? props.directory.find((person) => person.id === row.holderId)?.name ?? language.t("sucafina.native.procurement-ui.assignedApprover") : language.t("sucafina.native.procurement-ui.unassigned") },
        { label: "sucafina.native.procurement-ui.column.status", value: (row) => row.status },
        { label: "sucafina.native.procurement-ui.field.comment", value: (row) => row.comment },
        { label: "sucafina.native.procurement-ui.field.at", value: (row) => row.at },
      ]} />
    </Show>
  )
}

function RequestDetail(props: { request: RecordValue; directory: readonly { id: string; name: string }[]; open?: boolean }) {
  const language = useLanguage()
  const sourcing = () => object(props.request.sourcing)
  const po = () => object(props.request.po)
  const historyName = (row: RecordValue) => object(props.request.historyNames)[`${display(row.at, language.t)}|${display(row.by, language.t)}`] ?? props.directory.find((person) => person.id === row.by)?.name ?? row.by
  return (
    <details class="mx-card" open={props.open}>
      <summary><bdi dir="auto">{display(props.request.number, language.t)}</bdi> · <bdi dir="auto">{display(object(props.request.pr).title, language.t)}</bdi></summary>
      <Fields name="sucafina.native.procurement-ui.section.requisition" value={props.request.pr} fields={prFields} />
      <ApprovalDetails name="sucafina.native.procurement-ui.section.requisitionApproval" stepsName="sucafina.native.procurement-ui.section.requisitionApprovalSteps" value={props.request.prApproval} directory={props.directory} />
      <Show when={props.request.sourcing != null}>
        <Fields name="sucafina.native.procurement-ui.section.sourcing" value={sourcing()} fields={[
          ["sucafina.native.procurement-ui.field.technicalEvaluator", "evaluator"],
          ["sucafina.native.procurement-ui.field.fewerQuotationsJustification", "fewQuotesJustification"],
          ["sucafina.native.procurement-ui.field.selectionJustification", "selectionJustification"],
          ["sucafina.native.procurement-ui.field.contractStrategy", "contractStrategy"],
          ["sucafina.native.procurement-ui.field.selectedQuoteId", "selectedId"],
        ]} />
        <ApprovalDetails name="sucafina.native.procurement-ui.section.sourcingApproval" stepsName="sucafina.native.procurement-ui.section.sourcingApprovalSteps" value={sourcing().approval} directory={props.directory} />
        <Fields name="sucafina.native.procurement-ui.section.evaluationWeights" value={sourcing().weights} fields={[
          ["sucafina.native.procurement-ui.field.technicalWeight", "tech"],
          ["sucafina.native.procurement-ui.field.commercialWeight", "comm"],
        ]} />
        <ReadTable name="sucafina.native.procurement-ui.section.technicalCriteria" data={object(sourcing().weights).criteria} columns={columns([
          ["sucafina.native.procurement-ui.field.criterion", "name"],
          ["sucafina.native.procurement-ui.field.weight", "weight"],
        ])} />
        <ReadTable name="sucafina.native.procurement-ui.section.commercialCriteria" data={object(sourcing().weights).commCriteria} columns={columns([
          ["sucafina.native.procurement-ui.field.criterion", "name"],
          ["sucafina.native.procurement-ui.field.weight", "weight"],
          ["sucafina.native.procurement-ui.field.automaticPriceCriterion", "auto"],
        ])} />
        <ReadTable name="sucafina.native.procurement-ui.section.quotations" data={sourcing().quotes} columns={columns([
          ["sucafina.native.procurement-ui.field.supplier", "supplier"],
          ["sucafina.native.procurement-ui.field.currency", "currency"],
          ["sucafina.native.procurement-ui.field.quantity", "qty"],
          ["sucafina.native.procurement-ui.field.unitPrice", "unitPrice"],
          ["sucafina.native.procurement-ui.field.total", "total"],
          ["sucafina.native.procurement-ui.field.technicallyCompliant", "techPass"],
          ["sucafina.native.procurement-ui.field.technicalScores", "scores"],
          ["sucafina.native.procurement-ui.field.commercialScores", "cscores"],
        ])} />
        <ReadTable name="sucafina.native.procurement-ui.section.quoteEvaluation" data={props.request.evaluation} columns={columns([
          ["sucafina.native.procurement-ui.field.supplier", "supplier"],
          ["sucafina.native.procurement-ui.field.technicalScore", "technical"],
          ["sucafina.native.procurement-ui.field.price", "price"],
          ["sucafina.native.procurement-ui.field.commercialScore", "commercial"],
          ["sucafina.native.procurement-ui.field.overallScore", "overall"],
          ["sucafina.native.procurement-ui.field.rank", "rank"],
        ])} />
      </Show>
      <Show when={props.request.po != null}>
        <Fields name="sucafina.native.procurement-ui.section.purchaseOrder" value={po()} fields={poFields} />
        <ApprovalDetails name="sucafina.native.procurement-ui.section.purchaseOrderApproval" stepsName="sucafina.native.procurement-ui.section.purchaseOrderApprovalSteps" value={po().approval} directory={props.directory} />
        <ReadTable name="sucafina.native.procurement-ui.section.purchaseOrderLines" data={po().lines} columns={[
          { label: "sucafina.native.procurement-ui.field.description", value: (row) => row.desc ?? row.description },
          { label: "sucafina.native.procurement-ui.field.quantity", value: (row) => row.qty },
          { label: "sucafina.native.procurement-ui.field.unitPrice", value: (row) => row.unitPrice },
          { label: "sucafina.native.procurement-ui.field.unit", value: (row) => row.uom ?? row.unit },
        ]} />
      </Show>
      <ReadTable name="sucafina.native.procurement-ui.section.history" data={Array.isArray(props.request.history) ? [...rows(props.request.history)].reverse() : props.request.history} columns={[
        { label: "sucafina.native.procurement-ui.field.at", value: (row) => row.at },
        { label: "sucafina.native.procurement-ui.field.by", value: historyName },
        { label: "sucafina.native.procurement-ui.field.action", value: (row) => row.action },
        { label: "sucafina.native.procurement-ui.field.note", value: (row) => row.note },
      ]} />
    </details>
  )
}

function SupplierDetail(props: { supplier: RecordValue; requests: unknown; bankVisible: boolean; open?: boolean }) {
  const language = useLanguage()
  const linked = () => rows(props.requests).filter((request) => sameId(object(request.po).supplierId, props.supplier.id) || rows(object(request.sourcing).quotes).some((quote) => sameId(quote.supplierId, props.supplier.id)))
  return (
    <details class="mx-card" open={props.open}>
      <summary><bdi dir="auto">{display(props.supplier.number, language.t)}</bdi> · <bdi dir="auto">{display(props.supplier.legalName, language.t)}</bdi></summary>
      <Fields name="sucafina.native.procurement-ui.section.general" value={props.supplier} fields={supplierFields} />
      <Fields name="sucafina.native.procurement-ui.section.categories" value={props.supplier} fields={[["sucafina.native.procurement-ui.field.categories", "categories"]]} />
      <Fields name="sucafina.native.procurement-ui.section.contacts" value={props.supplier} fields={[
        ["sucafina.native.procurement-ui.field.contactName", "contactName"],
        ["sucafina.native.procurement-ui.field.contactEmail", "contactEmail"],
        ["sucafina.native.procurement-ui.field.contactPhone", "contactPhone"],
        ["sucafina.native.procurement-ui.field.financeEmail", "financeEmail"],
      ]} />
      <ReadTable name="sucafina.native.procurement-ui.section.additionalContacts" data={props.supplier.contacts} columns={columns([
        ["sucafina.native.procurement-ui.field.name", "name"],
        ["sucafina.native.procurement-ui.field.email", "email"],
        ["sucafina.native.procurement-ui.field.phone", "phone"],
      ])} />
      <Fields name="sucafina.native.procurement-ui.section.commercial" value={props.supplier} fields={[
        ["sucafina.native.procurement-ui.field.paymentTerms", "paymentTerms"],
        ["sucafina.native.procurement-ui.field.currency", "currency"],
        ["sucafina.native.procurement-ui.field.incoterm", "incoterm"],
      ]} />
      <Fields name="sucafina.native.procurement-ui.section.commercialNotes" value={props.supplier.commercial} fields={[["sucafina.native.procurement-ui.field.notes", "notes"]]} />
      <Show when={props.bankVisible}>
        <Fields name="sucafina.native.procurement-ui.section.bank" value={props.supplier} fields={[
          ["sucafina.native.procurement-ui.field.bankName", "bankName"],
          ["sucafina.native.procurement-ui.field.accountHolder", "accountHolder"],
          ["sucafina.native.procurement-ui.field.bankCountry", "bankCountry"],
          ["sucafina.native.procurement-ui.field.iban", "iban"],
          ["sucafina.native.procurement-ui.field.account", "account"],
          ["sucafina.native.procurement-ui.field.swift", "swift"],
        ]} />
      </Show>
      <Fields name="sucafina.native.procurement-ui.section.compliance" value={props.supplier} fields={[
        ["sucafina.native.procurement-ui.field.riskRating", "riskRating"],
        ["sucafina.native.procurement-ui.field.dueDiligenceComplete", "dueDiligence"],
        ["sucafina.native.procurement-ui.field.sanctionsScreeningDate", "sanctionsDate"],
        ["sucafina.native.procurement-ui.field.nda", "nda"],
        ["sucafina.native.procurement-ui.field.dpa", "dpa"],
        ["sucafina.native.procurement-ui.field.certifications", "certifications"],
        ["sucafina.native.procurement-ui.field.notes", "notes"],
      ]} />
      <Fields name="sucafina.native.procurement-ui.section.complianceNotes" value={props.supplier.compliance} fields={[["sucafina.native.procurement-ui.field.notes", "notes"]]} />
      <ReadTable name="sucafina.native.procurement-ui.section.linkedRequests" data={Array.isArray(props.requests) ? linked() : undefined} columns={requestColumns} />
      <ReadTable name="sucafina.native.procurement-ui.section.audit" data={props.supplier.history} columns={columns([
        ["sucafina.native.procurement-ui.field.field", "field"],
        ["sucafina.native.procurement-ui.field.action", "action"],
        ["sucafina.native.procurement-ui.field.at", "at"],
        ["sucafina.native.procurement-ui.field.by", "by"],
        ["sucafina.native.procurement-ui.field.note", "note"],
      ])} />
    </details>
  )
}

export function ProcurementView(props: NativeViewProps) {
  const language = useLanguage()
  const allowed = () => props.page.surface === "procurement" && pages.includes(props.page.page) && props.page.pages.includes(props.page.page)
  const requests = () => rows(props.page.data.requests)
  const suppliers = () => rows(props.page.data.suppliers)
  const filterRequests = () => requests().filter((request) => {
    if (props.query.request && request.number === props.query.request) return true
    const status = typeof request.status === "string" ? request.status : ""
    const filter = props.query.filter || "Open"
    const matches = filter === "All" ||
      (filter === "Open" && !["po_issued", "cancelled"].includes(status)) ||
      (filter === "Closed" && ["po_issued", "cancelled"].includes(status)) ||
      (filter === "Awaiting approval" && status.endsWith("_pending")) ||
      (filter === "Requisition" && ["draft", "pr_pending", "pr_rejected"].includes(status)) ||
      (filter === "Sourcing" && ["sourcing", "src_pending", "src_rejected"].includes(status)) ||
      (filter === "Purchase order" && status.startsWith("po_"))
    const pr = object(request.pr)
    const po = object(request.po)
    const query = (props.query.q ?? "").toLowerCase()
    return matches && [request.number, pr.title, pr.description, pr.costCenter, po.number, po.supplier, request.requesterName].some((value) => typeof value === "string" && value.toLowerCase().includes(query))
  })
  const filterSuppliers = () => suppliers().filter((supplier) => {
    if (sameId(props.query.supplier, supplier.id)) return true
    const status = props.query.status || "All"
    const query = (props.query.q ?? "").toLowerCase()
    return (status === "All" || supplier.status === status) && [supplier.legalName, supplier.number, supplier.taxId].some((value) => typeof value === "string" && value.toLowerCase().includes(query))
  })
  const pending = () => requests().filter((request) => typeof request.status === "string" && request.status.endsWith("_pending"))
  const approval = (request: RecordValue) => object(request.status === "src_pending" ? object(request.sourcing).approval : request.status === "po_pending" ? object(request.po).approval : request.prApproval)
  const step = (request: RecordValue) => rows(approval(request).steps).find((item) => item.status === "pending") ?? {}
  const holder = (request: RecordValue) => {
    const approverId = step(request).holderId
    if (approverId == null || approverId === "") return language.t("sucafina.native.procurement-ui.unassigned")
    return props.page.directory.find((person) => person.id === approverId)?.name ?? language.t("sucafina.native.procurement-ui.assignedApprover")
  }
  const settings = () => object(props.page.data.settings)
  const requestFilters: { value: string; label: CopyKey }[] = [
    { value: "Open", label: "sucafina.native.procurement-ui.filter.open" },
    { value: "Awaiting approval", label: "sucafina.native.procurement-ui.filter.awaitingApproval" },
    { value: "Requisition", label: "sucafina.native.procurement-ui.filter.requisition" },
    { value: "Sourcing", label: "sucafina.native.procurement-ui.filter.sourcing" },
    { value: "Purchase order", label: "sucafina.native.procurement-ui.filter.purchaseOrder" },
    { value: "Closed", label: "sucafina.native.procurement-ui.filter.closed" },
    { value: "All", label: "sucafina.native.procurement-ui.filter.all" },
  ]
  const supplierStatuses: { value: string; label: CopyKey }[] = [
    { value: "All", label: "sucafina.native.procurement-ui.filter.all" },
    { value: "pending", label: "sucafina.native.procurement-ui.status.pending" },
    { value: "active", label: "sucafina.native.procurement-ui.status.active" },
    { value: "blocked", label: "sucafina.native.procurement-ui.status.blocked" },
    { value: "inactive", label: "sucafina.native.procurement-ui.status.inactive" },
  ]
  return (
    <Show when={allowed()}>
      <Show when={props.page.page === "Dashboard"}>
        <ReadTable name="sucafina.native.procurement-ui.section.requests" data={props.page.data.requests} columns={requestColumns} empty="sucafina.native.procurement-ui.empty.requests" />
      </Show>
      <Show when={props.page.page === "Requests"}>
        <div class="mx-card mx-fields">
          <label class="mx-field"><span>{language.t("sucafina.native.procurement-ui.filter.label")}</span><select value={props.query.filter ?? "Open"} onChange={(event) => props.onQuery({ ...props.query, filter: event.currentTarget.value, request: undefined })}>
            <For each={requestFilters}>{(item) => <option value={item.value}>{language.t(item.label)}</option>}</For>
          </select></label>
          <label class="mx-field"><span>{language.t("sucafina.native.procurement-ui.search")}</span><input type="search" value={props.query.q ?? ""} onInput={(event) => props.onQuery({ ...props.query, q: event.currentTarget.value, request: undefined })} /></label>
        </div>
        <ReadTable name="sucafina.native.procurement-ui.section.requests" data={Array.isArray(props.page.data.requests) ? filterRequests() : undefined} columns={requestColumns} empty="sucafina.native.procurement-ui.empty.requestsMatch" />
        <For each={filterRequests()}>{(request) => <RequestDetail request={request} directory={props.page.directory} open={props.query.request === request.number} />}</For>
      </Show>
      <Show when={props.page.page === "My approvals"}>
        <ReadTable name="sucafina.native.procurement-ui.section.pendingApprovals" data={Array.isArray(props.page.data.requests) ? pending() : undefined} columns={[
          { label: "sucafina.native.procurement-ui.column.number", value: (row) => row.number },
          { label: "sucafina.native.procurement-ui.column.title", value: (row) => object(row.pr).title },
          { label: "sucafina.native.procurement-ui.column.status", value: (row) => row.status },
          { label: "sucafina.native.procurement-ui.field.level", value: (row) => step(row).levelName },
          { label: "sucafina.native.procurement-ui.field.approver", value: holder },
          { label: "sucafina.native.procurement-ui.column.amount", value: (row) => approval(row).amount },
          { label: "sucafina.native.procurement-ui.field.submitted", value: (row) => approval(row).submittedAt },
        ]} />
        <For each={pending()}>{(request) => <RequestDetail request={request} directory={props.page.directory} />}</For>
      </Show>
      <Show when={props.page.page === "Suppliers"}>
        <div class="mx-card mx-fields">
          <label class="mx-field"><span>{language.t("sucafina.native.procurement-ui.column.status")}</span><select value={props.query.status ?? "All"} onChange={(event) => props.onQuery({ ...props.query, status: event.currentTarget.value, supplier: undefined })}>
            <For each={supplierStatuses}>{(item) => <option value={item.value}>{language.t(item.label)}</option>}</For>
          </select></label>
          <label class="mx-field"><span>{language.t("sucafina.native.procurement-ui.search")}</span><input type="search" value={props.query.q ?? ""} onInput={(event) => props.onQuery({ ...props.query, q: event.currentTarget.value, supplier: undefined })} /></label>
        </div>
        <ReadTable name="sucafina.native.procurement-ui.section.suppliers" data={Array.isArray(props.page.data.suppliers) ? filterSuppliers() : undefined} columns={columns([
          ["sucafina.native.procurement-ui.column.number", "number"],
          ["sucafina.native.procurement-ui.field.legalName", "legalName"],
          ["sucafina.native.procurement-ui.field.type", "type"],
          ["sucafina.native.procurement-ui.field.country", "country"],
          ["sucafina.native.procurement-ui.field.categories", "categories"],
          ["sucafina.native.procurement-ui.field.risk", "riskRating"],
          ["sucafina.native.procurement-ui.column.status", "status"],
        ])} empty="sucafina.native.procurement-ui.empty.suppliersMatch" />
        <For each={filterSuppliers()}>{(supplier) => <SupplierDetail supplier={supplier} requests={props.page.data.requests} bankVisible={props.page.data.bankVisible === true} open={sameId(props.query.supplier, supplier.id)} />}</For>
      </Show>
      <Show when={props.page.page === "Settings"}>
        <Show when={Object.keys(settings()).length > 0} fallback={<p class="mx-empty">{language.t("sucafina.native.procurement-ui.section.settingsUnavailable")}</p>}>
          <Fields name="sucafina.native.procurement-ui.section.generalPolicy" value={settings()} fields={[
            ["sucafina.native.procurement-ui.field.currency", "currency"],
            ["sucafina.native.procurement-ui.field.prApprovalMode", "prApprovalMode"],
            ["sucafina.native.procurement-ui.field.minimumQuotations", "minQuotes"],
            ["sucafina.native.procurement-ui.field.technicalWeightSetting", "techWeight"],
            ["sucafina.native.procurement-ui.field.commercialWeightSetting", "commWeight"],
            ["sucafina.native.procurement-ui.field.blockSelfApproval", "blockSelfApproval"],
            ["sucafina.native.procurement-ui.field.requireActiveSupplier", "requireActiveSupplier"],
            ["sucafina.native.procurement-ui.field.attachmentLimit", "uploadCap"],
            ["sucafina.native.procurement-ui.field.reminderAfterDays", "reminderDays"],
            ["sucafina.native.procurement-ui.field.escalationAfterDays", "escalationDays"],
            ["sucafina.native.procurement-ui.field.ratesLastUpdated", "fxUpdated"],
          ]} />
          <ReadTable name="sucafina.native.procurement-ui.section.approvalMatrix" data={settings().levels} columns={[
            { label: "sucafina.native.procurement-ui.field.level", value: (row) => row.name },
            { label: "sucafina.native.procurement-ui.field.threshold", value: (row) => row.threshold },
            { label: "sucafina.native.procurement-ui.field.approvalHolder", value: (row) => row.holderId ? props.page.directory.find((person) => person.id === row.holderId)?.name ?? language.t("sucafina.native.procurement-ui.assignedApprover") : language.t("sucafina.native.procurement-ui.unassigned") },
          ]} />
          <ReadTable name="sucafina.native.procurement-ui.section.currencies" data={settings().fxRates} columns={columns([
            ["sucafina.native.procurement-ui.field.code", "code"],
            ["sucafina.native.procurement-ui.field.rate", "rate"],
          ])} />
          <ReadTable name="sucafina.native.procurement-ui.section.technicalCriteria" data={settings().criteria} columns={columns([
            ["sucafina.native.procurement-ui.field.name", "name"],
            ["sucafina.native.procurement-ui.field.weight", "weight"],
          ])} />
          <ReadTable name="sucafina.native.procurement-ui.section.commercialCriteria" data={settings().commCriteria} columns={columns([
            ["sucafina.native.procurement-ui.field.name", "name"],
            ["sucafina.native.procurement-ui.field.weight", "weight"],
            ["sucafina.native.procurement-ui.field.automaticPriceCriterion", "auto"],
          ])} />
          <Fields name="sucafina.native.procurement-ui.section.defaults" value={settings()} fields={[
            ["sucafina.native.procurement-ui.field.paymentTerms", "paymentTerms"],
            ["sucafina.native.procurement-ui.field.categories", "categories"],
            ["sucafina.native.procurement-ui.field.incoterms", "incoterms"],
            ["sucafina.native.procurement-ui.field.defaultInvoiceAddress", "billingAddress"],
            ["sucafina.native.procurement-ui.field.defaultDeliveryAddress", "defaultDeliveryAddress"],
          ]} />
        </Show>
      </Show>
    </Show>
  )
}
