// Injected orientation events prove plumbing, never physical sensor acceptance.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
module.exports=async function tilt(browser,url,sha,out){
  const context=await browser.newContext({viewport:{width:1080,height:486},isMobile:true,hasTouch:true});
  // This is a controlled DOM-event plumbing test, not a hardware sensor test.
  // Exclude the CI host's native null events before application listeners exist.
  await context.addInitScript(()=>window.addEventListener('deviceorientation',event=>{
    if(event.isTrusted)event.stopImmediatePropagation();
  },true));
  const page=await context.newPage(),errors=[],cases=[];
  page.on('pageerror',e=>errors.push(e.message));
  page.on('console',m=>{if(/ERROR:SCRIPT|ERROR:RESOURCE|ERROR:GAMEOBJECT/.test(m.text()))errors.push(m.text());});
  const pass=name=>{cases.push(name);console.log('TILT_CASE '+name);};
  const session=await context.newCDPSession(page);
  const emit=(beta,gamma)=>page.evaluate(({beta,gamma})=>
    window.dispatchEvent(new DeviceOrientationEvent('deviceorientation',{beta,gamma,alpha:0})),{beta,gamma});
  // Tilt is a secondary action. Exercise the same real More touch path as players.
  const more=()=>page.getByRole('button',{name:'More',exact:true});
  async function toggleTilt(){
    const m=more();
    assert.equal(await m.getAttribute('aria-expanded'),'false','More starts closed');
    await m.tap();
    assert.equal(await m.getAttribute('aria-expanded'),'true','More opens with real touch');
    await page.locator('#rider-mobile .toolbar-more').getByRole('button',{name:'Tilt',exact:true}).tap();
    assert.equal(await m.getAttribute('aria-expanded'),'false','Tilt closes More');
  }
  const open=async()=>{if(!await page.locator('.tilt-panel').isVisible()){await toggleTilt();assert.equal(await page.locator('.tilt-panel').isVisible(),true,'Tilt panel opens');}};
  const close=async()=>{if(await page.locator('.tilt-panel').isVisible()){await toggleTilt();assert.equal(await page.locator('.tilt-panel').isVisible(),false,'Tilt panel closes');}};
  const neutral=()=>page.waitForFunction(()=>{const c=window.riderTelemetry.command;return c.throttle===0&&c.brake_reverse===0&&c.lean===0;});
  async function touch(command,lean){
    const b=await page.locator(`[data-command="${command}"]`).boundingBox();
    await session.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:b.x+b.width/2,y:b.y+b.height/2,id:1}]});
    if(command==='throttle')await page.waitForFunction(()=>window.riderTelemetry.command.throttle===1&&window.riderTelemetry.speed>25);
    else await page.waitForFunction(value=>window.riderTelemetry.command.lean===value,lean);
  }
  const release=()=>session.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  async function calibrate(){await open();await page.getByRole('button',{name:'Calibrate neutral',exact:true}).click();await page.waitForFunction(()=>window.riderTilt.mode==='active'&&!document.querySelector('.tilt-panel').classList.contains('open'));}
  try{
    const launch=new URL(url);launch.search='?touch=1';await page.goto(launch.href);
    await page.waitForFunction(expected=>window.riderReady?.source_sha===expected&&window.riderTelemetry?.sequence>=2&&window.riderTilt?.mode==='off',sha);
    const identity=await page.evaluate(()=>JSON.stringify(window.riderReady));
    await page.evaluate(()=>{
      window.__orientationCtor=window.DeviceOrientationEvent;
      window.__permissionDescriptor=Object.getOwnPropertyDescriptor(DeviceOrientationEvent,'requestPermission');
      Object.defineProperty(DeviceOrientationEvent,'requestPermission',{configurable:true,value:()=>Promise.resolve('denied')});
      window.__tiltScreenAngle=0;
      Object.defineProperty(screen.orientation,'angle',{configurable:true,get:()=>window.__tiltScreenAngle});
    });
    await open();await page.getByRole('button',{name:'Enable tilt',exact:true}).click();
    await page.waitForFunction(()=>window.riderTilt.mode==='fallback'&&window.riderTilt.reason.includes('denied'));
    await close();await touch('throttle');await release();await neutral();pass('denied_touch_fallback');
    await page.evaluate(()=>{window.DeviceOrientationEvent=undefined;});
    await open();await page.getByRole('button',{name:'Enable tilt',exact:true}).click();
    await page.waitForFunction(()=>window.riderTilt.mode==='fallback'&&window.riderTilt.reason.includes('unavailable'));
    await close();await touch('throttle');await release();await neutral();pass('unsupported_touch_fallback');
    await page.evaluate(()=>{
      window.DeviceOrientationEvent=window.__orientationCtor;
      Object.defineProperty(DeviceOrientationEvent,'requestPermission',{configurable:true,value:()=>Promise.resolve('granted')});
    });
    await open();await page.getByRole('button',{name:'Enable tilt',exact:true}).click();
    await page.waitForFunction(()=>window.riderTilt.mode==='waiting');
    await emit(0,0);
    await page.waitForFunction(()=>window.riderTilt.mode==='calibrate');
    await calibrate();await emit(0,-20);
    await page.waitForFunction(()=>window.riderTelemetry.command.lean>.95&&window.riderTelemetry.pitch>.03);
    pass('calibrated_sensor_moves_body_through_owner');
    await page.screenshot({path:path.join(out,'tilt-driving.png')});
    await touch('right',-1);pass('touch_lean_overrides_sensor');await release();
    await page.waitForFunction(()=>window.riderTelemetry.command.lean>.95);
    const resets=await page.evaluate(()=>window.riderTelemetry.reset_count);
    await page.getByRole('button',{name:'Retry',exact:true}).click();
    await page.waitForFunction(n=>window.riderTelemetry.reset_count===n+1&&window.riderTilt.mode==='calibrate',resets);await neutral();
    pass('retry_requires_fresh_calibration');
    await emit(0,0);await calibrate();await emit(0,-1);
    const sequence=await page.evaluate(()=>window.riderTelemetry.sequence);
    await page.waitForFunction(n=>window.riderTelemetry.sequence>n+1&&window.riderTelemetry.command.lean===0,sequence);
    pass('dead_zone_neutral');
    await open();const full=page.getByRole('slider',{name:'Full lean angle',exact:true});await full.focus();await full.press('End');
    await page.waitForFunction(()=>window.riderTilt.fullAngle===45);
    await page.screenshot({path:path.join(out,'tilt-settings.png')});
    await close();await emit(0,-20);
    await page.waitForFunction(()=>window.riderTelemetry.command.lean>.39&&window.riderTelemetry.command.lean<.42);
    pass('live_sensitivity');
    await open();const dead=page.getByRole('slider',{name:'Dead zone',exact:true});await dead.focus();await dead.press('End');
    await page.waitForFunction(()=>window.riderTilt.deadZone===8);await close();await emit(0,-5);
    const deadSequence=await page.evaluate(()=>window.riderTelemetry.sequence);
    await page.waitForFunction(n=>window.riderTelemetry.sequence>n+1&&window.riderTelemetry.command.lean===0,deadSequence);
    pass('live_dead_zone');
    await open();await dead.focus();await dead.press('Home');
    for(let i=0;i<3;i++)await dead.press('ArrowRight');
    await page.waitForFunction(()=>window.riderTilt.deadZone===3);await close();await emit(0,-20);
    await page.waitForFunction(()=>window.riderTelemetry.command.lean>.39&&window.riderTelemetry.command.lean<.42);
    await open();await page.getByRole('button',{name:'Invert OFF',exact:true}).click();await close();
    await page.waitForFunction(()=>window.riderTelemetry.command.lean<-.39&&window.riderTelemetry.command.lean>-.42);
    pass('inverted_direction');
    // Exercise 90-degree sensor-axis normalization without enabling unsupported portrait gameplay.
    await page.setViewportSize({width:960,height:540});await neutral();
    await page.waitForFunction(()=>window.riderTilt.mode==='calibrate');
    await page.evaluate(()=>{window.__tiltScreenAngle=90;});
    await emit(0,0);await calibrate();await emit(20,0);
    await page.waitForFunction(()=>window.riderTelemetry.command.lean<-.39&&window.riderTelemetry.command.lean>-.42);
    assert.equal(await page.evaluate(()=>JSON.stringify(window.riderReady)),identity);
    pass('screen_axis_rotation_no_reload');
    await emit(null,null);await page.waitForFunction(()=>window.riderTilt.mode==='fallback');await neutral();
    await touch('throttle');await release();await neutral();pass('invalid_data_touch_fallback');
    await open();await page.getByRole('button',{name:'Enable tilt',exact:true}).click();
    await page.waitForFunction(()=>window.riderTilt.mode==='fallback'&&window.riderTilt.reason.includes('No sensor'),null,{timeout:6000});
    await page.screenshot({path:path.join(out,'tilt-fallback.png')});pass('no_data_timeout');
    const report=await page.evaluate(()=>window.riderMobile.snapshot());
    assert.equal(report.source,sha);assert.equal(report.tilt.mode,'fallback');
    fs.writeFileSync(path.join(out,'tilt-report.json'),JSON.stringify({cases,report,physicalDevice:'NOT RUN'},null,2));
    if(errors.length)throw Error(errors.join('\n'));
    return {name:'tilt-injected-orientation',status:'PASS',cases,physicalDevice:'NOT RUN'};
  }catch(error){
    await page.screenshot({path:path.join(out,'tilt-failure.png')}).catch(()=>{});
    fs.writeFileSync(path.join(out,'tilt-failure-state.json'),JSON.stringify({cases,state:await page.evaluate(()=>({tilt:window.riderTilt?.snapshot(),telemetry:window.riderTelemetry})).catch(()=>null)},null,2));
    throw error;
  }finally{await context.close();}
};
