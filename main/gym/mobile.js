// HTML5 input adapter. All vehicle writes remain in the fixed Lua owner.
(() => {
  if (window.riderMobile) return;
  const forced=new URLSearchParams(location.search).get('touch');
  const enabled=forced==='1'||(forced!=='0'&&navigator.maxTouchPoints>0);
  const pointers=new Map(),pending={};
  const api=window.riderMobile={enabled,mirrored:false,details:false,report:null,recording:false};
  let root,zones,status,hud,tiltHud,tiltPanel,measure,lastFrame,trial,lastSequence,toastNode;
  let browserIdentity={userAgent:navigator.userAgent};
  navigator.userAgentData?.getHighEntropyValues?.(['fullVersionList','platformVersion'])
    .then(value=>{browserIdentity={...browserIdentity,...value};}).catch(()=>{});
  api.cancel=()=>{api.clear();for(const key of Object.keys(pending))delete pending[key];lastSequence=undefined;lastFrame=undefined;if(trial){trial=null;api.recording=false;status.textContent="Capture cancelled: station switched";}};
  api.clear=(preserveTilt=false)=>{
    if(!preserveTilt)window.riderTilt?.pause("Input cleared — calibrate to resume");
    pointers.clear();
    root?.querySelectorAll('[data-command]').forEach(b=>b.classList.remove('held'));
  };
  const abort=reason=>{
    api.clear();pending.clear=true;lastFrame=undefined;
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
    if(enabled&&data&&data.sequence!==lastSequence){
      lastSequence=data.sequence;
      hud.textContent=data.station_result?`${data.station_name} · start ${data.start_speed.toFixed(1)} m/s · ${data.station_result}`:`${data.station_name||'Straight'} · start ${(data.start_speed||0).toFixed(1)} m/s · x ${(data.station_distance||0).toFixed(1)} m · top ${(data.station_top_speed||0).toFixed(1)} m/s · brake ${(data.station_brake_distance||0).toFixed(1)} m${window.riderStationError?' · '+window.riderStationError:data.station_note?' · '+data.station_note:''}`;
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
    #rider-mobile .toolbar button{min-height:32px;font-size:12px;padding:4px 7px}
    #rider-mobile button.held{background:#277b67}
    #rider-mobile .toolbar{position:absolute;top:max(6px,env(safe-area-inset-top));left:240px;right:max(8px,env(safe-area-inset-right));display:flex;justify-content:flex-end;flex-wrap:wrap;gap:4px;align-items:center}
    #rider-mobile .zones{position:absolute;bottom:max(8px,env(safe-area-inset-bottom));left:max(8px,env(safe-area-inset-left));right:max(8px,env(safe-area-inset-right));display:flex;justify-content:space-between;gap:24px}
    #rider-mobile .pair{display:flex;gap:8px}
    #rider-mobile .zones button{width:clamp(62px,12vw,130px);height:clamp(64px,18vh,100px);font-weight:bold;background:#142e38ce}
    #rider-mobile .zones button.held{background:#277b67}
    #rider-mobile .readout{position:absolute;right:10px;top:100px;max-width:calc(100% - 230px);background:#10252bdb;padding:5px;pointer-events:none;font-size:12px}
    #rider-mobile .toast{position:absolute;top:56px;left:50%;transform:translateX(-50%);max-width:calc(100% - 32px);padding:6px 12px;background:#10252bf0;border-radius:6px;text-align:center;pointer-events:none}
    #rider-mobile .toast[hidden]{display:none}
    #rider-mobile .measure,#rider-mobile .tilt-panel{display:none;position:absolute;top:114px;left:10px;right:10px;gap:5px;align-items:center;flex-wrap:wrap}
    #rider-mobile .measure.open,#rider-mobile .tilt-panel.open{display:flex}
    #rider-mobile .tilt-panel{background:#10252bf5;padding:8px;border-radius:8px;max-width:620px}
    #rider-mobile .tilt-panel label{pointer-events:auto;display:flex;align-items:center;gap:8px}
    #rider-mobile .tilt-panel input{pointer-events:auto;min-height:32px;width:110px;touch-action:pan-x}
    #rider-mobile.editing .toolbar button:not([data-tuning]){display:none}
    #rider-mobile.editing .zones{display:none}
    #rider-mobile.editing .readout{display:none}
    #rider-mobile.editing .measure,#rider-mobile.editing .tilt-panel{display:none}
    #app-container.mobile-driving #page-tools{display:none}
    @media (orientation:portrait){#rider-mobile .toast{top:196px}#rider-mobile .toolbar{left:220px}#rider-mobile .readout{top:160px}#rider-mobile .measure,#rider-mobile .tilt-panel{top:182px}#rider-mobile .zones{gap:8px}#rider-mobile .pair{gap:4px}#rider-mobile .zones button{width:20vw;font-size:12px}}
  `;
  document.head.append(style);
  document.getElementById('app-container')?.classList.add('mobile-driving');
  root=document.createElement('section');root.id='rider-mobile';
  const toolbar=document.createElement('div');toolbar.className='toolbar';
  function button(label,parent,click){
    const b=document.createElement('button');b.type='button';b.textContent=label;
    if(click)b.addEventListener('click',()=>{api.clear(true);pending.clear=true;click(b);document.querySelector('canvas')?.focus();});
    b.addEventListener('contextmenu',e=>e.preventDefault());parent.append(b);return b;
  }
  button('Retry',toolbar,()=>{pending.retry=true;});
  button('Next station',toolbar,()=>{
    const ids=api.stations||['straight'];const index=ids.indexOf(window.riderTelemetry?.station);
    pending.station=ids[(index+1)%ids.length];
  });
  api.sectionButton=button('Next section',toolbar,()=>{pending.next_section=true;});api.sectionButton.hidden=true;
  // A20: the same pause and slow-motion requests as Space and X; the loader owns the time step.
  const pauseButton=button('Pause',toolbar,()=>{pending.pause=true;});
  const speedButton=button('Speed 1x',toolbar,()=>{pending.time_step=true;});
  api.setTime=(paused,step)=>{pauseButton.textContent=paused?'Resume':'Pause';speedButton.textContent='Speed '+step+'x';};
  // A21: the same record and replay requests as B and G; the Lua tick owner records and replays.
  button('Record run',toolbar,()=>{pending.record=true;});
  button('Replay run',toolbar,()=>{pending.replay=true;});
  // Same LE1a panel as the hidden page button; it keeps focus instead of returning it to the canvas.
  button('Import level',toolbar).addEventListener('click',()=>{api.clear(true);pending.clear=true;window.riderCustom?.open();});
  button('Layout A · mirror',toolbar,b=>{
    api.mirrored=!api.mirrored;zones.style.flexDirection=api.mirrored?'row-reverse':'row';
    b.textContent=api.mirrored?'Layout B · mirror':'Layout A · mirror';abort('layout changed');
  });
  const tuningButton=button('Tuning',toolbar,()=>api.toggleDetails());tuningButton.dataset.tuning='';
  api.toggleDetails=()=>{abort('tuning changed');api.details=!api.details;root.classList.toggle('editing',api.details);tuningButton.textContent=api.details?'Close tuning':'Tuning';};
  button('Measure',toolbar,()=>{tiltPanel.classList.remove('open');measure.classList.toggle('open');});
  button('Tilt',toolbar,()=>{measure.classList.remove('open');tiltPanel.classList.toggle('open');});
  button('Copy report',toolbar,()=>{window.riderFeedback?.copy();});
  button(document.getElementById('quality')?.textContent||'High DPI',toolbar,()=>document.getElementById('quality')?.click());
  button('Fullscreen',toolbar,()=>document.getElementById('fullscreen')?.click());
  root.append(toolbar);
  const readout=document.createElement('div');readout.className='readout';
  hud=document.createElement('div');hud.textContent='Waiting for vehicle';
  status=document.createElement('div');status.textContent='';
  tiltHud=document.createElement('div');tiltHud.textContent='Tilt OFF — touch controls available';
  const replayHud=document.createElement('div');replayHud.dataset.replay='';
  api.setReplay=text=>{replayHud.textContent=text;};
  readout.append(hud,status,tiltHud,replayHud);root.append(readout);
  toastNode=document.createElement('div');toastNode.className='toast';toastNode.hidden=true;root.append(toastNode);
  api.toast=message=>{
    toastNode.textContent=message;toastNode.hidden=false;
    toastNode.style.top=Math.max(toolbar.getBoundingClientRect().bottom+8,matchMedia('(orientation:portrait)').matches?196:56)+'px';
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
})();
