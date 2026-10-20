// A19d Balance station geometry (metres). Writes main/gym/stations/balance.json; --check compares.
// node tools/gym/balance_geometry.cjs [--check]
// Floor at 0.8 m (the gym ground level); raised decks 0.8 m above it. Every section is independent:
// its own start deck (spawn 1.2 m from the deck start, start speed 0), its target platform and a cliff
// back to the floor. Falling to the floor is a miss. One descending-x chain like the other stations.
const fs=require('node:fs'),path=require('node:path');
const ROOT=path.resolve(__dirname,'../..'),FILE='main/gym/stations/balance.json';
const FLOOR=0.8,DECK=1.6,START=3,SLOT=0.3,RUN_OUT=4,SPAWN_IN=1.2,SPAWN_UP=0.9;
const RAMP_DEG=35,RAMP_RISE=0.4;
// Plank: station geometry, matched by the seesaw resource (seesaw.convexshape, seesaw.collisionobject).
const PLANK={length:4,thickness:0.08,taper:0.3,mass:20,pivot_height:0.5,pedestal_drop:0.12,pedestal_half_width:0.3,deck_overlap:0.25,limit_deg:25};
const r6=v=>Math.round(v*1e6)/1e6;
function build(){
 const pts=[[-5,FLOOR]],sections=[],labels=[];let x=0,seesaw=null;
 const to=(px,py)=>{px=r6(px);py=r6(py);const l=pts.at(-1);if(Math.abs(l[0]-px)>1e-9||Math.abs(l[1]-py)>1e-9)pts.push([px,py]);};
 function start(height){to(x,FLOOR);to(x,height);const s0=x;x+=START;to(x,height);return [r6(s0+SPAWN_IN),r6(height+SPAWN_UP)];}
 function cliff(height,id,name,type,spawn,t0,t1,extra){
  to(x,FLOOR);const end=x;x+=RUN_OUT;
  sections.push({id,name,mode:'up',type,spawn,start_speed:0,target_x0:r6(t0),target_x1:r6(t1),target_y:r6(height),end_x:r6(end),...extra});
  labels.push({position:[r6((t0+t1)/2),r6(height+1.4)],text:name});
 }
 // Beams: a 0.3 m slot (narrower than a wheel) separates the start deck from a beam of length L.
 for(const L of [2,1.5,1.2,1.05]){
  const spawn=start(DECK);to(x,FLOOR);x+=SLOT;to(x,FLOOR);to(x,DECK);const t0=x;x+=L;to(x,DECK);
  cliff(DECK,'beam-'+L,`BEAM ${L} m`,'beam',spawn,t0,x);
 }
 const run=RAMP_RISE/Math.tan(RAMP_DEG*Math.PI/180);
 // Steep short climb onto a 2 m platform.
 {const spawn=start(DECK);x+=run;to(x,DECK+RAMP_RISE);const t0=x;x+=2;to(x,DECK+RAMP_RISE);
  cliff(DECK+RAMP_RISE,'up',`UP ${RAMP_RISE} m ${RAMP_DEG} DEG`,'up',spawn,t0,x);}
 // Steep short descent onto a 2 m platform.
 {const spawn=start(DECK+RAMP_RISE);x+=run;to(x,DECK);const t0=x;x+=2;to(x,DECK);
  cliff(DECK,'down',`DOWN ${RAMP_RISE} m ${RAMP_DEG} DEG`,'down',spawn,t0,x);}
 // Seesaw: plank on a pivot 0.5 m above the decks. At rest its left tip lies on the start deck; tipped,
 // its right tip lies on the exit deck. A thin pedestal rises from the floor to just below the pivot.
 {const spawn=start(DECK),half=PLANK.length/2,rest=Math.asin(PLANK.pivot_height/half),reach=half*Math.cos(rest);
  const px=x-PLANK.deck_overlap+reach,py=DECK+PLANK.pivot_height;
  // The start deck ends deck_overlap past the resting tip.
  x=px-reach+PLANK.deck_overlap;to(x,DECK);to(x,FLOOR);
  to(px-PLANK.pedestal_half_width,FLOOR);to(px,py-PLANK.pedestal_drop);to(px+PLANK.pedestal_half_width,FLOOR);
  x=px+reach-PLANK.deck_overlap;to(x,FLOOR);to(x,DECK);const exit0=x;x+=2.5;to(x,DECK);
  seesaw={pivot:[r6(px),r6(py)],length:PLANK.length,thickness:PLANK.thickness,taper:PLANK.taper,mass:PLANK.mass,
   rest_angle:r6(rest),limit:r6(PLANK.limit_deg*Math.PI/180),section:'seesaw'};
  // Target: the exit deck beyond the tipped plank's tip.
  cliff(DECK,'seesaw','SEESAW','seesaw',spawn,px+reach+0.1,x,{deck_x0:r6(exit0)});}
 to(x,FLOOR);x+=1;to(x,FLOOR);
 const chain=pts.slice().reverse();
 return {schema:1,id:'balance',name:'Balance',kind:'balance',units:'metres',spawn:sections[0].spawn,start_speed:0,run_in:0,run_out:RUN_OUT,
  bounds:[-5,r6(x+1),-8,20],chains:[chain],hulls:[],labels,sections,seesaw};
}
const text=d=>JSON.stringify(d,null,1)+'\n';
module.exports={build,text,FILE,PLANK};
if(require.main===module){
 const flag=process.argv[2],bytes=text(build()),file=path.join(ROOT,FILE);
 if(flag==='--check'){if(!fs.existsSync(file)||fs.readFileSync(file,'utf8')!==bytes)throw Error(FILE+' is stale (run node tools/gym/balance_geometry.cjs)');console.log('PASS');}
 else{fs.writeFileSync(file,bytes);console.log('written '+FILE);}
}
