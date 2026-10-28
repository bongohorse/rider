-- Per-attempt collection from observed vehicle-part sweeps, in metres. No simulation/render/storage.
local data=require 'main.gym.coin_data'
local M={}
function M.new(authored) return {items=authored and authored.items or {},taken={},count=0,previous=nil} end
function M.reset(c) c.taken={};c.count=0;c.previous=nil end
local function near(p,a,b,r)
    local dx,dy=b[1]-a[1],b[2]-a[2];local l=dx*dx+dy*dy
    local t=l>0 and math.max(0,math.min(1,((p[1]-a[1])*dx+(p[2]-a[2])*dy)/l)) or 0
    return (p[1]-a[1]-dx*t)^2+(p[2]-a[2]-dy*t)^2<=r*r
end
function M.observe(c,parts,active)
    local before=c.previous or parts;c.previous=parts
    local collected={}
    if not active then return collected end
    for _,coin in ipairs(c.items) do if not c.taken[coin.id] then
        for i,p in ipairs(parts) do
            if near(coin.position,before[i] or p,p,data.RADIUS+p.radius) then
                c.taken[coin.id]=true;c.count=c.count+1;collected[#collected+1]=coin.id;break
            end
        end
    end end
    return collected
end
return M
