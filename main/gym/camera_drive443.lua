-- #443 (cam443): debug-only scripted drive for the camera A/B toggle case. One command per fixed tick, chosen only
-- from the tick count since the last reset (and, for the air lip, the existing air observer), never from live
-- input, so a camera-A run and a run that switches the camera live get exactly the same commands on every tick.
-- The controller stays the sole tick owner: this is one more command source in its fixed_update, ahead of live input.
-- Selected by the page URL `drive443`; without it (or with an unknown value) live input drives as usual.
local ramp_trial=require "main.gym.ramp_trial"
local air_trial=require "main.gym.air_trial"
local M={}
-- Straight reverse: full throttle, then held brake (reverse allowed) through the stop and the reverse latch.
M.REVERSE_THROTTLE_TICKS=90
-- ramp: ramps-long down-30 neutral from the authored 1 m/s (the a16 downhill protocol); air: the A19c driver
-- (throttle to the lip, the URL `lean` held in flight); reverse: the Straight script above.
M.SCRIPTS={ramp=true,air=true,reverse=true}
function M.new()
    local name=html5 and html5.run("new URLSearchParams(location.search).get('drive443') || ''") or ""
    if not M.SCRIPTS[name] then return nil end
    local d={script=name,generation=false,tick=0}
    function d.command(self) return M.command(d,self) end
    return d
end
function M.command(d,self)
    -- A Retry (record, replay, manual) starts the script again from its first tick.
    if d.generation~=self.generation then d.generation,d.tick=self.generation,0 end
    d.tick=d.tick+1
    if d.script=="ramp" then return ramp_trial.command(self.station) end
    if d.script=="air" then return air_trial.command(self) end
    if d.tick<=M.REVERSE_THROTTLE_TICKS then return {throttle=1,brake_reverse=0,lean=0,allow_reverse=false} end
    return {throttle=0,brake_reverse=1,lean=0,allow_reverse=true}
end
return M
