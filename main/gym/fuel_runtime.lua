local fuel=require 'main.gym.fuel'
local M={}
function M.reset(self)
    self.fuel=fuel.new(self.station and self.station.fuel);self.fuel_step=nil;self.fuel_publish=nil
end
function M.observe(self)
    local t=self.fuel
    if t and self.fuel_step then fuel.consume(t,self.fuel_step,t.power);self.fuel_step=nil end
end
function M.command(self,cmd,dt)
    local t=self.fuel;if not t then return end
    if cmd.throttle>0 or cmd.brake_reverse>0 or cmd.lean~=0 then t.started=true end
    local active=self.race and self.race.state=='running' or not self.race and t.started and not self.finish_done and not self.paused
    if active then self.fuel_step=dt end
    cmd.fuel_empty=t.amount<=0
end
function M.update(self)
    local t=self.fuel;if not t then return end
    local d=t and {generation=self.session_generation,amount=t.amount,start=t.config.start,time=t.config.time,drive=t.config.drive,warning=t.config.warning,
        collected=t.collected,feedback=t.feedback,empty=t.amount<=0,low=t.amount<=t.config.warning,text=fuel.label(t),power=t.power} or {generation=self.session_generation,disabled=true}
    local encoded=json.encode(d)
    if encoded~=self.fuel_publish then self.fuel_publish=encoded;msg.post('main:/loader#ui','fuel_state',d) end
    if t then t.feedback=0 end
end
return M
