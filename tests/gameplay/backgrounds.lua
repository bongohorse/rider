local model=require "main.backgrounds.model"
local function near(a,b) assert(math.abs(a-b)<1e-8,tostring(a).." vs "..tostring(b)) end
local config={enabled=true,layers={{image="grid",auto=false,depth=0.5},{visible=false,image="grid"}}}
local auto=assert(model.normalize({layers={{image="grid",depth=0.5,auto=true}}}))
for i,depth in ipairs({0.9,0.75,0.55,0.35,0.15,-0.1}) do near(model.depth(auto.layers[i],i),depth) end
assert(auto.layers[1].depth==0.5);auto.layers[1].auto=false;near(model.depth(auto.layers[1],1),0.5)
local normalized=assert(model.normalize(config));assert(model.active(normalized,1) and not model.active(normalized,2))
assert(model.normalize({layers={[7]={}}})==nil)
for _,depth in ipairs({-0.26,1.01,math.huge,0/0}) do assert(model.normalize({layers={{depth=depth}}})==nil) end
local frame={x=6,y=12,half_w=5,half_h=3,vehicle_low=10}
local rect=model.layout(frame,1);local uv=model.uv(frame,rect,normalized.layers[1],1,64,32)
near(uv[3],0.625);near(uv[4],.50625)
-- #605: steep, translated, flat and missing ranges; every active image intersects
-- both extremes and stays continuous, including outside the authored bounds.
for _,range in ipairs({{-120,120},{1000,1400},{7,7}}) do
 local f={x=6,y=range[1],half_w=5,half_h=3,level_min_y=range[1],level_max_y=range[2]}
 local previous=0
 for i=1,5 do
  local travel=0
  for _,y in ipairs({range[1]-1000,range[1],(range[1]+range[2])/2,range[2],range[2]+1000}) do
   f.y=y
   local a=model.uv(f,model.layout(f,i),auto.layers[i],i,64,32)
   assert(a[4]-a[2]<1 and a[4]+a[2]>0,"Steep layer image left viewport")
   assert(a[4]>.25 and a[4]<.75,"Viewport centre left image interior")
   f.y=y+1e-6;local b=model.uv(f,model.layout(f,i),auto.layers[i],i,64,32)
   assert(math.abs(a[4]-b[4])<1e-6,"Vertical jump")
   local manual={auto=false,depth=-.25};local c=model.uv(f,model.layout(f,i),manual,i,64,32)
   near(c[4],b[4]);near(c[3],f.x*1.25/24+.5)
   travel=math.max(travel,math.abs(a[4]-.5))
  end
  assert(travel>previous,"Near slots need more vertical travel");previous=travel
 end
 near(f.level_min_y,range[1]);near(f.level_max_y,range[2])
end
-- #603: camera Y and vehicle overlap must never crop or vertically shift the image.
for _,y in ipairs({-10000,-120,-4,-3,0,120,10000}) do
 frame.y=y;frame.vehicle_low=y-100
 local fg=model.layout(frame,6)
 near(fg.y-fg.half_h,y-frame.half_h);near(fg.half_h,frame.half_h)
 local tex=model.uv(frame,fg,normalized.layers[6],6,1024,512)
 near(tex[2],.5);near(tex[4],.5)
end
frame.y=12
-- Speed-dependent camera zoom must not slide the foreground sideways far from the origin.
do local far={x=300,y=0,half_w=8,half_h=4.5};local scroll={};local fg=normalized.layers[6]
 local a=model.uv(far,model.layout(far,6),fg,6,1024,512,scroll)
 far.half_w,far.half_h=8.08,4.545;local b=model.uv(far,model.layout(far,6),fg,6,1024,512,scroll);near(a[3],b[3])
 -- Screen-relative speed is the contract's 1-Depth of world speed at the current size.
 far.x=301;local c=model.uv(far,model.layout(far,6),fg,6,1024,512,scroll);near((c[3]-b[3])*(2*far.half_h*2),model.factor(fg,6)) end
-- Resource-owner model: components retain refs until the engine deletes their GOs.
local refs,objects,deleted,loads={}, {}, {}, {}
local function retain(id) if id then refs[id]=(refs[id] or 0)+1 end end
local function release(id) assert(refs[id] and refs[id]>0,"Double/foreign release");refs[id]=refs[id]-1 end
hash=function(x)return x end
buffer={VALUE_TYPE_FLOAT32=1,set_metadata=function()end,create=function()return {} end,get_stream=function(b,k)b[k]={};return b[k] end}
resource={create_buffer=function(path)assert(not refs[path]);refs[path]=1;return path end,
 create_texture=function(path)assert(not refs[path]);refs[path]=1;return path end,release=release}
