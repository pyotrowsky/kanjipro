// Kanji.pro 3.15: Firebase Auth with persistent login + Firestore sync journals.
// Each session is an independent immutable-ish document; device seeds are sharded.
// No OAuth tokens or user data are placed in public app configuration.
import {mergeDeviceJournals} from './cloud-sync.js';

const FIREBASE_SDK_VERSION='12.19.0';
const JOURNAL_FORMAT='wsjj-kanji-pro-device-journal';
const JOURNAL_KEY_PREFIX='wsjj-kanji-pro:firebase-journal:v1:';
const OWNER_KEY='wsjj-kanji-pro:firebase-owner:v1';
const DEVICE_KEY='wsjj-kanji-pro:firebase-device:v1';
const SHARD_LIMIT=85000;
const JOURNAL_STORAGE_LIMIT=4*1024*1024;

function parseLocal(key){
  try{return JSON.parse(localStorage.getItem(key)||'null')}catch{return null}
}
function clone(value){return JSON.parse(JSON.stringify(value))}
function deviceId(){
  let value=localStorage.getItem(DEVICE_KEY);
  if(!value){
    value=typeof crypto?.randomUUID==='function'?crypto.randomUUID().replaceAll('-',''):
      Date.now().toString(36)+Math.random().toString(36).slice(2);
    localStorage.setItem(DEVICE_KEY,value)
  }
  return value
}
function isPlain(x){return x!==null&&typeof x==='object'&&!Array.isArray(x)}
function validJournal(j){
  return j?.format===JOURNAL_FORMAT&&j?.version===1&&typeof j.device_id==='string'&&
    Array.isArray(j.events)&&isPlain(j.seed)&&isPlain(j.seed.learning)&&isPlain(j.seed.mistakes)
}
function sizeOf(obj){return new TextEncoder().encode(JSON.stringify(obj)).length}
function packSeed(seed){
  const entries=[];
  for(const section of ['learning','mistakes']){
    for(const [key,value] of Object.entries(seed[section]||{}))entries.push({section,key,value})
  }
  const parts=[],empty=()=>({learning:{},mistakes:{}});
  let current=empty(),size=0;
  for(const item of entries){
    const weight=sizeOf(item)+50;
    if(weight>SHARD_LIMIT)throw new Error('Pojedynczy rekord historii jest zbyt duży, aby go zsynchronizować.');
    if(size+weight>SHARD_LIMIT&&size){parts.push(current);current=empty();size=0}
    current[item.section][item.key]=item.value;
    size+=weight
  }
  parts.push(current);
  return parts
}
function packEvents(events){
  const chunks=[],groups=new Map();
  for(const e of events){
    if(!isPlain(e)||typeof e.id!=='string')continue;
    const key=String(e.session_id||'legacy');
    if(!groups.has(key))groups.set(key,[]);
    groups.get(key).push(e)
  }
  for(const [session,items] of groups){
    let bucket=[],size=0,index=0;
    const add=()=>{if(bucket.length){chunks.push({session,index,events:bucket});index++;bucket=[];size=0}};
    for(const item of items){
      const weight=sizeOf(item)+50;
      if(weight>SHARD_LIMIT)throw new Error('Pojedyncze zdarzenie sesji jest zbyt duże.');
      if(size+weight>SHARD_LIMIT&&size)add();
      bucket.push(item);size+=weight
    }
    add()
  }
  return chunks
}
export function buildFirebaseDocs(journal){
  if(!validJournal(journal))throw new Error('Niepoprawny format historii Firebase.');
  const common={format:JOURNAL_FORMAT,version:1,device_id:journal.device_id};
  const seeds=packSeed(journal.seed).map((seed,index)=>({
    id:'seed-'+journal.device_id+'-'+index,
    data:{...common,seed,events:[]}
  }));
  const sessions=packEvents(journal.events).map(chunk=>({
    id:'session-'+journal.device_id+'-'+chunk.session.replace(/[^a-zA-Z0-9_-]/g,'_')+'-'+chunk.index,
    data:{...common,seed:{learning:{},mistakes:{}},events:chunk.events}
  }));
  for(const item of [...seeds,...sessions]){
    if(sizeOf(item.data)>160000)throw new Error('Plik synchronizacji przekroczył dopuszczalny rozmiar fragmentu.')
  }
  return [...seeds,...sessions]
}
export function mergeFirebaseSnapshots(docs){
  return mergeDeviceJournals(docs.filter(d=>validJournal(d)))
}

