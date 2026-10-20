-- A19d debug-only tick-command driver; same sole owner and vehicle.apply as play.
-- Modes (window.riderBalanceTrial, read once per attempt generation): "idle" (no input), "full" (throttle
-- held), "skill" (slow closed-loop driving with key-like binary throttle/brake, recorded) and "replay"
-- (plays a recorded trace open-loop). Commands keep the keyboard shape: allow_reverse = not throttle.
-- With watch_plank=true in the same spec, the attempt also publishes the plank state every tick (#228).
local feel=require "main.gym.feel"
local seesaw=require "main.gym.seesaw"
local M={}
-- Skill controller, declared before evidence runs: speed reference sqrt(2 a d) capped at VMAX towards the
-- target centre; throttle below the reference band, brake above it, nothing inside it; every key state is
-- held for at least HOLD ticks (no faster than a 0.1 s key tap at 60 Hz).
M.skill={vmax=1.0,decel=0.8,band=0.08,hold=6}
local function key(throttle,brake) return {throttle=throttle,brake_reverse=brake,lean=0,allow_reverse=throttle==0} end
local function fresh(self)
    local ok,spec=pcall(json.decode,html5 and html5.run("JSON.stringify(window.riderBalanceTrial||null)") or "null")
    spec=ok and type(spec)=="table" and spec or {}
    local mode=({idle=true,full=true,skill=true,replay=true})[spec.mode] and spec.mode or "idle"
    return {generation=self.generation,section=self.station.section_index,mode=mode,replay=type(spec.trace)=="table" and spec.trace or {},
        trace={},tick=0,at=1,used=0,throttle=0,brake=0,held=M.skill.hold,watch=spec.watch_plank==true}
end
local function record(t,c)
    local last=t.trace[#t.trace]
    if last and last[2]==c.throttle and last[3]==c.brake_reverse then last[1]=last[1]+1
    else t.trace[#t.trace+1]={1,c.throttle,c.brake_reverse} end
end
local function skill(self,t)
    local s=self.station.sections[self.station.section_index]
    local p=b2d.body.get_position(self.vehicle.chassis)
    local x,vx=feel.metres(p.x),feel.metres(b2d.body.get_linear_velocity(self.vehicle.chassis).x)
    local d=(s.target_x0+s.target_x1)/2-x
    local ref=d>0 and math.min(M.skill.vmax,math.sqrt(2*M.skill.decel*d)) or 0
    local throttle,brake=0,0
    if vx<ref-M.skill.band then throttle=1 elseif vx>ref+M.skill.band then brake=1 end
    t.held=t.held+1
    if (throttle~=t.throttle or brake~=t.brake) and t.held>=M.skill.hold then t.throttle,t.brake,t.held=throttle,brake,0 end
    return key(t.throttle,t.brake)
end
function M.command(self)
    if self.station.kind~="balance" then return nil end
    local t=self.balance_trial_state
    if not t or t.generation~=self.generation or t.section~=self.station.section_index then t=fresh(self);self.balance_trial_state=t end
    t.tick=t.tick+1
    local c
    if t.mode=="full" then c=key(1,0)
    elseif t.mode=="skill" then c=skill(self,t)
    elseif t.mode=="replay" then
        local entry=t.replay[t.at]
        if entry then
            c=key(entry[2],entry[3])
            t.used=t.used+1
            if t.used>=entry[1] then t.at,t.used=t.at+1,0 end
        else c=key(0,0) end
    else c=key(0,0) end
    record(t,c)
    -- Per-tick plank state for the runner (#228), only for an attempt the probe watches (watch_plank): a seesaw
    -- swing can be shorter than the 0.25 s report interval, and several ticks can run per frame, so the first
    -- tick after the tip with |omega| > 0.2 is latched. This module is loaded for debug a19d only.
    if t.watch and html5 and self.seesaw and self.balance then
        local st,q=seesaw.state(self.seesaw),self.balance.record.seesaw
        local tipped=q and q.tip_at~=nil
        if tipped and not t.swing and math.abs(st.omega)>0.2 then t.swing={tick=t.tick,omega=st.omega} end
        html5.run(string.format("window.riderPlank={generation:%d,tick:%d,angle:%.9g,omega:%.9g,tipped:%s,swing_tick:%s,swing_omega:%s}",
            self.generation,t.tick,st.angle,st.omega,tipped and "true" or "false",t.swing and t.swing.tick or "null",t.swing and string.format("%.9g",t.swing.omega) or "null"))
    end
    return c
end
function M.report(self)
    local t=self.balance_trial_state
    if not t then return nil end
    return {mode=t.mode,generation=t.generation,ticks=t.tick,trace=t.trace,controller=M.skill}
end
return M
