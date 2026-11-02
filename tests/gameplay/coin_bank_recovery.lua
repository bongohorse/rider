-- #381: run the unmodified production coin_bank module under injected slot-store failures.
-- Existing coin_bank.lua tests exercise the real alternating-slot implementation;
-- this focused Lua test controls only its storage boundary and sync acknowledgement.
local documents,encoded_id,attempts,fail_first,fail_always,slots={},0,0,0,false,{}
local sync='saved'
local function copy(value)
    if type(value)~='table' then return value end
    local result={}
    for k,v in pairs(value) do result[k]=copy(v) end
    return result
end
json={encode=function(doc)
    encoded_id=encoded_id+1
    documents[tostring(encoded_id)]=copy(doc)
    return tostring(encoded_id)
end,decode=function(text)
    assert(documents[text],'Unknown encoded document')
    return copy(documents[text])
end}
sys={get_save_file=function(app,name) return app..'/'..name end,
    exists=function(path) return slots[path]~=nil end}
package.preload['main.gym.custom']=function()
    return {sync_state=function() return sync end,
        slot_store=function(names,parse)
            local function slot(i)
                local raw=slots['rider/'..names[i]]
                if not raw then return nil end
                return {seq=raw.seq,doc=assert(parse(raw.text)),slot=i}
            end
            local function newest()
                local a,b=slot(1),slot(2)
                if a and b then return a.seq>b.seq and a or b end
                return a or b
            end
            return {slot=slot,newest=newest,restore=newest,
                exists=function() return slot(1)~=nil or slot(2)~=nil end,
                save=function(text)
                    attempts=attempts+1
                    if fail_always or attempts<=fail_first then return nil,'injected EIO' end
                    local latest=newest()
                    local next_slot=latest and (latest.slot==1 and 2 or 1) or 1
                    local sequence=latest and latest.seq+1 or 1
                    slots['rider/'..names[next_slot]]={seq=sequence,text=text}
                    return sequence
                end}
        end}
end
local bank=require 'main.gym.coin_bank'
local function reset(failures,permanent)
    documents={};encoded_id=0;attempts=0;fail_first=failures or 0
    fail_always=permanent or false;slots={};sync='saved'
    local t=bank.new();bank.generation(t,1)
    return t
end

-- The old implementation never makes a fourth attempt after the third failure.
local recovering=reset(3)
assert(bank.offer(recovering,1,1,1,true,{'first-run/gem-a'}))
bank.poll(recovering,1);bank.poll(recovering,1)
assert(attempts==3 and recovering.pending and recovering.pending.tries==3)
assert(recovering.total==0 and recovering.gems==0)
-- A later official finish is queued while the first absolute snapshot is pending.
assert(bank.offer(recovering,1,2,1,true,{'first-run/gem-a','first-run/gem-b'}))
assert(recovering.desired==2 and recovering.desired_gems==2)
for _=1,40 do
    if recovering.pending.written then break end
    bank.poll(recovering,1)
end
assert(attempts==4 and recovering.pending.written,'storage recovery must trigger a fourth write')
assert(recovering.total==0 and recovering.gems==0,'no credit before sync acknowledgement')
sync='syncing';bank.poll(recovering,1)
assert(recovering.total==0 and recovering.gems==0)
sync='saved';bank.poll(recovering,1)
assert(recovering.total==1 and recovering.gems==1 and recovering.pending.total==2)
assert(attempts==5,'queued offer must use one new absolute snapshot')
sync='syncing';bank.poll(recovering,1)
assert(recovering.total==1 and recovering.gems==1)
sync='saved';bank.poll(recovering,1)
assert(not recovering.pending and recovering.total==2 and recovering.gems==2 and recovering.serial==2)
assert(recovering.claims['first-run/gem-a'] and recovering.claims['first-run/gem-b'])
assert(bank.new().total==2 and bank.new().gems==2,'reopen must retain durable totals')
assert(not bank.offer(recovering,1,2,1,true,{'first-run/gem-a'}))
for _=1,10 do bank.poll(recovering,1/60) end
assert(attempts==5 and recovering.total==2 and recovering.gems==2,'no duplicate credit')
print('PASS three failures then recovery, queued finish, sync gating, absolute totals and unique gems')

local twice=reset(2)
assert(bank.offer(twice,1,1,1,true,{'first-run/gem-a'}))
for _=1,10 do bank.poll(twice,1) end
assert(attempts==3 and twice.total==1 and twice.gems==1 and not twice.pending)
print('PASS two failed writes then successful acknowledgement')

local permanent=reset(0,true)
assert(bank.offer(permanent,1,1,1,true,{'first-run/gem-a'}))
for _=1,7200 do bank.poll(permanent,1/60) end
assert(attempts>=3 and attempts<=12,'permanent errors must use a bounded retry rate')
assert(permanent.total==0 and permanent.gems==0 and permanent.pending)
assert(permanent.status=='Coins not saved' and permanent.desired==1)
print('PASS permanent failure stays unacknowledged and rate-limited at 60Hz polling')
