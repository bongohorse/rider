-- Sprite-only decorations: no collision object, no physics or camera writes. Objects belong to the world.
local layout=require 'main.decorations.layout'
local M={}
local ENABLE,DISABLE=hash('enable'),hash('disable')
local function tint_for(item,selected)
    if item.hidden then return .35,.35,.35,.35 end
    if selected then return 1,.82,.45,1 end
    if item.placement=='body' then local c=layout.BODY_TINT;return c[1],c[2],c[3],c[4] end
    return 1,1,1,1
end
-- Writes one item onto an existing object; only what differs reaches the engine.
local function apply(o,item,scale,selected)
    local t=layout.transform(item,scale)
    local p=vmath.vector3(t.x,t.y,t.z)
    if not o.t or o.t.x~=t.x or o.t.y~=t.y or o.t.z~=t.z then go.set_position(p,o.id) end
    if not o.t or o.t.angle~=t.angle then go.set_rotation(vmath.quat_rotation_z(t.angle),o.id) end
    if not o.t or o.t.scale~=t.scale then go.set_scale(vmath.vector3(t.scale,t.scale,1),o.id) end
    if o.asset~=item.asset then sprite.play_flipbook(o.url,hash(item.asset)) end
    local r,g,b,a=tint_for(item,selected)
    local key=r..':'..g..':'..b..':'..a
    if o.tint~=key then go.set(o.url,'tint',vmath.vector4(r,g,b,a));o.tint=key end
    o.t,o.asset,o.placement,o.source_id=t,item.asset,item.placement,item.id
end
local function create(scale)
    local id=factory.create('#decoration',vmath.vector3(),nil,nil,vmath.vector3(1/scale/layout.PPM,1/scale/layout.PPM,1))
    return {id=id,url=msg.url(nil,id,'sprite'),on=true,tint='1:1:1:1'}
end
-- Makes the objects match the list in place. Objects are reused, never doubled, because go.delete is deferred
-- and a rebuild would hold both copies against the sprite pool. An Edit drag moves only its object.
function M.sync(s,items,selected)
    local scale=sys.get_config_number('physics.scale',.01)
    for i,item in ipairs(items) do
        s.items[i]=s.items[i] or create(scale)
        apply(s.items[i],item,scale,item.id~=nil and item.id==selected)
    end
    for i=#s.items,#items+1,-1 do
        local o=table.remove(s.items,i)
        if o.on then s.visible=s.visible-1 end
        go.delete(o.id)
    end
    local visible=0
    for _,o in ipairs(s.items) do if o.on then visible=visible+1 end end
    s.visible=visible
end
function M.build(compiled)
    local s={items={},visible=0}
    if compiled then M.sync(s,compiled.items);M.sync_fences(s,compiled.fences) end
    return s
end
-- Fences: one mesh object per fence, its buffer replaced in place when the fence changes.
local fence=require 'main.decorations.fence'
local serial=0
local function fence_buffer(points)
    local scale=sys.get_config_number('physics.scale',.01)
    local verts=fence.strip(points)
    local b=buffer.create(#verts,{{name=hash('position'),type=buffer.VALUE_TYPE_FLOAT32,count=3},{name=hash('texcoord0'),type=buffer.VALUE_TYPE_FLOAT32,count=2}})
    local pos,uv=buffer.get_stream(b,'position'),buffer.get_stream(b,'texcoord0')
    local x0,x1,y0,y1=math.huge,-math.huge,math.huge,-math.huge
    for i,v in ipairs(verts) do
        local x,y=v[1]/scale,v[2]/scale
        pos[(i-1)*3+1],pos[(i-1)*3+2],pos[(i-1)*3+3]=x,y,0
        uv[(i-1)*2+1],uv[(i-1)*2+2]=v[3],v[4]
        x0,x1,y0,y1=math.min(x0,x),math.max(x1,x),math.min(y0,y),math.max(y1,y)
    end
    buffer.set_metadata(b,hash('AABB'),{x0,y0,-1,x1,y1,1},buffer.VALUE_TYPE_FLOAT32)
    return b
end
function M.sync_fences(s,list,selected)
    s.fences=s.fences or {}
    for i,f in ipairs(list or {}) do
        local o=s.fences[i]
        local z=layout.Z[f.placement]
        local key=json.encode(f.points)
        if not o then
            serial=serial+1
            local res=resource.create_buffer('/decorations/fence-'..serial..'.bufferc',{buffer=fence_buffer(f.points),transfer_ownership=true})
            local id=factory.create('#fence',vmath.vector3(0,0,z))
            local url=msg.url(nil,id,'mesh')
            go.set(url,'vertices',res)
            o={id=id,url=url,res=res,key=key};s.fences[i]=o
        elseif o.key~=key then
            resource.set_buffer(o.res,fence_buffer(f.points),{transfer_ownership=true});o.key=key
        end
        go.set_position(vmath.vector3(0,0,z),o.id)
        local r,g,b,a=tint_for({hidden=f.hidden,placement=f.placement},f.id~=nil and f.id==selected)
        go.set(o.url,'tint',vmath.vector4(r,g,b,a))
        o.placement,o.source_id,o.points=f.placement,f.id,#f.points
    end
    for i=#s.fences,#(list or {})+1,-1 do
        local o=table.remove(s.fences,i)
        go.delete(o.id);resource.release(o.res)
    end
end
function M.final(s)
    for _,o in ipairs(s and s.fences or {}) do resource.release(o.res) end
end
-- Sprites outside the view are disabled; a message is sent only on a change.
-- The projection is one frame old (engine pitfall 11), so the view gets a margin against popping during a zoom.
function M.update(s,camera_x,camera_y,half_width,half_height)
    local w,h=half_width*1.25,half_height*1.25
    local left,right,bottom,top=camera_x-w,camera_x+w,camera_y-h,camera_y+h
    for _,o in ipairs(s.items) do
        local on=layout.visible(o.t,left,right,bottom,top)
        if on~=o.on then o.on=on;s.visible=s.visible+(on and 1 or -1);msg.post(o.url,on and ENABLE or DISABLE) end
    end
end
-- Read-only debug report of the engine's actual transforms.
function M.report(s)
    local r={objects=#s.items,visible=s.visible,items={},fences={}}
    for i,o in ipairs(s.fences or {}) do r.fences[i]={id=o.source_id,placement=o.placement,points=o.points,z=go.get_position(o.id).z} end
    for i,o in ipairs(s.items) do
        local p=go.get_position(o.id)
        r.items[i]={id=o.source_id,asset=o.asset,placement=o.placement,on=o.on,x=p.x,y=p.y,z=p.z,angle=o.t.angle,rotation_z=go.get(o.id,'euler.z')}
    end
    return r
end
return M
