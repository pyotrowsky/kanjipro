import test from 'node:test';
import assert from 'node:assert/strict';
import {parseWireMessage,parseModernMediaIndex,isZstdFrame,decodeAnkiMediaIndex,decodeAnkiCollection,decodeAnkiAudioFile} from '../js/anki-modern.js';

const bytes=(...parts)=>Uint8Array.from(parts.flatMap(p=>typeof p==='number'?[p]:Array.from(p)));
const field=(id,payload)=>bytes(id*8+2,payload.length,payload);
const enc=new TextEncoder();
const named=s=>field(1,enc.encode(s));
const manifest=(...names)=>bytes(...names.map(name=>field(1,named(name))));
const zstdHeader=bytes(0x28,0xb5,0x2f,0xfd);
test('modern Anki protobuf media manifest maps numeric ZIP entries in source order',()=>{
  const map=parseModernMediaIndex(manifest('front.gif','audio.mp3','stroke.webp','on.ogg'));
  assert.deepEqual(map,{'0':'front.gif','1':'audio.mp3','2':'stroke.webp','3':'on.ogg'});
});
test('protobuf parser rejects malformed lengths rather than reading arbitrary bytes',()=>{
  assert.throws(()=>parseWireMessage(bytes(10,15,3,2)),/długość/);
  assert.throws(()=>parseWireMessage(bytes(0)),/pole 0/);
  assert.equal(isZstdFrame(bytes(3,2,1)),false);
  assert.equal(isZstdFrame(zstdHeader),true);
});
test('new Anki database, media map and audio use Zstandard decoder; old files are left intact',async()=>{
  const original=globalThis.fzstd;
  const decoded=[];
  globalThis.fzstd={decompress(value){
    decoded.push(value);
    if(value[4]===1)return manifest('one.mp3','other.gif');
    if(value[4]===2)return bytes(83,81,76,105,116,101);
    return bytes(73,68,51)
  }};
  try{
    const media=await decodeAnkiMediaIndex(bytes(zstdHeader,1),true);
    assert.deepEqual(media,{'0':'one.mp3','1':'other.gif'});
    assert.deepEqual(await decodeAnkiCollection(bytes(zstdHeader,2),true),bytes(83,81,76,105,116,101));
    assert.deepEqual(await decodeAnkiAudioFile(bytes(zstdHeader,3),true),bytes(73,68,51));
    assert.equal(decoded.length,3);
    const legacy=bytes(1,2,3);
    assert.equal(await decodeAnkiCollection(legacy,false),legacy);
    assert.equal(await decodeAnkiAudioFile(legacy,false),legacy);
    assert.deepEqual(await decodeAnkiMediaIndex(enc.encode('{"0":"audio.mp3"}'),false),{'0':'audio.mp3'})
  }finally{globalThis.fzstd=original}
});
