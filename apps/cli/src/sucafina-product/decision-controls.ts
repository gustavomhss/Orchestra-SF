import { digestSfValue } from "../../../../modules/sucafina/Sucafinav1/product/contracts/canonical.ts"
import type { AuthorizedCaseProjection, BusinessEvidenceRef } from "../../../../modules/sucafina/Sucafinav1/product/contracts/business-context.ts"
import type { DomainProjection, SourceRef } from "../../../../modules/sucafina/Sucafinav1/product/contracts/context.ts"
import type { PortResult } from "../../../../modules/sucafina/Sucafinav1/product/contracts/ports.ts"
import type { TrustedUiContext } from "../../../../modules/sucafina/Sucafinav1/product/contracts/sf-execution.ts"
import type { StoredDecisionResult } from "../../../../modules/sucafina/Sucafinav1/product/decisions/result-store.ts"
import { encodeCaseRef } from "../../../../modules/sucafina/Sucafinav1/product/decisions/case-port.ts"
import { classificationKey } from "../../../../modules/sucafina/Sucafinav1/product/decisions/coverage-classification.ts"
import type { CoverageClassification } from "../../../../modules/sucafina/Sucafinav1/product/decisions/coverage-classification.ts"
import type { PlannerSensitivityUnits } from "../../../../modules/sucafina/Sucafinav1/product/planner/sensitivity-units.ts"
import { documentHtml, esc, pageMain } from "../../../../modules/sucafina/Sucafinav1/src/screen-shell.ts"
import type { SfDecisionHttpRuntime } from "./decision-domain-http.ts"

type CaseRef = { id: string; incarnation: string; version: number }
type RecordEvidence = Extract<BusinessEvidenceRef, { kind: "record" }>
type Forecast = { source: RecordEvidence; projection: DomainProjection; expectedVersion?: number; classification?: CoverageClassification }
type Scenario = { ref: string; title: string; alternativeId: string; parameters: readonly { ref: string; label: string }[] }
type Evidence = { evidence: RecordEvidence; source: SourceRef; fields: readonly string[]; label: string }
type ControlsBody = { cases: readonly { ref: string; title: string; version: number }[]; actions: readonly string[]; accessRevision: string; selected?: {
  ref: string; caseRef: CaseRef; decision: AuthorizedCaseProjection["case"]; forecasts: readonly { source: RecordEvidence; label: string }[]; forecast?: Forecast;
  scenarios: readonly Scenario[]; rules: readonly { id: string; expectedVersion?: number }[]; units?: PlannerSensitivityUnits; unitSelection?: { scenarioRef: string; baselineRef: string; parameterRef: string };
  evidence: readonly Evidence[]; recipients: readonly { ref: string; label: string }[]; conditions: readonly { label: string; revision: number }[];
} }
type Controls = ControlsBody & { fingerprint: string; selectionFingerprint: string }

