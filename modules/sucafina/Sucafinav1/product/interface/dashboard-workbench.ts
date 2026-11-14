/** Contextual controls use server-discovered options; executable commands never enter the form. */
export function dashboardWorkbenchWidget(page: string) {
  const entities: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }
  const escaped = page.replace(/[&<>"']/g, (value) => entities[value]!)
  return `<details class="card" data-dashboard-workbench-panel><summary>Revisão e ações</summary><section data-dashboard-workbench data-page="${escaped}" aria-label="Revisão e ações do Dashboard">
    <p>Monte a pauta desta página, preserve registros e revise escolhas existentes antes de aplicar alterações. As opções mostram até 100 registros e 50 casos autorizados.</p>
    <div class="form-grid"><label>Início do período<input type="date" data-dashboard-from></label><label>Fim do período<input type="date" data-dashboard-to></label></div>
    <button type="button" data-dashboard-load>Carregar opções</button><p role="status" aria-live="polite" data-dashboard-status></p>
    <fieldset><legend>Pauta da reunião</legend><p data-dashboard-agenda-count>Carregue as opções desta página.</p><button type="button" data-dashboard-agenda disabled>Pré-visualizar pauta</button> <button type="button" data-dashboard-preserve disabled>Preservar reunião</button><div data-dashboard-agenda-view></div></fieldset>
    <fieldset><legend>Retratos e histórico</legend><label>Registro para preservar<select data-dashboard-record><option value="">Selecione um registro</option></select></label><button type="button" data-dashboard-capture disabled>Preservar retrato</button><label>Reunião ou retrato preservado<select data-dashboard-history><option value="">Selecione um item do histórico</option></select></label><button type="button" data-dashboard-reopen disabled>Abrir histórico</button><div data-dashboard-history-view></div></fieldset>
    <form data-dashboard-draft><fieldset><legend>Rascunho de Hot Topic</legend><p>O rascunho precisa integrar uma escolha no caso antes de ser preparado. O impacto financeiro não é calculado aqui.</p>
      <label>Caso<select data-dashboard-case><option value="">Selecione um caso</option></select></label><label>Rascunho<select data-dashboard-draft-choice><option value="">Selecione novo ou existente</option></select></label><label>Hot Topic de origem<select data-dashboard-draft-source><option value="">Selecione um Hot Topic</option></select></label>
      <label>Ação<input name="action" required maxlength="1000" disabled></label><label>Responsável<input name="owner" required maxlength="500" disabled></label><label>Prazo<input name="due" type="date" required disabled></label><label>Prioridade<select name="priority" disabled><option value="normal">Normal</option><option value="high">Alta</option><option value="critical">Crítica</option></select></label><label>Notas<textarea name="notes" maxlength="16000" disabled></textarea></label>
      <button type="submit" data-dashboard-save-draft disabled>Salvar rascunho</button> <button type="button" data-dashboard-reset-draft disabled>Descartar alterações do formulário</button>
    </fieldset></form>
    <fieldset><legend>Escolhas e alterações</legend><label>Escolha existente para preparar<select data-dashboard-preparation><option value="">Selecione uma escolha</option></select></label><p data-dashboard-choice-reason></p><button type="button" data-dashboard-prepare disabled>Preparar escolha</button>
      <label>Alteração preparada<select data-dashboard-change><option value="">Selecione uma alteração</option></select></label><button type="button" data-dashboard-review disabled>Revisar alterações</button><div data-dashboard-review-view></div>
      <label><input type="checkbox" data-dashboard-confirm disabled>Revisei os campos e confirmo estas alterações.</label><button type="button" data-dashboard-apply disabled>Aplicar alterações</button>
    </fieldset>
  </section></details>`
}

export const dashboardWorkbenchScript = String.raw`
document.querySelectorAll('[data-dashboard-workbench]').forEach((root) => {
  if (root.dataset.ready) return;
  root.dataset.ready = 'true';
  const find = (name) => root.querySelector('[data-dashboard-' + name + ']');
  const form = find('draft'), status = find('status'), panel = root.closest('[data-dashboard-workbench-panel]');
  const fields = ['action', 'owner', 'due', 'priority', 'notes'];
  const labels = { action: 'Ação', owner: 'Responsável', due: 'Prazo', priority: 'Prioridade', notes: 'Notas', name: 'Nome', title: 'Título', status: 'Situação', risk: 'Risco', budget: 'Orçamento', actual: 'Realizado', forecast: 'Previsão', vendor: 'Fornecedor', type: 'Tipo', end: 'Término', start: 'Início', month: 'Mês', year: 'Ano', target: 'Meta', weight: 'Peso', progress: 'Progresso', value: 'Valor', description: 'Descrição', pm: 'Responsável pelo projeto', effective: 'Orçamento vigente', totalBudget: 'Orçamento total', totalActual: 'Realizado total', totalForecast: 'Previsão total', fact: 'Fato', rule: 'Regra', date: 'Data', severity: 'Severidade', opened: 'Chamados abertos', closed: 'Chamados encerrados', netChange: 'Variação de chamados', backlog: 'Chamados pendentes', active: 'Ativos', openIncidents: 'Incidentes abertos', renewal: 'Renovação', probability: 'Probabilidade', impact: 'Impacto' };
  const evidenceLabels = { confirmed: 'Confirmado', estimated: 'Estimado', absent: 'Ausente', unavailable: 'Indisponível', hypothetical: 'Hipótese' };
  const origins = { hotTopics: 'Hot Topics', opsTickets: 'Chamados', projects: 'Projetos', risks: 'Riscos', contracts: 'Contratos', members: 'Pessoas', leaders: 'Estrutura da equipe', opexOwners: 'OPEX', opexEntries: 'OPEX', capexProjects: 'CAPEX', capexEntries: 'CAPEX', 'itperf-item': 'Contrato de performance', stakeholders: 'Stakeholders', secKpi: 'Segurança de TI' };
  const states = { planned: 'Aguardando revisão', applied: 'Aplicada', conflict: 'Em conflito', failed: 'Não aplicada' };
  let data, agenda, review, draftBinding, draftCatalog = [], caseCatalog = [], sourceCatalog = [], busy = false;
  const keys = new Map();
  const scalar = (value) => value === null || value === undefined ? 'Não informado' : typeof value === 'boolean' ? value ? 'Sim' : 'Não' : String(value);
  const choice = (name, list) => find(name).value === '' ? undefined : list[Number(find(name).value)];
  const fieldLabel = (id) => {
    if (/effectiveMonthlyBudget\[\d+\]$/.test(String(id))) return 'Orçamento vigente';
    const original = String(id).split(/[.:]/).pop();
    let name = original;
    try { name = decodeURIComponent(original); } catch {
      // Malformed encoding keeps the original label, which is rendered only through textContent.
      name = original;
    }
    return labels[name] || (name.includes('|') ? name.split('|').join(' · ') : 'Campo');
  };
  const announce = (message) => { status.textContent = message; };
  const options = (name, list, empty) => {
    const select = find(name); select.replaceChildren(new Option(empty, ''));
    list.forEach((item, index) => select.add(new Option(item.label, String(index))));
  };
  const resetReview = () => { review = undefined; find('confirm').checked = false; find('review-view').replaceChildren(); };
  const retainView = () => {
    if (panel.open || busy || form.dataset.dirty) root.setAttribute('data-sf-retain-view', 'true');
    else if (root.hasAttribute('data-sf-retain-view')) {
      root.removeAttribute('data-sf-retain-view');
      if (typeof window.sucafinaRefresh === 'function') void window.sucafinaRefresh();
    }
  };
  const enable = () => {
    root.querySelectorAll('input, select, textarea, button').forEach((control) => { control.disabled = busy; });
    const permissions = data && data.permissions || {}, decisions = data && data.decisions || {}, writes = decisions.permissions || {};
    const selectedChange = choice('change', decisions.changes || []);
    find('agenda').disabled = busy || !data || !data.agenda;
    find('preserve').disabled = busy || !permissions.preserve || !agenda;
    find('capture').disabled = busy || !permissions.capture || !choice('record', data && data.records || []);
    find('reopen').disabled = busy || !choice('history', data && data.history || []);
    ['case', 'draft-choice', 'draft-source'].forEach((name) => { find(name).disabled = busy || !writes.draft || !!form.dataset.dirty; });
    find('draft-source').disabled = find('draft-source').disabled || find('draft-choice').value !== 'new';
    fields.forEach((name) => { form.elements.namedItem(name).disabled = busy || !writes.draft || !draftBinding; });
    find('save-draft').disabled = busy || !writes.draft || !draftBinding || !form.dataset.dirty;
    find('reset-draft').disabled = busy || !form.dataset.dirty;
    find('prepare').disabled = busy || !writes.prepare || !choice('preparation', decisions.preparations || []);
    find('review').disabled = busy || !selectedChange || selectedChange.state !== 'planned';
    find('confirm').disabled = busy || !review || !writes.apply;
    find('apply').disabled = busy || !review || !writes.apply || !find('confirm').checked;
    retainView();
  };
  const failure = (result) => {
    if (result.status === 'conflict' || result.status === 'stale') return 'Os dados mudaram. Seu formulário foi mantido. Atualize as opções e revise novamente antes de aplicar.';
    if (result.status === 'denied') return 'Seu acesso não permite esta ação agora. Seu formulário foi mantido.';
    if (result.status === 'needs-input' || result.status === 'invalid') return 'Confira os campos e a seleção. Seu formulário foi mantido.';
    return 'Não foi possível concluir a ação. Seu formulário foi mantido; tente novamente.';
  };
  const request = async (mode, payload, id) => {
    const url = new URL(location.href); url.search = ''; url.hash = ''; url.searchParams.set('sf', mode);
    if (id) url.searchParams.set('id', id);
    const key = mode + ':' + JSON.stringify(payload);
    if (!keys.has(key)) keys.set(key, crypto.randomUUID());
    const response = await fetch(url, id ? { credentials: 'same-origin' } : { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json', 'Idempotency-Key': keys.get(key) }, body: JSON.stringify(payload) });
    const result = await response.json();
    if (!response.ok || result.status !== 'ok') throw new Error(failure(result));
    keys.delete(key);
    return result.value;
  };
  const run = async (work) => {
    if (busy) return;
    busy = true; enable(); announce('Carregando…');
    try { await work(); } catch (error) { resetReview(); announce(error instanceof Error ? error.message : 'Não foi possível concluir a ação.'); }
    finally { busy = false; enable(); }
  };
  const table = (container, headings, items) => {
    const element = document.createElement('table'), head = element.createTHead().insertRow(), body = element.createTBody();
    headings.forEach((title) => { const cell = document.createElement('th'); cell.scope = 'col'; cell.textContent = title; head.append(cell); });
    items.forEach((values) => { const row = body.insertRow(); values.forEach((value) => { row.insertCell().textContent = scalar(value); }); });
    container.append(element);
  };
  const projection = (container, value) => {
    const shown = (value && value.values || []).filter((item) => !/(?:\.|:)(?:id|ownerId|projectId|projId)$/.test(item.id));
    table(container, ['Campo', 'Período', 'Valor', 'Unidade / moeda', 'Evidência', 'Origem'], shown.map((item) => {
      const period = item.period ? item.period.start === item.period.end ? item.period.start : item.period.start + ' a ' + item.period.end : 'Não informado';
      const unit = [item.unit === 'tickets' ? 'Chamados' : item.unit === 'date' ? 'Data' : item.unit, item.currency === 'unspecified' ? 'Moeda não informada' : item.currency].filter(Boolean).join(' · ') || '—';
      const source = [...new Set((item.sourceRefs || []).map((ref) => ref.kind === 'record' ? ref.target.recordType === 'dashboard-page' ? ref.target.recordId : origins[ref.target.recordType] || 'Registro do Dashboard' : 'Evidência vinculada'))].join(', ') || 'Não informada';
      const name = String(item.id).startsWith('tickets:') ? String(item.id).slice(String(item.id).indexOf(':', 8) + 1).split('|').join(' · ') : fieldLabel(item.id);
      return [name, period, item.value, unit, evidenceLabels[item.evidenceState] || 'Não informada', source];
    }));
    if (value && value.missing && value.missing.length) {
      const reasons = { missing: 'não informado', unavailable: 'indisponível', unconfirmed: 'não confirmado', hidden: 'acesso restrito' };
      const limitations = [...new Set(value.missing.map((item) => (item.field === 'actual-and-forecast-coverage' ? 'Cobertura do realizado e da previsão' : fieldLabel(item.field)) + ': ' + (reasons[item.reason] || 'não disponível')))];
      const note = document.createElement('p'); note.textContent = 'Limitações da fonte: ' + limitations.join('; ') + '.'; container.append(note);
    }
    if (!shown.length) { const empty = document.createElement('p'); empty.textContent = 'Nenhum campo disponível nesta seleção.'; container.append(empty); }
  };
  const sections = (container, values) => {
    container.replaceChildren();
    values.forEach((section) => { const title = document.createElement('h3'); title.textContent = section.title; container.append(title); projection(container, section.projection || section.content); });
  };
  const fillFields = (value) => { fields.forEach((name) => { form.elements.namedItem(name).value = value && value[name] || (name === 'priority' ? 'normal' : ''); }); };
  const selectDraft = () => {
    draftBinding = undefined; delete form.dataset.dirty;
    const selected = choice('case', caseCatalog);
    if (selected && find('draft-choice').value === 'new') {
      const source = choice('draft-source', sourceCatalog);
      if (source) draftBinding = { caseRef: selected.caseRef, target: source.draft.target, targetEvidence: source.draft.targetEvidence, fields: source.draft.fields, sourceRefs: [source.draft.targetEvidence], expectedVersion: 0 };
    } else if (selected) {
      const existing = choice('draft-choice', draftCatalog);
      if (existing) draftBinding = { caseRef: existing.caseRef, draftRef: existing.draftRef, target: existing.target, targetEvidence: existing.targetEvidence, fields: existing.fields, sourceRefs: existing.sourceRefs, expectedVersion: existing.version };
    }
    fillFields(draftBinding && draftBinding.fields); enable();
  };
  const selectCase = () => {
    const selected = choice('case', caseCatalog);
    draftCatalog = selected ? data.decisions.drafts.filter((draft) => draft.caseRef.id === selected.caseRef.id && draft.caseRef.incarnation === selected.caseRef.incarnation) : [];
    options('draft-choice', draftCatalog, 'Selecione novo ou existente');
    if (selected) find('draft-choice').add(new Option('Novo rascunho', 'new'), 1);
    find('draft-source').value = ''; selectDraft();
  };
  const refresh = async () => {
    const from = find('from').value, to = find('to').value;
    if ((from && !to) || (!from && to) || (from && to && from > to)) throw new Error('Informe o início e o fim do período em ordem cronológica.');
    const next = await request('dashboard-workbench', { page: root.dataset.page, ...(from && to ? { period: { start: from, end: to } } : {}) });
    data = next; agenda = undefined; resetReview();
    find('from').value = next.period.start; find('to').value = next.period.end;
    find('agenda-view').replaceChildren();
    find('agenda-count').textContent = next.agenda ? next.agenda.recordCount + ' registro(s) na pauta de ' + root.dataset.page + '.' : 'Esta página não possui pauta disponível.';
    options('record', next.records, 'Selecione um registro'); options('history', next.history, 'Selecione um item do histórico');
    options('preparation', next.decisions.preparations, 'Selecione uma escolha');
    options('change', next.decisions.changes.map((change) => ({ ...change, label: change.label + ' · ' + (states[change.state] || 'Aguardando revisão') })), 'Selecione uma alteração');
    find('choice-reason').textContent = '';
    if (!form.dataset.dirty) {
      caseCatalog = next.decisions.cases; sourceCatalog = next.records.filter((record) => record.draft);
      options('case', caseCatalog, 'Selecione um caso'); options('draft-source', sourceCatalog, 'Selecione um Hot Topic'); selectCase();
    }
  };
  const refreshedAfter = async (message) => {
    try { await refresh(); announce(message); }
    catch { data = undefined; agenda = undefined; resetReview(); announce(message + ' Atualize as opções para continuar.'); }
  };
  find('load').addEventListener('click', () => run(async () => { await refresh(); announce(form.dataset.dirty ? 'Opções atualizadas. As alterações do formulário foram mantidas com a origem revisada anteriormente.' : 'Opções carregadas. Selecione os registros e escolhas que deseja revisar.'); }));
  find('agenda').addEventListener('click', () => run(async () => { agenda = await request('dashboard-agenda', { sections: [data.agenda.section] }); sections(find('agenda-view'), agenda.sections); announce('Pauta pronta para revisão.'); }));
  find('preserve').addEventListener('click', () => run(async () => { await request('dashboard-review-preserve', { selectionRef: agenda.selectionRef, sectionRefs: agenda.sections.map((section) => section.id) }); await refreshedAfter('Reunião preservada. Ela está disponível no histórico enquanto suas fontes permanecem autorizadas.'); }));
  find('capture').addEventListener('click', () => run(async () => { const selected = choice('record', data.records); await request('dashboard-capture', { sourceRef: selected.sourceRef }); await refreshedAfter('Retrato do registro preservado.'); }));
  find('reopen').addEventListener('click', () => run(async () => {
    const selected = choice('history', data.history), value = await request(selected.kind === 'capture' ? 'dashboard-history' : 'dashboard-review', undefined, selected.ref);
    const view = find('history-view'); view.replaceChildren();
    if (selected.kind === 'capture') { const date = document.createElement('p'); date.textContent = 'Retrato histórico de ' + value.capturedAt.slice(0, 10) + '. Os valores abaixo são os preservados nessa data.'; view.append(date); projection(view, value.projection); }
    else sections(view, value.sections);
    announce('Histórico aberto com seu acesso atual.');
  }));
  find('case').addEventListener('change', selectCase);
  find('draft-choice').addEventListener('change', selectDraft); find('draft-source').addEventListener('change', selectDraft);
  fields.forEach((name) => form.elements.namedItem(name).addEventListener('input', () => { form.dataset.dirty = 'true'; resetReview(); enable(); }));
  find('reset-draft').addEventListener('click', () => { delete form.dataset.dirty; fillFields(draftBinding && draftBinding.fields); enable(); announce('Alterações do formulário descartadas. Você pode atualizar as opções antes de editar novamente.'); });
  form.addEventListener('submit', (event) => { event.preventDefault(); if (!draftBinding || !form.reportValidity()) return; run(async () => {
    const edited = Object.fromEntries(fields.map((name) => [name, form.elements.namedItem(name).value]));
    await request('dashboard-hot-topic-draft', { ...draftBinding, fields: edited }); delete form.dataset.dirty; await refreshedAfter('Rascunho salvo. Ele pode ser incluído em uma escolha do caso antes da preparação.');
  }); });
  find('preparation').addEventListener('change', () => { const selected = choice('preparation', data && data.decisions.preparations || []); find('choice-reason').textContent = selected ? 'Motivo registrado: ' + selected.reason : ''; enable(); });
  find('prepare').addEventListener('click', () => run(async () => { const selected = choice('preparation', data.decisions.preparations); await request('dashboard-hot-topic-prepare', { caseRef: selected.caseRef, choiceId: selected.choiceId, draftRef: selected.draftRef }); await refreshedAfter('Escolha preparada. Selecione a alteração e revise os campos antes de aplicar.'); }));
  find('change').addEventListener('change', () => { resetReview(); enable(); });
  find('review').addEventListener('click', () => run(async () => {
    const selected = choice('change', data.decisions.changes); resetReview();
    const selectedRef = { caseRef: selected.caseRef, choiceId: selected.choiceId, changeId: selected.changeId };
    const result = await request('dashboard-hot-topic-review', selectedRef);
    if (result.state !== 'planned' || !result.fields.length || !result.reviewDigest) throw new Error('Esta alteração não está disponível para aplicação.');
    review = { ...selectedRef, reviewDigest: result.reviewDigest };
    const title = document.createElement('h3'); title.textContent = result.target.label || selected.label; find('review-view').append(title);
    table(find('review-view'), ['Campo', 'Valor atual', 'Valor proposto'], result.fields.map((field) => [labels[field.field] || 'Campo', field.before, field.after]));
    announce('Confira os valores atuais e propostos. A aplicação exige sua confirmação.');
  }));
  find('confirm').addEventListener('change', enable);
  find('apply').addEventListener('click', () => run(async () => {
    if (!review || !find('confirm').checked) return;
    const receipt = await request('dashboard-hot-topic-apply', review);
    if (!receipt.result || receipt.result.ok !== true) throw new Error('A alteração não foi aplicada. Atualize as opções e revise o estado atual.');
    resetReview(); await refreshedAfter('Alterações aplicadas. O comprovante foi registrado no caso.');
  }));
  ['record', 'history'].forEach((name) => find(name).addEventListener('change', enable));
  ['from', 'to'].forEach((name) => find(name).addEventListener('change', () => { data = undefined; agenda = undefined; resetReview(); enable(); announce('Atualize as opções para usar o novo período.'); }));
  panel.addEventListener('toggle', retainView);
  enable();
});
`
