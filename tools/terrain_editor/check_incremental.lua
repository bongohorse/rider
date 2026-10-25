local doc=require 'main.gym.editor_doc'
local planner=require 'main.gym.editor_terrain'
local geom=require 'main.gym.terrain_geometry'
local source=dofile(arg[1]..'/six-anchor-source.lua')
local e=source.editor
local function old_entries(plans)
    local t={};for _,p in ipairs(plans) do t[#t+1]={points=p.points,signature=p.signature,color=p.color} end;return t
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
local hidden=assert(planner.plan(long,nil,{},nil,oldlong));local keep,colors=0,0
for _,p in ipairs(hidden) do if not p.changed then keep=keep+1 end;if p.restyled then colors=colors+1 end end
assert(keep==#base and colors>0 and colors<#base)
-- Exact shared front/edge endpoints and UV phase after arbitrary retained partitions.
for _,p in ipairs(plans) do
 local c=geom.section(p.prep,p.first,p.last,'test',true,p.styles)
 assert(c.vertices>0 and c.vertices%3==0)
end
local invalid=geom.section(geom.prepare({{0,0},{0,0}},-10),1,2,'invalid',true,{})
for _,v in ipairs(invalid.position) do assert(v==v and math.abs(v)<math.huge) end
local last=old
local max_sections=0
for n=1,40 do
 local moved=doc.copy(e.objects[1]);moved.anchors[4].out[2]=moved.anchors[4].out[2]+math.sin(n)*.3
 local ps=assert(planner.plan(e,{o1=moved},{},nil,last));max_sections=math.max(max_sections,#ps)
 local prior={}
 for _,p in ipairs(ps) do
  assert(p.last-p.first<=96)
  if prior[p.prep] then assert(prior[p.prep]==p.first) end;prior[p.prep]=p.last
 end
 last=old_entries(ps)
end
assert(max_sections<=24)
for _,p in ipairs(first) do
 local a=geom.section(p.prep,p.first,p.last,'editor',true,p.styles)
 local b=geom.section(p.prep,p.first,p.last,'play',false)
 for j=1,#a.position,3 do
  local x,y,z=a.position[j],a.position[j+1],a.position[j+2]
  if z<0 then y=p.lower-a.origin[2];z=z < -1.5*geom.DEPTH and geom.DEPTH or 0 end
  assert(math.abs(x-b.position[j])<1e-9 and math.abs(y-b.position[j+1])<1e-9 and z==b.position[j+2])
 end
 for j=1,#a.uv,2 do assert(math.abs(a.uv[j]+p.phase-b.uv[j])<1e-9) end
end
print('Repeated edits maximum sections: '..max_sections..'; editor floor/phase decoding matches Play')
print('PASS: unchanged plans reuse all '..#identical..' sections; tangent rebuilt '..rebuilt..', reused '..reused..'; global floor retains '..retained..'; hide retains '..keep..'; immutable source')