/** This reader enumerates identities only; every displayed value goes through its real authorized port. */
export async function readSfDecisionControls(runtime: SfDecisionHttpRuntime, request: Request): Promise<PortResult<Controls>> {
  const url = new URL(request.url)
  const wanted = url.searchParams.get("case") ?? ""
  const digest = digestSfValue({ caseRef: wanted })
  const access = await runtime.authority.ui.admit(request, "sf_case_read", digest)
  if (access.status !== "ok") return access
  const call = access.value
  try {
    if (!await runtime.authority.ui.validate(call, "sf_case_read", digest)) return { status: "denied", reason: "decision-controls-authority-unavailable" }
    const identities = await runtime.authority.state.read(request, "cases", (state, actor) => sameActor(actor, call)
      ? Object.values(state.cases).filter((value) => value.participants.includes(actor.principalRef)).map((value) => encodeCaseRef(value)) : undefined)
    if (identities.status !== "ok" || !identities.value || identities.value.length > 100) return { status: "unavailable", reason: "decision-controls-case-list-unavailable" }
    const cases: { ref: string; title: string; version: number }[] = []
    for (const ref of identities.value) {
      const value = await runtime.business.cases.read({ caseRef: ref }, call)
      if (value.status === "ok") cases.push({ ref, title: value.value.case.objective, version: value.value.case.version })
    }
    const currentList = async () => {
      const checked = await runtime.authority.state.read(request, "cases", (state, actor) => sameActor(actor, call) && cases.every((item) => Object.values(state.cases).some((current) =>
        encodeCaseRef(current) === item.ref && current.version === item.version && current.objective === item.title && current.participants.includes(actor.principalRef))))
      return checked.status === "ok" && checked.value === true
    }
    const actions = await runtime.authority.humanActions(request)
    const base = { cases, actions, accessRevision: call.binding.accessRevision }
    if (!wanted) return await currentList() && await runtime.authority.host.revalidate(call) ? { status: "ok", value: withFingerprint(base) } : { status: "denied", reason: "decision-controls-authority-changed" }
    if (!cases.some((value) => value.ref === wanted)) return { status: "denied", reason: "decision-controls-case-unavailable" }
    const current = await runtime.business.cases.read({ caseRef: wanted }, call)
    if (current.status !== "ok") return current
    const decision = current.value.case
    const caseRef = { id: decision.id, incarnation: decision.incarnation, version: decision.version }
    return await runtime.business.withCase<Controls>(call, caseRef, {}, async () => {
      const refs = current.value.evidenceRefs.filter((ref): ref is RecordEvidence => ref.kind === "record" && ref.target.surface === "planner")
      if (refs.length > 64) return { status: "needs-input", reason: "decision-controls-evidence-budget-exceeded" }
      const resolved = await runtime.business.context.context({ refs }, call)
      if (resolved.length !== refs.length) return { status: "unavailable", reason: "decision-controls-evidence-unavailable" }
      const evidence: Evidence[] = []
      const forecasts: { source: RecordEvidence; label: string }[] = []
      for (const [index, ref] of refs.entries()) {
        const found = resolved[index]
        if (!found || found.state !== "fresh" || !found.currentRef || !same(found.currentRef, ref) || !found.authorizedProjection || !("context" in found.authorizedProjection) || !("components" in found.authorizedProjection)) continue
        const projection = found.authorizedProjection
        const sources = projection.context.sourceRefs.filter((source) => source.surface === ref.target.surface && source.type === ref.target.recordType && source.id === ref.target.recordId && source.incarnation === ref.target.incarnation && source.version === ref.target.version)
        if (sources.length !== 1) continue
        const source = sources[0]!
        const fields = source.fields.filter((field) => ref.target.fields.includes(field))
        const label = `${ref.target.recordType === "planner-version" ? "Forecast" : "Registro Planner"} ${source.id} · ${source.period.start} a ${source.period.end} · ${projection.context.currency} · revisão ${source.version}`
        if (fields.length && source.period.start <= decision.horizon.start && source.period.end >= decision.horizon.end && ref.target.period && ref.target.period.start <= decision.horizon.start && ref.target.period.end >= decision.horizon.end) evidence.push({ evidence: ref, source, fields, label })
        if (ref.target.recordType === "planner-version") forecasts.push({ source: ref, label })
      }
      const selectedSource = url.searchParams.get("source")
      const matching = forecasts.filter((value) => value.source.refDigest === selectedSource)
      if (selectedSource && matching.length !== 1) return { status: "denied", reason: "decision-controls-source-unavailable" }
      const forecast = matching.length === 1 ? await readForecast(runtime, request, caseRef, matching[0]!.source, call) : undefined
      if (forecast && forecast.status !== "ok") return forecast
      const identities = await runtime.authority.state.read(request, "cases", (state, actor) => sameActor(actor, call)
        ? Object.values((state as typeof state & { decisionResults?: Record<string, StoredDecisionResult> }).decisionResults ?? {}).filter((value) => value.kind === "scenario" && value.caseRef.id === caseRef.id && value.caseRef.incarnation === caseRef.incarnation).map((value) => value.resultRef) : undefined)
      if (identities.status !== "ok" || !identities.value || identities.value.length > 100) return { status: "unavailable", reason: "decision-controls-scenarios-unavailable" }
      const scenarios: Scenario[] = []
      for (const ref of identities.value) {
        const stored = await runtime.business.results.readHistoricalScenario({ resultRef: ref }, call)
        if (stored.status !== "ok" || stored.value.kind !== "scenario") continue
        const alternatives = decision.alternatives.filter((value) => digestSfValue(value.scenario) === stored.value.requestDigest && digestSfValue(value.result) === stored.value.resultDigest)
        if (alternatives.length !== 1) continue
        const alternative = alternatives[0]!
        const parameters = alternative.scenario.operations.flatMap((operation, index) => operation.kind === "replace" && operation.replacementRef === undefined && typeof operation.amount === "number" && Number.isFinite(operation.amount) && operation.currency
          ? [{ ref: operation.targetRef, label: `Substituição ${index + 1} · ${operation.amount} ${operation.currency}${operation.period ? ` · ${operation.period.start} a ${operation.period.end}` : ""}` }] : [])
        scenarios.push({ ref, title: `${alternative.title} · revisão ${alternative.version}`, alternativeId: alternative.id, parameters })
      }
      const rules: { id: string; expectedVersion?: number }[] = []
      for (const criterion of decision.criteria) {
        const rule = await runtime.domain.criteria.resolve({ caseRef, criterionId: criterion.id }, call)
        rules.push({ id: criterion.id, ...(rule.status === "ok" ? { expectedVersion: rule.value.version } : rule.status === "needs-input" && rule.reason === "criterion-rule-unavailable" ? { expectedVersion: 0 } : {}) })
      }
      const scenarioRef = url.searchParams.get("scenario")
      const baselineRef = url.searchParams.get("baseline")
      const parameterRef = url.searchParams.get("parameter")
      const unitSelection = scenarioRef && baselineRef && parameterRef ? { scenarioRef, baselineRef, parameterRef } : undefined
      if (unitSelection && (!scenarios.some((value) => value.ref === baselineRef) || !scenarios.some((value) => value.ref === scenarioRef && value.parameters.some((parameter) => parameter.ref === parameterRef)))) return { status: "denied", reason: "decision-controls-units-unavailable" }
      const units = unitSelection ? await runtime.domain.units.issue(unitSelection, call) : undefined
      if (units && units.status !== "ok") return units
      const environment = await runtime.authority.host.environment(request)
      const recipients = decision.participants.flatMap((ref) => {
        if (ref === call.binding.principalRef) return [{ ref, label: "Você" }]
        const person = environment.directory.find((person) => person.id === ref)
        return person ? [{ ref, label: person.name }] : []
      })
      const conditions = decision.choices.length ? await runtime.domain.materiality.registry.list(caseRef, call) : undefined
      const again = await runtime.business.cases.read({ caseRef: wanted }, call)
      if (again.status !== "ok" || !same(again.value.case, decision) || !await currentList() || !await runtime.authority.host.revalidate(call)) return { status: "denied", reason: "decision-controls-authority-changed" }
      return { status: "ok", value: withFingerprint({ ...base, selected: { ref: wanted, caseRef, decision, forecasts,
        ...(forecast?.status === "ok" ? { forecast: forecast.value } : {}), scenarios, rules,
        ...(units?.status === "ok" && unitSelection ? { units: units.value.units, unitSelection } : {}), evidence, recipients,
        conditions: conditions?.status === "ok" ? conditions.records.map((record) => ({ label: record.selection.label, revision: record.revision })) : [] } }) }
    })
  } finally { runtime.authority.ui.finish(call) }
}

