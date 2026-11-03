-- #417: tap-to-switch FPS counter (pure cycle, colour level, smoothing) and the player-settings file.
local files={};local mode
sys={get_save_file=function(app,name) return app..'/'..name end,
 load=function(path) if mode=='unreadable' then error('injected unreadable settings') end;return files[path] or {} end,
 save=function(path,t) if mode=='write' then error('injected write failure') end;if mode=='false' then return false end
  local copy={};for k,v in pairs(t) do copy[k]=v end;files[path]=copy;return true end}
local fps=require 'main.game.fps_counter'
local settings=require 'main.game.player_settings'

-- Cycle: 30 -> 60 -> 90 -> 120 -> 144 -> Unlimited (0) -> 30; unknown caps restart at the default.
local order={30,60,90,120,144,0}
for i,cap in ipairs(order) do assert(fps.next_cap(cap)==order[i%#order+1],'cycle broken after '..cap) end
local cap,seen=fps.DEFAULT_CAP,{}
for _=1,6 do cap=fps.next_cap(cap);seen[#seen+1]=cap end
assert(table.concat(seen,',')=='90,120,144,0,30,60','six taps from the default visit every cap once and return')
assert(fps.DEFAULT_CAP==60)
for _,bad in ipairs({nil,false,'60',59,60.5,-1,1/0,0/0,{}}) do
 assert(not fps.valid_cap(bad),'accepted invalid cap '..tostring(bad))
 assert(fps.next_cap(bad)==fps.DEFAULT_CAP)
end
assert(fps.label(0)=='cap unlimited' and fps.label(120)=='cap 120')
assert(fps.text(59.6)=='60 fps' and fps.text(29.4)=='29 fps' and fps.text(false)=='-- fps')
print('PASS fps counter cycle 30/60/90/120/144/Unlimited, default 60, invalid caps, labels')

-- Colour: green >= 90 %, orange >= 70 %, red below, relative to the cap; Unlimited counts against 60.
local levels={{54,60,'green'},{53.99,60,'orange'},{42,60,'orange'},{41.99,60,'red'},
 {27,30,'green'},{26.9,30,'orange'},{21,30,'orange'},{20.9,30,'red'},
 {129.6001,144,'green'},{129.5,144,'orange'},{100.8001,144,'orange'},{100.7,144,'red'},
 {81,90,'green'},{63,90,'orange'},{60,90,'red'},{108,120,'green'},{84,120,'orange'},{83,120,'red'},
 {54,0,'green'},{53,0,'orange'},{42,0,'orange'},{41,0,'red'},{240,0,'green'},{0,60,'red'}}
for _,c in ipairs(levels) do
 local got=fps.level(c[1],c[2])
 assert(got==c[3],string.format('level(%s, cap %s) = %s, expected %s',c[1],c[2],tostring(got),c[3]))
end
assert(fps.level(nil,60)==nil and fps.level(false,60)==nil and fps.level(0/0,60)==nil,'no reading must stay uncoloured')
assert(fps.reference(0)==60 and fps.reference(144)==144)
print('PASS fps counter colour thresholds relative to the cap, Unlimited against 60')

-- Smoothing: 0.25 s buckets in a ~1 s sliding window of wall time; gaps restart the window.
local function run(c,t,hz,seconds)
 local changed=0
 for _=1,math.floor(seconds*hz+0.5) do t=t+1/hz;if fps.frame(c,t) then changed=changed+1 end end
 return t,changed
end
local c=fps.new();assert(not fps.frame(c,100) and c.fps==false,'first frame only starts the clock')
local t,changed=run(c,100,60,0.2);assert(changed==0 and c.fps==false,'no reading before the first bucket')
t,changed=run(c,t,60,2);assert(changed>=6 and changed<=9,'readings update about four times per second: '..changed)
assert(math.abs(c.fps-60)<0.5 and #c.buckets==fps.BUCKETS,'steady 60 Hz reading '..c.fps)
-- One slow frame inside a steady window must not flip the colour: the window smooths it.
t=t+0.1;fps.frame(c,t);t=run(c,t,60,0.3)
assert(c.fps>54 and fps.level(c.fps,60)=='green','single 100 ms hitch flickered the colour: '..c.fps)
-- A rate change is followed within the window length.
t=run(c,t,30,1.5);assert(math.abs(c.fps-30)<0.6,'did not follow 30 Hz '..c.fps)
-- A background gap (> 0.5 s) restarts the window instead of reporting a bogus low rate.
local before=c.fps;t=t+5;assert(not fps.frame(c,t) and #c.buckets==0 and c.fps==before)
t=run(c,t,144,1.2);assert(math.abs(c.fps-144)<1.5,'did not measure 144 Hz '..c.fps)
-- Backwards wall time is treated as a gap, never as a negative interval.
t=t-1;assert(not fps.frame(c,t) and #c.buckets==0)
-- A cap change restarts the measurement (no stale reading).
fps.restart(c);assert(c.fps==false and #c.buckets==0 and c.last==false)
print('PASS fps counter smoothing window, hitch, rate change, background gap, restart')

-- Player settings: default, valid roundtrip, invalid stored values, newer-version protection.
local path='rider/player-settings'
local s=settings.load();assert(s.fps_cap==60 and s.status=='default','missing file must load the default')
s.fps_cap=144;assert(settings.save(s)==true and files[path].version==1 and files[path].fps_cap==144)
local r=settings.load();assert(r.fps_cap==144 and r.status=='ok','stored cap not restored')
for _,stored in ipairs({{version=1,fps_cap=0},{version=1,fps_cap=30},{version=1,fps_cap=90},{version=1,fps_cap=120}}) do
 files[path]=stored;local v=settings.load();assert(v.fps_cap==stored.fps_cap and v.status=='ok')
end
for _,bad in ipairs({{version=1,fps_cap=59},{version=1,fps_cap='60'},{version=1,fps_cap=0/0},{version=1,fps_cap=-30},
 {version=1,fps_cap=1/0},{version=1,fps_cap=60.5},{version=1},{fps_cap=144},{version='1',fps_cap=144},{version=0,fps_cap=144},
 {version=1.5,fps_cap=144},{version=0/0,fps_cap=144},{version=-1,fps_cap=144}}) do
 files[path]=bad;local v=settings.load()
 assert(v.fps_cap==60 and v.status=='invalid','invalid stored value accepted: '..tostring(bad.version)..'/'..tostring(bad.fps_cap))
end
assert(select(2,settings.parse(nil))=='invalid' and select(2,settings.parse('x'))=='invalid')
mode='unreadable';local u=settings.load();assert(u.fps_cap==60 and u.status=='invalid','unreadable file must fall back')
mode=nil
-- An invalid file is replaced by the next valid save.
files[path]={version=1,fps_cap='bad'};local fixed=settings.load();fixed.fps_cap=30
assert(settings.save(fixed)==true and settings.load().fps_cap==30)
-- A newer settings file is used where valid but never overwritten.
files[path]={version=2,fps_cap=120,other='kept'};local n=settings.load();assert(n.fps_cap==120 and n.status=='newer')
n.fps_cap=144;local ok,why=settings.save(n);assert(ok==false and why and files[path].fps_cap==120 and files[path].other=='kept')
files[path]={version=2,fps_cap='future'};n=settings.load();assert(n.fps_cap==60 and n.status=='newer')
-- Write failures are reported, not hidden; invalid caps are never written.
files[path]=nil;local w=settings.load();w.fps_cap=90
mode='write';assert(settings.save(w)==false and files[path]==nil)
mode='false';assert(settings.save(w)==false and files[path]==nil)
mode=nil;w.fps_cap=75;assert(settings.save(w)==false and files[path]==nil)
print('PASS player settings default 60, roundtrip, invalid/unreadable fallback, newer file kept, write failure')
