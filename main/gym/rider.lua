-- Decorative rider + a zero-density sensor on the retained chassis body.
local M = {}
M.center_y,M.radius=56,12
function M.attach(v)
    local mass=b2d.body.get_mass(v.chassis)
    local shape=b2d.body.create_shape(v.chassis,{type=b2d.shape.SHAPE_TYPE_CIRCLE,
        center=vmath.vector3(0,M.center_y,0),radius=M.radius,sensor=true,density=0,
        filter={category_bits=1,mask_bits=1,group_index=0}})
    v.head=shape.shape_id
    b2d.shape.enable_sensor_events(v.head,true)
    assert(b2d.shape.is_valid(v.head) and b2d.shape.is_sensor(v.head),"Head sensor unavailable")
    assert(math.abs(b2d.body.get_mass(v.chassis)-mass)<0.01,"Head sensor changed vehicle mass")
end
function M.contact(v)
    assert(b2d.shape.is_valid(v.head),"Stale head sensor")
    for _,shape in ipairs(b2d.shape.get_sensor_overlaps(v.head)) do
        local body=b2d.shape.get_body(shape.shape_id)
        if body~=v.chassis and body~=v.wheels[1] and body~=v.wheels[2] then return true end
    end
    return false
end
function M.paint(v,contact)
    go.set(msg.url(nil,v.ids.chassis,"rider"),"tint",
        contact and vmath.vector4(1,0.25,0.25,1) or vmath.vector4(1,1,1,1))
end
return M
