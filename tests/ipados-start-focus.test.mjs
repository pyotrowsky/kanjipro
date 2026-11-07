import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createQuizFocusController,bindQuizSessionStart} from '../js/quiz-focus.js';

function setup({ipad=true,hidden=false,rect={top:320,bottom:374,height:54},focused=false}={}){
  const frames=[],timers=[],scrolls=[],events=[];
  let current={id:1},checked=false,focusCalls=0;
  const doc={activeElement:{tagName:'BUTTON',closest:()=>null},querySelector:()=>null};
  const input={disabled:false,value:'',selectionStart:0,selectionEnd:0,
    getBoundingClientRect:()=>rect,
    focus(){focusCalls++;doc.activeElement=input},
    blur(){if(doc.activeElement===input)doc.activeElement={tagName:'BODY'}},
    setRangeText(char,start,end){this.value=this.value.slice(0,start)+char+this.value.slice(end);this.selectionStart=this.selectionEnd=start+char.length},
    dispatchEvent(event){events.push(event.type)}
  };
  if(focused)doc.activeElement=input;
  const quiz={classList:{contains:()=>hidden}};
  const ctrl=createQuizFocusController({input,quiz,getCurrent:()=>current,isChecked:()=>checked,
    doc,win:{visualViewport:{offsetTop:0,height:700},innerHeight:700,scrollBy:x=>scrolls.push(x)},
    nav:{userAgent:ipad?'Mozilla iPad Safari':'Mozilla Mac Safari',platform:ipad?'iPad':'MacIntel',maxTouchPoints:ipad?5:0},
    frame:fn=>frames.push(fn),later:(fn,ms)=>timers.push({fn,ms}),
    makeInputEvent:()=>({type:'input'})
  });
  const flush=()=>{while(frames.length)frames.shift()()};
  return {ctrl,doc,input,quiz,frames,timers,scrolls,events,flush,
    get focusCalls(){return focusCalls},
    hide(){hidden=true},change(){current={id:2}},check(){checked=true}
  };
}
function key(k='k'){return {key:k,defaultPrevented:false,metaKey:false,ctrlKey:false,altKey:false,
  isComposing:false,target:{closest:()=>null},preventDefault(){this.defaultPrevented=true}}}

test('post-START reactivation restores first question focus only once',()=>{
  const f=setup();f.ctrl.restoreQuizFocusAfterStart();f.flush();
  for(const item of f.timers)item.fn();
  assert.equal(f.focusCalls,1);
  assert.deepEqual(f.timers.map(x=>x.ms),[80,220]);
  assert.equal(f.doc.activeElement,f.input)
});
test('post-START delayed recovery does not steal focus after leaving or changing questions',()=>{
  for(const mode of ['hide','change','check']){
    const f=setup();f.ctrl.restoreQuizFocusAfterStart();f[mode]();f.flush();
    for(const item of f.timers)item.fn();
    assert.equal(f.focusCalls,0,mode)
  }
});
test('iPad first hardware keypress is retained when START remains focused',()=>{
  const f=setup(),event=key();f.ctrl.handleStaleFocusKeydown(event);
  assert.equal(event.defaultPrevented,true);
  assert.equal(f.input.value,'k');
  assert.equal(f.doc.activeElement,f.input);
  assert.deepEqual(f.events,['input'])
});
test('shortcuts, active input and desktop keyboard events are not hijacked',()=>{
  const desktop=setup({ipad:false}),normal=key();
  desktop.ctrl.handleStaleFocusKeydown(normal);
  assert.equal(normal.defaultPrevented,false);
  const f=setup(),shortcut={...key(),metaKey:true};
  f.ctrl.handleStaleFocusKeydown(shortcut);
  assert.equal(shortcut.defaultPrevented,false);
  f.doc.activeElement=f.input;
  const inside=key();
  f.ctrl.handleStaleFocusKeydown(inside);
  assert.equal(inside.defaultPrevented,false)
});
test('IME composition and hidden quiz are not intercepted',()=>{
  const f=setup();const composing={...key(),isComposing:true};
  f.ctrl.handleStaleFocusKeydown(composing);assert.equal(composing.defaultPrevented,false);
  f.hide();const after=key();f.ctrl.handleStaleFocusKeydown(after);
  assert.equal(after.defaultPrevented,false)
});
test('session keeps the same direct focus invocation and keyboard listener',()=>{
  const app=readFileSync(new URL('../js/app.js',import.meta.url),'utf8');
  assert.match(app,/showQuestion\(\);restoreQuizFocusAfterStart\(\)/);
  // Audio button visibility now updates between timer start and focus; both behaviors must remain.
  assert.match(app,/focusAnswerField\(\);startVocabTimer\(\)/);
  assert.match(app,/document\.addEventListener\('keydown',quizFocus\.handleStaleFocusKeydown,true\)/);
});

