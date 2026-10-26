local R=require 'main.gym.course_progress'
local function near(a,b)assert(math.abs(a-b)<1e-8,tostring(a)..' ~= '..tostring(b))end
local function course(chains,start,goal,direction)
 return {chains=chains,spawn=start,finish={position={goal,0},line={{goal,-100},{goal,100}},direction={direction or 1,0}}}
end
local d=course({{{9,4},{3,4},{0,0}}},{0,0},9)
local r=assert(R.prepare(d));near(r.length,11);near(R.position(r,1.5,2),2.5);near(R.position(r,6,4),8)
assert(math.abs(2.5/r.length-1.5/9)>.05,'Slope must use arc length, not world X')
for _,p in ipairs({{1.5,2},{6,4},{1.5,2},{6,4},{1.5,2}})do local s=R.position(r,p[1],p[2]);near(s,p[1]==6 and 8 or 2.5)end
local left=assert(R.prepare(course(d.chains,{9,4},0,-1)));near(left.length,11);near(R.position(left,6,4),3)
local vertical=assert(R.prepare(course({{{20,10},{10,10},{10,0},{0,0}}},{0,0},20)))
near(vertical.length,30);near(R.position(vertical,10,5),15)
local downhill=assert(R.prepare(course({{{10,-4},{3,0},{0,4}}},{0,4},10)))
near(downhill.length,5+math.sqrt(65));near(R.position(downhill,1.5,2),2.5)
local gap=assert(R.prepare(course({{{10,0},{0,0}},{{30,0},{20,0}}},{2,0},28)))
near(gap.length,26);assert(gap.gaps==1);local s,err,air=R.position(gap,15,4);near(s,13);assert(not err and air)
near(R.position(gap,-10,0),0);near(R.position(gap,40,0),26);assert(not R.position(gap,15,50))
local bads={
 course({{{0,0},{10,0},{5,5},{15,5}}},{0,0},15),
 course({{{0,0},{10,0}},{{5,3},{15,3}}},{0,0},15),
 course({{{0,0},{0,10}}},{0,0},0),
 course({{{0,0},{10,0},{10,10},{10,5},{20,5}}},{0,0},20),
 course({{{0,0},{10,0}},{{10,5},{20,5}}},{0,0},20),
 course({{{0,0},{10,0}}},{0,0},-5),
}
for _,bad in ipairs(bads)do local value,why=R.prepare(bad);assert(not value and type(why)=='string')end
assert(not R.prepare({chains=d.chains,spawn={0,0}}))
local oversized={};for i=0,R.MAX_SEGMENTS+1 do oversized[#oversized+1]={i,0}end
assert(not R.prepare(course({oversized},{0,0},R.MAX_SEGMENTS+1)))
-- Input coordinates/source tables are never normalized or restyled in place.
near(d.chains[1][1][1],9);near(d.chains[1][3][1],0)
print('PASS slope/descent/vertical arc length, reverse/no odometer, directed left course, airborne gap, bounds and unsupported topology')
-- Adapter uses the existing run state and never changes its clock/finish/record fields.
package.loaded['main.gym.feel']={metres=function(n)return n*.01 end}
local sent={};msg={post=function(_,id,data)assert(id=='course_progress');sent[#sent+1]=data end}
local P=require 'main.gym.progress_runtime'
local self={station=d,race={state='ready',elapsed=12.5},session_generation=7,generation=1}
P.reset(self);P.observe(self,{x=600,y=400});near(self.progress.fraction,0)
self.race.state='running';P.observe(self,{x=600,y=400});near(self.progress.distance,8)
P.observe(self,{x=150,y=200});near(self.progress.distance,2.5)
self.race.state='paused';P.observe(self,{x=900,y=400});near(self.progress.distance,2.5)
self.race.state='running';P.observe(self,{x=900,y=400});assert(self.progress.fraction<1 and self.progress.fraction>.99)
assert(self.race.state=='running' and self.race.elapsed==12.5 and not self.finish_done)
self.race.state='finished';P.observe(self,{x=900,y=400});near(self.progress.fraction,1)
P.update(self,.1);assert(sent[#sent].generation==7 and sent[#sent].modal and sent[#sent].phase=='finished')
local ref=self.progress.route;self.race.state='ready';self.generation=2;P.reset(self);assert(self.progress.route==ref);near(self.progress.distance,0);P.update(self,.1);assert(sent[#sent].attempt==2)
local unsupported={station=bads[1],session_generation=8,generation=1};P.reset(unsupported);P.update(unsupported,.1);assert(sent[#sent].enabled and not sent[#sent].available and sent[#sent].reason~='')
print('PASS run-state pause/ready/finish, end marker cannot finish, same-reference Retry and unavailable report; timer unchanged')
