// HTML5 input adapter. All vehicle writes remain in the fixed Lua owner.
(() => {
  if (window.riderMobile) return;
  const forced=new URLSearchParams(location.search).get('touch');
  const enabled=forced==='1'||(forced!=='0'&&navigator.maxTouchPoints>0);
  const pointers=new Map(),pending={};
  // Offline Phosphor Icons core 2.1.1 bold subset, upstream commit 2b75f3ad12b420c9504ef05df8d2564a28f8500e.
  // MIT © 2023 Phosphor Icons; full notice in main/gym/PHOSPHOR_LICENSE.txt.
  const iconPaths={"pause":"M200,28H160a20,20,0,0,0-20,20V208a20,20,0,0,0,20,20h40a20,20,0,0,0,20-20V48A20,20,0,0,0,200,28Zm-4,176H164V52h32ZM96,28H56A20,20,0,0,0,36,48V208a20,20,0,0,0,20,20H96a20,20,0,0,0,20-20V48A20,20,0,0,0,96,28ZM92,204H60V52H92Z","resume":"M234.49,111.07,90.41,22.94A20,20,0,0,0,60,39.87V216.13a20,20,0,0,0,30.41,16.93l144.08-88.13a19.82,19.82,0,0,0,0-33.86ZM84,208.85V47.15L216.16,128Z","retry":"M228,128a100,100,0,0,1-98.66,100H128a99.39,99.39,0,0,1-68.62-27.29,12,12,0,0,1,16.48-17.45,76,76,0,1,0-1.57-109c-.13.13-.25.25-.39.37L54.89,92H72a12,12,0,0,1,0,24H24a12,12,0,0,1-12-12V56a12,12,0,0,1,24,0V76.72L57.48,57.06A100,100,0,0,1,228,128Z","menu":"M228,128a12,12,0,0,1-12,12H40a12,12,0,0,1,0-24H216A12,12,0,0,1,228,128ZM40,76H216a12,12,0,0,0,0-24H40a12,12,0,0,0,0,24ZM216,180H40a12,12,0,0,0,0,24H216a12,12,0,0,0,0-24Z","tuning":"M40,92H70.06a36,36,0,0,0,67.88,0H216a12,12,0,0,0,0-24H137.94a36,36,0,0,0-67.88,0H40a12,12,0,0,0,0,24Zm64-24A12,12,0,1,1,92,80,12,12,0,0,1,104,68Zm112,96H201.94a36,36,0,0,0-67.88,0H40a12,12,0,0,0,0,24h94.06a36,36,0,0,0,67.88,0H216a12,12,0,0,0,0-24Zm-48,24a12,12,0,1,1,12-12A12,12,0,0,1,168,188Z","coin":"M209.37,60.27C188.08,49.62,160,44,128,44S67.92,49.62,46.63,60.27C24.62,71.27,12,87.21,12,104v48c0,16.79,12.62,32.73,34.63,43.73C67.92,206.38,96.05,212,128,212s60.08-5.62,81.37-16.27c22-11,34.63-26.94,34.63-43.73V104C244,87.21,231.38,71.27,209.37,60.27Zm-152,21.46C75.08,72.88,100.16,68,128,68s52.92,4.88,70.63,13.73C211.81,88.32,220,96.86,220,104s-8.19,15.68-21.37,22.27C180.92,135.12,155.84,140,128,140s-52.92-4.88-70.63-13.73C44.19,119.68,36,111.14,36,104S44.19,88.32,57.37,81.73ZM180,181.38a180.38,180.38,0,0,1-40,6.3v-24a210.39,210.39,0,0,0,40-5.51ZM76,158.22a210.39,210.39,0,0,0,40,5.51v24a180.38,180.38,0,0,1-40-6.3ZM36,152V141.54a94.54,94.54,0,0,0,10.63,6.19c1.74.87,3.54,1.7,5.37,2.5V171.3C42,165.24,36,158.11,36,152Zm168,19.3V150.23c1.83-.8,3.63-1.63,5.37-2.5A94.54,94.54,0,0,0,220,141.54V152C220,158.11,214,165.24,204,171.3Z","fuel":"M247.8,66.83,228.49,47.51a12,12,0,0,0-17,17L230.83,83.8A4,4,0,0,1,232,86.63V166a6,6,0,0,1-12,0V128a28,28,0,0,0-28-28H180V56a28,28,0,0,0-28-28H72A28,28,0,0,0,44,56V204H32a12,12,0,0,0,0,24H192a12,12,0,0,0,0-24H180V124h12a4,4,0,0,1,4,4v38a30,30,0,0,0,60,0V86.63A27.81,27.81,0,0,0,247.8,66.83ZM68,204V56a4,4,0,0,1,4-4h80a4,4,0,0,1,4,4V204Zm72-92a12,12,0,0,1-12,12H96a12,12,0,0,1,0-24h32A12,12,0,0,1,140,112Z","finish":"M229,45a12,12,0,0,0-12.85,1.84c-24.71,21.41-44.53,13.31-74.82-1.68C113.19,31.27,78.17,13.94,40.14,46.88A12,12,0,0,0,36,56V224a12,12,0,0,0,24,0V181.71c22.84-17.13,42.1-9.11,70.68,5,16.23,8,34.74,17.2,54.8,17.2,14.72,0,30.28-4.94,46.38-18.88A12,12,0,0,0,236,176V56A12,12,0,0,0,229,45ZM185.48,83.91A63,63,0,0,0,212,78.08v32.15c-11,8.26-21.2,10.67-32,9.37V83.66C181.81,83.81,183.64,83.91,185.48,83.91ZM156,78.08v34.09c-4.64-2-9.5-4.4-14.68-7A255.21,255.21,0,0,0,116,93.83V59.75c4.64,2,9.5,4.4,14.68,7A252.91,252.91,0,0,0,156,78.08ZM92,52.32V88.24a63.33,63.33,0,0,0-32,5.61V61.68C71,53.42,81.2,51,92,52.32ZM86.52,148A63,63,0,0,0,60,153.86V121.7c11-8.25,21.2-10.66,32-9.36v35.94C90.19,148.13,88.36,148,86.52,148ZM116,153.86V119.77c4.64,2,9.5,4.4,14.68,7A252.91,252.91,0,0,0,156,138.1v34.09c-4.64-2.05-9.5-4.4-14.68-7A250.66,250.66,0,0,0,116,153.86Zm64,25.76V143.68c1.81.14,3.64.24,5.48.24A62.85,62.85,0,0,0,212,138.07v32.19C201,178.52,190.8,180.92,180,179.62Z","start":"M242.15,49.59A12,12,0,0,0,232,44H40a12,12,0,0,0-8.48,20.49L71,104,31.52,143.51A12,12,0,0,0,40,164H167.28l-26.11,54.84a12,12,0,1,0,21.66,10.32l80-168A12,12,0,0,0,242.15,49.59ZM178.71,140H69l27.52-27.52a12,12,0,0,0,0-17L69,68H213Z","car":"M236,108H213L170.83,65.86A19.86,19.86,0,0,0,156.69,60H48.28a20,20,0,0,0-16.64,8.91L2,113.34A12,12,0,0,0,0,120v48a20,20,0,0,0,20,20H33.5a34,34,0,0,0,65,0h59a34,34,0,0,0,65,0H236a20,20,0,0,0,20-20V128A20,20,0,0,0,236,108ZM50.42,84H155l24,24H34.42ZM66,188a10,10,0,1,1,10-10A10,10,0,0,1,66,188Zm124,0a10,10,0,1,1,10-10A10,10,0,0,1,190,188Zm42-24H221A34,34,0,0,0,159,164H97A34,34,0,0,0,35,164H24V132H232Z"};
  const glyph=name=>{
    const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');
    svg.setAttribute('viewBox','0 0 256 256');svg.setAttribute('fill','currentColor');
    svg.setAttribute('aria-hidden','true');svg.setAttribute('focusable','false');
    const path=document.createElementNS('http://www.w3.org/2000/svg','path');
    path.setAttribute('d',iconPaths[name]);svg.append(path);return svg;
  };
  const setIconLabel=(button,label,name)=>{
    if(button.getAttribute('aria-label')===label&&button.dataset.icon===name)return;
    button.dataset.icon=name;button.setAttribute('aria-label',label);button.title=label;
    button.replaceChildren(glyph(name));
  };

  const api=window.riderMobile={enabled,mirrored:false,details:false,report:null,recording:false};
  let root,zones,status,hud,tiltHud,tiltPanel,measure,lastFrame,trial,lastSequence,toastNode,progressNodes,coinHud,coinWidget,fuelHud,fuelBar,fuelWidget,mechanismHud,speedometer,speedValue,speedNeedle,speedLimit,raceSummary;
  let browserIdentity={userAgent:navigator.userAgent};
  navigator.userAgentData?.getHighEntropyValues?.(['fullVersionList','platformVersion'])
    .then(value=>{browserIdentity={...browserIdentity,...value};}).catch(()=>{});
  api.cancel=()=>{api.closeMore?.();api.clear();for(const key of Object.keys(pending))delete pending[key];lastSequence=undefined;lastFrame=undefined;if(trial){trial=null;api.recording=false;status.textContent="Capture cancelled: station switched";}};
  api.clear=(preserveTilt=false)=>{
    if(!preserveTilt)window.riderTilt?.pause("Input cleared — calibrate to resume");
    pointers.clear();
    root?.querySelectorAll('[data-command]').forEach(b=>b.classList.remove('held'));
  };
  const abort=reason=>{
    api.closeMore?.();api.clear();pending.clear=true;lastFrame=undefined;
    if(trial){trial=null;api.recording=false;status.textContent='Capture cancelled: '+reason;}
  };
  window.addEventListener('blur',()=>{pending.background=true;abort('focus lost');});
  document.addEventListener('visibilitychange',()=>{if(document.hidden){pending.background=true;abort('page hidden');}});
  window.addEventListener('resize',()=>abort('viewport changed; restart capture'));
  function summary(values){
    const sorted=[...values].sort((a,b)=>a-b);
    return {samples:sorted.length,mean:values.reduce((a,b)=>a+b,0)/values.length,
      p95:sorted[Math.ceil(sorted.length*.95)-1],max:sorted.at(-1)};
  }
  api.snapshot=()=>({source:window.riderBuild,browser:browserIdentity,layout:api.mirrored?'B':'A',
    viewport:window.riderViewport,recording:api.recording,capture:api.report,
    tilt:window.riderTilt?.snapshot(),actualDevice:'User must confirm device, refresh mode, feel and visible stutter'});
  api.poll=(dt,physics)=>{
    const now=performance.now(),gap=lastFrame===undefined?null:now-lastFrame;
    lastFrame=now;
    const data=window.riderTelemetry;
    const run=window.riderRun;
    api.setRun?.(run);
    if(enabled&&run){
      const label=run.state==='ready'?'Drive to start':run.state==='paused'?'Paused':run.state==='failed'?'Attempt ended':run.state==='finished'?'Finished':run.course_name||'Run';
      hud.textContent=`${label} · ${run.time.toFixed(2)} s · Best ${run.best>0?run.best.toFixed(2)+' s':'--'} · ${run.official?'Official':'Practice'}${run.has_medals?' · Saved '+['None','Bronze','Silver','Gold'][run.highest_medal]:''}${run.save==='saved'?'':' · '+run.save}`;
      if(raceSummary){
        raceSummary.hidden=false;
        const awarded=(run.state==='finished'||run.state==='failed')&&run.medal>0?' · '+['','Bronze','Silver','Gold'][run.medal]+' awarded':'';
        // No in-run prediction: full Gold/Silver thresholds are not in the current run_state.
        raceSummary.textContent=`${run.time.toFixed(2)} s · ${run.official?'Official':'Practice'}${awarded}`;
      }
    }else if(enabled&&data&&data.sequence!==lastSequence){
      if(raceSummary)raceSummary.hidden=true;
      lastSequence=data.sequence;
      hud.textContent=data.station_result?`${data.station_name} · start ${data.start_speed.toFixed(1)} m/s · ${data.station_result}`:`${data.station_name||'Straight'} · start ${(data.start_speed||0).toFixed(1)} m/s · x ${(data.station_distance||0).toFixed(1)} m · top ${(data.station_top_speed||0).toFixed(1)} m/s · brake ${(data.station_brake_distance||0).toFixed(1)} m${window.riderStationError?' · '+window.riderStationError:data.station_note?' · '+data.station_note:''}`;
    }
    if(enabled&&mechanismHud){const m=window.riderMechanisms;mechanismHud.hidden=!m;if(m)mechanismHud.textContent='Plates '+m.plates.filter(p=>p.active).length+'/'+m.plates.length+' active · Gate '+(m.gates[0]?.state||'none')+(m.plates.some(p=>p.mode==='pulse'&&p.pressed&&!p.active)?' · Release to rearm':'');}
    if(enabled&&fuelHud){const f=window.riderFuel;fuelWidget.hidden=!f;fuelHud.hidden=!f;fuelBar.hidden=!f;
      if(f){fuelHud.textContent=f.text+' · Refills '+f.collected;
        fuelHud.dataset.compact=Math.round(100*f.amount/Math.max(1,f.start))+'%';
        fuelBar.max=f.start;fuelBar.value=f.amount;fuelWidget.classList.toggle('low',!!f.low);
        const fraction=f.amount/Math.max(1,f.start);
         fuelWidget.classList.toggle('medium',!f.low&&fraction<.5);
         fuelBar.style.accentColor=f.low?'#ed655f':fraction<.5?'#ffbe4e':'#94dd49';
      }
    }
    if(enabled&&coinHud){
      const c=window.riderCoins;coinHud.hidden=!c;coinWidget.hidden=!c;
      if(c){coinHud.dataset.compact=String(c.count);coinHud.textContent=`Coins ${c.count}/${c.total}${c.flash?' · +'+c.flash:''} · Bank ${c.bank}${c.gem_total?' · Gems '+c.gems+'/'+c.gem_total+' · Earned '+c.gem_earned+'/'+c.gem_total+' · Gem bank '+c.gem_bank:''}${c.practice?' · Practice':''}${c.save==='saved'?'':' · '+c.save}`;}
    }
    if(enabled&&speedometer){
      // speed_mps is the observed chassis velocity magnitude; velocity_x supplies reverse direction.
      // Do not treat telemetry.fps (engine callback rate) as presented/render FPS.
      const speed=Number(data?.speed_mps),valid=Number.isFinite(speed)&&speed>=0&&!data?.ui_captured;
      speedometer.hidden=!valid;
      if(valid){
        const kmh=speed*3.6,scale=Math.max(20,Math.ceil(kmh/10)*10);
        const reverse=Number(data.velocity_x)<-0.01;
        speedValue.textContent=Math.round(kmh).toString();
        speedLimit.textContent=scale+' max'+(reverse?' · R':'');
        speedNeedle.style.transform='translateX(-50%) rotate('+(-110+220*Math.min(1,kmh/scale))+'deg)';
        speedometer.setAttribute('aria-label','Chassis speed '+kmh.toFixed(1)+' km/h'+(reverse?' reverse':''));
      }
    }
    if(enabled&&progressNodes){
      const p=window.riderProgress,n=progressNodes;
      n.root.hidden=!p?.enabled||p.modal||!!window.riderEditing||!!data?.ui_captured;
      if(p){
        for(const node of [n.start,n.finish,n.track,n.value])node.hidden=!p.available;
        n.reason.hidden=p.available;
        n.reason.textContent=p.available?'':'Progress unavailable: '+p.reason;
        if(p.available){n.car.style.left=(100*p.fraction)+'%';n.value.textContent=Math.floor(100*p.fraction+.000001)+'%';}
      }
    }
    if(enabled){
      if(api.sectionButton)api.sectionButton.hidden=!(data?.section_count>1);
      const tilt=window.riderTilt;
      tiltHud.textContent=tilt.mode==='active'?`Tilt input ${tilt.lean().toFixed(2)} · touch lean overrides`:
        tilt.mode==='off'?'':tilt.reason||'Calibrate tilt';
      const enable=tiltPanel.querySelector('[data-tilt-enable]');
      enable.textContent=['off','fallback'].includes(tilt.mode)?'Enable tilt':'Disable tilt';
    }
    if(trial){
      if(gap>1000)abort('interrupted frame stream');
      else {
        if(gap>0)trial.frames.push(gap);
        if(Number.isFinite(dt)&&dt>0)trial.engineDt.push(dt*1000);
        if(Number.isFinite(physics)&&physics>=0)trial.physics.push(physics);
        const seconds=(now-trial.started)/1000;
        status.textContent=`Recording ${Math.min(30,seconds).toFixed(0)} / 30 s — keep driving`;
        if(seconds>=30&&trial.frames.length&&trial.physics.length&&trial.engineDt.length){
          api.report={source:window.riderBuild,browser:browserIdentity,
            refreshModeUserSelected:trial.mode,layout:trial.layout,viewport:trial.viewport,
            durationSeconds:seconds,conditions:trial.conditions,tiltEnd:window.riderTilt?.snapshot(),timeScaleEnd:window.riderTimeState||{paused:false,step:1},resetCountEnd:window.riderTelemetry?.reset_count,engineCallbackIntervalMs:summary(trial.frames),
            engineDtMs:summary(trial.engineDt),physicsStepMs:summary(trial.physics),
            physicsZeroSamples:trial.physics.filter(v=>v===0).length,
            over25ms:trial.frames.filter(v=>v>25).length,
            evidence:'Browser capture. Zero profile samples may be below timing resolution. Physical device and visible stutter need user confirmation.'};
          trial=null;api.recording=false;status.textContent='30 s captured. Copy report; add feel and visible stutter.';
        }
      }
    }
    const held=new Set(pointers.values());
    const state={throttle:held.has('throttle'),brake:held.has('brake'),
      left:held.has('left'),right:held.has('right'),tilt:api.details||tiltPanel?.classList.contains('open')?0:(window.riderTilt?.lean()||0),...pending};
    for(const key of Object.keys(pending))delete pending[key];
    return JSON.stringify(state);
  };
  if(!enabled)return;
  const style=document.createElement('style');
  style.textContent=`
    #rider-mobile{position:fixed;inset:0;z-index:1000;pointer-events:none;font:14px system-ui;color:#ecfff8}
    #rider-mobile button,#rider-mobile select{pointer-events:auto;touch-action:none;user-select:none;-webkit-user-select:none;-webkit-touch-callout:none;min-height:44px;border:1px solid #78cdb9;border-radius:9px;background:#142e38ed;color:#ecfff8;font:inherit;padding:6px 10px}
    #rider-mobile .toolbar button{min-height:44px;min-width:44px;font-size:12px;padding:6px 8px}
    #rider-mobile .toolbar-more{position:absolute;top:calc(100% + 6px);right:0;width:min(340px,calc(100vw - 16px));box-sizing:border-box;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:6px;padding:8px;border:1px solid #78cdb9;border-radius:10px;background:#10252bf5;overflow-y:auto;overscroll-behavior:contain;touch-action:pan-y;pointer-events:auto;z-index:2}
    #rider-mobile .toolbar-more[hidden]{display:none}
    #rider-mobile .toolbar-more button{width:100%;min-width:0}
    #rider-mobile button.held{background:#277b67}
    #rider-mobile .toolbar{position:absolute;top:max(6px,env(safe-area-inset-top));left:240px;right:max(8px,env(safe-area-inset-right));display:flex;justify-content:flex-end;flex-wrap:wrap;gap:4px;align-items:center}
    #rider-mobile .zones{position:absolute;bottom:max(8px,env(safe-area-inset-bottom));left:max(8px,env(safe-area-inset-left));right:max(8px,env(safe-area-inset-right));display:flex;justify-content:space-between;gap:24px}
    #rider-mobile .pair{display:flex;gap:8px}
    #rider-mobile .zones button{width:clamp(62px,12vw,130px);height:clamp(64px,18vh,100px);font-weight:bold;background:#142e38ce}
    #rider-mobile .zones button.held{background:#277b67}
    #rider-mobile .readout{position:absolute;right:10px;top:60px;max-width:calc(100% - 230px);background:#10252bdb;padding:5px;pointer-events:none;font-size:12px}
    #rider-mobile .course-progress{display:flex;align-items:center;gap:8px;min-width:0;width:250px;max-width:100%;margin-top:6px;font-size:12px}
    #rider-mobile .progress-track{height:4px;min-width:24px;flex:1;position:relative;background:#486963}
    #rider-mobile .progress-car{position:absolute;top:-7px;width:14px;height:6px;border-radius:2px;background:#4de6d9;transform:translateX(-50%)}
    #rider-mobile .progress-car:before{content:'';position:absolute;top:-4px;left:3px;width:8px;height:4px;background:#4de6d9}
    #rider-mobile .progress-car:after{content:'';position:absolute;top:5px;left:1px;width:3px;height:3px;background:#ecfff8;box-shadow:9px 0 #ecfff8}
    #rider-mobile .course-progress[hidden],#rider-mobile .course-progress [hidden]{display:none}
    #rider-mobile .toast{position:absolute;top:56px;left:50%;transform:translateX(-50%);max-width:calc(100% - 32px);padding:6px 12px;background:#10252bf0;border-radius:6px;text-align:center;pointer-events:none}
    #rider-mobile .toast[hidden]{display:none}
    #rider-mobile .measure,#rider-mobile .tilt-panel{display:none;position:absolute;top:114px;left:10px;right:10px;gap:5px;align-items:center;flex-wrap:wrap}
    #rider-mobile .measure.open,#rider-mobile .tilt-panel.open{display:flex}
    #rider-mobile .tilt-panel{background:#10252bf5;padding:8px;border-radius:8px;max-width:620px}
    #rider-mobile .tilt-panel label{pointer-events:auto;display:flex;align-items:center;gap:8px}
    #rider-mobile .tilt-panel input{pointer-events:auto;min-height:32px;width:110px;touch-action:pan-x}
    #rider-mobile.editing .toolbar button:not([data-tuning]),#rider-mobile.editing .toolbar-more{display:none}
    #rider-mobile.editing .zones{display:none}
    #rider-mobile.editing .readout{display:none}
    #rider-mobile.editing .measure,#rider-mobile.editing .tilt-panel{display:none}
    #app-container.mobile-driving #page-tools{display:none}
  `;
  style.textContent+=`
    #rider-mobile{--rider-amber:#f5ac48;--rider-gold:#ffcc69;--rider-ink:#231f26;--rider-paper:#fff2d9;color:var(--rider-paper)}
    #rider-mobile button,#rider-mobile select{border-color:#e3a45c;background:#2b2633ed;color:var(--rider-paper)}
    #rider-mobile button:focus-visible{outline:2px solid var(--rider-gold);outline-offset:2px}
    #rider-mobile .toolbar{top:max(8px,env(safe-area-inset-top));left:max(8px,env(safe-area-inset-left));right:auto;flex-wrap:nowrap;justify-content:flex-start;gap:5px}
    #rider-mobile .toolbar button{width:44px;height:44px;min-width:44px;padding:8px;border:1px solid #a67865;border-radius:12px;background:#493544ee;box-shadow:0 2px 4px #1a14254d}
    #rider-mobile .toolbar button:nth-child(1){background:#74444a;border-color:#be7770}
    #rider-mobile .toolbar button:nth-child(2){background:#4b5279;border-color:#8799d1}
    #rider-mobile .toolbar button:nth-child(3){background:#74502f;border-color:#c28d52}
    #rider-mobile .toolbar button:nth-child(4){background:#484061;border-color:#9884bb}
    #rider-mobile .toolbar button[disabled]{opacity:.45}
    #rider-mobile .toolbar button[aria-expanded="true"]{background:#86522e}
    #rider-mobile .toolbar button svg{width:22px;height:22px;display:block;margin:auto}
    #rider-mobile .toolbar-more{left:0;right:auto;background:#29252cf5;border-color:#b7793e}
    #rider-mobile .toolbar button{position:relative;overflow:hidden;color:#fff9eb;box-shadow:0 2px 4px #1a14254d,inset 0 1px 0 #ffffff45}
    #rider-mobile .toolbar button:before{content:'';position:absolute;left:8px;right:8px;top:3px;height:3px;border-radius:100%;background:#ffffff55;pointer-events:none}
    #rider-mobile .toolbar button:nth-child(1){background:linear-gradient(#ed7777,#ad415c);border-color:#ff9b89}
    #rider-mobile .toolbar button:nth-child(2){background:linear-gradient(#829af0,#4b5ec1);border-color:#a4b5ff}
    #rider-mobile .toolbar button:nth-child(3){background:linear-gradient(#f4b95b,#bd7731);border-color:#ffcf7b}
    #rider-mobile .toolbar button:nth-child(4){background:linear-gradient(#9d83e0,#6853aa);border-color:#baa3ff}
    #rider-mobile .toolbar-more button{width:100%;height:auto;min-height:44px}
    #rider-mobile .zones button{position:relative;overflow:hidden;border:1px solid #aab4ff;border-radius:18px 18px 14px 14px;background:linear-gradient(180deg,#7b92efed,#4e55b7ee);color:#fffdf2;text-shadow:0 1px 1px #23142e88;box-shadow:0 3px 5px #120e1a70,inset 0 1px 0 #ffffff7d}
    #rider-mobile .zones button:before{content:'';position:absolute;top:4px;left:12px;right:12px;height:4px;border-radius:50%;background:#ffffff55;pointer-events:none}
    #rider-mobile .zones button[data-command="right"]{background:linear-gradient(180deg,#8b83e8ef,#5e4fa8f0);border-color:#c2aaff}
    #rider-mobile .zones button[data-command="brake"]{background:linear-gradient(180deg,#f07874f0,#b93f5bf2);border-color:#ffab94}
    #rider-mobile .zones button[data-command="throttle"]{background:linear-gradient(180deg,#a7df57f0,#5d9b3af2);border-color:#d5f68d;color:#192819;text-shadow:none}
    #rider-mobile .zones button.held{filter:brightness(1.17);box-shadow:inset 0 3px 6px #17121a88,0 0 0 2px #ffe4a3aa;transform:translateY(1px)}
    #rider-mobile .zones button.held,#rider-mobile button.held{background:#99612f}
    #rider-mobile .toolbar-more .readout{position:static;grid-column:1/-1;width:auto;max-width:none;max-height:none;background:#201c27;border:1px solid #685b68;border-radius:8px;font-size:11px;color:#eee0cd;padding:7px;pointer-events:none}
    #rider-mobile .toolbar-more .readout>div{white-space:normal;overflow-wrap:anywhere}
    #rider-mobile .course-progress{position:absolute;top:max(9px,env(safe-area-inset-top));left:50%;transform:translateX(-50%);width:clamp(184px,27vw,275px);height:30px;min-width:0;margin:0;gap:5px;font-size:10px;color:var(--rider-paper)}
    #rider-mobile .course-progress>span:not(.progress-value):not(.progress-reason) svg{width:16px;height:16px;display:block}
    #rider-mobile .progress-track{height:3px;min-width:20px;background:linear-gradient(90deg,#f8bc5d,#b17ae6);border-radius:4px}
    #rider-mobile .progress-car{top:-12px;width:17px;height:17px;background:none;color:var(--rider-gold)}
    #rider-mobile .progress-car:before,#rider-mobile .progress-car:after{content:none}
    #rider-mobile .progress-car svg{width:17px;height:17px}
    #rider-mobile .progress-value{position:absolute;top:15px;left:50%;transform:translateX(-50%);font-size:10px;font-variant-numeric:tabular-nums;font-weight:700}
    #rider-mobile .progress-reason{position:absolute;top:20px;left:50%;transform:translateX(-50%);white-space:nowrap;font-size:10px}
    #rider-mobile .race-summary{position:absolute;top:max(42px,calc(env(safe-area-inset-top) + 33px));left:50%;transform:translateX(-50%);font-size:10px;white-space:nowrap;color:#ffe3ac;background:#332a3094;padding:2px 6px;border-radius:7px}
    #rider-mobile .coin-widget{position:absolute;top:max(11px,env(safe-area-inset-top));right:max(10px,env(safe-area-inset-right));display:flex;align-items:center;gap:4px;color:var(--rider-gold);background:#2b263394;border-radius:10px;padding:3px 7px}
    #rider-mobile .coin-widget svg{width:16px;height:16px}
    #rider-mobile .coin-count{font-size:0}
    #rider-mobile .coin-count:after{content:attr(data-compact);font-size:12px;font-weight:700}
    #rider-mobile .fuel-widget{position:absolute;top:max(78px,calc(env(safe-area-inset-top) + 71px));left:max(10px,env(safe-area-inset-left));display:flex;flex-direction:column;align-items:center;gap:4px;color:var(--rider-amber);background:#2b263394;padding:5px 4px;border-radius:10px}
    #rider-mobile .fuel-widget svg{width:16px;height:16px}
    #rider-mobile .fuel-count{font-size:0}
    #rider-mobile .fuel-count:after{content:attr(data-compact);font-size:10px}
    #rider-mobile .fuel-bar{appearance:none;-webkit-appearance:none;writing-mode:vertical-lr;direction:rtl;width:14px;height:70px;border:2px solid #f9cb78;border-radius:8px;overflow:hidden;background:#27212e;box-shadow:inset 0 1px 2px #0d0a14}
    #rider-mobile .fuel-bar::-webkit-progress-bar{background:#27212e;border-radius:5px}
    #rider-mobile .fuel-bar::-webkit-progress-value{background:linear-gradient(90deg,#b9ee69,#6fc344);border-radius:5px}
    #rider-mobile .fuel-widget.medium .fuel-bar::-webkit-progress-value{background:linear-gradient(90deg,#ffe48a,#e9a53b)}
    #rider-mobile .fuel-widget.low .fuel-bar::-webkit-progress-value{background:linear-gradient(90deg,#ff9980,#e9545d)}
    #rider-mobile .fuel-widget.low{color:#ff7558}
    #rider-mobile .speedometer{position:absolute;bottom:max(9px,env(safe-area-inset-bottom));left:50%;transform:translateX(-50%);width:82px;height:82px;box-sizing:border-box;border:2px solid #c9874a;border-radius:50%;background:radial-gradient(circle at 45% 30%,#48373f,#2c2631 75%);box-shadow:0 2px 5px #130e1766;pointer-events:none;color:var(--rider-paper);text-align:center}
    #rider-mobile .speed-ticks{position:absolute;inset:0;pointer-events:none}
    #rider-mobile .speed-tick{position:absolute;left:calc(50% - 1.5px);top:calc(50% - 3px);width:3px;height:7px;border-radius:2px;transform:rotate(var(--tick-angle)) translateY(-29px);background:#92dd69}
    #rider-mobile .speed-tick.warm{background:#ffcb61}
    #rider-mobile .speed-tick.hot{background:#ff7d76}
    #rider-mobile .speed-needle{position:absolute;left:50%;bottom:47%;height:33%;width:2px;border-radius:2px;background:var(--rider-amber);transform-origin:50% 100%;transition:transform .08s linear}
    #rider-mobile .speed-value{position:absolute;top:48%;left:0;width:100%;font-weight:800;font-size:18px;font-variant-numeric:tabular-nums}
    #rider-mobile .speed-unit{position:absolute;top:73%;left:0;width:100%;font-size:9px}
    #rider-mobile .speed-limit{position:absolute;top:24%;left:0;width:100%;font-size:8px;color:#e3b87e}
    #rider-mobile .coin-widget[hidden],#rider-mobile .fuel-widget[hidden],#rider-mobile .speedometer[hidden],#rider-mobile .race-summary[hidden]{display:none}
    #rider-mobile.editing .course-progress,#rider-mobile.editing .race-summary,#rider-mobile.editing .coin-widget,#rider-mobile.editing .fuel-widget,#rider-mobile.editing .speedometer{display:none}
  `;
  document.head.append(style);
  document.getElementById('app-container')?.classList.add('mobile-driving');
  root=document.createElement('section');root.id='rider-mobile';
  const toolbar=document.createElement('div');toolbar.className='toolbar';
  const overflow=document.createElement('div');overflow.className='toolbar-more';overflow.id='rider-mobile-more';overflow.hidden=true;
  const closeOverflow=()=>{overflow.hidden=true;moreButton.setAttribute('aria-expanded','false');};
  api.closeMore=closeOverflow;
  function button(label,parent,click){
    const b=document.createElement('button');b.type='button';b.textContent=label;
    if(click)b.addEventListener('click',()=>{api.clear(true);pending.clear=true;if(parent===overflow)closeOverflow();click(b);document.querySelector('canvas')?.focus();});
    else if(parent===overflow)b.addEventListener('click',closeOverflow);
    b.addEventListener('contextmenu',e=>e.preventDefault());parent.append(b);return b;
  }
  // Keep the four existing direct commands and their real pointer behavior; icons are visual-only.
  const retryButton=button('Retry',toolbar,()=>{pending.retry=true;});setIconLabel(retryButton,'Retry','retry');
  const pauseButton=button('Pause',toolbar,()=>{pending.pause=true;});setIconLabel(pauseButton,'Pause','pause');
  const tuningButton=button('Tuning',toolbar,()=>api.toggleDetails());tuningButton.dataset.tuning='';setIconLabel(tuningButton,'Tuning','tuning');
  const moreButton=button('More',toolbar,()=>{
    const opening=overflow.hidden;
    if(opening){measure?.classList.remove('open');tiltPanel?.classList.remove('open');}
    overflow.hidden=!opening;moreButton.setAttribute('aria-expanded',String(opening));
  });
  setIconLabel(moreButton,'More','menu');
  moreButton.setAttribute('aria-controls',overflow.id);
  moreButton.setAttribute('aria-haspopup','true');
  moreButton.setAttribute('aria-expanded','false');
  button('Next station',overflow,()=>{
    const ids=api.stations||['straight'];const index=ids.indexOf(window.riderTelemetry?.station);
    pending.station=ids[(index+1)%ids.length];
  });
  api.sectionButton=button('Next section',overflow,()=>{pending.next_section=true;});api.sectionButton.hidden=true;
  // A20: the same pause and slow-motion requests as Space and X; the loader owns the time step.
  const speedButton=button('Speed 1x',overflow,()=>{pending.time_step=true;});
  api.setRun=run=>{
    const terminal=run?.state==='finished'||run?.state==='failed';
    pauseButton.disabled=terminal;
    setIconLabel(pauseButton,terminal?(run.state==='finished'?'Finished':'Attempt ended'):api.paused?'Resume':'Pause',api.paused?'resume':'pause');
  };
  api.setTime=(paused,step)=>{api.paused=paused;api.setRun(window.riderRun);speedButton.textContent='Speed '+step+'x';};
  // A21: the same record and replay requests as B and G; the Lua tick owner records and replays.
  button('Record run',overflow,()=>{pending.record=true;});
  button('Replay run',overflow,()=>{pending.replay=true;});
  // Same LE1a panel as the hidden page button; it keeps focus instead of returning it to the canvas.
  button('Import level',overflow).addEventListener('click',()=>{api.clear(true);pending.clear=true;window.riderCustom?.open();});
  button('Layout A · mirror',overflow,b=>{
    api.mirrored=!api.mirrored;zones.style.flexDirection=api.mirrored?'row-reverse':'row';
    b.textContent=api.mirrored?'Layout B · mirror':'Layout A · mirror';abort('layout changed');
  });
  api.toggleDetails=()=>{abort('tuning changed');api.details=!api.details;root.classList.toggle('editing',api.details);setIconLabel(tuningButton,api.details?'Close tuning':'Tuning','tuning');};
  button('Measure',overflow,()=>{tiltPanel.classList.remove('open');measure.classList.toggle('open');});
  button('Tilt',overflow,()=>{measure.classList.remove('open');tiltPanel.classList.toggle('open');});
  button('Copy report',overflow,()=>{window.riderFeedback?.copy();});
  button(document.getElementById('quality')?.textContent||'High DPI',overflow,()=>document.getElementById('quality')?.click());
  button('Fullscreen',overflow,()=>document.getElementById('fullscreen')?.click());
  toolbar.append(overflow);
  root.addEventListener('pointerdown',e=>{
    // A held drive pointer must not hide the secondary action before a second pointer can select it.
    // The selected action is responsible for cancelling held input (e.g. Import).
    if(!overflow.hidden&&!overflow.contains(e.target)&&!moreButton.contains(e.target)&&!zones.contains(e.target))closeOverflow();
  },true);
  document.addEventListener('keydown',e=>{if(e.key==='Escape')closeOverflow();});
  root.append(toolbar);
  const readout=document.createElement('div');readout.className='readout';
  hud=document.createElement('div');hud.textContent='Waiting for vehicle';
  status=document.createElement('div');status.textContent='';
  tiltHud=document.createElement('div');tiltHud.textContent='Tilt OFF — touch controls available';
  const replayHud=document.createElement('div');replayHud.dataset.replay='';
  api.setReplay=text=>{replayHud.textContent=text;};
  const progress=document.createElement('div');progress.className='course-progress';progress.hidden=true;
  const start=document.createElement('span'),finish=document.createElement('span'),value=document.createElement('span'),reason=document.createElement('span');
  start.append(glyph('start'));start.title='Start';finish.append(glyph('finish'));finish.title='Finish';
  value.className='progress-value';reason.className='progress-reason';
  const track=document.createElement('div'),car=document.createElement('div');track.className='progress-track';car.className='progress-car';car.append(glyph('car'));track.append(car);
  progress.append(start,track,finish,value,reason);progressNodes={root:progress,start,finish,value,reason,track,car};root.append(progress);
  raceSummary=document.createElement('div');raceSummary.className='race-summary';raceSummary.hidden=true;root.append(raceSummary);
  mechanismHud=document.createElement('div');mechanismHud.className='mechanism-status';mechanismHud.hidden=true;readout.append(mechanismHud);
  coinWidget=document.createElement('div');coinWidget.className='coin-widget';coinWidget.hidden=true;
  coinHud=document.createElement('div');coinHud.className='coin-count';coinHud.hidden=true;coinWidget.append(glyph('coin'),coinHud);root.append(coinWidget);
  fuelWidget=document.createElement('div');fuelWidget.className='fuel-widget';fuelWidget.hidden=true;
  fuelHud=document.createElement('div');fuelHud.className='fuel-count';fuelHud.hidden=true;
  fuelBar=document.createElement('progress');fuelBar.className='fuel-bar';fuelBar.max=100;fuelBar.hidden=true;fuelBar.setAttribute('aria-label','Fuel');
  fuelWidget.append(glyph('fuel'),fuelBar,fuelHud);root.append(fuelWidget);
  speedometer=document.createElement('div');speedometer.className='speedometer';speedometer.hidden=true;speedometer.setAttribute('role','img');
  speedNeedle=document.createElement('div');speedNeedle.className='speed-needle';
  speedValue=document.createElement('div');speedValue.className='speed-value';
  speedLimit=document.createElement('div');speedLimit.className='speed-limit';
  const speedUnit=document.createElement('div');speedUnit.className='speed-unit';speedUnit.textContent='km/h';
  const speedTicks=document.createElement('div');speedTicks.className='speed-ticks';
  for(let i=0;i<9;i++){const tick=document.createElement('i');tick.className='speed-tick'+(i>=7?' hot':i>=5?' warm':'');tick.style.setProperty('--tick-angle',(-110+i*27.5)+'deg');speedTicks.append(tick);}
  speedometer.append(speedTicks,speedNeedle,speedValue,speedLimit,speedUnit);root.append(speedometer);
  // Optional developer diagnostics belong to scrollable More, not over the playfield.
  readout.append(hud,status,tiltHud,replayHud);overflow.append(readout);
  toastNode=document.createElement('div');toastNode.className='toast';toastNode.hidden=true;root.append(toastNode);
  api.toast=message=>{
    toastNode.textContent=message;toastNode.hidden=false;
    toastNode.style.top=Math.max(toolbar.getBoundingClientRect().bottom+8,56)+'px';
    clearTimeout(api.toastTimer);api.toastTimer=setTimeout(()=>{toastNode.hidden=true;},1500);
  };
  measure=document.createElement('div');measure.className='measure';
  const mode=document.createElement('select');mode.setAttribute('aria-label','Refresh mode selected in phone settings');
  for(const value of ['Select phone refresh mode','60 Hz','144 Hz','Other / adaptive']){
    const option=document.createElement('option');option.textContent=value;mode.append(option);
  }
  mode.addEventListener('change',()=>{abort('refresh label changed');});measure.append(mode);
  button('Record 30 s',measure,()=>{
    if(!mode.selectedIndex){status.textContent='Select the refresh mode from phone settings first.';return;}
    api.report=null;lastFrame=undefined;api.recording=true;
    trial={started:performance.now(),mode:mode.value,layout:api.mirrored?'B':'A',
      viewport:{...window.riderViewport},conditions:{tilt:window.riderTilt?.snapshot(),timeScale:window.riderTimeState||{paused:false,step:1},preset:window.riderTelemetry?.preset,resetCountStart:window.riderTelemetry?.reset_count,tuning:window.riderControls?.map(r=>({key:r.key,value:r.value}))},frames:[],engineDt:[],physics:[]};
  });
  root.append(measure);
  tiltPanel=document.createElement('div');tiltPanel.className='tilt-panel';
  const enable=button('Enable tilt',tiltPanel,()=>{
    const tilt=window.riderTilt;
    if(['off','fallback'].includes(tilt.mode))tilt.enable();else tilt.disable();
  });
  enable.dataset.tiltEnable='';
  button('Calibrate neutral',tiltPanel,()=>{
    if(window.riderTilt.calibrate())tiltPanel.classList.remove('open');
  });
  for(const spec of [{key:'fullAngle',label:'Full lean angle',min:10,max:45,value:20},{key:'deadZone',label:'Dead zone',min:0,max:8,value:3}]){
    const label=document.createElement('label'),caption=document.createElement('span');
    caption.textContent=`${spec.label}: ${spec.value}°`;
    const input=document.createElement('input');input.type='range';input.min=spec.min;input.max=spec.max;input.step=1;input.value=spec.value;
    input.setAttribute('aria-label',spec.label);
    input.addEventListener('input',()=>{
      api.clear(true);pending.clear=true;window.riderTilt.configure(spec.key,Number(input.value));
      caption.textContent=`${spec.label}: ${input.value}°`;
    });
    label.append(caption,input);tiltPanel.append(label);
  }
  button('Invert OFF',tiltPanel,b=>{
    window.riderTilt.configure('inverted',!window.riderTilt.inverted);
    b.textContent=window.riderTilt.inverted?'Invert ON':'Invert OFF';
  });
  root.append(tiltPanel);
  zones=document.createElement('div');zones.className='zones';
  for(const commands of [[['left','Lean ←'],['right','Lean →']],[['brake','Brake / reverse'],['throttle','Throttle']]]){
    const pair=document.createElement('div');pair.className='pair';
    for(const [command,label] of commands){
      const b=button(label,pair);b.dataset.command=command;
      b.addEventListener('pointerdown',e=>{
        if(e.button!==0||api.details||window.riderFeedback?.visible||window.riderCustom?.visible)return;
        e.preventDefault();b.setPointerCapture(e.pointerId);pointers.set(e.pointerId,command);
        // Resume the existing Defold-owned context in this trusted DOM gesture;
        // DOM controls do not reach GLFW's canvas-only audio unlock listener.
        const context=window._dmJSDeviceShared?.audioCtx;
        if(context&&context.state!=='running')context.resume()?.catch(()=>{});
        pending.started=true;b.classList.add('held');
      });
      const release=e=>{pointers.delete(e.pointerId);if(![...pointers.values()].includes(command))b.classList.remove('held');};
      for(const name of ['pointerup','pointercancel','lostpointercapture'])b.addEventListener(name,release);
    }
    zones.append(pair);
  }
  root.append(zones);(document.getElementById('app-container')||document.body).append(root);
  // Follow the *rendered* primary toolbar, including wrapping and safe-area insets.
  // Keep the scrollable More menu above the driving targets even on short landscape screens.
  const positionOverlays=()=>{
    const toolbarRect=toolbar.getBoundingClientRect(),rootRect=root.getBoundingClientRect(),zonesRect=zones.getBoundingClientRect();
    const levelActions=document.getElementById('rider-level-actions');
    const levelTop=levelActions?.getClientRects().length?levelActions.getBoundingClientRect().top:Infinity;
    const lowerEdge=Math.min(zonesRect.top,levelTop);
    const raceBottom=raceSummary&&!raceSummary.hidden?raceSummary.getBoundingClientRect().bottom:toolbarRect.bottom;
    const top=Math.ceil(Math.max(toolbarRect.bottom,raceBottom)-rootRect.top+8);
    measure.style.top=top+'px';
    tiltPanel.style.top=top+'px';
    overflow.style.maxHeight=Math.max(44,Math.floor(lowerEdge-toolbarRect.bottom-16))+'px';
  };
  if(window.ResizeObserver)new ResizeObserver(positionOverlays).observe(toolbar);
  window.addEventListener('resize',positionOverlays);
  positionOverlays();
})();
