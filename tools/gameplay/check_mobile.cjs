// First-run touch loop; synthetic Chromium touch is not physical-device acceptance.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
// Fail closed on actual Chromium rectangles, not inferred CSS row counts.
function intersects(a,b){return a.left<b.right-1&&a.right>b.left+1&&a.top<b.bottom-1&&a.bottom>b.top+1;}
async function checkHudGeometry(page,viewport,moreOpen=false){
 const g=await page.evaluate(()=>{
  const box=e=>{if(!e)return null;const r=e.getBoundingClientRect();return {left:r.left,top:r.top,right:r.right,bottom:r.bottom,width:r.width,height:r.height};};
  const toolbar=document.querySelector('#rider-mobile .toolbar'),menu=document.querySelector('#rider-mobile .toolbar-more');
  const visible=e=>e.getClientRects().length>0&&getComputedStyle(e).visibility!=='hidden'&&getComputedStyle(e).display!=='none';
  return {toolbar:box(toolbar),menu:menu&&!menu.hidden?box(menu):null,readout:box(document.querySelector('#rider-mobile .readout')),
    zones:box(document.querySelector('#rider-mobile .zones')),
    buttons:[...toolbar.querySelectorAll('button')].filter(visible).map(e=>({label:e.textContent,rect:box(e)}))};
 });
 const screen={left:0,top:0,right:viewport.width,bottom:viewport.height};
 assert.ok(g.toolbar&&g.readout&&g.zones,'missing mobile HUD geometry');
 for(const {label,rect} of g.buttons){
  assert.ok(rect.width>=44&&rect.height>=44,'touch target too small: '+label+' '+JSON.stringify(rect));
  assert.ok(rect.left>=screen.left-1&&rect.right<=screen.right+1&&rect.top>=screen.top-1&&rect.bottom<=screen.bottom+1,'offscreen toolbar button: '+label);
  assert.equal(intersects(rect,g.zones),false,'toolbar overlaps drive zones: '+label);
 }
 assert.ok(g.toolbar.left>=-1&&g.toolbar.right<=screen.right+1,'toolbar outside viewport');
 if(moreOpen){
  assert.ok(g.menu,'More must have a visible panel');
  assert.ok(g.menu.left>=-1&&g.menu.right<=screen.right+1&&g.menu.bottom<=screen.bottom+1,'More outside viewport');
  assert.equal(intersects(g.menu,g.zones),false,'More overlaps drive zones');
 }else{
  assert.equal(g.menu,null,'closed More must not be displayed');
  assert.ok(g.readout.top>=g.toolbar.bottom+6,'readout must follow actual toolbar bottom');
  assert.equal(intersects(g.readout,g.zones),false,'readout overlaps drive zones');
  assert.equal(intersects(g.readout,g.toolbar),false,'readout overlaps toolbar');
 }
 return g;
}
module.exports=async function check(browser,base,sha,out){
 const context=await browser.newContext({viewport:{width:1080,height:486},isMobile:true,hasTouch:true});const page=await context.newPage(),errors=[],checks=[];const r={source_sha:sha,status:'INCOMPLETE',real_device:'NOT RUN',checks,errors};
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(/ERROR:SCRIPT|ERROR:RESOURCE|ERROR:GAMEOBJECT/.test(m.text()))errors.push(m.text());});
 try{
  await page.goto(new URL('index.html?station=first-run&touch=1',base).href);await page.waitForFunction(()=>window.riderRun?.state==='ready'&&window.riderTelemetry?.sequence>2&&window.riderMobile?.enabled);assert.equal(await page.evaluate(()=>window.riderBuild),sha);
  assert.match(await page.locator('#rider-mobile .readout').innerText(),/Drive to start/);await page.waitForFunction(()=>window.riderProgress?.available&&window.riderProgress.fraction===0);await page.locator('#rider-mobile .course-progress').waitFor({state:'visible',timeout:5000});assert.equal(await page.locator('#rider-mobile .course-progress').isVisible(),true);await page.waitForFunction(()=>window.riderCoins?.total===9);assert.match(await page.locator('#rider-mobile .coin-count').innerText(),/Coins 0\/9/);assert.equal(await page.evaluate(()=>window.riderCoins.gem_total),2);await page.screenshot({path:path.join(out,'run-phone-ready.png')});
  const hudLayouts=[];
  for(const viewport of [{width:486,height:1080},{width:390,height:844},{width:960,height:540},{width:1080,height:486}]){
   await page.setViewportSize(viewport);await page.waitForTimeout(250);
   const box=await page.locator('#rider-mobile .course-progress').boundingBox();
   assert.ok(box&&box.x>=0&&box.y>=0&&box.x+box.width<=viewport.width&&box.y+box.height<=viewport.height);
   const closed=await checkHudGeometry(page,viewport);
   if(viewport.width===486)await page.screenshot({path:path.join(out,'progress-phone-portrait.png')});
   await page.getByRole('button',{name:'More',exact:true}).tap();
   assert.equal(await page.getByRole('button',{name:'More',exact:true}).getAttribute('aria-expanded'),'true');
   const menu=page.locator('#rider-mobile .toolbar-more');
   await menu.waitFor({state:'visible'});
   assert.equal(await menu.locator('button').count(),12,'all existing secondary actions retained');
   assert.equal(await menu.getByRole('button',{name:'Next section',includeHidden:true}).isHidden(),true);
   const open=await checkHudGeometry(page,viewport,true);
   for(const label of ['Next station','Speed 1x','Record run','Replay run','Import level','Layout A · mirror','Measure','Tilt','Copy report','Fullscreen']){
    const action=menu.getByRole('button',{name:label,exact:true});
    await action.scrollIntoViewIfNeeded();
    assert.equal(await action.isVisible(),true,'secondary touch action inaccessible: '+label);
   }
   if(viewport.width===390)await page.screenshot({path:path.join(out,'mobile-hud-portrait-more.png')});
   await page.getByRole('button',{name:'More',exact:true}).tap();
   assert.equal(await menu.isHidden(),true);
   hudLayouts.push({viewport,closed,open});
  }
  await page.getByRole('button',{name:'More',exact:true}).tap();
  await page.getByRole('button',{name:'Layout A · mirror',exact:true}).tap();
  assert.equal(await page.evaluate(()=>window.riderMobile.mirrored),true);
  assert.equal(await page.locator('#rider-mobile .toolbar-more').isHidden(),true);
  await page.getByRole('button',{name:'More',exact:true}).tap();
  await page.getByRole('button',{name:'Layout B · mirror',exact:true}).tap();
  assert.equal(await page.evaluate(()=>window.riderMobile.mirrored),false);
  await page.getByRole('button',{name:'More',exact:true}).tap();
  await page.getByRole('button',{name:'Tilt',exact:true}).tap();
  assert.equal(await page.locator('#rider-mobile .tilt-panel').isVisible(),true);
  await page.getByRole('button',{name:'More',exact:true}).tap();
  assert.equal(await page.locator('#rider-mobile .tilt-panel').isHidden(),true);
  await page.getByRole('button',{name:'More',exact:true}).tap();
  checks.push({name:'touch-toolbar-geometry-and-more',layouts:hudLayouts});
  const g=await page.evaluate(()=>window.riderTelemetry.session_generation);
  const cdp=await context.newCDPSession(page);const box=await page.locator('[data-command="throttle"]').boundingBox();assert(box&&box.width>=44&&box.height>=44);
  const drive=()=>cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:box.x+box.width/2,y:box.y+box.height/2,id:1}]});
  await drive();await page.waitForFunction(()=>window.riderRun.state==='running'&&window.riderRun.time>1);await cdp.send('Input.dispatchTouchEvent',{type:'touchCancel',touchPoints:[]});await page.getByRole('button',{name:'Pause',exact:true}).tap();await page.waitForFunction(()=>window.riderRun.state==='paused');
  const t=await page.evaluate(()=>window.riderRun.time);await page.waitForFunction(()=>window.riderProgress.phase==='paused');const progress=await page.evaluate(()=>window.riderProgress.distance);await page.waitForTimeout(300);assert.equal(await page.evaluate(()=>window.riderRun.time),t);assert.equal(await page.evaluate(()=>window.riderProgress.distance),progress);await page.getByRole('button',{name:'Resume',exact:true}).tap();await page.waitForFunction(()=>window.riderRun.state==='running');
  await drive();await page.waitForFunction(()=>['finished','failed'].includes(window.riderRun.state),null,{timeout:45000});await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});assert.equal(await page.evaluate(()=>window.riderRun.state),'finished');await page.waitForFunction(()=>window.riderRun.save==='saved'&&window.riderRun.best>0&&window.riderTimeState.paused&&window.riderCoins?.bank===9&&window.riderCoins.save==='saved');assert.match(await page.locator('#rider-mobile .readout').innerText(),/Finished.*Best/);assert.equal(await page.getByRole('button',{name:'Finished',exact:true}).isDisabled(),true);assert.equal(await page.evaluate(()=>window.riderRun.medal),3);assert.equal(await page.evaluate(()=>window.riderRun.highest_medal),3);assert.match(await page.evaluate(()=>window.riderRunUI.medal),/Gold medal/);assert.match(await page.evaluate(()=>window.riderRunUI.next),/All target times beaten/);await page.waitForFunction(()=>/Coins 9\/9.*Bank 9/.test(document.querySelector('#rider-mobile .coin-count')?.textContent||''));assert.match(await page.locator('#rider-mobile .coin-count').innerText(),/Coins 9\/9.*Bank 9/);assert.match(await page.evaluate(()=>window.riderRunUI.coins),/Coins 9\/9/);assert.ok(await page.evaluate(()=>window.riderCoins.gems>0));assert.equal(await page.evaluate(()=>window.riderCoins.gem_bank),await page.evaluate(()=>window.riderCoins.gems));assert.match(await page.locator('#rider-mobile .coin-count').innerText(),/Gems/);await page.screenshot({path:path.join(out,'run-phone-finished.png')});checks.push({name:'touch-start-pause-resume-finish-saved',state:await page.evaluate(()=>window.riderRun)});
  await page.getByRole('button',{name:'Retry',exact:true}).tap();await page.waitForFunction(()=>window.riderRun.state==='ready');assert.equal(await page.evaluate(()=>window.riderTelemetry.session_generation),g);await page.waitForFunction(()=>window.riderProgress.fraction===0);await page.locator('#rider-mobile .course-progress').waitFor({state:'visible',timeout:5000});assert.equal(await page.locator('#rider-mobile .course-progress').isVisible(),true);await page.waitForFunction(()=>window.riderCoins.count===0&&!window.riderCoins.flash);assert.equal(await page.evaluate(()=>window.riderCoins.bank),9);checks.push({name:'touch-toolbar-retry-same-world'});checks.push({name:'route-progress-touch-ready-pause-and-retry',state:await page.evaluate(()=>window.riderProgress)});
  assert.deepEqual(errors,[]);r.status='PASS';return r;
 }catch(e){r.status='FAIL';r.failure=e.stack;r.state=await page.evaluate(()=>window.riderRun).catch(()=>null);await page.screenshot({path:path.join(out,'run-phone-failure.png')}).catch(()=>{});throw e;
 }finally{fs.writeFileSync(path.join(out,'run-phone-results.json'),JSON.stringify(r,null,2));await context.close();}
};
if(require.main===module){const {chromium}=require('playwright');const [base,sha,out]=process.argv.slice(2);fs.mkdirSync(out,{recursive:true});(async()=>{const b=await chromium.launch();try{console.log(JSON.stringify(await module.exports(b,base,sha,out)));}finally{await b.close();}})().catch(e=>{console.error(e);process.exitCode=1;});}
