import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {rssProfileV2,slowRssBaseline,rssTrendSvg,madRss,rssSeries,usableRssEntry} from '../js/rss-v2.js';
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
  const history=[sample(1700,'s1',now,undefined),sample(1500,'s2',now+day,undefined),sample(1300,'s3',now+2*day,undefined)];
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
  assert.match(app,/profile\.reliable&&profile\.rss_ms>baseline\.slow_cutoff_ms/);
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
