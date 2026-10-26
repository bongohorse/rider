-- Adapter inside the existing tick owner; the route is immutable and never controls a run.
local route=require 'main.gym.course_progress'
local feel=require 'main.gym.feel'
local M={}
local function phase(self)
    return self.race and self.race.state or self.finish_done and 'finished' or self.paused and 'paused' or 'running'
end
function M.reset(self)
    if not self.progress then
        local reference,why=route.prepare(self.station)
        self.progress={route=reference,reason=why,enabled=self.station.finish~=nil}
    end
    self.progress.distance,self.progress.fraction,self.progress.gap,self.progress.error=0,0,false,nil
    self.progress.sent=nil
end
function M.observe(self,state)
    local p=self.progress;if not p or not p.route then return end
    local status=phase(self)
    if status=='finished' then p.distance,p.fraction,p.gap,p.error=p.route.length,1,false,nil
    elseif status=='ready' then p.distance,p.fraction,p.gap,p.error=0,0,false,nil
    elseif status=='running' then
        local distance,err,gap=route.position(p.route,feel.metres(state.x),feel.metres(state.y))
        p.error=err
        if distance then p.distance,p.fraction,p.gap=distance,math.min(.999,distance/p.route.length),gap end
    end
end
function M.update(self,dt)
    local p=self.progress;if not p then return end
    local status=phase(self)
    p.poll=(p.poll or 0)+dt
    if p.sent==status and p.poll<.1 then return end
    p.poll=0;p.sent=status
    msg.post('main:/loader#ui','course_progress',{generation=self.session_generation,attempt=self.generation,
        enabled=p.enabled,available=p.route~=nil and not p.error,fraction=p.fraction,distance=p.distance,
        length=p.route and p.route.length or 0,gaps=p.route and p.route.gaps or 0,on_gap=p.gap,
        phase=status,modal=self.race and (status=='finished' or status=='failed') or false,reason=p.error or p.reason or ''})
end
return M
