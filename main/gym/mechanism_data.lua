-- O1: bounded typed crate/plate/gate data. Metres, seconds and SI motor force at the source boundary.
local M={MAX=8,MAX_LINKS=32,MAX_COORD=600,CRATE_HALF=.6,CRATE_MASS=8,PLATE_HALF=1.5,GATE_HALF=.3,GATE_HEIGHT=3,GUARD=1,FORCE=500}
local function finite(n) return type(n)=='number' and n==n and math.abs(n)<100000 end
local function point(p) return type(p)=='table' and #p==2 and finite(p[1]) and finite(p[2]) and math.abs(p[1])<=M.MAX_COORD and math.abs(p[2])<=M.MAX_COORD end
local function dense(t,max) if type(t)~='table' or #t>max then return false end;for k in pairs(t) do if type(k)~='number' or k%1~=0 or k<1 or k>#t then return false end end;return true end
local function fields(t,allowed) for k in pairs(t) do if not allowed[k] then return nil,'Unsupported mechanism field '..tostring(k),true end end;return true end
local function id(v) return type(v)=='string' and #v<=64 and v:match('^[a-z][a-z0-9%-]*$') and v~='vehicle' end
function M.extents(d)
 local a={};if not d then return a end
 for _,v in ipairs(d.crates) do a[#a+1]={v.position[1]-.9,v.position[1]+.9,v.position[2]-.9,v.position[2]+.9} end
 for _,v in ipairs(d.plates) do a[#a+1]={v.position[1]-(v.width or 3)/2,v.position[1]+(v.width or 3)/2,v.position[2]-.05,v.position[2]+.55} end
 for _,v in ipairs(d.gates) do a[#a+1]={v.position[1]-M.GUARD,v.position[1]+M.GUARD,v.position[2]-1.5,v.position[2]+1.5+v.travel} end
 return a
end
function M.validate(d,bounds)
 if d==nil then return true end
 if type(d)~='table' or d.version~=1 then return nil,'Unsupported mechanism version',true end
 local ok,err,unknown=fields(d,{version=true,crates=true,plates=true,gates=true,links=true});if not ok then return nil,err,unknown end
 local ids={vehicle='actor'}
 for _,kind in ipairs({'crates','plates','gates'}) do
  if not dense(d[kind],M.MAX) then return nil,'Mechanisms allow at most '..M.MAX..' '..kind end
  for _,v in ipairs(d[kind]) do
   if type(v)~='table' or not id(v.id) or ids[v.id] or not point(v.position) then return nil,'Invalid/duplicate mechanism ID or position (within 600 m)' end
   ids[v.id]=kind
   local allowed={id=true,position=true};if kind=='crates' then allowed.angle=true;allowed.mass=true;allowed.friction=true;allowed.restitution=true elseif kind=='plates' then allowed.width=true;allowed.actors=true;allowed.mode=true;allowed.pulse_seconds=true;allowed.initial_on=true elseif kind=='gates' then allowed.travel=true;allowed.speed=true;allowed.initial_open=true;allowed.condition=true end
   local supported,why,future=fields(v,allowed);if not supported then return nil,why,future end
   if kind=='crates' and v.angle~=nil and (not finite(v.angle) or math.abs(v.angle)>math.pi) then return nil,'Crate angle must be between -pi and pi radians' end
   if kind=='gates' and v.condition~=nil and v.condition~='any' and v.condition~='all' then return nil,'Gate input rule must be any or all' end
   if kind=='crates' and ((v.mass~=nil and (not finite(v.mass) or v.mass<1 or v.mass>40)) or (v.friction~=nil and (not finite(v.friction) or v.friction<0 or v.friction>1.5)) or (v.restitution~=nil and (not finite(v.restitution) or v.restitution<0 or v.restitution>.5))) then return nil,'Crate mass 1-40 kg, friction 0-1.5 and restitution 0-0.5 required' end
   if kind=='plates' and v.width~=nil and (not finite(v.width) or v.width<1 or v.width>8) then return nil,'Plate width must be 1-8 m' end
   if kind=='plates' and ((v.mode~=nil and v.mode~='pulse' and v.mode~='toggle' and v.mode~='hold') or (v.pulse_seconds~=nil and (not finite(v.pulse_seconds) or v.pulse_seconds<.1 or v.pulse_seconds>30)) or (v.initial_on~=nil and type(v.initial_on)~='boolean')) then return nil,'Plate mode must be pulse, toggle or hold; pulse duration 0.1-30 s' end
   if kind=='gates' and v.initial_open~=nil and type(v.initial_open)~='boolean' then return nil,'Gate initial_open must be boolean' end
   if kind=='gates' and (not finite(v.travel) or v.travel<3.5 or v.travel>6 or v.position[2]+v.travel>M.MAX_COORD or not finite(v.speed) or v.speed<.25 or v.speed>2) then return nil,'Gate travel must be 3.5-6 m; speed 0.25-2 m/s' end
  end
 end
 for _,v in ipairs(d.plates) do
  if not dense(v.actors,M.MAX+1) or #v.actors==0 then return nil,'Plate needs explicit accepted actor IDs' end
  local seen={};for _,actor in ipairs(v.actors) do if (actor~='vehicle' and ids[actor]~='crates') or seen[actor] then return nil,'Unknown/duplicate plate actor' end;seen[actor]=true end
 end
 if not dense(d.links,M.MAX_LINKS) then return nil,'At most '..M.MAX_LINKS..' plate-to-gate links' end
 local targets,pairs_seen={},{}
 for _,v in ipairs(d.links) do
  if type(v)~='table' then return nil,'Invalid mechanism link' end
  local supported,why,future=fields(v,{from=true,event=true,to=true,action=true});if not supported then return nil,why,future end
  if ids[v.from]~='plates' or ids[v.to]~='gates' or v.event~='active' or v.action~='open' or pairs_seen[v.from..'/'..v.to] then return nil,'Link must connect a distinct plate active output to a gate open input' end
  targets[v.to]=true;pairs_seen[v.from..'/'..v.to]=true
 end
 if bounds then for _,b in ipairs(M.extents(d)) do if b[1]<=bounds[1] or b[2]>=bounds[2] or b[3]<=bounds[3] or b[4]>=bounds[4] then return nil,'Mechanism or gate travel exceeds safety bounds' end end end
 return true
end
function M.cost(d)
 if not d then return {bodies=0,shapes=0,joints=0,sprites=0,vertices=0} end
 local c,p,g=#d.crates,#d.plates,#d.gates
 return {bodies=c+p+g,shapes=c+2*p+2*g,joints=g,sprites=3*c+p+3*g,vertices=4*(c+2*p+2*g)}
end
return M
