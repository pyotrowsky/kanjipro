// Stateless helpers for dictionary filters, searches and stable vocabulary IDs.
// These preserve the pre-refactor matching and ID rules.
import {romajiToHiragana,hira} from './japanese-text.js';

export function dictionaryLessonMatch(item,filter){
  if(!filter||filter==='all')return true;
  if(filter.startsWith('book:'))return Number(item.book)===Number(filter.slice(5));
  if(filter.startsWith('lesson:'))return item.lesson===filter.slice(7);
  return true
}

export function dictionarySearchTerms(raw){
  const text=String(raw||'').normalize('NFKC').trim().toLowerCase(),
        compact=text.replace(/\s+/g,''),
        converted=romajiToHiragana(text,true),
        kana=hira(converted);
  return{text,compact,kana}
}

export function includesDictionaryQuery(values,terms,cleanDisplayText){
  if(!terms.text)return true;
  for(const value of values){
    const raw=cleanDisplayText(value).normalize('NFKC').toLowerCase(),
          compact=raw.replace(/\s+/g,''),
          kana=hira(raw);
    if(raw.includes(terms.text)||compact.includes(terms.compact)||(terms.kana&&kana.includes(terms.kana)))return true
  }
  return false
}

export function dictionaryVocabId(v){
  const noteId=String(v.note_id||v.source_note_id||'').trim();
  if(noteId)return 'VOCAB_NOTE:'+noteId;
  const answers=[...(v.accepted_readings?.length?v.accepted_readings:[v.reading])].map(hira).filter(Boolean).sort();
  return 'VOCAB:'+v.surface+'|'+answers.join('/')
}
