-- Defold owns every body/world. This instance is called only by controller's existing attach/reset/fixed owner.
local data=require 'main.gym.mechanism_data'
local logic=require 'main.gym.mechanism_logic'
local M={}
local function scale() return sys.get_config_number('physics.scale',.01) end
local function at(p,z) local k=scale();return vmath.vector3(p[1]/k,p[2]/k,z or .2) end
local function tint(id,c) go.set(msg.url(nil,id,'sprite'),'tint',vmath.vector4(c[1],c[2],c[3],1)) end
local function line(ids,a,b,width,color,parent)
 local k=scale();local dx,dy=b[1]-a[1],b[2]-a[2]
 local id=factory.create('#line',at({(a[1]+b[1])/2,(a[2]+b[2])/2},.3),vmath.quat_rotation_z(math.atan2(dy,dx)))
 go.set_scale(vmath.vector3(math.sqrt(dx*dx+dy*dy)/(4*k),width/(4*k),1),id);tint(id,color);ids[#ids+1]=id
 if parent then go.set_parent(id,parent,false) end
 return id
end
local colors={crate={.65,.38,.16},plate={.3,.65,.75},gate={.8,.55,.2},active={.3,.9,.6},blocked={1,.3,.25}}
function M.spawn(spec)
 local s={spec=spec,logic=logic.new(spec),objects={},all={},decor={},crates={},plates={},gates={}}
 local ok,err=pcall(function()
  assert(math.abs(scale()-.01)<1e-6,'Mechanism resources require physics.scale 0.01')
  for _,kind in ipairs({'crates','plates','gates'}) do
   local singular=kind=='crates' and 'crate' or kind=='plates' and 'plate' or 'gate'
   for _,v in ipairs(spec[kind]) do
    local o={spec=v};o.id=factory.create('#mechanism_'..singular,at(v.position),vmath.quat_rotation_z(v.angle or 0));s.all[#s.all+1]=o.id;s.objects[v.id]=o;
    if singular=='plate' then go.set_scale(vmath.vector3((v.width or 3)/3,1,1),o.id) end
    s[kind][#s[kind]+1]=o;tint(o.id,colors[singular])
    if singular=='crate' then
     line(s.decor,{-.53,-.53},{.53,.53},.08,{.95,.72,.35},o.id);line(s.decor,{-.53,.53},{.53,-.53},.08,{.95,.72,.35},o.id)
    elseif singular=='gate' then
     for _,x in ipairs({-.2,.2}) do line(s.decor,{x,-1.45},{x,1.45},.05,{.95,.85,.55},o.id) end
    end
   end
  end
 end)
 if not ok then M.remove(s);error(err) end
 return s
end
local function rect(body,x,y,w,h)
 local k=scale();local pts={};for _,p in ipairs({{x-w,y-h},{x+w,y-h},{x+w,y+h},{x-w,y+h}}) do pts[#pts+1]=at(p,0) end
 local info=b2d.body.create_shape(body,{type=b2d.shape.SHAPE_TYPE_POLYGON,vertices=pts,sensor=true,density=0,filter={category_bits=1,mask_bits=1,group_index=0}})
 b2d.shape.enable_sensor_events(info.shape_id,true);return info.shape_id
end
local function joint(s,o)
 local k=scale();local origin=b2d.body.get_position(s.terrain);local p=at(o.spec.position,0)
 o.joint=b2d.joint.create_prismatic(s.terrain,o.body,{local_anchor_a=vmath.vector3(p.x-origin.x,p.y-origin.y,0),local_anchor_b=vmath.vector3(),local_axis_a=vmath.vector3(0,1,0),reference_angle=0,
  enable_limit=true,lower_translation=0,upper_translation=o.spec.travel/k,enable_motor=true,motor_speed=0,max_motor_force=data.FORCE/k,enable_spring=false,collide_connected=true})
 assert(b2d.joint.is_valid(o.joint),'Gate joint unavailable');assert(#b2d.body.get_joints(o.body)==1,'Gate joint leak')
end
function M.attach(s,terrain,vehicle)
 s.terrain=terrain;s.vehicle=vehicle
 for _,kind in ipairs({'crates','plates','gates'}) do for _,o in ipairs(s[kind]) do
  o.body=b2d.get_body(msg.url(nil,o.id,'body'));assert(b2d.body.is_valid(o.body),'Mechanism body unavailable')
  for _,shape in ipairs(b2d.body.get_shapes(o.body)) do b2d.shape.enable_sensor_events(shape.shape_id,true) end
 end end
 for _,body in ipairs({vehicle.chassis,vehicle.wheels[1],vehicle.wheels[2]}) do for _,shape in ipairs(b2d.body.get_shapes(body)) do b2d.shape.enable_sensor_events(shape.shape_id,true) end end
 for _,o in ipairs(s.crates) do
  local mass=o.spec.mass or data.CRATE_MASS;local md=b2d.body.get_mass_data(o.body);local ratio=mass/md.mass;md.mass=mass;md.inertia=md.inertia*ratio;b2d.body.set_mass_data(o.body,md)
  for _,shape in ipairs(b2d.body.get_shapes(o.body)) do b2d.shape.set_friction(shape.shape_id,o.spec.friction or .5);b2d.shape.set_restitution(shape.shape_id,o.spec.restitution or 0) end
  assert(math.abs(b2d.body.get_mass(o.body)-mass)<.01,'Crate mass differs from settings')
 end
 for _,o in ipairs(s.plates) do o.sensor=rect(o.body,0,.25,(o.spec.width or 3)/2,.3) end
 local carrier=s.plates[1];local origin=carrier and carrier.spec.position or {b2d.body.get_position(terrain).x*scale(),b2d.body.get_position(terrain).y*scale()}
 s.terrain_sensors=0;s.terrain_guards={}
 for _,o in ipairs(s.gates) do
  b2d.body.set_gravity_scale(o.body,0)
  o.guard=rect(carrier and carrier.body or terrain,o.spec.position[1]-origin[1],o.spec.position[2]+o.spec.travel/2-origin[2],data.GUARD,(data.GATE_HEIGHT+o.spec.travel)/2+.15)
  if not carrier then s.terrain_sensors=s.terrain_sensors+1;s.terrain_guards[#s.terrain_guards+1]=o.guard end
 end
 s.ready=true
end
function M.reset(s)
 for _,o in ipairs(s.gates) do if o.joint then local old=o.joint;b2d.joint.destroy(old);assert(not b2d.joint.is_valid(old),'Stale gate joint survived');o.joint=nil end end
 for _,id in ipairs(s.all) do local o;for _,v in pairs(s.objects) do if v.id==id then o=v;break end end
  b2d.body.set_active(o.body,false)
  local position={o.spec.position[1],o.spec.position[2]+(o.spec.travel and o.spec.initial_open and o.spec.travel or 0)}
  go.set_position(at(position),o.id);go.set_rotation(vmath.quat_rotation_z(o.spec.angle or 0),o.id);b2d.body.set_transform(o.body,at(position,0),o.spec.angle or 0)
  b2d.body.set_linear_velocity(o.body,vmath.vector3());b2d.body.set_angular_velocity(o.body,0)
  local p=b2d.body.get_position(o.body);local expected=at(position,0)
  assert(math.abs(p.x-expected.x)<.01 and math.abs(p.y-expected.y)<.01 and math.abs(b2d.body.get_angle(o.body)-(o.spec.angle or 0))<.005,'Noncanonical mechanism reset pose')
  assert(vmath.length(b2d.body.get_linear_velocity(o.body))<.001 and math.abs(b2d.body.get_angular_velocity(o.body))<.001,'Mechanism reset retained velocity')
  b2d.body.set_active(o.body,true)
 end
 for _,o in ipairs(s.crates) do b2d.body.set_awake(o.body,false);b2d.body.set_awake(o.body,true) end
 for _,o in ipairs(s.gates) do b2d.body.set_awake(o.body,false);b2d.body.set_awake(o.body,true);joint(s,o) end
 logic.reset(s.logic);s.skip=2;s.ticks=0;s.overlaps=0;s.peak_overlaps=0;s.occupants={};s.blocked={};s.positions={};s.publish=true
end
local function actor(s,body)
 if body==s.vehicle.chassis or body==s.vehicle.wheels[1] or body==s.vehicle.wheels[2] then return 'vehicle' end
 for _,o in ipairs(s.crates) do if body==o.body then return o.spec.id end end
end
local function overlaps(s,sensor)
 local found={}
 for _,shape in ipairs(b2d.shape.get_sensor_overlaps(sensor)) do
  s.overlaps=s.overlaps+1
  if b2d.shape.is_valid(shape.shape_id) and not b2d.shape.is_sensor(shape.shape_id) then
   local id=actor(s,b2d.shape.get_body(shape.shape_id));if id then found[id]=true end
  end
 end
 return found
end
function M.stop(s) for _,o in ipairs(s.gates) do b2d.joint.set_motor_speed(o.joint,0);local r=s.logic.gates[o.spec.id];if r.speed~=0 then r.state='stopped' end;r.speed=0 end end
function M.fixed(s,dt,active)
 if not active then M.stop(s);return end
 if s.skip>0 then s.skip=s.skip-1;return end
 s.overlaps=0;s.ticks=s.ticks+1
 for _,o in ipairs(s.plates) do s.occupants[o.spec.id]=overlaps(s,o.sensor) end
 for _,o in ipairs(s.gates) do s.blocked[o.spec.id]=next(overlaps(s,o.guard))~=nil;s.positions[o.spec.id]=(b2d.body.get_position(o.body).y*scale())-o.spec.position[2] end
 s.peak_overlaps=math.max(s.peak_overlaps,s.overlaps)
 logic.tick(s.logic,dt,s.occupants,s.blocked,s.positions)
 for _,o in ipairs(s.gates) do local r=s.logic.gates[o.spec.id];b2d.joint.set_motor_speed(o.joint,r.speed/scale());if r.speed~=0 then b2d.joint.wake_bodies(o.joint) end end
end
function M.state(s)
 local plates,gates,crates={},{},{}
 for _,o in ipairs(s.plates) do local r=s.logic.plates[o.spec.id];plates[#plates+1]={id=o.spec.id,pressed=r.pressed,active=r.active,mode=o.spec.mode or 'hold',count=r.count,serial=r.serial};tint(o.id,r.active and colors.active or colors.plate) end
 for _,o in ipairs(s.gates) do local r=s.logic.gates[o.spec.id];gates[#gates+1]={id=o.spec.id,state=r.state,open=r.open,blocked=r.blocked,height=b2d.joint.get_joint_translation(o.joint)*scale(),speed=r.speed,joints=#b2d.body.get_joints(o.body)};tint(o.id,r.blocked and colors.blocked or r.open and colors.active or colors.gate) end
 for _,o in ipairs(s.crates) do local p,v=b2d.body.get_position(o.body),b2d.body.get_linear_velocity(o.body);crates[#crates+1]={id=o.spec.id,x=p.x*scale(),y=p.y*scale(),angle=b2d.body.get_angle(o.body),vx=v.x*scale(),vy=v.y*scale(),mass=b2d.body.get_mass(o.body)} end
 return {generation=s.logic.generation,ticks=s.ticks,events=s.logic.events,plates=plates,gates=gates,crates=crates,overlaps=s.overlaps,peak_overlaps=s.peak_overlaps,cost=data.cost(s.spec)}
end
function M.remove(s)
 if s.terrain and b2d.body.is_valid(s.terrain) then
  for _,guard in ipairs(s.terrain_guards or {}) do
   for index,shape in ipairs(b2d.body.get_shapes(s.terrain)) do if shape.shape_id==guard then b2d.body.destroy_shape(s.terrain,index);break end end
  end
 end
 for _,id in ipairs(s.decor or {}) do go.delete(id) end
 for _,id in ipairs(s.all or {}) do go.delete(id) end
 s.objects={};s.all={};s.decor={};s.crates={};s.plates={};s.gates={};s.vehicle=nil;s.terrain=nil;s.ready=false
end
-- Read-only source extents in Edit; no bodies, sensors, actions or timers.
function M.preview(spec)
 local ids={};if not spec then return ids end
 for _,kind in ipairs({'crates','plates','gates'}) do for _,v in ipairs(spec[kind]) do
  local w,h=kind=='crates' and .6 or kind=='plates' and (v.width or 3)/2 or .3,kind=='crates' and .6 or kind=='plates' and .05 or 1.5
  local x,y=v.position[1],v.position[2];local pts={{x-w,y-h},{x+w,y-h},{x+w,y+h},{x-w,y+h}}
  if kind=='crates' and v.angle then local c,sn=math.cos(v.angle),math.sin(v.angle);for _,p in ipairs(pts) do local a,b=p[1]-x,p[2]-y;p[1]=x+a*c-b*sn;p[2]=y+a*sn+b*c end end
  for i,p in ipairs(pts) do line(ids,p,pts[i%4+1],.05,{.7,.85,.6}) end
  if kind=='gates' then line(ids,{x,y+h},{x,y+h+v.travel},.04,{.4,.7,1}) end
 end end
 return ids
end
return M
