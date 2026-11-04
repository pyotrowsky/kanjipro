import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {cleanAudioText,extractSounds,selectNoteAudio,matchAudioNotes,selectAnkiCollection,selectAudioMediaEntries} from '../js/anki-audio.js';

test('audio field priority prefers dictionary recording',()=>{
  const fields={Audio:'[sound:second.mp3]',AudioDictionary:'[sound:first.mp3]',AudioOnyomi:'[sound:third.ogg]'};
  assert.equal(selectNoteAudio(fields),'first.mp3');
  assert.equal(selectNoteAudio({AudioKunyomi:'[sound:kun.mp3]'}),'kun.mp3');
});
test('rejects unsupported and traversal-style sound references',()=>{
  assert.deepEqual(extractSounds('[sound:../private.mp3][sound:safe.mp3][sound:img.png][sound:foo.ogg]'),['safe.mp3','foo.ogg']);
  assert.deepEqual(extractSounds('[sound:folder/test.mp3]'),[]);
});
test('matches stable Anki note id even when surface is not included in the export',()=>{
  const words=[{note_id:'123',surface:'学校',reading:'がっこう'}];
  const result=matchAudioNotes([{id:'123',fields:{AudioDictionary:'[sound:school.mp3]'}}],words);
  assert.equal(result.matched.get('VOCAB_NOTE:123').filename,'school.mp3');
});
test('fallback matches exactly one surface plus reading and separates homographs',()=>{
  const words=[{surface:'市場',reading:'いちば',accepted_readings:['いちば']},{surface:'市場',reading:'しじょう',accepted_readings:['しじょう']}];
  const notes=[{id:'8',fields:{Expression:'市場',Reading:'しじょう',Audio:'[sound:market.mp3]'}}];
  const r=matchAudioNotes(notes,words);
  assert.equal(r.matched.size,1);
  assert.equal([...r.matched.values()][0].filename,'market.mp3');
});
test('ambiguous fallback is excluded and reported rather than guessed',()=>{
  const words=[{note_id:'1',surface:'学生',reading:'がくせい'},{note_id:'2',surface:'学生',reading:'がくせい'}];
  const r=matchAudioNotes([{id:'other',fields:{Expression:'学生',Reading:'がくせい',Audio:'[sound:s.mp3]'}}],words);
  assert.equal(r.matched.size,0);
  assert.equal(r.ambiguous.length,1);
});
test('rejects modern .anki21b package instead of silently loading its dummy .anki2',()=>{
  assert.throws(()=>selectAnkiCollection(new Map([['collection.anki2',{fake:true}],['collection.anki21b',{modern:true}]])),/starsze wersje Anki/);
  const legacy={legacy:true};
  assert.equal(selectAnkiCollection(new Map([['collection.anki21',legacy],['collection.anki2',{fake:true}]])),legacy);
  assert.equal(selectAnkiCollection(new Map([['collection.anki2',legacy]])),legacy);
});
test('import UI and offline entry code are wired',()=>{
  const app=readFileSync(new URL('../js/app.js',import.meta.url),'utf8');
  const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
  const sw=readFileSync(new URL('../sw.js',import.meta.url),'utf8');
  assert.match(app,/createPrivateAudioLibrary\(DB\.vocabulary\)/);
  assert.match(app,/initPrivateAudioImport\(\)/);
  assert.match(html,/id="importAnkiAudio"/);
  assert.match(html,/id="importAnkiAudioFile"/);
  assert.match(html,/id="playQuizAudio"/);
  assert.ok(sw.includes("'./js/anki-audio.js'"));
});

test('large decks are not rejected by a whole-archive size limit',()=>{
  const source=readFileSync(new URL('../js/anki-audio.js',import.meta.url),'utf8');
  assert.doesNotMatch(source,/MAX_APKG|Pakiet ma ponad 180 MB|file\.size\s*>\s*\d+/);
  assert.match(source,/new zip\.BlobReader\(file\)/);
});

test('GIFs, images, videos and unmatched audio are excluded from extraction',()=>{
  const matched=new Map([
    ['VOCAB_NOTE:1',{filename:'one.mp3'}],
    ['VOCAB_NOTE:2',{filename:'two.ogg'}],
    ['VOCAB_NOTE:3',{filename:'missing.mp3'}]
  ]);
  const media={'0':'kanji.gif','1':'one.mp3','2':'other.mp3','3':'portrait.png','4':'two.ogg','5':'movie.mp4'};
  const entry=(filename)=>({filename,uncompressedSize:22});
  const zipEntries=new Map(Object.keys(media).map(n=>[n,entry(n)]));
  const {chosen,ignoredNonAudio}=selectAudioMediaEntries(matched,media,zipEntries);
  assert.equal(ignoredNonAudio,3);
  assert.deepEqual([...chosen.keys()],['VOCAB_NOTE:1','VOCAB_NOTE:2']);
  assert.equal(chosen.get('VOCAB_NOTE:1').entry.filename,'1');
  assert.equal(chosen.get('VOCAB_NOTE:2').entry.filename,'4');
  assert.equal([...chosen.values()].some(x=>/gif|png|mp4|other/.test(x.filename)),false);
});
