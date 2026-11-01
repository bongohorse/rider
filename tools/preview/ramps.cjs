// Real release input path; no debug tick driver. Physical phone remains NOT RUN.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
module.exports=async function ramps(browser,url,sha,out){
 const cases=[],errors=[];
 const context=await browser.newContext({viewport:{width:1280,height:720}}),page=await context.newPage();
 page.on('pageerror',e=>errors.push(e.message));
 page.on('console',m=>{if(/ERROR:SCRIPT|ERROR:RESOURCE|ERROR:GAMEOBJECT/.test(m.text()))errors.push(m.text());});
 try{
  const target=new URL(url);target.search='?station=ramps-long&section=30&speed=0&touch=0';await page.goto(target.href);
  await page.waitForFunction(expected=>window.riderReady?.source_sha===expected&&window.riderTelemetry?.sequence>2&&window.riderStationReport?.section==='30',sha);
  assert.equal(await page.evaluate(()=>window.riderStationReport.automated),false);
  await page.keyboard.down('ArrowUp');await page.waitForFunction(()=>window.riderTelemetry.command.throttle===1&&window.riderTelemetry.station_distance>=2.5);
  await page.screenshot({path:path.join(out,'ramps-release-approach.png')});
  await page.keyboard.up('ArrowUp');await page.waitForFunction(()=>window.riderTelemetry.command.throttle===0);
  cases.push('release_keyboard_driver_and_report');
  const before=await page.evaluate(()=>({reset:window.riderTelemetry.reset_count,loads:window.riderTelemetry.world_loads}));
  await page.keyboard.down('v');await page.waitForFunction(n=>window.riderStationReport.section==='35'&&window.riderTelemetry.reset_count===n+1,before.reset);await page.keyboard.up('v');
  const after=await page.evaluate(()=>window.riderTelemetry);assert.equal(after.reset_count,before.reset+1);assert.equal(after.world_loads,before.loads);assert.equal(after.start_speed,0);
  cases.push('release_section_without_world_reload');
 }finally{await context.close();}
 const mobile=await browser.newContext({viewport:{width:1080,height:486},isMobile:true,hasTouch:true}),phone=await mobile.newPage();
 phone.on('pageerror',e=>errors.push(e.message));
 try{
  const target=new URL(url);target.search='?station=ramps&section=20&speed=0&touch=1';await phone.goto(target.href);
  await phone.waitForFunction(expected=>window.riderReady?.source_sha===expected&&window.riderTelemetry?.sequence>2&&window.riderStationReport?.section==='20',sha);
  const more=phone.getByRole('button',{name:'More',exact:true});
  assert.equal(await more.getAttribute('aria-expanded'),'false','More starts closed');
  await more.tap();
  assert.equal(await more.getAttribute('aria-expanded'),'true','More opens with real touch');
  await phone.locator('#rider-mobile .toolbar-more').getByRole('button',{name:'Next section',exact:true}).tap();
  assert.equal(await more.getAttribute('aria-expanded'),'false','Next section closes More');
  await phone.waitForFunction(()=>window.riderStationReport.section==='25'&&window.riderTelemetry.section_index===5);
  const toast=await phone.locator('#rider-mobile .toast').boundingBox(),toolbar=await phone.locator('#rider-mobile .toolbar').boundingBox();
  assert(toast&&toolbar&&toast.y>=toolbar.y+toolbar.height&&toast.x>=0&&toast.x+toast.width<=1080);
  await phone.screenshot({path:path.join(out,'ramps-release-phone.png')});
  const session=await mobile.newCDPSession(phone),b=await phone.getByRole('button',{name:'Throttle',exact:true}).boundingBox();
  await session.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:b.x+b.width/2,y:b.y+b.height/2,id:1}]});
  await phone.waitForFunction(()=>window.riderTelemetry.command.throttle===1&&window.riderTelemetry.speed_mps>.2);
  await session.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  await phone.waitForFunction(()=>window.riderTelemetry.command.throttle===0);
  cases.push('release_mobile_section_touch_and_wrapped_toast');
 }finally{await mobile.close();}
 if(errors.length)throw Error(errors.join('\n'));
 fs.writeFileSync(path.join(out,'ramps-release-result.json'),JSON.stringify({source_sha:sha,status:'PASS',cases,realDevice:'NOT RUN'},null,2));
 return {name:'ramps-release',status:'PASS',cases};
};
