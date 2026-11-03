import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read=(path)=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const html=read('index.html'),sw=read('sw.js'),css=read('css/shiba-approved.css');
const manifest=JSON.parse(read('manifest.webmanifest'));
const ICON_PATHS=['shiba-face','shiba-paws','shiba-study','shiba-peek','shiba-cheer','shiba-dance'];

test('all six user-approved Shibas use real transparent high-resolution WebP sprites',()=>{
  for(const name of ICON_PATHS){
    const svg=read('icons/'+name+'.svg');
    assert.match(svg,/^<svg\s/);
    assert.match(svg,/<image\b/);
    const data=svg.match(/data:image\/webp;base64,([A-Za-z0-9+/=]+)/);
    assert.ok(data,'Approved artwork is embedded in '+name);
    const bytes=Buffer.from(data[1],'base64');
    assert.equal(bytes.toString('ascii',0,4),'RIFF');
    assert.equal(bytes.toString('ascii',8,12),'WEBP');
    assert.ok(bytes.length>20000,name+' is not a tiny cropped thumbnail');
    assert.ok(sw.includes("'./icons/"+name+".svg'"),name+' works offline');
  }
});

test('approved pastel anime banner is used and available offline',()=>{
  const image=readFileSync(new URL('../icons/kanjipro-pastel-banner.png',import.meta.url));
  assert.ok(image.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])));
  assert.ok(image.length>100000,'Approved artwork should not be an empty placeholder');
  assert.match(css,/url\('\.\.\/icons\/kanjipro-pastel-banner\.png'\)/);
  assert.ok(sw.includes("'./icons/kanjipro-pastel-banner.png'"));
});

test('mascots appear in their correct positions on the actual app screens',()=>{
  assert.match(html,/class="shiba-card-paws" src="\.\/icons\/shiba-paws\.svg"/);
  assert.match(html,/class="shiba-quiz-accent" src="\.\/icons\/shiba-peek\.svg"/);
  assert.match(html,/class="shiba-finish-celebration" src="\.\/icons\/shiba-cheer\.svg"/);
  assert.match(html,/class="shiba-history-dance" src="\.\/icons\/shiba-dance\.svg"/);
  assert.match(html,/class="sidebar-mascot"[\s\S]*?shiba-study\.svg/);
  assert.match(html,/class="sidebar-brand"[\s\S]*?shiba-face\.svg/);
  assert.match(css,/:root\[data-theme="shiba"\] #setup>\.shiba-scene/);
  assert.match(css,/\.shiba-scene,\.shiba-history-dance\{display:none\}/);
});

test('iPhone/iPad app icons are valid Shiba PNGs for all PWA sizes',()=>{
  const entries={'icon-192':192,'icon-512':512,'icon-maskable-512':512,'apple-touch-icon':180};
  for(const [name,size] of Object.entries(entries)){
    const raw=read('assets/pwa-icons/'+name+'.b64').trim();
    const image=Buffer.from(raw,'base64');
    assert.ok(image.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])));
    assert.equal(image.readUInt32BE(16),size);
    assert.equal(image.readUInt32BE(20),size);
  }
  assert.match(read('.github/workflows/rebuild-and-deploy.yml'),/python scripts\/install_shiba_pwa_icons\.py _site\/icons/);
  assert.ok(manifest.icons.some(x=>x.src==='./icons/shiba-face.svg'));
  assert.match(html,/rel="apple-touch-icon" sizes="180x180" href="\.\/icons\/apple-touch-icon\.png"/);
});

test('new theme is cached offline and all version references match 3.23',()=>{
  assert.match(sw,/wsjj-kanji-pro-3\.23-1/);
  assert.ok(sw.includes("'./css/shiba-approved.css'"));
  assert.match(html,/shiba-approved\.css\?v=3\.23/);
  assert.match(html,/app\.js\?v=3\.23/);
  assert.equal(JSON.parse(read('data/ui.pl.json')).app.badge,'3.23');
});
