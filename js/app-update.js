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
  version,notice,noticeLabel,updateButton,manualButton,status,
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
      if('serviceWorker' in nav){
        const registration=await nav.serviceWorker.getRegistration();
        if(registration)await registration.update();
      }
      const target=new URL(win.location.href);
      target.searchParams.set('app_refresh',String(now()));
      // This changes only the navigation URL, never localStorage or IndexedDB.
      win.location.replace(target.href)
    }catch(err){
      updateInProgress=false;
      if(updateButton)updateButton.disabled=false;
      if(manualButton)manualButton.disabled=false;
      info('Nie udało się zaktualizować. Sprawdź internet i spróbuj ponownie.')
    }
  }
  manualButton?.addEventListener('click',()=>void check(true));
  updateButton?.addEventListener('click',()=>void apply());
  doc.addEventListener('visibilitychange',()=>{if(doc.visibilityState==='visible')void check()});
  win.addEventListener('pageshow',()=>void check());
  void check();
  return {check,apply}
}
