// #539: real browser check on the debug Gym bundle with the Meadow preset. At a crest and a valley the Band lies below
// the driving line and Fill below it; at Fit the Fill keeps its colour (no Band bleed from mipmaps). Real input only.
//   node tools/terrain_material/check_band.cjs <verified debug bundle> <out dir>
'use strict';
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const {chromium}=require('playwright'),{configure}=require('../gym/launch.cjs'),pointer=require('../gym/pointer.cjs');
const {loadFixtures}=require('../terrain_play/fixtures.cjs');
const [bundleArg,outArg]=process.argv.slice(2);
if(!bundleArg||!outArg)throw Error('Usage: node tools/terrain_material/check_band.cjs BUNDLE OUT');
const out=path.resolve(outArg);fs.mkdirSync(out,{recursive:true});
function find(d){for(const e of fs.readdirSync(d,{withFileTypes:true})){const p=path.join(d,e.name);if(e.isDirectory()){const v=find(p);if(v)return v;}else if(e.name==='index.html')return p;}}
const web=path.dirname(find(path.resolve(bundleArg)));
const server=http.createServer((q,r)=>{const f=path.join(web,new URL(q.url,'http://x').pathname);if(!f.startsWith(web)||!fs.existsSync(f)){r.writeHead(404);return r.end();}r.setHeader('Content-Type',f.endsWith('.wasm')?'application/wasm':f.endsWith('.js')?'text/javascript':f.endsWith('.json')?'application/json':'text/html');fs.createReadStream(f).pipe(r);});
const FIXTURE='mixed-over-budget';
(async()=>{
 await new Promise(ok=>server.listen(0,'127.0.0.1',ok));
 const d=JSON.parse(loadFixtures([FIXTURE])[FIXTURE]);d.editor.road_profile='perspective-v1';
 const chain=d.chains[0],browser=await chromium.launch(),page=await browser.newPage({viewport:{width:1280,height:720}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(/ERROR:/.test(m.text()))errors.push(m.text());});
 await configure(page,'band-539','le6');
 await page.goto('http://127.0.0.1:'+server.address().port+'/index.html?station=straight&terrain_material=meadow');
 await page.waitForFunction(()=>window.riderTelemetry?.sequence>2,null,{timeout:90000});
 const generation=await page.evaluate(()=>window.riderTelemetry.session_generation);
 await page.evaluate(body=>{window.riderCustom.open();window.riderCustom.importFile(new File([body],'band.json',{type:'application/json'}));},JSON.stringify(d));
 await page.waitForFunction(g=>window.riderTelemetry?.session_generation>g&&window.riderTelemetry.sequence>2,generation,{timeout:30000});
 await page.locator('canvas').focus();
 await page.keyboard.down('e');await pointer.frames(page,{n:3});await page.keyboard.up('e');
 await page.waitForFunction(()=>window.riderEditor?.mode==='edit'&&window.riderEditor.screen,null,{timeout:20000});
 const key=async k=>{await page.keyboard.down(k);await pointer.frames(page,{n:3});await page.keyboard.up(k);await pointer.frames(page,{n:30});await page.waitForTimeout(500);};
 const map=()=>page.evaluate(()=>{const e=window.riderEditor,c=document.querySelector('canvas'),r=c.getBoundingClientRect();return {s:e.screen,k:r.width/c.width,h:r.height,y:r.y,x:r.x,zoom:e.camera.zoom,usable:e.usable};});
 const at=(e,mx,my)=>({x:e.x+(e.s.ox+mx*e.s.ppm_x)*e.k,y:e.y+e.h-(e.s.oy+my*e.s.ppm_y)*e.k});
 const patch=async(name,points,size)=>{const file=path.join(out,name+'.png');await page.screenshot({path:file});return page.evaluate(async({src,points,size})=>{const i=new Image();i.src=src;await i.decode();const k=document.createElement('canvas');k.width=i.width;k.height=i.height;const c=k.getContext('2d');c.drawImage(i,0,0);return points.map(q=>{const d=c.getImageData(Math.round(q.x-size/2),Math.round(q.y-size/2),size,size).data;let r=0,g=0,b=0;for(let j=0;j<d.length;j+=4){r+=d[j];g+=d[j+1];b+=d[j+2];}const n=d.length/4;return [r/n,g/n,b/n].map(Math.round);});},{src:'data:image/png;base64,'+fs.readFileSync(file).toString('base64'),points,size});};
 const results={fixture:FIXTURE,errors};
 // Fit: below the line by much more than the Band, the body must read as Fill (red above green), never Band green.
 await key('Home');let e=await map();
 const mid=chain[Math.floor(chain.length/2)],fit=await patch('fit',[at(e,mid[0],mid[1]-6),at(e,mid[0],mid[1]-12)],4);
 results.fit={zoom:e.zoom,pixels:fit};
 for(const [r,g] of fit)assert.ok(r-g>=15,'Band colour over the Fill at Fit: '+JSON.stringify(fit));
 // Find a crest and a valley with a real curve.
 const pick=sign=>{let best=null;for(let i=4;i<chain.length-4;i++){const c=sign*(chain[i][1]-(chain[i-4][1]+chain[i+4][1])/2);if(!best||c>best.c)best={c,p:chain[i]};}return best.p;};
 for(const [name,p] of [['crest',pick(1)],['valley',pick(-1)]]){
  e=await map();for(let i=0;i<34&&e.zoom<.8;i++){const q=at(e,p[0],p[1]);await page.mouse.move(q.x,q.y);await pointer.frames(page);await page.mouse.wheel(0,-120);await pointer.frames(page,{n:5});e=await map();}
  assert.ok(e.zoom>=.8,'zoom target');await page.waitForTimeout(500);e=await map();
  const px=await patch(name,[at(e,p[0],p[1]-.3),at(e,p[0],p[1]-2)],10);results[name]={point:p,zoom:e.zoom,band:px[0],fill:px[1]};
  assert.ok(px[0][1]>px[0][0],name+': no Band below the line: '+JSON.stringify(px));
  assert.ok(px[1][0]>px[1][1],name+': no Fill below the Band: '+JSON.stringify(px));
  await key('Home');
 }
 assert.deepEqual(errors,[]);
 fs.writeFileSync(path.join(out,'band-539.json'),JSON.stringify(results,null,1)+'\n');
 console.log(JSON.stringify(results));console.log('PASS');
 await browser.close();server.close();
})().catch(e=>{console.error(String(e.message||e));process.exit(1);});
