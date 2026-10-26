-- Instance-owned records; reuse the existing alternating slots and HTML5 sync acknowledgement.
local custom=require 'main.gym.custom'
local M={KEY='first-run-course1-rules1-buggy-a-crash'}
local function finite(n) return type(n)=='number' and n==n and n>0 and n<86400 end
local function parse(text,key)
    local ok,d=pcall(json.decode,text)
    if not ok or type(d)~='table' then return nil,'Unreadable personal best' end
    if d.version~=1 and d.version~=2 then return nil,'Personal best is from an unsupported version',true end
    if d.key~=key or not finite(d.time) then return nil,'Invalid personal best identity/time' end
    if d.version==2 and (type(d.medal)~='number' or d.medal<0 or d.medal>3 or d.medal%1~=0) then return nil,'Invalid saved medal' end
    return d
end
function M.parse(text) return parse(text,M.KEY) end
function M.new(key)
    key=key or M.KEY
    local names={'best-'..key..'-a','best-'..key..'-b'}
    local s=custom.slot_store(names,function(text) return parse(text,key) end)
    local restored,err=s.restore();local latest=s.newest()
    local bad=latest and latest.unsupported or restored and restored.skipped or err or not restored and s.exists()
    -- A valid survivor must not hide an unreadable alternate (including sys.load returning {}).
    -- Keep both files intact rather than silently treating existing bad data as an empty slot.
    local best_time,medal=nil,0
    for i,name in ipairs(names) do
        local ok,exists=pcall(sys.exists,sys.get_save_file('rider',name))
        local slot=s.slot(i)
        local valid=slot and not slot.unsupported and slot.seq>=1 and slot.seq%1==0
        if not ok or exists and not valid then bad=true end
        if valid then best_time=math.min(best_time or slot.doc.time,slot.doc.time);medal=math.max(medal,slot.doc.version==2 and slot.doc.medal or 0) end
    end
    local t={store=s,key=key,best=best_time,medal=medal,status=bad and 'Record unavailable; save protected' or 'saved',blocked=bad}
    if not bad and custom.sync_state()~='saved' then t.status='Checking storage';t.pending=t.best or false end
    return t
end
function M.offer(t,result)
    if not result or not result.official or not finite(result.time) then return false end
    local medal=result.medal or 0
    if type(medal)~='number' or medal<0 or medal>3 or medal%1~=0 then return false end
    local improved=not t.best or result.time<t.best
    if not improved and medal<=t.medal then return false end
    if t.blocked or t.pending~=nil then return false end
    local time=math.min(t.best or result.time,result.time);medal=math.max(t.medal,medal)
    local seq,err=t.store.save(json.encode({version=2,key=t.key,time=time,medal=medal}))
    if not seq then t.status='Best not saved: '..tostring(err);return false end
    t.pending=time;t.pending_medal=medal;t.status='Saving best...';return improved
end
function M.poll(t)
    if t.pending==nil then return end
    local state=custom.sync_state()
    if state=='syncing' then return end
    if state=='saved' then
        if t.pending then t.best=t.pending end
        if t.pending_medal then t.medal=t.pending_medal end
        t.status='saved'
    else t.status='Best not saved ('..state..')';t.blocked=true end
    t.pending=nil;t.pending_medal=nil
end
return M
