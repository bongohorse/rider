-- One attempt authority, advanced only by the existing owner's completed simulation ticks.
-- No engine calls, persistence, formatting, rendering or extra update loop.
local M={}
function M.new(generation) return {generation=generation,attempt=0} end
function M.reset(r,official)
    r.attempt=r.attempt+1;r.id=tostring(r.generation)..':'..r.attempt
    r.state,r.elapsed,r.result,r.reason,r.resume='ready',0,nil,nil,nil
    r.official=official==true;r.practice_reason=nil;r.new_best=false
    return r.id
end
function M.practice(r,reason) r.official=false;r.practice_reason=r.practice_reason or reason end
function M.start(r,id)
    if id~=r.id or r.state~='ready' then return false end
    r.state='running';return true
end
function M.tick(r,dt)
    assert(type(dt)=='number' and dt>0 and dt<1 and dt==dt,'Invalid simulation step')
    if r.state=='running' then r.elapsed=r.elapsed+dt end
end
function M.pause(r,active)
    if active and (r.state=='running' or r.state=='ready') then r.resume=r.state;r.state='paused'
    elseif not active and r.state=='paused' then r.state=r.resume;r.resume=nil end
end
function M.finish(r,id)
    if id~=r.id or r.state~='running' then return nil end
    r.state='finished';r.result={id=r.id,time=r.elapsed,official=r.official};return r.result
end
function M.fail(r,id,reason)
    if id~=r.id or (r.state~='running' and r.state~='ready') then return false end
    r.state='failed';r.reason=reason;return true
end
function M.terminal(r) return r.state=='finished' or r.state=='failed' end
return M
