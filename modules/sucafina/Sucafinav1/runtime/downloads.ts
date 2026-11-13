import type { Actor, Environment, Snapshot } from "./contract.ts"
import { finite, object, rows, text } from "./contract.ts"
import type { ArtifactResult } from "./artifact.ts"
import { createReport } from "./reports.ts"
import { visibleRequests } from "../src/requests.ts"
import { supplierCsv } from "../src/supplier.ts"
import { esc } from "../src/screen-shell.ts"
import { procurementKeys } from "../src/nav.ts"

export async function download(
  kind: string,
  snapshot: Snapshot,
  actor: Actor,
  environment: Environment,
  query: URLSearchParams,
): Promise<ArtifactResult> {
  if (kind === "json") {
    if (!actor.roles.includes("admin")) return { ok: false, status: 403 }
    for (const member of rows(snapshot.data.members))
      snapshot.audit.push({
        who: actor.id,
        at: environment.at,
        record: `members:${String(member.id ?? "")}`,
        was: null,
        became: { read: true, member: String(member.id ?? "") },
      })
    return {
      ok: true,
      name: "cio-dashboard.json",
      type: "application/json",
      bytes: new TextEncoder().encode(JSON.stringify(snapshot.data, null, 2)),
    }
  }
  if (kind === "pptx" || kind === "docx")
    return createReport(snapshot, actor, environment, {
      format: kind,
      year: Number(query.get("year") ?? new Date(environment.at).getFullYear()),
      title: query.get("title") ?? undefined,
      topics: query.getAll("topic"),
    })
  if (kind === "xlsx" || kind === "members") {
    const { exportPlanner, exportMembers } = await import("./workbooks.ts")
    return kind === "xlsx"
      ? exportPlanner(snapshot, actor, environment, query.get("version") ?? undefined)
      : exportMembers(snapshot, actor, environment)
  }
  if (kind === "opex-template") {
    if (!actor.roles.includes("admin")) return { ok: false, status: 403 }
    const { Workbook } = await import("exceljs")
    const book = new Workbook()
    book
      .addWorksheet("OPEX")
      .addRow([
        "Owner",
        "Annual",
        ...["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
      ])
    return {
      ok: true,
      name: "opex-template.xlsx",
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      bytes: new Uint8Array(await book.xlsx.writeBuffer()),
    }
  }
  if (!procurementKeys(actor).length) return { ok: false, status: 403 }
  const store = object(snapshot.data.store)
  if (kind === "suppliers") {
    const privileged = actor.roles.includes("admin") || actor.roles.includes("supplier admin")
    if (privileged && !environment.bankKey) return { ok: false, status: 503 }
    const suppliers = rows(store.suppliers)
      .filter(
        (supplier) =>
          (typeof supplier.id === "string" || (typeof supplier.id === "number" && Number.isFinite(supplier.id))) &&
          typeof supplier.status === "string",
      )
      .map((supplier) => ({
        ...supplier,
        id: String(supplier.id),
        status: text(supplier.status),
      }))
    const bank = privileged && environment.bankKey ? supplierCsv(suppliers, actor, environment.bankKey) : []
    const general = [
      "number",
      "status",
      "legalName",
      "tradingName",
      "type",
      "country",
      "address",
      "taxId",
      "regNo",
      "categories",
      "contactName",
      "contactEmail",
      "contactPhone",
      "financeEmail",
      "paymentTerms",
      "currency",
      "incoterm",
      ...(privileged ? ["bankName", "accountHolder", "bankCountry"] : []),
      "riskRating",
      "dueDiligence",
      "sanctionsDate",
      "nda",
      "dpa",
      "certifications",
      "validatedBy",
      "validatedAt",
    ]
    const records = suppliers.map((supplier, index) => ({
      ...Object.fromEntries(
        general.map((key) => {
          const value = object(supplier)[key]
          return [
            key,
            Array.isArray(value)
              ? value.join("; ")
              : typeof value === "boolean"
                ? value
                  ? "Yes"
                  : "No"
                : typeof value === "number"
                  ? value
                  : text(value),
          ]
        }),
      ),
      ...(privileged ? bank[index] : {}),
    }))
    return csv("suppliers.csv", records)
  }
  const requests = visibleRequests(
    Object.values(object(store.requests))
      .map((row) => object(object(row).request))
      .filter((row): row is Record<string, unknown> & { createdBy: string } => typeof row.createdBy === "string"),
    actor,
  )
  if (kind === "register")
    return csv(
      "procurement-register.csv",
      requests.map((request) => {
        const pr = object(request.pr),
          source = object(request.sourcing),
          po = object(request.po)
        const quote = rows(source.quotes).find((item) => item.id === source.selectedId)
        const total = rows(po.lines).reduce((sum, line) => sum + finite(line.qty) * finite(line.unitPrice), 0)
        return {
          "PR number": text(request.number),
          Title: text(pr.title),
          Type: text(pr.type),
          Category: text(pr.category),
          "Cost centre": text(pr.costCenter),
          Requester:
            environment.directory.find((person) => person.id === request.createdBy)?.name ??
            (text(request.requesterName) || text(request.createdBy)),
          Created: text(request.createdAt).slice(0, 10),
          Status: text(request.status),
          Recurring: pr.recurring ? "Yes" : "No",
          Frequency: text(pr.frequency),
          "Est. annual value": pr.estAnnual ?? "",
          "Estimated amount": pr.estAmount ?? "",
          Quotes: rows(source.quotes).filter((item) => item.supplier).length,
          "Selected supplier": text(quote?.supplier),
          "Selected quote total": quote
            ? `${text(quote.currency) || text(object(store.settings).currency)} ${finite(quote.total).toFixed(2)}`
            : "",
          "Contract strategy": text(source.contractStrategy),
          "PO number": text(po.number),
          "OPEX/CAPEX": text(po.expenseType),
          "PO currency": text(po.currency) || text(object(store.settings).currency),
          "PO total": request.po ? total : "",
          "PO total (base)": request.po && typeof po.fxRate === "number" ? total * po.fxRate : "",
          "Payment terms": text(po.paymentTerms),
          "Delivery date": text(po.deliveryDate),
          "PO issued": text(po.issuedAt).slice(0, 10),
        }
      }),
    )
  if (kind === "po") {
    const request = requests.find((item) => String(item.number ?? item.id) === query.get("request"))
    if (!request || !request.po) return { ok: false, status: 404 }
    const po = object(request.po)
    const lines = rows(po.lines)
    const currency = text(po.currency) || text(object(store.settings).currency)
    const money = (value: number) => value.toLocaleString("en-US", { minimumFractionDigits: 2 })
    const multiline = (value: unknown) => esc(text(value) || "—").replace(/\n/g, "<br>")
    const terms = [
      ["Currency", currency],
      ["Expenditure type", `${text(po.expenseType)}${po.assetRef ? ` · ${text(po.assetRef)}` : ""}`],
      ["Payment terms", po.paymentTerms],
      ["Incoterm", po.incoterm ?? po.incoterms],
      ["Delivery / service start date", po.deliveryDate],
      ["Delivery address", po.deliveryAddress],
      ["Specific delivery conditions", po.deliveryConditions],
      ["Acceptance criteria", po.acceptance],
      ["Warranty / SLA", po.warranty],
      ["Contract reference", po.contractRef],
      ["Other terms", po.notes],
    ]
    const approvals = rows(object(po.approval).steps)
    const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(text(po.number))}</title><style>body{font:13px/1.5 Arial,sans-serif;color:#111;max-width:820px;margin:30px auto;padding:0 24px}table{width:100%;border-collapse:collapse;margin:10px 0}th,td{border:1px solid #ccc;padding:6px 8px;text-align:left}th{background:#f2f4f7}.box{display:grid;grid-template-columns:1fr 1fr;gap:16px}.box>div{border:1px solid #ccc;padding:10px}</style></head><body><h1>PURCHASE ORDER</h1><p>Status: ${esc(text(request.status))}</p><p><b>${esc(text(po.number))}</b><br>Date: ${esc(text(po.issuedAt ?? object(po.approval).submittedAt ?? po.generatedAt))}<br>Requisition: ${esc(text(request.number))}</p><div class="box"><div><b>Supplier</b><br>${esc(text(po.supplier))}<br>${esc(text(po.supplierContact))}<br>Quote ref: ${esc(text(po.quoteRef) || "—")}</div><div><b>Invoice to</b><br>${multiline(po.billingAddress)}</div></div><h2>Description</h2><p>${multiline(po.description)}</p><table><thead><tr><th>#</th><th>Description</th><th>Qty</th><th>Unit</th><th>Unit price (${esc(currency)})</th><th>Total (${esc(currency)})</th></tr></thead><tbody>${lines.map((line, index) => `<tr><td>${index + 1}</td><td>${esc(text(line.desc ?? line.description))}</td><td>${finite(line.qty)}</td><td>${esc(text(line.uom ?? line.unit))}</td><td>${money(finite(line.unitPrice))}</td><td>${money(finite(line.qty) * finite(line.unitPrice))}</td></tr>`).join("")}<tr><th colspan="5">Total agreed price (excl. VAT)</th><td>${money(lines.reduce((sum, line) => sum + finite(line.qty) * finite(line.unitPrice), 0))}</td></tr></tbody></table><h2>Terms & conditions</h2><table>${terms.map(([label, value]) => `<tr><th>${esc(text(label))}</th><td>${multiline(value)}</td></tr>`).join("")}</table>${approvals.length ? `<h2>Approvals</h2><table><tr><th>Level</th><th>Approved by</th><th>Date</th></tr>${approvals.map((step) => `<tr><td>${esc(text(step.levelName))}</td><td>${esc(step.status === "approved" ? (environment.directory.find((person) => person.id === step.by)?.name ?? text(step.by)) : text(step.status))}</td><td>${esc(text(step.at))}</td></tr>`).join("")}</table>` : ""}<p>Please quote the PO number on all invoices and delivery notes.</p></body></html>`
    return {
      ok: true,
      name: `${text(po.number).replace(/[^A-Za-z0-9_-]/g, "_") || "purchase-order"}.html`,
      type: "text/html; charset=utf-8",
      bytes: new TextEncoder().encode(html),
    }
  }
  return { ok: false, status: 404 }
}
function csv(name: string, data: Record<string, unknown>[]): ArtifactResult {
  const columns = [...new Set(data.flatMap((record) => Object.keys(record)))]
  const encode = (value: unknown) => {
    const string = typeof value === "number" ? String(value) : text(value)
    const safe = typeof value === "string" && /^[=+\-@\t\r]/.test(string) ? `'${string}` : string
    return `"${safe.replace(/"/g, '""')}"`
  }
  const body = [
    columns.map(encode).join(","),
    ...data.map((record) => columns.map((column) => encode(record[column])).join(",")),
  ].join("\r\n")
  return {
    ok: true,
    name,
    type: "text/csv; charset=utf-8",
    bytes: new TextEncoder().encode(body),
  }
}
