export const importAnalysisMarkup = `<section data-import-analysis aria-labelledby="sf-import-analysis-title">
  <style>[data-import-analysis] [hidden]{display:none!important}</style>
  <h2 id="sf-import-analysis-title">Análise opcional do arquivo</h2>
  <p>A análise usa a prévia revisada e as fontes atuais de uma decisão existente. A importação continua disponível sem análise.</p>
  <button type="button" data-analysis-open disabled>Analisar impacto do arquivo</button>
  <form data-analysis-form hidden>
    <label for="sf-import-analysis-case">Decisão</label><select id="sf-import-analysis-case" data-analysis-case required></select>
    <label for="sf-import-analysis-kind">Tipo de análise</label><select id="sf-import-analysis-kind" data-analysis-kind required></select>
    <label for="sf-import-analysis-model">Modelo</label><select id="sf-import-analysis-model" data-analysis-model required></select>
    <label for="sf-import-analysis-objective">Objetivo da análise</label><textarea id="sf-import-analysis-objective" data-analysis-objective required maxlength="8000">Explicar o impacto desta prévia de importação.</textarea>
    <p>A decisão precisa incluir o destino atual como evidência. <a href="?sf=workbench">Abrir decisões</a>.</p>
    <button type="submit" data-analysis-start disabled>Iniciar análise</button>
  </form>
  <p data-analysis-status aria-live="polite">Prepare e revise uma prévia para habilitar a análise opcional.</p>
  <button type="button" data-analysis-read disabled>Atualizar análise</button><button type="button" data-analysis-cancel disabled>Cancelar análise</button>
  <section data-analysis-output></section>
</section>`

