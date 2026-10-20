// A19b Bumps station geometry. The source is an editor document of Flat and Bump/wave prefabs; the
// editor's own compiler (LE5b sampling, 5 mm / 0.5 m) turns it into the station chain through Import and
// Export in the debug gym. An export is a generic custom level, so the station id, kind, sections,
// labels, bounds and start speed are added here explicitly. `node tools/gym/bumps_station.cjs` writes
// both files; the a19b case recompiles and compares them.
const assert=require('node:assert/strict');
// World metres, ground at y = 0, left to right. Wave ladder: five heights, a long (3 m) and a short
// (1 m) wavelength; counts keep the station below the 800 render objects of a station.
const HEIGHTS=[0.05,0.1,0.15,0.2,0.3];
const LADDERS=[{prefix:'long',wavelength:3,count:3},{prefix:'short',wavelength:1,count:6}];
// Crest-dip: single cosine crests, then dips, of 0.4 m and decreasing wavelength, i.e. increasing
// curvature h/2 (2 pi / wavelength)^2 at the apex.
const CREST_HEIGHT=0.4,CREST_WAVELENGTHS=[8,6,4,3];
const RUN_IN=5,RUN_OUT=6,BETWEEN=6,LEAD=10,TAIL=10,MARGIN=5;
const SPAWN_Y=0.9,START_SPEED=5;
const SOURCE={id:'bumps-source',name:'Bumps station source',file:'tools/gym/bumps-source.json'};
const STATION_FILE='main/gym/stations/bumps.json';
const fmt=x=>String(Number(x.toFixed(6)));
function layout(){
 const objects=[],sections=[],labels=[];
 let x=-LEAD;
 const add=(kind,params)=>{const o={id:'o'+(objects.length+1),type:'prefab',kind,at:[Number(x.toFixed(6)),0],params};objects.push(o);
  x+=kind==='flat'?params.length:params.wavelength*params.count;return o;};
 add('flat',{length:LEAD});
 const feature=(id,type,height,wavelength,count)=>{
  const start=x;add('wave',{height,wavelength,count});
  return {id,type,start_x:Number(start.toFixed(6)),end_x:Number(x.toFixed(6)),height,wavelength,count};
 };
 const section=(id,name,features)=>{
  // Measurement window of each feature: chassis centre from 0.5 m before its start (front wheel 0.46 m
  // ahead) to 1.5 m after its end (rear wheel past it plus 1 m).
  sections.push({id,name,mode:'up',spawn:[features.spawn,SPAWN_Y],start_speed:START_SPEED,features:features.list,
   end_x:Number((features.list.at(-1).end_x+1.5).toFixed(6))});
 };
 for(const ladder of LADDERS)for(const height of HEIGHTS){
  const spawn=x;add('flat',{length:RUN_IN});
  const f=feature('waves','waves',height,ladder.wavelength,ladder.count);
  const id=`${ladder.prefix}-${fmt(height)}`;
  section(id,`${fmt(height)} m x ${ladder.wavelength} m waves`,{spawn,list:[f]});
  labels.push({position:[Number(((f.start_x+f.end_x)/2).toFixed(6)),height+1.3],text:`h ${fmt(height)} m trough-crest, ${ladder.wavelength} m waves`});
  add('flat',{length:RUN_OUT});
 }
 const spawn=x,list=[];add('flat',{length:RUN_IN});
 for(const [type,sign] of [['crest',1],['dip',-1]])for(const wavelength of CREST_WAVELENGTHS){
  if(list.length)add('flat',{length:BETWEEN});
  const f=feature(`${type}-${wavelength}`,type,sign*CREST_HEIGHT,wavelength,1);list.push(f);
  labels.push({position:[Number(((f.start_x+f.end_x)/2).toFixed(6)),CREST_HEIGHT+1.3],text:`${type.toUpperCase()} ${fmt(CREST_HEIGHT)} m ${type==='crest'?'high':'deep'}, ${wavelength} m`});
 }
 section('crest-dip','Crests and dips 0.4 m, 8/6/4/3 m',{spawn,list});
 add('flat',{length:TAIL+MARGIN});
 const connections=objects.slice(1).map((o,i)=>({from:objects[i].id,to:o.id}));
 const bounds=[-LEAD+MARGIN,Number((x-MARGIN).toFixed(6)),-6,20];
 return {objects,connections,sections,labels,bounds};
}
// The editor source: a version 4 document (level-editor contract, LE5b) with START at the first section.
function source(){
 const l=layout(),start=l.sections[0].spawn;
 const editor={editor_version:4,compiler_version:4,sampling:{tolerance:0.005,max_segment:0.5},revision:1,next_id:l.objects.length+1,
  objects:l.objects,connections:l.connections,start:{position:start,speed:START_SPEED}};
 // Import needs compiled fields; a level file without matching compiled data opens as its source (LE4).
 return {schema:1,units:'metres',id:SOURCE.id,name:SOURCE.name,spawn:start,start_speed:START_SPEED,run_in:0,run_out:0,
  bounds:l.bounds,chains:[[[l.bounds[1],0],[l.bounds[0],0]]],hulls:[],labels:[],checkpoints:[],editor};
}
// Station JSON from the editor export: the compiled chain only, plus the explicit station metadata.
function station(exported){
 const l=layout();
 assert.equal(exported.chains.length,1,'one connected run compiles into one chain');
 assert.equal(exported.two_sided,undefined);assert.deepEqual(exported.hulls,[]);
 assert.deepEqual(exported.editor.sampling,{tolerance:0.005,max_segment:0.5});
 return {schema:1,id:'bumps',name:'Bumps',kind:'bumps',units:'metres',spawn:l.sections[0].spawn,start_speed:START_SPEED,
  run_in:RUN_IN,run_out:RUN_OUT,bounds:l.bounds,chains:exported.chains,labels:l.labels,sections:l.sections};
}
const text=v=>JSON.stringify(v,null,1)+'\n';
// Import the source into the editor of the debug gym and export it. The editor publishes its state
// (window.riderEditor) only under its own probe cases, so this page runs as `le5b`; nothing is driven.
async function compile(browser,base,runId){
 const {configure}=require('./launch.cjs');
 const page=await browser.newPage({viewport:{width:1280,height:720},acceptDownloads:true});
 try{await configure(page,runId,'le5b');return await compiled(page,base);}finally{await page.close();}
}
async function compiled(page,base){
 const ed=()=>page.evaluate(()=>window.riderEditor);
 async function key(name){await page.keyboard.down(name);await page.waitForTimeout(90);await page.keyboard.up(name);await page.waitForTimeout(60);}
 const canvas=(x,y)=>page.evaluate(([x,y])=>{const c=document.querySelector('canvas'),r=c.getBoundingClientRect();return {x:r.x+x/c.width*r.width,y:r.y+(1-y/c.height)*r.height};},[x,y]);
 async function button(name){
  const e=await ed();assert.ok(e.visible.includes(name),name+' not visible: '+e.visible.join(','));
  const b=e.buttons[name],at=await canvas(b.x,b.y);
  await page.mouse.move(at.x,at.y);await page.waitForTimeout(50);await page.mouse.down();await page.waitForTimeout(90);await page.mouse.up();await page.waitForTimeout(60);
 }
 await page.goto(base+'?station=straight');
 await page.waitForFunction(()=>window.riderTelemetry?.station==='straight'&&window.riderTelemetry.sequence>2);
 await page.locator('canvas').focus();await key('e');
 await page.waitForFunction(()=>window.riderEditor?.mode==='edit'&&window.riderEditor.view&&window.riderEditor.screen,null,{timeout:20000});
 await page.waitForTimeout(150);
 await button('import');await page.waitForFunction(()=>window.riderCustom.visible&&document.getElementById('rider-custom-file'));
 await page.locator('#rider-custom-file').setInputFiles({name:'bumps-source.json',mimeType:'application/json',buffer:Buffer.from(text(source()))});
 await page.waitForFunction(()=>!window.riderCustom.visible);await page.waitForTimeout(1100);
 const e=await ed();assert.ok(e.message.startsWith('Imported'),e.message);assert.equal(e.problem,'',e.problem);
 const [download]=await Promise.all([page.waitForEvent('download'),button('export')]);
 const exported=JSON.parse(require('node:fs').readFileSync(await download.path(),'utf8'));
 await page.getByRole('button',{name:'Close export',exact:true}).click();await page.waitForTimeout(1100);
 return station(exported);
}
module.exports={layout,source,station,compile,text,SOURCE,STATION_FILE,START_SPEED};
