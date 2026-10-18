// Normal release input, URL selection and retained-world Retry.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
module.exports=async function seams(browser,url,sha,out){
 const context=await browser.newContext({viewport:{width:1280,height:720}}),page=await context.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 page.on('console',m=>{if(/ERROR:SCRIPT|ERROR:RESOURCE|ERROR:GAMEOBJECT/.test(m.text()))errors.push(m.text());});
 const cases=[];
 try{
  for(const station of ['seams-chain','seams-hull']){
   const target=new URL(url);target.search=`?station=${station}&speed=9&touch=0`;await page.goto(target.href);
   await page.waitForFunction(({sha,station})=>window.riderReady?.source_sha===sha&&window.riderStationReport?.station===station&&window.riderTelemetry?.sequence>2,{sha,station});
   assert.equal(await page.evaluate(()=>window.riderStationReport.automated),false);
   await page.keyboard.down('ArrowUp');await page.waitForFunction(()=>window.riderTelemetry.command.throttle===1);await page.keyboard.up('ArrowUp');
   await page.waitForFunction(()=>window.riderTelemetry.command.throttle===0);
   const before=await page.evaluate(()=>window.riderTelemetry);
   await page.keyboard.down('r');await page.waitForFunction(n=>window.riderTelemetry.reset_count===n+1,before.reset_count);await page.keyboard.up('r');
   await page.waitForFunction(()=>window.riderTelemetry.sequence>2&&window.riderStationReport?.elapsed_s<1);
   assert.equal(await page.evaluate(()=>window.riderTelemetry.world_loads),before.world_loads);
   assert.equal(await page.evaluate(()=>window.riderTelemetry.start_speed),9);
   await page.screenshot({path:path.join(out,station+'-release.png')});
   cases.push(station+'_url_input_retry');
  }
  // Normal key selection uses the station framework (chain=6, hull=7).
  await page.keyboard.down('6');await page.waitForFunction(()=>window.riderStationReport?.station==='seams-chain');await page.keyboard.up('6');
  await page.keyboard.down('7');await page.waitForFunction(()=>window.riderStationReport?.station==='seams-hull');await page.keyboard.up('7');
  cases.push('keyboard_station_switch');
  if(errors.length)throw Error(errors.join('\n'));
 }finally{await context.close();}
 const phone=await browser.newContext({viewport:{width:1080,height:486},isMobile:true,hasTouch:true}),mobile=await phone.newPage();
 try{
  const target=new URL(url);target.search='?station=seams-chain&speed=5&touch=1';await mobile.goto(target.href);
  await mobile.waitForFunction(()=>window.riderStationReport?.station==='seams-chain'&&window.riderTelemetry?.sequence>2);
  await mobile.getByRole('button',{name:'Next station',exact:true}).click();await mobile.waitForFunction(()=>window.riderStationReport?.station==='seams-hull');
  await mobile.screenshot({path:path.join(out,'seams-release-phone.png')});cases.push('mobile_emulation_next_station');
 }finally{await phone.close();}
 fs.writeFileSync(path.join(out,'seams-release-result.json'),JSON.stringify({source_sha:sha,status:'PASS',cases,realDevice:'NOT RUN'},null,2));
 return {name:'seams-release',status:'PASS',cases};
};
