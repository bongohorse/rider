-- A19d Balance: read-only completed-step observations; no tuning, limits or reset requests.
-- Lengths in metres, angles in rad, speeds in m/s (converted once via feel.metres).
local feel=require "main.gym.feel"
local seams=require "main.gym.seam_metrics"
local seesaw=require "main.gym.seesaw"
local M={}
-- Declared before evidence runs (README "Balance").
M.protocol={stop_speed=0.05,stop_pitch=0.6,stop_hold_s=1.0,fall_drop=0.35,flip_pitch=1.6,timeout_s=30,
    seesaw_rest_s=0.5,seesaw_settle_omega=0.05,seesaw_settle_s=0.25}
function M.restart(self)
    local s=self.station.sections[self.station.section_index]
    -- The replaced attempt's plank extremes up to this reset (report only): a runner that sees the next
    -- generation first still learns whether the limit was reached after its last report.
    local old=self.balance and self.balance.record.seesaw
    local previous=old and {generation=old.generation,limit_reached=old.limit_reached,max_abs_angle=old.max_abs_angle} or nil
    self.balance={previous=previous,tuning_changed=false,tuning={},record={id=s.id,type=s.type,status="RUNNING",elapsed=0,target_x0=s.target_x0,target_x1=s.target_x1,
        target_y=s.target_y,start_speed=self.station.start_speed,max_speed_mps=0,throttle_s=0,brake_s=0,lean_max=0,input_changes=0,
        pitch_min=0,pitch_max=0,held_s=0}}
    for _,key in ipairs(feel.preset_keys) do self.balance.tuning[key]=feel.values[key] end
    if self.seesaw then
        local r=self.balance.record
        r.seesaw={reset=self.seesaw.last_reset,generation=self.seesaw.generation,max_abs_angle=0,max_abs_omega=0,limit=self.station.seesaw.limit,
            rest_target=self.station.seesaw.rest_angle,limit_reached=false}
    end
end
local function seesaw_observe(self,r)
    local q=r.seesaw
    if not q then return end
    local st=seesaw.state(self.seesaw)
    local p=M.protocol
    q.angle,q.omega=st.angle,st.omega
    q.max_abs_angle=math.max(q.max_abs_angle,math.abs(st.joint_angle))
    q.max_abs_omega=math.max(q.max_abs_omega,math.abs(st.omega))
    -- The ±limit is a safety stop only; the decks should hold the plank before it.
    if math.abs(st.joint_angle)>=q.limit-0.005 then q.limit_reached=true end
    if not q.rest_angle and r.elapsed>=p.seesaw_rest_s then q.rest_angle=st.angle end
    if not q.tip_at and st.angle<0 then q.tip_at=r.elapsed end
    if q.tip_at and not q.settled_at then
        q.calm=math.abs(st.omega)<p.seesaw_settle_omega and (q.calm or 0)+self.balance.dt or 0
        if q.calm>=p.seesaw_settle_s then q.settled_at=r.elapsed-q.calm;q.settled_angle=st.angle end
    end
    -- Final plank pose after the verdict: the vehicle leaving the plank tip can still move it.
    if r.done and not q.final_at then
        q.final_calm=math.abs(st.omega)<p.seesaw_settle_omega and (q.final_calm or 0)+self.balance.dt or 0
        if q.final_calm>=p.seesaw_settle_s then q.final_at=r.elapsed;q.final_angle=st.angle end
    end
