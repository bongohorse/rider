-- Normal-Play mesh adapter. Resources/objects belong to this proxy owner, never Retry.
local geometry=require "main.game.terrain_geometry"
local stations=require "main.game.stations"
local socket=require "socket"
local residency=require "main.game.terrain_residency"
local M={}
local SELECT_GAIN={1.6,.95,.5}
-- Scalar debug accounting only; no world/resource handles are kept in module state.
local created,released=0,0
local function publish()
    if html5 and sys.get_engine_info().is_debug then
        html5.run("window.riderTerrainMeshLifecycle="..json.encode({created=created,released=released,owned=created-released}))
    end
end
-- Same engine adapter for Play construction and local editor uploads.
function M.bounds(b,c)
    local scale=sys.get_config_number("physics.scale",0.01)
    local aabb={};for j,v in ipairs(c.bounds) do aabb[j]=v/scale end
    aabb[1],aabb[2],aabb[3]=aabb[1]-0.5,aabb[2]-0.5,-1
    aabb[4],aabb[5],aabb[6]=aabb[4]+0.5,aabb[5]+0.5,1
    buffer.set_metadata(b,hash("AABB"),aabb,buffer.VALUE_TYPE_FLOAT32)
end
function M.buffer(c)
    local scale=sys.get_config_number("physics.scale",0.01)
    local streams={{name=hash("position"),type=buffer.VALUE_TYPE_FLOAT32,count=3},{name=hash("color"),type=buffer.VALUE_TYPE_FLOAT32,count=4},{name=hash("texcoord0"),type=buffer.VALUE_TYPE_FLOAT32,count=2}}
    if c.look_data then streams[#streams+1]={name=hash("look_data"),type=buffer.VALUE_TYPE_FLOAT32,count=3} end
    -- #392 Stage A textured route: one float per vertex (family*4+face), 48 -> 52 bytes.
    if c.texture then streams[#streams+1]={name=hash("texture_slot"),type=buffer.VALUE_TYPE_FLOAT32,count=1} end
    local b=buffer.create(c.vertices,streams)
    if c.look_data then local stream=buffer.get_stream(b,"look_data");for i,v in ipairs(c.look_data) do stream[i]=v end end
    if c.texture then local stream=buffer.get_stream(b,"texture_slot");for i,v in ipairs(c.texture) do stream[i]=v end end
    local p,col,uv=buffer.get_stream(b,"position"),buffer.get_stream(b,"color"),buffer.get_stream(b,"texcoord0")
    for j,v in ipairs(c.position) do p[j]=v/scale end
    for j,v in ipairs(c.color) do col[j]=v end
    for j,v in ipairs(c.uv) do uv[j]=v end
    M.bounds(b,c)
    return b
end
-- Per-surface overrides: a hidden chunk object keeps the other preset's textures loaded for this world.
local PRESET_IMAGE={'surface','band','fill'}
function M.overrides(object,c,state)
    if not c.overrides then return end
    local url=msg.url(nil,object,"mesh")
    for i,id in ipairs(c.overrides) do
        if id and id~=c.preset then
            -- Held on the world's terrain state: a handle does not survive the world.
            state.holders=state.holders or {}
            if not state.holders[id] then
                state.holders[id]=factory.create("#preset_"..id,vmath.vector3(0,0,-3))
                msg.post(state.holders[id],"disable")
            end
            go.set(url,"texture"..(i-1),hash("/main/terrain_material/presets/"..id.."/"..PRESET_IMAGE[i]..".texturec"))
        end
    end
end
function M.upload(entry,c,path,state)
    local scale=sys.get_config_number("physics.scale",0.01)
    local b=M.buffer(c)
    -- A material change needs another chunk object; the resource keeps its identity only for the same layout.
    if entry.object and entry.material_key~=c.material_key then go.delete(entry.object);entry.object=nil end
    if entry.resource then resource.set_buffer(entry.resource,b,{transfer_ownership=true})
    else
        entry.resource=resource.create_buffer(path,{buffer=b,transfer_ownership=true})
        created=created+1;entry.path=path
    end
    if not entry.object then
        -- #392: the textured route has its own material/vertex layout; the pilot selection is fixed per page load.
        entry.object=factory.create(c.preset and "#preset_"..c.preset or c.textured and "#textured_mesh" or c.perspective and "#perspective_mesh" or "#terrain_mesh",vmath.vector3(c.origin[1]/scale,c.origin[2]/scale,c.layer_z))
        go.set(msg.url(nil,entry.object,"mesh"),"vertices",entry.resource)
        M.overrides(entry.object,c,state)
        entry.material_key=c.material_key
    else go.set_position(vmath.vector3(c.origin[1]/scale,c.origin[2]/scale,c.layer_z),entry.object) end
    entry.geometry=c
    if c.perspective then entry.look_object=nil end
    publish()
end
-- An edit elsewhere can change a run's draw order: retained sections follow without a rebuild.
function M.layer(entry,z)
    local c=entry.geometry
    if not (entry.object and c) or c.layer_z==z then return end
    local scale=sys.get_config_number("physics.scale",0.01)
    go.set_position(vmath.vector3(c.origin[1]/scale,c.origin[2]/scale,z),entry.object)
    c.layer_z=z
end
-- Selection/visibility changes write colors in place; positions and resource identity stay retained.
function M.colors(entry,styles,first)
    local c=entry.geometry
    local b=resource.get_buffer(entry.resource)
    local col=buffer.get_stream(b,"color")
    for _,g in ipairs(c.color_groups) do
        -- Retained geometry can move to a different sample offset after an upstream edit.
        local state=styles[g.interval-c.first+(first or c.first)] or 0
        for i=g.first,g.last do
            local k=(i-1)%4+1;local v=c.base_colors[i]
            if state==-1 and k==4 then v=0
            elseif state==1 and k<4 then v=v*SELECT_GAIN[k]
            elseif state==2 and k<4 then v=v*1.2 end
            col[i]=v
        end
    end
    resource.set_buffer(entry.resource,b,{transfer_ownership=true})
end
function M.drop(entry,delete_object)
    if delete_object and entry.object then go.delete(entry.object) end
    if entry.resource then resource.release(entry.resource);released=released+1 end
    entry.resource,entry.object,entry.geometry,entry.enabled=nil,nil,nil,nil
    publish()
end
function M.build(self,d)
    local started=socket.gettime()
    local look=require "main.terrain_perspective.look"
    local material=require("main.terrain_perspective.material");material.select(d)
    local state={perspective=require("main.terrain_perspective.runtime").enabled(d),params=look.params(d),baked=look.has_sections(d),material_key=material.key()};self.terrain_mesh=state
    local entries,stats=geometry.describe(d);if state.perspective then stats.buffer_bytes=stats.vertices*require("main.terrain_perspective.projection").stride() end;stats.budget=require("main.game.terrain_budget").measure(d);state.entries,state.stats,state.source=entries,stats,d
    local mapping=look.mapping(d);if mapping then for _,e in ipairs(entries) do e.looks=mapping[e.chain] end end
    if not state.perspective and html5 and sys.get_engine_info().is_debug then html5.run('window.riderRoadProjection=null') end
    M.update(self)
    -- Only the decoration copy omits terrain strokes; the physical station stays untouched.
    local decor={};for k,v in pairs(d) do decor[k]=v end;decor.chains={}
    local sprites,labels=stations.decorate(decor)
    stats.decoration_sprites,stats.labels=sprites,labels
    stats.build_ms=(socket.gettime()-started)*1000
    state.stats=stats
    publish()
    if html5 and sys.get_engine_info().is_debug then
        stats.generation,stats.station=self.session_generation,d.id
        html5.run("window.riderTerrainMesh="..json.encode(stats))
    end
    return sprites,labels
end
function M.diagnostics(state,mode,generation)
    if not (html5 and sys.get_engine_info().is_debug) then return end
    local r=state.last;local keys={r.visible,r.allocated,r.cached,r.enabled,r.bytes,r.uploaded,r.reassigned,r.released,r.queued,state.revision or 0}
    for _,e in ipairs(state.entries) do keys[#keys+1]=tostring(e.key)..":"..tostring(e.path)..":"..tostring(e.enabled) end
    local key=table.concat(keys,"|")
    if state.published==key then return end
    state.published=key
    local entries={}
    for _,e in ipairs(state.entries) do entries[#entries+1]={key=e.key,bounds=e.bounds,allocated=e.resource~=nil,enabled=e.enabled==true,path=e.path,bytes=e.geometry and e.geometry.bytes or 0} end
    html5.run("window.riderTerrainResources="..json.encode({mode=mode,generation=generation,counts=r,high_water=state.high_water,view=state.view,entries=entries}))
end
-- Change visual state only. A Gym draft may never replace the running collision samples.
local function same_chains(a,b)
    if #a.chains~=#b.chains then return false end
    for i,c in ipairs(a.chains) do
        if #c~=#b.chains[i] then return false end
        for j,p in ipairs(c) do local q=b.chains[i][j]
            if math.abs(p[1]-q[1])>1e-6 or math.abs(p[2]-q[2])>1e-6 then return false end
        end
    end
    return true
end
local function same_looks(a,b,first,last)
    if not a or not b then return a==b end
    for i=first,last do for _,k in ipairs({'width','side','shading'}) do if a[i][k]~=b[i][k] then return false end end end
    return true
end
local function live_look(self,state)
    local session=require("main.editor.editor_look")
    local d=session.live(self.session_generation) or state.source
    if d==state.look_source then return end
    if not same_chains(state.source,d) then
        if session.session then session.session.error='The editor geometry differs from this run. Play from the Editor first, then change 3D look.' end
        state.look_source=d;return
    end
    -- Retain the actual running station's markers/props/physics costs, even for a template copy.
    local visual={};for k,v in pairs(state.source) do visual[k]=v end;visual.editor=d.editor
    local budget,err=require('main.game.terrain_budget').check(visual)
    if not budget then
        if session.session then session.session.error=err end
        state.look_source=d;return
    end
    local look=require("main.terrain_perspective.look")
    local material=require("main.terrain_perspective.material");material.select(d)
    local material_key=material.key()
    local projected=require("main.terrain_perspective.runtime").enabled(d)
    local mapping=look.mapping(d)
    for _,e in ipairs(state.entries) do
        local values=mapping and mapping[e.chain]
        if state.perspective~=projected or state.material_key~=material_key then
            -- Factory/material layout changes only on explicit legacy opt-in, never camera motion.
            M.drop(e,true);e.dirty=true
        elseif not same_looks(e.looks,values,e.first,e.last) then e.dirty=true end
        e.looks=values
    end
    state.perspective,state.params,state.baked=projected,look.params(d),look.has_sections(d)
    state.material_key=material_key
    state.stats.buffer_bytes=state.stats.vertices*(projected and require("main.terrain_perspective.projection").stride() or 36)
    state.stats.budget=budget
    state.look_source=d;state.revision=(state.revision or 0)+1
end
function M.update(self)
    local state=self.terrain_mesh;if not state then return end
    live_look(self,state)
    local started=socket.gettime()
    local view=residency.viewport()
    local perspective=require "main.terrain_perspective.runtime"
    if state.perspective then perspective.prepare(state,{(view[1]+view[3])/2,(view[2]+view[4])/2}) end
    local r=residency.update(state,state.entries,view,function(e)
        local c=state.perspective and require("main.terrain_perspective.projection").section(e.prep,e.first,e.last,e.key,nil,e.looks) or geometry.section(e.prep,e.first,e.last,e.key)
        state.uploads=(state.uploads or 0)+1
        if not e.resource then state.serial=(state.serial or 0)+1 end
        M.upload(e,c,"/terrain_mesh/g"..self.session_generation.."-slot"..state.serial..".bufferc",state)
    end,function(e) M.drop(e,true) end)
    if state.perspective then perspective.apply(state,M.bounds) end
    state.stats.mesh_gameobjects,state.stats.allocated_bytes=r.allocated,r.bytes
    state.stats.resident=r
    r.update_ms=(socket.gettime()-started)*1000
    M.diagnostics(state,"play",self.session_generation)
end
function M.final(self,failed)
    local state=self.terrain_mesh
    if state then
        -- Drop our resource references; mesh components retain theirs until Defold destroys this world.
        for _,e in ipairs(state.entries) do M.drop(e,failed);e.geometry=nil end
        publish()
        self.terrain_mesh=nil
    end
end
return M
