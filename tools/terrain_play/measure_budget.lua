-- Native Lua allocation measurement of actual compiler + complete Edit emissions.
-- Two emitted generations model replacement, independently of adapter residency/engine pools.
local doc=require 'main.gym.editor_doc'
local geom=require 'main.gym.terrain_geometry'
local budget=require 'main.gym.terrain_budget'
for _,name in ipairs({'six-anchor','long-curves','mixed','long-over-budget'}) do
    collectgarbage('collect')
    local start=collectgarbage('count')
    local source=dofile(arg[1]..'/'..name..'-source.lua')
    local d=assert(doc.compile(source));local descriptors=geom.describe(d)
    local compiled=collectgarbage('count')
    local generations={}
    for g=1,2 do
        local all={};generations[g]=all
        for _,e in ipairs(descriptors) do all[#all+1]=geom.section(e.prep,e.first,e.last,e.key,true) end
    end
    local emitted=collectgarbage('count');local r=budget.measure(d)
    assert((emitted-start)*1024<r.cpu_estimate,'CPU estimate smaller than native Lua allocation observation')
    print(string.format('%s baseline_kib=%.1f compile_kib=%.1f two_edit_generations_kib=%.1f delta_kib=%.1f cpu_envelope_bytes=%d',name,start,compiled,emitted,emitted-start,r.cpu_estimate))
end
