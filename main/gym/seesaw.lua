-- A19d seesaw: the first dynamic station obstacle. Per-session instance owned by the sole gym owner
-- (controller.script); Defold owns the plank game object, its body and the world.
-- Units: station data in metres, converted once here (/physics.scale) to engine units; angles in rad.
-- Lifecycle: spawn (factory, in setup) -> attach (next update: borrow body, create joint) -> reset
-- -> remove (placement failure) or proxy unload (Defold deletes object, body and joint; final drops
-- references). Joint create/destroy windows: the first attach and its canonical reset run in the
-- owner's update() (world unlocked, same window as vehicle.attach); every later reset (Retry, section,
-- bounds) runs in the owner's fixed_update reset window. Never in a contact callback.
-- The revolute joint is recreated on every reset: the old handle is destroyed and must be invalid,
-- the new one valid, the plank keeps exactly one joint, and the joint generation advances.
local data=require "main.gym.station_data"
local M={}
local function scale() return sys.get_config_number("physics.scale",0.01) end
local function pose(s)
    local k=scale()
    return vmath.vector3(s.spec.pivot[1]/k,s.spec.pivot[2]/k,0),s.spec.rest_angle
end
function M.spawn(spec)
    local s={spec=spec,generation=0}
    local p,angle=pose(s)
    s.id=factory.create("#seesaw",p,vmath.quat_rotation_z(angle))
    -- A failure after create must not orphan the plank object.
    local ok,err=pcall(go.set,msg.url(nil,s.id,"sprite"),"tint",vmath.vector4(0.95,0.6,0.3,1))
    if not ok then go.delete(s.id);error(err) end
    return s
end
local function joint(s)
    local k=scale()
    local origin=b2d.body.get_position(s.terrain)
    -- Anchors in engine units (the binding applies physics.scale once); angles unscaled (rad).
    -- collide_connected: the terrain body holds every deck chain, which the plank must rest on.
    s.joint=b2d.joint.create_revolute(s.terrain,s.body,{
        local_anchor_a=vmath.vector3(s.spec.pivot[1]/k-origin.x,s.spec.pivot[2]/k-origin.y,0),local_anchor_b=vmath.vector3(),
        reference_angle=0,enable_limit=true,lower_angle=-s.spec.limit,upper_angle=s.spec.limit,
        enable_motor=false,enable_spring=false,collide_connected=true})
    assert(b2d.joint.is_valid(s.joint),"Seesaw joint unavailable")
    assert(#b2d.body.get_joints(s.body)==1,"Seesaw joint leak")
    s.generation=s.generation+1
end
function M.attach(s,terrain)
    -- seesaw.convexshape is authored in engine units for the gym scale (100 units = 1 m).
    assert(math.abs(scale()-0.01)<1e-6,"Seesaw resource requires physics.scale 0.01") -- float32 config value
    s.terrain=terrain
    s.body=b2d.get_body(msg.url(nil,s.id,"body"))
    assert(b2d.body.is_valid(s.body),"Seesaw body unavailable")
    -- The plank is station geometry: the resource must build exactly the declared plank.
    local plank=data.SEESAW_PLANK
    assert(math.abs(b2d.body.get_mass(s.body)-plank.mass)<0.01,"Seesaw mass differs from station data")
    s.mass=b2d.body.get_mass(s.body)
    joint(s)
    s.ready=true
end
-- Canonical pose and velocity; the joint is recreated. Returns diagnostics for the report.
function M.reset(s)
    assert(b2d.body.is_valid(s.body),"Seesaw body invalid before reset")
    local old=s.joint
    assert(b2d.joint.is_valid(old),"Seesaw joint invalid before reset")
    -- Pose and motion this reset replaced (report only).
    local before_angle,before_omega,before_awake=b2d.body.get_angle(s.body),b2d.body.get_angular_velocity(s.body),b2d.body.is_awake(s.body)
    b2d.joint.destroy(old)
    local stale=b2d.joint.is_valid(old)
    assert(not stale,"Replaced seesaw joint still valid")
    s.joint=nil
    local p,angle=pose(s)
    -- Pinned Box2D 3.1 builds the rotation with an approximate cos/sin (b2MakeRot), so the read-back
    -- angle differs by about 0.002 rad: the pose check allows 0.005 rad.
    -- Drop cached contacts before teleporting; synchronize the owning GO too (engine pitfall #1).
    local at
    -- Even if a pose check fails, the plank is reactivated and gets its joint back before the error
    -- propagates, so no session is left with a jointless plank or a dangling handle.
    local ok,err=pcall(function()
        b2d.body.set_active(s.body,false)
        local visual=go.get_position(s.id)
        go.set_position(vmath.vector3(p.x,p.y,visual.z),s.id)
        go.set_rotation(vmath.quat_rotation_z(angle),s.id)
        b2d.body.set_transform(s.body,p,angle)
        b2d.body.set_linear_velocity(s.body,vmath.vector3())
        b2d.body.set_angular_velocity(s.body,0)
        b2d.body.set_active(s.body,true)
        -- Canonical sleep timer (#217): Box2D 3.1 keeps body->sleepTime through Disable/Enable, SetTransform,
        -- velocity setters and SetAwake(true) on an awake body. A plank that was awake but slow ("sleepy") at R
        -- kept its part-used timer and fell asleep within 1-2 ticks of its slow push-out. Sleeping the fresh
        -- single-body island (no joint or contacts yet, so b2TrySleepIsland always succeeds) and waking it
        -- again resets the timer (b2WakeSolverSet: sleepTime 0, identity velocity).
        b2d.body.set_awake(s.body,false)
        b2d.body.set_awake(s.body,true)
        assert(b2d.body.is_awake(s.body),"Seesaw plank not awake after reset")
        at=b2d.body.get_position(s.body)
        if not (math.abs(at.x-p.x)<0.01 and math.abs(at.y-p.y)<0.01 and math.abs(b2d.body.get_angle(s.body)-angle)<0.005) then
            error(string.format("Noncanonical seesaw pose (%.4f, %.4f, %.5f)",at.x,at.y,b2d.body.get_angle(s.body)))
        end
        assert(vmath.length(b2d.body.get_linear_velocity(s.body))<0.001 and math.abs(b2d.body.get_angular_velocity(s.body))<0.001,"Seesaw velocity survived reset")
    end)
    if not ok then
        if b2d.body.is_valid(s.body) then b2d.body.set_active(s.body,true);joint(s) end
        error(err)
    end
    joint(s)
    s.last_reset={before_angle=before_angle,before_omega=before_omega,before_awake=before_awake,old_joint_valid=stale,joint_valid=b2d.joint.is_valid(s.joint),joints=#b2d.body.get_joints(s.body),
        generation=s.generation,angle=b2d.body.get_angle(s.body),omega=b2d.body.get_angular_velocity(s.body),
        x=at.x*scale(),y=at.y*scale(),speed=vmath.length(b2d.body.get_linear_velocity(s.body))*scale()}
    return s.last_reset
end
-- Read-only state: angle (rad, CCW positive) and angular velocity (rad/s); position in metres.
function M.state(s)
    local p=b2d.body.get_position(s.body)
    return {angle=b2d.body.get_angle(s.body),omega=b2d.body.get_angular_velocity(s.body),x=p.x*scale(),y=p.y*scale(),
        joint_angle=b2d.joint.get_joint_angle(s.joint),awake=b2d.body.is_awake(s.body)}
end
-- Placement failure: the joint goes with the plank's game object.
function M.remove(s)
    go.delete(s.id)
end
return M