async function readForecast(runtime: SfDecisionHttpRuntime, request: Request, caseRef: CaseRef, source: RecordEvidence, call: TrustedUiContext): Promise<PortResult<Forecast>> {
  const current = await runtime.business.cases.read({ caseRef: encodeCaseRef(caseRef) }, call)
  if (current.status !== "ok") return current
  const result = await runtime.business.planner.compareForecast({ baseRef: source.refId, candidateRef: source.refId, period: current.value.case.horizon, currency: current.value.case.currency }, call)
  if (result.status !== "ok") return result
  const key = classificationKey(caseRef, source.refId)
  const read = () => runtime.authority.state.read(request, "preferences", (state, actor) => sameActor(actor, call) ? { absent: !Object.hasOwn(state.preferences, key) } : undefined)
  const presence = await read()
  if (presence.status !== "ok" || !presence.value) return { status: "unavailable", reason: "decision-controls-classification-unavailable" }
  const classification = presence.value.absent ? undefined : await runtime.domain.baselineCoverage.readClassification(source.refId, call)
  const again = await read()
  if (again.status !== "ok" || !same(again.value, presence.value) || !await runtime.authority.host.revalidate(call)) return { status: "stale", reason: "decision-controls-classification-changed" }
  return { status: "ok", value: { source, projection: result.value.baseline,
    ...(presence.value.absent ? { expectedVersion: 0 } : classification?.status === "ok" ? { expectedVersion: classification.value.version, classification: classification.value } : {}) } }
}

