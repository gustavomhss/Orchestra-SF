import { digestSfValue } from "../../../../modules/sucafina/Sucafinav1/product/contracts/canonical.ts"
import { encodeCaseRef } from "../../../../modules/sucafina/Sucafinav1/product/decisions/case-port.ts"
import { decodeSfOperationInput } from "../../../../modules/sucafina/Sucafinav1/product/contracts/schema-admission.ts"
import { htmlPolicy } from "../../../../modules/sucafina/Sucafinav1/runtime/application.ts"
import { documentHtml, esc, pageMain } from "../../../../modules/sucafina/Sucafinav1/src/screen-shell.ts"
import type { createSfProductAuthority } from "../../../../modules/sucafina/Sucafinav1/product/integration/product-authority.ts"
import type { createSfCurrentChoiceServices, SfCurrentChoiceOptions } from "./current-choice-services.ts"

type Runtime = { authority: ReturnType<typeof createSfProductAuthority>; currentChoice: ReturnType<typeof createSfCurrentChoiceServices> }
const modes = ["current-choice", "current-choice-prepare", "current-choice-promote"] as const

/** Separate POSTs admit preparation and the exact human-reviewed promotion. */
export function createSfCurrentChoiceHttp(input: { origin: string; mount: string; runtime: () => Runtime | undefined }) {
  return async (request: Request, surface: string): Promise<Response | undefined> => {
    const url = new URL(request.url)
    const mode = url.searchParams.get("sf")
    if (!modes.some((value) => value === mode)) return undefined
    const reply = (value: unknown, status: number) => Response.json(value, { status,
      headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } })
    if (!["dashboard", "planner", "procurement"].includes(surface) || url.origin !== input.origin ||
      url.pathname !== `${input.mount}/${surface}` || request.headers.get("sec-fetch-site") === "cross-site") return reply({ status: "denied" }, 403)
    const runtime = input.runtime()
    if (!runtime) return reply({ status: "unavailable", reason: "current-choice-host-unavailable" }, 503)
    if (mode === "current-choice") {
      if (!["GET", "HEAD"].includes(request.method)) return reply({ status: "needs-input", reason: "method-not-allowed" }, 405)
      if ([...url.searchParams.keys()].some((key) => !["sf", "case", "format"].includes(key) || url.searchParams.getAll(key).length !== 1) ||
        url.searchParams.has("format") && url.searchParams.get("format") !== "json") return reply({ status: "needs-input", reason: "invalid-current-choice-request" }, 400)
      const wanted = url.searchParams.get("case") || undefined
      if (wanted && wanted.length > 16384) return reply({ status: "needs-input" }, 400)
      const digest = digestSfValue({ purpose: "current-choice", caseRef: wanted ?? "" })
      const access = await runtime.authority.ui.admit(request, "sf_case_read", digest)
      if (access.status !== "ok") return reply({ status: "denied" }, 403)
      try {
        if (!await runtime.authority.ui.validate(access.value, "sf_case_read", digest)) return reply({ status: "denied" }, 403)
        const result = await runtime.currentChoice.options(wanted, access.value)
        if (result.status !== "ok" || url.searchParams.get("format") === "json") return reply(result, status(result.status))
        const html = page(result.value, surface)
        return new Response(request.method === "HEAD" ? null : html, { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store",
          "Content-Security-Policy": htmlPolicy(html), "X-Content-Type-Options": "nosniff" } })
      } catch { return reply({ status: "unavailable", reason: "current-choice-options-unavailable" }, 503) }
      finally { runtime.authority.ui.finish(access.value) }
    }
    if (request.method !== "POST") return reply({ status: "needs-input", reason: "method-not-allowed" }, 405)
    if (request.headers.get("origin") !== input.origin) return reply({ status: "denied" }, 403)
    if ([...url.searchParams.keys()].some((key) => key !== "sf") || url.searchParams.getAll("sf").length !== 1 ||
      !request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) return reply({ status: "needs-input", reason: "invalid-current-choice-request" }, 400)
    const payload = await boundedJson(request)
    if (!valid(payload, mode === "current-choice-promote")) return reply({ status: "needs-input", reason: "invalid-current-choice-input" }, 400)
    const action = mode === "current-choice-prepare" ? "planner.preview" : "decisions.promote-alternative"
    const admitted = await runtime.authority.human.admit(request, action, payload)
    if (admitted.status !== "ok") return reply({ status: "denied" }, 403)
    try {
      const result = mode === "current-choice-prepare"
        ? await runtime.currentChoice.prepare(payload as Parameters<typeof runtime.currentChoice.prepare>[0], admitted.value)
        : await runtime.currentChoice.promote(payload as Parameters<typeof runtime.currentChoice.promote>[0], admitted.value)
      // The service performs its final joint authorization/snapshot fence before
      // returning. No asynchronous authority callback follows that publication.
      return reply(result, status(result.status))
    } catch { return reply({ status: "unavailable", reason: "current-choice-unavailable" }, 503) }
    finally { runtime.authority.human.finish(admitted.value) }
  }
}
function page(value: SfCurrentChoiceOptions, surface: string) {
  const data = JSON.stringify(value).replace(/</g, "\\u003c")
  const cases = value.cases.map((item) => `<option value="${esc(item.ref)}"${value.selected && item.ref === encodeCaseRef(value.selected.caseRef) ? " selected" : ""}>${esc(item.title)} · revisão ${item.version}</option>`).join("")
  const choices = value.selected?.choices.map((choice, index) => `<article class="panel"><h3>${esc(choice.title)}</h3><p>${esc(choice.reason)}</p><button type="button" data-prepare="${index}"${choice.request ? "" : " disabled"}>Preparar escolha vigente</button></article>`).join("") ?? ""
  const body = `<section class="sf-current-choice"><h1>Escolha vigente</h1><p>Recalcule uma escolha registrada com as fontes vigentes, revise o resultado e promova a alternativa mediante confirmação.</p>
    <form method="get"><input type="hidden" name="sf" value="current-choice"><label>Caso <select name="case" required><option value="">Selecione</option>${cases}</select></label><button>Abrir caso</button></form>
    ${value.selected ? `<h2>${esc(value.selected.title)}</h2>${choices || "<p>Este caso ainda não tem escolhas registradas.</p>"}` : ""}
    <p id="current-choice-status" role="status" aria-live="polite"></p><section id="current-choice-review" hidden></section>
    <p><a href="?sf=decision-controls">Controles de decisão e cobertura</a></p></section>
    <script type="application/json" id="current-choice-data">${data}</script>${script()}`
  return documentHtml("Escolha vigente", surface as "dashboard" | "planner" | "procurement", "", pageMain({ drawn: true, key: "Escolha vigente", index: 0 }, body), "", "", "")
}
function script() {
  return `<script>(() => {
    let data = JSON.parse(document.getElementById('current-choice-data').textContent);
    const status = document.getElementById('current-choice-status');
    const review = document.getElementById('current-choice-review');
    const commands = new Map(); let prepared; let busy = false;
    const reset = () => { prepared = undefined; review.replaceChildren(); review.hidden = true; };
    const close = () => { reset(); data = undefined; for (const button of document.querySelectorAll('[data-prepare]')) button.disabled = true; status.textContent = 'Acesso ou contexto alterado. Reabra o caso.'; };
    const send = async (mode, payload) => {
      const body = JSON.stringify(payload); const index = mode+body;
      let key = commands.get(index); if (!key) { key = crypto.randomUUID(); commands.set(index,key); }
      const target = new URL(location.href); target.search = new URLSearchParams({sf:mode}).toString();
      const response = await fetch(target, {method:'POST',credentials:'same-origin',cache:'no-store',headers:{'Content-Type':'application/json','Idempotency-Key':key},body});
      if (response.status === 401 || response.status === 403) { close(); return undefined; }
      const result = await response.json();
      if (!response.ok || result.status !== 'ok') {
        if (mode === 'current-choice-promote' && response.status >= 500) { status.textContent = 'Não foi possível confirmar a promoção. Tente novamente para consultar a mesma operação.'; return undefined; }
        reset(); status.textContent = response.status === 409 ? 'O caso ou a fonte mudou. Reabra o caso e prepare novamente.' : 'A escolha vigente está indisponível. Revise a fonte e a cobertura de custos.'; return undefined;
      }
      return result.value;
    };
    const paragraph = text => { const node = document.createElement('p'); node.textContent = text; review.append(node); };
    const amount = (value,currency) => value === null ? 'Indisponível' : new Intl.NumberFormat('pt-BR',{maximumFractionDigits:2}).format(value)+' '+currency;
    const render = value => {
      reset(); prepared = value; review.hidden = false;
      const title = document.createElement('h2'); title.textContent = 'Revisar resultado vigente'; review.append(title);
      const table = document.createElement('table'); const head = document.createElement('thead'); const row = document.createElement('tr');
      for (const text of ['Medida','Escolha registrada','Resultado vigente']) { const cell = document.createElement('th'); cell.textContent = text; row.append(cell); } head.append(row); table.append(head);
      const tbody = document.createElement('tbody');
      for (const [label,field] of [['Subtotal conhecido','knownSubtotal'],['Total qualificado','total']]) { const tr = document.createElement('tr'); for (const text of [label,amount(value.historical[field],value.historical.currency),amount(value.current[field],value.current.currency)]) { const cell = document.createElement('td'); cell.textContent = text; tr.append(cell); } tbody.append(tr); } table.append(tbody); review.append(table);
      const states = {complete:'Completa',conditioned:'Condicionada',incompatible:'Incompatível',unavailable:'Indisponível',pending:'Pendente'};
      paragraph('Comparação: '+(states[value.current.comparisonStatus] ?? value.current.comparisonStatus)+'. Cobertura: '+(states[value.current.costCoverage.coverageState] ?? value.current.costCoverage.coverageState)+'.');
      paragraph('Período: '+value.current.horizon.start+' a '+value.current.horizon.end+'.');
      for (const entry of value.current.costCoverage.entries) paragraph(entry.categoryId+': '+({included:'incluída','not-applicable':'não aplicável',pending:'pendente'}[entry.status])+(entry.reason ? ' — '+entry.reason : ''));
      for (const note of [...value.current.unresolvedConditions,...value.current.restrictions]) paragraph(note);
      paragraph('A promoção atualiza a alternativa vigente e reabre a consideração do caso. A escolha registrada permanece preservada.');
      const label = document.createElement('label'); const confirmation = document.createElement('input'); confirmation.type = 'checkbox'; label.append(confirmation,document.createTextNode(' Revisei o resultado, a cobertura e as pendências.')); review.append(label);
      const button = document.createElement('button'); button.type = 'button'; button.textContent = 'Promover resultado vigente'; button.disabled = true; review.append(button);
      confirmation.addEventListener('change',()=>button.disabled = !confirmation.checked || busy);
      button.addEventListener('click',async()=> {
        if (!prepared || prepared !== value || !confirmation.checked || busy) return;
        busy = true; button.disabled = true; status.textContent = 'Verificando a autorização e promovendo…';
        try { const result = await send('current-choice-promote',value.promotion); if (result && data) { reset(); for (const other of document.querySelectorAll('[data-prepare]')) other.disabled = true; status.textContent = 'Resultado promovido. A escolha histórica está preservada. Reabra o caso para continuar.'; } }
        catch { status.textContent = 'Não foi possível confirmar a promoção. Tente novamente para consultar a mesma operação.'; }
        finally { busy = false; if (prepared === value) button.disabled = !confirmation.checked; }
      });
    };
    for (const button of document.querySelectorAll('[data-prepare]')) button.addEventListener('click',async()=> {
      const option = data?.selected?.choices[Number(button.dataset.prepare)]; if (!option?.request || busy) return;
      reset(); busy = true; button.disabled = true; status.textContent = 'Ressimulando e verificando cobertura…';
      try { const value = await send('current-choice-prepare',option.request); if (value && data) { render(value); status.textContent = 'Resultado preparado. Revise antes de promover.'; } }
      catch { status.textContent = 'Não foi possível preparar a escolha. Tente novamente.'; }
      finally { busy = false; if (data) button.disabled = false; }
    });
  })();</script>`
}
function status(value: string) { return value === "ok" ? 200 : value === "denied" ? 403 : value === "conflict" || value === "stale" ? 409 : value === "needs-input" ? 400 : 503 }
function record(value: unknown): value is Record<string, unknown> { return !!value && typeof value === "object" && !Array.isArray(value) }
function text(value: unknown): value is string { return typeof value === "string" && !!value.trim() && value.length <= 16384 }
function integer(value: unknown) { return typeof value === "number" && Number.isSafeInteger(value) && value >= 1 }
function keys(value: Record<string, unknown>, names: readonly string[]) { return names.every((name) => Object.hasOwn(value, name)) && Object.keys(value).every((name) => names.includes(name)) }
function valid(value: unknown, promotion: boolean): value is Record<string, unknown> {
  if (!record(value) || !record(value.caseRef) || !keys(value.caseRef, ["id", "incarnation", "version"]) || !text(value.caseRef.id) || !text(value.caseRef.incarnation) || !integer(value.caseRef.version) ||
    !text(value.choiceId) || !record(value.alternativeRef) || !keys(value.alternativeRef, ["id", "version"]) || !text(value.alternativeRef.id) || !integer(value.alternativeRef.version) || !text(value.coverageRef)) return false
  return promotion ? keys(value, ["caseRef", "choiceId", "choiceDigest", "alternativeRef", "resultRef", "resultDigest", "scenario", "coverageRef"]) &&
    text(value.resultRef) && typeof value.choiceDigest === "string" && /^[a-f0-9]{64}$/.test(value.choiceDigest) && typeof value.resultDigest === "string" && /^[a-f0-9]{64}$/.test(value.resultDigest) && decodeSfOperationInput("sf_scenario_simulate", value.scenario).ok
    : keys(value, ["caseRef", "choiceId", "alternativeRef", "coverageRef"])
}
async function boundedJson(request: Request): Promise<unknown> {
  const reader = request.body?.getReader()
  if (!reader) return undefined
  const chunks: Uint8Array[] = []; let length = 0
  try {
    while (true) { const result = await reader.read(); if (result.done) break; length += result.value.byteLength;
      if (length > 262144) { await reader.cancel(); return undefined }; chunks.push(result.value) }
    const bytes = new Uint8Array(length); let offset = 0
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length }
    return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes))
  } catch { return undefined } finally { reader.releaseLock() }
}
