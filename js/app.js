const UI_RESPONSE = await fetch('./data/ui.pl.json?v=17', { cache: 'no-store' });
if (!UI_RESPONSE.ok) throw new Error(`UI strings HTTP ${UI_RESPONSE.status}`);
const UI = await UI_RESPONSE.json();
function t(path, vars={}){let value=path.split('.').reduce((o,k)=>o?.[k],UI);if(typeof value!=='string')return path;return value.replace(/\{(\w+)\}/g,(_,k)=>vars[k]??'')}
function applyUiStrings(){document.querySelectorAll('[data-i18n]').forEach(el=>el.textContent=t(el.dataset.i18n));document.querySelectorAll('[data-i18n-html]').forEach(el=>el.innerHTML=t(el.dataset.i18nHtml));document.querySelectorAll('[data-i18n-placeholder]').forEach(el=>el.placeholder=t(el.dataset.i18nPlaceholder));document.querySelectorAll('[data-i18n-aria]').forEach(el=>el.setAttribute('aria-label',t(el.dataset.i18nAria)));document.title=t('app.name');const meta=document.querySelector('meta[name="description"]');if(meta)meta.content=t('app.description')}
applyUiStrings();

const FONT_STORAGE_KEY='wsjj-kanji-pro:jp-font';
const FONT_PROFILES={
  mincho:{stack:'"Hiragino Mincho ProN","Hiragino Mincho Pro","Yu Mincho","Noto Serif CJK JP",serif',weight:'400'},
  meiryo:{stack:'"Meiryo","Hiragino Kaku Gothic ProN","Hiragino Sans","Yu Gothic",sans-serif',weight:'400'},
  hiragino_sans:{stack:'"Hiragino Sans","Hiragino Kaku Gothic ProN","Yu Gothic",sans-serif',weight:'400'},
  kyokasho:{stack:'"YuKyokasho","Yu Kyokasho","Hiragino Kaku Gothic ProN","Yu Mincho",serif',weight:'400'},
  system_serif:{stack:'"Yu Mincho","Hiragino Mincho ProN","Hiragino Mincho Pro",serif',weight:'400'}
};
function savedFontProfile(){try{return localStorage.getItem(FONT_STORAGE_KEY)||'mincho'}catch{return'mincho'}}
function saveFontProfile(id){try{localStorage.setItem(FONT_STORAGE_KEY,id)}catch{}}
function applyFontProfile(id,persist=true){const profile=FONT_PROFILES[id]||FONT_PROFILES.mincho;const key=FONT_PROFILES[id]?id:'mincho';document.documentElement.style.setProperty('--jp-font',profile.stack);document.documentElement.style.setProperty('--jp-font-weight',profile.weight);document.querySelectorAll('input[name="jpFont"]').forEach(x=>x.checked=x.value===key);if(persist)saveFontProfile(key)}
function renderFontSettings(){const root=document.querySelector('#fontOptions');if(!root)return;root.innerHTML='';for(const [id,profile] of Object.entries(FONT_PROFILES)){const label=document.createElement('label');label.className='font-option';const input=document.createElement('input');input.type='radio';input.name='jpFont';input.value=id;input.addEventListener('change',()=>applyFontProfile(id,true));const card=document.createElement('span');card.className='font-option-card';const textWrap=document.createElement('span');const name=document.createElement('span');name.className='font-option-name';name.textContent=t('settings.fonts.'+id);const desc=document.createElement('span');desc.className='font-option-desc';desc.textContent=t('settings.font_descriptions.'+id);textWrap.append(name,desc);const sample=document.createElement('span');sample.className='font-option-sample';sample.textContent=t('settings.preview_text');sample.style.fontFamily=profile.stack;sample.style.fontWeight=profile.weight;card.append(textWrap,sample);label.append(input,card);root.appendChild(label)}}
function initFontSettings(){renderFontSettings();applyFontProfile(savedFontProfile(),false);const dialog=document.querySelector('#settingsDialog'),open=document.querySelector('#openSettings'),close=document.querySelector('#closeSettings'),closeX=document.querySelector('#closeSettingsX');const show=()=>{if(!dialog)return;if(typeof dialog.showModal==='function')dialog.showModal();else dialog.setAttribute('open','')};const hide=()=>{if(!dialog)return;if(typeof dialog.close==='function')dialog.close();else dialog.removeAttribute('open')};open?.addEventListener('click',show);close?.addEventListener('click',hide);closeX?.addEventListener('click',hide);dialog?.addEventListener('click',e=>{if(e.target===dialog)hide()})}
initFontSettings();

