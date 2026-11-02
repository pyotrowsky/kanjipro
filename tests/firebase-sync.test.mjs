import test from 'node:test';
import assert from 'node:assert/strict';
import {buildFirebaseDocs, mergeFirebaseSnapshots} from '../js/firebase-sync.js';

const blank=(device='A')=>({format:'wsjj-kanji-pro-device-journal',version:1,device_id:device,
  seed:{learning:{},mistakes:{}},events:[]});

test('seed and events are separate Firestore documents',()=>{
  const j=blank();j.seed.learning['VOCAB:学校']={reviews:5,correct:4,wrong:1};
  j.events.push({id:'A:a',session_id:'a',at:100,question_id:'VOCAB:学校',
    learning_id:'VOCAB:学校',learned:true,correct:true,mistake_action:'none'});
  const docs=buildFirebaseDocs(j);
  assert.equal(docs.length,2);
  assert.ok(docs[0].id.startsWith('seed-'));
  assert.ok(docs[1].id.startsWith('session-'));
  assert.equal(mergeFirebaseSnapshots(docs.map(x=>x.data)).learning['VOCAB:学校'].reviews,6);
});

test('re-downloaded session cannot increase reviews twice',()=>{
  const j=blank();j.events.push({id:'A:once',session_id:'first',at:101,
    question_id:'VOCAB:one',learning_id:'VOCAB:one',learned:true,correct:true,mistake_action:'none',
    timing:{session_id:'first',at:101,correct:true,response_ms:2000,recognition_ms:600,input_mode:'romaji',rss_ms:950}});
  const docs=buildFirebaseDocs(j).map(x=>x.data);
  const got=mergeFirebaseSnapshots([...docs,...docs]);
  assert.equal(got.learning['VOCAB:one'].reviews,1);
  assert.equal(got.learning['VOCAB:one'].timing_history.length,1);
  assert.equal(got.learning['VOCAB:one'].timing_history[0].rss_ms,950)
});

test('a large seed is partitioned without losing historical records',()=>{
  const j=blank();
  for(let i=0;i<1100;i++)j.seed.learning['VOCAB_NOTE:'+i]={reviews:4,correct:3,wrong:1,
    timing_history:[{session_id:'s'+i,at:i,correct:true,rss_ms:1800,recognition_ms:400,response_ms:2100}]};
  const docs=buildFirebaseDocs(j);
  assert.ok(docs.length>1);
  const got=mergeFirebaseSnapshots(docs.map(x=>x.data));
  assert.equal(Object.keys(got.learning).length,1100);
  assert.equal(got.learning['VOCAB_NOTE:1040'].reviews,4)
});

test('shards preserve kana and ON/KUN mistake data',()=>{
  const j=blank('B');
  j.seed.mistakes['ON:読']={wrong_count:1,correct_streak:0,prompt:'読'};
  j.seed.mistakes['KUN:読']={wrong_count:2,correct_streak:0,prompt:'読'};
  const got=mergeFirebaseSnapshots(buildFirebaseDocs(j).map(x=>x.data));
  assert.equal(got.mistakes['ON:読'].wrong_count,1);
  assert.equal(got.mistakes['KUN:読'].wrong_count,2)
});

test('separate sessions from two devices both count; same events do not',()=>{
  const a=blank('A'),b=blank('B');
  a.events.push({id:'A:a',session_id:'a',at:10,question_id:'VOCAB:x',learning_id:'VOCAB:x',correct:true,learned:true});
  b.events.push({id:'B:b',session_id:'b',at:20,question_id:'VOCAB:x',learning_id:'VOCAB:x',correct:false,learned:true});
  const ad=buildFirebaseDocs(a).map(x=>x.data),bd=buildFirebaseDocs(b).map(x=>x.data);
  const got=mergeFirebaseSnapshots([...ad,...bd,...ad]);
  assert.deepEqual({reviews:got.learning['VOCAB:x'].reviews,correct:got.learning['VOCAB:x'].correct,wrong:got.learning['VOCAB:x'].wrong},{reviews:2,correct:1,wrong:1})
});
