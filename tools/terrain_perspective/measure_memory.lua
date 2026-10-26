-- Native Lua observation of two complete Edit generations; not process/GPU memory.
local doc=require 'main.gym.editor_doc'
local geom=require 'main.gym.terrain_geometry'
local projection=require 'main.terrain_perspective.projection'
local budget=require 'main.gym.terrain_budget'
for _,name in ipairs({'six-anchor','long-curves','mixed','long-over-budget'}) do
 local d=assert(doc.compile(dofile(arg[1]..'/'..name..'-source.lua')))
 local entries=geom.describe(d)
 for _,variant in ipairs({'accepted-layout','comparison-layout'}) do
  collectgarbage('collect');local before=collectgarbage('count');local generations={}
  for generation=1,2 do
   local all={};generations[generation]=all
   for _,e in ipairs(entries) do
    all[#all+1]=variant=='comparison-layout' and projection.section(e.prep,e.first,e.last,e.key) or geom.section(e.prep,e.first,e.last,e.key,true)
   end
  end
  collectgarbage('collect')
  local delta=(collectgarbage('count')-before)*1024
  assert(#generations==2 and #generations[1]==#entries and #generations[2]==#entries)
  budget.COMPARISON=variant=='comparison-layout';local r=assert(budget.check(d))
  assert(delta<r.cpu_estimate)
  print(string.format('%s %s two_generations_delta_bytes=%.0f vertex_payload_bytes=%d cpu_estimate_bytes=%d',name,variant,delta,r.payload,r.cpu_estimate))
 end
 budget.COMPARISON=false
end
