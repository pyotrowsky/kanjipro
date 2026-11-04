import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createQuizFocusController} from '../js/quiz-focus.js';

function scrolling({platform='iPad',rect={top:320,bottom:374,height:54},active=true,hidden=false}={}){
  const scrolls=[],frames=[];
  const input={getBoundingClientRect:()=>rect,focus(){}};
  const doc={activeElement:active?input:null};
  const controller=createQuizFocusController({input,
    quiz:{classList:{contains:()=>hidden}},
    getCurrent:()=>null,isChecked:()=>false,doc,
    win:{visualViewport:{offsetTop:0,height:700},innerHeight:700,scrollBy:x=>scrolls.push(x)},
    nav:{platform,userAgent:platform==='iPad'?'Mozilla iPad Safari':'Mozilla Mac Safari',maxTouchPoints:platform==='MacIntel'?5:0},
    frame:fn=>frames.push(fn),later:()=>{},makeInputEvent:()=>({type:'input'})
  });
  controller.keepAnswerVisible();
  while(frames.length)frames.shift()();
  return scrolls
}
test('visible focused answer does not scroll the page',()=>{
  assert.equal(scrolling().length,0)
});
test('answer outside upper viewport scrolls into view',()=>{
  const calls=scrolling({rect:{top:-700,bottom:-646,height:54}});
  assert.equal(calls.length,1);
  assert.ok(calls[0].top<0);
  assert.equal(calls[0].behavior,'auto')
});
test('answer below viewport scrolls into view',()=>{
  const calls=scrolling({rect:{top:1100,bottom:1154,height:54}});
  assert.equal(calls.length,1);
  assert.ok(calls[0].top>0)
});
test('touchscreen iPad with desktop Safari user agent remains supported',()=>{
  const calls=scrolling({platform:'MacIntel',rect:{top:-350,bottom:-296,height:54}});
  assert.equal(calls.length,1)
});
test('desktop Mac, hidden quiz, and inactive field do not scroll',()=>{
  assert.equal(scrolling({platform:'desktop',rect:{top:-350,bottom:-296,height:54}}).length,0);
  assert.equal(scrolling({hidden:true,rect:{top:-350,bottom:-296,height:54}}).length,0);
  assert.equal(scrolling({active:false,rect:{top:-350,bottom:-296,height:54}}).length,0)
});
test('typing conversion does not reset caret, and answer remains focused after Enter',()=>{
  const app=readFileSync(new URL('../js/app.js',import.meta.url),'utf8');
  assert.ok(!app.includes('input.setSelectionRange('));
  assert.ok(app.includes('input.value=after'));
  assert.ok(app.includes("input.addEventListener('focus',keepAnswerVisible)"));
  assert.ok(app.includes("try{submit.focus({preventScroll:true})}catch{submit.focus()}"))
});
test('new focus controller is cached for offline use and version badge is visible on wide screens',()=>{
  const app=readFileSync(new URL('../js/app.js',import.meta.url),'utf8');
  const sw=readFileSync(new URL('../sw.js',import.meta.url),'utf8');
  const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
  const css=readFileSync(new URL('../css/shiba-dashboard.css',import.meta.url),'utf8');
  assert.match(app,/from '\.\/quiz-focus\.js'/);
  assert.ok(sw.includes("'./js/quiz-focus.js'"));
  assert.match(sw,/wsjj-kanji-pro-3\.23-8/);
  assert.match(html,/class="sidebar-version"[^>]*>v<span data-i18n="app.badge">3\.23<\/span>/);
  assert.match(css,/@media\(min-width:740px\)[\s\S]*?\.sidebar-version\{display:block/);
});
