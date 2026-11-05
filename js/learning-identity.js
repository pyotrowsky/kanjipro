// Keep historical review entries for the same Anki note under one stable ID.
// Legacy correction sessions omitted learning_id and used a surface/reading fallback.
import {dictionaryVocabId} from './dictionary-helpers.js';
import {hira} from './japanese-text.js';

const isRecord=x=>Boolean(x)&&typeof x==='object'&&!Array.isArray(x);
const count=x=>Math.max(0,Number(x)||0);
const recent=x=>Number(x?.last_seen_at)||0;

export function legacyVocabularyId(surface,readings){
  const accepted=[...(readings||[])].map(hira).filter(Boolean).sort();
  return 'VOCAB:'+String(surface||'')+'|'+accepted.join('/');
}
export function vocabularyLearningAliases(vocabulary){
  const groups=new Map();
  for(const word of vocabulary||[]){
    const canonical=dictionaryVocabId(word);
    if(!canonical.startsWith('VOCAB_NOTE:'))continue;
    if(!groups.has(canonical))groups.set(canonical,[]);
    groups.get(canonical).push(word);
  }
  const targets=new Map();
  for(const [canonical,words] of groups){
    const surface=words[0].surface;
    const readings=[];
    for(const word of words){
      for(const reading of (word.accepted_readings?.length?word.accepted_readings:[word.reading])){
        if(reading&&!readings.includes(reading))readings.push(reading);
      }
    }
    const alias=legacyVocabularyId(surface,readings);
    if(!targets.has(alias))targets.set(alias,new Set());
    targets.get(alias).add(canonical);
  }
  return new Map([...targets].filter(([,ids])=>ids.size===1).map(([alias,ids])=>[alias,[...ids][0]]));
}
function mergeTimings(a,b){
  const seen=new Set(),out=[];
  for(const value of [...(Array.isArray(a)?a:[]),...(Array.isArray(b)?b:[])]){
    if(!isRecord(value))continue;
    const key=JSON.stringify([value.session_id,value.at,value.response_ms,value.recognition_ms,value.input_mode,value.rss_ms,value.correct,value.quality]);
    if(seen.has(key))continue;
    seen.add(key);out.push(value);
  }
  return out.sort((a,b)=>(Number(a.at)||0)-(Number(b.at)||0)).slice(-80);
}
export function mergeVocabularyLearningRecord(canonical,legacy){
  const latest=recent(legacy)>recent(canonical)?legacy:canonical;
  const reviews=count(canonical.reviews)+count(legacy.reviews);
  const correct=count(canonical.correct)+count(legacy.correct);
  const wrong=count(canonical.wrong)+count(legacy.wrong);
  return {...canonical,...legacy,...latest,reviews:Math.max(reviews,correct+wrong),correct,wrong,
    correct_streak:count(latest.correct_streak),
    last_seen_at:Math.max(recent(canonical),recent(legacy)),
    last_wrong_at:Math.max(Number(canonical.last_wrong_at)||0,Number(legacy.last_wrong_at)||0)||null,
    timing_history:mergeTimings(canonical.timing_history,legacy.timing_history)};
}
export function canonicalizeVocabularyLearning(stats,vocabulary){
  const result={...(stats||{})};
  const aliases=vocabularyLearningAliases(vocabulary);
  let changed=false;
  for(const [alias,canonical] of aliases){
    if(alias===canonical||!isRecord(result[alias]))continue;
    result[canonical]=isRecord(result[canonical])?mergeVocabularyLearningRecord(result[canonical],result[alias]):result[alias];
    delete result[alias];
    changed=true;
  }
  return {learning:result,changed};
}
