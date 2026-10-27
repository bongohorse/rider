local D=require 'main.gym.editor_doc';local A=require 'main.gym.editor_track_align'
local function level(points,coins)
 local d=D.blank('along-test','Along test');local e=d.editor;e.start.position={0,2};e.objects={{id='o1',type='line',points=points}};e.next_id=2
 for _,p in ipairs(coins) do local id='o'..e.next_id;e.objects[#e.objects+1]={id=id,type='coin',pickup_id='coin-'..id,position=p};e.next_id=e.next_id+1 end
 return e
end
local function near(a,b)assert(math.abs(a-b)<1e-7,tostring(a)..' ~= '..tostring(b))end
local e=level({{0,0},{3,4},{6,4}},{{.6,1.5},{4,5.2}});local ids={'o2','o3'};local s=A.refresh(e)
local c=A.selection(e,s,ids);assert(not c.active and c.mixed and not c.error)
local p=assert(A.adjust(e,s,ids,100));near(p.delta,2);assert(p.limited);assert(A.apply(e,p));e.revision=e.revision+1;A.accept(s,p,e.revision)
near(e.objects[2].position[1],1.8);near(e.objects[2].position[2],3.1);near(e.objects[3].position[1],6);near(e.objects[3].position[2],5.2)
p=assert(A.adjust(e,s,ids,-2));assert(A.apply(e,p));e.revision=e.revision+1;A.accept(s,p,e.revision);near(e.objects[2].position[1],.6);near(e.objects[3].position[1],4)
p=assert(A.adjust(e,s,ids,0,2));assert(A.apply(e,p));e.revision=e.revision+1;A.accept(s,p,e.revision);assert(not A.selection(e,s,ids).mixed);near(e.objects[2].position[1],.6);near(e.objects[2].position[2],2.8)
e.objects[2].position[2]=3.8;e.revision=e.revision+1;s=A.refresh(e,s);assert(A.selection(e,s,ids).mixed);near(s.bindings.o2.height,3)
e.objects[3].locked=true;assert(not A.adjust(e,s,ids,1));e.objects[3].locked=nil;assert(not A.adjust(e,s,{'o1','o2'},1))
for _,bad in ipairs({'bad',math.huge,0/0,100000})do assert(not A.distance(bad))end
local gap=level({{0,0},{5,0}},{{4,.7},{8,1.7}});gap.objects[#gap.objects+1]={id='o4',type='line',points={{7,0},{12,0}}};s=A.refresh(gap)
p=assert(A.adjust(gap,s,ids,3));near(p.delta,1);assert(A.apply(gap,p));gap.revision=gap.revision+1;A.accept(s,p,gap.revision)
near(gap.objects[2].position[1],5);near(gap.objects[3].position[1],9);assert(#assert(A.adjust(gap,s,ids,1)).moves==0)
p=assert(A.adjust(gap,s,ids,-3));near(p.delta,-2)
local joined=level({{0,0},{3,0}},{{2,.7}});joined.objects[#joined.objects+1]={id='o3',type='line',points={{3,0},{6,0}}};joined.connections={{from='o1',to='o3'}};s=A.refresh(joined);p=assert(A.adjust(joined,s,{'o2'},3));near(p.moves[1].position[1],5)
local reverse=level({{6,0},{3,0},{0,0}},{{2,.7}});p=assert(A.adjust(reverse,A.refresh(reverse),{'o2'},1));near(p.moves[1].position[1],3)
for _,points in ipairs({{{0,0},{0,3},{3,3}},{{0,0},{4,0},{2,2}}})do local t=level(points,{{1,5}});assert(not A.adjust(t,A.refresh(t),{'o2'},1))end
local ambiguous=level({{0,0},{6,0}},{{3,1}});ambiguous.objects[#ambiguous.objects+1]={id='o3',type='line',points={{2,0},{4,0}}};assert(not A.adjust(ambiguous,A.refresh(ambiguous),{'o2'},1))
-- Drop assigns its actual surface, even if the chosen offset crosses a higher parallel route.
local stacked=level({{0,0},{6,0}},{{2,.2}});stacked.objects[#stacked.objects+1]={id='o3',type='line',points={{0,.5},{6,.5}}}
p=assert(A.plan(stacked,{'o2'},.7));assert(A.apply(stacked,p));s=A.refresh(stacked);A.attach(stacked,s,p.targets);near(s.bindings.o2.height,.7)
p=assert(A.adjust(stacked,s,{'o2'},1));near(p.moves[1].position[2],.7);assert(A.apply(stacked,p));stacked.revision=stacked.revision+1;A.accept(s,p,stacked.revision)
stacked.revision=stacked.revision+1;s=A.refresh(stacked,s);near(s.bindings.o2.height,.7)
local hull=level({{0,0},{10,0}},{{4,5.7}});hull.objects[#hull.objects+1]={id='o3',type='hull',vertices={{2,3},{8,3},{8,5},{2,5}}};p=assert(A.adjust(hull,A.refresh(hull),{'o2'},10));near(p.delta,4);near(p.moves[1].position[2],5.7)
print('PASS route arc length vs X, shared signed clamping/gaps/joins/reverse, Mixed Height, locks, refresh/free moves, parallel-surface ownership, hull tops and unsupported ambiguity')
