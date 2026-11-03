-- Instance-owned records; reuse the existing alternating slots and HTML5 sync acknowledgement.
local custom=require 'main.game.custom'
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
    local t={store=s,key=key,best=best_time,medal=medal,desired_best=best_time,desired_medal=medal,
        status=bad and 'Record unavailable; save protected' or 'saved',blocked=bad}
    if not bad and custom.sync_state()~='saved' then t.status='Checking storage';t.pending=t.best or false;t.checking=true end
    return t
end
-- Only one immutable absolute snapshot may await storage acknowledgement at a time.
-- Later official results update desired state, never the in-flight slot or acknowledged best.
local function flush(t)
    if t.blocked or t.pending~=nil then return false end
    if t.desired_best==t.best and t.desired_medal==t.medal then return true end
    local state=custom.sync_state()
    if state=='syncing' then return false end
    if state~='saved' then t.blocked=true;t.status='Best not saved ('..state..')';return false end
    -- A failed write may have damaged its target slot. Recheck both slots before
    -- any retry so an unreadable or future-version alternate is never replaced.
    if t.retry_at then
        local fresh=M.new(t.key)
        if fresh.blocked or fresh.best~=t.best or fresh.medal~=t.medal then
            t.blocked=true;t.status='Record unavailable; save protected';return false
        end
    end
    local time,medal=t.desired_best,t.desired_medal
    local seq,err=t.store.save(json.encode({version=2,key=t.key,time=time,medal=medal}))
    if not seq then
        t.status='Best not saved: '..tostring(err)
        local delay=t.retry_delay or 1
        t.retry_at=os.time()+delay
        t.retry_delay=math.min(delay*2,30)
        return false
    end
    t.pending=time;t.pending_medal=medal;t.status='Saving best...'
    t.retry_at=nil;t.retry_delay=nil;t.retry_offer_used=nil
    return true
end
function M.offer(t,result)
    if not result or not result.official or not finite(result.time) then return false end
    local medal=result.medal or 0
    if type(medal)~='number' or medal<0 or medal>3 or medal%1~=0 or t.blocked then return false end
    local improved=not t.desired_best or result.time<t.desired_best
    local higher_medal=medal>t.desired_medal
    if not improved and not higher_medal then
        -- Preserve the old explicit re-offer recovery after one failed local write.
        -- Only one immediate retry is allowed; later attempts use poll's backoff.
        if t.retry_at and not t.retry_offer_used and t.pending==nil
            and result.time==t.desired_best and medal==t.desired_medal then
            t.retry_offer_used=true
            return flush(t) and (not t.best or result.time<t.best) or false
        end
        return false
    end
    t.desired_best=math.min(t.desired_best or result.time,result.time)
    t.desired_medal=math.max(t.desired_medal,medal)
    if t.pending==nil and not t.retry_at and not flush(t) then return false end
    return improved
end
function M.poll(t)
    if t.blocked then return end
    if t.pending~=nil then
        local state=custom.sync_state()
        if state=='syncing' then return end
        if state~='saved' then
            t.status='Best not saved ('..state..')';t.blocked=true
            t.pending=nil;t.pending_medal=nil
            return
        end
        if t.checking then
            -- The initial IndexedDB restore can reveal slots after M.new first ran.
            -- Reconcile their acknowledged record before writing any queued offer.
            local fresh=M.new(t.key)
            if fresh.blocked then
                t.blocked=true;t.status='Record unavailable; save protected'
                t.pending=nil;t.pending_medal=nil;t.checking=nil
                return
            end
            t.best=fresh.best;t.medal=fresh.medal
            if fresh.best then t.desired_best=math.min(t.desired_best or fresh.best,fresh.best) end
            t.desired_medal=math.max(t.desired_medal,fresh.medal)
            t.checking=nil
        else
            if t.pending then t.best=t.pending end
            if t.pending_medal then t.medal=t.pending_medal end
        end
        t.pending=nil;t.pending_medal=nil
    end
    if t.retry_at and os.time()<t.retry_at then return end
    if t.desired_best~=t.best or t.desired_medal~=t.medal then
        flush(t)
    else t.status='saved' end
end
return M
