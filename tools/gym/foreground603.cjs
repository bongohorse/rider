'use strict';
// Real mouse camera controls and keyboard drive input on the imported Meadow level.
// Reuses bg548's authored import and read-only renderer observer; no debug pose writes.
const assert=require('node:assert/strict'),path=require('node:path'),pointer=require('./pointer.cjs');
// Compare framebuffer pixels immediately before/after the foreground draw. This
// proves real shader cutouts over existing art, independent of telemetry alone.
function observe(){
 const programs=new WeakMap();
 for(const proto of [window.WebGLRenderingContext?.prototype,window.WebGL2RenderingContext?.prototype].filter(Boolean)){
  for(const name of ['drawArrays','drawElements','drawArraysInstanced','drawElementsInstanced']){
   if(!proto[name])continue;
   const draw=proto[name];proto[name]=function(...args){
    const program=this.getParameter(this.CURRENT_PROGRAM);
    if(program&&!programs.has(program))programs.set(program,this.getAttachedShaders(program).some(s=>this.getShaderSource(s).includes('vehicle_cutout')));
    const c=window.riderBackgroundState?.layers[5]?.cutout;
    if(!programs.get(program)||!c||c[1]<.08||c[1]>.27)return draw.apply(this,args);
    const x=Math.floor(c[0]*this.drawingBufferWidth/4)*4,y=Math.floor((c[1]*this.drawingBufferHeight-90)/4)*4;
    if(x<0||y<0||x+16>=this.drawingBufferWidth)return draw.apply(this,args);
    const before=new Uint8Array(16*16*4),after=new Uint8Array(before.length);
    this.readPixels(x,y,16,16,this.RGBA,this.UNSIGNED_BYTE,before);
    const result=draw.apply(this,args);this.readPixels(x,y,16,16,this.RGBA,this.UNSIGNED_BYTE,after);
    // Exact oracle: the same per-pixel threshold and coverage as main/backgrounds/foreground.fp.
    const smooth=(l,h,v)=>{const t=Math.max(0,Math.min(1,(v-l)/(h-l)));return t*t*(3-2*t);};
    const bayer=(a,b)=>2*a+3*b-4*a*b;
    const old=window.riderForegroundPixels||{frames:0,kept:0,dropped:0,violations:0};
    let changed=0,kept=0,dropped=0,violations=0;
    for(let j=0;j<16;j++)for(let i=0;i<16;i++){
     const n=(j*16+i)*4,different=[0,1,2].some(k=>before[n+k]!==after[n+k]);changed+=different?1:0;
     const fx=x+i,fy=y+j,cx=fx%4,cy=fy%4;
     const threshold=(4*bayer(cx%2,cy%2)+bayer(cx>>1,cy>>1)+.5)/16;
     const r=Math.hypot(((fx+.5)/this.drawingBufferWidth-c[0])/c[2],((fy+.5)/this.drawingBufferHeight-c[1])/c[3]);
     const coverage=.25+.75*smooth(.35,1,r);
     // Skip pixels within rounding of the feather edge.
     if(Math.abs(threshold-coverage)<.01)continue;
     if(threshold>coverage){dropped++;if(different)violations++;}else if(different)kept++;
    }
    window.riderForegroundPixels={x,y,changed,frames:old.frames+1,kept:old.kept+kept,dropped:old.dropped+dropped,violations:old.violations+violations};return result;
   };
  }
 }
}
async function run(page,out,state){
 // #678: the camera is a play bar button and a kit menu (real mouse clicks on the DOM buttons).
 async function tap(sel){
  const pt=await page.evaluate(sel=>{const b=document.querySelector(sel).getBoundingClientRect();return {x:(b.left+b.right)/2,y:(b.top+b.bottom)/2};},sel);
  await pointer.tap(page,pt);
 }
 await page.waitForFunction(()=>window.riderCamera443&&document.querySelector('#rider-playbar [data-act="camera"]'));
 await tap('#rider-playbar [data-act="camera"]');await page.waitForFunction(()=>window.riderCamera443.open&&!document.querySelector('#rider-playbar .pb-campanel').hidden);
 for(let i=0;i<15;i++)await tap('#rider-playbar [data-act="cam:step:offset:1"]');
 for(let i=0;i<8;i++)await tap('#rider-playbar [data-act="cam:step:zoom:1"]');
 await page.waitForFunction(()=>window.riderCamera443.values.offset===150&&window.riderCamera443.values.zoom===1.4);
 await tap('#rider-playbar [data-act="cam:close"]');
 // Follow the real moving vehicle: the overlap must be present in the screenshot.
 await page.keyboard.down('ArrowUp');
 let before,after,command;
 try{
  await page.waitForFunction(()=>{const s=window.riderBackgroundState,l=s?.layers[5];return l?.cutout&&l.cutout[1]<.27&&l.cutout[1]>0;},null,{timeout:15000});
  await page.waitForFunction(()=>window.riderTelemetry?.command?.throttle===1,null,{timeout:5000});
  before=await state();await page.waitForFunction(()=>{const p=window.riderForegroundPixels;return p&&(p.violations>0||p.frames>=20&&p.kept>=1000&&p.dropped>=1000);},null,{timeout:10000});await pointer.frames(page,{n:20});after=await state();
  assert(after.layers[5].cutout[1]<.3,'Vehicle left foreground overlap');
  await page.screenshot({path:path.join(out,'foreground603-driving.png')});
  command=await page.evaluate(()=>window.riderTelemetry.command);
 }finally{await page.keyboard.up('ArrowUp');}
 assert.notDeepEqual(before.layers[5].uv,after.layers[5].uv,'Real drive input did not scroll foreground');
 assert.equal(command.throttle,1,'Throttle must be read while the key is still held');
 for(const s of [before,after]){
  const l=s.layers[5];assert(l.rendered);assert.equal(l.uv[1],.5);assert.equal(l.uv[3],.5);
  assert(l.cutout[2]>0&&l.cutout[3]>0);assert.equal(s.source.preset,'meadow');
 }
 const pixels=await page.evaluate(()=>window.riderForegroundPixels);
 // Art has gaps between blades, so judge many frames: pixels the shader must discard never change,
 // and both drawn and discarded pixels occur. A moving phase or missing dither produces violations.
 assert.equal(pixels.violations,0,'A pixel the dither must discard was drawn');
 assert(pixels.kept>=1000&&pixels.dropped>=1000,'Dither not exercised: '+JSON.stringify(pixels));
 return {before,after,pixels,command,input:'mouse Height +150, Zoom 1.4; ArrowUp',screenshot:'foreground603-driving.png'};
}
module.exports={run,observe};
