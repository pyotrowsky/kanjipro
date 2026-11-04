// Pure, unchanged learning-time and accuracy calculations extracted from app.js.
// No access to browser state, storage, clocks, DOM or Firebase.
import {hira} from './japanese-text.js';

export function medianMs(values){
  const sorted=values.filter(v=>Number.isFinite(v)&&v>=0).sort((a,b)=>a-b);
  if(!sorted.length)return null;
  const mid=Math.floor(sorted.length/2);
  return sorted.length%2?sorted[mid]:(sorted[mid-1]+sorted[mid])/2
}

export function kanaReadingUnits(reading){
  const kana=Array.from(hira(String(reading||''))).filter(ch=>/[ぁ-ゖー]/u.test(ch));
  const count=kana.filter((ch,i)=>!/^[ぁぃぅぇぉゃゅょゎ]$/u.test(ch)||i===0).length;
  return Math.max(1,count)
}

export function rssFromTimes(responseMs,recognitionMs,units){
  if(!Number.isFinite(responseMs)||!Number.isFinite(recognitionMs)||!Number.isFinite(units)||units<1||recognitionMs<0||responseMs<recognitionMs)return null;
  return recognitionMs+(responseMs-recognitionMs)/units
}

export function quantile(sorted,fraction){
  if(!sorted.length)return null;
  const pos=(sorted.length-1)*fraction,low=Math.floor(pos),high=Math.ceil(pos),weight=pos-low;
  return sorted[low]*(1-weight)+sorted[high]*weight
}

export function smoothedAccuracy(s){const reviews=Math.max(0,Number(s?.reviews)||0),correct=Math.max(0,Number(s?.correct)||0);return(correct+1)/(reviews+2)}
