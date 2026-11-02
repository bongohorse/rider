-- #380: execute the real run_best module with only the storage/sync boundary stubbed.
-- A separate existing best.lua test covers the production alternating-slot store.
local docs,encoded,files,attempts,fail_next,fail_always,clock={},0,{},0,0,false,100
local sync='saved'
local function copy(x)
    if type(x)~='table' then return x end
    local y={};for k,v in pairs(x) do y[k]=copy(v) end;return y
end
local real_time=os.time
os.time=function() return clock end
json={encode=function(d) encoded=encoded+1;docs[tostring(encoded)]=copy(d);return tostring(encoded) end,
    decode=function(text) assert(docs[text],'bad document');return copy(docs[text]) end}
sys={get_save_file=function(app,name) return app..'/'..name end,
    exists=function(path) return files[path]~=nil end}
package.preload['main.gym.custom']=function()
    return {sync_state=function() return sync end,
        slot_store=function(names,parse)
            local function slot(i)
                local raw=files['rider/'..names[i]]
                if not raw then return nil end
                if raw=='unreadable' then return nil end
                local doc,err,unsupported=parse(raw.text)
                if doc then return {seq=raw.seq,doc=doc,slot=i} end
                if unsupported then return {seq=raw.seq,unsupported=err,slot=i} end
            end
            local function newest()
                local a,b=slot(1),slot(2)
                if a and b then return a.seq>b.seq and a or b end
                return a or b
            end
            local function restore()
                local n=newest()
                if n and n.unsupported then return nil end
                return n
            end
            return {slot=slot,newest=newest,restore=restore,
                exists=function() return files['rider/'..names[1]]~=nil or files['rider/'..names[2]]~=nil end,
                save=function(text)
                    attempts=attempts+1
                    local n=newest()
                    local target=n and (n.slot==1 and 2 or 1) or 1
                    if fail_always or fail_next>0 then
                        if fail_next>0 then fail_next=fail_next-1 end
                        -- A failed sys.save may remove its target, not the valid survivor.
                        files['rider/'..names[target]]=nil
                        return nil,'injected EIO'
                    end
                    local seq=n and n.seq+1 or 1
                    files['rider/'..names[target]]={seq=seq,text=text}
                    return seq
                end}
        end}
end
local best=require 'main.gym.run_best'
local function reset()
    docs={};encoded=0;files={};attempts=0;fail_next=0;fail_always=false
    sync='saved';clock=100
    return best.new()
end
local function poll_saved(t)
    sync='saved';best.poll(t)
end
local function reopen()
    return best.new()
end

-- Positive control: a second result after acknowledgement already worked before #380.
local control=reset()
assert(best.offer(control,{official=true,time=25,medal=1}))
poll_saved(control)
assert(best.offer(control,{official=true,time=20,medal=3}))
poll_saved(control)
assert(control.best==20 and control.medal==3 and attempts==2)
assert(reopen().best==20 and reopen().medal==3)
print('PASS post-ack second official offer positive control')

-- Failing-before regression: the original module rejects the better pending offer.
local t=reset()
assert(best.offer(t,{official=true,time=25,medal=1}))
sync='syncing';best.poll(t)
assert(t.best==nil and t.medal==0 and attempts==1)
assert(best.offer(t,{official=true,time=20,medal=3}),
    'pending second official record must be accepted into desired state')
assert(t.best==nil and t.medal==0 and attempts==1,'no premature save/ack while syncing')
poll_saved(t)
assert(t.best==25 and t.medal==1 and attempts==2,'first ack then exactly one queued absolute write')
assert(t.pending==20 and t.pending_medal==3)
sync='syncing';best.poll(t)
assert(t.best==25 and t.medal==1)
poll_saved(t)
assert(t.best==20 and t.medal==3 and attempts==2 and not t.pending)
assert(reopen().best==20 and reopen().medal==3)
print('PASS queued best and medal survive in-flight acknowledgement and alternate slot')

-- Initial sync verification is not permission to write or discard official offers.
local checking=reset()
sync='syncing';checking=best.new()
assert(checking.pending==false)
assert(best.offer(checking,{official=true,time=40,medal=1}))
assert(attempts==0 and checking.best==nil)
best.poll(checking);assert(attempts==0)
poll_saved(checking);assert(attempts==1 and checking.pending==40 and checking.best==nil)
poll_saved(checking);assert(checking.best==40 and checking.medal==1)
print('PASS initial storage checking queues without premature write')

