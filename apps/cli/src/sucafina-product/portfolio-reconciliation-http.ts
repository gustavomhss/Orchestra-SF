import { digestSfValue } from "../../../../modules/sucafina/Sucafinav1/product/contracts/canonical.ts"
import type { PortResult } from "../../../../modules/sucafina/Sucafinav1/product/contracts/ports.ts"
import { encodeCaseRef, parseCaseRef } from "../../../../modules/sucafina/Sucafinav1/product/decisions/case-port.ts"
import type { createPortfolioProduct } from "../../../../modules/sucafina/Sucafinav1/product/portfolio/product.ts"
import type { PortfolioReconciliationRequest } from "../../../../modules/sucafina/Sucafinav1/product/portfolio/reconciliation.ts"
import type { createSfProductAuthority } from "../../../../modules/sucafina/Sucafinav1/product/integration/product-authority.ts"
import { htmlPolicy } from "../../../../modules/sucafina/Sucafinav1/runtime/application.ts"
import { documentHtml, esc, pageMain } from "../../../../modules/sucafina/Sucafinav1/src/screen-shell.ts"
import type { createSfBusinessServices } from "./business-services.ts"
import type { createSfPortfolioReconciliationServices, SfPortfolioReconciliationChoice } from "./portfolio-reconciliation-services.ts"

type Product = ReturnType<typeof createPortfolioProduct>
type Reconciled = Extract<Awaited<ReturnType<Product["http"]["reconcile"]>>, { status: "ok" }>["value"]
type Page = { caseRef: PortfolioReconciliationRequest["caseRef"]; objective: string; choices: readonly SfPortfolioReconciliationChoice[];
  unavailable: number; accessRevision: string; selected?: PortfolioReconciliationRequest; reconciliation?: Reconciled }

