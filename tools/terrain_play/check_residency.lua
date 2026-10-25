-- Pure selection/ownership policy with the real descriptors; no simulated physics.
local geom=require 'main.gym.terrain_geometry'
local doc=require 'main.gym.editor_doc'
local policy=require 'main.gym.terrain_residency'
msg={url=function(_,id) return id end,post=function() end}
local serial,uploads,drops=0,0,0
local function activate(e)
    if not e.resource then serial=serial+1;e.resource=serial;e.object=serial end
    e.geometry=geom.section(e.prep,e.first,e.last,e.key);uploads=uploads+1
end
local function drop(e) e.resource,e.object=nil,nil;drops=drops+1 end
for _,name in ipairs({'six-anchor','long-curves','mixed'}) do
    local d=assert(doc.compile(dofile(arg[1]..'/'..name..'-source.lua')))
    local entries,stats=geom.describe(d)
    local chunks,oldstats=geom.build(d)
    assert(stats.buffer_bytes==oldstats.buffer_bytes and #entries==#chunks)
    for i,e in ipairs(entries) do
        local c=chunks[i]
        assert(e.bounds[1]<=c.bounds[1]+c.origin[1] and e.bounds[2]<=c.bounds[2]+c.origin[2])
        assert(e.bounds[3]>=c.bounds[4]+c.origin[1] and e.bounds[4]>=c.bounds[5]+c.origin[2])
    end
    local state={};local max_alloc=0
    local views={}
    for x=0,500,5 do views[#views+1]={x-8,-8,x+8,8} end
    for x=500,0,-17 do views[#views+1]={x-8,-8,x+8,8} end
    for _,v in ipairs({{226,12,250,35},{250,-35,274,-15},{282,-5,315,10},{380,-60,400,-40},{-8,-8,8,8}}) do views[#views+1]=v end
    for _,view in ipairs(views) do
        local r=policy.update(state,entries,view,activate,drop)
        max_alloc=math.max(max_alloc,r.allocated);assert(r.cached<=2 and r.allocated<=#entries)
        for _,e in ipairs(entries) do
            if policy.intersects(e.bounds,view,.005) then assert(e.resource and e.enabled,'Missing incoming section') end
            if e.resource then assert(e.geometry.key==e.key,'Stale reassigned section') end
        end
        local before=uploads
        -- Drain at most two preloads/update, then stationary selection must emit no geometry.
        for i=1,#entries do policy.update(state,entries,view,activate,drop) end
        before=uploads;policy.update(state,entries,view,activate,drop);assert(before==uploads)
    end
    local r=policy.update(state,entries,{-1000,-1000,1000,1000},activate,drop)
    assert(r.visible==#entries and r.allocated==#entries,'Fit must retain every visible section')
    r=policy.update(state,entries,{2000,2000,2010,2010},activate,drop)
    -- First teleport prediction retains only its bounded 32 m margin; none intersects here.
    assert(r.allocated<=2 and r.cached==r.allocated)
    for _,e in ipairs(entries) do if not e.resource then assert(not e.geometry,'Evicted CPU arrays retained') end end
    for _,e in ipairs(entries) do if e.resource then drop(e) end end
    print('PASS '..name..': '..#entries..' logical sections; sweep peak '..max_alloc..'; viewport fit preserves all; far view retains <=2; idle emits none')
end
