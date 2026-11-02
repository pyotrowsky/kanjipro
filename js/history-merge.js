// Pure and shared event-log merger for Firestore synchronization.
// Keep the established journal format to preserve existing Firebase records.
const FORMAT='wsjj-kanji-pro-device-journal';

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

