-- A19c: read-only per-jump observations on the air station; no tuning, limits or reset requests.
local feel=require "main.gym.feel"
local M={}
-- Declared protocol constants (main/gym/README.md#air-control).
M.MIN_AIRTIME=0.25 -- shorter unloaded phases (suspension hops) are not jumps
M.SETTLE=0.25 -- both wheels loaded and |pitch relative to the ground| < UPRIGHT for this long = LANDED
M.UPRIGHT=0.8
M.WINDOW=2 -- seconds after touchdown before an unsettled landing is final
M.COMPRESSION_WINDOW=0.5
M.KEEP=12 -- jumps kept per run (oldest dropped)
-- Speculative manifolds alone are not loaded contact (A18/A19 rule).
local function supported(body)
    for _,c in ipairs(b2d.body.get_contact_data(body)) do
        for _,p in ipairs(c.points) do
            if p.separation<=0 or p.normal_impulse>0 or p.total_normal_impulse>0 then return true end
        end
    end
    return false
end
local function wrap(a)
    while a>math.pi do a=a-2*math.pi end
    while a<=-math.pi do a=a+2*math.pi end
    return a
end
M.wrap=wrap
-- Slope (rad) of the authored chain segment touched by a body (centre in metres): the non-vertical segment
-- whose closest point lies nearest one wheel radius from the centre (at most 0.9 m away, centre not more
-- than 0.1 m below its surface). Returns the slope and that closest point's x (the contact point), or nil.
M.WHEEL_RADIUS=0.22
function M.ground_slope(chains,x,y)
    local best,slope,contact
    for _,chain in ipairs(chains) do
        for i=2,#chain do
            local a,b=chain[i-1],chain[i]
            local dx,dy=b[1]-a[1],b[2]-a[2]
            if math.abs(dx)>1e-6 then
                local t=math.max(0,math.min(1,((x-a[1])*dx+(y-a[2])*dy)/(dx*dx+dy*dy)))
                local px,py=a[1]+t*dx,a[2]+t*dy
                local length=math.sqrt(dx*dx+dy*dy)
                local nx,ny=-dy/length,dx/length
                if ny<0 then nx,ny=-nx,-ny end -- upward surface normal
                local above=(x-px)*nx+(y-py)*ny
                local distance=math.sqrt((x-px)^2+(y-py)^2)
                local miss=math.abs(distance-M.WHEEL_RADIUS)
                if above>-0.1 and distance<0.9 and (not best or miss<best) then best,slope,contact=miss,math.atan(dy/dx),px end
            end
        end
    end
    return slope,contact
end
local function section_of(station,x)
    local found
    for _,s in ipairs(station.sections) do if x>=s.spawn[1]-2 then found=s end end
    return found
end
function M.restart(self)
    self.air_tuning={}
    for _,key in ipairs(feel.preset_keys) do self.air_tuning[key]=feel.values[key] end
    self.air={jumps={},count=0,elapsed=0,lip_taken=false}
end
local function finish(r,status) r.status=status;r.done=true end
function M.observe(self,state,dt,sample)
    local a=self.air
    for _,key in ipairs(feel.preset_keys) do
        if self.air_tuning[key]~=feel.values[key] then a.tuning_changed=true end
    end
    a.elapsed=a.elapsed+dt
    local v=self.vehicle
    local c=self.last_command or {throttle=0,brake_reverse=0,lean=0}
    local x,y=feel.metres(state.x),feel.metres(state.y)
    local velocity=b2d.body.get_linear_velocity(v.chassis)
    local vx,vy=feel.metres(velocity.x),feel.metres(velocity.y)
    local support={supported(v.wheels[1]),supported(v.wheels[2])}
    -- A chassis on the ground (a roof or underbody landing) also ends the flight.
    local hull=supported(v.chassis)
    local airborne=not support[1] and not support[2] and not hull
    if not a.flight and not a.lip_taken then
        a.approach_throttle_min=math.min(a.approach_throttle_min or 1,c.throttle)
        a.approach_lean_max=math.max(a.approach_lean_max or 0,math.abs(c.lean))
    end
    -- The spawn drop after a start or Retry is not a jump: detection begins at the first loaded support.
    a.grounded=a.grounded or not airborne
    local f=a.flight
    if airborne and not f and a.grounded then
        local s=section_of(self.station,x)
        local wx={feel.metres(b2d.body.get_position(v.wheels[1]).x),feel.metres(b2d.body.get_position(v.wheels[2]).x)}
        -- A lip takeoff: both wheel centres within one wheel radius of the lip or past it, chassis within 2 m.
        -- A wheel leaves the convex lip slightly before lip_x; later steps can still confirm it (below).
        local from_lip=s~=nil and math.min(wx[1],wx[2])>=s.lip_x-M.WHEEL_RADIUS and x<=s.lip_x+2
        f={start=a.elapsed,lip=s,angle=state.angle,takeoff_angle_rad=state.angle,rotation=0,takeoff_x=x,takeoff_y=y,apex_y=y,
            takeoff_vx_mps=vx,takeoff_vy_mps=vy,takeoff_speed_mps=math.sqrt(vx*vx+vy*vy),section=s and s.id or "",from_lip=from_lip,
            throttle_max=0,brake_max=0, -- this step's command was issued before the takeoff was seen
            approach_throttle_min=a.approach_throttle_min or 0,approach_lean_max=a.approach_lean_max or 0}
        a.flight=f
        if from_lip then a.lip_taken=true end
    elseif f and airborne then
        if not f.from_lip and f.lip and math.min(feel.metres(b2d.body.get_position(v.wheels[1]).x),feel.metres(b2d.body.get_position(v.wheels[2]).x))>=f.lip.lip_x
            and x<=f.lip.lip_x+2 then
            -- Lip confirmed in flight: input ranges restart here (the trial reacts from the next step).
            f.from_lip,f.lip_confirmed_s,a.lip_taken=true,a.elapsed-f.start,true
            f.lean_min,f.lean_max,f.throttle_max,f.brake_max=nil,nil,0,0
        else
            f.lean_min,f.lean_max=math.min(f.lean_min or c.lean,c.lean),math.max(f.lean_max or c.lean,c.lean)
            f.throttle_max,f.brake_max=math.max(f.throttle_max,c.throttle),math.max(f.brake_max,c.brake_reverse)
        end
        -- Box2D angles stay within (-pi, pi]; one step turns far less than pi (rate cap 8-12 rad/s).
        f.rotation=f.rotation+wrap(state.angle-f.angle);f.angle=state.angle
        f.airtime=a.elapsed-f.start;f.apex_y=math.max(f.apex_y,y);f.vx,f.vy=vx,vy
    elseif f and not airborne then
        a.flight=nil
        f.airtime=a.elapsed-f.start -- airborne steps until this first supported step
        if f.airtime>=M.MIN_AIRTIME then
            f.rotation=f.rotation+wrap(state.angle-f.angle)
            -- Wheel 1 is the rear wheel (-0.46 m), wheel 2 the front wheel; 0 = chassis first.
            local k=support[1] and 1 or support[2] and 2 or 0
            local wp=b2d.body.get_position(k>0 and v.wheels[k] or v.chassis)
            local slope,contact=M.ground_slope(self.station.chains,feel.metres(wp.x),feel.metres(wp.y))
            local rot=math.deg(f.rotation)
            -- Positive = backward (nose up) relative to the takeoff travel direction.
            local back=f.takeoff_vx_mps>=0 and rot or -rot
            local tvx,tvy=f.vx or vx,f.vy or vy
            local s=slope or 0
            a.count=a.count+1
            local r={index=a.count,section=f.section,from_lip=f.from_lip,lip_confirmed_s=f.lip_confirmed_s or 0,status="LANDING",done=false,complete=false,
                airtime_s=f.airtime,rotation_deg=rot,backward_deg=back,flips=math.floor(math.abs(rot)/360),
                direction=math.abs(back)<1 and "none" or back>0 and "back" or "front",
                takeoff_x=f.takeoff_x,takeoff_speed_mps=f.takeoff_speed_mps,takeoff_vx_mps=f.takeoff_vx_mps,takeoff_vy_mps=f.takeoff_vy_mps,
                takeoff_angle_deg=math.deg(f.takeoff_angle_rad),apex_m=f.apex_y-f.takeoff_y,
                touchdown_x=x,contact_x=contact or false,touchdown_wheel=k,ground_found=slope~=nil,ground_slope_deg=math.deg(s),
                pitch_deg=math.deg(state.angle),landing_angle_deg=math.deg(wrap(state.angle-s)),
                touchdown_vy_mps=tvy,impact_normal_mps=-(-math.sin(s)*tvx+math.cos(s)*tvy),
                peak_compression_m=0,touchdown_at=a.elapsed,settled=0,
                lean_min=f.lean_min,lean_max=f.lean_max,throttle_max=f.throttle_max,brake_max=f.brake_max,
                approach_throttle_min=f.approach_throttle_min,approach_lean_max=f.approach_lean_max}
            table.insert(a.jumps,r)
            if #a.jumps>M.KEEP then table.remove(a.jumps,1) end
        end
    end
    -- Landing evaluation: impact (compression, chassis contact) over 0.5 s and the status over up to 2 s,
    -- each over its whole window. complete = both windows closed.
    for _,r in ipairs(a.jumps) do
        local t=a.elapsed-r.touchdown_at
        if not r.complete and t<=M.COMPRESSION_WINDOW then
            r.peak_compression_m=math.max(r.peak_compression_m,feel.metres(sample.travel1),feel.metres(sample.travel2))
            r.chassis_contact=r.chassis_contact or hull
        end
        if not r.done then
            local slope
            if support[1] and support[2] then
                local p1,p2=b2d.body.get_position(v.wheels[1]),b2d.body.get_position(v.wheels[2])
                slope=M.ground_slope(self.station.chains,feel.metres((p1.x+p2.x)/2),feel.metres((p1.y+p2.y)/2))
            end
            local upright=slope and math.abs(wrap(state.angle-slope))<M.UPRIGHT
            r.settled=upright and r.settled+dt or 0
            if r.touchdown_wheel==0 then finish(r,"CRASHED")
            elseif r.settled>=M.SETTLE then finish(r,"LANDED")
            elseif t>=M.WINDOW then finish(r,"CRASHED") end
        end
        r.complete=r.done and t>=M.COMPRESSION_WINDOW
    end
end
function M.report(self)
    local a=self.air
    local best_rotation,longest=0,0
    for _,r in ipairs(a.jumps) do best_rotation=math.max(best_rotation,math.abs(r.rotation_deg));longest=math.max(longest,r.airtime_s) end
    local f=a.flight
    return {kind="air",station=self.station.id,section=self.station.sections[self.station.section_index].id,
        source_sha=sys.get_config_string("rider.source_sha","development"),preset=self.preset,modified=self.modified or false,
        automated=self.testcase=="a19c",tuning=feel.snapshot(),start_speed=self.station.start_speed,comparable=not a.tuning_changed,
        tuning_at_start=self.air_tuning,jump_count=a.count,jumps=#a.jumps>0 and a.jumps or false, -- an empty Lua table would encode as {}
        best_rotation_deg=best_rotation,longest_airtime_s=longest,
        in_flight=f and {airtime_s=f.airtime or 0,rotation_deg=math.deg(f.rotation),section=f.section,from_lip=f.from_lip} or false,
        conditions="Jump (after the first loaded support since the start) = both wheels and the chassis without loaded support (touching or impulsive manifold point) for at least 0.25 s. Airtime = takeoff to the first loaded wheel or chassis contact. Rotation = summed chassis angle change in flight (positive = backward relative to travel); flips = whole 360 deg turns. Landing angle = chassis angle minus the slope of the authored chain segment nearest the first loaded wheel (or the chassis), at its closest (contact) point. Impact = last airborne chassis velocity (vertical and along the ground normal) and peak suspension compression within 0.5 s. LANDED = both wheels loaded with |pitch relative to the ground| < 0.8 rad for 0.25 s within 2 s; CRASHED = the chassis touches the ground (loaded contact) first or no LANDED within 2 s. chassis_contact reports chassis ground contact within 0.5 s (bottoming). complete = status final and the 0.5 s impact window closed."}
end
function M.enrich(self,sample)
    local a=self.air
    -- Headline: the run's lip jump; later landing bounces only add a count.
    local f,r,later=a.flight,nil,0
    for _,j in ipairs(a.jumps) do if j.from_lip then r,later=j,0 elseif r then later=later+1 end end
    if not r then r=a.jumps[#a.jumps] end
    if f then
        sample.station_result=string.format("In air %.2f s | rot %+.0f deg",f.airtime or 0,math.deg(f.rotation)*(f.takeoff_vx_mps>=0 and 1 or -1))
    elseif r then
        sample.station_result=string.format("Jump %d: %.2f s | rot %+.0f deg (%d flip%s) | land %+.0f deg | %.1f m/s %s",
            r.index,r.airtime_s,r.backward_deg,r.flips,r.flips==1 and "" or "s",r.landing_angle_deg,math.abs(r.impact_normal_mps),r.done and r.status or "")
            ..(later>0 and string.format(" | +%d bounce%s",later,later==1 and "" or "s") or "")
    else sample.station_result="Air control: jump and lean in the air" end
    if a.tuning_changed then sample.station_result=sample.station_result.." | tuning changed" end
    if html5 then html5.run("window.riderStationReport="..json.encode(M.report(self))) end
end
return M
