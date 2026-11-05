'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm');
const {installBufferObserver,bufferSnapshot}=require('../../tools/terrain_play/buffer_observer.cjs');
function fixture(){
 class GL{
  constructor(){this.calls=[];this.VERSION='version';this.VENDOR='vendor';this.RENDERER='renderer';}
  createBuffer(){this.calls.push(['create']);return this.fail?null:{};}
  deleteBuffer(b){this.calls.push(['delete',b]);return 'deleted';}
  bindBuffer(...args){this.calls.push(['bind',...args]);return 'bound';}
  bindBufferBase(...args){this.calls.push(['base',...args]);return 'base';}
  bindBufferRange(...args){this.calls.push(['range',...args]);return 'range';}
  bufferData(...args){this.calls.push(['data',...args]);return 'uploaded';}
  getParameter(key){return 'fixture-'+key;}
  isContextLost(){return false;}
 }
 const window={WebGLRenderingContext:GL},context=vm.createContext({window});
 vm.runInContext('('+installBufferObserver.toString()+')()',context);
 return {GL,window,snapshot:()=>JSON.parse(vm.runInContext('JSON.stringify(('+bufferSnapshot.toString()+')())',context))};
}
test('observer preserves API results/arguments, context bindings and explicit uniform-buffer attribution',()=>{
 const {GL,window,snapshot}=fixture(),a=new GL(),b=new GL(),one=a.createBuffer(),two=b.createBuffer();
 assert.equal(a.bindBuffer(35345,one),'bound');assert.equal(b.bindBuffer(34962,two),'bound');
 assert.equal(a.bufferData(35345,16,35048),'uploaded');assert.equal(b.bufferData(34962,64,35048),'uploaded');
 let s=snapshot();assert.equal(s.live,2);assert.equal(s.uniform_histogram[16],1);assert.equal(s.uniform_histogram[64],undefined);
 assert.equal(s.contexts.length,2);assert.equal(window.__buffers.live.get(one),16);assert.equal(window.__buffers.live.get(two),64);
 assert.deepEqual(a.calls.at(-1),['data',35345,16,35048]);
 const third=a.createBuffer();a.bindBufferBase(35345,0,third);a.bufferData(35345,32,35048);assert.equal(window.__buffers.live.get(third),32);
 a.bindBufferRange(35345,0,one,0,16);a.bufferData(35345,48,35048);assert.equal(window.__buffers.live.get(one),48);
 assert.equal(a.deleteBuffer(one),'deleted');s=snapshot();assert.equal(s.created-s.deleted,s.live);assert.equal(s.live,2);
 b.fail=true;assert.equal(b.createBuffer(),null);assert.equal(snapshot().failed_creates,1);assert.equal(snapshot().live,2);
});
test('WebGL2 subrange/default-zero lengths and DataView byte units match the primary API contract',()=>{
 const {GL,window}=fixture(),gl=new GL(),buffer=gl.createBuffer();gl.bindBuffer(34962,buffer);
 const data=new Uint16Array(10);gl.bufferData(34962,data,35044);assert.equal(window.__buffers.live.get(buffer),20);
 gl.bufferData(34962,data,35044,3);assert.equal(window.__buffers.live.get(buffer),14);
 gl.bufferData(34962,data,35044,3,0);assert.equal(window.__buffers.live.get(buffer),14);
 gl.bufferData(34962,data,35044,3,4);assert.equal(window.__buffers.live.get(buffer),8);
 gl.bufferData(34962,new DataView(new ArrayBuffer(20)),35044,3,0);assert.equal(window.__buffers.live.get(buffer),17);
});
