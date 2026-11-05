import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {normalizeAppVersion,sameAppVersion,createAppUpdater} from '../js/app-update.js';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
function fixture(remote='3.25'){
  const elements=()=>({classList:{removed:[],remove(name){this.removed.push(name)}},disabled:false,
    listeners:{},addEventListener(name,fn){this.listeners[name]=fn},textContent:''});
  const notice=elements(),noticeLabel=elements(),updateButton=elements(),manualButton=elements(),status=elements();
  const callbacks={};
  const calls=[],navigations=[];
  const win={location:{href:'https://example.org/kanjipro/?lang=pl',replace:href=>navigations.push(href),reload:()=>navigations.push('reload')},
    addEventListener:(name,fn)=>{callbacks[name]=fn}};
  const doc={visibilityState:'visible',addEventListener:(name,fn)=>{callbacks[name]=fn}};
  const nav={serviceWorker:{getRegistration:async()=>({update:async()=>calls.push('serviceWorker.update')})}};
  const fetcher=async (url,options)=>{
    calls.push({url,options});
    if(url.includes('kanji_quiz_database.json'))return{ok:true,json:async()=>({quiz_lessons:[],vocabulary:[],kanji:[]})};
    if(url.includes('js/app.js'))return{ok:true,text:async()=>`fetch('./data/ui.pl.json?v=${remote}');fetch('./data/kanji_quiz_database.json?v=${remote}')`};
    return{ok:true,json:async()=>({app:{badge:remote}})}
  };
  const controller=createAppUpdater({version:'3.24',notice,noticeLabel,updateButton,manualButton,status,win,doc,nav,fetcher,now:()=>123456});
  return {controller,notice,noticeLabel,updateButton,manualButton,status,calls,navigations,callbacks,win};
}
test('compares real app version instead of hardcoding cache revision',()=>{
  assert.equal(normalizeAppVersion(' 3.25 '),'3.25');
  assert.equal(normalizeAppVersion('bad'),null);
  assert.equal(sameAppVersion('3.25','3.25'),true);
  assert.equal(sameAppVersion('3.24','3.25'),false)
});
test('detects newer published version and offers an explicit update',async()=>{
  const f=fixture('3.25');
  const value=await f.controller.check(true);
  assert.equal(value,'3.25');
  assert.deepEqual(f.notice.classList.removed,['hidden']);
  assert.match(f.noticeLabel.textContent,/3\.25/);
  assert.equal(f.calls[0].options.cache,'no-store');
});
test('updating reloads with a new navigation URL without clearing user storage',async()=>{
  const f=fixture('3.25');
  await f.controller.apply();
  assert.equal(f.navigations.length,1);
  assert.equal(f.navigations[0],'reload');
  assert.ok(f.calls.some(x=>x.url?.includes('kanji_quiz_database.json')));
  assert.ok(f.calls.some(x=>x.url?.includes('js/app.js')));
  assert.deepEqual(f.calls.filter(x=>typeof x==='string'),['serviceWorker.update']);
});
test('does not announce an update when installed version is current',async()=>{
  const f=fixture('3.24');
  // The constructor starts an automatic check; finish it before the manual one.
  await f.controller.check();
  await f.controller.check(true);
  assert.equal(f.notice.classList.removed.length,0);
  assert.match(f.status.textContent,/aktualną wersję/);
});
test('app update is wired into settings and cached for offline app startup',()=>{
  const html=read('index.html'),app=read('js/app.js'),sw=read('sw.js');
  assert.match(html,/id="appUpdateBanner"/);
  assert.match(html,/id="checkAppUpdate"/);
  assert.match(html,/id="applyAppUpdate"/);
  assert.match(app,/createAppUpdater/);
  assert.ok(sw.includes("'./js/app-update.js'"));
});

test('do not reload when a release has incomplete learning database',async()=>{
 const f=fixture('3.37');
 const controller=createAppUpdater({
   version:'3.36',
   notice:null,updateButton:f.updateButton,manualButton:f.manualButton,status:f.status,
   win:f.win,doc:{addEventListener(){}},nav:{serviceWorker:{getRegistration:async()=>null}},
   fetcher:async url=>url.includes('kanji_quiz_database.json')?{ok:false}:{ok:true,json:async()=>({app:{badge:'3.37'}}),text:async()=>''}
 });
 await controller.apply();
 assert.deepEqual(f.navigations,[]);
 assert.match(f.status.textContent,/Nie udało się bezpiecznie zaktualizować/);
});
test('update waits for pending persistence writes before reloading',async()=>{
 const f=fixture('3.37');
 let release,finished=false;
 const beforeReload=()=>new Promise(resolve=>{release=()=>{finished=true;resolve()}});
 const controller=createAppUpdater({version:'3.36',notice:null,updateButton:f.updateButton,manualButton:f.manualButton,
   status:f.status,win:f.win,doc:{addEventListener(){}},nav:{serviceWorker:{getRegistration:async()=>null}},
   fetcher:async url=>{
     if(url.includes('kanji_quiz_database.json'))return{ok:true,json:async()=>({quiz_lessons:[],vocabulary:[],kanji:[]})};
     if(url.includes('js/app.js'))return{ok:true,text:async()=>`ui.pl.json?v=3.37;kanji_quiz_database.json?v=3.37`};
     return{ok:true,json:async()=>({app:{badge:'3.37'}})}
   },beforeReload});
 const applying=controller.apply();
 for(let i=0;i<20&&!release;i++)await Promise.resolve();
 assert.deepEqual(f.navigations,[]);
 assert.equal(typeof release,'function');
 release();await applying;
 assert.equal(finished,true);
 assert.deepEqual(f.navigations,['reload'])
});
test('Service Worker activation cannot wipe or indiscriminately clear site caches',()=>{
 const app=read('js/app.js'),sw=read('sw.js');
 assert.doesNotMatch(app,/controllerchange.*?window.location.reload/s);
 assert.match(sw,/key\.startsWith\('wsjj-kanji-pro-'\)/);
 assert.match(sw,/caches\.open\(CACHE_NAME\)\.then\(cache=>cache\.match/);
 assert.match(app,/beforeReload:async\(\)=>\{/);
});
