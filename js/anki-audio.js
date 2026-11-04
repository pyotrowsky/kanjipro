// Local-only Anki audio import. No upload, Firebase, or changes to study records.
// ZIP reading is lazy; the SQLite parser is loaded only when an import is requested.
import {hira} from './japanese-text.js';
import {dictionaryVocabId} from './dictionary-helpers.js';
import {decodeAnkiCollection,decodeAnkiMediaIndex,decodeAnkiAudioFile} from './anki-modern.js';

const DB_NAME='wsjj-kanji-pro-private-audio';
const ZIP_JS='https://cdn.jsdelivr.net/npm/@zip.js/zip.js@2.8.15/+esm';
const SQL_JS='https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.13.0/sql-wasm.js';
const SQL_WASM='https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.13.0/sql-wasm.wasm';
const ALLOWED=/\.(?:mp3|ogg|oga|opus|wav|m4a|aac)$/i;
const FIELDS=['AudioDictionary','Audio'];
const ON_FIELDS=['AudioOnyomi','AudioOn'];
const KUN_FIELDS=['AudioKunyomi','AudioKun'];

export function cleanAudioText(value){
  return hira(String(value??'').replace(/<[^>]*>/g,'').replace(/\[[^\]]*\]/g,'').replace(/[\s\u3000]/g,'')).normalize('NFKC');
}
export function extractSounds(value){
  return [...String(value||'').matchAll(/\[sound:([^\]]+)\]/gi)]
    .map(m=>m[1]).filter(name=>ALLOWED.test(name)&&!name.includes('/')&&!name.includes('\\'));
}
export function selectNamedAudio(fields,names){
  for(const name of names){
    const key=Object.keys(fields||{}).find(k=>k.toLowerCase()===name.toLowerCase());
    const sounds=extractSounds(key?fields[key]:'');
    if(sounds.length)return sounds[0]
  }
  return null
}
export function selectNoteAudio(fields){return selectNamedAudio(fields,FIELDS)}
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

