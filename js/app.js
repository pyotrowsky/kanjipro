const DB = await fetch('./data/kanji_quiz_database.json', { cache: 'no-store' }).then(r => { if (!r.ok) throw new Error(`Nie udało się wczytać bazy: ${r.status}`); return r.json(); });
const $=s=>document.querySelector(s);const setup=$('#setup'),quiz=$('#quiz'),finished=$('#finished'),promptEl=$('#prompt'),typeEl=$('#quizType'),progressEl=$('#progress'),input=$('#answer'),submit=$('#submit'),feedback=$('#feedback'),correctEl=$('#correct'),wrongEl=$('#wrong'),leftEl=$('#left'),lessonGrid=$('#lessonGrid'),kanjiGroups=$('#kanjiGroups'),sessionPreview=$('#sessionPreview'),vocabLimit=$('#vocabLimit'),furiganaChapterControls=$('#furiganaChapterControls'),furiganaLessonSelect=$('#furiganaLessonSelect'),furiganaLessonInput=$('#furiganaLessonInput'),furiganaHelp=$('#furiganaHelp'),inputModeHelp=$('#inputModeHelp');
let queue=[],current=null,checked=false,stats={correct:0,wrong:0,attempts:0,initial:0};
const ROMAJI={
  kya:'きゃ',kyu:'きゅ',kyo:'きょ',gya:'ぎゃ',gyu:'ぎゅ',gyo:'ぎょ',sha:'しゃ',shu:'しゅ',sho:'しょ',sya:'しゃ',syu:'しゅ',syo:'しょ',
  ja:'じゃ',ju:'じゅ',jo:'じょ',jya:'じゃ',jyu:'じゅ',jyo:'じょ',cha:'ちゃ',chu:'ちゅ',cho:'ちょ',cya:'ちゃ',cyu:'ちゅ',cyo:'ちょ',
  nya:'にゃ',nyu:'にゅ',nyo:'にょ',hya:'ひゃ',hyu:'ひゅ',hyo:'ひょ',bya:'びゃ',byu:'びゅ',byo:'びょ',pya:'ぴゃ',pyu:'ぴゅ',pyo:'ぴょ',
  mya:'みゃ',myu:'みゅ',myo:'みょ',rya:'りゃ',ryu:'りゅ',ryo:'りょ',fa:'ふぁ',fi:'ふぃ',fe:'ふぇ',fo:'ふぉ',
  tsa:'つぁ',tsi:'つぃ',tse:'つぇ',tso:'つぉ',thi:'てぃ',dhi:'でぃ',she:'しぇ',che:'ちぇ',je:'じぇ',
  shi:'し',chi:'ち',tsu:'つ',fu:'ふ',ji:'じ',
  ka:'か',ki:'き',ku:'く',ke:'け',ko:'こ',ga:'が',gi:'ぎ',gu:'ぐ',ge:'げ',go:'ご',
  sa:'さ',si:'し',su:'す',se:'せ',so:'そ',za:'ざ',zi:'じ',zu:'ず',ze:'ぜ',zo:'ぞ',
  ta:'た',ti:'ち',tu:'つ',te:'て',to:'と',da:'だ',di:'ぢ',du:'づ',de:'で',do:'ど',
  na:'な',ni:'に',nu:'ぬ',ne:'ね',no:'の',ha:'は',hi:'ひ',hu:'ふ',he:'へ',ho:'ほ',
  ba:'ば',bi:'び',bu:'ぶ',be:'べ',bo:'ぼ',pa:'ぱ',pi:'ぴ',pu:'ぷ',pe:'ぺ',po:'ぽ',
  ma:'ま',mi:'み',mu:'む',me:'め',mo:'も',ya:'や',yu:'ゆ',yo:'よ',
  ra:'ら',ri:'り',ru:'る',re:'れ',ro:'ろ',wa:'わ',wo:'を',
  a:'あ',i:'い',u:'う',e:'え',o:'お'
};
function romajiToHiragana(value,finalize=false){
  const s=String(value??'').normalize('NFKC').toLowerCase();let out='',i=0;
  while(i<s.length){const c=s[i];
    if(!/[a-z]/.test(c)){out+=c;i++;continue}
    if(c==='n'){
      const n=s[i+1];
      if(n==="'"){out+='ん';i+=2;continue}
      if(n==='n'){
        const after=s[i+2];
        // "nn" samo w sobie = ん, ale w "nna/nnya" drugie n zaczyna kolejną sylabę.
        if(after && /[aiueoy]/.test(after)){out+='ん';i+=1;continue}
        out+='ん';i+=2;continue
      }
      if(n && !/[aiueoy]/.test(n)){out+='ん';i++;continue}
      if(!n && finalize){out+='ん';i++;continue}
    }
    if(s.slice(i,i+3)==='tch'){out+='っ';i++;continue}if(i+1<s.length && c===s[i+1] && /[bcdfghjkmprstvwxyz]/.test(c) && c!=='n'){out+='っ';i++;continue}
    let hit=null;
    for(const len of [3,2,1]){const part=s.slice(i,i+len);if(ROMAJI[part]){hit=part;break}}
    if(hit){out+=ROMAJI[hit];i+=hit.length;continue}
    out+=c;i++;
  }
  return out;
}
function inputMode(){return document.querySelector('input[name="inputMode"]:checked')?.value||'romaji'}
function syncInputMode(){const r=inputMode()==='romaji';input.inputMode=r?'latin':'text';input.placeholder=r?'Wpisz romaji…':'Wpisz odczyt…';input.classList.toggle('romaji-mode',r);inputModeHelp.innerHTML=r?'Pisz np. <b>gakusei</b> → <b>がくせい</b>. Ten tryb nie wykonuje konwersji na kanji. <b>Enter zawsze sprawdza odpowiedź.</b>':'Używasz systemowego japońskiego IME. <b>Enter nadal uruchamia Sprawdź / Dalej.</b>';input.value=''}
function hira(s){return(s||'').normalize('NFKC').trim().replace(/[\s・･,，。\.]/g,'').replace(/[ァ-ヶ]/g,c=>String.fromCharCode(c.charCodeAt(0)-0x60))}function esc(s){return String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]))}function shuffle(a){for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a}function typeName(t){return t==='onyomi'?'ON’YOMI':t==='kunyomi'?'KUN’YOMI':'SŁÓWKO'}
const lessonMap=new Map(DB.quiz_lessons.map(x=>[x.lesson,x]));
const kanjiLessonMap=new Map(DB.kanji.map(k=>[k.character,k]));
let furiganaChapterManual=false;
function selectedLessons(){return[...document.querySelectorAll('#lessonGrid input:checked')].map(x=>lessonMap.get(x.value)).filter(Boolean).sort((a,b)=>a.lesson_order-b.lesson_order)}
function selectedModes(){return[...document.querySelectorAll('.mode input:checked')].map(x=>x.value)}function selectedKanji(){return new Set([...document.querySelectorAll('#kanjiGroups input:checked')].map(x=>x.value))}function vocabMaxOrder(){const ls=selectedLessons();return ls.length?Math.max(...ls.map(x=>x.lesson_order)):0}
function furiganaMode(){return document.querySelector('input[name="furiganaMode"]:checked')?.value||'selected'}
function normalizeLessonKey(raw){let x=String(raw||'').trim().toLowerCase().replace(/doki(?:\s*doki)?/g,'').replace(/\s+/g,'').replace(/[._/]/g,'-');if(lessonMap.has(x))return x;if(/^\d+$/.test(x)){const n=Number(x),hits=DB.quiz_lessons.filter(l=>Number(l.chapter)===n);if(hits.length===1)return hits[0].lesson}return null}
function furiganaLesson(){const key=normalizeLessonKey(furiganaLessonInput.value)||furiganaLessonSelect.value;return lessonMap.get(key)||null}
function latestSelectedKanjiLesson(){
  const items=[...selectedKanji()].map(k=>kanjiLessonMap.get(k)).filter(Boolean);
  return items.length?items.sort((a,b)=>a.lesson_order-b.lesson_order).at(-1):null;
}
function setDefaultFuriganaChapter(force=false){
  if(!force&&furiganaChapterManual)return;
  const l=latestSelectedKanjiLesson() || selectedLessons().at(-1) || DB.quiz_lessons[0];
  if(!l)return;
  furiganaLessonSelect.value=l.lesson;
  furiganaLessonInput.value=l.lesson;
}
function furiganaKnownSet(){if(furiganaMode()==='selected')return selectedKanji();const l=furiganaLesson();if(!l)return null;return new Set(DB.kanji.filter(k=>(k.lesson_order||Infinity)<=l.lesson_order).map(k=>k.character))}
function furiganaLabel(){if(furiganaMode()==='selected')return 'zaznaczone kanji';const l=furiganaLesson();return l?`do Doki ${l.lesson}`:'nieprawidłowy rozdział'}
function syncFuriganaControls(){const chapter=furiganaMode()==='chapter';furiganaChapterControls.classList.toggle('hidden',!chapter);if(chapter){furiganaChapterManual=false;setDefaultFuriganaChapter(true)}furiganaHelp.textContent=chapter?'Domyślnie ustawiam rozdział najpóźniejszego zaznaczonego kanji. Bez furigany będą kanji poznane do wskazanego rozdziału.':'Bez furigany będą tylko zaznaczone kanji. Każde inne kanji dostanie furiganę, o ile nie zdradzi odpowiedzi.';updatePreview()}
function populateFuriganaLessons(){furiganaLessonSelect.innerHTML='';for(const l of DB.quiz_lessons){const o=document.createElement('option');o.value=l.lesson;o.textContent=`Doki ${l.lesson}`;furiganaLessonSelect.appendChild(o)}setDefaultFuriganaChapter(true)}
function renderLessonGrid(){lessonGrid.innerHTML='';DB.quiz_lessons.forEach((l,i)=>{const lab=document.createElement('label');lab.className='lesson-chip';const inp=document.createElement('input');inp.type='checkbox';inp.value=l.lesson;inp.checked=i===0;const span=document.createElement('span');span.textContent=`Doki ${l.lesson}`;inp.addEventListener('change',()=>renderKanjiGroups(true));lab.append(inp,span);lessonGrid.appendChild(lab)})}
function renderKanjiGroups(preserve=true){const old=preserve?selectedKanji():new Set();const oldVisible=new Set([...document.querySelectorAll('#kanjiGroups input')].map(x=>x.value));kanjiGroups.innerHTML='';for(const l of selectedLessons()){const block=document.createElement('div');const title=document.createElement('div');title.className='kanji-group-title';title.textContent=`Doki ${l.lesson}`;const grid=document.createElement('div');grid.className='kanji-grid';for(const k of l.target_kanji){const lab=document.createElement('label');lab.className='kanji-chip';const inp=document.createElement('input');inp.type='checkbox';inp.value=k;inp.checked=oldVisible.has(k)?old.has(k):true;const span=document.createElement('span');span.textContent=k;inp.addEventListener('change',()=>{setDefaultFuriganaChapter();updatePreview()});lab.append(inp,span);grid.appendChild(lab)}block.append(title,grid);kanjiGroups.appendChild(block)}setDefaultFuriganaChapter();updatePreview()}
function setLessons(v){document.querySelectorAll('#lessonGrid input').forEach(x=>x.checked=v);renderKanjiGroups(false)}function setAllKanji(v){document.querySelectorAll('#kanjiGroups input').forEach(x=>x.checked=v);setDefaultFuriganaChapter();updatePreview()}
function renderVocab(v,targets,known){let html=esc(v.pattern_prefix||''),unsafe=false;for(const seg of (v.furigana_segments||[])){if(!seg.reading){html+=esc(seg.text);continue}const chars=seg.kanji||[];const show=chars.some(k=>!known.has(k));if(show&&chars.some(k=>targets.has(k)))unsafe=true;html+=show?`<ruby>${esc(seg.text)}<rt>${esc(seg.reading)}</rt></ruby>`:esc(seg.text)}html+=esc(v.pattern_suffix||'');return{html,unsafe}}
function buildVocabPool(){const targets=selectedKanji(),order=vocabMaxOrder(),known=furiganaKnownSet();if(!targets.size||!order||!known)return[];const grouped=new Map();for(const v of DB.vocabulary){if((v.lesson_order||0)>order)continue;if(!(v.all_kanji||[]).some(k=>targets.has(k)))continue;const r=renderVocab(v,targets,known);if(r.unsafe)continue;const visibleSurface=v.display_surface||v.surface;const key=visibleSurface+'\u0000'+r.html;let q=grouped.get(key);if(!q){q={question_id:`VOCAB:${key}`,type:'vocabulary',prompt:visibleSurface,prompt_html:r.html,accepted_answers:[],answer_display:[],meanings:[],target_kanji:[]};grouped.set(key,q)}for(const a of (v.accepted_readings?.length?v.accepted_readings:[v.reading]))if(a&&!q.accepted_answers.includes(a))q.accepted_answers.push(a);for(const a of (v.accepted_readings?.length?v.accepted_readings:[v.reading]))if(a&&!q.answer_display.includes(a))q.answer_display.push(a);if(v.polish&&!q.meanings.includes(v.polish))q.meanings.push(v.polish);for(const k of (v.all_kanji||[]))if(targets.has(k)&&!q.target_kanji.includes(k))q.target_kanji.push(k)}return[...grouped.values()]}
function buildReadingPools(){const targets=selectedKanji();const on=[],kun=[];for(const k of DB.kanji){if(!targets.has(k.character))continue;if(k.onyomi_accepted?.length)on.push({question_id:`ON:${k.character}`,type:'onyomi',prompt:k.character,prompt_html:esc(k.character),accepted_answers:k.onyomi_accepted,answer_display:k.onyomi_display||k.onyomi,meanings:k.polish?[k.polish]:[],target_kanji:[k.character]});if(k.kunyomi_accepted?.length)kun.push({question_id:`KUN:${k.character}`,type:'kunyomi',prompt:k.character,prompt_html:esc(k.character),accepted_answers:k.kunyomi_accepted,answer_display:k.kunyomi_display||k.kunyomi,meanings:k.polish?[k.polish]:[],target_kanji:[k.character]})}return{on,kun}}
function desiredVocabCount(poolLen){const mode=document.querySelector('input[name="vocabLimitMode"]:checked')?.value||'all';if(mode==='all')return poolLen;const n=Math.max(1,parseInt(vocabLimit.value,10)||1);return Math.min(n,poolLen)}
function poolCounts(){const r=buildReadingPools(),v=buildVocabPool();return{on:r.on.length,kun:r.kun.length,v:v.length,vChosen:desiredVocabCount(v.length)}}
function updatePreview(){const ls=selectedLessons(),ks=selectedKanji(),m=selectedModes();const c=poolCounts();const pieces=[];if(m.includes('onyomi'))pieces.push(`${c.on} ON`);if(m.includes('kunyomi'))pieces.push(`${c.kun} KUN`);if(m.includes('vocabulary'))pieces.push(c.vChosen===c.v?`${c.v} słówek`:`${c.vChosen} z ${c.v} słówek`);sessionPreview.textContent=ls.length?`Wybrano ${ls.length} rozdz. · ${ks.size} kanji · furigana: ${furiganaLabel()} · sesja: ${pieces.join(' · ')||'brak trybu'}`:'Wybierz przynajmniej jeden rozdział.'}
function buildQueue(){const modes=selectedModes(),r=buildReadingPools();let v=shuffle(buildVocabPool().slice()),q=[];if(document.querySelector('input[name="vocabLimitMode"]:checked')?.value==='limit')v=v.slice(0,desiredVocabCount(v.length));if(modes.includes('onyomi'))q.push(...r.on);if(modes.includes('kunyomi'))q.push(...r.kun);if(modes.includes('vocabulary'))q.push(...v);return shuffle(q.map(x=>({...x})))}
function showQuestion(){if(!queue.length){showFinish();return}current=queue.shift();checked=false;input.value='';input.disabled=false;submit.textContent='Sprawdź';typeEl.textContent=typeName(current.type);progressEl.textContent=`pozostało ${queue.length+1}`;promptEl.classList.toggle('vocab',current.type==='vocabulary');promptEl.innerHTML=current.prompt_html||esc(current.prompt);feedback.className='feedback empty';feedback.innerHTML='';updateStats();setTimeout(()=>input.focus(),30)}function accepted(q){return(q.accepted_answers||q.answer_display||[]).map(hira)}function answerText(q){return(q.answer_display||q.accepted_answers||[]).join(' / ')}function meaningText(q){const m=q.meanings?.length?q.meanings.join(' · '):q.meaning;return m?esc(m):''}
function check(){if(checked){showQuestion();return}if(inputMode()==='romaji')input.value=romajiToHiragana(input.value,true);const val=hira(input.value);if(!val)return;checked=true;stats.attempts++;const ok=accepted(current).includes(val);if(ok){stats.correct++;feedback.className='feedback good';feedback.innerHTML=`<div><strong>✓ ${esc(answerText(current))}</strong>${meaningText(current)?`<div class="meta">${meaningText(current)}</div>`:''}</div>`}else{stats.wrong++;feedback.className='feedback bad';feedback.innerHTML=`<div><strong>✕ ${esc(answerText(current))}</strong>${meaningText(current)?`<div class="meta">${meaningText(current)}</div>`:''}<div class="meta">Twoja odpowiedź: ${esc(input.value)}</div></div>`;const min=Math.min(3,queue.length),max=Math.min(7,queue.length),pos=max?Math.floor(Math.random()*(max-min+1))+min:0;queue.splice(pos,0,{...current})}input.disabled=true;submit.textContent='Dalej';updateStats();submit.focus()}
function updateStats(){correctEl.textContent=stats.correct;wrongEl.textContent=stats.wrong;leftEl.textContent=queue.length+(current&&!checked?1:0)}function start(){if(!selectedLessons().length){alert('Wybierz przynajmniej jeden rozdział.');return}if(!selectedKanji().size){alert('Wybierz przynajmniej jedno kanji główne.');return}if(!selectedModes().length){alert('Wybierz przynajmniej jeden tryb.');return}if(furiganaMode()==='chapter'&&!furiganaLesson()){alert('Podaj prawidłowy rozdział dla furigany, np. 1-6 albo 6.');return}queue=buildQueue();if(!queue.length){alert('Dla wybranych ustawień nie ma pytań.');return}stats={correct:0,wrong:0,attempts:0,initial:queue.length};setup.classList.add('hidden');finished.classList.add('hidden');quiz.classList.remove('hidden');showQuestion()}function showFinish(){quiz.classList.add('hidden');finished.classList.remove('hidden');const total=stats.correct+stats.wrong,acc=total?Math.round(stats.correct/total*100):100;$('#finalScore').textContent=`${acc}%`;$('#finalText').textContent=`Poprawne: ${stats.correct} · Błędy: ${stats.wrong} · Próby: ${stats.attempts}`}
function back(){quiz.classList.add('hidden');finished.classList.add('hidden');setup.classList.remove('hidden');updatePreview()}
renderLessonGrid();renderKanjiGroups(false);populateFuriganaLessons();document.querySelectorAll('.mode input').forEach(x=>x.addEventListener('change',updatePreview));document.querySelectorAll('input[name="vocabLimitMode"]').forEach(x=>x.addEventListener('change',()=>{vocabLimit.disabled=document.querySelector('input[name="vocabLimitMode"]:checked').value!=='limit';updatePreview()}));document.querySelectorAll('input[name="furiganaMode"]').forEach(x=>x.addEventListener('change',syncFuriganaControls));furiganaLessonSelect.addEventListener('change',()=>{furiganaChapterManual=true;furiganaLessonInput.value=furiganaLessonSelect.value;updatePreview()});furiganaLessonInput.addEventListener('input',()=>{furiganaChapterManual=true;const k=normalizeLessonKey(furiganaLessonInput.value);if(k)furiganaLessonSelect.value=k;updatePreview()});vocabLimit.addEventListener('input',updatePreview);document.querySelectorAll('input[name="inputMode"]').forEach(x=>x.addEventListener('change',syncInputMode));input.addEventListener('input',()=>{if(inputMode()==='romaji'&&!input.isComposing){const p=input.selectionStart??input.value.length;const before=input.value;const after=romajiToHiragana(before,false);if(after!==before){input.value=after;input.setSelectionRange(input.value.length,input.value.length)}}});$('#lessonAll').addEventListener('click',()=>setLessons(true));$('#lessonNone').addEventListener('click',()=>setLessons(false));$('#selectAll').addEventListener('click',()=>setAllKanji(true));$('#selectNone').addEventListener('click',()=>setAllKanji(false));$('#start').addEventListener('click',start);submit.addEventListener('click',check);input.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();check()}});$('#quit').addEventListener('click',back);$('#again').addEventListener('click',start);$('#settings').addEventListener('click',back);syncFuriganaControls();syncInputMode();

// PWA: offline support + iOS Home Screen experience.
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js', { updateViaCache: 'none' }).then(reg => reg.update()).catch(err => {
      console.warn('Service worker registration failed:', err);
    });
  });
}

const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
if (isStandalone) {
  document.documentElement.classList.add('standalone');
  const installedNote = document.getElementById('installedNote');
  if (installedNote) installedNote.classList.remove('hidden');
}