export function sfDecisionControlsHtml(value: Controls, surface: "dashboard" | "planner" | "procurement") {
  const selected = value.selected
  const select = (name: string, title: string, options: readonly { value: string; label: string }[], chosen = "") => `<label>${esc(title)}<select aria-label="${esc(title)}" name="${esc(name)}" required><option value="">Selecione</option>${options.map((option) => `<option value="${esc(option.value)}"${option.value === chosen ? " selected" : ""}>${esc(option.label)}</option>`).join("")}</select></label>`
  const hidden = (name: string, data: string) => `<input type="hidden" name="${esc(name)}" value="${esc(data)}">`
  const scope = `${hidden("sf", "decision-controls")}${selected ? hidden("case", selected.ref) : ""}`
  const picker = `<form method="get">${hidden("sf", "decision-controls")}${select("case", "Caso de decisão", value.cases.map((item) => ({ value: item.ref, label: `${item.title} · revisão ${item.version}` })), selected?.ref)}<button>Abrir caso</button></form>`
  const sourcePicker = selected ? `<form method="get">${scope}${select("source", "Forecast para classificar", selected.forecasts.map((item) => ({ value: item.source.refDigest, label: item.label })), selected.forecast?.source.refDigest)}<button>Abrir forecast</button></form>` : ""
  const can = (action: string) => value.actions.includes(action)
  const replacingCoverage = (selected?.forecast?.expectedVersion ?? 0) > 0
  const coverage = !selected?.forecast ? "<p>Escolha um forecast autorizado para revisar seus componentes.</p>" : selected.forecast.expectedVersion === undefined ? "<p>A classificação existente está indisponível. Revalide as fontes antes de alterá-la.</p>" : !selected.decision.costCoverageBases.length ? "<p>O caso ainda não tem uma base de cobertura. Registre a base no caso antes de classificar custos.</p>" : selected.decision.costCoverageBases.map((basis, index) => `<form data-decision-action="decision-coverage" data-basis="${index}"${replacingCoverage ? ' data-classification-replacement="true"' : ""}>${replacingCoverage ? `<h3>Nova versão completa da classificação</h3><p data-classification-replacement-notice>Este formulário começa uma nova classificação completa para o forecast selecionado. Ao salvar, ela substituirá a revisão ${selected.forecast!.expectedVersion} mostrada acima. Inclua novamente cada componente que deve permanecer classificado e informe o escopo ou a pendência de todas as categorias.</p>` : ""}<h3>${esc(basis.decisionType)} · revisão ${basis.version}</h3>${[...basis.categoryIds, ...basis.additionalCategoryIds].map((id, category) => `<fieldset data-category="${esc(id)}"><legend>${esc(categoryLabel(id))}</legend>${select(`status-${category}`, "Classificação", [{ value: "pending", label: "Pendente" }, { value: "included", label: "Incluído" }], "pending")}<label>Componentes incluídos<select aria-label="Componentes incluídos" name="components-${category}" multiple>${selected.forecast!.projection.components.map((component, componentIndex) => `<option value="${esc(component.id)}">${esc(`Parcela ${componentIndex + 1} · ${component.amount === null ? "valor indisponível" : component.amount} ${component.currency} · ${component.period.start} a ${component.period.end}`)}</option>`).join("")}</select></label><label>Escopo ou motivo da pendência<textarea name="note-${category}" required maxlength="2000"></textarea></label></fieldset>`).join("")}${replacingCoverage ? `<label><input type="checkbox" name="confirm-coverage-replacement" required>Revisei todas as categorias e confirmo a substituição da classificação registrada.</label>` : ""}<button${can("decisions.coverage") ? "" : " disabled"}>${replacingCoverage ? "Substituir classificação registrada" : "Salvar classificação"}</button></form>`).join("")
  const unitPicker = selected ? `<form method="get" id="sf-unit-selection">${scope}${select("baseline", "Cenário de referência", selected.scenarios.map((item) => ({ value: item.ref, label: item.title })), selected.unitSelection?.baselineRef)}${select("scenario", "Cenário a avaliar", selected.scenarios.map((item) => ({ value: item.ref, label: item.title })), selected.unitSelection?.scenarioRef)}${select("parameter", "Parâmetro", selected.scenarios.find((item) => item.ref === selected.unitSelection?.scenarioRef)?.parameters.map((item) => ({ value: item.ref, label: item.label })) ?? [], selected.unitSelection?.parameterRef)}<button>Verificar unidades</button></form>` : ""
  const criteria = selected?.units ? selected.decision.criteria.map((criterion) => {
    const version = selected.rules.find((rule) => rule.id === criterion.id)?.expectedVersion
    return `<form data-decision-action="decision-criteria" data-criterion="${esc(criterion.id)}"><h3>${esc(criterion.description)}</h3><p>Diferença do subtotal conhecido em ${esc(selected.decision.currency)}. Cobertura incompleta mantém o resultado condicionado.</p>${select("operator", "Condição", [{ value: "lte", label: "Menor ou igual" }, { value: "gte", label: "Maior ou igual" }, { value: "eq", label: "Igual" }])}<label>Limite em ${esc(selected.decision.currency)}<input name="value" type="number" step="any" required></label><button${can("decisions.criteria") && version !== undefined ? "" : " disabled"}>Salvar critério</button>${version === undefined ? "<p>A regra atual está indisponível; atualização bloqueada.</p>" : ""}</form>`
  }).join("") : "<p>Escolha dois cenários armazenados e um parâmetro para verificar moeda, período e unidades antes de informar o limite.</p>"
  const choices = selected?.decision.choices.map((choice) => ({ value: choice.id, label: selected.decision.alternatives.find((alternative) => alternative.id === choice.alternativeId)?.title ?? `Escolha registrada em ${choice.at}` })) ?? []
  const conditions = selected && choices.length && selected.scenarios.length >= 2 && selected.evidence.length ? `<form data-decision-action="decision-condition">${select("choice", "Escolha acompanhada", choices)}${select("criterion", "Critério da escolha", [])}${select("before", "Cenário anterior", selected.scenarios.map((item) => ({ value: item.ref, label: item.title })))}${select("after", "Cenário atual", selected.scenarios.map((item) => ({ value: item.ref, label: item.title })))}${select("evidence", "Fonte observada", selected.evidence.map((item, index) => ({ value: String(index), label: item.label })))}${select("recipient", "Responsável", selected.recipients.map((item) => ({ value: item.ref, label: item.label })))}<label>Descrição da condição<input name="label" required maxlength="300"></label><label><input type="checkbox" required>Confirmo o acompanhamento de todos os campos autorizados desta fonte no período do caso.</label><button${can("decisions.condition.record") ? "" : " disabled"}>Registrar acompanhamento</button></form>` : "<p>É necessário ter uma escolha registrada, dois cenários armazenados e uma fonte atual do Planner para registrar acompanhamento.</p>"
  const body = `<section class="sf-decision-controls"><nav aria-label="Decisões"><a href="?sf=workbench">Workbench</a> · <a href="?">Voltar à área</a></nav><h1>Controles da decisão</h1><p>Classifique custos, defina limites e registre condições com as fontes do caso.</p>${value.cases.length ? picker : "<p>Nenhum caso autorizado está disponível.</p>"}<div id="sf-decision-selected">${selected ? `<h2>${esc(selected.decision.objective)}</h2><p>${esc(selected.decision.currency)} · ${esc(selected.decision.horizon.start)} a ${esc(selected.decision.horizon.end)} · revisão ${selected.caseRef.version}</p><section><h2>Cobertura de custos</h2><p>Selecione explicitamente os componentes de cada categoria. A opção “não aplicável” depende de prova adicional e está indisponível.</p>${sourcePicker}${selected.forecast?.expectedVersion !== undefined ? `<p data-classification-version="${selected.forecast.expectedVersion}">${selected.forecast.expectedVersion === 0 ? "Nova classificação" : `Classificação registrada · revisão ${selected.forecast.expectedVersion}`}</p>` : ""}${selected.forecast?.classification ? `<ul>${selected.forecast.classification.mappings.map((mapping) => `<li>${esc(categoryLabel(mapping.entry.categoryId))}: ${mapping.components.length} parcela(s) incluída(s) — ${esc(mapping.entry.scopeNote)}</li>`).join("")}</ul>` : ""}${coverage}</section><section><h2>Critérios numéricos</h2>${unitPicker}${criteria}</section><section><h2>Condições da escolha</h2><p>O acompanhamento compara cenários existentes. Registrar uma condição não agenda uma rotina nem envia uma mensagem.</p>${conditions}${selected.conditions.length ? `<h3>Seus acompanhamentos</h3><ul>${selected.conditions.map((item) => `<li>${esc(item.label)} · revisão ${item.revision}</li>`).join("")}</ul>` : ""}</section>` : ""}</div><p id="sf-decision-status" role="status" aria-live="polite"></p></section>`
  const data = JSON.stringify(value).replaceAll("<", "\\u003c").replaceAll("\u2028", "\\u2028").replaceAll("\u2029", "\\u2029")
  const html = documentHtml("Controles da decisão", surface, "", pageMain({ drawn: true, key: "Controles da decisão", index: 0 }, body), "", "", value.accessRevision)
  return html.replace("</head>", `<style>.sf-decision-controls{max-width:960px;margin:auto;padding:16px}.sf-decision-controls section{margin:24px 0;border-top:1px solid #ccc;padding-top:16px}.sf-decision-controls form{display:grid;gap:12px;margin:16px 0;max-width:100%}.sf-decision-controls label{display:grid;gap:6px}.sf-decision-controls fieldset{min-width:0}.sf-decision-controls input,.sf-decision-controls select,.sf-decision-controls textarea{box-sizing:border-box;max-width:100%;width:100%;min-height:40px}.sf-decision-controls textarea{min-height:72px}.sf-decision-controls input[type=checkbox]{width:auto;min-height:auto;justify-self:start}.sf-decision-controls button{width:fit-content;min-height:44px}.sf-decision-controls nav{overflow-wrap:anywhere}@media(min-width:768px){.sf-decision-controls fieldset{display:grid;grid-template-columns:1fr 2fr;gap:12px}.sf-decision-controls fieldset label:last-child{grid-column:1/-1}}</style></head>`).replace("</body>", `<script id="sf-decision-data" type="application/json">${data}</script><script>${decisionControlsScript}</script></body>`)
}

