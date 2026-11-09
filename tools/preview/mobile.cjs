// Actual release engine + browser touch dispatch. Synthetic input is not phone evidence.
const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');
// #440: Quality High/Low (High = High DPI on) is remembered in localStorage and applied
// before the engine creates its back-buffer; ?dpi=0|1 overrides; a bad value means High.
// Own DPR-2 context with fresh storage. Software Chromium: no phone sharpness or frame time.
const QUALITY_KEY='rider-quality-v1';
async function quality(browser,url,sha,out,pass){
  const context=await browser.newContext({viewport:{width:1080,height:486},isMobile:true,hasTouch:true,deviceScaleFactor:2});
  const page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  page.on('console',m=>{if(/ERROR:SCRIPT|ERROR:RESOURCE|ERROR:GAMEOBJECT/.test(m.text()))errors.push(m.text());});
  const more=()=>page.getByRole('button',{name:'More',exact:true});
  const menu=()=>page.locator('#rider-mobile-more');
  const ready=()=>page.waitForFunction(expected=>window.riderReady?.source_sha===expected&&window.riderTelemetry?.sequence>=2&&window.riderMobile?.enabled,sha);
  // The engine's real back-buffer: the WebGL drawing buffer of the canvas it rendered into.
  const observe=()=>page.evaluate(key=>{
    const c=document.querySelector('canvas'),gl=c.getContext('webgl2')||c.getContext('webgl');
    return {devicePixelRatio,css:[innerWidth,innerHeight],canvas:[c.width,c.height],
      buffer:gl?[gl.drawingBufferWidth,gl.drawingBufferHeight]:null,dpr:window.riderViewport?.dpr,
      stored:localStorage.getItem(key),source:window.riderQuality?.source,search:location.search,
      pageButton:document.getElementById('quality')?.textContent};
  },QUALITY_KEY);
  async function expectQuality(high,source,stored,search){
    const scale=high?2:1,s=await observe();
    assert.deepEqual(s,{devicePixelRatio:2,css:[1080,486],canvas:[1080*scale,486*scale],buffer:[1080*scale,486*scale],dpr:scale,
      stored,source,search,pageButton:'Quality: '+(high?'High':'Low')},'Quality '+(high?'High':'Low')+' back-buffer');
    // The touch Menu (More) shows the same choice, and only that one.
    await more().tap();
    assert.equal(await more().getAttribute('aria-expanded'),'true');
    const shown=menu().getByRole('button',{name:'Quality: '+(high?'High':'Low'),exact:true});
    await shown.scrollIntoViewIfNeeded();
    assert.equal(await shown.isVisible(),true,'Menu shows Quality: '+(high?'High':'Low'));
    assert.equal(await menu().getByRole('button',{name:/^(Quality|High DPI)/}).count(),1,'One quality entry in the Menu');
    return shown;
  }
  async function closeMenu(){await more().tap();assert.equal(await more().getAttribute('aria-expanded'),'false');}
  async function tapAndReload(control){
    const loaded=page.waitForEvent('load');
    await control.tap();await loaded;await ready();
  }
  try{
    const launch=new URL(url);launch.search='?touch=1';
    await page.goto(launch.href);await ready();
    const high=await expectQuality(true,'default',null,'?touch=1');
    await tapAndReload(high);
    // Set Low in the Menu -> stored, and the same page reloaded at DPR 1.
    await expectQuality(false,'stored','low','?touch=1');await closeMenu();
    await page.reload();await ready();
    await expectQuality(false,'stored','low','?touch=1');await closeMenu();
    await page.screenshot({path:path.join(out,'mobile-quality-low.png')});
    pass('quality_low_remembered_after_reload');
    // ?dpi=1 overrides the stored Low without changing it.
    const override=new URL(launch.href);override.searchParams.set('dpi','1');
    await page.goto(override.href);await ready();
    const fromOverride=await expectQuality(true,'url','low','?touch=1&dpi=1');
    // The button still switches from an override: Low is stored and ?dpi is dropped.
    await tapAndReload(fromOverride);
    await expectQuality(false,'stored','low','?touch=1');await closeMenu();
    // An invalid stored value falls back to the High default.
    await page.evaluate(key=>localStorage.setItem(key,'banana'),QUALITY_KEY);
    await page.goto(launch.href);await ready();
    await expectQuality(true,'default','banana','?touch=1');await closeMenu();
    pass('quality_dpi_override_and_invalid_value_fallback');
    if(errors.length)throw Error(errors.join('\n'));
  }catch(error){
    await page.screenshot({path:path.join(out,'mobile-quality-failure.png')}).catch(()=>{});
    fs.writeFileSync(path.join(out,'mobile-quality-failure-state.json'),JSON.stringify(await observe().catch(()=>null),null,2));
    throw error;
  }finally{await context.close();}
}
module.exports=async function mobile(browser,url,sha,out){
  const context=await browser.newContext({viewport:{width:1080,height:486},isMobile:true,hasTouch:true});
  const page=await context.newPage(),errors=[],logs=[],cases=[];
  page.on('pageerror',e=>errors.push(e.message));
  page.on('console',m=>{logs.push(m.text());if(/ERROR:SCRIPT|ERROR:RESOURCE|ERROR:GAMEOBJECT/.test(m.text()))errors.push(m.text());});
  const pass=name=>{cases.push(name);console.log('MOBILE_CASE '+name);};
  const session=await context.newCDPSession(page);
  const dispatch=(type,points)=>session.send('Input.dispatchTouchEvent',{type,touchPoints:points});
  const more=()=>page.getByRole('button',{name:'More',exact:true});
  async function openMore(){
    const control=more();
    assert.equal(await control.getAttribute('aria-expanded'),'false','More starts closed');
    await control.tap();
    assert.equal(await control.getAttribute('aria-expanded'),'true','More opens with real touch');
  }
  async function tapSecondary(label){
    await openMore();
    await page.locator('#rider-mobile-more').getByRole('button',{name:label,exact:true}).tap();
    assert.equal(await more().getAttribute('aria-expanded'),'false',label+' closes More');
  }
  const point=async(command,id)=>{
    const box=await page.locator(`[data-command="${command}"]`).boundingBox();
    assert(box&&box.width>=44&&box.height>=44,'Touch zone must be usable');
    return {x:box.x+box.width/2,y:box.y+box.height/2,id};
  };
  const neutral=()=>page.waitForFunction(()=>{
    const c=window.riderTelemetry.command;
    return c.throttle===0&&c.brake_reverse===0&&c.lean===0;
  });
  // #359 (Claudio 2026-11-03): portrait shows no prompt. Only a transparent, text-free,
  // aria-hidden layer remains; the touch HUD is hidden and every former control spot
  // (and the centre) hits that layer, so touch cannot reach the HUD, canvas or editor.
  // Overlays appended to <body> (level actions) sit outside #app-container's stacking context,
  // so they must be hidden too; their spots count here. The play bar, Levels dialog and the
  // import/export/feedback panels live inside #app-container (#678) and are hidden by rules.
  const bodyControls='body>:not(#app-container) :is(button,input,textarea,select,a)';
  async function portraitBlocked(){
    const state=await page.evaluate(selector=>{
      const block=document.getElementById('rider-mobile-portrait-block'),style=getComputedStyle(block);
      const centre=node=>{const r=node.getBoundingClientRect();return r.width&&r.height?[r.x+r.width/2,r.y+r.height/2]:null;};
      const inside=([x,y])=>x>=0&&y>=0&&x<innerWidth&&y<innerHeight;
      // #678: the play bar lives in #app-container like the touch HUD; the portrait block must cover it too.
      const hud=[...document.querySelectorAll('#rider-mobile button,#rider-playbar button')].map(centre).filter(Boolean).filter(inside);
      const body=[...document.querySelectorAll(selector)].map(centre).filter(Boolean).filter(inside);
      const spots=hud.concat(body,[[innerWidth/2,innerHeight/2]]);
      return {text:block.textContent,children:block.childElementCount,role:block.getAttribute('role'),live:block.getAttribute('aria-live'),
        hidden:block.getAttribute('aria-hidden'),background:style.backgroundColor,shown:style.display!=='none',
        bodySpots:body.length,barLevels:[...document.querySelectorAll('#rider-playbar [data-act=levels]')].map(centre).filter(Boolean).filter(inside).length,levelSpots:[...document.querySelectorAll('#rider-level-actions button,#rider-playbar [data-act=levels]')].map(centre).filter(Boolean).filter(inside).length,
        bodyVisible:[...document.querySelectorAll(selector)].filter(n=>n.checkVisibility({visibilityProperty:true})).length,
        spots:spots.length,hits:spots.filter(([x,y])=>document.elementFromPoint(x,y)===block).length,
        prompt:/rotate|landscape only/i.test(document.body.innerText),
        alerts:[...document.querySelectorAll('[role=alert],[aria-live=assertive]')].filter(n=>n.getClientRects().length&&getComputedStyle(n).visibility!=='hidden').length};
    },bodyControls);
    assert.deepEqual({text:state.text,children:state.children,role:state.role,live:state.live,hidden:state.hidden,background:state.background,prompt:state.prompt,alerts:state.alerts},
      {text:'',children:0,role:null,live:null,hidden:'true',background:'rgba(0, 0, 0, 0)',prompt:false,alerts:0},'Portrait shows no rotate prompt or message');
    assert.equal(state.shown,true,'Portrait input block is active');
    assert(state.spots>1,'Former control spots are checked');
    assert.equal(state.hits,state.spots,'Portrait block intercepts touch at the centre and every former control spot');
    assert(state.levelSpots>=1&&state.barLevels>=1,'Levels/Next Level spots are checked (#678: Levels is in the play bar, inside #app-container)');
    assert.equal(state.bodyVisible,0,'No body-level overlay control is visible in portrait');
    for(const name of ['Retry','Pause','Resume','More'])assert.equal(await page.getByRole('button',{name,exact:true}).isVisible(),false,name+' is not offered in portrait');
    for(const command of ['left','right','brake','throttle'])assert.equal(await page.locator(`[data-command="${command}"]`).isVisible(),false,'No portrait drive zone '+command);
    assert.equal(await page.locator('#rider-mobile .zones .held').count(),0,'Rotation releases all held pointers');
  }
  // A real tap where Levels sits must not reach the level menu (it used to open it).
  // Call with no finger held: the tap uses its own touch sequence.
  async function portraitLevelsTapBlocked(){
    const levels=await page.evaluate(()=>{
      let value=window.riderLevelsRequest;window.__levelRequests=[];
      Object.defineProperty(window,'riderLevelsRequest',{configurable:true,get:()=>value,set:next=>{if(next)window.__levelRequests.push(next);value=next;}});
      const r=document.querySelector('#rider-level-actions button').getBoundingClientRect();
      return {x:r.x+r.width/2,y:r.y+r.height/2};
    });
    await dispatch('touchStart',[{x:levels.x,y:levels.y,id:30}]);await dispatch('touchEnd',[]);
    // A click would set the request synchronously; ten frames also cover a delayed click.
    await page.evaluate(()=>new Promise(resolve=>{let frames=0;const next=()=>++frames>=10?resolve():requestAnimationFrame(next);requestAnimationFrame(next);}));
    assert.deepEqual(await page.evaluate(()=>{
      const requests=window.__levelRequests,value=window.riderLevelsRequest;
      delete window.riderLevelsRequest;window.riderLevelsRequest=value;delete window.__levelRequests;
      return {requests,open:!!window.riderLevels?.open};
    }),{requests:[],open:false},'Portrait tap on Levels does not reach the level menu');
  }
  async function layout(){
    for(const command of ['left','right','brake','throttle']){
      const b=await page.locator(`[data-command="${command}"]`).boundingBox();
      assert(b&&b.x>=0&&b.y>=0&&b.x+b.width<=page.viewportSize().width+1&&b.y+b.height<=page.viewportSize().height+1);
    }
  }
  try{
    const launch=new URL(url);launch.search='?touch=1';
    await page.goto(launch.href);
    await page.waitForFunction(expected=>window.riderReady?.source_sha===expected&&window.riderTelemetry?.sequence>=2&&window.riderMobile?.enabled,sha);
    const identity=await page.evaluate(()=>JSON.stringify(window.riderReady));
    await layout();
    const throttle=await point('throttle',1),left=await point('left',2),brake=await point('brake',3);
    await dispatch('touchStart',[throttle,left]);
    await page.waitForFunction(()=>window.riderTelemetry.command.throttle===1&&window.riderTelemetry.command.lean===1&&window.riderTelemetry.speed>25);
    await page.waitForFunction(()=>window._dmJSDeviceShared?.audioCtx?.state==='running');
    pass('simultaneous_drive_lean_audio');
    await dispatch('touchStart',[throttle,left,brake]);
    await page.waitForFunction(()=>{const c=window.riderTelemetry.command;return c.throttle===0&&c.brake_reverse===1&&c.allow_reverse===false;});
    pass('brake_priority');
    await dispatch('touchCancel',[]);await neutral();pass('cancel_neutral');
    // Capture persists outside a button, then releases outside it.
    await dispatch('touchStart',[await point('throttle',1)]);
    await page.waitForFunction(()=>window.riderTelemetry.command.throttle===1);
    await dispatch('touchMove',[{x:540,y:250,id:1}]);
    await page.waitForFunction(()=>window.riderTelemetry.command.throttle===1);
    await dispatch('touchEnd',[]);await neutral();pass('outside_release');
    await dispatch('touchStart',[await point('throttle',1)]);
    await page.waitForFunction(()=>window.riderTelemetry.command.throttle===1);
    const resets=await page.evaluate(()=>window.riderTelemetry.reset_count);
    await page.getByRole('button',{name:'Retry',exact:true}).click();
    await page.waitForFunction(n=>window.riderTelemetry.reset_count===n+1,resets);await neutral();
    await dispatch('touchEnd',[]);pass('same_reset_path_clears_input');
    await page.waitForFunction(()=>!document.querySelector('#rider-mobile .toast').hidden);
    const toast=await page.locator('#rider-mobile .toast').boundingBox(),bar=await page.locator('#rider-playbar .pb-row').boundingBox();
    assert(toast&&bar&&toast.y>=bar.y+bar.height&&toast.x>=0&&toast.x+toast.width<=page.viewportSize().width);
    await page.waitForFunction(()=>document.querySelector('#rider-mobile .toast').hidden,null,{timeout:5000});
    pass('retry_toast_clear_and_expires');
    const loads=await page.evaluate(()=>window.riderTelemetry.world_loads);
    await tapSecondary('Next station');
    await page.waitForFunction(n=>window.riderTelemetry.world_loads===n+1,loads);
    await neutral();await page.waitForFunction(()=>window.riderTelemetry.sequence>2);
    assert.equal(await page.locator('#rider-mobile').count(),1);
    pass('station_switch_fresh_input_single_mobile_surface');
    const before=await point('throttle',1);
    await tapSecondary('Layout A · mirror');
    await page.waitForFunction(()=>window.riderMobile.mirrored);
    const after=await point('throttle',1);assert(after.x<before.x);
    await dispatch('touchStart',[after,await point('right',2)]);
    await page.waitForFunction(()=>window.riderTelemetry.command.throttle===1&&window.riderTelemetry.command.lean===-1);
    // Resize within supported mobile landscape, retaining held-input cancellation.
    await page.setViewportSize({width:960,height:540});await neutral();await dispatch('touchEnd',[]);
    await layout();await page.screenshot({path:path.join(out,'mobile-compact-landscape.png')});
    await page.setViewportSize({width:1080,height:486});await layout();
    assert.equal(await page.evaluate(()=>JSON.stringify(window.riderReady)),identity);
    pass('mirrored_drive_rotation_no_reload');
    // Unsupported portrait must cancel a held real pointer and suspend through the
    // existing loader path, without resetting/replaying or auto-resuming on rotation.
    const beforePortrait=await page.evaluate(()=>({
      resets:window.riderTelemetry.reset_count,loads:window.riderTelemetry.world_loads,
      source:window.riderReady.source_sha
    }));
    await dispatch('touchStart',[await point('throttle',1)]);
    await page.waitForFunction(()=>window.riderTelemetry.command.throttle===1);
    await page.setViewportSize({width:486,height:1080});
    await page.waitForFunction(()=>window.riderMobile.blocked&&window.riderTimeState?.paused);
    const blocker=page.locator('#rider-mobile-portrait-block');
    await portraitBlocked();
    await dispatch('touchEnd',[]);
    await portraitLevelsTapBlocked();
    await dispatch('touchStart',[{x:243,y:700,id:8}]);await dispatch('touchEnd',[]);
    await page.keyboard.press('1');
    assert.equal(await page.evaluate(()=>window.riderTelemetry.world_loads),beforePortrait.loads,'Portrait keyboard cannot switch station');
    assert.equal(await page.evaluate(()=>window.riderTimeState.paused),true,'Portrait touch cannot resume gameplay');
    await page.evaluate(()=>{window.__testAngle=180;Object.defineProperty(screen.orientation,'angle',{configurable:true,get:()=>window.__testAngle});window.dispatchEvent(new Event('orientationchange'));});
    assert.equal(await page.evaluate(()=>window.riderMobile.blocked),true,'Portrait at 180 degrees remains blocked');
    await page.setViewportSize({width:960,height:540});
    await page.evaluate(()=>{window.__testAngle=90;window.dispatchEvent(new Event('orientationchange'));});
    await page.waitForFunction(()=>!window.riderMobile.blocked);
    assert.equal(await blocker.isHidden(),true);
    for(const command of ['left','right','brake','throttle'])assert.equal(await page.locator(`[data-command="${command}"]`).isVisible(),true,'Landscape restores drive zone '+command);
    assert.equal(await page.evaluate(()=>window.riderTimeState.paused),true,'Landscape return must not auto-resume');
    assert.deepEqual(await page.evaluate(()=>({
      resets:window.riderTelemetry.reset_count,loads:window.riderTelemetry.world_loads,
      source:window.riderReady.source_sha
    })),beforePortrait,'Orientation cannot reset, reload or replace build');
    await page.getByRole('button',{name:'Resume',exact:true}).tap();
    await page.waitForFunction(()=>window.riderTimeState?.paused===false);
    await neutral();
    // Landscape → portrait → landscape before the next input poll must still suspend once.
    await page.evaluate(()=>{
      const width=innerWidth,height=innerHeight,saved={};
      for(const [key,value] of [['innerWidth',height],['innerHeight',width]]){
        saved[key]=Object.getOwnPropertyDescriptor(window,key);
        Object.defineProperty(window,key,{configurable:true,get:()=>value});
      }
      window.dispatchEvent(new Event('resize'));
      for(const key of Object.keys(saved)){if(saved[key])Object.defineProperty(window,key,saved[key]);else delete window[key];}
      if(innerWidth!==width||innerHeight!==height)throw Error('viewport override not restored');
      window.dispatchEvent(new Event('resize'));
    });
    await page.waitForFunction(()=>window.riderTimeState?.paused===true&&!window.riderMobile.blocked);
    await page.getByRole('button',{name:'Resume',exact:true}).tap();
    await page.waitForFunction(()=>window.riderTimeState?.paused===false);
    await neutral();
    for(const [viewport,angle] of [[{width:1080,height:486},270],[{width:896,height:400},90]]){
      await page.setViewportSize(viewport);
      await page.evaluate(value=>{window.__testAngle=value;window.dispatchEvent(new Event('orientationchange'));},angle);
      await page.waitForFunction(()=>!window.riderMobile.blocked);
      await layout();
      await dispatch('touchStart',[await point('throttle',1)]);
      await page.waitForFunction(()=>window.riderTelemetry.command.throttle===1);
      // A 90↔270 flip can leave viewport dimensions unchanged; it must still cancel.
      await page.evaluate(value=>{window.__testAngle=value;window.dispatchEvent(new Event('orientationchange'));},angle===270?90:270);
      await neutral();
      assert.equal(await page.locator('#rider-mobile .zones .held').count(),0);
      await dispatch('touchEnd',[]);
    }
    const resetAfterOrientation=await page.evaluate(()=>window.riderTelemetry.reset_count);
    await page.getByRole('button',{name:'Retry',exact:true}).tap();
    await page.waitForFunction(n=>window.riderTelemetry.reset_count===n+1,resetAfterOrientation);
    await neutral();
    await page.setViewportSize({width:1080,height:486});await layout();
    pass('portrait_held_input_suspend_no_auto_resume_and_both_landscape_sides');
    // Closing tuning with another pointer must release an active editor drag.
    const editorSequence=await page.evaluate(()=>window.riderTelemetry.sequence);
    await page.getByRole('button',{name:'Tuning',exact:true}).click();
    await page.waitForFunction(n=>window.riderCompact===false&&window.riderTelemetry.sequence>n+1,editorSequence);
    const editorPoint=await page.evaluate(()=>{
      const c=document.querySelector('canvas'),r=c.getBoundingClientRect(),row=window.riderControls[0];
      return {x:(row.left.x+row.right.x)*.5/c.width*r.width,y:(1-row.left.y/c.height)*r.height};
    });
    await page.mouse.move(editorPoint.x,editorPoint.y);await page.mouse.down();
    await page.waitForFunction(()=>window.riderDragging&&window.riderTelemetry.ui_captured);
    const close=await page.getByRole('button',{name:'Close tuning',exact:true}).boundingBox();
    await dispatch('touchStart',[{x:close.x+close.width/2,y:close.y+close.height/2,id:10}]);
    await dispatch('touchEnd',[]);
    await page.waitForFunction(()=>window.riderCompact===true&&!window.riderDragging&&!window.riderTelemetry.ui_captured);
    await page.mouse.up();
    await dispatch('touchStart',[await point('throttle',1)]);
    await page.waitForFunction(()=>window.riderTelemetry.command.throttle===1);
    await dispatch('touchEnd',[]);await neutral();pass('closing_editor_releases_capture');
    // A real 30-second capture exercises bounded collection and source metadata.
    await tapSecondary('Measure');
    await page.getByRole('combobox').selectOption({label:'60 Hz'});
    await page.getByRole('button',{name:'Record 30 s',exact:true}).click();
    await page.waitForFunction(()=>window.riderMobile.recording===true);
    await dispatch('touchStart',[await point('throttle',1)]);
    await page.waitForFunction(()=>window.riderMobile.report!==null,null,{timeout:40000});
    await dispatch('touchEnd',[]);await neutral();
    const capture=await page.evaluate(()=>window.riderMobile.snapshot());
    assert.equal(capture.capture.source,sha);assert.equal(capture.capture.refreshModeUserSelected,'60 Hz');
    assert(capture.capture.durationSeconds>=30&&capture.capture.engineCallbackIntervalMs.samples>100);
    fs.writeFileSync(path.join(out,'mobile-capture.json'),JSON.stringify(capture,null,2));
    pass('capture_30s_identity_and_samples');
    // An interrupted capture must not silently include background time.
    await page.getByRole('button',{name:'Record 30 s',exact:true}).click();
    await page.waitForFunction(()=>window.riderMobile.recording);
    await page.evaluate(()=>window.dispatchEvent(new Event('blur')));
    await page.waitForFunction(()=>!window.riderMobile.recording);assert.equal(await page.evaluate(()=>window.riderMobile.report),null);
    // Focus loss must suspend the actual Defold world, not only cancel browser capture.
    await page.waitForFunction(()=>window.riderTimeState?.paused===true);
    pass('interrupted_capture_cancelled');
    await page.evaluate(()=>{navigator.clipboard.writeText=()=>Promise.reject(new DOMException('Injected denial','NotAllowedError'));});
    await tapSecondary('Copy report');
    await page.waitForFunction(()=>window.riderFeedback.visible);
    assert((await page.locator('#rider-feedback-text').inputValue()).includes('## Mobile trial'));
    assert((await page.locator('#rider-feedback-text').inputValue()).includes(sha));
    await page.getByRole('button',{name:'Close',exact:true}).click();
    await page.waitForFunction(()=>!window.riderFeedback.visible&&!window.riderTelemetry.ui_captured);
    pass('mobile_report_fallback');
    // The new all-play-world focus-loss guard correctly leaves the game paused.
    // Resume explicitly through real touch before testing drivable fullscreen transitions.
    assert.equal(await page.evaluate(()=>window.riderTimeState?.paused),true,'Feedback must not auto-resume after focus loss');
    await page.getByRole('button',{name:'Resume',exact:true}).tap();
    await page.waitForFunction(()=>window.riderTimeState?.paused===false);
    await neutral();
    assert.equal(await page.locator('#app-container #rider-mobile').count(),1);
    async function settledViewport(){
      // fullscreenElement changes before the asynchronous viewport/input
      // transition has necessarily reached the engine. Resize clears held input.
      const sequence=await page.evaluate(()=>window.riderTelemetry.sequence);
      await page.waitForFunction(n=>window.riderTelemetry.sequence>n+1&&
        window.riderViewport.width===innerWidth&&window.riderViewport.height===innerHeight,sequence);
      await neutral();await layout();
    }
    // #359: entering fullscreen requests a landscape lock; a refusal stays silent.
    // The stub rejects like a browser without lock support (W3C Screen Orientation §5.2).
    await page.evaluate(()=>{
      window.__lockCalls=[];window.__lockUnhandled=0;
      window.addEventListener('unhandledrejection',()=>{window.__lockUnhandled++;});
      Object.defineProperty(screen.orientation,'lock',{configurable:true,value:type=>{
        window.__lockCalls.push({type,fullscreen:document.fullscreenElement!==null});
        return Promise.reject(new DOMException('Injected lock refusal','NotSupportedError'));
      }});
    });
    for(let transition=0;transition<3;transition++){
      await tapSecondary('Fullscreen');
      await page.waitForFunction(()=>document.fullscreenElement!==null);
      await page.waitForFunction(n=>window.__lockCalls.length===n+1,transition);
      await settledViewport();
      await dispatch('touchStart',[await point('throttle',1)]);
      await page.waitForFunction(()=>window.riderTelemetry.command.throttle===1);
      await dispatch('touchEnd',[]);await neutral();
      await page.evaluate(()=>document.exitFullscreen());
      await page.waitForFunction(()=>document.fullscreenElement===null);
      await settledViewport();
    }
    assert.deepEqual(await page.evaluate(()=>window.__lockCalls),Array(3).fill({type:'landscape',fullscreen:true}),'Each fullscreen entry, and only entry, requests a landscape lock');
    assert.equal(await page.evaluate(()=>window.__lockUnhandled),0,'A refused lock is swallowed');
    assert.equal(await page.evaluate(()=>/rotate|orientation|lock/i.test(document.body.innerText)),false,'A refused lock shows no message');
    assert.equal(await page.evaluate(()=>JSON.stringify(window.riderReady)),identity);
    pass('fullscreen_controls_remain_drivable_and_landscape_lock_requested');
    await page.screenshot({path:path.join(out,'mobile-landscape.png')});
    // The page tools are hidden in touch mode; the toolbar opens the same LE1a import panel.
    // Imports: from a built-in station, with a saved level, and after a reload of ?station=custom
    // (the saved level restores and the panel no longer opens by itself, as on the phone).
    const sample=name=>path.join(__dirname,'../../main/gym/samples',name+'.json');
    const importButton=()=>page.locator('#rider-mobile-more').getByRole('button',{name:'Import level',exact:true}).filter({visible:true});
    for(const [step,name] of [[0,'rolling-hills'],[1,'kicker-platform'],[2,'rolling-hills']]){
      if(step===2){
        const custom=new URL(url);custom.search='?station=custom&touch=1';
        await page.goto(custom.href);
        await page.waitForFunction(()=>window.riderTelemetry?.station==='kicker-platform'&&window.riderTelemetry.sequence>=2&&!window.riderCustom.visible);
      }
      await openMore();
      assert.equal(await importButton().count(),1,'One visible touch import entry');
      const box=await importButton().boundingBox();
      assert(box&&box.x>=0&&box.y>=0&&box.x+box.width<=page.viewportSize().width&&box.height>=32,'Touch import entry must be usable');
      if(step<2){
        // A single-finger tap on the entry opens the panel and captures input.
        await dispatch('touchStart',[{x:box.x+box.width/2,y:box.y+box.height/2,id:20}]);await dispatch('touchEnd',[]);
        await page.waitForFunction(()=>window.riderCustom.visible&&window.riderTelemetry.ui_captured);
      }else{
        // Browsers synthesize no click for a second finger; like Retry above, click while throttle is held:
        // the panel clears the held command.
        await dispatch('touchStart',[await point('throttle',1)]);
        await page.waitForFunction(()=>window.riderTelemetry.command.throttle===1);
        assert.equal(await more().getAttribute('aria-expanded'),'true','Drive-zone touch keeps More open for a second pointer');
        assert.equal(await importButton().isVisible(),true,'Import stays visible while throttle is held');
        await importButton().click();
        await page.waitForFunction(()=>window.riderCustom.visible&&window.riderTelemetry.ui_captured&&window.riderTelemetry.command.throttle===0);
        await dispatch('touchEnd',[]);
      }
      assert.equal(await more().getAttribute('aria-expanded'),'false','Import level closes More');
      const panel=await page.locator('#rider-custom-panel').boundingBox();
      assert(panel&&panel.x>=0&&panel.y>=0&&panel.x+panel.width<=page.viewportSize().width+1&&panel.y+panel.height<=page.viewportSize().height+1,'Import panel must fit the viewport');
      await page.locator('#rider-custom-file').setInputFiles(sample(name));
      await page.waitForFunction(id=>!window.riderCustom.visible&&window.riderTelemetry?.station===id&&window.riderTelemetry.custom&&window.riderCustomStatus==='Saved'&&!window.riderTelemetry.ui_captured,name,{timeout:30000});
      await neutral();
      await dispatch('touchStart',[await point('throttle',1)]);
      await page.waitForFunction(()=>window.riderTelemetry.command.throttle===1);
      await dispatch('touchEnd',[]);await neutral();
    }
    assert((await page.evaluate(()=>window.riderFeedback.text)).includes('- Level load: switch '));
    await page.screenshot({path:path.join(out,'mobile-import.png')});
    // Compact landscape: touch-opened Import stays on screen and above the drive zones.
    await page.setViewportSize({width:960,height:540});await neutral();await layout();
    await openMore();
    const compact=await importButton().boundingBox(),zone=await page.locator('[data-command="throttle"]').boundingBox();
    assert(compact&&zone&&compact.width>=44&&compact.height>=44&&compact.x>=0&&compact.y>=0&&compact.x+compact.width<=960&&compact.y+compact.height<=zone.y,'Compact landscape import entry must stay usable');
    await page.screenshot({path:path.join(out,'mobile-import-compact-landscape.png')});
    await more().tap();
    assert.equal(await more().getAttribute('aria-expanded'),'false','More closes with real touch');
    await page.setViewportSize({width:1080,height:486});await layout();
    pass('touch_import_entry_with_saved_level');
    // Initial portrait load is blocked as well, not only a landscape-to-portrait resize.
    await page.setViewportSize({width:400,height:896});
    await page.goto(launch.href);
    await page.waitForFunction(expected=>window.riderReady?.source_sha===expected&&window.riderMobile?.blocked,sha);
    await portraitBlocked();
    await portraitLevelsTapBlocked();
    // Body-level overlays come back unchanged in landscape: an open Import panel is hidden in
    // portrait (its controls are blocked) and still open afterwards; Levels works again.
    await page.setViewportSize({width:1080,height:486});
    await page.waitForFunction(()=>!window.riderMobile.blocked);await layout();
    await tapSecondary('Import level');
    await page.waitForFunction(()=>window.riderCustom.visible);
    await page.locator('#rider-custom-text').fill('{"kept":true}');
    await page.setViewportSize({width:486,height:1080});
    await page.waitForFunction(()=>window.riderMobile.blocked);
    assert.equal(await page.locator('#rider-custom-panel').isVisible(),false,'Import panel is hidden in portrait');
    await portraitBlocked();
    await page.setViewportSize({width:1080,height:486});
    await page.waitForFunction(()=>!window.riderMobile.blocked);
    assert.equal(await page.locator('#rider-custom-panel').isVisible(),true,'Import panel returns in landscape');
    assert.equal(await page.locator('#rider-custom-text').inputValue(),'{"kept":true}','Import panel keeps its state');
    await page.getByRole('button',{name:'Close import',exact:true}).tap();
    await page.waitForFunction(()=>!window.riderCustom.visible);
    await page.locator('#rider-playbar').getByRole('button',{name:'Levels',exact:true}).tap();
    await page.waitForFunction(()=>window.riderLevels?.open&&!document.getElementById('rider-levels').hidden);
    await page.getByRole('button',{name:'Back',exact:true}).tap();
    await page.waitForFunction(()=>!window.riderLevels.open&&document.getElementById('rider-levels').hidden);
    pass('portrait_initial_load_blocked_body_overlays_restored');
    await quality(browser,url,sha,out,pass);
    if(errors.length)throw Error(errors.join('\n'));
    return {name:'mobile-touch-emulation',status:'PASS',cases,physicalDevice:'NOT RUN'};
  }catch(error){
    await page.screenshot({path:path.join(out,'mobile-failure.png')}).catch(()=>{});
    fs.writeFileSync(path.join(out,'mobile-failure-state.json'),JSON.stringify(await page.evaluate(()=>({input:window.riderMobile?.snapshot(),telemetry:window.riderTelemetry})).catch(()=>null),null,2));
    throw error;
  }finally{
    fs.writeFileSync(path.join(out,'mobile.log'),logs.join('\n'));await context.close();
  }
};
