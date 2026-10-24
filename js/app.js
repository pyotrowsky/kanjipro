const UI_RESPONSE = await fetch('./data/ui.pl.json?v=3.6', { cache: 'no-store' });
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
function savedFontProfile(){try{return localStorage.getItem(FONT_STORAGE_KEY)||'meiryo'}catch{return'meiryo'}}
function saveFontProfile(id){try{localStorage.setItem(FONT_STORAGE_KEY,id)}catch{}}
function applyFontProfile(id,persist=true){const profile=FONT_PROFILES[id]||FONT_PROFILES.mincho;const key=FONT_PROFILES[id]?id:'mincho';document.documentElement.style.setProperty('--jp-font',profile.stack);document.documentElement.style.setProperty('--jp-font-weight',profile.weight);document.querySelectorAll('input[name="jpFont"]').forEach(x=>x.checked=x.value===key);if(persist)saveFontProfile(key)}
function renderFontSettings(){const root=document.querySelector('#fontOptions');if(!root)return;root.innerHTML='';for(const [id,profile] of Object.entries(FONT_PROFILES)){const label=document.createElement('label');label.className='font-option';const input=document.createElement('input');input.type='radio';input.name='jpFont';input.value=id;input.addEventListener('change',()=>applyFontProfile(id,true));const card=document.createElement('span');card.className='font-option-card';const textWrap=document.createElement('span');const name=document.createElement('span');name.className='font-option-name';name.textContent=t('settings.fonts.'+id);const desc=document.createElement('span');desc.className='font-option-desc';desc.textContent=t('settings.font_descriptions.'+id);textWrap.append(name,desc);const sample=document.createElement('span');sample.className='font-option-sample';sample.textContent=t('settings.preview_text');sample.style.fontFamily=profile.stack;sample.style.fontWeight=profile.weight;card.append(textWrap,sample);label.append(input,card);root.appendChild(label)}}
function initFontSettings(){renderFontSettings();applyFontProfile(savedFontProfile(),false);const dialog=document.querySelector('#settingsDialog'),open=document.querySelector('#openSettings'),close=document.querySelector('#closeSettings'),closeX=document.querySelector('#closeSettingsX');const show=()=>{if(!dialog)return;if(typeof dialog.showModal==='function')dialog.showModal();else dialog.setAttribute('open','')};const hide=()=>{if(!dialog)return;if(typeof dialog.close==='function')dialog.close();else dialog.removeAttribute('open')};open?.addEventListener('click',show);close?.addEventListener('click',hide);closeX?.addEventListener('click',hide);dialog?.addEventListener('click',e=>{if(e.target===dialog)hide()})}
initFontSettings();

const ANSWER_MODE_STORAGE_KEY='wsjj-kanji-pro:answer-mode';
function defaultAnswerMode(){return (navigator.maxTouchPoints||0)>0?'one':'two'}
function savedAnswerMode(){try{const x=localStorage.getItem(ANSWER_MODE_STORAGE_KEY);return x==='one'||x==='two'?x:defaultAnswerMode()}catch{return defaultAnswerMode()}}
function answerMode(){return document.querySelector('input[name="answerMode"]:checked')?.value||savedAnswerMode()}
function saveAnswerMode(value){try{localStorage.setItem(ANSWER_MODE_STORAGE_KEY,value)}catch{}}
function initAnswerModeSettings(){const current=savedAnswerMode();document.querySelectorAll('input[name="answerMode"]').forEach(x=>{x.checked=x.value===current;x.addEventListener('change',()=>{if(x.checked)saveAnswerMode(x.value)})})}
initAnswerModeSettings();

const STROKE_ANIMATION_MODE_KEY='wsjj-kanji-pro:stroke-animation-mode';
function savedStrokeAnimationMode(){try{const x=localStorage.getItem(STROKE_ANIMATION_MODE_KEY);return x==='active'?'active':'gradient'}catch{return'gradient'}}
function strokeAnimationMode(){return document.querySelector('input[name="strokeAnimationMode"]:checked')?.value||savedStrokeAnimationMode()}
function saveStrokeAnimationMode(value){try{localStorage.setItem(STROKE_ANIMATION_MODE_KEY,value==='active'?'active':'gradient')}catch{}}
function initStrokeAnimationModeSettings(){
  const current=savedStrokeAnimationMode();
  document.querySelectorAll('input[name="strokeAnimationMode"]').forEach(x=>{
    x.checked=x.value===current;
    x.addEventListener('change',()=>{
      if(!x.checked)return;
      saveStrokeAnimationMode(x.value);
      const svg=document.querySelector('#dictionaryStrokeCanvas .dictionary-kanjivg-svg');
      if(svg)animateKanjiVg(svg)
    })
  })
}
initStrokeAnimationModeSettings();