const DB = await fetch('./data/kanji_quiz_database.json?v=17', { cache: 'no-store' }).then(r => { if (!r.ok) throw new Error(t('errors.database_load',{status:r.status})); return r.json(); });
const $=s=>document.querySelector(s);const setup=$('#setup'),quiz=$('#quiz'),finished=$('#finished'),promptEl=$('#prompt'),typeEl=$('#quizType'),progressEl=$('#progress'),input=$('#answer'),submit=$('#submit'),feedback=$('#feedback'),correctEl=$('#correct'),wrongEl=$('#wrong'),leftEl=$('#left'),lessonGrid=$('#lessonGrid'),kanjiGroups=$('#kanjiGroups'),kanjiSelectionSummary=$('#kanjiSelectionSummary'),sessionPreview=$('#sessionPreview'),vocabLimit=$('#vocabLimit'),furiganaChapterControls=$('#furiganaChapterControls'),furiganaLessonSelect=$('#furiganaLessonSelect'),furiganaLessonInput=$('#furiganaLessonInput'),furiganaHelp=$('#furiganaHelp'),inputModeHelp=$('#inputModeHelp');
let queue=[],current=null,checked=false,stats={correct:0,wrong:0,attempts:0,initial:0},mistakeLog=new Map();
const ROMAJI={
  kya:'きゃ',kyu:'きゅ',kyo:'きょ',gya:'ぎゃ',gyu:'ぎゅ',gyo:'ぎょ',sha:'しゃ',shu:'しゅ',sho:'しょ',sya:'しゃ',syu:'しゅ',syo:'しょ',
  ja:'じゃ',ju:'じゅ',jo:'じょ',jya:'じゃ',jyu:'じゅ',jyo:'じょ',cha:'ちゃ',chu:'ちゅ',cho:'ちょ',cya:'ちゃ',cyu:'ちゅ',cyo:'ちょ',
  nya:'にゃ',nyu:'にゅ',nyo:'にょ',hya:'ひゃ',hyu:'ひゅ',hyo:'ひょ',bya:'びゃ',byu:'びゅ',byo:'びょ',pya:'ぴゃ',pyu:'ぴゅ',pyo:'ぴょ',
  mya:'みゃ',myu:'みゅ',myo:'みょ',rya:'りゃ',ryu:'りゅ',ryo:'りょ',fa:'ふぁ',fi:'ふぃ',fe:'ふぇ',fo:'ふぉ',
  tsa:'つぁ',tsi:'つぃ',tse:'つぇ',tso:'つぉ',thi:'てぃ',dhi:'でぃ',she:'しぇ',che:'ちぇ',je:'じぇ',dzu:'づ',dzi:'ぢ',dja:'ぢゃ',dju:'ぢゅ',djo:'ぢょ',
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
function syncInputMode(){const r=inputMode()==='romaji';input.inputMode=r?'latin':'text';input.placeholder=t(r?'input.placeholder_romaji':'input.placeholder_ime');input.classList.toggle('romaji-mode',r);inputModeHelp.innerHTML=t(r?'input.help_romaji_html':'input.help_ime_html');input.value=''}
function hira(s){return(s||'').normalize('NFKC').trim().replace(/[\s・･,，。\.]/g,'').replace(/[ァ-ヶ]/g,c=>String.fromCharCode(c.charCodeAt(0)-0x60))}function esc(s){return String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]))}function shuffle(a){for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a}function typeName(tn){return t(tn==='onyomi'?'quiz.type_onyomi':tn==='kunyomi'?'quiz.type_kunyomi':'quiz.type_vocabulary')}
const lessonMap=new Map(DB.quiz_lessons.map(x=>[x.lesson,x]));
const kanjiLessonMap=new Map(DB.kanji.map(k=>[k.character,k]));
const SESSION_PREFS_KEY='wsjj-kanji-pro:session-prefs';
function loadSessionPrefs(){try{const x=JSON.parse(localStorage.getItem(SESSION_PREFS_KEY)||'{}');return x&&typeof x==='object'?x:{}}catch{return{}}}
let sessionPrefs=loadSessionPrefs();
function collectSessionPrefs(){return{
  lessons:[...document.querySelectorAll('#lessonGrid input:checked')].map(x=>x.value),
  modes:[...document.querySelectorAll('.mode input:checked')].map(x=>x.value),
  vocabLimitMode:document.querySelector('input[name="vocabLimitMode"]:checked')?.value||'all',
  vocabLimit:Math.max(1,parseInt(vocabLimit?.value,10)||40)
}}
function saveSessionPrefs(){sessionPrefs=collectSessionPrefs();try{localStorage.setItem(SESSION_PREFS_KEY,JSON.stringify(sessionPrefs))}catch{}}
function restoreSessionControls(){if(Array.isArray(sessionPrefs.modes)){const allowed=new Set(['onyomi','kunyomi','vocabulary']);const saved=sessionPrefs.modes.filter(x=>allowed.has(x));document.querySelectorAll('.mode input').forEach(x=>x.checked=saved.includes(x.value))}const limitMode=sessionPrefs.vocabLimitMode==='limit'?'limit':sessionPrefs.vocabLimitMode==='all'?'all':null;if(limitMode){const radio=document.querySelector(`input[name="vocabLimitMode"][value="${limitMode}"]`);if(radio)radio.checked=true}if(Number.isFinite(Number(sessionPrefs.vocabLimit))&&Number(sessionPrefs.vocabLimit)>0)vocabLimit.value=String(Math.floor(Number(sessionPrefs.vocabLimit)));vocabLimit.disabled=document.querySelector('input[name="vocabLimitMode"]:checked')?.value!=='limit'}
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
function furiganaLabel(){if(furiganaMode()==='selected')return t('furigana.label_selected');const l=furiganaLesson();return l?t('furigana.label_chapter',{lesson:l.lesson}):t('furigana.label_invalid')}
function syncFuriganaControls(){const chapter=furiganaMode()==='chapter';furiganaChapterControls.classList.toggle('hidden',!chapter);if(chapter){furiganaChapterManual=false;setDefaultFuriganaChapter(true)}furiganaHelp.textContent=t(chapter?'furigana.help_chapter':'furigana.help_selected');updatePreview()}
function populateFuriganaLessons(){furiganaLessonSelect.innerHTML='';for(const l of DB.quiz_lessons){const o=document.createElement('option');o.value=l.lesson;o.textContent=t('common.doki_lesson',{lesson:l.lesson});furiganaLessonSelect.appendChild(o)}setDefaultFuriganaChapter(true)}
function lessonsGroupedByBook(){const groups=new Map();for(const l of DB.quiz_lessons){if(!groups.has(l.book))groups.set(l.book,[]);groups.get(l.book).push(l)}return[...groups.entries()].sort((a,b)=>Number(a[0])-Number(b[0]))}
function syncChapterToggle(){const btn=$('#lessonToggle'),inputs=[...document.querySelectorAll('#lessonGrid input')];if(!btn)return;const all=inputs.length>0&&inputs.every(x=>x.checked);btn.textContent=t(all?'actions.clear':'actions.select_all');btn.disabled=!inputs.length}
function syncKanjiToggle(){const btn=$('#kanjiToggle'),inputs=[...document.querySelectorAll('#kanjiGroups input')];if(!btn)return;const all=inputs.length>0&&inputs.every(x=>x.checked);btn.textContent=t(all?'actions.clear':'actions.select_all');btn.disabled=!inputs.length}
function syncBookStatuses(){document.querySelectorAll('.book-folder').forEach(folder=>{const inputs=[...folder.querySelectorAll('.lesson-chip input')],chosen=inputs.filter(x=>x.checked).length,total=inputs.length,status=folder.querySelector('.book-status'),toggle=folder.querySelector('.book-toggle'),all=total>0&&chosen===total;if(status)status.textContent=t('setup.book_status',{selected:chosen,total});if(toggle)toggle.textContent=t(all?'actions.clear':'actions.whole_book');folder.classList.toggle('has-selection',chosen>0);folder.classList.toggle('all-selected',all)});syncChapterToggle()}
function setBookLessons(book,value){document.querySelectorAll(`#lessonGrid input[data-book="${book}"]`).forEach(x=>x.checked=value);renderKanjiGroups(true);syncBookStatuses();saveSessionPrefs()}
function renderLessonGrid(){lessonGrid.innerHTML='';const firstLesson=DB.quiz_lessons[0]?.lesson;const hasSavedLessons=Array.isArray(sessionPrefs.lessons);const validSaved=new Set((sessionPrefs.lessons||[]).filter(x=>lessonMap.has(x)));const useSaved=hasSavedLessons&&((sessionPrefs.lessons||[]).length===0||validSaved.size>0);for(const [book,lessons] of lessonsGroupedByBook()){const folder=document.createElement('details');folder.className='book-folder';folder.dataset.book=book;const summary=document.createElement('summary');const title=document.createElement('span');title.className='book-title';title.textContent=t('common.doki',{book});const status=document.createElement('span');status.className='book-status';const toggleBtn=document.createElement('button');toggleBtn.type='button';toggleBtn.className='mini-btn book-toggle';toggleBtn.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();const inputs=[...folder.querySelectorAll('.lesson-chip input')],all=inputs.length>0&&inputs.every(x=>x.checked);setBookLessons(book,!all)});summary.append(title,status,toggleBtn);const body=document.createElement('div');body.className='book-folder-body';const grid=document.createElement('div');grid.className='lesson-grid';for(const l of lessons){const lab=document.createElement('label');lab.className='lesson-chip';const inp=document.createElement('input');inp.type='checkbox';inp.value=l.lesson;inp.dataset.book=String(book);inp.checked=useSaved?validSaved.has(l.lesson):l.lesson===firstLesson;const span=document.createElement('span');span.textContent=t('common.lesson',{chapter:l.chapter});inp.addEventListener('change',()=>{renderKanjiGroups(true);syncBookStatuses();saveSessionPrefs()});lab.append(inp,span);grid.appendChild(lab)}body.append(grid);folder.append(summary,body);lessonGrid.appendChild(folder)}syncBookStatuses()}
function renderKanjiGroups(preserve=true){const old=preserve?selectedKanji():new Set();const oldVisible=new Set([...document.querySelectorAll('#kanjiGroups input')].map(x=>x.value));kanjiGroups.innerHTML='';for(const l of selectedLessons()){const block=document.createElement('div');const title=document.createElement('div');title.className='kanji-group-title';title.textContent=t('setup.kanji_group',{book:l.book,chapter:l.chapter});const grid=document.createElement('div');grid.className='kanji-grid';for(const k of l.target_kanji){const lab=document.createElement('label');lab.className='kanji-chip';const inp=document.createElement('input');inp.type='checkbox';inp.value=k;inp.checked=oldVisible.has(k)?old.has(k):true;const span=document.createElement('span');span.textContent=k;inp.addEventListener('change',()=>{syncKanjiToggle();setDefaultFuriganaChapter();updatePreview()});lab.append(inp,span);grid.appendChild(lab)}block.append(title,grid);kanjiGroups.appendChild(block)}syncKanjiToggle();setDefaultFuriganaChapter();updatePreview()}
function setLessons(v){document.querySelectorAll('#lessonGrid input').forEach(x=>x.checked=v);renderKanjiGroups(false);syncBookStatuses();saveSessionPrefs()}function setAllKanji(v){document.querySelectorAll('#kanjiGroups input').forEach(x=>x.checked=v);syncKanjiToggle();setDefaultFuriganaChapter();updatePreview()}function toggleLessons(){const inputs=[...document.querySelectorAll('#lessonGrid input')],all=inputs.length>0&&inputs.every(x=>x.checked);setLessons(!all)}function toggleKanji(){const inputs=[...document.querySelectorAll('#kanjiGroups input')],all=inputs.length>0&&inputs.every(x=>x.checked);setAllKanji(!all)}
function renderVocab(v,targets,known){let html=esc(v.pattern_prefix||''),unsafe=false;for(const seg of (v.furigana_segments||[])){if(!seg.reading){html+=esc(seg.text);continue}const chars=seg.kanji||[];const show=chars.some(k=>!known.has(k));if(show&&chars.some(k=>targets.has(k)))unsafe=true;html+=show?`<ruby>${esc(seg.text)}<rt>${esc(seg.reading)}</rt></ruby>`:esc(seg.text)}html+=esc(v.pattern_suffix||'');return{html,unsafe}}
function buildVocabPool(){const targets=selectedKanji(),order=vocabMaxOrder(),known=furiganaKnownSet();if(!targets.size||!order||!known)return[];const grouped=new Map();for(const v of DB.vocabulary){if((v.lesson_order||0)>order)continue;if(!(v.all_kanji||[]).some(k=>targets.has(k)))continue;const r=renderVocab(v,targets,known);if(r.unsafe)continue;const visibleSurface=v.display_surface||v.surface;const key=visibleSurface+'\u0000'+r.html;let q=grouped.get(key);if(!q){q={question_id:`VOCAB:${key}`,type:'vocabulary',prompt:visibleSurface,prompt_html:r.html,accepted_answers:[],answer_display:[],meanings:[],target_kanji:[]};grouped.set(key,q)}for(const a of (v.accepted_readings?.length?v.accepted_readings:[v.reading]))if(a&&!q.accepted_answers.includes(a))q.accepted_answers.push(a);for(const a of (v.accepted_readings?.length?v.accepted_readings:[v.reading]))if(a&&!q.answer_display.includes(a))q.answer_display.push(a);if(v.polish&&!q.meanings.includes(v.polish))q.meanings.push(v.polish);for(const k of (v.all_kanji||[]))if(targets.has(k)&&!q.target_kanji.includes(k))q.target_kanji.push(k)}return[...grouped.values()]}
function buildReadingPools(){const targets=selectedKanji();const on=[],kun=[];for(const k of DB.kanji){if(!targets.has(k.character))continue;if(k.onyomi_accepted?.length)on.push({question_id:`ON:${k.character}`,type:'onyomi',prompt:k.character,prompt_html:esc(k.character),accepted_answers:k.onyomi_accepted,answer_display:k.onyomi_display||k.onyomi,meanings:k.polish?[k.polish]:[],target_kanji:[k.character]});if(k.kunyomi_accepted?.length)kun.push({question_id:`KUN:${k.character}`,type:'kunyomi',prompt:k.character,prompt_html:esc(k.character),accepted_answers:k.kunyomi_accepted,answer_display:k.kunyomi_display||k.kunyomi,meanings:k.polish?[k.polish]:[],target_kanji:[k.character]})}return{on,kun}}
function desiredVocabCount(poolLen){const mode=document.querySelector('input[name="vocabLimitMode"]:checked')?.value||'all';if(mode==='all')return poolLen;const n=Math.max(1,parseInt(vocabLimit.value,10)||1);return Math.min(n,poolLen)}
function poolCounts(){const r=buildReadingPools(),v=buildVocabPool();return{on:r.on.length,kun:r.kun.length,v:v.length,vChosen:desiredVocabCount(v.length)}}
function updatePreview(){const ls=selectedLessons(),ks=selectedKanji(),m=selectedModes();if(kanjiSelectionSummary)kanjiSelectionSummary.textContent=t('setup.kanji_selected',{count:ks.size});const c=poolCounts();const pieces=[];if(m.includes('onyomi'))pieces.push(t('vocab.preview_on',{count:c.on}));if(m.includes('kunyomi'))pieces.push(t('vocab.preview_kun',{count:c.kun}));if(m.includes('vocabulary'))pieces.push(c.vChosen===c.v?t('vocab.preview_vocab_all',{count:c.v}):t('vocab.preview_vocab_limited',{chosen:c.vChosen,total:c.v}));sessionPreview.textContent=ls.length?t('vocab.preview',{lessons:ls.length,kanji:ks.size,session:pieces.join(' · ')||t('vocab.preview_no_mode')}):t('vocab.preview_no_lessons')}
function buildQueue(){const modes=selectedModes(),r=buildReadingPools();let v=shuffle(buildVocabPool().slice()),q=[];if(document.querySelector('input[name="vocabLimitMode"]:checked')?.value==='limit')v=v.slice(0,desiredVocabCount(v.length));if(modes.includes('onyomi'))q.push(...r.on);if(modes.includes('kunyomi'))q.push(...r.kun);if(modes.includes('vocabulary'))q.push(...v);return shuffle(q.map(x=>({...x})))}
function showQuestion(){if(!queue.length){showFinish();return}current=queue.shift();checked=false;input.value='';input.disabled=false;submit.textContent=t('quiz.check');typeEl.textContent=typeName(current.type);progressEl.textContent=t('quiz.progress',{count:queue.length+1});promptEl.classList.toggle('vocab',current.type==='vocabulary');promptEl.innerHTML=current.prompt_html||esc(current.prompt);feedback.className='feedback empty';feedback.innerHTML='';updateStats();setTimeout(()=>input.focus(),30)}function compareReading(s){const x=hira(s);return inputMode()==='romaji'?x.replace(/づ/g,'ず').replace(/ぢ/g,'じ'):x}function accepted(q){return(q.accepted_answers||q.answer_display||[]).map(compareReading)}function answerText(q){return(q.answer_display||q.accepted_answers||[]).join(' / ')}function rawMeaning(q){return q.meanings?.length?q.meanings.join(' · '):(q.meaning||'')}function meaningText(q){const m=rawMeaning(q);return m?esc(m):''}
function recordMistake(q,userAnswer){const key=q.question_id||`${q.type}:${q.prompt}`;let item=mistakeLog.get(key);if(!item){item={type:typeName(q.type),prompt_html:q.prompt_html||esc(q.prompt),correct:answerText(q),meaning:rawMeaning(q),answers:[]};mistakeLog.set(key,item)}const a=String(userAnswer||'').trim();if(a&&!item.answers.includes(a))item.answers.push(a)}
function renderMistakeSummary(){const details=$('#mistakesDetails'),list=$('#mistakesList'),count=$('#mistakesCount');if(!details||!list||!count)return;list.innerHTML='';details.open=false;if(!mistakeLog.size){details.classList.add('hidden');count.textContent='0';return}details.classList.remove('hidden');count.textContent=String(mistakeLog.size);for(const item of mistakeLog.values()){const el=document.createElement('div');el.className='mistake-item';const yours=item.answers.map(esc).join(' · ');el.innerHTML=`<div class="mistake-head"><div class="mistake-prompt">${item.prompt_html}</div><div class="mistake-type">${esc(item.type)}</div></div><div class="mistake-answer">${esc(t('finish.mistake_correct',{answer:item.correct}))}</div>${yours?`<div class="mistake-yours">${esc(t('finish.mistake_yours',{answer:yours}))}</div>`:''}${item.meaning?`<div class="mistake-meaning">${esc(item.meaning)}</div>`:''}`;list.appendChild(el)}}
function check(){if(checked){showQuestion();return}if(inputMode()==='romaji')input.value=romajiToHiragana(input.value,true);const val=compareReading(input.value);if(!val)return;checked=true;stats.attempts++;const ok=accepted(current).includes(val);if(ok){stats.correct++;feedback.className='feedback good';feedback.innerHTML=`<div><strong>✓ ${esc(answerText(current))}</strong>${meaningText(current)?`<div class="meta">${meaningText(current)}</div>`:''}</div>`}else{stats.wrong++;recordMistake(current,input.value);feedback.className='feedback bad';feedback.innerHTML=`<div><strong>✕ ${esc(answerText(current))}</strong>${meaningText(current)?`<div class="meta">${meaningText(current)}</div>`:''}<div class="meta">${esc(t('quiz.your_answer',{answer:input.value}))}</div></div>`;const min=Math.min(3,queue.length),max=Math.min(7,queue.length),pos=max?Math.floor(Math.random()*(max-min+1))+min:0;queue.splice(pos,0,{...current})}input.disabled=true;submit.textContent=t('quiz.next');updateStats();submit.focus()}
function updateStats(){correctEl.textContent=stats.correct;wrongEl.textContent=stats.wrong;leftEl.textContent=queue.length+(current&&!checked?1:0)}function start(){saveSessionPrefs();if(!selectedLessons().length){alert(t('errors.choose_lesson'));return}if(!selectedKanji().size){alert(t('errors.choose_kanji'));return}if(!selectedModes().length){alert(t('errors.choose_mode'));return}if(furiganaMode()==='chapter'&&!furiganaLesson()){alert(t('errors.invalid_furigana'));return}queue=buildQueue();if(!queue.length){alert(t('errors.empty_pool'));return}stats={correct:0,wrong:0,attempts:0,initial:queue.length};mistakeLog=new Map();setup.classList.add('hidden');finished.classList.add('hidden');quiz.classList.remove('hidden');showQuestion()}function showFinish(){quiz.classList.add('hidden');finished.classList.remove('hidden');const total=stats.correct+stats.wrong,acc=total?Math.round(stats.correct/total*100):100;$('#finalScore').textContent=`${acc}%`;$('#finalCorrect').textContent=stats.correct;$('#finalWrong').textContent=stats.wrong;$('#finalAttempts').textContent=stats.attempts;renderMistakeSummary()}
function back(){quiz.classList.add('hidden');finished.classList.add('hidden');setup.classList.remove('hidden');updatePreview()}
renderLessonGrid();renderKanjiGroups(false);restoreSessionControls();populateFuriganaLessons();updatePreview();document.querySelectorAll('.mode input').forEach(x=>x.addEventListener('change',()=>{saveSessionPrefs();updatePreview()}));document.querySelectorAll('input[name="vocabLimitMode"]').forEach(x=>x.addEventListener('change',()=>{vocabLimit.disabled=document.querySelector('input[name="vocabLimitMode"]:checked').value!=='limit';saveSessionPrefs();updatePreview()}));document.querySelectorAll('input[name="furiganaMode"]').forEach(x=>x.addEventListener('change',syncFuriganaControls));furiganaLessonSelect.addEventListener('change',()=>{furiganaChapterManual=true;furiganaLessonInput.value=furiganaLessonSelect.value;updatePreview()});furiganaLessonInput.addEventListener('input',()=>{furiganaChapterManual=true;const k=normalizeLessonKey(furiganaLessonInput.value);if(k)furiganaLessonSelect.value=k;updatePreview()});vocabLimit.addEventListener('input',()=>{saveSessionPrefs();updatePreview()});document.querySelectorAll('input[name="inputMode"]').forEach(x=>x.addEventListener('change',syncInputMode));input.addEventListener('input',()=>{if(inputMode()==='romaji'&&!input.isComposing){const p=input.selectionStart??input.value.length;const before=input.value;const after=romajiToHiragana(before,false);if(after!==before){input.value=after;input.setSelectionRange(input.value.length,input.value.length)}}});$('#lessonToggle').addEventListener('click',toggleLessons);$('#kanjiToggle').addEventListener('click',toggleKanji);$('#start').addEventListener('click',start);submit.addEventListener('click',check);input.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();check()}});$('#quit').addEventListener('click',back);$('#again').addEventListener('click',start);$('#settings').addEventListener('click',back);syncFuriganaControls();syncInputMode();

// PWA: offline support + iOS Home Screen experience.
if ('serviceWorker' in navigator) {
  let refreshingForServiceWorker = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (refreshingForServiceWorker) return;
    refreshingForServiceWorker = true;
    window.location.reload();
  });
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js?v=17', { updateViaCache: 'none' }).then(reg => reg.update()).catch(err => {
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
