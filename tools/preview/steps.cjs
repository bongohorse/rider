// Real release input path; no debug tick driver. Physical phone remains NOT RUN.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
module.exports=async function steps(browser,url,sha,out){
 const cases=[],errors=[];
 const context=await browser.newContext({viewport:{width:1280,height:720}}),page=await context.newPage();
 page.on('pageerror',e=>errors.push(e.message));
 page.on('console',m=>{if(/ERROR:SCRIPT|ERROR:RESOURCE|ERROR:GAMEOBJECT/.test(m.text()))errors.push(m.text());});
 try{
  const target=new URL(url);target.search='?station=steps&section=0.15&speed=0&touch=0';await page.goto(target.href);
  await page.waitForFunction(expected=>window.riderReady?.source_sha===expected&&window.riderTelemetry?.sequence>2&&window.riderStationReport?.section==='0.15',sha);
  assert.equal(await page.evaluate(()=>window.riderStationReport.automated),false);
  await page.keyboard.down('ArrowUp');await page.waitForFunction(()=>window.riderTelemetry.command.throttle===1&&window.riderTelemetry.station_distance>=2.5);
  await page.screenshot({path:path.join(out,'steps-release-approach.png')});
  await page.keyboard.up('ArrowUp');await page.waitForFunction(()=>window.riderTelemetry.command.throttle===0);
  cases.push('release_keyboard_driver_and_report');
  const before=await page.evaluate(()=>({reset:window.riderTelemetry.reset_count,loads:window.riderTelemetry.world_loads}));
  await page.keyboard.down('v');await page.waitForFunction(n=>window.riderStationReport.section==='0.2'&&window.riderTelemetry.reset_count===n+1,before.reset);await page.keyboard.up('v');
  const after=await page.evaluate(()=>window.riderTelemetry);assert.equal(after.reset_count,before.reset+1);assert.equal(after.world_loads,before.loads);assert.equal(after.start_speed,0);
  cases.push('release_section_without_world_reload');
  target.search='?station=steps-down&section=0.5&speed=0&touch=0';await page.goto(target.href);
  await page.waitForFunction(()=>window.riderStationReport?.station==='steps-down'&&window.riderStationReport.section==='0.5'&&window.riderTelemetry?.sequence>2);
  assert.equal(await page.evaluate(()=>window.riderStationReport.automated),false);
  await page.screenshot({path:path.join(out,'steps-down-release.png')});
  cases.push('release_down_ladder_direct_url');
  await page.keyboard.down('t');await page.waitForFunction(()=>window.riderHud?.tuning);await page.keyboard.up('t');
  const slider=await page.evaluate(()=>{
   const c=document.querySelector('canvas'),r=c.getBoundingClientRect(),s=window.riderControls[0];
   return {x:r.x+s.right.x/c.width*r.width,y:r.y+(1-s.right.y/c.height)*r.height,
     centreX:r.x+(s.left.x+s.right.x)*.5/c.width*r.width,
     midpoint:(s.min+s.max)*.5*s.sign,tolerance:(s.max-s.min)*.01,
     value:s.max*s.sign};
  });
  // Begin inside the track and drag beyond the edge: exact-edge clicks may
  // miss the pick node because of browser/device-pixel rounding (see A12b).
  await page.mouse.move(slider.centreX,slider.y);await page.mouse.down();
  await page.waitForFunction(p=>Math.abs(window.riderControls[0].value-p.midpoint)<p.tolerance,slider);
  await page.mouse.move(slider.x+4,slider.y);
  await page.waitForFunction(p=>Math.abs(window.riderControls[0].value-p.value)<.01&&window.riderTelemetry.modified&&window.riderStationReport?.comparable===false,slider);
  // Release in place: moving to (2,2) while held sends one more
  // slider update and would overwrite the max value with the minimum.
  await page.mouse.up();
  await page.waitForFunction(()=>window.riderDragging===false&&window.riderTelemetry.ui_captured===false);
  const adjusted=await page.evaluate(()=>window.riderControls[0].value);
  assert(Math.abs(adjusted-slider.value)<.01,'released slider must retain right endpoint');
  assert.equal(await page.evaluate(()=>window.riderStationReport.highest_climbed_m),0);
  const resetBefore=await page.evaluate(()=>window.riderTelemetry.reset_count);
  await page.keyboard.down('r');
  await page.waitForFunction(n=>window.riderTelemetry.reset_count===n+1,resetBefore);
  await page.keyboard.up('r');
  await page.waitForFunction(value=>window.riderStationReport?.comparable===true&&Math.abs(window.riderStationReport.tuning_at_start.spring_hz-value)<.01,adjusted);
  cases.push('live_tuning_invalidates_comparison_until_retry');
 }finally{await context.close();}
 const mobile=await browser.newContext({viewport:{width:1080,height:486},isMobile:true,hasTouch:true}),phone=await mobile.newPage();
 phone.on('pageerror',e=>errors.push(e.message));
 try{
  const target=new URL(url);target.search='?station=steps&section=0.1&speed=0&touch=1';await phone.goto(target.href);
  await phone.waitForFunction(expected=>window.riderReady?.source_sha===expected&&window.riderTelemetry?.sequence>2&&window.riderStationReport?.section==='0.1',sha);
  await phone.getByRole('button',{name:'Next section',exact:true}).click();
  await phone.waitForFunction(()=>window.riderStationReport.section==='0.15'&&window.riderTelemetry.section_index===3);
  const toast=await phone.locator('#rider-mobile .toast').boundingBox(),toolbar=await phone.locator('#rider-mobile .toolbar').boundingBox();
  assert(toast&&toolbar&&toast.y>=toolbar.y+toolbar.height&&toast.x>=0&&toast.x+toast.width<=1080);
  await phone.screenshot({path:path.join(out,'steps-release-phone.png')});
  const session=await mobile.newCDPSession(phone),b=await phone.getByRole('button',{name:'Throttle',exact:true}).boundingBox();
  await session.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:b.x+b.width/2,y:b.y+b.height/2,id:1}]});
  await phone.waitForFunction(()=>window.riderTelemetry.command.throttle===1&&window.riderTelemetry.speed_mps>.2);
  await session.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  await phone.waitForFunction(()=>window.riderTelemetry.command.throttle===0);
  cases.push('release_mobile_section_touch_and_wrapped_toast');
 }finally{await mobile.close();}
 if(errors.length)throw Error(errors.join('\n'));
 fs.writeFileSync(path.join(out,'steps-release-result.json'),JSON.stringify({source_sha:sha,status:'PASS',cases,realDevice:'NOT RUN'},null,2));
 return {name:'steps-release',status:'PASS',cases};
};