const DB = await fetch('./data/kanji_quiz_database.json?v=3.6', { cache: 'no-store' }).then(r => { if (!r.ok) throw new Error(t('errors.database_load',{status:r.status})); return r.json(); });
const $=s=>document.querySelector(s);const setup=$('#setup'),reviewBank=$('#reviewBank'),quiz=$('#quiz'),finished=$('#finished'),promptEl=$('#prompt'),promptHint=$('#promptHint'),typeEl=$('#quizType'),progressEl=$('#progress'),input=$('#answer'),submit=$('#submit'),feedback=$('#feedback'),answerNotice=$('#answerNotice'),correctEl=$('#correct'),wrongEl=$('#wrong'),leftEl=$('#left'),lessonGrid=$('#lessonGrid'),kanjiGroups=$('#kanjiGroups'),kanjiSelectionSummary=$('#kanjiSelectionSummary'),sessionPreview=$('#sessionPreview'),vocabLimit=$('#vocabLimit'),furiganaChapterControls=$('#furiganaChapterControls'),furiganaLessonSelect=$('#furiganaLessonSelect'),furiganaHelp=$('#furiganaHelp'),inputModeHelp=$('#inputModeHelp'),reviewCard=$('#reviewCard'),reviewCardCount=$('#reviewCardCount'),reviewBankCount=$('#reviewBankCount'),reviewBankList=$('#reviewBankList'),finishTitle=$('#finishTitle');
const dictionary=$('#dictionary'),dictionaryBrowse=$('#dictionaryBrowse'),dictionaryDetail=$('#dictionaryDetail'),dictList=$('#dictList'),dictSearch=$('#dictSearch'),dictLessonFilter=$('#dictLessonFilter'),dictStatusFilter=$('#dictStatusFilter'),dictCount=$('#dictCount'),dictMore=$('#dictMore'),dictDetailContent=$('#dictDetailContent'),navPractice=$('#navPractice'),navDictionary=$('#navDictionary'),dictTabKanji=$('#dictTabKanji'),dictTabVocab=$('#dictTabVocab');
let queue=[],current=null,checked=false,stats={correct:0,wrong:0,attempts:0,initial:0},mistakeLog=new Map(),sessionKind='normal',sessionWrongIds=new Set(),sessionCreditedIds=new Set(),sessionLearningRecordedIds=new Set();
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
    if(/[-‐‑‒–—―−]/.test(c)){out+='ー';i++;continue}
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
function hira(s){return(s||'').normalize('NFKC').trim().replace(/[\s・･,，。\.]/g,'').replace(/[ァ-ヶ]/g,c=>String.fromCharCode(c.charCodeAt(0)-0x60))}function esc(s){return String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]))}
function cleanDisplayText(value){const ta=document.createElement('textarea');ta.innerHTML=String(value??'');return ta.value.replace(/<br\s*\/?>/gi,' ').replace(/<[^>]*>/g,' ').replace(/\u00a0/g,' ').replace(/\s+/g,' ').trim()}
for(const k of (DB.kanji||[]))k.polish=cleanDisplayText(k.polish);
for(const v of (DB.vocabulary||[]))v.polish=cleanDisplayText(v.polish);
function shuffle(a){for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a}function typeName(tn){return t(tn==='onyomi'?'quiz.type_onyomi':tn==='kunyomi'?'quiz.type_kunyomi':'quiz.type_vocabulary')}
const lessonMap=new Map(DB.quiz_lessons.map(x=>[x.lesson,x]));
const kanjiLessonMap=new Map(DB.kanji.map(k=>[k.character,k]));
const MISTAKE_BANK_KEY='wsjj-kanji-pro:mistake-bank:v1';
const LEARNING_STATS_KEY='wsjj-kanji-pro:learning-stats:v1';
const APP_DB_NAME='wsjj-kanji-pro';
const APP_DB_VERSION=1;
let appDb=null,storageWriteQueue=Promise.resolve(),persistentStorageGranted=null;
function localObject(key){try{const raw=JSON.parse(localStorage.getItem(key)||'{}');return raw&&typeof raw==='object'&&!Array.isArray(raw)?raw:{}}catch{return{}}}
function openAppDb(){return new Promise(resolve=>{if(!('indexedDB'in window)){resolve(null);return}let settled=false;try{const req=indexedDB.open(APP_DB_NAME,APP_DB_VERSION);req.onupgradeneeded=()=>{const db=req.result;if(!db.objectStoreNames.contains('learning_stats'))db.createObjectStore('learning_stats',{keyPath:'id'});if(!db.objectStoreNames.contains('mistakes'))db.createObjectStore('mistakes',{keyPath:'id'});if(!db.objectStoreNames.contains('meta'))db.createObjectStore('meta',{keyPath:'key'})};req.onsuccess=()=>{settled=true;resolve(req.result)};req.onerror=()=>{settled=true;console.warn('IndexedDB unavailable:',req.error);resolve(null)};req.onblocked=()=>{if(!settled){settled=true;console.warn('IndexedDB open blocked');resolve(null)}}}catch(err){console.warn('IndexedDB unavailable:',err);resolve(null)}})}
function idbGetAll(store){return new Promise((resolve,reject)=>{if(!appDb){resolve([]);return}try{const tx=appDb.transaction(store,'readonly'),req=tx.objectStore(store).getAll();req.onsuccess=()=>resolve(req.result||[]);req.onerror=()=>reject(req.error)}catch(err){reject(err)}})}
function idbPut(store,record){return new Promise((resolve,reject)=>{if(!appDb){resolve();return}try{const tx=appDb.transaction(store,'readwrite');tx.objectStore(store).put(record);tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error)}catch(err){reject(err)}})}
function idbReplaceStore(store,records){return new Promise((resolve,reject)=>{if(!appDb){resolve();return}try{const tx=appDb.transaction(store,'readwrite'),os=tx.objectStore(store);os.clear();for(const record of records)os.put(record);tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error)}catch(err){reject(err)}})}
function queueStorageWrite(task){storageWriteQueue=storageWriteQueue.then(task).catch(err=>console.warn('Persistent storage write failed:',err));return storageWriteQueue}
function learningRowsFromObject(obj){return Object.entries(obj||{}).filter(([,v])=>v&&typeof v==='object'&&!Array.isArray(v)).map(([id,v])=>({id,...v}))}
function mistakeRowsFromObject(obj){return Object.entries(obj||{}).filter(([,v])=>v&&typeof v==='object'&&!Array.isArray(v)).map(([id,v])=>({...v,id}))}
function objectFromRows(rows){const out={};for(const row of rows||[]){if(!row?.id)continue;const {id,...rest}=row;out[id]=rest}return out}
function mistakeObjectFromRows(rows){const out={};for(const row of rows||[]){if(!row?.id)continue;out[row.id]={...row}}return out}
async function initializePersistentState(){
  const legacyLearning=localObject(LEARNING_STATS_KEY),legacyMistakes=localObject(MISTAKE_BANK_KEY);
  appDb=await openAppDb();
  if(!appDb)return{learning:legacyLearning,mistakes:legacyMistakes};
  try{
    const [learningRows,mistakeRows]=await Promise.all([idbGetAll('learning_stats'),idbGetAll('mistakes')]);
    const learning={...legacyLearning,...objectFromRows(learningRows)},mistakes={...legacyMistakes,...mistakeObjectFromRows(mistakeRows)};
    await Promise.all([idbReplaceStore('learning_stats',learningRowsFromObject(learning)),idbReplaceStore('mistakes',mistakeRowsFromObject(mistakes)),idbPut('meta',{key:'schema',version:APP_DB_VERSION,migrated_at:Date.now()})]);
    try{localStorage.setItem(LEARNING_STATS_KEY,JSON.stringify(learning));localStorage.setItem(MISTAKE_BANK_KEY,JSON.stringify(mistakes))}catch{}
    return{learning,mistakes}
  }catch(err){console.warn('IndexedDB initialization failed:',err);return{learning:legacyLearning,mistakes:legacyMistakes}}
}
const initialPersistentState=await initializePersistentState();
let learningStats=initialPersistentState.learning;
let mistakeBank=new Map(Object.entries(initialPersistentState.mistakes));
function saveMistakeBank(){const obj=Object.fromEntries(mistakeBank);try{localStorage.setItem(MISTAKE_BANK_KEY,JSON.stringify(obj))}catch{}if(appDb)queueStorageWrite(()=>idbReplaceStore('mistakes',mistakeRowsFromObject(obj)))}
function saveLearningStats(id=null){try{localStorage.setItem(LEARNING_STATS_KEY,JSON.stringify(learningStats))}catch{}if(!appDb)return;if(id&&learningStats[id])queueStorageWrite(()=>idbPut('learning_stats',{id,...learningStats[id]}));else queueStorageWrite(()=>idbReplaceStore('learning_stats',learningRowsFromObject(learningStats)))}
async function requestPersistentStorage(){try{if(!navigator.storage?.persist)return false;persistentStorageGranted=navigator.storage.persisted?await navigator.storage.persisted():false;if(!persistentStorageGranted)persistentStorageGranted=await navigator.storage.persist();return persistentStorageGranted}catch{return false}}
void requestPersistentStorage();
function learningQuestionId(q){if(q?.type!=='vocabulary')return null;if(q.learning_id)return q.learning_id;const surface=q.persistent_surface||q.prompt||'',answers=[...(q.accepted_answers||[])].map(hira).filter(Boolean).sort();return `VOCAB:${surface}|${answers.join('/')}`}
function learningStatsFor(q){const id=learningQuestionId(q);return id?learningStats[id]||null:null}
function recordLearningResult(q,correct){const id=learningQuestionId(q);if(!id||sessionLearningRecordedIds.has(id))return;sessionLearningRecordedIds.add(id);const prev=learningStats[id]||{},reviews=Math.max(0,Number(prev.reviews)||0),correctCount=Math.max(0,Number(prev.correct)||0),wrongCount=Math.max(0,Number(prev.wrong)||0),streak=Math.max(0,Number(prev.correct_streak)||0),now=Date.now();learningStats[id]={reviews:reviews+1,correct:correctCount+(correct?1:0),wrong:wrongCount+(correct?0:1),correct_streak:correct?streak+1:0,last_seen_at:now,last_wrong_at:correct?(prev.last_wrong_at||null):now,last_result:correct?'correct':'wrong'};saveLearningStats(id)}
function smoothedAccuracy(s){const reviews=Math.max(0,Number(s?.reviews)||0),correct=Math.max(0,Number(s?.correct)||0);return(correct+1)/(reviews+2)}
function vocabPriority(q,now=Date.now()){const s=learningStatsFor(q)||{},reviews=Math.max(0,Number(s.reviews)||0),difficulty=1-smoothedAccuracy(s),lowExposure=1/Math.sqrt(reviews+1),newBonus=reviews===0?1:0,lastSeen=Number(s.last_seen_at)||0,daysSinceLastSeen=lastSeen?Math.max(0,now-lastSeen)/86400000:0,staleness=reviews===0?0:Math.min(daysSinceLastSeen/30,1),recentWrong=s.last_result==='wrong'?1:0;return Math.min(7,Math.max(1,1+2.5*difficulty+1.5*lowExposure+2.5*newBonus+staleness+recentWrong))}
function weightedSampleCore(items,count,now=Date.now()){if(count<=0)return[];if(count>=items.length)return items.slice();return items.map(item=>({item,key:-Math.log(Math.max(Math.random(),Number.MIN_VALUE))/vocabPriority(item,now)})).sort((a,b)=>a.key-b.key).slice(0,count).map(x=>x.item)}
function activeVocabMistake(q){const exact=mistakeBank.get(persistentQuestionId(q));if(exact)return exact;return q.persistent_surface?mistakeBank.get(`VOCAB:${q.persistent_surface}`)||null:null}
function weightedVocabSample(items,count){if(count>=items.length)return items.slice();const now=Date.now(),reserveLimit=Math.min(count,Math.max(1,Math.ceil(count*.25))),active=items.filter(item=>activeVocabMistake(item)),reserved=weightedSampleCore(active,Math.min(reserveLimit,active.length),now),reservedIds=new Set(reserved.map(item=>learningQuestionId(item)||item.question_id)),rest=items.filter(item=>!reservedIds.has(learningQuestionId(item)||item.question_id)),fill=weightedSampleCore(rest,count-reserved.length,now);return[...reserved,...fill]}



