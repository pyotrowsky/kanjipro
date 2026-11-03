import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const app=readFileSync(new URL('../js/app.js',import.meta.url),'utf8');
const start=app.indexOf('const IPADOS_WEBKIT=');
const end=app.indexOf('function showQuestion(){',start);
assert.ok(start>=0&&end>start,'iPadOS input visibility protection exists');
const snippet=app.slice(start,end);

function checkScroll({
  platform='iPad',userAgent='Mozilla/5.0 (iPad; CPU OS 26_0 like Mac OS X)',
  rect={top:320,bottom:374,height:54},active=true,hidden=false,
  visualViewport={offsetTop:0,height:700}
}={}){
  const scrollCalls=[];
  const input={getBoundingClientRect:()=>rect,focus:()=>{}};
  const ctx={
    navigator:{platform,userAgent,maxTouchPoints:platform==='MacIntel'?5:0},
    input,quiz:{classList:{contains:()=>hidden}},
    document:{activeElement:active?input:null},
    window:{visualViewport,scrollBy:delta=>scrollCalls.push(delta)},
    requestAnimationFrame:callback=>callback()
  };
  vm.runInNewContext(snippet+'\nkeepAnswerVisible();',ctx);
  return scrollCalls
}

test('focused and visible answer does not cause any scroll',()=>{
  assert.equal(checkScroll().length,0)
});

test('an iPadOS answer hidden above the viewport is brought back',()=>{
  const calls=checkScroll({rect:{top:-700,bottom:-646,height:54}});
  assert.equal(calls.length,1);
  assert.ok(calls[0].top<0);
  assert.equal(calls[0].behavior,'auto')
});

test('an iPadOS answer hidden below the viewport is brought back',()=>{
  const calls=checkScroll({rect:{top:1100,bottom:1154,height:54}});
  assert.equal(calls.length,1);
  assert.ok(calls[0].top>0)
});

test('an iPad with Mac-style browser user agent is supported',()=>{
  const calls=checkScroll({platform:'MacIntel',userAgent:'Mozilla/5.0 (Macintosh; Intel Mac OS X)',rect:{top:-350,bottom:-296,height:54}});
  assert.equal(calls.length,1)
});

test('other desktops do not use the iPadOS-specific workaround',()=>{
  assert.equal(checkScroll({platform:'MacIntel',userAgent:'Mozilla/5.0 (Macintosh; Intel Mac OS X)',rect:{top:-350,bottom:-296,height:54},active:false}).length,0);
  const scroll=[];
  const input={getBoundingClientRect:()=>({top:-100,bottom:-40,height:60})};
  const ctx={navigator:{platform:'MacIntel',userAgent:'Mozilla/5.0 (Macintosh; Intel Mac OS X)',maxTouchPoints:0},
    input,quiz:{classList:{contains:()=>false}},document:{activeElement:input},
    window:{visualViewport:{offsetTop:0,height:700},scrollBy:x=>scroll.push(x)},
    requestAnimationFrame:cb=>cb()};
  vm.runInNewContext(snippet+'\nkeepAnswerVisible();',ctx);
  assert.equal(scroll.length,0)
});

test('hidden quiz and unfocused field never trigger scroll',()=>{
  const hiddenRect={top:-900,bottom:-850,height:50};
  assert.equal(checkScroll({rect:hiddenRect,hidden:true}).length,0);
  assert.equal(checkScroll({rect:hiddenRect,active:false}).length,0)
});

test('typing conversion no longer repositions the caret with setSelectionRange',()=>{
  assert.ok(!app.includes('input.setSelectionRange('));
  assert.ok(app.includes('input.value=after'));
  assert.ok(app.includes("input.addEventListener('focus',keepAnswerVisible)"));
  assert.ok(app.includes("try{submit.focus({preventScroll:true})}catch{submit.focus()}"))
});
