-- P1-only render adapter: resource ownership belongs to the proxied world instance.
local geometry=require "main.terrain_compare.geometry"
local entry=require "main.terrain_compare.entry"
local stations=require "main.gym.stations"
local socket=require "socket"
local M={}
function M.build(self,d)
    local o=entry.options();local started=socket.gettime()
    local state={resources={},objects={},options=o};self.terrain_compare=state
    local sprites,labels
    local stats={chunks=0,vertices=0,triangles=0,buffer_bytes=0,intervals=o.intervals}
    if o.variant=="sprites" then sprites,labels=stations.decorate(d)
    else
        local chunks;chunks,stats=geometry.build(d,o.variant,o.intervals)
        local scale=sys.get_config_number("physics.scale",0.01)
        for i,c in ipairs(chunks) do
            local b=buffer.create(c.vertices,{{name=hash("position"),type=buffer.VALUE_TYPE_FLOAT32,count=3},{name=hash("color"),type=buffer.VALUE_TYPE_FLOAT32,count=4},{name=hash("texcoord0"),type=buffer.VALUE_TYPE_FLOAT32,count=2}})
            local p,col,uv=buffer.get_stream(b,"position"),buffer.get_stream(b,"color"),buffer.get_stream(b,"texcoord0")
            -- Convert metres once at this visual boundary, just as stations.build does for collision.
            for j,v in ipairs(c.position) do p[j]=v/scale end
            for j,v in ipairs(c.color) do col[j]=v end
            for j,v in ipairs(c.uv) do uv[j]=v end
            local aabb={};for j,v in ipairs(c.bounds) do aabb[j]=v/scale end
            -- Bounds describe the projected XY used by the shader, with a tiny float32 margin.
            aabb[1],aabb[2],aabb[3]=aabb[1]-0.5,aabb[2]-0.5,-1
            aabb[4],aabb[5],aabb[6]=aabb[4]+0.5,aabb[5]+0.5,1
            buffer.set_metadata(b,hash("AABB"),aabb,buffer.VALUE_TYPE_FLOAT32)
            local resource_id=resource.create_buffer("/terrain_compare/g"..self.session_generation.."-"..i..".bufferc",{buffer=b,transfer_ownership=true})
            state.resources[#state.resources+1]=resource_id
            local id=factory.create("#terrain_mesh",vmath.vector3(c.origin[1]/scale,c.origin[2]/scale,-2))
            state.objects[#state.objects+1]=id
            go.set(msg.url(nil,id,"mesh"),"vertices",resource_id)
        end
        -- Only the decoration copy omits terrain strokes; the physical station stays untouched.
        local decor={};for k,v in pairs(d) do decor[k]=v end;decor.chains={}
        sprites,labels=stations.decorate(decor)
    end
    stats.variant,stats.course,stats.view=o.variant,o.course,o.view
    stats.decoration_sprites,stats.labels,stats.mesh_gameobjects=sprites,labels,#state.objects
    stats.build_ms=(socket.gettime()-started)*1000
    state.stats=stats
    if html5 then html5.run("window.riderTerrainCompare="..json.encode(stats)) end
    return sprites,labels
end
function M.final(self)
    local state=self.terrain_compare
    if state then
        -- Drop our resource references; mesh components retain theirs until Defold destroys this world.
        for _,id in ipairs(state.resources) do resource.release(id) end
        self.terrain_compare=nil
    end
end
return M