let dictionaryTab='kanji',dictionaryLimit=120,practiceViewBeforeDictionary='setup',dictionaryCurrentEntry=null,dictionaryHistory=[],dictionaryPracticeKanjiIndex=null;

function dictionaryLessonMatch(item,filter){
  if(!filter||filter==='all')return true;
  if(filter.startsWith('book:'))return Number(item.book)===Number(filter.slice(5));
  if(filter.startsWith('lesson:'))return item.lesson===filter.slice(7);
  return true
}
function dictionarySearchTerms(raw){
  const text=String(raw||'').normalize('NFKC').trim().toLowerCase(),
        compact=text.replace(/\s+/g,''),
        converted=romajiToHiragana(text,true),
        kana=hira(converted);
  return{text,compact,kana}
}
function includesDictionaryQuery(values,terms){
  if(!terms.text)return true;
  for(const value of values){
    const raw=cleanDisplayText(value).normalize('NFKC').toLowerCase(),
          compact=raw.replace(/\s+/g,''),
          kana=hira(raw);
    if(raw.includes(terms.text)||compact.includes(terms.compact)||(terms.kana&&kana.includes(terms.kana)))return true
  }
  return false
}
function dictionaryVocabId(v){
  const noteId=String(v.note_id||v.source_note_id||'').trim();
  if(noteId)return 'VOCAB_NOTE:'+noteId;
  const answers=[...(v.accepted_readings?.length?v.accepted_readings:[v.reading])].map(hira).filter(Boolean).sort();
  return 'VOCAB:'+v.surface+'|'+answers.join('/')
}
function dictionaryMistake(v){
  const id=dictionaryVocabId(v);
  return mistakeBank.has(id)||mistakeBank.has('VOCAB:'+v.surface)
}
function dictionaryStats(v){return learningStats[dictionaryVocabId(v)]||null}
function dictionaryStatus(v){
  const stats=dictionaryStats(v),review=dictionaryMistake(v);
  if(review)return{kind:'review',label:t('dictionary.badge_review'),accuracy:null};
  const reviews=Math.max(0,Number(stats?.reviews)||0),correct=Math.max(0,Number(stats?.correct)||0);
  if(!reviews)return{kind:'new',label:t('dictionary.badge_new'),accuracy:null};
  const accuracy=Math.round(correct/reviews*100);
  if(reviews>=2&&accuracy<70)return{kind:'difficult',label:t('dictionary.badge_difficult'),accuracy};
  return{kind:'learned',label:accuracy+'%',accuracy}
}
function dictionaryStatusMatch(v,filter){
  if(!filter||filter==='all')return true;
  return dictionaryStatus(v).kind===filter
}
function dictionaryFilterOptions(){
  if(!dictLessonFilter||!dictStatusFilter)return;
  const current=dictLessonFilter.value||'all',books=[...new Set(DB.quiz_lessons.map(x=>x.book))].sort((a,b)=>a-b);
  dictLessonFilter.innerHTML='';
  const add=(root,value,label)=>{const o=document.createElement('option');o.value=value;o.textContent=label;root.appendChild(o)};
  add(dictLessonFilter,'all',t('dictionary.filter_all'));
  for(const book of books){
    add(dictLessonFilter,'book:'+book,t('dictionary.filter_book',{book}));
    for(const lesson of DB.quiz_lessons.filter(x=>x.book===book))add(dictLessonFilter,'lesson:'+lesson.lesson,t('dictionary.lesson',{lesson:lesson.lesson}))
  }
  dictLessonFilter.value=[...dictLessonFilter.options].some(x=>x.value===current)?current:'all';
  const statusCurrent=dictStatusFilter.value||'all';
  dictStatusFilter.innerHTML='';
  add(dictStatusFilter,'all',t('dictionary.status_all'));
  add(dictStatusFilter,'new',t('dictionary.status_new'));
  add(dictStatusFilter,'difficult',t('dictionary.status_difficult'));
  add(dictStatusFilter,'review',t('dictionary.status_review'));
  dictStatusFilter.value=[...dictStatusFilter.options].some(x=>x.value===statusCurrent)?statusCurrent:'all'
}
function dictionaryKanjiResults(){
  const terms=dictionarySearchTerms(dictSearch?.value),filter=dictLessonFilter?.value||'all';
  return DB.kanji.filter(k=>dictionaryLessonMatch(k,filter)&&includesDictionaryQuery([
    k.character,k.polish,k.onyomi_raw,...(k.onyomi||[]),k.kunyomi_raw,...(k.kunyomi||[])
  ],terms))
}
function dictionaryVocabResults(){
  const terms=dictionarySearchTerms(dictSearch?.value),filter=dictLessonFilter?.value||'all',status=dictStatusFilter?.value||'all';
  return DB.vocabulary.filter(v=>dictionaryLessonMatch(v,filter)&&dictionaryStatusMatch(v,status)&&includesDictionaryQuery([
    v.surface,v.display_surface,v.reading,v.romaji,v.polish,...(v.accepted_readings||[])
  ],terms))
}
function dictionaryEntryButton(type,index,body){
  return '<button class="dictionary-item" type="button" data-dict-type="'+esc(type)+'" data-dict-index="'+Number(index)+'">'+body+'</button>'
}
function dictionaryKanjiListItem(k){
  const idx=DB.kanji.indexOf(k),relatedCount=DB.vocabulary.filter(v=>(v.all_kanji||[]).includes(k.character)).length;
  return dictionaryEntryButton('kanji',idx,'<span class="dictionary-kanji">'+esc(k.character)+'</span><span class="dictionary-item-copy"><b>'+esc(k.polish||'—')+'</b><small>'+esc(t('dictionary.lesson',{lesson:k.lesson}))+' · '+relatedCount+' '+esc(t('dictionary.tab_vocab').toLowerCase())+'</small></span>')
}
function dictionaryVocabBadge(v){
  const status=dictionaryStatus(v);
  return '<span class="dictionary-status '+esc(status.kind)+'">'+esc(status.label)+'</span>'
}
function dictionaryVocabListItem(v){
  const idx=DB.vocabulary.indexOf(v),reading=(v.accepted_readings?.length?v.accepted_readings:[v.reading]).filter(Boolean).join(' / ');
  return dictionaryEntryButton('vocab',idx,'<span class="dictionary-word"><b>'+esc(v.display_surface||v.surface)+'</b><span>'+esc(reading)+'</span></span><span class="dictionary-item-copy"><b>'+esc(v.polish||'—')+'</b><small>'+esc(t('dictionary.lesson',{lesson:v.lesson}))+'</small></span>'+dictionaryVocabBadge(v))
}
function renderDictionary(){
  if(!dictList)return;
  const rows=dictionaryTab==='kanji'?dictionaryKanjiResults():dictionaryVocabResults(),shown=rows.slice(0,dictionaryLimit);
  dictList.classList.toggle('kanji-list',dictionaryTab==='kanji');
  dictList.innerHTML=shown.length?(dictionaryTab==='kanji'?shown.map(dictionaryKanjiListItem):shown.map(dictionaryVocabListItem)).join(''):'<div class="dictionary-empty">'+esc(t('dictionary.no_results'))+'</div>';
  dictCount.textContent=shown.length<rows.length?t('dictionary.result_count',{shown:shown.length,total:rows.length}):t('dictionary.result_count_all',{total:rows.length});
  dictMore.classList.toggle('hidden',shown.length>=rows.length)
}
function setDictionaryTab(tab){
  dictionaryTab=tab==='vocab'?'vocab':'kanji';dictionaryLimit=120;dictionaryHistory=[];dictionaryCurrentEntry=null;
  dictTabKanji.classList.toggle('active',dictionaryTab==='kanji');dictTabVocab.classList.toggle('active',dictionaryTab==='vocab');
  dictTabKanji.setAttribute('aria-selected',String(dictionaryTab==='kanji'));dictTabVocab.setAttribute('aria-selected',String(dictionaryTab==='vocab'));
  dictStatusFilter.classList.toggle('hidden',dictionaryTab!=='vocab');
  showDictionaryBrowse(true);renderDictionary()
}
function showDictionaryBrowse(clearHistory=false){
  if(clearHistory){dictionaryHistory=[];dictionaryCurrentEntry=null}
  dictionaryDetail.classList.add('hidden');dictionaryBrowse.classList.remove('hidden');
  const backButton=$('#dictBack');if(backButton)backButton.textContent=t('dictionary.back_history')
}
function dictionarySetDetailEntry(entry,pushHistory=true){
  if(pushHistory&&dictionaryCurrentEntry)dictionaryHistory.push(dictionaryCurrentEntry);
  dictionaryCurrentEntry=entry;
  dictionaryBrowse.classList.add('hidden');dictionaryDetail.classList.remove('hidden');
  const backButton=$('#dictBack');if(backButton)backButton.textContent=t('dictionary.back_history');
  dictionary.scrollIntoView({block:'start'})
}

