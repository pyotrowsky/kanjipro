import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {rssProfileV2,slowRssBaseline,slowPracticeBaseline} from '../js/rss-v2.js';
const app=readFileSync(new URL('../js/app.js',import.meta.url),'utf8');
const ui=JSON.parse(readFileSync(new URL('../data/ui.pl.json',import.meta.url),'utf8'));
const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const sample=(rss,session_id='s1',mode='romaji')=>({correct:true,rss_ms:rss,session_id,input_mode:mode,at:Date.UTC(2026,10,1)});
test('a single correct answer still yields preliminary RSS',()=>{
  const p=rssProfileV2([sample(1150)],'romaji');
  assert.equal(p.eligible,true);assert.equal(p.reliable,false);assert.equal(p.rss_ms,1150)
});
test('a hundred different preliminary words produce an indicative personal baseline, but not reliable slow cutoff',()=>{
  const entries=Array.from({length:100},(_,i)=>rssProfileV2([sample(500+i*20)],'romaji'));
  assert.equal(entries.filter(p=>p.eligible).length,100);
  assert.equal(slowRssBaseline(entries).ready,false);
  assert.equal(slowPracticeBaseline(entries.map(p=>({profile:p,history:[sample(p.rss_ms)]})),'romaji').ready,false);
  assert.match(app,/ready:values\.length>=RSS_BASELINE_MIN_WORDS/);
  assert.match(app,/slow_ready:verified\.ready/)
});
test('old unverified sessions retain their RSS while remaining preliminary',()=>{
  const entries=[sample(1000),sample(1100),sample(950,'s2')];
  const p=rssProfileV2(entries,'romaji');
  assert.equal(p.rss_ms,1000);
  assert.equal(p.reliable,false)
});
test('Romaji and IME maintain different RSS histories',()=>{
  const entries=[sample(900,'s1','romaji'),sample(1300,'s2','ime')];
  assert.equal(rssProfileV2(entries,'romaji').rss_ms,900);
  assert.equal(rssProfileV2(entries,'ime').rss_ms,1300)
});
test('history without RSS cannot invent measurements',()=>{
  const p=rssProfileV2([{correct:true,response_ms:1000,session_id:'s1',input_mode:'romaji'}],'romaji');
  assert.equal(p.eligible,false);assert.equal(p.rss_ms,null)
});
test('session help explains provisional values and independent RSS calibration',()=>{
  assert.match(ui.setup.rss_adaptive_html,/pierwszym poprawnym pomiarze/i);
  assert.match(ui.setup.rss_adaptive_html,/50 różnych słówek/i);
  assert.match(ui.dictionary.rss_preliminary_note,/3 sesji/i);
  assert.doesNotMatch(html,/id="rssProgress"/);
  assert.match(app,/input\.addEventListener\('beforeinput'/)
});