/** An ordinary read-only page in the existing surface. Every reload reopens C08 and current authority. */
export function createSfPortfolioReconciliationHttp(input: {
  origin: string; mount: string
  authority: ReturnType<typeof createSfProductAuthority>
  business: ReturnType<typeof createSfBusinessServices>
  product?: Product
  reconciliation?: ReturnType<typeof createSfPortfolioReconciliationServices>
}) {
  return async (request: Request, surface: string): Promise<Response | undefined> => {
    const url = new URL(request.url)
    if (url.searchParams.get("sf") !== "decision-portfolio-reconciliation") return undefined
    const reply = (value: unknown, status: number) => new Response(request.method === "HEAD" ? null : JSON.stringify(value), { status,
      headers: { "Content-Type": "application/json", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } })
    if (surface !== "dashboard" && surface !== "planner" && surface !== "procurement" || url.origin !== input.origin ||
      url.pathname !== `${input.mount}/${surface}` || request.signal.aborted || request.headers.get("sec-fetch-site") === "cross-site") return reply({ status: "denied", reason: "portfolio-reconciliation-origin-unavailable" }, 403)
    if (request.method !== "GET" && request.method !== "HEAD") return reply({ status: "needs-input", reason: "method-not-allowed" }, 405)
    if ([...url.searchParams.keys()].some((key) => !["sf", "case", "selection", "format"].includes(key) || url.searchParams.getAll(key).length !== 1) ||
      url.searchParams.has("format") && url.searchParams.get("format") !== "json") return reply({ status: "needs-input", reason: "invalid-portfolio-reconciliation-query" }, 400)
    const wanted = url.searchParams.get("case") ?? "", parsed = parseCaseRef(wanted)
    if (wanted.length > 16_384 || !parsed) return reply({ status: "needs-input", reason: "portfolio-reconciliation-case-required" }, 400)
    const selection = url.searchParams.get("selection"), selected = selection ? parseSelection(selection) : undefined
    if (selection && (!selected || encodeCaseRef(selected.caseRef) !== wanted)) return reply({ status: "needs-input", reason: "invalid-portfolio-reconciliation-selection" }, 400)
    if (!input.product || !input.reconciliation) return reply({ status: "unavailable", reason: "portfolio-reconciliation-producer-unavailable" }, 503)
    const digest = digestSfValue({ caseRef: wanted, selection: selected ?? null })
    const admitted = await input.authority.ui.admit(request, "sf_case_read", digest)
    if (admitted.status !== "ok") return reply(admitted, 403)
    const call = admitted.value, binding = digestSfValue([call.kind, call.binding]), transport = requestDigest(request)
    const intact = () => input.authority.host.requestFor(call) === request && !request.signal.aborted && requestDigest(request) === transport && binding === digestSfValue([call.kind, call.binding])
    try {
      if (!await input.authority.ui.validate(call, "sf_case_read", digest) || !intact()) return reply({ status: "denied", reason: "portfolio-reconciliation-authority-changed" }, 403)
      const first = await input.business.cases.read({ caseRef: wanted }, call)
      if (first.status !== "ok") return reply(first, responseStatus(first))
      const decision = first.value.case
      const caseRef = { id: decision.id, incarnation: decision.incarnation, version: decision.version }
      if (selected && digestSfValue(selected.caseRef) !== digestSfValue(caseRef)) return reply({ status: "stale", reason: "portfolio-reconciliation-case-changed" }, 409)
      const result = await input.business.withCase<Page>(call, caseRef, {}, async () => {
        if (selected) {
          const reconciled = await input.product!.http.reconcile(selected, call)
          if (reconciled.status !== "ok") return reconciled
          return { status: "ok", value: { caseRef, objective: decision.objective, accessRevision: call.binding.accessRevision, selected,
            choices: [{ request: selected, label: `Escolha de ${reconciled.value.originalChoice.at}`, originalCaseVersion: reconciled.value.originalCaseRef.version }],
            unavailable: 0, reconciliation: reconciled.value } }
        }
        const catalog = await input.reconciliation!.list(caseRef, call)
        if (catalog.status !== "ok") return catalog
        return { status: "ok", value: { caseRef, objective: decision.objective, ...catalog.value, accessRevision: call.binding.accessRevision } }
      })
      if (result.status !== "ok") return reply(result, responseStatus(result))
      if (!await input.authority.host.revalidate(call) || !intact()) return reply({ status: "denied", reason: "portfolio-reconciliation-authority-changed" }, 403)
      const last = await input.business.cases.read({ caseRef: wanted }, call)
      if (last.status !== "ok" || digestSfValue(last.value.case) !== digestSfValue(first.value.case) || !intact()) return reply({ status: "stale", reason: "portfolio-reconciliation-case-changed" }, 409)
      if (url.searchParams.get("format") === "json") return reply(result, 200)
      const html = reconciliationHtml(result.value, surface)
      return new Response(request.method === "HEAD" ? null : html, { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store",
        "Content-Security-Policy": htmlPolicy(html), "X-Content-Type-Options": "nosniff", "X-SF-Access-Revision": call.binding.accessRevision } })
    } catch { return reply({ status: "unavailable", reason: "portfolio-reconciliation-unavailable" }, 503) }
    finally { input.authority.ui.finish(call) }
  }
}

export function validSfPortfolioReconciliationRequest(value: unknown): value is PortfolioReconciliationRequest {
  if (!record(value) || !closed(value, ["caseRef", "portfolioResultRef", "combinationId", "choiceId"]) || !record(value.caseRef) ||
    !closed(value.caseRef, ["id", "incarnation", "version"]) || !text(value.caseRef.id) || !text(value.caseRef.incarnation) ||
    typeof value.caseRef.version !== "number" || !Number.isSafeInteger(value.caseRef.version) || value.caseRef.version < 1) return false
  return text(value.portfolioResultRef) && text(value.choiceId) && typeof value.combinationId === "string" && /^[a-f0-9]{64}$/.test(value.combinationId)
}

