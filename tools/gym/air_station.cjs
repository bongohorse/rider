// Generates (or with --check compares) the A19c air control station: node tools/gym/air_station.cjs [--check]
// World metres; one right-to-left chain. Each section: a plateau run-in, a kicker to the lip, then a drop
// to a flat landing area or a downslope (with a circular transition to flat) and a long run-out. The next
// section starts with a wall up to its own plateau.
const fs=require('node:fs'),path=require('node:path');
const ROOT=path.resolve(__dirname,'../..'),FILE='main/gym/stations/air.json';
const GROUND=0.8,START_SPEED=7,RUN_IN=4,KICKER={angle:20,rise:0.5},RUN_OUT=40,TRANSITION_RADIUS=15;
// Plateau height above the landing ground (m); downslope angle in degrees (0 = flat landing) and how far
// below the lip the downslope starts (m).
const SECTIONS=[
 {id:'big',height:16,slope:45,drop:3},
 {id:'mid',height:8,slope:35,drop:1.5},
 {id:'flat',height:8,slope:0},
 {id:'low',height:3,slope:0},
];
const r6=v=>Math.round(v*1e6)/1e6,rad=d=>d*Math.PI/180;
function build(){
 const points=[],sections=[],labels=[];let x=0;
 const add=(px,py)=>{const p=[r6(px),r6(py)],q=points.at(-1);if(!q||Math.hypot(p[0]-q[0],p[1]-q[1])>=0.01)points.push(p);};
 let top=GROUND;
 for(const s of SECTIONS){
  const plateau=GROUND+s.height,spawn=[r6(x+2),r6(plateau+0.9)];
  // Wall up from the previous run-out to this plateau; the first plateau gets a 2 m back wall.
  if(points.length)add(x,GROUND);else add(x,plateau+2);
  add(x,plateau);
  const rampStart=spawn[0]+RUN_IN,lipX=rampStart+KICKER.rise/Math.tan(rad(KICKER.angle)),lipY=plateau+KICKER.rise;
  add(rampStart,plateau);add(lipX,lipY);
  let landX,endX,labelAt;
  if(s.slope===0){
   add(lipX,GROUND);landX=lipX;endX=lipX+RUN_OUT;labelAt=[lipX+6,GROUND+1.4];
  }else{
   // The downslope starts s.drop below the lip and reaches the ground at the corner C, rounded by an arc.
   const b=rad(s.slope),startY=lipY-s.drop,cx=lipX+(startY-GROUND)/Math.tan(b),t=TRANSITION_RADIUS*Math.tan(b/2);
   const t1=[cx-Math.cos(b)*t,GROUND+Math.sin(b)*t],t2=[cx+t,GROUND],centre=[t2[0],GROUND+TRANSITION_RADIUS];
   add(lipX,startY);add(t1[0],t1[1]);
   const steps=Math.ceil(s.slope/5);
   for(let i=1;i<=steps;i++){const a=rad(-90-s.slope+s.slope*i/steps);add(centre[0]+TRANSITION_RADIUS*Math.cos(a),centre[1]+TRANSITION_RADIUS*Math.sin(a));}
   landX=lipX;endX=t2[0]+RUN_OUT;labelAt=[lipX+(cx-lipX)/2,(startY+GROUND)/2+1.6];
  }
  add(endX,GROUND);
  const name=`${s.height} m plateau / ${s.slope?s.slope+' deg downslope':'flat'} landing`;
  sections.push({id:s.id,name,mode:'up',spawn,start_speed:START_SPEED,ramp_start:r6(rampStart),lip_x:r6(lipX),lip_y:r6(lipY),
   height:s.height,landing:s.slope?'down':'flat',slope:s.slope,land_x:r6(landX),land_y:GROUND,end_x:r6(endX)});
  labels.push({position:[spawn[0],r6(plateau+2.2)],text:`${s.id.toUpperCase()}  ${s.height} m`});
  labels.push({position:labelAt.map(r6),text:s.slope?`LAND ${s.slope} deg DOWN`:'LAND FLAT 0 deg'});
  top=Math.max(top,lipY);x=endX;
 }
 const chain=points.reverse();
 return {schema:1,id:'air',name:'Air control',kind:'air',units:'metres',spawn:sections[0].spawn,start_speed:START_SPEED,
  run_in:RUN_IN,run_out:RUN_OUT,bounds:[-5,r6(x+5),-5,r6(top+15)],chains:[chain],labels,sections};
}
const text=d=>JSON.stringify(d,null,1)+'\n';
module.exports={build,text,FILE,SECTIONS,GROUND};
if(require.main===module){
 const flag=process.argv[2],file=path.join(ROOT,FILE),bytes=text(build());
 if(flag&&flag!=='--check')throw Error('usage: node tools/gym/air_station.cjs [--check]');
 if(flag==='--check'){
  if(!fs.existsSync(file)||fs.readFileSync(file,'utf8')!==bytes)throw Error('Stale '+FILE+' (run without --check)');
  console.log('PASS '+FILE);
 }else{fs.writeFileSync(file,bytes);console.log('Wrote '+FILE);}
}
