-- Fault injection at the resource adapter boundary; no physics mocks or second renderer.
local alive,objects,releases,deleted,fail,stage={}, {},0,0,nil,0
package.loaded['main.gym.stations']={decorate=function() return 0,0 end}
package.loaded.socket={gettime=function() return 0 end}
hash=function(v) return v end
sys={get_config_number=function() return .01 end,get_engine_info=function() return {is_debug=false} end}
vmath={vector3=function(...) return {...} end}
buffer={VALUE_TYPE_FLOAT32=1,create=function() return {} end,get_stream=function() return {} end,set_metadata=function() end}
resource={create_buffer=function(path)
    stage=stage+1;if fail=='create' and stage==3 then error('injected create failure') end
    assert(not alive[path]);alive[path]=true;return path
end,release=function(id) assert(alive[id]);alive[id]=nil;releases=releases+1 end}
factory={create=function() local id=#objects+1;objects[id]=true;return id end}
msg={url=function(_,id) return id end,post=function() end}
go={set=function() if fail=='bind' then error('injected bind failure') end end,delete=function(id) assert(objects[id]);objects[id]=false;deleted=deleted+1 end}
local mesh=require 'main.gym.terrain_mesh'
require('main.gym.terrain_residency').viewport=function() return nil end
local points={};for i=0,130 do points[#points+1]={i*.5,0} end
local d={id='ownership',chains={points},bounds={-10,80,-10,10}}
local self={session_generation=1}
mesh.build(self,d);assert(self.terrain_mesh.stats.chunks==3)
mesh.final(self);assert(releases==3 and not next(alive) and deleted==0)
mesh.final(self);assert(releases==3)
for _,f in ipairs({'create','bind'}) do
    stage,fail=0,f;local n=releases;local old_deleted=deleted
    local ok=pcall(mesh.build,self,d);assert(not ok)
    mesh.final(self,true);assert(not next(alive) and releases-n==(f=='create' and 2 or 1))
    assert(deleted-old_deleted==(f=='create' and 2 or 1))
    mesh.final(self,true);assert(not next(alive))
end
print('PASS: ownership release balance, idempotent final, partial create and bind failures; actual adapter, simulated engine boundary only')
