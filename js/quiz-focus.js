// Single controller for quiz focus, iPadOS scrolling and hardware-key recovery.
// Deliberately retains the established interaction timing and keyboard semantics.
export function createQuizFocusController({
  input,quiz,getCurrent,isChecked,
  doc=document,win=window,nav=navigator,
  frame=callback=>requestAnimationFrame(callback),
  later=(callback,ms)=>setTimeout(callback,ms),
  makeInputEvent=()=>new Event('input',{bubbles:true}),
  repeat=(callback,ms)=>setInterval(callback,ms),
  stopRepeat=id=>clearInterval(id)
}){
  const isIpadWebkit=/iPad|iPhone|iPod/.test(nav.userAgent)||
    (nav.platform==='MacIntel'&&nav.maxTouchPoints>1);
  let answerVisibilityFramePending=false;
  let focusGuardId=null;
  function canRestoreQuizFocus(){
    if(!isIpadWebkit||doc.hidden||quiz.classList.contains('hidden')||
      !getCurrent()||isChecked()||input.disabled||input.readOnly||
      doc.querySelector('#settingsDialog')?.open)return false;
    const active=doc.activeElement;
    // Never take input away from another editable control or a dialog.
    if(active&&active!==input&&(active.isContentEditable||
      /^(INPUT|TEXTAREA|SELECT)$/.test(active.tagName||'')||
      active.closest?.('[role="dialog"],dialog')))return false;
    return true;
  }
  function restoreActiveQuizFocus(){
    if(!canRestoreQuizFocus()||doc.activeElement===input)return;
    // On iPadOS, Safari may focus the document/body when transitioning views.
    // A button activated to START/RESTART can also retain DOM focus.
    const active=doc.activeElement;
    const allowed=!active||active===doc.body||active===doc.documentElement||
      active.closest?.('#quiz')||['start','again','reviewStart','reviewBankStart'].includes(active.id);
    if(allowed)focusAnswerField();
  }
  function startFocusGuard(){
    stopFocusGuard();
    if(!isIpadWebkit)return;
    focusGuardId=repeat(restoreActiveQuizFocus,850);
  }
  function stopFocusGuard(){
    if(focusGuardId!==null){stopRepeat(focusGuardId);focusGuardId=null}
  }
  function handleFocusEnvironmentChange(){restoreActiveQuizFocus()}
  function handleAnswerBlur(){later(restoreActiveQuizFocus,90)}

  function keepAnswerVisible(){
    if(!isIpadWebkit||answerVisibilityFramePending)return;
    answerVisibilityFramePending=true;
    frame(()=>frame(()=>{
      answerVisibilityFramePending=false;
      if(doc.activeElement!==input||quiz.classList.contains('hidden'))return;
      const viewport=win.visualViewport;
      const visibleTop=viewport?.offsetTop??0;
      const visibleBottom=visibleTop+(viewport?.height??win.innerHeight);
      const rect=input.getBoundingClientRect();
      const padding=24;
      if(rect.top>=visibleTop+padding&&rect.bottom<=visibleBottom-padding)return;
      const usable=Math.max(0,visibleBottom-visibleTop-2*padding-rect.height);
      const targetTop=visibleTop+padding+usable*.62;
      win.scrollBy({top:rect.top-targetTop,behavior:'auto'});
    }))
  }
  function releaseHiddenAnswerFocus(){
    // Safari may keep the input as activeElement while its quiz is hidden.
    // Reopening the same input then looks focused but cannot receive typing.
    if(doc.activeElement===input){try{input.blur()}catch{}}
  }
  function focusAnswerField(){
    if(doc.activeElement!==input){
      try{input.focus({preventScroll:true})}catch{input.focus()}
    }
    keepAnswerVisible()
  }
  function restoreQuizFocusAfterStart(){
    const firstQuestion=getCurrent();
    const refocus=()=>{
      if(getCurrent()!==firstQuestion||isChecked()||input.disabled||quiz.classList.contains('hidden'))return;
      if(doc.activeElement!==input)focusAnswerField()
    };
    frame(()=>frame(refocus));
    later(refocus,80);
    later(refocus,220)
  }
  function handleStaleFocusKeydown(event){
    if(!isIpadWebkit||quiz.classList.contains('hidden')||isChecked()||input.disabled||
       doc.activeElement===input||event.defaultPrevented||
       event.metaKey||event.ctrlKey||event.altKey||event.isComposing)return;
    const active=doc.activeElement;
    if(doc.querySelector('#settingsDialog')?.open||active?.isContentEditable)return;
    if(/^(INPUT|TEXTAREA|SELECT)$/.test(active?.tagName||'')&&active?.closest?.('#quiz'))return;
    if(event.key.length!==1||event.key===' '&&event.target?.closest?.('button'))return;
    event.preventDefault();
    focusAnswerField();
    const start=input.selectionStart??input.value.length;
    const end=input.selectionEnd??start;
    input.setRangeText(event.key,start,end,'end');
    input.dispatchEvent(makeInputEvent())
  }
  return {focusAnswerField,releaseHiddenAnswerFocus,keepAnswerVisible,restoreQuizFocusAfterStart,handleStaleFocusKeydown,
    startFocusGuard,stopFocusGuard,handleFocusEnvironmentChange,handleAnswerBlur,restoreActiveQuizFocus}
}

/**
 * iPadOS permits opening the software keyboard reliably only inside a direct
 * user gesture. A synthetic click following pointerdown/touchend can arrive
 * too late, so begin the session in touchend (while still user-activated).
 * Keep click/keyboard activation for mouse, pencil and accessibility.
 */
export function bindQuizSessionStart(button,run,guard){
  if(!button)return;
  let touchStart=null;
  button.addEventListener('touchstart',event=>{
    const touch=event.touches?.length===1?event.touches[0]:null;
    touchStart=touch?{x:touch.clientX,y:touch.clientY}:null;
  },{passive:true});
  button.addEventListener('touchcancel',()=>{touchStart=null});
  button.addEventListener('touchend',event=>{
    const touch=event.changedTouches?.length===1?event.changedTouches[0]:null;
    const start=touchStart;
    touchStart=null;
    if(!start||!touch||Math.hypot(touch.clientX-start.x,touch.clientY-start.y)>12)return;
    // Do not wait for a synthetic click: it may lose WebKit keyboard activation.
    if(event.cancelable)event.preventDefault();
    if(guard.accept())run();
  },{passive:false});
  button.addEventListener('click',()=>{if(guard.accept())run()});
}
