// Real Defold fields/navigation: no camera or document injection.
const assert=require('node:assert/strict'),path=require('node:path'),pointer=require('../gym/pointer.cjs');
module.exports=async function(h){
 const {page,ed,key,button,snapshot,unchanged,settle,canvas,out,cases,measurements}=h;
 const before=await snapshot(),centre=e=>[(e.usable.x0+e.usable.x1-2*e.screen.ox)/(2*e.screen.ppm_x),(e.usable.y0+e.usable.y1-2*e.screen.oy)/(2*e.screen.ppm_y)];
 async function value(text,finish='Enter'){await button('zoom_value');await key('Backspace');if(text)await page.keyboard.type(text,{delay:10});await key(finish);return settle();}
 let anchor=centre(await ed()),e=await value('100');assert.equal(e.camera.zoom,1);assert.equal(e.field,false);assert.equal(e.mode,'edit');
 for(let i=0;i<2;i++)assert.ok(Math.abs(centre(e)[i]-anchor[i])<.002,'percentage entry moved workspace centre');
 await button('zoom_out');assert.equal((await ed()).camera.zoom,.75);await button('zoom_in');assert.equal((await ed()).camera.zoom,1);
 await value('130%');await button('zoom_in');assert.equal((await ed()).camera.zoom,1.5);await button('zoom_out');assert.equal((await ed()).camera.zoom,1);
 for(const bad of ['','abc','0','401','1e2','100%%']){e=await value(bad);assert.equal(e.camera.zoom,1);assert.notEqual(e.field,false);assert.ok(e.ui.field_error);await key('Escape');}
 e=await value('175','Escape');assert.equal(e.camera.zoom,1);assert.equal(e.field,false);
 await value('1');await button('zoom_out');assert.equal((await ed()).camera.zoom,.01);
 await value('400');await button('zoom_in');assert.equal((await ed()).camera.zoom,4);
 // Pending numeric input plus a step acts on that input and does not trigger a gameplay key.
 await button('zoom_value');await page.keyboard.type('100');await button('zoom_out');assert.equal((await ed()).camera.zoom,.75);assert.equal((await ed()).field,false);
 await key('Home');e=await ed();const fit=e.camera.zoom,steps=[.01,.02,.05,.1,.2,.25,.5,.75,1,1.5,2,3,4];
 await button('zoom_in');assert.equal((await ed()).camera.zoom,steps.find(z=>z>fit+1e-9)??4);
 await key('Home');await button('zoom_out');assert.equal((await ed()).camera.zoom,[...steps].reverse().find(z=>z<fit-1e-9)??.01);
 await value('25');e=await ed();const u=e.usable,q=[(u.x0+u.x1)/2+50,(u.y0+u.y1)/2+30],world=[(q[0]-e.screen.ox)/e.screen.ppm_x,(q[1]-e.screen.oy)/e.screen.ppm_y];
 const p=await canvas(...q);await page.mouse.move(p.x,p.y);await pointer.frames(page);await page.mouse.wheel(0,-120);await pointer.frames(page,{n:8});e=await ed();assert.ok(e.camera.zoom>.25);assert.ok(Math.abs(e.screen.ox+world[0]*e.screen.ppm_x-q[0])<2);assert.ok(Math.abs(e.screen.oy+world[1]*e.screen.ppm_y-q[1])<2);
 const extents=[];for(const size of [{width:1280,height:720},{width:1280,height:480},{width:844,height:390},{width:390,height:844}]){
  await page.setViewportSize(size);await pointer.frames(page);await value('100');e=await ed();assert.equal(e.camera.zoom,1);assert.equal(e.overlay.nodes,628);
  const r=e.ui.rects;assert.ok(r.zoom_out.x+r.zoom_out.w<r.zoom_value.x&&r.zoom_value.x+r.zoom_value.w<r.zoom_in.x);assert.ok(r.zoom_in.x+r.zoom_in.w<=r.terrain_look.x);
  extents.push({viewport:size,ppm:e.screen.ppm_x,world_width:size.width/e.screen.ppm_x});await page.screenshot({path:path.join(out,`editor-zoom-${size.width}x${size.height}.png`)});
 }
 assert.ok(Math.abs(extents[0].world_width-extents[1].world_width)>.1,'100% incorrectly forces equal world area across aspect ratios');
 await page.setViewportSize({width:1280,height:720});await key('Home');await unchanged(before,'zoom entry/buttons/wheel/Fit/resize');
 measurements.editor_zoom={limits:[1,400],exact_100:true,invalid_preserved:true,fit,extents};cases.push('editor_zoom_entry_steps_anchor_limits_and_source_invariance');
};