const KANJIVG_REVISION='70a0b7ae0c18ceb5cb358274b029cce0234a43bc';
const KANJIVG_RAW_BASE='https://raw.githubusercontent.com/KanjiVG/kanjivg/'+KANJIVG_REVISION+'/kanji/';
let strokeOrderAnimationToken=0;

function kanjiVgFilename(character){
  const cp=String(character||'').codePointAt(0);
  return Number.isFinite(cp)?cp.toString(16).padStart(5,'0')+'.svg':''
}
function kanjiVgUrl(character){
  const filename=kanjiVgFilename(character);
  return filename?KANJIVG_RAW_BASE+filename:''
}
function strokeOrderSectionHtml(k){
  return '<section class="dictionary-stroke-order" id="dictionaryStrokeOrder">'+
    '<div class="dictionary-stroke-head"><div class="dictionary-related-title">'+esc(t('dictionary.stroke_order'))+'</div>'+
      '<button id="strokeReplay" class="mini-btn hidden" type="button">'+esc(t('dictionary.stroke_replay'))+'</button></div>'+
    '<div id="dictionaryStrokeCanvas" class="dictionary-stroke-card" aria-live="polite">'+
      '<div class="dictionary-stroke-loading">'+esc(t('dictionary.stroke_loading'))+'</div>'+
    '</div>'+
    '<div class="dictionary-stroke-attribution">'+t('dictionary.stroke_attribution_html')+'</div>'+
  '</section>'
}
const STROKE_GRADIENT_PALETTE=['#ef4444','#f97316','#f59e0b','#eab308','#84cc16','#22c55e','#14b8a6','#06b6d4','#3b82f6','#6366f1','#8b5cf6','#a855f7','#d946ef','#ec4899'];
function strokeGradientColor(index,total){
  if(total<=1)return STROKE_GRADIENT_PALETTE[0];
  const pos=index/(total-1),slot=Math.round(pos*(STROKE_GRADIENT_PALETTE.length-1));
  return STROKE_GRADIENT_PALETTE[Math.max(0,Math.min(STROKE_GRADIENT_PALETTE.length-1,slot))]
}
function setStrokeColor(path,color){
  path.setAttribute('stroke',color);
  path.style.setProperty('stroke',color,'important')
}
function prepareKanjiVgSvg(svg){
  svg.removeAttribute('width');svg.removeAttribute('height');
  svg.classList.add('dictionary-kanjivg-svg');
  const strokeRoot=svg.querySelector('[id*="StrokePaths"]');
  const paths=[...(strokeRoot?.querySelectorAll('path')||[])];
  const numbers=[...svg.querySelectorAll('[id*="StrokeNumbers"] text')];
  if(strokeRoot){
    strokeRoot.style.removeProperty('stroke');
    strokeRoot.removeAttribute('stroke');
  }
  numbers.forEach(x=>x.classList.add('dictionary-stroke-number'));
  paths.forEach((path,i)=>{
    path.classList.add('dictionary-stroke-path');
    path.dataset.strokeIndex=String(i);
    const length=Math.max(1,path.getTotalLength());
    path.style.strokeDasharray=String(length);
    path.style.strokeDashoffset=String(length);
    path.style.opacity='0.14'
  });
  return paths
}
function resetStrokePaths(paths,mode){
  for(const path of paths){
    path.getAnimations?.().forEach(a=>a.cancel());
    const length=Math.max(1,path.getTotalLength());
    path.style.strokeDasharray=String(length);
    path.style.strokeDashoffset=String(length);
    path.style.opacity='0.14';
    setStrokeColor(path,mode==='active'?'#cbd0d7':'#222')
  }
}
function animateKanjiVg(svg){
  const token=++strokeOrderAnimationToken,paths=[...svg.querySelectorAll('.dictionary-stroke-path')],mode=strokeAnimationMode();
  resetStrokePaths(paths,mode);
  const run=(i)=>{
    if(token!==strokeOrderAnimationToken||i>=paths.length)return;
    const path=paths[i],length=Math.max(1,path.getTotalLength());
    if(mode==='active'){
      paths.forEach((p,j)=>{
        if(j<i){setStrokeColor(p,'#222');p.style.opacity='1';p.style.strokeDashoffset='0'}
        else if(j>i){setStrokeColor(p,'#cbd0d7');p.style.opacity='0.32'}
      });
      setStrokeColor(path,'#e53935');
    }else{
      setStrokeColor(path,strokeGradientColor(i,paths.length))
    }
    path.style.opacity='1';
    const anim=path.animate(
      [{strokeDashoffset:String(length)},{strokeDashoffset:'0'}],
      {duration:540,easing:'ease-out',fill:'forwards'}
    );
    anim.onfinish=()=>{
      if(token!==strokeOrderAnimationToken)return;
      path.style.strokeDashoffset='0';
      path.style.opacity='1';
      if(mode==='active')setStrokeColor(path,'#222');
      run(i+1)
    }
  };
  run(0)
}
async function loadStrokeOrder(k){
  const canvas=$('#dictionaryStrokeCanvas'),replay=$('#strokeReplay');
  if(!canvas)return;
  const url=kanjiVgUrl(k.character);
  if(!url){canvas.innerHTML='<div class="dictionary-empty">'+esc(t('dictionary.stroke_unavailable'))+'</div>';return}
  try{
    const response=await fetch(url);
    if(!response.ok)throw new Error('KanjiVG HTTP '+response.status);
    const source=await response.text();
    if(!canvas.isConnected)return;
    const doc=new DOMParser().parseFromString(source,'image/svg+xml');
    const svg=doc.documentElement;
    if(svg.nodeName.toLowerCase()!=='svg'||doc.querySelector('parsererror'))throw new Error('Invalid KanjiVG SVG');
    canvas.innerHTML='';
    const adopted=document.importNode(svg,true);
    canvas.appendChild(adopted);
    const paths=prepareKanjiVgSvg(adopted);
    if(!paths.length)throw new Error('No stroke paths');
    replay?.classList.remove('hidden');
    replay?.addEventListener('click',()=>animateKanjiVg(adopted));
    requestAnimationFrame(()=>animateKanjiVg(adopted))
  }catch(err){
    console.warn('KanjiVG load failed:',err);
    if(canvas.isConnected)canvas.innerHTML='<div class="dictionary-empty">'+esc(t('dictionary.stroke_unavailable'))+'</div>'
  }
}
function openKanjiDetail(k,index=DB.kanji.indexOf(k),pushHistory=true){
  if(!k)return;
  const related=DB.vocabulary.filter(v=>(v.all_kanji||[]).includes(k.character)).sort((a,b)=>(a.lesson_order||0)-(b.lesson_order||0)||(a.surface||'').localeCompare(b.surface||'','ja'));
  const on=(k.onyomi_display||k.onyomi||[]).join('、')||'—',kun=(k.kunyomi_display||k.kunyomi||[]).join('、')||'—';
  const relatedHtml=related.length?related.map(dictionaryVocabListItem).join(''):'<div class="dictionary-empty">'+esc(t('dictionary.no_related_vocab'))+'</div>';
  dictDetailContent.innerHTML=
    '<div class="dictionary-kanji-detail">'+
      '<div class="dictionary-kanji-hero">'+esc(k.character)+'</div>'+
      '<div class="dictionary-detail-meaning">'+esc(k.polish||'—')+'</div>'+
      '<div class="dictionary-detail-lesson">'+esc(t('dictionary.lesson',{lesson:k.lesson}))+'</div>'+
      '<div class="dictionary-reading-grid">'+
        '<div><small>'+esc(t('dictionary.on'))+'</small><b>'+esc(on)+'</b></div>'+
        '<div><small>'+esc(t('dictionary.kun'))+'</small><b>'+esc(kun)+'</b></div>'+
      '</div>'+
      strokeOrderSectionHtml(k)+
      (related.length?'<button class="primary dictionary-practice" type="button" data-dict-practice-kanji="'+Number(index)+'">'+esc(t('dictionary.practice_related'))+' <span>'+esc(t('dictionary.practice_related_count',{count:related.length}))+'</span></button>':'')+
      '<div class="dictionary-related-title">'+esc(t('dictionary.related_vocab'))+' <span>'+related.length+'</span></div>'+
      '<div class="dictionary-list">'+relatedHtml+'</div>'+
    '</div>';
  dictionarySetDetailEntry({type:'kanji',index:Number(index)},pushHistory);
  loadStrokeOrder(k)
}
function openVocabDetail(v,index=DB.vocabulary.indexOf(v),pushHistory=true){
  if(!v)return;
  const readings=(v.accepted_readings?.length?v.accepted_readings:[v.reading]).filter(Boolean).join(' / ')||'—',stats=dictionaryStats(v),status=dictionaryStatus(v);
  let statsHtml='<div class="dictionary-learning-empty">'+esc(t('dictionary.new_word'))+'</div>';
  if(stats){
    const reviews=Math.max(0,Number(stats.reviews)||0),correct=Math.max(0,Number(stats.correct)||0),wrong=Math.max(0,Number(stats.wrong)||0),accuracy=reviews?Math.round(correct/reviews*100):0;
    statsHtml='<div class="dictionary-learning-stats">'+esc(t('dictionary.learning_stats',{reviews,correct,wrong,accuracy}))+'</div>'
  }
  const chars=(v.all_kanji||[]).map(ch=>DB.kanji.find(k=>k.character===ch)).filter(Boolean);
  const kanjiLinks=chars.length?'<div class="dictionary-vocab-kanji">'+chars.map(k=>'<button type="button" class="dictionary-kanji-chip" data-dict-type="kanji" data-dict-index="'+DB.kanji.indexOf(k)+'">'+esc(k.character)+'</button>').join('')+'</div>':'';
  dictDetailContent.innerHTML=
    '<div class="dictionary-vocab-detail">'+
      '<div class="dictionary-vocab-hero">'+esc(v.display_surface||v.surface)+'</div>'+
      '<div class="dictionary-detail-reading">'+esc(readings)+'</div>'+
      '<div class="dictionary-detail-meaning">'+esc(v.polish||'—')+'</div>'+
      '<div class="dictionary-detail-lesson">'+esc(t('dictionary.lesson',{lesson:v.lesson}))+'</div>'+
      '<div class="dictionary-detail-status">'+dictionaryVocabBadge(v)+'</div>'+
      kanjiLinks+
      '<div class="dictionary-learning-box">'+
        '<div class="dictionary-learning-head"><b>'+esc(t('dictionary.learning'))+'</b></div>'+
        statsHtml+
      '</div>'+
    '</div>';
  dictionarySetDetailEntry({type:'vocab',index:Number(index)},pushHistory)
}
function openDictionaryEntry(type,index,pushHistory=true){
  if(type==='kanji')openKanjiDetail(DB.kanji[Number(index)],Number(index),pushHistory);
  else if(type==='vocab')openVocabDetail(DB.vocabulary[Number(index)],Number(index),pushHistory)
}
function dictionaryBack(){
  const previous=dictionaryHistory.pop();
  if(previous){dictionaryCurrentEntry=null;openDictionaryEntry(previous.type,previous.index,false)}
  else showDictionaryBrowse(true)
}
function dictionaryVocabQuestion(v){
  const noteId=String(v.note_id||v.source_note_id||'').trim(),visible=v.display_surface||v.surface,stableId=dictionaryVocabId(v);
  const answers=[...(v.accepted_readings?.length?v.accepted_readings:[v.reading])].filter(Boolean);
  return{question_id:'DICT:'+stableId,persistent_id:stableId,persistent_surface:v.surface,persistent_note_id:noteId||null,learning_id:stableId,type:'vocabulary',prompt:visible,prompt_html:esc(visible),accepted_answers:[...answers],answer_display:[...answers],meanings:v.polish?[v.polish]:[],target_kanji:[...(v.all_kanji||[])]}
}
function dictionaryPracticeItems(k){
  return DB.vocabulary.filter(v=>(v.all_kanji||[]).includes(k.character)).map(dictionaryVocabQuestion).filter(q=>q.accepted_answers.length)
}
function startDictionaryKanjiPractice(index){
  const k=DB.kanji[Number(index)];if(!k)return;
  const items=dictionaryPracticeItems(k);if(!items.length){alert(t('dictionary.practice_empty'));return}
  dictionaryPracticeKanjiIndex=Number(index);
  dictionary.classList.add('hidden');navPractice.classList.add('active');navDictionary.classList.remove('active');
  beginSession(items,'dictionary')
}
function returnToDictionaryPracticeSource(){
  quiz.classList.add('hidden');finished.classList.add('hidden');setup.classList.add('hidden');reviewBank.classList.add('hidden');
  dictionary.classList.remove('hidden');navPractice.classList.remove('active');navDictionary.classList.add('active');
  if(Number.isInteger(dictionaryPracticeKanjiIndex))openKanjiDetail(DB.kanji[dictionaryPracticeKanjiIndex],dictionaryPracticeKanjiIndex,false);
  else showDictionaryBrowse()
}
function visiblePracticeSection(){
  for(const el of [setup,reviewBank,quiz,finished])if(el&&!el.classList.contains('hidden'))return el.id;
  return 'setup'
}
function setMainNav(which){
  const useDictionary=which==='dictionary';
  navPractice.classList.toggle('active',!useDictionary);navDictionary.classList.toggle('active',useDictionary);
  if(useDictionary){
    practiceViewBeforeDictionary=visiblePracticeSection();
    for(const el of [setup,reviewBank,quiz,finished])el?.classList.add('hidden');
    dictionary.classList.remove('hidden');showDictionaryBrowse(true);renderDictionary()
  }else{
    dictionary.classList.add('hidden');
    for(const el of [setup,reviewBank,quiz,finished])el?.classList.add('hidden');
    const restore=document.getElementById(practiceViewBeforeDictionary)||setup;restore.classList.remove('hidden')
  }
}
function initDictionary(){
  dictionaryFilterOptions();dictStatusFilter.classList.add('hidden');renderDictionary();
  navPractice?.addEventListener('click',()=>setMainNav('practice'));navDictionary?.addEventListener('click',()=>setMainNav('dictionary'));
  dictTabKanji?.addEventListener('click',()=>setDictionaryTab('kanji'));dictTabVocab?.addEventListener('click',()=>setDictionaryTab('vocab'));
  dictSearch?.addEventListener('input',()=>{dictionaryLimit=120;renderDictionary()});
  dictLessonFilter?.addEventListener('change',()=>{dictionaryLimit=120;renderDictionary()});
  dictStatusFilter?.addEventListener('change',()=>{dictionaryLimit=120;renderDictionary()});
  dictMore?.addEventListener('click',()=>{dictionaryLimit+=120;renderDictionary()});
  $('#dictBack')?.addEventListener('click',dictionaryBack);
  dictionary?.addEventListener('click',e=>{
    const practice=e.target.closest('[data-dict-practice-kanji]');if(practice){startDictionaryKanjiPractice(practice.dataset.dictPracticeKanji);return}
    const button=e.target.closest('[data-dict-type][data-dict-index]');if(button)openDictionaryEntry(button.dataset.dictType,button.dataset.dictIndex)
  })
}
initDictionary();

