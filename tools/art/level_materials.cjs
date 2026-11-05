// Draws the original level material presets (#538) in headless Chromium: procedural, no third-party input, fixed seeds.
// 128 px = 1 m. Surface and Band are 512 x 128 and repeat along the track; Fill is 512 x 512 and repeats both ways.
//   node tools/art/level_materials.cjs            then   python tools/art/level_materials.py --write
'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {chromium}=require('playwright');
const OUT=process.env.LEVEL_MATERIALS_OUT||path.resolve(__dirname,'../../main/terrain_material/presets');
const PRESETS=[
 {id:'meadow',name:'Meadow',seed:536,fold:'84,134,44',
  fill:{base:[26,36,29],dark:'30,16,8',light:'190,140,90',grainDark:'20,10,5',grainLight:'215,170,120',stoneH:[24,40],stoneS:[6,18],stoneL:[38,56],stoneShadow:'15,8,4',stones:34},
  band:{top:[92,58,42],mid:[100,55,31],low:[112,52,22],shadow:'18,10,4',root:'40,26,12',roots:150,bladeH:[94,114],bladeS:54,bladeL:[20,36],blades:900,bladeLen:[7,26],fleckH:[80,104],fleckS:58,fleckL:[30,60],flecks:2600},
  surface:{back:[108,44,27],mid:[98,52,36],front:[88,62,47],blotchDark:'12,44,12',blotchLight:'190,225,110',bladeH:[82,114],bladeS:56,bladeL:[24,40],bladeGain:18,edgeL:[26,50],track:[[32,32,35],[36,36,44],[38,40,52],[34,36,42]],trackDark:'70,44,22',trackLight:'232,204,150',rut:'58,36,18',streakLight:'240,214,164',grainDark:'50,30,14',grainLight:'245,225,180',pebble:[34,10,[45,70]],pebbleShadow:'30,18,8',tufts:14}},
 {id:'canyon',name:'Canyon',seed:611,fold:'176,132,64',
  fill:{base:[16,48,33],dark:'62,20,8',light:'232,150,92',grainDark:'50,18,8',grainLight:'240,180,130',stoneH:[20,34],stoneS:[20,36],stoneL:[46,64],stoneShadow:'40,14,6',stones:26},
  band:{top:[42,52,50],mid:[34,50,38],low:[24,50,28],shadow:'46,16,6',root:'66,34,14',roots:50,bladeH:[34,52],bladeS:48,bladeL:[34,52],blades:520,bladeLen:[6,20],fleckH:[38,54],fleckS:56,fleckL:[46,72],flecks:1700},
  surface:{back:[34,36,36],mid:[40,44,46],front:[44,52,54],blotchDark:'84,48,18',blotchLight:'240,212,132',bladeH:[36,54],bladeS:48,bladeL:[38,52],bladeGain:14,edgeL:[38,62],track:[[20,42,38],[24,50,48],[26,54,58],[20,48,44]],trackDark:'96,44,20',trackLight:'248,190,130',rut:'86,36,16',streakLight:'252,204,150',grainDark:'82,36,16',grainLight:'252,214,170',pebble:[20,22,[46,72]],pebbleShadow:'52,20,8',tufts:7}},
 {id:'snowfield',name:'Snowfield',seed:723,fold:'214,228,240',
  fill:{base:[214,20,30],dark:'10,18,34',light:'150,178,214',grainDark:'8,14,28',grainLight:'186,206,232',stoneH:[208,224],stoneS:[8,20],stoneL:[44,66],stoneShadow:'6,12,24',stones:30},
  band:{top:[208,44,94],mid:[208,36,86],low:[212,32,72],shadow:'12,20,36',root:null,roots:0,bladeH:[204,216],bladeS:42,bladeL:[80,96],blades:640,bladeLen:[6,18],fleckH:[200,214],fleckS:60,fleckL:[88,100],flecks:2200},
  surface:{back:[210,30,78],mid:[208,38,88],front:[206,46,95],blotchDark:'120,150,190',blotchLight:'255,255,255',bladeH:[202,216],bladeS:40,bladeL:[84,92],bladeGain:6,edgeL:[86,98],track:[[214,20,58],[212,22,68],[210,24,75],[214,20,62]],trackDark:'92,112,146',trackLight:'238,246,255',rut:'70,90,126',streakLight:'248,252,255',grainDark:'82,102,136',grainLight:'255,255,255',pebble:[214,16,[40,62]],pebbleShadow:'40,56,84',tufts:6}},
 {id:'forest',name:'Forest',seed:847,fold:'52,92,42',
  fill:{base:[22,34,18],dark:'12,6,3',light:'132,92,54',grainDark:'8,4,2',grainLight:'160,120,80',stoneH:[60,100],stoneS:[8,20],stoneL:[28,44],stoneShadow:'6,4,2',stones:30},
  band:{top:[112,44,31],mid:[122,44,22],low:[132,42,14],shadow:'6,6,2',root:'28,18,8',roots:190,bladeH:[108,136],bladeS:44,bladeL:[12,28],blades:1100,bladeLen:[8,30],fleckH:[90,120],fleckS:50,fleckL:[22,44],flecks:2400},
  surface:{back:[132,38,15],mid:[122,42,23],front:[110,48,33],blotchDark:'4,24,10',blotchLight:'120,170,70',bladeH:[100,134],bladeS:46,bladeL:[14,30],bladeGain:14,edgeL:[16,38],track:[[24,30,16],[26,32,22],[28,34,28],[24,32,20]],trackDark:'28,16,8',trackLight:'150,112,72',rut:'20,11,5',streakLight:'160,122,84',grainDark:'18,10,5',grainLight:'170,130,90',pebble:[34,12,[28,50]],pebbleShadow:'12,8,4',tufts:20}},
 {id:'volcanic',name:'Volcanic',seed:961,fold:'92,84,84',
  fill:{base:[260,8,15],dark:'5,4,8',light:'112,94,112',grainDark:'2,2,4',grainLight:'230,108,40',stoneH:[10,30],stoneS:[58,92],stoneL:[34,52],stoneShadow:'4,2,4',stones:22},
  band:{top:[0,4,36],mid:[0,4,24],low:[260,6,14],shadow:'3,2,4',root:'230,90,28',roots:70,bladeH:[0,20],bladeS:8,bladeL:[12,30],blades:560,bladeLen:[5,18],fleckH:[14,30],fleckS:82,fleckL:[30,58],flecks:700},
  surface:{back:[260,6,18],mid:[0,4,27],front:[0,4,36],blotchDark:'5,4,8',blotchLight:'130,118,118',bladeH:[0,20],bladeS:6,bladeL:[14,26],bladeGain:12,edgeL:[16,36],track:[[260,8,12],[255,8,16],[250,8,19],[260,8,13]],trackDark:'3,2,4',trackLight:'118,102,108',rut:'2,2,3',streakLight:'240,110,40',grainDark:'2,2,3',grainLight:'224,112,52',pebble:[16,70,[36,56]],pebbleShadow:'3,2,3',tufts:4}},
];
function paint(p){
 const W=512,HS=128;
 const seedAt=k=>{let seed=(p.seed*(k+1))>>>0;return ()=>(seed=(seed*1664525+1013904223)>>>0)/2**32;};
 const make=(w,h)=>{const c=document.createElement('canvas');c.width=w;c.height=h;return c;};
 const hsl=(v,a=1)=>`hsla(${v[0]},${v[1]}%,${v[2]}%,${a})`;
 const rgba=(c,a)=>`rgba(${c},${a})`;
 // FILL
 const fillImage=()=>{
  const r=seedAt(0),R=(a,b)=>a+(b-a)*r(),q=p.fill;
  const wrap=fn=>{for(const dx of [-W,0,W])for(const dy of [-W,0,W])fn(dx,dy);};
  const c=make(W,W),f=c.getContext('2d');f.fillStyle=hsl(q.base);f.fillRect(0,0,W,W);
  for(let i=0;i<420;i++){const x=R(0,W),y=R(0,W),d=R(14,70),dark=r()<.5,a=R(.03,.09);wrap((dx,dy)=>{const g=f.createRadialGradient(x+dx,y+dy,0,x+dx,y+dy,d);g.addColorStop(0,rgba(dark?q.dark:q.light,a));g.addColorStop(1,'rgba(0,0,0,0)');f.fillStyle=g;f.fillRect(x+dx-d,y+dy-d,2*d,2*d);});}
  for(let i=0;i<18000;i++){const x=R(0,W),y=R(0,W);f.fillStyle=r()<.5?rgba(q.grainDark,R(.04,.16)):rgba(q.grainLight,R(.03,.12));f.fillRect(x,y,R(1,2.4),R(1,2));}
  for(let i=0;i<q.stones;i++){
   const x=R(0,W),y=R(0,W),d=i<8?R(16,30):R(5,13),h=R(...q.stoneH),s=R(...q.stoneS),l=R(...q.stoneL),a=[],k=R(.65,.95),rot=R(0,3.14);
   for(let j=0;j<9;j++){const t=j/9*6.283,e=d*R(.82,1.12),px=Math.cos(t)*e,py=Math.sin(t)*e*k;a.push([px*Math.cos(rot)-py*Math.sin(rot),px*Math.sin(rot)+py*Math.cos(rot)]);}
   wrap((dx,dy)=>{const path=(ox,oy)=>{f.beginPath();a.forEach((v,j)=>{const m=a[(j+1)%9],mx=(v[0]+m[0])/2+x+dx+ox,my=(v[1]+m[1])/2+y+dy+oy;if(j===0)f.moveTo(mx,my);else f.quadraticCurveTo(v[0]+x+dx+ox,v[1]+y+dy+oy,mx,my);});const v=a[0],m=a[1];f.quadraticCurveTo(v[0]+x+dx+ox,v[1]+y+dy+oy,(v[0]+m[0])/2+x+dx+ox,(v[1]+m[1])/2+y+dy+oy);f.closePath();};
    path(d*.08,d*.14);f.fillStyle=rgba(q.stoneShadow,.45);f.fill();
    path(0,0);const g=f.createLinearGradient(0,y+dy-d,0,y+dy+d);g.addColorStop(0,hsl([h,s,l+16]));g.addColorStop(.55,hsl([h,s,l]));g.addColorStop(1,hsl([h,s,l-12]));f.fillStyle=g;f.fill();});
  }
  return c;
 };
 // BAND: starts at the driving line (row 0), transparent below its art, repeats along the track.
 const bandImage=()=>{
  const r=seedAt(1),R=(a,b)=>a+(b-a)*r(),q=p.band;
  const wrap=fn=>{for(const dx of [-W,0,W])fn(dx);};
  const c=make(W,HS),b=c.getContext('2d');
  const k=[[1,R(0,6.28),11],[2,R(0,6.28),8],[3,R(0,6.28),6],[5,R(0,6.28),5],[8,R(0,6.28),4],[13,R(0,6.28),3]];
  const edge=x=>38+k.reduce((s,[n,ph,a])=>s+a*Math.sin(x/W*6.283*n+ph),0);
  const fringe=(off,style)=>{b.beginPath();b.moveTo(-2,0);for(let x=-2;x<=W+2;x+=2)b.lineTo(x,edge(x)+off);b.lineTo(W+2,0);b.closePath();b.fillStyle=style;b.fill();};
  for(let i=0;i<14;i++)fringe(i*3+6,rgba(q.shadow,.055));
  b.lineCap='round';
  for(let i=0;i<q.roots;i++){const x=R(0,W),y0=edge(x)-4,len=R(10,46),sw=R(-10,10),w=R(.7,1.8),a=R(.25,.6);wrap(dx=>{b.strokeStyle=rgba(q.root,a);b.lineWidth=w;b.beginPath();b.moveTo(x+dx,y0);b.quadraticCurveTo(x+dx+sw,y0+len*.5,x+dx+sw*.4,y0+len);b.stroke();});}
  const g=b.createLinearGradient(0,0,0,64);g.addColorStop(0,hsl(q.top));g.addColorStop(.55,hsl(q.mid));g.addColorStop(1,hsl(q.low));fringe(0,g);
  for(let i=0;i<q.blades;i++){const x=R(0,W),y0=edge(x)-R(0,8),len=R(...q.bladeLen),sw=R(-5,5),w=R(1.2,3),l=R(...q.bladeL),h=R(...q.bladeH);wrap(dx=>{b.strokeStyle=hsl([h,q.bladeS,l]);b.lineWidth=w;b.beginPath();b.moveTo(x+dx,y0);b.quadraticCurveTo(x+dx+sw*.4,y0+len*.6,x+dx+sw,y0+len);b.stroke();});}
  for(let i=0;i<q.flecks;i++){const x=R(0,W),y=r()*edge(x),h=R(...q.fleckH),l=R(...q.fleckL),a=R(.25,.6),w=R(1,2.2),d=R(3,7);wrap(dx=>{b.fillStyle=hsl([h,q.fleckS,l],a);b.fillRect(x+dx,y,w,d);});}
  // Top rows meet the Surface in one shared colour: no bright line at the fold.
  b.globalCompositeOperation='source-atop';const t=b.createLinearGradient(0,0,0,16);t.addColorStop(0,rgba(p.fold,.72));t.addColorStop(1,rgba(p.fold,0));b.fillStyle=t;b.fillRect(0,0,W,16);b.globalCompositeOperation='source-over';
  return c;
 };
 // SURFACE: seen from above. Row 127 touches the Band, row 0 is the far edge. A worn track runs along the middle,
 // vegetation stays at both sides. The far edge frays into transparency; the contact side stays opaque.
 const surfaceImage=()=>{
  const r=seedAt(2),R=(a,b)=>a+(b-a)*r(),q=p.surface;
  const wrap=fn=>{for(const dx of [-W,0,W])fn(dx);};
  const c=make(W,HS),s=c.getContext('2d');
  const sg=s.createLinearGradient(0,0,0,HS);sg.addColorStop(0,hsl(q.back));sg.addColorStop(.6,hsl(q.mid));sg.addColorStop(1,hsl(q.front));s.fillStyle=sg;s.fillRect(0,0,W,HS);
  for(let i=0;i<280;i++){const x=R(0,W),y=R(0,HS),d=R(10,40),a=R(.05,.13),dark=r()<.5;wrap(dx=>{const g=s.createRadialGradient(x+dx,y,0,x+dx,y,d);g.addColorStop(0,rgba(dark?q.blotchDark:q.blotchLight,a));g.addColorStop(1,'rgba(0,0,0,0)');s.fillStyle=g;s.fillRect(x+dx-d,y-d,2*d,2*d);});}
  for(let i=0;i<5200;i++){const x=R(0,W),y=R(0,134),len=R(4,12),sw=R(-3,3),w=R(.8,1.8),t=y/HS,h=R(...q.bladeH),l=R(...q.bladeL)+t*q.bladeGain,a=R(.45,.9);wrap(dx=>{s.strokeStyle=hsl([h,q.bladeS,l],a);s.lineWidth=w;s.beginPath();s.moveTo(x+dx,y);s.lineTo(x+dx+sw,y-len);s.stroke();});}
  const wave=()=>[[1,R(0,6.28),5],[2,R(0,6.28),4],[3,R(0,6.28),3],[7,R(0,6.28),2],[11,R(0,6.28),1]];
  const w1=wave(),w2=wave(),w3=wave(),at=(w,x)=>w.reduce((v,[n,ph,a])=>v+a*Math.sin(x/W*6.283*n+ph),0);
  const back=x=>32+at(w1,x)*.8,front=x=>104+at(w2,x)*.8;
  s.save();s.beginPath();s.moveTo(0,back(0));for(let x=2;x<=W;x+=2)s.lineTo(x,back(x));for(let x=W;x>=0;x-=2)s.lineTo(x,front(x));s.closePath();s.clip();
  const dg=s.createLinearGradient(0,20,0,110);q.track.forEach((v,i)=>dg.addColorStop([0,.25,.6,1][i],hsl(v)));s.fillStyle=dg;s.fillRect(0,0,W,HS);
  for(let i=0;i<150;i++){const x=R(0,W),y=R(20,110),d=R(8,34),a=R(.05,.14),dark=r()<.5;wrap(dx=>{const g=s.createRadialGradient(x+dx,y,0,x+dx,y,d);g.addColorStop(0,rgba(dark?q.trackDark:q.trackLight,a));g.addColorStop(1,'rgba(0,0,0,0)');s.fillStyle=g;s.fillRect(x+dx-d,y-d,2*d,2*d);});}
  // Tyre wear: two soft ruts and fine streaks along the track.
  for(const [row,n,ph] of [[54,3,R(0,6.28)],[82,2,R(0,6.28)]])for(const [w,a] of [[11,.09],[6,.13]]){s.strokeStyle=rgba(q.rut,a);s.lineWidth=w;s.beginPath();for(let x=-4;x<=W+4;x+=4){const y=row+2.5*Math.sin(x/W*6.283*n+ph);if(x<0)s.moveTo(x,y);else s.lineTo(x,y);}s.stroke();}
  for(let i=0;i<190;i++){const x=R(0,W),y=R(30,102),l=R(30,190),a=R(.04,.13),w=R(.6,1.6),dark=r()<.6,e=R(-.6,.6);wrap(dx=>{s.strokeStyle=rgba(dark?q.rut:q.streakLight,a);s.lineWidth=w;s.beginPath();s.moveTo(x+dx,y);s.lineTo(x+dx+l,y+e);s.stroke();});}
  for(let i=0;i<9000;i++){const x=R(0,W),y=R(22,112);s.fillStyle=r()<.5?rgba(q.grainDark,R(.08,.25)):rgba(q.grainLight,R(.06,.2));s.fillRect(x,y,R(.8,1.8),R(.6,1.3));}
  for(let i=0;i<90;i++){const x=R(0,W),y=R(36,102),d=R(.8,2.2),l=R(...q.pebble[2]);wrap(dx=>{s.fillStyle=rgba(q.pebbleShadow,.35);s.beginPath();s.ellipse(x+dx+.5,y+.7,d,d*.7,0,0,6.3);s.fill();s.fillStyle=hsl([q.pebble[0],q.pebble[1],l]);s.beginPath();s.ellipse(x+dx,y,d,d*.7,0,0,6.3);s.fill();});}
  s.restore();
  const blade=(x,y,len,li)=>{const sw=R(-3,3),w=R(.8,1.8),h=R(...q.bladeH),l=R(...li),a=R(.6,.95);wrap(dx=>{s.strokeStyle=hsl([h,q.bladeS,l],a);s.lineWidth=w;s.beginPath();s.moveTo(x+dx,y);s.lineTo(x+dx+sw,y-len);s.stroke();});};
  for(let i=0;i<2200;i++){const x=R(0,W);blade(x,back(x)+R(-2,11),R(4,11),q.edgeL);}
  for(let i=0;i<2200;i++){const x=R(0,W);blade(x,front(x)+R(-5,8),R(4,12),q.edgeL);}
  for(let i=0;i<q.tufts;i++){const x=R(0,W),y=R(48,92);for(let j=0;j<18;j++)blade(x+R(-5,5),y+R(-2,2),R(3,7),q.edgeL);}
  // Fray the far edge, then let blades cross it.
  const fray=x=>Math.max(4,7+at(w3,x)*.7);
  s.globalCompositeOperation='destination-out';s.beginPath();s.moveTo(-2,-2);for(let x=-2;x<=W+2;x+=2)s.lineTo(x,fray(x));s.lineTo(W+2,-2);s.closePath();s.fillStyle='#000';s.fill();s.globalCompositeOperation='source-over';
  for(let i=0;i<620;i++){const x=R(0,W);blade(x,fray(x)+R(1,6),R(3,8),q.edgeL);}
  const ft=s.createLinearGradient(0,110,0,HS);ft.addColorStop(0,rgba(p.fold,0));ft.addColorStop(1,rgba(p.fold,.72));s.fillStyle=ft;s.fillRect(0,110,W,18);
  return c;
 };
 const dump=c=>c.toDataURL('image/png');
 return {surface:dump(surfaceImage()),band:dump(bandImage()),fill:dump(fillImage())};
}
(async()=>{
 const browser=await chromium.launch();const page=await browser.newPage();
 const meta={generator:'tools/art/level_materials.cjs',generator_sha256:crypto.createHash('sha256').update(fs.readFileSync(__filename)).digest('hex'),browser:browser.version(),presets:[]};
 for(const p of PRESETS){
  const images=await page.evaluate(paint,p);
  fs.mkdirSync(path.join(OUT,p.id),{recursive:true});
  for(const [n,d] of Object.entries(images))fs.writeFileSync(path.join(OUT,p.id,n+'.png'),Buffer.from(d.split(',')[1],'base64'));
  meta.presets.push({id:p.id,name:p.name,seed:p.seed});
  console.log(p.id);
 }
 await browser.close();
 fs.writeFileSync(path.join(OUT,'generation.json'),JSON.stringify(meta,null,1)+'\n');
})().catch(e=>{console.error(e);process.exit(1);});
