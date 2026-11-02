import test from 'node:test';
import assert from 'node:assert/strict';
import {mergeDeviceJournals} from '../js/history-merge.js';

const doc=(device_id,seed,events=[])=>({
  format:'wsjj-kanji-pro-device-journal',version:1,device_id,seed,events
});
const review=(id,at,question_id,learning_id,correct,extra={})=>({
  id,at,question_id,learning_id,correct,learned:true,mistake_action:correct?'none':'wrong',...extra
});

test('two devices merge independent new reviews and retain old reviews',()=>{
  const seed={learning:{'VOCAB:one':{reviews:5,correct:4,wrong:1,last_seen_at:1}},mistakes:{}};
  const a=doc('A',seed,[review('A:1',10,'VOCAB:one','VOCAB:one',true)]);
  const b=doc('B',seed,[review('B:1',20,'VOCAB:one','VOCAB:one',false,{mistake_snapshot:{type:'vocabulary',prompt:'one'}})]);
  const combined=mergeDeviceJournals([a,b]);
  assert.equal(combined.learning['VOCAB:one'].reviews,7);
  assert.equal(combined.learning['VOCAB:one'].correct,5);
  assert.equal(combined.learning['VOCAB:one'].wrong,2);
  assert.equal(combined.mistakes['VOCAB:one'].wrong_count,1)
});

test('repeated cloud downloads do not double count events or timing',()=>{
  const event=review('A:1',50,'VOCAB:one','VOCAB:one',true,{timing:{at:50,session_id:'s',correct:true,input_mode:'romaji',response_ms:1900,recognition_ms:600,rss_ms:925}});
  const a=doc('A',{learning:{},mistakes:{}},[event]);
  const once=mergeDeviceJournals([a]),repeated=mergeDeviceJournals([a,a,a]);
  assert.equal(once.learning['VOCAB:one'].reviews,1);
  assert.equal(repeated.learning['VOCAB:one'].reviews,1);
  assert.equal(repeated.learning['VOCAB:one'].timing_history.length,1)
});

test('two later credits resolve an active error without deleting unrelated data',()=>{
  const a=doc('A',{learning:{},mistakes:{}},[
    review('A:1',10,'VOCAB:one','VOCAB:one',false,{mistake_snapshot:{prompt:'one'}})
  ]);
  const b=doc('B',{learning:{},mistakes:{}},[
    review('B:1',20,'VOCAB:one','VOCAB:one',true,{learned:false,mistake_action:'credit'}),
    review('B:2',30,'VOCAB:one','VOCAB:one',true,{learned:false,mistake_action:'credit'})
  ]);
  assert.equal(mergeDeviceJournals([a,b]).mistakes['VOCAB:one'],undefined)
});

test('malformed and unrelated records cannot break empty collection merge',()=>{
  assert.deepEqual(mergeDeviceJournals([null,{},'hello']),{learning:{},mistakes:{},events:0})
});

test('ON and KUN events affect mistakes, not vocabulary learning stats',()=>{
  const a=doc('A',{learning:{},mistakes:{}},[
    review('A:on',10,'ON:読',null,false,{learned:false,mistake_snapshot:{type:'onyomi',prompt:'読'}}),
    review('A:kun',20,'KUN:読',null,false,{learned:false,mistake_snapshot:{type:'kunyomi',prompt:'読'}})
  ]);
  const got=mergeDeviceJournals([a]);
  assert.deepEqual(got.learning,{});
  assert.equal(Object.keys(got.mistakes).length,2)
});
