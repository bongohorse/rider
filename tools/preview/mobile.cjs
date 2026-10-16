// Actual release engine + browser touch dispatch. Synthetic input is not phone evidence.
const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');
module.exports=async function mobile(browser,url,sha,out){
  const context=await browser.newContext({viewport:{width:1080,height:486},isMobile:true,hasTouch:true});
  const page=await context.newPage(),errors=[],logs=[],cases=[];
  page.on('pageerror',e=>errors.push(e.message));
  page.on('console',m=>{logs.push(m.text());if(/ERROR:SCRIPT|ERROR:RESOURCE|ERROR:GAMEOBJECT/.test(m.text()))errors.push(m.text());});
  const pass=name=>{cases.push(name);console.log('MOBILE_CASE '+name);};
  const session=await context.newCDPSession(page);
  const dispatch=(type,points)=>session.send('Input.dispatchTouchEvent',{type,touchPoints:points});
  const point=async(command,id)=>{
    const box=await page.locator(`[data-command="${command}"]`).boundingBox();
    assert(box&&box.width>=44&&box.height>=44,'Touch zone must be usable');
    return {x:box.x+box.width/2,y:box.y+box.height/2,id};
  };
  const neutral=()=>page.waitForFunction(()=>{
    const c=window.riderTelemetry.command;
    return c.throttle===0&&c.brake_reverse===0&&c.lean===0;
  });
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
    const before=await point('throttle',1);
    await page.getByRole('button',{name:'Layout A · mirror',exact:true}).click();
    await page.waitForFunction(()=>window.riderMobile.mirrored);
    const after=await point('throttle',1);assert(after.x<before.x);
    await dispatch('touchStart',[after,await point('right',2)]);
    await page.waitForFunction(()=>window.riderTelemetry.command.throttle===1&&window.riderTelemetry.command.lean===-1);
    await page.setViewportSize({width:486,height:1080});await neutral();await dispatch('touchEnd',[]);
    await layout();await page.screenshot({path:path.join(out,'mobile-portrait.png')});
    await page.setViewportSize({width:1080,height:486});await layout();
    assert.equal(await page.evaluate(()=>JSON.stringify(window.riderReady)),identity);
    pass('mirrored_drive_rotation_no_reload');
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
    await page.getByRole('button',{name:'Measure',exact:true}).click();
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
    pass('interrupted_capture_cancelled');
    await page.evaluate(()=>{navigator.clipboard.writeText=()=>Promise.reject(new DOMException('Injected denial','NotAllowedError'));});
    await page.getByRole('button',{name:'Copy report',exact:true}).click();
    await page.waitForFunction(()=>window.riderFeedback.visible);
    assert((await page.locator('#rider-feedback-text').inputValue()).includes('## Mobile trial'));
    assert((await page.locator('#rider-feedback-text').inputValue()).includes(sha));
    await page.getByRole('button',{name:'Close',exact:true}).click();
    await page.waitForFunction(()=>!window.riderFeedback.visible&&!window.riderTelemetry.ui_captured);
    pass('mobile_report_fallback');
    assert.equal(await page.locator('#app-container #rider-mobile').count(),1);
    async function settledViewport(){
      // fullscreenElement changes before the asynchronous viewport/input
      // transition has necessarily reached the engine. Resize clears held input.
      const sequence=await page.evaluate(()=>window.riderTelemetry.sequence);
      await page.waitForFunction(n=>window.riderTelemetry.sequence>n+1&&
        window.riderViewport.width===innerWidth&&window.riderViewport.height===innerHeight,sequence);
      await neutral();await layout();
    }
    for(let transition=0;transition<3;transition++){
      await page.getByRole('button',{name:'Fullscreen',exact:true}).click();
      await page.waitForFunction(()=>document.fullscreenElement!==null);
      await settledViewport();
      await dispatch('touchStart',[await point('throttle',1)]);
      await page.waitForFunction(()=>window.riderTelemetry.command.throttle===1);
      await dispatch('touchEnd',[]);await neutral();
      await page.evaluate(()=>document.exitFullscreen());
      await page.waitForFunction(()=>document.fullscreenElement===null);
      await settledViewport();
    }
    assert.equal(await page.evaluate(()=>JSON.stringify(window.riderReady)),identity);
    pass('fullscreen_controls_remain_drivable');
    await page.screenshot({path:path.join(out,'mobile-landscape.png')});
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
