import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {learningRowsFromObject,mistakeRowsFromObject,objectFromRows,mistakeObjectFromRows,cleanRecordObject} from '../js/storage-records.js';

test('learning stats round-trip preserves stable IDs and timing histories',()=>{
  const input={'VOCAB_NOTE:123':{reviews:4,correct:3,wrong:1,timing_history:[{rss_ms:950,session_id:'s1'}]},'ON:学':{reviews:2}};
  const rows=learningRowsFromObject(input);
  assert.deepEqual(rows[0],{id:'VOCAB_NOTE:123',...input['VOCAB_NOTE:123']});
  assert.deepEqual(objectFromRows(rows),input);
  assert.deepEqual(input['VOCAB_NOTE:123'].timing_history,[{rss_ms:950,session_id:'s1'}]);
});
test('mistake records round-trip retains id in each restored mistake',()=>{
  const input={'VOCAB:学校':{wrong_count:3,credits:1,prompt:'学校'},'VOCAB:先生':{wrong_count:1}};
  const rows=mistakeRowsFromObject(input);
  assert.deepEqual(rows[0],{...input['VOCAB:学校'],id:'VOCAB:学校'});
  const restored=mistakeObjectFromRows(rows);
  assert.equal(restored['VOCAB:学校'].id,'VOCAB:学校');
  assert.equal(restored['VOCAB:学校'].wrong_count,3);
});
test('invalid source values are ignored as before',()=>{
  const input={valid:{reviews:1},empty:null,number:3,list:[1,2],text:'bad'};
  assert.deepEqual(learningRowsFromObject(input),[{id:'valid',reviews:1}]);
  assert.deepEqual(mistakeRowsFromObject(input),[{reviews:1,id:'valid'}]);
  assert.deepEqual(objectFromRows([null,{}, {id:'x',reviews:2}]),{x:{reviews:2}});
  assert.deepEqual(mistakeObjectFromRows([{}, {id:'x',wrong_count:2}]),{x:{id:'x',wrong_count:2}});
});
test('backup import sanitizer keeps record objects and ignores arrays or scalars',()=>{
  const payload={good:{reviews:2},list:[],empty:null,bad:15,text:'oops'};
  assert.deepEqual(cleanRecordObject(payload),{good:{reviews:2}});
  assert.deepEqual(cleanRecordObject([]),{});
  assert.deepEqual(cleanRecordObject(null),{});
});
test('storage record module is used by app and cached for offline startup',()=>{
  const app=readFileSync(new URL('../js/app.js',import.meta.url),'utf8');
  const sw=readFileSync(new URL('../sw.js',import.meta.url),'utf8');
  assert.match(app,/from '\.\/storage-records\.js'/);
  assert.ok(sw.includes("'./js/storage-records.js'"));
});
