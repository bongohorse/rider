-- Read-only completed-step observer. No physics mutation or second tick owner.
local feel=require "main.gym.feel"
local M={}
M.protocol={version=3,speeds_mps={5,7,9},tolerance_fraction=.05,dt_s=1/60,seam_radius_m=1,
    vy_floor_mps=.1,dvy_floor_mps=.1,rise_floor_m=.005,dvx_floor_mps=.02,baseline_factor=3,
    -- Pinned Box2D clamps normal angular speed to B2_MAX_ROTATION/full dt.
    rotation_cap_rps=.25*math.pi*60,rotation_margin_rps=.01,
    max_elapsed_s=30,repeat_speed_mps=.02,repeat_peak_mps=.02,repeat_rise_m=.002,
    sampling="Completed engine steps at 60 Hz (4 solver substeps); no substep contact claims",
    commands="Debug free roll (v2, retained in v3): throttle=brake=lean=0, motors disabled and passive coast/rolling moments absent. No tuning changes. Powered v1 control: throttle=clamp(nominal/(abs(preset motor_speed)*0.22),0,1); brake=0; lean=0. normal drive motor. No speed correction",
    validity="Baseline samples and entry within +/-5% of nominal 5/7/9 m/s; wheel spin below the engine rotation cap. Powered: every window sample within +/-5%. Free roll: no sample above +5%; speed loss is measured, not rejected",
    ghost_rule="Per seam: vertical bump if abs(chassis vy), abs(delta vy) or rise above baseline mean exceeds max(floor,3*baseline peak); longitudinal hit if a one-step chassis vx drop exceeds max(0.02 m/s,3*baseline abs(delta vx) peak). Either counts the seam once as a ghost bump. Contact loss separately recorded; sampled coincidence is not causal proof"}
