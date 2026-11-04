import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {normalizeAnswer,acceptedAnswers,answerText,rawMeaning,meaningText,requeueWrongAnswer} from '../js/quiz-logic.js';

test('romaji mode retains the existing voiced-kana equivalence',()=>{
  assert.equal(normalizeAnswer('づ','romaji'),'ず');
  assert.equal(normalizeAnswer('ぢ','romaji'),'じ');
  assert.equal(normalizeAnswer('づ','ime'),'づ');
  assert.equal(normalizeAnswer('ぢ','ime'),'ぢ');
  assert.equal(normalizeAnswer('カタカナ','ime'),'かたかな');
});
test('accepted readings respect input modes without mutation',()=>{
  const q={accepted_answers:['づ','ぢ'],answer_display:['zu']};
  const before=JSON.stringify(q);
  assert.deepEqual(acceptedAnswers(q,'romaji'),['ず','じ']);
  assert.deepEqual(acceptedAnswers(q,'ime'),['づ','ぢ']);
  assert.equal(JSON.stringify(q),before);
});
test('labels and escaped meanings preserve existing behavior',()=>{
  assert.equal(answerText({answer_display:['てづくり','がくせい']}),'てづくり / がくせい');
  assert.equal(rawMeaning({meanings:['ręcznie','uczeń']}),'ręcznie · uczeń');
  assert.equal(meaningText({meaning:'<kot> & pies'}),'&lt;kot&gt; &amp; pies');
  assert.equal(meaningText({}),'');
});
test('review mode appends a separate retry object',()=>{
  const q={id:'wrong'},queue=[{id:'next'}];
  requeueWrongAnswer(queue,q,'review',()=>0);
  assert.deepEqual(queue.map(x=>x.id),['next','wrong']);
  assert.notStrictEqual(queue[1],q);
});
test('normal mode keeps the existing random retry position',()=>{
  const source=Array.from({length:10},(_,i)=>({id:i}));
  for(const [random,index] of [[0,3],[0.999999,7]]){
    const queue=source.slice();
    requeueWrongAnswer(queue,{id:'wrong'},'normal',()=>random);
    assert.equal(queue[index].id,'wrong');
    assert.equal(queue.length,11);
  }
  const empty=[];
  requeueWrongAnswer(empty,{id:'wrong'},'normal',()=>0.9);
  assert.equal(empty[0].id,'wrong');
});
test('module is imported and available in PWA offline cache',()=>{
  const app=readFileSync(new URL('../js/app.js',import.meta.url),'utf8');
  const sw=readFileSync(new URL('../sw.js',import.meta.url),'utf8');
  assert.match(app,/from '\.\/quiz-logic\.js'/);
  assert.ok(sw.includes("'./js/quiz-logic.js'"));
});
