import { For, Show } from "solid-js"
import type { NativeViewProps } from "./view-contract"

type RecordValue = Record<string, unknown>
type Column = { label: string; value: (row: RecordValue) => unknown }

const pages = ["Dashboard", "Requests", "My approvals", "Suppliers", "Settings"]
const object = (value: unknown): RecordValue => value !== null && typeof value === "object" && !Array.isArray(value) ? value as RecordValue : {}
const rows = (value: unknown): RecordValue[] => Array.isArray(value) ? value.filter((item): item is RecordValue => item !== null && typeof item === "object" && !Array.isArray(item)) : []
const display = (value: unknown): string => {
  if (typeof value === "string") return value.trim() ? value : "—"
  if (typeof value === "number" && Number.isFinite(value)) return String(value)
  if (typeof value === "boolean") return value ? "Yes" : "No"
  if (Array.isArray(value)) return value.map(display).join(", ") || "—"
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
const columns = (fields: [string, string][]): Column[] => fields.map(([label, key]) => ({ label, value: (row) => row[key] }))

function ReadTable(props: { name: string; data: unknown; columns: Column[]; empty?: string }) {
  return (
    <section class="mx-card" aria-label={props.name}>
      <h3>{props.name}</h3>
      <Show when={Array.isArray(props.data)} fallback={<p class="mx-note">Information is unavailable.</p>}>
        <Show when={rows(props.data).length > 0} fallback={<p class="mx-empty">{props.empty ?? "No records."}</p>}>
          <div style={{ "overflow-x": "auto", "max-width": "100%" }}>
            <table>
              <thead><tr><For each={props.columns}>{(column) => <th scope="col">{column.label}</th>}</For></tr></thead>
              <tbody><For each={rows(props.data)}>{(row) => <tr><For each={props.columns}>{(column) => <td>{display(column.value(row))}</td>}</For></tr>}</For></tbody>
            </table>
          </div>
        </Show>
      </Show>
    </section>
  )
}

function Fields(props: { name: string; value: unknown; fields: [string, string][] }) {
  return (
    <section class="mx-card" aria-label={props.name}>
      <h3>{props.name}</h3>
      <dl class="mx-fields">
        <For each={props.fields}>{(field) => <div class="mx-field"><dt>{field[0]}</dt><dd>{display(object(props.value)[field[1]])}</dd></div>}</For>
      </dl>
    </section>
  )
}

const requestColumns: Column[] = [
  { label: "Number", value: (row) => row.number },
  { label: "Title", value: (row) => object(row.pr).title },
  { label: "Requester", value: (row) => row.requesterName },
  { label: "Status", value: (row) => row.status },
  { label: "Amount", value: (row) => row.value },
  { label: "Updated", value: (row) => row.updatedAt },
  { label: "PO number", value: (row) => object(row.po).number },
  { label: "Expense type", value: (row) => object(row.po).expenseType },
  { label: "Recurring", value: (row) => object(row.pr).recurring },
]
const prFields: [string, string][] = [["Title", "title"], ["Type", "type"], ["Description", "description"], ["Category", "category"], ["Estimated amount", "estAmount"], ["Cost centre", "costCenter"], ["Needed by", "needBy"], ["Business justification", "justification"], ["Recurring", "recurring"], ["Frequency", "frequency"], ["Estimated annual value", "estAnnual"], ["Expense type", "expenseType"]]
const poFields: [string, string][] = [["Number", "number"], ["Supplier", "supplier"], ["Currency", "currency"], ["FX rate", "fxRate"], ["Expense type", "expenseType"], ["Description", "description"], ["Payment terms", "paymentTerms"], ["Delivery date", "deliveryDate"], ["Delivery conditions", "deliveryConditions"], ["Contract reference", "contractRef"], ["Incoterm", "incoterm"], ["Incoterms", "incoterms"], ["Asset reference", "assetRef"], ["Supplier contact", "supplierContact"], ["Quote reference", "quoteRef"], ["Billing address", "billingAddress"], ["Delivery address", "deliveryAddress"], ["Acceptance", "acceptance"], ["Warranty", "warranty"], ["Notes", "notes"], ["Issued at", "issuedAt"]]
const supplierFields: [string, string][] = [["Number", "number"], ["Legal name", "legalName"], ["Trading name", "tradingName"], ["Type", "type"], ["Country", "country"], ["Address", "address"], ["Tax ID", "taxId"], ["Registration number", "regNo"], ["Status", "status"]]

function ApprovalDetails(props: { name: string; value: unknown; directory: readonly { id: string; name: string }[] }) {
  return (
    <Show when={props.value != null}>
      <Fields name={props.name} value={props.value} fields={[["Amount", "amount"], ["Submitted", "submittedAt"]]} />
      <ReadTable name={`${props.name} steps`} data={object(props.value).steps} columns={[
        { label: "Level", value: (row) => row.levelName },
        { label: "Approver", value: (row) => row.holderId ? props.directory.find((person) => person.id === row.holderId)?.name ?? "Assigned approver" : "Unassigned" },
        { label: "Status", value: (row) => row.status },
        { label: "Comment", value: (row) => row.comment },
        { label: "At", value: (row) => row.at },
      ]} />
    </Show>
  )
}

function RequestDetail(props: { request: RecordValue; directory: readonly { id: string; name: string }[]; open?: boolean }) {
  const sourcing = () => object(props.request.sourcing)
  const po = () => object(props.request.po)
  const historyName = (row: RecordValue) => object(props.request.historyNames)[`${display(row.at)}|${display(row.by)}`] ?? props.directory.find((person) => person.id === row.by)?.name ?? row.by
  return (
    <details class="mx-card" open={props.open}>
      <summary>{display(props.request.number)} · {display(object(props.request.pr).title)}</summary>
      <Fields name="Requisition" value={props.request.pr} fields={prFields} />
      <ApprovalDetails name="Requisition approval" value={props.request.prApproval} directory={props.directory} />
      <Show when={props.request.sourcing != null}>
        <Fields name="Sourcing" value={sourcing()} fields={[["Technical evaluator", "evaluator"], ["Fewer quotations justification", "fewQuotesJustification"], ["Selection justification", "selectionJustification"], ["Contract strategy", "contractStrategy"], ["Selected quote ID", "selectedId"]]} />
        <ApprovalDetails name="Sourcing approval" value={sourcing().approval} directory={props.directory} />
        <Fields name="Evaluation weights" value={sourcing().weights} fields={[["Technical weight", "tech"], ["Commercial weight", "comm"]]} />
        <ReadTable name="Technical criteria" data={object(sourcing().weights).criteria} columns={columns([["Criterion", "name"], ["Weight", "weight"]])} />
        <ReadTable name="Commercial criteria" data={object(sourcing().weights).commCriteria} columns={columns([["Criterion", "name"], ["Weight", "weight"], ["Automatic price criterion", "auto"]])} />
        <ReadTable name="Quotations" data={sourcing().quotes} columns={columns([["Supplier", "supplier"], ["Currency", "currency"], ["Quantity", "qty"], ["Unit price", "unitPrice"], ["Total", "total"], ["Technically compliant", "techPass"], ["Technical scores", "scores"], ["Commercial scores", "cscores"]])} />
        <ReadTable name="Quote evaluation" data={props.request.evaluation} columns={columns([["Supplier", "supplier"], ["Technical score", "technical"], ["Price", "price"], ["Commercial score", "commercial"], ["Overall score", "overall"], ["Rank", "rank"]])} />
      </Show>
      <Show when={props.request.po != null}>
        <Fields name="Purchase order" value={po()} fields={poFields} />
        <ApprovalDetails name="Purchase order approval" value={po().approval} directory={props.directory} />
        <ReadTable name="Purchase order lines" data={po().lines} columns={[
          { label: "Description", value: (row) => row.desc ?? row.description },
          { label: "Quantity", value: (row) => row.qty },
          { label: "Unit price", value: (row) => row.unitPrice },
          { label: "Unit", value: (row) => row.uom ?? row.unit },
        ]} />
      </Show>
      <ReadTable name="History" data={Array.isArray(props.request.history) ? [...rows(props.request.history)].reverse() : props.request.history} columns={[
        { label: "At", value: (row) => row.at }, { label: "By", value: historyName }, { label: "Action", value: (row) => row.action }, { label: "Note", value: (row) => row.note },
      ]} />
    </details>
  )
}

function SupplierDetail(props: { supplier: RecordValue; requests: unknown; bankVisible: boolean; open?: boolean }) {
  const linked = () => rows(props.requests).filter((request) => sameId(object(request.po).supplierId, props.supplier.id) || rows(object(request.sourcing).quotes).some((quote) => sameId(quote.supplierId, props.supplier.id)))
  return (
    <details class="mx-card" open={props.open}>
      <summary>{display(props.supplier.number)} · {display(props.supplier.legalName)}</summary>
      <Fields name="General" value={props.supplier} fields={supplierFields} />
      <Fields name="Categories" value={props.supplier} fields={[["Categories", "categories"]]} />
      <Fields name="Contacts" value={props.supplier} fields={[["Contact name", "contactName"], ["Contact email", "contactEmail"], ["Contact phone", "contactPhone"], ["Finance email", "financeEmail"]]} />
      <ReadTable name="Additional contacts" data={props.supplier.contacts} columns={columns([["Name", "name"], ["Email", "email"], ["Phone", "phone"]])} />
      <Fields name="Commercial" value={props.supplier} fields={[["Payment terms", "paymentTerms"], ["Currency", "currency"], ["Incoterm", "incoterm"]]} />
      <Fields name="Commercial notes" value={props.supplier.commercial} fields={[["Notes", "notes"]]} />
      <Show when={props.bankVisible}>
        <Fields name="Bank" value={props.supplier} fields={[["Bank name", "bankName"], ["Account holder", "accountHolder"], ["Bank country", "bankCountry"], ["IBAN", "iban"], ["Account", "account"], ["SWIFT", "swift"]]} />
      </Show>
      <Fields name="Compliance" value={props.supplier} fields={[["Risk rating", "riskRating"], ["Due diligence complete", "dueDiligence"], ["Sanctions screening date", "sanctionsDate"], ["NDA", "nda"], ["DPA", "dpa"], ["Certifications", "certifications"], ["Notes", "notes"]]} />
      <Fields name="Compliance notes" value={props.supplier.compliance} fields={[["Notes", "notes"]]} />
      <ReadTable name="Linked requests" data={Array.isArray(props.requests) ? linked() : undefined} columns={requestColumns} />
      <ReadTable name="Audit" data={props.supplier.history} columns={columns([["Field", "field"], ["Action", "action"], ["At", "at"], ["By", "by"], ["Note", "note"]])} />
    </details>
  )
}

export function ProcurementView(props: NativeViewProps) {
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
    const id = step(request).holderId
    if (id == null || id === "") return "Unassigned"
    return props.page.directory.find((person) => person.id === id)?.name ?? "Assigned approver"
  }
  const settings = () => object(props.page.data.settings)
  return (
    <Show when={allowed()}>
      <Show when={props.page.page === "Dashboard"}>
        <ReadTable name="Requests" data={props.page.data.requests} columns={requestColumns} empty="No requests yet." />
      </Show>
      <Show when={props.page.page === "Requests"}>
        <div class="mx-card mx-fields">
          <label class="mx-field"><span>Filter</span><select value={props.query.filter ?? "Open"} onChange={(event) => props.onQuery({ ...props.query, filter: event.currentTarget.value, request: undefined })}>
            <For each={["Open", "Awaiting approval", "Requisition", "Sourcing", "Purchase order", "Closed", "All"]}>{(item) => <option value={item}>{item}</option>}</For>
          </select></label>
          <label class="mx-field"><span>Search</span><input type="search" value={props.query.q ?? ""} onInput={(event) => props.onQuery({ ...props.query, q: event.currentTarget.value, request: undefined })} /></label>
        </div>
        <ReadTable name="Requests" data={Array.isArray(props.page.data.requests) ? filterRequests() : undefined} columns={requestColumns} empty="No requests match." />
        <For each={filterRequests()}>{(request) => <RequestDetail request={request} directory={props.page.directory} open={props.query.request === request.number} />}</For>
      </Show>
      <Show when={props.page.page === "My approvals"}>
        <ReadTable name="Pending approvals" data={Array.isArray(props.page.data.requests) ? pending() : undefined} columns={[
          { label: "Number", value: (row) => row.number },
          { label: "Title", value: (row) => object(row.pr).title },
          { label: "Status", value: (row) => row.status },
          { label: "Level", value: (row) => step(row).levelName },
          { label: "Approver", value: holder },
          { label: "Amount", value: (row) => approval(row).amount },
          { label: "Submitted", value: (row) => approval(row).submittedAt },
        ]} />
        <For each={pending()}>{(request) => <RequestDetail request={request} directory={props.page.directory} />}</For>
      </Show>
      <Show when={props.page.page === "Suppliers"}>
        <div class="mx-card mx-fields">
          <label class="mx-field"><span>Status</span><select value={props.query.status ?? "All"} onChange={(event) => props.onQuery({ ...props.query, status: event.currentTarget.value, supplier: undefined })}>
            <For each={["All", "pending", "active", "blocked", "inactive"]}>{(item) => <option value={item}>{item}</option>}</For>
          </select></label>
          <label class="mx-field"><span>Search</span><input type="search" value={props.query.q ?? ""} onInput={(event) => props.onQuery({ ...props.query, q: event.currentTarget.value, supplier: undefined })} /></label>
        </div>
        <ReadTable name="Suppliers" data={Array.isArray(props.page.data.suppliers) ? filterSuppliers() : undefined} columns={columns([["Number", "number"], ["Legal name", "legalName"], ["Type", "type"], ["Country", "country"], ["Categories", "categories"], ["Risk", "riskRating"], ["Status", "status"]])} empty="No suppliers match." />
        <For each={filterSuppliers()}>{(supplier) => <SupplierDetail supplier={supplier} requests={props.page.data.requests} bankVisible={props.page.data.bankVisible === true} open={sameId(props.query.supplier, supplier.id)} />}</For>
      </Show>
      <Show when={props.page.page === "Settings"}>
        <Show when={Object.keys(settings()).length > 0} fallback={<p class="mx-empty">Settings are unavailable.</p>}>
          <Fields name="General policy" value={settings()} fields={[["Currency", "currency"], ["PR approval mode", "prApprovalMode"], ["Minimum quotations", "minQuotes"], ["Technical weight", "techWeight"], ["Commercial weight", "commWeight"], ["Block self approval", "blockSelfApproval"], ["Require active supplier", "requireActiveSupplier"], ["Attachment limit (bytes)", "uploadCap"], ["Reminder after days", "reminderDays"], ["Escalation after days", "escalationDays"], ["Rates last updated", "fxUpdated"]]} />
          <ReadTable name="Approval matrix" data={settings().levels} columns={[
            { label: "Level", value: (row) => row.name },
            { label: "Threshold", value: (row) => row.threshold },
            { label: "Approval holder", value: (row) => row.holderId ? props.page.directory.find((person) => person.id === row.holderId)?.name ?? "Assigned approver" : "Unassigned" },
          ]} />
          <ReadTable name="Currencies" data={settings().fxRates} columns={columns([["Code", "code"], ["Rate", "rate"]])} />
          <ReadTable name="Technical criteria" data={settings().criteria} columns={columns([["Name", "name"], ["Weight", "weight"]])} />
          <ReadTable name="Commercial criteria" data={settings().commCriteria} columns={columns([["Name", "name"], ["Weight", "weight"], ["Automatic price criterion", "auto"]])} />
          <Fields name="Defaults" value={settings()} fields={[["Payment terms", "paymentTerms"], ["Categories", "categories"], ["Incoterms", "incoterms"], ["Default invoice-to address", "billingAddress"], ["Default delivery address", "defaultDeliveryAddress"]]} />
        </Show>
      </Show>
    </Show>
  )
}
