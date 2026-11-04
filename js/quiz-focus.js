// Single controller for quiz focus, iPadOS scrolling and hardware-key recovery.
// Deliberately retains the established interaction timing and keyboard semantics.
export function createQuizFocusController({
  input,quiz,getCurrent,isChecked,
  doc=document,win=window,nav=navigator,
  frame=callback=>requestAnimationFrame(callback),
  later=(callback,ms)=>setTimeout(callback,ms),
  makeInputEvent=()=>new Event('input',{bubbles:true})
}){
  const isIpadWebkit=/iPad|iPhone|iPod/.test(nav.userAgent)||
    (nav.platform==='MacIntel'&&nav.maxTouchPoints>1);
  let answerVisibilityFramePending=false;
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
  return {focusAnswerField,keepAnswerVisible,restoreQuizFocusAfterStart,handleStaleFocusKeydown}
}
