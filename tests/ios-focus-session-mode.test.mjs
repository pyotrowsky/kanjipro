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
test('iPad START focus happens synchronously and touch pointerdown does not focus START',()=>{
 const app=read('js/app.js');
 assert.match(app,/\$\('#start'\)\.addEventListener\('pointerdown',event=>\{[\s\S]*?event\.pointerType==='touch'\)event\.preventDefault\(\)/);
 assert.match(app,/\$\('#start'\)\.addEventListener\('click',\(\)=>\{if\(startActionGuard\.accept\(\)\)start\(\)\}\)/);
 assert.match(app,/showQuestion\(\);restoreQuizFocusAfterStart\(\)/);
 assert.match(app,/focusAnswerField\(\)\}function compareReading/);
});
