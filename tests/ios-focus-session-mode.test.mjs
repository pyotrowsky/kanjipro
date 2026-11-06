import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');

test('session mode description switches dynamically for normal and slow mode',()=>{
 const app=read('js/app.js'),html=read('index.html'),ui=JSON.parse(read('data/ui.pl.json'));
 assert.match(html,/id="sessionFocusNote"/);
 assert.match(html,/data-i18n="setup.session_focus_note_normal"/);
 assert.match(app,/focusNote\.textContent=t\(sessionFocus\(\)==='slow'\?'setup\.session_focus_note_slow':'setup\.session_focus_note_normal'\)/);
 assert.match(app,/document\.querySelectorAll\('input\[name="sessionFocus"\]'\)\.forEach/);
 assert.ok(ui.setup.session_focus_note_normal);
 assert.ok(ui.setup.session_focus_note_slow);
 assert.notEqual(ui.setup.session_focus_note_normal,ui.setup.session_focus_note_slow)
});
test('touch session starts invoke the shared trusted-gesture handler rather than pointerdown cancellation',()=>{
 const app=read('js/app.js');
 assert.match(app,/bindQuizSessionStart\(\$\('#start'\),start,startActionGuard\)/);
 assert.match(app,/bindQuizSessionStart\(\$\('#reviewStart'\),startReview,startActionGuard\)/);
 assert.match(app,/bindQuizSessionStart\(\$\('#reviewBankStart'\),startReview,startActionGuard\)/);
 assert.match(app,/bindQuizSessionStart\(\$\('#again'\),restartSession,startActionGuard\)/);
 assert.doesNotMatch(app,/\$\('#start'\)\.addEventListener\('pointerdown'/);
 assert.match(app,/showQuestion\(\);restoreQuizFocusAfterStart\(\)/);
 assert.match(app,/focusAnswerField\(\);startVocabTimer\(\)/);
});
