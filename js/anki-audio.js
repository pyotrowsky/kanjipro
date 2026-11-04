// Local-only Anki audio import. No upload, Firebase, or changes to study records.
// ZIP reading is lazy; the SQLite parser is loaded only when an import is requested.
import {hira} from './japanese-text.js';
import {dictionaryVocabId} from './dictionary-helpers.js';

const DB_NAME='wsjj-kanji-pro-private-audio';
const MAX_APKG=180*1024*1024;
const ZIP_JS='https://cdn.jsdelivr.net/npm/@zip.js/zip.js@2.8.15/+esm';
const SQL_JS='https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.13.0/sql-wasm.js';
const SQL_WASM='https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.13.0/sql-wasm.wasm';
const ALLOWED=/\.(?:mp3|ogg|oga|opus|wav|m4a|aac)$/i;
const FIELDS=['AudioDictionary','Audio','AudioOnyomi','AudioKunyomi'];

export function cleanAudioText(value){
  return hira(String(value??'').replace(/<[^>]*>/g,'').replace(/\[[^\]]*\]/g,'').replace(/[\s\u3000]/g,'')).normalize('NFKC');
}
export function extractSounds(value){
  return [...String(value||'').matchAll(/\[sound:([^\]]+)\]/gi)]
    .map(m=>m[1]).filter(name=>ALLOWED.test(name)&&!name.includes('/')&&!name.includes('\\'));
}
export function selectNoteAudio(fields){
  for(const name of FIELDS){
    const key=Object.keys(fields).find(k=>k.toLowerCase()===name.toLowerCase());
    const sounds=extractSounds(key?fields[key]:'');
    if(sounds.length)return sounds[0];
  }
  return null;
}
export function matchAudioNotes(notes,vocabulary){
  const byId=new Map(),byPair=new Map();
  const key=(surface,reading)=>cleanAudioText(surface)+'|'+cleanAudioText(reading);
  for(const word of vocabulary){
    const id=dictionaryVocabId(word);
    for(const noteId of [word.note_id,word.source_note_id]){
      if(noteId!=null&&String(noteId).trim())byId.set(String(noteId).trim(),id);
    }
    const readings=word.accepted_readings?.length?word.accepted_readings:[word.reading];
    for(const reading of readings||[]){
      const pair=key(word.surface,reading);
      if(!byPair.has(pair))byPair.set(pair,new Set());
      byPair.get(pair).add(id);
    }
  }
  const matched=new Map(),ambiguous=[];
  for(const note of notes){
    const filename=selectNoteAudio(note.fields||{});
    if(!filename)continue;
    let id=byId.get(String(note.id||'').trim());
    if(!id){
      const fields=note.fields||{};
      const val=names=>Object.entries(fields).find(([name])=>names.includes(name.toLowerCase()))?.[1]||'';
      const surface=val(['expression','word','vocabulary','japanese','front']);
      const reading=val(['reading','kana','pronunciation']);
      if(surface&&reading){
        const candidates=byPair.get(key(surface,reading));
        if(candidates?.size===1)id=[...candidates][0];
        else if(candidates?.size>1)ambiguous.push({noteId:note.id,surface,reading});
      }
    }
    if(id&&!matched.has(id))matched.set(id,{filename,noteId:note.id});
  }
  return {matched,ambiguous};
}

