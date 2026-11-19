/** Contextual controls use server-discovered options; executable commands never enter the form. */
export function dashboardWorkbenchWidget(page: string) {
  const entities: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }
  const escaped = page.replace(/[&<>"']/g, (value) => entities[value]!)
  return `<details class="card" data-dashboard-workbench-panel><summary>Revisão e ações</summary><section data-dashboard-workbench data-page="${escaped}" aria-label="Revisão e ações do Dashboard">
    <p>Monte a pauta desta página, preserve registros e revise escolhas existentes antes de aplicar alterações. As opções mostram até 100 registros e 50 casos autorizados.</p>
    <div class="form-grid"><label>Início do período<input type="date" data-dashboard-from></label><label>Fim do período<input type="date" data-dashboard-to></label></div>
    <button type="button" data-dashboard-load>Carregar opções</button><p role="status" aria-live="polite" data-dashboard-status></p>
    <div data-dashboard-recovery hidden><p data-dashboard-recovery-message></p><button type="button" data-dashboard-retry disabled>Repetir mesma tentativa</button></div><form data-dashboard-pending hidden></form>
    <fieldset><legend>Pauta da reunião</legend><p data-dashboard-agenda-count>Carregue as opções desta página.</p><button type="button" data-dashboard-agenda disabled>Pré-visualizar pauta</button> <button type="button" data-dashboard-preserve disabled>Preservar reunião</button><div data-dashboard-agenda-view></div></fieldset>
    <fieldset><legend>Retratos e histórico</legend><label>Registro para preservar<select data-dashboard-record><option value="">Selecione um registro</option></select></label><button type="button" data-dashboard-capture disabled>Preservar retrato</button><label>Reunião ou retrato preservado<select data-dashboard-history><option value="">Selecione um item do histórico</option></select></label><button type="button" data-dashboard-reopen disabled>Abrir histórico</button><div data-dashboard-history-view></div></fieldset>
    <form data-dashboard-draft><fieldset><legend>Rascunho de Hot Topic</legend><p>O rascunho precisa integrar uma escolha no caso antes de ser preparado. O impacto financeiro não é calculado aqui.</p>
      <label>Caso<select data-dashboard-case><option value="">Selecione um caso</option></select></label><label>Rascunho<select data-dashboard-draft-choice><option value="">Selecione novo ou existente</option></select></label><label>Hot Topic de origem<select data-dashboard-draft-source><option value="">Selecione um Hot Topic</option></select></label>
      <label>Ação<input name="action" required maxlength="1000" disabled></label><label>Responsável<input name="owner" required maxlength="500" disabled></label><label>Prazo<input name="due" type="date" required disabled></label><label>Prioridade<select name="priority" disabled><option value="normal">Normal</option><option value="high">Alta</option><option value="critical">Crítica</option></select></label><label>Notas<textarea name="notes" maxlength="16000" disabled></textarea></label>
      <button type="submit" data-dashboard-save-draft disabled>Salvar rascunho</button> <button type="button" data-dashboard-reset-draft disabled>Descartar alterações do formulário</button>
      <button type="button" data-dashboard-refresh-draft disabled>Carregar versão atual e manter minhas alterações</button><div data-dashboard-draft-diff></div><label data-dashboard-draft-confirmation hidden><input type="checkbox" data-dashboard-confirm-draft disabled>Revisei a versão atual do rascunho e quero manter meus valores.</label>
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
  const form = find('draft'), status = find('status'), panel = root.closest('[data-dashboard-workbench-panel]'), guard = find('pending');
  const fields = ['action', 'owner', 'due', 'priority', 'notes'];
  const labels = { action: 'Ação', owner: 'Responsável', due: 'Prazo', priority: 'Prioridade', notes: 'Notas', name: 'Nome', title: 'Título', status: 'Situação', risk: 'Risco', budget: 'Orçamento', actual: 'Realizado', forecast: 'Previsão', vendor: 'Fornecedor', type: 'Tipo', end: 'Término', start: 'Início', month: 'Mês', year: 'Ano', target: 'Meta', weight: 'Peso', progress: 'Progresso', value: 'Valor', description: 'Descrição', pm: 'Responsável pelo projeto', effective: 'Orçamento vigente', totalBudget: 'Orçamento total', totalActual: 'Realizado total', totalForecast: 'Previsão total', fact: 'Fato', rule: 'Regra', date: 'Data', severity: 'Severidade', opened: 'Chamados abertos', closed: 'Chamados encerrados', netChange: 'Variação de chamados', backlog: 'Chamados pendentes', active: 'Ativos', openIncidents: 'Incidentes abertos', renewal: 'Renovação', probability: 'Probabilidade', impact: 'Impacto' };
  const evidenceLabels = { confirmed: 'Confirmado', estimated: 'Estimado', absent: 'Ausente', unavailable: 'Indisponível', hypothetical: 'Hipótese' };
  const origins = { hotTopics: 'Hot Topics', opsTickets: 'Chamados', projects: 'Projetos', risks: 'Riscos', contracts: 'Contratos', members: 'Pessoas', leaders: 'Estrutura da equipe', opexOwners: 'OPEX', opexEntries: 'OPEX', capexProjects: 'CAPEX', capexEntries: 'CAPEX', 'itperf-item': 'Contrato de performance', stakeholders: 'Stakeholders', secKpi: 'Segurança de TI' };
  const states = { planned: 'Aguardando revisão', applied: 'Aplicada', conflict: 'Em conflito', failed: 'Não aplicada' };
  let data, agenda, review, draftBinding, draftIdentity, pendingDraft, mutation, draftConflict = false, draftCatalog = [], caseCatalog = [], sourceCatalog = [], busy = false, revoked = false;
  const controllers = new Set();
  const storedView = () => {
    const value = history.state && history.state.sfDashboardWorkbench;
    return value && value.schema === 1 && value.path === location.pathname && value.page === root.dataset.page ? value : {};
  };
  // Browser state contains only selectors and application correlation, never draft fields or evidence.
  // Draft restoration matches fresh authorized discovery; the host admits every exact apply replay again.
  const remember = (change) => {
    try {
      const previous = history.state && typeof history.state === 'object' ? history.state : {};
      history.replaceState({ ...previous, sfDashboardWorkbench: { ...storedView(), schema: 1, path: location.pathname, page: root.dataset.page, ...change } }, '', location.href);
    } catch { /* A browser that cannot retain navigation state still keeps the active attempt in memory. */ }
  };
  const rememberDraft = () => remember({ draft: draftIdentity && draftBinding ? { id: draftIdentity.id, incarnation: draftIdentity.incarnation, caseId: draftBinding.caseRef.id, caseIncarnation: draftBinding.caseRef.incarnation } : undefined });
  let applicationToRestore = storedView().application, draftOutcome = storedView().draftAttempt;
  if (draftOutcome) {
    const ref = draftOutcome.caseRef;
    if (Object.keys(draftOutcome).sort().join(',') !== 'caseRef,key' || typeof draftOutcome.key !== 'string' || !/^[a-f0-9-]{36}$/.test(draftOutcome.key) ||
      !ref || Object.keys(ref).sort().join(',') !== 'id,incarnation,version' || typeof ref.id !== 'string' || !ref.id.trim() || ref.id.length > 16384 ||
      typeof ref.incarnation !== 'string' || !ref.incarnation.trim() || ref.incarnation.length > 16384 || !Number.isSafeInteger(ref.version) || ref.version < 0) {
      draftOutcome = undefined; remember({ draftAttempt: undefined });
    }
  }
  const rememberApplication = () => remember({ application: mutation && mutation.mode === 'dashboard-hot-topic-apply' ? { body: mutation.body, key: mutation.key } : undefined });
  // A first save has no draftRef yet. Keep only the opaque intent, never the private
  // request body; discovery cannot identify its outcome by label, position or target.
  const rememberDraftAttempt = () => {
    const sent = mutation && mutation.mode === 'dashboard-hot-topic-draft' ? JSON.parse(mutation.body) : undefined;
    remember({ draftAttempt: sent && !sent.draftRef ? { caseRef: sent.caseRef, key: mutation.key } : undefined });
  };
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
  const announce = (message) => { if (!revoked) status.textContent = message; };
  const options = (name, list, empty) => {
    const select = find(name); select.replaceChildren(new Option(empty, ''));
    list.forEach((item, index) => select.add(new Option(item.label, String(index))));
  };
  const resetReview = () => { review = undefined; find('confirm').checked = false; find('review-view').replaceChildren(); };
  const retainView = () => {
    if (revoked) return;
    if (panel.open || busy || mutation || draftOutcome || applicationToRestore || form.dataset.dirty) root.setAttribute('data-sf-retain-view', 'true');
    else if (root.hasAttribute('data-sf-retain-view')) {
      root.removeAttribute('data-sf-retain-view');
      if (typeof window.sucafinaRefresh === 'function') void window.sucafinaRefresh();
    }
  };
  const enable = () => {
    if (revoked) return;
    const locked = busy || !!mutation || !!draftOutcome || !!applicationToRestore;
    root.querySelectorAll('input, select, textarea, button').forEach((control) => { control.disabled = locked; });
    const permissions = data && data.permissions || {}, decisions = data && data.decisions || {}, writes = decisions.permissions || {};
    const selectedChange = choice('change', decisions.changes || []);
    find('load').disabled = busy;
    find('recovery').hidden = !draftOutcome && (!mutation || !mutation.uncertain);
    find('recovery-message').textContent = draftOutcome ? 'O resultado do primeiro salvamento continua pendente. O serviço ainda não permite recuperar esta tentativa após recarregar a página. Nenhum novo salvamento será enviado; o comprovante precisa ser recuperado com seu acesso atual antes de continuar.' : mutation && mutation.ambiguous ? 'A tentativa anterior continua pendente. As opções recebidas são ambíguas. Atualize as opções antes de tentar recuperar o comprovante; nenhuma nova alteração foi enviada.' : 'O resultado da tentativa anterior ainda não foi confirmado. Repita a mesma requisição para consultar seu resultado com seu acesso atual antes de iniciar outra alteração.';
    find('retry').hidden = !!draftOutcome;
    find('retry').style.display = draftOutcome ? 'none' : '';
    find('retry').disabled = busy || !mutation || !mutation.uncertain || !!mutation.ambiguous;
    find('agenda').disabled = locked || !data || !data.agenda;
    find('preserve').disabled = locked || !permissions.preserve || !agenda;
    find('capture').disabled = locked || !permissions.capture || !choice('record', data && data.records || []);
    find('reopen').disabled = locked || !choice('history', data && data.history || []);
    ['case', 'draft-choice', 'draft-source'].forEach((name) => { find(name).disabled = locked || !writes.draft || !!form.dataset.dirty; });
    find('draft-source').disabled = find('draft-source').disabled || find('draft-choice').value !== 'new';
    fields.forEach((name) => { form.elements.namedItem(name).disabled = locked || !writes.draft || !draftBinding; });
    find('save-draft').disabled = locked || !writes.draft || !draftBinding || !form.dataset.dirty || draftConflict;
    find('reset-draft').disabled = locked || !form.dataset.dirty;
    find('refresh-draft').disabled = locked || !writes.draft || !draftBinding || !form.dataset.dirty;
    find('confirm-draft').disabled = locked || !writes.draft || !pendingDraft;
    find('prepare').disabled = locked || !writes.prepare || !choice('preparation', decisions.preparations || []);
    find('review').disabled = locked || !selectedChange || selectedChange.state !== 'planned';
    find('confirm').disabled = locked || !review || !writes.apply;
    find('apply').disabled = locked || !review || !writes.apply || !find('confirm').checked;
    retainView();
  };
  const failure = (result) => {
    if (result.status === 'conflict' || result.status === 'stale') return 'Os dados mudaram. Seu formulário foi mantido. Atualize as opções e revise novamente antes de aplicar.';
    if (result.status === 'denied') return 'Seu acesso não permite esta ação agora. Seu formulário foi mantido.';
    if (result.status === 'needs-input' || result.status === 'invalid') return 'Confira os campos e a seleção. Seu formulário foi mantido.';
    return 'Não foi possível concluir a ação. Seu formulário foi mantido; tente novamente.';
  };
  const request = async (mode, payload, id, attempt) => {
    if (revoked) throw new Error('Seu acesso mudou. Reabra a página com o acesso atual.');
    const url = new URL(location.href); url.search = ''; url.hash = ''; url.searchParams.set('sf', mode);
    if (id) url.searchParams.set('id', id);
    const controller = new AbortController(), timeout = setTimeout(() => controller.abort(), 10000);
    controllers.add(controller);
    try {
      const response = await fetch(url, id ? { credentials: 'same-origin', signal: controller.signal } : { method: 'POST', credentials: 'same-origin', signal: controller.signal, headers: { 'Content-Type': 'application/json', 'Idempotency-Key': attempt ? attempt.key : crypto.randomUUID() }, body: attempt ? attempt.body : JSON.stringify(payload) });
      if (response.status === 401 || response.status === 403 && !attempt) {
        window.dispatchEvent(new Event('sf-access-revoked'));
        throw new Error('Seu acesso mudou. Reabra a página com o acesso atual.');
      }
      const result = await response.json();
      if (revoked) throw new Error('Seu acesso mudou. Reabra a página com o acesso atual.');
      if (!response.ok || !result || result.status !== 'ok') {
        const error = new Error(failure(result || {})); error.status = result && result.status;
        error.rejected = [400, 401, 403, 409, 422].includes(response.status) && ['denied', 'conflict', 'stale', 'needs-input', 'invalid'].includes(error.status);
        throw error;
      }
      return result.value;
    } finally { clearTimeout(timeout); controllers.delete(controller); }
  };
  const run = async (work) => {
    if (busy || revoked) return;
    busy = true; enable(); announce('Carregando…');
    try { await work(); } catch (error) { if (!revoked) { if (!mutation) resetReview(); announce(error instanceof Error ? error.message : 'Não foi possível concluir a ação.'); } }
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
  const draftRequest = (value) => ({ caseRef: value.caseRef, draftRef: value.draftRef, target: value.target, targetEvidence: value.targetEvidence, fields: value.fields, sourceRefs: value.sourceRefs, expectedVersion: value.version });
  const clearDraftReview = () => { pendingDraft = undefined; draftConflict = false; find('draft-diff').replaceChildren(); find('confirm-draft').checked = false; find('draft-confirmation').hidden = true; };
  const selectDraft = () => {
    draftBinding = undefined; draftIdentity = undefined; clearDraftReview(); delete form.dataset.dirty;
    const selected = choice('case', caseCatalog);
    if (selected && find('draft-choice').value === 'new') {
      const source = choice('draft-source', sourceCatalog);
      if (source) draftBinding = { caseRef: selected.caseRef, target: source.draft.target, targetEvidence: source.draft.targetEvidence, fields: source.draft.fields, sourceRefs: [source.draft.targetEvidence], expectedVersion: 0 };
    } else if (selected) {
      const existing = choice('draft-choice', draftCatalog);
      if (existing) { draftBinding = draftRequest(existing); draftIdentity = { id: existing.id, incarnation: existing.incarnation }; }
    }
    fillFields(draftBinding && draftBinding.fields); rememberDraft(); enable();
  };
  const selectCase = () => {
    const selected = choice('case', caseCatalog);
    draftCatalog = selected ? data.decisions.drafts.filter((draft) => draft.caseRef.id === selected.caseRef.id && draft.caseRef.incarnation === selected.caseRef.incarnation) : [];
    options('draft-choice', draftCatalog, 'Selecione novo ou existente');
    if (selected) find('draft-choice').add(new Option('Novo rascunho', 'new'), 1);
    find('draft-source').value = ''; selectDraft();
  };
  const refresh = async (recheckingDenied = false) => {
    const from = find('from').value, to = find('to').value;
    if ((from && !to) || (!from && to) || (from && to && from > to)) throw new Error('Informe o início e o fim do período em ordem cronológica.');
    const next = await request('dashboard-workbench', { page: root.dataset.page, ...(from && to ? { period: { start: from, end: to } } : {}) });
    const caseAvailable = (ref) => next.decisions.cases.some((value) => value.caseRef.id === ref.id && value.caseRef.incarnation === ref.incarnation);
    const mutationCase = mutation && ['dashboard-hot-topic-draft', 'dashboard-hot-topic-prepare', 'dashboard-hot-topic-apply'].includes(mutation.mode) ? JSON.parse(mutation.body).caseRef : undefined;
    const retainingDraft = draftBinding && (form.dataset.dirty || mutation && mutation.mode === 'dashboard-hot-topic-draft');
    // A readable case does not authorize a removed source or a draft owned by a different
    // current principal. Never retain a saved draft merely because its case is still listed.
    const listedDraft = retainingDraft && draftIdentity && next.decisions.drafts.some((value) => value.id === draftIdentity.id && value.incarnation === draftIdentity.incarnation && value.caseRef.id === draftBinding.caseRef.id && value.caseRef.incarnation === draftBinding.caseRef.incarnation);
    const listedTarget = retainingDraft && next.records.some((value) => value.draft && value.draft.target.surface === draftBinding.target.surface && value.draft.target.type === draftBinding.target.type && value.draft.target.id === draftBinding.target.id && value.draft.target.incarnation === draftBinding.target.incarnation && value.draft.targetEvidence.refId === draftBinding.targetEvidence.refId && value.draft.targetEvidence.refDigest === draftBinding.targetEvidence.refDigest);
    const missingDraftSource = retainingDraft && (draftIdentity ? !listedDraft : !listedTarget);
    // Discovery is bounded and may omit a committed case whose sources advanced.
    // A restored apply contains no private fields. Its exact POST reauthorizes the
    // case and receipt at the host; an actual denial still takes the purge path.
    const requireListedCase = mutation && (!mutation.restored || recheckingDenied);
    if (mutationCase && requireListedCase && !caseAvailable(mutationCase) || retainingDraft && !caseAvailable(draftBinding.caseRef) || missingDraftSource) {
      window.dispatchEvent(new CustomEvent('sf-access-revoked', { detail: { reason: missingDraftSource ? 'draft-source-unconfirmed' : 'case-unavailable' } }));
      throw new Error('O caso, rascunho ou origem não está disponível com seu acesso atual.');
    }
    data = next; agenda = undefined; if (!mutation) resetReview();
    find('from').value = next.period.start; find('to').value = next.period.end;
    find('agenda-view').replaceChildren();
    find('history-view').replaceChildren();
    find('agenda-count').textContent = next.agenda ? next.agenda.recordCount + ' registro(s) na pauta de ' + root.dataset.page + '.' : 'Esta página não possui pauta disponível.';
    options('record', next.records, 'Selecione um registro'); options('history', next.history, 'Selecione um item do histórico');
    options('preparation', next.decisions.preparations, 'Selecione uma escolha');
    options('change', next.decisions.changes.map((change) => ({ ...change, label: change.label + ' · ' + (states[change.state] || 'Aguardando revisão') })), 'Selecione uma alteração');
    find('choice-reason').textContent = '';
    if (!form.dataset.dirty) {
      const selected = draftOutcome ? undefined : storedView().draft;
      caseCatalog = next.decisions.cases; sourceCatalog = next.records.filter((record) => record.draft);
      options('case', caseCatalog, 'Selecione um caso'); options('draft-source', sourceCatalog, 'Selecione um Hot Topic');
      const caseIndex = selected ? caseCatalog.findIndex((value) => value.caseRef.id === selected.caseId && value.caseRef.incarnation === selected.caseIncarnation) : -1;
      if (caseIndex >= 0) find('case').value = String(caseIndex);
      selectCase();
      const draftIndex = selected ? draftCatalog.findIndex((value) => selected.id && selected.incarnation ? value.id === selected.id && value.incarnation === selected.incarnation : value.draftRef === selected.draftRef && value.version === selected.version) : -1;
      if (draftIndex >= 0) { find('draft-choice').value = String(draftIndex); selectDraft(); }
    } else {
      // Refresh visible catalogs even while keeping the operator's dirty values and exact
      // original write binding. A new scoped source is not silently selected or rebound.
      caseCatalog = next.decisions.cases; sourceCatalog = next.records.filter((record) => record.draft);
      options('case', caseCatalog, 'Selecione um caso'); options('draft-source', sourceCatalog, 'Selecione um Hot Topic');
      const caseIndex = caseCatalog.findIndex((value) => value.caseRef.id === draftBinding.caseRef.id && value.caseRef.incarnation === draftBinding.caseRef.incarnation);
      if (caseIndex >= 0) find('case').value = String(caseIndex);
      draftCatalog = next.decisions.drafts.filter((value) => value.caseRef.id === draftBinding.caseRef.id && value.caseRef.incarnation === draftBinding.caseRef.incarnation);
      options('draft-choice', draftCatalog, 'Selecione novo ou existente');
      find('draft-choice').add(new Option('Novo rascunho', 'new'), 1);
      const draftIndex = draftIdentity ? draftCatalog.findIndex((value) => value.id === draftIdentity.id && value.incarnation === draftIdentity.incarnation) : -1;
      find('draft-choice').value = draftIndex >= 0 ? String(draftIndex) : 'new';
      const sourceIndex = sourceCatalog.findIndex((value) => value.draft.target.id === draftBinding.target.id && value.draft.target.incarnation === draftBinding.target.incarnation);
      if (sourceIndex >= 0) find('draft-source').value = String(sourceIndex);
    }
    restoreApplication();
    if (mutation && mutation.restored) {
      const sent = JSON.parse(mutation.body);
      mutation.ambiguous = next.decisions.changes.filter((change) => change.caseRef.id === sent.caseRef.id && change.caseRef.incarnation === sent.caseRef.incarnation && change.choiceId === sent.choiceId && change.changeId === sent.changeId).length > 1;
    }
  };
  const refreshedAfter = async (message) => {
    try { await refresh(); announce(message); }
    catch { if (!revoked) { data = undefined; agenda = undefined; resetReview(); announce(message + ' Atualize as opções para continuar.'); } }
  };
  const restoreApplication = () => {
    if (!applicationToRestore || mutation || draftOutcome) return;
    const saved = applicationToRestore; applicationToRestore = undefined;
    try {
      if (typeof saved.body !== 'string' || saved.body.length > 65536 || typeof saved.key !== 'string' || !/^[a-f0-9-]{36}$/.test(saved.key)) throw new Error('Invalid correlation');
      const value = JSON.parse(saved.body), ref = value.caseRef;
      if (Object.keys(value).sort().join(',') !== 'caseRef,changeId,choiceId,reviewDigest' || !ref || Object.keys(ref).sort().join(',') !== 'id,incarnation,version' ||
        typeof ref.id !== 'string' || !ref.id.trim() || ref.id.length > 16384 || typeof ref.incarnation !== 'string' || !ref.incarnation.trim() || ref.incarnation.length > 16384 || !Number.isSafeInteger(ref.version) || ref.version < 0 ||
        typeof value.choiceId !== 'string' || !value.choiceId.trim() || value.choiceId.length > 16384 || typeof value.changeId !== 'string' || !value.changeId.trim() || value.changeId.length > 16384 || !/^[a-f0-9]{64}$/.test(value.reviewDigest)) throw new Error('Invalid correlation');
      const current = data.decisions.changes.filter((change) => change.caseRef.id === ref.id && change.caseRef.incarnation === ref.incarnation && change.choiceId === value.choiceId && change.changeId === value.changeId);
      // The host's admitted apply route looks up the durable receipt before any
      // mutation and binds it to reviewDigest. Absence from a list is not failure
      // of that intent. Never replace the original case version, body or key.
      mutation = { mode: 'dashboard-hot-topic-apply', body: saved.body, key: saved.key, uncertain: true, restored: true, ambiguous: current.length > 1 };
      guard.dataset.dirty = 'true';
    } catch { remember({ application: undefined }); }
  };
  const completeMutation = async (attempt, value) => {
    if (attempt.mode === 'dashboard-hot-topic-draft') {
      const sent = JSON.parse(attempt.body);
      // The save receipt contains a draftRef and version only. Full identity and fields
      // come from the next authorized discovery, never from an invented receipt shape.
      remember({ draft: { ...(draftIdentity || {}), draftRef: value.draftRef, version: value.version, caseId: sent.caseRef.id, caseIncarnation: sent.caseRef.incarnation } });
      delete form.dataset.dirty; clearDraftReview();
      await refreshedAfter('Rascunho salvo. Ele pode ser incluído em uma escolha do caso antes da preparação.');
    } else if (attempt.mode === 'dashboard-hot-topic-apply') {
      resetReview();
      await refreshedAfter(value.result.ok ? 'Alterações aplicadas. O comprovante foi registrado no caso.' : 'A alteração não foi aplicada. O resultado foi registrado no caso; revise seu estado atual.');
    } else {
      const messages = { 'dashboard-hot-topic-prepare': 'Escolha preparada. Selecione a alteração e revise os campos antes de aplicar.', 'dashboard-review-preserve': 'Reunião preservada. Ela está disponível no histórico enquanto suas fontes permanecem autorizadas.', 'dashboard-capture': 'Retrato do registro preservado.' };
      await refreshedAfter(messages[attempt.mode]);
    }
  };
  const confirmedMutation = (attempt, value) => {
    const object = (item) => item !== null && typeof item === 'object' && !Array.isArray(item);
    const text = (item) => typeof item === 'string' && item.trim().length > 0;
    const strings = (items) => Array.isArray(items) && items.every(text);
    const version = (item) => Number.isSafeInteger(item) && item >= 0;
    if (!object(value)) return false;
    const sent = JSON.parse(attempt.body);
    if (attempt.mode === 'dashboard-capture') return Object.keys(value).join(',') === 'captureId' && typeof value.captureId === 'string' && /^dashboard-capture:[a-f0-9]{64}$/.test(value.captureId);
    if (attempt.mode === 'dashboard-hot-topic-draft') return Object.keys(value).sort().join(',') === 'draftRef,version' && typeof value.draftRef === 'string' && /^hot-topic-draft:[a-f0-9]{64}$/.test(value.draftRef) && version(value.version) && value.version === sent.expectedVersion + 1;
    if (attempt.mode === 'dashboard-hot-topic-prepare') return Object.keys(value).sort().join(',') === 'caseRef,changeId,choiceId' && object(value.caseRef) &&
      value.caseRef.id === sent.caseRef.id && value.caseRef.incarnation === sent.caseRef.incarnation && version(value.caseRef.version) && value.caseRef.version === sent.caseRef.version + 1 &&
      value.choiceId === sent.choiceId && typeof value.changeId === 'string' && /^dashboard-change:[a-f0-9]{64}$/.test(value.changeId);
    if (attempt.mode === 'dashboard-review-preserve') return typeof value.id === 'string' && /^dashboard-review:[a-f0-9]{64}$/.test(value.id) && value.version === 1 && text(value.createdAt) && Number.isFinite(Date.parse(value.createdAt)) &&
      Array.isArray(value.sourceRefs) && Array.isArray(value.comments) && Array.isArray(value.sections) && value.sections.length === sent.sectionRefs.length &&
      value.sections.every((section, index) => object(section) && section.id === sent.sectionRefs[index] && text(section.title) && object(section.period) && object(section.content) && Array.isArray(section.sourceRefs) && version(section.count));
    // The HTTP receipt has the domain command's identity, not the browser's request key.
    // Validate its complete shape here; the admitted host remains the authority for that binding.
    if (attempt.mode === 'dashboard-hot-topic-apply') return [value.id, value.idempotencyKey, value.targetIncarnation, value.principalRef, value.at].every(text) &&
      typeof value.commandDigest === 'string' && /^[a-f0-9]{64}$/.test(value.commandDigest) && Number.isFinite(Date.parse(value.at)) && value.surface === 'dashboard' && version(value.version) && object(value.result) &&
      (value.result.ok === true ? value.result.warnings === undefined || strings(value.result.warnings) : value.result.ok === false && [400, 403, 404, 409, 422, 503].includes(value.result.status) && (value.result.errors === undefined || strings(value.result.errors)));
    return false;
  };
  const retryMutation = async () => {
    const attempt = mutation;
    if (!attempt || draftOutcome || attempt.ambiguous || revoked) return;
    const reconciling = attempt.uncertain;
    try {
      const value = await request(attempt.mode, undefined, undefined, attempt);
      if (revoked || mutation !== attempt) return;
      if (!confirmedMutation(attempt, value)) throw new Error('Resultado não confirmado.');
      mutation = undefined; delete guard.dataset.dirty; rememberApplication(); rememberDraftAttempt();
      await completeMutation(attempt, value);
    } catch (error) {
      if (revoked || mutation !== attempt) return;
      let readRechecked = false;
      if (error.status === 'denied') {
        // Write refusal alone does not revoke readable local work. Recheck the authorized
        // case immediately; a missing case or denied read removes its private content.
        try { await refresh(true); readRechecked = true; }
        catch { if (revoked || mutation !== attempt) return; }
        if (revoked || mutation !== attempt) return;
      }
      // Egress revalidation can return denied after a durable commit. Apply conflicts
      // may also describe a receipt committed before delivery; neither creates a new intent.
      const definitive = error.rejected && error.status !== 'denied' && !(attempt.mode === 'dashboard-hot-topic-apply' && (error.status === 'conflict' || error.status === 'stale'));
      if (definitive && !reconciling) {
        mutation = undefined; delete guard.dataset.dirty; rememberApplication(); rememberDraftAttempt();
        if (attempt.mode === 'dashboard-hot-topic-draft' && (error.status === 'conflict' || error.status === 'stale')) {
          clearDraftReview(); draftConflict = true;
          throw new Error('O rascunho mudou. Use Carregar versão atual e manter minhas alterações, compare as diferenças e confirme a base antes de salvar.');
        }
        throw error;
      }
      attempt.uncertain = true; rememberApplication();
      announce(error.rejected ? readRechecked ? 'Seu acesso não permite esta ação agora. Seu formulário foi mantido com a leitura autorizada. O resultado permanece pendente; repita a mesma tentativa quando sua permissão permitir.' : 'A tentativa não foi autorizada ou seus dados mudaram. O resultado continua pendente; carregue as opções com seu acesso atual e repita a mesma tentativa para recuperar o comprovante.' : 'O resultado não foi confirmado. Os valores enviados estão preservados. Use Repetir mesma tentativa para recuperar o resultado.');
    }
  };
  const mutate = async (mode, payload) => {
    if (mutation || draftOutcome || applicationToRestore || revoked) return;
    mutation = { mode, body: JSON.stringify(payload), key: crypto.randomUUID(), uncertain: false };
    guard.dataset.dirty = 'true'; rememberApplication(); rememberDraftAttempt();
    await retryMutation();
  };
  find('retry').addEventListener('click', () => run(retryMutation));
  find('load').addEventListener('click', () => run(async () => { await refresh(); announce(draftOutcome ? 'Opções carregadas. O resultado do primeiro salvamento permanece pendente; a lista de rascunhos não confirma qual foi o resultado desta tentativa.' : mutation && mutation.ambiguous ? 'Opções atualizadas com seu acesso atual. A tentativa permanece pendente porque a seleção recebida é ambígua.' : form.dataset.dirty ? 'Opções atualizadas. As alterações do formulário foram mantidas com a origem revisada anteriormente.' + (mutation ? ' Repita a mesma tentativa para confirmar o resultado anterior.' : '') : mutation ? 'Opções atualizadas com seu acesso atual. Repita a mesma tentativa para confirmar o resultado anterior.' : 'Opções carregadas. Selecione os registros e escolhas que deseja revisar.'); }));
  find('agenda').addEventListener('click', () => run(async () => { agenda = await request('dashboard-agenda', { sections: [data.agenda.section] }); sections(find('agenda-view'), agenda.sections); announce('Pauta pronta para revisão.'); }));
  find('preserve').addEventListener('click', () => run(async () => { await mutate('dashboard-review-preserve', { selectionRef: agenda.selectionRef, sectionRefs: agenda.sections.map((section) => section.id) }); }));
  find('capture').addEventListener('click', () => run(async () => { const selected = choice('record', data.records); await mutate('dashboard-capture', { sourceRef: selected.sourceRef }); }));
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
  find('reset-draft').addEventListener('click', () => { delete form.dataset.dirty; clearDraftReview(); fillFields(draftBinding && draftBinding.fields); enable(); announce('Alterações do formulário descartadas. Você pode atualizar as opções antes de editar novamente.'); });
  find('refresh-draft').addEventListener('click', () => run(async () => {
    if (!draftBinding || !form.dataset.dirty) return;
    clearDraftReview(); draftConflict = true;
    await refresh();
    const sameCase = (value) => value.caseRef.id === draftBinding.caseRef.id && value.caseRef.incarnation === draftBinding.caseRef.incarnation;
    const sameTarget = (value) => value.target.id === draftBinding.target.id && value.target.incarnation === draftBinding.target.incarnation;
    if (draftIdentity) {
      const matches = data.decisions.drafts.filter((value) => value.id === draftIdentity.id && value.incarnation === draftIdentity.incarnation && sameCase(value) && sameTarget(value));
      if (matches.length === 1) pendingDraft = draftRequest(matches[0]);
    } else {
      const cases = data.decisions.cases.filter(sameCase), sources = data.records.filter((value) => value.draft && sameTarget(value.draft));
      if (cases.length === 1 && sources.length === 1) pendingDraft = { caseRef: cases[0].caseRef, target: sources[0].draft.target, targetEvidence: sources[0].draft.targetEvidence, fields: sources[0].draft.fields, sourceRefs: [sources[0].draft.targetEvidence], expectedVersion: 0 };
    }
    if (!pendingDraft) throw new Error('Este rascunho ou sua origem não está disponível com o acesso atual. Seus valores continuam no formulário.');
    table(find('draft-diff'), ['Campo', 'Versão anterior', 'Versão atual', 'Meus valores'], fields.map((name) => [labels[name], draftBinding.fields[name], pendingDraft.fields[name], form.elements.namedItem(name).value]));
    find('draft-confirmation').hidden = false;
    announce('Versão atual carregada. Compare as diferenças e confirme a base antes de salvar seus valores.');
  }));
  find('confirm-draft').addEventListener('change', () => {
    if (!pendingDraft) return;
    if (find('confirm-draft').checked) draftBinding = pendingDraft;
    draftConflict = !find('confirm-draft').checked; enable();
  });
  form.addEventListener('submit', (event) => { event.preventDefault(); if (!draftBinding || !form.reportValidity()) return; run(async () => {
    if (draftConflict) throw new Error('Carregue a versão atual e confirme a base antes de salvar. Seus valores foram mantidos.');
    const edited = Object.fromEntries(fields.map((name) => [name, form.elements.namedItem(name).value]));
    await mutate('dashboard-hot-topic-draft', { ...draftBinding, fields: edited });
  }); });
  find('preparation').addEventListener('change', () => { const selected = choice('preparation', data && data.decisions.preparations || []); find('choice-reason').textContent = selected ? 'Motivo registrado: ' + selected.reason : ''; enable(); });
  find('prepare').addEventListener('click', () => run(async () => { const selected = choice('preparation', data.decisions.preparations); await mutate('dashboard-hot-topic-prepare', { caseRef: selected.caseRef, choiceId: selected.choiceId, draftRef: selected.draftRef }); }));
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
    await mutate('dashboard-hot-topic-apply', review);
  }));
  ['record', 'history'].forEach((name) => find(name).addEventListener('change', enable));
  ['from', 'to'].forEach((name) => find(name).addEventListener('change', () => { data = undefined; agenda = undefined; resetReview(); enable(); announce('Atualize as opções para usar o novo período.'); }));
  panel.addEventListener('toggle', retainView);
  window.addEventListener('sf-access-revoked', (event) => {
    if (revoked) return;
    revoked = true; controllers.forEach((controller) => controller.abort()); controllers.clear();
    data = agenda = review = draftBinding = draftIdentity = pendingDraft = mutation = applicationToRestore = draftOutcome = undefined;
    draftCatalog = []; caseCatalog = []; sourceCatalog = []; delete form.dataset.dirty; delete guard.dataset.dirty;
    remember({ draft: undefined, application: undefined, draftAttempt: undefined });
    const note = document.createElement('p'); note.textContent = 'Seu acesso mudou. Reabra a página com o acesso atual.'; root.replaceChildren(note);
    if (event instanceof CustomEvent && event.detail && event.detail.reason === 'draft-source-unconfirmed') {
      const explanation = document.createElement('p'); explanation.textContent = 'Não foi possível confirmar a identidade autorizada do rascunho ou de sua origem. Os dados locais foram removidos. Recarregue as opções com seu acesso atual.'; root.append(explanation);
    }
  });
  if (applicationToRestore) announce('Há uma tentativa anterior para conferir. Carregue as opções com seu acesso atual antes de recuperar o resultado.');
  if (draftOutcome) { guard.dataset.dirty = 'true'; announce('O resultado do primeiro salvamento ainda não foi confirmado. A recuperação autorizada desta tentativa precisa estar disponível antes de continuar.'); }
  enable();
});
`
