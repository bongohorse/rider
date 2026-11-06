-- Debug-only free camera (#574): O or a button toggles it; WASD, arrows or a right-drag move, the wheel or Q and E zoom,
-- Shift is faster. It replaces only the view each frame, never physics, source or the follow state. No release build.
local M={}
local FREE_CAM=[==[(()=>{if(window.riderFreeCam)return;const k={},moves=['KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','KeyQ','KeyE','ShiftLeft','ShiftRight'];
let on=false,x=0,y=0,z=.8,last=0,drag=null;
const b=document.createElement('button');b.type='button';b.textContent='Free cam [O]';b.style.cssText='position:fixed;left:16px;bottom:64px;z-index:9;padding:6px 10px;font:600 13px sans-serif;background:#1d3a44;color:#fff;border:1px solid #6fb;border-radius:4px;opacity:.9';
const set=v=>{on=v;b.textContent=on?'Free cam ON [O]':'Free cam [O]';b.style.background=on?'#2c8a5e':'#1d3a44';if(on){addEventListener('wheel',onWheel,{capture:true,passive:false});const c=window.riderRoadProjection&&window.riderRoadProjection.camera;if(c){x=c[0];y=c[1];}last=performance.now();}else{removeEventListener('wheel',onWheel,{capture:true});delete window.riderFreeCamPose;for(const m of moves)k[m]=0;drag=null;}};
b.onclick=()=>{set(!on);document.querySelector('canvas')?.focus();};document.body.append(b);
const cancel=e=>{e.stopImmediatePropagation();e.preventDefault();};
const typing=e=>{const t=e.target;return !!(t&&(t.tagName==='INPUT'||t.tagName==='TEXTAREA'||t.tagName==='SELECT'||t.isContentEditable));};
const skip=e=>window.riderEditing||typing(e)||e.ctrlKey||e.metaKey||e.altKey;
addEventListener('keydown',e=>{if(skip(e))return;if(e.code==='KeyO'){if(!e.repeat)set(!on);cancel(e);return;}if(on&&moves.includes(e.code)){k[e.code]=1;cancel(e);}},true);
addEventListener('blur',()=>{for(const m of moves)k[m]=0;});
addEventListener('keyup',e=>{if(on&&k[e.code]){k[e.code]=0;cancel(e);}},true);
const scale=()=>{const c=document.querySelector('canvas');return (c.width/c.clientWidth)/(100*z);};
addEventListener('mousedown',e=>{if(on&&e.button===2){drag={cx:e.clientX,cy:e.clientY,x,y};cancel(e);}},true);
addEventListener('mousemove',e=>{if(drag){x=drag.x-(e.clientX-drag.cx)*scale();y=drag.y+(e.clientY-drag.cy)*scale();cancel(e);}},true);
addEventListener('mouseup',e=>{if(drag&&e.button===2){drag=null;cancel(e);}},true);
addEventListener('contextmenu',e=>{if(on)cancel(e);},true);
const onWheel=e=>{if(!on)return;const c=document.querySelector('canvas').getBoundingClientRect();if(e.clientX>c.left+c.width*.65)return;z=Math.max(.02,Math.min(6,z*Math.exp(-e.deltaY*.001)));cancel(e);};
const step=t=>{requestAnimationFrame(step);b.style.display=window.riderEditing?'none':'';if(window.riderEditing&&on)set(false);if(!on)return;const d=Math.min(.1,(t-last)/1000);last=t;const v=12/z*(k.ShiftLeft||k.ShiftRight?3:1)*d;
x+=((k.KeyD||k.ArrowRight?1:0)-(k.KeyA||k.ArrowLeft?1:0))*v;y+=((k.KeyW||k.ArrowUp?1:0)-(k.KeyS||k.ArrowDown?1:0))*v;
if(k.KeyE)z=Math.min(6,z*Math.exp(d*1.5));if(k.KeyQ)z=Math.max(.02,z*Math.exp(-d*1.5));window.riderFreeCamPose={x,y,zoom:z};};
requestAnimationFrame(step);window.riderFreeCam={set,get on(){return on;},get zoom(){return z;}};})()]==]
function M.update()
    if not (html5 and sys.get_engine_info().is_debug) then return end
    if not M.installed then M.installed=true;html5.run(FREE_CAM) end
    local text=html5.run("window.riderFreeCamPose?JSON.stringify(window.riderFreeCamPose):''")
    if text=='' then
        if M.saved_zoom then go.set('/camera#camera','orthographic_zoom',M.saved_zoom);M.saved_zoom=nil end
        return
    end
    if not M.saved_zoom then M.saved_zoom=go.get('/camera#camera','orthographic_zoom') end
    local ok,pose=pcall(json.decode,text)
    if not ok or type(pose)~='table' then return end
    local scale=sys.get_config_number('physics.scale',.01)
    go.set_position(vmath.vector3(pose.x/scale,pose.y/scale,500),'/camera')
    go.set('/camera#camera','orthographic_zoom',pose.zoom)
end
return M
