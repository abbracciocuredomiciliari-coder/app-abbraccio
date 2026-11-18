import {PRIMARY_SECTORS,EXTRA_SECTORS,SECTORS,STATUS_TILES,TOOLS,filterItems,countStatuses,sourceKey,uniqueItems,matchesTool,normalizeView} from './hub-core.mjs';

const ICONS={
 clipboard:'<rect x="5" y="4" width="14" height="17" rx="2"/><rect x="9" y="2" width="6" height="4" rx="1"/><path d="M9 10h6M9 14h6M9 18h4"/>',
 pulse:'<path d="M20.4 4.6a5 5 0 0 0-7 0L12 6l-1.4-1.4a5 5 0 0 0-7 7L12 20l8.4-8.4a5 5 0 0 0 0-7z"/><path d="M3 11h5l2-4 3 9 2-5h6"/>',
 users:'<circle cx="9" cy="7" r="3"/><path d="M3 21v-3a6 6 0 0 1 12 0v3M16 4a3 3 0 0 1 0 6M18 14a5 5 0 0 1 3 4v3"/>',
 user:'<circle cx="12" cy="7" r="4"/><path d="M4 22v-3a8 8 0 0 1 16 0v3"/>',
 home:'<path d="M3 10l9-8 9 8v11H3zM9 21V12h6v9"/>',
 list:'<path d="M8 5h13M8 12h13M8 19h13M3 5h.1M3 12h.1M3 19h.1"/>',
 inbox:'<path d="M4 4h16l3 12v5H1v-5zM1 16h6l2 3h6l2-3h6"/>',
 clock:'<circle cx="12" cy="12" r="10"/><path d="M12 5v7l-4 3"/>',
 phone:'<path d="M7 3H4a2 2 0 0 0-2 2 17 17 0 0 0 17 17 2 2 0 0 0 2-2v-3l-5-2-2 3a14 14 0 0 1-8-8l3-2zM15 3a6 6 0 0 1 6 6M15 7a2 2 0 0 1 2 2"/>',
 check:'<circle cx="12" cy="12" r="10"/><path d="M7 12l3 3 7-8"/>',
 x:'<circle cx="12" cy="12" r="10"/><path d="M8 8l8 8M16 8l-8 8"/>',
 alert:'<circle cx="12" cy="12" r="10"/><path d="M12 6v7M12 17h.1"/>',
 arrow:'<path d="M9 5l7 7-7 7"/>',back:'<path d="M15 5l-7 7 7 7"/>',
 calendar:'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 2v6M17 2v6M3 11h18"/>',
 medical:'<path d="M9 3h6v6h6v6h-6v6H9v-6H3V9h6z"/>',
 activity:'<path d="M2 12h5l3-9 4 18 3-9h5"/>',
 folder:'<path d="M2 6h8l2 3h10v12H2zM2 6V3h8l2 3h8v3"/>',
 transfer:'<path d="M3 7h16M15 3l4 4-4 4M21 17H5M9 13l-4 4 4 4"/>',
};
export const icon=name=>`<svg class="hub-icon" aria-hidden="true" viewBox="0 0 24 24">${ICONS[name]||ICONS.list}</svg>`;
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const labelFor=s=>STATUS_TILES.find(x=>x.id===s)?.label||'Tutte';
const workflowLabel=i=>i.outcome==='not-interested'?'Non interessati':({new:'Nuova',active:'In corso',waiting:'In attesa',closed:'Chiusa',cancelled:'Annullata'}[i.workflow]||'Da verificare');
const dateLabel=v=>{if(!v)return 'Da definire';const d=new Date(v.length===10?v+'T12:00:00+01:00':v);return Number.isFinite(d.getTime())?new Intl.DateTimeFormat('it-IT',{dateStyle:'short',timeZone:'Europe/Rome'}).format(d):'Data da verificare';};

/** mountHub crea soltanto la UI. In produzione snapshot è una risposta server
 * autorizzata; complete=true è riservato alla demo/insiemi realmente completi.
 * onViewChange deve caricare elenco e conteggi con gli stessi filtri.
 * onAction apre i moduli reali: nessun click sui riquadri scrive stati.
 */