local function invalidate(r,reason)
    for _,v in ipairs(r.reasons) do if v==reason then return end end
    r.reasons[#r.reasons+1]=reason
    r.comparable=false
end
function M.restart(self)
    local r={kind="seams",station=self.station.id,nominal_mps=self.station.start_speed,
        source_sha=sys.get_config_string("rider.source_sha","development"),preset=self.preset,
        automated=self.testcase=="a18" or self.testcase=="a18powered",freewheel=self.testcase=="a18",protocol=M.protocol,tuning_at_start={},trace={},seams={},reasons={},
        status="RUNNING",comparable=false,done=false,elapsed_s=0,baseline_count=0,baseline_y_sum=0,
        baseline_vy_peak=0,baseline_dvy_peak=0,baseline_dvx_peak=0,wheel_spin_peak_rps=0,ghost_bumps=0,vertical_bumps=0,longitudinal_hits=0}
    for _,key in ipairs(feel.preset_keys) do r.tuning_at_start[key]=feel.values[key] end
    for i,x in ipairs(self.station.seams) do r.seams[i]={id=i,x_m=x,samples=0,vy_peak_mps=0,dvy_peak_mps=0,rise_m=0,
        wheel1_loss_samples=0,wheel2_loss_samples=0,wheel1_losses=0,wheel2_losses=0,wheel1_gains=0,wheel2_gains=0,airborne_samples=0,
        dvx_drop_peak_mps=0,vx_loss_mps=0,vertical_bump=false,longitudinal_hit=false,ghost_bump=false} end
    local supported_speed=false
    for _,v in ipairs(M.protocol.speeds_mps) do if r.nominal_mps==v then supported_speed=true end end
    if not supported_speed then invalidate(r,"unsupported nominal speed") end
    self.seam_result=r
    self.seam_previous=nil
end
local function supported(body)
    -- Manifolds may be speculative; require a touching/impulsive point.
    for _,c in ipairs(b2d.body.get_contact_data(body)) do
        for _,p in ipairs(c.points) do
            if p.separation<=0 or p.normal_impulse>0 or p.total_normal_impulse>0 then return true end
        end
    end
    return false
end
M.supported=supported
function M.observe(self,state,dt,sample)
    local r=self.seam_result
    -- Tuning changes invalidate even a completed result until Retry.
    for _,key in ipairs(feel.preset_keys) do
        if r.tuning_at_start[key]~=feel.values[key] then invalidate(r,"tuning changed") end
    end
    if r.done then if #r.reasons>0 then r.status="INVALID / NOT COMPARABLE" end;return end
    r.elapsed_s=r.elapsed_s+dt
    if math.abs(dt-M.protocol.dt_s)>.00001 then invalidate(r,"unexpected timestep") end
    local x,y,vx=feel.metres(state.x),feel.metres(state.y),feel.metres(state.vx)
    local vy=feel.metres(b2d.body.get_linear_velocity(self.vehicle.chassis).y)
    local w={}
    for i,body in ipairs(self.vehicle.wheels) do w[i]=feel.metres(b2d.body.get_position(body).x) end
    local c1,c2=supported(self.vehicle.wheels[1]),supported(self.vehicle.wheels[2])
    local prev=self.seam_previous
    local dv=prev and math.abs(vy-prev.vy) or 0
    local drop=prev and prev.vx-vx or 0
    local off_target=math.abs(vx-r.nominal_mps)>math.abs(r.nominal_mps)*M.protocol.tolerance_fraction
    local command=self.last_command or {}
    local expected=r.freewheel and 0 or math.min(1,math.max(0,r.nominal_mps/(math.abs(r.tuning_at_start.motor_speed)*.22)))
    local motors={b2d.joint.is_motor_enabled(self.vehicle.joints[1]),b2d.joint.is_motor_enabled(self.vehicle.joints[2])}
    if r.freewheel and (motors[1] or motors[2]) then invalidate(r,"freewheel motor unexpectedly enabled") end
    if (command.measurement_freewheel==true)~=r.freewheel then invalidate(r,"motor conditions differ from protocol") end
    if not command.throttle or math.abs(command.throttle-expected)>.000001 or command.brake_reverse~=0 or command.lean~=0 then invalidate(r,"commands differ from protocol") end
    if x>=self.station.baseline[1] and x<=self.station.baseline[2] then
        r.baseline_count=r.baseline_count+1;r.baseline_y_sum=r.baseline_y_sum+y
        r.baseline_vy_peak=math.max(r.baseline_vy_peak,math.abs(vy))
        r.baseline_dvy_peak=math.max(r.baseline_dvy_peak,dv)
        r.baseline_dvx_peak=math.max(r.baseline_dvx_peak,math.abs(drop))
        if off_target then invalidate(r,"baseline speed outside +/-5% window") end
        r.baseline_y_min=math.min(r.baseline_y_min or y,y);r.baseline_y_max=math.max(r.baseline_y_max or y,y)
        if not c1 or not c2 then invalidate(r,"baseline lacks loaded wheel contact") end
    end
    if x>=self.station.baseline[1] and x<=self.station.window[2]+1 then
        -- Raw sampled values, retained without application-level rounding.
        local spin={b2d.body.get_angular_velocity(self.vehicle.wheels[1]),b2d.body.get_angular_velocity(self.vehicle.wheels[2])}
        r.trace[#r.trace+1]={r.elapsed_s,dt,x,y,vx,vy,w[1],w[2],c1,c2,command.throttle,command.brake_reverse,command.lean,motors[1],motors[2],spin[1],spin[2]}
        r.wheel_spin_peak_rps=math.max(r.wheel_spin_peak_rps,math.abs(spin[1]),math.abs(spin[2]))
        -- At the cap the wheel cannot roll at chassis speed; seam response would be confounded.
        if r.wheel_spin_peak_rps>=M.protocol.rotation_cap_rps-M.protocol.rotation_margin_rps then invalidate(r,"wheel spin at engine rotation cap") end
    end
    local enter=self.station.window[1];local finish=self.station.window[2]
    if x>=enter and not r.entry_mps then
        r.entry_mps=vx;r.entry_x_m=x
        if not prev or prev.x>=enter or x-enter>vx*dt+.01 then invalidate(r,"missing entry boundary") end
        if off_target then invalidate(r,"entry speed outside +/-5% window") end
        if r.baseline_count<10 then invalidate(r,"insufficient baseline") end
        r.baseline_y=r.baseline_count>0 and r.baseline_y_sum/r.baseline_count or y
        r.threshold_vy_mps=math.max(M.protocol.vy_floor_mps,M.protocol.baseline_factor*r.baseline_vy_peak)
        r.threshold_dvy_mps=math.max(M.protocol.dvy_floor_mps,M.protocol.baseline_factor*r.baseline_dvy_peak)
        r.threshold_rise_m=math.max(M.protocol.rise_floor_m,M.protocol.baseline_factor*((r.baseline_y_max or y)-(r.baseline_y_min or y)))
        r.threshold_dvx_mps=math.max(M.protocol.dvx_floor_mps,M.protocol.baseline_factor*r.baseline_dvx_peak)
    end
    if r.entry_mps then
        -- Include the first sample beyond the exit, bounding the whole crossing.
        r.speed_min_mps=math.min(r.speed_min_mps or vx,vx);r.speed_max_mps=math.max(r.speed_max_mps or vx,vx)
        if r.freewheel then
            -- Free roll: seam speed loss is the measured outcome; gaining speed is not plausible.
            if vx>r.nominal_mps*(1+M.protocol.tolerance_fraction) then invalidate(r,"speed above +5% window") end
        elseif off_target then invalidate(r,"speed outside +/-5% window") end
        for _,s in ipairs(r.seams) do
            if math.abs(x-s.x_m)<=M.protocol.seam_radius_m then
                s.samples=s.samples+1;s.vy_peak_mps=math.max(s.vy_peak_mps,math.abs(vy));s.dvy_peak_mps=math.max(s.dvy_peak_mps,dv)
                s.rise_m=math.max(s.rise_m,y-r.baseline_y)
                s.dvx_drop_peak_mps=math.max(s.dvx_drop_peak_mps,drop)
                s.vx_first_mps=s.vx_first_mps or vx;s.vx_last_mps=vx
                if not c1 then s.wheel1_loss_samples=s.wheel1_loss_samples+1 end
                if not c2 then s.wheel2_loss_samples=s.wheel2_loss_samples+1 end
                if prev and not prev.c1 and c1 then s.wheel1_gains=s.wheel1_gains+1 end
                if prev and not prev.c2 and c2 then s.wheel2_gains=s.wheel2_gains+1 end
                if prev and prev.c1 and not c1 then s.wheel1_losses=s.wheel1_losses+1 end
                if prev and prev.c2 and not c2 then s.wheel2_losses=s.wheel2_losses+1 end
                if not c1 and not c2 then s.airborne_samples=s.airborne_samples+1 end
                if prev then
                    for i=1,2 do if prev.w[i]<s.x_m and w[i]>=s.x_m then s["wheel"..i.."_crossed"]=true end end
                end
            end
        end
        if x>=finish then
            r.done=true;r.exit_mps=vx;r.drift_mps=vx-r.entry_mps
        end
    end
    if r.elapsed_s>=M.protocol.max_elapsed_s and not r.done then
        invalidate(r,"incomplete window after 30 s observation");r.done=true
    end
    if r.done then
        -- Finalize observed diagnostics for completed AND incomplete windows.
        -- Missing/unobserved seams never acquire a comparison verdict.
        for _,s in ipairs(r.seams) do
            s.complete=s.samples>=2 and s.wheel1_crossed==true and s.wheel2_crossed==true
            if not s.complete then invalidate(r,"incomplete seam coverage") end
            s.vertical_bump=s.samples>0 and (s.vy_peak_mps>(r.threshold_vy_mps or math.huge) or s.dvy_peak_mps>(r.threshold_dvy_mps or math.huge) or s.rise_m>(r.threshold_rise_m or math.huge))
            s.longitudinal_hit=s.samples>0 and s.dvx_drop_peak_mps>(r.threshold_dvx_mps or math.huge)
            s.ghost_bump=s.vertical_bump or s.longitudinal_hit
            s.vx_loss_mps=s.samples>0 and s.vx_first_mps-s.vx_last_mps or 0
            if s.vertical_bump then r.vertical_bumps=r.vertical_bumps+1 end
            if s.longitudinal_hit then r.longitudinal_hits=r.longitudinal_hits+1 end
            if s.ghost_bump then r.ghost_bumps=r.ghost_bumps+1 end
            s.wheel1_loss_s=s.wheel1_loss_samples*M.protocol.dt_s;s.wheel2_loss_s=s.wheel2_loss_samples*M.protocol.dt_s
        end
        r.comparable=#r.reasons==0
        r.status=r.comparable and "VALID" or "INVALID / NOT COMPARABLE"
    end
    self.seam_previous={x=x,vx=vx,vy=vy,c1=c1,c2=c2,w=w}
end
function M.enrich(self,sample)
    local r=self.seam_result
    sample.station_result=string.format("%s | vx %.2f..%.2f | %s",r.status,r.speed_min_mps or 0,r.speed_max_mps or 0,r.comparable and string.format("bumps %d (vertical %d, longitudinal %d)",r.ghost_bumps,r.vertical_bumps,r.longitudinal_hits) or "bumps not comparable")
    if html5 then html5.run("window.riderStationReport="..json.encode(r)) end
end
return M
