// Relative orientation -> one normalized lean input. No physics or second loop.
(function(root){
  const clamp=(n,lo,hi)=>Math.min(hi,Math.max(lo,n));
  function angle(beta,gamma,screenAngle){
    if(![beta,gamma,screenAngle].every(Number.isFinite)||Math.abs(beta)>180||Math.abs(gamma)>90)return null;
    const r=Math.PI/180,b=beta*r,g=gamma*r,s=screenAngle*r;
    // W3C Z-X-Y matrix row 3 gives device-frame vertical. Project it onto
    // screen-horizontal so landscape and portrait do not exchange lean axes.
    const x=-Math.cos(b)*Math.sin(g),y=Math.sin(b);
    return Math.asin(clamp(x*Math.cos(s)+y*Math.sin(s),-1,1))/r;
  }
  function normalize(raw,neutral,fullAngle,deadZone,inverted){
    if(![raw,neutral,fullAngle,deadZone].every(Number.isFinite)||fullAngle<=deadZone||deadZone<0)return 0;
    const delta=raw-neutral,magnitude=Math.max(0,Math.abs(delta)-deadZone)/(fullAngle-deadZone);
    return Math.sign(delta)*clamp(magnitude,0,1)*(inverted?-1:1);
  }
  if(typeof module==='object'&&module.exports)module.exports={angle,normalize};
  if(!root)return;
  if(root.riderTilt)return;
  const api=root.riderTilt={mode:'off',reason:'',fullAngle:20,deadZone:3,inverted:false,neutral:null,raw:null,received:0};
  let token=0,timer,lastSample,handler,lastAngles;
  const screenAngle=()=>Number.isFinite(screen.orientation?.angle)?screen.orientation.angle:Number.isFinite(root.orientation)?root.orientation:0;
  function detach(){
    if(handler)root.removeEventListener('deviceorientation',handler);
    handler=null;clearTimeout(timer);timer=null;
  }
  function fallback(reason){detach();api.mode='fallback';api.reason=reason;api.neutral=null;api.raw=null;token++;}
  api.disable=()=>{detach();token++;api.mode='off';api.reason='';api.neutral=null;api.raw=null;lastAngles=null;api.received=0;api.permissionPath='not requested';lastSample=undefined;};
  api.pause=reason=>{
    if(api.mode==='active'||api.mode==='calibrate'){
      api.mode='calibrate';api.neutral=null;api.reason=reason||'Calibrate neutral to resume';
    }
  };
  api.enable=async()=>{
    api.disable();const request=token;
    if(!root.isSecureContext){fallback('Secure connection required; use touch');return;}
    if(typeof root.DeviceOrientationEvent!=='function'){fallback('Tilt unavailable; use touch');return;}
    api.mode='permission';api.reason='Waiting for motion permission';
    try{
      const requestPermission=root.DeviceOrientationEvent.requestPermission;
      api.permissionPath=typeof requestPermission==='function'?'requestPermission':'legacy event API';
      if(typeof requestPermission==='function'){
        const result=await requestPermission.call(root.DeviceOrientationEvent);
        if(request!==token)return;
        if(result!=='granted'){fallback('Motion permission denied; use touch');return;}
      }
      if(request!==token)return;
      api.mode='waiting';api.reason='Hold neutral; waiting for sensor';
      handler=event=>{
        const value=angle(event.beta,event.gamma,screenAngle());
        if(value===null){
          if(api.mode==='active'||api.mode==='calibrate')fallback('Invalid sensor data; use touch');
          return;
        }
        lastAngles={beta:event.beta,gamma:event.gamma};
        api.raw=value;api.received++;lastSample=performance.now();
        clearTimeout(timer);timer=null;
        if(api.mode==='waiting'){api.mode='calibrate';api.reason='Tap Calibrate neutral while holding comfortably';}
      };
      root.addEventListener('deviceorientation',handler);
      timer=setTimeout(()=>{if(request===token&&api.mode==='waiting')fallback('No sensor data; use touch');},3000);
    }catch(error){if(request===token)fallback('Motion permission unavailable; use touch');}
  };
  api.calibrate=()=>{
    if(api.mode!=='calibrate'&&api.mode!=='active')return false;
    if(api.raw===null)return false;
    api.neutral=api.raw;api.mode='active';api.reason='';return true;
  };
  api.configure=(key,value)=>{
    if(key==='inverted'){api.inverted=!!value;return;}
    if(!Number.isFinite(value))return;
    if(key==='fullAngle')api.fullAngle=clamp(value,10,45);
    if(key==='deadZone')api.deadZone=clamp(value,0,8);
  };
  api.lean=()=>api.mode==='active'?normalize(api.raw,api.neutral,api.fullAngle,api.deadZone,api.inverted):0;
  api.snapshot=()=>({mode:api.mode,reason:api.reason,fullAngle:api.fullAngle,deadZone:api.deadZone,
    inverted:api.inverted,neutral:api.neutral,raw:api.raw,lean:api.lean(),received:api.received,
    screenAngle:screenAngle(),permissionPath:api.permissionPath||'not requested',
    sampleAgeMs:lastSample===undefined?null:performance.now()-lastSample});
  root.addEventListener('blur',()=>api.pause('Focus lost — calibrate to resume'));
  document.addEventListener('visibilitychange',()=>{if(document.hidden)api.pause('Page hidden — calibrate to resume');});
  root.addEventListener('resize',()=>{
    if(lastAngles)api.raw=angle(lastAngles.beta,lastAngles.gamma,screenAngle());
    api.pause('View changed — calibrate to resume');
  });
})(typeof window==='undefined'?null:window);
