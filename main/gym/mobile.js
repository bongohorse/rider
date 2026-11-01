// HTML5 input adapter. All vehicle writes remain in the fixed Lua owner.
(() => {
  if (window.riderMobile) return;
  const forced=new URLSearchParams(location.search).get('touch');
  const enabled=forced==='1'||(forced!=='0'&&navigator.maxTouchPoints>0);
  const pointers=new Map(),pending={};
  const api=window.riderMobile={enabled,mirrored:false,details:false,report:null,recording:false,blocked:false};
  let root,zones,status,hud,tiltHud,tiltPanel,measure,lastFrame,trial,lastSequence,toastNode,progressNodes,coinHud,fuelHud,fuelBar,mechanismHud;
  let browserIdentity={userAgent:navigator.userAgent};
  navigator.userAgentData?.getHighEntropyValues?.(['fullVersionList','platformVersion'])
    .then(value=>{browserIdentity={...browserIdentity,...value};}).catch(()=>{});
  api.cancel=()=>{api.closeMore?.();api.clear();for(const key of Object.keys(pending))delete pending[key];lastSequence=undefined;lastFrame=undefined;if(trial){trial=null;api.recording=false;status.textContent="Capture cancelled: station switched";}if(api.blocked){pending.clear=true;pending.background=true;}};
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
  window.addEventListener('resize',()=>{abort('viewport changed; restart capture');if(enabled)syncOrientation();});
  function summary(values){
    const sorted=[...values].sort((a,b)=>a-b);
    return {samples:sorted.length,mean:values.reduce((a,b)=>a+b,0)/values.length,
      p95:sorted[Math.ceil(sorted.length*.95)-1],max:sorted.at(-1)};
  }
  api.snapshot=()=>({source:window.riderBuild,browser:browserIdentity,layout:api.mirrored?'B':'A',
    viewport:window.riderViewport,recording:api.recording,capture:api.report,blocked:api.blocked,
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
    }else if(enabled&&data&&data.sequence!==lastSequence){
      lastSequence=data.sequence;
      hud.textContent=data.station_result?`${data.station_name} · start ${data.start_speed.toFixed(1)} m/s · ${data.station_result}`:`${data.station_name||'Straight'} · start ${(data.start_speed||0).toFixed(1)} m/s · x ${(data.station_distance||0).toFixed(1)} m · top ${(data.station_top_speed||0).toFixed(1)} m/s · brake ${(data.station_brake_distance||0).toFixed(1)} m${window.riderStationError?' · '+window.riderStationError:data.station_note?' · '+data.station_note:''}`;
    }
    if(enabled&&mechanismHud){const m=window.riderMechanisms;mechanismHud.hidden=!m;if(m)mechanismHud.textContent='Plates '+m.plates.filter(p=>p.active).length+'/'+m.plates.length+' active · Gate '+(m.gates[0]?.state||'none')+(m.plates.some(p=>p.mode==='pulse'&&p.pressed&&!p.active)?' · Release to rearm':'');}
    if(enabled&&fuelHud){const f=window.riderFuel;fuelHud.hidden=!f;fuelBar.hidden=!f;if(f){fuelHud.textContent=f.text+' · Refills '+f.collected;fuelBar.value=f.amount;fuelBar.style.accentColor=f.low?'#ffac40':'#59d4a5';} }
    if(enabled&&coinHud){
      const c=window.riderCoins;coinHud.hidden=!c;
      if(c)coinHud.textContent=`Coins ${c.count}/${c.total}${c.flash?' · +'+c.flash:''} · Bank ${c.bank}${c.gem_total?' · Gems '+c.gems+'/'+c.gem_total+' · Earned '+c.gem_earned+'/'+c.gem_total+' · Gem bank '+c.gem_bank:''}${c.practice?' · Practice':''}${c.save==='saved'?'':' · '+c.save}`;
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
    // Portrait is not a playable mobile mode. Deliver only the one-shot clear/focus-loss
    // request to the existing Lua loader, never held input or pending gameplay actions.
    if(api.blocked){
      const state={throttle:false,brake:false,left:false,right:false,tilt:0,
        clear:!!pending.clear,background:!!pending.background};
      for(const key of Object.keys(pending))delete pending[key];
      return JSON.stringify(state);
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
    #rider-mobile-rotate{position:fixed;inset:0;z-index:2147483647;display:flex;align-items:center;justify-content:center;box-sizing:border-box;padding:24px;background:#101820;color:#fff;text-align:center;font:600 20px system-ui;pointer-events:auto;touch-action:none}
    #rider-mobile-rotate[hidden]{display:none}
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
  // Primary controls remain directly touchable; all existing secondary actions live in More.
  button('Retry',toolbar,()=>{pending.retry=true;});
  const pauseButton=button('Pause',toolbar,()=>{pending.pause=true;});
  const tuningButton=button('Tuning',toolbar,()=>api.toggleDetails());tuningButton.dataset.tuning='';
  const moreButton=button('More',toolbar,()=>{
    const opening=overflow.hidden;
    if(opening){measure?.classList.remove('open');tiltPanel?.classList.remove('open');}
    overflow.hidden=!opening;moreButton.setAttribute('aria-expanded',String(opening));
  });
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
    pauseButton.textContent=terminal?(run.state==='finished'?'Finished':'Attempt ended'):api.paused?'Resume':'Pause';
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
  api.toggleDetails=()=>{abort('tuning changed');api.details=!api.details;root.classList.toggle('editing',api.details);tuningButton.textContent=api.details?'Close tuning':'Tuning';};
  button('Measure',overflow,()=>{tiltPanel.classList.remove('open');measure.classList.toggle('open');});
  button('Tilt',overflow,()=>{measure.classList.remove('open');tiltPanel.classList.toggle('open');});
  button('Copy report',overflow,()=>{window.riderFeedback?.copy();});
  button(document.getElementById('quality')?.textContent||'High DPI',overflow,()=>document.getElementById('quality')?.click());
  button('Fullscreen',overflow,()=>document.getElementById('fullscreen')?.click());
  toolbar.append(overflow);
  root.addEventListener('pointerdown',e=>{
    // A held drive pointer must not hide the secondary action before a second pointer can select it.
    // The selected action is responsible for cancelling held input (e.g. Import).
    if(!overflow.hidden&&!overflow.contains(e.target)&&e.target!==moreButton&&!zones.contains(e.target))closeOverflow();
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
  const start=document.createElement('span'),finish=document.createElement('span'),value=document.createElement('span'),reason=document.createElement('span');start.textContent='Start';finish.textContent='Finish';
  const track=document.createElement('div'),car=document.createElement('div');track.className='progress-track';car.className='progress-car';track.append(car);
  progress.append(start,track,finish,value,reason);progressNodes={root:progress,start,finish,value,reason,track,car};
  mechanismHud=document.createElement('div');mechanismHud.className='mechanism-status';mechanismHud.hidden=true;readout.append(mechanismHud);
  coinHud=document.createElement('div');coinHud.className='coin-count';coinHud.hidden=true;
  fuelHud=document.createElement('div');fuelHud.className='fuel-count';fuelHud.hidden=true;
  fuelBar=document.createElement('progress');fuelBar.className='fuel-bar';fuelBar.max=100;fuelBar.hidden=true;fuelBar.setAttribute('aria-label','Fuel');fuelBar.style.cssText='width:100%;height:6px';
  readout.append(hud,coinHud,fuelHud,fuelBar,progress,status,tiltHud,replayHud);root.append(readout);
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
    const top=Math.ceil(toolbarRect.bottom-rootRect.top+8);
    readout.style.top=top+'px';
    measure.style.top=top+'px';
    tiltPanel.style.top=top+'px';
    readout.style.maxHeight=Math.max(0,Math.floor(lowerEdge-rootRect.top-top-8))+'px';
    readout.style.overflowY='hidden';
    overflow.style.maxHeight=Math.max(44,Math.floor(lowerEdge-toolbarRect.bottom-16))+'px';
  };
  if(window.ResizeObserver)new ResizeObserver(positionOverlays).observe(toolbar);
  window.addEventListener('resize',positionOverlays);
  positionOverlays();
  // The overlay is deliberately outside the HUD so it also blocks canvas/editor taps.
  // The loader already implements an idempotent 'run_focus_lost' suspend; reuse it
  // instead of toggling pause or introducing a second physics/time-step owner.
  const rotate=document.createElement('div');
  rotate.id='rider-mobile-rotate';rotate.hidden=true;rotate.tabIndex=-1;
  rotate.setAttribute('role','alert');rotate.setAttribute('aria-live','assertive');
  rotate.textContent='Rotate your device — Rider is landscape only';
  (document.getElementById('app-container')||document.body).append(rotate);
  function syncOrientation(){
    const portrait=window.innerHeight>window.innerWidth;
    if(portrait===api.blocked)return;
    api.blocked=portrait;
    abort(portrait?'portrait orientation':'landscape orientation');
    // Discard any queued Retry/Replay/station commands from before the transition.
    for(const key of Object.keys(pending))delete pending[key];
    pending.clear=true;
    if(portrait)pending.background=true;
    rotate.hidden=!portrait;
    if(portrait){
      document.activeElement?.blur?.();rotate.focus({preventScroll:true});
    }else document.querySelector('canvas')?.focus();
  }
  // Do not allow keyboard gameplay shortcuts to bypass the portrait touch blocker.
  for(const type of ['keydown','keyup'])window.addEventListener(type,e=>{
    if(api.blocked){e.preventDefault();e.stopImmediatePropagation();}
  },true);
  // Landscape 90↔270 can keep the same viewport dimensions: still release
  // pointers and tilt so the opposite side never inherits held controls.
  const orientationChanged=()=>{abort('orientation changed');syncOrientation();};
  window.addEventListener('orientationchange',orientationChanged);
  screen.orientation?.addEventListener?.('change',orientationChanged);
  syncOrientation();
})();