const decisionControlsScript = `(() => {
  let data = JSON.parse(document.getElementById('sf-decision-data').textContent);
  let selected = data.selected;
  const status = document.getElementById('sf-decision-status');
  const selectedRoot = document.getElementById('sf-decision-selected');
  const edited = new Map();
  let closed = false;
  const clear = () => { selectedRoot.replaceChildren(); document.querySelector('.sf-decision-controls').replaceChildren(status); document.getElementById('sf-decision-data')?.remove(); edited.clear(); selected = undefined; data = undefined; closed = true; status.textContent = 'O acesso ou as fontes mudaram. Abra novamente o caso.'; };
  const preserveDraft = () => {
    const labels = {value:'Limite',operator:'Condição numérica',label:'Descrição da condição',choice:'Referência da escolha',criterion:'Referência do critério',before:'Referência do cenário anterior',after:'Referência do cenário atual',evidence:'Índice da fonte escolhida',recipient:'Referência do responsável'};
    const titles = {'decision-coverage':'Cobertura de custos','decision-criteria':'Critério numérico','decision-condition':'Condição da escolha'};
    const lines = [];
    for (const [form,names] of edited) {
      if (!form.isConnected) continue;
      const fields = new FormData(form);
      lines.push(titles[form.dataset.decisionAction]);
      for (const name of names) {
        const category = /^(note|status|components)-(\\d+)$/.exec(name);
        const label = category ? 'Categoria '+(Number(category[2])+1)+' — '+({note:'observação',status:'classificação',components:'referências dos componentes escolhidos'})[category[1]] : labels[name];
        if (!label) continue;
        const values = fields.getAll(name).map(value => String(value));
        lines.push(label+': '+values.join('; '));
      }
    }
    clear();
    if (!lines.length) return;
    closed = false;
    status.textContent = 'O caso ou as fontes mudaram. Seu rascunho está preservado; reabra o caso para revisar as escolhas.';
    const label = document.createElement('label'); label.textContent = 'Rascunho local preservado';
    const draft = document.createElement('textarea'); draft.readOnly = true; draft.id = 'sf-decision-draft'; draft.value = lines.join('\\n'); draft.rows = Math.min(18,Math.max(5,lines.length)); label.append(draft);
    const help = document.createElement('p'); help.textContent = 'Copie o rascunho antes de reabrir. As fontes e escolhas anteriores foram removidas; nenhum comando pode ser enviado por esta página.';
    const reopen = document.createElement('a'); reopen.href = '?sf=decision-controls'; reopen.textContent = 'Reabrir casos autorizados';
    document.querySelector('.sf-decision-controls').append(label,help,reopen);
  };
  for (const form of document.querySelectorAll('[data-decision-action]')) {
    const remember = event => { const name = event.target.name; if (!name) return; const names = edited.get(form) ?? new Set(); names.add(name); edited.set(form,names); };
    form.addEventListener('input',remember); form.addEventListener('change',remember);
  }
  const options = (select, values) => { select.replaceChildren(new Option('Selecione', '')); for (const value of values) select.add(new Option(value.label, value.value)); };
  const unitForm = document.getElementById('sf-unit-selection');
  if (unitForm) unitForm.elements.scenario.addEventListener('change', () => {
    const scenario = selected.scenarios.find(item => item.ref === unitForm.elements.scenario.value);
    options(unitForm.elements.parameter, (scenario?.parameters ?? []).map(item => ({value:item.ref,label:item.label})));
  });
  const condition = document.querySelector('[data-decision-action="decision-condition"]');
  if (condition) condition.elements.choice.addEventListener('change', () => {
    const choice = selected.decision.choices.find(item => item.id === condition.elements.choice.value);
    options(condition.elements.criterion, selected.decision.criteria.filter(item => choice?.criteria.includes(item.id)).map(item => ({value:item.id,label:item.description})));
  });
  const commands = new WeakMap();
  for (const form of document.querySelectorAll('[data-decision-action]')) form.addEventListener('submit', async event => {
    event.preventDefault(); if (!data || !selected || !form.reportValidity()) return;
    const fields = new FormData(form); const action = form.dataset.decisionAction; let payload;
    try {
      if (action === 'decision-coverage') {
        const basis = selected.decision.costCoverageBases[Number(form.dataset.basis)];
        const entries = [...form.querySelectorAll('[data-category]')].map((fieldset,index) => {
          const categoryId = fieldset.dataset.category; const note = String(fields.get('note-'+index)).trim();
          if (fields.get('status-'+index) === 'pending') return {categoryId,status:'pending',reason:note};
          const componentRefs = fields.getAll('components-'+index);
          if (!componentRefs.length) throw new Error('Selecione ao menos um componente para cada categoria incluída.');
          return {categoryId,status:'included',componentRefs,evidenceRefs:[selected.forecast.source],scopeNote:note};
        });
        payload = {caseRef:selected.caseRef,source:selected.forecast.source,basis,entries,expectedVersion:selected.forecast.expectedVersion};
      } else if (action === 'decision-criteria') {
        const value = Number(fields.get('value')); if (!Number.isFinite(value)) throw new Error('Informe um limite numérico válido.');
        payload = {caseRef:selected.caseRef,criterionId:form.dataset.criterion,metricRef:'planner:known-subtotal-difference',operator:fields.get('operator'),value,unit:selected.units.resultUnit,period:selected.decision.horizon,evidenceRefs:selected.units.sourceRefs,expectedRuleVersion:selected.rules.find(item => item.id === form.dataset.criterion).expectedVersion,sensitivity:selected.units};
      } else {
        if (fields.get('before') === fields.get('after')) throw new Error('Escolha dois cenários diferentes.');
        const evidence = selected.evidence[Number(fields.get('evidence'))];
        payload = {caseRef:selected.caseRef,choiceId:fields.get('choice'),scenarioRefs:[fields.get('before'),fields.get('after')],source:evidence.source,evidence:evidence.evidence,fields:evidence.fields,period:selected.decision.horizon,criterionId:fields.get('criterion'),recipientRef:fields.get('recipient'),destination:location.pathname+'?sf=workbench-case&caseRef='+encodeURIComponent(selected.ref),label:String(fields.get('label')).trim()};
      }
      const body = JSON.stringify(payload); let command = commands.get(form);
      if (!command || command.body !== body) { command = {body,key:crypto.randomUUID()}; commands.set(form,command); }
      const button = form.querySelector('button'); button.disabled = true; status.textContent = 'Verificando fontes e gravando…';
      try {
        const target = new URL(location.href); target.search = new URLSearchParams({sf:action}).toString();
        const response = await fetch(target, {method:'POST',headers:{'Content-Type':'application/json','Idempotency-Key':command.key},body:command.body,credentials:'same-origin',cache:'no-store'});
        if (response.status === 401 || response.status === 403) { clear(); return; }
        if (!data || closed) return;
        const result = await response.json();
        if (!data || closed) return;
        if (!response.ok || result.status !== 'ok') { if (response.status === 409) preserveDraft(); else status.textContent = 'Registro indisponível. Verifique as fontes, as escolhas e os campos informados.'; return; }
        status.textContent = 'Registro salvo. Atualizando o caso…'; location.reload();
      } catch { if (data && !closed) status.textContent = 'Não foi possível confirmar a resposta. Tente novamente com os mesmos campos para reconciliar o registro.'; }
      finally { if (button.isConnected) button.disabled = false; }
    } catch (error) { status.textContent = error instanceof Error ? error.message : 'Verifique os campos.'; }
  });
  let verifying = false;
  window.addEventListener('focus', async () => {
    if (closed || verifying) return;
    verifying = true;
    try { const target = new URL(location.href); target.searchParams.set('format','json'); const response = await fetch(target,{cache:'no-store',credentials:'same-origin'});
      if (response.status === 401 || response.status === 403) { clear(); return; }
      if (!response.ok) { if (data) preserveDraft(); return; } const result = await response.json();
      if (result.status !== 'ok' || !result.value) { if (data) preserveDraft(); return; }
      if (data && result.value.accessRevision !== data.accessRevision) { clear(); return; }
      if (data && result.value.selectionFingerprint !== data.selectionFingerprint) { preserveDraft(); return; }
      if (data) {
        const picker = document.querySelector('select[name="case"]');
        if (picker && result.value.fingerprint !== data.fingerprint) {
          const chosen = picker.value;
          options(picker,result.value.cases.map(item => ({value:item.ref,label:item.title+' · revisão '+item.version})));
          picker.value = chosen;
        }
        data = result.value; selected = data.selected;
        const serialized = document.getElementById('sf-decision-data'); if (serialized) serialized.textContent = JSON.stringify(data);
      }
    } catch { if (data) preserveDraft(); } finally { verifying = false; }
  });
})();`

