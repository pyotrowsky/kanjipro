import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {romajiToHiragana,hira,esc} from '../js/japanese-text.js';

const examples=[
 ['gakusei','がくせい'],['kya','きゃ'],['shou','しょう'],
 ['gakkou','がっこう'],['dzu','づ'],['du','づ'],
 ['dja','ぢゃ'],['nn','ん'],['nna','んな'],['nnya','んにゃ'],
 ["n'a",'んあ'],['fa','ふぁ'],['tsa','つぁ'],
 ['カタカナ','カタカナ'],['てづくり','てづくり'],
 ['foo-bar','ふぉおーばr']
];
for(const [source,expected] of examples){
  test('romaji conversion: '+source,()=>assert.equal(romajiToHiragana(source,true),expected));
}
test('unfinished n remains pending until finalization',()=>{
  assert.equal(romajiToHiragana('n',false),'n');
  assert.equal(romajiToHiragana('n',true),'ん');
});
test('katakana and spacing normalize without changing kanji',()=>{
  assert.equal(hira(' ガ・ク セイ。'),'がくせい');
  assert.equal(hira('学校'),'学校');
});
test('HTML is escaped and null inputs are harmless',()=>{
  assert.equal(esc('<b>&"'), '&lt;b&gt;&amp;&quot;');
  assert.equal(esc(null),'');
});
test('new helper module is imported and precached for offline launches',()=>{
  const app=readFileSync(new URL('../js/app.js',import.meta.url),'utf8');
  const sw=readFileSync(new URL('../sw.js',import.meta.url),'utf8');
  assert.match(app,/import \{romajiToHiragana,hira,esc\} from '\.\/japanese-text\.js'/);
  assert.ok(sw.includes("'./js/japanese-text.js'"));
  assert.match(sw,/wsjj-kanji-pro-3\.23-5/);
});