-- Duplicate, practice, invalid values and medal-only monotonic updates.
local m=reset()
assert(best.offer(m,{official=true,time=20,medal=1}))
assert(not best.offer(m,{official=true,time=20,medal=1}))
assert(not best.offer(m,{official=false,time=10,medal=3}))
assert(not best.offer(m,{official=true,time=0/0,medal=3}))
assert(not best.offer(m,{official=true,time=19,medal=4}))
assert(not best.offer(m,{official=true,time=19,medal=-1}))
assert(not best.offer(m,{official=true,time=19,medal=1.5}))
assert(not best.offer(m,{official=true,time=0,medal=2}))
assert(not best.offer(m,{official=true,time=86400,medal=2}))
assert(not best.offer(m,{official=true,time=30,medal=3}),
    'medal-only improvement does not count as a faster time')
assert(attempts==1 and m.best==nil and m.medal==0)
poll_saved(m);assert(attempts==2 and m.best==20 and m.medal==1)
poll_saved(m);assert(m.best==20 and m.medal==3 and attempts==2)
assert(not best.offer(m,{official=true,time=30,medal=3}))
assert(reopen().best==20 and reopen().medal==3)
print('PASS duplicate/practice/invalid filtering and medal-only upgrade')

-- A failed local write must not acknowledge or lose a desired result; retry is rate-limited.
local f=reset();fail_next=1
assert(not best.offer(f,{official=true,time=29,medal=1}))
assert(attempts==1 and f.best==nil and f.medal==0 and not f.pending)
best.poll(f);assert(attempts==1)
clock=clock+1;best.poll(f)
assert(attempts==2 and f.best==nil and f.medal==0 and f.pending==29)
sync='syncing';best.poll(f);assert(f.best==nil)
poll_saved(f);assert(f.best==29 and f.medal==1 and reopen().best==29)
print('PASS transient sys.save failure retries without false acknowledgement')

-- Legacy gameplay may explicitly re-offer the same finish after a local save error.
local explicit=reset();fail_next=1
assert(not best.offer(explicit,{official=true,time=21,medal=1}))
assert(best.offer(explicit,{official=true,time=21,medal=1}))
assert(attempts==2 and explicit.pending==21 and explicit.best==nil)
poll_saved(explicit);assert(explicit.best==21 and reopen().best==21)
local repeated=reset();fail_always=true
assert(not best.offer(repeated,{official=true,time=21,medal=1}))
assert(not best.offer(repeated,{official=true,time=21,medal=1}))
for _=1,100 do assert(not best.offer(repeated,{official=true,time=21,medal=1})) end
assert(attempts==2 and repeated.best==nil,'re-offers must not flood permanent faults')
print('PASS one explicit re-offer compatibility without repeated write flooding')

local permanent=reset();fail_always=true
assert(not best.offer(permanent,{official=true,time=22,medal=2}))
for _=1,7200 do best.poll(permanent) end
assert(attempts==1 and permanent.best==nil and permanent.medal==0)
for i=1,120 do clock=clock+1;best.poll(permanent) end
assert(attempts<=12 and permanent.best==nil and permanent.medal==0,
    'permanent failure must be bounded and unacknowledged')
print('PASS permanent save fault is rate-limited')

-- If a failed write left an unreadable or newer-format alternate, retry must stop.
local damaged=reset();fail_next=1
assert(not best.offer(damaged,{official=true,time=18,medal=1}))
local other='rider/best-'..best.KEY..'-a'
files[other]={seq=1,text=json.encode({version=999,key=best.KEY,time=1})}
clock=clock+1;best.poll(damaged)
assert(damaged.blocked and attempts==1 and files[other]~=nil and damaged.best==nil)
print('PASS retry protects an unsupported slot discovered after a failed write')

-- Sync failure is ambiguous durability: stop and preserve both slot files.
local s=reset();assert(best.offer(s,{official=true,time=25,medal=1}))
assert(best.offer(s,{official=true,time=20,medal=3}))
sync='failed';best.poll(s)
assert(s.blocked and s.best==nil and s.medal==0 and attempts==1)
sync='saved';best.poll(s);assert(attempts==1)
assert(not best.offer(s,{official=true,time=19,medal=3}))
print('PASS failed sync blocks future writes and never falsely acknowledges')

-- Existing unreadable and unsupported alternate slots stay protected.
local c=reset();local a='rider/best-'..best.KEY..'-a';local b='rider/best-'..best.KEY..'-b'
files[a]={seq=1,text=json.encode({version=2,key=best.KEY,time=31,medal=1})}
for _,broken in ipairs({'unreadable', {seq=2,text=json.encode({version=999,key=best.KEY,time=1})},
    {seq=2,text=json.encode({version=2,key=best.KEY,time=1,medal=99})}}) do
    files[b]=broken
    local guarded=best.new()
    assert(guarded.blocked and guarded.best==31 and guarded.medal==1)
    assert(not best.offer(guarded,{official=true,time=15,medal=3}))
    assert(attempts==0 and files[b]==broken)
end
files[b]=nil;assert(not best.new().blocked)
print('PASS corrupted/unsupported alternate and source identity stay protected')
os.time=real_time
