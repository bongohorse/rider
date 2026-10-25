-- Real compiler/geometry predictions, independent boundary cases; no engine overrides.
local budget=require 'main.gym.terrain_budget'
local doc=require 'main.gym.editor_doc'
local geometry=require 'main.gym.terrain_geometry'
local function fixture(name) return dofile(arg[1]..'/'..name..'-source.lua') end
for _,name in ipairs({'six-anchor','long-curves','mixed','long-over-budget'}) do
    local d=assert(doc.compile(fixture(name)))
    local r=assert(budget.check(d));local chunks,s=geometry.build(d)
    assert(r.sections==#chunks and r.vertices==s.vertices and r.payload==s.buffer_bytes)
    assert(r.mesh_peak==2*#chunks and r.allocated_max==#chunks and r.cached_max<=2)
    assert(require('main.gym.editor_terrain').admitted(d.editor))
    print(name..': '..r.sections..' sections, '..r.vertices..' vertices, '..r.payload..' payload B, '..r.cpu_estimate..' estimated CPU B, '..r.physics_vertices..' physics vertices')
end
local base=assert(doc.compile(fixture('long-over-budget')))
local function reject(d,resource)
    local ok,err=budget.check(d);assert(not ok and err:find(resource,1,true),tostring(err))
    print('PASS refusal: '..err)
end
local function chain(n) local c={};for i=0,n do c[#c+1]={i*.5,0} end;return c end
local d=doc.copy(base);d.chains={chain(1650)};reject(d,'terrain vertex payload')
d=doc.copy(base);d.chains={};for i=1,32 do d.chains[i]=chain(129) end;reject(d,'mesh components')
d=doc.copy(base);d.labels={};for i=1,961 do d.labels[i]={position={0,0},text='x'} end;reject(d,'labels')
d=doc.copy(base);d.markers={from_m=0,to_m=1000,minor_m=1,major_m=100};reject(d,'sprites')
d=doc.copy(base);d.labels={};for i=1,900 do d.labels[i]={position={0,0},text='x'} end
d.hulls={};for i=1,30 do d.hulls[i]={vertices={{0,0},{1,0},{1,1},{0,1}}} end;reject(d,'GameObjects')
-- Two-sided physics is charged twice, mesh once; independent from physical component capacity.
d=doc.copy(base);d.chains={chain(200)};d.two_sided={true};local r=assert(budget.check(d));assert(r.physics_vertices==402 and r.sections==4)
d.chains={chain(1100)};d.two_sided={true};reject(d,'physics vertices')
-- Exercise the policy's nearest CPU boundary without conflating it with the per-run compiler cap.
d=doc.copy(base);d.chains={chain(1521)};d.hulls={};d.labels={};d.finish=nil
assert(budget.check(d));d.chains={chain(1522)};reject(d,'estimated CPU working bytes')
local original=fixture('long-over-budget');original.editor.start.position={501,1};local ok,err=doc.compile(original);assert(not ok and err:find('500',1,true))
print('PASS independent source/compiler/START contracts retained; renderer budgets reject oversized inputs')
