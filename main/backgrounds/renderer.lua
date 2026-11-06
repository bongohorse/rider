-- One quad per visible layer, explicit image/buffer owners, no simulation or camera writes.
local model=require "main.backgrounds.model"
local M={};local next_owner=0
local function release(id) if id then resource.release(id) end end
local function unit_buffer(path)
    local b=buffer.create(6,{{name=hash("position"),type=buffer.VALUE_TYPE_FLOAT32,count=3},{name=hash("texcoord0"),type=buffer.VALUE_TYPE_FLOAT32,count=2}})
    local p,uv=buffer.get_stream(b,"position"),buffer.get_stream(b,"texcoord0")
    for n,c in ipairs({{-1,-1},{1,-1},{1,1},{-1,-1},{1,1},{-1,1}}) do
        p[(n-1)*3+1],p[(n-1)*3+2],p[(n-1)*3+3]=c[1],c[2],0
        uv[(n-1)*2+1],uv[(n-1)*2+2]=c[1],c[2]
    end
    buffer.set_metadata(b,hash("AABB"),{-1,-1,-0.01,1,1,0.01},buffer.VALUE_TYPE_FLOAT32)
    return resource.create_buffer(path,{buffer=b,transfer_ownership=true})
end
local function load_texture(path,id)
    local bytes=sys.load_resource(path)
    if not bytes then return nil,"Missing image" end
    local img=image.load_buffer(bytes,{premultiply_alpha=true,flip_vertically=true})
    if not img or img.type~=image.TYPE_RGBA then return nil,"Background images must be RGBA" end
    if img.width<1 or img.height<1 or img.width>2048 or img.height>1024 then return nil,"Background image exceeds 2048x1024" end
    local texture=resource.create_texture(id,{width=img.width,height=img.height,type=graphics.TEXTURE_TYPE_2D,format=graphics.TEXTURE_FORMAT_RGBA},img.buffer)
    return {resource=texture,width=img.width,height=img.height,path=path,bytes=img.width*img.height*4}
end
function M.new(scale)
    assert(type(scale)=="number" and scale>0)
    next_owner=next_owner+1
    return {owner=next_owner,serial=0,scale=scale,config=assert(model.normalize()),layers={},errors={},created=0,released=0,dirty=false}
end
local function path(s,kind)
    s.serial=s.serial+1
    return "/backgrounds/runtime/"..s.owner.."-"..s.serial..kind
end
local function remove(s,index)
    local l=s.layers[index]
    if not l then return end
    -- Disable now; deferred GO deletion owns the component's remaining resource references.
    msg.post(l.url,"disable");go.delete(l.object)
    release(l.texture.resource);s.layers[index]=nil;s.released=s.released+1
end
function M.set(s,config)
    local c,err=model.normalize(config)
    if not c then return false,err end
    s.config=c;s.errors={};s.dirty=true
    return true
end
function M.enabled(s,enabled)
    if type(enabled)~="boolean" then return false end
    s.config.enabled=enabled;s.dirty=true;return true
end
function M.visible(s,index,visible)
    if type(index)~="number" or index%1~=0 or index<1 or index>6 or type(visible)~="boolean" then return false end
    s.config.layers[index].visible=visible;s.errors[index]=nil;s.dirty=true;return true
end
local function create(s,index,l)
    local texture,err
    local selected=l.image and l.image~="" and l.image or l.preset_image
    local ok,result,why=pcall(load_texture,selected,path(s,".texturec"))
    if ok then texture,err=result,why else err=tostring(result) end
    if not texture and l.preset_image and l.preset_image~=selected then
        ok,result,why=pcall(load_texture,l.preset_image,path(s,".texturec"))
        if ok then texture,err=result,why else err=tostring(result) end
    end
    if not texture then s.errors[index]=err or "Image unavailable";return end
    if not s.buffer then s.buffer=unit_buffer(path(s,".bufferc")) end
    local id=factory.create(index==6 and "#foreground_mesh" or "#background_mesh")
    local url=msg.url(nil,id,"mesh")
    go.set(url,"vertices",s.buffer);go.set(url,"texture0",texture.resource)
    go.set(url,"image_size",vmath.vector4(texture.width,texture.height,0,0))
    s.layers[index]={object=id,url=url,texture=texture,requested=l.image,fallback=l.preset_image};s.created=s.created+1
end
function M.update(s,frame)
    if not s.dirty and next(s.layers)==nil then return end
    local count=0
    for i=1,6 do
        local config=s.config.layers[i];local l=s.layers[i]
        local active=model.active(s.config,i)
        if l and (not active or l.requested~=config.image or l.fallback~=config.preset_image) then remove(s,i);l=nil end
        if active and not l and not s.errors[i] then create(s,i,config);l=s.layers[i] end
        if l then
            count=count+1
            local rect=model.layout(frame,i)
            local uv=model.uv(frame,rect,config,i,l.texture.width,l.texture.height)
            local visible=rect.half_h>0
            if l.visible~=visible then msg.post(l.url,visible and "enable" or "disable");l.visible=visible end
            if visible then
                go.set_position(vmath.vector3(rect.x/s.scale,rect.y/s.scale,i==6 and 5 or -20+i),l.object)
                go.set_scale(vmath.vector3(rect.half_w/s.scale,rect.half_h/s.scale,1),l.object)
                go.set(l.url,"uv_transform",vmath.vector4(uv[1],uv[2],uv[3],uv[4]))
            end
            l.rect,l.uv=rect,uv
        end
    end
    s.dirty=false
    if count==0 and s.buffer then
        release(s.buffer);s.buffer=nil
        for _,f in ipairs({"#background_mesh","#foreground_mesh"}) do
            if factory.get_status(f)==factory.STATUS_LOADED then factory.unload(f) end
        end
    end
end
function M.report(s)
    local r={enabled=s.config.enabled,objects=0,textures=0,buffers=s.buffer and 1 or 0,texture_bytes=0,created=s.created,released=s.released,layers={},errors=s.errors}
    for i=1,6 do
        local l,c=s.layers[i],s.config.layers[i]
        r.layers[i]={visible=c.visible,auto=c.auto,depth=c.depth,effective_depth=model.depth(c,i),active=l~=nil}
        if l then
            r.objects=r.objects+1;r.textures=r.textures+1;r.texture_bytes=r.texture_bytes+l.texture.bytes
            r.layers[i].rect,r.layers[i].uv,r.layers[i].rendered=l.rect,l.uv,l.visible
        end
    end
    return r
end
function M.final(s)
    -- World teardown deletes its GOs; only release this owner's resource references.
    for i=1,6 do local l=s.layers[i];if l then release(l.texture.resource);s.layers[i]=nil end end
    release(s.buffer);s.buffer=nil
end
return M
