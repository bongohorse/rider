-- Loader-owned, single-tab ordinary-coin bank. Store absolute totals, never replay a delta on retry.
local custom=require 'main.gym.custom'
local M={LIMIT=2147483647,MAX_CLAIMS=4096}
local function copy(t) local r={};for k,v in pairs(t or {}) do r[k]=v end;return r end
local function claim(k) return type(k)=='string' and #k<=129 and k:match('^[a-z][a-z0-9%-]*/[a-z][a-z0-9%-]*$')~=nil end
local NAMES={'coin-bank-a','coin-bank-b'}
local function integer(n,max) return type(n)=='number' and n==n and n>=0 and n<=max and n%1==0 end
function M.parse(text)
    local ok,d=pcall(json.decode,text)
    if not ok or type(d)~='table' then return nil,'Unreadable coin bank' end
    if d.version~=1 and d.version~=2 then return nil,'Unsupported coin bank version',true end
    for k in pairs(d) do if k~='version' and k~='total' and k~='serial' and not (d.version==2 and (k=='gems' or k=='claims')) then return nil,'Unsupported coin bank field',true end end
    if not integer(d.total,M.LIMIT) or not integer(d.serial,M.LIMIT) then return nil,'Invalid coin bank total/serial' end
    if d.version==2 then
        if not integer(d.gems,M.MAX_CLAIMS) or type(d.claims)~='table' then return nil,'Invalid gem bank' end
        local n=0;for k,v in pairs(d.claims) do if not claim(k) or v~=true then return nil,'Invalid gem claim' end;n=n+1;if n>M.MAX_CLAIMS then return nil,'Gem claim limit' end end
        if n~=d.gems then return nil,'Gem claim count mismatch' end
    end
    return d
end
function M.new()
    local store=custom.slot_store(NAMES,M.parse)
    local restored,err=store.restore();local latest=store.newest()
    local bad=err or latest and latest.unsupported or restored and restored.skipped or not restored and store.exists()
    local total,serial,gems,claims=0,0,0,{}
    for i,name in ipairs(NAMES) do
        local ok,exists=pcall(sys.exists,sys.get_save_file('rider',name));local slot=store.slot(i)
        local valid=slot and not slot.unsupported and integer(slot.seq,M.LIMIT) and slot.seq>=1
        if not ok or exists and not valid then bad=true end
        if valid then total=math.max(total,slot.doc.total);serial=math.max(serial,slot.doc.serial);for k in pairs(slot.doc.claims or {}) do claims[k]=true end end
    end
    for _ in pairs(claims) do gems=gems+1 end
    return {gems=gems,desired_gems=gems,claims=claims,desired_claims=copy(claims),store=store,total=total,desired=total,serial=serial,blocked=bad or false,
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
    if t.blocked or t.checking or t.pending or (t.desired<=t.total and t.desired_gems<=t.gems) then return end
    if t.serial>=M.LIMIT then t.blocked=true;t.status='Coin bank limit reached';return end
    local d={version=2,total=t.desired,gems=t.desired_gems,claims=copy(t.desired_claims),serial=t.serial+1}
    t.pending={gems=d.gems,claims=d.claims,total=d.total,serial=d.serial,text=json.encode(d),tries=0};write(t)
end
function M.offer(t,generation,attempt,amount,official,claims)
    if generation~=t.generation or not integer(attempt,M.LIMIT) or attempt<=t.attempt then return false end
    -- The terminal result freezes eligibility. A duplicate cannot be reclassified and offered again.
    t.attempt=attempt
    if not official or not integer(amount,128) then return false end
    local added=0;local next_claims=copy(t.desired_claims)
    for _,k in ipairs(claims or {}) do
        if not claim(k) then return false end
        if not next_claims[k] then next_claims[k]=true;added=added+1 end
    end
    if t.desired_gems+added>M.MAX_CLAIMS then t.status='Gem bank limit reached';return false end
    if amount==0 and added==0 then return false end
    if t.blocked or t.desired+amount>M.LIMIT then t.status='Coins not saved';return false end
    t.desired=t.desired+amount;t.desired_gems=t.desired_gems+added;t.desired_claims=next_claims;flush(t);return true
end
function M.poll(t,dt)
    if t.blocked then return end
    local state=custom.sync_state()
    if t.checking then
        if state=='syncing' then t.status='Checking coin storage';return end
        t.checking=false;t.status='saved'
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
        t.total,t.serial,t.gems,t.claims=p.total,p.serial,p.gems,p.claims;t.pending=nil;t.status='saved'
    end
    flush(t)
end
return M
