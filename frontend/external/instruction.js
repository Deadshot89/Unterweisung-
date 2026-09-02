const API_BASE_URL = String(window.UM_API_BASE_URL || '').replace(/\/$/, '');
    function apiUrl(path){ const cleanPath = String(path || '').startsWith('/') ? path : '/' + path; return API_BASE_URL ? API_BASE_URL + cleanPath : cleanPath; }
    const params = new URLSearchParams(location.search);
    const token = params.get('t');
    const box = document.getElementById('box');
    let current = null;
    const startedAt = Date.now();
    function esc(s=''){return String(s??'').replace(/[&<>\"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]))}
    function fmtDate(d){return d ? new Date(d).toLocaleDateString('de-DE') : '—'}
    function langText(key){
      const l=current?.language||'de';
      const t={
        confirm:{de:'Ich bestätige, dass ich die Unterweisung gelesen, verstanden und den Inhalt beachtet habe.',en:'I confirm that I have read and understood the instruction and will follow the content.',pl:'Potwierdzam, że przeczytałem/przeczytałam i zrozumiałem/zrozumiałam instruktaż oraz będę stosować jego treść.'},
        complete:{de:'Unterweisung abschließen',en:'Complete instruction',pl:'Zakończ instruktaż'},
        questions:{de:'Wissenstest',en:'Knowledge test',pl:'Test wiedzy'},
        content:{de:'Unterweisung lesen',en:'Read instruction',pl:'Przeczytaj instruktaż'},
        template:{de:'Unterlage in neuem Fenster öffnen',en:'Open material in a new window',pl:'Otwórz materiał w nowym oknie'},
        noQuestions:{de:'Für diese Unterweisung sind aktuell keine Testfragen hinterlegt. Es wird nur die Bestätigung gespeichert.',en:'There are currently no test questions for this instruction. Only the confirmation will be saved.',pl:'Obecnie nie ma pytań testowych do tego instruktażu. Zapisane zostanie tylko potwierdzenie.'},
        checklist:{de:'Vor dem Abschluss prüfen',en:'Check before completing',pl:'Sprawdź przed zakończeniem'},
        step1:{de:'1. Lesen',en:'1. Read',pl:'1. Czytaj'},
        step2:{de:'2. Unterlage prüfen',en:'2. Review material',pl:'2. Sprawdź materiał'},
        step3:{de:'3. Fragen beantworten',en:'3. Answer questions',pl:'3. Odpowiedz'},
        step4:{de:'4. Abschließen',en:'4. Complete',pl:'4. Zakończ'}
      };
      return t[key]?.[l] || t[key]?.de || key;
    }
    function optionText(o){ return typeof o === 'object' && o ? (o.text ?? '') : o; }
    function optionValue(o,i){ return typeof o === 'object' && o && Number.isFinite(Number(o.answerIndex)) ? Number(o.answerIndex) : i; }
    function buildContentHtml(text){
      const raw = String(text || '').trim();
      if(!raw) return '<p class="muted">Für diese Unterweisung ist noch kein Beschreibungstext hinterlegt. Bitte die geöffnete Schulungsunterlage vollständig lesen.</p>';
      return raw.split(/\n\s*\n/).map(paragraph=>`<p style="white-space:pre-wrap">${esc(paragraph)}</p>`).join('');
    }
    async function load(){
      if(!token){ box.innerHTML='<div class="big-error"><h1>Kein gültiger Link</h1><p>Der Unterweisungslink fehlt oder ist beschädigt.</p></div>'; return; }
      const res = await fetch(apiUrl('/api/external/' + encodeURIComponent(token)), {mode:'cors'});
      const data = await res.json();
      if(!res.ok){ box.innerHTML='<div class="big-error"><h1>Link nicht verfügbar</h1><p>'+esc(data.error||'Fehler')+'</p></div>'; return; }
      current=data;
      renderInstruction();
    }
    function renderInstruction(){
      const questions = current.questions || [];
      const showPdf = !!current.templateUrl;
      box.className = '';
      box.innerHTML = `<div class="external-shell">
        <section class="hero">
          <h1>${esc(current.instructionName)}</h1>
          <p>${esc(current.companyName||'')} · ${esc(current.recipientName||current.email||'')} <span class="lang-chip">${esc((current.language||'de').toUpperCase())}</span></p>
          <p>Link gültig bis: <b>${fmtDate(current.expiresAt)}</b>${current.testRequired?` · Bestehen ab <b>${esc(current.passPercent||80)} %</b>`:''}</p>
          <div class="stepbar"><div class="step-pill">${langText('step1')}<small>${langText('content')}</small></div><div class="step-pill">${langText('step2')}<small>${esc(current.templateTitle||'PDF / Vorlage')}</small></div><div class="step-pill">${langText('step3')}<small>${questions.length} Fragen</small></div><div class="step-pill">${langText('step4')}<small>Nachweis speichern</small></div></div>
        </section>
        <section class="reader-grid">
          <div class="panel">
            <h2>${langText('content')}</h2>
            <div class="content-card">${buildContentHtml(current.description)}</div>
            ${showPdf?`<div class="template-actions"><a class="btn primary" href="${esc(current.templateUrl)}" target="_blank" rel="noopener">${langText('template')}</a></div>`:''}
            <h3>${langText('checklist')}</h3>
            <div class="read-checklist">
              <label><input type="checkbox" class="readCheck"> Ich habe die Schulungsunterlage geöffnet bzw. den Inhalt geprüft.</label>
              <label><input type="checkbox" class="readCheck"> Ich kenne die wichtigsten Regeln und weiß, was im Arbeitsbereich zu beachten ist.</label>
              <label><input type="checkbox" class="readCheck"> Ich weiß, dass ich bei Unsicherheit den Vorgesetzten / Line Manager fragen muss.</label>
            </div>
            <div class="locked-note">Der Abschluss wird erst gespeichert, wenn alle Prüfpunkte bestätigt und alle Fragen beantwortet sind.</div>
          </div>
          <aside class="panel">
            <h2>Schulungsunterlage</h2>
            ${showPdf?`<iframe class="pdf-frame" src="${esc(current.templateUrl)}" title="Schulungsunterlage"></iframe><div class="template-actions"><a class="btn ghost" href="${esc(current.templateUrl)}" target="_blank" rel="noopener">PDF groß öffnen</a></div>`:`<div class="notice2">Keine PDF-Unterlage verknüpft. Bitte den Text links vollständig lesen.</div>`}
          </aside>
        </section>
        <section class="panel">
          <h2>${langText('questions')}</h2>
          <div class="progress"><span id="progressBar"></span></div>
          <p class="muted" id="progressText">0 / ${questions.length} beantwortet</p>
          <div id="questionsBox">${questions.length ? questions.map(renderQuestion).join('') : `<p class="muted">${langText('noQuestions')}</p>`}</div>
        </section>
        <section class="panel">
          <label class="confirm-box"><input type="checkbox" id="confirm"> ${langText('confirm')}</label>
          <div class="actions-sticky"><button class="primary complete-btn" id="completeInstruction">${langText('complete')}</button></div>
        </section>
      </div>`;
      document.querySelectorAll('input[type="radio"]').forEach(i=>i.addEventListener('change',updateProgress));
      updateProgress();
    }
    function renderQuestion(q,idx){
      const letters = ['A','B','C','D','E','F'];
      return `<div class="question"><h3>${idx+1}. ${esc(q.question)}</h3>${(q.options||[]).map((o,i)=>`<label class="answer"><input type="radio" name="q_${esc(q.id)}" value="${esc(optionValue(o,i))}"><span class="answer-letter">${letters[i]||String(i+1)}</span><span>${esc(optionText(o))}</span></label>`).join('')}</div>`;
    }
    function updateProgress(){
      const questions=current?.questions||[];
      const answered=questions.filter(q=>document.querySelector(`input[name="q_${CSS.escape(q.id)}"]:checked`)).length;
      const pct=questions.length?Math.round(answered/questions.length*100):100;
      const bar=document.getElementById('progressBar'); if(bar) bar.style.width=pct+'%';
      const text=document.getElementById('progressText'); if(text) text.textContent=`${answered} / ${questions.length} beantwortet`;
    }
    function collectAnswers(){
      return (current.questions||[]).map(q=>{
        const checked=document.querySelector(`input[name="q_${CSS.escape(q.id)}"]:checked`);
        return checked ? {questionId:q.id, answerIndex:Number(checked.value)} : null;
      }).filter(Boolean);
    }
    function renderResult(data){
      const questionCount = data.questionCount ?? (current.questions || []).length;
      const correctCount = data.correctCount ?? null;
      const wrongCount = data.wrongCount ?? null;
      const score = data.scorePercent ?? null;
      if(data.passed===false){
        box.innerHTML = `<div class="result-bad"><h1>Test nicht bestanden</h1><p>Bitte lies die Unterweisung noch einmal sorgfältig und wiederhole den Test.</p><div class="score-grid"><div class="score-card"><span>Ergebnis</span><b>${esc(score)} %</b></div><div class="score-card"><span>Benötigt</span><b>${esc(data.passPercent)} %</b></div><div class="score-card"><span>Richtig</span><b>${correctCount ?? '—'}</b></div><div class="score-card"><span>Falsch</span><b>${wrongCount ?? '—'}</b></div></div><p class="muted">Beantwortete Fragen: ${esc(questionCount)}</p></div>`;
        return;
      }
      box.innerHTML = `<div class="result-ok"><h1>Unterweisung abgeschlossen</h1><p>Der Abschluss wurde gespeichert und ist ab sofort in der Admin-Website sichtbar.</p><div class="score-grid"><div class="score-card"><span>Ergebnis</span><b>${score === null ? 'Bestätigt' : esc(score) + ' %'}</b></div><div class="score-card"><span>Richtig</span><b>${correctCount ?? '—'}</b></div><div class="score-card"><span>Falsch</span><b>${wrongCount ?? '—'}</b></div><div class="score-card"><span>Gültig bis</span><b>${esc(data.validUntil || '—')}</b></div></div><p>Du kannst das Fenster jetzt schließen.</p></div>`;
    }
    async function complete(){
      if(!document.getElementById('confirm')?.checked) return alert('Bitte Bestätigung anhaken.');
      const readChecks=[...document.querySelectorAll('.readCheck')];
      if(readChecks.some(c=>!c.checked)) return alert('Bitte zuerst alle Punkte unter "Vor dem Abschluss prüfen" bestätigen.');
      const questions=current.questions||[];
      const answers=collectAnswers();
      if(current.testRequired && questions.length && answers.length !== questions.length) return alert('Bitte alle Testfragen beantworten.');
      const button = document.querySelector('.complete-btn');
      if(button){ button.disabled = true; button.textContent = 'Wird gespeichert ...'; }
      const res = await fetch(apiUrl('/api/external/' + encodeURIComponent(token)), {method:'POST',headers:{'Content-Type':'application/json'},mode:'cors',body:JSON.stringify({confirmed:true,answers,durationMinutes:Math.max(1,Math.round((Date.now()-startedAt)/60000)),confirmationText:langText('confirm')})});
      const data = await res.json();
      if(!res.ok){ if(button){ button.disabled = false; button.textContent = langText('complete'); } return alert(data.error||'Fehler'); }
      renderResult(data);
    }
    box.addEventListener('click',event=>{if(event.target.closest('#completeInstruction')) complete();});
    load();
