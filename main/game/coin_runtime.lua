local coins=require 'main.gym.coins'
local visual=require 'main.gym.coin_visual'
local data=require 'main.gym.coin_data'
local M={}
function M.reset(self)
    require('main.gym.fuel_runtime').reset(self)
    if not self.station or not self.station.coins then return end
    if not self.coins then
        self.coins=coins.new(self.station.coins);self.coin_ids={}
        for _,p in ipairs(self.coins.items) do self.coin_ids[p.id]=visual.create(p.position,p.kind) end
    else coins.reset(self.coins) end
    for _,p in ipairs(self.coins.items) do
        local id=self.coin_ids[p.id];visual.position(id,p.position);visual.scale(id,p.kind,1);go.set(msg.url(nil,id,'sprite'),'tint',vmath.vector4(1,1,1,1))
        msg.post(msg.url(nil,id,'sprite'),'enable')
    end
    self.coin_effects={};self.coin_feedback=0;self.coin_attempt=(self.coin_attempt or 0)+1;self.coin_publish=true
end
function M.observe(self,state)
    local c=self.coins;if not c then return end
    local feel=require 'main.gym.feel'
    local parts={{feel.metres(state.x),feel.metres(state.y),radius=.65}}
    local head=require 'main.gym.rider'
    local offset=feel.metres(head.center_y)
    parts[#parts+1]={parts[1][1]-math.sin(state.angle)*offset,parts[1][2]+math.cos(state.angle)*offset,radius=feel.metres(head.radius)}
    for _,body in ipairs(self.vehicle.wheels) do local p=b2d.body.get_position(body);parts[#parts+1]={feel.metres(p.x),feel.metres(p.y),radius=.22} end
    local active=self.race and self.race.state=='running' or not self.race and not self.finish_done and not self.paused
    local before=c.count
    local found=coins.observe(c,parts,active)
    for _,id in ipairs(found) do
        for _,p in ipairs(c.items) do if p.id==id then if p.kind=='fuel' then require('main.gym.fuel').refill(self.fuel) end;self.coin_effects[id]={age=0,item=p};break end end
    end
    if #found>0 then self.coin_feedback=c.count-before;self.coin_publish=true end
end
function M.finish(self,result)
    if not self.coins or not result then return end
    self.coin_publish=true
    result.coins=self.coins.count
    local bitmap={};for _,p in ipairs(self.coins.items) do bitmap[#bitmap+1]=self.coins.taken[p.id] and '1' or '0' end
    msg.post('main:/loader#script','coin_finish',{generation=self.session_generation,attempt=self.race.attempt,amount=result.coins,official=result.official,gems=table.concat(bitmap)})
end
function M.update(self,dt)
    require('main.gym.fuel_runtime').update(self)
    if not self.coins then return end
    -- Presentation only: reuse collected sprites, bounded by the authored pickup cap.
    for key,e in pairs(self.coin_effects) do
        e.age=e.age+(dt or 0);local t=math.min(1,e.age/.48);local id=self.coin_ids[key]
        visual.position(id,{e.item.position[1],e.item.position[2]+.95*(1-(1-t)^2)})
        visual.scale(id,e.item.kind,1+.18*math.sin(t*math.pi))
        go.set(msg.url(nil,id,'sprite'),'tint',vmath.vector4(1,1,1,1-t*t))
        if t>=1 then msg.post(msg.url(nil,id,'sprite'),'disable');self.coin_effects[key]=nil end
    end
    local practice=not self.race or not self.race.official
    if practice~=self.coin_practice then self.coin_practice=practice;self.coin_publish=true end
    if not self.coin_publish then return end
    self.coin_publish=false
    local gold,gems=data.counts(self.coins.items)
    msg.post('main:/loader#ui','coin_state',{generation=self.session_generation,attempt=self.coin_attempt,count=self.coins.count,total=gold,gems=self.coins.gems,gem_total=gems,
        feedback=self.coin_feedback,practice=practice,finished=self.finish_done or false})
    self.coin_feedback=0
end
return M
