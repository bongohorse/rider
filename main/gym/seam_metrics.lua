-- Read-only completed-step observer. No physics mutation or second tick owner.
local feel=require "main.gym.feel"
local M={}
M.protocol={version=2,tolerance_fraction=.05,dt_s=1/60,seam_radius_m=1,
    vy_floor_mps=.1,dvy_floor_mps=.1,rise_floor_m=.005,baseline_factor=3,
    max_elapsed_s=30,repeat_speed_mps=.02,repeat_peak_mps=.02,repeat_rise_m=.002,
    sampling="Completed engine steps at 60 Hz (4 solver substeps); no substep contact claims",
    commands="Debug v2: throttle=brake=lean=0, motors disabled and passive coast/rolling moments absent. No tuning changes. Powered v1 control: throttle=clamp(nominal/(abs(preset motor_speed)*0.22),0,1); brake=0; lean=0. normal drive motor. No speed correction",
    ghost_rule="Per seam: abs(chassis vy), abs(delta vy) or rise above baseline mean exceeds max(floor,3*baseline peak); count a seam once. Contact loss separately recorded; sampled coincidence is not causal proof"}
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
        baseline_vy_peak=0,baseline_dvy_peak=0,ghost_bumps=0}
    for _,key in ipairs(feel.preset_keys) do r.tuning_at_start[key]=feel.values[key] end
    for i,x in ipairs(self.station.seams) do r.seams[i]={id=i,x_m=x,samples=0,vy_peak_mps=0,dvy_peak_mps=0,rise_m=0,
        wheel1_loss_samples=0,wheel2_loss_samples=0,wheel1_losses=0,wheel2_losses=0,wheel1_gains=0,wheel2_gains=0,airborne_samples=0,ghost_bump=false} end
    if r.nominal_mps~=5 and r.nominal_mps~=15 and r.nominal_mps~=30 then invalidate(r,"unsupported nominal speed") end
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
    local command=self.last_command or {}
    local expected=r.freewheel and 0 or math.min(1,math.max(0,r.nominal_mps/(math.abs(r.tuning_at_start.motor_speed)*.22)))
    if (command.measurement_freewheel==true)~=r.freewheel then invalidate(r,"motor conditions differ from protocol") end
    if not command.throttle or math.abs(command.throttle-expected)>.000001 or command.brake_reverse~=0 or command.lean~=0 then invalidate(r,"commands differ from protocol") end
    if x>=self.station.baseline[1] and x<=self.station.baseline[2] then
        r.baseline_count=r.baseline_count+1;r.baseline_y_sum=r.baseline_y_sum+y
        r.baseline_vy_peak=math.max(r.baseline_vy_peak,math.abs(vy))
        r.baseline_dvy_peak=math.max(r.baseline_dvy_peak,dv)
        r.baseline_y_min=math.min(r.baseline_y_min or y,y);r.baseline_y_max=math.max(r.baseline_y_max or y,y)
        if not c1 or not c2 then invalidate(r,"baseline lacks loaded wheel contact") end
    end
    if x>=self.station.baseline[1] and x<=self.station.window[2]+1 then
        -- Lossless sampled values (JSON numbers, no rounding), retained once/run.
        r.trace[#r.trace+1]={r.elapsed_s,dt,x,y,vx,vy,w[1],w[2],c1,c2,command.throttle,command.brake_reverse,command.lean}
    end
    local enter=self.station.window[1];local finish=self.station.window[2]
    if x>=enter and not r.entry_mps then
        r.entry_mps=vx;r.entry_x_m=x
        if not prev or prev.x>=enter or x-enter>vx*dt+.01 then invalidate(r,"missing entry boundary") end
        if r.baseline_count<10 then invalidate(r,"insufficient baseline") end
        r.baseline_y=r.baseline_count>0 and r.baseline_y_sum/r.baseline_count or y
        r.threshold_vy_mps=math.max(M.protocol.vy_floor_mps,M.protocol.baseline_factor*r.baseline_vy_peak)
        r.threshold_dvy_mps=math.max(M.protocol.dvy_floor_mps,M.protocol.baseline_factor*r.baseline_dvy_peak)
        r.threshold_rise_m=math.max(M.protocol.rise_floor_m,M.protocol.baseline_factor*((r.baseline_y_max or y)-(r.baseline_y_min or y)))
    end
    if r.entry_mps then
        -- Include the first sample beyond the exit, bounding the whole crossing.
        r.speed_min_mps=math.min(r.speed_min_mps or vx,vx);r.speed_max_mps=math.max(r.speed_max_mps or vx,vx)
        if math.abs(vx-r.nominal_mps)>math.abs(r.nominal_mps)*M.protocol.tolerance_fraction then invalidate(r,"speed outside +/-5% window") end
        for _,s in ipairs(r.seams) do
            if math.abs(x-s.x_m)<=M.protocol.seam_radius_m then
                s.samples=s.samples+1;s.vy_peak_mps=math.max(s.vy_peak_mps,math.abs(vy));s.dvy_peak_mps=math.max(s.dvy_peak_mps,dv)
                s.rise_m=math.max(s.rise_m,y-r.baseline_y)
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
            for _,s in ipairs(r.seams) do
                if s.samples<2 or not s.wheel1_crossed or not s.wheel2_crossed then invalidate(r,"incomplete seam coverage") end
                s.ghost_bump=s.vy_peak_mps>r.threshold_vy_mps or s.dvy_peak_mps>r.threshold_dvy_mps or s.rise_m>r.threshold_rise_m
                if s.ghost_bump then r.ghost_bumps=r.ghost_bumps+1 end
                s.wheel1_loss_s=s.wheel1_loss_samples*M.protocol.dt_s;s.wheel2_loss_s=s.wheel2_loss_samples*M.protocol.dt_s
            end
            r.comparable=#r.reasons==0
            r.status=r.comparable and "VALID" or "INVALID / NOT COMPARABLE"
        end
    end
    if r.elapsed_s>=M.protocol.max_elapsed_s and not r.done then
        invalidate(r,"incomplete window after 30 s observation");r.done=true;r.status="INVALID / NOT COMPARABLE"
    end
    self.seam_previous={x=x,vy=vy,c1=c1,c2=c2,w=w}
end
function M.enrich(self,sample)
    local r=self.seam_result
    sample.station_result=string.format("%s | vx %.2f..%.2f | %s",r.status,r.speed_min_mps or 0,r.speed_max_mps or 0,r.comparable and ("bumps "..r.ghost_bumps) or "bumps not comparable")
    if html5 then html5.run("window.riderStationReport="..json.encode(r)) end
end
return M
