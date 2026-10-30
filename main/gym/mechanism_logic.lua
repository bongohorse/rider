-- Typed occupancy events and motor decisions; never integrates physics or owns another clock.
local M={PRESS=.08,RELEASE=.15}
function M.new(spec)
 local s={spec=spec,generation=0};M.reset(s);return s
end
function M.reset(s)
 s.generation=s.generation+1;s.plates={};s.gates={};s.events=0;s.last_serial={}
 for _,p in ipairs(s.spec.plates) do s.plates[p.id]={pressed=false,candidate=false,age=0,serial=0,count=0,published=false,active=p.mode=='toggle' and p.initial_on==true or false,pulse=0} end
 for _,g in ipairs(s.spec.gates) do s.gates[g.id]={open=g.initial_open==true,speed=0,state=g.initial_open and 'open' or 'closed',blocked=false} end
end
function M.event(s,e)
 if e.generation~=s.generation or not s.plates[e.source] or e.event~='occupied' or type(e.active)~='boolean' or type(e.serial)~='number' or e.serial<1 or e.serial%1~=0 or e.serial<=(s.last_serial[e.source] or 0) then return false end
 s.last_serial[e.source]=e.serial;s.events=s.events+1
 for _,l in ipairs(s.spec.links) do if l.from==e.source then s.gates[l.to].open=e.active end end
 return true
end
function M.tick(s,dt,occupants,blocked,positions)
 assert(type(dt)=='number' and dt>0 and dt<1)
 for _,p in ipairs(s.spec.plates) do
  local r=s.plates[p.id];local n=0;for _,id in ipairs(p.actors) do if (occupants[p.id] or {})[id] then n=n+1 end end;r.count=n
  local candidate=n>0
  if candidate~=r.candidate then r.candidate=candidate;r.age=0 end
  r.age=r.age+dt
  if candidate~=r.pressed and r.age>=(candidate and M.PRESS or M.RELEASE) then
   r.pressed=candidate
   local mode=p.mode or 'hold'
   if mode=='hold' then r.active=candidate
   elseif mode=='toggle' and candidate then r.active=not r.active
   elseif mode=='pulse' and candidate then r.active=true;r.pulse=p.pulse_seconds or 4;r.emit=true end
  end
  if (p.mode or 'hold')=='pulse' and r.pulse>0 then r.pulse=math.max(0,r.pulse-dt);if r.pulse==0 then r.active=false end end
  if r.published~=r.active or r.emit then
   r.emit=nil;r.published=r.active;r.serial=r.serial+1;M.event(s,{generation=s.generation,source=p.id,event='occupied',active=r.active,serial=r.serial})
  end
 end
 for _,g in ipairs(s.spec.gates) do
  local r=s.gates[g.id];local remaining=(r.open and g.travel or 0)-(positions[g.id] or 0)
  r.blocked=blocked[g.id]==true and math.abs(remaining)>.015
  r.speed=r.blocked and 0 or math.abs(remaining)<=.015 and 0 or math.max(-g.speed,math.min(g.speed,remaining/dt))
  r.state=r.blocked and 'blocked' or r.speed>0 and 'opening' or r.speed<0 and 'closing' or r.open and 'open' or 'closed'
 end
end
return M
