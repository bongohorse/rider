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
 {id:'quarry',name:'Quarry',seed:611,kind:'quarry',fold:'122,118,112',foldAlpha:.72},
 {id:'volcano',name:'Volcano',seed:723,kind:'volcano',fold:'66,58,58',foldAlpha:.66},
 {id:'city',name:'City street',seed:847,kind:'city',fold:'168,166,160'},
 {id:'inca',name:'Inca stone',seed:961,kind:'inca',fold:'205,166,76'},
 {id:'glacier',name:'Glacier',seed:1033,kind:'glacier',fold:'232,240,248'},
 {id:'scrapyard',name:'Scrapyard',seed:1151,kind:'scrap',fold:'120,118,104'},
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
function paintKind(p){
 const W=512,HS=128;
 const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v)),mix=(a,b,t)=>a+(b-a)*t,smooth=(a,b,v)=>{const t=clamp((v-a)/(b-a));return t*t*(3-2*t);};
 const mixc=(a,b,t)=>[mix(a[0],b[0],t),mix(a[1],b[1],t),mix(a[2],b[2],t)],scale=(c,k)=>[c[0]*k,c[1]*k,c[2]*k];
 const rng=k=>{let seed=(p.seed*(k+1)+k*7919)>>>0;return ()=>(seed=(seed*1664525+1013904223)>>>0)/2**32;};
 // Value noise that repeats after cx x cy cells over a w x h image.
 const noise=(cx,cy,w,h,k)=>{const r=rng(100+k),g=new Float32Array(cx*cy);for(let i=0;i<g.length;i++)g[i]=r();
  return (x,y)=>{const u=x/w*cx,v=y/h*cy,i=Math.floor(u),j=Math.floor(v),fu=u-i,fv=v-j,su=fu*fu*(3-2*fu),sv=fv*fv*(3-2*fv),m=(a,b)=>g[((b%cy+cy)%cy)*cx+((a%cx+cx)%cx)];
   return mix(mix(m(i,j),m(i+1,j),su),mix(m(i,j+1),m(i+1,j+1),su),sv);};};
 const fbm=(cx,cy,w,h,k)=>{const a=noise(cx,cy,w,h,k),b=noise(cx*2,cy*2,w,h,k+1),c=noise(cx*4,cy*4,w,h,k+2);return (x,y)=>(a(x,y)*.55+b(x,y)*.3+c(x,y)*.15);};
 // Voronoi cells on a torus: distance to nearest, gap to second nearest, cell id.
 const cells=(cx,cy,w,h,jit,k)=>{const r=rng(200+k),pts=[];for(let j=0;j<cy;j++)for(let i=0;i<cx;i++)pts.push([((i+1+(r()-.5)*jit)*w/cx)%w,(j+.5+(r()-.5)*jit)*h/cy,r(),r()]);
  return (x,y)=>{const u=Math.floor(x/w*cx-.5),v=Math.floor(y/h*cy);let d1=1e9,d2=1e9,id=0;
   for(let b=-2;b<=2;b++)for(let a=-2;a<=2;a++){const ii=((u+a)%cx+cx)%cx,jj=((v+b)%cy+cy)%cy,q=pts[jj*cx+ii];let dx=Math.abs(q[0]-x),dy=Math.abs(q[1]-y);dx=Math.min(dx,w-dx);dy=Math.min(dy,h-dy);const d=Math.hypot(dx,dy),at=jj*cx+ii;if(at===id&&d1<1e9)continue;if(d<d1){d2=d1;d1=d;id=at;}else if(d<d2)d2=d;}
   return {d1,gap:d2-d1,id,a:pts[id][2],b:pts[id][3]};};};
 const image=(w,h,fn)=>{const c=document.createElement('canvas');c.width=w;c.height=h;const x=c.getContext('2d'),d=x.createImageData(w,h);for(let j=0;j<h;j++)for(let i=0;i<w;i++){const o=fn(i,j),k=(j*w+i)*4;d.data[k]=clamp(o[0],0,255);d.data[k+1]=clamp(o[1],0,255);d.data[k+2]=clamp(o[2],0,255);d.data[k+3]=o[3]===undefined?255:o[3];}x.putImageData(d,0,0);return c;};
 const wave=(k,amp)=>{const r=rng(300+k),w=[[1,r()*6.28,amp],[2,r()*6.28,amp*.7],[3,r()*6.28,amp*.5],[5,r()*6.28,amp*.35],[9,r()*6.28,amp*.2]];return x=>w.reduce((v,[n,ph,a])=>v+a*Math.sin(x/W*6.2831853*n+ph),0);};
 // Baked relief: shade from a height field, light from the upper left. wrapY for textures that repeat vertically.
 const relief=(w,h,wrapY,fn,k=.075)=>{const H=new Float32Array(w*h);for(let j=0;j<h;j++)for(let i=0;i<w;i++)H[j*w+i]=fn(i,j);
  return (x,y)=>{const l=H[y*w+(x+w-1)%w],r=H[y*w+(x+1)%w],up=wrapY?(y+h-1)%h:Math.max(0,y-1),dn=wrapY?(y+1)%h:Math.min(h-1,y+1),t=H[up*w+x],b=H[dn*w+x];return clamp(1+k*2*((r-l)*.6+(b-t)*.8)/2,.42,1.5);};};
 const FAR=4;
 const finishSurface=c=>{const s=c.getContext('2d');const g=s.createLinearGradient(0,112,0,HS);g.addColorStop(0,`rgba(${p.fold},0)`);g.addColorStop(.62,`rgba(${p.fold},${p.foldAlpha||.92})`);g.addColorStop(1,`rgba(${p.fold},${p.foldAlpha||.92})`);s.fillStyle=g;s.fillRect(0,112,W,16);return c;};
 const finishBand=c=>{const b=c.getContext('2d');b.globalCompositeOperation='source-atop';const g=b.createLinearGradient(0,0,0,14);g.addColorStop(0,`rgba(${p.fold},${p.foldAlpha||.92})`);g.addColorStop(.43,`rgba(${p.fold},${p.foldAlpha||.92})`);g.addColorStop(1,`rgba(${p.fold},0)`);b.fillStyle=g;b.fillRect(0,0,W,14);b.globalCompositeOperation='source-over';return c;};
 // Band helper: art above edge(x), then a soft contact shadow, then transparent.
 const band=(edge,colour,shadow=18)=>image(W,HS,(x,y)=>{const e=edge(x);if(y<e)return colour(x,y,e);const t=(y-e)/shadow;if(t>=1)return [0,0,0,0];return [8,6,6,Math.round(120*(1-t)*(1-t))];});
 const K={
  quarry(){
   const stone=relief(W,W,true,(()=>{const c=cells(8,7,W,W,.72,1),n=fbm(24,24,W,W,1),big=fbm(5,5,W,W,4),fine=fbm(96,96,W,W,9);return (x,y)=>{const a=c(x,y);return smooth(0,16,a.gap)*(18+a.a*16)+big(x,y)*10+n(x,y)*7+fine(x,y)*3;};})());
   const c=cells(8,7,W,W,.72,1),tint=fbm(6,6,W,W,6),n2=fbm(48,48,W,W,8);
   const fill=image(W,W,(x,y)=>{const a=c(x,y),base=mixc(mixc([92,88,82],[136,126,110],a.a),[118,108,92],a.b*.45),moss=smooth(.6,.72,tint(x,y))*(1-smooth(0,10,a.gap));let col=mixc(base,[74,86,52],moss*.6);col=scale(col,.84+n2(x,y)*.3);col=scale(col,stone(x,y)*mix(.3,1,smooth(0,4,a.gap)));return col;});
   const cob=cells(26,5,W,HS,.62,2),rn=fbm(8,3,W,HS,11),gr=fbm(120,30,W,HS,13);
   const sh=relief(W,HS,false,(x,y)=>{const a=cob(x,y),wear=1-smooth(28,50,Math.abs(y-66));return smooth(0,7,a.gap)*(7-wear*3.5)+gr(x,y)*1.6;});
   const ef=wave(1,4);
   const surface=image(W,HS,(x,y)=>{if(y<FAR+Math.max(0,ef(x)+2))return [0,0,0,0];const a=cob(x,y),wear=1-smooth(28,50,Math.abs(y-66));let col=mixc(mixc([98,96,92],[142,136,124],a.a),[164,156,140],wear*.5);col=mixc(col,[84,100,60],smooth(.52,.7,rn(x,y))*(1-wear)*(1-smooth(0,6,a.gap))*.7);col=scale(col,sh(x,y)*mix(.28,1,smooth(0,2.6,a.gap)));return col;});
   const e0=wave(3,9),blocks=fbm(14,2,W,HS,15);const edge=x=>Math.max(20,50+e0(x)+(blocks(x,8)-.5)*26);
   const bh=relief(W,HS,false,(()=>{const q=cells(14,3,W,HS,.8,3),nn=fbm(48,12,W,HS,16);return (x,y)=>smooth(0,10,q(x,y).gap)*12+nn(x,y)*7;})()),q=cells(14,3,W,HS,.8,3);
   const bd=band(edge,(x,y,e)=>{const a=q(x,y);let col=mixc([98,94,88],[140,132,118],a.a);col=mixc(col,[78,96,50],(1-smooth(0,16,y))*.7);col=scale(col,bh(x,y)*mix(.34,1,smooth(0,3,a.gap))*mix(1.05,.72,smooth(0,e,y)));return col;},22);
   return {fill,surface,band:bd};
  },
  volcano(){
   const hot=t=>mixc(mixc([96,14,4],[232,70,8],smooth(0,.45,t)),mixc([255,150,30],[255,238,150],smooth(.72,1,t)),smooth(.42,.74,t));
   const c=cells(7,7,W,W,.95,3),glow=fbm(4,4,W,W,14),fine=fbm(64,64,W,W,12),mid=fbm(14,14,W,W,11),ff=cells(30,30,W,W,.95,4);
   const rh=relief(W,W,true,(x,y)=>{const a=c(x,y);return smooth(0,26,a.gap)*22+mid(x,y)*12+fine(x,y)*5+smooth(0,3,ff(x,y).gap)*1.6;});
   const fill=image(W,W,(x,y)=>{const a=c(x,y),g=smooth(.3,.62,glow(x,y)),core=(1-smooth(1,7.5,a.gap))*g,halo=Math.exp(-a.gap/11)*g;let col=mixc([26,23,27],[60,50,52],a.a*.6+mid(x,y)*.4);col=scale(col,rh(x,y));col=mixc(col,[150,34,6],clamp(halo*.55));return mixc(col,hot(core),clamp(core*1.5));});
   const s=cells(13,3,W,HS,.92,5),sf=fbm(12,3,W,HS,17),sg=fbm(80,20,W,HS,19),fr=wave(5,3);
   const sh=relief(W,HS,false,(x,y)=>smooth(0,9,s(x,y).gap)*10+sg(x,y)*5);
   const surface=image(W,HS,(x,y)=>{if(y<FAR+Math.max(0,fr(x)+1.5))return [0,0,0,0];const a=s(x,y),mid2=1-smooth(24,42,Math.abs(y-66)),g=smooth(.28,.54,sf(x,y))*mix(.3,1,mid2),core=(1-smooth(.6,4.2,a.gap))*g,halo=Math.exp(-a.gap/6)*g;let col=mixc([74,66,64],[30,26,30],mid2);col=scale(col,sh(x,y)*(.86+sg(x,y)*.28));col=mixc(col,[150,34,6],clamp(halo*.55));return mixc(col,hot(core),clamp(core*1.6));});
   const r=rng(6),dr=[];for(let i=0;i<22;i++)dr.push([r()*W,5+r()*9,18+r()*52]);
   const base=wave(6,5),cache=new Float32Array(W);for(let i=0;i<W;i++){let v=26+base(i);for(const q of dr){let dx=Math.abs(i-q[0]);dx=Math.min(dx,W-dx);v=Math.max(v,26+q[2]*Math.exp(-(dx*dx)/(q[1]*q[1])));}cache[i]=v;}
   const bh=relief(W,HS,false,(x,y)=>smooth(0,9,s(x,y).gap)*8+sg(x,y)*4);
   const bd=band(x=>cache[x],(x,y,e)=>{const depth=y/e,t=smooth(.42,1,depth)*smooth(24,44,e)+smooth(e-9,e,y)*.8,a=s(x,y);let col=scale([54,48,48],bh(x,y)*mix(.55,1,smooth(0,2.2,a.gap)));return mixc(col,hot(clamp(t)),clamp(t*1.25));},20);
   return {fill,surface,band:bd};
  },
  city(){
   const n=fbm(32,32,W,W,21),rn=rng(7),tint=[];for(let i=0;i<8*16;i++)tint.push(rn());
   const fill=image(W,W,(x,y)=>{const row=Math.floor(y/32),off=row%2?32:0,ix=Math.floor(((x+off)%W)/64),bx=((x+off)%W)%64,by=y%32,j=Math.min(Math.min(bx,64-bx),Math.min(by,32-by));const t=tint[(row%16)*8+ix%8];if(j<2.5)return scale([92,88,84],.8+n(x,y)*.4);const brick=mixc([140,62,46],[176,88,62],t);return scale(brick,(.78+n(x,y)*.42)*mix(.86,1,smooth(2.5,6,j)));});
   const an=fbm(64,16,W,HS,24),spot=fbm(8,3,W,HS,27);
   const surface=image(W,HS,(x,y)=>{if(y<FAR)return [0,0,0,0];const curb=y<16||y>=112;let col=curb?scale([168,166,160],.85+an(x,y)*.3):scale([62,64,68],.72+an(x,y)*.55+spot(x,y)*.2);
    if(curb&&(x%128>=62&&x%128<65))col=scale(col,.62);
    if(!curb){if((y>=20&&y<23)||(y>=105&&y<108))col=mixc(col,[226,226,220],.86);if(y>=60&&y<68&&x%128>=28&&x%128<100)col=mixc(col,[232,186,52],.9);}
    return col;});
   const bd=image(W,HS,(x,y)=>{if(y<38){let col=scale([168,166,160],(.82+an(x,y*3)*.3)*mix(1.02,.74,y/38));if(x%128>=62&&x%128<65)col=scale(col,.62);return col;}if(y<60){const t=(y-38)/22;return [10,10,12,Math.round(190*(1-t)*(1-t))];}return [0,0,0,0];});
   return {fill,surface,band:bd};
  },
  inca(){
   const c=cells(6,6,W,W,.62,18),n=fbm(24,24,W,W,31),big=fbm(5,5,W,W,34);
   const fill=image(W,W,(x,y)=>{const a=c(x,y);const stone=mixc([150,136,108],[186,170,136],a.a);let col=scale(stone,(.82+n(x,y)*.34)*(.9+big(x,y)*.2)*mix(.95,1.08,a.b));const light=smooth(0,9,a.gap)*mix(.9,1,1-smooth(0,60,a.d1));col=scale(col,mix(.34,1,smooth(0,2.4,a.gap))*mix(.86,1.06,light));return col;});
   const sn=fbm(40,10,W,HS,37),moss=fbm(12,3,W,HS,38),ef=wave(8,3);
   const surface=image(W,HS,(x,y)=>{if(y<FAR+Math.max(0,ef(x)+1))return [0,0,0,0];const row=Math.floor((y-4)/31),off=row%2?32:0,bx=(x+off)%W%64,by=((y-4)%31+31)%31,j=Math.min(Math.min(bx,64-bx),Math.min(by,31-by));const id=(Math.floor(((x+off)%W)/64)*7+row*13)%10/10;let col=scale(mixc([168,150,114],[202,184,144],id),.82+sn(x,y)*.36);if(j<2)return scale([72,62,46],.9+sn(x,y)*.3);col=scale(col,mix(.84,1,smooth(2,6,j)));const edge=smooth(30,52,Math.abs(y-64))*smooth(.42,.62,moss(x,y));col=mixc(col,[74,104,48],edge*.8);if(y>=62&&y<67)col=mixc(col,[214,170,62],.7);return col;});
   const step=(x,y)=>{const u=(x+32)%64,v=y-22;const d=Math.max(Math.abs(u-32),0);const lev=Math.floor(d/8);return v>=lev*6&&v<36&&d<32&&v<lev*6+14;};
   const bd=image(W,HS,(x,y)=>{if(y<78){let col=scale([176,158,122],.82+n(x,y)*.38);if(y<7||(y>=70))col=mixc(col,[214,170,62],.82);else if(y<10||y>=67)col=scale(col,.5);else if(step(x,y))col=scale(col,.56);else if(step(x,y-3))col=scale(col,1.2);return col;}if(y<98){const t=(y-78)/20;return [8,6,4,Math.round(170*(1-t)*(1-t))];}return [0,0,0,0];});
   return {fill,surface,band:bd};
  },
  glacier(){
   const n=fbm(6,6,W,W,41),cr=cells(7,7,W,W,.85,9),streak=fbm(4,32,W,W,44);
   const fill=image(W,W,(x,y)=>{const a=cr(x,y),t=n(x,y);let col=mixc([34,84,132],[120,190,226],t);col=mixc(col,[196,234,248],smooth(.58,.72,streak(x,y))*.3);col=mixc(col,[220,246,252],(1-smooth(0,2,a.gap))*.55);return col;});
   const f=fill.getContext('2d'),r=rng(11);const crystals=[];for(let i=0;i<14;i++)crystals.push([r()*W,r()*W,20+r()*36,r()*6.28,r()]);
   for(const [x0,y0,q,ang,t] of crystals)for(const dx of [-W,0,W])for(const dy of [-W,0,W]){f.save();f.translate(x0+dx,y0+dy);f.rotate(ang);f.beginPath();f.moveTo(0,-q);f.lineTo(q*.28,-q*.55);f.lineTo(q*.28,q*.6);f.lineTo(0,q);f.lineTo(-q*.28,q*.6);f.lineTo(-q*.28,-q*.55);f.closePath();f.fillStyle=`rgba(${t>.5?'198,244,255':'150,214,255'},.82)`;f.fill();f.beginPath();f.moveTo(0,-q);f.lineTo(q*.28,-q*.55);f.lineTo(q*.28,q*.6);f.lineTo(0,q);f.closePath();f.fillStyle='rgba(40,110,170,.35)';f.fill();f.restore();}
   const sn=fbm(30,8,W,HS,47),sc=fbm(3,48,W,HS,48),ef=wave(10,4),mw=wave(11,5),mw2=wave(12,5);
   const surface=image(W,HS,(x,y)=>{if(y<FAR+Math.max(0,ef(x)+2.5))return [0,0,0,0];const ice=smooth(28+mw(x),36+mw(x),y)*(1-smooth(96+mw2(x),104+mw2(x),y));const snow=scale([232,240,248],.9+sn(x,y)*.14);let i=mixc([120,186,224],[176,224,244],sn(x,y));i=mixc(i,[236,250,255],smooth(.56,.64,sc(x,y))*.5);return mixc(snow,i,ice);});
   const rr=rng(12),sp=[];let xx=0;while(xx<W-6){const w=8+rr()*22;sp.push([xx,w,18+rr()*64]);xx+=w;}sp[sp.length-1][1]=W-sp[sp.length-1][0];
   const cache=new Float32Array(W);for(const [a,w,l] of sp)for(let i=Math.floor(a);i<Math.min(W,a+w);i++){cache[i]=16+l*(1-Math.abs((i-a)/w*2-1));}
   const bd=image(W,HS,(x,y)=>{const e=cache[x];if(y<16)return scale([232,240,248],.94+sn(x,y)*.1);if(y<e)return mixc([226,244,252],[118,196,236],(y-16)/(e-16+.01));const t=(y-e)/12;if(t<1)return [10,30,60,Math.round(70*(1-t))];return [0,0,0,0];});
   return {fill,surface,band:bd};
  },
  scrap(){
   const n=fbm(10,10,W,W,51),rust=fbm(6,6,W,W,54),rn=rng(13),tint=[];for(let i=0;i<16;i++)tint.push(rn());
   const fill=image(W,W,(x,y)=>{const u=(x+64)%128,v=(y+64)%128,j=Math.min(u,128-u,v,128-v),id=Math.floor((x+64)/128)%4+4*(Math.floor((y+64)/128)%4),t=tint[id];let col=mixc([86,92,98],[58,66,78],t);const rt=smooth(.44,.66,rust(x,y));col=mixc(col,[132,70,34],rt);col=scale(col,.82+n(x,y)*.34);if(j<3)return scale(col,.34);col=scale(col,mix(1.14,1,smooth(3,8,j)));const rv=Math.min(Math.hypot(u-12,v-12),Math.hypot(116-u,v-12),Math.hypot(u-12,116-v),Math.hypot(116-u,116-v));if(rv<5)return scale([150,152,152],1.05-rv*.09);return col;});
   const sn=fbm(40,10,W,HS,57),rs=fbm(10,3,W,HS,58);
   const surface=image(W,HS,(x,y)=>{if(y<FAR)return [0,0,0,0];const bump=(((Math.floor(x/16)+Math.floor(y/16))%2)===0?Math.abs((x%16)-(y%16)):Math.abs((x%16)+(y%16)-16))<2.2&&(x%16>3&&x%16<13);let col=scale([116,122,128],.84+sn(x,y)*.3);if(bump)col=scale(col,1.34);col=mixc(col,[138,76,36],smooth(.5,.72,rs(x,y))*.75);if(y<14||y>=114){const st=((x+y)%64)<32;col=st?[226,178,40]:[36,36,38];col=scale(col,.84+sn(x,y)*.3);}return col;});
   const bd=image(W,HS,(x,y)=>{if(y<56){let col=scale([98,104,110],.84+n(x,y*2)*.3);col=mixc(col,[132,70,34],smooth(.5,.66,rust(x,y*2+40))*.8*smooth(10,50,y));const u=x%64,rv=Math.min(Math.hypot(u-16,y-16),Math.hypot(u-16,y-42));if(rv<5)return scale([156,158,160],1.05-rv*.08);if(y>=26&&y<30)col=scale(col,.56);if(x%128>=62&&x%128<65)col=scale(col,.5);return col;}if(y<74){const t=(y-56)/18;const drip=smooth(.55,.75,rust(x,y))*(1-t);return drip>.05?[110,58,28,Math.round(190*drip)]:[8,8,8,Math.round(120*(1-t)*(1-t))];}return [0,0,0,0];});
   return {fill,surface,band:bd};
  },
 };
 const a=K[p.kind]();
 return {surface:finishSurface(a.surface).toDataURL('image/png'),band:finishBand(a.band).toDataURL('image/png'),fill:a.fill.toDataURL('image/png')};
}
(async()=>{
 const browser=await chromium.launch();const page=await browser.newPage();
 const meta={generator:'tools/art/level_materials.cjs',generator_sha256:crypto.createHash('sha256').update(fs.readFileSync(__filename)).digest('hex'),browser:browser.version(),presets:[]};
 for(const p of PRESETS){
  const images=await page.evaluate(p.kind?paintKind:paint,p);
  fs.mkdirSync(path.join(OUT,p.id),{recursive:true});
  for(const [n,d] of Object.entries(images))fs.writeFileSync(path.join(OUT,p.id,n+'.png'),Buffer.from(d.split(',')[1],'base64'));
  meta.presets.push({id:p.id,name:p.name,seed:p.seed});
  console.log(p.id);
 }
 await browser.close();
 fs.writeFileSync(path.join(OUT,'generation.json'),JSON.stringify(meta,null,1)+'\n');
})().catch(e=>{console.error(e);process.exit(1);});
