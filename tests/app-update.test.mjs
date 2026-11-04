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
  const win={location:{href:'https://example.org/kanjipro/?lang=pl',replace:href=>navigations.push(href)},
    addEventListener:(name,fn)=>{callbacks[name]=fn}};
  const doc={visibilityState:'visible',addEventListener:(name,fn)=>{callbacks[name]=fn}};
  const nav={serviceWorker:{getRegistration:async()=>({update:async()=>calls.push('serviceWorker.update')})}};
  const fetcher=async (url,options)=>{calls.push({url,options});return{ok:true,json:async()=>({app:{badge:remote}})}};
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
  assert.match(f.navigations[0],/app_refresh=123456/);
  assert.deepEqual(f.calls.filter(x=>typeof x==='string'),['serviceWorker.update']);
});
test('does not announce an update when installed version is current',async()=>{
  const f=fixture('3.24');
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
