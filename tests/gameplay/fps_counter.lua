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
local levels={{54,60,'green'},{53,60,'orange'},{42,60,'orange'},{41,60,'red'},
 {27,30,'green'},{26,30,'orange'},{21,30,'orange'},{20,30,'red'},
 {130,144,'green'},{129,144,'orange'},{101,144,'orange'},{100,144,'red'},
 {81,90,'green'},{63,90,'orange'},{60,90,'red'},{108,120,'green'},{84,120,'orange'},{83,120,'red'},
 {54,0,'green'},{53,0,'orange'},{42,0,'orange'},{41,0,'red'},{240,0,'green'},{0,60,'red'}}
for _,c in ipairs(levels) do
 local got=fps.level(c[1],c[2])
 assert(got==c[3],string.format('level(%s, cap %s) = %s, expected %s',c[1],c[2],tostring(got),c[3]))
end
assert(fps.level(nil,60)==nil and fps.level(false,60)==nil and fps.level(0/0,60)==nil,'no reading must stay uncoloured')
-- The colour follows the whole number the text shows: "54 fps" is green and "53 fps" orange at cap 60.
for _,c in ipairs({{53.5,'54 fps','green',60},{53.99,'54 fps','green',60},{53.49,'53 fps','orange',60},{41.5,'42 fps','orange',60},{41.49,'41 fps','red',60},
 {129.5,'130 fps','green',144},{129.49,'129 fps','orange',144},{26.5,'27 fps','green',30},{26.49,'26 fps','orange',30},{53.5,'54 fps','green',0}}) do
 local cap=c[4]
 assert(fps.text(c[1])==c[2] and fps.level(c[1],cap)==c[3],string.format('%s shows %s but is %s at cap %d',c[1],fps.text(c[1]),tostring(fps.level(c[1],cap)),cap))
end
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
-- A stall (> 0.5 s between frames) shows its real low rate at once, never the stale green reading.
assert(fps.level(c.fps,30)=='green');t=t+2;assert(fps.frame(c,t) and math.abs(c.fps-0.5)<1e-9 and fps.level(c.fps,30)=='red','stall kept a stale reading '..c.fps)
-- A sustained stall stays low and red.
for _=1,5 do t=t+0.8;assert(fps.frame(c,t)) end
assert(math.abs(c.fps-1.25)<1e-9 and fps.level(c.fps,60)=='red' and fps.text(c.fps)=='1 fps','sustained stall not shown '..c.fps)
-- Slow frames just under the gap length are measured by the normal window, also low and red.
t=run(c,t,2.5,2);assert(math.abs(c.fps-2.5)<0.01 and fps.level(c.fps,60)=='red','slow frames not shown '..c.fps)
-- Once frames flow again the stall leaves the window within about 1 s.
t=t+5;fps.frame(c,t);assert(c.fps<1)
t=run(c,t,144,1.2);assert(math.abs(c.fps-144)<1.5,'did not recover to 144 Hz '..c.fps)
-- Backwards wall time restarts the window, never a negative interval.
local before=c.fps;t=t-1;assert(not fps.frame(c,t) and #c.buckets==0 and c.fps==before)
-- A cap change restarts the measurement (no stale reading).
fps.restart(c);assert(c.fps==false and #c.buckets==0 and c.last==false)
print('PASS fps counter smoothing window, hitch, rate change, background gap, restart')

-- Player settings: default, valid roundtrip, invalid stored values, newer-version protection.
local path='rider/player-settings'
local s=settings.load();assert(s.fps_cap==60 and s.status=='default','missing file must load the default')
s.fps_cap=144;assert(settings.save(s)==true and files[path].version==3 and files[path].fps_cap==144)
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
-- A newer settings file (version 4 since #443) is used where valid but never overwritten.
files[path]={version=4,fps_cap=120,other='kept'};local n=settings.load();assert(n.fps_cap==120 and n.status=='newer')
n.fps_cap=144;local ok,why=settings.save(n);assert(ok==false and why and files[path].fps_cap==120 and files[path].other=='kept')
files[path]={version=4,fps_cap='future'};n=settings.load();assert(n.fps_cap==60 and n.status=='newer')
-- Write failures are reported, not hidden; invalid caps are never written.
files[path]=nil;local w=settings.load();w.fps_cap=90
mode='write';assert(settings.save(w)==false and files[path]==nil)
mode='false';assert(settings.save(w)==false and files[path]==nil)
mode=nil;w.fps_cap=75;assert(settings.save(w)==false and files[path]==nil)
print('PASS player settings default 60, roundtrip, invalid/unreadable fallback, newer file kept, write failure')
