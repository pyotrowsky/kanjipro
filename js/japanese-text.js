// Pure Japanese reading and display helpers. Behavior preserved from app.js.
// Keep these functions independent of the DOM and user data storage.
const ROMAJI={
  kya:'きゃ',kyu:'きゅ',kyo:'きょ',gya:'ぎゃ',gyu:'ぎゅ',gyo:'ぎょ',sha:'しゃ',shu:'しゅ',sho:'しょ',sya:'しゃ',syu:'しゅ',syo:'しょ',
  ja:'じゃ',ju:'じゅ',jo:'じょ',jya:'じゃ',jyu:'じゅ',jyo:'じょ',cha:'ちゃ',chu:'ちゅ',cho:'ちょ',cya:'ちゃ',cyu:'ちゅ',cyo:'ちょ',
  nya:'にゃ',nyu:'にゅ',nyo:'にょ',hya:'ひゃ',hyu:'ひゅ',hyo:'ひょ',bya:'びゃ',byu:'びゅ',byo:'びょ',pya:'ぴゃ',pyu:'ぴゅ',pyo:'ぴょ',
  mya:'みゃ',myu:'みゅ',myo:'みょ',rya:'りゃ',ryu:'りゅ',ryo:'りょ',fa:'ふぁ',fi:'ふぃ',fe:'ふぇ',fo:'ふぉ',
  tsa:'つぁ',tsi:'つぃ',tse:'つぇ',tso:'つぉ',thi:'てぃ',dhi:'でぃ',she:'しぇ',che:'ちぇ',je:'じぇ',dzu:'づ',dzi:'ぢ',dja:'ぢゃ',dju:'ぢゅ',djo:'ぢょ',
  shi:'し',chi:'ち',tsu:'つ',fu:'ふ',ji:'じ',
  ka:'か',ki:'き',ku:'く',ke:'け',ko:'こ',ga:'が',gi:'ぎ',gu:'ぐ',ge:'げ',go:'ご',
  sa:'さ',si:'し',su:'す',se:'せ',so:'そ',za:'ざ',zi:'じ',zu:'ず',ze:'ぜ',zo:'ぞ',
  ta:'た',ti:'ち',tu:'つ',te:'て',to:'と',da:'だ',di:'ぢ',du:'づ',de:'で',do:'ど',
  na:'な',ni:'に',nu:'ぬ',ne:'ね',no:'の',ha:'は',hi:'ひ',hu:'ふ',he:'へ',ho:'ほ',
  ba:'ば',bi:'び',bu:'ぶ',be:'べ',bo:'ぼ',pa:'ぱ',pi:'ぴ',pu:'ぷ',pe:'ぺ',po:'ぽ',
  ma:'ま',mi:'み',mu:'む',me:'め',mo:'も',ya:'や',yu:'ゆ',yo:'よ',
  ra:'ら',ri:'り',ru:'る',re:'れ',ro:'ろ',wa:'わ',wo:'を',
  a:'あ',i:'い',u:'う',e:'え',o:'お'
};
export function romajiToHiragana(value,finalize=false){
  const s=String(value??'').normalize('NFKC').toLowerCase();let out='',i=0;
  while(i<s.length){const c=s[i];
    if(/[-‐‑‒–—―−]/.test(c)){out+='ー';i++;continue}
    if(!/[a-z]/.test(c)){out+=c;i++;continue}
    if(c==='n'){
      const n=s[i+1];
      if(n==="'"){out+='ん';i+=2;continue}
      if(n==='n'){
        const after=s[i+2];
        // "nn" samo w sobie = ん, ale w "nna/nnya" drugie n zaczyna kolejną sylabę.
        if(after && /[aiueoy]/.test(after)){out+='ん';i+=1;continue}
        out+='ん';i+=2;continue
      }
      if(n && !/[aiueoy]/.test(n)){out+='ん';i++;continue}
      if(!n && finalize){out+='ん';i++;continue}
    }
    if(s.slice(i,i+3)==='tch'){out+='っ';i++;continue}if(i+1<s.length && c===s[i+1] && /[bcdfghjkmprstvwxyz]/.test(c) && c!=='n'){out+='っ';i++;continue}
    let hit=null;
    for(const len of [3,2,1]){const part=s.slice(i,i+len);if(ROMAJI[part]){hit=part;break}}
    if(hit){out+=ROMAJI[hit];i+=hit.length;continue}
    out+=c;i++;
  }
  return out;
}
export function hira(s){return(s||'').normalize('NFKC').trim().replace(/[\s・･,，。\.]/g,'').replace(/[ァ-ヶ]/g,c=>String.fromCharCode(c.charCodeAt(0)-0x60))}export function esc(s){return String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]))}

