-- Sprite-only decorations: no collision object, no physics or camera writes. Objects belong to the world.
local layout=require 'main.decorations.layout'
local M={}
local ENABLE,DISABLE=hash('enable'),hash('disable')
function M.build(compiled)
    local s={items={},visible=0}
    if not compiled then return s end
    local scale=sys.get_config_number('physics.scale',.01)
    for i,item in ipairs(compiled.items) do
        local t=layout.transform(item,scale)
        local id=factory.create('#decoration',vmath.vector3(t.x,t.y,t.z),vmath.quat_rotation_z(t.angle),nil,vmath.vector3(t.scale,t.scale,1))
        local url=msg.url(nil,id,'sprite')
        sprite.play_flipbook(url,hash(item.asset))
        if item.placement=='body' then local c=layout.BODY_TINT;go.set(url,'tint',vmath.vector4(c[1],c[2],c[3],c[4])) end
        s.items[i]={id=id,url=url,t=t,on=true,asset=item.asset,placement=item.placement}
    end
    s.visible=#s.items
    return s
end
-- Sprites outside the view are disabled; a message is sent only on a change.
function M.update(s,camera_x,half_width)
    local left,right=camera_x-half_width,camera_x+half_width
    for _,o in ipairs(s.items) do
        local on=layout.visible(o.t,left,right)
        if on~=o.on then o.on=on;s.visible=s.visible+(on and 1 or -1);msg.post(o.url,on and ENABLE or DISABLE) end
    end
end
-- Read-only debug report of the engine's actual transforms.
function M.report(s)
    local r={objects=#s.items,visible=s.visible,items={}}
    for i,o in ipairs(s.items) do
        local p=go.get_position(o.id)
        r.items[i]={asset=o.asset,placement=o.placement,on=o.on,x=p.x,y=p.y,z=p.z,angle=o.t.angle,rotation_z=go.get(o.id,'euler.z')}
    end
    return r
end
return M