test('iPad touchend starts and focuses answer synchronously without waiting for a click',()=>{
 const callbacks={},options={};
 const button={addEventListener(name,fn,opt){callbacks[name]=fn;options[name]=opt}};
 const f=setup(),guard={accept:()=>true};
 let starts=0;
 bindQuizSessionStart(button,()=>{starts++;f.ctrl.focusAnswerField()},guard);
 callbacks.touchstart({touches:[{clientX:40,clientY:90}]});
 let prevented=false;
 callbacks.touchend({changedTouches:[{clientX:40,clientY:90}],cancelable:true,preventDefault(){prevented=true}});
 assert.equal(starts,1);
 assert.equal(f.doc.activeElement,f.input);
 assert.equal(prevented,true);
 assert.equal(options.touchend.passive,false);
});
test('touch gesture and synthetic click cannot double-start a session',()=>{
 const callbacks={},button={addEventListener(name,fn){callbacks[name]=fn}};
 let starts=0,last=0;
 const guard={accept(){const now=Date.now();if(now-last<650)return false;last=now;return true}};
 bindQuizSessionStart(button,()=>{starts++},guard);
 callbacks.touchstart({touches:[{clientX:10,clientY:20}]});
 callbacks.touchend({changedTouches:[{clientX:12,clientY:23}],cancelable:true,preventDefault(){}});
 callbacks.click();
 assert.equal(starts,1);
});
test('scrolling and cancelled touches never accidentally start quiz',()=>{
 const callbacks={},button={addEventListener(name,fn){callbacks[name]=fn}};
 let starts=0;
 bindQuizSessionStart(button,()=>starts++,{accept:()=>true});
 callbacks.touchstart({touches:[{clientX:10,clientY:20}]});
 callbacks.touchend({changedTouches:[{clientX:40,clientY:90}],cancelable:true,preventDefault(){}});
 callbacks.touchstart({touches:[{clientX:10,clientY:20}]});
 callbacks.touchcancel();
 callbacks.touchend({changedTouches:[{clientX:10,clientY:20}],cancelable:true,preventDefault(){}});
 assert.equal(starts,0);
});

test('restarting a finished quiz resets the stale hidden input before focusing again',()=>{
 const f=setup({focused:true,hidden:true});
 // A finished quiz may leave the hidden answer as document.activeElement.
 assert.equal(f.doc.activeElement,f.input);
 f.ctrl.releaseHiddenAnswerFocus();
 assert.notEqual(f.doc.activeElement,f.input);
 f.ctrl.focusAnswerField();
 assert.equal(f.doc.activeElement,f.input);
 assert.equal(f.focusCalls,1);
});
test('restart path releases hidden answer before revealing the new quiz',()=>{
 const app=readFileSync(new URL('../js/app.js',import.meta.url),'utf8');
 assert.match(app,/releaseHiddenAnswerFocus\(\);setup\.classList\.add\('hidden'\)/);
 assert.match(app,/function showFinish\(\)\{stopFocusGuard\(\);clearVocabTimer\(\);hideAnswerNotice\(\);releaseHiddenAnswerFocus\(\)/);
 assert.match(app,/bindQuizSessionStart\(\$\('#again'\),restartSession,startActionGuard\)/);
});

test('focus guard restores iPad hardware typing after missing focus in a review session',()=>{
 const f=setup(),intervals=[],stopped=[];
 // Existing test setup exercises the controller directly; a dedicated fake here
 // makes repeated focus checks deterministic without real timers.
 const doc={hidden:false,body:{tagName:'BODY'},documentElement:{tagName:'HTML'},activeElement:null,querySelector:()=>null};
 doc.activeElement=doc.body;
 const input={disabled:false,readOnly:false,focus(){doc.activeElement=input;this.calls=(this.calls||0)+1}};
 const quiz={classList:{contains:()=>false}};
 const c=createQuizFocusController({input,quiz,getCurrent:()=>({id:1}),isChecked:()=>false,
  doc,nav:{userAgent:'iPad',platform:'iPad',maxTouchPoints:5},
  win:{innerHeight:750,scrollBy(){}},frame:()=>{},later:()=>{},
  repeat:(callback,ms)=>{intervals.push({callback,ms});return intervals.length},
  stopRepeat:id=>stopped.push(id)});
 c.startFocusGuard();
 assert.equal(intervals[0].ms,850);
 intervals[0].callback();
 assert.equal(doc.activeElement,input);
 assert.equal(input.calls,1);
 intervals[0].callback();
 assert.equal(input.calls,1);
 c.stopFocusGuard();
 assert.deepEqual(stopped,[1]);
});
test('focus guard pauses when quiz is hidden, question checked, document hidden or dialog open',()=>{
 const states={hidden:false,checked:false,dialog:false,disabled:false},doc={body:{tagName:'BODY'},documentElement:{tagName:'HTML'},activeElement:null,querySelector:()=>states.dialog?{open:true}:null};
 doc.activeElement=doc.body;
 Object.defineProperty(doc,'hidden',{get:()=>states.hidden});
 const input={disabled:false,readOnly:false,focus(){doc.activeElement=input;this.calls=(this.calls||0)+1}};
 const quiz={classList:{contains:()=>states.hiddenQuiz||false}};
 const c=createQuizFocusController({input,quiz,getCurrent:()=>({}),isChecked:()=>states.checked,
  doc,nav:{userAgent:'iPad',platform:'iPad',maxTouchPoints:5},win:{innerHeight:750},frame:()=>{},later:()=>{}});
 for(const blocked of ['hidden','checked','dialog','hiddenQuiz']){
   states[blocked]=true;c.restoreActiveQuizFocus();assert.notEqual(doc.activeElement,input,blocked);states[blocked]=false;
 }
 input.disabled=true;c.restoreActiveQuizFocus();assert.notEqual(doc.activeElement,input);
 input.disabled=false;
 doc.activeElement={tagName:'INPUT'};c.restoreActiveQuizFocus();assert.notEqual(doc.activeElement,input);
});
test('quiz starts and exits consistently manage the iPad focus guard',()=>{
 const app=readFileSync(new URL('../js/app.js',import.meta.url),'utf8');
 assert.match(app,/quiz\.classList\.remove\('hidden'\);startFocusGuard\(\)/);
 assert.match(app,/function showReviewBank\(\)\{stopFocusGuard\(\)/);
 assert.match(app,/function showFinish\(\)\{stopFocusGuard\(\)/);
 assert.match(app,/input\.addEventListener\('blur',quizFocus\.handleAnswerBlur\)/);
 assert.match(app,/document\.addEventListener\('visibilitychange',quizFocus\.handleFocusEnvironmentChange\)/);
});
