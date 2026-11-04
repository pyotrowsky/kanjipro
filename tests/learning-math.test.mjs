import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {medianMs,kanaReadingUnits,rssFromTimes,quantile,smoothedAccuracy} from '../js/learning-math.js';

test('median uses valid nonnegative measurements only and never edits its input',()=>{
  const values=[3400,700,NaN,-10,1900,Infinity];
  assert.equal(medianMs(values),1900);
  assert.equal(values.length,6);
  assert.equal(values[0],3400);
  assert.equal(medianMs([]),null);
  assert.equal(medianMs([500,1000]),750);
});
test('quantile interpolation matches the existing personal RSS cutoff formula',()=>{
  const sorted=[200,400,600,800];
  assert.equal(quantile(sorted,.25),350);
  assert.equal(quantile(sorted,.5),500);
  assert.equal(quantile(sorted,.75),650);
  assert.equal(quantile([],0.5),null);
});
test('RSS preserves response time minus recognition time per mora',()=>{
  assert.equal(rssFromTimes(2600,600,4),1100);
  assert.equal(rssFromTimes(800,800,4),800);
  assert.equal(rssFromTimes(600,800,4),null);
  assert.equal(rssFromTimes(2600,600,0),null);
  assert.equal(rssFromTimes(NaN,600,3),null);
  assert.equal(rssFromTimes(2600,-1,3),null);
});
test('kana readings preserve small kana, sokuon, long vowels, and katakana conversion',()=>{
  assert.equal(kanaReadingUnits('きょう'),2);
  assert.equal(kanaReadingUnits('がっこう'),4);
  assert.equal(kanaReadingUnits('コーヒー'),4);
  assert.equal(kanaReadingUnits('きゃ'),1);
  assert.equal(kanaReadingUnits(''),1);
});
test('accuracy smoothing retains the existing neutral prior and boundaries',()=>{
  assert.equal(smoothedAccuracy({reviews:0,correct:0}),0.5);
  assert.equal(smoothedAccuracy({reviews:3,correct:2}),3/5);
  assert.equal(smoothedAccuracy({reviews:2,correct:2}),3/4);
  assert.equal(smoothedAccuracy(null),0.5);
});
test('math module is imported by app and precached for offline PWA launches',()=>{
  const app=readFileSync(new URL('../js/app.js',import.meta.url),'utf8');
  const sw=readFileSync(new URL('../sw.js',import.meta.url),'utf8');
  assert.match(app,/from '\.\/learning-math\.js'/);
  assert.ok(sw.includes("'./js/learning-math.js'"));
  assert.match(sw,/wsjj-kanji-pro-3\.23-5/);
});
