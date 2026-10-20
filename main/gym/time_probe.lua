-- A20 debug probe (case a20 only): read-only world time, tick and input state for the pause/slow-motion test.
-- World time is the sum of fixed-step dt (the Box2D step dt); wall time is socket.gettime (1 ms steps on HTML5).
local feel=require "main.gym.feel"
local socket=require "socket"
local M={}
local DRIVE={}
for _,id in ipairs({"throttle_up","throttle_w","brake_down","brake_s","lean_left","lean_right"}) do DRIVE[hash(id)]=true end
local function neutral(c) return not c or (c.throttle==0 and c.brake_reverse==0 and c.lean==0) end
function M.fixed(self,dt)
    self.time_last_dt=dt
    local r=self.since_resume
    if r and self.vehicle and self.vehicle.ready then
        r.ticks=r.ticks+1
        if not neutral(self.last_command) then r.driven=r.driven+1 end
    end
    -- Throttle from rest after a Retry: distance and speed after 1 s of world time, at the current factor.
    if not (self.vehicle and self.vehicle.ready) then return end
    local p=self.time_trial or {}
    self.time_trial=p
    local x=feel.metres(b2d.body.get_position(self.vehicle.chassis).x)
    if self.last_command and self.last_command.throttle==1 then
        if not p.start or p.start.resets~=self.reset_count then p.start={t=self.world_time,x=x,ticks=self.fixed_ticks,resets=self.reset_count};p.result=nil end
        if not p.result and self.world_time-p.start.t>=1 then
            p.result={factor=dt*60,world_s=self.world_time-p.start.t,ticks=self.fixed_ticks-p.start.ticks,dx_m=x-p.start.x,
                vx_mps=feel.metres(b2d.body.get_linear_velocity(self.vehicle.chassis).x),resets=self.reset_count}
        end
    else p.start=nil end
end
function M.update(self)
    if not html5 then return end
    local held=0
    for id in pairs(self.held) do if DRIVE[id] then held=held+1 end end
    local m=self.mobile or {}
    local state={generation=self.session_generation,station=self.station and self.station.id or false,paused=self.paused,factor=self.time_factor,
        world=self.world_time,ticks=self.fixed_ticks,dt=self.time_last_dt or false,scaled=self.time_scaled_ticks,wall=socket.gettime(),
        held=held,mobile=(m.throttle or m.brake or m.left or m.right) and true or false,command=self.last_command or false,
        resets=self.reset_count,dropped=self.time_dropped,since_resume=self.since_resume or false,
        trial=self.time_trial and self.time_trial.result or false}
    if self.vehicle and self.vehicle.ready then
        local p,v=b2d.body.get_position(self.vehicle.chassis),b2d.body.get_linear_velocity(self.vehicle.chassis)
        state.x,state.y,state.vx,state.vy=feel.metres(p.x),feel.metres(p.y),feel.metres(v.x),feel.metres(v.y)
    end
    html5.run("window.riderTime="..json.encode(state))
end
return M
