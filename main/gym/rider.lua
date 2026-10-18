-- Decorative rider + a zero-density sensor on the retained chassis body.
-- The rider sprite lives on its own child GO so it can lean/bob visually;
-- the head sensor stays on the chassis body and is never moved by the visual.
local feel = require "main.gym.feel"
local M = {}
M.center_y,M.radius=56,12
-- Hip pivot in chassis space; the sprite sits 16 units above it (rest = old pose).
M.base=vmath.vector3(0,20,2)
function M.spawn(v)
    v.ids.rider=factory.create("#rider",M.base)
    go.set_parent(v.ids.rider,v.ids.chassis,false)
end
function M.attach(v)
    local mass=b2d.body.get_mass(v.chassis)
    local shape=b2d.body.create_shape(v.chassis,{type=b2d.shape.SHAPE_TYPE_CIRCLE,
        center=vmath.vector3(0,M.center_y,0),radius=M.radius,sensor=true,density=0,
        filter={category_bits=1,mask_bits=1,group_index=0}})
    v.head=shape.shape_id
    b2d.shape.enable_sensor_events(v.head,true)
    assert(b2d.shape.is_valid(v.head) and b2d.shape.is_sensor(v.head),"Head sensor unavailable")
    assert(math.abs(b2d.body.get_mass(v.chassis)-mass)<0.01,"Head sensor changed vehicle mass")
    M.rest(v)
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
    go.set(msg.url(nil,v.ids.rider,"sprite"),"tint",
        contact and vmath.vector4(1,0.25,0.25,1) or vmath.vector4(1,1,1,1))
end
-- Visual state at rest. Teleports (Retry, speed start) must not read as a kick.
function M.rest(v)
    v.reaction={x=0,y=0,angle=0,vx=0,vy=0,vangle=0,dvx=0,dvy=0,dspin=0,lean=0}
    v.reaction_previous=nil
end
-- Fixed owner, after commands: read-only sampling of chassis velocity changes
-- in chassis space (m/s, rad/s), accumulated until the next rendered frame.
function M.sample(v,command)
    local r=v.reaction
    local velocity=b2d.body.get_linear_velocity(v.chassis)
    local now={x=feel.metres(velocity.x),y=feel.metres(velocity.y),spin=b2d.body.get_angular_velocity(v.chassis)}
    local p=v.reaction_previous
    if p then
        local a=b2d.body.get_angle(v.chassis)
        local dx,dy=now.x-p.x,now.y-p.y
        local c,s=math.cos(a),math.sin(a)
        r.dvx=r.dvx+dx*c+dy*s
        r.dvy=r.dvy-dx*s+dy*c
        r.dspin=r.dspin+now.spin-p.spin
    end
    v.reaction_previous=now
    local airborne=true
    for _,wheel in ipairs(v.wheels) do if #b2d.body.get_contact_data(wheel)>0 then airborne=false end end
    r.lean=airborne and (command.lean or 0) or 0
end
-- Semi-implicit spring step for one axis; the pose never leaves [-limit, limit].
local function axis(r,key,velocity,target,limit,omega,zeta,h)
    local speed=r[velocity]+(-omega*omega*(r[key]-target)-2*zeta*omega*r[velocity])*h
    local value=r[key]+speed*h
    if value>limit then value,speed=limit,math.min(speed,0)
    elseif value<-limit then value,speed=-limit,math.max(speed,0) end
    r[key],r[velocity]=value,speed
end
-- Render frame: inertial kicks, then a damped spring back to rest.
function M.animate(v,dt)
    local r,c=v.reaction,feel.rider
    -- Forward acceleration leans the rider back (+angle) and shifts it rearward.
    r.vx=r.vx-c.gain_x*r.dvx
    r.vy=r.vy-c.gain_y*r.dvy
    r.vangle=r.vangle+c.gain_angle*r.dvx-c.gain_spin*r.dspin
    r.dvx,r.dvy,r.dspin=0,0,0
    local omega=2*math.pi*c.hz
    local steps=math.max(1,math.ceil(dt*240))
    for _=1,steps do
        local h=dt/steps
        axis(r,"x","vx",0,c.max_x,omega,c.damping,h)
        axis(r,"y","vy",0,c.max_y,omega,c.damping,h)
        axis(r,"angle","vangle",r.lean*c.air_lean_angle,c.max_angle,omega,c.damping,h)
    end
    go.set_position(M.base+vmath.vector3(r.x,r.y,0),v.ids.rider)
    go.set_rotation(vmath.quat_rotation_z(r.angle),v.ids.rider)
end
return M
