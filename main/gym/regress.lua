-- A22 regression traces (debug case a22 only; physics contract "Command playback and ghosts").
-- Check mode installs a stored format-version-1 trace and replays it through the shared A21 player (replay.lua):
-- one recorded command per fixed tick through vehicle.apply in the controller's fixed_update. No second loop, no
-- manual stepping. Record mode (deliberate regeneration only) drives the station protocol and records it with the
-- A21 recorder. Both modes start at the same fixed tick after vehicle-ready with the same neutral pre-roll.
-- Read-only besides that: the only other write is the declared debug perturbation of one preset value, through the
-- normal live-tuning path, before the replay starts.
local feel=require "main.gym.feel"
local replay=require "main.gym.replay"
local air_trial=require "main.gym.air_trial"
local gaps=require "main.gym.gap_metrics"
local air=require "main.gym.air_metrics"
local M={TUNE=15,START=30}

function M.new() return {ticks=0,phase="waiting",run_ticks=0} end
local function read(expr)
    local ok,d=pcall(json.decode,html5.run("JSON.stringify("..expr.."||null)"))
    if ok then return d end
end
local function publish(name,value) html5.run("window."..name.."="..json.encode(value)) end

-- Record mode only, while the recording runs: the station protocol driver (A19 full throttle, or the A19c air
-- protocol with the URL lean). Otherwise nil, so the pre-roll is the same neutral live command as in check mode.
function M.command(self)
    local s=self.regress_state
    local rec=self.replay.rec
    if not (s.spec and s.spec.mode=="record" and s.phase=="recording" and rec and rec.active) then return nil end
    if s.spec.program=="air" then return air_trial.command(self) end
    return {throttle=1,brake_reverse=0,lean=0,allow_reverse=false}
end

local function station_report(self)
    if self.station.kind=="gaps" then return gaps.report(self) end
    if self.station.kind=="air" then return air.report(self) end
    return false
end
local function finish(self,s,phase)
    s.phase=phase
    if s.tune then s.tune.applied=feel.values[s.tune.key]==s.tune.value end
    local result={phase=phase,error=s.error or false,top_speed_mps=s.top_speed_mps or false,top_tick=s.top_tick or false,run_ticks=s.run_ticks,
        start_tick=s.start_tick or false,preset=self.preset,modified=self.modified or false,station_report=station_report(self),tune=s.tune or false,
        damped_ticks=self.vehicle.damped_ticks or 0} -- #211: vehicle ticks with air pitch damping since the last reset
    publish("riderRegressResult",result)
end

-- After the tick's command was applied (controller fixed_update, vehicle ready).
function M.fixed(self)
    local s=self.regress_state
    local r=self.replay
    s.ticks=s.ticks+1
    if s.ticks==1 then s.spec=read("window.riderRegressSpec") or {} end
    local spec=s.spec
    -- Debug perturbation (check mode only): one preset value changed through the live-tuning path before the start.
    if s.ticks==M.TUNE and spec.mode=="check" and type(spec.tune)=="table" then
        s.tune={key=spec.tune.key,value=spec.tune.value}
        self.pending_tuning={key=spec.tune.key,value=spec.tune.value}
    end
    if s.ticks==M.START then
        s.start_tick=self.fixed_ticks
        if spec.mode=="record" then
            -- Traces are recorded on the measurement baseline only: preset A, unmodified.
            if self.preset~="a" or self.modified then s.error="record needs preset A unmodified";finish(self,s,"refused")
            else replay.toggle_record(self);s.phase="recording" end
        elseif spec.mode=="check" then
            local trace=read("window.riderRegressTrace")
            local ok,err
            if type(trace)=="table" and (trace.preset~="a" or trace.modified~=false) then ok,err=nil,"trace is not preset A unmodified"
            else ok,err=replay.install(self,trace) end
            if ok then replay.toggle_play(self);s.phase="replaying" else s.error=err;finish(self,s,"refused") end
        end
    end
    -- Top speed: chassis vx (m/s) at the start of every run tick (read after the command, before the step), the same
    -- ticks in both modes: recorded tick k and replayed (applied) tick k.
    local n
    if s.phase=="recording" and r.rec then n=r.rec.ticks elseif s.phase=="replaying" and r.play then n=r.play.applied or 0 end
    if n and n>s.run_ticks then
        s.run_ticks=n
        local vx=feel.metres(b2d.body.get_linear_velocity(self.vehicle.chassis).x)
        if not s.top_speed_mps or vx>s.top_speed_mps then s.top_speed_mps,s.top_tick=vx,n end
    end
    -- End: one tick after the last command in both modes (trailing pose captured / last pose compared).
    if s.phase=="recording" and r.rec and not r.rec.active and (r.rec.trailing or r.rec.error) then
        publish("riderRegressRecording",replay.export(r.rec))
        finish(self,s,"recorded")
    elseif s.phase=="replaying" and r.play and r.play.ended then
        finish(self,s,"replayed")
    end
    publish("riderRegress",{phase=s.phase,ticks=s.ticks,run_ticks=s.run_ticks,error=s.error or false})
end
return M
