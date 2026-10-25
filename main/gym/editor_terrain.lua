-- Source-to-preview dependency planning. No compiler/physics/source writes; no per-frame rebuild.
local doc=require "main.gym.editor_doc"
local geometry=require "main.gym.terrain_geometry"
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
-- Preview admission uses the still-active legacy estimate, not a replacement budget scheme.
function M.admitted(e)
    local units=0
    for _,o in ipairs(e.objects) do units=units+doc.drawn(o)+(o.type=="label" and 1 or 0) end
    return units+(e.finish and 2 or 0)<=800
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
                        if last-i<32 and anchors[last] then last=last+#anchors[last].points-1 end
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
    if #plans>64 then return nil,"Mesh preview exceeds safe replacement capacity; line preview retained." end
    return plans
end
function M.create() return {entries={},serial=0,updates=0,uploads=0} end
function M.update(state,e,previews,selected,hover,generation)
    local mesh=require "main.gym.terrain_mesh"
    local plans,err=M.plan(e,previews,selected,hover,state.entries)
    if not plans then return nil,err end
    local retained,retired={},{}
    for _,p in ipairs(plans) do if p.entry then retained[p.entry]=true end end
    for _,entry in ipairs(state.entries) do if not retained[entry] then retired[#retired+1]=entry end end
    local result={rebuilt=0,reused=0,recolored=0,uniforms=0,chunks=#plans,vertices=0,buffer_bytes=0}
    local entries={};state.pending=entries
    local scale=sys.get_config_number("physics.scale",0.01)
    for _,p in ipairs(plans) do
        local entry=p.entry or table.remove(retired) or {}
        if not entry.key then state.serial=state.serial+1;entry.key=state.serial end
        entries[#entries+1]=entry
        if p.changed then
            local c=geometry.section(p.prep,p.first,p.last,tostring(entry.key),true,p.styles)
            mesh.upload(entry,c,"/editor_terrain/g"..generation.."-"..entry.key..".bufferc")
            result.rebuilt=result.rebuilt+1;state.uploads=state.uploads+1
        else
            result.reused=result.reused+1
            if p.restyled then mesh.colors(entry,p.styles);result.recolored=result.recolored+1 end
        end
        local c=entry.geometry
        if entry.phase~=p.phase or entry.lower~=p.lower or p.changed then
            go.set(msg.url(nil,entry.object,"mesh"),"editor_params",vmath.vector4(p.phase,(p.lower-c.origin[2])/scale,geometry.DEPTH/scale,1))
            if c.body=="filled" and entry.lower~=p.lower then
                c.bounds[2]=p.lower-c.origin[2]
                mesh.bounds(resource.get_buffer(entry.resource),c)
            end
            result.uniforms=result.uniforms+1
        end
        entry.signature,entry.color,entry.points,entry.phase,entry.lower=p.signature,p.color,p.points,p.phase,p.lower
        result.vertices=result.vertices+c.vertices;result.buffer_bytes=result.buffer_bytes+c.bytes
    end
    for _,entry in ipairs(retired) do mesh.drop(entry,true) end
    state.entries=entries;state.pending=nil;state.updates=state.updates+1;state.last=result
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
