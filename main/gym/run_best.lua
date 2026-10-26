-- Instance-owned records; reuse the existing alternating slots and HTML5 sync acknowledgement.
local custom=require 'main.gym.custom'
local M={KEY='first-run-course1-rules1-buggy-a-crash'}
local function finite(n) return type(n)=='number' and n==n and n>0 and n<86400 end
function M.parse(text)
    local ok,d=pcall(json.decode,text)
    if not ok or type(d)~='table' then return nil,'Unreadable personal best' end
    if d.version~=1 then return nil,'Personal best is from an unsupported version',true end
    if d.key~=M.KEY or not finite(d.time) then return nil,'Invalid personal best identity/time' end
    return d
end
function M.new()
    local s=custom.slot_store({'best-'..M.KEY..'-a','best-'..M.KEY..'-b'},M.parse)
    local restored,err=s.restore();local latest=s.newest()
    local bad=latest and latest.unsupported or restored and restored.skipped or err or not restored and s.exists()
    local t={store=s,best=restored and restored.doc.time,status=bad and 'Record unavailable; save protected' or 'saved',blocked=bad}
    if not bad and custom.sync_state()~='saved' then t.status='Checking storage';t.pending=t.best or false end
    return t
end
function M.offer(t,result)
    if not result or not result.official or not finite(result.time) then return false end
    if t.best and result.time>=t.best then return false end
    if t.blocked or t.pending~=nil then return false end
    local seq,err=t.store.save(json.encode({version=1,key=M.KEY,time=result.time}))
    if not seq then t.status='Best not saved: '..tostring(err);return false end
    t.pending=result.time;t.status='Saving best...';return true
end
function M.poll(t)
    if t.pending==nil then return end
    local state=custom.sync_state()
    if state=='syncing' then return end
    if state=='saved' then
        if t.pending then t.best=t.pending end
        t.status='saved'
    else t.status='Best not saved ('..state..')';t.blocked=true end
    t.pending=nil
end
return M
