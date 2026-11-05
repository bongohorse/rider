'use strict';
// Page-init observer. Explicit API handle/payload accounting only; this is not physical GPU memory.
function installBufferObserver(){
 const p=window.__buffers={live:new Map(),targets:new Map(),ids:new Map(),contexts:new Set(),created:0,deleted:0,failed_creates:0,next:0};
 for(const proto of [window.WebGLRenderingContext?.prototype,window.WebGL2RenderingContext?.prototype].filter(Boolean)){
  const bindings=new WeakMap(),create=proto.createBuffer,del=proto.deleteBuffer,bind=proto.bindBuffer,data=proto.bufferData;
  const bound=ctx=>{let b=bindings.get(ctx);if(!b){b=new Map();bindings.set(ctx,b);p.contexts.add(ctx);}return b;};
  proto.createBuffer=function(...args){p.contexts.add(this);const b=create.apply(this,args);if(b){p.created++;p.live.set(b,0);p.ids.set(b,++p.next);p.targets.set(b,new Set());}else p.failed_creates++;return b;};
  proto.deleteBuffer=function(b){const result=del.call(this,b);if(p.live.delete(b)){p.deleted++;p.ids.delete(b);p.targets.delete(b);}return result;};
  proto.bindBuffer=function(target,b){const result=bind.call(this,target,b);bound(this).set(target,b);if(b&&p.targets.has(b))p.targets.get(b).add(target);return result;};
  for(const name of ['bindBufferBase','bindBufferRange'])if(typeof proto[name]==='function'){
   const original=proto[name];proto[name]=function(...args){const result=original.apply(this,args),target=args[0],b=args[2];bound(this).set(target,b);if(b&&p.targets.has(b))p.targets.get(b).add(target);return result;};
  }
  proto.bufferData=function(target,d,...args){
   const result=data.call(this,target,d,...args),b=bound(this).get(target);
   if(b){
    let bytes=typeof d==='number'?d:d?.byteLength||0;
    // WebGL2 length=0 means the remaining typed elements; DataView offsets/lengths are bytes.
    if(typeof d!=='number'&&args.length>=2){const width=d.BYTES_PER_ELEMENT||1,n=d.length??d.byteLength;bytes=((args[2]||0)===0?n-args[1]:args[2])*width;}
    p.live.set(b,bytes);
   }
   return result;
  };
 }
}
function bufferSnapshot(){
 const p=window.__buffers,histogram={},uniform_histogram={},buffers=[];
 for(const [buffer,bytes] of p.live){
  histogram[bytes]=(histogram[bytes]||0)+1;
  const targets=[...p.targets.get(buffer)];if(targets.includes(35345))uniform_histogram[bytes]=(uniform_histogram[bytes]||0)+1;
  buffers.push({id:p.ids.get(buffer),bytes,targets});
 }
 return {created:p.created,deleted:p.deleted,live:p.live.size,failed_creates:p.failed_creates,histogram,uniform_histogram,buffers,
  contexts:[...p.contexts].map(gl=>{
   const ext=gl.getExtension?.('WEBGL_debug_renderer_info');
   return {version:gl.getParameter(gl.VERSION),vendor:gl.getParameter(gl.VENDOR),renderer:gl.getParameter(gl.RENDERER),
    unmasked_renderer:ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):null,context_lost:gl.isContextLost?.()??null};
  })};
}
module.exports={installBufferObserver,bufferSnapshot};
