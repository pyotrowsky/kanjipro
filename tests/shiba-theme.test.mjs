import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const html=read('index.html');
const app=read('js/app.js');
const css=read('css/shiba-theme.css');
const sw=read('sw.js');
const ui=JSON.parse(read('data/ui.pl.json'));
const manifest=JSON.parse(read('manifest.webmanifest'));

const start=app.indexOf("const APP_THEME_KEY=");
const end=app.indexOf("const FONT_STORAGE_KEY=",start);
assert.ok(start>0&&end>start,'Theme functions are self contained');
const themeCode=app.slice(start,end);

function simulate(initial){
  const saved=new Map(initial?[[ 'wsjj-kanji-pro:theme',initial]]:[]);
  const radios=[{value:'shiba',checked:false,events:{}},{value:'classic',checked:false,events:{}}];
  for(const radio of radios)radio.addEventListener=(key,handler)=>{radio.events[key]=handler};
  const meta={content:null,setAttribute(key,value){if(key==='content')this.content=value}};
  const doc={documentElement:{dataset:{}},querySelectorAll(query){
    return query==='input[name="appTheme"]'?radios:[]
  },querySelector(query){return query==='meta[name="theme-color"]'?meta:null}};
  const storage={getItem:key=>saved.get(key)??null,setItem:(key,value)=>saved.set(key,value)};
  vm.runInNewContext(themeCode,{localStorage:storage,document:doc});
  return{doc,radios,saved,meta}
}

test('Shiba Inu is the default appearance and has a matching toolbar color',()=>{
  const s=simulate();
  assert.equal(s.doc.documentElement.dataset.theme,'shiba');
  assert.equal(s.meta.content,'#de6d27');
  assert.equal(s.radios[0].checked,true);
});

test('existing classic preference is respected after reload',()=>{
  const s=simulate('classic');
  assert.equal(s.doc.documentElement.dataset.theme,'classic');
  assert.equal(s.meta.content,'#d63031');
  assert.equal(s.radios[1].checked,true);
});

test('switching themes persists the chosen appearance',()=>{
  const s=simulate('classic');
  s.radios[0].checked=true;
  s.radios[0].events.change();
  assert.equal(s.doc.documentElement.dataset.theme,'shiba');
  assert.equal(s.saved.get('wsjj-kanji-pro:theme'),'shiba');
});

test('the classic app hides decorative Shiba components',()=>{
  assert.match(css,/\.shiba-brand-mark,\.shiba-hero,\.shiba-quiz-accent,\.shiba-finish-accent\{display:none\}/);
  assert.match(css,/:root\[data-theme="shiba"\] \.(?:shiba-hero|brand)/);
  assert.match(html,/name="appTheme" value="classic"/);
  assert.match(html,/name="appTheme" value="shiba"/);
});

test('Shiba theme remains offline-ready, localized and versioned',()=>{
  assert.equal(ui.app.badge,'3.22');
  assert.ok(ui.settings.theme_shiba&&ui.settings.theme_classic&&ui.setup.shiba_title);
  assert.match(sw,/'\.\/css\/shiba-theme\.css'/);
  assert.match(sw,/'\.\/icons\/shiba-face\.svg'/);
  assert.match(sw,/'\.\/icons\/shiba-study\.svg'/);
  assert.match(html,/shiba-theme\.css\?v=3\.22/);
  assert.equal(manifest.theme_color,'#de6d27');
});

test('theme persistence never modifies Firestore or study data',()=>{
  assert.match(app,/theme:savedAppTheme\(\)/);
  assert.match(app,/settings\.theme==='shiba'\|\|settings\.theme==='classic'/);
  assert.match(app,/createFirebaseSync/);
  assert.match(app,/function keepAnswerVisible\(\)/);
});