function parseSelection(value: string) {
  if (value.length > 16_384) return undefined
  try { const selected: unknown = JSON.parse(value); return validSfPortfolioReconciliationRequest(selected) ? selected : undefined }
  catch { return undefined }
}

function reconciliationHtml(page: Page, surface: "dashboard" | "planner" | "procurement") {
  const original = page.reconciliation
  const controls = `?${new URLSearchParams({ sf: "decision-controls", case: encodeCaseRef(page.caseRef) })}`
  const catalog = `?${new URLSearchParams({ sf: "decision-portfolio-reconciliation", case: encodeCaseRef(page.caseRef) })}`
  const options = page.choices.map((choice) => `<option value="${esc(JSON.stringify(choice.request))}"${page.selected && digestSfValue(page.selected) === digestSfValue(choice.request) ? " selected" : ""}>${esc(choice.label)} · revisão original ${choice.originalCaseVersion}</option>`).join("")
  const form = `<form method="get"><input type="hidden" name="sf" value="decision-portfolio-reconciliation"><input type="hidden" name="case" value="${esc(encodeCaseRef(page.caseRef))}"><label>Composição e escolha preservadas<select name="selection" required><option value="">Selecione a escolha</option>${options}</select></label><button${page.choices.length ? "" : " disabled"}>Reconciliar leitura</button></form>${page.selected ? `<p><a href="${esc(catalog)}">Escolher outra composição preservada</a></p>` : ""}`
  const result = original ? renderReconciliation(original) : `<p role="status">${page.choices.length ? "Escolha uma composição autorizada para conferir a escolha original e seus recibos." : "Nenhuma composição com escolha e origem verificáveis está disponível neste caso."}</p>`
  const body = `<section class="sf-portfolio-reconciliation"><nav aria-label="Decisões"><a href="${esc(controls)}">Controles da decisão</a> · <a href="?sf=workbench">Workbench</a></nav><h1>Reconciliação do portfolio</h1><h2>${esc(page.objective)}</h2><p>Leitura do caso atual na revisão ${page.caseRef.version}. A composição e a escolha originais são preservadas; aplicar, aprovar ou tentar novamente exige a ação correspondente.</p>${form}${page.unavailable ? `<p role="status">${page.unavailable} composição(ões) preservada(s) não pôde(puderam) ser reautorizada(s). Uma fonte alterada sem nova revisão do caso continua bloqueada quando o vínculo atual não é válido.</p>` : ""}${result}</section>`
  const html = documentHtml("Reconciliação do portfolio", surface, "", pageMain({ drawn: true, key: "Reconciliação do portfolio", index: 0 }, body), "", "", page.accessRevision)
  return html.replace("</head>", `<style>.sf-portfolio-reconciliation{max-width:1120px;margin:auto;padding:16px;overflow-wrap:anywhere}.sf-portfolio-reconciliation form,.sf-portfolio-reconciliation label{display:grid;gap:12px}.sf-portfolio-reconciliation form{margin:24px 0}.sf-portfolio-reconciliation select{max-width:100%;min-height:44px}.sf-portfolio-reconciliation button{min-height:44px;width:fit-content}.sf-portfolio-reconciliation section{margin:24px 0}.sf-portfolio-reconciliation .table-region{overflow:auto;max-width:100%}.sf-portfolio-reconciliation table{border-collapse:collapse;width:100%}.sf-portfolio-reconciliation th,.sf-portfolio-reconciliation td{text-align:left;vertical-align:top;padding:8px;border:1px solid #ccc}.sf-portfolio-reconciliation dl{display:grid;grid-template-columns:minmax(120px,1fr) 2fr;gap:8px}.sf-portfolio-reconciliation dd{margin:0}</style></head>`)
}

