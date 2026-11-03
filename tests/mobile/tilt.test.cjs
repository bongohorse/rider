const {test}=require('node:test');
const assert=require('node:assert/strict');
const {angle,normalize}=require('../../main/game/tilt.js');
const near=(a,b)=>assert(Math.abs(a-b)<1e-9,`${a} != ${b}`);
test('screen horizontal lean stays consistent in four orientations',()=>{
  near(angle(0,-30,0),30);
  near(angle(30,0,90),30);
  near(angle(0,30,180),30);
  near(angle(-30,0,270),30);
  near(angle(0,-30,360),30);
});
test('neutral, dead zone, proportional response, clamping and inversion',()=>{
  near(normalize(10,10,20,3,false),0);
  near(normalize(12,10,20,3,false),0);
  near(normalize(23,10,20,3,false),10/17);
  near(normalize(30,10,20,3,false),1);
  near(normalize(-10,10,20,3,false),-1);
  near(normalize(30,10,20,3,true),-1);
  near(normalize(200,10,20,3,false),1);
});
test('missing, nonfinite and out-of-range sensor data cannot become input',()=>{
  for(const value of [null,undefined,NaN,Infinity,'0'])assert.equal(angle(value,0,0),null);
  assert.equal(angle(181,0,0),null);assert.equal(angle(0,91,0),null);
  assert.equal(angle(0,0,Infinity),null);
  near(normalize(null,0,20,3,false),0);
  near(normalize(30,0,3,3,false),0);
  near(normalize(30,0,20,-1,false),0);
});

