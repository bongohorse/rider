-- #438: one-shot sound cues, edge-detected from existing gameplay state. Presentation only: reads the
-- coin, fuel, run and finish state and the vehicle's contacts/velocity, never writes gameplay, physics
-- or scoring state, and adds no loop or tick. Mute, pause and the no-autoplay rule live in audio.effect.
local audio=require "main.game.audio"
local M={}
-- Hard landing: airborne (no chassis or wheel contact) for at least MIN_AIR s, and the last airborne
-- chassis vertical velocity was at least HARD_MPS downward.
M.MIN_AIR=0.25
M.HARD_MPS=4.5
-- Fixed step, after the step's observations: flight state for the landing cue.
-- touching = vehicle.touching (chassis or a wheel has contact data); vy_mps = chassis vertical velocity (m/s).
function M.fixed(self,touching,vy_mps,dt)
    local a=self.sfx_air
    if not a or a.resets~=self.reset_count then a={air=0,vy=0,resets=self.reset_count};self.sfx_air=a end
    if not touching then a.air,a.vy=a.air+dt,vy_mps
    else
        if a.air>=M.MIN_AIR and a.vy<=-M.HARD_MPS then self.sfx_landed=true end
        a.air=0
    end
end
-- True when value grew within the same attempt key since the last frame; a new attempt only re-baselines.
local function rose(self,key,attempt,value)
    local seen=self.sfx_seen
    if not seen then seen={value={},attempt={}};self.sfx_seen=seen end
    local up=seen.value[key]~=nil and seen.attempt[key]==attempt and value>seen.value[key]
    seen.value[key],seen.attempt[key]=value,attempt
    return up
end
-- Render frame: at most one voice per cue per frame.
function M.update(self)
    local c,f,r=self.coins,self.fuel,self.race
    if c and rose(self,"coin",self.coin_attempt,c.count) then audio.effect(self,"coin") end
    if c and rose(self,"gem",self.coin_attempt,c.gems) then audio.effect(self,"gem") end
    if f and rose(self,"fuel",self.fuel_attempt,f.collected) then audio.effect(self,"fuel") end
    -- Attempt ended: a level run fails (head or bounds; no automatic reset then). Worlds without a run
    -- (gym stations, custom levels) reset at once on a head or bounds crash, so that reset is the event.
    local crashed=r and rose(self,"crash",r.id,r.state=="failed" and 1 or 0)
    local reset=rose(self,"reset",0,self.reset_count or 0)
    if not r and reset and (self.last_reset_reason=="head" or self.last_reset_reason=="bounds") then crashed=true end
    if crashed then audio.effect(self,"crash") end
    if rose(self,"finish",0,self.finish_count or 0) then audio.effect(self,"finish") end
    -- A crash on impact already sounds, and an ended run is over: the landing cue is dropped, never queued.
    if self.sfx_landed then
        self.sfx_landed=false
        if not crashed and not (r and (r.state=="failed" or r.state=="finished")) then audio.effect(self,"land") end
    end
end
return M
