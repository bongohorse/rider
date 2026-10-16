-- Read-only observer. Values describe the most recent completed engine step.
local vehicle = require "main.gym.vehicle"
local M = {}
M.budget = json.decode(sys.load_resource("/main/gym/budget.json"))
function M.new() return {elapsed=0,frames=0} end
function M.over(value,limit,minimum)
    if not limit then return false end
    return minimum and value<limit or not minimum and value>limit
end
function M.sample(v)
    local state = vehicle.state(v)
    local sample = {speed=vmath.length(b2d.body.get_linear_velocity(v.chassis)),velocity_x=state.vx}
    for i,wheel in ipairs(v.wheels) do
        -- Wheel joint translation has no wheel binding in 1.14.0. Project the
        -- world wheel centre into chassis-local Y (the authored spring axis).
        local local_point = b2d.body.get_local_point(v.chassis,b2d.body.get_position(wheel))
        sample["travel"..i] = local_point.y-vehicle.config.wheel_y
        sample["contact"..i] = #b2d.body.get_contact_data(wheel)>0
    end
    sample.physics_ms = b2d.world.get_profile(b2d.body.get_world(v.chassis)).step
    return sample
end
function M.frame(m,v,dt)
    if dt<=0 then return end
    m.elapsed,m.frames = m.elapsed+dt,m.frames+1
    if m.elapsed<M.budget.sample_seconds then return end
    local s=M.sample(v)
    s.fps,s.frame_ms = m.frames/m.elapsed,1000*m.elapsed/m.frames
    m.elapsed,m.frames = 0,0
    return s
end
return M
