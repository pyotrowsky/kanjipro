import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {dictionaryLessonMatch,dictionarySearchTerms,includesDictionaryQuery,dictionaryVocabId} from '../js/dictionary-helpers.js';

const cleaner=value=>String(value??'').replace(/<[^>]*>/g,'').replace(/\\u00a0/g,' ').replace(/\\s+/g,' ').trim();

test('book, chapter and all-chapter filters retain their previous semantics',()=>{
  const item={book:3,lesson:'3-12'};
  assert.equal(dictionaryLessonMatch(item,'all'),true);
  assert.equal(dictionaryLessonMatch(item,'book:3'),true);
  assert.equal(dictionaryLessonMatch(item,'book:2'),false);
  assert.equal(dictionaryLessonMatch(item,'lesson:3-12'),true);
  assert.equal(dictionaryLessonMatch(item,'lesson:3-13'),false);
  assert.equal(dictionaryLessonMatch(item,''),true);
});
test('dictionary terms normalize uppercase, spaces, romaji, and katakana',()=>{
  assert.deepEqual(dictionarySearchTerms(' GAKUSEI '),{text:'gakusei',compact:'gakusei',kana:'がくせい'});
  assert.deepEqual(dictionarySearchTerms('ガクセイ'),{text:'ガクセイ',compact:'ガクセイ',kana:'がくせい'});
  assert.deepEqual(dictionarySearchTerms('ＫＡＮＪＩ'),{text:'kanji',compact:'kanji',kana:'かんじ'});
});
test('dictionary matches romaji against kana and written Japanese without false positives',()=>{
  const entries=['学生','がくせい','GAKUSEI','student'];
  assert.equal(includesDictionaryQuery(entries,dictionarySearchTerms('gakusei'),cleaner),true);
  assert.equal(includesDictionaryQuery(['がくせい'],dictionarySearchTerms('ガクセイ'),cleaner),true);
  assert.equal(includesDictionaryQuery(['東京'],dictionarySearchTerms('osaka'),cleaner),false);
  assert.equal(includesDictionaryQuery(['東京'],dictionarySearchTerms(''),cleaner),true);
});
test('dictionary keeps separate note IDs and distinct homograph readings',()=>{
  assert.equal(dictionaryVocabId({note_id:123,surface:'学生'}),'VOCAB_NOTE:123');
  assert.equal(dictionaryVocabId({source_note_id:' 42 ',surface:'学生'}),'VOCAB_NOTE:42');
  assert.equal(dictionaryVocabId({surface:'市場',accepted_readings:['いちば']}),'VOCAB:市場|いちば');
  assert.equal(dictionaryVocabId({surface:'市場',accepted_readings:['しじょう']}),'VOCAB:市場|しじょう');
  assert.equal(dictionaryVocabId({surface:'学生',accepted_readings:['ガクセイ','がくせい']}),'VOCAB:学生|がくせい/がくせい');
});
test('dictionary module is imported and precached offline',()=>{
  const app=readFileSync(new URL('../js/app.js',import.meta.url),'utf8');
  const sw=readFileSync(new URL('../sw.js',import.meta.url),'utf8');
  assert.match(app,/from '\.\/dictionary-helpers\.js'/);
  assert.ok(sw.includes("'./js/dictionary-helpers.js'"));
  assert.match(sw,/wsjj-kanji-pro-3\.23-7/);
});
