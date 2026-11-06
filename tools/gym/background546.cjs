'use strict';
// bg546: real engine rendering, named debug camera poses and resource lifecycle; no device claims.
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const {chromium}=require('playwright'),{configure}=require('./launch.cjs'),pointer=require('./pointer.cjs');
const EXPECTED=['empty','depth_xy','vertical_edges','foreground_safe','layer_toggle','master_restore','missing_fallback','world_teardown','resource_cycles','steep_605'];
function observe(){
 const state=window.__bg546={textures:new Map(),gl:null,pixels:[],draws:0};
 const get=HTMLCanvasElement.prototype.getContext;
 HTMLCanvasElement.prototype.getContext=function(...a){const gl=get.apply(this,a);if(gl&&['webgl','webgl2','experimental-webgl'].includes(a[0]))state.gl=gl;return gl;};
 for(const proto of [window.WebGLRenderingContext?.prototype,window.WebGL2RenderingContext?.prototype].filter(Boolean)){
  for(const name of ['drawArrays','drawElements','drawArraysInstanced','drawElementsInstanced'])if(proto[name]){const draw=proto[name];proto[name]=function(...a){state.draws++;return draw.apply(this,a);};}
  const tex=proto.texImage2D,del=proto.deleteTexture;
  proto.texImage2D=function(...a){const result=tex.apply(this,a);if(a.length>=9&&a[1]===0)state.textures.set(this.getParameter(this.TEXTURE_BINDING_2D),[a[3],a[4]]);return result;};
  proto.deleteTexture=function(t){state.textures.delete(t);return del.call(this,t);};
 }
 const raf=window.requestAnimationFrame.bind(window);
 window.requestAnimationFrame=cb=>raf(t=>{const before=state.draws;cb(t);const gl=state.gl;if(state.draws>before&&gl&&gl.drawingBufferWidth){state.pixels=[.05,.1,.15,.3,.45,.55,.65,.75].map(y=>{const p=new Uint8Array(4);gl.readPixels(Math.floor(gl.drawingBufferWidth*.85),Math.floor(gl.drawingBufferHeight*y),1,1,gl.RGBA,gl.UNSIGNED_BYTE,p);return Array.from(p);});}});
}
async function main(){
 const [outArg,sha,runId,kind,bundleArg]=process.argv.slice(2);assert.equal(kind,'bg546');assert(bundleArg&&runId&&sha);
 const out=path.resolve(outArg);fs.mkdirSync(out,{recursive:true});const bundle=path.resolve(bundleArg);
 const manifest=JSON.parse(fs.readFileSync(path.join(bundle,'bundle.json')));assert.equal(manifest.source_sha,sha);
 const indexes=Object.keys(manifest.files).filter(x=>x.endsWith('/index.html')||x==='index.html');assert.equal(indexes.length,1);
 const web=path.dirname(path.join(bundle,indexes[0]));let browser,page,server;
 const report={schema_version:1,source_sha:sha,run_id:runId,status:'FAIL',cases:{},errors:[],evidence:{},not_run:['physical device','phone/GPU performance','preset art acceptance']};let seq=0;
 try{
  server=http.createServer((req,res)=>{const file=path.resolve(web,'.'+new URL(req.url,'http://localhost').pathname);if(!file.startsWith(web+path.sep)||!fs.existsSync(file)){res.writeHead(404);return res.end();}res.setHeader('Content-Type',file.endsWith('.wasm')?'application/wasm':file.endsWith('.js')?'text/javascript':file.endsWith('.html')?'text/html':'application/octet-stream');fs.createReadStream(file).pipe(res);});
  await new Promise(ok=>server.listen(0,'127.0.0.1',ok));browser=await chromium.launch();report.browser=browser.version();
  page=await browser.newPage({viewport:{width:1280,height:720},deviceScaleFactor:1});await configure(page,runId,kind);await page.addInitScript(observe);
  page.on('pageerror',e=>report.errors.push(e.message));page.on('console',m=>{if(/ERROR:SCRIPT|ERROR:RESOURCE|ERROR:GAMEOBJECT/.test(m.text()))report.errors.push(m.text());});
  await page.goto(`http://127.0.0.1:${server.address().port}/index.html?station=straight`);
  await page.waitForFunction(()=>window.riderBackgroundReport?.fixed_ticks>5&&window.riderTelemetry?.sequence>2,null,{timeout:60000});
  const snapshot=()=>page.evaluate(()=>({state:window.riderBackgroundReport,pixels:window.__bg546.pixels,layer_images:[...window.__bg546.textures.values()].filter(s=>s[0]===64&&s[1]===32).length}));
  async function command(action,data={}){
   const request={seq:++seq,action,...data};await page.evaluate(r=>window.riderBackgroundRequest=r,request);
   await page.waitForFunction(n=>window.riderBackgroundReport?.ack===n,seq,{timeout:10000});
   const first=await page.evaluate(()=>window.riderBackgroundReport.sequence);await page.waitForFunction(n=>window.riderBackgroundReport.sequence>=n+5,first,{timeout:10000});
   const s=await snapshot();assert.equal(s.state.error,false);assert.equal(s.state.source_sha,sha);assert.equal(s.state.run_id,runId);return s;
  }
  const config=(count=1)=>({enabled:true,layers:Array.from({length:count},(_,i)=>({image:`/main/backgrounds/fixtures/${i===5?'foreground':'grid'}.png`,visible:true,auto:false,depth:.5}))});
  const initial=await snapshot();assert.equal(initial.state.objects,0);assert.equal(initial.layer_images,0);report.cases.empty=initial;
  await command('set',{config:config()});const a=await command('pose',{pose:'sky'}),b=await command('pose',{pose:'sky_east'});
  assert(Math.abs(b.state.layers[0].uv[2]-a.state.layers[0].uv[2]-.125)<1e-6,'X Depth motion');
  const rise=await command('pose',{pose:'sky_rise'});
  const sky=6;for(const s of [a,b,rise])assert(Math.abs(s.pixels[sky][2]-180)<=2,'Motion sample is occluded by world/UI');report.evidence.motion_pixels={origin:a.pixels[sky],east:b.pixels[sky],rise:rise.pixels[sky]};assert(Math.abs((b.pixels[sky][0]-a.pixels[sky][0]+256)%256-32)<=2,'Framebuffer X motion ignored Depth: '+JSON.stringify(report.evidence.motion_pixels));
  assert(Math.abs(rise.pixels[sky][1]-a.pixels[sky][1])>=1,'Bounded Y motion missing from framebuffer');
  const far=config();far.layers[0].depth=1;await command('set',{config:far});
  const farOrigin=await command('pose',{pose:'sky'}),farEast=await command('pose',{pose:'sky_east'}),farRise=await command('pose',{pose:'sky_rise'});
  for(let c=0;c<4;c++)assert(Math.abs(farEast.pixels[sky][c]-farOrigin.pixels[sky][c])<=1,'Depth 1 framebuffer moved horizontally');
  assert.notEqual(farRise.state.layers[0].uv[3],farOrigin.state.layers[0].uv[3],'Depth must not suppress bounded vertical motion');
  await command('set',{config:config()});
  const high=await command('pose',{pose:'high'}),low=await command('pose',{pose:'low'});
  assert(Math.abs(high.state.layers[0].uv[3]-low.state.layers[0].uv[3]-.0125)<1e-6,'Bounded Y motion');report.cases.depth_xy={origin:a.state.layers[0],east:b.state.layers[0],high:high.state.layers[0],low:low.state.layers[0],pixels:{origin:a.pixels[sky],east:b.pixels[sky],rise:rise.pixels[sky],far_origin:farOrigin.pixels[sky],far_east:farEast.pixels[sky],far_rise:farRise.pixels[sky]}};
  for(const p of high.pixels)assert(p[1]>3&&p[1]<245&&Math.abs(p[2]-180)<=2&&p[3]===255,'High pose lost image interior: '+p);
  for(const p of low.pixels)assert(p[1]>3&&p[1]<245&&Math.abs(p[2]-180)<=2&&p[3]===255,'Low pose lost image interior: '+p);
  report.cases.vertical_edges={high:high.pixels,low:low.pixels};await page.screenshot({path:path.join(out,'low-edge.png')});
  await command('set',{config:config(6)});const foreground=await command('pose',{pose:'origin'}),l=foreground.state.layers[5],f=foreground.state.frame;
  assert(l.active&&l.rendered);assert.equal(l.rect.half_h,f.half_h);
  assert.equal(l.rect.y-l.rect.half_h,f.y-f.half_h);
  assert.equal(l.uv[1],.5);assert.equal(l.uv[3],.5);
  await page.screenshot({path:path.join(out,'foreground-safe.png')});
  // The translucent fixture now covers the full viewport; camera Y never clips it.
  const foregroundPixels=await command('pose',{pose:'low'});
  for(const p of foregroundPixels.pixels)assert(p[2]>=164&&p[2]<=168,'Foreground disappeared at low camera Y: '+p);
  const highForeground=await command('pose',{pose:'high'});
  assert.equal(highForeground.state.layers[5].rendered,true);
  assert.deepEqual(highForeground.state.layers[5].uv,foregroundPixels.state.layers[5].uv);
  report.cases.foreground_safe={visible:l,pixels:foregroundPixels.pixels,high:highForeground.state.layers[5]};
  await page.screenshot({path:path.join(out,'high-edge.png')});
  const slots=[];
  for(let index=1;index<=6;index++){
   const layerOff=await command('visible',{index,visible:false});assert.equal(layerOff.state.objects,5);assert.equal(layerOff.layer_images,5);assert.equal(layerOff.state.layers[index-1].visible,false);
   const layerOn=await command('visible',{index,visible:true});assert.equal(layerOn.state.objects,6);assert.equal(layerOn.layer_images,6);slots.push({index,off:layerOff.state.objects,on:layerOn.state.objects});
  }
  report.cases.layer_toggle={slots};
  await command('visible',{index:2,visible:false});const off=await command('enabled',{enabled:false});assert.equal(off.state.objects,0);assert.equal(off.state.buffers,0);assert.equal(off.layer_images,0);
  const restored=await command('enabled',{enabled:true});assert.equal(restored.state.objects,5);assert.equal(restored.state.layers[1].visible,false);assert.equal(restored.state.layers[0].visible,true);assert.deepEqual(restored.state.layers.map(l=>[l.visible,l.auto,l.depth]),off.state.layers.map(l=>[l.visible,l.auto,l.depth]));report.cases.master_restore={off:off.state,restored:restored.state};
  const fallback=await command('set',{config:{layers:[{image:'/main/backgrounds/fixtures/missing.png',preset_image:'/main/backgrounds/fixtures/grid.png'}]}});assert.equal(fallback.state.objects,1);report.cases.missing_fallback={objects:fallback.state.objects,images:fallback.layer_images};
  const generation=await page.evaluate(()=>window.riderTelemetry.session_generation);
  const fixture=fs.readFileSync('main/terrain_compare/courses/six-anchor.json','utf8');
  await page.evaluate(text=>{window.riderCustom.open();document.querySelector('#rider-custom-text').value=text;[...document.querySelectorAll('#rider-custom-panel button')].find(b=>b.textContent==='Import text').click();},fixture);
  await page.waitForFunction(n=>window.riderCustomStatus==='Saved'&&window.riderTelemetry?.session_generation>n&&window.riderBackgroundReport?.sequence>5,generation,{timeout:30000});
  await pointer.frames(page,{n:5});const fresh=await snapshot();assert.equal(fresh.state.objects,0);assert.equal(fresh.layer_images,0);report.cases.world_teardown={generation:await page.evaluate(()=>window.riderTelemetry.session_generation),objects:fresh.state.objects,images:fresh.layer_images};
  await command('set',{config:config()});
  for(let i=0;i<8;i++){const s=await command('enabled',{enabled:false});assert.equal(s.state.objects,0);assert.equal(s.layer_images,0);const s2=await command('enabled',{enabled:true});assert.equal(s2.state.objects,1);assert.equal(s2.layer_images,1);}
  const final=await command('enabled',{enabled:false});assert.equal(final.state.created,final.state.released);assert.equal(final.state.texture_bytes,0);report.cases.resource_cycles={cycles:8,final:final.state};
  // #605: load a real steep level through the ordinary custom import path.
  const steep=JSON.parse(fs.readFileSync('main/game/stations/straight.json','utf8'));
  steep.id='steep-605';steep.name='Steep background visibility';steep.bounds=[-100,450,-140,140];
  steep.spawn=[0,-118.3];steep.chains=[[[400,120],[300,120],[100,-120],[-40,-120]]];
  const oldGeneration=await page.evaluate(()=>window.riderTelemetry.session_generation);
  await page.evaluate(()=>window.riderCustom.open());await page.locator('#rider-custom-text').fill(JSON.stringify(steep));
  await page.getByRole('button',{name:'Import text',exact:true}).click();
  await page.waitForFunction(g=>window.riderCustomStatus==='Saved'&&window.riderTelemetry?.session_generation>g&&window.riderBackgroundReport?.sequence>5,oldGeneration,{timeout:30000});
  const meadow={layers:Array.from({length:5},(_,i)=>({image:`/main/background_presets/meadow/layer${i+1}.png`,auto:true}))};
  const captures={};
  for(const pose of ['steep_top','steep_bottom']){
   await command('set',{config:meadow});const all=await command('pose',{pose});
   assert.equal(all.state.objects,5);assert.equal(all.state.frame.level_min_y,-140);assert.equal(all.state.frame.level_max_y,140);
   const layers=all.state.layers.slice(0,5);
   let previous=0;
   for(const l of layers){
    assert(l.active&&l.rendered);assert(l.uv[3]-l.uv[1]<1&&l.uv[3]+l.uv[1]>0,'Image outside viewport');
    const travel=Math.abs(l.uv[3]-.5);assert(travel>previous,'Near layer must move more');previous=travel;
   }
   await page.screenshot({path:path.join(out,pose+'.png')});
   // Isolated captures make all five existing silhouettes inspectable, without foreground occlusion.
   for(let i=0;i<5;i++){
    const single={layers:meadow.layers.map((l,j)=>({...l,visible:i===j}))};
    await command('set',{config:single});await page.screenshot({path:path.join(out,`${pose}-layer${i+1}.png`)});
   }
   captures[pose]={frame:all.state.frame,layers,screenshot:pose+'.png'};
  }
  report.cases.steep_605=captures;
  assert(Math.abs(final.state.fixed_min-1/60)<1e-7&&Math.abs(final.state.fixed_max-1/60)<1e-7);assert.deepEqual(report.errors,[]);
  assert.deepEqual(Object.keys(report.cases),EXPECTED);report.status='PASS';
 }catch(e){report.failure=e.stack;if(page)await page.screenshot({path:path.join(out,'failure.png')}).catch(()=>{});}
 finally{fs.writeFileSync(path.join(out,'background546-result.json'),JSON.stringify(report,null,2)+'\n');if(browser)await browser.close();if(server)await new Promise(ok=>server.close(ok));}
 console.log(JSON.stringify({status:report.status,cases:Object.keys(report.cases),failure:report.failure}));return report.status==='PASS'?0:1;
}
module.exports={EXPECTED};if(require.main===module)main().then(code=>process.exitCode=code).catch(e=>{console.error(e);process.exitCode=1;});
