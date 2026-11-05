// Check public app version without touching users' learning data or private Anki audio.
// When a newer version is published, prompt instead of interrupting an active quiz.
export function normalizeAppVersion(value){
  const s=String(value??'').trim();
  return /^\d+\.\d+(?:\.\d+)?$/.test(s)?s:null
}
export function sameAppVersion(local,remote){
  return !!normalizeAppVersion(local)&&normalizeAppVersion(local)===normalizeAppVersion(remote)
}
export function createAppUpdater({
  version,notice,noticeLabel,updateButton,manualButton,status,beforeReload=async()=>{},
  win=window,doc=document,nav=navigator,fetcher=fetch,
  now=()=>Date.now()
}){
  let lastChecked=0,checking=null,updateInProgress=false;
  const current=normalizeAppVersion(version);
  const info=message=>{if(status)status.textContent=message};
  const showNewVersion=remote=>{
    if(!notice)return;
    notice.classList.remove('hidden');
    if(noticeLabel)noticeLabel.textContent='Dostępna aktualizacja Kanji.pro v'+remote;
  };
  async function check(force=false){
    if(checking)return checking;
    if(!force&&now()-lastChecked<60000)return null;
    lastChecked=now();
    checking=(async()=>{
      try{
        const url=new URL('./data/ui.pl.json',win.location.href);
        url.searchParams.set('update_check',String(now()));
        const response=await fetcher(url.href,{cache:'no-store'});
        if(!response.ok)throw new Error('HTTP '+response.status);
        const data=await response.json();
        const remote=normalizeAppVersion(data?.app?.badge);
        if(!remote)throw new Error('Nieprawidłowa wersja');
        if(!sameAppVersion(current,remote)){
          showNewVersion(remote);
          info('Dostępna aktualizacja v'+remote+'. Wybierz „Aktualizuj”.');
        }else if(force){info('Masz aktualną wersję v'+remote+'.')}
        return remote
      }catch(err){
        if(force)info('Nie udało się sprawdzić aktualizacji. Sprawdź połączenie i spróbuj ponownie.');
        return null
      }finally{checking=null}
    })();
    return checking
  }
  async function apply(){
    if(updateInProgress)return;
    updateInProgress=true;
    if(updateButton)updateButton.disabled=true;
    if(manualButton)manualButton.disabled=true;
    info('Aktualizowanie aplikacji…');
    try{
      // First verify network access; a stale offline copy should never trigger reload loops.
      const url=new URL('./data/ui.pl.json',win.location.href);
      url.searchParams.set('refresh_check',String(now()));
      const response=await fetcher(url.href,{cache:'no-store'});
      if(!response.ok)throw new Error('Brak połączenia');
      const ui=await response.json();
      const remote=normalizeAppVersion(ui?.app?.badge);
      if(!remote)throw new Error('Nieprawidłowa wersja aplikacji');
      // Validate essential remote assets *before* replacing the running app.
      // Incomplete GitHub Pages deployments must not leave a blank quiz.
      const [database,script]=await Promise.all([
        fetcher(new URL('./data/kanji_quiz_database.json?preflight='+now(),win.location.href).href,{cache:'no-store'}),
        fetcher(new URL('./js/app.js?preflight='+now(),win.location.href).href,{cache:'no-store'})
      ]);
      if(!database.ok||!script.ok)throw new Error('Nowa wersja nie jest jeszcze kompletna');
      const dataset=await database.json();
      if(!Array.isArray(dataset?.quiz_lessons)||!Array.isArray(dataset?.vocabulary)||!Array.isArray(dataset?.kanji))throw new Error('Niekompletna baza nauki');
      const source=await script.text();
      if(!source.includes("ui.pl.json?v="+remote)||!source.includes("kanji_quiz_database.json?v="+remote))throw new Error('Pliki aplikacji mają różne wersje');
      if('serviceWorker' in nav){
        const registration=await nav.serviceWorker.getRegistration();
        if(registration)await registration.update();
      }
      // Never navigate with a changing query string, which can open a separate
      // standalone navigation context on some iOS installations.
      await beforeReload();
      if(typeof win.location.reload==='function')win.location.reload();
      else win.location.replace(win.location.href)
    }catch(err){
      updateInProgress=false;
      if(updateButton)updateButton.disabled=false;
      if(manualButton)manualButton.disabled=false;
      info('Nie udało się bezpiecznie zaktualizować. Twoje dane pozostały bez zmian. Spróbuj ponownie później.')
    }
  }
  manualButton?.addEventListener('click',()=>void check(true));
  updateButton?.addEventListener('click',()=>void apply());
  doc.addEventListener('visibilitychange',()=>{if(doc.visibilityState==='visible')void check()});
  win.addEventListener('pageshow',()=>void check());
  void check();
  return {check,apply}
}
