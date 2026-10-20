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
function M.mute(self)
    self.audio_muted=not self.audio_muted
    go.set("#engine","gain",(self.audio_muted or self.audio_paused) and 0 or M.gain)
end
-- A20: a paused world is silent (gain 0); slow motion keeps the wheel-speed pitch.
function M.pause(self,paused)
    self.audio_paused=paused
    if self.audio_started then go.set("#engine","gain",(self.audio_muted or paused) and 0 or M.gain) end
end
function M.update(self)
    if not self.audio_started or not self.vehicle or not self.vehicle.ready then return end
    local omega=0
    for _,wheel in ipairs(self.vehicle.wheels) do omega=omega+math.abs(b2d.body.get_angular_velocity(wheel))/2 end
    self.audio_pitch=M.pitch(omega)
    go.set("#engine","speed",self.audio_pitch)
end
function M.stop(self) if self.audio_started then sound.stop("#engine") end end
return M