// #439: the real tilt.js (and mobile.js, touch off) in a stubbed browser realm with
// controllable focus, visibility, viewport and screen angle. Real-browser cases:
// tools/preview/tilt.cjs.
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const sources=['tilt.js','mobile.js'].map(name=>fs.readFileSync(path.join(__dirname,'../../main/game',name),'utf8'));
function realm({mobile=false,permission}={}){
  const listeners=new Map(),timers=[];
  const target=()=>{
    const map=new Map();listeners.set(map,true);
    return {map,addEventListener(type,handler){if(!map.has(type))map.set(type,[]);map.get(type).push(handler);},
      removeEventListener(type,handler){const list=map.get(type)||[];const i=list.indexOf(handler);if(i>=0)list.splice(i,1);}};
  };
  const win=target(),doc=target(),orient=target();
  const state={focused:true};
  const orientation={angle:90,type:'landscape-primary',addEventListener:orient.addEventListener,removeEventListener:orient.removeEventListener};
  const DeviceOrientationEvent=function(){};
  if(permission)DeviceOrientationEvent.requestPermission=()=>Promise.resolve(permission);
  const document={hidden:false,visibilityState:'visible',hasFocus:()=>state.focused,addEventListener:doc.addEventListener,removeEventListener:doc.removeEventListener,querySelector:()=>null};
  const window={isSecureContext:true,innerWidth:900,innerHeight:400,DeviceOrientationEvent,
    addEventListener:win.addEventListener,removeEventListener:win.removeEventListener};
  const fire=(map,type,event={})=>{for(const handler of [...(map.get(type)||[])])handler(event);};
  const context={window,document,screen:{orientation},URLSearchParams,performance:{now:()=>0},
    navigator:{maxTouchPoints:0,userAgent:'node'},location:{search:'?touch=0'},
    setTimeout:(fn,ms)=>{const t={fn,ms,done:false};timers.push(t);return t;},clearTimeout:t=>{if(t)t.done=true;}};
  vm.runInNewContext(sources[0],context);
  if(mobile)vm.runInNewContext(sources[1],context);
  const page={window,document,orientation,tilt:window.riderTilt,mobile:window.riderMobile,
    flush(){for(const t of timers.filter(t=>!t.done&&t.ms===0)){t.done=true;t.fn();}},
    sample(beta,gamma){fire(win.map,'deviceorientation',{beta,gamma});},
    blur(){state.focused=false;fire(win.map,'blur');page.flush();},
    focus(){state.focused=true;fire(win.map,'focus');page.flush();},
    hide(){document.hidden=true;document.visibilityState='hidden';fire(doc.map,'visibilitychange');page.flush();},
    show(){document.hidden=false;document.visibilityState='visible';fire(doc.map,'visibilitychange');page.flush();},
    view(width,height,angle,type){window.innerWidth=width;window.innerHeight=height;
      if(angle!==undefined){orientation.angle=angle;orientation.type=type||(width>=height?'landscape':'portrait')+'-primary';fire(orient.map,'change');fire(win.map,'orientationchange');}
      fire(win.map,'resize');page.flush();},
  };
  return page;
}
// Screen angle 90, landscape: beta drives screen-horizontal lean (angle(b,0,90) === b).
async function calibrated(options){
  const page=realm(options);
  await page.tilt.enable();
  assert.equal(page.tilt.mode,'waiting');
  page.sample(5,0);assert.equal(page.tilt.mode,'calibrate');
  assert.equal(page.tilt.calibrate(),true);
  assert.equal(page.tilt.mode,'active');near(page.tilt.neutral,5);
  page.sample(25,0);near(page.tilt.lean(),1);
  return page;
}
function away(page,leave,back){
  leave(page);
  assert.equal(page.tilt.mode,'paused','Away pauses tilt');
  near(page.tilt.neutral,5);
  page.sample(-40,0);page.sample(40,0);
  assert.equal(page.tilt.lean(),0,'No lean while away');
  assert.equal(page.tilt.mode,'paused','Samples while away do not resume tilt');
  back(page);
  assert.equal(page.tilt.mode,'active','Return resumes tilt without calibration');
  near(page.tilt.neutral,5);
  assert.equal(page.tilt.lean(),0,'A sample from before the return is never applied');
  page.sample(15,0);near(page.tilt.lean(),7/17);
}
test('resume decision: only a visible, focused landscape view on the calibrated side resumes',()=>{
  const {resume}=require('../../main/game/tilt.js');
  const view={neutralAngle:90,screenAngle:90,visible:true,focused:true,landscape:true};
  assert.equal(resume(view),'active');
  assert.equal(resume({...view,neutralAngle:-90,screenAngle:270}),'active');
  for(const key of ['visible','focused','landscape'])assert.equal(resume({...view,[key]:false}),'paused',key);
  assert.equal(resume({...view,screenAngle:270}),'calibrate','90 -> 270 flip needs a new neutral');
  assert.equal(resume({...view,neutralAngle:270,screenAngle:90}),'calibrate','270 -> 90 flip needs a new neutral');
  assert.equal(resume({...view,screenAngle:270,focused:false}),'paused','A flip is judged only on return');
  assert.equal(resume({...view,neutralAngle:null}),'calibrate');
  assert.equal(resume({...view,screenAngle:NaN}),'calibrate');
});
test('focus loss keeps the calibrated neutral and resumes on focus',async()=>{
  away(await calibrated(),page=>page.blur(),page=>page.focus());
});
test('a hidden page keeps the neutral; visible but unfocused stays paused',async()=>{
  away(await calibrated(),page=>{page.blur();page.hide();},page=>{
    page.show();assert.equal(page.tilt.mode,'paused','Visible but unfocused stays paused');
    page.focus();
  });
});
test('a landscape resize keeps the neutral and resumes',async()=>{
  for(const options of [{},{mobile:true}]){
    const page=await calibrated(options);
    page.view(880,420);
    assert.equal(page.tilt.mode,'active','Same-side landscape resize resumes at once');
    near(page.tilt.neutral,5);
    assert.equal(page.tilt.lean(),0,'No lean from a sample taken before the resize');
    page.sample(15,0);near(page.tilt.lean(),7/17);
  }
});
test('portrait pauses tilt; returning to the same landscape side resumes with the neutral',async()=>{
  away(await calibrated(),page=>page.view(400,900,0),page=>{
    page.focus();assert.equal(page.tilt.mode,'paused','Focus alone does not resume in portrait');
    page.view(900,400,90);
  });
});
test('a stale portrait angle under landscape geometry cannot resume or drop the neutral',async()=>{
  const page=await calibrated();
  page.orientation.angle=0;page.orientation.type='portrait-primary';page.sample(10,10);
  assert.equal(page.tilt.mode,'paused');near(page.tilt.neutral,5);assert.equal(page.tilt.lean(),0);
  page.view(900,400,90);assert.equal(page.tilt.mode,'active');near(page.tilt.neutral,5);
});
test('a landscape side flip (90 <-> 270) requires a new calibration',async()=>{
  for(const [from,to] of [[90,270],[270,90]]){
    const page=realm();
    page.view(900,400,from,from===90?'landscape-primary':'landscape-secondary');
    await page.tilt.enable();page.sample(5,0);assert.equal(page.tilt.calibrate(),true);
    page.view(900,400,to,to===90?'landscape-primary':'landscape-secondary');
    assert.equal(page.tilt.mode,'calibrate',`${from} -> ${to} asks for calibration`);
    assert.equal(page.tilt.neutral,null);assert.match(page.tilt.reason,/side/i);
    page.sample(30,0);page.sample(-30,0);assert.equal(page.tilt.lean(),0,'No lean with the old neutral');
    // angle(beta,0,90) === beta and angle(beta,0,270) === -beta.
    const screenBeta=value=>to===90?value:-value;
    page.sample(screenBeta(12),0);
    assert.equal(page.tilt.calibrate(),true,'Calibrate neutral re-centres on the new side');
    near(page.tilt.neutral,12);assert.equal(page.tilt.neutralAngle,to);near(page.tilt.lean(),0);
    page.sample(screenBeta(22),0);near(page.tilt.lean(),7/17);
  }
});
test('a side flip while away is detected on return, also without a change event',async()=>{
  const page=await calibrated();
  page.blur();page.orientation.angle=270;page.orientation.type='landscape-secondary';
  page.focus();assert.equal(page.tilt.mode,'calibrate');assert.equal(page.tilt.neutral,null);
  const quiet=await calibrated();
  quiet.orientation.angle=270;quiet.orientation.type='landscape-secondary';
  quiet.sample(30,0);
  assert.equal(quiet.tilt.mode,'calibrate','An active sample on the other side drops the neutral');
  assert.equal(quiet.tilt.lean(),0);
});
test('explicit Calibrate neutral re-centres while active and after return',async()=>{
  const page=await calibrated();
  page.sample(12,0);assert.equal(page.tilt.calibrate(),true);near(page.tilt.neutral,12);
  page.blur();page.focus();
  assert.equal(page.tilt.calibrate(),false,'No fresh sample yet');
  page.sample(-3,0);assert.equal(page.tilt.calibrate(),true);near(page.tilt.neutral,-3);
});
test('mobile.js focus, visibility and resize releases keep the neutral',async()=>{
  const page=await calibrated({mobile:true});
  away(page,p=>p.blur(),p=>p.focus());
  away(page,p=>{p.blur();p.hide();},p=>{p.show();p.focus();});
  away(page,p=>{p.blur();p.view(880,420);},p=>p.focus());
});
test('Retry, UI capture and cleared input still require recalibration',async()=>{
  const page=await calibrated({mobile:true});
  page.mobile.clear(true);assert.equal(page.tilt.mode,'active','Pause/time changes keep tilt');
  page.mobile.clear();
  assert.equal(page.tilt.mode,'calibrate');assert.equal(page.tilt.neutral,null);assert.equal(page.tilt.lean(),0);
  page.sample(5,0);page.tilt.calibrate();page.blur();page.mobile.clear();
  assert.equal(page.tilt.mode,'calibrate','A reset while away still drops the neutral');
  page.focus();assert.equal(page.tilt.mode,'calibrate');assert.equal(page.tilt.neutral,null);
});
test('permission denial still falls back to touch',async()=>{
  const page=realm({permission:'denied'});
  await page.tilt.enable();
  assert.equal(page.tilt.mode,'fallback');assert.match(page.tilt.reason,/denied/);
  assert.equal(page.tilt.neutral,null);page.focus();assert.equal(page.tilt.mode,'fallback');
  assert.equal(page.tilt.lean(),0);
});
