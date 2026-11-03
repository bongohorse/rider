-- #443: camera A/B choice and live camera settings (camera_settings.lua), their version 3 player-settings format
-- (migration from versions 1 and 2, per-value fallback, newer file kept), clamping, reset, and feel.camera using them
-- (defaults change nothing, each setting moves the render camera, B-only settings never touch camera A).
local files={};local mode
local debug=false
sys={get_save_file=function(app,name) return app..'/'..name end,
 load=function(path) if mode=='unreadable' then error('injected unreadable settings') end;return files[path] or {} end,
 save=function(path,t) if mode=='write' then error('injected write failure') end
  local copy={};for k,v in pairs(t) do copy[k]=v end;files[path]=copy;return true end,
 get_engine_info=function() return {is_debug=debug} end,
 get_config_number=function(_,default) return default end,
 load_resource=function(path)
  local f=io.open('.'..path,'rb');if not f then return nil end
  local text=f:read('*a');f:close();return text
 end}
-- The preset files are flat JSON objects (no arrays): turn them into a Lua table constructor.
json={decode=function(text)
 local chunk=assert(loadstring('return '..text:gsub('"([%w_]+)"%s*:','["%1"]=')))
 return chunk()
end}
-- Minimal vmath for feel.camera: 3-vectors with +, - and scalar *.
local V={}
V.__index=V
local function v3(x,y,z) return setmetatable({x=x or 0,y=y or 0,z=z or 0},V) end
V.__add=function(a,b) return v3(a.x+b.x,a.y+b.y,a.z+b.z) end
V.__sub=function(a,b) return v3(a.x-b.x,a.y-b.y,a.z-b.z) end
V.__mul=function(a,b) if type(a)=='number' then a,b=b,a end;return v3(a.x*b,a.y*b,a.z*b) end
vmath={vector3=v3}
local cs=require 'main.game.camera_settings'
local settings=require 'main.game.player_settings'
local feel=require 'main.game.feel'

