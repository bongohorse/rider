-- #480: an unreadable official course is left out of the level menu instead of stopping the loader.
local files,encoded={},{};local serial=0
sys={get_save_file=function(app,name)return app..'/'..name end,exists=function(p)return files[p]~=nil end,
 get_engine_info=function()return {is_debug=true}end,load=function(p)return files[p] or {}end,
 save=function(p,d)files[p]=d;return true end}
json={encode=function(t)serial=serial+1;encoded[tostring(serial)]=t;return tostring(serial)end,decode=function(t)return encoded[t]end}
html5=nil
local logged={}
local real_print=print
print=function(...)local parts={};for i=1,select('#',...)do parts[#parts+1]=tostring(select(i,...))end;logged[#logged+1]=table.concat(parts,' ')end
require('main.game.custom').sync_state=function()return 'saved' end

local function course(id)
  return {id=id,name=id..' name',chains={{{0,0},{10,0},{20,1}}},coins={version=3,items={{id='g1',kind='gem',position={1,1}}}}}
end
local unavailable={}
package.loaded['main.game.stations']={resource=function(id)
  if unavailable[id] then return nil,'Station id mismatch' end
  return course(id)
end}
local L=require 'main.game.levels_runtime'
local C=require 'main.game.course_catalog'
local function self_at(station,finished)
  return {station=station,level_finished=finished,loading=false,coin_bank={claims={}}}
end
local function view(t,self)
  for _=1,3 do L.poll(t,self,.1) end
  return L.view
end

-- All courses readable: every catalogue course is listed in order, nothing is logged.
local t=L.new()
local v=view(t,self_at('first-run',false))
assert(#v.courses==#C.ids,'every readable course is listed')
for i,id in ipairs(C.ids) do assert(v.courses[i].id==id,'catalogue order kept') end
assert(#logged==0,'no error for readable courses')

-- The middle course is unreadable: no crash, it is left out and logged once with its cause.
unavailable['rolling-hills']=true;logged={}
local ok,broken=pcall(L.new)
assert(ok,'an unreadable course must not stop the loader: '..tostring(broken))
v=view(broken,self_at('first-run',true))
assert(#v.courses==#C.ids-1,'the unreadable course is left out')
for _,c in ipairs(v.courses) do assert(c.id~='rolling-hills') end
assert(#logged==1 and logged[1]:find('^ERROR:LEVELS: course rolling%-hills is unavailable: Station id mismatch'),'logged loudly: '..tostring(logged[1]))
-- Next Level never points at an unavailable course.
assert(v.next_id=='' and v.next_enabled==false,'next level skips an unavailable course')
-- Records and the remaining courses keep working.
assert(broken.records['first-run'] and broken.records['ridge-run'] and not broken.records['rolling-hills'])

print=real_print
print('PASS levels runtime: an unreadable official course is left out and logged; the loader and the other courses keep working')
