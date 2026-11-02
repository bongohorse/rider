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
state='syncing';local protected=P.new();assert(protected.blocked and not protected.checking,'protected storage must not leave the known catalogue in endless checking');state='saved'
files={};p=P.new();P.poll(p);fail=true;assert(P.offer(p,'first-run',true));P.poll(p);assert(p.blocked and not p.completed['first-run'])
files={};fail=false;state='syncing';p=P.new();P.poll(p);assert(p.checking);P.legacy(p,'first-run',{best=30,status='Checking storage'});assert(not p.desired['first-run']);state='saved';P.poll(p);assert(not p.checking)
assert(not P.parse(json.encode({version=1,completed={},future=true})))
-- A valid IndexedDB snapshot may arrive only after new() observed empty memory.
-- All acknowledged completions must be adopted before a queued finish can be flushed.
files={};state='syncing';p=P.new();assert(p.checking)
assert(P.offer(p,'first-run',true))
local restored_all={['first-run']=true,['rolling-hills']=true,['ridge-run']=true}
files[a]={format=1,seq=1,text=json.encode({version=1,completed=restored_all})}
local original=files[a];state='saved';P.poll(p)
assert(not p.blocked and not p.checking and p.status=='saved' and not p.pending)
assert(p.completed['first-run'] and p.completed['rolling-hills'] and p.completed['ridge-run'])
assert(p.desired['first-run'] and p.desired['rolling-hills'] and p.desired['ridge-run'])
assert(files[a]==original and files[b]==nil,'late restore must not be overwritten')
assert(P.new().completed['ridge-run'] and not P.offer(p,'ridge-run',true))
-- A late corrupt/unsupported peer is protected even if another slot is valid.
for _,bad in ipairs({'bad',{format=1,seq=2,text=json.encode({version=999,completed={}})}}) do
 files={};state='syncing';local t=P.new();assert(P.offer(t,'first-run',true))
 files[a]={format=1,seq=1,text=json.encode({version=1,completed=restored_all})}
 files[b]=bad;state='saved';P.poll(t)
 assert(t.blocked and not t.pending and t.status=='Progress protected')
 assert(not P.offer(t,'rolling-hills',true) and files[b]==bad)
end
-- Initial sync errors must prevent any new save.
files={};state='syncing';p=P.new();assert(P.offer(p,'first-run',true))
state='failed';P.poll(p);assert(p.blocked and p.status=='Progress not saved' and not files[a] and not files[b])
-- A legitimate late restore may still accept a new *additional* official completion.
files={};state='syncing';p=P.new()
files[a]={format=1,seq=1,text=json.encode({version=1,completed={['first-run']=true,['rolling-hills']=true}})}
state='saved';P.poll(p)
assert(p.completed['rolling-hills'] and P.offer(p,'ridge-run',true))
P.poll(p);assert(p.pending and files[b]);P.poll(p)
assert(p.completed['ridge-run'] and P.new().completed['ridge-run'])
print('PASS official sequential completion, duplicate/practice/locked rejection, acknowledgement/reopen, legacy adoption, failed write/sync and protected corrupt/future peers')
