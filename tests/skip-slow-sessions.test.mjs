import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
test('skip action is small on the left and shares the double-tap guard',()=>{
  const html=read('index.html'),app=read('js/app.js'),css=read('css/styles.css');
  assert.match(html,/<div class="answer-actions"><button id="skipQuestion"[^>]*>✕<\/button><button id="submit"/);
  assert.match(app,/if\(!checked&&!pendingAudioAdvance&&quizActionGuard\.accept\(\)\)check\(false,true\)/);
  assert.match(css,/\.answer-box \.answer-actions \.skip-question\{width:43px/);
});
test('skipping reveals the answer and records a wrong attempt without fake RSS data',()=>{
  const app=read('js/app.js');
  assert.match(app,/function check\(advance=false,skip=false\)/);
  assert.match(app,/if\(!val&&!skip\)return/);
  assert.match(app,/const ok=!skip&&accepted\(current\)\.includes\(val\)/);
  assert.match(app,/recordVocabTiming\(current,ok,elapsed,val,\{skipped:skip\}\)/);
  assert.match(app,/recordPersistentWrong\(current\)/);
  assert.match(app,/requeueWrongAnswer\(queue,current,sessionKind\)/);
  assert.match(app,/timing:current\.type==='vocabulary'/);
});
test('slow vocabulary mode uses RSS upper quartile, selected chapters and word limit',()=>{
  const html=read('index.html'),app=read('js/app.js'),ui=JSON.parse(read('data/ui.pl.json'));
  assert.match(html,/name="sessionFocus" value="normal" checked/);
  assert.match(html,/name="sessionFocus" value="slow"/);
  assert.match(app,/profile\.reliable&&profile\.rss_ms>baseline\.slow_cutoff_ms/);
  assert.match(app,/const slow=slowVocabPool\(\);if\(!slow\.length\)/);
  assert.match(app,/beginSession\(limited,'slow'\)/);
  assert.match(app,/sessionFocus:sessionFocus\(\)/);
  assert.match(app,/function restartSession\(\)\{if\(sessionKind==='slow'\)/);
  assert.ok(ui.setup.slow_needs_baseline&&ui.setup.slow_empty)
});
