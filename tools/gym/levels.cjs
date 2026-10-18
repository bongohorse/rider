// LE1b: deterministic custom test levels that vary physical length and geometry complexity independently.
// Every accepted level stays inside the unchanged station validator; rejected cases each break one limit.
// CLI: node tools/gym/levels.cjs <output-dir> writes every case as <id>.json plus index.json.
const fs=require('node:fs'),path=require('node:path');
const BASE=0.8,AMPLITUDE=0.4,WAVE=25,START=[0,1.7],SPEED=5;
const round=v=>Math.round(v*1000)/1000;
const surface=x=>round(BASE+AMPLITUDE*Math.sin(2*Math.PI*x/WAVE));
// Points from right to left like the built-in stations (solid side below); the chain ends lie outside the bounds.
function ground(length,segments,chains=1){
 const x0=-10,x1=length+2,points=[];
 for(let i=0;i<=segments;i++){const x=round(x1-(x1-x0)*i/segments);points.push([x,surface(x)]);}
 if(chains===1)return [points];
 const per=segments/chains,out=[];
 for(let c=0;c<chains;c++)out.push(points.slice(c*per,(c+1)*per+1));
 return out;
}
// Hulls sit 0.2 m below the lowest surface point: static shapes and render objects without vehicle contact.
function hulls(length,count,vertices){
 const out=[];
 for(let i=0;i<count;i++){
  const cx=round(length*(i+.5)/count);
  if(vertices===4)out.push({vertices:[[round(cx-1),-.5],[round(cx+1),-.5],[round(cx+1),.2],[round(cx-1),.2]]});
  else{
   const v=[];
   for(let k=0;k<vertices;k++){const a=2*Math.PI*k/vertices-Math.PI/2;v.push([round(cx+.35*Math.cos(a)),round(-.15+.35*Math.sin(a))]);}
   out.push({vertices:v});
  }
 }
 return out;
}
function level(id,name,{length,segments,chains=1,hullCount=0,hullVertices=4,spawnX=START[0]}){
 const d={schema:1,id,name,units:'metres',spawn:[spawnX,round(surface(spawnX)+.9)],start_speed:SPEED,run_in:10,run_out:20,
  bounds:[spawnX===START[0]?-8:round(spawnX-8),length,-10,25],chains:ground(length,segments,chains)};
 if(hullCount)d.hulls=hulls(length,hullCount,hullVertices);
 return d;
}
// The 100-segment chain is linear between its points; a far start uses that line, not the sine.
function farStart(d,x){
 const p=d.chains[0];let i=0;while(p[i+1][0]>x)i++;
 const [a,b]=[p[i],p[i+1]],y=a[1]+(b[1]-a[1])*(x-a[0])/(b[0]-a[0]);
 d.spawn=[x,round(y+.9)];return d;
}
const objects=d=>d.chains.reduce((n,c)=>n+c.length-1,0)+(d.hulls||[]).reduce((n,h)=>n+h.vertices.length,0)+(d.labels||[]).length;
const LONG=99000;
function cases(){
 const accepted=[
  ['length',level('len-100m','LE1b length 100 m',{length:100,segments:100})],
  ['length',level('len-1km','LE1b length 1 km',{length:1000,segments:100})],
  ['length',level('len-10km','LE1b length 10 km',{length:10000,segments:100})],
  ['length',level('len-99km','LE1b length 99 km',{length:LONG,segments:100})],
  ['length',farStart(level('len-99km-far','LE1b length 99 km, start at 98.8 km',{length:LONG,segments:100,spawnX:98800}),98800)],
  ['segments',level('seg-100','LE1b 400 m, 100 segments',{length:400,segments:100})],
  ['segments',level('seg-200','LE1b 400 m, 200 segments',{length:400,segments:200})],
  ['segments',level('seg-400','LE1b 400 m, 400 segments',{length:400,segments:400})],
  ['segments',level('seg-800','LE1b 400 m, 800 segments (render budget)',{length:400,segments:800})],
  ['chains',level('chains-32','LE1b 400 m, 32 chains x 25 segments',{length:400,segments:800,chains:32})],
  ['hulls',level('hulls-16','LE1b 400 m, 100 segments + 16 box hulls',{length:400,segments:100,hullCount:16})],
  ['hulls',level('hulls-32','LE1b 400 m, 100 segments + 32 box hulls',{length:400,segments:100,hullCount:32})],
  ['hulls',level('hulls-64','LE1b 400 m, 100 segments + 64 box hulls',{length:400,segments:100,hullCount:64})],
  ['hulls',level('hulls-64x8','LE1b 400 m, 100 segments + 64 octagon hulls',{length:400,segments:100,hullCount:64,hullVertices:8})],
  ['corner',level('corner-99km-800','LE1b 99 km, 800 segments',{length:LONG,segments:800})],
 ].map(([dimension,d])=>({dimension,id:d.id,expect:'accepted',level:d,objects:objects(d),length_m:d.bounds[1],segments:d.chains.reduce((n,c)=>n+c.length-1,0),chains:d.chains.length,hulls:(d.hulls||[]).length}));
 const long=level('reject-length-100km','Rejected: 100 km',{length:100000,segments:100});
 const tooMany=level('reject-render-801','Rejected: 801 render objects',{length:400,segments:801});
 const chain=level('reject-chain-2049','Rejected: 2049-point chain',{length:400,segments:2048});
 const chains=level('reject-chains-33','Rejected: 33 chains',{length:400,segments:33,chains:33});
 const hull65=level('reject-hulls-65','Rejected: 65 hulls',{length:400,segments:100,hullCount:65});
 const hull9=level('reject-hull-9','Rejected: 9-vertex hull',{length:400,segments:100,hullCount:1,hullVertices:9});
 const big=level('reject-text-256k','Rejected: text above 256 KiB',{length:400,segments:100});big.notes='x'.repeat(256*1024);
 const rejected=[
  ['length',long,'Non-finite bounds'],
  ['segments',tooMany,'Station render budget exceeds 800 objects'],
  ['segments',chain,'Invalid chain length'],
  ['chains',chains,'Missing/too many chains'],
  ['hulls',hull65,'Invalid hulls'],
  ['hulls',hull9,'Invalid hull vertices'],
  ['text',big,null],
 ].map(([dimension,d,reason])=>({dimension,id:d.id,expect:'rejected',level:d,reason,objects:objects(d)}));
 return [...accepted,...rejected];
}
const text=d=>JSON.stringify(d);
// The committed phone samples are the largest accepted length and complexity levels.
const PHONE=['seg-800','len-99km','len-99km-far'];
module.exports={cases,text,objects,surface,PHONE};
if(require.main===module){
 const out=path.resolve(process.argv[2]||'.');fs.mkdirSync(out,{recursive:true});
 const all=cases();
 for(const c of all)fs.writeFileSync(path.join(out,c.id+'.json'),text(c.level));
 fs.writeFileSync(path.join(out,'index.json'),JSON.stringify(all.map(({level,...c})=>({...c,bytes:Buffer.byteLength(text(level))})),null,1));
 console.log(out+': '+all.length+' levels');
}
