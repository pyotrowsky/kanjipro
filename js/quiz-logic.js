// Pure answer evaluation and session retry logic. No storage, DOM or cloud dependencies.
import {hira,esc} from './japanese-text.js';

export function normalizeAnswer(s,mode){const x=hira(s);return mode==='romaji'?x.replace(/[-‐‑‒–—―−]/g,'ー').replace(/づ/g,'ず').replace(/ぢ/g,'じ'):x}
export function acceptedAnswers(q,mode){return(q.accepted_answers||q.answer_display||[]).map(s=>normalizeAnswer(s,mode))}
export function answerText(q){return(q.answer_display||q.accepted_answers||[]).join(' / ')}
export function rawMeaning(q){return q.meanings?.length?q.meanings.join(' · '):(q.meaning||'')}
export function meaningText(q){const m=rawMeaning(q);return m?esc(m):''}

// Mutates the caller's queue like the original quiz implementation.
export function requeueWrongAnswer(queue,current,sessionKind,random=Math.random){
  if(sessionKind==='review'){queue.push({...current});return}
  const min=Math.min(3,queue.length),max=Math.min(7,queue.length);
  const pos=max?Math.floor(random()*(max-min+1))+min:0;
  queue.splice(pos,0,{...current})
}
