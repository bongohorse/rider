-- Adapter to the existing controller/reset owner. Session state stays on that owner instance.
local run=require 'main.gym.run'
local best=require 'main.gym.run_best'
local medals=require 'main.gym.medals'
local M={}
function M.eligible(self)
    return self.station and (self.station.id=='first-run' or self.station.medal_times and self.station.finish) and not self.station.custom
        and self.station.start_speed==0 and self.preset=='a' and not self.modified
        and not self.invalid_preset and not self.preset_refused and self.crash_enabled
        and self.time_factor==1 and not self.pending_tuning and not self.pending_preset
        and not (self.replay.rec and self.replay.rec.active) and not (self.replay.play and not self.replay.play.ended)
        and self.testcase=='' and not sys.get_engine_info().is_debug
end
function M.ready(self)
    if not self.station or self.station.custom or (self.station.id~='first-run' and not (self.station.medal_times and self.station.finish)) then return end
    self.race=self.race or run.new(self.session_generation)
    self.personal=self.personal or best.new(medals.key(self.station))
    run.reset(self.race,M.eligible(self));self.race_step=nil;self.race_stopped=nil
end
function M.practice(self,reason) if self.race then run.practice(self.race,reason) end end
function M.failed(self,reason)
    if not self.race then return false end
    run.fail(self.race,self.race.id,reason);return true
end
function M.observe(self,dt)
    if not self.race then return end
    if not M.eligible(self) then M.practice(self,'Changed vehicle/rules or practice start') end
    -- The observed pose includes the preceding command's simulation step, never an upcoming one.
    if self.race_step then run.tick(self.race,self.race_step) end
    self.race_step=nil
end
function M.command(self,cmd,dt)
    local r=self.race;if not r then return cmd end
    if r.state=='ready' and (cmd.throttle>0 or cmd.brake_reverse>0 or cmd.lean~=0) then run.start(r,r.id) end
    if r.state~='running' then return {throttle=0,brake_reverse=0,lean=0,allow_reverse=false} end
    self.race_step=dt;return cmd
end
function M.finish(self)
    if not self.race then return end
    local result=run.finish(self.race,self.race.id)
    if result then
        result.medal=result.official and medals.award(self.station.medal_times,result.time) or 0
        self.race.new_best=best.offer(self.personal,result)
    end
end
function M.pause(self,active) if self.race then run.pause(self.race,active) end end
function M.update(self,dt)
    if not self.race then return end
    best.poll(self.personal)
    if run.terminal(self.race) and not self.race_stopped then
        self.race_stopped=true
        msg.post("main:/loader#script","run_stop",{generation=self.session_generation,id=self.race.id})
    end
    self.race_poll=(self.race_poll or 0)+dt
    if self.race_poll<.05 and self.race.state=='running' then return end
    self.race_poll=0
    local r=self.race
    local medal=r.result and r.result.medal or 0
    local next_name,next_time=medals.next(self.station.medal_times,medal)
    msg.post('main:/loader#ui','run_state',{generation=self.session_generation,id=r.id,state=r.state,time=r.result and r.result.time or r.elapsed,
        official=r.official,has_medals=self.station.medal_times~=nil,medal=medal,highest_medal=self.personal.medal or 0,next_medal=next_name,next_time=next_time,best=self.personal.best or 0,save=self.personal.status,new_best=r.new_best or false,reason=r.reason or '',practice=r.practice_reason or ''})
end
return M
