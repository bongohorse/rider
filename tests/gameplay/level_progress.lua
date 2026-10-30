-- Actual alternating-slot progress store: acknowledge before unlock, protect unknown/corrupt peers.
local files,encoded={},{};local serial,state,fail=0,'saved',false
sys={get_save_file=function(app,name)return app..'/'..name end,exists=function(p)return files[p]~=nil end,
 get_engine_info=function()return {is_debug=true}end,load=function(p)if files[p]=='bad' then error('bad slot') end;return files[p] or {}end,
 save=function(p,d)if fail then error('write failure') end;files[p]=d;return true end}
json={encode=function(t)serial=serial+1;encoded[tostring(serial)]=t;return tostring(serial)end,decode=function(t)assert(encoded[t]);return encoded[t]end}
require('main.gym.custom').sync_state=function()return state end
local P=require 'main.gym.level_progress';local C=require 'main.gym.course_catalog';local p=P.new();P.poll(p)
assert(C.unlocked(p.completed,'first-run') and not C.unlocked(p.completed,'rolling-hills'))
assert(not P.offer(p,'rolling-hills',true));assert(not P.offer(p,'first-run',false));assert(not P.offer(p,'custom',true))
assert(P.offer(p,'first-run',true));assert(not P.offer(p,'first-run',true));P.poll(p)
assert(not C.unlocked(p.completed,'rolling-hills'));state='syncing';P.poll(p);assert(not p.completed['first-run'])
state='saved';P.poll(p);assert(C.unlocked(p.completed,'rolling-hills'));assert(P.new().completed['first-run'])
assert(P.offer(p,'rolling-hills',true));P.poll(p);state='failed';P.poll(p);assert(p.blocked and not C.unlocked(p.completed,'ridge-run') and p.status=='Progress not saved')
files={};state='saved';p=P.new();P.poll(p);P.legacy(p,'first-run',{best=30,status='saved'});P.poll(p);P.poll(p);assert(C.unlocked(p.completed,'rolling-hills'))
assert(not P.offer(p,'first-run',true));assert(P.offer(p,'rolling-hills',true));P.poll(p);P.poll(p);assert(C.unlocked(p.completed,'ridge-run'));assert(C.next('ridge-run')==nil)
local a,b='rider/level-progress-a','rider/level-progress-b'
files[a]={format=1,seq=1,text=json.encode({version=1,completed={['first-run']=true}})}
for _,bad in ipairs({'bad',{}, {format=1,seq=2,text=json.encode({version=999,completed={}})}, {format=1,seq=2,text=json.encode({version=1,completed={['first-run']=false}})}})do
 files[b]=bad;local guarded=P.new();assert(guarded.blocked and guarded.completed['first-run']);assert(not P.offer(guarded,'rolling-hills',true));P.poll(guarded);assert(files[b]==bad)
end
files={};p=P.new();P.poll(p);fail=true;assert(P.offer(p,'first-run',true));P.poll(p);assert(p.blocked and not p.completed['first-run'])
files={};fail=false;state='syncing';p=P.new();P.poll(p);assert(p.checking);P.legacy(p,'first-run',{best=30,status='Checking storage'});assert(not p.desired['first-run']);state='saved';P.poll(p);assert(not p.checking)
assert(not P.parse(json.encode({version=1,completed={},future=true})))
print('PASS official sequential completion, duplicate/practice/locked rejection, acknowledgement/reopen, legacy adoption, failed write/sync and protected corrupt/future peers')
