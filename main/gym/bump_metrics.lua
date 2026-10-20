-- Read-only completed-step observations (A19b); no tuning, limits or reset requests.
local feel=require "main.gym.feel"
-- Speculative manifolds alone are not loaded contact (A18/A19 rule).
local supported=require("main.gym.seam_metrics").supported
local M={}
-- Window of a feature, chassis centre in metres: from 0.5 m before its start (the front wheel is
-- 0.46 m ahead) to 1.5 m after its end (the rear wheel past it plus 1 m).
M.BEFORE,M.AFTER=.5,1.5
-- A lift-off is at least this many consecutive steps without loaded support on one wheel.
M.LIFT_STEPS=2
-- The wheel joints have no travel stop. Reference travel: from spring rest until the chassis underside
-- (half-height 14 u) touches flat ground under the wheels (wheel_y -30 u, radius 22 u): 38 u = 0.38 m.
M.CLEARANCE_M=.38
M.protocol={version=1,dt_s=1/60,lift_steps=M.LIFT_STEPS,window_before_m=M.BEFORE,window_after_m=M.AFTER,clearance_m=M.CLEARANCE_M,
    geometry="Feature height h = trough to crest: y = h/2 (1 - cos(2 pi x / wavelength)) from ground level (a dip goes h below it); wheel 1 = rear, 2 = front",
    commands="Debug a19b: constant throttle=clamp(start_speed/(abs(preset motor_speed)*0.22),0,1) (A18 powered control: wheel target = start speed, no feedback), brake=0, lean=0. Above about 7.04 m/s (preset A) the throttle saturates at 1",
    support="A wheel is supported in a completed step when one of its manifold points touches (separation<=0) or carries normal impulse (A19 rule); a speculative manifold alone is a loss",
    measures="Per feature window: contact loss = unsupported steps / window steps per wheel, any wheel and both wheels; compression = max positive spring travel along chassis Y from spring rest (static sag included; sag at window entry reported), also as a share of the 0.38 m reference travel to underbody contact on flat ground (no travel stop exists); pitch = chassis angle min/max in rad (positive = nose up); chassis/underbody contact = impulsive chassis manifold point (underbody: chassis-local y <= -13 u). Crest/dip: apex speed = chassis vx when its centre crosses the apex; lifted = one wheel unsupported for at least 2 consecutive steps in the window; bottomed = underbody contact"}
-- Impulsive chassis contact; the box underside is -14 u, allow the rounded contact skin (A17 rule).
local function chassis_contacts(chassis)
    local hit,under=false,false
    for _,c in ipairs(b2d.body.get_contact_data(chassis)) do
        for _,p in ipairs(c.points) do
            if p.normal_impulse>0 or p.total_normal_impulse>0 then
                hit=true
                if b2d.body.get_local_point(chassis,p.point).y<=-13 then under=true end
            end
        end
    end
    return hit,under
end
local function feature_record(f)
    return {id=f.id,type=f.type,height_m=f.height,wavelength_m=f.wavelength,count=f.count,start_x=f.start_x,end_x=f.end_x,
        steps=0,loss_steps={0,0},any_loss_steps=0,both_loss_steps=0,compression_m={0,0},chassis_contact=false,underbody_contact=false,
        lifted=false,done=false}
