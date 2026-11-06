// #544: the first-run course with and without a level material, real debug build in headless Chromium: vertex payload,
// texture bytes uploaded, start time and frame intervals. Software rendering: frame times say nothing about a device.
//   node tools/terrain_material/measure_budgets.cjs <verified debug bundle> <out dir>
'use strict';
const fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const {chromium}=require('playwright'),{configure}=require('../gym/launch.cjs');
const {stats}=require('./observe.cjs');
const [bundleArg,outArg]=process.argv.slice(2);
const out=path.resolve(outArg);fs.mkdirSync(out,{recursive:true});
function find(d){for(const e of fs.readdirSync(d,{withFileTypes:true})){const p=path.join(d,e.name);if(e.isDirectory()){const v=find(p);if(v)return v;}else if(e.name==='index.html')return p;}}
const web=path.dirname(find(path.resolve(bundleArg)));
const server=http.createServer((q,r)=>{const f=path.join(web,new URL(q.url,'http://x').pathname);if(!f.startsWith(web)||!fs.existsSync(f)){r.writeHead(404);return r.end();}r.setHeader('Content-Type',f.endsWith('.wasm')?'application/wasm':f.endsWith('.js')?'text/javascript':f.endsWith('.json')?'application/json':'text/html');fs.createReadStream(f).pipe(r);});
function probe(){const p=window.__m={tex:0,levels:{},frames:[],start:performance.now(),ready:0};const P=WebGL2RenderingContext.prototype,t=P.texImage2D;P.texImage2D=function(...a){if(a.length>=9&&a[3]>0&&a[4]>0){p.tex+=a[3]*a[4]*4;const k=a[3]+'x'+a[4];p.levels[k]=(p.levels[k]||0)+1;}return t.apply(this,a);};const raf=requestAnimationFrame.bind(window);window.requestAnimationFrame=cb=>raf(x=>{p.frames.push(performance.now());return cb(x);});}
(async()=>{
 await new Promise(ok=>server.listen(0,'127.0.0.1',ok));
 const b=await chromium.launch(),results={};
 for(const [id,url] of [['untextured',''],['meadow','&terrain_material=meadow'],['city','&terrain_material=city']]){
  const c=await b.newContext({viewport:{width:1280,height:720}}),p=await c.newPage();await configure(p,'budget-'+id.replace(/\W/g,''),'le6');await p.addInitScript(probe);
  const t0=Date.now();await p.goto('http://127.0.0.1:'+server.address().port+'/index.html?station=first-run'+url);
  await p.waitForFunction(()=>window.riderRoadProjection?.sections>0&&window.riderTelemetry?.sequence>2,null,{timeout:90000});const ready=Date.now()-t0;
  await p.waitForTimeout(2000);const n=await p.evaluate(()=>window.__m.frames.length);await p.waitForTimeout(5000);
  const f=await p.evaluate(n=>window.__m.frames.slice(n),n);
  results[id]={ready_ms:ready,frame_ms:stats(f.slice(1).map((t,i)=>t-f[i])),texture_bytes:await p.evaluate(()=>window.__m.tex),textures:await p.evaluate(()=>window.__m.levels),stride:await p.evaluate(()=>window.riderRoadProjection.stride),mesh:await p.evaluate(()=>window.riderTerrainMesh&&{vertices:window.riderTerrainMesh.vertices,payload:window.riderTerrainMesh.buffer_bytes,cpu:window.riderTerrainMesh.budget&&window.riderTerrainMesh.budget.cpu_estimate})};
  await c.close();
 }
 await b.close();server.close();
 fs.writeFileSync(path.join(out,'budgets-544.json'),JSON.stringify(results,null,1)+'\n');console.log(JSON.stringify(results));
})().catch(e=>{console.error(String(e.message||e).slice(0,300));process.exit(1);});
