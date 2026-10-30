// UI commands only. The loader admits courses and owns progress, pause and world changes.
(() => {
 if (window.riderLevelMenu) return;
 const request=(action,id)=>{window.riderMobile?.clear();window.riderLevelsRequest={action,id};};
 const style=document.createElement('style');style.textContent=`
 #rider-levels[hidden],#rider-level-actions[hidden]{display:none!important}
 #rider-levels{position:fixed;inset:0;z-index:1200;background:#07171f;color:#edf9f4;font:16px system-ui;overflow:auto;padding:24px max(18px,env(safe-area-inset-left));box-sizing:border-box;touch-action:pan-y}
 #rider-levels .level-heading{max-width:1000px;margin:auto;display:flex;align-items:center;justify-content:space-between;gap:16px}
 #rider-levels h1{font-size:26px;margin:6px 0}#rider-levels .level-status{max-width:1000px;margin:8px auto 20px;color:#9ec8c7}
 #rider-levels .level-grid{max-width:1000px;margin:auto;display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:16px}
 #rider-levels article{background:#122d36;border:1px solid #35505a;border-radius:16px;overflow:hidden;display:flex;flex-direction:column}
 #rider-levels article.locked{opacity:.7}#rider-levels svg{width:100%;height:100px;background:#183c4b;display:block}
 #rider-levels .level-info{padding:16px;flex:1}#rider-levels h2{font-size:19px;margin:0 0 12px}#rider-levels p{margin:7px 0;font-size:14px}
 #rider-levels button,#rider-level-actions button{font:600 15px system-ui;min-height:44px;padding:10px 18px;border:1px solid #65bfa7;border-radius:9px;background:#235b50;color:#fff;cursor:pointer}
 #rider-levels article button{margin:0 16px 16px}#rider-levels button:disabled,#rider-level-actions button:disabled{background:#263d43;border-color:#46616a;color:#abc2c8;cursor:default}
 #rider-level-actions{position:fixed;right:12px;bottom:60px;z-index:450;display:flex;gap:8px}
 @media(max-width:650px){#rider-levels .level-grid{grid-template-columns:1fr}#rider-levels{padding-top:12px}#rider-levels h1{font-size:22px}#rider-levels svg{height:80px}#rider-level-actions{bottom:150px;right:8px}#rider-level-actions button{font-size:13px;padding:8px 12px}}
 `;document.head.append(style);
 const root=document.createElement('section');root.id='rider-levels';root.hidden=true;root.setAttribute('role','dialog');root.setAttribute('aria-modal','true');root.setAttribute('aria-label','Choose a level');
 const heading=document.createElement('div');heading.className='level-heading';const title=document.createElement('h1');title.textContent='Choose a level';heading.append(title);
 const close=document.createElement('button');close.textContent='Back';close.onclick=()=>request('close');heading.append(close);root.append(heading);
 const status=document.createElement('p');status.className='level-status';root.append(status);const grid=document.createElement('div');grid.className='level-grid';root.append(grid);
 const actions=document.createElement('div');actions.id='rider-level-actions';const open=document.createElement('button');open.textContent='Levels';open.onclick=()=>request('open');const next=document.createElement('button');next.textContent='Next Level';next.hidden=true;next.onclick=()=>request('next');actions.append(open,next);document.body.append(root,actions);
 let signature='',wasOpen=false;
 const api=window.riderLevelMenu={render(view){
  root.hidden=!view.open;actions.hidden=view.open||view.loading||!!window.riderEditing;
  next.hidden=!view.next_enabled;status.textContent=view.status==='saved'?'Finish a level to unlock the next. Medals and Wonder Gems are optional.':view.status;
  const key=JSON.stringify([view.courses,view.loading]);
  if(key!==signature){signature=key;grid.replaceChildren();
   for(const [i,c] of view.courses.entries()){
    const card=document.createElement('article');card.className=c.unlocked?'':'locked';card.dataset.course=c.id;
    const ns='http://www.w3.org/2000/svg',svg=document.createElementNS(ns,'svg');svg.setAttribute('viewBox','0 0 300 100');svg.setAttribute('aria-label',c.name+' terrain preview');svg.setAttribute('role','img');
    const xs=c.preview.map(p=>p[0]),ys=c.preview.map(p=>p[1]),xmin=Math.min(...xs),xrange=Math.max(...xs)-xmin||1,ymin=Math.min(...ys),yrange=Math.max(4,Math.max(...ys)-ymin);
    const points=c.preview.slice().sort((a,b)=>a[0]-b[0]).map(p=>[10+280*(p[0]-xmin)/xrange,80-50*(p[1]-ymin)/yrange]);
    const terrain=document.createElementNS(ns,'polygon');terrain.setAttribute('points',[[10,100],...points,[290,100]].map(p=>p.join(',')).join(' '));terrain.setAttribute('fill','#38745e');terrain.setAttribute('stroke','#8ed49d');terrain.setAttribute('stroke-width','3');svg.append(terrain);card.append(svg);
    const info=document.createElement('div');info.className='level-info';const name=document.createElement('h2');name.textContent=`${i+1}. ${c.name}`;info.append(name);
    for(const text of [c.completed?'Completed':c.unlocked?'Ready to drive':`Locked — finish ${view.courses[i-1]?.name||'the previous level'}`,`Best ${c.best>0?c.best.toFixed(2)+' s':'--'} · Medal ${['None','Bronze','Silver','Gold'][c.medal]}`,`Wonder Gems ${c.gems}/${c.total_gems}`,c.record_status==='saved'?'':c.record_status]){if(text){const p=document.createElement('p');p.textContent=text;info.append(p);}}
    card.append(info);const play=document.createElement('button');play.textContent=c.unlocked?'Play '+c.name:'Locked';play.disabled=!c.unlocked||view.loading;play.onclick=()=>request('play',c.id);card.append(play);grid.append(card);
   }
  }
  if(view.open&&!wasOpen){window.riderMobile?.clear();close.focus();}
  if(!view.open&&wasOpen)document.querySelector('canvas')?.focus();wasOpen=view.open;
 }};
 root.addEventListener('keydown',e=>{if(e.key==='Escape'){request('close');e.preventDefault();}if(e.key==='Tab'){const buttons=[...root.querySelectorAll('button:not(:disabled)')],first=buttons[0],last=buttons.at(-1);if(e.shiftKey&&document.activeElement===first){last.focus();e.preventDefault();}else if(!e.shiftKey&&document.activeElement===last){first.focus();e.preventDefault();}}});
})();
