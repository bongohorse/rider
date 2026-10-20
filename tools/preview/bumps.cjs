// Release bumps station (A19b): URL start, keyboard driver, section switch and retained-world Retry; the
// touch toolbar's Next station reaches it after the preceding station (`balance`).
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
module.exports=async function bumps(browser,url,sha,out){
 const context=await browser.newContext({viewport:{width:1280,height:720}}),page=await context.newPage(),errors=[],cases=[];
 page.on('pageerror',e=>errors.push(e.message));
 page.on('console',m=>{if(/ERROR:SCRIPT|ERROR:RESOURCE|ERROR:GAMEOBJECT/.test(m.text()))errors.push(m.text());});
 try{
  const target=new URL(url);target.search='?station=bumps&speed=0&touch=0';await page.goto(target.href);
  await page.waitForFunction(sha=>window.riderReady?.source_sha===sha&&window.riderStationReport?.station==='bumps'&&window.riderStationReport.section==='long-0.05'&&window.riderTelemetry?.sequence>2,sha);
  assert.equal(await page.evaluate(()=>window.riderStationReport.automated),false);
  await page.keyboard.down('ArrowUp');await page.waitForFunction(()=>window.riderTelemetry.command.throttle===1&&window.riderTelemetry.station_distance>=6);
  await page.keyboard.up('ArrowUp');await page.waitForFunction(()=>window.riderTelemetry.command.throttle===0);
  // The first feature window was entered under real keyboard input.
  assert.ok(await page.evaluate(()=>window.riderStationReport.records[0].features[0].steps>0));
  cases.push('release_url_and_keyboard_driver');
  const before=await page.evaluate(()=>window.riderTelemetry);
  await page.keyboard.down('v');await page.waitForFunction(n=>window.riderStationReport.section==='long-0.1'&&window.riderTelemetry.reset_count===n+1,before.reset_count);await page.keyboard.up('v');
  await page.keyboard.down('r');await page.waitForFunction(n=>window.riderTelemetry.reset_count===n+2,before.reset_count);await page.keyboard.up('r');
  await page.waitForFunction(()=>window.riderTelemetry.station_distance<.5&&window.riderStationReport.section==='long-0.1');
  assert.equal(await page.evaluate(()=>window.riderTelemetry.world_loads),before.world_loads);
  await page.screenshot({path:path.join(out,'bumps-release.png')});
  cases.push('release_section_and_retry_without_world_reload');
  if(errors.length)throw Error(errors.join('\n'));
 }finally{await context.close();}
 const phone=await browser.newContext({viewport:{width:1080,height:486},isMobile:true,hasTouch:true}),mobile=await phone.newPage();
 try{
  const target=new URL(url);target.search='?station=balance&touch=1';await mobile.goto(target.href);
  await mobile.waitForFunction(()=>window.riderStationReport?.station==='balance'&&window.riderTelemetry?.sequence>2);
  await mobile.getByRole('button',{name:'Next station',exact:true}).click();
  await mobile.waitForFunction(()=>window.riderStationReport?.station==='bumps'&&window.riderTelemetry?.sequence>2);
  await mobile.getByRole('button',{name:'Next section',exact:true}).click();await mobile.waitForFunction(()=>window.riderStationReport.section==='long-0.1');
  await mobile.screenshot({path:path.join(out,'bumps-release-phone.png')});cases.push('mobile_emulation_next_station_and_section');
 }finally{await phone.close();}
 fs.writeFileSync(path.join(out,'bumps-release-result.json'),JSON.stringify({source_sha:sha,status:'PASS',cases,realDevice:'NOT RUN'},null,2));
 return {name:'bumps-release',status:'PASS',cases};
};
