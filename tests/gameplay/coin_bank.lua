local files,encoded={},{};local serial=0;local state='saved';local fail=false;local writes=0
sys={get_save_file=function(app,name)return app..'/'..name end,exists=function(p)return files[p]~=nil end,
 get_engine_info=function()return {is_debug=true}end,load=function(p)if files[p]=='bad' then error('bad slot') end;return files[p] or {}end,
 save=function(p,d)writes=writes+1;if fail then files[p]=nil;error('write failure') end;files[p]=d;return true end}
json={encode=function(t)serial=serial+1;encoded[tostring(serial)]=t;return tostring(serial)end,decode=function(t)assert(encoded[t]);return encoded[t]end}
local custom=require 'main.gym.custom';custom.sync_state=function()return state end
local B=require 'main.gym.coin_bank';local b=B.new();B.generation(b,1)
assert(not B.offer(b,1,1,3,false) and b.total==0);assert(not B.offer(b,1,1,3,true))
assert(B.offer(b,1,2,3,true));assert(b.total==0 and b.desired==3);assert(not B.offer(b,1,2,3,true))
state='syncing';B.poll(b,.1);assert(b.total==0);assert(B.offer(b,1,3,2,true));assert(b.desired==5 and b.pending.total==3)
state='saved';B.poll(b,.1);assert(b.total==3 and b.pending.total==5);B.poll(b,.1);assert(b.total==5 and not b.pending)
assert(B.new().total==5);assert(not B.offer(b,0,10,128,true));B.generation(b,2);assert(B.offer(b,2,1,3,true));B.poll(b,.1);assert(b.total==8)
-- A failed write retries one immutable absolute credit, without adding the delta again.
fail=true;assert(B.offer(b,2,2,4,true));assert(b.total==8 and b.pending.total==12);B.poll(b,1);assert(b.total==8)
fail=false;B.poll(b,1);assert(b.total==8);B.poll(b,.1);assert(b.total==12 and B.new().total==12)
assert(not B.offer(b,2,2,4,true));assert(b.total==12)
assert(B.offer(b,2,3,2,true));state='failed';B.poll(b,.1);assert(b.total==12 and b.blocked and b.status=='Coins not saved')
assert(not B.offer(b,2,4,2,true));state='saved'
local a='rider/coin-bank-a';local z='rider/coin-bank-b'
files[a]={format=1,seq=1,text=json.encode({version=1,total=12,serial=3})}
for _,bad in ipairs({'bad',{}, {format=1,seq=2,text=json.encode({version=999,total=1,serial=4})},{format=1,seq=2,text=json.encode({version=1,total=0/0,serial=4})}})do
 files[z]=bad;local guarded=B.new();assert(guarded.blocked and guarded.total==12);B.generation(guarded,1);assert(not B.offer(guarded,1,1,5,true));assert(files[z]==bad)
end
files[z]=nil;assert(not B.new().blocked)
print('PASS bank repeated legitimate finishes, duplicate/practice/stale rejection, queued sync, reopen, immutable write retries, failed sync and protected alternate slots')

state='syncing';local checking=B.new();B.poll(checking,.1);assert(checking.checking and checking.status=='Checking coin storage')
state='saved';B.poll(checking,.1);assert(not checking.checking and checking.status=='saved')
print('PASS initial coin storage acknowledgement clears the checking presentation')