/** Optional analysis has its own state; it never receives or calls the import Apply action. */
export const importAnalysisScript = `((root, post) => {
  const panel=root.querySelector('[data-import-analysis]'),open=panel.querySelector('[data-analysis-open]'),form=panel.querySelector('[data-analysis-form]');
  const cases=panel.querySelector('[data-analysis-case]'),kinds=panel.querySelector('[data-analysis-kind]'),models=panel.querySelector('[data-analysis-model]'),objective=panel.querySelector('[data-analysis-objective]');
  const start=panel.querySelector('[data-analysis-start]'),read=panel.querySelector('[data-analysis-read]'),cancel=panel.querySelector('[data-analysis-cancel]'),status=panel.querySelector('[data-analysis-status]'),output=panel.querySelector('[data-analysis-output]');
  let preview,choices,runRef,runState,attempt,epoch=0,working=false,importBusy=false;
  const call=(action,value={},key=crypto.randomUUID())=>post('workbench-analysis',{action,...value},key);
  const controls=()=>{const locked=working||importBusy;open.disabled=locked||!preview;form.querySelectorAll('select,textarea').forEach((item)=>item.disabled=locked);start.disabled=locked||!preview||!choices?.cases.length||!choices?.analyses.length||!choices?.models.length||!!runRef;read.disabled=locked||!runRef;cancel.disabled=locked||!runRef||['ready','failed','stale','cancelled','unavailable','needs-input'].includes(runState)};
  const resetRun=()=>{runRef=undefined;runState=undefined;attempt=undefined;output.replaceChildren()};
  const resetChoices=()=>{choices=undefined;form.hidden=true;cases.replaceChildren();kinds.replaceChildren();models.replaceChildren();resetRun()};
  const clear=()=>{epoch++;preview=undefined;working=false;resetChoices();status.textContent='Prepare e revise uma prévia para habilitar a análise opcional.';controls()};
  const fail=(error,current)=>{if(current!==epoch)return;output.replaceChildren();if(['denied','stale','conflict'].includes(error.state)){epoch++;working=false;resetChoices();status.textContent=error.state==='denied'?'O acesso à análise mudou. Atualize as opções antes de continuar.':'O caso ou a fonte mudou. Atualize o caso e revise a prévia antes de tentar novamente.'}else status.textContent=error.state==='needs-input'?'A análise precisa de dados adicionais. Revise a decisão, suas fontes e o objetivo antes de tentar novamente.':'Não foi possível confirmar a análise. Tente novamente para reconciliar a mesma solicitação. A importação continua disponível.'};
  const option=(parent,value,label)=>{const item=document.createElement('option');item.value=String(value);item.textContent=label;parent.append(item)};
  const update=async(current)=>{
    const result=await call('read',{runRef});if(current!==epoch)return;runState=result.state;output.replaceChildren();
    const messages={preparing:'Preparando análise.',running:'Análise em andamento.',ready:'Análise disponível. Nenhuma alteração do domínio foi aplicada.',failed:'A análise falhou. A prévia da importação permanece disponível.',stale:'A análise perdeu a validade da fonte ou do caso.',cancelled:'Análise cancelada.',unavailable:'Análise indisponível.', 'needs-input':'A análise precisa de dados adicionais.'};
    status.textContent=messages[runState]||'Estado da análise: '+String(runState);
    if(runState==='ready'){const result=await call('output',{runRef});if(current!==epoch)return;if(typeof result.html!=='string')throw new Error('analysis-output-unavailable');const fragment=document.createElement('template');fragment.innerHTML=result.html;output.append(fragment.content)}
  };
  open.addEventListener('click',async()=>{if(working||importBusy||!preview)return;epoch++;const current=epoch;resetChoices();working=true;controls();status.textContent='Buscando decisões acessíveis e modelos configurados…';try{
    const value=await call('choices');if(current!==epoch)return;choices={...value,analyses:value.analyses.filter((item)=>item.skillId==='sf-enquadrar-decisao'||(item.skillId==='sf-explicar-forecast'&&preview.manifest.context.surface==='planner'))};
    choices.cases.forEach((item,index)=>option(cases,index,item.label+' · versão '+item.caseRef.version));choices.analyses.forEach((item,index)=>option(kinds,index,item.label));choices.models.forEach((item,index)=>option(models,index,item.providerID+' / '+item.id));form.hidden=false;
    status.textContent=!choices.cases.length?'Nenhuma decisão acessível. Abra Decisões para selecionar as fontes do destino.':!choices.analyses.length?'As análises de importação não estão disponíveis nesta instalação.':!choices.models.length?'Nenhum modelo está disponível. Você pode continuar a revisão e a importação.':'Escolha a decisão, o tipo de análise e o modelo. O início exige sua confirmação.';
  }catch(error){fail(error,current)}finally{if(current===epoch)working=false;controls()}});
  form.addEventListener('change',()=>{if(working)return;epoch++;resetRun();status.textContent='Opções alteradas. Inicie a análise para usar a seleção atual.';controls()});
  form.addEventListener('submit',async(event)=>{event.preventDefault();if(working||importBusy||!preview||!choices||runRef||!form.reportValidity())return;
    const selectedCase=choices.cases[Number(cases.value)],selected=choices.analyses[Number(kinds.value)],model=choices.models[Number(models.value)],text=objective.value.trim();if(!selectedCase||!selected||!model||!text)return;
    const request={caseRef:selectedCase.caseRef,profileId:selected.profileId,profileVersion:selected.profileVersion,skillId:selected.skillId,skillVersion:selected.skillVersion,manifestDigest:selected.manifestDigest,outputSchemaVersion:selected.outputSchemaVersion,requestedOperationScope:selected.requestedOperationScope,objective:text};
    const selection={caseRef:selectedCase.caseRef,previewRef:preview.manifest.id,importRequest:preview.importRequest,...(selected.skillId==='sf-enquadrar-decisao'?{intentText:text}:{period:preview.manifest.context.period,currency:preview.manifest.context.currency})};
    const signature=JSON.stringify({request,selection,model});if(attempt?.signature!==signature)attempt={signature,prepareKey:crypto.randomUUID(),startKey:crypto.randomUUID()};
    const current=epoch;working=true;output.replaceChildren();controls();status.textContent='Validando a prévia e as fontes da decisão…';try{
      if(!attempt.skillInput)attempt.skillInput=await call('prepare',{input:{request,selection}},attempt.prepareKey);if(current!==epoch)return;
      status.textContent='Iniciando a análise autorizada…';const result=await call('start',{input:{request,skillInput:attempt.skillInput,model}},attempt.startKey);if(current!==epoch)return;if(typeof result.runRef!=='string'||!result.runRef)throw new Error('analysis-run-unavailable');runRef=result.runRef;runState='preparing';await update(current);
    }catch(error){fail(error,current)}finally{if(current===epoch)working=false;controls()}
  });
  read.addEventListener('click',async()=>{if(working||importBusy||!runRef)return;const current=epoch;working=true;controls();try{await update(current)}catch(error){fail(error,current)}finally{if(current===epoch)working=false;controls()}});
  cancel.addEventListener('click',async()=>{if(working||importBusy||!runRef||cancel.disabled)return;const current=epoch;working=true;controls();try{await call('cancel',{runRef});if(current!==epoch)return;await update(current)}catch(error){fail(error,current)}finally{if(current===epoch)working=false;controls()}});
  return {clear,lock:(value)=>{importBusy=value;controls()},show:(manifest,importRequest)=>{const eligible=manifest?.state==='preview'&&!manifest.domainApplied&&importRequest;if(!eligible){clear();return}if(preview?.manifest.id!==manifest.id||preview?.manifest.version!==manifest.version)clear();preview={manifest:structuredClone(manifest),importRequest:structuredClone(importRequest)};status.textContent=choices?status.textContent:'A prévia revisada está pronta para análise opcional.';controls()}};
})(root, post)`
