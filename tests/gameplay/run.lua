local run=require 'main.gym.run'
local r=run.new(7);local a=run.reset(r,true)
for i=1,100 do run.tick(r,1/60) end;assert(r.elapsed==0 and r.state=='ready')
assert(not run.start(r,'stale'));assert(run.start(r,a));assert(not run.start(r,a))
for i=1,60 do run.tick(r,1/60) end;assert(math.abs(r.elapsed-1)<1e-12)
run.pause(r,true);for i=1,60 do run.tick(r,1/60) end;assert(math.abs(r.elapsed-1)<1e-12)
assert(not run.finish(r,a));run.pause(r,false);run.tick(r,1/120)
local result=assert(run.finish(r,a));assert(result.time==r.elapsed and result.official)
run.tick(r,1/60);run.pause(r,true);assert(r.state=='finished' and result.time==r.elapsed and not run.finish(r,a))
local b=run.reset(r,true);assert(b~=a and not run.finish(r,a));run.start(r,b);run.practice(r,'test');assert(not run.finish(r,b).official)
local c=run.reset(r,true);assert(run.fail(r,c,'head'));assert(not run.fail(r,c,'bounds') and not run.finish(r,c));run.tick(r,.5);assert(r.elapsed==0)
run.reset(r,true);run.pause(r,true);assert(r.state=='paused');run.pause(r,false);assert(r.state=='ready')
-- The same 60 simulation steps grouped into 30 or 60 render updates give the same result.
local function score(group) local t=run.new(1);local id=run.reset(t,true);run.start(t,id);for frame=1,60/group do for i=1,group do run.tick(t,1/60) end end;return run.finish(t,id).time end
assert(score(1)==score(2))
print('PASS run ready/start/pause/finish/failure/retry/stale IDs/unrounded clock/30 vs 60 render grouping')
