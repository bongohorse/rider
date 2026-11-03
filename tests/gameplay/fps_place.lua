-- #444: FPS counter placement (normalised position, clamping, keeping clear of controls, drag threshold) and the
-- version 2 player-settings format (ON/OFF and position, migration from version 1, newer files kept).
local files={};local mode
sys={get_save_file=function(app,name) return app..'/'..name end,
 load=function(path) if mode=='unreadable' then error('injected unreadable settings') end;return files[path] or {} end,
 save=function(path,t) if mode=='write' then error('injected write failure') end
  local copy={};for k,v in pairs(t) do copy[k]=v end;files[path]=copy;return true end}
local place=require 'main.game.fps_place'
local settings=require 'main.game.player_settings'
local function near(a,b,what) assert(math.abs(a-b)<1e-6,string.format('%s: %.6f ~= %.6f',what,a,b)) end
local function inside(area,w,h,left,top,what)
 assert(left>=area.x0-1e-6 and left+w<=area.x1+1e-6 and top<=area.y1+1e-6 and top-h>=area.y0-1e-6,
  string.format('%s leaves the area: %.1f,%.1f',what,left,top))
end

-- Normalisation: 0/0 is top left, 1/1 bottom right, of the counter's free travel inside the area.
local area={x0=0,y0=0,x1=1280,y1=720};local w,h=112,46
local l,t=place.to_screen(area,w,h,0,0);near(l,0,'top-left x');near(t,720,'top-left top')
l,t=place.to_screen(area,w,h,1,1);near(l,1280-112,'bottom-right x');near(t,46,'bottom-right top')
l,t=place.to_screen(area,w,h,0.5,0.5);near(l,(1280-112)/2,'centre x');near(t,720-(720-46)/2,'centre top')
for _,name in ipairs(place.PRESET_ORDER) do
 local x,y=place.preset(name);local sl,st=place.to_screen(area,w,h,x,y);inside(area,w,h,sl,st,name)
 local nx,ny=place.normalise(area,w,h,sl,st);near(nx,x,name..' x roundtrip');near(ny,y,name..' y roundtrip')
 assert(place.preset_of(x,y)==name,'preset not recognised: '..name)