end
function M.restart(self)
    self.bump_tuning={}
    for _,key in ipairs(feel.preset_keys) do self.bump_tuning[key]=feel.values[key] end
    local parts={self.station.id,tostring(self.station.start_speed)}
    for _,key in ipairs(feel.preset_keys) do parts[#parts+1]=key.."="..tostring(feel.values[key]) end
    local identity=table.concat(parts,";")
    if identity~=self.bump_identity then self.bump_archive={} end
    self.bump_identity=identity
    self.bumps={records={}}
    for i,s in ipairs(self.station.sections) do
        local features={}
        for k,f in ipairs(s.features) do features[k]=feature_record(f) end
        self.bumps.records[i]={id=s.id,status="NOT RUN",elapsed=0,features=features,start_speed=self.station.start_speed,independent=i==self.station.section_index}
    end
    self.bump_prev_x=nil
end
local function observe_feature(r,f,s,x,prev,vx,state,sample,support,hit,under)
    if x<f.start_x-M.BEFORE or x>f.end_x+M.AFTER then
        if x>f.end_x+M.AFTER and r.steps>0 then r.done=true end
        return
    end
    if r.steps==0 then
        r.entry_speed_mps=vx
        r.entry_compression_m={feel.metres(sample.travel1),feel.metres(sample.travel2)}
        r.pitch_min_rad,r.pitch_max_rad,r.vx_min_mps,r.vx_max_mps=state.angle,state.angle,vx,vx
        r.run={0,0}
    end
    r.steps=r.steps+1
    r.vx_min_mps,r.vx_max_mps=math.min(r.vx_min_mps,vx),math.max(r.vx_max_mps,vx)
    r.pitch_min_rad,r.pitch_max_rad=math.min(r.pitch_min_rad,state.angle),math.max(r.pitch_max_rad,state.angle)
    for k=1,2 do
        r.compression_m[k]=math.max(r.compression_m[k],feel.metres(sample["travel"..k]))
        if support[k] then r.run[k]=0
        else
            r.loss_steps[k]=r.loss_steps[k]+1;r.run[k]=r.run[k]+1
            if r.run[k]>=M.LIFT_STEPS and not r.lifted then
                r.lifted,r.lift_wheel,r.lift_x_m,r.lift_speed_mps=true,k,x,vx
            end
        end
    end
    if not support[1] or not support[2] then r.any_loss_steps=r.any_loss_steps+1 end
    if not support[1] and not support[2] then r.both_loss_steps=r.both_loss_steps+1 end
    r.chassis_contact=r.chassis_contact or hit
    if under and not r.underbody_contact then r.underbody_contact,r.underbody_x_m=true,x end
    if f.type~="waves" and not r.apex_speed_mps then
        local apex=f.start_x+f.wavelength/2
        if prev and prev<apex and x>=apex then r.apex_speed_mps=vx end
    end
end
function M.observe(self,state,dt,sample)
    for _,key in ipairs(feel.preset_keys) do
        if self.bump_tuning[key]~=feel.values[key] then self.bumps.tuning_changed=true;self.bump_archive={} end
    end
    local v=self.vehicle
    local x,vx=feel.metres(state.x),feel.metres(state.vx)
    local prev=self.bump_prev_x;self.bump_prev_x=x
    local support={supported(v.wheels[1]),supported(v.wheels[2])}
    local hit,under=chassis_contacts(v.chassis)
    for i,s in ipairs(self.station.sections) do
        local r=self.bumps.records[i]
        if i>=self.station.section_index and (x>=s.spawn[1]-.01 or r.entered) and (x<=s.end_x or r.entered) and not r.done then
            if not r.entered then
                r.entered=true;r.status="RUNNING";r.entry_speed_mps=vx;self.bumps.active=r.id
                r.independent=r.independent and x<=s.spawn[1]+.5
            end
            r.elapsed=r.elapsed+dt
            local c=self.last_command
            r.throttle_min=math.min(r.throttle_min or 1,c.throttle)
            r.throttle_max=math.max(r.throttle_max or 0,c.throttle)
            r.brake_max=math.max(r.brake_max or 0,c.brake_reverse)
            r.lean_max=math.max(r.lean_max or 0,math.abs(c.lean))
            for k,f in ipairs(s.features) do observe_feature(r.features[k],f,s,x,prev,vx,state,sample,support,hit,under) end
            r.stalled=math.abs(vx)<.1 and (r.stalled or 0)+dt or 0
            -- Observation only: a stall or the 90 s limit ends the record, never the practice run.
            if x>s.end_x or r.stalled>=1 or r.elapsed>=90 then
                r.status=x>s.end_x and "DONE" or r.stalled>=1 and "STALLED" or "TIMEOUT"
                if r.status~="DONE" then r.stop_x_m=x end
                r.done=true
                -- Only an independent start replaces an archived result.
                if r.independent then self.bump_archive[r.id]=r end
                for _,f in ipairs(r.features) do f.done=true end
            end
        end
    end
end
-- Shares and per-wheel names for the report (wheel 1 is the rear wheel, 2 the front). A feature that was
-- never entered has no measurements (absent fields, null in the page report).
local function summary(r)
    if r.steps==0 then return r end
    local n=r.steps
    r.loss_share_rear,r.loss_share_front=r.loss_steps[1]/n,r.loss_steps[2]/n
    r.loss_share_any,r.loss_share_both=r.any_loss_steps/n,r.both_loss_steps/n
    r.compression_rear_m,r.compression_front_m=r.compression_m[1],r.compression_m[2]
    r.compression_max_m=math.max(r.compression_m[1],r.compression_m[2])
    r.compression_share_rear,r.compression_share_front=r.compression_m[1]/M.CLEARANCE_M,r.compression_m[2]/M.CLEARANCE_M
    r.compression_share_max=r.compression_max_m/M.CLEARANCE_M
    r.bottomed=r.underbody_contact
    return r
end
function M.report(self)
    local records={}
    for i,s in ipairs(self.station.sections) do
        local current=self.bumps.records[i]
        local r=current.entered and current or self.bump_archive[s.id] or current
        for _,f in ipairs(r.features) do summary(f) end
        records[#records+1]=r
    end
    return {kind="bumps",station=self.station.id,section=self.station.sections[self.station.section_index].id,
        source_sha=sys.get_config_string("rider.source_sha","development"),preset=self.preset,modified=self.modified or false,
        automated=self.testcase=="a19b",tuning=feel.snapshot(),start_speed=self.station.start_speed,protocol=M.protocol,
        records=records,comparable=not self.bumps.tuning_changed,tuning_at_start=self.bump_tuning,
        conditions="Independent authored starts 5 m before the first feature; ground at y=0. "..M.protocol.commands..". "..M.protocol.support..". "..M.protocol.measures.."."}
end
function M.enrich(self,sample)
    local report=M.report(self)
    local active=self.bumps.active or report.section
    local r
    for _,x in ipairs(report.records) do if x.id==active then r=x end end
    local f=r.features[1]
    if #r.features==1 and f.steps==0 then
        sample.station_result=string.format("%s %s",r.id,r.status)
    elseif #r.features==1 then
        sample.station_result=string.format("%s %s | loss R %.0f%% F %.0f%% | comp %.2f m | pitch %.2f..%.2f rad",r.id,r.status,
            100*f.loss_share_rear,100*f.loss_share_front,f.compression_max_m,f.pitch_min_rad or 0,f.pitch_max_rad or 0)
    else
        local lifted,bottomed={},{}
        for _,g in ipairs(r.features) do
            if g.lifted then lifted[#lifted+1]=g.id end
            if g.bottomed then bottomed[#bottomed+1]=g.id end
        end
        sample.station_result=string.format("%s %s | lift %s | bottomed %s",r.id,r.status,#lifted>0 and table.concat(lifted," ") or "none",#bottomed>0 and table.concat(bottomed," ") or "none")
    end
    if self.bumps.tuning_changed then sample.station_result="Tuning changed; Retry for comparable results" end
    if html5 then html5.run("window.riderStationReport="..json.encode(report)) end
end
return M
