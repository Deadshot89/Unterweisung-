(function(root){
  const escapeHtml = (value='') => String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const renderKeyPoints = items => Array.isArray(items) && items.length
    ? `<section class="um-learning-keypoints"><h4>Wichtige Merkpunkte</h4><ul>${items.map(item=>`<li>${escapeHtml(item)}</li>`).join('')}</ul></section>`
    : '';
  function renderLearningStep({instruction={},step={},index=0,total=1}) {
    const goal = instruction.learningGoal || instruction.description || '';
    const intro = instruction.learningIntro || instruction.intro || '';
    return `<article class="um-learning-stage"><header class="um-learning-context"><span class="um-learning-step-count">Schritt ${index+1} von ${Math.max(1,total)}</span><h3>${escapeHtml(step.title)}</h3>${goal?`<div class="um-learning-goal"><span>Lernziel</span><strong>${escapeHtml(goal)}</strong></div>`:''}${intro?`<p class="um-learning-intro">${escapeHtml(intro)}</p>`:''}</header><figure class="um-learning-visual">${step.imageUrl?`<img class="um-learning-image" src="${escapeHtml(step.imageUrl)}" alt="${escapeHtml(step.imageCaption||step.title)}">`:''}${step.imageCaption?`<figcaption><span>Praxisbezug</span><p>${escapeHtml(step.imageCaption)}</p></figcaption>`:''}</figure><section class="um-learning-copy"><p class="um-learning-lead">${escapeHtml(step.body||step.text||'')}</p>${step.calloutText?`<aside class="um-learning-callout"><span>${escapeHtml(step.calloutTitle||'Wichtig')}</span><p>${escapeHtml(step.calloutText)}</p></aside>`:''}${renderKeyPoints(instruction.keyPoints)}</section></article>`;
  }
  function renderQuestionList({questions=[],passPercent=80,namePrefix='umQuestion'}) {
    return `<section class="um-test-stage"><header class="um-test-head"><span>Wissen prüfen</span><h3>Abschlusstest</h3><p>Zum Bestehen sind mindestens ${escapeHtml(passPercent)} % erforderlich.</p></header><div class="um-test-progress" data-um-test-progress><span></span></div>${questions.map((q,qi)=>`<fieldset class="um-question-card"><legend>${qi+1}. ${escapeHtml(q.question)}</legend>${(q.options||[]).map((opt,oi)=>`<label class="um-answer-card"><input type="radio" name="${escapeHtml(namePrefix)}_${escapeHtml(q.id)}" value="${oi}"><span class="um-answer-letter">${String.fromCharCode(65+oi)}</span><span>${escapeHtml(typeof opt==='object'?(opt.text??''):opt)}</span></label>`).join('')}</fieldset>`).join('')}</section>`;
  }
  function renderResult({passed,scorePercent=null,passPercent=80,validUntil='',certificateActionHtml=''}) {
    return `<section class="um-result-panel ${passed?'is-pass':'is-fail'}"><span class="um-result-kicker">${passed?'Erfolgreich abgeschlossen':'Noch nicht bestanden'}</span><h2>${passed?'Unterweisung abgeschlossen':'Test wiederholen'}</h2>${scorePercent===null?'':`<div class="um-result-score">${escapeHtml(scorePercent)} %</div>`}<p>${passed?`Der Abschluss wurde dokumentiert${validUntil?` · gültig bis ${escapeHtml(validUntil)}`:''}.`:`Erforderlich sind mindestens ${escapeHtml(passPercent)} %. Bitte prüfe die Lerninhalte erneut und wiederhole anschließend den Test.`}</p>${certificateActionHtml||''}</section>`;
  }
  root.UMLearningExperience = Object.freeze({escapeHtml,renderLearningStep,renderQuestionList,renderResult});
})(globalThis);
