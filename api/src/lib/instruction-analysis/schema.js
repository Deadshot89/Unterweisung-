export const SAFETY_CATEGORIES=Object.freeze({
  scope:'Bestimmungsgemäße Verwendung und Einsatzgrenzen',qualification:'Berechtigung und Qualifikation',
  pre_use:'Kontrollen vor Arbeitsbeginn',normal_operation:'Sicherer Arbeitsablauf',
  ppe:'Persönliche Schutzausrüstung',mechanical:'Mechanische Gefahren und Schutzvorrichtungen',
  electrical:'Elektrische Gefahren und gespeicherte Energie',substances:'Gefahrstoffe, Brand und Explosion',
  environment:'Arbeitsumgebung, Verkehrswege und Dritte',malfunctions:'Störungen, Mängel und Stillsetzen',
  emergencies:'Notfälle und Erste Hilfe',maintenance:'Reinigung, Wartung und Instandhaltung',
  shutdown:'Abstellen und Schutz gegen unbefugte Nutzung',device_specific:'Weitere geräte- oder themenspezifische Gefahren'
});
const string={type:'string'},integer={type:'integer'};
const list=items=>({type:'array',items});
const object=properties=>({type:'object',properties,required:Object.keys(properties),additionalProperties:false});
const evidence=list(object({page:integer,quote:string}));
export const ANALYSIS_SCHEMA=object({
  topic:string,device:string,language:{type:'string',enum:['de','en','pl']},readingStatus:{type:'string',enum:['complete','partial','unreadable']},
  pages:list(object({page:integer,status:{type:'string',enum:['read','blank','unreadable']},note:string})),
  sections:list(object({title:string,body:string,aspectIds:list(string),sourcePages:list(integer)})),
  aspects:list(object({id:string,category:{type:'string',enum:Object.keys(SAFETY_CATEGORIES)},label:string,status:{type:'string',enum:['covered','missing','unclear','not_applicable']},explanation:string,evidence})),
  questions:list(object({aspectId:string,question:string,options:list(string),correctIndex:integer,explanation:string,evidence})),
  missingInformation:list(string)
});
function ensure(condition,message){if(!condition){const e=new Error(message);e.code='invalid_analysis';e.status=422;throw e;}}
function text(value,max=10000){return typeof value==='string' && value.trim().length>0 && value.length<=max;}
function array(value,max=200){return Array.isArray(value) && value.length<=max;}
export function validateAnalysis(data,{pageCount,language}) {
  ensure(data && text(data.topic,240) && typeof data.device==='string' && data.device.length<=500,'Thema fehlt oder ist ungültig.');
  ensure(data.language===language && ['complete','partial','unreadable'].includes(data.readingStatus),'Sprache oder Lesestatus ungültig.');
  ensure(array(data.pages,50) && array(data.sections,150) && array(data.aspects,100) && array(data.questions,100) && array(data.missingInformation,100),'Analyse ist unvollständig oder zu umfangreich.');
  ensure(Number.isInteger(pageCount) && pageCount>=1 && pageCount<=50,'Seitenanzahl ungültig.');
  const blockers=[];const pages=new Map();
  for(const p of data.pages){ensure(Number.isInteger(p.page)&&p.page>=1&&p.page<=pageCount&&!pages.has(p.page)&&['read','blank','unreadable'].includes(p.status)&&typeof p.note==='string','Seitenangaben ungültig.');pages.set(p.page,p.status);}
  if(pages.size!==pageCount || data.readingStatus!=='complete' || [...pages.values()].some(s=>s==='unreadable')) blockers.push('Nicht alle Seiten wurden vollständig gelesen.');
  if(![...pages.values()].includes('read')) blockers.push('Keine lesbaren fachlichen Inhalte erkannt.');
  const checkEvidence=refs=>{ensure(array(refs,30),'Quellenangaben ungültig.');for(const ref of refs) ensure(Number.isInteger(ref.page)&&pages.get(ref.page)==='read'&&text(ref.quote,1200),'Quelle fehlt oder verweist auf eine ungelesene Seite.');};
  const aspects=new Map();
  for(const a of data.aspects){
    ensure(text(a.id,80)&&!aspects.has(a.id)&&Object.hasOwn(SAFETY_CATEGORIES,a.category)&&text(a.label,240)&&text(a.explanation,2500)&&['covered','missing','unclear','not_applicable'].includes(a.status),'Sicherheitsaspekt ungültig.');
    checkEvidence(a.evidence);if(a.status==='covered') ensure(a.evidence.length>0,'Abgedeckter Aspekt ohne Fundstelle.');
    if(a.status==='not_applicable') ensure(a.explanation.trim().length>=20,'Nicht anwendbar benötigt eine nachvollziehbare Begründung.');
    if(['missing','unclear'].includes(a.status)) blockers.push(`${a.label}: ${a.status==='missing'?'Angaben fehlen':'Angaben unklar'}`);
    aspects.set(a.id,a);
  }
  for(const category of Object.keys(SAFETY_CATEGORIES)) if(!data.aspects.some(a=>a.category===category)) blockers.push(`${SAFETY_CATEGORIES[category]} wurde nicht bewertet.`);
  const described=new Set(),tested=new Set(),seenQuestions=new Set();
  for(const section of data.sections){
    ensure(text(section.title,240)&&text(section.body,20000)&&array(section.aspectIds,100)&&array(section.sourcePages,50)&&section.sourcePages.length>0,'Unterweisungsabschnitt ungültig.');
    ensure(section.sourcePages.every(page=>pages.get(page)==='read'),'Abschnitt ohne lesbare Quellseite.');
    for(const id of section.aspectIds){ensure(aspects.get(id)?.status==='covered','Abschnitt enthält einen unbelegten Aspekt.');described.add(id);}
  }
  for(const q of data.questions){
    ensure(aspects.get(q.aspectId)?.status==='covered'&&text(q.question,2000)&&text(q.explanation,2500),'Frage ist nicht durch einen abgedeckten Aspekt begründet.');
    ensure(array(q.options,4)&&q.options.length===4&&q.options.every(o=>text(o,600))&&new Set(q.options.map(o=>o.trim().toLowerCase())).size===4,'Jede Frage braucht vier unterschiedliche Antworten.');
    ensure(Number.isInteger(q.correctIndex)&&q.correctIndex>=0&&q.correctIndex<4,'Richtige Antwort ungültig.');
    ensure(!seenQuestions.has(q.question.trim().toLowerCase()),'Doppelte Frage.');seenQuestions.add(q.question.trim().toLowerCase());
    checkEvidence(q.evidence);ensure(q.evidence.length>0,'Frage ohne Fundstelle.');tested.add(q.aspectId);
  }
  for(const aspect of aspects.values()) if(aspect.status==='covered') {
    if(!described.has(aspect.id)) blockers.push(`${aspect.label}: Unterweisungstext fehlt.`);
    if(!tested.has(aspect.id)) blockers.push(`${aspect.label}: Testfrage fehlt.`);
  }
  for(const missing of data.missingInformation){ensure(text(missing,2500),'Fehlende Quellenangabe ungültig.');blockers.push(missing);}
  if(!data.questions.length || !data.sections.length) blockers.push('Unterweisungstext und Testfragen werden benötigt.');
  return {data,publishable:blockers.length===0,blockers:[...new Set(blockers)],coverage:{aspects:aspects.size,covered:data.aspects.filter(a=>a.status==='covered').length,questions:data.questions.length,pagesRead:[...pages.values()].filter(s=>s==='read').length,pageCount}};
}
export function instructionText(data){return data.sections.map(section=>`${section.title}\n${section.body}`).join('\n\n');}
