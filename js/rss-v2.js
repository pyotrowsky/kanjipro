// RSS 2.0: pure calculations. Legacy entries remain readable, but only newly
// quality-verified measurements qualify vocabulary for slow sessions.
import {medianMs,quantile} from './learning-math.js';
export const RSS_RELIABLE_SAMPLES=5;
export const RSS_RELIABLE_SESSIONS=3;
export const RSS_RELIABLE_DAYS=2;
export const RSS_SLOW_BASELINE_WORDS=8;
export const RSS_RECENT_SESSIONS=10;
const validValue=x=>Number.isFinite(x)&&x>=0;
export function usableRssEntry(entry,mode){
  return Boolean(entry?.correct&&entry.input_mode===mode&&validValue(entry.rss_ms)&&
    (entry.quality===undefined||entry.quality==='valid'));
}
export function madRss(values){
  const median=medianMs(values);
  return median===null?null:medianMs(values.map(value=>Math.abs(value-median)))
}
export function rssSeries(history,mode){
  const grouped=new Map();
  for(const [i,row] of (Array.isArray(history)?history:[]).entries()){
    if(!usableRssEntry(row,mode)||!row.session_id)continue;
    const key=String(row.session_id);
    if(!grouped.has(key))grouped.set(key,{session_id:key,at:Number(row.at)||0,values:[],verified:0,legacy:0});
    const item=grouped.get(key);
    item.at=Math.min(item.at||Number(row.at)||0,Number(row.at)||item.at);
    item.values.push(row.rss_ms);
    if(row.quality==='valid')item.verified++;
    else item.legacy++;
  }
  return [...grouped.values()].sort((a,b)=>a.at-b.at).map(p=>({
    session_id:p.session_id,at:p.at,rss_ms:medianMs(p.values),
    samples:p.values.length,verified:p.verified,legacy:p.legacy
  }));
}
export function rssProfileV2(history,mode){
  const series=rssSeries(history,mode).slice(-RSS_RECENT_SESSIONS);
  const latest=new Set(series.map(x=>x.session_id));
  const valid=(Array.isArray(history)?history:[]).filter(x=>latest.has(String(x?.session_id))&&usableRssEntry(x,mode));
  const verified=valid.filter(x=>x.quality==='valid');
  const verifiedSessions=new Set(verified.map(x=>String(x.session_id)));
  const verifiedDays=new Set(verified.map(x=>Number.isFinite(x.at)?new Date(x.at).toISOString().slice(0,10):'unknown'));
  const medians=series.map(p=>p.rss_ms);
  const rss_ms=medianMs(medians),mad_ms=series.length>=3?madRss(medians):null;
  const variability=mad_ms===null||!rss_ms?'unknown':mad_ms/rss_ms>=.45?'unstable':mad_ms/rss_ms>=.20?'variable':'stable';
  const reliable=verified.length>=RSS_RELIABLE_SAMPLES&&verifiedSessions.size>=RSS_RELIABLE_SESSIONS&&verifiedDays.size>=RSS_RELIABLE_DAYS;
  return {rss_ms,mad_ms,variability,count:valid.length,verified_count:verified.length,
    sessions:series.length,verified_sessions:verifiedSessions.size,verified_days:verifiedDays.size,
    eligible:series.length>0,reliable,series};
}
export function slowRssBaseline(profiles){
  const values=(profiles||[]).filter(p=>p?.reliable&&validValue(p.rss_ms)).map(p=>p.rss_ms).sort((a,b)=>a-b);
  return {ready:values.length>=RSS_SLOW_BASELINE_WORDS,count:values.length,
    cutoff_ms:values.length>=RSS_SLOW_BASELINE_WORDS?quantile(values,.75):null};
}
// Access to practice is deliberately independent from a word's confidence label.
// Three separate sessions over two days plus 20 unique measured words make the
// slow-mode pool useful without demanding repeated review of the same words.
export const SLOW_PRACTICE_MIN_WORDS=50;
export const SLOW_PRACTICE_MIN_SESSIONS=5;
export const SLOW_PRACTICE_MIN_DAYS=2;
// Access requirements count distinct measured words, sessions and local calendar days.
// Older valid RSS samples remain useful; reliability is a separate confidence flag.
export function slowPracticeBaseline(entries,mode,{minWords=SLOW_PRACTICE_MIN_WORDS,minSessions=SLOW_PRACTICE_MIN_SESSIONS,minDays=SLOW_PRACTICE_MIN_DAYS}={}){
  const words=(entries||[]).filter(x=>x?.profile?.eligible&&validValue(x.profile.rss_ms));
  const sessions=new Set(),days=new Set();
  for(const {history} of words){
    for(const measurement of Array.isArray(history)?history:[]){
      if(!measurement?.session_id||!usableRssEntry(measurement,mode))continue;
      sessions.add(String(measurement.session_id));
      if(Number.isFinite(measurement.at)&&measurement.at>0){
        const dt=new Date(measurement.at);
        days.add(dt.getFullYear()+'-'+String(dt.getMonth()+1).padStart(2,'0')+'-'+String(dt.getDate()).padStart(2,'0'))
      }
    }
  }
  const values=words.map(x=>x.profile.rss_ms).sort((a,b)=>a-b);
  const ready=words.length>=minWords&&sessions.size>=minSessions&&days.size>=minDays;
  return {ready,count:words.length,sessions:sessions.size,days:days.size,
    cutoff_ms:ready?quantile(values,.75):null};
}
// When globally slow words are absent from the user's selected chapters,
// select the slowest measured quartile *within that selection*. Never
// fabricate RSS or include words without a valid reading-time measurement.
export function selectedSlowWords(entries,globalCutoff,{minLocalWords=4}={}){
  const measured=(entries||[]).filter(x=>x?.profile?.eligible&&validValue(x.profile.rss_ms));
  const global=validValue(globalCutoff)?measured.filter(x=>x.profile.rss_ms>globalCutoff):[];
  if(global.length)return {items:global.map(x=>x.item),source:'global',measured:measured.length};
  if(measured.length<minLocalWords)return {items:[],source:'insufficient',measured:measured.length};
  const sorted=measured.map(x=>x.profile.rss_ms).sort((a,b)=>a-b),cutoff=quantile(sorted,.75);
  const local=measured.filter(x=>x.profile.rss_ms>cutoff);
  // Tied readings can make >P75 empty. Pick the slowest measured word.
  const items=local.length?local:[measured.reduce((a,b)=>a.profile.rss_ms>=b.profile.rss_ms?a:b)];
  return {items:items.map(x=>x.item),source:'local',measured:measured.length,cutoff_ms:cutoff};
}
export function rssQualityLabel(quality){
  return quality||'legacy';
}
export function rssTrendSvg(series,baseline=null){
  if(!series?.length)return '';
  const width=600,height=208,padLeft=44,padRight=16,padTop=18,padBottom=42;
  const ys=series.map(p=>p.rss_ms);
  if(validValue(baseline))ys.push(baseline);
  const min=Math.max(0,Math.min(...ys)*.85),max=Math.max(...ys)*1.12;
  const delta=max-min||1;
  const x=i=>padLeft+(width-padLeft-padRight)*(series.length===1?.5:i/(series.length-1));
  const y=value=>padTop+(height-padTop-padBottom)*(max-value)/delta;
  const points=series.map((p,i)=>[x(i),y(p.rss_ms)]);
  const fmt=v=>(v/1000).toFixed(1)+' s';
  const coords=points.map(([px,py])=>px.toFixed(1)+','+py.toFixed(1)).join(' ');
  const grid=[0,.5,1].map(f=>{const v=min+delta*f;return '<line x1="'+padLeft+'" y1="'+y(v).toFixed(1)+'" x2="'+(width-padRight)+'" y2="'+y(v).toFixed(1)+'" stroke="currentColor" opacity=".12"/><text x="'+(padLeft-8)+'" y="'+(y(v)+4).toFixed(1)+'" text-anchor="end" fill="currentColor" font-size="11">'+fmt(v)+'</text>'}).join('');
  const line=points.length>1?'<polyline points="'+coords+'" fill="none" stroke="var(--accent,#ad663a)" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"/>':'';
  const avg=validValue(baseline)?'<line x1="'+padLeft+'" x2="'+(width-padRight)+'" y1="'+y(baseline).toFixed(1)+'" y2="'+y(baseline).toFixed(1)+'" stroke="var(--muted,#777)" stroke-dasharray="6 5" stroke-width="2"/>':'';
  const nodes=series.map((p,i)=>'<circle cx="'+x(i).toFixed(1)+'" cy="'+y(p.rss_ms).toFixed(1)+'" r="5" fill="var(--accent,#ad663a)"><title>'+new Date(p.at||0).toLocaleDateString('pl-PL')+' — '+fmt(p.rss_ms)+' ('+p.samples+' pom.)</title></circle>').join('');
  const dates=[0,series.length-1].filter((n,i,a)=>a.indexOf(n)===i).map(i=>'<text x="'+x(i).toFixed(1)+'" y="'+(height-12)+'" text-anchor="'+(i===0?'start':'end')+'" fill="currentColor" font-size="12">'+new Date(series[i].at||0).toLocaleDateString('pl-PL')+'</text>').join('');
  return '<svg viewBox="0 0 '+width+' '+height+'" role="img" aria-label="Przebieg RSS w kolejnych sesjach. Niższy wynik oznacza szybsze rozpoznawanie." xmlns="http://www.w3.org/2000/svg">'+grid+avg+line+nodes+dates+'</svg>';
}