export function createFirebaseSync({snapshot,applySnapshot,afterApply,onStatus}){
  let auth=null,db=null,sdk=null,user=null,running=null,enabled=false,lastSync=0;
  let journal=null,ownerUid=localStorage.getItem(OWNER_KEY)||'';
  let initialized=false;
  const status=(state,detail='')=>onStatus?.(state,detail);
  function saveJournal(){
    if(!journal)return;
    const raw=JSON.stringify(journal);
    if(new Blob([raw]).size>JOURNAL_STORAGE_LIMIT)throw new Error('Dziennik jest pełny (4 MB). Zrób kopię zapasową historii i zgłoś problem.');
    localStorage.setItem(JOURNAL_KEY_PREFIX+ownerUid,raw)
  }
  function ensureJournal(uid){
    if(ownerUid&&ownerUid!==uid)throw new Error('Na tym urządzeniu jest historia przypisana do innego konta Google. Zaloguj się na poprzednie konto, aby uniknąć wymieszania danych.');
    if(!ownerUid){ownerUid=uid;localStorage.setItem(OWNER_KEY,ownerUid)}
    if(journal)return journal;
    const old=parseLocal(JOURNAL_KEY_PREFIX+ownerUid);
    journal=validJournal(old)?old:{format:JOURNAL_FORMAT,version:1,device_id:deviceId(),seed:clone(snapshot()),events:[],uploaded:{}};
    if(!isPlain(journal.uploaded))journal.uploaded={};
    saveJournal();return journal
  }
  function appendAnswer(payload){
    if(!ownerUid)return; // Before first account link, existing local learning stats will become the seed.
    const j=ensureJournal(ownerUid);
    const e={...clone(payload),id:j.device_id+':'+(typeof crypto?.randomUUID==='function'?crypto.randomUUID():Date.now().toString(36)+Math.random().toString(36).slice(2))};
    j.events.push(e);
    try{saveJournal()}catch(err){j.events.pop();status('error',String(err.message||err));throw err}
  }
  async function sync(){
    if(!user||!db||!sdk){status('disconnected');return false}
    if(ownerUid&&ownerUid!==user.uid){status('account_conflict');return false}
    if(running)return running;
    const uid=user.uid;
    running=(async()=>{
      status('syncing');
      try{
        if(navigator.onLine===false)throw new Error('Brak internetu. Wyniki pozostają zapisane lokalnie.');
        const j=ensureJournal(uid),ref=sdk.firestore.collection(db,'users',uid,'journals');
        for(const fragment of buildFirebaseDocs(j)){
          if(auth.currentUser?.uid!==uid)throw new Error('Zmiana konta w czasie synchronizacji.');
          const fingerprint=fragment.id.startsWith('seed-')?'seed-v1':
            String(fragment.data.events.length)+':'+String(fragment.data.events.at(-1)?.id||'');
          if(j.uploaded[fragment.id]===fingerprint)continue;
          await sdk.firestore.setDoc(sdk.firestore.doc(ref,fragment.id),fragment.data);
          j.uploaded[fragment.id]=fingerprint;saveJournal()
        }
        const remote=await sdk.firestore.getDocsFromServer(ref);
        if(auth.currentUser?.uid!==uid)throw new Error('Zmiana konta w czasie synchronizacji.');
        // Local pieces are included even if the remote index is eventually behind.
        const localFragments=buildFirebaseDocs(j).map(x=>x.data);
        const remoteFragments=remote.docs.map(x=>x.data());
        const merged=mergeFirebaseSnapshots([...remoteFragments,...localFragments]);
        await applySnapshot(merged);
        afterApply?.();
        lastSync=Date.now();status('synced',new Date().toLocaleString('pl-PL'));
        return true
      }catch(err){console.warn('Firebase sync:',err);status('error',String(err?.message||err));return false}
      finally{running=null}
    })();
    return running
  }
  function connect(){
    if(!enabled||!auth||!sdk){status('unconfigured');return}
    if(auth.currentUser){void sync();return}
    // Popup is triggered directly by the user's click (important for mobile Safari).
    void sdk.auth.signInWithPopup(auth,new sdk.auth.GoogleAuthProvider()).catch(err=>{
      status('error',String(err?.message||err))
    })
  }
  async function disconnect(){
    if(!auth||!sdk)return;
    try{await sdk.auth.signOut(auth);user=null;status('disconnected')}catch(err){status('error',String(err?.message||err))}
  }
  function handleUser(next){
    user=next;
    if(!next){status('disconnected');return}
    if(ownerUid&&ownerUid!==next.uid){status('account_conflict');return}
    try{
      ensureJournal(next.uid);
      status('connected',next.email||next.displayName||'');
      void sync()
    }catch(err){status('error',String(err?.message||err))}
  }
  async function init(){
    status('initializing');
    try{
      const response=await fetch('./data/firebase-config.json?v=3.15',{cache:'no-store'});
      if(!response.ok)throw new Error('Nie znaleziono konfiguracji Firebase.');
      const cfg=await response.json();
      const valid=['apiKey','authDomain','projectId','appId'].every(k=>typeof cfg[k]==='string'&&cfg[k].trim());
      if(!valid){status('unconfigured');return}
      const base='https://www.gstatic.com/firebasejs/'+FIREBASE_SDK_VERSION+'/';
      const [appApi,authApi,firestoreApi]=await Promise.all([
        import(base+'firebase-app.js'),import(base+'firebase-auth.js'),import(base+'firebase-firestore.js')
      ]);
      sdk={auth:authApi,firestore:firestoreApi};
      const app=appApi.getApps().length?appApi.getApp():appApi.initializeApp(cfg);
      auth=authApi.getAuth(app);
      db=firestoreApi.getFirestore(app);
      await authApi.setPersistence(auth,authApi.browserLocalPersistence);
      enabled=true;initialized=true;
      authApi.onAuthStateChanged(auth,handleUser,err=>status('error',String(err.message||err)));
    }catch(err){console.warn('Firebase initialization:',err);status('error',String(err?.message||err))}
  }
  function syncOnReturn(){
    if(user&&enabled&&Date.now()-lastSync>30000)void sync()
  }
  return {init,connect,disconnect,sync,syncOnReturn,appendAnswer,
    isConfigured:()=>enabled,isConnected:()=>Boolean(user&&enabled&&ownerUid===user.uid),
    hasJournal:()=>Boolean(ownerUid),isInitialized:()=>initialized}
}
