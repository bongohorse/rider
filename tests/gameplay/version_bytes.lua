-- Exercise the actual registry accounting: live AND retired slots, fresh physical sizes, one bridge call.
local idx={format=1,next=3,entries={{id=1,key=1,time=1,name='One',named=false,count=1}},garbage={2}}
local sizes={['rider/custom-versions-a']=100,['rider/custom-versions-b']=100,['rider/custom-version-1-a']=40,['rider/custom-version-1-b']=50,['rider/custom-version-2-a']=25,['rider/custom-version-2-b']=35}
local calls,reads,last=0,0,nil
sys={get_save_file=function(_,name)return 'rider/'..name end,load=function(path)if path:match('custom%-versions%-') then return {format=1,seq=1,text='index'} end;return {}end}
json={decode=function(text)assert(text=='index');return idx end,encode=function(paths)last=paths;return 'paths' end}
html5={run=function(code)calls=calls+1;local n=0;for _,path in ipairs(last)do if not sizes[path] then return nil end;n=n+sizes[path] end;return tostring(n)end}
io={open=function(path)reads=reads+1;if not sizes[path] then return nil end;return {seek=function()return sizes[path]end,close=function()end}end}
local H=require('main.gym.editor_versions').create(function()return {}end)
assert(H.bytes()==350 and calls==1 and reads==0 and #last==6)
sizes['rider/custom-version-1-a']=55;assert(H.bytes()==365 and calls==2 and reads==0,'must not cache physical sizes')
sizes['rider/custom-version-2-b']=nil;assert(H.bytes()==330 and calls==3 and reads==6,'missing metadata must fall back for the full set')
html5=nil;reads=0;assert(H.bytes()==330 and reads==6)
print('PASS batched registry/live/retired byte accounting, fresh sizes, whole-set missing-stat fallback and native path')