function loadScript(src){
  return new Promise((resolve,reject)=>{
    if(typeof window.initSqlJs==='function'){resolve();return}
    const script=document.createElement('script');
    script.src=src;script.async=true;script.crossOrigin='anonymous';
    script.onload=resolve;script.onerror=()=>reject(new Error('Nie udało się pobrać biblioteki SQLite. Połącz się z internetem.'));
    document.head.append(script);
  })
}
async function readNotes(sqliteBytes){
  await loadScript(SQL_JS);
  const SQL=await window.initSqlJs({locateFile:()=>SQL_WASM});
  const db=new SQL.Database(sqliteBytes);
  try{
    const models=JSON.parse(db.exec('SELECT models FROM col LIMIT 1')[0]?.values?.[0]?.[0]||'{}');
    const result=db.exec('SELECT id,mid,flds FROM notes');
    if(!result.length)return [];
    return result[0].values.map(([id,mid,flds])=>{
      const model=models[String(mid)];
      const values=String(flds||'').split('\u001f');
      const fields={};
      for(const field of model?.flds||[])fields[field.name]=values[field.ord]||'';
      return{id:String(id),fields}
    });
  }finally{db.close()}
}
function openAudioDb(){
  return new Promise((resolve,reject)=>{
    const request=indexedDB.open(DB_NAME,1);
    request.onupgradeneeded=()=>request.result.createObjectStore('audio',{keyPath:'id'});
    request.onsuccess=()=>resolve(request.result);
    request.onerror=()=>reject(request.error)
  })
}
function transaction(db,mode,fn){
  return new Promise((resolve,reject)=>{
    const tx=db.transaction('audio',mode),store=tx.objectStore('audio');
    let output;try{output=fn(store)}catch(err){reject(err);return}
    tx.oncomplete=()=>resolve(output);
    tx.onerror=()=>reject(tx.error);
    tx.onabort=()=>reject(tx.error)
  })
}
export function selectAnkiCollection(entries){
  // Newer exports include a dummy collection.anki2 containing a warning card.
  if(entries.has('collection.anki21'))return entries.get('collection.anki21');
  if(entries.has('collection.anki21b'))throw new Error('Nowy format Anki (.anki21b) nie jest jeszcze obsługiwany. Wyeksportuj talię ponownie z opcją „Obsługuj starsze wersje Anki” oraz „Dołącz multimedia”.');
  if(entries.has('collection.anki2'))return entries.get('collection.anki2');
  throw new Error('Brakuje collection.anki21 lub collection.anki2 w archiwum.');
}
export function createPrivateAudioLibrary(vocabulary){
  let dbPromise=null,ids=new Set();
  const ready=async()=>{
    if(!dbPromise)dbPromise=openAudioDb().then(async db=>{
      const keys=await new Promise((resolve,reject)=>{
        const tx=db.transaction('audio','readonly'),request=tx.objectStore('audio').getAllKeys();
        request.onsuccess=()=>resolve(request.result||[]);
        request.onerror=()=>reject(request.error)
      });
      ids=new Set(keys);return db
    }).catch(err=>{dbPromise=null;throw err});
    return dbPromise
  };
  const has=id=>ids.has(id);
  const count=()=>ids.size;
  const play=async id=>{
    if(!has(id))return false;
    const db=await ready();
    const row=await new Promise((resolve,reject)=>{
      const req=db.transaction('audio','readonly').objectStore('audio').get(id);
      req.onsuccess=()=>resolve(req.result);
      req.onerror=()=>reject(req.error)
    });
    if(!row?.blob)return false;
    const url=URL.createObjectURL(row.blob);
    const player=new Audio(url);
    const cleanup=()=>URL.revokeObjectURL(url);
    player.addEventListener('ended',cleanup,{once:true});
    player.addEventListener('error',cleanup,{once:true});
    try{await player.play();return true}catch(err){cleanup();throw err}
  };
  const clear=async()=>{
    const db=await ready();await transaction(db,'readwrite',store=>store.clear());ids.clear()
  };
  const importApkg=async(file,onProgress=()=>{})=>{
    if(!file||!file.name.toLowerCase().endsWith('.apkg'))throw new Error('Wybierz pakiet .apkg.');
    if(file.size>MAX_APKG)throw new Error('Pakiet ma ponad 180 MB. Wyeksportuj mniejszą talię z Anki.');
    await ready();
    onProgress('Otwieranie archiwum Anki…');
    const zip=await import(ZIP_JS);
    const reader=new zip.ZipReader(new zip.BlobReader(file));
    try{
      const entries=await reader.getEntries();
      const index=new Map(entries.map(entry=>[entry.filename,entry]));
      const sqlite=selectAnkiCollection(index);
      const media=index.get('media');
      if(!media)throw new Error('Eksport nie zawiera indeksu mediów. Zaznacz multimedia podczas eksportu.');
      const decoder=new TextDecoder();
      const map=JSON.parse(decoder.decode(await media.getData(new zip.Uint8ArrayWriter())));
      onProgress('Odczytywanie notatek i dopasowywanie nagrań…');
      const notes=await readNotes(await sqlite.getData(new zip.Uint8ArrayWriter()));
      const {matched,ambiguous}=matchAudioNotes(notes,vocabulary);
      const filenames=new Map(Object.entries(map).map(([number,name])=>[name,number]));
      let imported=0,skipped=0,processed=0;
      const db=await ready();
      for(const [id,{filename}] of matched){
        processed++;
        const n=filenames.get(filename),entry=n==null?null:index.get(String(n));
        if(!entry||!ALLOWED.test(filename)||entry.uncompressedSize>8*1024*1024){skipped++;continue}
        try{
          const bytes=await entry.getData(new zip.Uint8ArrayWriter());
          const ext=filename.split('.').pop().toLowerCase();
          const mime={mp3:'audio/mpeg',ogg:'audio/ogg',oga:'audio/ogg',opus:'audio/ogg',wav:'audio/wav',m4a:'audio/mp4',aac:'audio/aac'}[ext];
          const blob=new Blob([bytes],{type:mime});
          await transaction(db,'readwrite',store=>store.put({id,blob,filename,importedAt:Date.now()}));
          ids.add(id);imported++
        }catch(err){console.warn('Anki audio skipped:',filename,err);skipped++}
        if(processed%20===0)onProgress('Zapisano '+imported+' / '+matched.size+' dopasowanych nagrań…')
      }
      return{notes:notes.length,matched:matched.size,imported,skipped,ambiguous:ambiguous.length,total:ids.size}
    }finally{await reader.close()}
  };
  return {ready,has,count,play,clear,importApkg}
}
