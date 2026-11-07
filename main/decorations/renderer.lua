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
    if compiled then M.sync(s,compiled.items) end
    return s
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
    local r={objects=#s.items,visible=s.visible,items={}}
    for i,o in ipairs(s.items) do
        local p=go.get_position(o.id)
        r.items[i]={id=o.source_id,asset=o.asset,placement=o.placement,on=o.on,x=p.x,y=p.y,z=p.z,angle=o.t.angle,rotation_z=go.get(o.id,'euler.z')}
    end
    return r
end
return M
