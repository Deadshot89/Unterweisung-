const API_BASE_URL=String(window.UM_API_BASE_URL||'').replace(/\/$/,'');
const params=new URLSearchParams(location.search);const token=params.get('t');const box=document.getElementById('box');const renderer=globalThis.UMLearningExperience;
const session={data:null,stepIndex:0,startedAt:Date.now()};
function apiUrl(path){const clean=String(path||'').startsWith('/')?path:'/'+path;return API_BASE_URL?API_BASE_URL+clean:clean;}
function esc(value=''){return renderer?.escapeHtml?renderer.escapeHtml(value):String(value??'');}
function fmtDate(value){return value?new Date(value).toLocaleDateString('de-DE'):'—';}
function optionValue(option,index){return typeof option==='object'&&option&&Number.isFinite(Number(option.answerIndex))?Number(option.answerIndex):index;}

async function load(){
  if(!token){renderError('Kein gültiger Link','Der Unterweisungslink fehlt oder ist beschädigt.');return;}
  try{const res=await fetch(apiUrl('/api/external/'+encodeURIComponent(token)),{mode:'cors'});const data=await res.json();if(!res.ok)throw new Error(data.error||'Unterweisung konnte nicht geladen werden.');session.data=data;session.stepIndex=0;render();}
  catch(error){renderError('Link nicht verfügbar',error.message||error);}
}
function renderError(title,text){box.className='';box.innerHTML=`<div class="big-error"><h1>${esc(title)}</h1><p>${esc(text)}</p></div>`;}
function progress(){const data=session.data;if(!data)return 0;const total=Math.max(1,(data.steps?.length||0)+1);return Math.min(100,Math.round(session.stepIndex/total*100));}
function hero(){const d=session.data;return `<section class="hero"><span class="lang-chip">${esc((d.language||'de').toUpperCase())}</span><h1>${esc(d.instructionName)}</h1><p>${esc(d.companyName||'')} · ${esc(d.recipientName||d.email||'')}</p><p>Link gültig bis <b>${fmtDate(d.expiresAt)}</b>${d.testRequired?` · Bestehen ab <b>${esc(d.passPercent||80)} %</b>`:''}</p><div class="progress"><span style="width:${progress()}%"></span></div></section>`;}
function originalAction(){const d=session.data;return d.templateUrl?`<a class="btn ghost" href="${esc(d.templateUrl)}" target="_blank" rel="noopener">Originalunterlage öffnen</a>`:'';}
function render(){
  const d=session.data;if(!d||!renderer)return;const steps=d.steps||[];const step=steps[session.stepIndex];let content='';let actions='';
  if(step){
    content=renderer.renderLearningStep({instruction:{name:d.instructionName,learningGoal:d.learningGoal,learningIntro:d.learningIntro,keyPoints:d.keyPoints||[],description:d.description},step:{...step,imageCaption:step.imageCaption||'',calloutTitle:step.calloutTitle||'',calloutText:step.calloutText||''},index:session.stepIndex,total:steps.length});
    actions=`<div class="learning-actions"><div class="learning-actions-group">${originalAction()}</div><div class="learning-actions-group"><button class="ghost" id="extPrev" ${session.stepIndex===0?'disabled':''}>Zurück</button><button class="primary" id="extNext">${session.stepIndex===steps.length-1?'Zum Abschluss':'Weiter'}</button></div></div>`;
  }else{
    const test=d.testRequired?renderer.renderQuestionList({questions:d.questions||[],passPercent:d.passPercent||80,namePrefix:'externalQuestion'}):`<section class="um-test-stage"><header class="um-test-head"><span>Abschluss</span><h3>Unterweisung bestätigen</h3><p>Du hast alle Lernschritte durchlaufen.</p></header></section>`;
    content=`${test}<section class="panel external-confirm"><label class="confirm-box"><input type="checkbox" id="confirm"> Ich bestätige, dass ich die Unterweisung vollständig durchlaufen und verstanden habe.</label></section>`;
    actions=`<div class="learning-actions"><div class="learning-actions-group"><button class="ghost" id="extPrev">Zurück zu den Lerninhalten</button>${originalAction()}</div><div class="learning-actions-group"><button class="primary complete-btn" id="extComplete">Unterweisung abschließen</button></div></div>`;
  }
  box.className='';box.innerHTML=`<div class="external-shell">${hero()}<section class="panel external-learning-panel">${content}${actions}</section></div>`;
  document.querySelector('.um-learning-image')?.addEventListener('click',event=>zoomImage(event.currentTarget.src));
  document.getElementById('extPrev')?.addEventListener('click',()=>{session.stepIndex=Math.max(0,session.stepIndex-1);render();});
  document.getElementById('extNext')?.addEventListener('click',()=>{session.stepIndex=Math.min(steps.length,session.stepIndex+1);render();});
  document.getElementById('extComplete')?.addEventListener('click',complete);
}
function zoomImage(src){if(!src)return;document.body.insertAdjacentHTML('beforeend',`<div class="learning-image-modal" role="dialog" aria-modal="true" onclick="this.remove()"><img src="${esc(src)}" alt="Vergrößerte Lernabbildung"></div>`);}
function collectAnswers(){const d=session.data;return(d.questions||[]).map(q=>{const checked=document.querySelector(`input[name="externalQuestion_${CSS.escape(String(q.id))}"]:checked`);if(!checked)return null;const optionIndex=Number(checked.value);return{questionId:q.id,answerIndex:optionValue((q.options||[])[optionIndex],optionIndex)};}).filter(Boolean);}
async function complete(){
  const d=session.data;if(!document.getElementById('confirm')?.checked){alert('Bitte bestätige zuerst den Abschluss der Unterweisung.');return;}const answers=collectAnswers();if(d.testRequired&&(d.questions||[]).length&&answers.length!==(d.questions||[]).length){alert('Bitte alle Testfragen beantworten.');return;}
  const button=document.getElementById('extComplete');if(button){button.disabled=true;button.textContent='Abschluss wird gespeichert …';}
  try{const res=await fetch(apiUrl('/api/external/'+encodeURIComponent(token)),{method:'POST',headers:{'Content-Type':'application/json'},mode:'cors',body:JSON.stringify({confirmed:true,answers,durationMinutes:Math.max(1,Math.round((Date.now()-session.startedAt)/60000)),confirmationText:'Teilnehmer hat die Unterweisung vollständig durchlaufen und digital bestätigt.'})});const result=await res.json();if(!res.ok)throw new Error(result.error||'Abschluss fehlgeschlagen.');renderResult(result);}
  catch(error){if(button){button.disabled=false;button.textContent='Unterweisung abschließen';}alert(error.message||error);}
}
function renderResult(result){
  const d=session.data;const passed=result.passed!==false;const content=renderer.renderResult({passed,scorePercent:d.testRequired?(result.scorePercent??0):null,passPercent:d.passPercent||80,validUntil:result.validUntil?fmtDate(result.validUntil):''});
  const action=passed?'<p class="muted">Der Abschluss wurde gespeichert. Dieses Fenster kann jetzt geschlossen werden.</p>':'<button class="primary" id="extRetry">Lerninhalte erneut ansehen</button>';
  box.className='';box.innerHTML=`<div class="external-shell">${hero()}<section class="panel external-learning-panel">${content}${action}</section></div>`;
  document.getElementById('extRetry')?.addEventListener('click',()=>{session.stepIndex=0;render();});
}
load();