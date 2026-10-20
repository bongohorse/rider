-- Debug-only A19c tick-command driver (case a19c); same sole owner and vehicle.apply as play.
-- Full throttle until the lip takeoff, then neutral drive with the requested lean held for the whole
-- flight (URL lean=-1|0|1, default 0), then neutral. No feedback or velocity correction.
local M={}
function M.command(self)
    if self.air_trial_lean==nil then
        local requested=html5 and tonumber(html5.run("new URLSearchParams(location.search).get('lean') || '0'")) or 0
        self.air_trial_lean=(requested==1 or requested==-1) and requested or 0
    end
    local a=self.air
    local flying=a and a.flight and a.flight.from_lip
    return {throttle=a and not a.lip_taken and 1 or 0,brake_reverse=0,lean=flying and self.air_trial_lean or 0,allow_reverse=false}
end
return M