function persistentQuestionId(q){return q?.persistent_id||q?.question_id||`${q?.type||'q'}:${q?.prompt||''}`}
function snapshotQuestion(q){return{id:persistentQuestionId(q),type:q.type,persistent_surface:q.persistent_surface||null,persistent_note_id:q.persistent_note_id||null,disambiguation:q.disambiguation||'',prompt:q.prompt,prompt_html:q.prompt_html||esc(q.prompt),target_kanji:[...(q.target_kanji||[])],accepted_answers:[...(q.accepted_answers||[])],answer_display:[...(q.answer_display||[])],meanings:[...(q.meanings||[])]}}
function resolveMistakeQuestion(rec){
  if(!rec||!rec.id)return null;
  if(rec.type==='onyomi'||rec.type==='kunyomi'){
    const k=DB.kanji.find(x=>x.character===rec.prompt);if(!k)return null;
    const isOn=rec.type==='onyomi',answers=isOn?k.onyomi_accepted:k.kunyomi_accepted,display=isOn?(k.onyomi_display||k.onyomi):(k.kunyomi_display||k.kunyomi);
    if(!answers?.length)return null;
    return{question_id:rec.id,persistent_id:rec.id,type:rec.type,prompt:k.character,prompt_html:esc(k.character),accepted_answers:[...answers],answer_display:[...(display||answers)],meanings:k.polish?[k.polish]:[],target_kanji:[k.character]}
  }
  if(rec.type==='vocabulary'){
    const noteId=rec.persistent_note_id||(String(rec.id).startsWith('VOCAB_NOTE:')?String(rec.id).slice(11):null);
    const surface=rec.persistent_surface||(String(rec.id).startsWith('VOCAB:')?String(rec.id).slice(6):null);
    const rows=noteId?DB.vocabulary.filter(v=>String(v.note_id||v.source_note_id||'')===String(noteId)):DB.vocabulary.filter(v=>v.surface===surface);
    if(!rows.length)return null;
    const accepted=[],display=[],meanings=[],targets=new Set(rec.target_kanji||[]);
    for(const v of rows){for(const a of (v.accepted_readings?.length?v.accepted_readings:[v.reading])){if(a&&!accepted.includes(a))accepted.push(a);if(a&&!display.includes(a))display.push(a)}if(v.polish&&!meanings.includes(v.polish))meanings.push(v.polish);if(!targets.size)for(const k of (v.all_kanji||[]))targets.add(k)}
    if(!accepted.length)return null;
    const first=rows[0],visible=first.display_surface||first.surface,known=furiganaMode()==='chapter'?(furiganaKnownSet()||targets):targets,rendered=renderVocab(first,targets,known);
    return{question_id:rec.id,persistent_id:rec.id,persistent_surface:first.surface,persistent_note_id:noteId||null,disambiguation:rec.disambiguation||'',type:'vocabulary',prompt:visible,prompt_html:rendered.unsafe?(rec.prompt_html||esc(visible)):rendered.html,accepted_answers:accepted,answer_display:display,meanings,target_kanji:[...targets]}
  }
  return null
}
function resolvedMistakeEntries(){
  const out=[];let changed=false;
  for(const [id,rec] of mistakeBank){const q=resolveMistakeQuestion(rec);if(!q){mistakeBank.delete(id);changed=true;continue}out.push({record:rec,question:q})}
  if(changed)saveMistakeBank();
  return out.sort((a,b)=>(b.record.wrong_count||0)-(a.record.wrong_count||0)||(b.record.last_wrong_at||0)-(a.record.last_wrong_at||0))
}
function recordPersistentWrong(q){
  const id=persistentQuestionId(q),prev=mistakeBank.get(id)||{},snap=snapshotQuestion(q);
  sessionWrongIds.add(id);
  mistakeBank.set(id,{...prev,...snap,wrong_count:(prev.wrong_count||0)+1,correct_streak:0,last_wrong_at:Date.now()});
  saveMistakeBank();refreshReviewUI()
}
function recordPersistentCorrect(q){
  const id=persistentQuestionId(q),prev=mistakeBank.get(id);if(!prev)return;
  if(sessionWrongIds.has(id)||sessionCreditedIds.has(id))return;
  sessionCreditedIds.add(id);
  const next=(prev.correct_streak||0)+1;
  if(next>=2)mistakeBank.delete(id);else mistakeBank.set(id,{...prev,correct_streak:next,last_correct_at:Date.now()});
  saveMistakeBank();refreshReviewUI()
}
function renderReviewList(entries){
  if(!reviewBankList)return;reviewBankList.innerHTML='';
  for(const {record,question:q} of entries){const item=document.createElement('div');item.className='review-item';item.innerHTML=`<div class="review-item-main"><div class="review-item-head"><div class="review-item-prompt">${q.prompt_html||esc(q.prompt)}</div><span class="review-type">${esc(typeName(q.type))}</span></div><div class="review-answer">${esc(t('review.answer',{answer:answerText(q)}))}</div>${rawMeaning(q)?`<div class="review-meaning">${esc(rawMeaning(q))}</div>`:''}</div><div class="review-meta">${esc(t('review.item_meta',{wrong:record.wrong_count||0,streak:record.correct_streak||0}))}</div>`;reviewBankList.appendChild(item)}
}
function refreshReviewUI(){
  const entries=resolvedMistakeEntries(),count=entries.length,label=t('review.count',{count});
  reviewCard?.classList.toggle('hidden',count===0);if(reviewCardCount)reviewCardCount.textContent=label;if(reviewBankCount)reviewBankCount.textContent=label;
  renderReviewList(entries);return entries
}
function reviewQuestions(){return resolvedMistakeEntries().map(x=>({...x.question}))}

