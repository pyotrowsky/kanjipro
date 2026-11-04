import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createQuizActionGuard} from '../js/quiz-action-guard.js';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('accidental rapid double touch cannot check and advance twice',()=>{
  let clock=1000;
  const guard=createQuizActionGuard({now:()=>clock,minIntervalMs:420});
  assert.equal(guard.accept(),true);
  clock=1100;assert.equal(guard.accept(),false);
  clock=1419;assert.equal(guard.accept(),false);
  clock=1420;assert.equal(guard.accept(),true);
  guard.reset();assert.equal(guard.accept(),true)
});
test('mobile guards cover quiz tap, Enter key repeat and session start',()=>{
  const app=read('js/app.js');
  assert.ok(app.includes("quizActionGuard.accept())check"));
  assert.ok(app.includes("startActionGuard.accept())start()"));
  assert.ok(app.includes("e.repeat||!quizActionGuard.accept()"));
  assert.ok(app.includes("if(pendingAudioAdvance)return"))
});
test('automatic audio is opt-in and one-step waits for recording',()=>{
  const app=read('js/app.js'),html=read('index.html'),ui=JSON.parse(read('data/ui.pl.json'));
  assert.ok(html.includes('id="autoAudioAfterAnswer" type="checkbox"'));
  assert.match(app,/localStorage\.getItem\(AUTO_AUDIO_KEY\)==='enabled'/);
  assert.match(app,/privateAudio\.play\(autoId,\{waitForEnd:true\}\)/);
  assert.match(app,/if\(!advance&&current\.type==='vocabulary'/);
  assert.match(app,/auto_audio_after_answer:savedAutoAudio\(\)/);
  assert.ok(ui.settings.auto_audio_toggle)
});
test('touch targets use manipulation without disabling normal scrolling',()=>{
  const css=read('css/styles.css');
  assert.match(css,/touch-action:manipulation/);
  assert.doesNotMatch(css,/touch-action:none/)
});
