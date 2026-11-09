// Real Defold fields/navigation: no camera or document injection.
const assert=require('node:assert/strict'),path=require('node:path'),pointer=require('../gym/pointer.cjs');
module.exports=async function(h){
 const {page,ed,key,button,snapshot,unchanged,settle,canvas,out,cases,measurements}=h;
 const before=await snapshot(),centre=e=>[(e.usable.x0+e.usable.x1-2*e.screen.ox)/(2*e.screen.ppm_x),(e.usable.y0+e.usable.y1-2*e.screen.oy)/(2*e.screen.ppm_y)];
 async function value(text,finish='Enter'){await button('zoom_value');await key('Backspace');if(text)await page.keyboard.type(text,{delay:10});await page.waitForFunction(text=>window.riderEditor.field===text,text,{timeout:5000});await key(finish);return settle();}
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
  // #687/#688: under the HTML chrome the zoom controls are its floating view bar: in order, and clear of the page's
  // Quality/Fullscreen buttons.
  const z=await page.evaluate(()=>{const q=n=>document.querySelector(`#rider-chrome-view [data-cmd="${n}"]`)?.getBoundingClientRect();
   return {out:q('zoom_out'),value:q('zoom_value'),in:q('zoom_in'),bar:document.getElementById('rider-chrome-view').getBoundingClientRect(),tools:document.getElementById('page-tools').getBoundingClientRect()};});
  assert.ok(z.out.right<=z.value.left&&z.value.right<=z.in.left,'zoom order');
  assert.ok(z.bar.right<=z.tools.left+.5||z.bar.bottom<=z.tools.top+.5,'view bar clear of the page buttons at '+JSON.stringify(size)+': '+JSON.stringify({bar:z.bar,tools:z.tools}));
  extents.push({viewport:size,ppm:e.screen.ppm_x,world_width:size.width/e.screen.ppm_x});await page.screenshot({path:path.join(out,`editor-zoom-${size.width}x${size.height}.png`)});
 }
 assert.ok(Math.abs(extents[0].world_width-extents[1].world_width)>.1,'100% incorrectly forces equal world area across aspect ratios');
 await page.setViewportSize({width:1280,height:720});await key('Home');
 // #687: the minimap (real pointer input): a press centres the view at that course point, a drag pans, the toggle hides it.
 e=await ed();const x=e.extent,mp=await page.evaluate(()=>{const s=document.querySelector('#rider-chrome-map svg')?.getBoundingClientRect();return s&&{x:s.left,y:s.top,w:s.width,h:s.height};});
 assert.ok(mp&&mp.w>0,'minimap shown');const expect=fx=>x[0]+(fx*640-8)/624*(x[1]-x[0]);
 const at=async fx=>{await page.mouse.click(mp.x+mp.w*fx,mp.y+mp.h/2);await pointer.frames(page,{n:8});return centre(await ed());};
 const a=await at(.25),b=await at(.75);
 for(const [c,fx] of [[a,.25],[b,.75]])assert.ok(Math.abs(c[0]-expect(fx))<=.02*(x[1]-x[0])+.5,'minimap press centres the view: '+JSON.stringify({c,expect:expect(fx)}));
 await page.mouse.move(mp.x+mp.w*.25,mp.y+mp.h/2);await page.mouse.down();await page.mouse.move(mp.x+mp.w*.5,mp.y+mp.h/2,{steps:6});await pointer.frames(page,{n:6});
 // Still dragging: the view follows (polled, as a slow runner may need more frames for the last move).
 const near=c=>Math.abs(c[0]-expect(.5))<=.02*(x[1]-x[0])+.5;let mid=centre(await ed());
 for(let i=0;i<40&&!near(mid);i++){await pointer.frames(page,{n:2});mid=centre(await ed());}
 await page.mouse.up();assert.ok(near(mid),'minimap drag pans the view: '+JSON.stringify({mid,expect:expect(.5),a,b,mp,camera:(await ed()).camera,log:await page.evaluate(()=>window.riderChrome.mapLog)}));
 // y: a press near the top centres higher than one near the bottom.
 const tb=async fy=>{await page.mouse.click(mp.x+mp.w*.5,mp.y+mp.h*fy);await pointer.frames(page,{n:8});return centre(await ed())[1];};
 const top=await tb(.15),bottom=await tb(.85);assert.ok(top>bottom,'minimap y orientation: '+JSON.stringify({top,bottom}));
 // The status line under the view bar stays readable: the bar ends above it.
 const line=await page.evaluate(()=>{const c=document.querySelector('canvas'),r=c.getBoundingClientRect(),b=document.getElementById('rider-chrome-view').getBoundingClientRect();return {bar:b.bottom,text:r.bottom-18*r.height/720};});
 assert.ok(line.bar<=line.text,'view bar clear of the status line: '+JSON.stringify(line));
 const win=await page.evaluate(()=>{const r=document.querySelector('#rider-chrome-map .win');return +r.getAttribute('width');});assert.ok(win>0,'view window drawn');
 await page.locator('#rider-chrome-view [data-act=minimap]').click();await pointer.frames(page,{n:4});assert.equal(await page.locator('#rider-chrome-map').isVisible(),false,'toggle hides the minimap');
 await page.locator('#rider-chrome-view [data-act=minimap]').click();await pointer.frames(page,{n:4});assert.equal(await page.locator('#rider-chrome-map').isVisible(),true);
 // #717: collapsing the library keeps the minimap (the toggle alone decides); expanding restores the library.
 await button('collapse_tools');await page.waitForFunction(()=>document.getElementById('rider-chrome-dock').classList.contains('closed'));
 assert.equal(await page.locator('#rider-chrome-map').isVisible(),true,'minimap stays with a collapsed library');
 await button('collapse_tools');await page.waitForFunction(()=>!document.getElementById('rider-chrome-dock').classList.contains('closed'));
 // #717: a real wheel over the library scrolls the library, never the world; over the canvas it still zooms.
 {const cam0=JSON.stringify((await ed()).camera),lib=await page.locator('#rider-chrome-dock').boundingBox();
  await page.mouse.move(lib.x+lib.width/2,lib.y+lib.height/2);await pointer.frames(page,{n:2});await page.mouse.wheel(0,-240);await pointer.frames(page,{n:8});
  assert.equal(JSON.stringify((await ed()).camera),cam0,'a wheel over the library moved the world');
  const u=(await ed()).usable,q=await canvas((u.x0+u.x1)/2,(u.y0+u.y1)/2);await page.mouse.move(q.x,q.y);await pointer.frames(page,{n:2});await page.mouse.wheel(0,-120);await pointer.frames(page,{n:8});
  assert.notEqual(JSON.stringify((await ed()).camera),cam0,'a wheel over the canvas still zooms');}
 measurements.minimap={presses:[a[0],b[0]],drag:mid[0],extent:x};
 await key('Home');await unchanged(before,'zoom entry/buttons/wheel/Fit/resize/minimap');
 measurements.editor_zoom={limits:[1,400],exact_100:true,invalid_preserved:true,fit,extents};cases.push('editor_zoom_entry_steps_anchor_limits_and_source_invariance');
};
