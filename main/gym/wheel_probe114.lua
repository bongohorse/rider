-- #114 stage 1: debug HTML5-only wheel observer for the wheel-size A/B (opt-in URL wheel114=1 or wheel114=throttle).
-- Reads the completed fixed step once per Defold-owned fixed_update, like the #352 camera probe: never writes a
-- body, joint, shape, tuning value, save or production telemetry, and never steps the world. wheel114=throttle
-- additionally supplies a constant full-throttle command (a debug driver like ramp_trial) for the Straight
-- top-speed protocol; it is consulted only after every station driver and before live input.
local feel=require "main.game.feel"
local M={}
-- Box2D 3.1.0 B2_MAX_ROTATION (0.25 pi per full step) at the fixed 1/60 s step, rad/s (engine pitfall 6).
M.CAP=.25*math.pi*60
-- HTML5 bridge only (not msg.post); runners copy the trace before the next navigation.
M.KEEP=3600
function M.mode()
    assert(sys.get_engine_info().is_debug and html5,"wheel114 requires debug HTML5")
    local mode=html5.run("new URLSearchParams(location.search).get('wheel114') || ''")
    return (mode=="1" or mode=="throttle") and mode or nil
end
function M.command(self)
    if self.wheel114_mode~="throttle" then return nil end
    return {throttle=1,brake_reverse=0,lean=0,allow_reverse=false}
end
-- First loaded manifold point of a body (touching or carrying impulse, the A18/A19 support rule) and its normal.
local function loaded(body)
    for _,c in ipairs(b2d.body.get_contact_data(body)) do
        for _,p in ipairs(c.points) do
            if p.separation<=0 or p.normal_impulse>0 or p.total_normal_impulse>0 then return p.point,c.normal end
        end
    end
end
-- Slip (m/s) of a supported wheel: velocity of the wheel's material point at the contact, along the contact
-- tangent, against static ground (chain or hull; the measured stations have no moving ground). Rolling without
-- slip is 0. The binding scales the point and velocity once (engine units); feel.metres converts once.
local function slip(wheel)
    local point,normal=loaded(wheel)
    if not point then return false end
    local v=b2d.body.get_linear_velocity_from_world_point(wheel,point)
    return feel.metres(v.x*-normal.y+v.y*normal.x)
end
local function geometry(self)
    local v=self.vehicle
    local shapes=b2d.body.get_shapes(v.wheels[1])
    local shape=#shapes==1 and b2d.shape.get_shape(shapes[1].shape_id) or {}
    return {preset=self.preset,factory=v.wheel_factory,radius_u=shape.radius or false,
        radius_m=feel.values.wheel_radius_m,wheel_y_u=feel.values.wheel_y,art_scale=feel.values.wheel_art_scale,
        camera_rest_u=feel.follow.rest,wheel_mass_kg=b2d.body.get_mass(v.wheels[1]),
        wheel_inertia=b2d.body.get_rotational_inertia(v.wheels[1]),chassis_mass_kg=b2d.body.get_mass(v.chassis),
        cap_rps=M.CAP,source_sha=sys.get_config_string("rider.source_sha","development")}
end
function M.fixed(self,state,dt)
    assert(sys.get_engine_info().is_debug and html5,"wheel114 requires debug HTML5")
    local v=self.vehicle
    if self.wheel114_resets~=self.reset_count then
        self.wheel114_resets,self.wheel114_tick=self.reset_count,0
        if not self.wheel114_geometry then
            self.wheel114_geometry=true
            html5.run("window.riderWheel114Geometry="..json.encode(geometry(self)))
        end
    end
    self.wheel114_tick=self.wheel114_tick+1
    local velocity=b2d.body.get_linear_velocity(v.chassis)
    local section=self.station.sections and self.station.sections[self.station.section_index]
    local c=self.last_command or {}
    local s1,s2=slip(v.wheels[1]),slip(v.wheels[2])
    local sample={tick=self.wheel114_tick,resets=self.reset_count,generation=self.generation,dt=dt,
        station=self.station.id,section=section and section.id or false,preset=self.preset,
        x=feel.metres(state.x),y=feel.metres(state.y),angle=state.angle,
        vx=feel.metres(velocity.x),vy=feel.metres(velocity.y),
        w1=b2d.body.get_angular_velocity(v.wheels[1]),w2=b2d.body.get_angular_velocity(v.wheels[2]),
        s1=s1~=false,s2=s2~=false,slip1=s1,slip2=s2,
        hull=#b2d.body.get_contact_data(v.chassis)>0,throttle=c.throttle or 0,brake=c.brake_reverse or 0,lean=c.lean or 0}
    html5.run("(function(s){var a=window.riderWheel114Trace||(window.riderWheel114Trace=[]);a.push(s);if(a.length>"..M.KEEP..")a.shift();})("..json.encode(sample)..")")
end
return M
