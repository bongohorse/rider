-- Retained Lua allocation for two real authored mesh generations, not process/GPU memory.
local doc=require 'main.gym.editor_doc'
local look=require 'main.terrain_perspective.look'
local proj=require 'main.terrain_perspective.projection'
local geom=require 'main.gym.terrain_geometry'
local budget=require 'main.gym.terrain_budget'
for _,name in ipairs({'six-anchor','long-curves','mixed','long-over-budget'}) do
 local source=dofile(arg[1]..'/'..name..'-source.lua');source.editor.road_profile=look.ID;source.editor.road_look={version=1,params=proj.validate(proj.DEFAULT)}
 for i,o in ipairs(source.editor.objects) do if doc.terrain(o) then o.road_look={version=1,width=i%2==0 and 2 or .25,side=i%2==0 and .25 or 64,shading=i%2==0 and 0 or 1} end end
 local d=assert(doc.compile(source));local entries=geom.describe(d);local mapping=look.mapping(d)
 collectgarbage('collect');local before=collectgarbage('count');local generations={}
 for generation=1,2 do local meshes={};generations[generation]=meshes;for _,e in ipairs(entries) do meshes[#meshes+1]=proj.section(e.prep,e.first,e.last,e.key,nil,mapping[e.chain]) end end
 collectgarbage('collect');local bytes=(collectgarbage('count')-before)*1024;local r=assert(budget.check(d));assert(#generations[2]==#entries and bytes<r.cpu_estimate)
 print(string.format('%s two_generations_retained_bytes=%.0f payload_bytes=%d estimated_CPU_bytes=%d',name,bytes,r.payload,r.cpu_estimate))
end
