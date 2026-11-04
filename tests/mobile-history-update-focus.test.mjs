import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');

test('dashboard practiced words opens history on phone, with a back control',()=>{
  const html=read('index.html'),app=read('js/app.js'),ui=JSON.parse(read('data/ui.pl.json'));
  assert.match(html,/id="homeHistoryLink"/);
  assert.match(html,/id="historyBackToPractice"/);
  assert.match(app,/\$\('#homeHistoryLink'\)\?\.addEventListener\('click',\(\)=>setMainNav\('history'\)\)/);
  assert.match(app,/\$\('#historyBackToPractice'\)\?\.addEventListener\('click',\(\)=>setMainNav\('practice'\)\)/);
  assert.ok(ui.history.open&&ui.history.back);
});

test('mobile answer buttons preserve keyboard focus across one-step and two-step checks',()=>{
  const app=read('js/app.js');
  assert.match(app,/submit\.addEventListener\('pointerdown',event=>\{/);
  assert.match(app,/event\.pointerType==='touch'&&document\.activeElement===input/);
  assert.match(app,/event\.preventDefault\(\)/);
  assert.match(app,/if\(\(navigator\.maxTouchPoints\|\|0\)===0\)input\.disabled=true/);
  assert.match(app,/if\(\(navigator\.maxTouchPoints\|\|0\)===0\)\{try\{submit\.focus/);
  assert.match(app,/if\(oneStep&&!pendingAudioAdvance\)/);
});

test('update prompt wraps its label and action within narrow phone screens',()=>{
  const css=read('css/styles.css');
  assert.match(css,/\.app-update-banner\{box-sizing:border-box;max-width:calc\(100vw - 24px\)/);
  assert.match(css,/\.app-update-banner #appUpdateLabel\{flex:1 1 155px;min-width:0/);
  assert.match(css,/@media\(max-width:370px\)\{\.app-update-banner #appUpdateLabel\{flex-basis:100%\}/);
  assert.match(css,/\.app-update-banner #applyAppUpdate\{width:100%;flex-basis:100%/);
});
