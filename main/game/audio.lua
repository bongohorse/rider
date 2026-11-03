-- One voice per session; raw wheel angular speed controls playback ratio.
local M={idle_pitch=0.65,pitch_per_rad=0.045,max_pitch=2.2,gain=0.08}
function M.pitch(omega) return math.min(M.max_pitch,M.idle_pitch+math.abs(omega)*M.pitch_per_rad) end
function M.start(self)
    if self.audio_started then return end
    self.audio_started=true;self.audio_starts=(self.audio_starts or 0)+1
    self.audio_pitch=M.idle_pitch
    go.set("#engine","gain",(self.audio_muted or self.audio_paused) and 0 or M.gain)
    go.set("#engine","speed",self.audio_pitch)
    sound.play("#engine")
end
-- #438: one-shot effects (sfx_<name>.sound on the controller GO) and their per-voice gain. Presentation only.
M.effects={coin=0.15,gem=0.18,fuel=0.15,land=0.2,crash=0.2,finish=0.15}
-- Plays one voice unless the engine voice has not started (no autoplay before input), the player muted
-- or the world is paused; a dropped event is not queued. Returns whether it played.
function M.effect(self,name)
    local gain=M.effects[name]
    if not gain or not self.audio_started or self.audio_muted or self.audio_paused then return false end
    sound.play("#sfx_"..name,{gain=gain})
    self.audio_effects=self.audio_effects or {}
    self.audio_effects[name]=(self.audio_effects[name] or 0)+1
    return true
end
-- Mute and pause also cut effects that are still ringing.
local function silence(self)
    if not self.audio_started then return end
    for name in pairs(M.effects) do sound.stop("#sfx_"..name) end
end
function M.mute(self)
    self.audio_muted=not self.audio_muted
    go.set("#engine","gain",(self.audio_muted or self.audio_paused) and 0 or M.gain)
    if self.audio_muted then silence(self) end
end
-- A20: a paused world is silent (gain 0); slow motion keeps the wheel-speed pitch.
function M.pause(self,paused)
    self.audio_paused=paused
    if self.audio_started then go.set("#engine","gain",(self.audio_muted or paused) and 0 or M.gain) end
    if paused then silence(self) end
end
function M.update(self)
    if not self.audio_started or not self.vehicle or not self.vehicle.ready then return end
    local omega=0
    for _,wheel in ipairs(self.vehicle.wheels) do omega=omega+math.abs(b2d.body.get_angular_velocity(wheel))/2 end
    self.audio_pitch=M.pitch(omega)
    go.set("#engine","speed",self.audio_pitch)
end
function M.stop(self) if self.audio_started then sound.stop("#engine");silence(self) end end
return M
