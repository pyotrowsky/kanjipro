// WSJJ Kanji.pro 3.14 — optional Google Drive sync. No access tokens in persistent storage.
// Each browser/device has its own Drive appDataFolder journal. Other devices never overwrite it.
const JOURNAL_KEY='wsjj-kanji-pro:cloud-journal:v1';
const DEVICE_KEY='wsjj-kanji-pro:cloud-device:v1';
const SCOPE='https://www.googleapis.com/auth/drive.appdata';
const PREFIX='kanjipro-sync-v1-';
const FORMAT='wsjj-kanji-pro-device-journal';
const MAX_JOURNAL_BYTES=4*1024*1024;

export function mergeDeviceJournals(documents){
  const learning={},mistakes={},allEvents=new Map();
  const isPlain=x=>Boolean(x)&&typeof x==='object'&&!Array.isArray(x);
  const positive=x=>Math.max(0,Number(x)||0);
  const joinTimes=(a,b)=>{
    const all=[...(Array.isArray(a)?a:[]),...(Array.isArray(b)?b:[])];
    const keys=new Set(),out=[];
    for(const x of all){
      if(!isPlain(x))continue;
      const key=JSON.stringify([x.session_id,x.at,x.response_ms,x.recognition_ms,x.input_mode,x.rss_ms,x.correct]);
      if(keys.has(key))continue;
      keys.add(key);out.push(x)
    }
    return out.sort((a,b)=>(Number(a.at)||0)-(Number(b.at)||0)).slice(-30)
  };
  for(const doc of documents){
    if(!isPlain(doc)||doc.format!==FORMAT||doc.version!==1||typeof doc.device_id!=='string')continue;
    const seeds=doc.seed||{};
    for(const [id,incoming] of Object.entries(seeds.learning||{})){
      if(!isPlain(incoming))continue;
      const prev=learning[id];
      if(!prev){learning[id]={...incoming};continue}
      const newer=positive(incoming.last_seen_at)>=positive(prev.last_seen_at)?incoming:prev;
      const correct=Math.max(positive(prev.correct),positive(incoming.correct));
      const wrong=Math.max(positive(prev.wrong),positive(incoming.wrong));
      learning[id]={...prev,...incoming,...newer,reviews:Math.max(positive(prev.reviews),positive(incoming.reviews),correct+wrong),
        correct,wrong,timing_history:joinTimes(prev.timing_history,incoming.timing_history)}
    }
    for(const [id,record] of Object.entries(seeds.mistakes||{})){
      if(!isPlain(record))continue;
      const prev=mistakes[id];
      const timestamp=x=>Math.max(positive(x?.last_wrong_at),positive(x?.last_correct_at));
      if(!prev||timestamp(record)>timestamp(prev))mistakes[id]={...record}
      else if(prev)mistakes[id].wrong_count=Math.max(positive(prev.wrong_count),positive(record.wrong_count))
    }
    for(const e of Array.isArray(doc.events)?doc.events:[]){
      if(!isPlain(e)||typeof e.id!=='string'||typeof e.question_id!=='string'||!Number.isFinite(e.at))continue;
      if(!allEvents.has(e.id))allEvents.set(e.id,e)
    }
  }
  const events=[...allEvents.values()].sort((a,b)=>a.at-b.at||a.id.localeCompare(b.id));
  for(const e of events){
    const at=e.at,id=e.question_id;
    if(e.learned&&typeof e.learning_id==='string'){
      const prev=learning[e.learning_id]||{},correct=Boolean(e.correct);
      learning[e.learning_id]={...prev,reviews:positive(prev.reviews)+1,
        correct:positive(prev.correct)+(correct?1:0),wrong:positive(prev.wrong)+(correct?0:1),
        correct_streak:correct?positive(prev.correct_streak)+1:0,
        last_seen_at:Math.max(positive(prev.last_seen_at),at),
        last_wrong_at:correct?prev.last_wrong_at||null:at,last_result:correct?'correct':'wrong'}
    }
    if(e.timing&&typeof e.learning_id==='string'&&Number.isFinite(e.timing.response_ms)){
      const prev=learning[e.learning_id]||{};
      const entry={...e.timing};
      learning[e.learning_id]={...prev,timing_history:joinTimes(prev.timing_history,[entry])}
    }
    if(e.mistake_action==='wrong'&&isPlain(e.mistake_snapshot)){
      const prev=mistakes[id]||{};
      mistakes[id]={...prev,...e.mistake_snapshot,wrong_count:positive(prev.wrong_count)+1,
        correct_streak:0,last_wrong_at:at}
    }else if(e.mistake_action==='credit'&&mistakes[id]){
      const prev=mistakes[id],streak=positive(prev.correct_streak)+1;
      if(streak>=2)delete mistakes[id];
      else mistakes[id]={...prev,correct_streak:streak,last_correct_at:at}
    }
  }
  return {learning,mistakes,events:events.length}
}