-- Specs: every setting has a default inside its range and a positive step; A is the default camera.
assert(cs.DEFAULT_MODE=='a' and cs.valid_mode('a') and cs.valid_mode('b') and not cs.valid_mode('c') and not cs.valid_mode(nil))
assert(#cs.SPECS==6,'six live settings')
for _,spec in ipairs(cs.SPECS) do
 assert(spec.default>=spec.min and spec.default<=spec.max and spec.step>0,spec.key)
 assert(cs.valid(spec.key,spec.default) and cs.BY_KEY[spec.key]==spec)
end
-- Multipliers default to exactly 1 and the height offset to 0 (x * 1 and y + 0 are exact: camera A unchanged).
local d=cs.defaults()
assert(d.mode=='a' and d.follow==1 and d.look==1 and d.zoom==1 and d.offset==0,'neutral defaults')
-- The B values are #374's: no extra landing pan surge, 240 u/s bound on new downhill lead.
assert(d.descent_response==0 and d.descent_rise_limit==240,'#374 camera B defaults')
assert(cs.BY_KEY.descent_response.b and cs.BY_KEY.descent_rise_limit.b and not cs.BY_KEY.follow.b,'B-only rows')
assert(cs.is_default(d) and cs.is_default(cs.DEFAULTS))
print('PASS camera settings specs: camera A default, neutral multipliers, #374 B values')

-- Clamping: out-of-range input lands on the limit; non-finite or non-number input is refused.
assert(cs.clamp('zoom',5)==1.4 and cs.clamp('zoom',0)==0.7 and cs.clamp('offset',-1000)==-150 and cs.clamp('offset',1000)==150)
assert(cs.clamp('follow',1.23456789)==1.2346,'rounded to 4 decimals')
for _,bad in ipairs({0/0,1/0,-1/0,'1',true,{},nil}) do assert(cs.clamp('zoom',bad)==nil,'clamp accepted '..tostring(bad)) end
assert(cs.clamp('nothing',1)==nil,'unknown key clamped')
-- Validity (stored values): inside the range only, no clamping.
assert(cs.valid('zoom',1.4) and cs.valid('zoom',0.7) and not cs.valid('zoom',1.41) and not cs.valid('zoom',0.69))
assert(not cs.valid('offset',0/0) and not cs.valid('offset',1/0) and not cs.valid('offset','0') and not cs.valid('nothing',0))
print('PASS camera settings clamping and validity')

-- Commands: toggle, mode, steps (clamped at the limits, exactly back on the default), set, reset, bad commands.
local c=cs.defaults()
assert(cs.apply(c,{command='toggle'}) and c.mode=='b' and cs.apply(c,{command='toggle'}) and c.mode=='a')
assert(not cs.apply(c,{command='mode',mode='a'}) and cs.apply(c,{command='mode',mode='b'}) and c.mode=='b')
assert(not cs.apply(c,{command='mode',mode='x'}) and c.mode=='b')
for _,spec in ipairs(cs.SPECS) do
 local n=0
 while cs.apply(c,{command='step',key=spec.key,dir=1}) do n=n+1;assert(n<1000) end
 assert(c[spec.key]==spec.max,spec.key..' not clamped at max '..c[spec.key])
 assert(not cs.apply(c,{command='step',key=spec.key,dir=1}),'step past max changed something')
 while cs.apply(c,{command='step',key=spec.key,dir=-1}) do n=n+1;assert(n<2000) end
 assert(c[spec.key]==spec.min,spec.key..' not clamped at min '..c[spec.key])
 -- Up from the default and back down returns exactly to the default (no float drift).
 c[spec.key]=spec.default
 for _=1,3 do cs.apply(c,{command='step',key=spec.key,dir=1}) end
 for _=1,3 do cs.apply(c,{command='step',key=spec.key,dir=-1}) end
 assert(c[spec.key]==spec.default,spec.key..' drifted: '..string.format('%.17g',c[spec.key]))
end
assert(cs.apply(c,{command='set',key='zoom',value=9}) and c.zoom==1.4,'set clamps')
assert(not cs.apply(c,{command='set',key='zoom',value=0/0}) and c.zoom==1.4,'set accepted NaN')
for _,bad in ipairs({{command='step',key='zoom',dir=2},{command='step',key='zoom'},{command='step',key='nothing',dir=1},
 {command='launch'},{},'reset'}) do
 local before=cs.copy(c)
 assert(not cs.apply(c,bad),'bad command accepted')
 for k,v in pairs(before) do assert(c[k]==v,'bad command changed '..k) end
end
assert(not cs.apply(nil,{command='toggle'}))
-- Reset: camera A and every default; a second reset is no change.
c.offset=40;c.follow=1.5
assert(cs.apply(c,{command='reset'}) and cs.is_default(c),'reset did not restore camera A defaults')
assert(not cs.apply(c,{command='reset'}),'reset of defaults reported a change')
-- Sanitize: each invalid field falls back on its own.
local s,valid=cs.sanitize({mode='b',follow=1.5,look='far',zoom=1.2,offset=500,descent_response=3,descent_rise_limit=0/0})
assert(not valid and s.mode=='b' and s.follow==1.5 and s.look==1 and s.zoom==1.2 and s.offset==0 and s.descent_response==3 and s.descent_rise_limit==240)
s,valid=cs.sanitize(nil);assert(not valid and cs.is_default(s))
s,valid=cs.sanitize(cs.copy(cs.DEFAULTS));assert(valid and cs.is_default(s))
print('PASS camera commands: toggle, mode, clamped steps back to default, set, reset to camera A, bad commands ignored')

-- Player settings version 3: defaults, roundtrip, migration from versions 1 and 2, per-value fallback, newer kept.
local path='rider/player-settings'
assert(settings.VERSION==3)
local p=settings.load();assert(p.status=='default' and cs.is_default(p.camera),'missing file: camera A defaults')
assert(settings.apply_camera(p,{command='toggle'}) and settings.apply_camera(p,{command='step',key='offset',dir=1}))
assert(settings.save(p)==true)
local f=files[path]
assert(f.version==3 and f.camera_mode=='b' and f.camera_offset==10 and f.camera_follow==1 and f.camera_zoom==1 and
 f.camera_look==1 and f.camera_descent_response==0 and f.camera_descent_rise_limit==240,'version 3 file')
assert(f.fps_cap==60 and f.fps_visible==true and f.fps_x==0 and f.fps_y==0,'version 3 keeps the FPS fields')
local r=settings.load();assert(r.status=='ok' and r.camera.mode=='b' and r.camera.offset==10,'roundtrip')
-- A version 2 (#444) file keeps its counter and gets camera A defaults; the next save writes version 3.
files[path]={version=2,fps_cap=30,fps_visible=false,fps_x=0.5,fps_y=1}
local v2=settings.load()
assert(v2.status=='ok' and v2.fps_cap==30 and v2.fps_visible==false and v2.fps_x==0.5 and v2.fps_y==1 and cs.is_default(v2.camera),'version 2 migration')
-- Version 2 never reads camera fields it did not have.
files[path]={version=2,fps_cap=30,fps_visible=false,fps_x=0.5,fps_y=1,camera_mode='b',camera_zoom=1.2}
v2=settings.load();assert(v2.status=='ok' and cs.is_default(v2.camera),'version 2 read camera fields')
assert(settings.apply_camera(v2,{command='toggle'}) and settings.save(v2)==true)
f=files[path];assert(f.version==3 and f.fps_cap==30 and f.fps_visible==false and f.camera_mode=='b' and f.camera_zoom==1,'migrated version 2 file')
-- A version 1 (#417) file keeps its cap and gets every other default.
files[path]={version=1,fps_cap=144}
local v1=settings.load();assert(v1.status=='ok' and v1.fps_cap==144 and v1.fps_visible==true and cs.is_default(v1.camera),'version 1 migration')
assert(settings.save(v1)==true and files[path].version==3 and files[path].camera_mode=='a','version 1 saved as version 3')
-- Each invalid camera value falls back on its own; the rest of the file stays.
local good={version=3,fps_cap=90,fps_visible=true,fps_x=0.25,fps_y=0.5,camera_mode='b',camera_follow=1.5,camera_look=0.5,
 camera_zoom=1.2,camera_offset=-30,camera_descent_response=4,camera_descent_rise_limit=600}
local function with(k,v) local t={};for a,b in pairs(good) do t[a]=b end;t[k]=v;return t end
files[path]=with('camera_mode','b');local g=settings.load()
assert(g.status=='ok' and g.camera.mode=='b' and g.camera.follow==1.5 and g.camera.look==0.5 and g.camera.zoom==1.2 and
 g.camera.offset==-30 and g.camera.descent_response==4 and g.camera.descent_rise_limit==600,'full version 3 file')
for _,bad in ipairs({{'camera_mode','c'},{'camera_mode',2},{'camera_mode',nil},{'camera_follow',3},{'camera_follow',0/0},
 {'camera_look','1'},{'camera_zoom',1/0},{'camera_offset',151},{'camera_offset',nil},{'camera_descent_response',-1},
 {'camera_descent_rise_limit',5000}}) do
 files[path]=with(bad[1],bad[2]);local v=settings.load()
 assert(v.status=='invalid','invalid '..bad[1]..' not reported')
 assert(v.fps_cap==90 and v.fps_x==0.25,'an invalid camera value dropped FPS values')
 local key=bad[1]:sub(8)
 for _,k in ipairs({'mode','follow','look','zoom','offset','descent_response','descent_rise_limit'}) do
  if k==key then assert(v.camera[k]==cs.DEFAULTS[k],k..' did not fall back')
  else assert(v.camera[k]==g.camera[k],'invalid '..key..' changed '..k) end
 end
end
mode='unreadable';local u=settings.load();assert(u.status=='invalid' and cs.is_default(u.camera),'unreadable fallback');mode=nil
-- A newer file is used where valid and never overwritten, also by camera commands (which last for the session).
files[path]=with('version',4);files[path].future='kept'
local n=settings.load();assert(n.status=='newer' and n.camera.mode=='b' and n.camera.zoom==1.2,'newer file not read')
assert(settings.apply_camera(n,{command='reset'}));local ok,why=settings.save(n)
assert(ok==false and why and files[path].camera_mode=='b' and files[path].future=='kept','newer file overwritten')
assert(n.camera.mode=='a','the reset still lasts for the session')
files[path]={version=4,fps_cap=60,camera_mode='z',camera_zoom='close'};n=settings.load()
assert(n.status=='newer' and n.camera.mode=='a' and n.camera.zoom==1,'unknown newer camera values fall back')
-- Invalid camera settings are never written.
files[path]=nil;local w=settings.load();w.camera.zoom=9;assert(settings.save(w)==false and files[path]==nil)
w.camera.zoom=1;w.camera.mode='c';assert(settings.save(w)==false and files[path]==nil)
w.camera=nil;assert(settings.save(w)==false and files[path]==nil)
print('PASS player settings v3: camera A defaults, roundtrip, v1/v2 migration, per-value fallback, newer file kept, invalid never written')

-- feel.camera with the settings: nil and the defaults are the same camera; each setting moves the render camera;
-- B-only settings never change camera A. Pure render maths: no body, tick or replay is involved.
local function run(experiment,tune,frames,velocity,grounded)
 local st,pos=feel.camera_start(0,90,0,velocity.x,270,tune)
 local zoom=feel.values.camera_zoom*(tune and tune.zoom or 1)
 local target=v3(0,90,0)
 for i=1,frames do
  target=v3(target.x+velocity.x/60,target.y+velocity.y/60,0)
  -- A downhill: the chassis sinks while grounded, so B's lead builds.
  pos,zoom=feel.camera(st,target,velocity,grounded,pos,zoom,270,1/60,480,experiment,tune)
  assert(pos.x==pos.x and pos.y==pos.y and zoom==zoom,'non-finite camera at frame '..i)
 end
 return pos,zoom,st
end
local downhill=v3(400,-250,0)
for _,e in ipairs({false,'b'}) do
 local e1=e or nil
 local a1,z1=run(e1,nil,120,downhill,true)
 local a2,z2=run(e1,cs.copy(cs.DEFAULTS),120,downhill,true)
 assert(a1.x==a2.x and a1.y==a2.y and z1==z2,'default settings changed the camera')
end
local base,bz=run(nil,nil,120,downhill,true)
local function tuned(k,v,e) local t=cs.copy(cs.DEFAULTS);t[k]=v;return run(e,t,120,downhill,true) end
local up=tuned('offset',100);assert(up.y>base.y+50,'height offset did not raise the camera')
local _,zin=tuned('zoom',1.3);assert(zin>bz*1.2,'zoom setting did not zoom in')
local near=tuned('look',0);assert(near.x<base.x-50,'look-ahead 0 still looks ahead')
-- Follow speed shows while the view catches up (at a steady speed its lead cancels the lag exactly).
local function early(t)
 -- From rest, then rolling: the view lags towards the new framing at the follow speed.
 local st,pos=feel.camera_start(0,90,0,0,270,t);local zoom=feel.values.camera_zoom;local target=v3(0,90,0)
 for _=1,8 do target=v3(target.x+downhill.x/60,target.y,0);pos,zoom=feel.camera(st,target,v3(downhill.x,0,0),true,pos,zoom,270,1/60,480,nil,t) end
 return pos
end
local slow_t=cs.copy(cs.DEFAULTS);slow_t.follow=0.5
local e0,e1=early(nil),early(slow_t);assert(math.abs(e1.x-e0.x)>1 or math.abs(e1.y-e0.y)>1,'follow speed changed nothing')
for _,k in ipairs({'descent_response','descent_rise_limit'}) do
 local a=tuned(k,cs.BY_KEY[k].max)
 assert(a.x==base.x and a.y==base.y,'B-only '..k..' changed camera A')
end
-- Camera B: its downhill lead lowers the view; a zero rise limit removes that lead (back to A's height).
local b=run('b',nil,120,downhill,true);assert(b.y<base.y-5,'camera B shows no downhill lead')
local b0=tuned('descent_rise_limit',0,'b');assert(math.abs(b0.y-base.y)<1e-9,'zero rise limit still builds B lead')
local bfast=tuned('descent_response',12,'b');assert(bfast.y<b.y,'B descent pan rate changed nothing')
print('PASS feel.camera settings: defaults unchanged, height/zoom/look/follow move the view, B-only keys never touch A')
