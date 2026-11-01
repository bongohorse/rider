// A19d release: direct URL, keyboard drive over the seesaw, R resets the plank in the same world, V and mobile Next section.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
module.exports=async function balance(browser,url,sha,out){
 const context=await browser.newContext({viewport:{width:1280,height:720}}),page=await context.newPage(),errors=[],cases=[];
 page.on('pageerror',e=>errors.push(e.message));
 page.on('console',m=>{if(/ERROR:SCRIPT|ERROR:RESOURCE|ERROR:GAMEOBJECT/.test(m.text()))errors.push(m.text());});
 try{
  const target=new URL(url);target.search='?station=balance&section=seesaw&touch=0';await page.goto(target.href);
  await page.waitForFunction(sha=>window.riderReady?.source_sha===sha&&window.riderStationReport?.station==='balance'&&window.riderStationReport.section==='seesaw'&&window.riderTelemetry?.sequence>2,sha);
  let r=await page.evaluate(()=>window.riderStationReport);
  assert.equal(r.automated,false);assert.equal(r.start_speed,0);assert.equal(r.seesaw.joint_valid,true);assert.equal(r.seesaw.plank_joints,1);
  cases.push('release_url_from_rest_with_seesaw');
  // Hold throttle until the plank has tipped past level under the buggy.
  await page.keyboard.down('ArrowUp');
  await page.waitForFunction(()=>window.riderTelemetry.command.throttle===1&&window.riderStationReport.seesaw.angle<-0.05,null,{timeout:20000});
  await page.keyboard.up('ArrowUp');await page.waitForFunction(()=>window.riderTelemetry.command.throttle===0);
  cases.push('release_keyboard_tips_seesaw');
  const before=await page.evaluate(()=>({t:window.riderTelemetry,g:window.riderStationReport.seesaw.generation}));
  await page.keyboard.down('r');await page.waitForFunction(n=>window.riderTelemetry.reset_count===n+1,before.t.reset_count);await page.keyboard.up('r');
  await page.waitForFunction(g=>window.riderStationReport.seesaw.generation===g+1,before.g);
  r=await page.evaluate(()=>window.riderStationReport);
  assert.equal(r.seesaw.reset.old_joint_valid,false);assert.equal(r.seesaw.reset.joint_valid,true);
  assert(Math.abs(r.seesaw.reset.angle-r.record.seesaw.rest_target)<.005&&r.seesaw.reset.omega===0,'plank back at rest');
  assert.equal(await page.evaluate(()=>window.riderTelemetry.world_loads),before.t.world_loads);
  await page.screenshot({path:path.join(out,'balance-release.png')});
  cases.push('release_retry_resets_seesaw_without_world_reload');
  const n=await page.evaluate(()=>window.riderTelemetry.reset_count);
  await page.keyboard.down('v');await page.waitForFunction(n=>window.riderStationReport.section==='beam-2'&&window.riderTelemetry.reset_count===n+1,n);await page.keyboard.up('v');
  cases.push('release_section_cycle');
  if(errors.length)throw Error(errors.join('\n'));
 }finally{await context.close();}
 const phone=await browser.newContext({viewport:{width:1080,height:486},isMobile:true,hasTouch:true}),mobile=await phone.newPage();
 try{
  const target=new URL(url);target.search='?station=balance&section=down&touch=1';await mobile.goto(target.href);
  await mobile.waitForFunction(()=>window.riderStationReport?.station==='balance'&&window.riderTelemetry?.sequence>2);
  const more=mobile.getByRole('button',{name:'More',exact:true});
  assert.equal(await more.getAttribute('aria-expanded'),'false');
  await more.tap();assert.equal(await more.getAttribute('aria-expanded'),'true');
  await mobile.locator('#rider-mobile .toolbar-more').getByRole('button',{name:'Next section',exact:true}).tap();
  assert.equal(await more.getAttribute('aria-expanded'),'false');
  await mobile.waitForFunction(()=>window.riderStationReport.section==='seesaw');
  await mobile.screenshot({path:path.join(out,'balance-release-phone.png')});cases.push('mobile_emulation_next_section');
 }finally{await phone.close();}
 fs.writeFileSync(path.join(out,'balance-release-result.json'),JSON.stringify({source_sha:sha,status:'PASS',cases,realDevice:'NOT RUN'},null,2));
 return {name:'balance-release',status:'PASS',cases};
};
