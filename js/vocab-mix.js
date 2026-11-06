// Configurable vocabulary mix for limited sessions.
// Percentages are upper bounds: missing categories are filled from the rest.
export const DEFAULT_VOCAB_MIX=Object.freeze({new:55,difficult:25,slow:20});
export const VOCAB_MIX_KEYS=['new','difficult','slow'];
export function normalizeVocabMix(raw=DEFAULT_VOCAB_MIX){
  const values={};
  for(const key of VOCAB_MIX_KEYS){
    const value=Number(raw?.[key]);
    values[key]=Number.isFinite(value)?Math.min(100,Math.max(0,Math.round(value))):DEFAULT_VOCAB_MIX[key];
  }
  const total=VOCAB_MIX_KEYS.reduce((sum,key)=>sum+values[key],0);
  if(total>100){
    // Handle corrupt/legacy preferences without overflowing session quotas.
    let left=100;
    for(const key of ['difficult','slow','new']){values[key]=Math.min(values[key],left);left-=values[key]}
  }
  return values;
}
export function editVocabMix(current,key,desired){
  const mix=normalizeVocabMix(current);
  if(!VOCAB_MIX_KEYS.includes(key))return mix;
  const others=VOCAB_MIX_KEYS.filter(item=>item!==key).reduce((sum,item)=>sum+mix[item],0);
  mix[key]=Math.min(100-others,Math.max(0,Math.round(Number(desired)||0)));
  return mix;
}
export function selectVocabularyMix(items,count,config){
  const {mix,isNew,isDifficult,isSlow,pick,id}=config;
  const size=Math.min(items.length,Math.max(0,Math.floor(count)));
  if(!size)return[];
  if(size===items.length)return items.slice();
  const pct=normalizeVocabMix(mix),taken=new Set(),chosen=[];
  function reserve(test,limit){
    if(!limit)return;
    const available=items.filter(item=>!taken.has(id(item))&&test(item));
    const batch=pick(available,Math.min(limit,size-chosen.length));
    for(const item of batch){const key=id(item);if(taken.has(key))continue;taken.add(key);chosen.push(item)}
  }
  reserve(isDifficult,Math.round(size*pct.difficult/100));
  reserve(item=>!isDifficult(item)&&isSlow(item),Math.round(size*pct.slow/100));
  reserve(item=>!isDifficult(item)&&!isSlow(item)&&isNew(item),Math.round(size*pct.new/100));
  const remaining=items.filter(item=>!taken.has(id(item)));
  reserve(()=>true,0); // fill uses the same weighted sampler, without quotas
  for(const item of pick(remaining,size-chosen.length)){
    if(!taken.has(id(item))){taken.add(id(item));chosen.push(item)}
  }
  return chosen.slice(0,size);
}
