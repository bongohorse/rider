-- Read-only completed-step observations; no tuning, limits or reset requests.
local feel=require "main.gym.feel"
local M={}
-- Speculative manifolds alone are not loaded contact (see A18 seam protocol).
local function supported(body)
    for _,c in ipairs(b2d.body.get_contact_data(body)) do
        for _,p in ipairs(c.points) do
            if p.separation<=0 or p.normal_impulse>0 or p.total_normal_impulse>0 then return true end
        end
    end
    return false
end
function M.restart(self)
    self.gap_tuning={}
    for _,key in ipairs(feel.preset_keys) do self.gap_tuning[key]=feel.values[key] end
    local parts={self.station.id,tostring(self.station.start_speed)}
    for _,key in ipairs(feel.preset_keys) do parts[#parts+1]=key.."="..tostring(feel.values[key]) end
    local identity=table.concat(parts,";")
    if identity~=self.gap_identity then self.gap_archive={} end
    self.gap_identity=identity
    self.gaps={records={}}
    for i,s in ipairs(self.station.sections) do
        self.gaps.records[i]={id=s.id,gap_m=s.gap,landing=s.landing,status="NOT RUN",elapsed=0,airtime_s=0,
            peak_compression_m=0,start_speed=self.station.start_speed,independent=i==self.station.section_index}
    end
end
function M.observe(self,state,dt,sample)
    for _,key in ipairs(feel.preset_keys) do
        if self.gap_tuning[key]~=feel.values[key] then self.gaps.tuning_changed=true;self.gap_archive={} end
    end
    local v=self.vehicle
    local x,y,vx,vy=feel.metres(state.x),feel.metres(state.y),feel.metres(state.vx),feel.metres(b2d.body.get_linear_velocity(v.chassis).y)
    local wheel={feel.metres(b2d.body.get_position(v.wheels[1]).x),feel.metres(b2d.body.get_position(v.wheels[2]).x)}
    local support={supported(v.wheels[1]),supported(v.wheels[2])}
    for i,s in ipairs(self.station.sections) do
        local r=self.gaps.records[i]
        if i>=self.station.section_index and (x>=s.spawn[1]-.01 or r.entered) and (x<=s.end_x or r.entered) and not r.done then
            if not r.entered then
                r.entered=true;r.status="RUNNING";r.entry_speed_mps=vx;self.gaps.active=r.id
                r.independent=r.independent and x<=s.spawn[1]+.5
            end
            r.elapsed=r.elapsed+dt
            local c=self.last_command
            r.throttle_min=math.min(r.throttle_min or 1,c.throttle)
            r.throttle_max=math.max(r.throttle_max or 0,c.throttle)
            r.brake_max=math.max(r.brake_max or 0,c.brake_reverse)
            r.lean_max=math.max(r.lean_max or 0,math.abs(c.lean))
            if not r.takeoff_speed_mps and x>=s.lip_x then r.takeoff_speed_mps=vx;r.takeoff_angle_rad=state.angle end
            local airborne=not support[1] and not support[2]
            -- Takeoff = both wheels past the lip and unloaded; the rear wheel leaves last.
            if not r.airborne_at and airborne and math.min(wheel[1],wheel[2])>s.lip_x then r.airborne_at=r.elapsed end
            if r.airborne_at and not r.touchdown_at then
                if airborne then r.airtime_s=r.elapsed-r.airborne_at;r.vy_before_mps=vy
                else
                    -- First loaded wheel after the lip; its centre x approximates the contact x.
                    local k=support[1] and 1 or 2
                    r.touchdown_at=r.elapsed;r.touchdown_wheel=k
                    r.jump_distance_m=wheel[k]-s.lip_x
                    r.touchdown_vy_mps=r.vy_before_mps or vy
                    r.landing_angle_rad=state.angle
                    r.landed_on_deck=wheel[k]>=s.land_x
                end
            end
            if r.touchdown_at and r.elapsed-r.touchdown_at<=.5 then
                r.peak_compression_m=math.max(r.peak_compression_m,feel.metres(sample.travel1),feel.metres(sample.travel2))
            end
            local on_deck=r.landed_on_deck and wheel[1]>=s.land_x and wheel[2]>=s.land_x and support[1] and support[2] and math.abs(state.angle)<.8
            r.settled=on_deck and (r.settled or 0)+dt or 0
            r.stalled=math.abs(vx)<.1 and x>=s.ramp_start and (r.stalled or 0)+dt or 0
            local fell=y<s.lip_y-1
            if r.settled>=.25 or fell or (r.touchdown_at and not r.landed_on_deck) or x>=s.end_x or r.stalled>=1 or r.elapsed>=8 then
                r.status=r.settled>=.25 and "CLEARED" or "MISSED"
                r.done=true;self.gap_archive[r.id]=r
            end
        end
    end
end
function M.report(self)
    local records,widest={},0
    for i,s in ipairs(self.station.sections) do
        local current=self.gaps.records[i]
        local r=current.entered and current or self.gap_archive[s.id] or current
        records[#records+1]=r
        if r.status=="CLEARED" and r.independent and not self.gaps.tuning_changed then widest=math.max(widest,r.gap_m) end
    end
    return {kind="gaps",station=self.station.id,section=self.station.sections[self.station.section_index].id,
        source_sha=sys.get_config_string("rider.source_sha","development"),preset=self.preset,modified=self.modified or false,
        automated=self.testcase=="a19",tuning=feel.snapshot(),start_speed=self.station.start_speed,
        widest_cleared_m=widest,records=records,comparable=not self.gaps.tuning_changed,tuning_at_start=self.gap_tuning,
        conditions="Independent authored starts 2 m before a 15 deg ramp to a 0.5 m lip; automated throttle=1, no brake/lean. Loaded wheel support (touching or impulsive manifold). Jump distance = first loaded wheel centre x after the lip minus lip x. Cleared = both wheels loaded on the landing side, |pitch|<0.8 rad for 0.25 s; missed = first touchdown short of the landing edge, falling 1 m below the lip, 1 s stall or 8 s observation. Impact = touchdown vertical speed and peak suspension compression within 0.5 s."}
end
function M.enrich(self,sample)
    local report=M.report(self)
    local active=self.gaps.active or report.section
    local r
    for _,x in ipairs(report.records) do if x.id==active then r=x end end
    sample.station_result=string.format("%s m %s | jump %.2f m | widest %g m",tostring(r.gap_m),r.status,r.jump_distance_m or 0,report.widest_cleared_m)
    if self.gaps.tuning_changed then sample.station_result="Tuning changed; Retry for comparable results" end
    if html5 then html5.run("window.riderStationReport="..json.encode(report)) end
end
return M
