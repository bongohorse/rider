-- Pure admission policy for the production depth renderer. No engine/physics mutation.
-- Limits are application headroom, not claims about physical GPU/process memory.
local M={MESHES=128,SPRITES=1024,LABELS=1024,INSTANCES=1024,
    PAYLOAD=1024*1024,CPU=16*1024*1024,PHYSICS_VERTICES=2048,RESERVE=64}
function M.measure(d)
    local projected=M.COMPARISON or require('main.terrain_perspective.profile').enabled(d)
    local stride,working=projected and 48 or 36,projected and 560 or 512
    local r={stride=stride,sections=0,vertices=0,segments=0,physics_vertices=0,physics_chains=0,hull_vertices=0,
        sprites=0,labels=#(d.labels or {}),largest_chain=0,largest_segments=0}
    for i,c in ipairs(d.chains) do
        local n=#c-1
        r.segments=r.segments+n;r.sections=r.sections+math.ceil(n/64)
        r.vertices=r.vertices+n*18+12
        local sides=d.two_sided and d.two_sided[i] and 2 or 1
        r.physics_vertices=r.physics_vertices+#c*sides;r.physics_chains=r.physics_chains+sides
        if n>r.largest_segments then r.largest_chain,r.largest_segments=i,n end
    end
    for _,h in ipairs(d.hulls or {}) do r.hull_vertices=r.hull_vertices+#h.vertices end
    local mech=require('main.gym.mechanism_data').cost(d.mechanisms)
    r.mechanism_bodies=mech.bodies;r.mechanism_shapes=mech.shapes;r.mechanism_joints=mech.joints
    r.physics_vertices=r.physics_vertices+r.hull_vertices+mech.vertices
    r.sprites=#(d.coins and d.coins.items or {})+r.hull_vertices+(d.finish and 1 or 0)+(d.seesaw and 1 or 0)
    if d.mechanisms then r.sprites=r.sprites+math.max(mech.sprites,4*#d.mechanisms.crates+4*#d.mechanisms.plates+5*#d.mechanisms.gates) end
    r.labels=r.labels+(d.finish and 1 or 0)
    if d.markers then
        local m=d.markers
        -- Same loop and major test as stations.decorate, including nonzero marker origins.
        for x=m.from_m,m.to_m,m.minor_m do
            r.sprites=r.sprites+1
            if math.abs(x/m.major_m-math.floor(x/m.major_m+0.5))<.001 then r.labels=r.labels+1 end
        end
    end
    if d.id and d.id:match('^straight') and not d.custom then r.sprites=r.sprites+48 end
    r.payload=r.vertices*stride
    -- Fit can activate everything; caching is a subset, never an extra two beyond all sections.
    r.visible_max=r.sections;r.allocated_max=r.sections;r.cached_max=math.min(2,r.sections)
    r.mesh_peak=2*r.sections -- retiring old + incoming, before end-of-frame deletion
    r.instances=r.sections+r.sprites+r.labels+M.RESERVE
    -- Conservative CPU working envelope: retained editor arrays (including base colors),
    -- staging/replacement arrays, descriptors and two engine-owned buffer copies.
    r.cpu_estimate=r.vertices*working+r.physics_vertices*512+r.payload*2
    -- Pinned mesh-world VB freelist reuses handles but retains their uploaded size.
    -- Current editor planner emits <=96 intervals/section; one shared seed VB is extra.
    r.engine_pool_ceiling=(M.MESHES+1)*(96*18+12)*stride
    r.replacement_payload=2*r.payload
    return r
end
local function over(name,n,limit,fix)
    if n>limit then return string.format('Resource budget: %s needs %d; limit %d. %s',name,n,limit,fix) end
end
function M.check(d)
    local r=M.measure(d)
    local target=string.format('Shorten or simplify chain %d (%d segments); keep sampling accuracy.',r.largest_chain,r.largest_segments)
    local err=over('mesh components at replacement peak',r.mesh_peak,M.MESHES,'Reduce separate terrain runs. '..target)
        or over('terrain vertex payload bytes at Fit',r.payload,M.PAYLOAD,target)
        or over('estimated CPU working bytes',r.cpu_estimate,M.CPU,'Reduce terrain/content; save separate courses. '..target)
        or over('physics vertices (two-sided copies and hulls included)',r.physics_vertices,M.PHYSICS_VERTICES,'Reduce runs, two-sided terrain or obstacles; split the course.')
        or over('sprites including vehicle/replay reserve',r.sprites+M.RESERVE,M.SPRITES,'Remove obstacle edges or distance markers.')
        or over('labels including reserve',r.labels+M.RESERVE,M.LABELS,'Remove labels or major distance markers.')
        or over('GameObjects including reserve',r.instances,M.INSTANCES,'Remove obstacle edges, labels or distance markers; split the course.')
    if err then return nil,err,r end
    return r
end
function M.preview(sections,vertices,sprites,labels,document)
    -- Edit updates can overlap old/new components. Leave START/FINISH/headroom independent.
    local projected=M.COMPARISON or require('main.terrain_perspective.profile').enabled({editor=document})
    return sections*2<=M.MESHES and vertices*(projected and 48 or 36)<=M.PAYLOAD and
        2*sprites+12<=M.SPRITES and 2*labels+4<=M.LABELS and
        2*(sections+sprites+labels)+16<=M.INSTANCES
end
return M
