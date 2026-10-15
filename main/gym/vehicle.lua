-- Per-session vehicle. Positions/anchors: engine units; angular speed: rad/s.
-- Motor torque uses the pinned binding's scaled input convention (not body torque).
local M = {}
M.config = {spawn_x = 0, spawn_y = 170, wheel_x = {-46,46}, wheel_y = -30,
    spring_hz = 5, damping = 0.8, motor_speed = -16,
    drive_torque = 1800, brake_torque = 3000}
function M.spawn()
    local c = M.config
    local v = {ids = {}, wheels = {}, joints = {}}
    v.ids.chassis = factory.create("#chassis", vmath.vector3(c.spawn_x, c.spawn_y, 0))
    for i,x in ipairs(c.wheel_x) do
        v.ids[i] = factory.create("#wheel", vmath.vector3(c.spawn_x+x, c.spawn_y+c.wheel_y, 1))
    end
    return v
end
local function body(id) return b2d.get_body(msg.url(nil,id,"body")) end
function M.attach(v)
    v.chassis = body(v.ids.chassis)
    assert(b2d.body.is_valid(v.chassis), "Chassis body unavailable")
    for i,x in ipairs(M.config.wheel_x) do
        v.wheels[i] = body(v.ids[i])
        assert(b2d.body.is_valid(v.wheels[i]), "Wheel body unavailable")
        v.joints[i] = b2d.joint.create_wheel(v.chassis,v.wheels[i],{
            local_anchor_a = vmath.vector3(x,M.config.wheel_y,0), local_anchor_b = vmath.vector3(),
            local_axis_a = vmath.vector3(0,1,0), enable_spring = true,
            hertz = M.config.spring_hz, damping_ratio = M.config.damping,
            enable_motor = false, motor_speed = 0, max_motor_torque = 0,
            collide_connected = false
        })
        assert(b2d.joint.is_valid(v.joints[i]), "Wheel joint unavailable")
    end
    v.ready = true
end
function M.apply(v,command)
    local brake = command.brake_reverse > 0
    local drive = command.throttle > 0 and not brake
    for _,joint in ipairs(v.joints) do
        b2d.joint.enable_motor(joint,brake or drive)
        b2d.joint.set_motor_speed(joint,drive and M.config.motor_speed*command.throttle or 0)
        b2d.joint.set_max_motor_torque(joint,brake and M.config.brake_torque or drive and M.config.drive_torque or 0)
    end
end
function M.state(v)
    local p = b2d.body.get_position(v.chassis)
    return {x=p.x,y=p.y,vx=b2d.body.get_linear_velocity(v.chassis).x,angle=b2d.body.get_angle(v.chassis)}
end
return M
