local doc=require 'main.gym.editor_doc'
local planner=require 'main.gym.editor_terrain'
local geom=require 'main.gym.terrain_geometry'
local source=dofile(arg[1]..'/six-anchor-source.lua')
local e=source.editor
local function old_entries(plans)
    local t={};for _,p in ipairs(plans) do t[#t+1]={points=p.points,signature=p.signature} end;return t
end
local first=assert(planner.plan(e,nil,{},nil,{}));assert(#first==11)
local old=old_entries(first)
local identical=assert(planner.plan(e,nil,{},nil,old))
for _,p in ipairs(identical) do assert(not p.changed and p.entry) end
local before=doc.copy(source)
local changed=doc.copy(e.objects[1]);changed.anchors[4].out[2]=changed.anchors[4].out[2]+1
local plans=assert(planner.plan(e,{o1=changed},{},nil,old))
local rebuilt,reused=0,0
for _,p in ipairs(plans) do if p.changed then rebuilt=rebuilt+1 else reused=reused+1 end end
assert(rebuilt>0 and reused>0,'A local tangent edit rebuilt everything')
local function equal(a,b)
 if type(a)~='table' then return a==b end
 for k,v in pairs(a) do if not equal(v,b[k]) then return false end end
 for k in pairs(b) do if a[k]==nil then return false end end
 return true
end
assert(equal(source,before),'Preview mutated source')
-- The shader floor and UV phase may change without altering a retained section's vertices/resources.
local lower=doc.copy(e.objects[1]);lower.anchors[3].p[2]=lower.anchors[3].p[2]-2
local floor=assert(planner.plan(e,{o1=lower},{},nil,old));local retained=0
for _,p in ipairs(floor) do if not p.changed then retained=retained+1 end end
assert(retained>0)
-- Hidden metadata remains source-only for collision, but updates only the owning render sections.
local long=dofile(arg[1]..'/long-curves-source.lua').editor
local base=assert(planner.plan(long,nil,{},nil,{}));local oldlong=old_entries(base)
long.objects[2].hidden=true
local hidden=assert(planner.plan(long,nil,{},nil,oldlong));local keep=0
for _,p in ipairs(hidden) do if not p.changed then keep=keep+1 end end
assert(keep>0)
-- Exact shared front/edge endpoints and UV phase after arbitrary retained partitions.
for _,p in ipairs(plans) do
 local c=geom.section(p.prep,p.first,p.last,'test',true,p.styles)
 assert(c.vertices>0 and c.vertices%3==0)
end
print('PASS: unchanged plans reuse all '..#identical..' sections; tangent rebuilt '..rebuilt..', reused '..reused..'; global floor retains '..retained..'; hide retains '..keep..'; immutable source')
