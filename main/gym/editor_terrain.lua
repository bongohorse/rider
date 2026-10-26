-- Source-to-preview dependency planning. No compiler/physics/source writes; no per-frame rebuild.
local doc=require "main.gym.editor_doc"
local geometry=require "main.gym.terrain_geometry"
local residency=require "main.gym.terrain_residency"
local M={}
local function point_key(p) return string.format("%.17g,%.17g",p[1],p[2]) end
local function same(a,b)
    if #a~=#b then return false end
    for i,v in ipairs(a) do if v~=b[i] then return false end end
    return true
end
local function signature(prep,first,last,styles)
    local t={prep.monotone,first==1,last==#prep.p}
    for i=first,last do t[#t+1]=prep.p[i][1];t[#t+1]=prep.p[i][2] end
    if not prep.monotone then
        for _,i in ipairs({first,last}) do t[#t+1]=prep.normals[i][1];t[#t+1]=prep.normals[i][2] end
    end
    return t
end
local function matches(entry,p,i)
    if i+#entry.points-1>#p then return false end
    for j,q in ipairs(entry.points) do if q[1]~=p[i+j-1][1] or q[2]~=p[i+j-1][2] then return false end end
    return true
end
-- Source-only estimate, using the same connected runs as the compiler. Invalid drafts stay editable.
function M.admitted(e,compiled_budget)
    if compiled_budget then
        -- Reuse the existing live validation result; a drag's actual plan is guarded below.
        return require("main.gym.terrain_budget").preview(compiled_budget.sections,compiled_budget.vertices,
            compiled_budget.sprites-(e.finish and 1 or 0),compiled_budget.labels-(e.finish and 1 or 0))
    end
    local sections,vertices,sprites,labels=0,0,0,0
    local pieces=doc.pieces(e)
    for _,run in ipairs(doc.runs(e)) do
        for _,c in ipairs(doc.run_chains(e,run,pieces)) do
            local n=#c.points-1
            sections=sections+math.ceil(n/geometry.INTERVALS);vertices=vertices+n*18+12
        end
    end
    for _,o in ipairs(e.objects) do
        if doc.outline(o) then sprites=sprites+#doc.outline(o)
        elseif o.type=="label" then labels=labels+1 end
    end
    return require("main.gym.terrain_budget").preview(sections,vertices,sprites,labels)
end
function M.plan(e,previews,selected,hover,old)
    local effective={objects={},connections=e.connections,start=e.start,finish=e.finish}
    local styles_by={}
    for i,o in ipairs(e.objects) do
        local shown=previews and previews[o.id] or o
        effective.objects[i]=shown
        styles_by[o.id]=o.hidden and -1 or selected[o.id] and 1 or hover==o.id and 2 or 0
    end
    local lower=doc.bounds(effective)[3]
    local pieces=doc.pieces(effective)
    local candidates={}
    for _,entry in ipairs(old or {}) do
        local k=point_key(entry.points[1]);candidates[k]=candidates[k] or {};table.insert(candidates[k],entry)
    end
    local plans,used,arc,previous={},{},0,nil
    for _,run in ipairs(doc.runs(effective)) do
        for _,chain in ipairs(doc.run_chains(effective,run,pieces)) do
            local raw=chain.points
            if #raw>=2 then
                local reverse=raw[1][1]>raw[#raw][1]
                local first=raw[reverse and #raw or 1]
                if previous then arc=arc+math.sqrt((previous[1]-first[1])^2+(previous[2]-first[2])^2) end
                local prep=geometry.prepare(raw,lower,arc);arc,previous=prep.arc,prep.p[#prep.p]
                local styles={}
                for i=1,#raw-1 do styles[i]=styles_by[chain.owner[reverse and #raw-i+1 or i+1]] end
                -- Match old whole sections by exact source samples, independent of shifted sample indices.
                local anchors={}
                for i,p in ipairs(prep.p) do
                    for _,entry in ipairs(candidates[point_key(p)] or {}) do
                        if not used[entry] and matches(entry,prep.p,i) then anchors[i]=entry;break end
                    end
                end
                local i=1
                while i<#prep.p do
                    local entry=anchors[i];if entry and used[entry] then entry=nil end
                    local last=entry and i+#entry.points-1 or math.min(i+geometry.INTERVALS,#prep.p)
                    if not entry then
                        for j=i+1,last-1 do if anchors[j] then last=j;break end end
                        -- Absorb a short changed sliver's neighbor to avoid fragmentation over repeated drags.
                        if last-i<32 and anchors[last] then last=math.min(i+96,last+#anchors[last].points-1) end
                    end
                    local sig=signature(prep,i,last,styles)
                    local points={};for k=i,last do points[#points+1]={prep.p[k][1],prep.p[k][2]} end
                    if entry then used[entry]=true end
                    local color={};for k=i,last-1 do color[#color+1]=styles[k] or 0 end
                    plans[#plans+1]={entry=entry,prep=prep,first=i,last=last,signature=sig,color=color,points=points,styles=styles,
                        changed=not entry or not same(entry.signature,sig),restyled=not entry or not same(entry.color or {},color),phase=prep.u[i],lower=lower}
                    i=last
                end
            end
        end
    end
    -- Safe fallback for still-invalid drafts; configured engine capacity is not raised.
    local vertices=0
    for _,p in ipairs(plans) do vertices=vertices+(p.last-p.first)*18+(p.first==1 and 6 or 0)+(p.last==#p.prep.p and 6 or 0) end
    if not require("main.gym.terrain_budget").preview(#plans,vertices,0,0) then
        return nil,"Mesh preview exceeds component or Fit payload budget; shorten terrain. Line preview retained."
    end
    return plans
end
function M.create() return {entries={},serial=0,updates=0,uploads=0} end
local function materialize(state,entry,generation,result)
    local mesh=require "main.gym.terrain_mesh"
    local p=entry.plan
    local rebuilt=entry.dirty or not entry.resource
    if rebuilt then
        local c=require("main.terrain_perspective.runtime").enabled() and require("main.terrain_perspective.projection").section(p.prep,p.first,p.last,tostring(entry.key),p.styles) or geometry.section(p.prep,p.first,p.last,tostring(entry.key),true,p.styles)
        if not entry.resource then state.resource_serial=(state.resource_serial or 0)+1 end
        mesh.upload(entry,c,"/editor_terrain/g"..generation.."-slot"..state.resource_serial..".bufferc")
        result.rebuilt=result.rebuilt+1;state.uploads=state.uploads+1
    elseif entry.restyle then
        mesh.colors(entry,p.styles,p.first);result.recolored=result.recolored+1
    end
    local c=entry.geometry
    local scale=sys.get_config_number("physics.scale",0.01)
    go.set(msg.url(nil,entry.object,"mesh"),"editor_params",vmath.vector4(p.phase,(p.lower-c.origin[2])/scale,geometry.DEPTH/scale,1))
    if c.body=="filled" and not c.perspective then c.bounds[2]=p.lower-c.origin[2];mesh.bounds(resource.get_buffer(entry.resource),c) end
    result.uniforms=result.uniforms+1
    entry.restyle=nil
end
function M.resident(state,generation,view,result)
    local mesh=require "main.gym.terrain_mesh"
    result=result or {rebuilt=0,recolored=0,uniforms=0}
    local perspective=require "main.terrain_perspective.runtime"
    if perspective.enabled() then perspective.prepare(state,{(view[1]+view[3])/2,(view[2]+view[4])/2}) end
    local r=residency.update(state,state.entries,view,function(entry) materialize(state,entry,generation,result) end,function(entry) mesh.drop(entry,true) end)
    if perspective.enabled() then perspective.apply(state,mesh.bounds) end
    if state.last_geometry then
        state.last_geometry.allocated,state.last_geometry.allocated_bytes=r.allocated,r.bytes
    end
    mesh.diagnostics(state,"edit",generation)
    return r
end
function M.update(state,e,previews,selected,hover,generation,view)
    local mesh=require "main.gym.terrain_mesh"
    local plans,err=M.plan(e,previews,selected,hover,state.entries)
    if not plans then return nil,err end
    local retained,retired={},{}
    for _,p in ipairs(plans) do if p.entry then retained[p.entry]=true end end
    for _,entry in ipairs(state.entries) do if not retained[entry] then retired[#retired+1]=entry end end
    local result={rebuilt=0,reused=0,recolored=0,uniforms=0,chunks=#plans,vertices=0,buffer_bytes=0}
    local entries={};state.pending=entries
    for _,p in ipairs(plans) do
        local entry=p.entry or table.remove(retired) or {}
        if not entry.key then state.serial=state.serial+1;entry.key=state.serial end
        entries[#entries+1]=entry
        entry.dirty=entry.dirty or p.changed
        entry.refresh=entry.refresh or p.restyled or entry.phase~=p.phase or entry.lower~=p.lower
        entry.restyle=entry.restyle or p.restyled
        if not p.changed then result.reused=result.reused+1 end
        entry.plan=p;entry.bounds=geometry.extent(p.prep,p.first,p.last);entry.base_bounds=entry.bounds
        entry.signature,entry.color,entry.points,entry.phase,entry.lower=p.signature,p.color,p.points,p.phase,p.lower
        local vertices=(p.last-p.first)*18+(p.first==1 and 6 or 0)+(p.last==#p.prep.p and 6 or 0)
        result.vertices=result.vertices+vertices;result.buffer_bytes=result.buffer_bytes+vertices*(require("main.gym.terrain_budget").COMPARISON and 48 or 36)
    end
    for _,entry in ipairs(retired) do mesh.drop(entry,true);entry.geometry=nil end
    -- Register new entries before any potentially failing upload; pending retains partial failure cleanup.
    state.entries=entries;state.last_geometry=result;state.revision=(state.revision or 0)+1
    M.resident(state,generation,view,result)
    state.pending=nil;state.updates=state.updates+1
    return result
end
function M.final(state,remove)
    local mesh=require "main.gym.terrain_mesh"
    if state then
        local seen={}
        for _,list in ipairs({state.entries,state.pending or {}}) do for _,entry in ipairs(list) do
            if not seen[entry] then mesh.drop(entry,remove);seen[entry]=true end
        end end
        state.entries,state.pending={},nil
    end
end
return M
