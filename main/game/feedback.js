(() => {
  if (window.riderFeedback) return;
  const api = window.riderFeedback = {text:'',status:'Copy feedback [F]',visible:false,busy:false,request:0};
  let panel;
  api.close = () => {
    api.request++;api.busy=false;api.visible=false;
    if(panel)panel.remove();panel=null;
    api.status='Copy feedback [F]';
    document.querySelector('canvas')?.focus();
  };
  api.fallback = text => {
    if(panel)panel.remove();
    panel=document.createElement('section');panel.id='rider-feedback-panel';
    panel.style.cssText='position:fixed;right:12px;bottom:12px;z-index:99999;width:min(480px,90vw);padding:12px;background:#18313b;color:white;border:1px solid #68cdbc;font:14px sans-serif';
    const heading=document.createElement('p');heading.textContent='Clipboard unavailable. Select and copy this report:';
    const field=document.createElement('textarea');field.id='rider-feedback-text';field.value=text;field.readOnly=true;
    field.style.cssText='box-sizing:border-box;width:100%;height:230px;font:12px monospace';
    const retry=document.createElement('button');retry.textContent='Try copy again';retry.onclick=()=>api.copy();
    const close=document.createElement('button');close.textContent='Close';close.onclick=api.close;
    panel.append(heading,field,retry,close);document.body.append(panel);
    api.visible=true;api.status='Select text to copy';field.focus();field.select();
    if(document.fullscreenElement)document.exitFullscreen?.().catch(()=>{api.status='Exit fullscreen to copy report';});
  };
  api.copy = async () => {
    if(!api.text){api.status='Waiting for measurements';return;}
    if(api.busy)return;
    const request=++api.request,text=api.text+(window.riderStationReport?'\n## Station measurements\n'+JSON.stringify(window.riderStationReport,null,2):'')+(window.riderMobile?.enabled ? "\n## Mobile trial\n"+JSON.stringify(window.riderMobile.snapshot(),null,2) : "");api.busy=true;api.status='Copying...';
    try {
      if(!window.isSecureContext || !navigator.clipboard?.writeText)throw Error('Clipboard unavailable');
      await navigator.clipboard.writeText(text);
      if(request!==api.request)return;
      api.status='Copied feedback [F]';
    } catch(error) {
      if(request!==api.request)return;
      api.fallback(text);
    } finally {if(request===api.request)api.busy=false;}
  };
  document.addEventListener('keydown',event=>{
    // In the level editor F places a test start; the copy shortcut is off there (R15 input gating).
    if(event.code!=='KeyF'||event.repeat||window.riderEditing||event.ctrlKey||event.metaKey||event.altKey||/^(INPUT|TEXTAREA|BUTTON)$/.test(event.target?.tagName)||event.target?.isContentEditable)return;
    event.preventDefault();api.copy();
  });
})();
