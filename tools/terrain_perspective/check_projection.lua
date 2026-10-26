-- Actual production geometry, encoded comparison body and coherent central projection.
local geom=require 'main.gym.terrain_geometry'
local proj=require 'main.terrain_perspective.projection'
local doc=require 'main.gym.editor_doc'
local budget=require 'main.gym.terrain_budget'
local function check(d)
 local es,stats=geom.describe(d)
 for _,e in ipairs(es) do
  local g=proj.section(e.prep,e.first,e.last,e.key)
  assert(g.vertices==e.vertices and g.bytes==g.vertices*48 and #g.look_data==g.vertices*3)
  for _,p in ipairs({proj.DEFAULT,{version=1,mode='perspective',width=2,perspective=1,angle=45,side=.25,shading=0},
      {version=1,mode='fixed',width=.25,perspective=1,angle=10,side=64,shading=1}}) do
   for _,cam in ipairs({{-1000,-400},{0,0},{250,50},{1000,400}}) do
    local bounds=proj.bounds(e.bounds,cam,p)
    for j=1,g.vertices do
     local k=(j-1)*3;local x,y,z=g.position[k+1],g.position[k+2],g.position[k+3]
     local depth=z>0 and p.width or 0
     if z<0 then
      depth=z< -1.5*.9 and p.width or 0
      if g.look_data[k+3]>0 then y=math.max(d.bounds[3]-g.origin[2],g.look_data[k+2]-p.side)
      else local t=math.min(p.side,.9)/.9;x=g.look_data[k+1]*(1-t)+x*t;y=g.look_data[k+2]*(1-t)+y*t end
     end
     x,y=x+g.origin[1],y+g.origin[2]
     local u,v=proj.project(x,y,depth,cam,p)
     assert(u>=bounds[1]-1e-8 and u<=bounds[3]+1e-8 and v>=bounds[2]-1e-8 and v<=bounds[4]+1e-8,'Clipped projected vertex')
     if depth==0 then assert(u==x and v==y,'Moved collision plane') end
     local againx,againy=proj.project(x,y,depth,cam,p);assert(againx==u and againy==v,'Stateful projection')
    end
   end
  end
 end
 return #es
end
for _,name in ipairs({'six-anchor','long-curves','mixed','long-over-budget'}) do
 local d=assert(doc.compile(dofile(arg[1]..'/'..name..'-source.lua')))
 local chunks=check(d)
 budget.COMPARISON=true;local r=assert(budget.check(d));assert(r.payload==r.vertices*48)
 assert(r.sections==chunks and r.cpu_estimate<budget.CPU)
 budget.COMPARISON=false
 print('PASS '..name..': '..chunks..' sections; collision plane invariant, exact 48 B stride, min/max controls and projected bounds')
end
local curl={};for i=0,100 do local a=i/100*math.pi*1.5;curl[#curl+1]={math.cos(a)*10,math.sin(a)*10} end
check({chains={curl},bounds={-20,20,-20,20}})
for _,bad in ipairs({{version=99},{version=1,mode='other'}, {version=1,mode='fixed',width=0/0}}) do assert(not proj.validate(bad)) end
local p=assert(proj.validate(proj.DEFAULT));p.extra=1;assert(not proj.validate(p))
local many={};for i=0,1212 do many[#many+1]={i*.5,0} end
budget.COMPARISON=true
assert(budget.check({chains={many}}))
many[#many+1]={606.5,0};local ok,err=budget.check({chains={many}});assert(not ok and err:find('terrain vertex payload',1,true))
budget.COMPARISON=false;assert(budget.check({chains={many}}),'Normal renderer must keep its existing admission')
print('PASS ribbon/overhang, invalid/version/NaN guards, deterministic reverse projection')