// Audio from Japanese (Kanji) notes belongs to ON/KUN readings, not vocab playback.
export function matchAllAudioNotes(notes,vocabulary,kanji=[]){
  const {matched,ambiguous}=matchAudioNotes(notes,vocabulary);
  const kanjiById=new Map(),kanjiByCharacter=new Map();
  for(const k of kanji){
    if(!k?.character)continue;
    if(k.note_id!=null)kanjiById.set(String(k.note_id),k.character);
    kanjiByCharacter.set(k.character,k.character)
  }
  for(const note of notes){
    const fields=note.fields||{};
    const on=selectNamedAudio(fields,ON_FIELDS),kun=selectNamedAudio(fields,KUN_FIELDS);
    if(!on&&!kun)continue;
    const expression=Object.entries(fields).find(([name])=>['expression','kanji','character'].includes(name.toLowerCase()))?.[1]||'';
    const kanjiChar=kanjiById.get(String(note.id))||kanjiByCharacter.get(cleanAudioText(expression));
    if(!kanjiChar)continue;
    if(on&&!matched.has('ON:'+kanjiChar))matched.set('ON:'+kanjiChar,{filename:on,noteId:note.id});
    if(kun&&!matched.has('KUN:'+kanjiChar))matched.set('KUN:'+kanjiChar,{filename:kun,noteId:note.id})
  }
  return {matched,ambiguous}
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
    // Modern Anki SQLite moved note types and field names into dedicated tables.
    const modern=Boolean(db.exec("SELECT name FROM sqlite_master WHERE type='table' AND name='notetypes'")[0]?.values?.length);
    let models={};
    if(modern){
      const names=db.exec('SELECT ntid,ord,name FROM fields ORDER BY ntid,ord');
      for(const [mid,ord,name] of names[0]?.values||[]){
        const id=String(mid);
        if(!models[id])models[id]={flds:[]};
        models[id].flds.push({name,ord:Number(ord)})
      }
    }else models=JSON.parse(db.exec('SELECT models FROM col LIMIT 1')[0]?.values?.[0]?.[0]||'{}');
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
// Returns only audio named in Anki audio fields AND present in the package's media index.
// Unrelated images, GIFs, videos and even unmatched audio are never decompressed.
export function selectAudioMediaEntries(matched,mediaMap,zipEntries){
  const audioByName=new Map();
  let ignoredNonAudio=0;
  for(const [number,name] of Object.entries(mediaMap)){
    if(!ALLOWED.test(name)){ignoredNonAudio++;continue}
    if(!audioByName.has(name))audioByName.set(name,String(number));
  }
  const chosen=new Map();
  for(const [id,{filename}] of matched){
    if(!ALLOWED.test(filename))continue;
    const number=audioByName.get(filename);
    if(number==null)continue;
    const entry=zipEntries.get(number);
    if(entry&&!entry.directory)chosen.set(id,{filename,entry});
  }
  return {chosen,ignoredNonAudio}
}
export function selectAnkiCollection(entries){
  // Newer exports include a dummy collection.anki2 containing a warning card.
  if(entries.has('collection.anki21b'))return entries.get('collection.anki21b');
  if(entries.has('collection.anki21'))return entries.get('collection.anki21');
  if(entries.has('collection.anki2'))return entries.get('collection.anki2');
  throw new Error('Brakuje collection.anki21 lub collection.anki2 w archiwum.');
}
export function createPrivateAudioLibrary(vocabulary,kanji=[]){
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
  // Warm the next question before the answer tap, so iOS can start playback
  // inside the user gesture (without an IndexedDB round trip).
  let prepared=null,preparing=null;
  const fetchRow=async id=>{
    const db=await ready();
    return new Promise((resolve,reject)=>{
      const req=db.transaction('audio','readonly').objectStore('audio').get(id);
      req.onsuccess=()=>resolve(req.result);
      req.onerror=()=>reject(req.error)
    })
  };
  const prepare=async id=>{
    if(!id||!has(id))return false;
    if(prepared?.id===id)return true;
    if(preparing?.id===id)return preparing.promise;
    const job=(async()=>{
      const row=await fetchRow(id);
      if(!row?.blob)return false;
      const url=URL.createObjectURL(row.blob);
      if(prepared?.url)URL.revokeObjectURL(prepared.url);
      prepared={id,url};
      return true
    })();
    preparing={id,promise:job};
    try{return await job}finally{if(preparing?.promise===job)preparing=null}
  };
  const play=async(id,{waitForEnd=false}={})=>{
    if(!has(id))return false;
    // Start synchronously when warm: essential for Safari gesture restrictions.
    if(prepared?.id!==id)await prepare(id);
    if(prepared?.id!==id)return false;
    const player=new Audio(prepared.url);
    let resolveFinished;
    const finished=new Promise(resolve=>{resolveFinished=resolve});
    let finishedOnce=false;
    const finish=()=>{
      if(finishedOnce)return;
      finishedOnce=true;
      player.removeEventListener('ended',finish);
      player.removeEventListener('error',finish);
      player.removeEventListener('abort',finish);
      resolveFinished()
    };
    player.addEventListener('ended',finish);
    player.addEventListener('error',finish);
    player.addEventListener('abort',finish);
    try{
      await player.play();
      if(waitForEnd)await finished;
      return true
    }catch(err){finish();throw err}
  };
  const clear=async()=>{
    const db=await ready();await transaction(db,'readwrite',store=>store.clear());ids.clear();
    if(prepared?.url)URL.revokeObjectURL(prepared.url);
    prepared=null;preparing=null
  };
  const importApkg=async(file,onProgress=()=>{})=>{
    if(!file||!file.name.toLowerCase().endsWith('.apkg'))throw new Error('Wybierz pakiet .apkg.');
    // The archive stays in its original Blob. Only matching audio entries are extracted.
    await ready();
    onProgress('Otwieranie archiwum Anki…');
    const zip=await import(ZIP_JS);
    const reader=new zip.ZipReader(new zip.BlobReader(file));
    try{
      const entries=await reader.getEntries();
      const index=new Map(entries.map(entry=>[entry.filename,entry]));
      const sqlite=selectAnkiCollection(index);
      const modern=sqlite.filename==='collection.anki21b';
      const media=index.get('media');
      if(!media)throw new Error('Eksport nie zawiera indeksu mediów. Zaznacz multimedia podczas eksportu.');
      onProgress('Odczytywanie indeksu mediów Anki…');
      const map=await decodeAnkiMediaIndex(await media.getData(new zip.Uint8ArrayWriter()),modern);
      onProgress('Dekodowanie bazy notatek '+(modern?'Anki 21b':'Anki')+'…');
      const collectionBytes=await decodeAnkiCollection(await sqlite.getData(new zip.Uint8ArrayWriter()),modern);
      const notes=await readNotes(collectionBytes);
      onProgress('Dopasowywanie nagrań do słówek i odczytów kanji…');
      const {matched,ambiguous}=matchAllAudioNotes(notes,vocabulary,kanji);
      const {chosen,ignoredNonAudio}=selectAudioMediaEntries(matched,map,index);
      let imported=0,skipped=0,processed=0;
      const db=await ready();
      for(const [id,{filename}] of matched){
        processed++;
        const entry=chosen.get(id)?.entry;
        if(!entry||entry.uncompressedSize>8*1024*1024){skipped++;continue}
        try{
          const bytes=await decodeAnkiAudioFile(await entry.getData(new zip.Uint8ArrayWriter()),modern);
          const ext=filename.split('.').pop().toLowerCase();
          const mime={mp3:'audio/mpeg',ogg:'audio/ogg',oga:'audio/ogg',opus:'audio/ogg',wav:'audio/wav',m4a:'audio/mp4',aac:'audio/aac'}[ext];
          const blob=new Blob([bytes],{type:mime});
          await transaction(db,'readwrite',store=>store.put({id,blob,filename,importedAt:Date.now()}));
          ids.add(id);imported++
        }catch(err){console.warn('Anki audio skipped:',filename,err);skipped++}
        if(processed%20===0)onProgress('Zapisano '+imported+' / '+matched.size+' dopasowanych nagrań…')
      }
      return{notes:notes.length,matched:matched.size,imported,skipped,ambiguous:ambiguous.length,ignoredNonAudio,total:ids.size}
    }finally{await reader.close()}
  };
  return {ready,has,count,play,prepare,clear,importApkg}
}
