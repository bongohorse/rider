local coins=require 'main.gym.coins'
local visual=require 'main.gym.coin_visual'
local M={}
function M.reset(self)
    if not self.station or not self.station.coins then return end
    if not self.coins then
        self.coins=coins.new(self.station.coins);self.coin_ids={}
        for _,p in ipairs(self.coins.items) do self.coin_ids[p.id]=visual.create(p.position) end
    else coins.reset(self.coins) end
    for _,id in pairs(self.coin_ids) do msg.post(msg.url(nil,id,'sprite'),'enable') end
    self.coin_feedback=0;self.coin_attempt=(self.coin_attempt or 0)+1;self.coin_publish=true
end
function M.observe(self,state)
    local c=self.coins;if not c then return end
    local feel=require 'main.gym.feel'
    local parts={{feel.metres(state.x),feel.metres(state.y),radius=.65}}
    for _,body in ipairs(self.vehicle.wheels) do local p=b2d.body.get_position(body);parts[#parts+1]={feel.metres(p.x),feel.metres(p.y),radius=.22} end
    local active=self.race and self.race.state=='running' or not self.race and not self.finish_done and not self.paused
    local found=coins.observe(c,parts,active)
    for _,id in ipairs(found) do msg.post(msg.url(nil,self.coin_ids[id],'sprite'),'disable') end
    if #found>0 then self.coin_feedback=#found;self.coin_publish=true end
end
function M.finish(self,result)
    if not self.coins or not result then return end
    self.coin_publish=true
    result.coins=self.coins.count
    msg.post('main:/loader#script','coin_finish',{generation=self.session_generation,attempt=self.race.attempt,amount=result.coins,official=result.official})
end
function M.update(self)
    if not self.coins then return end
    local practice=not self.race or not self.race.official
    if practice~=self.coin_practice then self.coin_practice=practice;self.coin_publish=true end
    if not self.coin_publish then return end
    self.coin_publish=false
    msg.post('main:/loader#ui','coin_state',{generation=self.session_generation,attempt=self.coin_attempt,count=self.coins.count,total=#self.coins.items,
        feedback=self.coin_feedback,practice=practice,finished=self.finish_done or false})
    self.coin_feedback=0
end
return M