end
assert(#place.PRESET_ORDER==9 and place.preset('nowhere')==nil and place.preset(nil)==nil and place.preset_of(0.3,0.2)==nil)
assert(place.DEFAULT_X==0 and place.DEFAULT_Y==0 and place.preset_of(place.DEFAULT_X,place.DEFAULT_Y)=='top_left','reset is not top left')
-- Any dragged position round-trips; the same normalised pair lands proportionally on another resolution or after a
-- rotation (and stays inside), so a stored position survives both.
for _,p in ipairs({{0.25,0.75},{0.9,0.1},{0,1},{1,0},{0.333,0.5}}) do
 local sl,st=place.to_screen(area,w,h,p[1],p[2]);local nx,ny=place.normalise(area,w,h,sl,st)
 near(nx,p[1],'drag x roundtrip');near(ny,p[2],'drag y roundtrip')
 for _,other in ipairs({{x0=0,y0=0,x1=1080,y1=486},{x0=0,y0=0,x1=2160,y1=972},{x0=0,y0=0,x1=486,y1=1080},{x0=40,y0=20,x1=1240,y1=700}}) do
  local ol,ot=place.to_screen(other,w,h,p[1],p[2]);inside(other,w,h,ol,ot,'resolution change')
  local ox,oy=place.normalise(other,w,h,ol,ot);near(ox,p[1],'resolution x');near(oy,p[2],'resolution y')
 end
end
print('PASS fps place normalised position: presets, reset top left, roundtrip, resolution and rotation changes')

-- Clamping: the whole counter stays inside (also with a safe-area inset); an oversized counter keeps its corner in.
local safe={x0=30,y0=10,x1=1250,y1=700}
for _,p in ipairs({{-500,900},{5000,-300},{-1,701},{1240,30}}) do
 local cl,ct=place.clamp(safe,w,h,p[1],p[2]);inside(safe,w,h,cl,ct,'clamp '..p[1]..','..p[2])
end
local cl,ct=place.clamp(safe,w,h,600,400);near(cl,600,'inside x unchanged');near(ct,400,'inside top unchanged')
local nx,ny=place.normalise(safe,w,h,-1000,1000);near(nx,0,'clamped normalise x');near(ny,0,'clamped normalise y')
nx,ny=place.normalise(safe,w,h,9999,-9999);near(nx,1,'clamped normalise x max');near(ny,1,'clamped normalise y max')
local tiny={x0=0,y0=0,x1=80,y1=30};cl,ct=place.clamp(tiny,w,h,50,10);near(cl,0,'oversized x');near(ct,30,'oversized top')
nx,ny=place.normalise(tiny,w,h,50,10);assert(nx==0 and ny==0,'no travel normalises to 0')
for _,bad in ipairs({-0.01,1.01,0/0,1/0,'0.5',nil,true}) do assert(not place.valid(bad),'accepted '..tostring(bad)) end
assert(place.valid(0) and place.valid(1) and place.valid(0.5))
print('PASS fps place clamping to the visible/safe area, oversized counter, invalid coordinates')

-- Drag threshold: about 10 CSS px separates a tap from a drag; on a 2.25x canvas that is 22.5 screen px.
assert(place.THRESHOLD_CSS_PX==10)
assert(not place.is_drag(0,0,10) and not place.is_drag(9.9,0,10) and not place.is_drag(6,7.9,10),'short travel must stay a tap')
assert(place.is_drag(10,0,10) and place.is_drag(0,-10,10) and place.is_drag(6,8,10) and place.is_drag(-8,-6,10),'10 px travel must drag')
assert(not place.is_drag(20,8,10*2.25) and place.is_drag(20,12,10*2.25),'threshold not scaled to CSS px')
print('PASS fps place drag threshold 10 CSS px')

-- Keeping clear of controls. 1080x486 phone layout (CSS px = screen px here): Retry/Pause/Tuning/More toolbar top
-- right, drive zones bottom left and right, Levels above the right zone.
local phone={x0=0,y0=0,x1=1080,y1=486}
local controls={
 {x0=812,y0=436,x1=870,y1=480,name='retry'},{x0=874,y0=436,x1=936,y1=480,name='pause'},{x0=940,y0=436,x1=1012,y1=480,name='tuning'},{x0=1016,y0=436,x1=1072,y1=480,name='more'},
 {x0=8,y0=8,x1=138,y1=96,name='brake'},{x0=146,y0=8,x1=276,y1=96,name='throttle'},{x0=804,y0=8,x1=934,y1=96,name='lean back'},{x0=942,y0=8,x1=1072,y1=96,name='lean fwd'},
 {x0=960,y0=108,x1=1068,y1=152,name='levels'}}
local gap=4
for _,name in ipairs(place.PRESET_ORDER) do
 local x,y=place.preset(name);local sl,st=place.to_screen(phone,w,h,x,y)
 local fl,ft,clear=place.place(phone,w,h,sl,st,controls,gap)
 assert(clear,'no free position for '..name);inside(phone,w,h,fl,ft,name)
 local r=place.hit(fl,ft,w,h,controls,gap);assert(not r,name..' covers '..(r and r.name or ''))
end
-- Bottom left sits on the drive zones: it moves the short way (up, above them), not across the screen.
local fl,ft=place.place(phone,w,h,0,46,controls,gap);near(ft,96+gap+h,'bottom left moved above the zones');near(fl,0,'bottom left kept its x')
-- Top right sits on the toolbar: moved below it (or left of it), never onto Pause.
fl,ft=place.place(phone,w,h,1080-w,486,controls,gap);assert(not place.hit(fl,ft,w,h,controls,gap) and (ft<=436-gap+1e-6 or fl+w<=812-gap+1e-6),'top right still on the toolbar')
-- A free position is unchanged; touching with the gap is fine.
fl,ft=place.place(phone,w,h,400,300,controls,gap);near(fl,400,'free x');near(ft,300,'free top')
assert(not place.hit(138+gap,96+gap+h,w,h,{controls[5]},gap),'touching at the gap counts as overlap')
assert(not place.hit(138+gap,60,w,h,{controls[5]},gap),'beside the zone at the gap counts as overlap')
assert(place.hit(138+gap-0.5,60,w,h,{controls[5]},gap),'half a pixel into the gap must count')
-- Regression (fps444): a stored position just above Levels, re-placed with the probe size off by float32 noise,
-- stays where it was dropped (it used to jump 90 px left: the 'up' step shared a rounded key with the start).
local desk_br={{x0=1176.2,y0=60,x1=1268,y1=104},{x0=1193.6,y0=6,x1=1272,y1=38},{x0=1091.9,y0=6,x1=1187.6,y1=38}}
for _,hh in ipairs({61.3333435,61.3333,61.33331298828}) do
 local sl,st=place.to_screen({x0=0,y0=0,x1=1280,y1=720},149.3333740234,hh,1,0.83603239372864)
 local ql,qt=place.place({x0=0,y0=0,x1=1280,y1=720},149.3333740234,hh,sl,st,desk_br,4)
 assert(math.abs(ql-sl)<0.01 and math.abs(qt-st)<0.01,string.format('float noise moved the counter: %.4f,%.4f -> %.4f,%.4f',sl,st,ql,qt))
end
-- A real overlap of a few pixels still moves the counter the short way (up), not sideways.
local ql,qt=place.place({x0=0,y0=0,x1=1280,y1=720},149.3333740234,61.3333,1130.6666,166,desk_br,4)
assert(math.abs(ql-1130.6666)<0.01 and math.abs(qt-(108+61.3333))<0.01,'a small overlap moved sideways')
-- Desktop 1280x720: the Pause/Speed/Record/Replay row and a dragged drop onto Pause.
local desk={x0=0,y0=0,x1=1280,y1=720}
local row={{x0=581,y0=504,x1=704,y1=536,name='pause'},{x0=717,y0=504,x1=851,y1=536,name='speed'},{x0=864,y0=504,x1=976,y1=536,name='record'},{x0=989,y0=504,x1=1101,y1=536,name='replay'}}
fl,ft=place.place(desk,w,h,600,530,row,gap);assert(not place.hit(fl,ft,w,h,row,gap),'drop onto Pause still covers a button')
-- Crowded: a drop onto a wall finds the only gap; a fully covered screen reports that nothing is clear.
local wall={{x0=0,y0=0,x1=1280,y1=600},{x0=0,y0=600,x1=500,y1=720},{x0=700,y0=600,x1=1280,y1=720}}
local clear
fl,ft,clear=place.place(desk,w,h,100,700,wall,0);assert(clear and not place.hit(fl,ft,w,h,wall,0) and fl>=500 and fl+w<=700,'boxed-in drop found no gap')
local full={{x0=-10,y0=-10,x1=2000,y1=2000}};fl,ft,clear=place.place(desk,w,h,300,300,full,0);assert(clear==false,'a fully covered screen must report no clear position')
print('PASS fps place keeps clear of pause, drive and other controls at 1080x486 and 1280x720; crowded fallback')

-- Settings version 2: defaults, roundtrip, migration from version 1, invalid values, newer file never overwritten.
local path='rider/player-settings'
local s=settings.load();assert(s.fps_visible==true and s.fps_x==0 and s.fps_y==0 and s.fps_cap==60 and s.status=='default','defaults')
s.fps_visible,s.fps_x,s.fps_y=false,0.25,0.75;assert(settings.save(s)==true)
local f=files[path];assert(f.version==2 and f.fps_visible==false and f.fps_x==0.25 and f.fps_y==0.75 and f.fps_cap==60,'version 2 file')
local r=settings.load();assert(r.fps_visible==false and r.fps_x==0.25 and r.fps_y==0.75 and r.status=='ok','roundtrip')
-- A #417 version 1 file keeps its cap, gets the defaults and is written as version 2 on the next save.
files[path]={version=1,fps_cap=30};local old=settings.load()
assert(old.status=='ok' and old.fps_cap==30 and old.fps_visible==true and old.fps_x==0 and old.fps_y==0,'version 1 migration')
assert(settings.apply(old,{command='bottom_right'}) and settings.save(old)==true)
f=files[path];assert(f.version==2 and f.fps_cap==30 and f.fps_x==1 and f.fps_y==1 and f.fps_visible==true,'migrated file')
-- Version 1 ignores fields it never had.
files[path]={version=1,fps_cap=90,fps_visible=false,fps_x=0.5,fps_y=0.5};old=settings.load()
assert(old.fps_cap==90 and old.fps_visible==true and old.fps_x==0 and old.status=='ok','version 1 must not read version 2 fields')
-- Each invalid value falls back on its own; the position is one value (both coordinates or neither).
for _,bad in ipairs({{fps_visible='yes',fps_x=0.5,fps_y=0.5,keep='pos'},{fps_visible=1,fps_x=0.5,fps_y=0.5,keep='pos'},
 {fps_visible=false,fps_x=1.5,fps_y=0.5,keep='visible'},{fps_visible=false,fps_x=0.5,fps_y=-0.1,keep='visible'},
 {fps_visible=false,fps_x=0/0,fps_y=0.5,keep='visible'},{fps_visible=false,fps_x='0.5',fps_y=0.5,keep='visible'},
 {fps_visible=false,fps_y=0.5,keep='visible'},{fps_visible=false,fps_x=1/0,fps_y=0.2,keep='visible'}}) do
 files[path]={version=2,fps_cap=120,fps_visible=bad.fps_visible,fps_x=bad.fps_x,fps_y=bad.fps_y}
 local v=settings.load()
 assert(v.status=='invalid' and v.fps_cap==120,'invalid value not reported')
 if bad.keep=='pos' then assert(v.fps_visible==true and v.fps_x==0.5 and v.fps_y==0.5,'visible fallback lost the position')
 else assert(v.fps_visible==false and v.fps_x==0 and v.fps_y==0,'position fallback lost visibility') end
end
files[path]={version=2,fps_cap=59,fps_visible=false,fps_x=0.5,fps_y=1};local v=settings.load()
assert(v.status=='invalid' and v.fps_cap==60 and v.fps_visible==false and v.fps_y==1,'an invalid cap must not drop valid counter values')
mode='unreadable';v=settings.load();assert(v.status=='invalid' and v.fps_visible==true and v.fps_x==0,'unreadable fallback');mode=nil
-- A newer file is used where valid and never overwritten, also by counter commands.
files[path]={version=3,fps_cap=144,fps_visible=false,fps_x=0.5,fps_y=0.5,future='kept'};local n=settings.load()
assert(n.status=='newer' and n.fps_visible==false and n.fps_x==0.5 and n.fps_cap==144,'newer file not read')
assert(settings.apply(n,{command='on'}));local ok,why=settings.save(n)
assert(ok==false and why and files[path].fps_visible==false and files[path].future=='kept','newer file overwritten')
assert(n.fps_visible==true,'the change still lasts for the session')
files[path]={version=3,fps_cap=144,fps_visible='future',fps_x=2};n=settings.load()
assert(n.status=='newer' and n.fps_visible==true and n.fps_x==0 and n.fps_cap==144,'unknown newer values fall back')
-- Invalid settings are never written.
files[path]=nil;local w2=settings.load();w2.fps_x=7;assert(settings.save(w2)==false and files[path]==nil)
w2.fps_x=0;w2.fps_visible='on';assert(settings.save(w2)==false and files[path]==nil)
print('PASS player settings v2: defaults, roundtrip, v1 migration, per-value fallback, newer file kept')

-- Counter commands: ON/OFF, nine presets, reset, a dragged position; anything else changes nothing.
local c=settings.defaults()
assert(not settings.apply(c,{command='on'}),'ON when already on is no change')
assert(settings.apply(c,{command='off'}) and c.fps_visible==false and settings.apply(c,{command='on'}) and c.fps_visible==true)
for _,name in ipairs(place.PRESET_ORDER) do
 if name~='top_left' then assert(settings.apply(c,{command=name}),name) end
 local x,y=place.preset(name);assert(c.fps_x==x and c.fps_y==y,'preset '..name)
end
assert(settings.apply(c,{x=0.42,y=0.17}) and c.fps_x==0.42 and c.fps_y==0.17,'dragged position')
assert(settings.apply(c,{command='reset'}) and c.fps_x==0 and c.fps_y==0 and c.fps_visible==true,'reset to top left')
for _,bad in ipairs({{command='middle'},{command=5},{x=0.5},{x=-1,y=0.5},{x=0.5,y=0/0},{x='0.1',y=0.1},{},'reset',nil}) do
 local before={c.fps_visible,c.fps_x,c.fps_y}
 assert(not settings.apply(c,bad),'accepted a bad counter command')
 assert(c.fps_visible==before[1] and c.fps_x==before[2] and c.fps_y==before[3],'bad command changed the setting')
end
assert(c.fps_cap==60,'counter commands never change the cap')
print('PASS fps counter commands: ON/OFF, nine presets, dragged position, reset, invalid commands ignored')