function same(left: unknown, right: unknown) { return digestSfValue(left) === digestSfValue(right) }
function withFingerprint(value: ControlsBody): Controls {
  const selected = value.selected
  const forecast = selected?.forecast
  const source = ({ observedAt: _observedAt, ...material }: SourceRef) => material
  // Only observations issued by this read are transient. Persisted decisions,
  // classifications, source digests, periods, versions and values remain material.
  const material = { ...value, ...(selected ? { selected: { ...selected,
    evidence: selected.evidence.map((item) => ({ ...item, source: source(item.source) })),
    ...(forecast ? { forecast: { ...forecast, projection: { ...forecast.projection,
      context: { ...forecast.projection.context, sourceRefs: forecast.projection.context.sourceRefs.map(source) },
      components: forecast.projection.components.map((component) => ({ ...component, sourceRefs: component.sourceRefs.map(source) })),
      ...(forecast.projection.comparison ? { comparison: { ...forecast.projection.comparison, context: { ...forecast.projection.comparison.context,
        sourceRefs: forecast.projection.comparison.context.sourceRefs.map(source) } } } : {}) } } } : {}) } } : {}) }
  return { ...value, fingerprint: digestSfValue(material), selectionFingerprint: digestSfValue({ accessRevision: material.accessRevision, actions: material.actions, selected: material.selected }) }
}
function sameActor(actor: { principalRef: string; accessRevision: string; policyVersion: string }, call: TrustedUiContext) {
  return actor.principalRef === call.binding.principalRef && actor.accessRevision === call.binding.accessRevision && actor.policyVersion === call.binding.policyVersion
}
function categoryLabel(value: string) {
  const labels: Record<string, string> = { service: "Serviço", service_overlap: "Sobreposição de serviços", implementation: "Implantação", contract_exit: "Saída contratual", migration: "Migração", taxes: "Tributos", training: "Treinamento", internal_costs: "Custos internos", other_relevant_costs: "Outros custos relevantes" }
  return labels[value] ?? value.replaceAll("_", " ")
}