function cleanRecordObject(value){if(!value||typeof value!=='object'||Array.isArray(value))return{};const out={};for(const [k,v] of Object.entries(value))if(v&&typeof v==='object'&&!Array.isArray(v))out[k]=v;return out}
function learningReviewTotal(){return Object.values(learningStats).reduce((sum,s)=>sum+Math.max(0,Number(s?.reviews)||0),0)}
function renderDataBackupSummary(){const el=$('#dataBackupSummary');if(!el)return;el.textContent=t('settings.data_summary',{items:Object.keys(learningStats).length,reviews:learningReviewTotal(),mistakes:mistakeBank.size})}
function setDataBackupStatus(key){const el=$('#dataBackupStatus');if(!el)return;if(!key){el.classList.add('hidden');el.textContent='';return}el.textContent=t(key);el.classList.remove('hidden')}
function backupPayload(){return{format:'wsjj-kanji-pro-backup',schema_version:1,app_version:'3.6',exported_at:new Date().toISOString(),data:{learning_stats:learningStats,mistake_bank:Object.fromEntries(mistakeBank),settings:{font:savedFontProfile(),answer_mode:savedAnswerMode(),stroke_animation_mode:savedStrokeAnimationMode(),session_prefs:loadSessionPrefs()}}}}
function exportLearningData(){const json=JSON.stringify(backupPayload(),null,2),blob=new Blob([json],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a'),date=new Date().toISOString().slice(0,10);a.href=url;a.download=`wsjj-kanji-pro-backup-${date}.json`;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);setDataBackupStatus('settings.export_done')}
async function importLearningData(file){
  if(!file)return;if(file.size>10*1024*1024){setDataBackupStatus('settings.import_invalid');return}
  try{
    const parsed=JSON.parse(await file.text());
    if(parsed?.format!=='wsjj-kanji-pro-backup'||parsed?.schema_version!==1||!parsed.data)throw new Error('format');
    const nextLearning=cleanRecordObject(parsed.data.learning_stats),nextMistakes=cleanRecordObject(parsed.data.mistake_bank);
    if(!confirm(t('settings.import_confirm')))return;
    await storageWriteQueue;
    learningStats=nextLearning;mistakeBank=new Map(Object.entries(nextMistakes));
    try{
      localStorage.setItem(LEARNING_STATS_KEY,JSON.stringify(learningStats));
      localStorage.setItem(MISTAKE_BANK_KEY,JSON.stringify(Object.fromEntries(mistakeBank)));
      const settings=parsed.data.settings||{};
      if(typeof settings.font==='string')localStorage.setItem(FONT_STORAGE_KEY,settings.font);
      if(settings.answer_mode==='one'||settings.answer_mode==='two')localStorage.setItem(ANSWER_MODE_STORAGE_KEY,settings.answer_mode);
      if(settings.stroke_animation_mode==='gradient'||settings.stroke_animation_mode==='active')localStorage.setItem(STROKE_ANIMATION_MODE_KEY,settings.stroke_animation_mode);
      if(settings.session_prefs&&typeof settings.session_prefs==='object'&&!Array.isArray(settings.session_prefs))localStorage.setItem(SESSION_PREFS_KEY,JSON.stringify(settings.session_prefs));
    }catch{}
    if(appDb)await Promise.all([idbReplaceStore('learning_stats',learningRowsFromObject(learningStats)),idbReplaceStore('mistakes',mistakeRowsFromObject(Object.fromEntries(mistakeBank))),idbPut('meta',{key:'last_import',imported_at:Date.now()})]);
    setDataBackupStatus('settings.import_done');setTimeout(()=>window.location.reload(),350)
  }catch(err){console.warn('Backup import failed:',err);setDataBackupStatus('settings.import_invalid')}
}
function initDataBackupSettings(){
  const exportBtn=$('#exportData'),importBtn=$('#importData'),fileInput=$('#importDataFile');
  exportBtn?.addEventListener('click',()=>{renderDataBackupSummary();exportLearningData()});
  importBtn?.addEventListener('click',()=>{setDataBackupStatus(null);fileInput?.click()});
  fileInput?.addEventListener('change',async()=>{const file=fileInput.files?.[0];fileInput.value='';await importLearningData(file)});
  $('#openSettings')?.addEventListener('click',()=>{renderDataBackupSummary();setDataBackupStatus(null)});
  renderDataBackupSummary()
}

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
function furiganaLesson(){return lessonMap.get(furiganaLessonSelect.value)||null}
function latestSelectedKanjiLesson(){
  const items=[...selectedKanji()].map(k=>kanjiLessonMap.get(k)).filter(Boolean);
  return items.length?items.sort((a,b)=>a.lesson_order-b.lesson_order).at(-1):null;
}
function setDefaultFuriganaChapter(force=false){
  if(!force&&furiganaChapterManual)return;
  const l=latestSelectedKanjiLesson() || selectedLessons().at(-1) || DB.quiz_lessons[0];
  if(!l)return;
  furiganaLessonSelect.value=l.lesson;
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
function buildVocabPool(){const targets=selectedKanji(),order=vocabMaxOrder(),known=furiganaKnownSet();if(!targets.size||!order||!known)return[];const grouped=new Map();for(const v of DB.vocabulary){if((v.lesson_order||0)>order)continue;if(!(v.all_kanji||[]).some(k=>targets.has(k)))continue;const r=renderVocab(v,targets,known);if(r.unsafe)continue;const visibleSurface=v.display_surface||v.surface,noteId=String(v.note_id||v.source_note_id||'').trim(),key=(noteId||v.surface)+'\u0000'+visibleSurface+'\u0000'+r.html;let q=grouped.get(key);if(!q){const stableId=noteId?`VOCAB_NOTE:${noteId}`:`VOCAB:${v.surface}|${[...(v.accepted_readings?.length?v.accepted_readings:[v.reading])].map(hira).filter(Boolean).sort().join('/')}`;q={question_id:`VOCAB:${key}`,persistent_id:stableId,persistent_surface:v.surface,persistent_note_id:noteId||null,learning_id:stableId,type:'vocabulary',prompt:visibleSurface,prompt_html:r.html,accepted_answers:[],answer_display:[],meanings:[],target_kanji:[]};grouped.set(key,q)}for(const a of (v.accepted_readings?.length?v.accepted_readings:[v.reading]))if(a&&!q.accepted_answers.includes(a))q.accepted_answers.push(a);for(const a of (v.accepted_readings?.length?v.accepted_readings:[v.reading]))if(a&&!q.answer_display.includes(a))q.answer_display.push(a);if(v.polish&&!q.meanings.includes(v.polish))q.meanings.push(v.polish);for(const k of (v.all_kanji||[]))if(targets.has(k)&&!q.target_kanji.includes(k))q.target_kanji.push(k)}const out=[...grouped.values()],byPrompt=new Map();for(const q of out){const sig=[...q.accepted_answers].map(hira).filter(Boolean).sort().join('/');if(!byPrompt.has(q.prompt))byPrompt.set(q.prompt,new Set());byPrompt.get(q.prompt).add(sig)}for(const q of out){if((byPrompt.get(q.prompt)?.size||0)>1)q.disambiguation=q.meanings.join(' · ')}return out}
function buildReadingPools(){const targets=selectedKanji();const on=[],kun=[];for(const k of DB.kanji){if(!targets.has(k.character))continue;if(k.onyomi_accepted?.length)on.push({question_id:`ON:${k.character}`,persistent_id:`ON:${k.character}`,type:'onyomi',prompt:k.character,prompt_html:esc(k.character),accepted_answers:k.onyomi_accepted,answer_display:k.onyomi_display||k.onyomi,meanings:k.polish?[k.polish]:[],target_kanji:[k.character]});if(k.kunyomi_accepted?.length)kun.push({question_id:`KUN:${k.character}`,persistent_id:`KUN:${k.character}`,type:'kunyomi',prompt:k.character,prompt_html:esc(k.character),accepted_answers:k.kunyomi_accepted,answer_display:k.kunyomi_display||k.kunyomi,meanings:k.polish?[k.polish]:[],target_kanji:[k.character]})}return{on,kun}}
function desiredVocabCount(poolLen){const mode=document.querySelector('input[name="vocabLimitMode"]:checked')?.value||'all';if(mode==='all')return poolLen;const n=Math.max(1,parseInt(vocabLimit.value,10)||1);return Math.min(n,poolLen)}
function poolCounts(){const r=buildReadingPools(),v=buildVocabPool();return{on:r.on.length,kun:r.kun.length,v:v.length,vChosen:desiredVocabCount(v.length)}}
function updatePreview(){const ls=selectedLessons(),ks=selectedKanji(),m=selectedModes();if(kanjiSelectionSummary)kanjiSelectionSummary.textContent=t('setup.kanji_selected',{count:ks.size});const c=poolCounts();const pieces=[];if(m.includes('onyomi'))pieces.push(t('vocab.preview_on',{count:c.on}));if(m.includes('kunyomi'))pieces.push(t('vocab.preview_kun',{count:c.kun}));if(m.includes('vocabulary'))pieces.push(c.vChosen===c.v?t('vocab.preview_vocab_all',{count:c.v}):t('vocab.preview_vocab_limited',{chosen:c.vChosen,total:c.v}));sessionPreview.textContent=ls.length?t('vocab.preview',{lessons:ls.length,kanji:ks.size,session:pieces.join(' · ')||t('vocab.preview_no_mode')}):t('vocab.preview_no_lessons')}
function beginSession(items,kind='normal'){sessionKind=kind;queue=shuffle(items.map(x=>({...x})));stats={correct:0,wrong:0,attempts:0,initial:queue.length};mistakeLog=new Map();sessionWrongIds=new Set();sessionCreditedIds=new Set();sessionLearningRecordedIds=new Set();setup.classList.add('hidden');reviewBank.classList.add('hidden');finished.classList.add('hidden');dictionary?.classList.add('hidden');quiz.classList.remove('hidden');$('#quit').textContent=t(kind==='review'?'review.quiz_back':kind==='dictionary'?'dictionary.back':'quiz.back');showQuestion()}
function showSetupScreen(){hideAnswerNotice();quiz.classList.add('hidden');finished.classList.add('hidden');reviewBank.classList.add('hidden');setup.classList.remove('hidden');refreshReviewUI();updatePreview()}
function showReviewBank(){hideAnswerNotice();const entries=refreshReviewUI();if(!entries.length){showSetupScreen();return}setup.classList.add('hidden');quiz.classList.add('hidden');finished.classList.add('hidden');reviewBank.classList.remove('hidden')}
function startReview(){hideAnswerNotice();const items=reviewQuestions();if(!items.length){showSetupScreen();return}beginSession(items,'review')}
function restartSession(){if(sessionKind==='review'){if(reviewQuestions().length)startReview();else showSetupScreen()}else if(sessionKind==='dictionary'&&Number.isInteger(dictionaryPracticeKanjiIndex)){startDictionaryKanjiPractice(dictionaryPracticeKanjiIndex)}else start()}
function finishBack(){if(sessionKind==='review'&&reviewQuestions().length)showReviewBank();else if(sessionKind==='dictionary')returnToDictionaryPracticeSource();else showSetupScreen()}
function buildQueue(){const modes=selectedModes(),r=buildReadingPools();let v=buildVocabPool().slice(),q=[];if(document.querySelector('input[name="vocabLimitMode"]:checked')?.value==='limit')v=weightedVocabSample(v,desiredVocabCount(v.length));if(modes.includes('onyomi'))q.push(...r.on);if(modes.includes('kunyomi'))q.push(...r.kun);if(modes.includes('vocabulary'))q.push(...v);return shuffle(q.map(x=>({...x})))}
function focusAnswerField(){try{input.focus({preventScroll:true})}catch{input.focus()}if(document.activeElement!==input)requestAnimationFrame(()=>{try{input.focus({preventScroll:true})}catch{input.focus()}})}
function showQuestion(){if(!queue.length){showFinish();return}current=queue.shift();checked=false;input.value='';input.disabled=false;submit.textContent=t('quiz.check');typeEl.textContent=typeName(current.type);progressEl.textContent=t('quiz.progress',{count:queue.length+1});promptEl.classList.toggle('vocab',current.type==='vocabulary');promptEl.innerHTML=current.prompt_html||esc(current.prompt);const hint=current.type==='vocabulary'?String(current.disambiguation||'').trim():'';promptHint.textContent=hint;promptHint.classList.toggle('hidden',!hint);feedback.className='feedback empty';feedback.innerHTML='';updateStats();focusAnswerField()}function compareReading(s){const x=hira(s);return inputMode()==='romaji'?x.replace(/[-‐‑‒–—―−]/g,'ー').replace(/づ/g,'ず').replace(/ぢ/g,'じ'):x}function accepted(q){return(q.accepted_answers||q.answer_display||[]).map(compareReading)}function answerText(q){return(q.answer_display||q.accepted_answers||[]).join(' / ')}function rawMeaning(q){return q.meanings?.length?q.meanings.join(' · '):(q.meaning||'')}function meaningText(q){const m=rawMeaning(q);return m?esc(m):''}
function recordMistake(q,userAnswer){const key=q.question_id||`${q.type}:${q.prompt}`;let item=mistakeLog.get(key);if(!item){item={type:typeName(q.type),prompt_html:q.prompt_html||esc(q.prompt),correct:answerText(q),meaning:rawMeaning(q),answers:[]};mistakeLog.set(key,item)}const a=String(userAnswer||'').trim();if(a&&!item.answers.includes(a))item.answers.push(a)}
function hideAnswerNotice(){if(!answerNotice)return;answerNotice.classList.add('hidden');answerNotice.classList.remove('good','bad');answerNotice.textContent=''}
function showWrongNotice(wrong,correct){if(!answerNotice)return;answerNotice.classList.remove('good');answerNotice.classList.add('bad');answerNotice.textContent=t('quiz.wrong_compact',{wrong,correct});answerNotice.classList.remove('hidden')}
function showCorrectNotice(meaning){if(!answerNotice||!meaning)return;answerNotice.classList.remove('bad');answerNotice.classList.add('good');answerNotice.textContent=t('quiz.correct_compact',{meaning});answerNotice.classList.remove('hidden')}
function renderMistakeSummary(){const details=$('#mistakesDetails'),list=$('#mistakesList'),count=$('#mistakesCount');if(!details||!list||!count)return;list.innerHTML='';details.open=false;if(!mistakeLog.size){details.classList.add('hidden');count.textContent='0';return}details.classList.remove('hidden');count.textContent=String(mistakeLog.size);for(const item of mistakeLog.values()){const el=document.createElement('div');el.className='mistake-item';const yours=item.answers.map(esc).join(' · ');el.innerHTML=`<div class="mistake-head"><div class="mistake-prompt">${item.prompt_html}</div><div class="mistake-type">${esc(item.type)}</div></div><div class="mistake-answer">${esc(t('finish.mistake_correct',{answer:item.correct}))}</div>${yours?`<div class="mistake-yours">${esc(t('finish.mistake_yours',{answer:yours}))}</div>`:''}${item.meaning?`<div class="mistake-meaning">${esc(item.meaning)}</div>`:''}`;list.appendChild(el)}}
function check(advance=false){if(checked){showQuestion();return}const typedRaw=input.value;if(inputMode()==='romaji')input.value=romajiToHiragana(input.value,true);const val=compareReading(input.value);if(!val)return;checked=true;stats.attempts++;const ok=accepted(current).includes(val),correct=answerText(current),meaning=rawMeaning(current);recordLearningResult(current,ok);if(ok){stats.correct++;recordPersistentCorrect(current);if(!advance){feedback.className='feedback good';feedback.innerHTML=`<div><strong>✓ ${esc(correct)}</strong>${meaningText(current)?`<div class="meta">${meaningText(current)}</div>`:''}</div>`}}else{stats.wrong++;recordMistake(current,input.value);recordPersistentWrong(current);if(!advance){feedback.className='feedback bad';feedback.innerHTML=`<div><strong>✕ ${esc(correct)}</strong>${meaningText(current)?`<div class="meta">${meaningText(current)}</div>`:''}<div class="meta">${esc(t('quiz.your_answer',{answer:input.value}))}</div></div>`}if(sessionKind==='review')queue.push({...current});else{const min=Math.min(3,queue.length),max=Math.min(7,queue.length),pos=max?Math.floor(Math.random()*(max-min+1))+min:0;queue.splice(pos,0,{...current})}}updateStats();if(advance){showQuestion();if(ok)showCorrectNotice(meaning);else showWrongNotice(typedRaw,correct);return}input.disabled=true;submit.textContent=t('quiz.next');submit.focus()}
function updateStats(){correctEl.textContent=stats.correct;wrongEl.textContent=stats.wrong;leftEl.textContent=queue.length+(current&&!checked?1:0)}
function start(){hideAnswerNotice();saveSessionPrefs();if(!selectedLessons().length){alert(t('errors.choose_lesson'));return}if(!selectedKanji().size){alert(t('errors.choose_kanji'));return}if(!selectedModes().length){alert(t('errors.choose_mode'));return}if(furiganaMode()==='chapter'&&!furiganaLesson()){alert(t('errors.invalid_furigana'));return}const items=buildQueue();if(!items.length){alert(t('errors.empty_pool'));return}beginSession(items,'normal')}
function showFinish(){hideAnswerNotice();quiz.classList.add('hidden');finished.classList.remove('hidden');refreshReviewUI();const total=stats.correct+stats.wrong,acc=total?Math.round(stats.correct/total*100):100,remaining=resolvedMistakeEntries().length;finishTitle.textContent=t(sessionKind==='review'?'review.finish_title':'finish.title');$('#finalScore').textContent=`${acc}%`;$('#finalCorrect').textContent=stats.correct;$('#finalWrong').textContent=stats.wrong;$('#finalAttempts').textContent=stats.attempts;$('#again').textContent=t(sessionKind==='review'?(remaining?'review.practice_remaining':'review.done'):'finish.again');$('#settings').textContent=t(sessionKind==='review'?(remaining?'review.finish_back':'finish.settings'):sessionKind==='dictionary'?'dictionary.return_to_dictionary':'finish.settings');renderMistakeSummary()}
function back(){if(sessionKind==='review')showReviewBank();else if(sessionKind==='dictionary')returnToDictionaryPracticeSource();else showSetupScreen()}
initDataBackupSettings();
renderLessonGrid();renderKanjiGroups(false);restoreSessionControls();populateFuriganaLessons();refreshReviewUI();updatePreview();document.querySelectorAll('.mode input').forEach(x=>x.addEventListener('change',()=>{saveSessionPrefs();updatePreview()}));document.querySelectorAll('input[name="vocabLimitMode"]').forEach(x=>x.addEventListener('change',()=>{vocabLimit.disabled=document.querySelector('input[name="vocabLimitMode"]:checked').value!=='limit';saveSessionPrefs();updatePreview()}));document.querySelectorAll('input[name="furiganaMode"]').forEach(x=>x.addEventListener('change',syncFuriganaControls));furiganaLessonSelect.addEventListener('change',()=>{furiganaChapterManual=true;updatePreview()});vocabLimit.addEventListener('input',()=>{saveSessionPrefs();updatePreview()});document.querySelectorAll('input[name="inputMode"]').forEach(x=>x.addEventListener('change',syncInputMode));let answerComposing=false;
input.addEventListener('compositionstart',()=>{answerComposing=true});
input.addEventListener('compositionend',()=>{answerComposing=false});
input.addEventListener('input',()=>{if(input.value)hideAnswerNotice();if(inputMode()==='romaji'&&!answerComposing){const p=input.selectionStart??input.value.length;const before=input.value;const after=romajiToHiragana(before,false);if(after!==before){input.value=after;input.setSelectionRange(input.value.length,input.value.length)}}});$('#lessonToggle').addEventListener('click',toggleLessons);$('#kanjiToggle').addEventListener('click',toggleKanji);$('#start').addEventListener('click',start);$('#reviewOpen').addEventListener('click',showReviewBank);$('#reviewStart').addEventListener('click',startReview);$('#reviewBankStart').addEventListener('click',startReview);$('#reviewBankBack').addEventListener('click',showSetupScreen);submit.addEventListener('click',()=>check(answerMode()==='one'));input.addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.isComposing&&!answerComposing){e.preventDefault();e.stopPropagation();const oneStep=answerMode()==='one';check(oneStep);if(oneStep)requestAnimationFrame(()=>{if(!quiz.classList.contains('hidden'))input.focus({preventScroll:true})})}});$('#quit').addEventListener('click',back);$('#again').addEventListener('click',restartSession);$('#settings').addEventListener('click',finishBack);syncFuriganaControls();syncInputMode();

// PWA: offline support + iOS Home Screen experience.
if ('serviceWorker' in navigator) {
  let refreshingForServiceWorker = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (refreshingForServiceWorker) return;
    refreshingForServiceWorker = true;
    window.location.reload();
  });
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js?v=3.6', { updateViaCache: 'none' }).then(reg => reg.update()).catch(err => {
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