end
function M.observe(self,state,dt,sample)
    local b=self.balance
    for _,key in ipairs(feel.preset_keys) do if b.tuning[key]~=feel.values[key] then b.tuning_changed=true end end
    local r=b.record
    b.dt=dt
    if r.done then
        -- The plank is still observed after the verdict (settling can outlast the stop).
        r.elapsed=r.elapsed+dt
        seesaw_observe(self,r)
        return
    end
    local p=M.protocol
    local v=self.vehicle
    local x,vx=feel.metres(state.x),feel.metres(state.vx)
    local wheels={}
    for i=1,2 do
        local w=b2d.body.get_position(v.wheels[i])
        wheels[i]={x=feel.metres(w.x),y=feel.metres(w.y),supported=seams.supported(v.wheels[i])}
    end
    r.elapsed=r.elapsed+dt
    local c=self.last_command
    if c.throttle>0 then r.throttle_s=r.throttle_s+dt end
    if c.brake_reverse>0 then r.brake_s=r.brake_s+dt end
    r.lean_max=math.max(r.lean_max,math.abs(c.lean))
    local key=c.throttle..":"..c.brake_reverse..":"..c.lean
    if b.last_key and key~=b.last_key then r.input_changes=r.input_changes+1 end
    b.last_key=key
    r.max_speed_mps=math.max(r.max_speed_mps,math.abs(vx))
    r.pitch_min,r.pitch_max=math.min(r.pitch_min,state.angle),math.max(r.pitch_max,state.angle)
    seesaw_observe(self,r)
    -- Stopped on the target: both wheel centres over it and loaded, slow and level enough, held.
    local on=true
    for i=1,2 do
        local w=wheels[i]
        if not w.supported or w.x<r.target_x0 or w.x>r.target_x1 or w.y<r.target_y then on=false end
    end
    local stopped=on and math.abs(vx)<p.stop_speed and math.abs(state.angle)<p.stop_pitch
    r.held_s=stopped and r.held_s+dt or 0
    local low=math.min(wheels[1].y,wheels[2].y)
    if r.held_s>=p.stop_hold_s then
        r.status="COMPLETED";r.reason="stopped on target"
    elseif low<r.target_y-p.fall_drop then
        r.status="MISSED";r.reason="fell"
    elseif math.abs(state.angle)>p.flip_pitch then
        r.status="MISSED";r.reason="flipped"
    elseif r.elapsed>=p.timeout_s then
        r.status="MISSED";r.reason="timeout"
    end
    if r.status~="RUNNING" then
        r.done=true;r.time_s=r.elapsed;r.chassis_x=x
        r.rear_x,r.front_x=math.min(wheels[1].x,wheels[2].x),math.max(wheels[1].x,wheels[2].x)
        -- Distances from the wheel centres to the target edges (negative = outside).
        r.margin_rear_m,r.margin_front_m=r.rear_x-r.target_x0,r.target_x1-r.front_x
    end
end
function M.report(self)
    local world=b2d.world.get_counters(b2d.body.get_world(self.terrain))
    local report={kind="balance",station=self.station.id,section=self.station.sections[self.station.section_index].id,
        source_sha=sys.get_config_string("rider.source_sha","development"),preset=self.preset,modified=self.modified or false,
        automated=self.testcase=="a19d",tuning=feel.snapshot(),start_speed=self.station.start_speed,comparable=not self.balance.tuning_changed,
        record=self.balance.record,previous=self.balance.previous,reset_reason=self.last_reset_reason,protocol=M.protocol,generation=self.generation,bodies=world.body_count,joints=world.joint_count,
        conditions="Independent starts from rest on a raised deck 0.8 m above the floor. Completed = both wheel centres over the target platform with loaded support (touching or impulsive manifold point), |vx| < 0.05 m/s and |pitch| < 0.6 rad held for 1 s. Missed = a wheel centre 0.35 m below the target top (fell), |pitch| > 1.6 rad (flipped) or 30 s. Seesaw: tip = plank angle crosses level; settled = |omega| < 0.05 rad/s for 0.25 s after the tip; the joint limit is a safety stop."}
    if self.seesaw then
        local st=seesaw.state(self.seesaw)
        report.seesaw={angle=st.angle,omega=st.omega,x=st.x,y=st.y,joint_angle=st.joint_angle,generation=self.seesaw.generation,
            joint_valid=b2d.joint.is_valid(self.seesaw.joint),plank_joints=#b2d.body.get_joints(self.seesaw.body),mass=self.seesaw.mass,
            reset=self.seesaw.last_reset}
    end
    if self.balance_trial then report.trial=self.balance_trial.report(self) end
    return report
end
function M.enrich(self,sample)
    local report=M.report(self)
    local r=report.record
    sample.station_result=string.format("%s %s | %.1f s",r.id,r.status,r.time_s or r.elapsed)
    if self.balance.tuning_changed then sample.station_result="Tuning changed; Retry for comparable results" end
    if html5 then html5.run("window.riderStationReport="..json.encode(report)) end
end
return M
