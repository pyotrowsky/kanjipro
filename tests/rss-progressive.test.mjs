import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const app=readFileSync(new URL('../js/app.js',import.meta.url),'utf8');
const ui=JSON.parse(readFileSync(new URL('../data/ui.pl.json',import.meta.url),'utf8'));
const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const start=app.indexOf('const RSS_MIN_SAMPLES=');
const end=app.indexOf('function smoothedAccuracy(',start);
assert.ok(start>=0&&end>start,'RSS profile code can be isolated');

function sample(rss,session_id='session-1',mode='romaji'){
  return {correct:true,rss_ms:rss,session_id,input_mode:mode,at:123,reading_units:4,response_ms:2400,recognition_ms:800};
}
function engine(entries,mode='romaji'){
  const learningStats={};
  const vocabulary=[];
  for(const [id,history] of Object.entries(entries)){
    vocabulary.push({id});
    learningStats[id]={timing_history:history,reviews:history.length}
  }
  const progress={textContent:''};
  const ctx={DB:{vocabulary},learningStats,
    dictionaryVocabId:v=>v.id,inputMode:()=>mode,formatTiming:n=>Number.isFinite(n)?(n/1000).toFixed(2)+' s':'—',
    medianMs:values=>{const sorted=values.filter(Number.isFinite).sort((a,b)=>a-b);if(!sorted.length)return null;const m=Math.floor(sorted.length/2);return sorted.length%2?sorted[m]:(sorted[m-1]+sorted[m])/2},
    $:()=>progress,t:(key,values)=>key+':'+JSON.stringify(values)};
  vm.runInNewContext(app.slice(start,end)+'\nthis.profile=wordRssProfile;this.baseline=personalRssBaseline;this.speed=rssSpeedCategory;this.render=renderRssProgress;',ctx);
  return {...ctx,progress}
}
test('one correct answer yields a preliminary word RSS instead of Brak danych',()=>{
  const x=engine({v1:[sample(1150)]}),p=x.profile(x.learningStats.v1,'romaji');
  assert.equal(p.eligible,true);
  assert.equal(p.reliable,false);
  assert.equal(p.rss_ms,1150)
});
test('100 DIFFERENT correctly answered words already yield a personal median',()=>{
  const entries=Object.fromEntries(Array.from({length:100},(_,i)=>['v'+i,[sample(500+i*20)]]));
  const x=engine(entries),base=x.baseline();
  assert.equal(base.words,100);
  assert.equal(base.reliable_words,0);
  assert.equal(base.ready,true);
  assert.equal(base.median_ms,1490);
  assert.equal(x.speed(x.profile(x.learningStats.v99,'romaji'),base),'slow');
  x.render();
  assert.ok(x.progress.textContent.startsWith('setup.rss_progress_ready:'))
});
test('profile is initially visible while calibration is incomplete',()=>{
  const x=engine({one:[sample(760)],two:[sample(1200)]});
  assert.equal(x.baseline().ready,false);
  assert.equal(x.baseline().median_ms,980);
  x.render();
  assert.ok(x.progress.textContent.startsWith('setup.rss_progress_collecting:'))
});
test('three correct measurements from two sessions mark a word as reliable',()=>{
  const x=engine({one:[sample(1000),sample(1100),sample(950,'session-2')]});
  const p=x.profile(x.learningStats.one,'romaji');
  assert.equal(p.reliable,true);
  assert.equal(p.rss_ms,1000)
});
test('IME and Romaji are calibrated separately',()=>{
  const x=engine({one:[sample(900,'s1','romaji'),sample(1300,'s2','ime')]},'ime');
  assert.equal(x.baseline().median_ms,1300);
  assert.equal(x.profile(x.learningStats.one,'romaji').rss_ms,900)
});
test('old histories without RSS remain unmeasurable; no times are fabricated',()=>{
  const x=engine({one:[]});
  assert.equal(x.baseline().median_ms,null);
  assert.equal(x.profile(x.learningStats.one,'romaji').eligible,false)
});
test('session help, dictionary, and setup all explain progressive calibration',()=>{
  assert.match(ui.setup.rss_adaptive_html,/pierwszej poprawnej odpowiedzi/i);
  assert.match(ui.setup.rss_adaptive_html,/8 różnych/i);
  assert.match(ui.dictionary.rss_preliminary_note,/2 sesjach/i);
  assert.match(html,/id="rssProgress"/);
  assert.match(app,/input\.addEventListener\('beforeinput'/);
});
