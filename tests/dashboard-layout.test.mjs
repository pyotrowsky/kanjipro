import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const app=read('js/app.js'),html=read('index.html'),css=read('css/shiba-dashboard.css'),sw=read('sw.js');
const start=app.indexOf('function globalVocabularySummary(){');
const end=app.indexOf('function renderRssProgress(){',start);
assert.ok(start>0&&end>start,'dashboard calculation functions are present');

function fixture(){
  const elements={};
  for(const id of ['homeWords','historyWords','homeAccuracy','historyAccuracy','homeRss','historyRss','homeAccuracyNote','homeRssNote','historyRecent']){
    elements['#'+id]={textContent:'',innerHTML:''}
  }
  const DB={vocabulary:[
    {id:'VOCAB_NOTE:1',surface:'学校',polish:'szkoła'},
    {id:'VOCAB_NOTE:1',surface:'学校',polish:'szkoła'},
    {id:'VOCAB_NOTE:2',surface:'犬',polish:'pies'},
    {id:'VOCAB_NOTE:3',surface:'猫',polish:'kot'}
  ]};
  const learningStats={
    'VOCAB_NOTE:1':{reviews:4,correct:3,wrong:1,last_seen_at:1300},
    'VOCAB_NOTE:2':{reviews:2,correct:1,wrong:1,last_seen_at:1700},
    'ON:日':{reviews:300,correct:300,wrong:0},
  };
  const sandbox={DB,learningStats,
    dictionaryVocabId:v=>v.id,
    personalRssBaseline:()=>({median_ms:780,words:2,mode:'romaji'}),
    formatTiming:ms=>Number.isFinite(ms)?(ms/1000).toFixed(2)+' s':'—',
    $:id=>elements[id]||null,
    t:(key,vars={})=>key+':'+JSON.stringify(vars),
    wordRssProfile:()=>({eligible:false,rss_ms:null}),
    inputMode:()=> 'romaji',
    esc:x=>String(x??'').replace(/[<>]/g,''),
    Intl
  };
  vm.runInNewContext(app.slice(start,end)+'\nthis.getStats=globalVocabularySummary;this.renderHome=renderHomeStats;this.renderHistory=renderHistoryScreen;',sandbox);
  return {sandbox,elements}
}
test('counts unique practiced words only, not ON/KUN or duplicated dictionary entries',()=>{
  const f=fixture(),s=f.sandbox.getStats();
  assert.equal(s.practiced,2);
  assert.equal(s.reviews,6);
  assert.equal(s.correct,4);
  assert.equal(s.accuracy,67);
});
test('shows accurate global stats and RSS from selected input method',()=>{
  const f=fixture();f.sandbox.renderHome();
  assert.equal(f.elements['#homeWords'].textContent,'2');
  assert.equal(f.elements['#homeAccuracy'].textContent,'67%');
  assert.equal(f.elements['#homeRss'].textContent,'780 ms');
  assert.match(f.elements['#homeAccuracyNote'].textContent,/4/);
  assert.match(f.elements['#homeRssNote'].textContent,/Romaji/);
});
test('history view renders recent practiced vocabulary using local learning stats',()=>{
  const f=fixture();f.sandbox.renderHistory();
  assert.match(f.elements['#historyRecent'].innerHTML,/犬/);
  assert.match(f.elements['#historyRecent'].innerHTML,/学校/);
  assert.doesNotMatch(f.elements['#historyRecent'].innerHTML,/猫/);
  assert.equal(f.elements['#historyWords'].textContent,'2');
});
test('an empty history shows blank statistics, never fake data',()=>{
  const f=fixture();delete f.sandbox.learningStats['VOCAB_NOTE:1'];delete f.sandbox.learningStats['VOCAB_NOTE:2'];
  f.sandbox.renderHome();
  assert.equal(f.elements['#homeWords'].textContent,'0');
  assert.equal(f.elements['#homeAccuracy'].textContent,'—');
});
test('sidebar on large iPad/desktop, mobile top navigation, genuine history and settings controls',()=>{
  for(const id of ['sidePractice','sideHistory','sideDictionary','sideSettings','navPractice','navDictionary','historyRecent'])assert.match(html,new RegExp('id="'+id+'"'));
  assert.match(css,/@media\(min-width:780px\)/);
  assert.match(css,/\.desktop-sidebar\{display:flex/);
  assert.match(css,/\.main-workspace/);
  assert.match(app,/setMainNav\('history'\)/);
  assert.match(app,/\$\('#openSettings'\)\?\.click\(\)/);
});
test('Otsukaresama finish uses session stats; original mockup cutouts remain available offline',()=>{
  assert.match(html,/おつかれさま！/);
  assert.match(html,/id="finishVocabCount"/);
  assert.match(html,/id="finishSessionAccuracy"/);
  assert.match(html,/id="finishSessionRss"/);
  assert.match(app,/sessionLearningRecordedIds\.size/);
  for(const path of ['icons/shiba-peek.svg','icons/shiba-cheer.svg','icons/shiba-study.svg','icons/shiba-face.svg']){
    const art=read(path);
    assert.match(art,/data:image\/webp;base64,UklGR/);
    assert.ok(sw.includes("'./"+path+"'"),'offline '+path);
  }
  assert.match(sw,/wsjj-kanji-pro-3\.21-1/);
});
