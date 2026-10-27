-- Loader-owned, single-tab ordinary-coin bank. Store absolute totals, never replay a delta on retry.
local custom=require 'main.gym.custom'
local M={LIMIT=2147483647}
local NAMES={'coin-bank-a','coin-bank-b'}
local function integer(n,max) return type(n)=='number' and n==n and n>=0 and n<=max and n%1==0 end
function M.parse(text)
    local ok,d=pcall(json.decode,text)
    if not ok or type(d)~='table' then return nil,'Unreadable coin bank' end
    if d.version~=1 then return nil,'Unsupported coin bank version',true end
    for k in pairs(d) do if k~='version' and k~='total' and k~='serial' then return nil,'Unsupported coin bank field',true end end
    if not integer(d.total,M.LIMIT) or not integer(d.serial,M.LIMIT) then return nil,'Invalid coin bank total/serial' end
    return d
end
function M.new()
    local store=custom.slot_store(NAMES,M.parse)
    local restored,err=store.restore();local latest=store.newest()
    local bad=err or latest and latest.unsupported or restored and restored.skipped or not restored and store.exists()
    local total,serial=0,0
    for i,name in ipairs(NAMES) do
        local ok,exists=pcall(sys.exists,sys.get_save_file('rider',name));local slot=store.slot(i)
        local valid=slot and not slot.unsupported and integer(slot.seq,M.LIMIT) and slot.seq>=1
        if not ok or exists and not valid then bad=true end
        if valid then total=math.max(total,slot.doc.total);serial=math.max(serial,slot.doc.serial) end
    end
    return {store=store,total=total,desired=total,serial=serial,blocked=bad or false,
        checking=not bad and custom.sync_state()~='saved',status=bad and 'Coin bank protected' or 'saved',generation=0,attempt=0}
end
function M.generation(t,generation)
    if generation>t.generation then t.generation=generation;t.attempt=0 end
end
local function write(t)
    local p=t.pending
    p.tries=p.tries+1
    local seq,err=t.store.save(p.text)
    if not seq then t.status='Coins not saved';p.retry_in=1;return false end
    p.written=true;t.status='Saving coins...';return true
end
local function flush(t)
    if t.blocked or t.checking or t.pending or t.desired<=t.total then return end
    if t.serial>=M.LIMIT then t.blocked=true;t.status='Coin bank limit reached';return end
    local d={version=1,total=t.desired,serial=t.serial+1}
    t.pending={total=d.total,serial=d.serial,text=json.encode(d),tries=0};write(t)
end
function M.offer(t,generation,attempt,amount,official)
    if generation~=t.generation or not integer(attempt,M.LIMIT) or attempt<=t.attempt then return false end
    -- The terminal result freezes eligibility. A duplicate cannot be reclassified and offered again.
    t.attempt=attempt
    if not official or not integer(amount,128) or amount==0 then return false end
    if t.blocked or t.desired+amount>M.LIMIT then t.status='Coins not saved';return false end
    t.desired=t.desired+amount;flush(t);return true
end
function M.poll(t,dt)
    if t.blocked then return end
    local state=custom.sync_state()
    if t.checking then
        if state=='syncing' then t.status='Checking coin storage';return end
        t.checking=false
        if state~='saved' then t.blocked=true;t.status='Coins not saved';return end
    end
    local p=t.pending
    if p then
        if not p.written then
            p.retry_in=(p.retry_in or 0)-dt
            if p.tries<3 and p.retry_in<=0 then write(t) end
            return
        end
        if state=='syncing' then return end
        if state~='saved' then t.blocked=true;t.status='Coins not saved';return end
        t.total,t.serial=p.total,p.serial;t.pending=nil;t.status='saved'
    end
    flush(t)
end
return M
