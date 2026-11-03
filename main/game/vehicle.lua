-- Per-session vehicle. Positions/anchors: engine units; angular speed: rad/s.
-- Motor torque uses the pinned binding's scaled input convention (not body torque).
local M = {}
local rider = require "main.gym.rider"
local feel = require "main.gym.feel"
M.config = feel.values
function M.spawn()
    local c = M.config
    local v = {ids = {}, wheels = {}, joints = {}}
    v.ids.chassis = factory.create("#chassis", vmath.vector3(c.spawn_x, c.spawn_y, 0))
    rider.spawn(v)
    for i,x in ipairs(c.wheel_x) do
        v.ids[i] = factory.create("#wheel", vmath.vector3(c.spawn_x+x, c.spawn_y+c.wheel_y, 1))
    end
    return v
end
-- Removes a vehicle that could not be placed; its bodies and joints go with the game objects.
function M.remove(v)
    go.delete(v.ids.chassis,true)
    for i=1,2 do go.delete(v.ids[i]) end
end
local function body(id) return b2d.get_body(msg.url(nil,id,"body")) end
local function joints(v)
    for i,x in ipairs(M.config.wheel_x) do
        v.joints[i] = b2d.joint.create_wheel(v.chassis,v.wheels[i],{
            local_anchor_a = vmath.vector3(x,M.config.wheel_y,0), local_anchor_b = vmath.vector3(),
            local_axis_a = vmath.vector3(0,1,0), enable_spring = true,
            hertz = M.config.spring_hz, damping_ratio = M.config.damping,
            enable_motor = false, motor_speed = 0, max_motor_torque = 0,
            collide_connected = false
        })
        assert(b2d.joint.is_valid(v.joints[i]), "Wheel joint unavailable")
    end
end
function M.attach(v)
    v.chassis = body(v.ids.chassis)
    assert(b2d.body.is_valid(v.chassis), "Chassis body unavailable")
    for i=1,2 do
        v.wheels[i] = body(v.ids[i])
        assert(b2d.body.is_valid(v.wheels[i]), "Wheel body unavailable")
    end
    joints(v)
    rider.attach(v)
    v.ready = true
