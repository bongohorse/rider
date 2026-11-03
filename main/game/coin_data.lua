-- Gold and Wonder Gem pickups. Authored metres; no body, sensor or general object/event engine.
local M={MAX=128,RADIUS=.25,GEM_RADIUS=.36}
function M.radius(p) return (p.kind=='gem' or p.kind=='fuel') and M.GEM_RADIUS or M.RADIUS end
function M.counts(items)
    local gold,gems=0,0
    for _,p in ipairs(items or {}) do if p.type==nil or p.type=='coin' then if p.kind=='gem' then gems=gems+1 elseif p.kind~='fuel' then gold=gold+1 end end end
    return gold,gems
end
function M.id(id) return type(id)=='string' and #id<=64 and id:match('^[a-z][a-z0-9%-]*$')~=nil end
function M.point(p) return type(p)=='table' and #p==2 and type(p[1])=='number' and type(p[2])=='number' and p[1]==p[1] and p[2]==p[2] and math.abs(p[1])<100000 and math.abs(p[2])<100000 end
function M.validate(c,bounds)
    if c==nil then return true end
    if type(c)~='table' or (c.version~=1 and c.version~=2 and c.version~=3) then return nil,'Unsupported coin pickup version',true end
    for k in pairs(c) do if k~='version' and k~='items' then return nil,'Unsupported coin pickup field '..tostring(k),true end end
    if type(c.items)~='table' or #c.items>M.MAX then return nil,'Combined coin pickup limit is '..M.MAX end
    for k in pairs(c.items) do if type(k)~='number' or k%1~=0 or k<1 or k>#c.items then return nil,'Coin items must be a dense list' end end
    local seen={}
    for _,p in ipairs(c.items) do
        if type(p)~='table' or not M.id(p.id) or seen[p.id] or not M.point(p.position) then return nil,'Invalid/duplicate coin pickup ID or position' end
        if p.kind~=nil and not (p.kind=='gem' and c.version>=2 or p.kind=='fuel' and c.version>=3) then return nil,'Unsupported pickup kind/version',true end
        if p.content~=nil then return nil,'Canister refill is configured once for the course',true end
        for k in pairs(p) do if k~='id' and k~='position' and k~='kind' then return nil,'Unsupported coin pickup item field '..tostring(k),true end end
        seen[p.id]=true
        local x,y=p.position[1],p.position[2]
        if bounds and (x<=bounds[1] or x>=bounds[2] or y<=bounds[3] or y>=bounds[4]) then return nil,'Coin '..p.id..' is outside safety bounds' end
    end
    return true
end
return M
