-- Debug-only stock-A coast/brake observer (#345). Called only by the controller's existing fixed_update.
-- No second physics loop, no timing callbacks, no changes to vehicle/preset behavior.
local feel=require "main.gym.feel"
local vehicle=require "main.gym.vehicle"
local stations=require "main.gym.stations"
local replay=require "main.gym.replay"
local M={SETTLE=90,CAP=1200,ORDER={"coast","brake","coast"}}
local emit,request_reset
function M.bind(emitter,resetter) emit,request_reset=emitter,resetter end
function M.new() return {phase="settle",settle=0,index=1,runs={},last_tick=false} end
local function contact(v)
    return #b2d.body.get_contact_data(v.wheels[1])>0,#b2d.body.get_contact_data(v.wheels[2])>0
end
local function sample(self,tick)
    local v=self.vehicle
    local s=vehicle.state(v)
    local a,b=contact(v)
    -- Compact trace: [completed ticks, chassis x (m), chassis vx (m/s), rear contact, front contact,
    -- rear omega (rad/s), front omega (rad/s)]. Read before the next command, after prior engine step.
    return {tick,feel.metres(s.x),feel.metres(s.vx),a,b,
        b2d.body.get_angular_velocity(v.wheels[1]),b2d.body.get_angular_velocity(v.wheels[2])}
end
local function finish(self,status,reason)
    local s=self.coast_measure_state
    if s.phase=="done" then return end
    s.phase="done"
    local result={status=status,error=reason or false,source_sha=sys.get_config_string("rider.source_sha","development"),
        run_id=self.run_id,station=self.station and self.station.id or false,preset=self.preset,
        modified=self.modified or false,config_identity=replay.identity(),
        physics_hz=60,render_fps=sys.get_config_int("display.update_frequency",60),
        physics_scale=sys.get_config_number("physics.scale",0.01),time_factor=self.time_factor,
        scaled_ticks=self.time_scaled_ticks,runs=s.runs,completed=#s.runs}
    if status=="PASS" then
        result.repeat_delta_m=s.runs[3].distance_m-s.runs[1].distance_m
        result.repeat_delta_s=s.runs[3].seconds-s.runs[1].seconds
    end
    html5.run("window.riderCoastMeasureResult="..json.encode(result))
    emit(self,"suite_end",{status=status,cases={coast_measure=status=="PASS",completed=#s.runs,
        error=reason or false}})
end
local function fail(self,reason) finish(self,"FAIL",reason) end
local function invariant(self)
    if self.station.id~="straight" or self.station.start_speed~=0 or self.station.sections then return "not stock Straight at 0 m/s" end
    if self.preset~="a" or self.modified then return "not unmodified preset A" end
    if self.time_factor~=1 or self.time_scaled_ticks~=0 then return "scaled physics tick" end
    if self.paused then return "paused during measurement" end
    if self.pending_section or self.pending_preset or self.pending_tuning then return "unexpected station/preset/tuning change" end
    if sys.get_config_number("physics.scale",0.01)~=0.01 then return "unexpected physics scale" end
    local sha=sys.get_config_string("rider.source_sha","development")
    if #sha~=40 or not sha:match("^[0-9a-f]+$") or self.run_id=="interactive" then return "missing source/run identity" end
    if stations.outside(self.station,vehicle.state(self.vehicle)) then return "outside Straight bounds" end
end
-- The only test-specific velocity seed is the existing coast Gym technique, after 90 settled
-- owner ticks and *verified* dual wheel support. Every subsequent tick uses normal vehicle.apply.
local function seed(self)
    local v=self.vehicle
    local a,b=contact(v)
    local vx=feel.metres(vehicle.state(v).vx)
    if not (a and b and math.abs(vx)<0.1) then
        return fail(self,"unsettled/ungrounded 5 m/s start: contacts="..tostring(a)..","..tostring(b).." vx="..vx)
    end
    for _,body in ipairs({v.chassis,v.wheels[1],v.wheels[2]}) do
        b2d.body.set_linear_velocity(body,vmath.vector3(500,0,0))
    end
    for _,wheel in ipairs(v.wheels) do b2d.body.set_angular_velocity(wheel,-500/22) end
    local initial=sample(self,0)
    if math.abs(initial[3]-5)>1e-6 or not (initial[4] and initial[5]) then
        return fail(self,"seed failed to establish grounded 5.0 m/s")
    end
    local first=self.coast_measure_state.runs[1]
    if first and (math.abs(first.start[2]-initial[2])>0.02 or
        math.abs(first.start[3]-initial[3])>1e-6 or
        first.start[4]~=initial[4] or first.start[5]~=initial[5]) then
        return fail(self,"run starts differ after canonical reset/settle")
    end
    local s=self.coast_measure_state
    s.current={kind=M.ORDER[s.index],start=initial,trace={initial},commands={},
        start_fixed_tick=self.fixed_ticks}
    s.last_tick=self.fixed_ticks
    s.phase="running"
end
local function finish_run(self)
    local s=self.coast_measure_state
    local r=s.current
    if #r.commands~=#r.trace-1 then return fail(self,"missing/duplicate fixed-tick commands") end
    local last=r.trace[#r.trace]
    r.ticks=last[1]
    r.seconds=r.ticks/60
    r.distance_m=last[2]-r.start[2]
    r.stop=last
    if r.ticks<1 or r.distance_m<0 then return fail(self,"invalid stop interval/distance") end
    s.runs[#s.runs+1]=r
    s.current=nil
    if s.index==#M.ORDER then finish(self,"PASS");return end
    s.index=s.index+1
    s.phase="reset_pending"
    s.reset_count=self.reset_count
    request_reset(self,"coast_measure")
end
-- Read after last physics step, before the one normalized command of this fixed tick.
function M.before(self,dt)
    local s=self.coast_measure_state
    if s.phase=="done" then return end
    if math.abs(dt*60-1)>1e-4 then return fail(self,"not a 60-Hz owner tick") end
    local err=invariant(self)
    if err then return fail(self,err) end
    if s.phase=="reset_pending" then
        if self.reset_count~=s.reset_count+1 or self.last_reset_reason~="coast_measure" then
            return fail(self,"expected one canonical Retry before next run")
        end
        s.phase,s.settle,s.last_tick="settle",0,false
    elseif self.pending_reset then return fail(self,"unexpected reset during measurement") end
    if s.phase=="settle" then
        s.settle=s.settle+1
        if s.settle==M.SETTLE then seed(self) end
    elseif s.phase=="running" then
        if self.fixed_ticks~=s.last_tick+1 then return fail(self,"missing or repeated fixed tick") end
        local r=s.current
        local n=#r.trace
        local q=sample(self,n)
        r.trace[#r.trace+1]=q
        s.last_tick=self.fixed_ticks
        if not (q[4] or q[5]) then return fail(self,"lost all wheel contact at tick "..n) end
        if math.abs(q[3])<0.1 then finish_run(self)
        elseif n>=M.CAP then fail(self,"no stop below 0.1 m/s within "..M.CAP.." ticks")
        elseif q[3]<-0.1 then fail(self,"unexpected reversal") end
    end
end
-- The brake is explicitly non-reversing; all commands pass through the normal owner vehicle.apply.
function M.command(self)
    local s=self.coast_measure_state
    return {throttle=0,brake_reverse=(s.phase=="running" and s.index==2) and 1 or 0,
        lean=0,allow_reverse=false}
end
function M.after(self)
    local s=self.coast_measure_state
    if s.phase=="done" then return end
    local c=self.last_command
    local want=(s.phase=="running" and s.index==2) and 1 or 0
    if not c or c.throttle~=0 or c.brake_reverse~=want or c.lean~=0 or c.allow_reverse~=false then
        return fail(self,"normalized command changed before vehicle.apply")
    end
    if s.phase=="running" then
        local r=s.current
        r.commands[#r.commands+1]={c.throttle,c.brake_reverse,c.lean,c.allow_reverse}
    end
end
return M
