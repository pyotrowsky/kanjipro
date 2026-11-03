import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const app=readFileSync(new URL('../js/app.js',import.meta.url),'utf8');
const start=app.indexOf('function restoreQuizFocusAfterStart(){');
const end=app.indexOf('function showQuestion(){',start);
assert.ok(start>=0&&end>start,'quiz-start focus recovery helper is present');
const helper=app.slice(start,end);

function simulate({hide=false,changeQuestion=false,checked=false}={}){
  const frames=[],timers=[];
  const initial={id:1},newQuestion={id:2};
  let focusCalls=0;
  const input={disabled:false};
  const context={
    current:initial,checked,input,
    quiz:{classList:{contains:()=>hide}},
    document:{activeElement:{tagName:'BUTTON'}},
    focusAnswerField:()=>{focusCalls++;context.document.activeElement=input},
    requestAnimationFrame:fn=>frames.push(fn),
    setTimeout:(fn,ms)=>timers.push({fn,ms})
  };
  vm.runInNewContext(helper+'\nrestoreQuizFocusAfterStart()',context);
  if(changeQuestion)context.current=newQuestion;
  while(frames.length)frames.shift()();
  for(const item of timers)item.fn();
  return {focusCalls,timers:timers.map(x=>x.ms)}
}

test('START regains input focus after iPad click settles',()=>{
  const result=simulate();
  assert.equal(result.focusCalls,1);
  assert.deepEqual(result.timers,[80,220])
});
test('focus retries do not steal focus when user leaves the quiz',()=>{
  assert.equal(simulate({hide:true}).focusCalls,0);
  assert.equal(simulate({changeQuestion:true}).focusCalls,0);
  assert.equal(simulate({checked:true}).focusCalls,0)
});
test('session start invokes delayed recovery as well as immediate focus',()=>{
  assert.match(app,/function beginSession\([\s\S]*?showQuestion\(\);restoreQuizFocusAfterStart\(\)/);
  assert.match(app,/function showQuestion\([\s\S]*?startVocabTimer\(\);focusAnswerField\(\)/);
});
test('iPad first keypress can recover from an old setup input',()=>{
  assert.match(app,/document\.addEventListener\('keydown',event=>/);
  assert.match(app,/active\?\.closest\?\.\('#quiz'\)/);
  assert.match(app,/input\.setRangeText\(event\.key,start,end,'end'\)/)
});
