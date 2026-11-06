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
