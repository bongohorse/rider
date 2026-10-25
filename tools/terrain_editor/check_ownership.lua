-- Actual editor planner + production adapter; simulated engine boundary only, no physics mocks.
local alive,created,sets,fail={},0,0,false
package.loaded['main.gym.stations']={decorate=function() return 0,0 end}
package.loaded.socket={gettime=function() return 0 end}
hash=function(v) return v end
sys={get_config_number=function() return .01 end,get_engine_info=function() return {is_debug=false} end}
vmath={vector3=function(...) return {...} end,vector4=function(...) return {...} end}
buffer={VALUE_TYPE_FLOAT32=1,create=function() return {streams={}} end,get_stream=function(b,n) b.streams[n]=b.streams[n] or {};return b.streams[n] end,set_metadata=function() end}
resource={create_buffer=function(path,args) assert(not alive[path]);alive[path]=args.buffer;created=created+1;return path end,
 get_buffer=function(id) return assert(alive[id]) end,
 set_buffer=function(id,b) assert(alive[id]);if fail then error('injected update failure') end;alive[id]=b;sets=sets+1 end,
 release=function(id) assert(alive[id]);alive[id]=nil end}
local next_id=0
factory={create=function() next_id=next_id+1;return next_id end}
msg={url=function(_,id) return id end,post=function() end}
go={set=function() end,set_position=function() end,delete=function() end}
local terrain=require 'main.gym.editor_terrain'
local doc=require 'main.gym.editor_doc'
local e=dofile(arg[1]..'/six-anchor-source.lua').editor
local state=terrain.create()
local first=assert(terrain.update(state,e,nil,{},nil,7));assert(first.chunks==11 and created==11)
local paths={};for _,entry in ipairs(state.entries) do paths[entry.path]=true end
local same=assert(terrain.update(state,e,nil,{},nil,7));assert(same.rebuilt==0 and same.reused==11 and created==11 and sets==0)
local changed=doc.copy(e.objects[1]);changed.anchors[4].out[2]=changed.anchors[4].out[2]+1
local local_=assert(terrain.update(state,e,{o1=changed},{},nil,7));assert(local_.rebuilt==3 and local_.reused==8 and created==11)
for _,entry in ipairs(state.entries) do assert(paths[entry.path],'Unnecessary buffer replacement') end
local selection=assert(terrain.update(state,e,{o1=changed},{o1=true},nil,7))
assert(selection.rebuilt==0 and selection.recolored==11 and created==11)
fail=true
local failed=pcall(terrain.update,state,e,nil,{},nil,7);assert(not failed)
terrain.final(state,true);assert(not next(alive))
terrain.final(state,true);assert(not next(alive))
-- The same downstream samples may start at a different index after upstream resampling.
-- Recoloring must use their new owner indices, including both physical end caps.
local mesh=require 'main.gym.terrain_mesh'
local geom=require 'main.gym.terrain_geometry'
fail=false
local c=geom.section(geom.prepare({{0,0},{1,0},{2,0}},-2),1,3,'shifted',true,{})
local entry={};mesh.upload(entry,c,'/shifted.bufferc')
mesh.colors(entry,{[7]=-1,[8]=1},7)
local col=alive[entry.resource].streams.color
for _,g in ipairs(c.color_groups) do
 for i=g.first,g.last do
  local k=(i-1)%4+1;local expected=c.base_colors[i]
  if g.interval==1 and k==4 then expected=0
  elseif g.interval==2 and k<4 then expected=expected*({1.6,.95,.5})[k] end
  assert(col[i]==expected,'Retained section used stale interval owner during recolor')
 end
end
mesh.drop(entry,true);assert(not next(alive))
print('PASS: initial 11 resources; idle retains 11; tangent updates 3/reuses 8 with same resource identities; selection recolors without geometry; failed upload cleanup balances all resources')
print('PASS: shifted retained section uses new selection/hidden owner indices, including end caps')
