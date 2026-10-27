local sent={};msg={post=function(target,id,data)sent[#sent+1]={target=target,id=id,data=data}end}
local debug=false;sys={get_engine_info=function()return {is_debug=debug}end}
local offered=0
package.loaded['main.gym.run_best']={new=function()return {status='saved'}end,poll=function()end,offer=function(_,r)offered=offered+1;return r.official end}
local runtime=require 'main.gym.run_runtime';local run=require 'main.gym.run'
local function owner()return {station={id='first-run',start_speed=0},preset='a',crash_enabled=true,time_factor=1,testcase='',replay={},session_generation=7}end
local s=owner();assert(runtime.eligible(s));s.station.editor={revision=999,road_look={cosmetic=true}};assert(runtime.eligible(s))
for _,bad in ipairs({function(t)t.station.custom=true end,function(t)t.station.start_speed=1 end,function(t)t.preset='b' end,function(t)t.modified=true end,function(t)t.crash_enabled=false end,function(t)t.time_factor=.5 end,function(t)t.testcase='le6' end,function(t)t.replay.play={}end,function(t)t.replay.rec={active=true}end})do local t=owner();bad(t);assert(not runtime.eligible(t))end
debug=true;assert(not runtime.eligible(s));debug=false
runtime.ready(s);local id=s.race.id;runtime.observe(s,1/60);assert(s.race.elapsed==0)
local cmd={throttle=1,brake_reverse=0,lean=0};assert(runtime.command(s,cmd,1/60)==cmd);assert(s.race.elapsed==0)
runtime.observe(s,1/60);assert(s.race.elapsed==1/60);runtime.finish(s);runtime.finish(s);assert(offered==1)
runtime.update(s,1/60);runtime.update(s,1/60);local stops=0;for _,m in ipairs(sent)do if m.id=='run_stop' then stops=stops+1;assert(m.data.id==id)end end;assert(stops==1)
runtime.ready(s);assert(s.race.id~=id and s.race.official and not s.race.new_best)
runtime.practice(s,'Record/replay');runtime.command(s,cmd,1/60);runtime.observe(s,1/60);assert(not s.race.official)
print('PASS production adapter official isolation, cosmetic identity, completed-step clock, exactly-once finish/stop and Retry')

local medalOwner=owner();medalOwner.station.finish={};medalOwner.station.medal_times={version=1,gold=26,silver=30,bronze=40}
runtime.ready(medalOwner);runtime.command(medalOwner,cmd,1/60);medalOwner.race.elapsed=30;runtime.finish(medalOwner)
assert(medalOwner.race.result.medal==2);runtime.finish(medalOwner);runtime.update(medalOwner,1/60)
assert(sent[#sent].data.medal==2 and sent[#sent].data.next_medal=='Gold' and sent[#sent].data.next_time==26)
runtime.practice(medalOwner,'Late rule change');assert(medalOwner.race.result.official)
runtime.ready(medalOwner);assert(not medalOwner.race.result and medalOwner.race.elapsed==0)
print('PASS authoritative unrounded inclusive result medal, next target, terminal freeze and Retry reset')

runtime.practice(medalOwner,'Changed assists');runtime.command(medalOwner,cmd,1/60);medalOwner.race.elapsed=25;runtime.finish(medalOwner)
assert(medalOwner.race.result.medal==0 and not medalOwner.race.result.official)
print('PASS practice attempts cannot receive a medal')