image={TYPE_RGBA="rgba",load_buffer=function()return {type="rgba",width=64,height=32,buffer={}} end}
graphics={TEXTURE_TYPE_2D=1,TEXTURE_FORMAT_RGBA=1}
sys={load_resource=function(path)loads[path]=(loads[path] or 0)+1;if path=="missing" then return nil end;return path end}
vmath={vector3=function(...)return {...} end,vector4=function(...)return {...} end}
msg={url=function(_,id)return id end,post=function(id)assert(objects[id]) end}
local next_object=0
factory={STATUS_LOADED=1,create=function()next_object=next_object+1;objects[next_object]={};return next_object end,get_status=function()return 0 end,unload=function()end}
go={
 delete=function(id)assert(objects[id]);deleted[#deleted+1]=id end,
 set_position=function(_,id)assert(objects[id],"Foreign GO write") end,set_scale=function(_,id)assert(objects[id],"Foreign GO write") end}
-- Components retain the resource when the property is set.
local owner_release=resource.release
go.set=function(id,k,v)assert(objects[id]);if k=="vertices" or k=="texture0" then if objects[id][k] then owner_release(objects[id][k]) end;objects[id][k]=v;retain(v) end end
local function flush()
 for _,id in ipairs(deleted) do local o=objects[id];for _,k in ipairs({"vertices","texture0"}) do if o[k] then release(o[k]) end end;objects[id]=nil end
 deleted={}
end
local render=require "main.backgrounds.renderer"
local state=render.new(0.01)
render.update(state,frame);assert(next(refs)==nil,"Empty layer allocated")
assert(render.set(state,nil));local status=factory.get_status;factory.get_status=function()error("Empty renderer touched factory")end
render.update(state,frame);factory.get_status=status
assert(render.set(state,config));render.update(state,frame)
local report=render.report(state);assert(report.objects==1 and report.buffers==1 and report.texture_bytes==8192)
assert(not render.set(state,{enabled="yes"}));assert(state.config.enabled)
assert(render.enabled(state,false));render.update(state,frame);flush()
assert(render.report(state).objects==0 and render.report(state).buffers==0)
assert(state.config.layers[1].visible and not state.config.layers[2].visible)
for _,n in pairs(refs) do assert(n==0,"Disabled owner leak") end
assert(render.enabled(state,true));render.update(state,frame);assert(render.report(state).objects==1)
assert(config.layers[2].visible==false and config.enabled,"Input was mutated")
assert(render.visible(state,1,false));render.update(state,frame);flush();assert(render.report(state).objects==0)
assert(render.visible(state,1,true));render.update(state,frame);assert(render.report(state).objects==1)
-- Missing chosen image falls back; a missing fallback is safely omitted and not retried per frame.
assert(render.set(state,{layers={{image="missing",preset_image="grid"},{image="missing"}}}));render.update(state,frame);flush()
assert(render.report(state).objects==1 and state.errors[2]);local before=loads.missing
render.update(state,frame);assert(loads.missing==before)
-- Live OFF/ON never loses choices and releases each image exactly once.
for _=1,8 do render.enabled(state,false);render.update(state,frame);flush();render.enabled(state,true);render.update(state,frame) end
render.enabled(state,false);render.update(state,frame);flush()
for _,n in pairs(refs) do assert(n==0,"Live toggle resource leak") end
render.final(state)
print("PASS backgrounds: Depth, bounded foreground, atomic configuration, preserved choices and resource owners")

-- Cached world transforms may be a frame old. Rapid down/up poses must both be bounded.
local positions={chassis={x=0,y=50,z=0},rider={x=0,y=20,z=0},rear={x=-76,y=40,z=0},front={x=76,y=40,z=0}}
local cached={chassis={y=200},rider={y=220},rear={y=180},front={y=180}}
go.get_position=function(id)return positions[id]end
go.get_world_position=function(id)return cached[id]end
vmath.length=function(v)return math.sqrt(v.x*v.x+v.y*v.y+v.z*v.z)end
local bounds=require "main.backgrounds.vehicle_bounds"
local ids={chassis="chassis",rider="rider","rear","front"}
near(bounds.low(ids,0.01),-0.4)
positions.chassis.y,positions.rear.y,positions.front.y=200,180,180
cached.chassis.y,cached.rider.y,cached.rear.y,cached.front.y=50,70,30,30
assert(bounds.low(ids,0.01)<=-0.3+1e-8,"Rising interpolated vehicle escaped bound")
print("PASS background visual bound uses both immediate and prior poses")
