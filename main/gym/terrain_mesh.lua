-- Normal-Play mesh adapter. Resources/objects belong to this proxy owner, never Retry.
local geometry=require "main.gym.terrain_geometry"
local stations=require "main.gym.stations"
local socket=require "socket"
local M={}
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
    local b=buffer.create(c.vertices,{{name=hash("position"),type=buffer.VALUE_TYPE_FLOAT32,count=3},{name=hash("color"),type=buffer.VALUE_TYPE_FLOAT32,count=4},{name=hash("texcoord0"),type=buffer.VALUE_TYPE_FLOAT32,count=2}})
    local p,col,uv=buffer.get_stream(b,"position"),buffer.get_stream(b,"color"),buffer.get_stream(b,"texcoord0")
    for j,v in ipairs(c.position) do p[j]=v/scale end
    for j,v in ipairs(c.color) do col[j]=v end
    for j,v in ipairs(c.uv) do uv[j]=v end
    M.bounds(b,c)
    return b
end
function M.upload(entry,c,path)
    local scale=sys.get_config_number("physics.scale",0.01)
    local b=M.buffer(c)
    if entry.resource then resource.set_buffer(entry.resource,b,{transfer_ownership=true})
    else
        entry.resource=resource.create_buffer(path,{buffer=b,transfer_ownership=true})
        created=created+1;entry.path=path
    end
    if not entry.object then
        entry.object=factory.create("#terrain_mesh",vmath.vector3(c.origin[1]/scale,c.origin[2]/scale,-2))
        go.set(msg.url(nil,entry.object,"mesh"),"vertices",entry.resource)
    else go.set_position(vmath.vector3(c.origin[1]/scale,c.origin[2]/scale,-2),entry.object) end
    entry.geometry=c
    publish()
end
function M.drop(entry,delete_object)
    if delete_object and entry.object then go.delete(entry.object) end
    if entry.resource then resource.release(entry.resource);released=released+1 end
    entry.resource,entry.object=nil,nil
    publish()
end
function M.build(self,d)
    local started=socket.gettime()
    local state={resources={},objects={},paths={}};self.terrain_mesh=state
    local chunks,stats=geometry.build(d)
    local scale=sys.get_config_number("physics.scale",0.01)
    for i,c in ipairs(chunks) do
        local b=M.buffer(c)
        local path="/terrain_mesh/g"..self.session_generation.."-"..c.key..".bufferc"
        local resource_id=resource.create_buffer(path,{buffer=b,transfer_ownership=true})
        state.resources[#state.resources+1]=resource_id
        created=created+1
        state.paths[#state.paths+1]=path
        local id=factory.create("#terrain_mesh",vmath.vector3(c.origin[1]/scale,c.origin[2]/scale,-2))
        state.objects[#state.objects+1]=id
        go.set(msg.url(nil,id,"mesh"),"vertices",resource_id)
    end
    -- Only the decoration copy omits terrain strokes; the physical station stays untouched.
    local decor={};for k,v in pairs(d) do decor[k]=v end;decor.chains={}
    local sprites,labels=stations.decorate(decor)
    stats.decoration_sprites,stats.labels,stats.mesh_gameobjects=sprites,labels,#state.objects
    stats.build_ms=(socket.gettime()-started)*1000
    state.stats=stats
    publish()
    if html5 and sys.get_engine_info().is_debug then
        stats.generation,stats.station,stats.paths=self.session_generation,d.id,state.paths
        html5.run("window.riderTerrainMesh="..json.encode(stats))
    end
    return sprites,labels
end
function M.final(self,failed)
    local state=self.terrain_mesh
    if state then
        -- Drop our resource references; mesh components retain theirs until Defold destroys this world.
        if failed then for _,id in ipairs(state.objects) do go.delete(id) end end
        for _,id in ipairs(state.resources) do resource.release(id);released=released+1 end
        publish()
        self.terrain_mesh=nil
    end
end
return M