function readLocal(key){try{return JSON.parse(localStorage.getItem(key)||'null')}catch{return null}}
function clone(data){return JSON.parse(JSON.stringify(data))}
function localDeviceId(){
  let id=localStorage.getItem(DEVICE_KEY);
  if(id)return id;
  id=typeof crypto?.randomUUID==='function'?crypto.randomUUID().replaceAll('-',''):
    Date.now().toString(36)+Math.random().toString(36).slice(2);
  localStorage.setItem(DEVICE_KEY,id);
  return id
}
function validJournal(j){return j?.format===FORMAT&&j?.version===1&&typeof j.device_id==='string'&&Array.isArray(j.events)&&j.seed&&typeof j.seed==='object'}
function unionOwn(local,remote){
  if(!validJournal(remote)||local.device_id!==remote.device_id)return local;
  const all=new Map();
  for(const event of [...remote.events,...local.events])if(event&&typeof event.id==='string')all.set(event.id,event);
  return {...local,seed:remote.seed||local.seed,events:[...all.values()].sort((a,b)=>a.at-b.at)}
}

export function createCloudSync({snapshot,applySnapshot,onStatus,afterApply}){
  let clientId='',token='',tokenExpiresAt=0,tokenClient=null,journal=readLocal(JOURNAL_KEY),running=null;
  const state=(code,detail='')=>onStatus?.(code,detail);
  function ensureJournal(){
    if(validJournal(journal))return journal;
    journal={format:FORMAT,version:1,device_id:localDeviceId(),seed:clone(snapshot()),events:[]};
    saveJournal();return journal
  }
  function saveJournal(){
    const text=JSON.stringify(journal);
    if(new Blob([text]).size>MAX_JOURNAL_BYTES)throw new Error('Historia synchronizacji przekroczyła 4 MB. Wyeksportuj kopię i skontaktuj się z administratorem.');
    localStorage.setItem(JOURNAL_KEY,text)
  }
  function appendAnswer(payload){
    if(!validJournal(journal))return;
    const e={...payload,id:journal.device_id+':'+(typeof crypto?.randomUUID==='function'?crypto.randomUUID():Date.now().toString(36)+Math.random().toString(36).slice(2))};
    journal.events.push(clone(e));
    try{saveJournal()}catch(err){journal.events.pop();state('error',String(err.message||err));throw err}
  }
  async function loadConfig(){
    try{
      const r=await fetch('./data/cloud-config.json?v=3.14',{cache:'no-store'});
      if(!r.ok)throw new Error('missing config');
      const cfg=await r.json();
      if(typeof cfg.google_client_id==='string'&&/^[\w.-]+\.apps\.googleusercontent\.com$/.test(cfg.google_client_id))clientId=cfg.google_client_id
    }catch(err){console.warn('Cloud configuration not available:',err)}
    state(clientId?'disconnected':'unconfigured')
  }
  async function loadGoogleScript(){
    if(window.google?.accounts?.oauth2)return;
    await new Promise((resolve,reject)=>{
      const script=document.createElement('script');script.src='https://accounts.google.com/gsi/client';script.async=true;
      script.onload=resolve;script.onerror=()=>reject(new Error('Nie udało się wczytać logowania Google'));
      document.head.appendChild(script)
    })
  }
  async function drive(url,options={}){
    if(!token||Date.now()>tokenExpiresAt-30000)throw new Error('Sesja Google wygasła — połącz ponownie.');
    const headers=new Headers(options.headers||{});
    headers.set('Authorization','Bearer '+token);
    const response=await fetch(url,{...options,headers});
    if(response.status===401){token='';tokenExpiresAt=0;state('disconnected');throw new Error('Sesja Google wygasła — połącz ponownie.')}
    if(!response.ok)throw new Error('Google Drive HTTP '+response.status+': '+(await response.text()).slice(0,250));
    return response
  }
  async function listFiles(){
    const files=[];let next='';
    do{
      const params=new URLSearchParams({spaces:'appDataFolder',fields:'nextPageToken,files(id,name)',pageSize:'1000'});
      if(next)params.set('pageToken',next);
      const result=await (await drive('https://www.googleapis.com/drive/v3/files?'+params)).json();
      for(const file of result.files||[])if(file.name?.startsWith(PREFIX)&&file.name.endsWith('.json'))files.push(file);
      next=result.nextPageToken||''
    }while(next);
    return files
  }
  async function fetchJournal(id){
    const data=await (await drive('https://www.googleapis.com/drive/v3/files/'+encodeURIComponent(id)+'?alt=media')).json();
    if(!validJournal(data))throw new Error('Nieznany format danych synchronizacji.');
    return data
  }
  async function uploadOwn(journal,existing){
    const raw=JSON.stringify(journal);
    if(new Blob([raw]).size>MAX_JOURNAL_BYTES)throw new Error('Zbyt duża historia synchronizacji.');
    if(existing){
      const url='https://www.googleapis.com/upload/drive/v3/files/'+encodeURIComponent(existing.id)+'?uploadType=media';
      await drive(url,{method:'PATCH',headers:{'Content-Type':'application/json'},body:raw});
      return
    }
    const boundary='kanjipro_'+Date.now().toString(36);
    const metadata={name:PREFIX+journal.device_id+'.json',parents:['appDataFolder'],mimeType:'application/json'};
    const body='--'+boundary+'\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n'+JSON.stringify(metadata)+
      '\r\n--'+boundary+'\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n'+raw+'\r\n--'+boundary+'--';
    await drive('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id',
      {method:'POST',headers:{'Content-Type':'multipart/related; boundary='+boundary},body})
  }
  async function performSync(){
    if(!token){state('disconnected');return false}
    if(running)return running;
    running=(async()=>{
      state('syncing');
      try{
        const local=ensureJournal(),files=await listFiles();
        const remote=await Promise.all(files.map(async f=>({file:f,data:await fetchJournal(f.id)})));
        const own=remote.find(x=>x.data.device_id===local.device_id);
        // Another device is never overwritten; only our own named journal is uploaded.
        journal=own?unionOwn(local,own.data):local;
        saveJournal();
        await uploadOwn(journal,own?.file);
        const documents=remote.filter(x=>x.data.device_id!==journal.device_id).map(x=>x.data).concat(journal);
        const merged=mergeDeviceJournals(documents);
        await applySnapshot(merged);
        afterApply?.();
        state('synced',new Date().toLocaleString('pl-PL'));
        return true
      }catch(err){state('error',String(err?.message||err));return false}
      finally{running=null}
    })();
    return running
  }
  async function connect(){
    if(!clientId){state('unconfigured');return}
    if(token&&Date.now()<tokenExpiresAt-30000){void performSync();return}
    try{
      await loadGoogleScript();
      if(!tokenClient){
        tokenClient=window.google.accounts.oauth2.initTokenClient({
          client_id:clientId,scope:SCOPE,
          callback:r=>{
            if(r.error||!r.access_token){state('error',r.error||'Nie przyznano dostępu.');return}
            if(!window.google.accounts.oauth2.hasGrantedAllScopes(r,SCOPE)){state('error','Nie przyznano dostępu do danych aplikacji na Dysku.');return}
            token=r.access_token;tokenExpiresAt=Date.now()+(Number(r.expires_in)||3500)*1000;
            void performSync()
          },
          error_callback:()=>state('error','Logowanie przerwane lub zablokowane.')
        })
      }
      // A user gesture must initiate OAuth. The library should be loaded ahead of time by warmUp().
      tokenClient.requestAccessToken({prompt:'consent'})
    }catch(err){state('error',String(err.message||err))}
  }
  function disconnect(){
    token='';tokenExpiresAt=0;
    // Keep the on-device journal: no learning data is ever deleted by disconnect.
    state(clientId?'disconnected':'unconfigured')
  }
  function warmUp(){
    if(clientId)void loadGoogleScript().catch(()=>{})
  }
  function resetForImport(){
    // Import intentionally replaces history. An existing cloud journal must not silently restore old values.
    if(validJournal(journal))throw new Error('Odłącz synchronizację i wykonaj kopię danych przed importem. Import do aktywnej historii synchronizacji jest zablokowany.');
  }
  return{loadConfig,connect,disconnect,warmUp,sync:performSync,appendAnswer,resetForImport,isConfigured:()=>Boolean(clientId),isConnected:()=>Boolean(token&&Date.now()<tokenExpiresAt-30000)}
}
