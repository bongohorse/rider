// Normal release input on the air station: URL selection, a keyboard jump with held lean measured and shown
// on the HUD, retained-world Retry to the section start, section switch and mobile Next section.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
module.exports=async function air(browser,url,sha,out){
 const context=await browser.newContext({viewport:{width:1280,height:720}}),page=await context.newPage(),errors=[],cases=[];
 page.on('pageerror',e=>errors.push(e.message));
 page.on('console',m=>{if(/ERROR:SCRIPT|ERROR:RESOURCE|ERROR:GAMEOBJECT/.test(m.text()))errors.push(m.text());});
 try{
  const target=new URL(url);target.search='?station=air&touch=0';await page.goto(target.href);
  await page.waitForFunction(sha=>window.riderReady?.source_sha===sha&&window.riderStationReport?.station==='air'&&window.riderStationReport.section==='big'&&window.riderTelemetry?.sequence>2,sha);
  assert.equal(await page.evaluate(()=>window.riderStationReport.automated),false);
  assert.equal(await page.evaluate(()=>window.riderTelemetry.start_speed),7);
  cases.push('release_url_default_section_and_speed');
  // Drive off the lip, then hold lean back (A) until the jump is measured.
  await page.keyboard.down('ArrowUp');await page.waitForFunction(()=>window.riderTelemetry.command.throttle===1);
  await page.waitForFunction(()=>window.riderStationReport.in_flight?.from_lip,null,{timeout:15000});
  await page.keyboard.up('ArrowUp');await page.keyboard.down('a');
  await page.waitForFunction(()=>window.riderTelemetry.command.lean===1);
  await page.waitForFunction(()=>(window.riderStationReport.jumps||[]).find(j=>j.from_lip&&j.complete),null,{timeout:15000});
  await page.keyboard.up('a');await page.waitForFunction(()=>window.riderTelemetry.command.lean===0);
  const jump=await page.evaluate(()=>window.riderStationReport.jumps.find(j=>j.from_lip));
  assert.equal(jump.section,'big');assert.equal(jump.lean_max,1);assert(jump.airtime_s>=.25);
  assert(Number.isFinite(jump.rotation_deg)&&Number.isFinite(jump.landing_angle_deg)&&jump.ground_found);
  await page.waitForFunction(()=>/^Jump \d+: /.test(window.riderTelemetry.station_result));
  await page.screenshot({path:path.join(out,'air-release.png')});
  cases.push('release_keyboard_jump_measured_and_shown');
  // A20 slow motion marks every jump record not comparable, as it marks other stations' records.
  // X cycles 1 -> 0.5 -> 0.25 -> 1; hold each press until the telemetry shows the new factor.
  const step=async()=>{
   const cur=await page.evaluate(()=>window.riderTelemetry.time_factor);await page.keyboard.down('x');await page.waitForFunction(cur=>window.riderTelemetry.time_factor!==cur,cur);await page.keyboard.up('x');
   // Let the engine sample the release before the next press (pitfall 5).
   const n=await page.evaluate(()=>window.riderTelemetry.sequence);await page.waitForFunction(n=>window.riderTelemetry.sequence>n+1,n);};
  await step();assert.equal(await page.evaluate(()=>window.riderTelemetry.time_factor),0.5);
  await page.waitForFunction(()=>window.riderStationReport.comparable===false&&window.riderStationReport.jumps.every(j=>j.time_comparable===false&&j.status.endsWith(' (slow motion: not comparable)')));
  await step();await step();assert.equal(await page.evaluate(()=>window.riderTelemetry.time_factor),1);
  cases.push('release_slow_motion_marks_jumps');
  const before=await page.evaluate(()=>window.riderTelemetry);
  await page.keyboard.down('r');await page.waitForFunction(n=>window.riderTelemetry.reset_count===n+1,before.reset_count);await page.keyboard.up('r');
  const back=await page.evaluate(()=>window.riderTelemetry);
  assert(back.station_distance<2,'R returns to the section start');
  assert.equal(back.world_loads,before.world_loads);
  assert.equal(await page.evaluate(()=>window.riderStationReport.jump_count),0);
  cases.push('release_retry_to_start_without_world_reload');
  await page.keyboard.down('v');await page.waitForFunction(n=>window.riderStationReport.section==='mid'&&window.riderTelemetry.reset_count===n+1,back.reset_count);await page.keyboard.up('v');
  cases.push('release_section_switch');
  if(errors.length)throw Error(errors.join('\n'));
 }finally{await context.close();}
 const phone=await browser.newContext({viewport:{width:1080,height:486},isMobile:true,hasTouch:true}),mobile=await phone.newPage();
 try{
  const target=new URL(url);target.search='?station=air&section=flat&speed=0&touch=1';await mobile.goto(target.href);
  await mobile.waitForFunction(()=>window.riderStationReport?.station==='air'&&window.riderStationReport.section==='flat'&&window.riderTelemetry?.sequence>2);
  await mobile.getByRole('button',{name:'Next section',exact:true}).click();await mobile.waitForFunction(()=>window.riderStationReport.section==='low');
  await mobile.screenshot({path:path.join(out,'air-release-phone.png')});cases.push('mobile_emulation_next_section');
 }finally{await phone.close();}
 fs.writeFileSync(path.join(out,'air-release-result.json'),JSON.stringify({source_sha:sha,status:'PASS',cases,realDevice:'NOT RUN'},null,2));
 return {name:'air-release',status:'PASS',cases};
};