end
function M.reset(v)
    assert(b2d.shape.is_valid(v.head),"Head sensor lost before reset")
    for _,joint in ipairs(v.joints) do
        assert(b2d.joint.is_valid(joint), "Invalid joint before reset")
        b2d.joint.destroy(joint)
        assert(not b2d.joint.is_valid(joint), "Replaced joint still valid")
    end
    v.joints = {}
    local c = M.config
    local bodies = {v.chassis,v.wheels[1],v.wheels[2]}
    -- Drop cached contacts before teleporting retained bodies. Bodies/shapes stay valid.
    for _,b in ipairs(bodies) do b2d.body.set_active(b,false) end
    for i,b in ipairs(bodies) do
        assert(b2d.body.is_valid(b), "Retained body invalid")
        local x = c.spawn_x + (i>1 and c.wheel_x[i-1] or 0)
        local y = c.spawn_y + (i>1 and c.wheel_y or 0)
        -- Dynamic transforms default on in this engine: synchronize the owning
        -- GO as well, otherwise the next step copies the old GO pose back.
        local id=i==1 and v.ids.chassis or v.ids[i-1]
        local visual=go.get_position(id)
        go.set_position(vmath.vector3(x,y,visual.z),id)
        go.set_rotation(vmath.quat(),id)
        b2d.body.set_transform(b,vmath.vector3(x,y,0),0)
        b2d.body.set_linear_velocity(b,vmath.vector3())
        b2d.body.set_angular_velocity(b,0)
        b2d.body.set_awake(b,true)
        local p,vel = b2d.body.get_position(b),b2d.body.get_linear_velocity(b)
        if not (math.abs(p.x-x)<0.01 and math.abs(p.y-y)<0.01 and math.abs(b2d.body.get_angle(b))<0.001) then
            error(string.format("Noncanonical reset pose (body %d at %.4f, %.4f, expected %.4f, %.4f, angle %.5f)",i,p.x,p.y,x,y,b2d.body.get_angle(b)))
        end
        assert(vmath.length(vel)<0.001 and math.abs(b2d.body.get_angular_velocity(b))<0.001, "Reset velocity survived")
    end
    for _,b in ipairs(bodies) do b2d.body.set_active(b,true);b2d.body.set_awake(b,true) end
    assert(b2d.shape.is_valid(v.head) and #b2d.body.get_shapes(v.chassis)==2,"Retry changed sensor ownership")
    v.reverse_time,v.reversing,v.coasting=0,false,false
    v.reset_tick,v.damped,v.damped_ticks=true,false,0
    joints(v)
    assert(#b2d.body.get_joints(v.chassis)==2, "Joint leak after reset")
    rider.rest(v)
end
function M.apply(v,command,dt)
    local c=M.config
    if v.applied_hz~=c.spring_hz or v.applied_damping~=c.damping then
        for _,joint in ipairs(v.joints) do
            b2d.joint.set_spring_hertz(joint,c.spring_hz)
            b2d.joint.set_spring_damping_ratio(joint,c.damping)
            b2d.joint.wake_bodies(joint)
        end
        v.applied_hz,v.applied_damping=c.spring_hz,c.damping
    end
    local brake = command.brake_reverse > 0
    local drive = command.throttle > 0 and not brake and not command.fuel_empty
    local speed=b2d.body.get_linear_velocity(v.chassis).x
    if brake and command.allow_reverse and not command.fuel_empty then
        if not v.reversing and math.abs(speed)<c.reverse_threshold then
            v.reverse_time=(v.reverse_time or 0)+dt
            v.reversing=v.reverse_time>=c.reverse_delay
        end
    else v.reverse_time,v.reversing=0,false end
    local reverse=brake and command.allow_reverse and v.reversing and not command.fuel_empty
    v.powered_input=drive and command.throttle or reverse and command.brake_reverse or 0
    local grounded=false
    for _,wheel in ipairs(v.wheels) do
        if #b2d.body.get_contact_data(wheel)>0 then grounded=true end
    end
    -- A18 diagnostic only: open drivetrain, no motor/coast/rolling moments.
    -- This changes experimental actuator conditions, never preset coefficients.
    local freewheel=command.measurement_freewheel==true
    assert(not freewheel or (sys.get_engine_info().is_debug and sys.get_config_string("rider.gym_test","")=="a18"),"Freewheel is debug A18 only")
    local coasting=not brake and not drive and grounded and not freewheel
    local motor_speed=drive and c.motor_speed*command.throttle or reverse and c.reverse_speed*command.brake_reverse or 0
    for _,joint in ipairs(v.joints) do
        if brake or drive or (coasting and not v.coasting) then b2d.joint.wake_bodies(joint) end
        b2d.joint.enable_motor(joint,brake or drive or coasting)
        b2d.joint.set_motor_speed(joint,motor_speed)
        b2d.joint.set_max_motor_torque(joint,feel.motor_torque(brake and not reverse and c.brake_torque or (drive or reverse) and c.drive_torque or coasting and c.coast_torque or 0))
    end
    v.coasting=coasting
    if coasting then
        for _,wheel in ipairs(v.wheels) do
            local omega=b2d.body.get_angular_velocity(wheel)
            -- Raw body torque (N m), distinct from the scaled joint cap.
            -- No repeated waking at rest (airborne chassis damping is the separate #211 term below).
            if b2d.body.is_awake(wheel) and math.abs(omega)>0.01 then
                b2d.body.apply_torque(wheel,-omega*c.rolling_resistance)
            end
        end
    end
    -- #211: optional pitch damping in flight only: no wheel and no chassis contact (a roof or underbody
    -- touching the ground is not flight), lean exactly 0, k > 0. omega is rad/s and body torque raw N m
    -- (neither scaled), so k is N m s; preset key absent = 0 = no torque at all.
    -- Never on the reset tick: reset drops the cached contacts, so that tick reads as airborne.
    -- The binding's apply_torque wakes the body, so like rolling resistance it skips a sleeping chassis and
    -- |omega| <= 0.01 rad/s (no torque that would keep a resting vehicle awake).
    -- v.damped (this tick) and v.damped_ticks (since the last reset) are read-only diagnostics.
    local omega=b2d.body.get_angular_velocity(v.chassis)
    v.damped=command.lean==0 and not grounded and c.air_pitch_damping>0 and not v.reset_tick
        and #b2d.body.get_contact_data(v.chassis)==0 and b2d.body.is_awake(v.chassis) and math.abs(omega)>0.01
    v.reset_tick=nil
    if v.damped then
        b2d.body.apply_torque(v.chassis,feel.body_torque(-c.air_pitch_damping*omega))
        v.damped_ticks=(v.damped_ticks or 0)+1
    end
    if command.lean~=0 then
        local airborne=true
        for _,wheel in ipairs(v.wheels) do if #b2d.body.get_contact_data(wheel)>0 then airborne=false end end
        local omega=b2d.body.get_angular_velocity(v.chassis)
        local torque=airborne and c.lean_torque or c.ground_lean_torque
        local rate=airborne and c.lean_rate_max or c.ground_rate_max
        -- Soft threshold: stop adding spin, but always allow counter-steering.
        -- Ground assistance pitches the chassis; it does not move the centre of mass.
        if torque>0 and (math.abs(omega)<rate or omega*command.lean<0) then
            b2d.body.apply_torque(v.chassis,feel.body_torque(command.lean*torque))
        end
    end
end
-- A wheel or the chassis touches something (follow camera: a buggy on its roof also stands somewhere).
function M.touching(v)
    if #b2d.body.get_contact_data(v.chassis)>0 then return true end
    for _,wheel in ipairs(v.wheels) do if #b2d.body.get_contact_data(wheel)>0 then return true end end
    return false
end
function M.state(v)
    local p = b2d.body.get_position(v.chassis)
    return {x=p.x,y=p.y,vx=b2d.body.get_linear_velocity(v.chassis).x,angle=b2d.body.get_angle(v.chassis)}
end
return M
