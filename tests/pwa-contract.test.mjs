import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync,existsSync} from 'node:fs';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const sw=read('sw.js');
const html=read('index.html');
const app=read('js/app.js');
const version=JSON.parse(read('data/ui.pl.json')).app.badge;
const cacheName=sw.match(/const CACHE_NAME\s*=\s*['"]([^'"]+)['"]/);
const precacheSource=sw.match(/const PRECACHE\s*=\s*\[([\s\S]*?)\]\.map/);
const freshSource=sw.match(/const FRESH_PATHS\s*=\s*new Set\(\[([\s\S]*?)\]\)/);
const precached=new Set([...(precacheSource?.[1]||'').matchAll(/'(\.\/[^']+)'/g)].map(match=>match[1]));
const fresh=new Set([...(freshSource?.[1]||'').matchAll(/new URL\('(\.\/[^']+)'/g)].map(match=>match[1]));

test('PWA cache revision tracks the app version without pinning the cache number',()=>{
  assert.match(version,/^\d+\.\d+(?:\.\d+)?$/);
  assert.ok(cacheName,'Service worker declares a cache name');
  assert.match(cacheName[1],/^wsjj-kanji-pro-\d+\.\d+(?:\.\d+)?(?:-[a-zA-Z0-9._-]+)?$/);
  assert.ok(cacheName[1]===`wsjj-kanji-pro-${version}`||
    cacheName[1].startsWith(`wsjj-kanji-pro-${version}-`),
    'Service worker cache must belong to the displayed app version');
});

test('desktop, mobile and iPad show the same app version',()=>{
  const badges=[...html.matchAll(/data-i18n="app\.badge">([^<]+)<\/span>/g)].map(m=>m[1]);
  assert.ok(badges.length>=2,'Expected mobile header and desktop/iPad sidebar badges');
  for(const badge of badges)assert.equal(badge,version);
});

test('versioned HTML assets and app fetches agree with UI version',()=>{
  const linked=[...html.matchAll(/(?:href|src)="\.\/(?:css|js)\/[^"?]+\?v=([^"]+)"/g)];
  assert.ok(linked.length>=5,'Expected versioned CSS and app JS links');
  for(const match of linked)assert.equal(match[1],version,'Mismatch in '+match[0]);
  const uiFetch=app.match(/fetch\(['"]\.\/data\/ui\.pl\.json\?v=([^'"]+)['"]/);
  if(uiFetch)assert.equal(uiFetch[1],version);
  const swRegistration=app.match(/register\(['"]\.\/sw\.js\?v=([^'"]+)['"]/);
  if(swRegistration)assert.equal(swRegistration[1],version);
});

test('all local imported JS modules exist and are in both PWA asset strategies',()=>{
  const scripts=readdirSync(new URL('../js/',import.meta.url)).filter(file=>file.endsWith('.js'));
  for(const file of scripts){
    const source=read('js/'+file);
    for(const match of source.matchAll(/\b(?:import|export)\s+(?:[^;\n]*?\sfrom\s*)?['"](\.[^'"]+)['"]/g)){
      const importPath=match[1];
      assert.ok(importPath.startsWith('./'),'Expected a local flat JS import: '+importPath);
      const asset='./js/'+importPath.slice(2);
      assert.ok(existsSync(new URL('../'+asset.slice(2),import.meta.url)),asset+' must exist');
      assert.ok(precached.has(asset),asset+' must be precached for offline loading');
      assert.ok(fresh.has(asset),asset+' must be refreshed after deployment');
    }
  }
});

test('HTML entry modules and stylesheets are valid and precached',()=>{
  const assets=[...html.matchAll(/(?:src|href)="(\.\/(?:js|css)\/[^"?]+)(?:\?[^"]*)?"/g)].map(m=>m[1]);
  assert.ok(assets.includes('./js/app.js'));
  for(const asset of assets){
    assert.ok(existsSync(new URL('../'+asset.slice(2),import.meta.url)),asset+' must exist');
    assert.ok(precached.has(asset),asset+' must be precached');
    assert.ok(fresh.has(asset),asset+' must be refreshed after deployment');
  }
});
