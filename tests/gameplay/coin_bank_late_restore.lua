-- #393: IndexedDB may populate the coin-bank slots only after coin_bank.new() sampled them.
-- Production custom.slot_store with injected sys/json; the restore arrives while syncing.
local files,encoded={},{};local serial=0;local state='saved';local writes=0;local fail=false
sys={get_save_file=function(app,name)return app..'/'..name end,exists=function(p)return files[p]~=nil end,
 get_engine_info=function()return {is_debug=true}end,load=function(p)if files[p]=='bad' then error('bad slot') end;return files[p] or {}end,
 save=function(p,d)writes=writes+1;if fail then error('write failure') end;files[p]=d;return true end}
json={encode=function(t)serial=serial+1;encoded[tostring(serial)]=t;return tostring(serial)end,decode=function(t)assert(encoded[t],'bad document');return encoded[t]end}
local custom=require 'main.gym.custom';custom.sync_state=function()return state end
local B=require 'main.gym.coin_bank'
local A,Z='rider/coin-bank-a','rider/coin-bank-b'
local function slot(seq,doc) return {format=1,seq=seq,text=json.encode(doc)} end
local function restored() return slot(1,{version=2,total=100,gems=1,claims={['first-run/gem-a']=true},serial=5}) end
local function settle(b) for _=1,4 do B.poll(b,.1) end end
local function fresh() files={};writes=0;state='syncing';local b=B.new();B.generation(b,1);return b end

-- Late restore, two official awards: the restored balance and gem survive alternating writes.
local b=fresh();assert(b.checking and b.total==0)
assert(B.offer(b,1,1,2,true));assert(b.desired==2 and not b.pending and writes==0)
files[A]=restored();state='saved';settle(b)
assert(b.total==102 and b.gems==1 and b.serial==6,'late restore must be adopted before the first write')
assert(B.offer(b,1,2,1,true));settle(b)
local reopened=B.new();assert(reopened.total==103 and reopened.gems==1 and reopened.claims['first-run/gem-a'],'reopen keeps 103 coins and the gem')
assert(reopened.serial==7)
print('PASS late-restored 100 coins/1 gem plus two queued official awards reopen as 103/1')

-- Positive control: the same slot already visible before new() gives the same result.
files={};files[A]=restored();state='saved';local c=B.new();B.generation(c,1)
assert(c.total==100 and c.gems==1);assert(B.offer(c,1,1,2,true));settle(c);assert(B.offer(c,1,2,1,true));settle(c)
assert(B.new().total==103 and B.new().gems==1)
print('PASS already-restored control reopens as 103/1')

-- A gem claimed during sync that the restore already holds is not counted twice; new gems add.
b=fresh();assert(B.offer(b,1,1,2,true,{'first-run/gem-a','first-run/gem-b'}));assert(b.desired_gems==2)
files[A]=restored();state='saved';settle(b)
assert(b.total==102 and b.gems==2 and b.claims['first-run/gem-a'] and b.claims['first-run/gem-b'])
assert(B.new().gems==2 and B.new().total==102)
print('PASS duplicate late-restored gem claim is not recredited; a new queued gem is kept')

-- Both late slots: the newest serial/total wins and the next write continues its serial.
b=fresh();assert(B.offer(b,1,1,1,true))
files[A]=slot(1,{version=2,total=50,gems=0,claims={},serial=2});files[Z]=slot(2,{version=2,total=100,gems=1,claims={['first-run/gem-a']=true},serial=5})
state='saved';settle(b);assert(b.total==101 and b.serial==6 and b.gems==1)
assert(B.new().total==101)
print('PASS both late slots: highest total/serial adopted, next serial continues')

-- Late corrupt or newer-format peers block writes and keep their bytes.
for _,peer in ipairs({'bad',slot(2,{version=999,total=1,serial=9}),slot(2,{version=2,total=0/0,gems=0,claims={},serial=9})}) do
 b=fresh();assert(B.offer(b,1,1,2,true))
 files[A]=restored();files[Z]=peer;state='saved';local before=writes;settle(b)
 assert(b.blocked and b.status=='Coin bank protected' and writes==before and files[Z]==peer)
 assert(not B.offer(b,1,2,1,true))
end
print('PASS late corrupt, future-version or invalid peer blocks writes and is preserved')

-- Failed sync after a pending restore: no write, balance not invented.
b=fresh();assert(B.offer(b,1,1,2,true));files[A]=restored();state='failed';settle(b)
assert(b.blocked and writes==0 and B.new().total==100)
print('PASS failed sync blocks writes and leaves the restored slot untouched')

-- The first write after adoption fails (EIO): the retry keeps the adopted absolute total.
b=fresh();assert(B.offer(b,1,1,2,true));files[A]=restored();state='saved';fail=true
B.poll(b,.1);assert(b.pending and b.pending.total==102 and not b.pending.written and b.total==100)
fail=false;for _=1,4 do B.poll(b,1) end
assert(b.total==102 and b.gems==1 and not b.pending and B.new().total==102)
print('PASS failed first write after late adoption retries the adopted total, without loss or recredit')
