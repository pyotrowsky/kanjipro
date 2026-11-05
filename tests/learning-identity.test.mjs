import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {canonicalizeVocabularyLearning,vocabularyLearningAliases,legacyVocabularyId} from '../js/learning-identity.js';

const word=(note_id,surface,reading)=>({note_id,surface,reading,accepted_readings:[reading]});
test('two corrected sessions join the original mistake under the canonical note ID',()=>{
  const vocab=[word('123','書いて','かいて')];
  const old=legacyVocabularyId('書いて',['かいて']);
  const data={
    'VOCAB_NOTE:123':{reviews:1,correct:0,wrong:1,last_seen_at:10,timing_history:[{at:10,session_id:'main',correct:false}]},
    [old]:{reviews:2,correct:2,wrong:0,last_seen_at:30,correct_streak:2,last_result:'correct',
      timing_history:[{at:20,session_id:'review1',correct:true,rss_ms:1750},{at:30,session_id:'review2',correct:true,rss_ms:1600}]}
  };
  const {learning,changed}=canonicalizeVocabularyLearning(data,vocab);
  assert.equal(changed,true);
  assert.equal(learning[old],undefined);
  assert.deepEqual([learning['VOCAB_NOTE:123'].reviews,learning['VOCAB_NOTE:123'].correct,learning['VOCAB_NOTE:123'].wrong],[3,2,1]);
  assert.equal(learning['VOCAB_NOTE:123'].timing_history.length,3);
  assert.equal(learning['VOCAB_NOTE:123'].last_result,'correct');
  assert.deepEqual(canonicalizeVocabularyLearning(learning,vocab).learning,learning);
});
test('ambiguous homographs are not automatically combined',()=>{
  const vocab=[word('1','書いて','かいて'),word('2','書いて','かいて')];
  const old=legacyVocabularyId('書いて',['かいて']);
  const result=canonicalizeVocabularyLearning({[old]:{reviews:2}},vocab);
  assert.equal(result.changed,false);
  assert.equal(result.learning[old].reviews,2);
  assert.equal(vocabularyLearningAliases(vocab).has(old),false);
});
test('canonicalization preserves independently tracked words and does not overwrite recent measurements',()=>{
  const vocab=[word('123','書いて','かいて'),word('456','読む','よむ')];
  const old=legacyVocabularyId('書いて',['かいて']);
  const sample={session_id:'same',at:5,response_ms:2300,correct:true,rss_ms:1750};
  const {learning}=canonicalizeVocabularyLearning({
    'VOCAB_NOTE:123':{reviews:1,correct:0,wrong:1,timing_history:[sample]},
    [old]:{reviews:1,correct:1,wrong:0,timing_history:[sample]},
    'VOCAB_NOTE:456':{reviews:9,correct:8,wrong:1}
  },vocab);
  assert.equal(learning['VOCAB_NOTE:123'].timing_history.length,1);
  assert.equal(learning['VOCAB_NOTE:456'].reviews,9);
});
test('correction questions retain canonical learning_id, including offline worker cache',()=>{
 const app=readFileSync(new URL('../js/app.js',import.meta.url),'utf8');
 const sw=readFileSync(new URL('../sw.js',import.meta.url),'utf8');
 assert.match(app,/persistent_id:rec.id,learning_id:dictionaryVocabId\(first\)/);
 assert.match(app,/canonicalizeVocabularyLearning\(merged.learning,DB.vocabulary\)/);
 assert.ok(sw.includes("'./js/learning-identity.js'"));
});
