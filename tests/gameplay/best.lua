-- Exercise the production alternating-slot store, parser and sync boundary with faulting file APIs.
local files={};local state='saved';local mode;local last
sys={get_save_file=function(app,name)return app..'/'..name end,get_engine_info=function()return {is_debug=true}end,
 load=function(path)return files[path] or {}end,save=function(path,t)
 last=path
 if mode=='write' then files[path]=nil;error('injected write failure') end
 files[path]=t;return true end}
local encoded={};local serial=0
json={encode=function(t)serial=serial+1;encoded[tostring(serial)]=t;return tostring(serial)end,decode=function(s)assert(encoded[s],'bad JSON');return encoded[s]end}
local custom=require 'main.gym.custom';custom.sync_state=function()return state end
local best=require 'main.gym.run_best'
local t=best.new();assert(not t.best)
assert(not best.offer(t,{official=false,time=2}));assert(best.offer(t,{official=true,time=5}));assert(not t.best)
state='syncing';best.poll(t);assert(not t.best and t.pending==5)
state='saved';best.poll(t);assert(t.best==5 and t.status=='saved')
assert(not best.offer(t,{official=true,time=6}));assert(not best.offer(t,{official=true,time=0/0}))
local reopened=best.new();assert(reopened.best==5)
mode='write';assert(not best.offer(t,{official=true,time=4}));assert(t.best==5 and best.new().best==5)
mode=nil;assert(best.offer(t,{official=true,time=4}));state='failed';best.poll(t);assert(t.best==5 and t.status:find('not saved') and t.blocked)
assert(not best.offer(t,{official=true,time=3}))
state='saved';local fresh=best.new();assert(fresh.best==4) -- RAM file survived failed sync; not a reload/device claim.
local future={version=999,key=best.KEY,time=1};local ok,err,unknown=best.parse(json.encode(future));assert(not ok and unknown)
assert(not best.parse(json.encode({version=1,key='other-rules',time=1})))
-- Unsupported newest slot is protected; malformed data cannot silently replace an older record.
files[last]={format=1,seq=99,text=json.encode(future)}
local protected=best.new();assert(protected.blocked and not best.offer(protected,{official=true,time=1}))
print('PASS best minimum/reopen/practice/rule identity/version protection/write failure/async acknowledgement')
