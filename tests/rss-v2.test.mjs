import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {rssProfileV2,slowRssBaseline,slowPracticeBaseline,selectedSlowWords,rssTrendSvg,madRss,rssSeries,usableRssEntry} from '../js/rss-v2.js';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const day=24*3600*1000;
const sample=(rss,session,at,quality='valid',mode='romaji')=>({correct:true,rss_ms:rss,session_id:session,input_mode:mode,at,quality});
const now=Date.UTC(2026,10,1);
test('first correct RSS remains visible but never qualifies for slow mode',()=>{
  const p=rssProfileV2([sample(1800,'s1',now)],'romaji');
  assert.equal(p.eligible,true);
  assert.equal(p.rss_ms,1800);
  assert.equal(p.reliable,false);
  assert.equal(slowRssBaseline([p]).ready,false)
});
test('legacy RSS stays visible while not falsely claiming quality verification',()=>{
  const history=[sample(1700,'s1',now),sample(1500,'s2',now+day),sample(1300,'s3',now+2*day)].map(({quality,...row})=>row);
  const p=rssProfileV2(history,'romaji');
  assert.equal(p.eligible,true);
  assert.equal(p.rss_ms,1500);
  assert.equal(p.verified_count,0);
  assert.equal(p.reliable,false)
});
test('five verified samples across 3 sessions and 2 days qualify',()=>{
  const history=[
    sample(3000,'s1',now),sample(3200,'s1',now),
    sample(2600,'s2',now+day),sample(2800,'s2',now+day),
    sample(2400,'s3',now+2*day)
  ];
  const p=rssProfileV2(history,'romaji');
  assert.equal(p.reliable,true);
  assert.equal(p.sessions,3);
  assert.equal(p.verified_sessions,3);
  assert.equal(p.verified_days,3);
  assert.equal(p.rss_ms,2700);
  assert.deepEqual(p.series.map(x=>x.samples),[2,2,1])
});
test('five samples from a single cram session do NOT become reliable',()=>{
  const p=rssProfileV2(Array.from({length:5},(_,i)=>sample(2200+i*30,'s1',now)),'romaji');
  assert.equal(p.reliable,false);
  assert.equal(p.verified_sessions,1)
});
test('interrupted or focus-lost answers do not affect RSS, while wrong and skipped lack RSS',()=>{
  const rows=[
    sample(1200,'s1',now),
    sample(50000,'s2',now+day,'focus_lost'),
    sample(90000,'s3',now+2*day,'interrupted'),
    {...sample(null,'s4',now+3*day,'skipped'),correct:false},
    {...sample(null,'s5',now+4*day,'incorrect'),correct:false}
  ];
  assert.equal(rssProfileV2(rows,'romaji').rss_ms,1200);
  assert.equal(usableRssEntry(rows[1],'romaji'),false);
  assert.equal(usableRssEntry(rows[2],'romaji'),false);
});
test('IME and Romaji stay separate; stability uses MAD across session medians',()=>{
  const stable=[sample(2200,'a',now),sample(2300,'b',now+day),sample(2400,'c',now+2*day)];
  const varied=[sample(1000,'a',now),sample(2500,'b',now+day),sample(6000,'c',now+2*day)];
  assert.equal(rssProfileV2(stable,'romaji').mad_ms,100);
  assert.equal(rssProfileV2(varied,'romaji').variability,'unstable');
  assert.equal(rssProfileV2([...stable,sample(4500,'d',now+3*day,'valid','ime')],'ime').rss_ms,4500);
  assert.equal(madRss([1,2,2,4]),.5)
});
test('slow threshold uses at least eight RELIABLE words',()=>{
  const profiles=Array.from({length:8},(_,i)=>({reliable:true,rss_ms:1300+200*i}));
  assert.equal(slowRssBaseline(profiles.slice(0,7)).ready,false);
  const b=slowRssBaseline(profiles);
  assert.equal(b.ready,true);
  assert.equal(b.cutoff_ms,2350);
  assert.equal(slowRssBaseline([...profiles,{reliable:false,rss_ms:99999}]).cutoff_ms,2350)
});
test('accessible SVG shows chronological measured history without fabricated points',()=>{
  const series=rssSeries([sample(3500,'s1',now),sample(2600,'s2',now+day)],'romaji');
  const svg=rssTrendSvg(series,2700);
  assert.match(svg,/<svg /);
  assert.match(svg,/<polyline /);
  assert.match(svg,/aria-label=/);
  assert.match(svg,/stroke-dasharray/);
  assert.match(svg,/3\.5 s/);
  assert.equal(rssTrendSvg([]),'')
});
test('RSS 2.0 is integrated into dictionary, slow practice and quality tracking',()=>{
  const app=read('js/app.js'),sw=read('sw.js'),ui=JSON.parse(read('data/ui.pl.json'));
  assert.match(app,/rssProfileV2\(stats\?\.timing_history,mode\)/);
  assert.match(app,/profile\.eligible&&profile\.rss_ms>baseline\.slow_cutoff_ms/);
  assert.match(app,/rssTrendSvg\(rssProfile\.series,personalBaseline\.median_ms\)/);
  assert.match(app,/vocabTiming\.quality='interrupted'/);
  assert.match(app,/timing\.quality='focus_lost'/);
  assert.match(app,/quality,technical_reason:/);
  assert.match(app,/if\(advance&&ok\)/);
  assert.match(app,/if\(!advance\|\|!ok\)\{feedback\.className='feedback bad'/);
  assert.match(app,/recordVocabTiming\(current,ok,elapsed,val,\{skipped:skip\}\)/);
  assert.ok(ui.dictionary.rss_chart_title);
  assert.ok(sw.includes("'./js/rss-v2.js'"))
});

test('slow practice unlock requires 50 unique words, five sessions and two calendar days',()=>{
  const records=(words,sessions,daySpread=2)=>Array.from({length:words},(_,i)=>{
    const session='s'+(i%sessions),at=now+(i%daySpread)*day;
    const row=sample(1500+i*30,session,at);
    return {profile:rssProfileV2([row],'romaji'),history:[row]};
  });
  const tooFewWords=slowPracticeBaseline(records(49,5),'romaji');
  assert.equal(tooFewWords.ready,false);
  assert.equal(tooFewWords.count,49);
  assert.equal(slowPracticeBaseline(records(50,4),'romaji').ready,false);
  assert.equal(slowPracticeBaseline(records(50,5,1),'romaji').ready,false);
  const unlocked=slowPracticeBaseline(records(50,5,2),'romaji');
  assert.equal(unlocked.ready,true);
  assert.equal(unlocked.count,50);
  assert.equal(unlocked.sessions,5);
  assert.equal(unlocked.days,2);
  assert.equal(unlocked.cutoff_ms,2602.5);
});
test('unlock accepts valid legacy RSS but ignores invalid, skipped and other input modes',()=>{
 const entries=Array.from({length:50},(_,i)=>{
   const row=sample(1800+i,'s'+(i%5),now+(i%2)*day);
   const {quality,...legacy}=row;
   return {profile:rssProfileV2([legacy],'romaji'),history:[legacy]};
 });
 assert.equal(slowPracticeBaseline(entries,'romaji').ready,true);
 const otherMode=entries.map((entry,i)=>i===49?{profile:rssProfileV2([{...entry.history[0],input_mode:'ime'}],'romaji'),history:[{...entry.history[0],input_mode:'ime'}]}:entry);
 assert.equal(slowPracticeBaseline(otherMode,'romaji').ready,false);
 assert.equal(slowPracticeBaseline(entries.slice(0,49),'romaji').ready,false);
 const bad=entries.map((entry,i)=>i%2===0?entry:{profile:entry.profile,history:[{...entry.history[0],quality:'focus_lost'}]});
 assert.equal(slowPracticeBaseline(bad,'romaji').ready,false);
});
test('slow focus selector is disabled in markup and updated dynamically',()=>{
 const html=read('index.html'),app=read('js/app.js'),css=read('css/styles.css'),ui=JSON.parse(read('data/ui.pl.json'));
 assert.match(html,/name="sessionFocus" value="slow" disabled aria-describedby="slowUnlockProgress"/);
 assert.match(html,/id="slowUnlockProgress"/);
 assert.match(app,/slowRadio\.disabled=!baseline\.slow_ready/);
 assert.match(app,/slowRadio\.parentElement\?\.classList\.toggle\('session-focus-locked',!baseline\.slow_ready\)/);
 assert.match(app,/const practice=slowPracticeBaseline\(practiceEntries,mode\)/);
 assert.match(css,/\.choice\.session-focus-locked/);
 assert.match(ui.setup.slow_locked_progress,/\{words\}/);
});

test('selected slow words use global quartile when candidates exist',()=>{
 const entries=[900,1500,2100,3300].map((ms,i)=>({item:'word'+i,profile:{rss_ms:ms,eligible:true}}));
 const selection=selectedSlowWords(entries,2500);
 assert.equal(selection.source,'global');
 assert.deepEqual(selection.items,['word3']);
});
test('selected slow words fall back to local upper quartile when none exceed global threshold',()=>{
 const entries=[900,1500,2100,2500].map((ms,i)=>({item:'word'+i,profile:{rss_ms:ms,eligible:true}}));
 const selection=selectedSlowWords(entries,3300);
 assert.equal(selection.source,'local');
 assert.deepEqual(selection.items,['word3']);
});
test('no local slow session from fewer than four measured words',()=>{
 const entries=[900,1500,2100].map((ms,i)=>({item:'word'+i,profile:{rss_ms:ms,eligible:true}}));
 assert.deepEqual(selectedSlowWords(entries,3300).items,[]);
 assert.equal(selectedSlowWords(entries,3300).source,'insufficient');
});
test('unmeasured words cannot enter fallback pool; tied measurements still produce session',()=>{
 const entries=[1,2,3,4].map(i=>({item:'word'+i,profile:{rss_ms:2000,eligible:true}}));
 entries.push({item:'unmeasured',profile:{rss_ms:null,eligible:false}});
 const sel=selectedSlowWords(entries,3300);
 assert.equal(sel.source,'local');
 assert.equal(sel.items.length,1);
 assert.notEqual(sel.items[0],'unmeasured');
});
