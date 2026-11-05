// #536 experiment: original, procedural placeholder art (no third-party input). 512 px = 4 m. Deterministic.
// Usage: node tools/terrain_material/experiment_536/art.cjs
'use strict';
const fs=require('node:fs'),path=require('node:path');
const {chromium}=require('playwright');
const OUT=path.resolve(__dirname,'../../../main/terrain_material/experiment_536');
function paint(){
 const S=512;
 let seed=536;const r=()=>(seed=(seed*1664525+1013904223)>>>0)/2**32;const R=(a,b)=>a+(b-a)*r();
 const make=()=>{const c=document.createElement('canvas');c.width=c.height=S;return c;};
 const wrap=(fn,both=true)=>{for(const dx of [-S,0,S])for(const dy of both?[-S,0,S]:[0])fn(dx,dy);};
 const hsl=(h,s,l,a=1)=>`hsla(${h},${s}%,${l}%,${a})`;
 // FILL: earth with soft blotches, faint strata, stones and pebbles; tiles both ways.
 const fill=make(),f=fill.getContext('2d');
 f.fillStyle=hsl(26,36,29);f.fillRect(0,0,S,S);
 for(let i=0;i<420;i++){const x=R(0,S),y=R(0,S),q=R(14,70),dark=r()<.5,a=R(.03,.09);
  wrap((dx,dy)=>{const g=f.createRadialGradient(x+dx,y+dy,0,x+dx,y+dy,q);g.addColorStop(0,dark?`rgba(30,16,8,${a})`:`rgba(190,140,90,${a})`);g.addColorStop(1,'rgba(0,0,0,0)');f.fillStyle=g;f.fillRect(x+dx-q,y+dy-q,2*q,2*q);});}
 for(let i=0;i<18000;i++){const x=R(0,S),y=R(0,S);f.fillStyle=r()<.5?`rgba(20,10,5,${R(.04,.16)})`:`rgba(215,170,120,${R(.03,.12)})`;f.fillRect(x,y,R(1,2.4),R(1,2));}
 const stone=(ctx,x,y,q,h,s,l)=>{const n=9,a=[];const k=R(.65,.95),rot=R(0,3.14);for(let i=0;i<n;i++){const t=i/n*6.283,d=q*R(.82,1.12);const px=Math.cos(t)*d,py=Math.sin(t)*d*k;a.push([x+px*Math.cos(rot)-py*Math.sin(rot),y+px*Math.sin(rot)+py*Math.cos(rot)]);}
  const path=(ox,oy)=>{ctx.beginPath();for(let i=0;i<n;i++){const p=a[i],m=a[(i+1)%n];const mx=(p[0]+m[0])/2+ox,my=(p[1]+m[1])/2+oy;if(i===0)ctx.moveTo(mx,my);else ctx.quadraticCurveTo(p[0]+ox,p[1]+oy,mx,my);}const p=a[0],m=a[1];ctx.quadraticCurveTo(p[0]+ox,p[1]+oy,(p[0]+m[0])/2+ox,(p[1]+m[1])/2+oy);ctx.closePath();};
  path(q*.08,q*.14);ctx.fillStyle='rgba(15,8,4,.45)';ctx.fill();
  path(0,0);const g=ctx.createLinearGradient(x,y-q,x,y+q);g.addColorStop(0,hsl(h,s,l+16));g.addColorStop(.55,hsl(h,s,l));g.addColorStop(1,hsl(h,s,l-12));ctx.fillStyle=g;ctx.fill();};
 for(let i=0;i<34;i++){const x=R(0,S),y=R(0,S),q=i<8?R(16,30):R(5,13),h=R(24,40),s=R(6,18),l=R(38,56);const before=seed;wrap((dx,dy)=>{seed=before;stone(f,x+dx,y+dy,q,h,s,l);});}
 // BAND: grass fringe from the driving line down, transparent below; tiles in U only, fades out by ~0.9 m.
 const band=make(),b=band.getContext('2d');
 const k=[[1,R(0,6.28),11],[2,R(0,6.28),8],[3,R(0,6.28),6],[5,R(0,6.28),5],[8,R(0,6.28),4],[13,R(0,6.28),3]];
 const edge=x=>38+k.reduce((s,[n,p,a])=>s+a*Math.sin(x/S*6.283*n+p),0);
 const fringe=(ctx,off,style)=>{ctx.beginPath();ctx.moveTo(-2,0);for(let x=-2;x<=S+2;x+=2)ctx.lineTo(x,edge(x)+off);ctx.lineTo(S+2,0);ctx.closePath();ctx.fillStyle=style;ctx.fill();};
 // Soft contact shadow on the earth below the turf.
 for(let i=0;i<14;i++)fringe(b,i*3+6,'rgba(18,10,4,.055)');
 // Roots: thin dark tendrils.
 b.lineCap='round';for(let i=0;i<150;i++){const x=R(0,S),y0=edge(x)-4,len=R(10,46),sw=R(-10,10);const w=R(.7,1.8),a=R(.25,.6);wrap(dx=>{b.strokeStyle=`rgba(40,26,12,${a})`;b.lineWidth=w;b.beginPath();b.moveTo(x+dx,y0);b.quadraticCurveTo(x+dx+sw,y0+len*.5,x+dx+sw*.4,y0+len);b.stroke();},false);}
 const g=b.createLinearGradient(0,0,0,64);g.addColorStop(0,hsl(92,58,42));g.addColorStop(.55,hsl(100,55,31));g.addColorStop(1,hsl(112,52,22));
 fringe(b,0,g);
 // Hanging blades over the edge, then light flecks on the turf.
 for(let i=0;i<900;i++){const x=R(0,S),e=edge(x),y0=e-R(0,8),len=R(7,26),sw=R(-5,5),w=R(1.2,3),l=R(20,36),h=R(94,114);wrap(dx=>{b.strokeStyle=hsl(h,54,l);b.lineWidth=w;b.beginPath();b.moveTo(x+dx,y0);b.quadraticCurveTo(x+dx+sw*.4,y0+len*.6,x+dx+sw,y0+len);b.stroke();},false);}
 for(let i=0;i<2600;i++){const x=R(0,S),t=r(),y=t*edge(x),h=R(80,104),l=R(30,60),a=R(.25,.6),w=R(1,2.2),c=R(3,7);wrap(dx=>{b.fillStyle=hsl(h,58,l,a);b.fillRect(x+dx,y,w,c);},false);}
 // Top rows meet the Surface in one shared colour: no bright line at the fold.
 b.globalCompositeOperation='source-atop';const bt=b.createLinearGradient(0,0,0,16);bt.addColorStop(0,'rgba(84,134,44,.72)');bt.addColorStop(1,'rgba(84,134,44,0)');b.fillStyle=bt;b.fillRect(0,0,S,16);b.globalCompositeOperation='source-over';
 // SURFACE: seen from above. Row 128 is the driving line, row 0 the far edge; darker to the back.
 const surface=make(),s=surface.getContext('2d');
 const sg=s.createLinearGradient(0,0,0,128);sg.addColorStop(0,hsl(108,44,27));sg.addColorStop(.6,hsl(98,52,36));sg.addColorStop(1,hsl(88,62,47));
 s.fillStyle=sg;s.fillRect(0,0,S,S);
 for(let i=0;i<280;i++){const x=R(0,S),y=R(0,128),q=R(10,40),a=R(.05,.13),dark=r()<.5;wrap(dx=>{const c=s.createRadialGradient(x+dx,y,0,x+dx,y,q);c.addColorStop(0,dark?`rgba(12,44,12,${a})`:`rgba(190,225,110,${a})`);c.addColorStop(1,'rgba(0,0,0,0)');s.fillStyle=c;s.fillRect(x+dx-q,y-q,2*q,2*q);},false);}
 for(let i=0;i<5200;i++){const x=R(0,S),y=R(0,134),len=R(4,12),sw=R(-3,3),w=R(.8,1.8),t=y/128,h=R(82,114),l=R(24,40)+t*18,a=R(.45,.9);wrap(dx=>{s.strokeStyle=hsl(h,56,l,a);s.lineWidth=w;s.beginPath();s.moveTo(x+dx,y);s.lineTo(x+dx+sw,y-len);s.stroke();},false);}
 // Worn track: sandy earth along the middle where many cars drove; grass stays on both sides and creeps over the edges.
 const wave=()=>[[1,R(0,6.28),5],[2,R(0,6.28),4],[3,R(0,6.28),3],[7,R(0,6.28),2],[11,R(0,6.28),1]];
 const w1=wave(),w2=wave(),at=(w,x)=>w.reduce((v,[n,p,a])=>v+a*Math.sin(x/S*6.283*n+p),0);
 const back=x=>25+at(w1,x),front=x=>106+at(w2,x);
 s.save();s.beginPath();s.moveTo(0,back(0));for(let x=2;x<=S;x+=2)s.lineTo(x,back(x));for(let x=S;x>=0;x-=2)s.lineTo(x,front(x));s.closePath();s.clip();
 const dg=s.createLinearGradient(0,20,0,110);dg.addColorStop(0,hsl(32,32,35));dg.addColorStop(.25,hsl(36,36,44));dg.addColorStop(.6,hsl(38,40,52));dg.addColorStop(1,hsl(34,36,42));s.fillStyle=dg;s.fillRect(0,0,S,128);
 for(let i=0;i<150;i++){const x=R(0,S),y=R(20,110),q=R(8,34),a=R(.05,.14),dark=r()<.5;wrap(dx=>{const c=s.createRadialGradient(x+dx,y,0,x+dx,y,q);c.addColorStop(0,dark?`rgba(70,44,22,${a})`:`rgba(232,204,150,${a})`);c.addColorStop(1,'rgba(0,0,0,0)');s.fillStyle=c;s.fillRect(x+dx-q,y-q,2*q,2*q);},false);}
 // Tyre wear: two soft ruts and fine streaks running along the track.
 for(const [row,n,p] of [[50,3,R(0,6.28)],[82,2,R(0,6.28)]])for(const [w,a] of [[11,.09],[6,.13]]){s.strokeStyle=`rgba(58,36,18,${a})`;s.lineWidth=w;s.beginPath();for(let x=-2;x<=S+2;x+=4){const y=row+2.5*Math.sin(x/S*6.283*n+p);if(x<0)s.moveTo(x,y);else s.lineTo(x,y);}s.stroke();}
 for(let i=0;i<190;i++){const x=R(0,S),y=R(26,104),l=R(30,190),a=R(.04,.13),w=R(.6,1.6),dark=r()<.6;wrap(dx=>{s.strokeStyle=dark?`rgba(58,36,18,${a})`:`rgba(240,214,164,${a})`;s.lineWidth=w;s.beginPath();s.moveTo(x+dx,y);s.lineTo(x+dx+l,y+R(-.6,.6));s.stroke();},false);}
 for(let i=0;i<9000;i++){const x=R(0,S),y=R(18,112);s.fillStyle=r()<.5?`rgba(50,30,14,${R(.08,.25)})`:`rgba(245,225,180,${R(.06,.2)})`;s.fillRect(x,y,R(.8,1.8),R(.6,1.3));}
 for(let i=0;i<90;i++){const x=R(0,S),y=R(30,102),q=R(.8,2.2),l=R(45,70);wrap(dx=>{s.fillStyle='rgba(30,18,8,.35)';s.beginPath();s.ellipse(x+dx+.5,y+.7,q,q*.7,0,0,6.3);s.fill();s.fillStyle=hsl(34,10,l);s.beginPath();s.ellipse(x+dx,y,q,q*.7,0,0,6.3);s.fill();},false);}
 s.restore();
 // Grass blades over both edges; only a few tufts survive in the middle.
 const blade=(x,y,len)=>{const sw=R(-3,3),w=R(.8,1.8),h=R(82,114),l=R(26,50),a=R(.6,.95);wrap(dx=>{s.strokeStyle=hsl(h,56,l,a);s.lineWidth=w;s.beginPath();s.moveTo(x+dx,y);s.lineTo(x+dx+sw,y-len);s.stroke();},false);};
 for(let i=0;i<2200;i++){const x=R(0,S);blade(x,back(x)+R(-2,11),R(4,11));}
 for(let i=0;i<2200;i++){const x=R(0,S);blade(x,front(x)+R(-5,8),R(4,12));}
 for(let i=0;i<14;i++){const x=R(0,S),y=R(44,92);for(let j=0;j<18;j++)blade(x+R(-5,5),y+R(-2,2),R(3,7));}
 // Front rows fade into the same colour as the Band's top rows.
 const ft=s.createLinearGradient(0,110,0,128);ft.addColorStop(0,'rgba(84,134,44,0)');ft.addColorStop(1,'rgba(84,134,44,.72)');s.fillStyle=ft;s.fillRect(0,110,S,18);
 const dump=c=>c.toDataURL('image/png');
 // SHADOW: soft dark ellipse for the vehicle.
 const shadow=document.createElement('canvas');shadow.width=256;shadow.height=52;const h=shadow.getContext('2d');h.translate(128,26);h.scale(1,26/128);const sh=h.createRadialGradient(0,0,0,0,0,128);sh.addColorStop(0,'rgba(0,0,0,1)');sh.addColorStop(.55,'rgba(0,0,0,.8)');sh.addColorStop(1,'rgba(0,0,0,0)');h.fillStyle=sh;h.fillRect(-128,-128,256,256);
 return {surface:dump(surface),band:dump(band),fill:dump(fill),shadow:dump(shadow)};
}
(async()=>{
 const browser=await chromium.launch();const page=await browser.newPage();
 const images=await page.evaluate(paint);await browser.close();
 fs.mkdirSync(OUT,{recursive:true});
 for(const [n,d] of Object.entries(images)){const file=path.join(OUT,n+'.png');fs.writeFileSync(file,Buffer.from(d.split(',')[1],'base64'));console.log(file,fs.statSync(file).size);}
})();
