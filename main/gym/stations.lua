local data=require "main.gym.station_data"
local feel=require "main.gym.feel"
local M={ids={"straight"}}
if sys.get_config_string("rider.gym_test","")=="a15" and sys.get_engine_info().is_debug then
    M.ids={"straight","straight-test","invalid-test"}
end
function M.load(id,speed)
    local found=false
    for _,key in ipairs(M.ids) do if id==key then found=true end end
    local note=not found and "Unknown station; using Straight" or ""
    id=found and id or "straight"
    local ok,d=pcall(function() return json.decode(assert(sys.load_resource("/main/gym/stations/"..id..".json"))) end)
    local valid,err
    if ok then valid,err=data.validate(d) else err="Unreadable station file" end
    if not valid or d.id~=id then return nil,err or "Station id mismatch" end
    local message
    d.start_speed,message=data.speed(speed,d.start_speed)
    return d,message or note
end
function M.initial()
    local id=sys.get_config_string("rider.station","straight")
    local speed=sys.get_config_string("rider.start_speed","")
    if html5 then
        id=html5.run("new URLSearchParams(location.search).get('station') || 'straight'")
        speed=html5.run("new URLSearchParams(location.search).get('speed') || ''")
    end
    return M.load(id,speed)
end
function M.configure(d)
    local scale=sys.get_config_number("physics.scale",0.01)
    feel.values.spawn_x,feel.values.spawn_y=d.spawn[1]/scale,d.spawn[2]/scale
end
function M.build(body,d)
    local scale=sys.get_config_number("physics.scale",0.01)
    local origin=b2d.body.get_position(body)
    local function p(v) return vmath.vector3(v[1]/scale-origin.x,v[2]/scale-origin.y,0) end
    b2d.body.destroy_shape(body,1) -- remove the known resource seed before creating shapes
    local chains,segments={},{}
    for _,line in ipairs(d.chains) do
        local vertices={}
        for _,v in ipairs(line) do vertices[#vertices+1]=p(v) end
        local first,last=vertices[1],vertices[#vertices]
        local chain,shapes=b2d.body.create_chain(body,{vertices=vertices,
            prev_vertex=first+(first-vertices[2]),next_vertex=last+(last-vertices[#vertices-1]),
            friction=0.8,restitution=0,enable_sensor_events=true,filter={category_bits=1,mask_bits=1}})
        chains[#chains+1]=chain
        for _,s in ipairs(shapes) do segments[#segments+1]=s end
    end
    for _,h in ipairs(d.hulls or {}) do
        local vertices={};for _,v in ipairs(h.vertices) do vertices[#vertices+1]=p(v) end
        local shape=b2d.body.create_shape(body,{type=b2d.shape.SHAPE_TYPE_POLYGON,vertices=vertices,friction=0.8,restitution=0,
            filter={category_bits=1,mask_bits=1}})
        b2d.shape.enable_sensor_events(shape.shape_id,true)
    end
    return chains,segments
end
function M.start(v,d)
    local speed=d.start_speed/sys.get_config_number("physics.scale",0.01)
    b2d.body.set_linear_velocity(v.chassis,vmath.vector3(speed,0,0))
    for _,wheel in ipairs(v.wheels) do
        b2d.body.set_linear_velocity(wheel,vmath.vector3(speed,0,0))
        -- The authored wheel radius is 22 engine units (same geometry as wheel art).
        b2d.body.set_angular_velocity(wheel,-speed/22)
    end
end
function M.outside(d,s)
    local b=d.bounds;local scale=sys.get_config_number("physics.scale",0.01)
    return s.x*scale<b[1] or s.x*scale>b[2] or s.y*scale<b[3] or s.y*scale>b[4]
end
function M.decorate(d)
    local scale=sys.get_config_number("physics.scale",0.01)
    for x=-4096+128,8192-128,256 do factory.create("#checker",vmath.vector3(x,16,-1)) end
    if d.markers then
        for x=d.markers.from_m,d.markers.to_m,d.markers.major_m do
            local id=factory.create("#marker",vmath.vector3(x/scale,115,0))
            label.set_text(msg.url(nil,id,"label"),string.format("%g m",x))
        end
    end
end
function M.draw(d)
    local scale=sys.get_config_number("physics.scale",0.01)
    local color=vmath.vector4(0.3,0.9,0.7,1)
    local function line(a,b) msg.post("@render:","draw_line",{start_point=a,end_point=b,color=color}) end
    for _,chain in ipairs(d.chains) do
        for i=2,#chain do local a,b=chain[i-1],chain[i];line(vmath.vector3(a[1]/scale,a[2]/scale,0),vmath.vector3(b[1]/scale,b[2]/scale,0)) end
    end
    if d.markers then
        local m=d.markers
        for x=m.from_m,m.to_m,m.minor_m do
            local major=math.abs(x/m.major_m-math.floor(x/m.major_m+0.5))<0.001
            line(vmath.vector3(x/scale,80,0),vmath.vector3(x/scale,major and 105 or 90,0))
        end
    end
end
return M