function renderReconciliation(value: Reconciled) {
  const choice = value.originalChoice, result = choice.result
  const facts = [["Estado financeiro original", value.originalCombination.comparisonStatus], ["Elegibilidade original", value.originalCombination.eligibility],
    ["Subtotal conhecido", amount(result.knownSubtotal)], ["Total completo", amount(result.total)], ["Moeda", result.currency],
    ["Período", `${result.horizon.start} – ${result.horizon.end}`], ["Estado atual de aplicação do caso", value.applicationState],
    ["Escolha humana", choice.id], ["Motivo preservado", choice.reason], ["Registro da escolha", value.choiceLedgerRef],
    ["Resultado original", value.portfolioResultRef]]
  const components = value.components.map((component) => `<section><h3>Componente ${esc(component.original.id)}</h3><p>${esc(amount(component.original.amount))} ${esc(component.original.currency)} · ${esc(component.original.period.start)} a ${esc(component.original.period.end)} · ${esc(component.original.evidenceState)}</p><p>Correspondência com mudanças: ${esc(component.correlation)}.</p>${table("Mudanças e recibos vinculados", ["Mudança", "Estado", "Operação", "Recibo", "Estado do recibo"], component.effects.map((effect) => [effect.change.id, effect.change.state, effect.change.operationRef, effect.receipt?.id ?? "Sem recibo", effect.receipt?.status ?? "Indisponível"]))}${table("Condições da escolha", ["Critério", "Fonte e versão", "Período", "Materialidade", "Limite da prova"], component.conditions.map((condition) => [condition.condition.criterionId, `${condition.condition.source.id} · v${condition.condition.source.version}`, `${condition.condition.period.start} – ${condition.condition.period.end}`, condition.impact.state, condition.impact.state === "unknown" ? "Desconhecida: falta prova do produtor para este componente." : condition.impact.reason]))}</section>`).join("")
  return `<section aria-label="Reconciliação autorizada"><h2>Composição e escolha originais</h2><dl>${facts.map(([name, data]) => `<dt>${esc(name!)}</dt><dd>${esc(data!)}</dd>`).join("")}</dl><p>Valores ausentes permanecem indisponíveis. Recibos individuais não comprovam uma transação global.</p><p>Materialidade permanece desconhecida até existir uma condição registrada ligada aos cenários e componentes reais antes e depois da mudança.</p>${components}${table("Mudanças sem correspondência inequívoca", ["Mudança", "Estado", "Operação", "Recibo"], value.unmappedChanges.map((change) => [change.id, change.state, change.operationRef, change.receiptRef ?? "Sem recibo"]))}</section>`
}

function table(title: string, headers: readonly string[], rows: readonly (readonly string[])[]) {
  if (!rows.length) return `<p>${esc(title)}: nenhum registro autorizado nesta composição.</p>`
  return `<div class="table-region" role="region" aria-label="${esc(title)}" tabindex="0"><table><caption>${esc(title)}</caption><thead><tr>${headers.map((header) => `<th scope="col">${esc(header)}</th>`).join("")}</tr></thead><tbody>${rows.map((row) => `<tr>${row.map((value) => `<td>${esc(value)}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`
}
function responseStatus(result: PortResult<unknown>) { return result.status === "ok" ? 200 : result.status === "denied" ? 403 : result.status === "needs-input" ? 400 : result.status === "stale" || result.status === "conflict" ? 409 : 503 }
function requestDigest(request: Request) { return digestSfValue({ method: request.method, url: request.url, headers: [...request.headers.entries()] }) }
function amount(value: number | null) { return value === null ? "Indisponível" : String(value) }
function text(value: unknown): value is string { return typeof value === "string" && !!value.trim() && value.length <= 16_384 }
function record(value: unknown): value is Record<string, unknown> { return !!value && typeof value === "object" && !Array.isArray(value) && Object.getPrototypeOf(value) === Object.prototype }
function closed(value: Record<string, unknown>, fields: readonly string[]) { return fields.every((field) => Object.hasOwn(value, field)) && Object.keys(value).every((field) => fields.includes(field)) }
