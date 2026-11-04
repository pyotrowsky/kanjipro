// Modern Anki (.anki21b) format helpers: zstd frames + protobuf media manifest.
// No Anki media is uploaded. Only the requested archive entries are decompressed.
const ZSTD_UMD='https://cdn.jsdelivr.net/npm/fzstd@0.1.1/umd/index.js';
let zstdLibraryPromise=null;
const MAX_DB_BYTES=192*1024*1024;
const MAX_INDEX_BYTES=16*1024*1024;
export const MAX_AUDIO_BYTES=8*1024*1024;

export function isZstdFrame(bytes){
  return bytes?.length>=4&&bytes[0]===0x28&&bytes[1]===0xb5&&bytes[2]===0x2f&&bytes[3]===0xfd
}
function loadZstdLibrary(){
  if(globalThis.fzstd?.decompress)return Promise.resolve(globalThis.fzstd);
  if(!zstdLibraryPromise)zstdLibraryPromise=new Promise((resolve,reject)=>{
    const script=document.createElement('script');
    script.src=ZSTD_UMD;
    script.async=true;
    script.crossOrigin='anonymous';
    script.onload=()=>globalThis.fzstd?.decompress?resolve(globalThis.fzstd):reject(new Error('Brak dekodera Zstandard.'));
    script.onerror=()=>reject(new Error('Nie udało się pobrać dekodera Zstandard. Sprawdź internet.'));
    document.head.append(script);
  }).catch(err=>{zstdLibraryPromise=null;throw err});
  return zstdLibraryPromise
}
export async function decodeZstd(bytes,maxBytes=MAX_DB_BYTES){
  if(!isZstdFrame(bytes))throw new Error('Nieprawidłowy format kompresji Zstandard.');
  // Safari/iPadOS needs the JS decoder; native streaming is optional.
  const decoder=await loadZstdLibrary();
  const result=decoder.decompress(bytes);
  if(result.length>maxBytes)throw new Error('Rozpakowane dane Anki przekraczają limit pamięci importera.');
  return result
}
function varint(bytes,pos){
  let result=0,mul=1,steps=0;
  for(;;){
    if(pos>=bytes.length||++steps>10)throw new Error('Uszkodzony Protobuf: varint.');
    const byte=bytes[pos++];
    result+=(byte&127)*mul;
    if(!Number.isSafeInteger(result))throw new Error('Uszkodzony Protobuf: liczba poza zakresem.');
    if((byte&128)===0)return [result,pos];
    mul*=128
  }
}
export function parseWireMessage(bytes){
  const fields=new Map();let pos=0;
  while(pos<bytes.length){
    const tag=varint(bytes,pos);pos=tag[1];
    const field=Math.floor(tag[0]/8),wire=tag[0]%8;
    if(!field)throw new Error('Uszkodzony Protobuf: pole 0.');
    let value;
    if(wire===0){const next=varint(bytes,pos);value=next[0];pos=next[1]}
    else if(wire===2){
      const length=varint(bytes,pos);pos=length[1];
      if(length[0]>bytes.length-pos)throw new Error('Uszkodzony Protobuf: długość pola.');
      value=bytes.subarray(pos,pos+length[0]);pos+=length[0]
    }else if(wire===1){if(pos+8>bytes.length)throw new Error('Uszkodzony Protobuf: fixed64.');pos+=8;continue}
    else if(wire===5){if(pos+4>bytes.length)throw new Error('Uszkodzony Protobuf: fixed32.');pos+=4;continue}
    else throw new Error('Nieobsługiwany typ pola Protobuf.');
    if(!fields.has(field))fields.set(field,[]);
    fields.get(field).push(value)
  }
  return fields
}
export function parseModernMediaIndex(bytes){
  const decoded=parseWireMessage(bytes);
  const entries=decoded.get(1)||[];
  const result={};
  const textDecoder=new TextDecoder('utf-8',{fatal:true});
  for(let i=0;i<entries.length;i++){
    if(!(entries[i] instanceof Uint8Array))throw new Error('Nieprawidłowy wpis pliku Protobuf.');
    const message=parseWireMessage(entries[i]);
    const name=message.get(1)?.[0];
    if(name instanceof Uint8Array)result[String(i)]=textDecoder.decode(name)
  }
  return result
}
export async function decodeAnkiMediaIndex(bytes,modern){
  if(!modern){
    const map=JSON.parse(new TextDecoder().decode(bytes));
    if(!map||typeof map!=='object'||Array.isArray(map))throw new Error('Nieprawidłowy indeks mediów Anki.');
    return map
  }
  const unpacked=await decodeZstd(bytes,MAX_INDEX_BYTES);
  return parseModernMediaIndex(unpacked)
}
export async function decodeAnkiCollection(bytes,modern){
  return modern?decodeZstd(bytes,MAX_DB_BYTES):bytes
}
export async function decodeAnkiAudioFile(bytes,modern){
  if(!modern)return bytes;
  return decodeZstd(bytes,MAX_AUDIO_BYTES)
}
