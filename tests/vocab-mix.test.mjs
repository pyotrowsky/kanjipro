import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {DEFAULT_VOCAB_MIX,normalizeVocabMix,editVocabMix,selectVocabularyMix} from '../js/vocab-mix.js';
const words=[...Array(10)].map((_,i)=>({id:i,kind:i<4?'new':i<7?'difficult':i<9?'slow':'other'}));
const options=(mix=DEFAULT_VOCAB_MIX)=>({mix,id:x=>x.id,pick:(xs,n)=>xs.slice(0,n),isNew:x=>x.kind==='new',isDifficult:x=>x.kind==='difficult',isSlow:x=>x.kind==='slow'});
test('defaults retain 55/25/20 quotas and nothing duplicates',()=>{
 assert.deepEqual(DEFAULT_VOCAB_MIX,{new:55,difficult:25,slow:20});
 const selected=selectVocabularyMix(words,10,options());
 assert.equal(selected.length,10);assert.equal(new Set(selected.map(x=>x.id)).size,10);
});
test('custom ratios change limited selection, not just UI text',()=>{
 const a=selectVocabularyMix(words,5,options({new:0,difficult:60,slow:40}));
 assert.equal(a.filter(x=>x.kind==='difficult').length,3);
 assert.equal(a.filter(x=>x.kind==='slow').length,2);
 const b=selectVocabularyMix(words,5,options({new:80,difficult:0,slow:0}));
 assert.equal(b.filter(x=>x.kind==='new').length,4);
});
test('missing quota categories backfill without shortening session',()=>{
 const pool=words.filter(x=>x.kind!=='slow');
 const result=selectVocabularyMix(pool,5,{...options({new:10,difficult:10,slow:80}),mix:{new:10,difficult:10,slow:80}});
 assert.equal(result.length,5);assert.equal(new Set(result.map(x=>x.id)).size,5);
});
test('editing a slider clamps total to 100 and corrupted preferences normalize',()=>{
 assert.deepEqual(editVocabMix(DEFAULT_VOCAB_MIX,'new',90),DEFAULT_VOCAB_MIX);
 assert.deepEqual(editVocabMix(DEFAULT_VOCAB_MIX,'slow',5),{new:55,difficult:25,slow:5});
 const cfg=normalizeVocabMix({new:90,difficult:80,slow:60});
 assert.equal(Object.values(cfg).reduce((a,b)=>a+b,0),100);
});
test('settings are persistent and description is dynamically updated',()=>{
 const app=readFileSync(new URL('../js/app.js',import.meta.url),'utf8');
 const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
 const sw=readFileSync(new URL('../sw.js',import.meta.url),'utf8');
 assert.match(app,/vocabMix:sessionVocabMix\(\)/);
 assert.match(app,/updateSessionMixDescription\(\)/);
 assert.match(app,/selectVocabularyMix\(items,count,/);
 assert.match(html,/id="vocabMixNew"/);
 assert.match(html,/id="vocabMixDifficult"/);
 assert.match(html,/id="vocabMixSlow"/);
 assert.match(html,/id="sessionMixDescription"/);
 assert.ok(sw.includes("'./js/vocab-mix.js'"));
});
