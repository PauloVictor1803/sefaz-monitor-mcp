const $ = id => document.getElementById(id);
const el = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text !== undefined) n.textContent = String(text); return n; };
const drawings = {
  overview: '<path d="M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z"/>',
  alert: '<path d="M12 3 2 21h20L12 3Z"/><path d="M12 9v5m0 3h.01"/>',
  tool: '<path d="m7 7-5 5 5 5m10-10 5 5-5 5m-3-12-4 14"/>',
  integration: '<path d="M8 3v5m8-5v5M5 8h14v3a7 7 0 0 1-14 0V8Zm7 10v4"/>',
  states: '<path d="M4 5h16v14H4zM4 10h16M9 5v14M15 5v14"/>',
  docs: '<path d="M6 3h9l4 4v14H6zM14 3v5h5M9 12h7m-7 4h5"/>',
  check: '<circle cx="12" cy="12" r="9"/><path d="m8 12 3 3 6-6"/>',
};
function icon(name) { const wrap = el('span'); wrap.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true">${drawings[name] || drawings.check}</svg>`; return wrap.firstElementChild; }
const states = { AC:'Acre', AL:'Alagoas', AP:'Amapá', AM:'Amazonas', BA:'Bahia', CE:'Ceará', DF:'Distrito Federal', ES:'Espírito Santo', GO:'Goiás', MA:'Maranhão', MT:'Mato Grosso', MS:'Mato Grosso do Sul', MG:'Minas Gerais', PA:'Pará', PB:'Paraíba', PR:'Paraná', PE:'Pernambuco', PI:'Piauí', RJ:'Rio de Janeiro', RN:'Rio Grande do Norte', RS:'Rio Grande do Sul', RO:'Rondônia', RR:'Roraima', SC:'Santa Catarina', SP:'São Paulo', SE:'Sergipe', TO:'Tocantins' };
const docs = { NFE:'NF-e', NFCE:'NFC-e', CTE:'CT-e', MDFE:'MDF-e' };
const statusInfo = {
  OPERACIONAL:{ cls:'up', label:'Operacional' }, DEGRADADO:{ cls:'degraded', label:'Instabilidade' }, PARCIAL:{ cls:'degraded', label:'Queda parcial' }, OFFLINE:{ cls:'down', label:'Fora do ar' }, MANUTENCAO:{ cls:'maintenance', label:'Manutenção' }, DESCONHECIDO:{ cls:'unknown', label:'Sem confirmação' }, NAO_MAPEADO:{ cls:'unknown', label:'Não mapeado' }, NAO_SUPORTADO:{ cls:'unknown', label:'Não suportado' },
};
const info = code => statusInfo[code] || statusInfo.DESCONHECIDO;
const authorizerType = code => ({PROPRIO:'Próprio',VIRTUAL:'Virtual',VIRTUAL_PADRAO:'Virtual (padrão)'})[code] || 'Sem mapeamento';
const normalize = text => String(text || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const time = value => { const date = new Date(value); return Number.isNaN(date.getTime()) ? 'Não informado' : new Intl.DateTimeFormat('pt-BR', {timeZone:'America/Sao_Paulo',dateStyle:'short',timeStyle:'short'}).format(date); };
let documentType='NFE', selectedUf='MG', currentView='dashboard', stateData=[], summaryData, ufData, manualText, manualPending, refreshing=false, statesRequest=0, ufRequest=0;
let statesController, ufController;
const nav = {
  dashboard:{label:'Visão geral',icon:'overview',title:'O pulso da SEFAZ.\nEm um só lugar.',description:'Acompanhe os autorizadores e encontre o contexto para orientar o próximo atendimento.'},
  incidents:{label:'Incidentes',icon:'alert',title:'O que está\nacontecendo agora.',description:'Confira os alertas ativos, as manutenções e o histórico recente reportado pela fonte.'},
  tester:{label:'Testar ferramentas',icon:'tool',title:'Uma consulta.\nTodos os detalhes.',description:'Teste as quatro ferramentas MCP usando a mesma conexão disponível para os agentes.'},
  integration:{label:'Integração e manual',icon:'integration',title:'Seu agente,\ncom mais contexto.',description:'Endpoint, documentação e manual em Markdown para conectar e orientar sua IA.'},
};
function setView(view) {
  if (!Object.hasOwn(nav,view)) return;
  currentView=view; for (const key of Object.keys(nav)) $(`view-${key}`).hidden=key!==view;
  for (const b of $('main-nav').children) b.setAttribute('aria-pressed',String(b.dataset.view===view));
  $('breadcrumb-current').textContent=nav[view].label;
  const [line1,line2]=nav[view].title.split('\n');$('page-title').replaceChildren(document.createTextNode(line1),el('br'),el('span','',line2));$('page-description').textContent=nav[view].description;
  if(view==='integration') loadManual().catch(()=>{});
  if(view==='incidents') renderIncidents();
}
for(const [view,v] of Object.entries(nav)){const button=el('button','nav-button');button.type='button';button.dataset.view=view;button.title=v.label;button.setAttribute('aria-label',v.label);button.setAttribute('aria-pressed',String(view==='dashboard'));button.append(icon(v.icon),el('span','',v.label),el('span','','↗'));button.addEventListener('click',()=>setView(view));$('main-nav').append(button);}
for(const id of ['detail-uf','tool-uf']){for(const [uf,name] of Object.entries(states)){const option=el('option','',`${uf} · ${name}`);option.value=uf;$(id).append(option);}$(id).value='MG';}
for(const [id,name] of [['metric-icon-states','states'],['metric-icon-incidents','alert'],['metric-icon-docs','docs'],['alert-strip-icon','check']])$(id).append(icon(name));
function banner(message, auth=false){$('error-banner').hidden=!message;$('error-banner').replaceChildren();if(!message)return;$('error-banner').append(document.createTextNode(message));if(auth){const b=el('button','',' Configurar acesso');b.type='button';b.addEventListener('click',()=>$('access-dialog').showModal());$('error-banner').append(b);}}
function headers(json=false){const h={Accept:'application/json'};if(json)h['Content-Type']='application/json';const token=$('access-token').value.trim().replace(/^Bearer\s+/i,'');if(token)h.Authorization=`Bearer ${token}`;return h;}
async function requestJSON(path, options={}){
  const response=await fetch(path,{...options,headers:headers(Boolean(options.body)),signal:options.signal||AbortSignal.timeout(18000)});
  let data;try{data=await response.json();}catch{const e=new Error(`Resposta inesperada do servidor (HTTP ${response.status}).`);e.status=response.status;throw e;}
  if(!response.ok||data.error){const e=new Error(response.status===401?'O servidor exige um token de acesso válido.':typeof data.error==='string'?data.error:data.error?.message||`Falha na consulta (HTTP ${response.status}).`);e.status=response.status;throw e;}
  return data;
}
function errorText(error){if(error.name==='TimeoutError')return'O servidor não respondeu dentro de 18 segundos. Tente novamente.';if(error instanceof TypeError)return'Não foi possível conectar ao monitor. Confira a conexão e tente novamente.';return error.message||'Não foi possível concluir a consulta.';}
function renderStates(){
  const search=normalize($('state-search').value.trim()),only=$('only-issues').checked;
  const visible=stateData.filter(s=>(!search||normalize(`${s.uf} ${s.estado}`).includes(search))&&(!only||s.status!=='OPERACIONAL'));
  $('states-grid').replaceChildren();$('state-count').textContent=`${visible.length} de ${stateData.length} estados · ${docs[documentType]}`;
  if(!visible.length){$('states-grid').append(el('p','grid-message',stateData.length?'Nenhum estado corresponde aos filtros.':'Ainda não há dados para exibir.'));return;}
  for(const state of visible){
    const st=info(state.status),card=el('button','state-card');card.type='button';card.setAttribute('aria-pressed',String(state.uf===selectedUf));card.setAttribute('aria-label',`${state.uf}, ${state.estado}, ${st.label}, ${state.autorizador || 'autorizador não informado'}`);card.title=`${state.estado} · ${st.label}`;
    const top=el('div','state-top');top.append(el('span','state-uf',state.uf),el('span',`state-light ${st.cls}`));const auth=el('div','state-authorizer');auth.append(el('span','',state.autorizador||'Não informado'),el('span','',state.tipoAutorizador==='PROPRIO'?'Próprio':['VIRTUAL','VIRTUAL_PADRAO'].includes(state.tipoAutorizador)?'Virtual':'—'));
    card.append(top,el('span','state-name',state.estado||states[state.uf]||state.uf),el('span','state-status',st.label),auth);card.addEventListener('click',()=>{selectedUf=state.uf;$('detail-uf').value=selectedUf;renderStates();loadUf();});$('states-grid').append(card);
  }
}
async function loadStates(){
  statesController?.abort();statesController=new AbortController();const id=++statesRequest,type=documentType;
  $('states-grid').setAttribute('aria-busy','true');$('states-grid').classList.add('stale-data');
  try{const data=await requestJSON(`/api/estados?tipo_documento=${encodeURIComponent(type)}`,{signal:AbortSignal.any([statesController.signal,AbortSignal.timeout(18000)])});if(id!==statesRequest)return;if(!Array.isArray(data.estados))throw new Error('A lista de estados não veio no formato esperado.');stateData=data.estados;renderStates();$('metric-states').replaceChildren(document.createTextNode(`${stateData.filter(s=>s.status==='OPERACIONAL').length} `),el('small','','/ 27'));$('metric-document').textContent=docs[type];$('metric-coverage').textContent=`${stateData.length} UFs consultadas`;$('states-grid').classList.remove('stale-data');}
  catch(e){if(id!==statesRequest||e.name==='AbortError')return;stateData=[];$('metric-states').textContent='—';$('metric-coverage').textContent='Sem dados';$('state-count').textContent=`Sem confirmação · ${docs[type]}`;$('states-grid').replaceChildren(el('p','grid-message',errorText(e)));banner(`Não foi possível atualizar os estados. ${errorText(e)}`,e.status===401);}
  finally{if(id===statesRequest)$('states-grid').setAttribute('aria-busy','false');}
}
async function loadUf(){
  ufController?.abort();ufController=new AbortController();const id=++ufRequest;
  $('uf-details').setAttribute('aria-busy','true');$('uf-details').replaceChildren(el('p','muted-copy','Consultando os quatro documentos…'));$('copy-summary').disabled=true;$('uf-json').textContent='Consultando…';ufData=undefined;
  try{const data=await requestJSON(`/api/uf?uf=${encodeURIComponent(selectedUf)}&tipo_documento=TODOS`,{signal:AbortSignal.any([ufController.signal,AbortSignal.timeout(18000)])});if(id!==ufRequest)return;if(!Array.isArray(data.documentos))throw new Error('Os documentos não vieram no formato esperado.');ufData=data;$('uf-details').replaceChildren();
    for(const doc of data.documentos){const st=info(doc.status),row=el('div','doc-row'),left=el('div');left.append(el('strong','',docs[doc.documento]||doc.documento),el('small','',`${doc.autorizador||'Não informado'} · ${authorizerType(doc.tipoAutorizador)}`));row.append(left,el('span',`status-pill ${st.cls}`,st.label));$('uf-details').append(row);}
    $('uf-json').textContent=JSON.stringify(data,null,2);$('copy-summary').disabled=!data.resumoTexto;
  }catch(e){if(id!==ufRequest||e.name==='AbortError')return;$('uf-details').replaceChildren(el('p','muted-copy',errorText(e)));$('uf-json').textContent='Consulta indisponível.';if(e.status===401)banner(errorText(e),true);}
  finally{if(id===ufRequest)$('uf-details').setAttribute('aria-busy','false');}
}
function renderSummary(data){
  const st=info(data.statusGeral);$('global-status').textContent=st.label;$('global-dot').className=`status-dot ${st.cls}`;
  $('last-check').textContent=`Recebido às ${new Intl.DateTimeFormat('pt-BR',{timeZone:'America/Sao_Paulo',timeStyle:'medium'}).format(new Date())} · Brasília`;$('cache-label').textContent=data.cached?'Resposta em cache':'Resposta da fonte';
  $('metric-incidents').textContent=Number.isFinite(data.totalIncidentesAtivos)?data.totalIncidentesAtivos:'—';
  const active=Array.isArray(data.incidentesAtivos)?data.incidentesAtivos:[],maintenance=Array.isArray(data.manutencoesAtivas)?data.manutencoesAtivas:[];
  $('alert-summary').textContent=active.length||maintenance.length?`${active.length} incidente(s) e ${maintenance.length} manutenção(ões) reportado(s)`:'Nenhum incidente ativo reportado.';
  $('alert-description').textContent=active.length?'Consulte os detalhes antes de orientar sobre a indisponibilidade.':maintenance.length?'Há manutenção reportada pela fonte. Confira os horários e serviços envolvidos.':'Confira o documento e o autorizador da UF. A visão geral não substitui o diagnóstico da emissão.';
  $('alert-strip-icon').replaceChildren(icon(active.length||maintenance.length?'alert':'check'));renderIncidents();
}
function incidentCard(item, kind){
  const card=el('article',`incident-card ${kind==='resolved'?'resolved':''}`);card.append(el('h3','',item.name||'Aviso da fonte'));
  const label=kind==='resolved'?`Resolvido em ${time(item.resolved)}`:kind==='maintenance'?`Início: ${time(item.start||item.started)}`:`Início: ${time(item.started)}`;card.append(el('div','incident-meta',`${label}${item.status?` · ${item.status}`:''}`));
  if(item.lastUpdate?.message)card.append(el('p','',item.lastUpdate.message));return card;
}
function renderIncidents(){
  const target=$('incidents-list');target.replaceChildren();if(!summaryData){target.append(el('div','empty-box','Os incidentes serão exibidos após uma consulta bem-sucedida.'));return;}
  const groups=[['Incidentes ativos',summaryData.incidentesAtivos,'active'],['Manutenções reportadas',summaryData.manutencoesAtivas,'maintenance'],['Resolvidos recentemente',summaryData.incidentesResolvidosRecentes,'resolved']];
  for(const [title,items,kind]of groups){target.append(el('h3','incident-group-title',title));if(!Array.isArray(items)||!items.length){target.append(el('p','field-help','Nenhum registro retornado pela fonte.'));continue;}for(const item of items)target.append(incidentCard(item,kind));}
}
async function refreshAll(){
  if(refreshing)return;refreshing=true;$('refresh-button').disabled=true;$('refresh-incidents').disabled=true;banner('');
  const summary=async()=>{try{const data=await requestJSON('/api/status');if(typeof data.statusGeral!=='string')throw new Error('O status nacional não veio no formato esperado.');summaryData=data;renderSummary(data);}catch(e){summaryData=undefined;$('global-status').textContent='Sem confirmação';$('global-dot').className='status-dot';$('cache-label').textContent='Consulta indisponível';$('last-check').textContent='Não foi possível atualizar o panorama';$('metric-incidents').textContent='—';$('alert-summary').textContent='Não foi possível conferir os alertas.';$('alert-description').textContent='Tente atualizar novamente. Não há confirmação do status atual.';renderIncidents();banner(errorText(e),e.status===401);}};
  await Promise.allSettled([summary(),loadStates(),loadUf()]);refreshing=false;$('refresh-button').disabled=false;$('refresh-incidents').disabled=false;
}
for(const b of document.querySelectorAll('[data-document]'))b.addEventListener('click',()=>{documentType=b.dataset.document;for(const button of document.querySelectorAll('[data-document]'))button.setAttribute('aria-pressed',String(button===b));$('metric-document').textContent=docs[documentType];loadStates();});
$('state-search').addEventListener('input',renderStates);$('only-issues').addEventListener('change',renderStates);$('detail-uf').addEventListener('change',()=>{selectedUf=$('detail-uf').value;renderStates();loadUf();});
$('refresh-button').addEventListener('click',refreshAll);$('refresh-incidents').addEventListener('click',refreshAll);for(const id of ['show-incidents','alerts-link'])$(id).addEventListener('click',()=>setView('incidents'));
let autoTimer;function configureAuto(){clearInterval(autoTimer);if($('auto-refresh').checked&&!document.hidden)autoTimer=setInterval(()=>{if(!document.hidden)refreshAll();},60000);} $('auto-refresh').addEventListener('change',configureAuto);document.addEventListener('visibilitychange',configureAuto);
async function copy(button,text,original){try{await navigator.clipboard.writeText(text);button.textContent='Copiado ✓';}catch{button.textContent='Selecione o texto para copiar';}setTimeout(()=>{button.textContent=original;},2500);}
$('copy-summary').addEventListener('click',()=>{if(ufData?.resumoTexto)copy($('copy-summary'),ufData.resumoTexto,'Copiar resumo ⧉');});
const endpoint=new URL('/mcp',location.href).href;$('endpoint').value=endpoint;$('client-config').textContent=JSON.stringify({mcpServers:{'sefaz-monitor':{url:endpoint}}},null,2);$('copy-endpoint').addEventListener('click',()=>copy($('copy-endpoint'),endpoint,'Copiar ⧉'));
async function loadManual(){if(manualText)return manualText;if(manualPending)return manualPending;manualPending=(async()=>{try{const r=await fetch('/INSTRUCOES_AGENTE.md',{signal:AbortSignal.timeout(12000)});if(!r.ok)throw new Error('Não foi possível carregar o manual.');manualText=await r.text();$('manual-text').textContent=manualText;return manualText;}catch(e){$('manual-text').textContent=errorText(e);$('manual-feedback').textContent='O manual não pôde ser carregado. Tente novamente.';throw e;}finally{manualPending=undefined;}})();return manualPending;}
$('copy-manual').addEventListener('click',async()=>{try{const text=await loadManual();await copy($('copy-manual'),text,'Copiar manual ⧉');}catch{}});
function toolFields(){const name=$('tool-name').value;$('tool-uf-field').hidden=name!=='consultar_status_uf';$('tool-doc-field').hidden=!['consultar_status_uf','listar_todos_estados_sefaz'].includes(name);$('tool-active-field').hidden=name!=='consultar_incidentes_sefaz';$('tool-problems-field').hidden=name!=='listar_todos_estados_sefaz';const all=$('tool-document').querySelector('option[value="TODOS"]');all.disabled=name==='listar_todos_estados_sefaz';if(all.disabled&&$('tool-document').value==='TODOS')$('tool-document').value=documentType;}
$('tool-name').addEventListener('change',toolFields);let toolText='';
$('tool-form').addEventListener('submit',async event=>{event.preventDefault();$('tool-submit').disabled=true;$('copy-tool').hidden=true;$('tool-output').replaceChildren(el('p','','Consultando a ferramenta…'));const name=$('tool-name').value,args={};
  if(name==='consultar_status_uf')Object.assign(args,{uf:$('tool-uf').value,tipo_documento:$('tool-document').value});
  if(name==='listar_todos_estados_sefaz')Object.assign(args,{tipo_documento:$('tool-document').value,apenas_com_problemas:$('tool-problems').checked});
  if(name==='consultar_incidentes_sefaz')args.apenas_ativos=$('tool-active').checked;
  try{const data=await requestJSON('/mcp',{method:'POST',body:JSON.stringify({jsonrpc:'2.0',id:Date.now(),method:'tools/call',params:{name,arguments:args}})});if(data.result?.isError)throw new Error((data.result.content||[]).map(x=>x.text||'').join('\n'));const blocks=data.result?.content?.filter(x=>x.type==='text')||[];if(!blocks.length)throw new Error('A ferramenta não retornou conteúdo.');toolText=blocks[0].text;$('tool-output').replaceChildren(el('pre','',toolText));if(blocks.length>1){const details=el('details','json-details');details.append(el('summary','','Ver JSON completo'),el('pre','',blocks.slice(1).map(x=>x.text).join('\n')));$('tool-output').append(details);}$('copy-tool').hidden=false;}
  catch(e){toolText='';$('tool-output').replaceChildren(el('p','',errorText(e)));if(e.status===401)banner(errorText(e),true);}
  finally{$('tool-submit').disabled=false;}
});
$('copy-tool').addEventListener('click',()=>{if(toolText)copy($('copy-tool'),toolText,'Copiar ⧉');});
$('access-button').addEventListener('click',()=>$('access-dialog').showModal());for(const b of document.querySelectorAll('[data-close]'))b.addEventListener('click',()=>$(b.dataset.close).close());
$('toggle-token').addEventListener('click',()=>{const show=$('access-token').type==='password';$('access-token').type=show?'text':'password';$('toggle-token').textContent=show?'Ocultar':'Mostrar';$('toggle-token').setAttribute('aria-pressed',String(show));$('toggle-token').setAttribute('aria-label',show?'Ocultar token':'Mostrar token');});
$('access-dialog').addEventListener('close',()=>{$('access-token').type='password';$('toggle-token').textContent='Mostrar';$('toggle-token').setAttribute('aria-pressed','false');$('toggle-token').setAttribute('aria-label','Mostrar token');});$('apply-access').addEventListener('click',()=>{$('access-dialog').close();refreshAll();});
setView('dashboard');toolFields();refreshAll();
