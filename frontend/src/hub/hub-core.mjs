/** Modello di VISTA proposto. Adattare i modelli reali sul server.
 * Nessun dato clinico, nessuna richiesta di rete e nessuna scrittura qui.
 */
export const PRIMARY_SECTORS = [
  {id:'infermieristiche-strumentali',title:'Consegne Infermieristiche e Strumentali',description:'Prestazioni infermieristiche e diagnostiche',icon:'pulse'},
  {id:'oss',title:'Consegne Assistenza OSS',description:'Assistenza sociosanitaria domiciliare',icon:'users'},
  {id:'badanti',title:'Consegne Assistenza Badanti',description:'Assistenza familiare e badanti',icon:'home'},
];
export const EXTRA_SECTORS = [
  {id:'medici',title:'Consegne Medici e Specialisti',description:'Visite e incarichi medici',icon:'medical'},
  {id:'riabilitazione',title:'Consegne Riabilitazione',description:'Fisioterapisti e professionisti della riabilitazione',icon:'activity'},
  {id:'altri',title:'Altri professionisti',description:'Ulteriori qualifiche configurate nel gestionale',icon:'users'},
  {id:'backoffice',title:'Consegne Amministrative',description:'Documenti, incassi e attività di back office',icon:'folder'},
  {id:'da-classificare',title:'Da classificare',description:'Consegne esistenti senza settore confermato',icon:'alert'},
];
export const SECTORS=[...PRIMARY_SECTORS,...EXTRA_SECTORS];
export const STATUS_TILES = [
  {id:'tutte',label:'Tutte',icon:'list'}, {id:'nuove',label:'Nuove',icon:'inbox'},
  {id:'in-corso',label:'In corso',icon:'clock'}, {id:'da-ricontattare',label:'Da ricontattare',icon:'phone'},
  {id:'chiuse',label:'Chiuse',icon:'check'}, {id:'non-interessati',label:'Non interessati',icon:'x'},
  {id:'urgenti',label:'Urgenti',icon:'alert'},
];
export const TOOLS=[
  {id:'oggi',label:'Da fare oggi',icon:'calendar'},
  {id:'da-prendere',label:'Da iniziare',icon:'inbox'}, {id:'scadute',label:'Scadute',icon:'clock'},
  {id:'attesa',label:'In attesa di risposta',icon:'clock'},
  {id:'ricontatti',label:'Ricontatti',icon:'phone'}, {id:'aperte',label:'Tutte aperte',icon:'list'},
];
export function sourceKey(item){return `${item.source}:${item.id}`;}
export function isOpen(item){return !['closed','cancelled'].includes(item.workflow);}
export function isUrgent(item){return isOpen(item)&&item.priority==='urgent';}
export function matchesStatus(item,status){
  switch(status){
    case 'tutte': return true;
    case 'nuove': return item.workflow==='new';
    case 'in-corso': return item.workflow==='active';
    case 'da-ricontattare': return isOpen(item)&&item.followUpRequired===true;
    case 'chiuse': return ['closed','cancelled'].includes(item.workflow)&&!(item.outcome==='not-interested'&&item.commercial===true);
    case 'non-interessati': return item.workflow==='closed'&&item.outcome==='not-interested'&&item.commercial===true;
    case 'urgenti': return isUrgent(item);
    default: return false;
  }
}
/** canonicalId deve essere il legame CERTO già verificato tra le fonti.
 * In assenza di tale legame si deduplica solo source:id, MAI per titolo/nome.
 * L'adattatore aggrega e conserva tutti i riferimenti della lavorazione.
 */
export function uniqueItems(items){
  const map=new Map();
  for(const item of items){
    const key=item.canonicalId?`canonical:${item.canonicalId}`:sourceKey(item);
    const refs=item.sourceRefs||[{source:item.source,id:item.id}];
    if(!map.has(key)) {map.set(key,{...item,sourceRefs:[...refs]});continue;}
    const prev=map.get(key);
    const refMap=new Map([...prev.sourceRefs,...refs].map(r=>[`${r.source}:${r.id}`,r]));
    // Le proprietà di stato dell'aggregato devono essere già riconciliate
    // dall'adattatore server. Non scegliere automaticamente lo stato più nuovo.
    map.set(key,{...prev,sourceRefs:[...refMap.values()]});
  }
  return [...map.values()];
}
export function filterItems(items,{sectorId=null,professionalId=null,status='tutte',query='',area='all'}={}){
  const q=query.trim().toLocaleLowerCase('it');
  return uniqueItems(items).filter(i=>(!sectorId||i.sectorId===sectorId)
    &&(!professionalId||(i.professionalIds||[]).includes(professionalId))
    &&(area==='all'||i.area===area)&&matchesStatus(i,status)
    &&(!q||[i.title,i.referenceLabel,...(i.professionalLabels||[])].filter(Boolean).join(' ').toLocaleLowerCase('it').includes(q)));
}
export function countStatuses(items,filter={}){
  return Object.fromEntries(STATUS_TILES.map(s=>[s.id,filterItems(items,{...filter,status:s.id}).length]));
}
export function dateInRome(value){
  if(!value)return null;
  if(/^\d{4}-\d{2}-\d{2}$/.test(value))return value;
  const d=new Date(value);if(!Number.isFinite(d.getTime()))return null;
  const p=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Rome',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(d);
  const v=t=>p.find(x=>x.type===t)?.value;
  return `${v('year')}-${v('month')}-${v('day')}`;
}
export function matchesTool(item,tool,{today,now=Date.now()}={}){
  switch(tool){
    case 'oggi':return isOpen(item)&&[item.dueAt,item.nextContactAt,item.waitCheckAt].some(d=>dateInRome(d)===today);
    case 'da-prendere':return isOpen(item)&&item.workflow==='new';
    case 'scadute':{
      if(!isOpen(item)||!item.dueAt)return false;
      if(/^\d{4}-\d{2}-\d{2}$/.test(item.dueAt))return item.dueAt<today;
      const date=Date.parse(item.dueAt);return Number.isFinite(date)&&date<now;
    }
    case 'attesa':return isOpen(item)&&item.workflow==='waiting';
    case 'ricontatti':return isOpen(item)&&item.followUpRequired===true;
    case 'aperte':return isOpen(item);
    default:return false;
  }
}
export function normalizeView(view={}){
  const allowed=['home','extra','sector','list','professionals','professional','patients','patient','detail','tools','tool-list','registro'];
  const screen=allowed.includes(view.screen)?view.screen:'home';
  return {screen,sectorId:SECTORS.some(s=>s.id===view.sectorId)?view.sectorId:null,status:STATUS_TILES.some(s=>s.id===view.status)?view.status:'tutte',professionalId:view.professionalId||null,patientId:view.patientId||null,patientName:view.patientName||'',itemKey:view.itemKey||null,tool:TOOLS.some(t=>t.id===view.tool)?view.tool:null,query:view.query||'',area:view.area||'all'};
}
