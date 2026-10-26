local M=require 'main.gym.medals'
local t=M.defaults()
assert(M.validate(nil) and M.validate(t))
for _,case in ipairs({{26,3},{26.00000001,2},{30,2},{30.00000001,1},{40,1},{40.00000001,0}}) do assert(M.award(t,case[1])==case[2]) end
for _,n in ipairs({0,-1,0/0,math.huge}) do assert(M.award(t,n)==0) end
for _,bad in ipairs({{}, {version=1,gold=0,silver=30,bronze=40}, {version=1,gold=30,silver=30,bronze=40},{version=1,gold=26,silver=40,bronze=30},{version=1,gold=26,silver=30,bronze=math.huge}}) do assert(not M.validate(bad)) end
local ok,err,unknown=M.validate({version=999});assert(not ok and unknown)
local n,time=M.next(t,0);assert(n=='Bronze' and time==40)
n,time=M.next(t,1);assert(n=='Silver' and time==30)
n,time=M.next(t,2);assert(n=='Gold' and time==26)
n,time=M.next(t,3);assert(n=='' and time==0)
assert(not M.set(t,'gold','30'));assert(not M.set(t,'silver','nan'));assert(t.gold==26)
local edited=assert(M.set(t,'bronze','45.5'));assert(edited.bronze==45.5 and t.bronze==40)
assert(M.set(nil,'gold','25').silver==30)
local course={id='first-run',finish={}}
local key=M.key(course);assert(key=='first-run-course1-rules1-buggy-a-crash')
course.editor={revision=55,road_look={width=2}};course.medal_times=edited;assert(M.key(course)==key)
course.race_revision=2;assert(M.key(course)~=key);course.custom=true;assert(not M.key(course))
local D=require 'main.gym.editor_doc'
local d=D.blank('medal-test','Medal test');d.editor.objects={{id='o1',type='line',points={{-10,0},{50,0}}}};d.editor.next_id=2;d.editor.start.position={0,2};d.editor.finish={position={40,0},direction=1}
assert(D.validate(d));d.editor.medal_times=t
local compiled=assert(D.compile(d));assert(compiled.medal_times.gold==26 and compiled.editor.editor_version==8)
assert(not D.compare(d,compiled));compiled.medal_times.gold=25;assert(D.compare(d,compiled):find('medal_times.gold',1,true))
local reopened=D.open_level(assert(D.compile(d)));assert(reopened.editor.medal_times.bronze==40)
local legacy=D.copy(d);legacy.editor.medal_times=nil;legacy.editor.editor_version=7;legacy.editor.compiler_version=7
assert(D.validate(legacy) and legacy.editor.editor_version==8 and legacy.editor.medal_times==nil)
local future=D.copy(d);future.editor.medal_times.version=999;local valid,why,protected=D.validate(future);assert(not valid and protected)
print('PASS medal exact boundaries/highest/slow completion/next/invalid/edit/cosmetic/revision/source compile and version protection')