export function mountHub(root,initial={}){
 let options={...initial},snapshot=initial.snapshot||{items:[],professionals:[]};
 let view=normalizeView(initial.view),stack=[],destroyed=false;
 const items=()=>snapshot.items||[],pros=()=>snapshot.professionals||[],pats=()=>snapshot.patients||[];
 const scope=()=>({sectorId:view.sectorId,professionalId:view.professionalId,patientId:view.patientId,area:view.area,query:view.query});
 const scopeKey=()=>JSON.stringify(scope());
 const count=id=>snapshot.complete?countStatuses(items(),scope())[id]:snapshot.summary?.statuses?.[scopeKey()]?.[id];
 const badge=n=>`<span class="hub-count">${n===undefined?'—':esc(n)}</span>`;
 function go(next,{push=true}={}){
   if(push)stack.push({...view});
   view=normalizeView({...view,...next});
   options.onViewChange?.({...view});render(true);
 }
 function back(){view=stack.pop()||normalizeView();options.onViewChange?.({...view});render(true);}
 function sectorButton(s){const n=snapshot.complete?filterItems(items(),{sectorId:s.id,area:view.area}).length:snapshot.summary?.sectors?.[s.id];return `<button class="hub-sector" data-action="sector" data-id="${esc(s.id)}">${icon(s.icon)}<span><strong>${esc(s.title)}</strong><small>${esc(s.description)}</small></span><span class="hub-sector-end">${badge(n)}${icon('arrow')}</span></button>`;}
 function tile(t,n,action='status'){return `<button class="hub-state" data-action="${action}" data-id="${esc(t.id)}"><span class="hub-state-top">${icon(t.icon)}${badge(n)}</span><span class="hub-state-label">${esc(t.label)}</span></button>`;}
 function controls(){return `<form class="hub-toolbar" data-form="filters"><label class="hub-field">Cerca paziente, professionista o consegna<input class="hub-input" type="search" name="query" value="${esc(view.query)}" placeholder="Scrivi un nome o una parola…"></label><label class="hub-field">Area<select class="hub-input" name="area"><option value="all">Tutte le aree autorizzate</option>${(snapshot.authorizedAreas||[]).map(a=>`<option value="${esc(a.id)}" ${a.id===view.area?'selected':''}>${esc(a.label)}</option>`).join('')}</select></label><button class="hub-button" type="submit">Cerca</button></form>`;}
 function record(i){return `<article class="hub-record"><h3>${esc(i.title)}</h3><div class="hub-tags"><span class="hub-tag">${esc(workflowLabel(i))}</span>${i.followUpRequired?'<span class="hub-tag">Da ricontattare</span>':''}${i.priority==='urgent'?'<span class="hub-tag urgent">Urgente</span>':''}</div><p class="hub-meta">${esc(i.referenceLabel||'Riferimento da collegare')}</p>${i.patientLabel?`<p class="hub-meta">Paziente: ${esc(i.patientLabel)}</p>`:''}<p class="hub-meta">Professionista: ${esc((i.professionalLabels||[]).join(', ')||'Da collegare')}</p><p class="hub-meta">Scadenza: ${esc(dateLabel(i.dueAt))}${i.nextContactAt?' · Ricontatto: '+esc(dateLabel(i.nextContactAt)):''}</p><div class="hub-list-actions"><button class="hub-button primary" data-action="detail" data-id="${esc(sourceKey(i))}">Apri consegna ${icon('arrow')}</button></div></article>`;}
 function getRows(){
   if(!snapshot.complete)return items();
   let rows=filterItems(items(),{...scope(),status:view.status});
   if(view.screen==='tool-list')rows=rows.filter(i=>matchesTool(i,view.tool,{today:snapshot.today,userId:snapshot.userId,now:snapshot.now}));
   return rows;
 }
 function render(focus=false){
   if(destroyed)return;
   const sector=SECTORS.find(s=>s.id===view.sectorId);
   const professional=pros().find(p=>p.id===view.professionalId);
   let subtitle='Gestione delle richieste e delle attività per settore',body='';
   if(view.screen==='home'){
     body=`<div class="hub-sectors">${PRIMARY_SECTORS.map(sectorButton).join('')}<button class="hub-sector" data-action="extra">${icon('users')}<span><strong>Altri professionisti e back office</strong><small>Medici, riabilitazione e ulteriori settori</small></span>${icon('arrow')}</button><button class="hub-sector" data-action="patients">${icon('user')}<span><strong>Pazienti</strong><small>Consegne e attività per paziente</small></span><span class="hub-sector-end">${badge(pats().length)}${icon('arrow')}</span></button><button class="hub-sector" data-action="professionals">${icon('users')}<span><strong>Professionisti</strong><small>Consegne e incarichi per professionista</small></span><span class="hub-sector-end">${badge(pros().length)}${icon('arrow')}</span></button></div><hr class="hub-divider"><h2 class="hub-section-title">Strumenti di lavoro</h2><div class="hub-shortcuts"><button class="hub-shortcut" data-action="tools">${icon('list')}Attività e controlli</button><button class="hub-shortcut" data-action="create">${icon('clipboard')}Nuova consegna</button><button class="hub-shortcut" data-action="legacy">${icon('folder')}Funzioni esistenti</button></div>`;
   }else if(view.screen==='extra'){
     subtitle='Scegli il settore';body=`<div class="hub-sectors">${EXTRA_SECTORS.map(sectorButton).join('')}</div>`;
   }else if(view.screen==='sector'||view.screen==='professional'||view.screen==='patient'){
     const patient=pats().find(p=>p.id===view.patientId);
     subtitle=view.screen==='patient'?'Consegne e attività del paziente':view.screen==='professional'?'Consegne e incarichi del professionista':sector?.description||'Richieste e attività del settore';
     body=`<h2 class="hub-section-title">${esc(view.screen==='patient'?(patient?.label||'Paziente'):view.screen==='professional'?(professional?.label||'Professionista'):sector?.title||'Settore')}</h2><div class="hub-states">${STATUS_TILES.map(t=>tile(t,count(t.id))).join('')}</div><hr class="hub-divider"><div class="hub-shortcuts"><button class="hub-shortcut" data-action="patients">${icon('user')}Cerca paziente</button><button class="hub-shortcut" data-action="professionals">${icon('users')}Cerca professionista</button><button class="hub-shortcut" data-action="create">${icon('clipboard')}Nuova consegna</button></div>`;
   }else if(view.screen==='list'||view.screen==='tool-list'){
     const rows=getRows();subtitle=view.screen==='tool-list'?(TOOLS.find(t=>t.id===view.tool)?.label||'Attività'):labelFor(view.status);
     body=`<h2 class="hub-section-title">${esc(professional?.label||sector?.title||'Tutte le consegne')}</h2>${controls()}<p class="hub-meta">${esc(snapshot.complete?rows.length:snapshot.totalResults??'—')} risultati${view.status==='urgenti'?' · Priorità urgente, consegne aperte':''}</p><div class="hub-records">${rows.length?rows.map(record).join(''):'<p class="hub-empty">Nessuna consegna corrisponde ai filtri.</p>'}</div>${!snapshot.complete?`<div class="hub-list-actions"><button class="hub-button" data-action="previous" ${snapshot.hasPrevious?'':'disabled'}>Precedenti</button><button class="hub-button" data-action="next" ${snapshot.hasNext?'':'disabled'}>Successive</button></div>`:''}`;
   }else if(view.screen==='professionals'){
     subtitle='Trova il professionista e apri le sue consegne';
     const q=view.query.toLocaleLowerCase('it');
     const rows=snapshot.complete?pros().filter(p=>[p.label,p.role].join(' ').toLocaleLowerCase('it').includes(q)&&(!view.sectorId||p.sectorIds.includes(view.sectorId))):pros();
     body=`${controls()}<div class="hub-sectors">${rows.map(p=>`<button class="hub-sector" data-action="professional" data-id="${esc(p.id)}">${icon('user')}<span><strong>${esc(p.label)}</strong><small>${esc(p.role)}</small></span>${badge(snapshot.complete?filterItems(items(),{professionalId:p.id,area:view.area,sectorId:view.sectorId}).length:p.itemCount)}</button>`).join('')||'<p class="hub-empty">Nessun professionista nei filtri selezionati.</p>'}</div>`;
   }else if(view.screen==='patients'){
     subtitle='Trova il paziente e apri le sue consegne';
     body=`${controls()}<div class="hub-sectors">${pats().map(p=>`<button class="hub-sector" data-action="patient" data-id="${esc(p.id)}">${icon('user')}<span><strong>${esc(p.label)}</strong><small>${esc(p.role)}</small></span>${badge(p.itemCount)}</button>`).join('')||'<p class="hub-empty">Nessun paziente nei filtri selezionati.</p>'}</div>`;
   }else if(view.screen==='tools'){
     subtitle='Filtri e funzioni trasversali, senza perdere le consegne precedenti';
     body=`<div class="hub-states">${TOOLS.map(t=>tile(t,snapshot.complete?uniqueItems(items()).filter(i=>matchesTool(i,t.id,{today:snapshot.today,userId:snapshot.userId,now:snapshot.now})).length:snapshot.summary?.tools?.[t.id],'tool')).join('')}</div><p class="hub-notice">Queste viste non limitano l’archivio generale alla sola giornata corrente.</p>`;
   }else if(view.screen==='detail'){
     const candidate=snapshot.complete?uniqueItems(items()).find(i=>sourceKey(i)===view.itemKey):snapshot.detail;
     const i=candidate&&sourceKey(candidate)===view.itemKey?candidate:null;
     subtitle='Dettaglio della consegna';
     body=i?`<h2 class="hub-section-title">${esc(i.title)}</h2><div class="hub-tags"><span class="hub-tag">${esc(workflowLabel(i))}</span>${i.priority==='urgent'?'<span class="hub-tag urgent">Urgente</span>':''}</div><dl class="hub-detail-grid">${[['Settore',SECTORS.find(s=>s.id===i.sectorId)?.title||'Da classificare'],['Paziente',i.patientLabel||'—'],['Professionista collegato',(i.professionalLabels||[]).join(', ')||'Da collegare'],['Riferimento',i.referenceLabel||'Da collegare'],['Scadenza',dateLabel(i.dueAt)],['Prossima azione',i.nextAction||'Da definire'],['Ricontatto',dateLabel(i.nextContactAt)]].map(([k,v])=>`<div class="hub-kv"><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl><h3>Dettagli operativi</h3><p class="hub-meta">${esc(i.description||'Nessun dettaglio aggiuntivo.')}</p><div class="hub-list-actions"><button class="hub-button primary" data-action="source">Apri gestione completa</button><button class="hub-button" data-action="link-patient">🔍 Cerca paziente</button><button class="hub-button" data-action="assignment" ${i.assignmentRef?'':'disabled'}>Apri incarico collegato</button>${i.sectorId==='da-classificare'?'<button class="hub-button" data-action="set-sector">Classifica settore</button>':''}</div><p class="hub-notice">Stati, attese, storico e allegati restano collegati alla lavorazione originale. Aprire questa schermata non la completa.</p>`:'<p class="hub-empty">Consegna non disponibile o accesso non autorizzato.</p>';
   }
   root.classList.add('consegne-hub');
   root.innerHTML=`<div class="hub-frame"><header class="hub-top"><h1 class="hub-title" tabindex="-1">${icon('clipboard')}CONSEGNE</h1><span class="hub-brand">Abbraccio</span></header>${view.screen!=='home'?`<button class="hub-button hub-back" data-action="back">${icon('back')}Indietro</button><p class="hub-crumb">Consegne${sector?' / '+esc(sector.title):''}${professional?' / '+esc(professional.label):''}</p>`:''}<p class="hub-subtitle">${esc(subtitle)}</p>${snapshot.loading?'<p class="hub-loading" role="status">Caricamento aggiornato…</p>':snapshot.error?`<p class="hub-error" role="alert">${esc(snapshot.error)}</p><button class="hub-button" data-action="retry">Riprova</button>`:body}</div>`;
   if(focus){const h=root.querySelector('h1');h?.focus({preventScroll:true});h?.scrollIntoView({block:'start',behavior:'auto'});}
 }
 function click(e){
   const b=e.target.closest('[data-action]');if(!b||!root.contains(b)||b.disabled)return;
   const a=b.dataset.action,id=b.dataset.id;
   if(a==='back')return back();
   if(a==='sector')return go({screen:'sector',sectorId:id,professionalId:null,patientId:null,query:'',status:'tutte'});
   if(a==='extra')return go({screen:'extra',sectorId:null,professionalId:null,patientId:null});
   if(a==='status')return go({screen:'list',status:id});
   if(a==='tool')return go({screen:'tool-list',tool:id,status:'tutte',sectorId:null,professionalId:null,patientId:null});
   if(a==='professionals')return go({screen:'professionals',query:'',professionalId:null,patientId:null});
   if(a==='professional')return go({screen:'professional',professionalId:id,patientId:null,status:'tutte',query:''});
   if(a==='patients')return go({screen:'patients',query:'',patientId:null,patientName:null,professionalId:null});
   if(a==='patient'){const p=pats().find(x=>x.id===id);return go({screen:'patient',patientId:id,patientName:p?.label||'',professionalId:null,status:'tutte',query:''});}
   if(a==='tools')return go({screen:'tools',sectorId:null,professionalId:null});
   if(a==='detail')return go({screen:'detail',itemKey:id});
   options.onAction?.({action:a,view:{...view},itemKey:view.itemKey});
 }
 function submit(e){if(e.target.dataset.form!=='filters')return;e.preventDefault();const data=new FormData(e.target);go({query:String(data.get('query')||''),area:String(data.get('area')||'all')},{push:false});}
 root.addEventListener('click',click);root.addEventListener('submit',submit);render();
 return {
   update(next){options={...options,...next};snapshot=next.snapshot||snapshot;if(next.view)view=normalizeView(next.view);render();},
   destroy(){destroyed=true;root.removeEventListener('click',click);root.removeEventListener('submit',submit);root.replaceChildren();},
 };
}
